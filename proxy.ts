import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = [
  "/booking",
  "/my-bookings",
  "/admin/dashboard",
  "/admin/bookings",
  "/admin/settings",
  "/admin/machines",
];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    const logoutUrl = request.nextUrl.clone();
    logoutUrl.pathname = "/api/auth/logout";
    logoutUrl.searchParams.set("redirectTo", "/login");
    return NextResponse.redirect(logoutUrl);
  }

  const hasSessionCookie = Boolean(request.cookies.get("booking_session")?.value);
  if (isProtectedPath(request.nextUrl.pathname) && !hasSessionCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
