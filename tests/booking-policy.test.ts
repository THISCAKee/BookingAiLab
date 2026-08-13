import { describe, expect, it } from "vitest";
import {
  getBookingAvailability,
  isBookingTerminal,
  isNoShowExpired,
  type BookingPolicySettings,
} from "@/lib/booking/policy";

const defaultSettings: BookingPolicySettings = {
  weekdays: [1, 2, 3, 4, 5],
  openingTime: "08:30",
  closingTime: "16:30",
  durationMinutes: 180,
  graceMinutes: 15,
  timezone: "Asia/Bangkok",
};

describe("getBookingAvailability", () => {
  it("allows a weekday booking at opening time for exactly three hours", () => {
    const result = getBookingAvailability(
      new Date("2026-08-17T01:30:00.000Z"),
      defaultSettings,
    );

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("AVAILABLE");
    expect(result.startAt.toISOString()).toBe("2026-08-17T01:30:00.000Z");
    expect(result.endAt.toISOString()).toBe("2026-08-17T04:30:00.000Z");
  });

  it("allows a booking at the latest valid start time", () => {
    const result = getBookingAvailability(
      new Date("2026-08-17T06:30:00.000Z"),
      defaultSettings,
    );

    expect(result.allowed).toBe(true);
    expect(result.endAt.toISOString()).toBe("2026-08-17T09:30:00.000Z");
  });

  it("rejects a weekday booking whose full duration passes closing time", () => {
    const result = getBookingAvailability(
      new Date("2026-08-17T06:31:00.000Z"),
      defaultSettings,
    );

    expect(result).toMatchObject({
      allowed: false,
      code: "INSUFFICIENT_SERVICE_TIME",
    });
  });

  it("rejects weekends and times before opening", () => {
    expect(
      getBookingAvailability(
        new Date("2026-08-16T04:00:00.000Z"),
        defaultSettings,
      ).code,
    ).toBe("SERVICE_CLOSED");

    expect(
      getBookingAvailability(
        new Date("2026-08-17T01:29:00.000Z"),
        defaultSettings,
      ).code,
    ).toBe("SERVICE_NOT_OPEN");
  });

  it("rejects invalid policy settings", () => {
    expect(() =>
      getBookingAvailability(new Date("2026-08-17T01:30:00.000Z"), {
        ...defaultSettings,
        closingTime: "08:00",
      }),
    ).toThrow("closingTime must be after openingTime");
  });
});

describe("booking status and no-show rules", () => {
  it("treats only completed, cancelled and expired bookings as terminal", () => {
    expect(isBookingTerminal("completed")).toBe(true);
    expect(isBookingTerminal("cancelled")).toBe(true);
    expect(isBookingTerminal("expired")).toBe(true);
    expect(isBookingTerminal("confirmed")).toBe(false);
    expect(isBookingTerminal("active")).toBe(false);
  });

  it("expires a booking only after the grace period has elapsed", () => {
    const startAt = new Date("2026-08-17T01:30:00.000Z");

    expect(
      isNoShowExpired(startAt, new Date("2026-08-17T01:44:59.999Z"), 15),
    ).toBe(false);
    expect(
      isNoShowExpired(startAt, new Date("2026-08-17T01:45:00.000Z"), 15),
    ).toBe(true);
  });
});
