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
};

export function timelockErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const code = message in statuses ? message : fallback;
  return NextResponse.json({ ok: false, code }, { status: statuses[code] ?? 500 });
}
