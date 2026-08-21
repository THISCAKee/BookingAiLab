# Google Sheets–First Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Supabase from the runtime and make direct Google OAuth plus private Google Sheets the complete authentication and booking backend.

**Architecture:** Next.js route handlers perform Google OAuth code flow, verify Google ID-token claims, and issue an encrypted HttpOnly session cookie. Server actions and TimeLock route handlers use a focused Google Sheets repository; Apps Script with `LockService` owns atomic booking mutations so concurrent requests cannot create overlapping rows.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Web Crypto/Node `crypto`, Google OAuth 2.0, Google Sheets API v4, Google Apps Script.

**Spec:** `docs/superpowers/specs/2026-08-21-google-sheets-architecture-design.md`

## Global Constraints

- Google Sheets is the source of truth for users, machines, schedules, settings, bookings, TimeLock accounts, events, and audit history.
- No Supabase Auth, Supabase database, Supabase RPC, Supabase middleware client, or Supabase service key.
- Require verified Google email, normalized `@msu.ac.th` email, and exact `hd === "msu.ac.th"` on every authenticated server operation.
- Derive `emailPrefix` from the verified session email; never accept identity fields from browser form data.
- Keep the spreadsheet private and expose no Google credentials to browser or TimeLockApp.
- All writes that can race use idempotency keys and Apps Script locking; fail closed if the atomic mutation service is unavailable.
- Do not log passwords, device tokens, OAuth tokens, session secrets, or management codes.
- Use `cache: "no-store"` for Sheet reads and revalidate affected pages after mutations.

---

## File map

Create focused modules under `lib/google/` for OAuth/session and Sheets transport, `lib/booking/` for Sheet-backed booking rules, and `lib/timelock/` for Sheet-backed device/account operations. Replace `lib/supabase/`, existing Supabase auth calls, and Supabase imports in route handlers only after equivalent tests pass. Keep old SQL migrations as historical files unless explicitly removed later.

## Task 1: Establish Google-only configuration and test seams

**Files:**
- Modify: `.env.example`
- Modify: `package.json`, `package-lock.json`
- Modify: `vitest.config.ts`
- Create: `lib/google/config.ts`
- Test: `tests/google-config.test.ts`

**Interfaces:**
- Produces `GoogleRuntimeConfig` and `getGoogleRuntimeConfig(): GoogleRuntimeConfig`.
- `GoogleRuntimeConfig` contains `clientId`, `clientSecret`, `redirectUri`, `sessionSecret`, `serviceAccountEmail`, `serviceAccountPrivateKey`, `spreadsheetId`, and optional `atomicMutationUrl`/`atomicMutationSecret`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { getGoogleRuntimeConfig } from "@/lib/google/config";

describe("getGoogleRuntimeConfig", () => {
  it("rejects when a required Google-only secret is absent", () => {
    expect(() => getGoogleRuntimeConfig({ GOOGLE_OAUTH_CLIENT_ID: "id" })).toThrow("GOOGLE_CONFIG_MISSING");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/google-config.test.ts`

Expected: FAIL because `@/lib/google/config` does not exist.

- [ ] **Step 3: Implement the minimal config reader**

Use an explicit `Record<string, string | undefined>` parameter for tests, defaulting to `process.env`. Reject missing required values with `GOOGLE_CONFIG_MISSING`; normalize escaped private-key newlines with `.replace(/\\n/g, "\\n")`.

- [ ] **Step 4: Update environment documentation and test setup**

Replace Supabase variables in `.env.example` with Google OAuth, session, Sheets service-account, spreadsheet, and Apps Script variables. Add a test-only environment helper in `vitest.config.ts` without embedding a real secret.

- [ ] **Step 5: Run focused and baseline tests**

Run: `npm test -- tests/google-config.test.ts tests/smoke.test.ts`

Expected: PASS for the new test and unchanged baseline tests.

- [ ] **Step 6: Commit**

```bash
git add .env.example package.json package-lock.json vitest.config.ts lib/google/config.ts tests/google-config.test.ts
git commit -m "feat: add Google-only runtime configuration"
```

## Task 2: Implement OAuth claim validation and encrypted session cookies

**Files:**
- Create: `lib/auth/google-claims.ts`
- Create: `lib/auth/session.ts`
- Create: `app/api/auth/google/route.ts`
- Create: `app/api/auth/google/callback/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Modify: `app/login/login-button.tsx`, `app/login/page.tsx`
- Test: `tests/auth-google-claims.test.ts`, `tests/auth-session.test.ts`

**Interfaces:**
- Produces `validateGoogleClaims(input: unknown): GoogleIdentity`.
- `GoogleIdentity` is `{ email: string; name: string; hd: "msu.ac.th"; emailPrefix: string }`.
- Produces `createSessionCookie(identity: GoogleIdentity, now?: Date): Promise<string>` and `readSessionCookie(value: string | undefined, now?: Date): Promise<GoogleIdentity | null>`.
- OAuth callback consumes Google authorization code and produces a redirect with the session cookie.

- [ ] **Step 1: Write failing claim-validation tests**

```ts
it("requires both the MSU email suffix and exact hosted domain", () => {
  expect(() => validateGoogleClaims({ email: "a@msu.ac.th", email_verified: true, hd: "gmail.com", name: "A" })).toThrow("AUTH_DOMAIN_NOT_ALLOWED");
  expect(validateGoogleClaims({ email: "A@MSU.AC.TH", email_verified: true, hd: "msu.ac.th", name: "A" })).toMatchObject({ email: "a@msu.ac.th", emailPrefix: "a", hd: "msu.ac.th" });
});
```

- [ ] **Step 2: Run tests and verify the expected failure**

Run: `npm test -- tests/auth-google-claims.test.ts`

Expected: FAIL because the validator does not exist.

- [ ] **Step 3: Implement claim validation**

Accept only verified Google claims, trim/lowercase email, require exact `hd`, derive the local part before `@`, and use `name` then `given_name + family_name` then email prefix as the display-name fallback.

- [ ] **Step 4: Write failing session round-trip tests**

```ts
it("round-trips identity and rejects tampered or expired cookies", async () => {
  const cookie = await createSessionCookie(identity, now);
  expect(await readSessionCookie(cookie, now)).toEqual(identity);
  expect(await readSessionCookie(`${cookie}x`, now)).toBeNull();
  expect(await readSessionCookie(cookie, new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000))).toBeNull();
});
```

- [ ] **Step 5: Implement session signing/encryption and OAuth handlers**

Use a server-only session secret and an authenticated/encrypted payload. Store OAuth state and PKCE verifier in short-lived HttpOnly cookies. Verify the ID token signature, issuer, audience, and expiry using Google JWKS before calling `validateGoogleClaims`; do not trust decoded JWT payloads alone.

- [ ] **Step 6: Replace login UI and remove Supabase auth calls**

Make the login button navigate to `/api/auth/google`, update error messages for Google-only auth, and add logout to clear the local session cookie.

- [ ] **Step 7: Run tests**

Run: `npm test -- tests/auth-google-claims.test.ts tests/auth-session.test.ts tests/auth-logout.test.ts`

Expected: PASS with no Supabase import in the changed auth path.

- [ ] **Step 8: Commit**

```bash
git add lib/auth app/api/auth app/login tests/auth-google-claims.test.ts tests/auth-session.test.ts tests/auth-logout.test.ts
git commit -m "feat: replace Supabase auth with Google OAuth sessions"
```

## Task 3: Build the private Google Sheets transport and parsers

**Files:**
- Create: `lib/google/service-account.ts`
- Create: `lib/google/sheets-client.ts`
- Create: `lib/google/sheet-schema.ts`
- Create: `lib/google/sheet-types.ts`
- Modify: `lib/timelock/google-sheets.ts`
- Test: `tests/google-sheets-client.test.ts`, `tests/google-sheet-schema.test.ts`

**Interfaces:**
- Produces `readSheet(tab: SheetTab): Promise<string[][]>`, `appendSheetRow(tab: SheetTab, row: string[]): Promise<void>`, `updateSheetRow(tab: SheetTab, rowNumber: number, row: string[]): Promise<void>`.
- Produces typed parsers `parseSettings`, `parseMachines`, `parseBookings`, and `parseUsers` that reject invalid headers/rows with stable error codes.
- Uses injectable `fetch` for tests and service-account JWT access tokens in production.

- [ ] **Step 1: Write failing parser tests**

Cover exact headers, missing headers, invalid status, invalid dates, duplicate machine IDs, and the `emailPrefix`/`hd` fields on booking and user rows.

- [ ] **Step 2: Run parser tests to verify RED**

Run: `npm test -- tests/google-sheet-schema.test.ts`

Expected: FAIL because the typed schema modules do not exist.

- [ ] **Step 3: Implement row types and strict parsers**

Use stable header arrays matching the approved spec. Preserve 1-based source row numbers in parsing errors. Never coerce malformed booleans, timestamps, or statuses silently.

- [ ] **Step 4: Write failing Sheets transport tests**

Assert that service-account token requests, URL encoding, `GET` reads, `POST` appends, and `PUT` updates use the configured spreadsheet ID and never expose private-key material in thrown errors.

- [ ] **Step 5: Implement transport**

Move existing JWT token code into `lib/google/service-account.ts`; make the Sheets client return stable `GOOGLE_SHEET_READ_FAILED`/`GOOGLE_SHEET_WRITE_FAILED` errors and use `cache: "no-store"`.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- tests/google-sheets-client.test.ts tests/google-sheet-schema.test.ts tests/timelock-status.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/google lib/timelock/google-sheets.ts tests/google-sheets-client.test.ts tests/google-sheet-schema.test.ts
git commit -m "feat: add typed private Google Sheets repository"
```

## Task 4: Add atomic Apps Script booking mutations and booking rules

**Files:**
- Create: `scripts/google-apps-script/Code.gs`
- Create: `lib/booking/sheet-repository.ts`
- Create: `lib/booking/sheet-policy.ts`
- Modify: `lib/booking/policy.ts`, `lib/booking/schedule.ts`, `lib/booking/settings.ts`
- Test: `tests/booking-sheet-policy.test.ts`, `tests/booking-sheet-repository.test.ts`

**Interfaces:**
- Produces `getBookingOptions(date: string): Promise<PublicBookingOptions>`.
- Produces `createSheetBooking(input: { machineId: string; startAt: string; idempotencyKey: string }, identity: GoogleIdentity): Promise<CreatedBooking>`.
- Produces `cancelSheetBooking(bookingNumber: string, manageCode: string, identity: GoogleIdentity): Promise<void>`.
- Apps Script accepts `{ operation, payload, idempotencyKey, secret }` and returns `{ ok, data?, code? }`.

- [ ] **Step 1: Write failing overlap and identity tests**

Test that a machine overlap, same-user overlap, closed day, outside opening hours, wrong owner, wrong hosted domain, and repeated idempotency key are rejected; cancelled/expired rows do not block a slot.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/booking-sheet-policy.test.ts tests/booking-sheet-repository.test.ts`

Expected: FAIL because the Sheet booking modules do not exist.

- [ ] **Step 3: Implement pure booking policy**

Reuse existing schedule calculations where compatible, but feed them parsed Sheet settings/machines/bookings. Return stable codes such as `BOOKING_MACHINE_OVERLAP`, `BOOKING_CUSTOMER_OVERLAP`, `BOOKING_OUTSIDE_SCHEDULE`, and `BOOKING_NOT_FOUND`.

- [ ] **Step 4: Implement Apps Script atomic operations**

Use `LockService.getScriptLock().tryLock(10000)`, re-read all relevant rows while locked, validate overlap and idempotency, append/update the row, and release the lock in `finally`. Reject calls without the shared secret and return JSON only.

- [ ] **Step 5: Implement Next.js mutation adapter**

Call the configured Apps Script endpoint with timeout and no-store fetch. Map non-OK responses to user-safe messages and never fall back to direct append for booking mutations.

- [ ] **Step 6: Run tests**

Run: `npm test -- tests/booking-sheet-policy.test.ts tests/booking-sheet-repository.test.ts tests/booking-policy.test.ts tests/scheduled-booking.test.ts`

Expected: new Sheet tests pass; old tests may remain until callers are migrated in Task 5.

- [ ] **Step 7: Commit**

```bash
git add scripts/google-apps-script lib/booking tests/booking-sheet-policy.test.ts tests/booking-sheet-repository.test.ts
git commit -m "feat: add atomic Google Sheets booking mutations"
```

## Task 5: Migrate booking pages, actions, admin, and settings off Supabase

**Files:**
- Modify: `lib/booking/actions.ts`, `lib/booking/queries.ts`, `app/booking/actions.ts`, `app/booking/page.tsx`
- Modify: `app/my-bookings/page.tsx`, `app/my-bookings/actions.ts`
- Modify: `app/admin/**/*.tsx`, `app/admin/**/actions.ts`, `components/admin/*.tsx`
- Modify: `lib/auth/profile.ts`, `lib/auth/admin.ts`, `middleware.ts`
- Test: existing booking/admin tests plus `tests/booking-authentication.test.ts`

**Interfaces:**
- All page loaders call `requireGoogleIdentity()` and Sheet repository functions.
- `createScheduledBooking` derives identity from the session and calls `createSheetBooking`.
- Admin actions call Sheet CRUD functions after `requireAdminIdentity()`.

- [ ] **Step 1: Write failing auth-boundary tests**

Assert that a booking action ignores an email/name supplied in `FormData`, rejects no session/wrong domain/missing `hd`, and stores the verified session identity fields.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/booking-authentication.test.ts`

Expected: FAIL because actions still use Supabase and do not call the new identity boundary.

- [ ] **Step 3: Replace booking queries/actions**

Load machines/settings/bookings from Sheets, pass only IDs and times from the form, derive `email`, `name`, `hd`, and `emailPrefix` from `requireGoogleIdentity()`, and preserve the existing UI result types.

- [ ] **Step 4: Replace admin queries/actions**

Read/update Machines, Settings, Bookings, Users, and AuditLog through the repository. Enforce an allow-listed admin identity or Sheet role on every action, including direct POSTs.

- [ ] **Step 5: Update middleware and pages**

Use the local session cookie for protected-route redirects. Keep `/booking` authenticated; redirect unauthenticated users to `/login`; do not allow middleware alone to be the only authorization check.

- [ ] **Step 6: Run migrated test suites**

Run: `npm test -- tests/booking-authentication.test.ts tests/booking-actions.test.ts tests/booking-settings.test.ts tests/admin-dashboard-view.test.ts tests/admin-machine.test.ts tests/public-booking-nav.test.tsx`

Expected: PASS with no runtime Supabase dependency in booking/admin paths.

- [ ] **Step 7: Commit**

```bash
git add lib/booking app/booking app/my-bookings app/admin components/admin lib/auth/profile.ts lib/auth/admin.ts middleware.ts tests
git commit -m "feat: migrate booking and admin flows to Google Sheets"
```

## Task 6: Migrate TimeLock gateway and API to Google Sheets

**Files:**
- Modify: `lib/timelock/accounts.ts`, `lib/timelock/sheet-sync.ts`, `lib/timelock/requests.ts`, `lib/timelock/gateway.ts`
- Modify: `app/api/timelock/**/*.ts`, `app/api/machines/**/*.ts`
- Create: `lib/timelock/sheet-gateway.ts`
- Test: `tests/timelock-sheet-gateway.test.ts`, existing `tests/timelock-*.test.ts`

**Interfaces:**
- Produces `authenticateTimelockDevice(device: DeviceRequest): Promise<DeviceContext>` without a Supabase argument.
- Produces `loginTimelockUser(device: DeviceContext, input): Promise<TimelockSession>`.
- Produces `syncTimelockDevice(device: DeviceContext): Promise<OfflineAccount[]>`.
- Produces `logoutTimelockUser(device: DeviceContext, input): Promise<TimelockSession>`.

- [ ] **Step 1: Write failing gateway tests**

Cover invalid device token, machine mismatch, inactive email-prefix account, password verification, lockout after five failures, duplicate active session, event acknowledgement, and Sheet outage behavior.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/timelock-sheet-gateway.test.ts tests/timelock-accounts.test.ts`

Expected: FAIL because gateway functions still require Supabase.

- [ ] **Step 3: Implement Sheet-backed device/account/session access**

Hash device tokens with SHA-256, compare to `Machines.deviceTokenHash`, read `Users` by lowercase `emailPrefix`, store lock/session/event rows, and keep offline-cache behavior only from Sheet-derived data.

- [ ] **Step 4: Update route handlers and error mapping**

Remove Supabase client construction from every TimeLock and heartbeat route. Preserve existing HTTP error codes and request shapes from `docs/booking-api-contract.md`.

- [ ] **Step 5: Run all TimeLock tests**

Run: `npm test -- tests/timelock-*.test.ts tests/machine-presence.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/timelock app/api/timelock app/api/machines tests/timelock-sheet-gateway.test.ts
git commit -m "feat: migrate TimeLock gateway to Google Sheets"
```

## Task 7: Remove Supabase runtime dependency and update documentation

**Files:**
- Modify: `package.json`, `package-lock.json`, `README.md`, `.env.example`
- Delete: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/service.ts`
- Delete or archive: Supabase-specific application tests and migrations only where no longer referenced
- Modify: `next.config.ts`, `tsconfig.json` if aliases/imports require cleanup
- Test: `tests/no-supabase-runtime.test.ts`

**Interfaces:**
- No application module imports `@supabase/*`.
- No required environment variable starts with `SUPABASE_`.

- [ ] **Step 1: Write failing dependency-scan test**

```ts
it("does not expose Supabase as a runtime dependency", async () => {
  const files = await collectSourceFiles(["app", "components", "lib"]);
  expect(files.join("\\n")).not.toMatch(/@supabase\\//);
});
```

- [ ] **Step 2: Run the scan and verify RED**

Run: `npm test -- tests/no-supabase-runtime.test.ts`

Expected: FAIL while Supabase imports remain.

- [ ] **Step 3: Remove dependency and stale runtime code**

Delete runtime Supabase clients and remove `@supabase/ssr`/`@supabase/supabase-js` from package manifests after all callers are migrated. Keep SQL migrations only as historical documentation if they are no longer part of deployment.

- [ ] **Step 4: Update README and environment/deployment instructions**

Document Google OAuth redirect URI setup, service-account sharing, spreadsheet tabs/headers, Apps Script deployment secret, session secret, and TimeLock API setup. Explicitly state that Supabase is not required.

- [ ] **Step 5: Run dependency scan and TypeScript checks**

Run: `npm test -- tests/no-supabase-runtime.test.ts tests/smoke.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json README.md .env.example next.config.ts tsconfig.json tests/no-supabase-runtime.test.ts
git add -u lib/supabase
git commit -m "chore: remove Supabase runtime dependency"
```

## Task 8: Full verification and deployment smoke checks

**Files:**
- Modify: `docs/booking-api-contract.md`, `README.md` only for verified final behavior
- Test: all `tests/**/*.test.ts` and `tests/**/*.test.tsx`

- [ ] **Step 1: Run the complete unit test suite**

Run: `npm test`

Expected: exit code 0 with zero failed tests.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: exit code 0 and no missing environment/configuration import errors.

- [ ] **Step 3: Run static checks**

Run: `npx tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 4: Perform non-production manual smoke test**

Using a test spreadsheet: sign in with a valid MSU Google account, verify a wrong `hd` claim is rejected, create one booking, repeat the request with the same idempotency key, attempt a conflicting booking, cancel the original booking, sign in to TimeLock using the generated email prefix, and verify the machine/API event path.

- [ ] **Step 5: Inspect diff and status**

Run: `git diff --check; git status --short; rg -n "@supabase/|SUPABASE_|createSupabase" app components lib package.json .env.example README.md`

Expected: no runtime matches; only explicitly retained historical documentation/migrations may mention Supabase.

- [ ] **Step 6: Commit final verification documentation**

```bash
git add docs/booking-api-contract.md README.md
git commit -m "docs: finalize Google Sheets booking deployment guidance"
```
