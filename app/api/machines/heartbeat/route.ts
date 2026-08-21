import { NextResponse } from "next/server";
import { parseHeartbeatRequest } from "@/lib/machines/heartbeat";
import { recordMachineHeartbeat } from "@/lib/timelock/sheet-gateway";

const errorStatus: Record<string, number> = {
  INVALID_HEARTBEAT: 400,
  MACHINE_TOKEN_INVALID: 401,
  MACHINE_NOT_REGISTERED: 404,
  USERNAME_REQUIRED: 400,
};

function getErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  return message in errorStatus ? message : "HEARTBEAT_FAILED";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseHeartbeatRequest(body, request.headers.get("x-device-token"));
    const data = await recordMachineHeartbeat(parsed.heartbeat, parsed.deviceToken);
    return NextResponse.json({ ok: true, machine: data });
  } catch (error) {
    const code = getErrorCode(error);
    return NextResponse.json({ ok: false, code }, { status: errorStatus[code] ?? 500 });
  }
}
