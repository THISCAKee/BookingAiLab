import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireGoogleIdentity } from "@/lib/auth/identity";
import { toBookingFailure, type BookingFailure } from "@/lib/booking/action-utils";
import {
  deriveMachineQueueOption,
  isEffectiveBooking,
  viewerHasEffectiveBooking,
  type QueueMachineOption,
} from "@/lib/booking/queue-policy";
import { getSelectableBookingDates } from "@/lib/booking/schedule";
import { cancelSheetBookingByOwner, createSheetBooking } from "@/lib/booking/sheet-repository";
import { getGoogleRuntimeConfig } from "@/lib/google/config";
import { parseBookings, parseMachines } from "@/lib/google/sheet-schema";
import type { SheetBooking, SheetMachine } from "@/lib/google/sheet-types";
import { createGoogleSheetsClient } from "@/lib/google/sheets-client";
import { parseTimelockEvents } from "@/lib/timelock/sheet-records";
import { parseTimelockUsers } from "@/lib/timelock/sheet-records";
import { decryptTimelockPassword } from "@/lib/timelock/password-vault";

export type PublicMachineOption = {
  id: string;
  machineCode: string;
  machineName: string;
  location: string | null;
} & QueueMachineOption;
export type PublicBookingOptions = {
  date: string;
  viewerCanBook: boolean;
  viewerBlockReason: "BOOKING_ALREADY_ACTIVE" | "BOOKING_DATE_NOT_ALLOWED" | null;
  viewerBookingEndAt: string | null;
  viewerBookingStarted: boolean;
  machines: PublicMachineOption[];
};
export type CreatedBooking = { bookingId: string; bookingNumber: string; timelockUsername: string; timelockPassword: string; machineCode: string; startAt: string; endAt: string; status: string };
export type ManagedBooking = { bookingId: string; bookingNumber: string; machineCode: string; machineName: string; location: string | null; startAt: string; endAt: string; status: string; canCancel: boolean };
export type ViewerBooking = ManagedBooking & { timelockUsername: string; timelockPassword: string | null };
export type BookingActionResult<T = undefined> = { ok: true; data: T; message?: string } | BookingFailure;

function sheets() { return createGoogleSheetsClient({ spreadsheetId: getGoogleRuntimeConfig().spreadsheetId }); }

async function readBookingData() {
  const client = sheets();
  const [machineRows, bookingRows] = await Promise.all([client.readSheet("Machines"), client.readSheet("Bookings")]);
  return { machines: parseMachines(machineRows), bookings: parseBookings(bookingRows) };
}

async function readPublicBookingData() {
  const client = sheets();
  const [machineRows, bookingRows, eventRows] = await Promise.all([
    client.readSheet("Machines"),
    client.readSheet("Bookings"),
    client.readSheet("Events"),
  ]);
  const startedBookingIds = new Set(
    parseTimelockEvents(eventRows)
      .filter((event) => event.eventType === "session_started")
      .map((event) => event.bookingId),
  );
  return {
    machines: parseMachines(machineRows),
    bookings: parseBookings(bookingRows),
    startedBookingIds,
  };
}

function active(booking: SheetBooking) { return !["cancelled", "expired", "completed"].includes(booking.status); }

export function buildPublicBookingOptions(input: {
  date: string;
  machines: SheetMachine[];
  bookings: SheetBooking[];
  startedBookingIds: ReadonlySet<string>;
  viewerEmail: string;
  now: Date;
}): PublicBookingOptions {
  const isCurrentDate = getSelectableBookingDates(input.now)[0].value === input.date;
  const viewerBookings = input.bookings.filter((booking) =>
    booking.email.trim().toLowerCase() === input.viewerEmail.trim().toLowerCase()
    && isEffectiveBooking(booking, input.now));
  const viewerHasBooking = viewerHasEffectiveBooking({
    bookings: input.bookings,
    email: input.viewerEmail,
    now: input.now,
  });
  return {
    date: input.date,
    viewerCanBook: isCurrentDate && !viewerHasBooking,
    viewerBlockReason: !isCurrentDate
      ? "BOOKING_DATE_NOT_ALLOWED"
      : viewerHasBooking ? "BOOKING_ALREADY_ACTIVE" : null,
    viewerBookingEndAt: viewerBookings.length > 0
      ? viewerBookings.reduce((latest, booking) =>
        new Date(booking.endAt).getTime() > new Date(latest).getTime() ? booking.endAt : latest,
      viewerBookings[0].endAt)
      : null,
    viewerBookingStarted: viewerBookings.some((booking) => input.startedBookingIds.has(booking.bookingId)),
    machines: input.machines.map((machine) => ({
      id: machine.machineId,
      machineCode: machine.machineCode,
      machineName: machine.machineName,
      location: machine.location,
      ...(isCurrentDate
        ? deriveMachineQueueOption({
            machine,
            bookings: input.bookings,
            startedBookingIds: input.startedBookingIds,
            now: input.now,
          })
        : {
            operationalStatus: "full_today" as const,
            bookable: false,
            nextStartAt: null,
            nextEndAt: null,
            queueCount: 0,
            currentEndAt: null,
            currentRemainingMinutes: null,
          }),
    })),
  };
}

export async function getPublicBookingOptions(date: string): Promise<BookingActionResult<PublicBookingOptions>> {
  try {
    const [identity, { machines, bookings, startedBookingIds }] = await Promise.all([
      requireGoogleIdentity(),
      readPublicBookingData(),
    ]);
    return {
      ok: true,
      data: buildPublicBookingOptions({
        date,
        machines,
        bookings,
        startedBookingIds,
        viewerEmail: identity.email,
        now: new Date(),
      }),
    };
  }
  catch (error) { return toBookingFailure(error); }
}

export async function createImmediateBooking(input: { machineId: string }): Promise<BookingActionResult<CreatedBooking>> {
  try {
    const identity = await requireGoogleIdentity();
    const data = await createSheetBooking({ machineId: input.machineId, idempotencyKey: randomUUID() }, identity);
    return { ok: true, data: data as CreatedBooking, message: "จองเครื่องสำเร็จ" };
  } catch (error) { return toBookingFailure(error); }
}

export async function getViewerBookings(): Promise<BookingActionResult<ViewerBooking[]>> {
  try {
    const identity = await requireGoogleIdentity();
    const client = sheets();
    const [machineRows, bookingRows, userRows] = await Promise.all([
      client.readSheet("Machines"),
      client.readSheet("Bookings"),
      client.readSheet("Users"),
    ]);
    const machines = parseMachines(machineRows);
    const bookings = parseBookings(bookingRows);
    const users = parseTimelockUsers(userRows);
    const viewerBookings = bookings
      .filter((booking) => booking.email.toLowerCase() === identity.email.toLowerCase() && active(booking))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((booking) => {
        const machine = machines.find((row) => row.machineId === booking.machineId);
        return {
          bookingId: booking.bookingId,
          bookingNumber: booking.bookingNumber,
          machineCode: booking.machineCode,
          machineName: machine?.machineName ?? booking.machineCode,
          location: machine?.location ?? null,
          startAt: booking.startAt,
          endAt: booking.endAt,
          status: booking.status,
          canCancel: active(booking),
          timelockUsername: booking.emailPrefix,
          timelockPassword: (() => {
            const user = users.find((row) => row.sourceBookingId === booking.bookingId && row.email.toLowerCase() === identity.email.toLowerCase());
            if (!user?.passwordCiphertext) return null;
            try { return decryptTimelockPassword(user.passwordCiphertext); } catch { return null; }
          })(),
        };
      });
    return { ok: true, data: viewerBookings };
  } catch (error) { return toBookingFailure(error); }
}

export async function cancelViewerBooking(bookingId: string): Promise<BookingActionResult<undefined>> {
  try {
    const identity = await requireGoogleIdentity();
    const { bookings } = await readBookingData();
    const booking = bookings.find((row) => row.bookingId === bookingId && row.email.toLowerCase() === identity.email.toLowerCase());
    if (!booking) return toBookingFailure(new Error("BOOKING_ACCESS_DENIED"));
    if (!active(booking)) return toBookingFailure(new Error("BOOKING_CANCELLATION_NOT_ALLOWED"));
    await cancelSheetBookingByOwner({ bookingId, idempotencyKey: randomUUID() }, identity);
    revalidatePath("/booking");
    revalidatePath("/my-bookings");
    return { ok: true, data: undefined, message: "ยกเลิกการจองแล้ว" };
  } catch (error) { return toBookingFailure(error); }
}
