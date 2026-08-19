import type { PasswordVerifier } from "@/lib/timelock/passwords";

const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

export type OfflineAccountSource = {
  id: string;
  username: string;
  allowedMinutes: number;
  isActive: boolean;
  passwordAlgorithm: PasswordVerifier["algorithm"];
  passwordIterations: number;
  passwordSalt: string;
  passwordHash: string;
};

export function buildOfflineAccount(account: OfflineAccountSource, now = new Date()) {
  return {
    id: account.id,
    username: account.username,
    allowedMinutes: account.allowedMinutes,
    isActive: account.isActive,
    verifier: {
      algorithm: account.passwordAlgorithm,
      iterations: account.passwordIterations,
      salt: account.passwordSalt,
      hash: account.passwordHash,
    } satisfies PasswordVerifier,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
  };
}
