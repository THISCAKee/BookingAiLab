import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("proxy authentication boundaries", () => {
  it("allows an admin session to reach the admin dashboard without a booking session", () => {
    const response = proxy(new NextRequest("http://localhost:3000/admin/dashboard", {
      headers: { cookie: "admin_session=valid-admin-session" },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps a customer session from entering the admin dashboard", () => {
    const response = proxy(new NextRequest("http://localhost:3000/admin/dashboard", {
      headers: { cookie: "booking_session=customer-session" },
    }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin");
  });

  it("still requires a booking session for the customer booking page", () => {
    const response = proxy(new NextRequest("http://localhost:3000/booking"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });
});
