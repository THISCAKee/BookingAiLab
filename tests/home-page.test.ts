import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import BookingPage from "@/app/booking/page";

describe("home page", () => {
  it("uses the booking board as the root page", () => {
    expect(HomePage).toBe(BookingPage);
  });
});
