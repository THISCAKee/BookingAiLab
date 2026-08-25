import { describe, expect, it } from "vitest";
import {
  createAdminIdentity,
  verifyAdminCredentials,
} from "@/lib/auth/admin-password-login";

describe("admin password login", () => {
  it("accepts the configured admin username and password", () => {
    expect(
      verifyAdminCredentials(" admin ", "correct-password", {
        username: "admin",
        password: "correct-password",
      }),
    ).toBe(true);
  });

  it("rejects an incorrect username or password", () => {
    expect(
      verifyAdminCredentials("admin", "wrong-password", {
        username: "admin",
        password: "correct-password",
      }),
    ).toBe(false);
    expect(
      verifyAdminCredentials("other", "correct-password", {
        username: "admin",
        password: "correct-password",
      }),
    ).toBe(false);
  });

  it("creates the admin identity used by the protected admin pages", () => {
    expect(createAdminIdentity({ email: "operator@msu.ac.th", name: "Lab Operator" })).toEqual({
      email: "operator@msu.ac.th",
      name: "Lab Operator",
      hd: "msu.ac.th",
      emailPrefix: "operator",
    });
  });
});
