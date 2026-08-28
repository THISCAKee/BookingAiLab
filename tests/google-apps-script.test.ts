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

  getLastRow() {
    return this.rows.length;
  }

  deleteRows(startRow: number, count: number) {
    this.rows.splice(startRow - 1, count);
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
  const properties = new Map<string, string>();
  const triggers: Array<{ handler: string }> = [];
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
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties.get(key) ?? null,
        setProperty: (key: string, value: string) => { properties.set(key, value); },
      }),
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => true,
        waitLock: () => undefined,
        releaseLock: () => undefined,
      }),
    },
    ScriptApp: {
      getProjectTriggers: () => triggers.map((trigger) => ({ getHandlerFunction: () => trigger.handler })),
      deleteTrigger: (trigger: { getHandlerFunction: () => string }) => {
        const index = triggers.findIndex((item) => item.handler === trigger.getHandlerFunction());
        if (index >= 0) triggers.splice(index, 1);
      },
      newTrigger: (handler: string) => ({
        timeBased: () => ({
          everyMinutes: (minutes: number) => ({
            create: () => { triggers.push({ handler: `${handler}:${minutes}` }); },
          }),
        }),
      }),
    },
    console,
  });
  vm.runInContext(readFileSync("scripts/google-apps-script/Code.gs", "utf8"), context);
  return { context: context as typeof context & {
    createBooking_: (body: unknown, now: Date) => unknown;
    extendBooking_: (body: unknown, now: Date) => unknown;
    installDailyCleanupTrigger: (now: Date) => unknown;
    dailyCleanupTick_: (now: Date) => unknown;
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

describe("Google Apps Script authoritative booking queue", () => {
  const createBody = {
    idempotencyKey: "create-new",
    payload: {
      machineId: "m-1",
      manageCode: "QUEUECODE123",
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

  it("ignores client time fields and creates an immediate authoritative 180 minute slot", () => {
    const { context, sheets } = runtime([], false);
    const result = JSON.parse(JSON.stringify(context.createBooking_({
      ...createBody,
      payload: {
        ...createBody.payload,
        startAt: "2030-01-01T00:00:00.000Z",
        endAt: "2030-01-01T03:00:00.000Z",
      },
    }, new Date("2026-08-24T00:30:00.000Z"))));
    expect(result.data).toMatchObject({
      startAt: "2026-08-24T00:30:00.000Z",
      endAt: "2026-08-24T03:30:00.000Z",
      status: "confirmed",
    });
    const created = sheets.Bookings.rows.at(-1);
    expect(created?.[BOOKING_HEADERS.indexOf("extensionCount")]).toBe(0);
    const createdUser = sheets.Users.rows.at(-1);
    expect(createdUser?.[USER_HEADERS.indexOf("allowedMinutes")]).toBe(180);
    const confirmedEvent = sheets.Events.rows.at(-1) as unknown[];
    expect(confirmedEvent?.[EVENT_HEADERS.indexOf("eventType")]).toBe("booking_confirmed");
    expect(confirmedEvent?.[EVENT_HEADERS.indexOf("bookingId")]).toBe(created?.[BOOKING_HEADERS.indexOf("bookingId")]);
    expect(String(confirmedEvent)).not.toContain("passwordHash");
    expect(String(confirmedEvent)).not.toContain("plain-text-password");
    expect(sheets.AuditLog.rows.at(-1)?.[2]).toBe("booking_confirmed");

    const eventCountAfterCreate = sheets.Events.rows.length;
    const auditCountAfterCreate = sheets.AuditLog.rows.length;
    const duplicate = JSON.parse(JSON.stringify(
      context.createBooking_(createBody, new Date("2026-08-24T00:31:00.000Z")),
    ));
    expect(duplicate.data.manageCode).toBe("QUEUECODE123");
    expect(sheets.Events.rows).toHaveLength(eventCountAfterCreate);
    expect(sheets.AuditLog.rows).toHaveLength(auditCountAfterCreate);
  });

  it("blocks a second booking until the first user logs in", () => {
    const { context } = runtime([], false);
    context.createBooking_(createBody, new Date("2026-08-24T00:30:00.000Z"));

    expect(() => context.createBooking_({
      ...createBody,
      idempotencyKey: "create-other",
      payload: {
        ...createBody.payload,
        email: "other@msu.ac.th",
        emailPrefix: "other",
        account: { ...createBody.payload.account, username: "other" },
      },
    }, new Date("2026-08-24T00:31:00.000Z"))).toThrow("BOOKING_PREVIOUS_NOT_STARTED");
  });

  it("starts the next booking after the predecessor's login-adjusted end", () => {
    const { context, sheets } = runtime([], false);
    const first = JSON.parse(JSON.stringify(context.createBooking_(createBody, new Date("2026-08-24T00:30:00.000Z"))));
    const firstBooking = sheets.Bookings.rows.find((row) => row[0] === first.data.bookingId) as unknown[];
    firstBooking[BOOKING_HEADERS.indexOf("startAt")] = "2026-08-24T02:00:00.000Z";
    firstBooking[BOOKING_HEADERS.indexOf("endAt")] = "2026-08-24T05:00:00.000Z";
    sheets.Events.appendRow([
      "login-event", "session_started", "session-1", first.data.bookingId, "PC-001", "new", "active", "{}",
      "2026-08-24T02:00:00.000Z", "2026-08-24T02:00:00.000Z",
    ]);

    const second = JSON.parse(JSON.stringify(context.createBooking_({
      ...createBody,
      idempotencyKey: "create-other",
      payload: {
        ...createBody.payload,
        email: "other@msu.ac.th",
        emailPrefix: "other",
        account: { ...createBody.payload.account, username: "other" },
      },
    }, new Date("2026-08-24T02:01:00.000Z"))));

    expect(second.data).toMatchObject({
      startAt: "2026-08-24T05:15:00.000Z",
      endAt: "2026-08-24T08:15:00.000Z",
    });
  });

  it("rejects a viewer who has any effective booking on another machine", () => {
    const otherMachineBooking = [
      "b-other", "BK-OTHER", "new@msu.ac.th", "New Student", "msu.ac.th", "new", "m-2", "PC-002",
      "2026-08-24T01:00:00.000Z", "2026-08-24T04:00:00.000Z", "confirmed", "hash-other",
      "2026-08-24T00:00:00.000Z", "2026-08-24T00:00:00.000Z", "create-other", 0,
    ];
    const { context } = runtime([otherMachineBooking], false);

    expect(() => context.createBooking_(createBody, new Date("2026-08-24T00:30:00.000Z")))
      .toThrow("BOOKING_ALREADY_ACTIVE");
  });

  it("ignores cancelled tails and preserves a started predecessor's end", () => {
    const rows = [
      [
        "b-confirmed", "BK-CONFIRMED", "first@msu.ac.th", "First", "msu.ac.th", "first", "m-1", "PC-001",
        "2026-08-24T01:00:00.000Z", "2026-08-24T04:00:00.000Z", "confirmed", "hash-1",
        "2026-08-24T00:00:00.000Z", "2026-08-24T00:00:00.000Z", "create-1", 0,
      ],
      [
        "b-cancelled", "BK-CANCELLED", "second@msu.ac.th", "Second", "msu.ac.th", "second", "m-1", "PC-001",
        "2026-08-24T04:15:00.000Z", "2026-08-24T09:00:00.000Z", "cancelled", "hash-2",
        "2026-08-24T00:00:00.000Z", "2026-08-24T00:00:00.000Z", "create-2", 0,
      ],
      [
        "b-ended", "BK-ENDED", "ended@msu.ac.th", "Ended", "msu.ac.th", "ended", "m-1", "PC-001",
        "2026-08-23T21:00:00.000Z", "2026-08-24T00:30:00.000Z", "confirmed", "hash-3",
        "2026-08-23T20:00:00.000Z", "2026-08-23T20:00:00.000Z", "create-3", 0,
      ],
    ];
    const { context, sheets } = runtime(rows, false);
    sheets.Events.appendRow([
      "session-event", "session_started", "session-1", "b-confirmed", "PC-001", "first", "active", "{}",
      "2026-08-24T01:00:00.000Z", "2026-08-24T01:00:00.000Z",
    ]);
    const result = JSON.parse(JSON.stringify(context.createBooking_(createBody, new Date("2026-08-24T00:30:00.000Z"))));

    expect(result.data).toMatchObject({
      startAt: "2026-08-24T04:15:00.000Z",
      endAt: "2026-08-24T07:15:00.000Z",
    });
    expect(rowObject(sheets.Bookings, "b-confirmed").endAt).toBe("2026-08-24T04:00:00.000Z");
  });

  it("rejects a slot crossing Bangkok midnight and an unavailable machine", () => {
    const late = runtime([], false);
    expect(() => late.context.createBooking_(createBody, new Date("2026-08-24T16:00:00.000Z")))
      .toThrow("BOOKING_CROSSES_MIDNIGHT");

    const unavailable = runtime([], false);
    unavailable.sheets.Machines.rows[1][4] = "maintenance";
    expect(() => unavailable.context.createBooking_(createBody, new Date("2026-08-24T00:30:00.000Z")))
      .toThrow("BOOKING_MACHINE_UNAVAILABLE");
  });
});

describe("Google Apps Script booking extension", () => {
  it("adds 180 minutes while keeping the per-extension allowance at 180", () => {
    const { context, sheets } = runtime();
    const first = JSON.parse(JSON.stringify(context.extendBooking_(body, new Date("2026-08-24T03:00:00.000Z"))));
    const repeated = JSON.parse(JSON.stringify(context.extendBooking_(body, new Date("2026-08-24T03:01:00.000Z"))));

    expect(first).toEqual({
      ok: true,
      data: {
        bookingId: "b-1",
        endAt: "2026-08-24T07:30:00.000Z",
        extensionCount: 1,
        allowedMinutes: 180,
      },
    });
    expect(repeated).toEqual(first);
    expect(rowObject(sheets.Bookings, "b-1")).toMatchObject({
      endAt: "2026-08-24T07:30:00.000Z",
      extensionCount: 1,
    });
    expect(rowObject(sheets.Users, "u-1")).toMatchObject({ allowedMinutes: 180 });
  });

  it("does not consume the 15 minute turnaround or mutate rows before the next queue", () => {
    const nextBooking = [
      "b-2", "BK-2", "other@msu.ac.th", "Other", "msu.ac.th", "other", "m-1", "PC-001",
      "2026-08-24T04:45:00.000Z", "2026-08-24T07:45:00.000Z", "confirmed", "hash-2",
      "2026-08-24T00:00:00.000Z", "2026-08-24T00:00:00.000Z", "create-2", 0,
    ];
    const { context, sheets } = runtime([nextBooking]);
    const before = structuredClone({
      bookings: sheets.Bookings.rows,
      users: sheets.Users.rows,
      events: sheets.Events.rows,
      audit: sheets.AuditLog.rows,
    });

    expect(() => context.extendBooking_(body, new Date("2026-08-24T03:00:00.000Z")))
      .toThrow("EXTENSION_NEXT_BOOKING_CONFLICT");
    expect({
      bookings: sheets.Bookings.rows,
      users: sheets.Users.rows,
      events: sheets.Events.rows,
      audit: sheets.AuditLog.rows,
    }).toEqual(before);
  });
});

describe("Google Apps Script daily cleanup", () => {
  it("keeps current rows on install and clears Bookings and Users once after the date changes", () => {
    const { context, sheets } = runtime();

    context.installDailyCleanupTrigger(new Date("2026-08-24T03:00:00.000Z"));
    expect(sheets.Bookings.rows).toHaveLength(2);
    expect(sheets.Users.rows).toHaveLength(2);

    context.dailyCleanupTick_(new Date("2026-08-24T17:00:30.000Z"));
    expect(sheets.Bookings.rows).toEqual([BOOKING_HEADERS]);
    expect(sheets.Users.rows).toEqual([USER_HEADERS]);
    expect(sheets.AuditLog.rows).toHaveLength(2);

    context.dailyCleanupTick_(new Date("2026-08-24T17:01:30.000Z"));
    expect(sheets.AuditLog.rows).toHaveLength(2);
  });
});
