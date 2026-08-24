import { NextResponse } from "next/server";

const statuses: Record<string, number> = {
  MACHINE_TOKEN_INVALID: 401,
  LOGIN_INVALID: 400,
  LOGOUT_INVALID: 400,
  OFFLINE_SESSION_INVALID: 400,
  CREDENTIALS_INVALID: 401,
  ACCOUNT_LOCKED: 423,
  ACCOUNT_INACTIVE: 403,
  ACCOUNT_MACHINE_MISMATCH: 403,
  ACCOUNT_ALREADY_ACTIVE: 409,
  SESSION_NOT_FOUND: 404,
  EXTENSION_CHECK_INVALID: 400,
  EXTENSION_CONFIRM_INVALID: 400,
  EXTENSION_LIMIT_REACHED: 409,
  EXTENSION_CROSSES_MIDNIGHT: 409,
  EXTENSION_NEXT_BOOKING_CONFLICT: 409,
  EXTENSION_BOOKING_INACTIVE: 409,
  EXTENSION_ACCOUNT_MISMATCH: 403,
};

export function timelockErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const code = message in statuses ? message : fallback;
  return NextResponse.json({ ok: false, code }, { status: statuses[code] ?? 500 });
}
