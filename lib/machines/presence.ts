export const HEARTBEAT_STALE_AFTER_SECONDS = 45;

export type MachineSessionStatus = "logged_in" | "logged_out" | "idle";
export type MachineConnectionStatus = "online" | "stale";
export type TimelockOperationalStatus = "offline" | "online" | "active";

export type MachineHeartbeatInput = {
  machineCode: unknown;
  username: unknown;
  sessionStatus: unknown;
  appVersion: unknown;
  osVersion: unknown;
  reportedAt: unknown;
};

export type NormalizedHeartbeat = {
  machineCode: string;
  username: string | null;
  sessionStatus: MachineSessionStatus;
  appVersion: string;
  osVersion: string;
  reportedAt: string;
};

function requiredString(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("INVALID_HEARTBEAT");
  }

  return value.trim();
}

export function normalizeHeartbeatInput(input: MachineHeartbeatInput): NormalizedHeartbeat {
  const machineCode = requiredString(input.machineCode).toUpperCase();
  const sessionStatus = requiredString(input.sessionStatus);

  if (!(["logged_in", "logged_out", "idle"] as string[]).includes(sessionStatus)) {
    throw new Error("INVALID_HEARTBEAT");
  }

  const reportedAt = new Date(requiredString(input.reportedAt));
  if (Number.isNaN(reportedAt.getTime())) {
    throw new Error("INVALID_HEARTBEAT");
  }

  const username = typeof input.username === "string" ? input.username.trim() : "";

  return {
    machineCode,
    username: sessionStatus === "logged_out" || username.length === 0 ? null : username,
    sessionStatus: sessionStatus as MachineSessionStatus,
    appVersion: requiredString(input.appVersion),
    osVersion: requiredString(input.osVersion),
    reportedAt: reportedAt.toISOString(),
  };
}

export function deriveMachineConnectionStatus(
  lastSeenAt: string | null | undefined,
  now = new Date(),
): MachineConnectionStatus {
  if (!lastSeenAt) {
    return "stale";
  }

  const lastSeen = new Date(lastSeenAt);
  if (Number.isNaN(lastSeen.getTime())) {
    return "stale";
  }

  const ageSeconds = (now.getTime() - lastSeen.getTime()) / 1000;
  return ageSeconds <= HEARTBEAT_STALE_AFTER_SECONDS ? "online" : "stale";
}

export function deriveTimelockStatus(
  lastSeenAt: string | null | undefined,
  sessionStatus: MachineSessionStatus,
  now = new Date(),
): TimelockOperationalStatus {
  if (deriveMachineConnectionStatus(lastSeenAt, now) === "stale") return "offline";
  return sessionStatus === "logged_in" ? "active" : "online";
}
