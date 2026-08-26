import { describe, expect, it, vi } from "vitest";
import { createGoogleSheetsClient } from "@/lib/google/sheets-client";

describe("Google Sheets client", () => {
  it("reads an encoded tab range with a bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ values: [["header"], ["value"]] }), { status: 200 }),
    );
    const client = createGoogleSheetsClient({
      spreadsheetId: "sheet/id",
      accessToken: async () => "token",
      fetchImpl,
    });

    await expect(client.readSheet("Machines")).resolves.toEqual([["header"], ["value"]]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://sheets.googleapis.com/v4/spreadsheets/sheet%2Fid/values/Machines!A1%3AZ",
      expect.objectContaining({ headers: { authorization: "Bearer token" }, cache: "no-store" }),
    );
  });

  it("maps failed writes to a stable error", async () => {
    const client = createGoogleSheetsClient({
      spreadsheetId: "sheet-id",
      accessToken: async () => "token",
      fetchImpl: vi.fn().mockResolvedValue(new Response("no", { status: 500 })),
    });

    await expect(client.appendSheetRow("Bookings", ["row"])).rejects.toThrow("GOOGLE_SHEET_WRITE_FAILED");
  });

  it("shares one access token across concurrent sheet reads", async () => {
    const fetchImpl = vi.fn().mockImplementation(
      async () => new Response(JSON.stringify({ values: [["header"]] }), { status: 200 }),
    );
    const accessToken = vi.fn().mockImplementation(
      () => new Promise<string>((resolve) => setTimeout(() => resolve("token"), 5)),
    );
    const client = createGoogleSheetsClient({ spreadsheetId: "sheet-id", accessToken, fetchImpl });

    await Promise.all([
      client.readSheet("Settings"),
      client.readSheet("Machines"),
      client.readSheet("Bookings"),
    ]);

    expect(accessToken).toHaveBeenCalledTimes(1);
  });
});
