export type BookingStatus =
  | "confirmed"
  | "app_pending"
  | "app_received"
  | "active"
  | "completed"
  | "cancelled"
  | "expired";

export type BookingPolicySettings = {
  weekdays: number[];
  openingTime: string;
  closingTime: string;
  durationMinutes: number;
  graceMinutes: number;
  timezone: string;
};

export type BookingAvailability = {
  allowed: boolean;
  code:
    | "AVAILABLE"
    | "SERVICE_CLOSED"
    | "SERVICE_NOT_OPEN"
    | "INSUFFICIENT_SERVICE_TIME";
  startAt: Date;
  endAt: Date;
};

type LocalDateTime = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
  second: number;
};

const weekdayNumbers: Record<string, number> = {
  Sun: 7,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function parseTime(value: string, fieldName: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const hour = Number(match?.[1]);
  const minute = Number(match?.[2]);

  if (!match || hour > 23 || minute > 59) {
    throw new Error(`${fieldName} must be a valid HH:mm time`);
  }

  return hour * 60 + minute;
}

function validateSettings(settings: BookingPolicySettings) {
  const openingMinutes = parseTime(settings.openingTime, "openingTime");
  const closingMinutes = parseTime(settings.closingTime, "closingTime");

  if (closingMinutes <= openingMinutes) {
    throw new Error("closingTime must be after openingTime");
  }

  if (
    settings.weekdays.length === 0 ||
    settings.weekdays.some(
      (weekday) => !Number.isInteger(weekday) || weekday < 1 || weekday > 7,
    )
  ) {
    throw new Error("weekdays must contain ISO weekday numbers from 1 to 7");
  }

  if (!Number.isInteger(settings.durationMinutes) || settings.durationMinutes <= 0) {
    throw new Error("durationMinutes must be a positive integer");
  }

  if (!Number.isInteger(settings.graceMinutes) || settings.graceMinutes < 0) {
    throw new Error("graceMinutes must be a non-negative integer");
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone }).format();
  } catch {
    throw new Error("timezone must be a valid IANA timezone");
  }

  return { openingMinutes, closingMinutes };
}

function getLocalDateTime(date: Date, timezone: string): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    weekday: weekdayNumbers[values.weekday],
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function sameLocalDate(left: LocalDateTime, right: LocalDateTime) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day
  );
}

export function getBookingAvailability(
  now: Date,
  settings: BookingPolicySettings,
): BookingAvailability {
  const { openingMinutes, closingMinutes } = validateSettings(settings);
  const startAt = new Date(now);
  const endAt = new Date(now.getTime() + settings.durationMinutes * 60_000);
  const localStart = getLocalDateTime(startAt, settings.timezone);
  const localEnd = getLocalDateTime(endAt, settings.timezone);
  const currentMinutes = localStart.hour * 60 + localStart.minute;
  const currentSeconds = currentMinutes * 60 + localStart.second;
  const openingSeconds = openingMinutes * 60;
  const closingSeconds = closingMinutes * 60;

  if (!settings.weekdays.includes(localStart.weekday)) {
    return { allowed: false, code: "SERVICE_CLOSED", startAt, endAt };
  }

  if (currentSeconds < openingSeconds) {
    return { allowed: false, code: "SERVICE_NOT_OPEN", startAt, endAt };
  }

  const endSeconds = localEnd.hour * 3_600 + localEnd.minute * 60 + localEnd.second;
  if (!sameLocalDate(localStart, localEnd) || endSeconds > closingSeconds) {
    return {
      allowed: false,
      code: "INSUFFICIENT_SERVICE_TIME",
      startAt,
      endAt,
    };
  }

  return { allowed: true, code: "AVAILABLE", startAt, endAt };
}

export function isBookingTerminal(status: BookingStatus) {
  return status === "completed" || status === "cancelled" || status === "expired";
}

export function isNoShowExpired(
  startAt: Date,
  now: Date,
  graceMinutes: number,
) {
  return now.getTime() >= startAt.getTime() + graceMinutes * 60_000;
}
