import { describe, expect, it } from "vitest";
import { summarizeAdminOverview, bookingActivity } from "@/lib/admin/overview";

describe("admin overview", () => {
  it("counts open bookings and combines online and active machines", () => {
    expect(summarizeAdminOverview(
      [{ status: "confirmed" }, { status: "active" }, { status: "completed" }, { status: "cancelled" }],
      [{ operationalStatus: "online" }, { operationalStatus: "active" }, { operationalStatus: "offline" }],
    )).toEqual({ totalBookings: 4, openBookings: 2, onlineMachines: 2, offlineMachines: 1 });
  });
  it("groups recent bookings by Bangkok calendar day and ignores invalid dates", () => {
    const result = bookingActivity([
      { createdAt: "2026-11-02T18:00:00Z" },
      { createdAt: "2026-11-03T10:00:00Z" },
      { createdAt: "invalid" },
    ], new Date("2026-11-03T10:00:00Z"));
    expect(result).toHaveLength(7);
    expect(result.at(-1)).toMatchObject({ date: "2026-11-03", count: 2 });
    expect(result.reduce((sum, day) => sum + day.count, 0)).toBe(2);
  });
});
