import { describe, expect, it } from "vitest";
import { normalizeAdminUsername } from "@/lib/auth/admin-login";

describe("admin login username", () => {
  it("maps the admin username to the configured MSU account", () => {
    expect(normalizeAdminUsername(" admin ")).toBe("admin@msu.ac.th");
    expect(normalizeAdminUsername("ADMIN")).toBe("admin@msu.ac.th");
  });

  it("rejects every other username", () => {
    expect(normalizeAdminUsername("other")).toBeNull();
    expect(normalizeAdminUsername("admin@msu.ac.th")).toBeNull();
    expect(normalizeAdminUsername(123)).toBeNull();
  });
});
