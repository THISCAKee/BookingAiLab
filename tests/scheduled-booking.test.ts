import { describe, expect, it } from "vitest";
import {
  getImmediateBookingWindow,
  getSelectableBookingDates,
  normalizeBookingIdentity,
} from "@/lib/booking/schedule";

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

describe("immediate booking window", () => {
  it("creates an immediate three-hour window from server time", () => {
    expect(
      getImmediateBookingWindow(new Date("2026-08-25T03:15:00.000Z")),
    ).toEqual({
      date: "2026-08-25",
      startAt: "2026-08-25T03:15:00.000Z",
      endAt: "2026-08-25T06:15:00.000Z",
    });
  });

  it("rejects an immediate window that crosses Bangkok midnight", () => {
    expect(
      getImmediateBookingWindow(new Date("2026-08-25T16:30:00.000Z")),
    ).toBeNull();
  });

  it("allows a window ending exactly at Bangkok midnight", () => {
    expect(
      getImmediateBookingWindow(new Date("2026-08-25T14:00:00.000Z")),
    ).toMatchObject({ endAt: "2026-08-25T17:00:00.000Z" });
  });

  it("offers only today in Bangkok", () => {
    expect(
      getSelectableBookingDates(
        new Date("2026-08-18T17:30:00.000Z"),
        "Asia/Bangkok",
      ),
    ).toEqual([{ value: "2026-08-19", kind: "today", label: "วันนี้" }]);
  });

});
