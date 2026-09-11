import { randomInt } from "node:crypto";
import type { GoogleIdentity } from "@/lib/auth/google-claims";
import { createPasswordVerifier } from "@/lib/timelock/passwords";
import { encryptTimelockPassword } from "@/lib/timelock/password-vault";

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type AtomicOptions = {
  url?: string;
  secret?: string;
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
};

const DEFAULT_ATOMIC_TIMEOUT_MS = 15_000;

function atomicOptions(options: AtomicOptions) {
  const url = options.url ?? process.env.GOOGLE_ATOMIC_MUTATION_URL;
  const secret = options.secret ?? process.env.GOOGLE_ATOMIC_MUTATION_SECRET;
  if (!url || !secret) throw new Error("BOOKING_ATOMIC_NOT_CONFIGURED");
  return {
    url,
    secret,
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? DEFAULT_ATOMIC_TIMEOUT_MS,
  };
}

export async function createSheetBooking(
  input: { machineId: string; idempotencyKey: string },
  identity: GoogleIdentity,
  options: AtomicOptions = {},
) {
  const atomic = atomicOptions(options);
  const timelockPassword = randomInt(0, 10_000).toString().padStart(4, "0");
  const passwordVerifier = await createPasswordVerifier(timelockPassword);
  const body = JSON.stringify({
    operation: "create_booking",
    secret: atomic.secret,
    idempotencyKey: input.idempotencyKey,
    payload: {
      machineId: input.machineId,
      email: identity.email,
      name: identity.name,
      hd: identity.hd,
      emailPrefix: identity.emailPrefix,
      account: {
        username: identity.emailPrefix,
        passwordAlgorithm: passwordVerifier.algorithm,
        passwordIterations: passwordVerifier.iterations,
        passwordSalt: passwordVerifier.salt,
        passwordHash: passwordVerifier.hash,
        passwordCiphertext: encryptTimelockPassword(timelockPassword, process.env.TIMELOCK_PASSWORD_ENCRYPTION_KEY ?? atomic.secret),
        allowedMinutes: 180,
      },
    },
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), atomic.timeoutMs);
    let response: Response;
    try {
      response = await atomic.fetchImpl(atomic.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        if (attempt === 0) continue;
        throw new Error("BOOKING_ATOMIC_TIMEOUT");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) throw new Error("BOOKING_ATOMIC_FAILED");
    const result = (await response.json()) as { ok?: boolean; data?: unknown; code?: string };
    if (!result.ok || result.data === undefined) {
      if (result.code === "BOOKING_ATOMIC_BUSY" && attempt === 0) continue;
      throw new Error(result.code || "BOOKING_ATOMIC_FAILED");
    }
    const data = result.data as Record<string, unknown>;
    if (typeof data.startAt !== "string" || !data.startAt || typeof data.endAt !== "string" || !data.endAt) {
      throw new Error("BOOKING_ATOMIC_FAILED");
    }
    return {
      bookingId: data.bookingId,
      bookingNumber: data.bookingNumber,
      machineCode: data.machineCode,
      startAt: data.startAt,
      endAt: data.endAt,
      status: data.status,
      timelockUsername: identity.emailPrefix,
      timelockPassword,
    };
  }
  throw new Error("BOOKING_ATOMIC_FAILED");
}

export async function cancelSheetBookingByOwner(
  input: { bookingId: string; idempotencyKey: string },
  identity: GoogleIdentity,
  options: AtomicOptions = {},
) {
  const atomic = atomicOptions(options);
  const response = await atomic.fetchImpl(atomic.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operation: "cancel_booking_by_owner",
      secret: atomic.secret,
      idempotencyKey: input.idempotencyKey,
      payload: { ...input, email: identity.email, hd: identity.hd, emailPrefix: identity.emailPrefix },
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("BOOKING_ATOMIC_FAILED");
  const result = (await response.json()) as { ok?: boolean; code?: string };
  if (!result.ok) throw new Error(result.code || "BOOKING_ATOMIC_FAILED");
}
