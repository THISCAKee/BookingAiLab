import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("root authentication boundary", () => {
  it("starts a fresh login when the root is opened with an existing session", () => {
    const response = proxy(new NextRequest("http://localhost:3000/", {
      headers: { cookie: "booking_session=existing" },
    }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/api/auth/logout?redirectTo=%2Flogin",
    );
  });
});
