import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicBookingBoard } from "@/components/booking/public-booking-board";
import { BookingResultPanel } from "@/components/booking/booking-result-panel";
import { PublicBookingNav } from "@/components/booking/public-booking-nav";
import { getDictionary, isLocale } from "@/lib/i18n/dictionaries";
import type { PublicBookingOptions } from "@/lib/booking/actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));

const options: PublicBookingOptions = {
  date: "2026-08-24",
  viewerCanBook: true,
  viewerBlockReason: null,
  viewerBookingEndAt: null,
  viewerBookingStarted: false,
  machines: [
    {
      id: "m-2", machineCode: "PC-002", machineName: "Workstation 2", location: "AI Lab",
      operationalStatus: "in_use", bookable: true,
      nextStartAt: "2026-08-24T06:15:00.000Z", nextEndAt: "2026-08-24T09:15:00.000Z",
      queueCount: 1, currentEndAt: "2026-08-24T06:00:00.000Z", currentRemainingMinutes: 150,
    },
  ],
};

describe("Thai/English translation", () => {
  it("only accepts supported locales", () => {
    expect(isLocale("th")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it("renders the booking board in English", () => {
    const html = renderToStaticMarkup(<PublicBookingBoard initialOptions={options} locale="en" />);

    expect(html).toContain("Choose a machine");
    expect(html).toContain("In use");
    expect(html).toContain("2 h 30 min left");
    expect(html).toContain("Ends 13:00");
    expect(html).toContain("1 in queue");
    expect(html).not.toMatch(/[฀-๿]/);
  });

  it("translates booking failures by code and falls back to the server message", () => {
    const known = renderToStaticMarkup(<BookingResultPanel locale="en" state={{ ok: false, code: "MACHINE_UNAVAILABLE", message: "เครื่องนี้ไม่ว่างแล้ว", retryable: true }} onRetry={() => undefined} />);
    expect(known).toContain(getDictionary("en").result.errors.MACHINE_UNAVAILABLE);
    expect(known).toContain("Choose another machine");

    const unknown = renderToStaticMarkup(<BookingResultPanel locale="en" state={{ ok: false, code: "SOMETHING_NEW", message: "server message", retryable: false }} />);
    expect(unknown).toContain("server message");
  });

  it("shows the language switcher in the public navigation", () => {
    const html = renderToStaticMarkup(<PublicBookingNav locale="en" />);

    expect(html).toContain("My booking");
    expect(html).toContain('name="locale"');
    expect(html).toContain('value="th"');
    expect(html).toContain('value="en"');
  });
});
