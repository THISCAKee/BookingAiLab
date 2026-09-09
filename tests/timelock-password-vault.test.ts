import { describe, expect, it } from "vitest";
import { decryptTimelockPassword, encryptTimelockPassword } from "@/lib/timelock/password-vault";

describe("TimeLock password vault", () => {
  it("round-trips a password without storing it as plaintext", () => {
    const ciphertext = encryptTimelockPassword("secret-password", "vault-secret");

    expect(ciphertext).not.toContain("secret-password");
    expect(decryptTimelockPassword(ciphertext, "vault-secret")).toBe("secret-password");
  });

  it("rejects a ciphertext when the vault key is wrong", () => {
    const ciphertext = encryptTimelockPassword("secret-password", "vault-secret");

    expect(() => decryptTimelockPassword(ciphertext, "wrong-secret")).toThrow("PASSWORD_DECRYPT_FAILED");
  });
});
