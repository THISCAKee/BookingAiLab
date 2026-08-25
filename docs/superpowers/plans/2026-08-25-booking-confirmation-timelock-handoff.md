# Booking Confirmation and TimeLock Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้การจองแสดงผลสำเร็จ/ไม่สำเร็จอย่างชัดเจน และส่งข้อมูล session ที่ WPF TimeLock ต้องใช้ผ่าน Backend โดย Google Sheets ยังเป็นแหล่งข้อมูลหลัก

**Architecture:** คง server action และ Apps Script atomic mutation เดิมไว้ เพิ่ม stable booking result codes, confirmation event/audit และขยาย TimeLock login response จาก `Users` + `Bookings` ที่ผูกกับ machine/account เดียวกัน หน้าเว็บจะแสดงข้อมูล credential จริงเฉพาะ success response ครั้งเดียว ส่วน WPF ไม่อ่าน Sheet โดยตรง

**Tech Stack:** Next.js App Router 16, TypeScript, React server actions, Google Apps Script, Google Sheets API, Vitest

**Spec:** `docs/superpowers/specs/2026-08-25-booking-confirmation-timelock-handoff-design.md`

## Global Constraints

- Google Sheets เป็นฐานข้อมูลหลักและไม่มี Supabase runtime
- การจองหนึ่งครั้งต้องเป็น 180 นาทีและใช้กติกาวันปัจจุบัน/เครื่องว่างเดิม
- WPF ต้องเรียก BookingAiLab API ด้วย Device Token และห้ามอ่าน Google Sheet โดยตรง
- ห้ามเก็บ plaintext TimeLock password ใน Sheet, Event, AuditLog, log หรือ Git
- Server เป็น authority สำหรับ booking status, end time, quota และ extension policy
- ทุกงานต้องใช้ TDD: เขียน failing test, รันให้เห็น failure, implement ขั้นต่ำ, รันให้ผ่าน

### Task 1: Define complete booking result and error contract

**Files:**
- Modify: `lib/booking/action-utils.ts`
- Modify: `app/booking/actions.ts`
- Modify: `tests/booking-actions.test.ts`
- Test: `tests/booking-action-result.test.ts`

**Interfaces:**
- Produces `BookingFailure = { ok: false; code: string; message: string; retryable: boolean }`.
- Produces `BookingFormState = BookingFailure | { ok: true; code: "BOOKING_CONFIRMED"; message: string; booking: CreatedBooking }`.
- `getBookingErrorMessage` continues to return safe Thai text and must never include raw provider errors, secrets, or password verifier data.

- [ ] **Step 1: Write failing tests**

Add tests for the exact `toBookingFailure(error: unknown): BookingFailure` boundary:

```ts
expect(toBookingFailure(new Error("MACHINE_UNAVAILABLE"))).toEqual({
  ok: false,
  code: "MACHINE_UNAVAILABLE",
  message: "เครื่องนี้ไม่ว่างแล้ว กรุณาเลือกเครื่องอื่น",
  retryable: true,
});
expect(toBookingFailure(new Error("BOOKING_ATOMIC_NOT_CONFIGURED")).retryable).toBe(false);
expect(toBookingFailure(new Error("UNKNOWN_PROVIDER_ERROR")).message).toBe(
  "ไม่สามารถทำรายการจองได้ กรุณาลองใหม่อีกครั้ง",
);
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/booking-actions.test.ts tests/booking-action-result.test.ts`

Expected: FAIL because the complete failure result helper/type does not exist.

- [ ] **Step 3: Implement the minimal contract**

Add stable mappings for the current server codes, including `BOOKING_MACHINE_OVERLAP`, `BOOKING_CUSTOMER_OVERLAP`, `BOOKING_OUTSIDE_SCHEDULE`, `BOOKING_ATOMIC_NOT_CONFIGURED`, and `BOOKING_ATOMIC_FAILED`. Return `retryable: true` for selection/conflict/time errors and `false` for missing configuration/authentication. Update `bookMachineAction` to return `code` on failure and `code: "BOOKING_CONFIRMED"` on success.

- [ ] **Step 4: Run tests to verify green**

Run: `npm test -- tests/booking-actions.test.ts tests/booking-action-result.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/booking/action-utils.ts app/booking/actions.ts tests/booking-actions.test.ts tests/booking-action-result.test.ts
git commit -m "feat: define booking result contract"
```

### Task 2: Render explicit booking success and failure states

**Files:**
- Modify: `components/booking/public-booking-board.tsx`
- Modify: `app/booking/actions.ts`
- Create: `components/booking/booking-result-panel.tsx`
- Create: `tests/public-booking-result.test.tsx`

**Interfaces:**
- Consumes the `BookingFormState` from Task 1.
- Produces a success panel with booking number, machine code, start/end time, TimeLock username, and one-time password.
- Produces a failure alert with the server message and a retry path without any credential fields.
- `BookingResultPanel` is a presentational component so its success/failure rendering can be tested without browser-only hooks.

- [ ] **Step 1: Write failing tests**

Add `tests/public-booking-result.test.tsx` using `renderToStaticMarkup` from `react-dom/server` and the real `BookingResultPanel`. The success fixture must assert the labels `ยืนยันการจองแล้ว`, `ชื่อผู้ใช้ TimeLock`, and `รหัสผ่าน TimeLock`; the failure fixture must assert the actionable error and assert that `รหัสผ่าน TimeLock` is absent.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/public-booking-result.test.tsx`

Expected: FAIL because the component does not yet render the complete result contract and/or test helpers are not wired.

- [ ] **Step 3: Implement the minimal UI behavior**

Implement `BookingResultPanel` with props `{ state: BookingFormState; onRetry?: () => void }`. Keep the existing visual style. On success, render only the success panel and preserve the existing one-time credential warning. On failure, render a red `role="alert"` panel with the stable message and a retry button when `retryable` is true. Mount the panel from `PublicBookingBoard`, keep the booking form available after failure, and clear stale success data before a new submit. Do not use browser `alert()`; the in-page status is the notification channel approved in the design.

- [ ] **Step 4: Run tests to verify green**

Run: `npm test -- tests/public-booking-result.test.tsx tests/booking-actions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/booking/public-booking-board.tsx app/booking/actions.ts tests/public-booking-result.test.tsx
git commit -m "feat: show booking confirmation states"
```

### Task 3: Append booking confirmation Event and Audit rows atomically

**Files:**
- Modify: `scripts/google-apps-script/Code.gs`
- Modify: `tests/google-apps-script.test.ts`

**Interfaces:**
- Consumes the existing `create_booking` payload and script lock.
- Produces an `Events` row with `eventType = booking_confirmed` and safe metadata, plus an `AuditLog` row with `action = booking_confirmed`.
- Does not write plaintext password or password verifier fields to either sheet.

- [ ] **Step 1: Extend the fake Sheets fixture and write failing tests**

Add an `AuditLog` fixture/header and assert after a successful `createBooking_` call:

```ts
expect(sheets.Events.rows.at(-1)).toMatchObject([
  "generated-2", "booking_confirmed", "", "booking-id", "PC-001", "new", "confirmed",
]);
expect(JSON.stringify(sheets.Events.rows.at(-1))).not.toContain("passwordHash");
expect(JSON.stringify(sheets.Events.rows.at(-1))).not.toContain("plain-text-password");
expect(sheets.AuditLog.rows.at(-1)?.[2]).toBe("booking_confirmed");
```

Also add a duplicate idempotency test asserting the second call does not append another `booking_confirmed` event or audit row.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/google-apps-script.test.ts`

Expected: FAIL because `createBooking_` currently appends only Booking and User rows.

- [ ] **Step 3: Implement the minimal Apps Script mutation**

After `upsertUser_`, append a mapped `booking_confirmed` event and audit row using generated IDs and safe booking metadata. Keep all writes inside the existing `doPost` script lock. Update the duplicate branch so it returns the existing row without appending another event/audit record.

- [ ] **Step 4: Run tests to verify green**

Run: `npm test -- tests/google-apps-script.test.ts`

Expected: PASS, including invalid/conflict cases with no mutation rows.

- [ ] **Step 5: Commit**

```bash
git add scripts/google-apps-script/Code.gs tests/google-apps-script.test.ts
git commit -m "feat: record booking confirmation events"
```

### Task 4: Return complete booking metadata from TimeLock login

**Files:**
- Modify: `lib/timelock/sheet-gateway.ts`
- Modify: `tests/timelock-sheet-gateway.test.ts`
- Modify: `tests/timelock-api.test.ts`

**Interfaces:**
- `loginTimelockUser` returns `sessionId`, `bookingId`, `bookingNumber`, `machineCode`, `username`, `startedAt`, `endAt`, `allowedMinutes`, `extensionCount`, and `status`.
- Booking metadata is resolved from the active account’s `sourceBookingId`, matching machine, username, and active booking; no client-provided booking fields are trusted.

- [ ] **Step 1: Write failing tests**

Extend the Sheet gateway login fixture and assert:

```ts
expect(result).toMatchObject({
  bookingId: "b-1",
  bookingNumber: "BK-1",
  machineCode: "PC-001",
  username: "student",
  endAt: "2026-08-24T04:30:00.000Z",
  allowedMinutes: 180,
  extensionCount: 0,
  status: "active",
});
```

Add a failure test where the account exists but its booking is missing or belongs to another machine, expecting `ACCOUNT_MACHINE_MISMATCH` and no `session_started` row.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/timelock-sheet-gateway.test.ts tests/timelock-api.test.ts`

Expected: FAIL because login currently returns only session ID, username, machine, start time, and status.

- [ ] **Step 3: Implement the minimal gateway change**

Load and parse `Bookings` alongside `Users`. Resolve the booking before appending `session_started`; include its metadata and the user’s `allowedMinutes` in the returned session. Keep the event payload `{}` or safe metadata only, never credential data.

- [ ] **Step 4: Run tests to verify green**

Run: `npm test -- tests/timelock-sheet-gateway.test.ts tests/timelock-api.test.ts`

Expected: PASS and existing logout/extension tests remain green.

- [ ] **Step 5: Commit**

```bash
git add lib/timelock/sheet-gateway.ts tests/timelock-sheet-gateway.test.ts tests/timelock-api.test.ts
git commit -m "feat: return booking metadata from timelock login"
```

### Task 5: Align the WPF API contract and setup documentation

**Files:**
- Modify: `docs/booking-api-contract.md`
- Modify: `README.md`
- Modify: `.env.example` only if new non-secret configuration is required

**Interfaces:**
- Documents the exact `/api/timelock/login` success response and its server-authoritative fields.
- Documents that `booking_confirmed` is an internal Sheet event and that WPF consumes the login/session API, not Google Sheets.

- [ ] **Step 1: Write a contract test fixture**

Add or extend the API test fixture to assert the JSON response includes `bookingId`, `bookingNumber`, `endAt`, `allowedMinutes`, and `extensionCount`, while excluding password, passwordHash, passwordSalt, Apps Script secret, and service-account fields.

- [ ] **Step 2: Run the contract test to verify the current mismatch**

Run: `npm test -- tests/timelock-api.test.ts`

Expected: FAIL until the route receives the expanded gateway session object.

- [ ] **Step 3: Update the documentation**

Replace the draft login response with the exact response shape from Task 4. Add the error behavior for account/booking mismatch and explain that WPF starts its timer from `endAt`, then uses the existing extension check/confirm APIs.

- [ ] **Step 4: Run the contract test and documentation checks**

Run: `npm test -- tests/timelock-api.test.ts` and `git diff --check`

Expected: PASS with no whitespace errors.

- [ ] **Step 5: Commit**

```bash
git add docs/booking-api-contract.md README.md .env.example
git commit -m "docs: document booking timelock handoff"
```

### Task 6: Full verification and deployment handoff

**Files:**
- No production files unless verification finds a concrete failure.

- [ ] **Step 1: Run the full automated suite**

Run: `npm test -- --run`

Expected: all test files and tests pass, including the new booking result, Apps Script, and TimeLock metadata cases.

- [ ] **Step 2: Run type checking**

Run: `npx tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 3: Run the production build**

Run: `npm run build -- --webpack`

Expected: exit code 0 and routes include the booking and TimeLock endpoints.

- [ ] **Step 4: Check the diff and repository state**

Run: `git diff --check` and `git status -sb`

Expected: no diff errors; only intentional user-local untracked files remain.

- [ ] **Step 5: Deploy handoff**

After code deployment, copy the updated `scripts/google-apps-script/Code.gs` into Apps Script, save, deploy a new Web App version, and verify a test booking creates `Bookings`, `Users`, `Events.booking_confirmed`, and `AuditLog` rows. Then give WPF the documented API contract and machine/device-token configuration; do not give WPF Sheet credentials or Apps Script secret.
