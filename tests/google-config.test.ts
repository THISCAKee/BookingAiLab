import { describe, expect, it } from "vitest";
import { getGoogleRuntimeConfig } from "@/lib/google/config";

describe("getGoogleRuntimeConfig", () => {
  it("rejects when a required Google-only secret is absent", () => {
    expect(() => getGoogleRuntimeConfig({ GOOGLE_OAUTH_CLIENT_ID: "id" })).toThrow(
      "GOOGLE_CONFIG_MISSING",
    );
  });

  it("normalizes escaped private-key newlines", () => {
    const config = getGoogleRuntimeConfig({
      GOOGLE_OAUTH_CLIENT_ID: "client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
      GOOGLE_OAUTH_REDIRECT_URI: "http://localhost:3000/api/auth/google/callback",
      SESSION_SECRET: "a-session-secret-that-is-long-enough-for-tests",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "backend@example.iam.gserviceaccount.com",
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "line-1\\nline-2",
      GOOGLE_SHEET_ID: "sheet-id",
    });

    expect(config.serviceAccountPrivateKey).toBe("line-1\nline-2");
  });
});
