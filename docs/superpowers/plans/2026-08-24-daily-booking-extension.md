# Daily Booking and Time Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** จำกัดการจองไว้ที่วันปัจจุบันทุกวัน รอบละ 3 ชั่วโมง และเพิ่ม API ต่อเวลาได้รวมสูงสุด 9 ชั่วโมงเฉพาะเมื่อไม่มีคิวถัดไป พร้อมล้าง Bookings และ Users หลังข้ามวัน

**Architecture:** Next.js เป็นชั้นตรวจ Device Token, parse request และอ่าน Sheet เพื่อคืน extension eligibility ส่วน Google Apps Script เป็นผู้ยืนยัน create/extend/cleanup mutation ภายใต้ `LockService`. TimeLock session ถูกบันทึกใน `Events` เพื่อ resolve `sessionId` ไปยัง Booking โดยไม่เชื่อ machine, username หรือ booking ID จาก client.

**Tech Stack:** Next.js 16.3.1 App Router Route Handlers, TypeScript, Vitest, Google Sheets API, Google Apps Script V8

**Spec:** `docs/superpowers/specs/2026-08-24-daily-booking-extension-design.md`

## Global Constraints

- Google Sheet เป็นแหล่งข้อมูลหลักเพียงแห่งเดียว และไม่มี Supabase runtime
- วันที่และขอบเขตเที่ยงคืนใช้ `Asia/Bangkok`
- จองได้เฉพาะวันปัจจุบัน เปิดทุกวัน และระยะเวลาต่อช่วงคงที่ 180 นาที
- รอบแรกนับเป็นช่วงที่ 1 ต่อได้อีกไม่เกิน 2 ครั้ง รวมสูงสุด 540 นาที
- ต่อเวลาได้เมื่อเพิ่มครบ 180 นาทีโดยไม่เกิน 00:00 และไม่ซ้อนคิว active ของเครื่องเดียวกัน
- WPF source และ popup implementation อยู่นอก repository นี้; repository นี้ส่งมอบ backend กับ API contract
- Route Handlers ใช้ native `Request`/`NextResponse`, `POST` และ Node.js runtime ตามเอกสาร Next.js 16 ใน `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- ทุก production behavior ต้องผ่าน TDD: เขียน test, เห็น expected failure, แล้วจึงเขียน implementation
- รักษา uncommitted login/session changes ที่มีอยู่ ห้าม stage `AGENTS.md`, `CLAUDE.md` หรือไฟล์ที่ไม่เกี่ยวข้อง

## File Responsibility Map

- `lib/booking/schedule.ts`: วันที่ที่หน้าเว็บเลือกได้และรอบ 180 นาที
- `lib/booking/sheet-policy.ts`: บังคับ today-only, exact duration และ schedule policy ก่อนส่ง mutation
- `lib/booking/extension-policy.ts`: pure decision สำหรับ limit, midnight และ next-queue conflict
- `lib/google/sheet-types.ts`, `lib/google/sheet-schema.ts`: typed `extensionCount` และ validation ของ Bookings
- `lib/timelock/sheet-records.ts`: parse Users/Events และ resolve active session จากข้อมูล Sheet
- `lib/timelock/requests.ts`: parse extension check/confirm payload
- `lib/timelock/sheet-gateway.ts`: authenticate device, persist session lifecycle, read eligibility และส่ง atomic confirm
- `app/api/timelock/extension/check/route.ts`: extension eligibility endpoint
- `app/api/timelock/extension/confirm/route.ts`: atomic extension confirmation endpoint
- `scripts/google-apps-script/Code.gs`: locked create/extend mutations, schema initialization และ midnight cleanup trigger
- `docs/booking-api-contract.md`, `README.md`: WPF contract และขั้นตอน deploy/migrate Sheet

---

### Task 1: Enforce Today-Only Daily Booking

**Files:**
- Modify: `tests/scheduled-booking.test.ts`
- Modify: `tests/booking-sheet-policy.test.ts`
- Modify: `lib/booking/schedule.ts`
- Modify: `lib/booking/sheet-policy.ts`
- Modify: `components/booking/public-booking-board.tsx`

**Interfaces:**
- Consumes: existing `getSelectableBookingDates(now, timezone)` and `assertSheetBookingAllowed(input)`
- Produces: `getSelectableBookingDates()` returns exactly one Bangkok date; `assertSheetBookingAllowed` accepts optional `now?: Date` for deterministic tests and rejects non-today/non-180-minute requests

- [ ] **Step 1: Change the date test and add policy tests that describe the new behavior**

```ts
it("offers only today in Bangkok", () => {
  expect(getSelectableBookingDates(new Date("2026-08-18T17:30:00.000Z")))
    .toEqual([{ value: "2026-08-19", kind: "today", label: "วันนี้" }]);
});

it("accepts a three-hour booking today on a weekend", () => {
  expect(() => assertSheetBookingAllowed({
    machine,
    bookings: [],
    email: "student@msu.ac.th",
    startAt: "2026-08-22T03:00:00.000Z",
    endAt: "2026-08-22T06:00:00.000Z",
    settings: { ...settings, serviceWeekdays: [1, 2, 3, 4, 5, 6, 7] },
    now: new Date("2026-08-22T01:00:00.000Z"),
  })).not.toThrow();
});

it("rejects another day and a duration other than 180 minutes", () => {
  const common = { machine, bookings: [], email: "student@msu.ac.th", settings: { ...settings, serviceWeekdays: [1,2,3,4,5,6,7] }, now: new Date("2026-08-22T01:00:00.000Z") };
  expect(() => assertSheetBookingAllowed({ ...common, startAt: "2026-08-23T03:00:00.000Z", endAt: "2026-08-23T06:00:00.000Z" })).toThrow("BOOKING_DATE_NOT_ALLOWED");
  expect(() => assertSheetBookingAllowed({ ...common, startAt: "2026-08-22T03:00:00.000Z", endAt: "2026-08-22T05:00:00.000Z" })).toThrow("BOOKING_DURATION_INVALID");
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- tests/scheduled-booking.test.ts tests/booking-sheet-policy.test.ts`

Expected: date test still receives today and tomorrow; policy does not accept `now` or reject wrong date/duration.

- [ ] **Step 3: Implement the minimal date and booking-policy changes**

```ts
export function getSelectableBookingDates(now = new Date(), timezone = "Asia/Bangkok") {
  if (timezone !== "Asia/Bangkok") throw new Error("UNSUPPORTED_TIMEZONE");
  return [{ value: bangkokDateValue(now), kind: "today", label: "วันนี้" }];
}
```

In `assertSheetBookingAllowed`, compare `localParts(input.startAt, timezone).date` with the Bangkok date of `input.now ?? new Date()`, require `(end - start) === 180 * 60_000`, and keep machine/schedule/overlap checks. Change the empty-date UI copy so it no longer tells users to choose tomorrow.

- [ ] **Step 4: Run focused and related tests and verify GREEN**

Run: `npm test -- tests/scheduled-booking.test.ts tests/booking-sheet-policy.test.ts tests/booking-actions.test.ts`

Expected: all selected tests pass.

- [ ] **Step 5: Commit only daily-booking files**

```bash
git add tests/scheduled-booking.test.ts tests/booking-sheet-policy.test.ts lib/booking/schedule.ts lib/booking/sheet-policy.ts components/booking/public-booking-board.tsx
git commit -m "feat: restrict bookings to today"
```

---

### Task 2: Add Extension Count to the Booking Schema

**Files:**
- Modify: `tests/google-sheet-schema.test.ts`
- Modify: `tests/booking-sheet-policy.test.ts`
- Modify: `lib/google/sheet-types.ts`
- Modify: `lib/google/sheet-schema.ts`

**Interfaces:**
- Produces: `SheetBooking.extensionCount: number`; `BOOKING_HEADERS` ends with `extensionCount`; valid range is integer `0..2`
- Consumes: all booking readers continue using `parseBookings(rows)`

- [ ] **Step 1: Add parser tests for valid and invalid extension counts**

```ts
it("parses a booking extension count", () => {
  const row = ["b-1", "BK-1", "student@msu.ac.th", "Student", "msu.ac.th", "student", "m-1", "PC-001", "2026-08-24T01:30:00.000Z", "2026-08-24T04:30:00.000Z", "confirmed", "hash", "2026-08-24T00:00:00.000Z", "2026-08-24T00:00:00.000Z", "request-1", "0"];
  expect(parseBookings([BOOKING_HEADERS, row])[0].extensionCount).toBe(0);
  expect(() => parseBookings([BOOKING_HEADERS, [...row.slice(0, -1), "3"]])).toThrow("SHEET_BOOKING_INVALID:2");
});
```

- [ ] **Step 2: Run schema tests and verify RED**

Run: `npm test -- tests/google-sheet-schema.test.ts`

Expected: `extensionCount` is absent from the parsed result.

- [ ] **Step 3: Add the typed field, header and validation**

```ts
export type SheetBooking = {
  // existing fields
  extensionCount: number;
};
```

Parse `Number(valueAt(row, positions, "extensionCount"))` and reject values that are not integers from 0 through 2. Update the strongly typed fixture in `tests/booking-sheet-policy.test.ts` with `extensionCount: 0`. Apps Script and README headers are updated in Tasks 6 and 8 so their existing uncommitted changes can be reviewed in context.

- [ ] **Step 4: Run schema and all booking tests and verify GREEN**

Run: `npm test -- tests/google-sheet-schema.test.ts tests/booking-sheet-policy.test.ts tests/scheduled-booking.test.ts`

Expected: all selected tests pass without weakening header validation.

- [ ] **Step 5: Commit schema changes**

```bash
git add lib/google/sheet-types.ts lib/google/sheet-schema.ts tests/google-sheet-schema.test.ts tests/booking-sheet-policy.test.ts
git commit -m "feat: track booking extension count"
```

---

### Task 3: Implement Pure Extension Eligibility Policy

**Files:**
- Create: `tests/booking-extension-policy.test.ts`
- Create: `lib/booking/extension-policy.ts`

**Interfaces:**
- Produces: `evaluateBookingExtension(input: { booking: SheetBooking; bookings: SheetBooking[]; now: Date }): ExtensionDecision`
- Produces: `ExtensionDecision = { canExtend: boolean; reason: ExtensionReason; currentEndAt: string; proposedEndAt: string | null; extensionCount: number; maxExtensionCount: 2 }`
- Consumes: active statuses from `SheetBooking`; fixed constants `EXTENSION_MINUTES = 180`, `MAX_EXTENSION_COUNT = 2`

- [ ] **Step 1: Write one test per decision branch**

```ts
it("offers another 180 minutes when there is no next queue", () => {
  expect(evaluateBookingExtension({ booking: current, bookings: [current], now }))
    .toMatchObject({ canExtend: true, reason: "EXTENSION_AVAILABLE", proposedEndAt: "2026-08-24T07:30:00.000Z" });
});

it.each([
  [{ ...current, extensionCount: 2 }, [current], "EXTENSION_LIMIT_REACHED"],
  [{ ...current, endAt: "2026-08-24T15:00:00.000Z" }, [current], "EXTENSION_CROSSES_MIDNIGHT"],
  [current, [current, { ...nextBooking, startAt: current.endAt, endAt: "2026-08-24T07:30:00.000Z" }], "EXTENSION_NEXT_BOOKING_CONFLICT"],
])("rejects unavailable extension", (booking, bookings, reason) => {
  expect(evaluateBookingExtension({ booking, bookings, now })).toMatchObject({ canExtend: false, reason, proposedEndAt: null });
});
```

Also test terminal current booking and a next booking that touches `proposedEndAt` without overlap.

- [ ] **Step 2: Run the new policy test and verify RED**

Run: `npm test -- tests/booking-extension-policy.test.ts`

Expected: module/function not found.

- [ ] **Step 3: Implement the smallest pure policy**

Calculate `proposedEndAt = booking.endAt + 180 minutes`; calculate the next Bangkok midnight from the local booking date; allow equality at 00:00 but reject values beyond it. Require the Booking local date to equal the Bangkok date of `now`, otherwise return `EXTENSION_BOOKING_INACTIVE`. Exclude the current booking by `bookingId` and reject active same-machine rows with standard half-open overlap.

- [ ] **Step 4: Run policy tests and verify GREEN**

Run: `npm test -- tests/booking-extension-policy.test.ts`

Expected: all decision branches pass.

- [ ] **Step 5: Commit policy and tests**

```bash
git add lib/booking/extension-policy.ts tests/booking-extension-policy.test.ts
git commit -m "feat: define booking extension policy"
```

---

### Task 4: Persist and Resolve TimeLock Sessions in Events

**Files:**
- Create: `tests/timelock-sheet-records.test.ts`
- Create: `lib/timelock/sheet-records.ts`
- Modify: `tests/timelock-api.test.ts`
- Modify: `lib/timelock/sheet-gateway.ts`

**Interfaces:**
- Produces: `parseTimelockUsers(rows)`, `parseTimelockEvents(rows)`, `resolveActiveSheetSession({ sessionId, machineCode, users, events, bookings })`
- Produces: `createSheetTimelockGateway(deps)` for deterministic Sheets client, clock and UUID injection; existing named exports delegate to the production instance
- Produces: resolved `{ sessionId, username, machineCode, booking, user }` or throws `SESSION_NOT_FOUND` / `ACCOUNT_MACHINE_MISMATCH`
- Modifies: successful `loginTimelockUser` appends `session_started`; `logoutTimelockUser` appends `session_ended`

- [ ] **Step 1: Write parser and active-session resolution tests**

```ts
it("resolves a started session to its active booking and user", () => {
  expect(resolveActiveSheetSession({ sessionId: "s-1", machineCode: "PC-001", users, events: [started], bookings: [booking] }))
    .toMatchObject({ sessionId: "s-1", username: "student", booking: { bookingId: "b-1" } });
});

it("rejects an ended session and a session from another machine", () => {
  expect(() => resolveActiveSheetSession({ sessionId: "s-1", machineCode: "PC-001", users, events: [started, ended], bookings: [booking] })).toThrow("SESSION_NOT_FOUND");
  expect(() => resolveActiveSheetSession({ sessionId: "s-1", machineCode: "PC-002", users, events: [started], bookings: [booking] })).toThrow("ACCOUNT_MACHINE_MISMATCH");
});
```

- [ ] **Step 2: Run the new tests and verify RED**

Run: `npm test -- tests/timelock-sheet-records.test.ts`

Expected: module/function not found.

- [ ] **Step 3: Implement strict User/Event parsing and resolution**

Use the existing exact sheet headers. Resolve the latest `session_started` by `sessionId`, reject if a later `session_ended` exists, then require matching active User by username/machine and active Booking by `sourceBookingId`.

- [ ] **Step 4: Add failing gateway tests for event rows on login/logout**

Refactor `sheet-gateway.ts` through `createSheetTimelockGateway({ sheets, now, randomId, atomicFetch })` while preserving existing route-facing exports. Assert that login appends:

```ts
[eventId, "session_started", sessionId, bookingId, "PC-001", "student", "active", "{}", now, now]
```

and logout appends `session_ended` with the same session ID.

- [ ] **Step 5: Run the gateway test and verify RED, then implement and verify GREEN**

Run before implementation: `npm test -- tests/timelock-sheet-records.test.ts tests/timelock-api.test.ts`

Run after implementation: same command; expected all pass.

- [ ] **Step 6: Commit session persistence files**

```bash
git add lib/timelock/sheet-records.ts lib/timelock/sheet-gateway.ts tests/timelock-sheet-records.test.ts tests/timelock-api.test.ts
git commit -m "feat: persist timelock sessions in sheets"
```

---

### Task 5: Add Extension Request Contracts and Route Handlers

**Files:**
- Modify: `tests/timelock-api.test.ts`
- Modify: `lib/timelock/requests.ts`
- Modify: `lib/timelock/http.ts`
- Create: `tests/timelock-extension-gateway.test.ts`
- Modify: `lib/timelock/sheet-gateway.ts`
- Create: `app/api/timelock/extension/check/route.ts`
- Create: `app/api/timelock/extension/confirm/route.ts`

**Interfaces:**
- Produces: `parseExtensionCheckRequest(body): { sessionId: string }`
- Produces: `parseExtensionConfirmRequest(body): { sessionId: string; idempotencyKey: string }`
- Produces: `checkTimelockExtension(device, input)` and `confirmTimelockExtension(device, input)`
- Confirm sends Apps Script operation `extend_booking` with server-resolved `sessionId`, `bookingId`, `machineCode`, `username` and client idempotency key

- [ ] **Step 1: Add request parser tests**

```ts
expect(parseExtensionCheckRequest({ sessionId: " s-1 " })).toEqual({ sessionId: "s-1" });
expect(parseExtensionConfirmRequest({ sessionId: "s-1", idempotencyKey: "req-1" })).toEqual({ sessionId: "s-1", idempotencyKey: "req-1" });
expect(() => parseExtensionConfirmRequest({ sessionId: "s-1" })).toThrow("EXTENSION_CONFIRM_INVALID");
```

- [ ] **Step 2: Run request tests and verify RED**

Run: `npm test -- tests/timelock-api.test.ts`

Expected: parser exports do not exist.

- [ ] **Step 3: Implement parsers and HTTP status mapping**

Map malformed bodies to 400, invalid/ended sessions to 404 or 403, and atomic queue conflict/limit/midnight codes to 409. Non-eligibility from check remains HTTP 200 with `canExtend: false`.

- [ ] **Step 4: Write gateway tests for check and atomic confirm**

Inject fake Sheet rows and fake atomic fetch. Assert check uses `evaluateBookingExtension`; assert confirm body has no client-selected duration/end time and contains only server-resolved references:

```ts
expect(body).toMatchObject({
  operation: "extend_booking",
  idempotencyKey: "req-1",
  payload: { sessionId: "s-1", bookingId: "b-1", machineCode: "PC-001", username: "student" },
});
expect(body.payload).not.toHaveProperty("proposedEndAt");
```

- [ ] **Step 5: Run gateway tests and verify RED, implement gateway methods, then verify GREEN**

Run: `npm test -- tests/timelock-api.test.ts tests/timelock-extension-gateway.test.ts`

Expected after implementation: all tests pass.

- [ ] **Step 6: Add the two POST Route Handlers**

Each route follows the current TimeLock pattern:

```ts
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const machine = await authenticateTimelockDevice(parseDeviceRequest(request.headers));
    const data = await checkTimelockExtension(machine, parseExtensionCheckRequest(await request.json()));
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return timelockErrorResponse(error, "EXTENSION_CHECK_FAILED");
  }
}
```

The confirm route uses `confirmTimelockExtension` and fallback `EXTENSION_CONFIRM_FAILED`.

- [ ] **Step 7: Run all TimeLock tests and commit**

Run: `npm test -- tests/timelock-api.test.ts tests/timelock-sheet-records.test.ts tests/timelock-extension-gateway.test.ts`

```bash
git add lib/timelock/requests.ts lib/timelock/http.ts lib/timelock/sheet-gateway.ts app/api/timelock/extension tests/timelock-api.test.ts tests/timelock-extension-gateway.test.ts
git commit -m "feat: add timelock extension api"
```

---

### Task 6: Implement Atomic Booking Extension in Apps Script

**Files:**
- Create: `tests/google-apps-script-contract.test.ts`
- Modify: `scripts/google-apps-script/Code.gs`
- Modify: `tests/booking-sheet-repository.test.ts`
- Modify: `lib/booking/sheet-repository.ts`

**Interfaces:**
- Apps Script consumes `operation: "extend_booking"`
- Apps Script returns `{ ok: true, data: { bookingId, endAt, extensionCount, allowedMinutes } }` or a stable extension code
- Existing `create_booking` enforces today and exact 180 minutes and writes `extensionCount = 0`

- [ ] **Step 1: Add Apps Script behavior and repository tests before Apps Script changes**

Load `Code.gs` as text and assert the operation dispatch and required function names are missing, so the test fails for the feature rather than formatting:

```ts
expect(source).toContain("body.operation === 'extend_booking'");
expect(source).toContain("function extendBooking_(body)");
expect(source).toContain("extensionCount: 0");
expect(source).toContain("BOOKING_DATE_NOT_ALLOWED");
```

Evaluate `Code.gs` in `node:vm` with fake `SpreadsheetApp`, `PropertiesService`, `LockService`, `Utilities` and in-memory sheets. Exercise `doPost` with `operation: "extend_booking"` and assert:

```ts
expect(success).toMatchObject({ ok: true, data: { bookingId: "b-1", extensionCount: 1, allowedMinutes: 360 } });
expect(bookings.row("b-1").endAt).toBe("2026-08-24T07:30:00.000Z");
expect(users.row("u-1").allowedMinutes).toBe(360);
expect(repeat).toEqual(success);
expect(bookings.row("b-1").extensionCount).toBe(1);
```

Add separate fixtures where a next Booking starts inside the proposed window and where the proposed end crosses midnight; expect the stable conflict/midnight codes and no modified rows.

Extend repository tests to verify create always sends a 180-minute interval and never accepts an arbitrary allowed-minute value from the browser-facing caller.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/google-apps-script-contract.test.ts tests/booking-sheet-repository.test.ts`

Expected: Apps Script lacks extension dispatch and the VM call returns `BOOKING_OPERATION_INVALID`.

- [ ] **Step 3: Implement Apps Script extension mutation under the existing lock**

`extendBooking_(body)` must:

1. Return stored result when an `booking_extended` Event contains the same idempotency key.
2. Resolve active `session_started` with no `session_ended` for the payload session/machine/username.
3. Load Booking and User by server-derived IDs.
4. Reject inactive booking, mismatched account, `extensionCount >= 2`, proposed end beyond Bangkok midnight, and active same-machine overlap in `[endAt, endAt + 180m)`.
5. Update Booking `endAt`, `extensionCount`, `updatedAt` and User `allowedMinutes`, `updatedAt` in the same script lock.
6. Append `booking_extended` Event whose JSON payload stores idempotency key and exact response; append AuditLog without secrets.

Also update `createBooking_` to require today in Bangkok, require exactly 180 minutes, and write `extensionCount: 0`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- tests/google-apps-script-contract.test.ts tests/booking-sheet-repository.test.ts tests/booking-extension-policy.test.ts`

Expected: all selected tests pass.

- [ ] **Step 5: Review complete Code.gs diff to preserve identity initializer changes, then commit**

```bash
git diff -- scripts/google-apps-script/Code.gs
git add scripts/google-apps-script/Code.gs tests/google-apps-script-contract.test.ts lib/booking/sheet-repository.ts tests/booking-sheet-repository.test.ts
git commit -m "feat: extend bookings atomically in sheets"
```

---

### Task 7: Add Idempotent Midnight Cleanup

**Files:**
- Modify: `tests/google-apps-script-contract.test.ts`
- Modify: `scripts/google-apps-script/Code.gs`

**Interfaces:**
- Produces Apps Script entry point `installDailyCleanupTrigger()`
- Produces trigger handler `dailyCleanupTick_()` using `LAST_DAILY_CLEANUP_DATE`
- Preserves row 1 in `Bookings` and `Users`; writes one audit row only when data was deleted

- [ ] **Step 1: Add failing cleanup contract tests**

```ts
expect(source).toContain("function installDailyCleanupTrigger()");
expect(source).toContain("everyMinutes(1)");
expect(source).toContain("LAST_DAILY_CLEANUP_DATE");
expect(source).toContain("function dailyCleanupTick_()");
```

Extend the Task 6 VM harness with fake `PropertiesService`, `SpreadsheetApp`, `LockService`, `ScriptApp` and sheets. Verify first install records today without deleting rows, first tick after date change deletes data rows but not headers, and a second tick is a no-op. Expose only cleanup functions to the test context; do not add production test hooks.

- [ ] **Step 2: Run cleanup tests and verify RED**

Run: `npm test -- tests/google-apps-script-contract.test.ts`

Expected: installer/handler absent.

- [ ] **Step 3: Implement trigger installation and cleanup**

Delete existing project triggers for `dailyCleanupTick_` before creating one `ScriptApp.newTrigger("dailyCleanupTick_").timeBased().everyMinutes(1).create()`. Installer sets the current Bangkok date. Handler acquires script lock, compares the date property, clears only rows 2 onward in Bookings/Users, updates the property, and appends an AuditLog row when deleted counts are non-zero.

- [ ] **Step 4: Run cleanup and full Apps Script tests and verify GREEN**

Run: `npm test -- tests/google-apps-script-contract.test.ts`

Expected: install, rollover delete and repeat no-op tests pass.

- [ ] **Step 5: Commit cleanup files**

```bash
git add scripts/google-apps-script/Code.gs tests/google-apps-script-contract.test.ts
git commit -m "feat: clear daily booking sheets after midnight"
```

---

### Task 8: Update WPF Contract, Setup Documentation and Live Sheet

**Files:**
- Modify: `docs/booking-api-contract.md`
- Modify: `README.md`
- Modify: `scripts/google-apps-script/Code.gs`

**Interfaces:**
- Documents exact check/confirm request and response fields, reason codes, 60-second blocking popup behavior and confirm idempotency
- Live Sheet migration adds `extensionCount` and sets `serviceWeekdays = 1,2,3,4,5,6,7`

- [ ] **Step 1: Update API contract with copy-ready WPF examples**

Document:

```http
POST /api/timelock/extension/check
x-machine-code: PC-001
x-device-token: <device token>
Content-Type: application/json

{"sessionId":"session-id"}
```

and confirm with `{"sessionId":"session-id","idempotencyKey":"uuid"}`. Include all reason codes and the rule: never extend client time until confirm succeeds.

- [ ] **Step 2: Update README migration/deployment instructions**

List the new Booking header, all-days setting, `installDailyCleanupTrigger()` authorization, Apps Script redeploy step and WPF rollout order. In the edited TimeLock Gateway section, replace the obsolete old-capitalization `Users` header instructions with the current Google-only schema; do not alter historical migration files.

- [ ] **Step 3: Run documentation/schema checks**

Run: `npm test -- tests/no-supabase-runtime.test.ts tests/google-sheet-schema.test.ts tests/google-apps-script-contract.test.ts`

Expected: all selected tests pass and docs contain no runtime Supabase instructions.

- [ ] **Step 4: Migrate the live Google Sheet with read-before-write verification**

Read current `Bookings` row 1 and the `serviceWeekdays` setting. If `Bookings` is header-only, append `extensionCount` as the final header and update the setting to `1,2,3,4,5,6,7`. If data rows exist, stop and report them rather than shifting a live schema without a migration backup. Re-read both values and report only header/settings metadata, never account or booking secrets.

- [ ] **Step 5: Deploy Apps Script or provide the exact manual handoff**

If an authenticated deployment mechanism is available, update the Apps Script project, create a new Web App version, preserve the `/exec` URL and invoke `installDailyCleanupTrigger()` once. Otherwise stop at a copy-ready `Code.gs` and guide the user through paste → Save → Deploy new version → Run installer; do not claim the live atomic backend is upgraded before this is done.

- [ ] **Step 6: Commit documentation changes after reviewing overlap with earlier README work**

```bash
git add docs/booking-api-contract.md README.md
git commit -m "docs: document daily extension workflow"
```

---

### Task 9: Full Verification and Handoff

**Files:**
- Verify all modified files
- Do not stage: `AGENTS.md`, `CLAUDE.md`

**Interfaces:**
- Confirms repository behavior, production build, live Sheet schema and deployment status

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test -- --run`

Expected: all test files and tests pass with zero failures.

- [ ] **Step 2: Run TypeScript and production build verification**

Run: `npx tsc --noEmit`

Run: `npm run build -- --webpack`

Expected: both commands exit 0; build lists both extension Route Handlers.

- [ ] **Step 3: Run repository safety checks**

Run: `git diff --check`

Run: `git status --short`

Confirm secrets are not staged, Supabase runtime test passes, and unrelated user files remain untouched.

- [ ] **Step 4: Verify live backend boundaries**

First read the live Sheet and confirm there are no real Booking rows. Only with explicit approval, create a named verification Booking and session, then verify today-only booking, extension check, conflict rejection, confirm idempotency, `extensionCount`/`allowedMinutes` updates and cleanup handler behavior; remove only the named verification rows afterward. If the Sheet contains real data or no test Device Token is available, perform read-only checks and report the unverified end-to-end cases instead of mutating data.

- [ ] **Step 5: Report exact completion boundary**

Report backend/API/Sheet/Apps Script pieces that are live, automated evidence, and the remaining WPF work on the other computer. Explicitly state that popup and forced logout are not end-to-end complete until the WPF client consumes the new endpoints.
