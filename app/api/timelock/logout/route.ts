import { NextResponse } from "next/server";
import { authenticateTimelockDevice, logoutTimelockUser } from "@/lib/timelock/sheet-gateway";
import { timelockErrorResponse } from "@/lib/timelock/http";
import { parseDeviceRequest, parseLogoutRequest } from "@/lib/timelock/requests";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const machine = await authenticateTimelockDevice(parseDeviceRequest(request.headers));
    const session = await logoutTimelockUser(machine, parseLogoutRequest(await request.json()));
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    return timelockErrorResponse(error, "LOGOUT_FAILED");
  }
}
