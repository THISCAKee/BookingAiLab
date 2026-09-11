import { describe, expect, it, vi } from "vitest";
import { cancelSheetBookingByOwner } from "@/lib/booking/sheet-repository";

describe("owner booking cancellation", () => {
  it("sends an owner-scoped cancellation request", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await cancelSheetBookingByOwner(
      { bookingId: "b-1", idempotencyKey: "cancel-1" },
      { email: "student@msu.ac.th", name: "Student", hd: "msu.ac.th", emailPrefix: "student" },
      { url: "https://script.example.test/exec", secret: "secret", fetchImpl },
    );

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    expect(body).toMatchObject({ operation: "cancel_booking_by_owner", payload: { bookingId: "b-1", email: "student@msu.ac.th" } });
    expect(body.payload).not.toHaveProperty("manageCode");
  });
});
