import type { SheetBooking, SheetMachine } from "@/lib/google/sheet-types";

export type QueueOperationalStatus = "available" | "in_use" | "queued" | "waiting_for_login" | "full_today";

export type QueueMachineOption = {
  operationalStatus: QueueOperationalStatus;
  bookable: boolean;
  nextStartAt: string | null;
  nextEndAt: string | null;
  queueCount: number;
  currentEndAt: string | null;
  currentRemainingMinutes: number | null;
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
  void now;
  return !TERMINAL.has(booking.status)
    && Number.isFinite(new Date(booking.startAt).getTime())
    && Number.isFinite(new Date(booking.endAt).getTime());
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
  startedBookingIds: ReadonlySet<string>;
  now: Date;
}): QueueMachineOption {
  const nowMs = input.now.getTime();
  const effective = input.bookings.filter((booking) =>
    booking.machineId === input.machine.machineId
    && isEffectiveBooking(booking, input.now));
  const current = effective
    .filter((booking) => new Date(booking.startAt).getTime() <= nowMs)
    .sort((left, right) => new Date(right.endAt).getTime() - new Date(left.endAt).getTime())[0];
  const activeSession = effective
    .filter((booking) => booking.status === "active"
      && input.startedBookingIds.has(booking.bookingId)
      && new Date(booking.startAt).getTime() <= nowMs
      && new Date(booking.endAt).getTime() > nowMs)
    .sort((left, right) => new Date(right.endAt).getTime() - new Date(left.endAt).getTime())[0];
  const activeEndMs = activeSession ? new Date(activeSession.endAt).getTime() : null;
  const currentEndAt = activeSession?.endAt ?? null;
  const currentRemainingMinutes = activeEndMs === null
    ? null
    : Math.ceil((activeEndMs - nowMs) / 60_000);
  const queueCount = effective.filter((booking) => new Date(booking.startAt).getTime() > nowMs).length;
  const latestEnd = effective.reduce(
    (latest, booking) => Math.max(latest, new Date(booking.endAt).getTime()),
    Number.NEGATIVE_INFINITY,
  );
  const latestBooking = effective
    .slice()
    .sort((left, right) => new Date(right.endAt).getTime() - new Date(left.endAt).getTime())[0];
  const start = new Date(effective.length === 0 ? nowMs : latestEnd + TURNAROUND_MS);
  const end = new Date(start.getTime() + SLOT_MS);
  const unavailable = input.machine.status !== "available";
  const crossesMidnight = bangkokDateValue(start) !== bangkokDateValue(input.now)
    || end.getTime() > nextBangkokMidnight(start).getTime();

  if (unavailable) {
    return {
      operationalStatus: "full_today",
      bookable: false,
      nextStartAt: null,
      nextEndAt: null,
      queueCount,
      currentEndAt,
      currentRemainingMinutes,
    };
  }

  if (latestBooking && !input.startedBookingIds.has(latestBooking.bookingId)) {
    return {
      operationalStatus: "waiting_for_login",
      bookable: false,
      nextStartAt: null,
      nextEndAt: null,
      queueCount,
      currentEndAt,
      currentRemainingMinutes,
    };
  }

  if (crossesMidnight) {
    return {
      operationalStatus: "full_today",
      bookable: false,
      nextStartAt: null,
      nextEndAt: null,
      queueCount,
      currentEndAt,
      currentRemainingMinutes,
    };
  }

  return {
    operationalStatus: current ? "in_use" : queueCount > 0 ? "queued" : "available",
    bookable: true,
    nextStartAt: start.toISOString(),
    nextEndAt: end.toISOString(),
    queueCount,
    currentEndAt,
    currentRemainingMinutes,
  };
}
