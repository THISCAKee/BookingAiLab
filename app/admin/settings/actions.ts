"use server";

import { revalidatePath } from "next/cache";
import { requireActiveAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateBookingSettings } from "@/lib/booking/settings";

export type SettingsFormState = {
  ok: boolean;
  message?: string;
};

function parseNumber(value: FormDataEntryValue | null) {
  return Number(value);
}

export async function updateBookingSettingsAction(
  _previousState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  try {
    const supabase = await createSupabaseServerClient();
    await requireActiveAdmin(supabase);

    const validation = validateBookingSettings({
      serviceWeekdays: formData
        .getAll("serviceWeekdays")
        .map((value) => Number(value)),
      openingTime: String(formData.get("openingTime") ?? ""),
      closingTime: String(formData.get("closingTime") ?? ""),
      durationMinutes: parseNumber(formData.get("durationMinutes")),
      graceMinutes: parseNumber(formData.get("graceMinutes")),
      timezone: String(formData.get("timezone") ?? ""),
    });

    if (!validation.ok) {
      return { ok: false, message: validation.message };
    }

    const { error } = await supabase
      .from("booking_settings")
      .update({
        service_weekdays: validation.value.serviceWeekdays,
        opening_time: validation.value.openingTime,
        closing_time: validation.value.closingTime,
        duration_minutes: validation.value.durationMinutes,
        grace_minutes: validation.value.graceMinutes,
        timezone: validation.value.timezone,
      })
      .eq("id", 1);

    if (error) {
      return { ok: false, message: "บันทึก Settings ไม่สำเร็จ กรุณาลองใหม่" };
    }

    revalidatePath("/admin/settings");
    revalidatePath("/booking");
    return { ok: true, message: "บันทึก Settings แล้ว" };
  } catch {
    return { ok: false, message: "ไม่สามารถโหลดสิทธิ์ Admin ได้ กรุณาลองใหม่" };
  }
}
