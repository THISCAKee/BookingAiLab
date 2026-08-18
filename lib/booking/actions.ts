import { revalidatePath } from "next/cache";
import { getBookingErrorMessage } from "@/lib/booking/action-utils";

export type PublicMachineOption = {
  id: string;
  machineCode: string;
  machineName: string;
  location: string | null;
  available: boolean;
};

export type PublicBookingSlot = {
  startAt: string;
  endAt: string;
  label: string;
  machines: PublicMachineOption[];
};

export type PublicBookingOptions = {
  date: string;
  slots: PublicBookingSlot[];
};

export type CreatedBooking = {
  bookingId: string;
  bookingNumber: string;
  manageCode: string;
  machineCode: string;
  startAt: string;
  endAt: string;
  status: string;
};

export type ManagedBooking = {
  bookingId: string;
  bookingNumber: string;
  machineCode: string;
  machineName: string;
  location: string | null;
  startAt: string;
  endAt: string;
  status: string;
  canCancel: boolean;
};

export type BookingActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; message: string };

async function getClient() {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  return createSupabaseServerClient();
}

export async function getPublicBookingOptions(
  date: string,
): Promise<BookingActionResult<PublicBookingOptions>> {
  try {
    const supabase = await getClient();
    const { data, error } = await supabase.rpc("get_booking_options", {
      p_booking_date: date,
    });
    if (error) return { ok: false, message: getBookingErrorMessage(error) };
    return { ok: true, data: data as PublicBookingOptions };
  } catch (error) {
    return { ok: false, message: getBookingErrorMessage(error) };
  }
}

export async function createScheduledBooking(input: {
  identity: string;
  machineId: string;
  startAt: string;
}): Promise<BookingActionResult<CreatedBooking>> {
  try {
    const supabase = await getClient();
    const { data, error } = await supabase.rpc("create_scheduled_booking", {
      p_identity: input.identity,
      p_machine_id: input.machineId,
      p_start_at: input.startAt,
    });
    if (error) return { ok: false, message: getBookingErrorMessage(error) };
    revalidatePath("/booking");
    return { ok: true, data: data as CreatedBooking, message: "จองเครื่องสำเร็จ" };
  } catch (error) {
    return { ok: false, message: getBookingErrorMessage(error) };
  }
}

export async function getManagedBooking(
  bookingNumber: string,
  manageCode: string,
): Promise<BookingActionResult<ManagedBooking>> {
  try {
    const supabase = await getClient();
    const { data, error } = await supabase.rpc("get_booking_by_code", {
      p_booking_number: bookingNumber,
      p_manage_code: manageCode,
    });
    if (error || !data) {
      return { ok: false, message: "ไม่พบรายการจองหรือรหัสจัดการไม่ถูกต้อง" };
    }
    return { ok: true, data: data as ManagedBooking };
  } catch {
    return { ok: false, message: "ไม่สามารถตรวจสอบรายการจองได้ กรุณาลองใหม่" };
  }
}

export async function cancelManagedBooking(
  bookingNumber: string,
  manageCode: string,
): Promise<BookingActionResult<undefined>> {
  try {
    const supabase = await getClient();
    const { error } = await supabase.rpc("cancel_booking_by_code", {
      p_booking_number: bookingNumber,
      p_manage_code: manageCode,
    });
    if (error) return { ok: false, message: getBookingErrorMessage(error) };
    revalidatePath("/booking");
    revalidatePath("/my-bookings");
    return { ok: true, data: undefined, message: "ยกเลิกการจองแล้ว" };
  } catch (error) {
    return { ok: false, message: getBookingErrorMessage(error) };
  }
}
