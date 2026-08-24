import { randomUUID } from "node:crypto";
import type { GoogleIdentity } from "@/lib/auth/google-claims";
import { getGoogleRuntimeConfig } from "@/lib/google/config";
import { createGoogleSheetsClient } from "@/lib/google/sheets-client";

const IDENTITY_HEADERS = [
  "identityId",
  "email",
  "name",
  "hd",
  "emailPrefix",
  "lastLoginAt",
  "updatedAt",
];

type IdentitySheetClient = {
  readSheet(tab: "Identities"): Promise<string[][]>;
  appendSheetRow(tab: "Identities", row: string[]): Promise<void>;
  updateSheetRow(tab: "Identities", rowNumber: number, row: string[]): Promise<void>;
};

export async function upsertLoginIdentity(
  identity: GoogleIdentity,
  options: {
    client?: IdentitySheetClient;
    now?: Date;
    identityId?: string;
  } = {},
) {
  const client = options.client ?? createGoogleSheetsClient({
    spreadsheetId: getGoogleRuntimeConfig().spreadsheetId,
  });
  const rows = await client.readSheet("Identities");
  if (
    rows.length === 0 ||
    IDENTITY_HEADERS.some((header, index) => rows[0]?.[index] !== header)
  ) {
    throw new Error("LOGIN_IDENTITY_SHEET_INVALID");
  }

  const now = (options.now ?? new Date()).toISOString();
  const existingIndex = rows.findIndex(
    (row, index) => index > 0 && row[1]?.toLowerCase() === identity.email.toLowerCase(),
  );
  const row = [
    existingIndex > 0 ? rows[existingIndex][0] : options.identityId ?? randomUUID(),
    identity.email,
    identity.name,
    identity.hd,
    identity.emailPrefix,
    now,
    now,
  ];

  if (existingIndex > 0) {
    await client.updateSheetRow("Identities", existingIndex + 1, row);
  } else {
    await client.appendSheetRow("Identities", row);
  }
}
