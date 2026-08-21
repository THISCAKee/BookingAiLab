import { NextResponse } from "next/server";

function logoutResponse(request: Request) {
  const requestUrl = new URL(request.url);
  const redirectTo = requestUrl.searchParams.get("redirectTo") || "/login";
  const target = redirectTo.startsWith("/") ? redirectTo : "/login";
  const response = NextResponse.redirect(new URL(target, request.url));
  response.cookies.delete("booking_session");
  return response;
}

export async function GET(request: Request) { return logoutResponse(request); }
export async function POST(request: Request) { return logoutResponse(request); }
