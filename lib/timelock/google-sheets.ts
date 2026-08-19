import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

async function getGoogleAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !privateKey) throw new Error("GOOGLE_SHEETS_NOT_CONFIGURED");

  const now = Math.floor(Date.now() / 1_000);
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({
    iss: email,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3_600,
  }))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(privateKey, "base64url")}`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("GOOGLE_TOKEN_FAILED");
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("GOOGLE_TOKEN_FAILED");
  return data.access_token;
}

function sheetId() {
  const value = process.env.GOOGLE_SHEET_ID;
  if (!value) throw new Error("GOOGLE_SHEETS_NOT_CONFIGURED");
  return value;
}

export async function readTimelockSheet() {
  const token = await getGoogleAccessToken();
  const range = encodeURIComponent("Users!A1:G");
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId()}/values/${range}`,
    { headers: { authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!response.ok) throw new Error("GOOGLE_SHEET_READ_FAILED");
  const data = (await response.json()) as { values?: unknown[][] };
  return (data.values ?? []).map((row) => row.map((value) => String(value ?? "")));
}

export async function writeTimelockActiveState(sourceRow: number, isActive: boolean) {
  const token = await getGoogleAccessToken();
  const rangeText = `Users!F${sourceRow}`;
  const range = encodeURIComponent(rangeText);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId()}/values/${range}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ range: rangeText, majorDimension: "ROWS", values: [[isActive]] }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("GOOGLE_SHEET_WRITE_FAILED");
}
