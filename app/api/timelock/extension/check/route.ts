import { NextResponse } from "next/server";
import { authenticateTimelockDevice, checkTimelockExtension } from "@/lib/timelock/sheet-gateway";
import { timelockErrorResponse } from "@/lib/timelock/http";
import { parseDeviceRequest, parseExtensionCheckRequest } from "@/lib/timelock/requests";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const machine = await authenticateTimelockDevice(parseDeviceRequest(request.headers));
    const data = await checkTimelockExtension(machine, parseExtensionCheckRequest(await request.json()));
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return timelockErrorResponse(error, "EXTENSION_CHECK_FAILED");
  }
}
