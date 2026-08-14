import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureCustomerProfile, requireUniversityUser } from "@/lib/auth/profile";
import { getBookingErrorMessage } from "@/lib/booking/action-utils";
import type { BookingSummary } from "@/lib/booking/queries";

export type BookingActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; message: string };

async function createClientAndProfile() {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const user = await requireUniversityUser(supabase);
  await ensureCustomerProfile(supabase, user);
  return supabase;
}

export async function createBooking(
  machineId: string,
): Promise<BookingActionResult<Record<string, unknown>>> {
  try {
    const supabase = await createClientAndProfile();
    const { data, error } = await supabase.rpc("create_immediate_booking", {
      p_machine_id: machineId,
    });

    if (error) {
      return { ok: false, message: getBookingErrorMessage(error) };
    }

    revalidatePath("/booking");
    revalidatePath("/my-bookings");
    return { ok: true, data: data as Record<string, unknown>, message: "จองเครื่องสำเร็จ" };
  } catch (error) {
    return { ok: false, message: getBookingErrorMessage(error) };
  }
}

export async function cancelBooking(
  bookingId: string,
): Promise<BookingActionResult> {
  try {
    const supabase = await createClientAndProfile();
    const { error } = await supabase.rpc("cancel_booking", {
      p_booking_id: bookingId,
    });

    if (error) {
      return { ok: false, message: getBookingErrorMessage(error) };
    }

    revalidatePath("/booking");
    revalidatePath("/my-bookings");
    return { ok: true, message: "ยกเลิกการจองแล้ว" };
  } catch (error) {
    return { ok: false, message: getBookingErrorMessage(error) };
  }
}

export async function getAvailableMachines(supabase: SupabaseClient) {
  return supabase
    .from("machines")
    .select("id, machine_code, machine_name, location, status")
    .eq("status", "available")
    .order("machine_code", { ascending: true });
}

export type { BookingSummary };
