import { describe, expect, it } from "vitest";
import { upsertLoginIdentity } from "@/lib/auth/sheet-identities";

const headers = [
  "identityId",
  "email",
  "name",
  "hd",
  "emailPrefix",
  "lastLoginAt",
  "updatedAt",
];

function inMemoryIdentitySheet(initialRows: string[][] = [headers]) {
  const rows = initialRows.map((row) => [...row]);
  return {
    rows,
    client: {
      async readSheet() {
        return rows.map((row) => [...row]);
      },
      async appendSheetRow(_tab: "Identities", row: string[]) {
        rows.push([...row]);
      },
      async updateSheetRow(_tab: "Identities", rowNumber: number, row: string[]) {
        rows[rowNumber - 1] = [...row];
      },
    },
  };
}

describe("login identity repository", () => {
  it("adds a complete inactive login identity on first login", async () => {
    const sheet = inMemoryIdentitySheet();

    await upsertLoginIdentity(
      {
        email: "student@msu.ac.th",
        name: "Student Name",
        hd: "msu.ac.th",
        emailPrefix: "student",
      },
      {
        client: sheet.client,
        now: new Date("2026-08-24T06:00:00.000Z"),
        identityId: "identity-1",
      },
    );

    expect(sheet.rows).toEqual([
      headers,
      [
        "identity-1",
        "student@msu.ac.th",
        "Student Name",
        "msu.ac.th",
        "student",
        "2026-08-24T06:00:00.000Z",
        "2026-08-24T06:00:00.000Z",
      ],
    ]);
  });

  it("updates the existing identity instead of adding a duplicate", async () => {
    const sheet = inMemoryIdentitySheet([
      headers,
      [
        "identity-existing",
        "student@msu.ac.th",
        "Old Name",
        "msu.ac.th",
        "student",
        "2026-08-23T06:00:00.000Z",
        "2026-08-23T06:00:00.000Z",
      ],
    ]);

    await upsertLoginIdentity(
      {
        email: "student@msu.ac.th",
        name: "Updated Name",
        hd: "msu.ac.th",
        emailPrefix: "student",
      },
      {
        client: sheet.client,
        now: new Date("2026-08-24T07:00:00.000Z"),
        identityId: "must-not-be-used",
      },
    );

    expect(sheet.rows).toEqual([
      headers,
      [
        "identity-existing",
        "student@msu.ac.th",
        "Updated Name",
        "msu.ac.th",
        "student",
        "2026-08-24T07:00:00.000Z",
        "2026-08-24T07:00:00.000Z",
      ],
    ]);
  });
});
