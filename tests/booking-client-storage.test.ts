import { describe, expect, it } from "vitest";
import type { BookingFormState } from "@/app/booking/actions";
import {
  clearStoredBooking,
  loadStoredBooking,
  storeBooking,
} from "@/lib/booking/client-storage";

const bookingState: BookingFormState = {
  ok: true,
  code: "BOOKING_CONFIRMED",
  message: "จองเครื่องสำเร็จ",
  booking: {
    bookingId: "b-1",
    bookingNumber: "BK-1",
    timelockUsername: "student",
    timelockPassword: "password",
    machineCode: "PC-001",
    startAt: "2026-08-25T01:30:00.000Z",
    endAt: "2026-08-25T04:30:00.000Z",
    status: "confirmed",
  },
};

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("stored booking handoff", () => {
  it("restores a successful booking so its credentials remain available after navigation", () => {
    const browserStorage = storage();

    storeBooking(browserStorage, bookingState);

    expect(loadStoredBooking(browserStorage)).toEqual(bookingState);
  });

  it("removes the stored booking after the TimeLock session starts", () => {
    const browserStorage = storage();
    storeBooking(browserStorage, bookingState);

    clearStoredBooking(browserStorage);

    expect(loadStoredBooking(browserStorage)).toBeNull();
  });

  it("ignores malformed stored data instead of exposing an invalid code", () => {
    const browserStorage = storage();
    browserStorage.setItem("booking-ai-lab:last-booking", "not-json");

    expect(loadStoredBooking(browserStorage)).toBeNull();
  });

  it("ignores legacy stored bookings that still contain a management code", () => {
    const browserStorage = storage();
    browserStorage.setItem("booking-ai-lab:last-booking", JSON.stringify({
      ...bookingState,
      booking: { ...bookingState.booking, manageCode: "LEGACY-CODE" },
    }));

    expect(loadStoredBooking(browserStorage)).toBeNull();
  });
});
