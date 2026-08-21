import { createHash, randomBytes } from "node:crypto";
import { getGoogleRuntimeConfig } from "@/lib/google/config";

const GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

function base64UrlJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function createGoogleAuthorizationRequest() {
  const config = getGoogleRuntimeConfig();
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const url = new URL(GOOGLE_AUTHORIZATION_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
    hd: "msu.ac.th",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), state, verifier };
}

type GoogleTokenResponse = { id_token?: string; error?: string };
type JwtHeader = { alg?: string; kid?: string; typ?: string };
type GoogleJwk = { kid?: string; kty: "RSA"; n: string; e: string; alg?: string; use?: string };
type GoogleJwksResponse = { keys?: GoogleJwk[] };

export async function exchangeGoogleCode(code: string, verifier: string) {
  const config = getGoogleRuntimeConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("GOOGLE_TOKEN_EXCHANGE_FAILED");
  const data = (await response.json()) as GoogleTokenResponse;
  if (!data.id_token) throw new Error("GOOGLE_ID_TOKEN_MISSING");
  return data.id_token;
}

export async function verifyGoogleIdToken(idToken: string) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("GOOGLE_ID_TOKEN_INVALID");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = base64UrlJson<JwtHeader>(encodedHeader);
  const payload = base64UrlJson<Record<string, unknown>>(encodedPayload);
  if (header.alg !== "RS256" || !header.kid) throw new Error("GOOGLE_ID_TOKEN_INVALID");

  const jwksResponse = await fetch(GOOGLE_JWKS_URL, { cache: "no-store" });
  if (!jwksResponse.ok) throw new Error("GOOGLE_JWKS_FAILED");
  const jwks = (await jwksResponse.json()) as GoogleJwksResponse;
  const jwk = jwks.keys?.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("GOOGLE_ID_TOKEN_KEY_NOT_FOUND");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    Buffer.from(encodedSignature, "base64url"),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!valid) throw new Error("GOOGLE_ID_TOKEN_INVALID");

  const config = getGoogleRuntimeConfig();
  const issuer = payload.iss;
  const audience = payload.aud;
  const expiry = Number(payload.exp);
  if (
    (issuer !== "accounts.google.com" && issuer !== "https://accounts.google.com") ||
    audience !== config.clientId ||
    !Number.isFinite(expiry) ||
    expiry <= Math.floor(Date.now() / 1_000)
  ) {
    throw new Error("GOOGLE_ID_TOKEN_INVALID");
  }
  return payload;
}
