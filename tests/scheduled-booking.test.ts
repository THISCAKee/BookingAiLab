import { describe, expect, it } from "vitest";
import {
  getBookingSlots,
  getSelectableBookingDates,
  normalizeBookingIdentity,
} from "@/lib/booking/schedule";

const settings = {
  weekdays: [1, 2, 3, 4, 5],
  openingTime: "08:30",
  closingTime: "16:30",
  durationMinutes: 180,
  timezone: "Asia/Bangkok",
};

describe("scheduled booking identity", () => {
  it("turns a student id into its university email", () => {
    expect(normalizeBookingIdentity(" 65012345678 ")).toBe(
      "65012345678@msu.ac.th",
    );
  });

  it("normalizes an existing university email", () => {
    expect(normalizeBookingIdentity(" Student.Name@MSU.AC.TH ")).toBe(
      "student.name@msu.ac.th",
    );
  });

  it("rejects non-university identities", () => {
    expect(normalizeBookingIdentity("student@gmail.com")).toBeNull();
    expect(normalizeBookingIdentity("student-name")).toBeNull();
    expect(normalizeBookingIdentity(" ")).toBeNull();
  });
});

describe("scheduled booking dates and slots", () => {
  it("offers only today and tomorrow in Bangkok", () => {
    expect(
      getSelectableBookingDates(
        new Date("2026-08-18T17:30:00.000Z"),
        "Asia/Bangkok",
      ).map((date) => date.value),
    ).toEqual(["2026-08-19", "2026-08-20"]);
  });

  it("builds consecutive complete slots from opening time", () => {
    const slots = getBookingSlots(
      "2026-08-19",
      settings,
      new Date("2026-08-19T01:00:00.000Z"),
    );

    expect(slots).toEqual([
      {
        startAt: "2026-08-19T01:30:00.000Z",
        endAt: "2026-08-19T04:30:00.000Z",
        label: "08:30–11:30",
      },
      {
        startAt: "2026-08-19T04:30:00.000Z",
        endAt: "2026-08-19T07:30:00.000Z",
        label: "11:30–14:30",
      },
    ]);
  });

  it("hides slots that have already started today", () => {
    expect(
      getBookingSlots(
        "2026-08-19",
        settings,
        new Date("2026-08-19T05:00:00.000Z"),
      ),
    ).toEqual([]);
  });

  it("returns no slots outside configured weekdays", () => {
    expect(
      getBookingSlots(
        "2026-08-22",
        settings,
        new Date("2026-08-21T01:00:00.000Z"),
      ),
    ).toEqual([]);
  });
});
