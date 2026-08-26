import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireGoogleIdentity } from "@/lib/auth/identity";
import { toBookingFailure, type BookingFailure } from "@/lib/booking/action-utils";
import { getImmediateBookingWindow } from "@/lib/booking/schedule";
import { cancelSheetBooking, createSheetBooking } from "@/lib/booking/sheet-repository";
import { getGoogleRuntimeConfig } from "@/lib/google/config";
import { parseBookings, parseMachines, parseSettings } from "@/lib/google/sheet-schema";
import type { SheetBooking, SheetMachine, SheetSettings } from "@/lib/google/sheet-types";
import { createGoogleSheetsClient } from "@/lib/google/sheets-client";

export type PublicMachineOption = { id: string; machineCode: string; machineName: string; location: string | null; available: boolean };
export type PublicBookingOptions = { date: string; startAt: string | null; endAt: string | null; machines: PublicMachineOption[] };
export type CreatedBooking = { bookingId: string; bookingNumber: string; manageCode: string; timelockUsername: string; timelockPassword: string; machineCode: string; startAt: string; endAt: string; status: string };
export type ManagedBooking = { bookingId: string; bookingNumber: string; machineCode: string; machineName: string; location: string | null; startAt: string; endAt: string; status: string; canCancel: boolean };
export type BookingActionResult<T = undefined> = { ok: true; data: T; message?: string } | BookingFailure;

function sheets() { return createGoogleSheetsClient({ spreadsheetId: getGoogleRuntimeConfig().spreadsheetId }); }

async function readBookingData() {
  const client = sheets();
  const [settingsRows, machineRows, bookingRows] = await Promise.all([client.readSheet("Settings"), client.readSheet("Machines"), client.readSheet("Bookings")]);
  return { settings: parseSettings(settingsRows), machines: parseMachines(machineRows), bookings: parseBookings(bookingRows) };
}

function active(booking: SheetBooking) { return !["cancelled", "expired", "completed"].includes(booking.status); }
function overlaps(booking: SheetBooking, startAt: string, endAt: string) { return active(booking) && new Date(booking.startAt).getTime() < new Date(endAt).getTime() && new Date(startAt).getTime() < new Date(booking.endAt).getTime(); }

function bookingOptions(date: string, machines: SheetMachine[], bookings: SheetBooking[], now = new Date()): PublicBookingOptions {
  const window = getImmediateBookingWindow(now);
  const isCurrentDate = window?.date === date;
  return {
    date,
    startAt: isCurrentDate ? window.startAt : null,
    endAt: isCurrentDate ? window.endAt : null,
    machines: machines.map((machine) => ({
      id: machine.machineId,
      machineCode: machine.machineCode,
      machineName: machine.machineName,
      location: machine.location,
      available: machine.status === "available" && isCurrentDate && !bookings.some((booking) => booking.machineId === machine.machineId && overlaps(booking, window.startAt, window.endAt)),
    })),
  };
}

export async function getPublicBookingOptions(date: string): Promise<BookingActionResult<PublicBookingOptions>> {
  try { const { machines, bookings } = await readBookingData(); return { ok: true, data: bookingOptions(date, machines, bookings) }; }
  catch (error) { return toBookingFailure(error); }
}

export async function createImmediateBooking(input: { machineId: string }): Promise<BookingActionResult<CreatedBooking>> {
  try {
    const identity = await requireGoogleIdentity();
    const window = getImmediateBookingWindow(new Date(), 180);
    if (!window) return toBookingFailure(new Error("BOOKING_CROSSES_MIDNIGHT"));
    const data = await createSheetBooking({ machineId: input.machineId, startAt: window.startAt, endAt: window.endAt, idempotencyKey: randomUUID() }, identity);
    return { ok: true, data: { ...(data as CreatedBooking), startAt: window.startAt, endAt: window.endAt, status: "confirmed" }, message: "จองเครื่องสำเร็จ" };
  } catch (error) { return toBookingFailure(error); }
}

function managementHash(code: string) { return createHash("sha256").update(code).digest("hex"); }

export async function getManagedBooking(bookingNumber: string, manageCode: string): Promise<BookingActionResult<ManagedBooking>> {
  try {
    const { machines, bookings } = await readBookingData();
    const booking = bookings.find((row) => row.bookingNumber === bookingNumber && row.manageCodeHash === managementHash(manageCode));
    if (!booking) return toBookingFailure(new Error("BOOKING_ACCESS_DENIED"));
    const machine = machines.find((row) => row.machineId === booking.machineId);
    return { ok: true, data: { bookingId: booking.bookingId, bookingNumber: booking.bookingNumber, machineCode: booking.machineCode, machineName: machine?.machineName ?? booking.machineCode, location: machine?.location ?? null, startAt: booking.startAt, endAt: booking.endAt, status: booking.status, canCancel: active(booking) } };
  } catch (error) { return toBookingFailure(error); }
}

export async function cancelManagedBooking(bookingNumber: string, manageCode: string): Promise<BookingActionResult<undefined>> {
  try { const identity = await requireGoogleIdentity(); await cancelSheetBooking({ bookingNumber, manageCode, idempotencyKey: randomUUID() }, identity); revalidatePath("/booking"); revalidatePath("/my-bookings"); return { ok: true, data: undefined, message: "ยกเลิกการจองแล้ว" }; }
  catch (error) { return toBookingFailure(error); }
}
