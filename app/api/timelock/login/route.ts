import { NextResponse } from "next/server";
import { authenticateTimelockDevice, loginTimelockUser } from "@/lib/timelock/sheet-gateway";
import { timelockErrorResponse } from "@/lib/timelock/http";
import { parseDeviceRequest, parseLoginRequest } from "@/lib/timelock/requests";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const machine = await authenticateTimelockDevice(parseDeviceRequest(request.headers));
    const session = await loginTimelockUser(machine, parseLoginRequest(await request.json()));
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    return timelockErrorResponse(error, "LOGIN_FAILED");
  }
}
