"use server";

import {
  cancelManagedBooking,
  getManagedBooking,
  type ManagedBooking,
} from "@/lib/booking/actions";
import { normalizeManagementCredentials } from "@/lib/booking/action-utils";

export type LookupState =
  | { ok: false; message?: string }
  | { ok: true; message?: string; booking: ManagedBooking; bookingNumber: string; manageCode: string };

export async function lookupBookingAction(
  _previousState: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const credentials = normalizeManagementCredentials(
    formData.get("bookingNumber"),
    formData.get("manageCode"),
  );
  if (!credentials) return { ok: false, message: "กรอกเลขที่การจองและรหัสจัดการให้ครบ" };

  const result = await getManagedBooking(credentials.bookingNumber, credentials.manageCode);
  return result.ok ? { ok: true, booking: result.data, ...credentials } : result;
}

export async function cancelBookingAction(
  _previousState: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const credentials = normalizeManagementCredentials(
    formData.get("bookingNumber"),
    formData.get("manageCode"),
  );
  if (!credentials) return { ok: false, message: "ข้อมูลสำหรับยกเลิกไม่ครบ" };

  const cancelled = await cancelManagedBooking(credentials.bookingNumber, credentials.manageCode);
  if (!cancelled.ok) return cancelled;
  const refreshed = await getManagedBooking(credentials.bookingNumber, credentials.manageCode);
  return refreshed.ok
    ? { ok: true, message: cancelled.message, booking: refreshed.data, ...credentials }
    : { ok: false, message: cancelled.message };
}
