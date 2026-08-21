"use server";

import {
  createScheduledBooking,
  getPublicBookingOptions,
  type CreatedBooking,
  type PublicBookingOptions,
} from "@/lib/booking/actions";

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
  const machineId = formData.get("machineId");
  const startAt = formData.get("startAt");
  const input = typeof machineId === "string" && typeof startAt === "string" && machineId.trim() && startAt.trim()
    ? { machineId: machineId.trim(), startAt: startAt.trim() }
    : null;

  if (!input) {
    return { ok: false, message: "เลือกวัน เวลา และเครื่องให้ครบ" };
  }

  const result = await createScheduledBooking(input);
  return result.ok
    ? { ok: true, message: result.message ?? "จองเครื่องสำเร็จ", booking: result.data }
    : result;
}
