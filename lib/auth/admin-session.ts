import type { GoogleIdentity } from "@/lib/auth/google-claims";
import { createSessionCookie, readSessionCookie } from "@/lib/auth/session";

export const ADMIN_SESSION_COOKIE = "admin_session";

export function createAdminSessionCookie(
  identity: GoogleIdentity,
  now = new Date(),
  secret?: string,
) {
  return createSessionCookie(identity, now, secret);
}

export function readAdminSessionCookie(
  value: string | undefined,
  now = new Date(),
  secret?: string,
) {
  return readSessionCookie(value, now, secret);
}
