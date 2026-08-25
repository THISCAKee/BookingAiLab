import type { SheetBooking, SheetMachine } from "@/lib/google/sheet-types";

export type SheetBookingSettings = {
  serviceWeekdays: number[];
  openingTime: string;
  closingTime: string;
  durationMinutes: number;
  graceMinutes: number;
  timezone: string;
};

function localParts(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}` };
}

function active(status: SheetBooking["status"]) {
  return !["cancelled", "expired", "completed"].includes(status);
}

export function assertSheetBookingAllowed(input: {
  machine: SheetMachine;
  bookings: SheetBooking[];
  email: string;
  startAt: string;
  endAt: string;
  settings: SheetBookingSettings;
  now?: Date;
}) {
  if (input.machine.status !== "available") throw new Error("BOOKING_MACHINE_UNAVAILABLE");
  const start = new Date(input.startAt).getTime();
  const end = new Date(input.endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error("BOOKING_TIME_INVALID");
  if (end - start !== 180 * 60_000) throw new Error("BOOKING_DURATION_INVALID");

  const startLocal = localParts(input.startAt, input.settings.timezone);
  const todayLocal = localParts((input.now ?? new Date()).toISOString(), input.settings.timezone);
  if (startLocal.date !== todayLocal.date) throw new Error("BOOKING_DATE_NOT_ALLOWED");
  const nextMidnight = new Date(`${startLocal.date}T00:00:00+07:00`).getTime() + 24 * 60 * 60 * 1000;
  if (end > nextMidnight) throw new Error("BOOKING_CROSSES_MIDNIGHT");

  for (const booking of input.bookings.filter((row) => active(row.status))) {
    const existingStart = new Date(booking.startAt).getTime();
    const existingEnd = new Date(booking.endAt).getTime();
    if (existingStart < end && start < existingEnd) {
      if (booking.machineId === input.machine.machineId) throw new Error("BOOKING_MACHINE_OVERLAP");
      if (booking.email === input.email.toLowerCase()) throw new Error("BOOKING_CUSTOMER_OVERLAP");
    }
  }
}
