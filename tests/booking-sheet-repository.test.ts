import { describe, expect, it, vi } from "vitest";
import type { GoogleIdentity } from "@/lib/auth/google-claims";
import { createSheetBooking } from "@/lib/booking/sheet-repository";

const identity: GoogleIdentity = { email: "student@msu.ac.th", name: "Student", hd: "msu.ac.th", emailPrefix: "student" };

describe("Sheet booking repository", () => {
  it("sends only verified identity and booking references to the atomic endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { bookingId: "b-1" } }), { status: 200 }));
    const result = await createSheetBooking({ machineId: "m-1", startAt: "2026-08-21T03:00:00.000Z", idempotencyKey: "request-1" }, identity, {
      url: "https://script.example.test/exec", secret: "secret", fetchImpl,
    });

    expect(result).toEqual({ bookingId: "b-1" });
    expect(fetchImpl).toHaveBeenCalledWith("https://script.example.test/exec", expect.objectContaining({ method: "POST", cache: "no-store" }));
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    expect(body).toMatchObject({ operation: "create_booking", idempotencyKey: "request-1", secret: "secret", payload: { machineId: "m-1", email: identity.email, hd: identity.hd, emailPrefix: identity.emailPrefix } });
  });

  it("fails closed when atomic booking configuration is unavailable", async () => {
    await expect(createSheetBooking({ machineId: "m-1", startAt: "2026-08-21T03:00:00.000Z", idempotencyKey: "request-1" }, identity, {})).rejects.toThrow("BOOKING_ATOMIC_NOT_CONFIGURED");
  });
});
