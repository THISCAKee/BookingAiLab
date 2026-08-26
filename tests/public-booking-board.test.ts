import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public booking loading state", () => {
  it("includes an accessible modal status for an in-flight booking", () => {
    const source = readFileSync(`${process.cwd()}/components/booking/public-booking-board.tsx`, "utf8");

    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("กำลังยืนยันการจอง");
    expect(source).toContain("กรุณารอสักครู่");
  });
});
