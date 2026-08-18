import { normalizeHeartbeatInput, type MachineHeartbeatInput } from "@/lib/machines/presence";

export function parseHeartbeatRequest(body: unknown, deviceToken: string | null) {
  if (!deviceToken?.trim()) {
    throw new Error("MACHINE_TOKEN_INVALID");
  }

  if (!body || typeof body !== "object") {
    throw new Error("INVALID_HEARTBEAT");
  }

  return {
    deviceToken: deviceToken.trim(),
    heartbeat: normalizeHeartbeatInput(body as MachineHeartbeatInput),
  };
}
