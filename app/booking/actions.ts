"use server";

import {
  createScheduledBooking,
  getPublicBookingOptions,
  type CreatedBooking,
  type PublicBookingOptions,
} from "@/lib/booking/actions";
import { toBookingFailure, type BookingFailure } from "@/lib/booking/action-utils";

export type BookingFormState =
  | BookingFailure
  | { ok: true; code: "BOOKING_CONFIRMED"; message: string; booking: CreatedBooking };

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
    return toBookingFailure(new Error("BOOKING_INPUT_INVALID"));
  }

  const result = await createScheduledBooking(input);
  return result.ok
    ? { ok: true, code: "BOOKING_CONFIRMED", message: result.message ?? "จองเครื่องสำเร็จ", booking: result.data }
    : result;
}
