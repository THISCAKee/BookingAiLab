import { createHash, randomBytes } from "node:crypto";
import { getGoogleRuntimeConfig } from "@/lib/google/config";
import { parseBookings, parseMachines, parseSettings } from "@/lib/google/sheet-schema";
import type { BookingStatus, MachineStatus, SheetSettings } from "@/lib/google/sheet-types";
import { createGoogleSheetsClient } from "@/lib/google/sheets-client";

function client() {
  return createGoogleSheetsClient({ spreadsheetId: getGoogleRuntimeConfig().spreadsheetId });
}

export function mapAdminMachineRows(rows: readonly (readonly string[])[]) {
  return parseMachines(rows).map((machine) => ({
    id: machine.machineId,
    machine_code: machine.machineCode,
    machine_name: machine.machineName,
    location: machine.location,
    status: machine.status,
    hasToken: Boolean(machine.deviceTokenHash),
    lastSeenAt: machine.lastSeenAt,
  }));
}

export function mergeSettingsRows(
  rows: readonly (readonly string[])[],
  values: Record<string, string>,
  updatedAt: string,
) {
  const headers = [...(rows[0] ?? [])];
  const keyIndex = headers.indexOf("Key");
  const valueIndex = headers.indexOf("Value");
  const updatedIndex = headers.indexOf("UpdatedAt");
  if (keyIndex < 0 || valueIndex < 0 || updatedIndex < 0) throw new Error("SHEET_HEADER_INVALID:Settings");
  return [headers, ...rows.slice(1).map((source) => {
    const row = [...source];
    const key = row[keyIndex];
    if (key in values) { row[valueIndex] = values[key]; row[updatedIndex] = updatedAt; }
    return row;
  })];
}

export async function listAdminMachines() {
  return mapAdminMachineRows(await client().readSheet("Machines"));
}

export async function listAdminBookings() {
  return parseBookings(await client().readSheet("Bookings")).sort((a, b) => b.startAt.localeCompare(a.startAt));
}

export async function getAdminBookingSettings(): Promise<SheetSettings> {
  return parseSettings(await client().readSheet("Settings"));
}

export async function updateAdminMachine(input: { machineId: string; machineName: string; location: string | null; status: MachineStatus }) {
  const sheets = client();
  const rows = await sheets.readSheet("Machines");
  const machine = parseMachines(rows).find((row) => row.machineId === input.machineId);
  if (!machine) throw new Error("MACHINE_NOT_FOUND");
  const headers = rows[0];
  const row = [...rows[machine.sourceRow - 1]];
  const positions = new Map(headers.map((name, index) => [name, index]));
  const set = (name: string, value: string) => { const index = positions.get(name); if (index !== undefined) row[index] = value; };
  set("machineName", input.machineName); set("location", input.location ?? ""); set("status", input.status); set("updatedAt", new Date().toISOString());
  await sheets.updateSheetRow("Machines", machine.sourceRow, row);
}

export async function rotateAdminMachineToken(machineId: string) {
  const sheets = client();
  const rows = await sheets.readSheet("Machines");
  const machine = parseMachines(rows).find((row) => row.machineId === machineId);
  if (!machine) throw new Error("MACHINE_NOT_FOUND");
  const token = randomBytes(32).toString("base64url");
  const row = [...rows[machine.sourceRow - 1]];
  const positions = new Map(rows[0].map((name, index) => [name, index]));
  row[positions.get("deviceTokenHash")!] = createHash("sha256").update(token).digest("hex");
  row[positions.get("updatedAt")!] = new Date().toISOString();
  await sheets.updateSheetRow("Machines", machine.sourceRow, row);
  return { deviceToken: token, machineCode: machine.machineCode };
}

export async function updateAdminBookingStatus(bookingId: string, status: BookingStatus) {
  const sheets = client();
  const rows = await sheets.readSheet("Bookings");
  const booking = parseBookings(rows).find((row) => row.bookingId === bookingId);
  if (!booking) throw new Error("BOOKING_NOT_FOUND");
  const row = [...rows[booking.sourceRow - 1]];
  const positions = new Map(rows[0].map((name, index) => [name, index]));
  row[positions.get("status")!] = status;
  row[positions.get("updatedAt")!] = new Date().toISOString();
  await sheets.updateSheetRow("Bookings", booking.sourceRow, row);
}

export async function updateAdminSettings(settings: SheetSettings) {
  const sheets = client();
  const rows = await sheets.readSheet("Settings");
  const values: Record<string, string> = {
    serviceWeekdays: settings.serviceWeekdays.join(","), openingTime: settings.openingTime,
    closingTime: settings.closingTime, durationMinutes: String(settings.durationMinutes),
    graceMinutes: String(settings.graceMinutes), timezone: settings.timezone,
  };
  const updated = mergeSettingsRows(rows, values, new Date().toISOString());
  for (let index = 1; index < updated.length; index += 1) {
    await sheets.updateSheetRow("Settings", index + 1, [...updated[index]]);
  }
}
