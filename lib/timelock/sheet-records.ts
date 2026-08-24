import type { SheetBooking } from "@/lib/google/sheet-types";

export const TIMELOCK_USER_HEADERS = [
  "userId", "email", "name", "emailPrefix", "username", "role", "machineCode",
  "passwordAlgorithm", "passwordIterations", "passwordSalt", "passwordHash",
  "allowedMinutes", "isActive", "sourceBookingId", "updatedAt",
] as const;

export const TIMELOCK_EVENT_HEADERS = [
  "eventId", "eventType", "sessionId", "bookingId", "machineCode", "username",
  "status", "payload", "createdAt", "updatedAt",
] as const;

export type TimelockSheetUser = {
  sourceRow: number;
  userId: string;
  email: string;
  name: string;
  emailPrefix: string;
  username: string;
  role: string;
  machineCode: string;
  passwordAlgorithm: "pbkdf2-sha256";
  passwordIterations: number;
  passwordSalt: string;
  passwordHash: string;
  allowedMinutes: number;
  isActive: boolean;
  sourceBookingId: string;
  updatedAt: string;
};

export type TimelockSheetEvent = {
  sourceRow: number;
  eventId: string;
  eventType: string;
  sessionId: string;
  bookingId: string;
  machineCode: string;
  username: string;
  status: string;
  payload: string;
  createdAt: string;
  updatedAt: string;
};

function positions(rows: readonly (readonly string[])[], headers: readonly string[], tab: string) {
  const result = new Map((rows[0] ?? []).map((header, index) => [String(header).trim(), index]));
  if (headers.some((header) => !result.has(header))) throw new Error(`SHEET_HEADER_INVALID:${tab}`);
  return result;
}

function value(row: readonly string[], index: Map<string, number>, header: string) {
  return String(row[index.get(header) ?? -1] ?? "").trim();
}

function validDate(input: string) {
  return Boolean(input) && !Number.isNaN(Date.parse(input));
}

export function parseTimelockUsers(rows: readonly (readonly string[])[]): TimelockSheetUser[] {
  if (rows.length === 0) return [];
  const index = positions(rows, TIMELOCK_USER_HEADERS, "Users");
  return rows.slice(1).flatMap((row, offset) => {
    if (row.every((item) => !String(item ?? "").trim())) return [];
    const activeValue = value(row, index, "isActive").toLowerCase();
    const user: TimelockSheetUser = {
      sourceRow: offset + 2,
      userId: value(row, index, "userId"),
      email: value(row, index, "email").toLowerCase(),
      name: value(row, index, "name"),
      emailPrefix: value(row, index, "emailPrefix").toLowerCase(),
      username: value(row, index, "username").toLowerCase(),
      role: value(row, index, "role").toLowerCase(),
      machineCode: value(row, index, "machineCode").toUpperCase(),
      passwordAlgorithm: value(row, index, "passwordAlgorithm") as "pbkdf2-sha256",
      passwordIterations: Number(value(row, index, "passwordIterations")),
      passwordSalt: value(row, index, "passwordSalt"),
      passwordHash: value(row, index, "passwordHash"),
      allowedMinutes: Number(value(row, index, "allowedMinutes")),
      isActive: activeValue === "true",
      sourceBookingId: value(row, index, "sourceBookingId"),
      updatedAt: value(row, index, "updatedAt"),
    };
    if (!user.userId || !user.email || !user.emailPrefix || !user.username || user.role !== "user" || !user.machineCode || user.passwordAlgorithm !== "pbkdf2-sha256" || !Number.isInteger(user.passwordIterations) || user.passwordIterations <= 0 || !user.passwordSalt || !user.passwordHash || !Number.isInteger(user.allowedMinutes) || user.allowedMinutes <= 0 || !["true", "false"].includes(activeValue) || !user.sourceBookingId || !validDate(user.updatedAt)) {
      throw new Error(`SHEET_USER_INVALID:${user.sourceRow}`);
    }
    return [user];
  });
}

export function parseTimelockEvents(rows: readonly (readonly string[])[]): TimelockSheetEvent[] {
  if (rows.length === 0) return [];
  const index = positions(rows, TIMELOCK_EVENT_HEADERS, "Events");
  return rows.slice(1).flatMap((row, offset) => {
    if (row.every((item) => !String(item ?? "").trim())) return [];
    const event: TimelockSheetEvent = {
      sourceRow: offset + 2,
      eventId: value(row, index, "eventId"),
      eventType: value(row, index, "eventType"),
      sessionId: value(row, index, "sessionId"),
      bookingId: value(row, index, "bookingId"),
      machineCode: value(row, index, "machineCode").toUpperCase(),
      username: value(row, index, "username").toLowerCase(),
      status: value(row, index, "status"),
      payload: value(row, index, "payload"),
      createdAt: value(row, index, "createdAt"),
      updatedAt: value(row, index, "updatedAt"),
    };
    if (!event.eventId || !event.eventType || !event.sessionId || !event.bookingId || !event.machineCode || !event.username || !event.status || !validDate(event.createdAt) || !validDate(event.updatedAt)) {
      throw new Error(`SHEET_EVENT_INVALID:${event.sourceRow}`);
    }
    return [event];
  });
}

function bookingActive(booking: SheetBooking) {
  return !["cancelled", "expired", "completed"].includes(booking.status);
}

export function resolveActiveSheetSession(input: {
  sessionId: string;
  machineCode: string;
  users: TimelockSheetUser[];
  events: TimelockSheetEvent[];
  bookings: SheetBooking[];
}) {
  const started = input.events
    .filter((event) => event.sessionId === input.sessionId && event.eventType === "session_started")
    .sort((left, right) => right.sourceRow - left.sourceRow)[0];
  if (!started) throw new Error("SESSION_NOT_FOUND");
  if (started.machineCode !== input.machineCode.toUpperCase()) throw new Error("ACCOUNT_MACHINE_MISMATCH");
  const ended = input.events.some((event) => event.sessionId === input.sessionId && event.eventType === "session_ended" && event.sourceRow > started.sourceRow);
  if (ended) throw new Error("SESSION_NOT_FOUND");

  const user = input.users.find((row) => row.username === started.username && row.machineCode === started.machineCode && row.isActive && row.sourceBookingId === started.bookingId);
  const booking = input.bookings.find((row) => row.bookingId === started.bookingId && row.machineCode === started.machineCode && row.emailPrefix === started.username && bookingActive(row));
  if (!user || !booking) throw new Error("ACCOUNT_MACHINE_MISMATCH");

  return {
    sessionId: started.sessionId,
    username: started.username,
    machineCode: started.machineCode,
    booking,
    user,
  };
}
