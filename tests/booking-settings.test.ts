import { describe, expect, it } from "vitest";
import { validateBookingSettings, type BookingSettingsInput } from "@/lib/booking/settings";

const validSettings: BookingSettingsInput = {
  serviceWeekdays: [1, 2, 3, 4, 5],
  openingTime: "08:30",
  closingTime: "16:30",
  durationMinutes: 180,
  graceMinutes: 15,
  timezone: "Asia/Bangkok",
};

describe("validateBookingSettings", () => {
  it("normalizes a valid settings payload", () => {
    expect(
      validateBookingSettings({
        ...validSettings,
        serviceWeekdays: [5, 1, 5, 2],
        openingTime: " 08:30 ",
      }),
    ).toEqual({
      ok: true,
      value: { ...validSettings, serviceWeekdays: [1, 2, 5], openingTime: "08:30" },
    });
  });

  it("rejects an empty or invalid weekday list", () => {
    expect(validateBookingSettings({ ...validSettings, serviceWeekdays: [] })).toEqual({
      ok: false,
      message: "ต้องเลือกวันเปิดให้บริการอย่างน้อย 1 วัน",
    });
    expect(validateBookingSettings({ ...validSettings, serviceWeekdays: [0, 8] })).toEqual({
      ok: false,
      message: "วันเปิดให้บริการไม่ถูกต้อง",
    });
  });

  it("requires closing time to be later than opening time", () => {
    expect(validateBookingSettings({ ...validSettings, closingTime: "08:00" })).toEqual({
      ok: false,
      message: "เวลาปิดต้องอยู่หลังเวลาเปิด",
    });
  });

  it("requires positive duration and non-negative grace period", () => {
    expect(validateBookingSettings({ ...validSettings, durationMinutes: 0 })).toEqual({
      ok: false,
      message: "ระยะเวลาจองต้องมากกว่า 0 นาที",
    });
    expect(validateBookingSettings({ ...validSettings, graceMinutes: -1 })).toEqual({
      ok: false,
      message: "Grace period ต้องไม่ติดลบ",
    });
  });

  it("rejects an invalid timezone", () => {
    expect(validateBookingSettings({ ...validSettings, timezone: "Not/A-Timezone" })).toEqual({
      ok: false,
      message: "Timezone ไม่ถูกต้อง",
    });
  });
});
