import { randomBytes } from "node:crypto";
import type { GoogleIdentity } from "@/lib/auth/google-claims";
import { createPasswordVerifier } from "@/lib/timelock/passwords";

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
  const timelockPassword = randomBytes(9).toString("base64url");
  const manageCode = randomBytes(6).toString("hex").toUpperCase();
  const passwordVerifier = await createPasswordVerifier(timelockPassword);
  const body = JSON.stringify({
    operation: "create_booking",
    secret: atomic.secret,
    idempotencyKey: input.idempotencyKey,
    payload: {
      machineId: input.machineId,
      manageCode,
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
      ...data,
      timelockUsername: identity.emailPrefix,
      timelockPassword,
    };
  }
  throw new Error("BOOKING_ATOMIC_FAILED");
}

export async function cancelSheetBooking(
  input: { bookingNumber: string; manageCode: string; idempotencyKey: string },
  identity: GoogleIdentity,
  options: AtomicOptions = {},
) {
  const atomic = atomicOptions(options);
  const response = await atomic.fetchImpl(atomic.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operation: "cancel_booking",
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
