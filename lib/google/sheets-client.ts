import { getGoogleSheetsAccessToken } from "@/lib/google/service-account";

export type SheetTab = "Settings" | "Machines" | "Bookings" | "Users" | "Identities" | "Events" | "AuditLog" | "LoginLocks";
type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type SheetReadOptions = { maxAgeMs?: number };

// Polled read-only views share recent reads so concurrent viewers stay under the Sheets read quota.
export const SHARED_READ_MAX_AGE_MS = 10_000;
const sharedReads = new Map<string, { at: number; rows: Promise<string[][]> }>();

export function clearSheetReadCache() {
  sharedReads.clear();
}

// Last outcome of a real Sheets read in this server instance, surfaced on the admin dashboard.
export type SheetReadHealth = { lastSuccessAt: string | null; lastError: string | null };
const readHealth: SheetReadHealth = { lastSuccessAt: null, lastError: null };

export function getSheetReadHealth(): SheetReadHealth {
  return { ...readHealth };
}

type GoogleSheetsClientOptions = {
  spreadsheetId: string;
  accessToken?: () => Promise<string>;
  fetchImpl?: FetchImpl;
};

export function createGoogleSheetsClient(options: GoogleSheetsClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = options.accessToken ?? getGoogleSheetsAccessToken;
  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(options.spreadsheetId)}`;
  let accessTokenPromise: Promise<string> | null = null;

  async function getAccessToken() {
    if (!accessTokenPromise) {
      accessTokenPromise = accessToken().catch((error) => {
        accessTokenPromise = null;
        throw error;
      });
    }
    return accessTokenPromise;
  }

  async function request(path: string, init?: RequestInit) {
    const token = await getAccessToken();
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

  async function fetchSheet(tab: SheetTab) {
    const range = encodeURIComponent(`${tab}!A1:Z`);
    const response = await request(`/values/${range}`);
    if (!response.ok) {
      console.error(`Google Sheets read ${tab} failed: ${response.status} ${await response.text().catch(() => "")}`);
      readHealth.lastError = `GOOGLE_SHEET_READ_FAILED:${tab}:${response.status}`;
      throw new Error("GOOGLE_SHEET_READ_FAILED");
    }
    const data = (await response.json()) as { values?: unknown[][] };
    readHealth.lastSuccessAt = new Date().toISOString();
    readHealth.lastError = null;
    return (data.values ?? []).map((row) => row.map((value) => String(value ?? "")));
  }

  function forgetTab(tab: SheetTab) {
    sharedReads.delete(`${options.spreadsheetId}:${tab}`);
  }

  return {
    async readSheet(tab: SheetTab, readOptions: SheetReadOptions = {}) {
      const maxAgeMs = readOptions.maxAgeMs ?? 0;
      if (maxAgeMs <= 0) return fetchSheet(tab);
      const key = `${options.spreadsheetId}:${tab}`;
      const cached = sharedReads.get(key);
      if (cached && Date.now() - cached.at < maxAgeMs) return cached.rows;
      const rows = fetchSheet(tab);
      const entry = { at: Date.now(), rows };
      sharedReads.set(key, entry);
      rows.catch(() => { if (sharedReads.get(key) === entry) sharedReads.delete(key); });
      return rows;
    },

    async appendSheetRow(tab: SheetTab, row: string[]) {
      const range = encodeURIComponent(`${tab}!A:Z`);
      const response = await request(`/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ majorDimension: "ROWS", values: [row] }),
      });
      forgetTab(tab);
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
      forgetTab(tab);
      if (!response.ok) throw new Error("GOOGLE_SHEET_WRITE_FAILED");
    },
  };
}
