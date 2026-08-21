import { NextResponse } from "next/server";
import { createGoogleAuthorizationRequest } from "@/lib/auth/google-oauth";

export async function GET(request: Request) {
  const { url, state, verifier } = createGoogleAuthorizationRequest();
  const response = NextResponse.redirect(url);
  const secure = new URL(request.url).protocol === "https:";
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set("google_oauth_verifier", verifier, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
