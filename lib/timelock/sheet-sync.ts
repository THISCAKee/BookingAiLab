import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseGoogleSheetAccounts } from "@/lib/timelock/accounts";
import { readTimelockSheet, writeTimelockActiveState } from "@/lib/timelock/google-sheets";
import { createPasswordVerifier } from "@/lib/timelock/passwords";

const SYNC_INTERVAL_MS = 60_000;

function fingerprint(account: { sheetUserId: string; username: string; password: string }) {
  const key = process.env.TIMELOCK_PASSWORD_FINGERPRINT_KEY;
  if (!key) throw new Error("TIMELOCK_FINGERPRINT_NOT_CONFIGURED");
  return createHmac("sha256", key)
    .update(`${account.sheetUserId}\0${account.username}\0${account.password}`)
    .digest("hex");
}

export async function flushSheetOutbox(supabase: SupabaseClient) {
  const { data: pending, error } = await supabase
    .from("timelock_sheet_outbox")
    .select("id, source_row, desired_active, attempt_count")
    .in("status", ["pending", "processing"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(25);
  if (error) throw error;

  for (const item of pending ?? []) {
    await supabase.from("timelock_sheet_outbox").update({ status: "processing" }).eq("id", item.id);
    try {
      await writeTimelockActiveState(item.source_row, item.desired_active);
      await supabase.from("timelock_sheet_outbox").update({
        status: "completed", processed_at: new Date().toISOString(), last_error: null,
      }).eq("id", item.id);
    } catch (error) {
      const attempts = Number(item.attempt_count) + 1;
      const delayMinutes = Math.min(60, 2 ** Math.min(attempts, 6));
      await supabase.from("timelock_sheet_outbox").update({
        status: "pending",
        attempt_count: attempts,
        next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        last_error: error instanceof Error ? error.message : "GOOGLE_SHEET_WRITE_FAILED",
      }).eq("id", item.id);
    }
  }
}

export async function syncTimelockAccounts(supabase: SupabaseClient, force = false) {
  const now = new Date();
  const { data: syncState } = await supabase
    .from("timelock_sync_state")
    .select("last_attempt_at")
    .eq("singleton", true)
    .maybeSingle();
  if (!force && syncState?.last_attempt_at && now.getTime() - new Date(syncState.last_attempt_at).getTime() < SYNC_INTERVAL_MS) {
    return { skipped: true };
  }

  await supabase.from("timelock_sync_state").update({ last_attempt_at: now.toISOString() }).eq("singleton", true);

  try {
    const accounts = parseGoogleSheetAccounts(await readTimelockSheet());
    const [{ data: machines, error: machineError }, { data: current, error: accountError }, { data: pending }] = await Promise.all([
      supabase.from("machines").select("id, machine_code"),
      supabase.from("timelock_accounts").select("id, sheet_user_id, password_fingerprint, password_algorithm, password_iterations, password_salt, password_hash"),
      supabase.from("timelock_sheet_outbox").select("account_id, desired_active").neq("status", "completed"),
    ]);
    if (machineError) throw machineError;
    if (accountError) throw accountError;

    const machineByCode = new Map((machines ?? []).map((machine) => [machine.machine_code, machine.id]));
    const currentBySheetId = new Map((current ?? []).map((account) => [account.sheet_user_id, account]));
    const pendingByAccount = new Map((pending ?? []).map((item) => [item.account_id, item.desired_active]));
    const seenIds: string[] = [];

    for (const account of accounts) {
      const machineId = machineByCode.get(account.machineCode);
      if (!machineId) throw new Error(`SHEET_MACHINE_NOT_FOUND:${account.sourceRow}`);
      const existing = currentBySheetId.get(account.sheetUserId);
      const passwordFingerprint = fingerprint(account);
      const verifier = existing?.password_fingerprint === passwordFingerprint
        ? {
            algorithm: existing.password_algorithm,
            iterations: existing.password_iterations,
            salt: existing.password_salt,
            hash: existing.password_hash,
          }
        : await createPasswordVerifier(account.password);

      const isActive = existing && pendingByAccount.has(existing.id)
        ? Boolean(pendingByAccount.get(existing.id))
        : account.isActive;
      const { error } = await supabase.from("timelock_accounts").upsert({
        sheet_user_id: account.sheetUserId,
        username: account.username,
        machine_id: machineId,
        password_algorithm: verifier.algorithm,
        password_iterations: verifier.iterations,
        password_salt: verifier.salt,
        password_hash: verifier.hash,
        password_fingerprint: passwordFingerprint,
        allowed_minutes: account.allowedMinutes,
        is_active: isActive,
        source_row: account.sourceRow,
        last_synced_at: now.toISOString(),
      }, { onConflict: "sheet_user_id" });
      if (error) throw error;
      seenIds.push(account.sheetUserId);
    }

    if (seenIds.length > 0) {
      await supabase.from("timelock_accounts").update({ is_active: false }).not("sheet_user_id", "in", `(${seenIds.map((id) => `"${id.replaceAll('"', '\\"')}"`).join(",")})`);
    } else {
      await supabase.from("timelock_accounts").update({ is_active: false }).neq("is_active", false);
    }

    await flushSheetOutbox(supabase);
    const { count } = await supabase.from("timelock_sheet_outbox").select("id", { count: "exact", head: true }).neq("status", "completed");
    await supabase.from("timelock_sync_state").update({
      last_success_at: now.toISOString(), last_error: null, synced_row_count: accounts.length, pending_outbox_count: count ?? 0,
    }).eq("singleton", true);
    return { skipped: false, count: accounts.length };
  } catch (error) {
    await supabase.from("timelock_sync_state").update({
      last_error: error instanceof Error ? error.message : "SHEET_SYNC_FAILED",
    }).eq("singleton", true);
    throw error;
  }
}
