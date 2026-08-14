"use server";

import { cancelBooking } from "@/lib/booking/actions";
import { validateMachineId } from "@/lib/booking/action-utils";

export type CancelFormState = {
  ok: boolean;
  message?: string;
};

export async function cancelBookingAction(
  _previousState: CancelFormState,
  formData: FormData,
): Promise<CancelFormState> {
  const bookingId = validateMachineId(formData.get("bookingId"));

  if (!bookingId) {
    return { ok: false, message: "ไม่พบรายการจองที่ต้องการยกเลิก" };
  }

  const result = await cancelBooking(bookingId);
  return { ok: result.ok, message: result.message };
}
