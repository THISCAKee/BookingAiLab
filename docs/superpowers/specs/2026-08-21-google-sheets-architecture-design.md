# Google Sheets–First Booking Architecture

## Status

Approved direction; implementation has not started.

## Goal

Replace Supabase completely with a Google OAuth + Google Sheets backend. Google Sheets is the source of truth for users, machines, schedules, settings, bookings, TimeLock accounts, events, and audit history.

## Non-goals

- No Supabase Auth, Supabase database, Supabase RPC, Supabase middleware client, or Supabase service key.
- No Google Sheet credentials exposed to the browser or TimeLock desktop client.
- No plain-text storage of passwords or management codes.

## Architecture

```text
Browser
  | Google OAuth
  v
Next.js App Router
  |-- OAuth callback + signed HttpOnly session cookie
  |-- server-side authorization and validation
  |-- Google Sheets repository (service account)
  `-- optional Apps Script atomic mutation endpoint
          |
          v
      Private Google Spreadsheet
          |-- Settings
          |-- Machines
          |-- Bookings
          |-- Users
          |-- Events
          |-- AuditLog
          `-- LoginLocks

TimeLockApp --> Next.js API --> Google Sheets
```

The spreadsheet is shared only with the backend service account. The Apps Script path is used for operations that must be atomic under concurrent requests: create booking, cancel booking, and state transitions. If the deployment cannot use Apps Script, the repository must fail closed for booking writes rather than silently using an unsafe read-then-append flow.

## Authentication

Implement Google OAuth directly using authorization-code flow:

1. `/api/auth/google` creates a state and PKCE verifier, stores them in short-lived HttpOnly cookies, and redirects to Google.
2. `/api/auth/google/callback` validates state, exchanges the code, verifies the Google ID token signature/issuer/audience/expiry, and reads claims.
3. The server requires `email_verified === true`, a normalized email matching `^[^@\\s]+@msu\\.ac\\.th$`, and an exact `hd` claim of `msu.ac.th`.
4. It derives `name` from the verified Google profile and `emailPrefix` from the local part of the email.
5. It creates a signed/encrypted HttpOnly session cookie containing only the minimum identity claims: email, name, hd, emailPrefix, role, issued-at, and expiry.

Every server action, page data loader, and API route revalidates the session and domain claims. Browser form fields are never trusted for identity. Admin authorization is based on an allow-listed admin email or a `Users` sheet role, evaluated server-side.

## Spreadsheet schema

The backend owns stable header names and validates headers before reading or writing.

### `Settings`

| Column | Meaning |
|---|---|
| Key | `serviceWeekdays`, `openingTime`, `closingTime`, `durationMinutes`, `graceMinutes`, `timezone` |
| Value | Setting value |
| UpdatedAt | ISO timestamp |

### `Machines`

`machineId`, `machineCode`, `machineName`, `location`, `status`, `deviceTokenHash`, `lastSeenAt`, `updatedAt`

### `Bookings`

`bookingId`, `bookingNumber`, `email`, `name`, `hd`, `emailPrefix`, `machineId`, `machineCode`, `startAt`, `endAt`, `status`, `manageCodeHash`, `createdAt`, `updatedAt`

### `Users`

`userId`, `email`, `name`, `emailPrefix`, `role`, `machineCode`, `passwordHash`, `passwordSalt`, `allowedMinutes`, `isActive`, `sourceBookingId`, `updatedAt`

The `emailPrefix` is the stable identifier passed to the TimeLock account workflow. It is normalized to lowercase and must be unique within the active account set.

### `Events`, `AuditLog`, and `LoginLocks`

These sheets store TimeLock delivery/session events, administrative audit entries, and failed-login lock state. Each row has a stable ID and timestamps so retries are idempotent.

## Booking workflow

1. The authenticated user opens `/booking`.
2. Next.js reads settings, machines, and active bookings from Sheets with `cache: no-store`.
3. The user selects date, time, and machine.
4. The server action accepts only the selected machine/time references; it derives identity from the session.
5. The atomic mutation checks settings, machine availability, customer overlap, machine overlap, and duplicate request ID while holding a lock.
6. It appends the booking and creates/updates the corresponding TimeLock user using the email prefix.
7. It records an audit row and returns a safe confirmation payload.
8. Cancellation uses the booking number plus a one-time management code, re-reads ownership from the session or validated code, updates status, and records an audit row.

Booking status values remain `confirmed`, `app_pending`, `app_received`, `active`, `completed`, `cancelled`, and `expired` so the existing TimeLock contract can be migrated without changing its user-visible semantics.

## TimeLock API

Existing route handlers keep their external request/response shapes where practical, but replace Supabase lookups with the Sheets repository. Device authentication hashes the supplied device token and compares it with the `Machines` sheet. Account login reads the matching `Users` row, verifies the password hash, enforces `LoginLocks`, and records session state in `Events`.

The API must scope every read/write by the authenticated machine code and token. Passwords, device tokens, and management codes must not appear in logs or API error responses.

## Error handling and consistency

- Missing or invalid sheet headers/configuration produces a clear server error and disables writes.
- Google API failures do not create a partial booking response; mutation endpoints return retryable errors with an idempotency key.
- All write operations use idempotency keys to prevent duplicate rows after network retries.
- Reads use `no-store`; after mutations, relevant paths are revalidated.
- Admin sheet edits are validated on read. Invalid machine/status/settings rows are reported instead of being silently coerced.

## Environment and deployment

Required secrets include Google OAuth client ID/secret, an OAuth redirect URI, a session encryption/signing secret, Google service-account email/private key, spreadsheet ID, and (when enabled) an Apps Script mutation endpoint secret. No Supabase environment variables remain required.

The spreadsheet must be private and shared with the backend service account only. OAuth redirect URIs and allowed origins must be explicit. Production must use HTTPS.

## Testing strategy

- Unit tests for OAuth claim validation, hosted-domain verification, email-prefix derivation, session serialization, sheet header parsing, settings validation, booking overlap rules, idempotency, and TimeLock account authentication.
- Repository tests using a fake Sheets transport that exercises real row parsing and mutation behavior.
- Route/action tests for unauthenticated, wrong-domain, missing-`hd`, admin, duplicate-booking, and concurrent-mutation cases.
- Build and lint verification after migration, plus a manual smoke test with a non-production spreadsheet.

## Migration and cleanup

Implementation will first add the new repository and tests, then migrate booking/admin/TimeLock flows one by one. After all callers move, remove Supabase imports, clients, middleware integration, environment variables, and Supabase-specific tests/migrations from the application path. Existing Supabase migrations may remain as historical files unless the user explicitly requests repository deletion.
