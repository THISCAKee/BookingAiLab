import { NextResponse } from "next/server";

export function createAuthenticatedSessionResponse(
  requestUrl: URL,
  session: string,
) {
  const response = NextResponse.redirect(new URL("/booking", requestUrl.origin));
  response.cookies.set("booking_session", session, {
    httpOnly: true,
    secure: requestUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
  });
  response.cookies.delete("google_oauth_state");
  response.cookies.delete("google_oauth_verifier");
  return response;
}
