export type ImmediateBookingWindow = {
  date: string;
  startAt: string;
  endAt: string;
};

const BANGKOK_OFFSET = "+07:00";

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
  return new Date(`${dateValue}T00:00:00${BANGKOK_OFFSET}`).getTime() + 24 * 60 * 60 * 1000;
}

export function normalizeBookingIdentity(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (/^\d+$/.test(normalized)) return `${normalized}@msu.ac.th`;
  if (/^[^@\s]+@msu\.ac\.th$/.test(normalized)) return normalized;
  return null;
}

export function getSelectableBookingDates(now = new Date(), timezone = "Asia/Bangkok") {
  if (timezone !== "Asia/Bangkok") throw new Error("UNSUPPORTED_TIMEZONE");
  return [{ value: bangkokDateValue(now), kind: "today", label: "วันนี้" }];
}

export function getImmediateBookingWindow(
  now = new Date(),
  durationMinutes = 180,
): ImmediateBookingWindow | null {
  if (!Number.isInteger(durationMinutes) || durationMinutes !== 180) {
    throw new Error("INVALID_DURATION");
  }
  if (!Number.isFinite(now.getTime())) return null;

  const end = new Date(now.getTime() + durationMinutes * 60_000);
  const date = bangkokDateValue(now);
  if (end.getTime() > nextBangkokMidnight(date)) return null;

  return { date, startAt: now.toISOString(), endAt: end.toISOString() };
}
