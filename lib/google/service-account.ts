import { createSign } from "node:crypto";
import { getGoogleRuntimeConfig } from "@/lib/google/config";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_REFRESH_BUFFER_MS = 60_000;

let cachedToken: { value: string; expiresAt: number } | null = null;
let tokenRequest: Promise<{ value: string; expiresAt: number }> | null = null;

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

export async function getGoogleSheetsAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - now > TOKEN_REFRESH_BUFFER_MS) {
    return cachedToken.value;
  }
  if (tokenRequest) return (await tokenRequest).value;

  tokenRequest = requestGoogleSheetsAccessToken();
  try {
    cachedToken = await tokenRequest;
    return cachedToken.value;
  } finally {
    tokenRequest = null;
  }
}

async function requestGoogleSheetsAccessToken() {
  const config = getGoogleRuntimeConfig();
  const now = Math.floor(Date.now() / 1_000);
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({
    iss: config.serviceAccountEmail,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3_600,
  }))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(config.serviceAccountPrivateKey, "base64url")}`;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("GOOGLE_TOKEN_FAILED");
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("GOOGLE_TOKEN_FAILED");
  const expiresInMs = Math.max(60_000, (data.expires_in ?? 3_600) * 1_000);
  return { value: data.access_token, expiresAt: Date.now() + expiresInMs };
}
