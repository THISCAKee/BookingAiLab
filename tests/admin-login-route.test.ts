import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/admin/login/route";

describe("admin login route", () => {
  const originalPassword = process.env.ADMIN_PASSWORD;
  const originalSessionSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.ADMIN_PASSWORD = "correct-password";
    process.env.SESSION_SECRET = "session-secret-for-route-tests";
  });

  afterEach(() => {
    if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalPassword;
    if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSessionSecret;
  });

  it("sets an admin session and redirects to the dashboard after valid credentials", async () => {
    const response = await POST(new Request("http://localhost:3000/api/admin/login", {
      method: "POST",
      body: new URLSearchParams({ username: "admin", password: "correct-password" }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/dashboard");
    expect(response.headers.get("set-cookie")).toContain("admin_session=");
  });

  it("redirects back with an error and does not create a session after invalid credentials", async () => {
    const response = await POST(new Request("http://localhost:3000/api/admin/login", {
      method: "POST",
      body: new URLSearchParams({ username: "admin", password: "wrong-password" }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin?error=credentials");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
