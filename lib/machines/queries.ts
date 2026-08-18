import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveMachineConnectionStatus, type MachineSessionStatus } from "@/lib/machines/presence";

export type MachineDashboardRow = {
  id: string;
  machineCode: string;
  machineName: string;
  location: string | null;
  machineStatus: string;
  connectionStatus: "online" | "stale";
  sessionStatus: MachineSessionStatus;
  username: string | null;
  lastSeenAt: string | null;
  reportedAt: string | null;
  appVersion: string | null;
  osVersion: string | null;
  booking: {
    bookingNumber: string;
    startAt: string;
    endAt: string;
    status: string;
  } | null;
};

export async function listMachineDashboard(
  supabase: SupabaseClient,
  now = new Date(),
): Promise<MachineDashboardRow[]> {
  const [{ data: machines, error: machinesError }, { data: presence, error: presenceError }, { data: bookings, error: bookingsError }] = await Promise.all([
    supabase
      .from("machines")
      .select("id, machine_code, machine_name, location, status")
      .order("machine_code", { ascending: true }),
    supabase
      .from("machine_presence")
      .select("machine_id, session_status, username, last_seen_at, reported_at, app_version, os_version"),
    supabase
      .from("bookings")
      .select("machine_id, booking_number, start_at, end_at, status")
      .in("status", ["confirmed", "app_pending", "app_received", "active"]),
  ]);

  if (machinesError) throw machinesError;
  if (presenceError) throw presenceError;
  if (bookingsError) throw bookingsError;

  const presenceByMachine = new Map((presence ?? []).map((row) => [row.machine_id, row]));
  const bookingByMachine = new Map((bookings ?? []).map((row) => [row.machine_id, row]));

  return (machines ?? []).map((machine) => {
    const currentPresence = presenceByMachine.get(machine.id);
    const booking = bookingByMachine.get(machine.id);

    return {
      id: machine.id,
      machineCode: machine.machine_code,
      machineName: machine.machine_name,
      location: machine.location,
      machineStatus: machine.status,
      connectionStatus: deriveMachineConnectionStatus(currentPresence?.last_seen_at, now),
      sessionStatus: (currentPresence?.session_status ?? "logged_out") as MachineSessionStatus,
      username: currentPresence?.username ?? null,
      lastSeenAt: currentPresence?.last_seen_at ?? null,
      reportedAt: currentPresence?.reported_at ?? null,
      appVersion: currentPresence?.app_version ?? null,
      osVersion: currentPresence?.os_version ?? null,
      booking: booking
        ? {
            bookingNumber: booking.booking_number,
            startAt: booking.start_at,
            endAt: booking.end_at,
            status: booking.status,
          }
        : null,
    } satisfies MachineDashboardRow;
  });
}
