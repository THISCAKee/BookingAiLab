import { describe, expect, it } from "vitest";
import {
  getBookingErrorMessage,
  normalizeManagementCredentials,
  normalizeDisplayName,
  validateScheduledBookingInput,
  validateMachineId,
} from "@/lib/booking/action-utils";

describe("booking action utilities", () => {
  it("prefers the Google display name and falls back to the email local part", () => {
    expect(
      normalizeDisplayName({
        email: "student@msu.ac.th",
        user_metadata: { full_name: "Student MSU" },
      }),
    ).toBe("Student MSU");

    expect(
      normalizeDisplayName({
        email: "student@msu.ac.th",
        user_metadata: {},
      }),
    ).toBe("student");
  });

  it("accepts only a non-empty machine UUID input", () => {
    expect(validateMachineId("33000000-0000-0000-0000-000000000001")).toBe(
      "33000000-0000-0000-0000-000000000001",
    );
    expect(validateMachineId(" ")).toBeNull();
    expect(validateMachineId(null)).toBeNull();
    expect(validateMachineId(123)).toBeNull();
  });

  it("maps stable server error codes to actionable Thai messages", () => {
    expect(getBookingErrorMessage({ message: "BOOKING_ALREADY_ACTIVE" })).toContain(
      "ยังมีการจอง",
    );
    expect(getBookingErrorMessage({ message: "MACHINE_UNAVAILABLE" })).toContain(
      "เครื่องนี้ไม่ว่าง",
    );
    expect(getBookingErrorMessage({ message: "UNKNOWN_DATABASE_ERROR" })).toBe(
      "ไม่สามารถทำรายการจองได้ กรุณาลองใหม่อีกครั้ง",
    );
  });

  it("validates the public scheduled booking payload", () => {
    expect(
      validateScheduledBookingInput({
        identity: " 65011234 ",
        machineId: "33000000-0000-0000-0000-000000000001",
        startAt: "2026-08-19T01:30:00.000Z",
      }),
    ).toEqual({
      identity: "65011234",
      machineId: "33000000-0000-0000-0000-000000000001",
      startAt: "2026-08-19T01:30:00.000Z",
    });

    expect(
      validateScheduledBookingInput({ identity: "bad", machineId: "", startAt: "later" }),
    ).toBeNull();
  });

  it("normalizes booking management credentials without revealing account data", () => {
    expect(normalizeManagementCredentials(" bk-123 ", " abcd-2345 ")).toEqual({
      bookingNumber: "BK-123",
      manageCode: "ABCD-2345",
    });
    expect(normalizeManagementCredentials("", "secret")).toBeNull();
  });
});
