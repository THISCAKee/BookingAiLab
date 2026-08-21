"use server";

import { revalidatePath } from "next/cache";
import { requireAdminIdentity } from "@/lib/auth/identity";
import { updateAdminSettings } from "@/lib/admin/sheet-repository";
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
    await requireAdminIdentity();

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

    await updateAdminSettings(validation.value);

    revalidatePath("/admin/settings");
    revalidatePath("/booking");
    return { ok: true, message: "บันทึก Settings แล้ว" };
  } catch {
    return { ok: false, message: "ไม่สามารถโหลดสิทธิ์ Admin ได้ กรุณาลองใหม่" };
  }
}
