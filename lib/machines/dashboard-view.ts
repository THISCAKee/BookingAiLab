import type { MachineDashboardRow } from "@/lib/machines/queries";

export type DashboardFilter = "all" | "online" | "active" | "offline";

export function summarizeDashboardMachines(machines: MachineDashboardRow[]) {
  return {
    all: machines.length,
    online: machines.filter((machine) => machine.operationalStatus === "online").length,
    active: machines.filter((machine) => machine.operationalStatus === "active").length,
    offline: machines.filter((machine) => machine.operationalStatus === "offline").length,
  };
}

export function filterDashboardMachines(
  machines: MachineDashboardRow[],
  filter: DashboardFilter,
) {
  if (filter !== "all") return machines.filter((machine) => machine.operationalStatus === filter);
  return machines;
}
