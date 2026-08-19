import { NextResponse } from "next/server";
import { authenticateTimelockDevice, logoutTimelockUser } from "@/lib/timelock/gateway";
import { timelockErrorResponse } from "@/lib/timelock/http";
import { parseDeviceRequest, parseLogoutRequest } from "@/lib/timelock/requests";
import { flushSheetOutbox } from "@/lib/timelock/sheet-sync";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServiceClient();
    const machine = await authenticateTimelockDevice(supabase, parseDeviceRequest(request.headers));
    const session = await logoutTimelockUser(supabase, machine, parseLogoutRequest(await request.json()));
    try { await flushSheetOutbox(supabase); } catch { /* durable outbox retries later */ }
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    return timelockErrorResponse(error, "LOGOUT_FAILED");
  }
}
