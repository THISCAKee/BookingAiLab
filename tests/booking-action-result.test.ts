import { describe, expect, it } from "vitest";
import { toBookingFailure } from "@/lib/booking/action-utils";

describe("booking result contract", () => {
  it("returns an actionable retryable failure for a machine conflict", () => {
    expect(toBookingFailure(new Error("MACHINE_UNAVAILABLE"))).toEqual({
      ok: false,
      code: "MACHINE_UNAVAILABLE",
      message: "เครื่องนี้ไม่ว่างแล้ว กรุณาเลือกเครื่องอื่น",
      retryable: true,
    });
  });

  it("marks missing server configuration as not retryable from the browser", () => {
    expect(toBookingFailure(new Error("BOOKING_ATOMIC_NOT_CONFIGURED")).retryable).toBe(false);
  });

  it("hides unknown provider details behind a safe retry message", () => {
    expect(toBookingFailure(new Error("UNKNOWN_PROVIDER_ERROR: secret-value"))).toEqual({
      ok: false,
      code: "UNKNOWN_PROVIDER_ERROR",
      message: "ไม่สามารถทำรายการจองได้ กรุณาลองใหม่อีกครั้ง",
      retryable: true,
    });
  });
});
