import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateGoogleClaims } from "@/lib/auth/google-claims";
import { completeGoogleLogin } from "@/lib/auth/complete-login";
import { createSessionCookie } from "@/lib/auth/session";
import { upsertLoginIdentity } from "@/lib/auth/sheet-identities";
import { exchangeGoogleCode, verifyGoogleIdToken } from "@/lib/auth/google-oauth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const loginUrl = new URL("/login", requestUrl.origin);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;
  const verifier = cookieStore.get("google_oauth_verifier")?.value;

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    loginUrl.searchParams.set("error", "callback");
    return NextResponse.redirect(loginUrl);
  }

  try {
    const claims = await verifyGoogleIdToken(await exchangeGoogleCode(code, verifier));
    const identity = validateGoogleClaims(claims);
    return completeGoogleLogin(identity, requestUrl, {
      upsertIdentity: upsertLoginIdentity,
      createSession: createSessionCookie,
    });
  } catch (error) {
    loginUrl.searchParams.set(
      "error",
      error instanceof Error && ["AUTH_EMAIL_INVALID", "AUTH_DOMAIN_NOT_ALLOWED", "AUTH_EMAIL_NOT_VERIFIED"].includes(error.message)
        ? "unauthorized"
        : "callback",
    );
    return NextResponse.redirect(loginUrl);
  }
}
