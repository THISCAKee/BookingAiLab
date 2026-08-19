import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildOfflineAccount } from "@/lib/timelock/offline-cache";
import { verifyPassword, type PasswordVerifier } from "@/lib/timelock/passwords";
import type { DeviceRequest, TimelockLogoutStatus } from "@/lib/timelock/requests";
import { syncTimelockAccounts } from "@/lib/timelock/sheet-sync";

type DeviceContext = { id: string; machineCode: string };

export async function authenticateTimelockDevice(
  supabase: SupabaseClient,
  device: DeviceRequest,
): Promise<DeviceContext> {
  const tokenHash = createHash("sha256").update(device.deviceToken).digest("hex");
  const { data, error } = await supabase
    .from("machines")
    .select("id, machine_code")
    .eq("machine_code", device.machineCode)
    .eq("device_token_hash", tokenHash)
    .maybeSingle();
  if (error || !data) throw new Error("MACHINE_TOKEN_INVALID");
  return { id: data.id, machineCode: data.machine_code };
}

function verifierFromRow(row: Record<string, unknown>): PasswordVerifier {
  return {
    algorithm: row.password_algorithm as PasswordVerifier["algorithm"],
    iterations: Number(row.password_iterations),
    salt: String(row.password_salt),
    hash: String(row.password_hash),
  };
}

async function updateFailedLogin(supabase: SupabaseClient, accountId: string, current: { failed_count?: number; locked_until?: string | null } | null) {
  const lockExpired = current?.locked_until && new Date(current.locked_until).getTime() <= Date.now();
  const failedCount = (lockExpired ? 0 : Number(current?.failed_count ?? 0)) + 1;
  await supabase.from("timelock_login_locks").upsert({
    account_id: accountId,
    failed_count: Math.min(failedCount, 5),
    locked_until: failedCount >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
    last_failed_at: new Date().toISOString(),
  });
}

export async function loginTimelockUser(
  supabase: SupabaseClient,
  device: DeviceContext,
  input: { username: string; password: string },
) {
  const { data: account, error } = await supabase
    .from("timelock_accounts")
    .select("id, machine_id, username, is_active, allowed_minutes, password_algorithm, password_iterations, password_salt, password_hash")
    .eq("username", input.username)
    .maybeSingle();
  if (error || !account || account.machine_id !== device.id || !account.is_active) {
    throw new Error("CREDENTIALS_INVALID");
  }

  const { data: lock } = await supabase
    .from("timelock_login_locks")
    .select("failed_count, locked_until")
    .eq("account_id", account.id)
    .maybeSingle();
  if (lock?.locked_until && new Date(lock.locked_until).getTime() > Date.now()) {
    throw new Error("ACCOUNT_LOCKED");
  }

  if (!(await verifyPassword(input.password, verifierFromRow(account)))) {
    await updateFailedLogin(supabase, account.id, lock);
    throw new Error("CREDENTIALS_INVALID");
  }

  await supabase.from("timelock_login_locks").upsert({
    account_id: account.id, failed_count: 0, locked_until: null, last_failed_at: null,
  });
  const startedAt = new Date().toISOString();
  const { data: session, error: sessionError } = await supabase.rpc("start_timelock_session", {
    p_account_id: account.id,
    p_machine_id: device.id,
    p_client_session_id: randomUUID(),
    p_source: "online",
    p_started_at: startedAt,
  });
  if (sessionError) {
    if (sessionError.message.includes("ACCOUNT_ALREADY_ACTIVE")) throw new Error("ACCOUNT_ALREADY_ACTIVE");
    throw new Error("LOGIN_FAILED");
  }
  return session;
}

export async function syncTimelockDevice(supabase: SupabaseClient, device: DeviceContext) {
  try {
    await syncTimelockAccounts(supabase);
  } catch {
    // The last successful Supabase cache remains usable during a Sheet outage.
  }

  const { data, error } = await supabase
    .from("timelock_accounts")
    .select("id, username, allowed_minutes, is_active, password_algorithm, password_iterations, password_salt, password_hash")
    .eq("machine_id", device.id);
  if (error) throw error;
  const now = new Date();
  return (data ?? []).map((account) => buildOfflineAccount({
    id: account.id,
    username: account.username,
    allowedMinutes: account.allowed_minutes,
    isActive: account.is_active,
    passwordAlgorithm: account.password_algorithm,
    passwordIterations: account.password_iterations,
    passwordSalt: account.password_salt,
    passwordHash: account.password_hash,
  }, now));
}

export async function logoutTimelockUser(
  supabase: SupabaseClient,
  device: DeviceContext,
  input: { sessionId: string; usedSeconds: number; status: TimelockLogoutStatus },
) {
  const { data, error } = await supabase.rpc("end_timelock_session", {
    p_session_id: input.sessionId,
    p_machine_id: device.id,
    p_used_seconds: input.usedSeconds,
    p_status: input.status,
  });
  if (error) {
    if (error.message.includes("SESSION_NOT_FOUND")) throw new Error("SESSION_NOT_FOUND");
    throw new Error("LOGOUT_FAILED");
  }
  return data;
}

export async function reconcileOfflineSession(
  supabase: SupabaseClient,
  device: DeviceContext,
  input: { clientSessionId: string; username: string; startedAt: string; endedAt: string | null; usedSeconds: number; status: string },
) {
  const { data: existing } = await supabase.from("timelock_sessions").select("id, status").eq("client_session_id", input.clientSessionId).maybeSingle();
  if (existing) return { sessionId: existing.id, status: existing.status, duplicate: true };

  const { data: account } = await supabase.from("timelock_accounts").select("id, machine_id").eq("username", input.username).maybeSingle();
  if (!account || account.machine_id !== device.id) throw new Error("ACCOUNT_MACHINE_MISMATCH");
  const { data: started, error: startError } = await supabase.rpc("start_timelock_session", {
    p_account_id: account.id,
    p_machine_id: device.id,
    p_client_session_id: input.clientSessionId,
    p_source: "offline",
    p_started_at: input.startedAt,
  });
  if (startError) throw new Error(startError.message.includes("ACCOUNT_ALREADY_ACTIVE") ? "ACCOUNT_ALREADY_ACTIVE" : "OFFLINE_SESSION_FAILED");
  if (input.status === "active") return started;
  return logoutTimelockUser(supabase, device, {
    sessionId: String(started.sessionId), usedSeconds: input.usedSeconds, status: input.status as TimelockLogoutStatus,
  });
}
