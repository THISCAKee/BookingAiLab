export type BookingSettingsInput = {
  serviceWeekdays: number[];
  openingTime: string;
  closingTime: string;
  durationMinutes: number;
  graceMinutes: number;
  timezone: string;
};

export type BookingSettings = BookingSettingsInput & {
  id: number;
  createdAt?: string;
  updatedAt?: string;
};

export type BookingSettingsValidation =
  | { ok: true; value: BookingSettingsInput }
  | { ok: false; message: string };

function parseTime(value: string) {
  const normalized = value.trim();
  const match = /^(\d{2}):(\d{2})$/.exec(normalized);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }

  return { normalized, minutes: hour * 60 + minute };
}

export function validateBookingSettings(
  input: BookingSettingsInput,
): BookingSettingsValidation {
  const weekdays = [...new Set(input.serviceWeekdays)].sort((a, b) => a - b);
  if (weekdays.length === 0) {
    return { ok: false, message: "ต้องเลือกวันเปิดให้บริการอย่างน้อย 1 วัน" };
  }

  if (weekdays.some((weekday) => !Number.isInteger(weekday) || weekday < 1 || weekday > 7)) {
    return { ok: false, message: "วันเปิดให้บริการไม่ถูกต้อง" };
  }

  const opening = parseTime(input.openingTime);
  const closing = parseTime(input.closingTime);
  if (!opening || !closing) {
    return { ok: false, message: "รูปแบบเวลาไม่ถูกต้อง" };
  }

  if (closing.minutes <= opening.minutes) {
    return { ok: false, message: "เวลาปิดต้องอยู่หลังเวลาเปิด" };
  }

  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0) {
    return { ok: false, message: "ระยะเวลาจองต้องมากกว่า 0 นาที" };
  }

  if (!Number.isInteger(input.graceMinutes) || input.graceMinutes < 0) {
    return { ok: false, message: "Grace period ต้องไม่ติดลบ" };
  }

  const timezone = input.timezone.trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    return { ok: false, message: "Timezone ไม่ถูกต้อง" };
  }

  return {
    ok: true,
    value: {
      serviceWeekdays: weekdays,
      openingTime: opening.normalized,
      closingTime: closing.normalized,
      durationMinutes: input.durationMinutes,
      graceMinutes: input.graceMinutes,
      timezone,
    },
  };
}

export async function getBookingSettings(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("booking_settings")
    .select(
      "id, service_weekdays, opening_time, closing_time, duration_minutes, grace_minutes, timezone, created_at, updated_at",
    )
    .eq("id", 1)
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    serviceWeekdays: data.service_weekdays as number[],
    openingTime: String(data.opening_time).slice(0, 5),
    closingTime: String(data.closing_time).slice(0, 5),
    durationMinutes: data.duration_minutes,
    graceMinutes: data.grace_minutes,
    timezone: data.timezone,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } satisfies BookingSettings;
}
import type { SupabaseClient } from "@supabase/supabase-js";
