import { describe, expect, it } from "vitest";
import { mapAdminMachineRows, mergeSettingsRows } from "@/lib/admin/sheet-repository";
import { MACHINE_HEADERS, SETTINGS_HEADERS } from "@/lib/google/sheet-schema";

describe("admin Sheet repository helpers", () => {
  it("maps machine rows to the existing admin-card shape", () => {
    const rows = [
      MACHINE_HEADERS,
      ["m-1", "PC-001", "Workstation 1", "AI Lab", "available", "hash", "", "2026-08-21T00:00:00.000Z"],
    ];
    expect(mapAdminMachineRows(rows)).toEqual([{ id: "m-1", machine_code: "PC-001", machine_name: "Workstation 1", location: "AI Lab", status: "available", hasToken: true, lastSeenAt: null }]);
  });

  it("updates settings values while preserving stable headers", () => {
    const rows = [SETTINGS_HEADERS, ["openingTime", "08:30", "old"], ["timezone", "Asia/Bangkok", "old"]];
    const updated = mergeSettingsRows(rows, { openingTime: "09:00", timezone: "Asia/Bangkok" }, "2026-08-21T01:00:00.000Z");
    expect(updated).toEqual([SETTINGS_HEADERS, ["openingTime", "09:00", "2026-08-21T01:00:00.000Z"], ["timezone", "Asia/Bangkok", "2026-08-21T01:00:00.000Z"]]);
  });
});
