import { describe, expect, it } from "vitest";
import {
  filterDashboardMachines,
  summarizeDashboardMachines,
} from "@/lib/machines/dashboard-view";
import type { MachineDashboardRow } from "@/lib/machines/queries";

const machines: MachineDashboardRow[] = [
  {
    id: "machine-1",
    machineCode: "LAB-01",
    machineName: "Workstation 01",
    location: "AI Lab",
    machineStatus: "available",
    connectionStatus: "online",
    operationalStatus: "active",
    sessionStatus: "logged_in",
    username: "student@msu.ac.th",
    lastSeenAt: "2026-08-18T16:00:00.000Z",
    reportedAt: "2026-08-18T16:00:00.000Z",
    appVersion: "1.0.0",
    osVersion: "Windows 11",
    booking: null,
  },
  {
    id: "machine-2",
    machineCode: "LAB-02",
    machineName: "Workstation 02",
    location: "AI Lab",
    machineStatus: "available",
    connectionStatus: "online",
    operationalStatus: "online",
    sessionStatus: "idle",
    username: null,
    lastSeenAt: "2026-08-18T16:00:00.000Z",
    reportedAt: "2026-08-18T16:00:00.000Z",
    appVersion: "1.0.0",
    osVersion: "Windows 11",
    booking: null,
  },
  {
    id: "machine-3",
    machineCode: "LAB-03",
    machineName: "Workstation 03",
    location: "AI Lab",
    machineStatus: "maintenance",
    connectionStatus: "stale",
    operationalStatus: "offline",
    sessionStatus: "logged_out",
    username: null,
    lastSeenAt: null,
    reportedAt: null,
    appVersion: null,
    osVersion: null,
    booking: null,
  },
];

describe("admin dashboard view", () => {
  it("summarizes the live room state independently", () => {
    expect(summarizeDashboardMachines(machines)).toEqual({
      all: 3,
      online: 1,
      active: 1,
      offline: 1,
    });
  });

  it("filters machines by connection and login state", () => {
    expect(filterDashboardMachines(machines, "online").map((machine) => machine.id)).toEqual(["machine-2"]);
    expect(filterDashboardMachines(machines, "active").map((machine) => machine.id)).toEqual(["machine-1"]);
    expect(filterDashboardMachines(machines, "offline").map((machine) => machine.id)).toEqual(["machine-3"]);
    expect(filterDashboardMachines(machines, "all").map((machine) => machine.id)).toEqual(["machine-1", "machine-2", "machine-3"]);
  });
});
