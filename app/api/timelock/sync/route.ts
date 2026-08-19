import { NextResponse } from "next/server";
import { authenticateTimelockDevice, syncTimelockDevice } from "@/lib/timelock/gateway";
import { timelockErrorResponse } from "@/lib/timelock/http";
import { parseDeviceRequest } from "@/lib/timelock/requests";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServiceClient();
    const machine = await authenticateTimelockDevice(supabase, parseDeviceRequest(request.headers));
    const accounts = await syncTimelockDevice(supabase, machine);
    return NextResponse.json({ ok: true, machineCode: machine.machineCode, accounts });
  } catch (error) {
    return timelockErrorResponse(error, "SYNC_FAILED");
  }
}
