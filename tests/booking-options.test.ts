import { describe, expect, it } from "vitest";
import { buildPublicBookingOptions } from "@/lib/booking/actions";
import type { SheetBooking, SheetMachine } from "@/lib/google/sheet-types";

function machine(overrides: Partial<SheetMachine> = {}): SheetMachine {
  return {
    sourceRow: 2,
    machineId: "m-1",
    machineCode: "PC-001",
    machineName: "Workstation 1",
    location: "AI Lab",
    status: "available",
    deviceTokenHash: "hash",
    lastSeenAt: null,
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

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

describe("public booking queue options", () => {
  it("disables a machine until its latest booking logs in to TimeLock", () => {
    const options = buildPublicBookingOptions({
      date: "2026-08-24",
      machines: [machine()],
      bookings: [booking({ status: "active" })],
      startedBookingIds: new Set(),
      viewerEmail: "other@msu.ac.th",
      now: new Date("2026-08-24T03:00:00.000Z"),
    });

    expect(options.machines[0]).toMatchObject({
      operationalStatus: "waiting_for_login",
      bookable: false,
      nextStartAt: null,
      nextEndAt: null,
    });
  });

  it("returns per-machine queue previews and a global viewer booking lock", () => {
    const options = buildPublicBookingOptions({
      date: "2026-08-24",
      machines: [
        machine(),
        machine({ sourceRow: 3, machineId: "m-2", machineCode: "PC-002" }),
      ],
      bookings: [booking({ status: "active" })],
      startedBookingIds: new Set(["b-1"]),
      viewerEmail: "student@msu.ac.th",
      now: new Date("2026-08-24T03:00:00.000Z"),
    });

    expect(options).toEqual({
      date: "2026-08-24",
      viewerCanBook: false,
      viewerBlockReason: "BOOKING_ALREADY_ACTIVE",
      viewerBookingEndAt: "2026-08-24T05:00:00.000Z",
      machines: [
        {
          id: "m-1",
          machineCode: "PC-001",
          machineName: "Workstation 1",
          location: "AI Lab",
          operationalStatus: "in_use",
          bookable: true,
          nextStartAt: "2026-08-24T05:15:00.000Z",
          nextEndAt: "2026-08-24T08:15:00.000Z",
          queueCount: 0,
          currentEndAt: "2026-08-24T05:00:00.000Z",
          currentRemainingMinutes: 120,
        },
        {
          id: "m-2",
          machineCode: "PC-002",
          machineName: "Workstation 1",
          location: "AI Lab",
          operationalStatus: "available",
          bookable: true,
          nextStartAt: "2026-08-24T03:00:00.000Z",
          nextEndAt: "2026-08-24T06:00:00.000Z",
          queueCount: 0,
          currentEndAt: null,
          currentRemainingMinutes: null,
        },
      ],
    });
  });

  it("blocks every preview for a date other than today", () => {
    const options = buildPublicBookingOptions({
      date: "2026-08-25",
      machines: [machine()],
      bookings: [],
      startedBookingIds: new Set(),
      viewerEmail: "new@msu.ac.th",
      now: new Date("2026-08-24T03:00:00.000Z"),
    });

    expect(options).toMatchObject({
      viewerCanBook: false,
      viewerBlockReason: "BOOKING_DATE_NOT_ALLOWED",
      viewerBookingEndAt: null,
      machines: [expect.objectContaining({
        operationalStatus: "full_today",
        bookable: false,
        nextStartAt: null,
        nextEndAt: null,
      })],
    });
  });
});
