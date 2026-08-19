import { describe, expect, it } from "vitest";
import { deriveTimelockStatus } from "@/lib/machines/presence";

describe("TimeLock dashboard status", () => {
  const now = new Date("2026-08-19T10:00:00.000Z");

  it("is Offline after the heartbeat becomes stale", () => {
    expect(
      deriveTimelockStatus("2026-08-19T09:59:14.000Z", "logged_in", now),
    ).toBe("offline");
  });

  it("is Online when the app is connected without a logged-in user", () => {
    expect(
      deriveTimelockStatus("2026-08-19T09:59:45.000Z", "logged_out", now),
    ).toBe("online");
  });

  it("is Active for normal and local admin sessions", () => {
    expect(
      deriveTimelockStatus("2026-08-19T09:59:45.000Z", "logged_in", now),
    ).toBe("active");
  });
});
