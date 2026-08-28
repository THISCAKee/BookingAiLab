import { describe, expect, it, vi } from "vitest";
import { syncTimelockDevice, type SheetDeviceContext } from "@/lib/timelock/sheet-gateway";
import { BOOKING_HEADERS } from "@/lib/google/sheet-schema";
import { TIMELOCK_USER_HEADERS } from "@/lib/timelock/sheet-records";

const device: SheetDeviceContext = { id: "m-1", machineCode: "PC-001" };

function user(id: string, username: string, bookingId: string, machineCode = "PC-001") {
  return [
    id, `${username}@msu.ac.th`, username, username, username, "user", machineCode,
    "pbkdf2-sha256", "600000", `salt-${id}`, `hash-${id}`, "180", "TRUE", bookingId,
    "2026-08-24T00:00:00.000Z",
  ];
}

function booking(
  id: string,
  username: string,
  startAt: string,
  endAt: string,
  status = "confirmed",
  machineCode = "PC-001",
) {
  return [
    id, `BK-${id}`, `${username}@msu.ac.th`, username, "msu.ac.th", username,
    machineCode === "PC-001" ? "m-1" : "m-2", machineCode, startAt, endAt, status,
    `manage-${id}`, "2026-08-24T00:00:00.000Z", "2026-08-24T00:00:00.000Z", `create-${id}`, "0",
  ];
}

describe("TimeLock offline sync eligibility", () => {
  it("keeps an active account available after its provisional end", async () => {
    const userRows = [
      [...TIMELOCK_USER_HEADERS],
      user("u-late", "late", "b-late"),
    ];
    const bookingRows = [
      [...BOOKING_HEADERS],
      booking("b-late", "late", "2026-08-24T01:00:00.000Z", "2026-08-24T03:00:00.000Z"),
    ];
    const sheets = {
      readSheet: vi.fn(async (tab: string) => tab === "Users" ? userRows : bookingRows),
      appendSheetRow: vi.fn().mockResolvedValue(undefined),
      updateSheetRow: vi.fn().mockResolvedValue(undefined),
    };

    await expect(syncTimelockDevice(device, {
      sheets,
      now: () => new Date("2026-08-24T05:00:00.000Z"),
    })).resolves.toEqual([expect.objectContaining({
      id: "u-late",
      username: "late",
      expiresAt: "2026-08-24T03:00:00.000Z",
    })]);
  });

  it("returns accounts whose matching booking is still non-terminal", async () => {
    const userRows = [
      [...TIMELOCK_USER_HEADERS],
      user("u-current", "current", "b-current"),
      user("u-future", "future", "b-future"),
      user("u-ended", "ended", "b-ended"),
      user("u-cancelled", "cancelled", "b-cancelled"),
      user("u-wrong", "wrong", "b-wrong", "PC-002"),
    ];
    const bookingRows = [
      [...BOOKING_HEADERS],
      booking("b-current", "current", "2026-08-24T02:00:00.000Z", "2026-08-24T05:00:00.000Z"),
      booking("b-future", "future", "2026-08-24T05:15:00.000Z", "2026-08-24T08:15:00.000Z"),
      booking("b-ended", "ended", "2026-08-23T23:00:00.000Z", "2026-08-24T03:00:00.000Z"),
      booking("b-cancelled", "cancelled", "2026-08-24T02:00:00.000Z", "2026-08-24T05:00:00.000Z", "cancelled"),
      booking("b-wrong", "wrong", "2026-08-24T02:00:00.000Z", "2026-08-24T05:00:00.000Z", "confirmed", "PC-002"),
    ];
    const sheets = {
      readSheet: vi.fn(async (tab: string) => tab === "Users" ? userRows : bookingRows),
      appendSheetRow: vi.fn().mockResolvedValue(undefined),
      updateSheetRow: vi.fn().mockResolvedValue(undefined),
    };

    await expect(syncTimelockDevice(device, {
      sheets,
      now: () => new Date("2026-08-24T03:00:00.000Z"),
    })).resolves.toEqual([
      expect.objectContaining({ id: "u-current", username: "current", expiresAt: "2026-08-24T05:00:00.000Z" }),
      expect.objectContaining({ id: "u-future", username: "future", expiresAt: "2026-08-24T08:15:00.000Z" }),
      expect.objectContaining({ id: "u-ended", username: "ended", expiresAt: "2026-08-24T03:00:00.000Z" }),
    ]);
  });
});
