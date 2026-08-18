import { NextResponse } from "next/server";
import { parseHeartbeatRequest } from "@/lib/machines/heartbeat";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("record_machine_heartbeat", {
      p_machine_code: parsed.heartbeat.machineCode,
      p_device_token: parsed.deviceToken,
      p_username: parsed.heartbeat.username,
      p_session_status: parsed.heartbeat.sessionStatus,
      p_app_version: parsed.heartbeat.appVersion,
      p_os_version: parsed.heartbeat.osVersion,
      p_reported_at: parsed.heartbeat.reportedAt,
    });

    if (error) {
      const code = getErrorCode({ message: error.message });
      return NextResponse.json({ ok: false, code }, { status: errorStatus[code] ?? 500 });
    }

    return NextResponse.json({ ok: true, machine: data });
  } catch (error) {
    const code = getErrorCode(error);
    return NextResponse.json({ ok: false, code }, { status: errorStatus[code] ?? 500 });
  }
}
