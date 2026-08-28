# TimeLock Login-Based Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้ TimeLock เริ่มนับเวลาเมื่อ login จริง และเปิด booking คิวถัดไปได้เมื่อ booking ก่อนหน้ามี `session_started` แล้ว

**Architecture:** คง Google Sheets และ Apps Script เป็น source of truth โดยให้ `Bookings.startAt/endAt` เป็น provisional window ตอนสร้าง booking และเป็น authoritative actual window หลัง TimeLock login สำเร็จ Apps Script จะอ่าน Events ภายใต้ script lock เพื่อบล็อก queue predecessor ที่ยังไม่ login ส่วน Backend จะอัปเดต booking เป็นเวลา login + allowance ก่อนบันทึก session event และคืนค่า session เดียวกันให้ WPF

**Tech Stack:** Next.js App Router 16, TypeScript, React server components, Google Apps Script, Google Sheets, Vitest

**Spec:** `docs/superpowers/specs/2026-08-28-timelock-login-timing-design.md`

## Global Constraints

- Google Sheets เป็นฐานข้อมูลหลักและไม่มี Supabase runtime
- เวลา session จริงเริ่มจาก `startedAt = loginAt` และ `endAt = startedAt + allowedMinutes`
- Booking คิวถัดไปต้องมี predecessor `session_started` ก่อน และเว้น turnaround 15 นาที
- allowance ยังคง 180 นาที และไม่ให้ session ข้าม Bangkok midnight
- ไม่เพิ่ม Sheet columns และไม่บันทึก plaintext password, verifier, token หรือ secret ลง Sheet/Event/log
- WPF อยู่นอก repository; API ต้องคืน `endAt` ที่คำนวณจาก login ให้ client ใช้เป็น authority
- ทุก behavior change ต้องใช้ TDD: write failing test, verify RED, implement minimal code, verify GREEN

---

## File map

- Modify `lib/timelock/sheet-gateway.ts`: login-time calculation, booking row mutation, actual session response, sync eligibility
- Modify `lib/timelock/http.ts`: stable `BOOKING_CROSSES_MIDNIGHT` mapping if absent and preserve safe error bodies
- Modify `lib/booking/queue-policy.ts`: keep uncompleted bookings visible/effective even when their provisional end passed
- Modify `lib/booking/action-utils.ts`: map `BOOKING_PREVIOUS_NOT_STARTED` to actionable Thai booking feedback
- Modify `scripts/google-apps-script/Code.gs`: require predecessor `session_started`; queue from latest authoritative `endAt`
- Modify `components/booking/public-booking-board.tsx`, `components/booking/booking-result-panel.tsx`, `app/booking/page.tsx`: explain provisional queue time and login-based timer
- Modify `docs/booking-api-contract.md`: update TimeLock login, sync, queue and error contract
- Modify tests under `tests/`: gateway, sync, Apps Script, queue policy, UI, action result, API and extension regressions

### Task 1: Change the TypeScript TimeLock session to start at login

**Files:**
- Modify: `lib/timelock/sheet-gateway.ts:96-149`
- Test: `tests/timelock-sheet-gateway.test.ts`

**Interfaces:**
- `loginTimelockUser(device, input, options)` continues to return `{ sessionId, bookingId, bookingNumber, username, machineCode, startedAt, endAt, allowedMinutes, extensionCount, status }`.
- On success, `Bookings.startAt` and `Bookings.endAt` are written with the actual login window and status `active` before the function returns.

- [ ] **Step 1: Write the failing late-login test**

Replace the fixed-window rejection assertions with a behavior test using the existing `scheduledLoginSheets()` fixture:

```ts
it("starts the full allowance when login happens after the provisional end", async () => {
  const sheets = await scheduledLoginSheets();
  const result = await loginTimelockUser(device, {
    username: "student",
    password: "secret-password",
  }, {
    sheets,
    now: () => new Date("2026-08-24T05:00:00.000Z"),
    randomId: (() => {
      const ids = ["s-late", "e-late"];
      return () => ids.shift() ?? "unexpected";
    })(),
  });

  expect(result).toMatchObject({
    startedAt: "2026-08-24T05:00:00.000Z",
    endAt: "2026-08-24T08:00:00.000Z",
    allowedMinutes: 180,
    status: "active",
  });
  expect(sheets.updateSheetRow).toHaveBeenCalledWith("Bookings", 2, expect.arrayContaining([
    "2026-08-24T05:00:00.000Z",
    "2026-08-24T08:00:00.000Z",
    "active",
  ]));
});
```

Add a test at a time that would make the full allowance cross Bangkok midnight; expect `BOOKING_CROSSES_MIDNIGHT`, no booking update, and no `session_started` append. Retain the existing missing-booking, credential, event, logout and extension coverage.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm test -- tests/timelock-sheet-gateway.test.ts`

Expected: FAIL because login currently rejects after the provisional `endAt` and does not update `Bookings`.

- [ ] **Step 3: Implement the minimal gateway behavior**

In `loginTimelockUser`:

1. Keep device/account/password/booking relationship validation.
2. Remove the `now < booking.startAt` and `now >= booking.endAt` checks.
3. Calculate `startedAt = now.toISOString()` and `actualEnd = new Date(now.getTime() + account.allowedMinutes * 60_000)`.
4. Reject `BOOKING_CROSSES_MIDNIGHT` when the actual end has a different Bangkok date.
5. Use `updatedSheetRow` to update the matched Booking row with `startAt`, `endAt`, `status: "active"`, and `updatedAt: startedAt`.
6. Append `session_started` using the same `startedAt`; return `actualEnd.toISOString()` as `endAt`.

Do not put credentials in the event payload. Preserve `bookingNumber`, `extensionCount`, and `allowedMinutes` from the validated server records.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run: `npm test -- tests/timelock-sheet-gateway.test.ts`

Expected: PASS, including the new late-login and midnight tests plus existing logout/session tests.

### Task 2: Make sync and queue policy tolerate provisional windows

**Files:**
- Modify: `lib/timelock/sheet-gateway.ts:101-117`
- Modify: `lib/booking/queue-policy.ts:35-40`
- Test: `tests/timelock-sync.test.ts`
- Test: `tests/booking-queue-policy.test.ts`

**Interfaces:**
- `syncTimelockDevice` returns active accounts whose linked booking is non-terminal, even if the provisional end has passed.
- `isEffectiveBooking` treats every non-terminal booking with valid dates as effective for queue/viewer blocking; terminal statuses remain excluded.

- [ ] **Step 1: Write the failing sync and policy tests**

In `tests/timelock-sync.test.ts`, add an active booking whose `endAt` is before `now` and assert `syncTimelockDevice` still returns one account with the booking end as `expiresAt` until login adjusts it. In `tests/booking-queue-policy.test.ts`, add:

```ts
it("keeps an uncompleted booking effective after its provisional end", () => {
  expect(isEffectiveBooking({ ...booking(), status: "confirmed", endAt: "2026-08-24T04:00:00.000Z" }, new Date("2026-08-24T05:00:00.000Z"))).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/timelock-sync.test.ts tests/booking-queue-policy.test.ts`

Expected: FAIL because sync and `isEffectiveBooking` currently filter by `endAt > now`.

- [ ] **Step 3: Implement the minimal policy changes**

Remove only the time comparison from `bookingIsUsableAt`/sync filtering and from `isEffectiveBooking`; retain machine, account, active status, valid-date, and booking-link checks. Keep `expiresAt` equal to the stored booking `endAt` until the login mutation updates it.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- tests/timelock-sync.test.ts tests/booking-queue-policy.test.ts tests/timelock-sheet-gateway.test.ts`

Expected: PASS with existing queue status and offline cache behavior preserved except for the provisional-time rule.

### Task 3: Gate Apps Script queue creation on predecessor login

**Files:**
- Modify: `scripts/google-apps-script/Code.gs:87-135, 362-365`
- Modify: `tests/google-apps-script.test.ts:204-314`

**Interfaces:**
- `createBooking_(body, currentTime)` throws `BOOKING_PREVIOUS_NOT_STARTED` when the latest non-terminal booking for the requested machine has no matching `session_started` event.
- When the predecessor has started, the new booking uses `latestEnd + 15 minutes`; when no predecessor exists, it uses `currentTime`.

- [ ] **Step 1: Write the failing Apps Script tests**

Update the consecutive-booking test to create the first booking, then assert the second attempt fails before a session event exists:

```ts
expect(() => context.createBooking_({ ...createBody, idempotencyKey: "create-other", payload: otherPayload }, new Date("2026-08-24T00:31:00.000Z")))
  .toThrow("BOOKING_PREVIOUS_NOT_STARTED");
```

Add a `session_started` event for the first booking in the fixture, update its `endAt` to `2026-08-24T05:00:00.000Z`, then assert the second booking starts at `2026-08-24T05:15:00.000Z` and ends at `2026-08-24T08:15:00.000Z`. Add a regression test proving cancelled, completed and expired predecessor rows do not block a new first booking.

- [ ] **Step 2: Run the Apps Script tests to verify RED**

Run: `npm test -- tests/google-apps-script.test.ts`

Expected: FAIL because the current script creates the second slot without reading `Events`.

- [ ] **Step 3: Implement the minimal Apps Script gate**

In `createBooking_`:

1. Read `Events` and build its header index after validating the machine and before choosing the start time.
2. Filter machine bookings to non-terminal rows regardless of whether their provisional `endAt` has passed.
3. Select the row with the greatest valid `endAt`.
4. If a predecessor exists, require an event with `eventType === 'session_started'` and matching `bookingId`; otherwise throw `BOOKING_PREVIOUS_NOT_STARTED`.
5. Use predecessor `endAt + 15 minutes` only after that check; keep the existing midnight, duplicate-customer, idempotency and atomic-write behavior.

Add a small helper next to `effectiveBooking_` for the non-terminal predicate and a helper for matching started events. Do not change the Event schema or write secrets.

- [ ] **Step 4: Run the Apps Script tests to verify GREEN**

Run: `npm test -- tests/google-apps-script.test.ts`

Expected: PASS, including no-mutation behavior on `BOOKING_PREVIOUS_NOT_STARTED` and existing booking confirmation/extension tests.

### Task 4: Expose stable errors and update booking-facing copy

**Files:**
- Modify: `lib/timelock/http.ts:3-23`
- Modify: `lib/booking/action-utils.ts:1-35`
- Modify: `components/booking/public-booking-board.tsx:90-140`
- Modify: `components/booking/booking-result-panel.tsx:35-85`
- Modify: `app/booking/page.tsx:30-45`
- Test: `tests/timelock-api.test.ts`
- Test: `tests/booking-action-result.test.ts`
- Test: `tests/public-booking-board.test.ts`
- Test: `tests/public-booking-result.test.tsx`

**Interfaces:**
- API maps `BOOKING_CROSSES_MIDNIGHT` and `BOOKING_PREVIOUS_NOT_STARTED` to HTTP 409 with `{ ok: false, code }`.
- Booking failure mapping returns actionable Thai text for `BOOKING_PREVIOUS_NOT_STARTED` without raw provider messages.
- UI says the displayed queue window is provisional and actual 180-minute usage starts at TimeLock login.

- [ ] **Step 1: Write failing API, action and UI assertions**

Add:

```ts
expect(timelockErrorResponse(new Error("BOOKING_PREVIOUS_NOT_STARTED"), "LOGIN_FAILED").status).toBe(409);
expect(toBookingFailure(new Error("BOOKING_PREVIOUS_NOT_STARTED"))).toMatchObject({
  ok: false,
  code: "BOOKING_PREVIOUS_NOT_STARTED",
  retryable: true,
});
```

Assert rendered booking copy contains `เวลาจะเริ่มนับเมื่อ login เข้า TimeLock` and does not state that the user must enter at the displayed `startAt`. Update the result panel assertion from the old “เข้าใช้งาน ... ได้ตั้งแต่ ... เท่านั้น” wording to the provisional/login-based wording.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/timelock-api.test.ts tests/booking-action-result.test.ts tests/public-booking-board.test.ts tests/public-booking-result.test.tsx`

Expected: FAIL because the new codes/copy are not mapped or rendered.

- [ ] **Step 3: Implement the minimal contract and copy changes**

Add both conflict codes to the existing safe mappings. Keep failure payloads limited to `{ ok, code }` at the TimeLock API boundary. Update only the booking/TimeLock explanatory text: show the queue slot as an estimate, state that the timer begins at successful TimeLock login, and state that the next queue opens after the previous user starts their session. Keep one-time credential and security copy intact.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- tests/timelock-api.test.ts tests/booking-action-result.test.ts tests/public-booking-board.test.ts tests/public-booking-result.test.tsx`

Expected: PASS with no credential/verifier leakage in success or failure markup.

### Task 5: Update API contract and compatibility regressions

**Files:**
- Modify: `docs/booking-api-contract.md` sections `TimeLock login`, `TimeLock offline sync`, `TimeLock logout และหมดเวลา`
- Modify: `tests/timelock-extension-gateway.test.ts`
- Modify: `tests/timelock-sheet-gateway.test.ts`
- Modify: `tests/booking-flow-performance.test.ts` only if exact response fixtures include old timing assumptions

**Interfaces:**
- Documentation states that login has no fixed `startAt/endAt` eligibility check, returns `startedAt = loginAt`, and returns `endAt = loginAt + allowedMinutes`.
- Extension tests continue to use the login-adjusted `Bookings.endAt` and reject overlap with the next authoritative queue.

- [ ] **Step 1: Write the regression assertions**

Add a gateway assertion that after login at `2026-08-24T05:00:00.000Z`, the extension check reports `currentEndAt: "2026-08-24T08:00:00.000Z"`. Add an API assertion that neither `BOOKING_NOT_STARTED` nor `BOOKING_EXPIRED` is emitted for the late-login success path.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- tests/timelock-sheet-gateway.test.ts tests/timelock-extension-gateway.test.ts tests/timelock-api.test.ts`

Expected: FAIL until the adjusted booking end is persisted and consumed by extension resolution.

- [ ] **Step 3: Implement documentation and fixture alignment**

Update the contract examples and prose to describe provisional queue times, login-based actual times, `BOOKING_PREVIOUS_NOT_STARTED`, and the unchanged 180-minute/15-minute/midnight rules. Adjust only test fixtures needed to represent the new persisted booking window; do not weaken extension or logout validation.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- tests/timelock-sheet-gateway.test.ts tests/timelock-extension-gateway.test.ts tests/timelock-api.test.ts`

Expected: PASS with extension, logout, machine isolation and response-safety tests intact.

### Task 6: Full verification and handoff

**Files:**
- Inspect: all files changed by Tasks 1–5
- Test: full repository test/build/lint checks

- [ ] **Step 1: Run the complete automated test suite**

Run: `npm test`

Expected: Vitest exits 0 with zero failed tests.

- [ ] **Step 2: Run TypeScript/build verification**

Run: `npm run build`

Expected: Next.js production build exits 0 without type or route-handler errors.

- [ ] **Step 3: Run whitespace and diff inspection**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors; only the intended spec/plan/code/test/docs changes plus the pre-existing `.gitignore`, `AGENTS.md`, and `CLAUDE.md` user-owned changes are present.

- [ ] **Step 4: Manually verify the behavior checklist**

Confirm from the tests and diff that:

1. A late login starts a full allowance from login time.
2. The stored booking end changes to that actual session end.
3. A second booking is blocked before predecessor login.
4. A second booking is allowed after predecessor `session_started` and uses the updated end + 15 minutes.
5. No fixed-window login error remains on the normal login path.
6. Logout, extension, sync, API safety and midnight constraints remain enforced.

- [ ] **Step 5: Commit implementation if repository permissions allow**

```bash
git add lib/timelock lib/booking scripts/google-apps-script/Code.gs components/booking app/booking/page.tsx tests docs/booking-api-contract.md
git commit -m "feat: start timelock timing at login"
```

If `.git/index.lock` remains unavailable, report the verified working-tree changes and the exact permission error without modifying or deleting existing Git files.
