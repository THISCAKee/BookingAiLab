import type { SheetBooking, SheetMachine } from "@/lib/google/sheet-types";

export type QueueOperationalStatus = "available" | "in_use" | "queued" | "full_today";

export type QueueMachineOption = {
  operationalStatus: QueueOperationalStatus;
  bookable: boolean;
  nextStartAt: string | null;
  nextEndAt: string | null;
  queueCount: number;
  currentEndAt: string | null;
};

const SLOT_MS = 180 * 60_000;
const TURNAROUND_MS = 15 * 60_000;
const TERMINAL = new Set(["cancelled", "completed", "expired"]);

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

function nextBangkokMidnight(date: Date) {
  const dateValue = bangkokDateValue(date);
  const midnight = new Date(`${dateValue}T00:00:00+07:00`);
  midnight.setUTCDate(midnight.getUTCDate() + 1);
  return midnight;
}

export function isEffectiveBooking(booking: SheetBooking, now: Date) {
  const endAt = new Date(booking.endAt).getTime();
  return !TERMINAL.has(booking.status) && Number.isFinite(endAt) && endAt > now.getTime();
}

export function viewerHasEffectiveBooking(input: {
  bookings: SheetBooking[];
  email: string;
  now: Date;
}) {
  const email = input.email.trim().toLowerCase();
  return input.bookings.some((booking) =>
    booking.email.trim().toLowerCase() === email
    && isEffectiveBooking(booking, input.now));
}

export function deriveMachineQueueOption(input: {
  machine: SheetMachine;
  bookings: SheetBooking[];
  now: Date;
}): QueueMachineOption {
  const nowMs = input.now.getTime();
  const effective = input.bookings.filter((booking) =>
    booking.machineId === input.machine.machineId
    && isEffectiveBooking(booking, input.now));
  const current = effective
    .filter((booking) => new Date(booking.startAt).getTime() <= nowMs)
    .sort((left, right) => new Date(right.endAt).getTime() - new Date(left.endAt).getTime())[0];
  const queueCount = effective.filter((booking) => new Date(booking.startAt).getTime() > nowMs).length;
  const latestEnd = effective.reduce(
    (latest, booking) => Math.max(latest, new Date(booking.endAt).getTime()),
    Number.NEGATIVE_INFINITY,
  );
  const start = new Date(effective.length === 0 ? nowMs : latestEnd + TURNAROUND_MS);
  const end = new Date(start.getTime() + SLOT_MS);
  const unavailable = input.machine.status !== "available";
  const crossesMidnight = bangkokDateValue(start) !== bangkokDateValue(input.now)
    || end.getTime() > nextBangkokMidnight(start).getTime();

  if (unavailable || crossesMidnight) {
    return {
      operationalStatus: "full_today",
      bookable: false,
      nextStartAt: null,
      nextEndAt: null,
      queueCount,
      currentEndAt: current?.endAt ?? null,
    };
  }

  return {
    operationalStatus: current ? "in_use" : queueCount > 0 ? "queued" : "available",
    bookable: true,
    nextStartAt: start.toISOString(),
    nextEndAt: end.toISOString(),
    queueCount,
    currentEndAt: current?.endAt ?? null,
  };
}
