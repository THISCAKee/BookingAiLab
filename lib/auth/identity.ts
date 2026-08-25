import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, readAdminSessionCookie } from "@/lib/auth/admin-session";
import { readSessionCookie } from "@/lib/auth/session";
import type { GoogleIdentity } from "@/lib/auth/google-claims";

export async function requireIdentityFromCookie(cookie: string | undefined, secret?: string): Promise<GoogleIdentity> {
  const identity = await readSessionCookie(cookie, new Date(), secret);
  if (!identity) throw new Error("AUTH_REQUIRED");
  if (identity.hd !== "msu.ac.th" || !identity.email.endsWith("@msu.ac.th")) throw new Error("AUTH_DOMAIN_NOT_ALLOWED");
  return identity;
}

export async function getGoogleIdentity() {
  const cookieStore = await cookies();
  return requireIdentityFromCookie(cookieStore.get("booking_session")?.value);
}

export async function requireGoogleIdentity() {
  return getGoogleIdentity();
}

export async function requireAdminIdentity() {
  const cookieStore = await cookies();
  return requireAdminIdentityFromCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function requireAdminIdentityFromCookie(cookie: string | undefined, secret?: string) {
  const identity = await readAdminSessionCookie(cookie, new Date(), secret);
  if (!identity) throw new Error("ADMIN_REQUIRED");
  return identity;
}
