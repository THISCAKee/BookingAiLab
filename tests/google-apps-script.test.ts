import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const BOOKING_HEADERS = [
  "bookingId", "bookingNumber", "email", "name", "hd", "emailPrefix", "machineId",
  "machineCode", "startAt", "endAt", "status", "manageCodeHash", "createdAt", "updatedAt",
  "idempotencyKey", "extensionCount",
];
const USER_HEADERS = [
  "userId", "email", "name", "emailPrefix", "username", "role", "machineCode",
  "passwordAlgorithm", "passwordIterations", "passwordSalt", "passwordHash", "allowedMinutes",
  "isActive", "sourceBookingId", "updatedAt",
];
const EVENT_HEADERS = [
  "eventId", "eventType", "sessionId", "bookingId", "machineCode", "username", "status",
  "payload", "createdAt", "updatedAt",
];

class FakeSheet {
  rows: unknown[][];

  constructor(rows: unknown[][]) {
    this.rows = structuredClone(rows);
  }

  getDataRange() {
    return {
      getValues: () => structuredClone(this.rows),
      getDisplayValues: () => structuredClone(this.rows),
    };
  }

  getRange(row: number, column: number, rowCount: number, columnCount: number) {
    return {
      setValues: (values: unknown[][]) => {
        values.forEach((source, rowOffset) => {
          const target = this.rows[row - 1 + rowOffset] ?? [];
          source.slice(0, columnCount).forEach((value, columnOffset) => {
            target[column - 1 + columnOffset] = value;
          });
          this.rows[row - 1 + rowOffset] = target;
        });
        return this;
      },
    };
  }

  appendRow(row: unknown[]) {
    this.rows.push(structuredClone(row));
  }
}

function rowObject(sheet: FakeSheet, id: string) {
  const [headers, ...rows] = sheet.rows;
  const idIndex = headers.indexOf(headers[0]);
  const row = rows.find((candidate) => candidate[idIndex] === id);
  return Object.fromEntries(headers.map((header, index) => [header, row?.[index]]));
}

function runtime(extraBookings: unknown[][] = [], includeCurrentBooking = true) {
  const sheets = {
    Settings: new FakeSheet([
      ["Key", "Value", "UpdatedAt"],
      ["serviceWeekdays", "1,2,3,4,5,6,7", "2026-08-24T00:00:00.000Z"],
      ["openingTime", "08:30", "2026-08-24T00:00:00.000Z"],
      ["closingTime", "16:30", "2026-08-24T00:00:00.000Z"],
      ["durationMinutes", "180", "2026-08-24T00:00:00.000Z"],
      ["graceMinutes", "15", "2026-08-24T00:00:00.000Z"],
      ["timezone", "Asia/Bangkok", "2026-08-24T00:00:00.000Z"],
    ]),
    Machines: new FakeSheet([
      ["machineId", "machineCode", "machineName", "location", "status", "deviceTokenHash", "lastSeenAt", "updatedAt"],
      ["m-1", "PC-001", "Workstation 1", "AI Lab", "available", "hash", "", "2026-08-24T00:00:00.000Z"],
    ]),
    Bookings: new FakeSheet([
      BOOKING_HEADERS,
      ...(includeCurrentBooking ? [[
        "b-1", "BK-1", "student@msu.ac.th", "Student", "msu.ac.th", "student", "m-1",
        "PC-001", "2026-08-24T01:30:00.000Z", "2026-08-24T04:30:00.000Z", "active",
        "manage-hash", "2026-08-24T00:00:00.000Z", "2026-08-24T00:00:00.000Z", "create-1", 0,
      ]] : []),
      ...extraBookings,
    ]),
    Users: new FakeSheet([
      USER_HEADERS,
      [
        "u-1", "student@msu.ac.th", "Student", "student", "student", "user", "PC-001",
        "pbkdf2-sha256", 600000, "salt", "hash", 180, true, "b-1",
        "2026-08-24T00:00:00.000Z",
      ],
    ]),
    Events: new FakeSheet([
      EVENT_HEADERS,
      [
        "e-1", "session_started", "s-1", "b-1", "PC-001", "student", "active", "{}",
        "2026-08-24T01:30:00.000Z", "2026-08-24T01:30:00.000Z",
      ],
    ]),
    AuditLog: new FakeSheet([
      ["auditId", "actorEmail", "action", "entityType", "entityId", "metadata", "createdAt"],
    ]),
  };
  let id = 1;
  const context = vm.createContext({
    SpreadsheetApp: {
      getActive: () => ({ getSheetByName: (name: keyof typeof sheets) => sheets[name] }),
    },
    Utilities: {
      getUuid: () => `generated-${id++}`,
      DigestAlgorithm: { SHA_256: "SHA_256" },
      computeDigest: (_algorithm: string, value: string) => [...createHash("sha256").update(value).digest()],
      formatDate: (date: Date, _timezone: string, format: string) => {
        const local = new Date(date.getTime() + 7 * 60 * 60 * 1000);
        const weekday = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
        const time = local.toISOString().slice(11, 16);
        if (format === "u HH:mm") return `${weekday} ${time}`;
        if (format === "yyyyMMdd-HHmmss") return local.toISOString().replace(/[-:]/g, "").slice(0, 8) + "-" + local.toISOString().replace(/[-:]/g, "").slice(9, 15);
        throw new Error(`unsupported format ${format}`);
      },
    },
    Session: { getScriptTimeZone: () => "Asia/Bangkok" },
    console,
  });
  vm.runInContext(readFileSync("scripts/google-apps-script/Code.gs", "utf8"), context);
  return { context: context as typeof context & {
    createBooking_: (body: unknown, now: Date) => unknown;
    extendBooking_: (body: unknown, now: Date) => unknown;
  }, sheets };
}

const body = {
  operation: "extend_booking",
  idempotencyKey: "extend-1",
  payload: {
    sessionId: "s-1",
    bookingId: "b-1",
    machineCode: "PC-001",
    username: "student",
  },
};

describe("Google Apps Script booking extension", () => {
  it("creates only a three-hour booking today with zero extensions", () => {
    const { context, sheets } = runtime([], false);
    const createBody = {
      idempotencyKey: "create-new",
      payload: {
        machineId: "m-1",
        startAt: "2026-08-24T01:30:00.000Z",
        endAt: "2026-08-24T04:30:00.000Z",
        email: "new@msu.ac.th",
        name: "New Student",
        hd: "msu.ac.th",
        emailPrefix: "new",
        account: {
          username: "new",
          passwordAlgorithm: "pbkdf2-sha256",
          passwordIterations: 600000,
          passwordSalt: "salt",
          passwordHash: "hash",
          allowedMinutes: 999,
        },
      },
    };

    context.createBooking_(createBody, new Date("2026-08-24T00:30:00.000Z"));
    const created = sheets.Bookings.rows.at(-1);
    expect(created?.[BOOKING_HEADERS.indexOf("extensionCount")]).toBe(0);
    const createdUser = sheets.Users.rows.at(-1);
    expect(createdUser?.[USER_HEADERS.indexOf("allowedMinutes")]).toBe(180);

    expect(() => context.createBooking_({
      ...createBody,
      idempotencyKey: "wrong-duration",
      payload: { ...createBody.payload, endAt: "2026-08-24T03:30:00.000Z" },
    }, new Date("2026-08-24T00:30:00.000Z"))).toThrow("BOOKING_DURATION_INVALID");
    expect(() => context.createBooking_({
      ...createBody,
      idempotencyKey: "wrong-day",
      payload: {
        ...createBody.payload,
        startAt: "2026-08-25T01:30:00.000Z",
        endAt: "2026-08-25T04:30:00.000Z",
      },
    }, new Date("2026-08-24T00:30:00.000Z"))).toThrow("BOOKING_DATE_NOT_ALLOWED");
  });

  it("updates Booking and User exactly once for a repeated idempotency key", () => {
    const { context, sheets } = runtime();
    const first = JSON.parse(JSON.stringify(context.extendBooking_(body, new Date("2026-08-24T03:00:00.000Z"))));
    const repeated = JSON.parse(JSON.stringify(context.extendBooking_(body, new Date("2026-08-24T03:01:00.000Z"))));

    expect(first).toEqual({
      ok: true,
      data: {
        bookingId: "b-1",
        endAt: "2026-08-24T07:30:00.000Z",
        extensionCount: 1,
        allowedMinutes: 360,
      },
    });
    expect(repeated).toEqual(first);
    expect(rowObject(sheets.Bookings, "b-1")).toMatchObject({
      endAt: "2026-08-24T07:30:00.000Z",
      extensionCount: 1,
    });
    expect(rowObject(sheets.Users, "u-1")).toMatchObject({ allowedMinutes: 360 });
  });

  it("does not mutate rows when a next booking overlaps the extension", () => {
    const nextBooking = [
      "b-2", "BK-2", "other@msu.ac.th", "Other", "msu.ac.th", "other", "m-1", "PC-001",
      "2026-08-24T04:30:00.000Z", "2026-08-24T07:30:00.000Z", "confirmed", "hash-2",
      "2026-08-24T00:00:00.000Z", "2026-08-24T00:00:00.000Z", "create-2", 0,
    ];
    const { context, sheets } = runtime([nextBooking]);
    const before = structuredClone({ bookings: sheets.Bookings.rows, users: sheets.Users.rows });

    expect(() => context.extendBooking_(body, new Date("2026-08-24T03:00:00.000Z")))
      .toThrow("EXTENSION_NEXT_BOOKING_CONFLICT");
    expect({ bookings: sheets.Bookings.rows, users: sheets.Users.rows }).toEqual(before);
  });
});
