import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { GoogleIdentity } from "@/lib/auth/google-claims";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const ALGORITHM = "aes-256-gcm";

type SessionPayload = GoogleIdentity & { exp: number };

function keyFromSecret(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function secretFromEnvironment(secret?: string) {
  const value = secret ?? process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET_MISSING");
  return value;
}

export async function createSessionCookie(
  identity: GoogleIdentity,
  now = new Date(),
  secret?: string,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyFromSecret(secretFromEnvironment(secret)), iv);
  const payload: SessionPayload = { ...identity, exp: now.getTime() + SESSION_TTL_MS };
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export async function readSessionCookie(
  value: string | undefined,
  now = new Date(),
  secret?: string,
): Promise<GoogleIdentity | null> {
  if (!value) return null;

  try {
    const [version, ivText, tagText, ciphertextText] = value.split(".");
    if (version !== "v1" || !ivText || !tagText || !ciphertextText) return null;

    const decipher = createDecipheriv(
      ALGORITHM,
      keyFromSecret(secretFromEnvironment(secret)),
      Buffer.from(ivText, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const payload = JSON.parse(plaintext) as SessionPayload;
    if (!Number.isFinite(payload.exp) || payload.exp <= now.getTime()) return null;

    const { exp: _exp, ...identity } = payload;
    if (
      typeof identity.email !== "string" ||
      typeof identity.name !== "string" ||
      identity.hd !== "msu.ac.th" ||
      typeof identity.emailPrefix !== "string"
    ) {
      return null;
    }
    return identity;
  } catch {
    return null;
  }
}
