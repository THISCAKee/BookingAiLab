export type DeviceRequest = { machineCode: string; deviceToken: string };

function requiredString(value: unknown, code: string) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(code);
  return value.trim();
}

function isoDate(value: unknown, code: string) {
  const date = new Date(requiredString(value, code));
  if (Number.isNaN(date.getTime())) throw new Error(code);
  return date.toISOString();
}

export function parseDeviceRequest(headers: Headers): DeviceRequest {
  return {
    machineCode: requiredString(headers.get("x-machine-code"), "MACHINE_TOKEN_INVALID").toUpperCase(),
    deviceToken: requiredString(headers.get("x-device-token"), "MACHINE_TOKEN_INVALID"),
  };
}

export function parseLoginRequest(body: unknown) {
  if (!body || typeof body !== "object") throw new Error("LOGIN_INVALID");
  const value = body as Record<string, unknown>;
  return {
    username: requiredString(value.username, "LOGIN_INVALID").toLowerCase(),
    password: requiredString(value.password, "LOGIN_INVALID"),
  };
}

export type TimelockLogoutStatus = "logged_out" | "completed" | "forced_logout";

export function parseLogoutRequest(body: unknown) {
  if (!body || typeof body !== "object") throw new Error("LOGOUT_INVALID");
  const value = body as Record<string, unknown>;
  const status = requiredString(value.status, "LOGOUT_INVALID");
  const usedSeconds = Number(value.usedSeconds);
  if (!["logged_out", "completed", "forced_logout"].includes(status) || !Number.isInteger(usedSeconds) || usedSeconds < 0) {
    throw new Error("LOGOUT_INVALID");
  }
  return {
    sessionId: requiredString(value.sessionId, "LOGOUT_INVALID"),
    usedSeconds,
    status: status as TimelockLogoutStatus,
  };
}

export function parseOfflineSessionRequest(body: unknown) {
  if (!body || typeof body !== "object") throw new Error("OFFLINE_SESSION_INVALID");
  const value = body as Record<string, unknown>;
  const status = requiredString(value.status, "OFFLINE_SESSION_INVALID");
  const usedSeconds = Number(value.usedSeconds);
  if (!["active", "logged_out", "completed", "forced_logout"].includes(status) || !Number.isInteger(usedSeconds) || usedSeconds < 0) {
    throw new Error("OFFLINE_SESSION_INVALID");
  }
  return {
    clientSessionId: requiredString(value.clientSessionId, "OFFLINE_SESSION_INVALID"),
    username: requiredString(value.username, "OFFLINE_SESSION_INVALID").toLowerCase(),
    startedAt: isoDate(value.startedAt, "OFFLINE_SESSION_INVALID"),
    endedAt: status === "active" ? null : isoDate(value.endedAt, "OFFLINE_SESSION_INVALID"),
    usedSeconds,
    status,
  };
}
