import { describe, expect, it } from "vitest";
import { createSessionCookie, readSessionCookie } from "@/lib/auth/session";
import type { GoogleIdentity } from "@/lib/auth/google-claims";

const identity: GoogleIdentity = {
  email: "student@msu.ac.th",
  name: "Student",
  hd: "msu.ac.th",
  emailPrefix: "student",
};

describe("session cookie", () => {
  it("round-trips identity and rejects tampered or expired cookies", async () => {
    const now = new Date("2026-08-21T00:00:00.000Z");
    const cookie = await createSessionCookie(identity, now, "session-secret-for-tests");

    expect(await readSessionCookie(cookie, now, "session-secret-for-tests")).toEqual(identity);
    expect(await readSessionCookie(`${cookie}x`, now, "session-secret-for-tests")).toBeNull();
    expect(
      await readSessionCookie(
        cookie,
        new Date("2026-08-29T00:00:00.000Z"),
        "session-secret-for-tests",
      ),
    ).toBeNull();
  });
});
