import { NextResponse } from "next/server";
import {
  adminCredentialsFromEnvironment,
  createAdminIdentity,
  verifyAdminCredentials,
} from "@/lib/auth/admin-password-login";
import { ADMIN_SESSION_COOKIE, createAdminSessionCookie } from "@/lib/auth/admin-session";

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");
  const configured = adminCredentialsFromEnvironment();

  if (!configured.password) {
    return redirectWithError(request, "config");
  }

  if (!verifyAdminCredentials(username, password, configured)) {
    return redirectWithError(request, "credentials");
  }

  const session = await createAdminSessionCookie(
    createAdminIdentity({ email: configured.email, name: configured.name }),
  );
  const response = NextResponse.redirect(new URL("/admin/dashboard", request.url), 303);
  response.cookies.set(ADMIN_SESSION_COOKIE, session, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
  });
  return response;
}

function redirectWithError(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/admin?error=${error}`, request.url), 303);
}
