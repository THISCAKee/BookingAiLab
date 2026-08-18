export type ScheduledBookingSettings = {
  weekdays: number[];
  openingTime: string;
  closingTime: string;
  durationMinutes: number;
  timezone: string;
};

export type BookingSlot = {
  startAt: string;
  endAt: string;
  label: string;
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

function addCalendarDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const hour = Number(match?.[1]);
  const minute = Number(match?.[2]);
  if (!match || hour > 23 || minute > 59) throw new Error("INVALID_TIME");
  return hour * 60 + minute;
}

function formatMinutes(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toBangkokInstant(dateValue: string, minutes: number) {
  return new Date(`${dateValue}T${formatMinutes(minutes)}:00${BANGKOK_OFFSET}`);
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
  const today = bangkokDateValue(now);

  return [today, addCalendarDays(today, 1)].map((value, index) => ({
    value,
    kind: index === 0 ? "today" : "tomorrow",
    label: index === 0 ? "วันนี้" : "พรุ่งนี้",
  }));
}

export function getBookingSlots(
  dateValue: string,
  settings: ScheduledBookingSettings,
  now = new Date(),
): BookingSlot[] {
  if (settings.timezone !== "Asia/Bangkok") throw new Error("UNSUPPORTED_TIMEZONE");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return [];

  const noon = new Date(`${dateValue}T12:00:00${BANGKOK_OFFSET}`);
  if (Number.isNaN(noon.getTime())) return [];
  const isoWeekday = noon.getUTCDay() === 0 ? 7 : noon.getUTCDay();
  if (!settings.weekdays.includes(isoWeekday)) return [];

  const opening = parseMinutes(settings.openingTime);
  const closing = parseMinutes(settings.closingTime);
  if (!Number.isInteger(settings.durationMinutes) || settings.durationMinutes <= 0) {
    throw new Error("INVALID_DURATION");
  }

  const slots: BookingSlot[] = [];
  for (
    let start = opening;
    start + settings.durationMinutes <= closing;
    start += settings.durationMinutes
  ) {
    const end = start + settings.durationMinutes;
    const startAt = toBangkokInstant(dateValue, start);
    if (startAt.getTime() <= now.getTime()) continue;
    const endAt = toBangkokInstant(dateValue, end);
    slots.push({
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      label: `${formatMinutes(start)}–${formatMinutes(end)}`,
    });
  }

  return slots;
}
