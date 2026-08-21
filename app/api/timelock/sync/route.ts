import { NextResponse } from "next/server";
import { authenticateTimelockDevice, syncTimelockDevice } from "@/lib/timelock/sheet-gateway";
import { timelockErrorResponse } from "@/lib/timelock/http";
import { parseDeviceRequest } from "@/lib/timelock/requests";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const machine = await authenticateTimelockDevice(parseDeviceRequest(request.headers));
    const accounts = await syncTimelockDevice(machine);
    return NextResponse.json({ ok: true, machineCode: machine.machineCode, accounts });
  } catch (error) {
    return timelockErrorResponse(error, "SYNC_FAILED");
  }
}
