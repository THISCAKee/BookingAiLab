import { describe, expect, it, vi } from "vitest";
import type { GoogleIdentity } from "@/lib/auth/google-claims";
import { createSheetBooking } from "@/lib/booking/sheet-repository";

const identity: GoogleIdentity = { email: "student@msu.ac.th", name: "Student", hd: "msu.ac.th", emailPrefix: "student" };

describe("Sheet booking repository", () => {
  it("uses only the Apps Script response as the authoritative booking window", async () => {
    const data = {
      bookingId: "b-1",
      bookingNumber: "BK-1",
      machineCode: "PC-001",
      startAt: "2026-08-24T05:15:00.000Z",
      endAt: "2026-08-24T08:15:00.000Z",
      status: "confirmed",
      manageCode: "ABCD-1234",
    };
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data }), { status: 200 }));
    const result = await createSheetBooking({ machineId: "m-1", idempotencyKey: "request-1" }, identity, {
      url: "https://script.example.test/exec", secret: "secret", fetchImpl,
    });

    expect(result).toMatchObject({ ...data, timelockUsername: "student" });
    expect(result.timelockPassword).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(fetchImpl).toHaveBeenCalledWith("https://script.example.test/exec", expect.objectContaining({ method: "POST", cache: "no-store" }));
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    expect(body).toMatchObject({ operation: "create_booking", idempotencyKey: "request-1", secret: "secret", payload: { machineId: "m-1", email: identity.email, hd: identity.hd, emailPrefix: identity.emailPrefix, account: { username: "student", passwordAlgorithm: "pbkdf2-sha256", passwordIterations: 600_000 } } });
    expect(body.payload).not.toHaveProperty("startAt");
    expect(body.payload).not.toHaveProperty("endAt");
    expect(body.payload.manageCode).toMatch(/^[A-Z0-9_-]{12}$/);
    expect(body.payload.account.allowedMinutes).toBe(180);
    expect(body.payload.account.passwordHash).toBeTruthy();
    expect(body.payload.account.passwordSalt).toBeTruthy();
  });

  it("retries a busy atomic mutation with the same idempotency key and password verifier", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, code: "BOOKING_ATOMIC_BUSY" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        data: {
          bookingId: "b-1",
          startAt: "2026-08-24T05:15:00.000Z",
          endAt: "2026-08-24T08:15:00.000Z",
        },
      }), { status: 200 }));

    await expect(createSheetBooking(
      { machineId: "m-1", idempotencyKey: "request-1" },
      identity,
      { url: "https://script.example.test/exec", secret: "secret", fetchImpl },
    )).resolves.toMatchObject({ bookingId: "b-1" });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const first = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    const second = JSON.parse(fetchImpl.mock.calls[1][1].body as string);
    expect(second.idempotencyKey).toBe("request-1");
    expect(second.payload.manageCode).toBe(first.payload.manageCode);
    expect(second.payload.account.passwordSalt).toBe(first.payload.account.passwordSalt);
    expect(second.payload.account.passwordHash).toBe(first.payload.account.passwordHash);
  });

  it("fails closed when atomic booking configuration is unavailable", async () => {
    await expect(createSheetBooking({ machineId: "m-1", idempotencyKey: "request-1" }, identity, {})).rejects.toThrow("BOOKING_ATOMIC_NOT_CONFIGURED");
  });

  it("stops after two timed-out attempts", async () => {
    const fetchImpl = vi.fn().mockImplementation((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const upstreamTimer = setTimeout(() => reject(new Error("upstream still running")), 20);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(upstreamTimer);
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
    );

    await expect(
      createSheetBooking(
        { machineId: "m-1", idempotencyKey: "request-1" },
        identity,
        { url: "https://script.example.test/exec", secret: "secret", fetchImpl, timeoutMs: 1 },
      ),
    ).rejects.toThrow("BOOKING_ATOMIC_TIMEOUT");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rejects a success response without an authoritative time window", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: { bookingId: "b-1" },
    }), { status: 200 }));

    await expect(createSheetBooking(
      { machineId: "m-1", idempotencyKey: "request-1" },
      identity,
      { url: "https://script.example.test/exec", secret: "secret", fetchImpl },
    )).rejects.toThrow("BOOKING_ATOMIC_FAILED");
  });
});
