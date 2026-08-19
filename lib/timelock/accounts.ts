export type TimelockSheetRow = string[];

export type ParsedTimelockAccount = {
  sourceRow: number;
  sheetUserId: string;
  username: string;
  password: string;
  allowedMinutes: number;
  isActive: boolean;
  machineCode: string;
};

const REQUIRED_HEADERS = [
  "UserId",
  "Username",
  "Password",
  "AllowedMinutes",
  "Role",
  "IsActive",
  "MachineCode",
] as const;

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

export function parseGoogleSheetAccounts(
  rows: TimelockSheetRow[],
): ParsedTimelockAccount[] {
  if (rows.length === 0) return [];

  const header = rows[0].map((value) => value.trim());
  const positions = new Map(header.map((name, index) => [name, index]));
  if (REQUIRED_HEADERS.some((name) => !positions.has(name))) {
    throw new Error("SHEET_HEADER_INVALID");
  }

  const valueAt = (row: TimelockSheetRow, name: (typeof REQUIRED_HEADERS)[number]) =>
    String(row[positions.get(name)!] ?? "").trim();

  return rows.slice(1).flatMap((row, offset) => {
    const sourceRow = offset + 2;
    if (row.every((value) => String(value ?? "").trim().length === 0)) return [];

    const role = valueAt(row, "Role").toLowerCase();
    if (role !== "user") throw new Error(`SHEET_ROLE_INVALID:${sourceRow}`);

    const allowedMinutes = Number(valueAt(row, "AllowedMinutes"));
    const isActive = parseBoolean(valueAt(row, "IsActive"));
    const account = {
      sourceRow,
      sheetUserId: valueAt(row, "UserId"),
      username: valueAt(row, "Username").toLowerCase(),
      password: valueAt(row, "Password"),
      allowedMinutes,
      isActive,
      machineCode: valueAt(row, "MachineCode").toUpperCase(),
    };

    if (
      !account.sheetUserId ||
      !account.username ||
      !account.password ||
      !Number.isInteger(allowedMinutes) ||
      allowedMinutes <= 0 ||
      isActive === null ||
      !account.machineCode
    ) {
      throw new Error(`SHEET_ACCOUNT_INVALID:${sourceRow}`);
    }

    return [{ ...account, isActive }];
  });
}
