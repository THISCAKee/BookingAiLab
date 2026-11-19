import { listAdminBookings, listAdminMachines } from "@/lib/admin/sheet-repository";
import { createGoogleSheetsClient, getSheetReadHealth, SHARED_READ_MAX_AGE_MS } from "@/lib/google/sheets-client";
import { getGoogleRuntimeConfig } from "@/lib/google/config";
import { deriveMachineConnectionStatus, deriveTimelockStatus, type MachineSessionStatus, type TimelockOperationalStatus } from "@/lib/machines/presence";
import { parseTimelockUsers } from "@/lib/timelock/sheet-records";

export type MachineDashboardRow = {
  id: string; machineCode: string; machineName: string; location: string | null; machineStatus: string;
  connectionStatus: "online" | "stale"; operationalStatus: TimelockOperationalStatus;
  sessionStatus: MachineSessionStatus; username: string | null; lastSeenAt: string | null;
  reportedAt: string | null; appVersion: string | null; osVersion: string | null;
  booking: { bookingNumber: string; startAt: string; endAt: string; status: string } | null;
};

type DashboardBooking = { machineId: string; status: string; endAt: string };

// A booking only counts as in use while it is "active" and its end time has not passed;
// a missed logout call must not keep the machine marked busy forever.
export function bookingInUse(booking: DashboardBooking, now: Date) {
  const end = Date.parse(booking.endAt);
  return booking.status === "active" && (Number.isNaN(end) || end > now.getTime());
}

// A fresh heartbeat from TimeLockApp is the real-time source of truth; bookings are the fallback
// for sheets without the heartbeat session columns or when the machine has gone quiet.
export function resolveSessionStatus(
  machine: { lastSeenAt: string | null; sessionStatus: MachineSessionStatus | null },
  booking: DashboardBooking | null,
  now: Date,
): MachineSessionStatus {
  if (machine.sessionStatus && deriveMachineConnectionStatus(machine.lastSeenAt, now) === "online") return machine.sessionStatus;
  return booking && bookingInUse(booking, now) ? "logged_in" : "logged_out";
}

export async function listMachineDashboard(now = new Date()): Promise<MachineDashboardRow[]> {
  const [machines, bookings] = await Promise.all([listAdminMachines(), listAdminBookings()]);
  return machines.map((machine) => {
    const current = bookings.find((booking) => booking.machineId === machine.id && !["completed", "cancelled", "expired"].includes(booking.status) && (booking.status !== "active" || bookingInUse(booking, now))) ?? null;
    const sessionStatus = resolveSessionStatus(machine, current, now);
    const lastSeenAt = machine.lastSeenAt;
    return {
      id: machine.id, machineCode: machine.machine_code, machineName: machine.machine_name,
      location: machine.location, machineStatus: machine.status,
      connectionStatus: deriveMachineConnectionStatus(lastSeenAt, now),
      operationalStatus: deriveTimelockStatus(lastSeenAt, sessionStatus, now), sessionStatus,
      username: sessionStatus === "logged_out" ? null : machine.sessionUsername ?? current?.emailPrefix ?? null,
      lastSeenAt, reportedAt: null, appVersion: null, osVersion: null,
      booking: current ? { bookingNumber: current.bookingNumber, startAt: current.startAt, endAt: current.endAt, status: current.status } : null,
    };
  });
}

export type TimelockSyncHealth = { lastSuccessAt: string | null; lastError: string | null; syncedRowCount: number; pendingOutboxCount: number };

// Call after the dashboard rows are loaded so the read health reflects this request's Sheet reads.
export async function getTimelockSyncHealth(): Promise<TimelockSyncHealth> {
  let syncedRowCount = 0;
  try {
    const rows = await createGoogleSheetsClient({ spreadsheetId: getGoogleRuntimeConfig().spreadsheetId }).readSheet("Users", { maxAgeMs: SHARED_READ_MAX_AGE_MS });
    syncedRowCount = parseTimelockUsers(rows).filter((user) => user.isActive).length;
  } catch (error) {
    const health = getSheetReadHealth();
    return { ...health, lastError: health.lastError ?? (error instanceof Error ? error.message : "SHEET_SYNC_FAILED"), syncedRowCount, pendingOutboxCount: 0 };
  }
  return { ...getSheetReadHealth(), syncedRowCount, pendingOutboxCount: 0 };
}
