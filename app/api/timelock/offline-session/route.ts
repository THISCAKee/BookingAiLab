import { NextResponse } from "next/server";
import { authenticateTimelockDevice, reconcileOfflineSession } from "@/lib/timelock/sheet-gateway";
import { timelockErrorResponse } from "@/lib/timelock/http";
import { parseDeviceRequest, parseOfflineSessionRequest } from "@/lib/timelock/requests";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const machine = await authenticateTimelockDevice(parseDeviceRequest(request.headers));
    const session = await reconcileOfflineSession(machine, parseOfflineSessionRequest(await request.json()));
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    return timelockErrorResponse(error, "OFFLINE_SESSION_FAILED");
  }
}
