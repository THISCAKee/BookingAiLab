import { describe, expect, it } from "vitest";
import { summarizeAdminOverview } from "@/lib/admin/overview";

describe("admin overview", () => {
  it("counts open bookings and combines online and active machines", () => {
    expect(summarizeAdminOverview(
      [{ status: "confirmed" }, { status: "active" }, { status: "completed" }, { status: "cancelled" }],
      [{ operationalStatus: "online" }, { operationalStatus: "active" }, { operationalStatus: "offline" }],
    )).toEqual({ totalBookings: 4, openBookings: 2, onlineMachines: 2, offlineMachines: 1 });
  });
});
