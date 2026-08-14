import type { SupabaseClient } from "@supabase/supabase-js";

export type Machine = {
  id: string;
  machine_code: string;
  machine_name: string;
  location: string | null;
  status: string;
};

export type BookingSummary = {
  id: string;
  booking_number: string;
  machine_id: string;
  start_at: string;
  end_at: string;
  status: string;
  machine: {
    machine_code: string;
    machine_name: string;
    location: string | null;
  } | null;
};

export async function listAvailableMachines(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("machines")
    .select("id, machine_code, machine_name, location, status")
    .eq("status", "available")
    .order("machine_code", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as Machine[];
}

export async function listMyBookings(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, booking_number, machine_id, start_at, end_at, status, machines(machine_code, machine_name, location)",
    )
    .order("start_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as BookingSummary[];
}
