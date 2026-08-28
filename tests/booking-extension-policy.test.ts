import { describe, expect, it } from "vitest";
import { evaluateBookingExtension } from "@/lib/booking/extension-policy";
import type { SheetBooking } from "@/lib/google/sheet-types";

const current: SheetBooking = {
  sourceRow: 2,
  bookingId: "b-1",
  bookingNumber: "BK-1",
  email: "student@msu.ac.th",
  name: "Student",
  hd: "msu.ac.th",
  emailPrefix: "student",
  machineId: "m-1",
  machineCode: "PC-001",
  startAt: "2026-08-24T01:30:00.000Z",
  endAt: "2026-08-24T04:30:00.000Z",
  status: "active",
  manageCodeHash: "hash",
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
  idempotencyKey: "create-1",
  extensionCount: 0,
};

const now = new Date("2026-08-24T03:00:00.000Z");

function nextBooking(input: Partial<SheetBooking> = {}): SheetBooking {
  return {
    ...current,
    sourceRow: 3,
    bookingId: "b-2",
    bookingNumber: "BK-2",
    email: "other@msu.ac.th",
    name: "Other",
    emailPrefix: "other",
    startAt: "2026-08-24T04:30:00.000Z",
    endAt: "2026-08-24T07:30:00.000Z",
    status: "confirmed",
    idempotencyKey: "create-2",
    ...input,
  };
}

describe("booking extension policy", () => {
  it("offers another 180 minutes when the machine has no next queue", () => {
    expect(evaluateBookingExtension({ booking: current, bookings: [current], now })).toEqual({
      canExtend: true,
      reason: "EXTENSION_AVAILABLE",
      currentEndAt: "2026-08-24T04:30:00.000Z",
      proposedEndAt: "2026-08-24T07:30:00.000Z",
      extensionCount: 0,
      maxExtensionCount: 2,
    });
  });

  it("rejects a next queue that overlaps the proposed extension", () => {
    expect(evaluateBookingExtension({
      booking: current,
      bookings: [current, nextBooking()],
      now,
    })).toMatchObject({
      canExtend: false,
      reason: "EXTENSION_NEXT_BOOKING_CONFLICT",
      proposedEndAt: null,
    });
  });

  it("preserves the 15 minute turnaround before a queued booking", () => {
    expect(evaluateBookingExtension({
      booking: current,
      bookings: [current, nextBooking({
        startAt: "2026-08-24T04:45:00.000Z",
        endAt: "2026-08-24T07:45:00.000Z",
      })],
      now,
    })).toMatchObject({
      canExtend: false,
      reason: "EXTENSION_NEXT_BOOKING_CONFLICT",
      proposedEndAt: null,
    });
  });

  it("allows a queue that starts exactly when the proposed extension ends", () => {
    expect(evaluateBookingExtension({
      booking: current,
      bookings: [current, nextBooking({
        startAt: "2026-08-24T07:30:00.000Z",
        endAt: "2026-08-24T10:30:00.000Z",
      })],
      now,
    })).toMatchObject({ canExtend: true, reason: "EXTENSION_AVAILABLE" });
  });

  it("rejects the third extension attempt after two extensions", () => {
    expect(evaluateBookingExtension({
      booking: { ...current, extensionCount: 2 },
      bookings: [current],
      now,
    })).toMatchObject({ canExtend: false, reason: "EXTENSION_LIMIT_REACHED" });
  });

  it("rejects an extension that would cross Bangkok midnight", () => {
    const late = {
      ...current,
      startAt: "2026-08-24T12:00:00.000Z",
      endAt: "2026-08-24T15:00:00.000Z",
    };
    expect(evaluateBookingExtension({
      booking: late,
      bookings: [late],
      now: new Date("2026-08-24T13:00:00.000Z"),
    })).toMatchObject({ canExtend: false, reason: "EXTENSION_CROSSES_MIDNIGHT" });
  });

  it("rejects terminal and previous-day bookings", () => {
    expect(evaluateBookingExtension({
      booking: { ...current, status: "completed" },
      bookings: [current],
      now,
    })).toMatchObject({ canExtend: false, reason: "EXTENSION_BOOKING_INACTIVE" });

    expect(evaluateBookingExtension({
      booking: current,
      bookings: [current],
      now: new Date("2026-08-25T03:00:00.000Z"),
    })).toMatchObject({ canExtend: false, reason: "EXTENSION_BOOKING_INACTIVE" });
  });
});
