import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicBookingNav } from "@/components/booking/public-booking-nav";

describe("public booking navigation", () => {
  it("keeps booking management public without exposing an admin entry point", () => {
    const html = renderToStaticMarkup(<PublicBookingNav />);

    expect(html).toContain('href="/booking"');
    expect(html).toContain('href="/my-bookings"');
    expect(html).not.toContain('href="/admin"');
    expect(html).not.toContain("ผู้ดูแลระบบ");
  });
});
