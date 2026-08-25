import { NextResponse, type NextRequest } from "next/server";

const protectedBookingPrefixes = [
  "/booking",
  "/my-bookings",
];

const protectedAdminPrefixes = [
  "/admin/dashboard",
  "/admin/bookings",
  "/admin/settings",
  "/admin/machines",
];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some(
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

  const pathname = request.nextUrl.pathname;
  const needsAdminSession = matchesPrefix(pathname, protectedAdminPrefixes);
  const needsBookingSession = matchesPrefix(pathname, protectedBookingPrefixes);
  const hasAdminSession = Boolean(request.cookies.get("admin_session")?.value);
  const hasBookingSession = Boolean(request.cookies.get("booking_session")?.value);

  if ((needsAdminSession && !hasAdminSession) || (needsBookingSession && !hasBookingSession)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = needsAdminSession ? "/admin" : "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
