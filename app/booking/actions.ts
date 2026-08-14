"use server";

import { createBooking } from "@/lib/booking/actions";
import { validateMachineId } from "@/lib/booking/action-utils";

export type BookingFormState = {
  ok: boolean;
  message?: string;
};

export async function bookMachineAction(
  _previousState: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const machineId = validateMachineId(formData.get("machineId"));

  if (!machineId) {
    return { ok: false, message: "ไม่พบเครื่องที่ต้องการจอง" };
  }

  const result = await createBooking(machineId);
  return { ok: result.ok, message: result.message };
}
