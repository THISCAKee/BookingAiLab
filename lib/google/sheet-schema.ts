import type { BookingStatus, MachineStatus, SheetBooking, SheetMachine } from "@/lib/google/sheet-types";

export const MACHINE_HEADERS = [
  "machineId", "machineCode", "machineName", "location", "status", "deviceTokenHash", "lastSeenAt", "updatedAt",
] as const;
export const BOOKING_HEADERS = [
  "bookingId", "bookingNumber", "email", "name", "hd", "emailPrefix", "machineId", "machineCode", "startAt", "endAt", "status", "manageCodeHash", "createdAt", "updatedAt", "idempotencyKey",
] as const;

const MACHINE_STATUSES = new Set<MachineStatus>(["inactive", "available", "maintenance", "disabled"]);
const BOOKING_STATUSES = new Set<BookingStatus>(["confirmed", "app_pending", "app_received", "active", "completed", "cancelled", "expired"]);

function headerPositions(rows: readonly (readonly string[])[], expected: readonly string[], tab: string) {
  const positions = new Map((rows[0] ?? []).map((value, index) => [String(value).trim(), index]));
  if (expected.some((header) => !positions.has(header))) throw new Error(`SHEET_HEADER_INVALID:${tab}`);
  return positions;
}

function valueAt(row: readonly string[], positions: Map<string, number>, header: string) {
  return String(row[positions.get(header) ?? -1] ?? "").trim();
}

function optional(value: string) {
  return value || null;
}

function isIsoDate(value: string) {
  return Boolean(value) && !Number.isNaN(Date.parse(value));
}

export function parseMachines(rows: readonly (readonly string[])[]): SheetMachine[] {
  if (rows.length === 0) return [];
  const positions = headerPositions(rows, MACHINE_HEADERS, "Machines");
  return rows.slice(1).flatMap((row, offset) => {
    const sourceRow = offset + 2;
    if (row.every((value) => !String(value ?? "").trim())) return [];
    const machineCode = valueAt(row, positions, "machineCode").toUpperCase();
    const status = valueAt(row, positions, "status") as MachineStatus;
    const machine: SheetMachine = {
      sourceRow,
      machineId: valueAt(row, positions, "machineId"),
      machineCode,
      machineName: valueAt(row, positions, "machineName"),
      location: optional(valueAt(row, positions, "location")),
      status,
      deviceTokenHash: valueAt(row, positions, "deviceTokenHash"),
      lastSeenAt: optional(valueAt(row, positions, "lastSeenAt")),
      updatedAt: valueAt(row, positions, "updatedAt"),
    };
    if (!machine.machineId || !machine.machineCode || !machine.machineName || !MACHINE_STATUSES.has(status) || !machine.deviceTokenHash || !isIsoDate(machine.updatedAt) || (machine.lastSeenAt !== null && !isIsoDate(machine.lastSeenAt))) {
      throw new Error(`SHEET_MACHINE_INVALID:${sourceRow}`);
    }
    return [machine];
  });
}

export function parseBookings(rows: readonly (readonly string[])[]): SheetBooking[] {
  if (rows.length === 0) return [];
  const positions = headerPositions(rows, BOOKING_HEADERS, "Bookings");
  return rows.slice(1).flatMap((row, offset) => {
    const sourceRow = offset + 2;
    if (row.every((value) => !String(value ?? "").trim())) return [];
    const email = valueAt(row, positions, "email").toLowerCase();
    const booking: SheetBooking = {
      sourceRow,
      bookingId: valueAt(row, positions, "bookingId"),
      bookingNumber: valueAt(row, positions, "bookingNumber"),
      email,
      name: valueAt(row, positions, "name"),
      hd: valueAt(row, positions, "hd") as "msu.ac.th",
      emailPrefix: valueAt(row, positions, "emailPrefix").toLowerCase(),
      machineId: valueAt(row, positions, "machineId"),
      machineCode: valueAt(row, positions, "machineCode").toUpperCase(),
      startAt: valueAt(row, positions, "startAt"),
      endAt: valueAt(row, positions, "endAt"),
      status: valueAt(row, positions, "status") as BookingStatus,
      manageCodeHash: valueAt(row, positions, "manageCodeHash"),
      createdAt: valueAt(row, positions, "createdAt"),
      updatedAt: valueAt(row, positions, "updatedAt"),
      idempotencyKey: valueAt(row, positions, "idempotencyKey") || undefined,
    };
    const validEmail = /^[^@\s]+@msu\.ac\.th$/.test(booking.email);
    if (!booking.bookingId || !booking.bookingNumber || !validEmail || !booking.name || booking.hd !== "msu.ac.th" || booking.emailPrefix !== booking.email.split("@")[0] || !booking.machineId || !booking.machineCode || !isIsoDate(booking.startAt) || !isIsoDate(booking.endAt) || Date.parse(booking.startAt) >= Date.parse(booking.endAt) || !BOOKING_STATUSES.has(booking.status) || !booking.manageCodeHash || !isIsoDate(booking.createdAt) || !isIsoDate(booking.updatedAt)) {
      throw new Error(`SHEET_BOOKING_INVALID:${sourceRow}`);
    }
    return [booking];
  });
}
