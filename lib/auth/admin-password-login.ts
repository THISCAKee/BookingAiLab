import { timingSafeEqual } from "node:crypto";
import type { GoogleIdentity } from "@/lib/auth/google-claims";

export type AdminCredentials = {
  username: string;
  password: string;
};

export function verifyAdminCredentials(
  username: unknown,
  password: unknown,
  configured: AdminCredentials,
) {
  if (typeof username !== "string" || typeof password !== "string") return false;

  const submittedUsername = Buffer.from(username.trim().toLowerCase());
  const expectedUsername = Buffer.from(configured.username.trim().toLowerCase());
  const submittedPassword = Buffer.from(password);
  const expectedPassword = Buffer.from(configured.password);

  return secureEqual(submittedUsername, expectedUsername) && secureEqual(submittedPassword, expectedPassword);
}

function secureEqual(left: Buffer, right: Buffer) {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createAdminIdentity(input: { email: string; name: string }): GoogleIdentity {
  const email = input.email.trim().toLowerCase();
  const emailPrefix = email.split("@")[0];
  return { email, name: input.name.trim(), hd: "msu.ac.th", emailPrefix };
}

export function adminCredentialsFromEnvironment(env: NodeJS.ProcessEnv = process.env) {
  return {
    username: env.ADMIN_USERNAME?.trim() || "admin",
    password: env.ADMIN_PASSWORD || "",
    email: env.ADMIN_EMAIL?.trim().toLowerCase() || "admin@msu.ac.th",
    name: env.ADMIN_NAME?.trim() || "Administrator",
  };
}
