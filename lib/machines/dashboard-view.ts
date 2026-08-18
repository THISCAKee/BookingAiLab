import type { MachineDashboardRow } from "@/lib/machines/queries";

export type DashboardFilter = "all" | "online" | "logged_in" | "stale";

export function summarizeDashboardMachines(machines: MachineDashboardRow[]) {
  return {
    all: machines.length,
    online: machines.filter((machine) => machine.connectionStatus === "online").length,
    loggedIn: machines.filter((machine) => machine.sessionStatus === "logged_in").length,
    stale: machines.filter((machine) => machine.connectionStatus === "stale").length,
  };
}

export function filterDashboardMachines(
  machines: MachineDashboardRow[],
  filter: DashboardFilter,
) {
  if (filter === "online") return machines.filter((machine) => machine.connectionStatus === "online");
  if (filter === "logged_in") return machines.filter((machine) => machine.sessionStatus === "logged_in");
  if (filter === "stale") return machines.filter((machine) => machine.connectionStatus === "stale");
  return machines;
}
