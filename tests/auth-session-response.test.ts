import { describe, expect, it } from "vitest";
import { createAuthenticatedSessionResponse } from "@/lib/auth/session-response";

describe("authenticated session response", () => {
  it("creates a browser-session cookie and redirects directly to booking", () => {
    const response = createAuthenticatedSessionResponse(
      new URL("http://localhost:3000/api/auth/google/callback"),
      "encrypted-session",
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/booking");
    const cookie = response.cookies.get("booking_session");
    expect(cookie).toMatchObject({
      name: "booking_session",
      value: "encrypted-session",
      httpOnly: true,
    });
    expect(cookie?.maxAge).toBeUndefined();
    expect(cookie?.expires).toBeUndefined();
  });
});
