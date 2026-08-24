import { describe, expect, it } from "vitest";
import { assertSheetBookingAllowed } from "@/lib/booking/sheet-policy";
import type { SheetBooking, SheetMachine } from "@/lib/google/sheet-types";

const machine: SheetMachine = {
  sourceRow: 2, machineId: "m-1", machineCode: "PC-001", machineName: "Lab 1", location: null,
  status: "available", deviceTokenHash: "hash", lastSeenAt: null, updatedAt: "2026-08-20T00:00:00.000Z",
};
const baseBooking: SheetBooking = {
  sourceRow: 2, bookingId: "b-1", bookingNumber: "BK-1", email: "other@msu.ac.th", name: "Other", hd: "msu.ac.th", emailPrefix: "other",
  machineId: "m-1", machineCode: "PC-001", startAt: "2026-08-21T03:00:00.000Z", endAt: "2026-08-21T06:00:00.000Z", status: "confirmed", manageCodeHash: "hash", createdAt: "2026-08-20T00:00:00.000Z", updatedAt: "2026-08-20T00:00:00.000Z",
};

const settings = { serviceWeekdays: [1, 2, 3, 4, 5], openingTime: "08:00", closingTime: "17:00", durationMinutes: 180, graceMinutes: 15, timezone: "Asia/Bangkok" };

describe("Sheet booking policy", () => {
  it("allows a three-hour booking today on a weekend when all days are enabled", () => {
    expect(() => assertSheetBookingAllowed({
      machine,
      bookings: [],
      email: "student@msu.ac.th",
      startAt: "2026-08-22T03:00:00.000Z",
      endAt: "2026-08-22T06:00:00.000Z",
      settings: { ...settings, serviceWeekdays: [1, 2, 3, 4, 5, 6, 7] },
      now: new Date("2026-08-22T01:00:00.000Z"),
    })).not.toThrow();
  });

  it("rejects a booking outside today in Bangkok", () => {
    expect(() => assertSheetBookingAllowed({
      machine,
      bookings: [],
      email: "student@msu.ac.th",
      startAt: "2026-08-23T03:00:00.000Z",
      endAt: "2026-08-23T06:00:00.000Z",
      settings: { ...settings, serviceWeekdays: [1, 2, 3, 4, 5, 6, 7] },
      now: new Date("2026-08-22T01:00:00.000Z"),
    })).toThrow("BOOKING_DATE_NOT_ALLOWED");
  });

  it("rejects a booking shorter than 180 minutes", () => {
    expect(() => assertSheetBookingAllowed({
      machine,
      bookings: [],
      email: "student@msu.ac.th",
      startAt: "2026-08-21T03:00:00.000Z",
      endAt: "2026-08-21T05:00:00.000Z",
      settings,
      now: new Date("2026-08-21T01:00:00.000Z"),
    })).toThrow("BOOKING_DURATION_INVALID");
  });

  it("rejects an overlapping machine booking", () => {
    expect(() => assertSheetBookingAllowed({ machine, bookings: [baseBooking], email: "student@msu.ac.th", startAt: "2026-08-21T04:00:00.000Z", endAt: "2026-08-21T07:00:00.000Z", settings, now: new Date("2026-08-21T01:00:00.000Z") })).toThrow("BOOKING_MACHINE_OVERLAP");
  });

  it("rejects an overlapping booking by the same customer", () => {
    expect(() => assertSheetBookingAllowed({ machine: { ...machine, machineId: "m-2" }, bookings: [{ ...baseBooking, email: "student@msu.ac.th" }], email: "student@msu.ac.th", startAt: "2026-08-21T04:00:00.000Z", endAt: "2026-08-21T07:00:00.000Z", settings, now: new Date("2026-08-21T01:00:00.000Z") })).toThrow("BOOKING_CUSTOMER_OVERLAP");
  });

  it("rejects a non-service day and unavailable machine", () => {
    expect(() => assertSheetBookingAllowed({ machine, bookings: [], email: "student@msu.ac.th", startAt: "2026-08-22T03:00:00.000Z", endAt: "2026-08-22T06:00:00.000Z", settings, now: new Date("2026-08-22T01:00:00.000Z") })).toThrow("BOOKING_OUTSIDE_SCHEDULE");
    expect(() => assertSheetBookingAllowed({ machine: { ...machine, status: "maintenance" }, bookings: [], email: "student@msu.ac.th", startAt: "2026-08-21T03:00:00.000Z", endAt: "2026-08-21T06:00:00.000Z", settings, now: new Date("2026-08-21T01:00:00.000Z") })).toThrow("BOOKING_MACHINE_UNAVAILABLE");
  });
});
