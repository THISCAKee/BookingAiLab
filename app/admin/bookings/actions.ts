"use server";

import { revalidatePath } from "next/cache";
import { requireActiveAdmin } from "@/lib/auth/admin";
import { getBookingErrorMessage, validateMachineId } from "@/lib/booking/action-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminBookingState = { ok: boolean; message?: string };

export async function adminCancelBookingAction(
  _previous: AdminBookingState,
  formData: FormData,
): Promise<AdminBookingState> {
  const bookingId = validateMachineId(formData.get("bookingId"));
  if (!bookingId) return { ok: false, message: "ไม่พบรายการจอง" };
  try {
    const supabase = await createSupabaseServerClient();
    await requireActiveAdmin(supabase);
    const { error } = await supabase.rpc("admin_cancel_booking", { p_booking_id: bookingId });
    if (error) return { ok: false, message: getBookingErrorMessage(error) };
    revalidatePath("/admin/bookings");
    revalidatePath("/admin/dashboard");
    revalidatePath("/booking");
    return { ok: true, message: "ยกเลิกการจองแล้ว" };
  } catch (error) {
    return { ok: false, message: getBookingErrorMessage(error) };
  }
}
