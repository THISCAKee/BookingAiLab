import { createHash, randomUUID } from "node:crypto";
import { getGoogleRuntimeConfig } from "@/lib/google/config";
import { createGoogleSheetsClient } from "@/lib/google/sheets-client";
import { parseMachines } from "@/lib/google/sheet-schema";
import type { SheetTab } from "@/lib/google/sheets-client";
import { buildOfflineAccount } from "@/lib/timelock/offline-cache";
import { verifyPassword, type PasswordVerifier } from "@/lib/timelock/passwords";
import type { DeviceRequest, TimelockLogoutStatus } from "@/lib/timelock/requests";
import type { NormalizedHeartbeat } from "@/lib/machines/presence";
import { parseTimelockEvents, parseTimelockUsers, type TimelockSheetUser } from "@/lib/timelock/sheet-records";

export type SheetDeviceContext = { id: string; machineCode: string };

function client() { return createGoogleSheetsClient({ spreadsheetId: getGoogleRuntimeConfig().spreadsheetId }); }

export type TimelockGatewaySheets = {
  readSheet(tab: SheetTab): Promise<string[][]>;
  appendSheetRow(tab: SheetTab, row: string[]): Promise<void>;
};

type GatewayDependencies = {
  sheets?: TimelockGatewaySheets;
  now?: () => Date;
  randomId?: () => string;
};

function dependencies(options: GatewayDependencies) {
  return {
    sheets: options.sheets ?? client(),
    now: options.now ?? (() => new Date()),
    randomId: options.randomId ?? randomUUID,
  };
}

async function users(sheetsClient: TimelockGatewaySheets) {
  return parseTimelockUsers(await sheetsClient.readSheet("Users"));
}

export async function authenticateTimelockDevice(device: DeviceRequest): Promise<SheetDeviceContext> {
  const machines = parseMachines(await client().readSheet("Machines"));
  const tokenHash = createHash("sha256").update(device.deviceToken).digest("hex");
  const machine = machines.find((row) => row.machineCode === device.machineCode && row.deviceTokenHash === tokenHash);
  if (!machine) throw new Error("MACHINE_TOKEN_INVALID");
  return { id: machine.machineId, machineCode: machine.machineCode };
}

export async function recordMachineHeartbeat(input: NormalizedHeartbeat, deviceToken: string) {
  const sheets = client();
  const rows = await sheets.readSheet("Machines");
  const machines = parseMachines(rows);
  const tokenHash = createHash("sha256").update(deviceToken).digest("hex");
  const machine = machines.find((row) => row.machineCode === input.machineCode && row.deviceTokenHash === tokenHash);
  if (!machine) throw new Error("MACHINE_TOKEN_INVALID");
  const headers = rows[0] ?? [];
  const row = [...(rows[machine.sourceRow - 1] ?? [])];
  const index = new Map(headers.map((header, position) => [header, position]));
  const set = (header: string, value: string) => { const position = index.get(header); if (position !== undefined) row[position] = value; };
  set("lastSeenAt", input.reportedAt); set("updatedAt", new Date().toISOString());
  await sheets.updateSheetRow("Machines", machine.sourceRow, row);
  return { machineId: machine.machineId, machineCode: machine.machineCode, receivedAt: new Date().toISOString() };
}

function verifier(row: TimelockSheetUser): PasswordVerifier {
  return { algorithm: row.passwordAlgorithm, iterations: row.passwordIterations, salt: row.passwordSalt, hash: row.passwordHash };
}

export async function syncTimelockDevice(device: SheetDeviceContext) {
  const rows = await users(client());
  const now = new Date();
  return rows.filter((row) => row.machineCode === device.machineCode && row.isActive).map((row) => buildOfflineAccount({ id: row.userId, username: row.emailPrefix || row.username, allowedMinutes: row.allowedMinutes, isActive: true, passwordAlgorithm: row.passwordAlgorithm, passwordIterations: row.passwordIterations, passwordSalt: row.passwordSalt, passwordHash: row.passwordHash }, now));
}

export async function loginTimelockUser(device: SheetDeviceContext, input: { username: string; password: string }, options: GatewayDependencies = {}) {
  const deps = dependencies(options);
  const account = (await users(deps.sheets)).find((row) => (row.emailPrefix || row.username) === input.username.toLowerCase() && row.machineCode === device.machineCode && row.isActive);
  if (!account || !(await verifyPassword(input.password, verifier(account)))) throw new Error("CREDENTIALS_INVALID");
  const sessionId = deps.randomId();
  const eventId = deps.randomId();
  const startedAt = deps.now().toISOString();
  await deps.sheets.appendSheetRow("Events", [eventId, "session_started", sessionId, account.sourceBookingId, device.machineCode, account.username, "active", "{}", startedAt, startedAt]);
  return { sessionId, username: input.username.toLowerCase(), machineCode: device.machineCode, startedAt, status: "active" };
}

export async function logoutTimelockUser(device: SheetDeviceContext, input: { sessionId: string; usedSeconds: number; status: TimelockLogoutStatus }, options: GatewayDependencies = {}) {
  const deps = dependencies(options);
  const events = parseTimelockEvents(await deps.sheets.readSheet("Events"));
  const started = events.filter((event) => event.sessionId === input.sessionId && event.eventType === "session_started").sort((left, right) => right.sourceRow - left.sourceRow)[0];
  const ended = started && events.some((event) => event.sessionId === input.sessionId && event.eventType === "session_ended" && event.sourceRow > started.sourceRow);
  if (!started || ended) throw new Error("SESSION_NOT_FOUND");
  if (started.machineCode !== device.machineCode) throw new Error("ACCOUNT_MACHINE_MISMATCH");
  const endedAt = deps.now().toISOString();
  await deps.sheets.appendSheetRow("Events", [deps.randomId(), "session_ended", input.sessionId, started.bookingId, device.machineCode, started.username, input.status, JSON.stringify({ usedSeconds: input.usedSeconds }), endedAt, endedAt]);
  return { sessionId: input.sessionId, machineCode: device.machineCode, usedSeconds: input.usedSeconds, status: input.status, endedAt };
}

export async function reconcileOfflineSession(device: SheetDeviceContext, input: { clientSessionId: string; username: string; startedAt: string; endedAt: string | null; usedSeconds: number; status: string }) {
  const account = (await users(client())).find((row) => (row.emailPrefix || row.username) === input.username.toLowerCase() && row.machineCode === device.machineCode && row.isActive);
  if (!account) throw new Error("ACCOUNT_MACHINE_MISMATCH");
  return { sessionId: input.clientSessionId, username: input.username, machineCode: device.machineCode, startedAt: input.startedAt, endedAt: input.endedAt, usedSeconds: input.usedSeconds, status: input.status };
}
