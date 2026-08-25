import { describe, expect, it } from "vitest";
import {
  createAdminSessionCookie,
  readAdminSessionCookie,
} from "@/lib/auth/admin-session";
import { requireAdminIdentityFromCookie } from "@/lib/auth/identity";

describe("admin session", () => {
  it("round-trips an admin identity and rejects an expired session", async () => {
    const now = new Date("2026-08-25T00:00:00.000Z");
    const cookie = await createAdminSessionCookie(
      { email: "admin@msu.ac.th", name: "Administrator", hd: "msu.ac.th", emailPrefix: "admin" },
      now,
      "admin-session-secret",
    );

    await expect(readAdminSessionCookie(cookie, now, "admin-session-secret")).resolves.toEqual({
      email: "admin@msu.ac.th",
      name: "Administrator",
      hd: "msu.ac.th",
      emailPrefix: "admin",
    });
    await expect(
      readAdminSessionCookie(cookie, new Date("2026-09-02T00:00:00.000Z"), "admin-session-secret"),
    ).resolves.toBeNull();
  });

  it("allows protected admin code to use only a valid admin session cookie", async () => {
    const cookie = await createAdminSessionCookie(
      { email: "admin@msu.ac.th", name: "Administrator", hd: "msu.ac.th", emailPrefix: "admin" },
      new Date("2026-08-25T00:00:00.000Z"),
      "admin-session-secret",
    );

    await expect(requireAdminIdentityFromCookie(cookie, "admin-session-secret")).resolves.toEqual({
      email: "admin@msu.ac.th",
      name: "Administrator",
      hd: "msu.ac.th",
      emailPrefix: "admin",
    });
    await expect(requireAdminIdentityFromCookie(undefined, "admin-session-secret")).rejects.toThrow("ADMIN_REQUIRED");
  });
});
