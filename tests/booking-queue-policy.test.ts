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
  it("offers an empty machine immediately for exactly 180 minutes", () => {
    expect(deriveMachineQueueOption({
      machine,
      bookings: [],
      now: new Date("2026-08-24T03:00:00.000Z"),
    })).toEqual({
      operationalStatus: "available",
      bookable: true,
      nextStartAt: "2026-08-24T03:00:00.000Z",
      nextEndAt: "2026-08-24T06:00:00.000Z",
      queueCount: 0,
      currentEndAt: null,
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
      now: new Date("2026-08-24T03:00:00.000Z"),
    })).toEqual({
      operationalStatus: "in_use",
      bookable: true,
      nextStartAt: "2026-08-24T08:30:00.000Z",
      nextEndAt: "2026-08-24T11:30:00.000Z",
      queueCount: 1,
      currentEndAt: "2026-08-24T05:00:00.000Z",
    });
  });

  it("reports queued when only future bookings remain", () => {
    expect(deriveMachineQueueOption({
      machine,
      bookings: [booking({
        startAt: "2026-08-24T05:15:00.000Z",
        endAt: "2026-08-24T08:15:00.000Z",
      })],
      now: new Date("2026-08-24T03:00:00.000Z"),
    })).toMatchObject({
      operationalStatus: "queued",
      queueCount: 1,
      currentEndAt: null,
      nextStartAt: "2026-08-24T08:30:00.000Z",
    });
  });

  it("ignores terminal, expired, and cancelled tail rows without shifting confirmed rows", () => {
    const now = new Date("2026-08-24T03:00:00.000Z");
    const confirmed = booking({ endAt: "2026-08-24T05:00:00.000Z" });
    const ignored = [
      booking({ bookingId: "completed", status: "completed", endAt: "2026-08-24T12:00:00.000Z" }),
      booking({ bookingId: "cancelled", status: "cancelled", endAt: "2026-08-24T14:00:00.000Z" }),
      booking({ bookingId: "expired", status: "expired", endAt: "2026-08-24T15:00:00.000Z" }),
      booking({ bookingId: "ended", endAt: now.toISOString() }),
    ];

    expect(ignored.every((row) => !isEffectiveBooking(row, now))).toBe(true);
    expect(deriveMachineQueueOption({ machine, bookings: [confirmed, ...ignored], now }))
      .toMatchObject({ nextStartAt: "2026-08-24T05:15:00.000Z" });
    expect(confirmed.endAt).toBe("2026-08-24T05:00:00.000Z");
  });

  it("marks a slot full when a new 180 minute window crosses Bangkok midnight", () => {
    expect(deriveMachineQueueOption({
      machine,
      bookings: [],
      now: new Date("2026-08-24T16:00:00.000Z"),
    })).toEqual({
      operationalStatus: "full_today",
      bookable: false,
      nextStartAt: null,
      nextEndAt: null,
      queueCount: 0,
      currentEndAt: null,
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
      bookings: [{ ...otherMachine, endAt: now.toISOString() }],
      email: "student@msu.ac.th",
      now,
    })).toBe(false);
  });
});
