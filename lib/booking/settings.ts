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

export async function getBookingSettings() {
  const { getAdminBookingSettings } = await import("@/lib/admin/sheet-repository");
  const data = await getAdminBookingSettings();
  return {
    id: 1,
    serviceWeekdays: data.serviceWeekdays,
    openingTime: data.openingTime,
    closingTime: data.closingTime,
    durationMinutes: data.durationMinutes,
    graceMinutes: data.graceMinutes,
    timezone: data.timezone,
  } satisfies BookingSettings;
}
