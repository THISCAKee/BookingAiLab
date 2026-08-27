import { describe, expect, it, vi } from "vitest";
import {
  checkTimelockExtension,
  confirmTimelockExtension,
  type SheetDeviceContext,
} from "@/lib/timelock/sheet-gateway";
import { BOOKING_HEADERS } from "@/lib/google/sheet-schema";
import { TIMELOCK_EVENT_HEADERS, TIMELOCK_USER_HEADERS } from "@/lib/timelock/sheet-records";

const device: SheetDeviceContext = { id: "m-1", machineCode: "PC-001" };

const userRows = [
  [...TIMELOCK_USER_HEADERS],
  [
    "u-1", "student@msu.ac.th", "Student", "student", "student", "user", "PC-001",
    "pbkdf2-sha256", "600000", "salt", "hash", "180", "TRUE", "b-1",
    "2026-08-24T00:00:00.000Z",
  ],
];

const eventRows = [
  [...TIMELOCK_EVENT_HEADERS],
  [
    "e-1", "session_started", "s-1", "b-1", "PC-001", "student", "active", "{}",
    "2026-08-24T01:30:00.000Z", "2026-08-24T01:30:00.000Z",
  ],
];

const bookingRows = [
  [...BOOKING_HEADERS],
  [
    "b-1", "BK-1", "student@msu.ac.th", "Student", "msu.ac.th", "student", "m-1",
    "PC-001", "2026-08-24T01:30:00.000Z", "2026-08-24T04:30:00.000Z", "active",
    "manage-hash", "2026-08-24T00:00:00.000Z", "2026-08-24T00:00:00.000Z", "create-1", "0",
  ],
];

function sheets() {
  return {
    readSheet: vi.fn(async (tab: string) => ({
      Users: userRows,
      Events: eventRows,
      Bookings: bookingRows,
    })[tab] ?? []),
    appendSheetRow: vi.fn().mockResolvedValue(undefined),
    updateSheetRow: vi.fn().mockResolvedValue(undefined),
  };
}

describe("TimeLock extension gateway", () => {
  it("checks an active session against booking queues", async () => {
    await expect(checkTimelockExtension(device, { sessionId: "s-1" }, {
      sheets: sheets(),
      now: () => new Date("2026-08-24T03:00:00.000Z"),
    })).resolves.toEqual({
      canExtend: true,
      reason: "EXTENSION_AVAILABLE",
      currentEndAt: "2026-08-24T04:30:00.000Z",
      proposedEndAt: "2026-08-24T07:30:00.000Z",
      extensionCount: 0,
      maxExtensionCount: 2,
    });
  });

  it("confirms with only server-resolved references", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        bookingId: "b-1",
        endAt: "2026-08-24T07:30:00.000Z",
        extensionCount: 1,
        allowedMinutes: 360,
      },
    }), { status: 200 }));

    await expect(confirmTimelockExtension(device, {
      sessionId: "s-1",
      idempotencyKey: "request-1",
    }, {
      sheets: sheets(),
      now: () => new Date("2026-08-24T03:00:00.000Z"),
      atomic: { url: "https://script.example.test/exec", secret: "secret", fetchImpl },
    })).resolves.toEqual({
      bookingId: "b-1",
      endAt: "2026-08-24T07:30:00.000Z",
      extensionCount: 1,
      allowedMinutes: 360,
    });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    expect(body).toEqual({
      operation: "extend_booking",
      secret: "secret",
      idempotencyKey: "request-1",
      payload: {
        sessionId: "s-1",
        bookingId: "b-1",
        machineCode: "PC-001",
        username: "student",
      },
    });
    expect(body.payload).not.toHaveProperty("proposedEndAt");
    expect(body.payload).not.toHaveProperty("allowedMinutes");
  });
});
