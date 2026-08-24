import type { SheetBooking } from "@/lib/google/sheet-types";

export type ExtensionReason =
  | "EXTENSION_AVAILABLE"
  | "EXTENSION_LIMIT_REACHED"
  | "EXTENSION_CROSSES_MIDNIGHT"
  | "EXTENSION_NEXT_BOOKING_CONFLICT"
  | "EXTENSION_BOOKING_INACTIVE";

export type ExtensionDecision = {
  canExtend: boolean;
  reason: ExtensionReason;
  currentEndAt: string;
  proposedEndAt: string | null;
  extensionCount: number;
  maxExtensionCount: 2;
};

const EXTENSION_MS = 180 * 60_000;
const MAX_EXTENSION_COUNT = 2 as const;

function bangkokDateValue(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function nextBangkokMidnight(dateValue: string) {
  const nextDate = new Date(`${dateValue}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return new Date(`${nextDate.toISOString().slice(0, 10)}T00:00:00+07:00`);
}

function active(booking: SheetBooking) {
  return !["cancelled", "expired", "completed"].includes(booking.status);
}

function decision(
  booking: SheetBooking,
  reason: ExtensionReason,
  proposedEndAt: string | null,
): ExtensionDecision {
  return {
    canExtend: reason === "EXTENSION_AVAILABLE",
    reason,
    currentEndAt: booking.endAt,
    proposedEndAt,
    extensionCount: booking.extensionCount,
    maxExtensionCount: MAX_EXTENSION_COUNT,
  };
}

export function evaluateBookingExtension(input: {
  booking: SheetBooking;
  bookings: SheetBooking[];
  now: Date;
}): ExtensionDecision {
  const bookingDate = bangkokDateValue(new Date(input.booking.endAt));
  if (!active(input.booking) || bookingDate !== bangkokDateValue(input.now)) {
    return decision(input.booking, "EXTENSION_BOOKING_INACTIVE", null);
  }
  if (input.booking.extensionCount >= MAX_EXTENSION_COUNT) {
    return decision(input.booking, "EXTENSION_LIMIT_REACHED", null);
  }

  const currentEnd = new Date(input.booking.endAt).getTime();
  const proposedEnd = currentEnd + EXTENSION_MS;
  if (proposedEnd > nextBangkokMidnight(bookingDate).getTime()) {
    return decision(input.booking, "EXTENSION_CROSSES_MIDNIGHT", null);
  }

  const conflict = input.bookings.some((booking) =>
    booking.bookingId !== input.booking.bookingId
    && booking.machineId === input.booking.machineId
    && active(booking)
    && new Date(booking.startAt).getTime() < proposedEnd
    && currentEnd < new Date(booking.endAt).getTime());
  if (conflict) {
    return decision(input.booking, "EXTENSION_NEXT_BOOKING_CONFLICT", null);
  }

  return decision(input.booking, "EXTENSION_AVAILABLE", new Date(proposedEnd).toISOString());
}
