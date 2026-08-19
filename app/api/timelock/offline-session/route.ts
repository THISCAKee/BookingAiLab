import { NextResponse } from "next/server";
import { authenticateTimelockDevice, reconcileOfflineSession } from "@/lib/timelock/gateway";
import { timelockErrorResponse } from "@/lib/timelock/http";
import { parseDeviceRequest, parseOfflineSessionRequest } from "@/lib/timelock/requests";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServiceClient();
    const machine = await authenticateTimelockDevice(supabase, parseDeviceRequest(request.headers));
    const session = await reconcileOfflineSession(supabase, machine, parseOfflineSessionRequest(await request.json()));
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    return timelockErrorResponse(error, "OFFLINE_SESSION_FAILED");
  }
}
