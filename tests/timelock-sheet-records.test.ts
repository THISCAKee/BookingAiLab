import { describe, expect, it } from "vitest";
import {
  TIMELOCK_EVENT_HEADERS,
  TIMELOCK_USER_HEADERS,
  parseTimelockEvents,
  parseTimelockUsers,
  resolveActiveSheetSession,
} from "@/lib/timelock/sheet-records";
import type { SheetBooking } from "@/lib/google/sheet-types";

const booking: SheetBooking = {
  sourceRow: 2,
  bookingId: "b-1",
  bookingNumber: "BK-1",
  email: "student@msu.ac.th",
  name: "Student",
  hd: "msu.ac.th",
  emailPrefix: "student",
  machineId: "m-1",
  machineCode: "PC-001",
  startAt: "2026-08-24T01:30:00.000Z",
  endAt: "2026-08-24T04:30:00.000Z",
  status: "active",
  manageCodeHash: "hash",
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
  idempotencyKey: "create-1",
  extensionCount: 0,
};

const userRows = [
  TIMELOCK_USER_HEADERS,
  [
    "u-1", "student@msu.ac.th", "Student", "student", "student", "user", "PC-001",
    "pbkdf2-sha256", "600000", "salt", "hash", "180", "TRUE", "b-1",
    "2026-08-24T00:00:00.000Z",
  ],
];

const startedRows = [
  TIMELOCK_EVENT_HEADERS,
  [
    "e-1", "session_started", "s-1", "b-1", "PC-001", "student", "active", "{}",
    "2026-08-24T01:30:00.000Z", "2026-08-24T01:30:00.000Z",
  ],
];

describe("TimeLock Sheet records", () => {
  it("parses complete Users and Events rows", () => {
    expect(parseTimelockUsers(userRows)[0]).toMatchObject({
      sourceRow: 2,
      userId: "u-1",
      username: "student",
      machineCode: "PC-001",
      allowedMinutes: 180,
      isActive: true,
      sourceBookingId: "b-1",
    });
    expect(parseTimelockEvents(startedRows)[0]).toEqual({
      sourceRow: 2,
      eventId: "e-1",
      eventType: "session_started",
      sessionId: "s-1",
      bookingId: "b-1",
      machineCode: "PC-001",
      username: "student",
      status: "active",
      payload: "{}",
      createdAt: "2026-08-24T01:30:00.000Z",
      updatedAt: "2026-08-24T01:30:00.000Z",
    });
  });

  it("resolves a started session to its active booking and user", () => {
    expect(resolveActiveSheetSession({
      sessionId: "s-1",
      machineCode: "PC-001",
      users: parseTimelockUsers(userRows),
      events: parseTimelockEvents(startedRows),
      bookings: [booking],
    })).toMatchObject({
      sessionId: "s-1",
      username: "student",
      machineCode: "PC-001",
      booking: { bookingId: "b-1" },
      user: { userId: "u-1" },
    });
  });

  it("rejects a session that has ended", () => {
    const ended = parseTimelockEvents([
      ...startedRows,
      [
        "e-2", "session_ended", "s-1", "b-1", "PC-001", "student", "completed", "{}",
        "2026-08-24T04:30:00.000Z", "2026-08-24T04:30:00.000Z",
      ],
    ]);
    expect(() => resolveActiveSheetSession({
      sessionId: "s-1",
      machineCode: "PC-001",
      users: parseTimelockUsers(userRows),
      events: ended,
      bookings: [booking],
    })).toThrow("SESSION_NOT_FOUND");
  });

  it("rejects another machine and mismatched account data", () => {
    const common = {
      sessionId: "s-1",
      users: parseTimelockUsers(userRows),
      events: parseTimelockEvents(startedRows),
      bookings: [booking],
    };
    expect(() => resolveActiveSheetSession({ ...common, machineCode: "PC-002" }))
      .toThrow("ACCOUNT_MACHINE_MISMATCH");
    expect(() => resolveActiveSheetSession({
      ...common,
      machineCode: "PC-001",
      bookings: [{ ...booking, emailPrefix: "someone-else" }],
    })).toThrow("ACCOUNT_MACHINE_MISMATCH");
  });
});
