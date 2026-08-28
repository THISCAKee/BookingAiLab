import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { PublicBookingBoard } from "@/components/booking/public-booking-board";
import type { PublicBookingOptions } from "@/lib/booking/actions";

const options: PublicBookingOptions = {
  date: "2026-08-24",
  viewerCanBook: true,
  viewerBlockReason: null,
  viewerBookingEndAt: null,
  machines: [
    {
      id: "m-1", machineCode: "PC-001", machineName: "Workstation 1", location: "AI Lab",
      operationalStatus: "available", bookable: true,
      nextStartAt: "2026-08-24T03:00:00.000Z", nextEndAt: "2026-08-24T06:00:00.000Z",
      queueCount: 0, currentEndAt: null,
    },
    {
      id: "m-2", machineCode: "PC-002", machineName: "Workstation 2", location: "AI Lab",
      operationalStatus: "in_use", bookable: true,
      nextStartAt: "2026-08-24T06:15:00.000Z", nextEndAt: "2026-08-24T09:15:00.000Z",
      queueCount: 1, currentEndAt: "2026-08-24T06:00:00.000Z",
    },
    {
      id: "m-3", machineCode: "PC-003", machineName: "Workstation 3", location: "AI Lab",
      operationalStatus: "queued", bookable: true,
      nextStartAt: "2026-08-24T09:30:00.000Z", nextEndAt: "2026-08-24T12:30:00.000Z",
      queueCount: 2, currentEndAt: null,
    },
    {
      id: "m-4", machineCode: "PC-004", machineName: "Workstation 4", location: "AI Lab",
      operationalStatus: "full_today", bookable: false,
      nextStartAt: null, nextEndAt: null, queueCount: 3, currentEndAt: null,
    },
  ],
};

describe("public booking queue board", () => {
  it("renders machine status, scheduled window, current end, and queue count", () => {
    const html = renderToStaticMarkup(createElement(PublicBookingBoard, { initialOptions: options }));

    expect(html).toContain("ว่าง");
    expect(html).toContain("ใช้งานอยู่");
    expect(html).toContain("มีคิว");
    expect(html).toContain("คิวเต็มสำหรับวันนี้");
    expect(html).toContain("เข้าใช้ได้");
    expect(html).toContain("Session ปัจจุบันสิ้นสุด");
    expect(html).toContain("คิวรอ 2 รายการ");
  });

  it("disables every machine when the viewer already has an effective booking", () => {
    const html = renderToStaticMarkup(createElement(PublicBookingBoard, { initialOptions: {
      ...options,
      viewerCanBook: false,
      viewerBlockReason: "BOOKING_ALREADY_ACTIVE",
      viewerBookingEndAt: "2026-08-24T06:00:00.000Z",
    } }));

    expect(html).toContain("กรุณารอให้ Session หรือการจองปัจจุบันสิ้นสุดก่อนจองใหม่");
    expect(html.match(/name="machineId"/g)).toHaveLength(4);
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(5);
  });
});
