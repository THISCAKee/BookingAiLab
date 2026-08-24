import { getGoogleSheetsAccessToken } from "@/lib/google/service-account";

export type SheetTab = "Settings" | "Machines" | "Bookings" | "Users" | "Identities" | "Events" | "AuditLog" | "LoginLocks";
type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type GoogleSheetsClientOptions = {
  spreadsheetId: string;
  accessToken?: () => Promise<string>;
  fetchImpl?: FetchImpl;
};

export function createGoogleSheetsClient(options: GoogleSheetsClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = options.accessToken ?? getGoogleSheetsAccessToken;
  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(options.spreadsheetId)}`;

  async function request(path: string, init?: RequestInit) {
    const token = await accessToken();
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    return response;
  }

  return {
    async readSheet(tab: SheetTab) {
      const range = encodeURIComponent(`${tab}!A1:Z`);
      const response = await request(`/values/${range}`);
      if (!response.ok) throw new Error("GOOGLE_SHEET_READ_FAILED");
      const data = (await response.json()) as { values?: unknown[][] };
      return (data.values ?? []).map((row) => row.map((value) => String(value ?? "")));
    },

    async appendSheetRow(tab: SheetTab, row: string[]) {
      const range = encodeURIComponent(`${tab}!A:Z`);
      const response = await request(`/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ majorDimension: "ROWS", values: [row] }),
      });
      if (!response.ok) throw new Error("GOOGLE_SHEET_WRITE_FAILED");
    },

    async updateSheetRow(tab: SheetTab, rowNumber: number, row: string[]) {
      const rangeText = `${tab}!A${rowNumber}:Z${rowNumber}`;
      const range = encodeURIComponent(rangeText);
      const response = await request(`/values/${range}?valueInputOption=RAW`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ range: rangeText, majorDimension: "ROWS", values: [row] }),
      });
      if (!response.ok) throw new Error("GOOGLE_SHEET_WRITE_FAILED");
    },
  };
}
