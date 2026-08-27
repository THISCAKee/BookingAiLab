import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BookingResultPanel } from "@/components/booking/booking-result-panel";
import type { BookingFormState } from "@/app/booking/actions";

describe("public booking result panel", () => {
  it("renders the complete TimeLock handoff after a successful booking", () => {
    const state: BookingFormState = {
      ok: true,
      code: "BOOKING_CONFIRMED",
      message: "จองเครื่องสำเร็จ",
      booking: {
        bookingId: "b-1",
        bookingNumber: "BK-1",
        manageCode: "MANAGE-1",
        timelockUsername: "student",
        timelockPassword: "one-time-password",
        machineCode: "PC-001",
        startAt: "2026-08-25T01:30:00.000Z",
        endAt: "2026-08-25T04:30:00.000Z",
        status: "confirmed",
      },
    };

    const html = renderToStaticMarkup(<BookingResultPanel state={state} onRetry={() => undefined} />);

    expect(html).toContain("ยืนยันการจองแล้ว");
    expect(html).toContain("ชื่อผู้ใช้ TimeLock");
    expect(html).toContain("รหัสผ่าน TimeLock");
    expect(html).toContain("one-time-password");
    expect(html).toContain("BK-1");
    expect(html).toContain("ใช้สำหรับตรวจสอบรายละเอียดการจองของคุณ");
    expect(html).toContain("ใช้คู่กับเลขที่การจองเมื่อต้องการดูรายละเอียดหรือยกเลิกการจอง");
    expect(html).toContain("timelock-highlight");
    expect(html).toContain('class="timelock-username-value');
    expect(html).toContain('class="timelock-password-value');
    expect(html).toContain("time-value-regular");
    expect(html).toContain("booking-time-section");
    expect(html).not.toContain("border-amber-300");
    expect(html).not.toContain("bg-amber-50");
    expect(html).not.toContain("bg-amber-200");
    expect(html).not.toContain("text-amber-800");
    expect(html).not.toContain("text-amber-950");
    expect(html).not.toContain("bg-[#242424]");
    expect(html).not.toContain("bg-[#0b1324]");
  });

  it("renders an actionable failure without exposing any TimeLock password", () => {
    const state: BookingFormState = {
      ok: false,
      code: "MACHINE_UNAVAILABLE",
      message: "เครื่องนี้ไม่ว่างแล้ว กรุณาเลือกเครื่องอื่น",
      retryable: true,
    };

    const html = renderToStaticMarkup(<BookingResultPanel state={state} onRetry={() => undefined} />);

    expect(html).toContain('role="alert"');
    expect(html).toContain("เครื่องนี้ไม่ว่างแล้ว กรุณาเลือกเครื่องอื่น");
    expect(html).toContain("ลองเลือกเครื่องใหม่");
    expect(html).not.toContain("รหัสผ่าน TimeLock");
  });
});
