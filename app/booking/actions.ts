"use server";

import {
  createScheduledBooking,
  getPublicBookingOptions,
  type CreatedBooking,
  type PublicBookingOptions,
} from "@/lib/booking/actions";
import { validateScheduledBookingInput } from "@/lib/booking/action-utils";

export type BookingFormState =
  | { ok: false; message?: string }
  | { ok: true; message: string; booking: CreatedBooking };

export async function loadBookingOptionsAction(date: string): Promise<{
  ok: boolean;
  data?: PublicBookingOptions;
  message?: string;
}> {
  const result = await getPublicBookingOptions(date);
  return result.ok ? { ok: true, data: result.data } : result;
}

export async function bookMachineAction(
  _previousState: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const input = validateScheduledBookingInput({
    identity: formData.get("identity"),
    machineId: formData.get("machineId"),
    startAt: formData.get("startAt"),
  });

  if (!input) {
    return { ok: false, message: "กรอกรหัสนิสิตหรืออีเมล @msu.ac.th และเลือกวัน เวลา และเครื่องให้ครบ" };
  }

  const result = await createScheduledBooking(input);
  return result.ok
    ? { ok: true, message: result.message ?? "จองเครื่องสำเร็จ", booking: result.data }
    : result;
}
