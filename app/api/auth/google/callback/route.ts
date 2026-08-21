import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateGoogleClaims } from "@/lib/auth/google-claims";
import { createSessionCookie } from "@/lib/auth/session";
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
    const session = await createSessionCookie(identity);
    const response = NextResponse.redirect(new URL("/", requestUrl.origin));
    response.cookies.set("booking_session", session, {
      httpOnly: true,
      secure: requestUrl.protocol === "https:",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    response.cookies.delete("google_oauth_state");
    response.cookies.delete("google_oauth_verifier");
    return response;
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
