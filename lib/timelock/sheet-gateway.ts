import { createHash, randomUUID } from "node:crypto";
import { getGoogleRuntimeConfig } from "@/lib/google/config";
import { createGoogleSheetsClient } from "@/lib/google/sheets-client";
import { parseMachines } from "@/lib/google/sheet-schema";
import { buildOfflineAccount } from "@/lib/timelock/offline-cache";
import { verifyPassword, type PasswordVerifier } from "@/lib/timelock/passwords";
import type { DeviceRequest, TimelockLogoutStatus } from "@/lib/timelock/requests";
import type { NormalizedHeartbeat } from "@/lib/machines/presence";

export type SheetDeviceContext = { id: string; machineCode: string };

function client() { return createGoogleSheetsClient({ spreadsheetId: getGoogleRuntimeConfig().spreadsheetId }); }

async function users(): Promise<Array<Record<string, string>>> {
  const rows = await client().readSheet("Users");
  const headers = rows[0] ?? [];
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "").trim()])) as Record<string, string>);
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

function verifier(row: Record<string, string>): PasswordVerifier {
  return { algorithm: "pbkdf2-sha256", iterations: Number(row.passwordIterations), salt: row.passwordSalt, hash: row.passwordHash };
}

export async function syncTimelockDevice(device: SheetDeviceContext) {
  const rows = await users();
  const now = new Date();
  return rows.filter((row) => row.machineCode?.toUpperCase() === device.machineCode && row.isActive.toLowerCase() === "true").map((row) => buildOfflineAccount({ id: row.userId, username: row.emailPrefix || row.username, allowedMinutes: Number(row.allowedMinutes), isActive: true, passwordAlgorithm: "pbkdf2-sha256", passwordIterations: Number(row.passwordIterations), passwordSalt: row.passwordSalt, passwordHash: row.passwordHash }, now));
}

export async function loginTimelockUser(device: SheetDeviceContext, input: { username: string; password: string }) {
  const account = (await users()).find((row) => (row.emailPrefix || row.username).toLowerCase() === input.username.toLowerCase() && row.machineCode?.toUpperCase() === device.machineCode && row.isActive.toLowerCase() === "true");
  if (!account || !(await verifyPassword(input.password, verifier(account)))) throw new Error("CREDENTIALS_INVALID");
  return { sessionId: randomUUID(), username: input.username.toLowerCase(), machineCode: device.machineCode, startedAt: new Date().toISOString(), status: "active" };
}

export async function logoutTimelockUser(device: SheetDeviceContext, input: { sessionId: string; usedSeconds: number; status: TimelockLogoutStatus }) {
  return { sessionId: input.sessionId, machineCode: device.machineCode, usedSeconds: input.usedSeconds, status: input.status, endedAt: new Date().toISOString() };
}

export async function reconcileOfflineSession(device: SheetDeviceContext, input: { clientSessionId: string; username: string; startedAt: string; endedAt: string | null; usedSeconds: number; status: string }) {
  const account = (await users()).find((row) => (row.emailPrefix || row.username).toLowerCase() === input.username.toLowerCase() && row.machineCode?.toUpperCase() === device.machineCode && row.isActive.toLowerCase() === "true");
  if (!account) throw new Error("ACCOUNT_MACHINE_MISMATCH");
  return { sessionId: input.clientSessionId, username: input.username, machineCode: device.machineCode, startedAt: input.startedAt, endedAt: input.endedAt, usedSeconds: input.usedSeconds, status: input.status };
}
