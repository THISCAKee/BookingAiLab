import { describe, expect, it } from "vitest";
import {
  deriveMachineQueueOption,
  isEffectiveBooking,
  viewerHasEffectiveBooking,
} from "@/lib/booking/queue-policy";
import type { SheetBooking, SheetMachine } from "@/lib/google/sheet-types";

const machine: SheetMachine = {
  sourceRow: 2,
  machineId: "m-1",
  machineCode: "PC-001",
  machineName: "Workstation 1",
  location: "AI Lab",
  status: "available",
  deviceTokenHash: "hash",
  lastSeenAt: null,
  updatedAt: "2026-08-24T00:00:00.000Z",
};

function booking(overrides: Partial<SheetBooking> = {}): SheetBooking {
  return {
    sourceRow: 2,
    bookingId: "b-1",
    bookingNumber: "BK-1",
    email: "student@msu.ac.th",
    name: "Student",
    hd: "msu.ac.th",
    emailPrefix: "student",
    machineId: "m-1",
    machineCode: "PC-001",
    startAt: "2026-08-24T02:00:00.000Z",
    endAt: "2026-08-24T05:00:00.000Z",
    status: "confirmed",
    manageCodeHash: "hash",
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    idempotencyKey: "create-1",
    extensionCount: 0,
    ...overrides,
  };
}

describe("machine booking queue policy", () => {
  it("keeps an uncompleted booking effective after its provisional end", () => {
    expect(isEffectiveBooking(
      booking({ status: "confirmed", endAt: "2026-08-24T04:00:00.000Z" }),
      new Date("2026-08-24T05:00:00.000Z"),
    )).toBe(true);
  });

  it("offers an empty machine immediately for exactly 180 minutes", () => {
    expect(deriveMachineQueueOption({
      machine,
      bookings: [],
      startedBookingIds: new Set(),
      now: new Date("2026-08-24T03:00:00.000Z"),
    })).toEqual({
      operationalStatus: "available",
      bookable: true,
      nextStartAt: "2026-08-24T03:00:00.000Z",
      nextEndAt: "2026-08-24T06:00:00.000Z",
      queueCount: 0,
      currentEndAt: null,
      currentRemainingMinutes: null,
    });
  });

  it("blocks a machine when its latest booking has not started a TimeLock session", () => {
    const option = deriveMachineQueueOption({
      machine,
      bookings: [booking()],
      startedBookingIds: new Set(),
      now: new Date("2026-08-24T03:00:00.000Z"),
    });

    expect(option).toMatchObject({
      operationalStatus: "waiting_for_login",
      bookable: false,
      nextStartAt: null,
      nextEndAt: null,
      currentEndAt: null,
      currentRemainingMinutes: null,
    });
  });

  it("reports the authoritative end and remaining minutes for a logged-in session", () => {
    expect(deriveMachineQueueOption({
      machine,
      bookings: [booking({ status: "active" })],
      startedBookingIds: new Set(["b-1"]),
      now: new Date("2026-08-24T03:00:00.000Z"),
    })).toMatchObject({
      currentEndAt: "2026-08-24T05:00:00.000Z",
      currentRemainingMinutes: 120,
    });
  });

  it("rounds active session time up to the next whole minute", () => {
    expect(deriveMachineQueueOption({
      machine,
      bookings: [booking({ status: "active" })],
      startedBookingIds: new Set(["b-1"]),
      now: new Date("2026-08-24T04:25:50.000Z"),
    })).toMatchObject({
      currentEndAt: "2026-08-24T05:00:00.000Z",
      currentRemainingMinutes: 35,
    });
  });

  it("stops exposing the session end when its authoritative time has elapsed", () => {
    expect(deriveMachineQueueOption({
      machine,
      bookings: [booking({ status: "active" })],
      startedBookingIds: new Set(["b-1"]),
      now: new Date("2026-08-24T05:00:00.000Z"),
    })).toMatchObject({
      currentEndAt: null,
      currentRemainingMinutes: null,
    });
  });

  it("keeps showing the active session while a later queue is waiting to login", () => {
    expect(deriveMachineQueueOption({
      machine,
      bookings: [
        booking({ status: "active" }),
        booking({
          sourceRow: 3,
          bookingId: "b-2",
          bookingNumber: "BK-2",
          email: "next@msu.ac.th",
          emailPrefix: "next",
          startAt: "2026-08-24T05:15:00.000Z",
          endAt: "2026-08-24T08:15:00.000Z",
        }),
      ],
      startedBookingIds: new Set(["b-1"]),
      now: new Date("2026-08-24T03:00:00.000Z"),
    })).toMatchObject({
      operationalStatus: "waiting_for_login",
      bookable: false,
      currentEndAt: "2026-08-24T05:00:00.000Z",
      currentRemainingMinutes: 120,
    });
  });

  it("allows the next booking after the latest booking starts a TimeLock session", () => {
    expect(deriveMachineQueueOption({
      machine,
      bookings: [booking()],
      startedBookingIds: new Set(["b-1"]),
      now: new Date("2026-08-24T03:00:00.000Z"),
    })).toMatchObject({
      operationalStatus: "in_use",
      bookable: true,
      nextStartAt: "2026-08-24T05:15:00.000Z",
      nextEndAt: "2026-08-24T08:15:00.000Z",
    });
  });

  it("appends after the final effective booking with a 15 minute gap", () => {
    expect(deriveMachineQueueOption({
      machine,
      bookings: [
        booking(),
        booking({
          sourceRow: 3,
          bookingId: "b-2",
          bookingNumber: "BK-2",
          email: "other@msu.ac.th",
          emailPrefix: "other",
          startAt: "2026-08-24T05:15:00.000Z",
          endAt: "2026-08-24T08:15:00.000Z",
        }),
      ],
      startedBookingIds: new Set(["b-2"]),
      now: new Date("2026-08-24T03:00:00.000Z"),
    })).toEqual({
      operationalStatus: "in_use",
      bookable: true,
      nextStartAt: "2026-08-24T08:30:00.000Z",
      nextEndAt: "2026-08-24T11:30:00.000Z",
      queueCount: 1,
      currentEndAt: null,
      currentRemainingMinutes: null,
    });
  });

  it("reports queued when only future bookings remain", () => {
    expect(deriveMachineQueueOption({
      machine,
      bookings: [booking({
        startAt: "2026-08-24T05:15:00.000Z",
        endAt: "2026-08-24T08:15:00.000Z",
      })],
      startedBookingIds: new Set(["b-1"]),
      now: new Date("2026-08-24T03:00:00.000Z"),
    })).toMatchObject({
      operationalStatus: "queued",
      queueCount: 1,
      currentEndAt: null,
      nextStartAt: "2026-08-24T08:30:00.000Z",
    });
  });

  it("ignores terminal and cancelled tail rows while retaining non-terminal rows", () => {
    const now = new Date("2026-08-24T03:00:00.000Z");
    const confirmed = booking({ endAt: "2026-08-24T05:00:00.000Z" });
    const ignored = [
      booking({ bookingId: "completed", status: "completed", endAt: "2026-08-24T12:00:00.000Z" }),
      booking({ bookingId: "cancelled", status: "cancelled", endAt: "2026-08-24T14:00:00.000Z" }),
      booking({ bookingId: "expired", status: "expired", endAt: "2026-08-24T15:00:00.000Z" }),
    ];

    expect(ignored.every((row) => !isEffectiveBooking(row, now))).toBe(true);
    expect(deriveMachineQueueOption({
      machine,
      bookings: [confirmed, ...ignored],
      startedBookingIds: new Set(["b-1"]),
      now,
    }))
      .toMatchObject({ nextStartAt: "2026-08-24T05:15:00.000Z" });
    expect(confirmed.endAt).toBe("2026-08-24T05:00:00.000Z");
  });

  it("retains a confirmed row after its provisional end", () => {
    const now = new Date("2026-08-24T03:00:00.000Z");
    expect(isEffectiveBooking(booking({ bookingId: "ended", endAt: "2026-08-24T00:30:00.000Z" }), now)).toBe(true);
  });

  it("marks a slot full when a new 180 minute window crosses Bangkok midnight", () => {
    expect(deriveMachineQueueOption({
      machine,
      bookings: [],
      startedBookingIds: new Set(),
      now: new Date("2026-08-24T16:00:00.000Z"),
    })).toEqual({
      operationalStatus: "full_today",
      bookable: false,
      nextStartAt: null,
      nextEndAt: null,
      queueCount: 0,
      currentEndAt: null,
      currentRemainingMinutes: null,
    });
  });

  it("blocks a viewer with any effective booking on any machine", () => {
    const now = new Date("2026-08-24T03:00:00.000Z");
    const otherMachine = booking({ machineId: "m-2", machineCode: "PC-002" });
    expect(viewerHasEffectiveBooking({
      bookings: [otherMachine],
      email: "STUDENT@MSU.AC.TH",
      now,
    })).toBe(true);
    expect(viewerHasEffectiveBooking({
      bookings: [{ ...otherMachine, status: "cancelled" }],
      email: "student@msu.ac.th",
      now,
    })).toBe(false);
    expect(viewerHasEffectiveBooking({
      bookings: [{ ...otherMachine, status: "completed", endAt: now.toISOString() }],
      email: "student@msu.ac.th",
      now,
    })).toBe(false);
  });
});
