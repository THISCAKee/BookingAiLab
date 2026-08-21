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
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[get("weekday") as "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"] ?? 0;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, weekday, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function timeMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("BOOKING_SETTINGS_INVALID");
  return Number(match[1]) * 60 + Number(match[2]);
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
}) {
  if (input.machine.status !== "available") throw new Error("BOOKING_MACHINE_UNAVAILABLE");
  const start = new Date(input.startAt).getTime();
  const end = new Date(input.endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error("BOOKING_TIME_INVALID");

  const startLocal = localParts(input.startAt, input.settings.timezone);
  const endLocal = localParts(input.endAt, input.settings.timezone);
  const opening = timeMinutes(input.settings.openingTime);
  const closing = timeMinutes(input.settings.closingTime);
  if (startLocal.date !== endLocal.date || !input.settings.serviceWeekdays.includes(startLocal.weekday) || startLocal.minutes < opening || endLocal.minutes > closing) {
    throw new Error("BOOKING_OUTSIDE_SCHEDULE");
  }

  for (const booking of input.bookings.filter((row) => active(row.status))) {
    const existingStart = new Date(booking.startAt).getTime();
    const existingEnd = new Date(booking.endAt).getTime();
    if (existingStart < end && start < existingEnd) {
      if (booking.machineId === input.machine.machineId) throw new Error("BOOKING_MACHINE_OVERLAP");
      if (booking.email === input.email.toLowerCase()) throw new Error("BOOKING_CUSTOMER_OVERLAP");
    }
  }
}
