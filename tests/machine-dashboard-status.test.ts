import { describe, expect, it } from "vitest";
import { bookingInUse, bookingMachineOffline, resolveSessionStatus } from "@/lib/machines/queries";

const now = new Date("2026-11-18T12:00:00.000Z");
const fresh = "2026-11-18T11:59:50.000Z";
const stale = "2026-11-18T11:50:00.000Z";
const activeBooking = { machineId: "m-1", status: "active", endAt: "2026-11-18T13:00:00.000Z" };

describe("machine dashboard session status", () => {
  it("stops treating an active booking as in use once its end time passes", () => {
    expect(bookingInUse(activeBooking, now)).toBe(true);
    expect(bookingInUse({ ...activeBooking, endAt: "2026-11-18T11:00:00.000Z" }, now)).toBe(false);
  });

  it("trusts a fresh heartbeat over a booking that was never closed", () => {
    expect(resolveSessionStatus({ lastSeenAt: fresh, sessionStatus: "logged_out" }, activeBooking, now)).toBe("logged_out");
    expect(resolveSessionStatus({ lastSeenAt: fresh, sessionStatus: "logged_in" }, null, now)).toBe("logged_in");
  });

  it("falls back to the booking when the heartbeat is stale or has no session column", () => {
    expect(resolveSessionStatus({ lastSeenAt: stale, sessionStatus: "logged_out" }, activeBooking, now)).toBe("logged_in");
    expect(resolveSessionStatus({ lastSeenAt: fresh, sessionStatus: null }, activeBooking, now)).toBe("logged_in");
  });

  it("flags an in-use booking whose machine stopped sending heartbeats", () => {
    expect(bookingMachineOffline(activeBooking, { lastSeenAt: stale }, now)).toBe(true);
    expect(bookingMachineOffline(activeBooking, undefined, now)).toBe(true);
    expect(bookingMachineOffline(activeBooking, { lastSeenAt: fresh }, now)).toBe(false);
    expect(bookingMachineOffline({ ...activeBooking, status: "confirmed" }, { lastSeenAt: stale }, now)).toBe(false);
  });
});
