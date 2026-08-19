import { NextResponse } from "next/server";
import { authenticateTimelockDevice, loginTimelockUser } from "@/lib/timelock/gateway";
import { timelockErrorResponse } from "@/lib/timelock/http";
import { parseDeviceRequest, parseLoginRequest } from "@/lib/timelock/requests";
import { syncTimelockAccounts } from "@/lib/timelock/sheet-sync";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServiceClient();
    const machine = await authenticateTimelockDevice(supabase, parseDeviceRequest(request.headers));
    try { await syncTimelockAccounts(supabase); } catch { /* use last successful cache */ }
    const session = await loginTimelockUser(supabase, machine, parseLoginRequest(await request.json()));
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    return timelockErrorResponse(error, "LOGIN_FAILED");
  }
}
