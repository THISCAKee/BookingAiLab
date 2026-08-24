import type { GoogleIdentity } from "@/lib/auth/google-claims";
import { createAuthenticatedSessionResponse } from "@/lib/auth/session-response";

type CompleteLoginDependencies = {
  upsertIdentity(identity: GoogleIdentity): Promise<void>;
  createSession(identity: GoogleIdentity): Promise<string>;
};

export async function completeGoogleLogin(
  identity: GoogleIdentity,
  requestUrl: URL,
  dependencies: CompleteLoginDependencies,
) {
  await dependencies.upsertIdentity(identity);
  const session = await dependencies.createSession(identity);
  return createAuthenticatedSessionResponse(requestUrl, session);
}
