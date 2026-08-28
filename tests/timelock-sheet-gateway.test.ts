import { describe, expect, it, vi } from "vitest";
import {
  loginTimelockUser,
  logoutTimelockUser,
  type SheetDeviceContext,
} from "@/lib/timelock/sheet-gateway";
import { TIMELOCK_EVENT_HEADERS, TIMELOCK_USER_HEADERS } from "@/lib/timelock/sheet-records";
import { BOOKING_HEADERS } from "@/lib/google/sheet-schema";
import { createPasswordVerifier } from "@/lib/timelock/passwords";

const device: SheetDeviceContext = { id: "m-1", machineCode: "PC-001" };

async function scheduledLoginSheets() {
  const password = await createPasswordVerifier("secret-password");
  const userRows = [
    [...TIMELOCK_USER_HEADERS],
    [
      "u-1", "student@msu.ac.th", "Student", "student", "student", "user", "PC-001",
      password.algorithm, String(password.iterations), password.salt, password.hash,
      "180", "TRUE", "b-1", "2026-08-24T00:00:00.000Z",
    ],
  ];
  const bookingRows = [
    [...BOOKING_HEADERS],
    [
      "b-1", "BK-1", "student@msu.ac.th", "Student", "msu.ac.th", "student", "m-1",
      "PC-001", "2026-08-24T01:30:00.000Z", "2026-08-24T04:30:00.000Z", "confirmed",
      "manage-hash", "2026-08-24T00:00:00.000Z", "2026-08-24T00:00:00.000Z", "create-1", "0",
    ],
  ];
  return {
    appendSheetRow: vi.fn().mockResolvedValue(undefined),
    updateSheetRow: vi.fn().mockResolvedValue(undefined),
    readSheet: vi.fn(async (tab: string) => tab === "Users" ? userRows : bookingRows),
  };
}

describe("TimeLock Sheet gateway sessions", () => {
  it("starts the full allowance when login happens after the provisional end", async () => {
    const sheets = await scheduledLoginSheets();
    const ids = ["s-late", "e-late"];

    const result = await loginTimelockUser(device, {
      username: "student",
      password: "secret-password",
    }, {
      sheets,
      now: () => new Date("2026-08-24T05:00:00.000Z"),
      randomId: () => ids.shift() ?? "unexpected",
    });

    expect(result).toMatchObject({
      startedAt: "2026-08-24T05:00:00.000Z",
      endAt: "2026-08-24T08:00:00.000Z",
      allowedMinutes: 180,
      status: "active",
    });
    expect(sheets.updateSheetRow).toHaveBeenCalledWith("Bookings", 2, expect.arrayContaining([
      "2026-08-24T05:00:00.000Z",
      "2026-08-24T08:00:00.000Z",
      "active",
    ]));
  });

  it("rejects a login when the full allowance would cross Bangkok midnight", async () => {
    const sheets = await scheduledLoginSheets();

    await expect(loginTimelockUser(device, {
      username: "student",
      password: "secret-password",
    }, {
      sheets,
      now: () => new Date("2026-08-24T16:00:00.000Z"),
    })).rejects.toThrow("BOOKING_CROSSES_MIDNIGHT");
    expect(sheets.updateSheetRow).not.toHaveBeenCalled();
    expect(sheets.appendSheetRow).not.toHaveBeenCalled();
  });

  it("allows login before the provisional start and starts timing at login", async () => {
    const sheets = await scheduledLoginSheets();

    await expect(loginTimelockUser(device, {
      username: "student",
      password: "secret-password",
    }, {
      sheets,
      now: () => new Date("2026-08-24T01:29:59.999Z"),
    })).resolves.toMatchObject({
      startedAt: "2026-08-24T01:29:59.999Z",
      endAt: "2026-08-24T04:29:59.999Z",
      status: "active",
    });
    expect(sheets.appendSheetRow).toHaveBeenCalledOnce();
  });

  it("allows login one millisecond before the scheduled end", async () => {
    const sheets = await scheduledLoginSheets();

    await expect(loginTimelockUser(device, {
      username: "student",
      password: "secret-password",
    }, {
      sheets,
      now: () => new Date("2026-08-24T04:29:59.999Z"),
      randomId: () => "generated-id",
    })).resolves.toMatchObject({ bookingId: "b-1" });
    expect(sheets.appendSheetRow).toHaveBeenCalledOnce();
  });

  it("allows login at the provisional end and starts a fresh full allowance", async () => {
    const sheets = await scheduledLoginSheets();

    await expect(loginTimelockUser(device, {
      username: "student",
      password: "secret-password",
    }, {
      sheets,
      now: () => new Date("2026-08-24T04:30:00.000Z"),
    })).resolves.toMatchObject({
      startedAt: "2026-08-24T04:30:00.000Z",
      endAt: "2026-08-24T07:30:00.000Z",
      status: "active",
    });
    expect(sheets.appendSheetRow).toHaveBeenCalledOnce();
  });

  it("appends a session_started event after verifying login", async () => {
    const verifier = await createPasswordVerifier("secret-password");
    const userRows = [
      [...TIMELOCK_USER_HEADERS],
      [
        "u-1", "student@msu.ac.th", "Student", "student", "student", "user", "PC-001",
        verifier.algorithm, String(verifier.iterations), verifier.salt, verifier.hash,
        "180", "TRUE", "b-1", "2026-08-24T00:00:00.000Z",
      ],
    ];
    const bookingRows = [
      [...BOOKING_HEADERS],
      [
        "b-1", "BK-1", "student@msu.ac.th", "Student", "msu.ac.th", "student", "m-1",
        "PC-001", "2026-08-24T01:30:00.000Z", "2026-08-24T04:30:00.000Z", "confirmed",
        "manage-hash", "2026-08-24T00:00:00.000Z", "2026-08-24T00:00:00.000Z", "create-1", "0",
      ],
    ];
    const sheets = {
      readSheet: vi.fn(async (tab: string) => tab === "Users" ? userRows : bookingRows),
      appendSheetRow: vi.fn().mockResolvedValue(undefined),
      updateSheetRow: vi.fn().mockResolvedValue(undefined),
    };
    const ids = ["s-1", "e-1"];

    await expect(loginTimelockUser(device, {
      username: "student",
      password: "secret-password",
    }, {
      sheets,
      now: () => new Date("2026-08-24T01:30:00.000Z"),
      randomId: () => ids.shift() ?? "unexpected",
    })).resolves.toEqual({
      sessionId: "s-1",
      bookingId: "b-1",
      bookingNumber: "BK-1",
      username: "student",
      machineCode: "PC-001",
      startedAt: "2026-08-24T01:30:00.000Z",
      endAt: "2026-08-24T04:30:00.000Z",
      allowedMinutes: 180,
      extensionCount: 0,
      status: "active",
    });

    expect(sheets.appendSheetRow).toHaveBeenCalledWith("Events", [
      "e-1", "session_started", "s-1", "b-1", "PC-001", "student", "active", "{}",
      "2026-08-24T01:30:00.000Z", "2026-08-24T01:30:00.000Z",
    ]);
  });

  it("rejects an account whose active booking is missing without starting a session", async () => {
    const verifier = await createPasswordVerifier("secret-password");
    const sheets = {
      readSheet: vi.fn(async (tab: string) => tab === "Users" ? [
        [...TIMELOCK_USER_HEADERS],
        [
          "u-1", "student@msu.ac.th", "Student", "student", "student", "user", "PC-001",
          verifier.algorithm, String(verifier.iterations), verifier.salt, verifier.hash,
          "180", "TRUE", "missing-booking", "2026-08-24T00:00:00.000Z",
        ],
      ] : [[...BOOKING_HEADERS]]),
      appendSheetRow: vi.fn().mockResolvedValue(undefined),
      updateSheetRow: vi.fn().mockResolvedValue(undefined),
    };

    await expect(loginTimelockUser(device, {
      username: "student",
      password: "secret-password",
    }, { sheets })).rejects.toThrow("ACCOUNT_MACHINE_MISMATCH");
    expect(sheets.appendSheetRow).not.toHaveBeenCalled();
  });

  it.each(["logged_out", "completed", "forced_logout"] as const)(
    "revokes the old password and completes the booking after %s",
    async (status) => {
      const verifier = await createPasswordVerifier("secret-password");
      const userRows = [
        [...TIMELOCK_USER_HEADERS],
        [
          "u-1", "student@msu.ac.th", "Student", "student", "student", "user", "PC-001",
          verifier.algorithm, String(verifier.iterations), verifier.salt, verifier.hash,
          "180", "TRUE", "b-1", "2026-08-24T00:00:00.000Z",
        ],
      ];
      const bookingRows = [
        [...BOOKING_HEADERS],
        [
          "b-1", "BK-1", "student@msu.ac.th", "Student", "msu.ac.th", "student", "m-1",
          "PC-001", "2026-08-24T01:30:00.000Z", "2026-08-24T04:30:00.000Z", "confirmed",
          "manage-hash", "2026-08-24T00:00:00.000Z", "2026-08-24T00:00:00.000Z", "create-1", "0",
        ],
      ];
      const eventRows = [
        [...TIMELOCK_EVENT_HEADERS],
        [
          "e-1", "session_started", "s-1", "b-1", "PC-001", "student", "active", "{}",
          "2026-08-24T01:30:00.000Z", "2026-08-24T01:30:00.000Z",
        ],
      ];
      const rows = { Users: userRows, Bookings: bookingRows, Events: eventRows };
      const sheets = {
        readSheet: vi.fn(async (tab: keyof typeof rows) => structuredClone(rows[tab])),
        appendSheetRow: vi.fn(async (tab: keyof typeof rows, row: string[]) => { rows[tab].push([...row]); }),
        updateSheetRow: vi.fn(async (tab: keyof typeof rows, rowNumber: number, row: string[]) => { rows[tab][rowNumber - 1] = [...row]; }),
      };

      await expect(logoutTimelockUser(device, {
        sessionId: "s-1",
        usedSeconds: 10_800,
        status,
      }, {
        sheets,
        now: () => new Date("2026-08-24T04:30:00.000Z"),
        randomId: () => "e-2",
      })).resolves.toEqual({
        sessionId: "s-1",
        machineCode: "PC-001",
        usedSeconds: 10_800,
        status,
        endedAt: "2026-08-24T04:30:00.000Z",
      });

      expect(userRows[1][TIMELOCK_USER_HEADERS.indexOf("isActive")]).toBe("FALSE");
      expect(userRows[1][TIMELOCK_USER_HEADERS.indexOf("userId")]).toBe("u-1");
      expect(userRows[1][TIMELOCK_USER_HEADERS.indexOf("username")]).toBe("student");
      expect(bookingRows[1][BOOKING_HEADERS.indexOf("status")]).toBe("completed");
      expect(eventRows.at(-1)).toEqual([
        "e-2", "session_ended", "s-1", "b-1", "PC-001", "student", status,
        JSON.stringify({ usedSeconds: 10_800 }),
        "2026-08-24T04:30:00.000Z", "2026-08-24T04:30:00.000Z",
      ]);
      await expect(loginTimelockUser(device, {
        username: "student",
        password: "secret-password",
      }, { sheets })).rejects.toThrow("CREDENTIALS_INVALID");
      expect(eventRows).toHaveLength(3);
    },
  );
});
