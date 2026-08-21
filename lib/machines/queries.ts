import { listAdminBookings, listAdminMachines } from "@/lib/admin/sheet-repository";
import { deriveMachineConnectionStatus, deriveTimelockStatus, type MachineSessionStatus, type TimelockOperationalStatus } from "@/lib/machines/presence";

export type MachineDashboardRow = {
  id: string; machineCode: string; machineName: string; location: string | null; machineStatus: string;
  connectionStatus: "online" | "stale"; operationalStatus: TimelockOperationalStatus;
  sessionStatus: MachineSessionStatus; username: string | null; lastSeenAt: string | null;
  reportedAt: string | null; appVersion: string | null; osVersion: string | null;
  booking: { bookingNumber: string; startAt: string; endAt: string; status: string } | null;
};

export async function listMachineDashboard(now = new Date()): Promise<MachineDashboardRow[]> {
  const [machines, bookings] = await Promise.all([listAdminMachines(), listAdminBookings()]);
  return machines.map((machine) => {
    const current = bookings.find((booking) => booking.machineId === machine.id && !["completed", "cancelled", "expired"].includes(booking.status)) ?? null;
    const sessionStatus: MachineSessionStatus = current?.status === "active" ? "logged_in" : "logged_out";
    const lastSeenAt = machine.lastSeenAt;
    return {
      id: machine.id, machineCode: machine.machine_code, machineName: machine.machine_name,
      location: machine.location, machineStatus: machine.status,
      connectionStatus: deriveMachineConnectionStatus(lastSeenAt, now),
      operationalStatus: deriveTimelockStatus(lastSeenAt, sessionStatus, now), sessionStatus,
      username: current?.emailPrefix ?? null, lastSeenAt, reportedAt: null, appVersion: null, osVersion: null,
      booking: current ? { bookingNumber: current.bookingNumber, startAt: current.startAt, endAt: current.endAt, status: current.status } : null,
    };
  });
}

export type TimelockSyncHealth = { lastSuccessAt: string | null; lastError: string | null; syncedRowCount: number; pendingOutboxCount: number };
export async function getTimelockSyncHealth(): Promise<TimelockSyncHealth | null> { return null; }
