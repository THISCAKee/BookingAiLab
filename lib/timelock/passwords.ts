import { pbkdf2 as pbkdf2Callback, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2 = promisify(pbkdf2Callback);
export const DEFAULT_PASSWORD_ITERATIONS = 600_000;

export type PasswordVerifier = {
  algorithm: "pbkdf2-sha256";
  iterations: number;
  salt: string;
  hash: string;
};

export async function createPasswordVerifier(
  password: string,
  options: { iterations?: number; salt?: Buffer } = {},
): Promise<PasswordVerifier> {
  const iterations = options.iterations ?? DEFAULT_PASSWORD_ITERATIONS;
  const salt = options.salt ?? randomBytes(16);
  const hash = await pbkdf2(password, salt, iterations, 32, "sha256");

  return {
    algorithm: "pbkdf2-sha256",
    iterations,
    salt: salt.toString("base64"),
    hash: hash.toString("base64"),
  };
}

export async function verifyPassword(
  password: string,
  verifier: PasswordVerifier,
): Promise<boolean> {
  if (verifier.algorithm !== "pbkdf2-sha256" || verifier.iterations <= 0) return false;

  try {
    const expected = Buffer.from(verifier.hash, "base64");
    const actual = await pbkdf2(
      password,
      Buffer.from(verifier.salt, "base64"),
      verifier.iterations,
      expected.length,
      "sha256",
    );
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
