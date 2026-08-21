"use server";

import { revalidatePath } from "next/cache";
import { requireAdminIdentity } from "@/lib/auth/identity";
import { getBookingErrorMessage, validateMachineId } from "@/lib/booking/action-utils";
import { updateAdminBookingStatus } from "@/lib/admin/sheet-repository";

export type AdminBookingState = { ok: boolean; message?: string };

export async function adminCancelBookingAction(
  _previous: AdminBookingState,
  formData: FormData,
): Promise<AdminBookingState> {
  const bookingId = validateMachineId(formData.get("bookingId"));
  if (!bookingId) return { ok: false, message: "ไม่พบรายการจอง" };
  try {
    await requireAdminIdentity();
    await updateAdminBookingStatus(bookingId, "cancelled");
    revalidatePath("/admin/bookings");
    revalidatePath("/admin/dashboard");
    revalidatePath("/booking");
    return { ok: true, message: "ยกเลิกการจองแล้ว" };
  } catch (error) {
    return { ok: false, message: getBookingErrorMessage(error) };
  }
}
