import { describe, expect, it } from "vitest";
import {
  parseGoogleSheetAccounts,
  type TimelockSheetRow,
} from "@/lib/timelock/accounts";
import {
  createPasswordVerifier,
  verifyPassword,
} from "@/lib/timelock/passwords";

const header = [
  "UserId",
  "Username",
  "Password",
  "AllowedMinutes",
  "Role",
  "IsActive",
  "MachineCode",
];

describe("TimeLock account sync", () => {
  it("normalizes valid user rows from the private Google Sheet", () => {
    const rows: TimelockSheetRow[] = [
      header,
      ["67010001", " Student01 ", "pass-123", "120", "user", "TRUE", " pc-001 "],
    ];

    expect(parseGoogleSheetAccounts(rows)).toEqual([
      {
        sourceRow: 2,
        sheetUserId: "67010001",
        username: "student01",
        password: "pass-123",
        allowedMinutes: 120,
        isActive: true,
        machineCode: "PC-001",
      },
    ]);
  });

  it("rejects admin rows because Sheet accounts are users only", () => {
    const rows: TimelockSheetRow[] = [
      header,
      ["1", "admin", "secret", "60", "admin", "TRUE", "PC-001"],
    ];

    expect(() => parseGoogleSheetAccounts(rows)).toThrow("SHEET_ROLE_INVALID:2");
  });

  it("rejects invalid duration and missing machine assignment", () => {
    expect(() =>
      parseGoogleSheetAccounts([
        header,
        ["1", "student", "secret", "0", "user", "TRUE", ""],
      ]),
    ).toThrow("SHEET_ACCOUNT_INVALID:2");
  });
});

describe("TimeLock password verifier", () => {
  it("accepts the original password and rejects a different password", async () => {
    const verifier = await createPasswordVerifier("correct horse", {
      iterations: 1_000,
      salt: Buffer.from("0123456789abcdef", "utf8"),
    });

    expect(verifier.algorithm).toBe("pbkdf2-sha256");
    expect(await verifyPassword("correct horse", verifier)).toBe(true);
    expect(await verifyPassword("wrong", verifier)).toBe(false);
  });
});
