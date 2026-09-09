import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function keyFromSecret(secret?: string) {
  const value = secret ?? process.env.TIMELOCK_PASSWORD_ENCRYPTION_KEY ?? process.env.GOOGLE_ATOMIC_MUTATION_SECRET;
  if (!value) throw new Error("TIMELOCK_PASSWORD_ENCRYPTION_KEY_MISSING");
  return createHash("sha256").update(value).digest();
}

export function encryptTimelockPassword(password: string, secret?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyFromSecret(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptTimelockPassword(value: string, secret?: string) {
  try {
    const [version, ivText, tagText, ciphertextText] = value.split(".");
    if (version !== "v1" || !ivText || !tagText || !ciphertextText) throw new Error("INVALID");
    const decipher = createDecipheriv(ALGORITHM, keyFromSecret(secret), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("PASSWORD_DECRYPT_FAILED");
  }
}
