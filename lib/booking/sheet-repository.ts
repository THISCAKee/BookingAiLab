import type { GoogleIdentity } from "@/lib/auth/google-claims";

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type AtomicOptions = {
  url?: string;
  secret?: string;
  fetchImpl?: FetchImpl;
};

function atomicOptions(options: AtomicOptions) {
  const url = options.url ?? process.env.GOOGLE_ATOMIC_MUTATION_URL;
  const secret = options.secret ?? process.env.GOOGLE_ATOMIC_MUTATION_SECRET;
  if (!url || !secret) throw new Error("BOOKING_ATOMIC_NOT_CONFIGURED");
  return { url, secret, fetchImpl: options.fetchImpl ?? fetch };
}

export async function createSheetBooking(
  input: { machineId: string; startAt: string; endAt?: string; idempotencyKey: string },
  identity: GoogleIdentity,
  options: AtomicOptions = {},
) {
  const atomic = atomicOptions(options);
  const response = await atomic.fetchImpl(atomic.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operation: "create_booking",
      secret: atomic.secret,
      idempotencyKey: input.idempotencyKey,
      payload: {
        machineId: input.machineId,
        startAt: input.startAt,
        endAt: input.endAt,
        email: identity.email,
        name: identity.name,
        hd: identity.hd,
        emailPrefix: identity.emailPrefix,
      },
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("BOOKING_ATOMIC_FAILED");
  const result = (await response.json()) as { ok?: boolean; data?: unknown; code?: string };
  if (!result.ok || result.data === undefined) throw new Error(result.code || "BOOKING_ATOMIC_FAILED");
  return result.data;
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
