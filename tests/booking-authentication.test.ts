import { describe, expect, it } from "vitest";
import { requireIdentityFromCookie } from "@/lib/auth/identity";
import { createSessionCookie } from "@/lib/auth/session";

describe("booking authentication boundary", () => {
  it("returns only the verified session identity", async () => {
    const cookie = await createSessionCookie({ email: "student@msu.ac.th", name: "Student", hd: "msu.ac.th", emailPrefix: "student" }, new Date(), "test-secret");
    await expect(requireIdentityFromCookie(cookie, "test-secret")).resolves.toEqual({ email: "student@msu.ac.th", name: "Student", hd: "msu.ac.th", emailPrefix: "student" });
  });

  it("rejects missing or invalid sessions", async () => {
    await expect(requireIdentityFromCookie(undefined, "test-secret")).rejects.toThrow("AUTH_REQUIRED");
    await expect(requireIdentityFromCookie("invalid", "test-secret")).rejects.toThrow("AUTH_REQUIRED");
  });
});
