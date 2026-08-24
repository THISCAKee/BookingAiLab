import { describe, expect, it } from "vitest";
import { completeGoogleLogin } from "@/lib/auth/complete-login";

const identity = {
  email: "student@msu.ac.th",
  name: "Student Name",
  hd: "msu.ac.th" as const,
  emailPrefix: "student",
};

describe("complete Google login", () => {
  it("persists the identity before issuing the session", async () => {
    let persistedIdentity: typeof identity | undefined;

    const response = await completeGoogleLogin(
      identity,
      new URL("http://localhost:3000/api/auth/google/callback"),
      {
        async upsertIdentity(value) {
          persistedIdentity = value;
        },
        async createSession(value) {
          if (persistedIdentity !== value) throw new Error("IDENTITY_NOT_PERSISTED");
          return "encrypted-session";
        },
      },
    );

    expect(persistedIdentity).toEqual(identity);
    expect(response.headers.get("location")).toBe("http://localhost:3000/booking");
    expect(response.cookies.get("booking_session")?.value).toBe("encrypted-session");
  });
});
