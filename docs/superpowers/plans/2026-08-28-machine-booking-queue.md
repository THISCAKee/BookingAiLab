# Machine Booking Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มคิวจองต่อเครื่องที่เว้น 15 นาทีและใช้งานรอบละ 180 นาที พร้อมป้องกันการจองซ้ำข้ามเครื่องและบังคับช่วงเวลาเข้าใช้ใน TimeLock

**Architecture:** Next.js อ่าน `Machines` และ `Bookings` เพื่อสร้าง preview ต่อเครื่อง แต่ส่งให้ Apps Script เฉพาะ `machineId`, identity ที่ยืนยันแล้ว, credential verifier และ idempotency key จากนั้น Apps Script คำนวณช่วงเวลาจริงใหม่ภายใต้ Script Lock ก่อนเขียนทุก row. TimeLock ผูก `Users.sourceBookingId` กลับไปยัง Booking และอนุญาต login/sync เฉพาะเมื่อเวลาปัจจุบันอยู่ใน `[startAt, endAt)`.

**Tech Stack:** Next.js App Router 16.3.1, React 19 server actions, TypeScript, Google Sheets API, Google Apps Script, Vitest 3

**Spec:** `docs/superpowers/specs/2026-08-28-machine-booking-queue-design.md`

## Global Constraints

- ใช้แท็บ `Bookings` เดิมเป็นข้อมูลจริงของคิวและไม่เพิ่มแท็บใหม่
- Booking ใหม่เริ่มต่อจากปลายคิว 15 นาทีและยาว 180 นาที
- ห้าม Booking ใหม่สิ้นสุดหลังเที่ยงคืนตาม `Asia/Bangkok`
- ผู้ใช้มี Booking ที่ยังมีผลได้เพียงหนึ่งรายการในระบบทุกเครื่อง
- สถานะ terminal คือ `cancelled`, `completed`, `expired`; Booking ที่ `endAt <= now` ไม่ขวางคิวหรือผู้ใช้
- เวลาของ Booking ที่ยืนยันแล้วคงที่; cancellation หรือ logout ก่อนเวลาไม่เลื่อนคิวอื่น
- Username TimeLock ใช้ซ้ำได้ แต่ทุก Booking ต้องได้ Password ใหม่และห้ามบันทึก plaintext password
- Apps Script เป็น authority ของ `startAt`/`endAt`; Next.js และ browser ห้ามส่งเวลาที่ mutation เชื่อถือ
- Login และ sync ใช้ช่วงครึ่งเปิด `startAt <= now < endAt`
- การต่อเวลาเพิ่ม `endAt` ครั้งละ 180 นาที, คืน `allowedMinutes: 180` ทุกครั้ง และห้ามทับ Booking ถัดไป
- อ่าน `node_modules/next/dist/docs/01-app/02-guides/forms.md`, `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, และ `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` ก่อนแก้โค้ด Next.js ที่เกี่ยวข้อง
- รักษา user changes ใน `.gitignore`, `AGENTS.md`, และ `CLAUDE.md`; ห้าม stage ไฟล์เหล่านี้
- ทุก task ใช้ TDD: สร้าง failure ที่เจาะจง, implement ขั้นต่ำ, รัน targeted tests, แล้ว commit เฉพาะไฟล์ใน task

## File Structure

- Create `lib/booking/queue-policy.ts`: policy บริสุทธิ์สำหรับ effective booking, viewer eligibility และ preview slot ต่อเครื่อง
- Create `tests/booking-queue-policy.test.ts`: boundary tests ของเวลา, terminal status, queue gap และ Bangkok midnight
- Modify `lib/booking/actions.ts`: เปลี่ยน public contract ให้เป็นข้อมูลต่อเครื่องและใช้ identity ของ viewer
- Modify `lib/booking/sheet-repository.ts`: ส่ง atomic request โดยไม่มี `startAt`/`endAt` จาก Next.js และใช้เวลาที่ Apps Script คืนมา
- Modify `scripts/google-apps-script/Code.gs`: คำนวณ authoritative tail slot, ตรวจ active booking ของผู้ใช้ และเขียนผลภายใต้ lock
- Modify `components/booking/public-booking-board.tsx`: แสดงสถานะ/เวลา/จำนวนคิวและปิดทั้งหน้าเมื่อ viewer มี Booking
- Modify `components/booking/booking-result-panel.tsx`: แสดงเวลาจริงจาก mutation และบอกว่า credential ใช้ได้เมื่อถึง `startAt`
- Modify `lib/timelock/sheet-gateway.ts`: ตรวจ booking time window ก่อน event และกรอง offline sync ด้วย Booking
- Modify `lib/timelock/http.ts`: map stable TimeLock eligibility codes เป็น HTTP status
- Modify `lib/booking/extension-policy.ts`: รักษา collision rule กับ Booking ถัดไปและ per-extension allowance contract
- Modify `docs/booking-api-contract.md`: เอกสาร queue, TimeLock errors/sync และ WPF scheduled resync dependency
- Modify `README.md`: rollout order และ operational verification

---

### Task 1: Add the pure booking queue policy

**Files:**
- Create: `lib/booking/queue-policy.ts`
- Create: `tests/booking-queue-policy.test.ts`

**Interfaces:**
- Consumes: `SheetBooking`, `SheetMachine`, a verified viewer email, and a server `Date`.
- Produces: `isEffectiveBooking(booking: SheetBooking, now: Date): boolean`.
- Produces: `deriveMachineQueueOption(input: { machine: SheetMachine; bookings: SheetBooking[]; now: Date }): QueueMachineOption`.
- Produces: `viewerHasEffectiveBooking(input: { bookings: SheetBooking[]; email: string; now: Date }): boolean`.
- `QueueMachineOption` has `operationalStatus`, `bookable`, `nextStartAt`, `nextEndAt`, `queueCount`, and `currentEndAt`.

- [ ] **Step 1: Write the failing queue policy tests**

Create fixtures through a small `booking(overrides)` factory and assert the exact cases below:

```ts
expect(deriveMachineQueueOption({ machine, bookings: [], now })).toMatchObject({
  operationalStatus: "available",
  bookable: true,
  nextStartAt: "2026-08-24T03:00:00.000Z",
  nextEndAt: "2026-08-24T06:00:00.000Z",
  queueCount: 0,
  currentEndAt: null,
});

expect(deriveMachineQueueOption({
  machine,
  bookings: [
    booking({ startAt: "2026-08-24T02:00:00.000Z", endAt: "2026-08-24T05:00:00.000Z" }),
    booking({ bookingId: "b-2", startAt: "2026-08-24T05:15:00.000Z", endAt: "2026-08-24T08:15:00.000Z" }),
  ],
  now,
})).toMatchObject({
  operationalStatus: "in_use",
  nextStartAt: "2026-08-24T08:30:00.000Z",
  nextEndAt: "2026-08-24T11:30:00.000Z",
  queueCount: 1,
  currentEndAt: "2026-08-24T05:00:00.000Z",
});
```

Also assert: future-only rows produce `queued`; cancelled/completed/expired and `endAt === now` are ignored; cancelling the tail reuses its released tail without changing another confirmed row; a slot ending after Bangkok midnight returns `full_today`, `bookable: false`, and null next times; matching current/future viewer bookings return true while terminal/ended bookings return false.

- [ ] **Step 2: Run the policy test and verify RED**

Run: `npm test -- tests/booking-queue-policy.test.ts`

Expected: FAIL because `@/lib/booking/queue-policy` does not exist.

- [ ] **Step 3: Implement the minimal pure policy**

Create these exact exports and constants:

```ts
export type QueueOperationalStatus = "available" | "in_use" | "queued" | "full_today";
export type QueueMachineOption = {
  operationalStatus: QueueOperationalStatus;
  bookable: boolean;
  nextStartAt: string | null;
  nextEndAt: string | null;
  queueCount: number;
  currentEndAt: string | null;
};

const SLOT_MS = 180 * 60_000;
const TURNAROUND_MS = 15 * 60_000;
const TERMINAL = new Set(["cancelled", "completed", "expired"]);
```

Use `endAt > now` for effectiveness, `startAt <= now && now < endAt` for the current booking, and `startAt > now` for `queueCount`. Compute the tail from the maximum effective `endAt`; compute Bangkok midnight with an explicit `+07:00` boundary. A machine whose Sheet status is not `available` must return `bookable: false`; use `full_today` so the public four-state contract remains exhaustive.

- [ ] **Step 4: Run the policy test and verify GREEN**

Run: `npm test -- tests/booking-queue-policy.test.ts`

Expected: PASS for empty, multi-row, terminal, cancellation, viewer and midnight boundaries.

- [ ] **Step 5: Commit the policy unit**

```bash
git add lib/booking/queue-policy.ts tests/booking-queue-policy.test.ts
git commit -m "feat: add machine booking queue policy"
```

### Task 2: Make the atomic request machine-only

**Files:**
- Modify: `lib/booking/sheet-repository.ts`
- Modify: `tests/booking-sheet-repository.test.ts`

**Interfaces:**
- Consumes: `createSheetBooking({ machineId, idempotencyKey }, identity, options)`.
- Produces: `CreatedSheetBooking` containing authoritative `startAt`, `endAt`, booking metadata, and the one-time TimeLock password generated for this request.
- Sends: verified identity, machine ID, password verifier, fixed `allowedMinutes: 180`, and no client-authored booking times.

- [ ] **Step 1: Change the repository test to reject client-authored times**

Use the Apps Script response as the only time source:

```ts
const responseData = {
  bookingId: "b-1",
  bookingNumber: "BK-1",
  machineCode: "PC-001",
  startAt: "2026-08-24T05:15:00.000Z",
  endAt: "2026-08-24T08:15:00.000Z",
  status: "confirmed",
  manageCode: "ABCD-1234",
};
const result = await createSheetBooking(
  { machineId: "m-1", idempotencyKey: "request-1" },
  identity,
  { url, secret, fetchImpl },
);
const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
expect(body.payload).not.toHaveProperty("startAt");
expect(body.payload).not.toHaveProperty("endAt");
expect(body.payload.account.allowedMinutes).toBe(180);
expect(result).toMatchObject(responseData);
```

Add a retry fixture whose first response is `{ ok: false, code: "BOOKING_ATOMIC_BUSY" }` and second response succeeds. Assert both captured request bodies have the same `idempotencyKey`, `passwordSalt`, and `passwordHash`. Update the timeout fixture to abort both attempts and then expect `BOOKING_ATOMIC_TIMEOUT`; update missing-configuration calls to the same two-field input.

- [ ] **Step 2: Run the repository test and verify RED**

Run: `npm test -- tests/booking-sheet-repository.test.ts`

Expected: FAIL because the current input requires `startAt` and serializes it.

- [ ] **Step 3: Remove time calculation from the repository**

Change the input signature to `{ machineId: string; idempotencyKey: string }`, set `account.allowedMinutes` directly to `180`, omit `startAt`/`endAt` from JSON, and build the password verifier plus serialized request body once. Use at most two fetch attempts with that identical body; retry only `BOOKING_ATOMIC_BUSY` or an aborted/timeout attempt, and throw the stable code after the second failure. Validate that a success response has non-empty string `startAt` and `endAt` before attaching `timelockUsername` and the one plaintext `timelockPassword` generated before the loop. Throw `BOOKING_ATOMIC_FAILED` for a malformed success response.

- [ ] **Step 4: Run the repository test and verify GREEN**

Run: `npm test -- tests/booking-sheet-repository.test.ts`

Expected: PASS; the payload contains no booking time fields and retry attempts reuse the exact idempotency key and password verifier.

- [ ] **Step 5: Commit the authority boundary**

```bash
git add lib/booking/sheet-repository.ts tests/booking-sheet-repository.test.ts
git commit -m "refactor: make booking time server authoritative"
```

### Task 3: Compute and persist the authoritative queue in Apps Script

**Files:**
- Modify: `scripts/google-apps-script/Code.gs`
- Modify: `tests/google-apps-script.test.ts`

**Interfaces:**
- Consumes: `create_booking` with `payload.machineId`, verified identity/account and no time fields.
- Produces: `createBooking_(body, currentTime)` response with authoritative `startAt` and `endAt`.
- Maintains: one effective Booking per email, multiple ordered Bookings per machine, 15-minute gap and idempotent Event/Audit side effects under the existing Script Lock.

- [ ] **Step 1: Rewrite the Apps Script create tests around queue authority**

Remove `startAt`/`endAt` from `createBody.payload` and assert:

```ts
const first = context.createBooking_(createBody, new Date("2026-08-24T03:00:00.000Z"));
expect(first.data).toMatchObject({
  startAt: "2026-08-24T03:00:00.000Z",
  endAt: "2026-08-24T06:00:00.000Z",
});

const second = context.createBooking_({
  ...createBody,
  idempotencyKey: "create-2",
  payload: { ...createBody.payload, email: "other@msu.ac.th", emailPrefix: "other", account: { ...createBody.payload.account, username: "other" } },
}, new Date("2026-08-24T03:01:00.000Z"));
expect(second.data).toMatchObject({
  startAt: "2026-08-24T06:15:00.000Z",
  endAt: "2026-08-24T09:15:00.000Z",
});
```

Add cases for multiple tails, terminal/ended rows, `BOOKING_ALREADY_ACTIVE` on the same email across another machine, `BOOKING_CROSSES_MIDNIGHT`, machine status `BOOKING_MACHINE_UNAVAILABLE`, and cancellation preserving later confirmed timestamps. Keep the existing duplicate-key assertions that Event and Audit row counts do not increase.

- [ ] **Step 2: Run the Apps Script tests and verify RED**

Run: `npm test -- tests/google-apps-script.test.ts`

Expected: FAIL because `createBooking_` currently parses client times and rejects overlaps instead of appending a queue slot.

- [ ] **Step 3: Implement authoritative slot helpers and mutation**

Add `effectiveBooking_(row, index, now)` and `nextQueueSlot_(rows, index, machineId, now)`. In `createBooking_`, check the duplicate idempotency row first, then the machine, then any effective row whose email matches case-insensitively. Compute `start = now` when no effective machine row exists; otherwise use `max(endAt) + 15 minutes`; compute `end = start + 180 minutes`; reject a different Bangkok date or an end after Bangkok midnight. Write `start.toISOString()` and `end.toISOString()` into Booking, Event, Audit and response fields. Do not read `body.payload.startAt` or `body.payload.endAt` anywhere.

- [ ] **Step 4: Run the Apps Script tests and verify GREEN**

Run: `npm test -- tests/google-apps-script.test.ts`

Expected: PASS including sequential queue, active-user rejection, midnight, cancellation, idempotency, existing extension, and cleanup tests.

- [ ] **Step 5: Commit the atomic queue mutation**

```bash
git add scripts/google-apps-script/Code.gs tests/google-apps-script.test.ts
git commit -m "feat: create authoritative machine queue slots"
```

### Task 4: Expose queue previews and viewer eligibility from booking actions

**Files:**
- Modify: `lib/booking/actions.ts`
- Modify: `lib/booking/action-utils.ts`
- Modify: `tests/booking-actions.test.ts`
- Create: `tests/booking-options.test.ts`

**Interfaces:**
- Consumes: Task 1 policy, `requireGoogleIdentity()`, Sheets `Machines`/`Bookings`, and Task 2 repository.
- Produces: `PublicMachineOption = identity fields & QueueMachineOption`.
- Produces: `PublicBookingOptions = { date, viewerCanBook, viewerBlockReason, viewerBookingEndAt, machines }` where the block reason is `"BOOKING_ALREADY_ACTIVE" | null`.
- `createImmediateBooking({ machineId })` returns Apps Script `startAt`/`endAt` unchanged.

- [ ] **Step 1: Read the installed Next.js server action guide**

Run: `sed -n '1,240p' node_modules/next/dist/docs/01-app/02-guides/server-actions.md`

Expected: confirm the current `"use server"` action boundary and serializable return contract are valid for Next.js 16.3.1.

- [ ] **Step 2: Write failing action and option tests**

Export a pure `buildPublicBookingOptions` for fixture testing and assert this shape:

```ts
expect(options).toEqual({
  date: "2026-08-24",
  viewerCanBook: false,
  viewerBlockReason: "BOOKING_ALREADY_ACTIVE",
  viewerBookingEndAt: "2026-08-24T06:00:00.000Z",
  machines: expect.arrayContaining([
    expect.objectContaining({
      id: "m-1",
      operationalStatus: "in_use",
      bookable: true,
      nextStartAt: "2026-08-24T06:15:00.000Z",
      nextEndAt: "2026-08-24T09:15:00.000Z",
    }),
  ]),
});
```

Assert that `createImmediateBooking` calls `createSheetBooking` without preview times and returns the mutation’s `startAt`/`endAt`. Extend error mappings for `BOOKING_ATOMIC_BUSY`, `BOOKING_MACHINE_UNAVAILABLE`, and `BOOKING_ALREADY_ACTIVE` with actionable Thai text; `BOOKING_ATOMIC_BUSY` must be retryable while active/midnight failures are not.

- [ ] **Step 3: Run action tests and verify RED**

Run: `npm test -- tests/booking-actions.test.ts tests/booking-options.test.ts tests/booking-action-result.test.ts`

Expected: FAIL because the old contract has one page-level window and boolean `available`.

- [ ] **Step 4: Implement the queue action contract**

Replace `bookingOptions` with `buildPublicBookingOptions`, derive each machine through Task 1, and obtain the viewer email through `requireGoogleIdentity`. Keep the requested date limited to the Bangkok current date. Remove `getImmediateBookingWindow` from `createImmediateBooking`; call `createSheetBooking({ machineId, idempotencyKey: randomUUID() }, identity)` and copy the returned authoritative times. Keep safe generic fallback errors.

- [ ] **Step 5: Run action tests and verify GREEN**

Run: `npm test -- tests/booking-actions.test.ts tests/booking-options.test.ts tests/booking-action-result.test.ts tests/booking-sheet-repository.test.ts`

Expected: PASS with no page-level `startAt`/`endAt` dependency.

- [ ] **Step 6: Commit the public queue contract**

```bash
git add lib/booking/actions.ts lib/booking/action-utils.ts tests/booking-actions.test.ts tests/booking-options.test.ts tests/booking-action-result.test.ts
git commit -m "feat: expose machine queue booking options"
```

### Task 5: Render queue status, scheduled time and global viewer lock

**Files:**
- Modify: `app/booking/page.tsx`
- Modify: `components/booking/public-booking-board.tsx`
- Modify: `components/booking/booking-result-panel.tsx`
- Modify: `tests/public-booking-board.test.ts`
- Modify: `tests/public-booking-result.test.tsx`

**Interfaces:**
- Consumes: `PublicBookingOptions` and authoritative `CreatedBooking` from Task 4.
- Produces: Thai labels `ว่าง`, `ใช้งานอยู่`, `มีคิว`, `คิวเต็มสำหรับวันนี้`; scheduled start/end, current end and queue count.
- Disables every radio/submit when `viewerCanBook === false` without relying on the browser for enforcement.

- [ ] **Step 1: Read the installed Next.js forms guide**

Run: `sed -n '1,260p' node_modules/next/dist/docs/01-app/02-guides/forms.md`

Expected: confirm `useActionState`, pending state and server-side validation behavior for Next.js 16.3.1/React 19.

- [ ] **Step 2: Write failing source and render tests**

Extend the board assertions to require all four labels plus `เข้าใช้ได้`, `คิวรอ`, and the viewer lock message `กรุณารอให้ Session หรือการจองปัจจุบันสิ้นสุดก่อนจองใหม่`. Render `BookingResultPanel` with a future start and assert `เข้าใช้งาน TimeLock ได้ตั้งแต่` and both authoritative formatted times; assert `เริ่มทันที` is absent for a future booking.

- [ ] **Step 3: Run UI tests and verify RED**

Run: `npm test -- tests/public-booking-board.test.ts tests/public-booking-result.test.tsx tests/public-booking-nav.test.tsx`

Expected: FAIL because cards still use `available`/`ถูกจอง` and a single immediate window.

- [ ] **Step 4: Implement the queue card states**

Use a typed label map keyed by `QueueOperationalStatus`. Each card formats its own `nextStartAt`/`nextEndAt`, shows `currentEndAt` for `in_use`, and shows `queueCount` when positive. A card radio is disabled when `!machine.bookable || !initialOptions.viewerCanBook`. Replace the left-side immediate window with a short explanation of 180-minute slots and 15-minute turnaround. Disable submit by the same conditions and show the viewer lock alert once above the cards.

- [ ] **Step 5: Make the confirmation use only authoritative mutation times**

Change success copy from `เริ่มทันที` to `เข้าใช้ได้ตามช่วงเวลาที่ยืนยัน` and render a future-start warning. Do not retain or compare the preview slot after success; use only `state.booking.startAt` and `state.booking.endAt`.

- [ ] **Step 6: Run UI tests and verify GREEN**

Run: `npm test -- tests/public-booking-board.test.ts tests/public-booking-result.test.tsx tests/public-booking-nav.test.tsx tests/booking-action-result.test.ts`

Expected: PASS for status copy, disabled state, future credential warning and accessible pending dialog.

- [ ] **Step 7: Commit the queue UI**

```bash
git add app/booking/page.tsx components/booking/public-booking-board.tsx components/booking/booking-result-panel.tsx tests/public-booking-board.test.ts tests/public-booking-result.test.tsx
git commit -m "feat: show machine queue availability"
```

### Task 6: Enforce scheduled TimeLock login and offline sync

**Files:**
- Modify: `lib/timelock/sheet-gateway.ts`
- Modify: `lib/timelock/http.ts`
- Modify: `tests/timelock-sheet-gateway.test.ts`
- Modify: `tests/timelock-api.test.ts`
- Create: `tests/timelock-sync.test.ts`

**Interfaces:**
- Consumes: active TimeLock user, matching non-terminal Booking and server clock.
- Produces: `BOOKING_NOT_STARTED` when `now < startAt`, `BOOKING_EXPIRED` when `now >= endAt`, with no `session_started` event.
- Produces: offline accounts only for matching machine bookings satisfying `startAt <= now < endAt`.

- [ ] **Step 1: Read the installed Next.js route handler guide**

Run: `sed -n '1,260p' node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`

Expected: confirm Node runtime route handlers and `NextResponse.json` status responses for Next.js 16.3.1.

- [ ] **Step 2: Write failing login boundary tests**

Add table cases at one millisecond before start, exactly start, one millisecond before end, and exactly end:

```ts
await expect(loginAt("2026-08-24T01:29:59.999Z")).rejects.toThrow("BOOKING_NOT_STARTED");
await expect(loginAt("2026-08-24T01:30:00.000Z")).resolves.toMatchObject({ bookingId: "b-1" });
await expect(loginAt("2026-08-24T04:29:59.999Z")).resolves.toMatchObject({ bookingId: "b-1" });
await expect(loginAt("2026-08-24T04:30:00.000Z")).rejects.toThrow("BOOKING_EXPIRED");
```

For both rejected cases assert `appendSheetRow` was not called. Add API tests expecting HTTP 409 and `{ ok: false, code: "BOOKING_NOT_STARTED" }` / `{ ok: false, code: "BOOKING_EXPIRED" }`.

- [ ] **Step 3: Write failing sync eligibility tests**

Make `syncTimelockDevice(device, options)` accept injected Sheets and clock. Supply active Users for current, future, expired, cancelled and wrong-machine bookings; expect only the current matching account in the result.

- [ ] **Step 4: Run TimeLock tests and verify RED**

Run: `npm test -- tests/timelock-sheet-gateway.test.ts tests/timelock-api.test.ts tests/timelock-sync.test.ts`

Expected: FAIL because login does not compare time and sync filters only `Users.isActive`/machine code.

- [ ] **Step 5: Implement one eligibility resolver shared by login and sync**

Add an internal resolver that matches `sourceBookingId`, machine code and normalized username/email prefix, then checks terminal status and the half-open time window. Login verifies password first, resolves the Booking, throws the two stable codes before creating IDs/events, and uses `deps.now()` exactly once. Sync reads `Users` and `Bookings` together through injected dependencies, drops unmatched/future/expired/terminal rows, and passes the injected time to `buildOfflineAccount`.

- [ ] **Step 6: Map stable HTTP responses and run tests GREEN**

Add `BOOKING_NOT_STARTED: 409` and `BOOKING_EXPIRED: 409` to `lib/timelock/http.ts`, then run:

Run: `npm test -- tests/timelock-sheet-gateway.test.ts tests/timelock-api.test.ts tests/timelock-sync.test.ts`

Expected: PASS and rejected login cases append no session event.

- [ ] **Step 7: Commit TimeLock eligibility**

```bash
git add lib/timelock/sheet-gateway.ts lib/timelock/http.ts tests/timelock-sheet-gateway.test.ts tests/timelock-api.test.ts tests/timelock-sync.test.ts
git commit -m "feat: enforce timelock booking windows"
```

### Task 7: Lock extension behavior against queued bookings

**Files:**
- Modify: `lib/booking/extension-policy.ts`
- Modify: `tests/booking-extension-policy.test.ts`
- Modify: `scripts/google-apps-script/Code.gs`
- Modify: `tests/google-apps-script.test.ts`
- Modify: `tests/timelock-extension-gateway.test.ts`

**Interfaces:**
- Consumes: current Booking, all machine Bookings and a proposed 180-minute extension.
- Produces: `EXTENSION_NEXT_BOOKING_CONFLICT` whenever proposed use reaches beyond the next Booking start; preserves `allowedMinutes: 180` on each successful extension.

- [ ] **Step 1: Add exact turnaround conflict regressions**

Add policy and Apps Script fixtures where the next Booking starts 15 minutes after current `endAt`. Assert a 180-minute extension is rejected and no Booking/User/Event/Audit row changes. Keep the success expectation exact:

```ts
expect(success.data).toMatchObject({
  endAt: "2026-08-24T07:30:00.000Z",
  extensionCount: 1,
  allowedMinutes: 180,
});
```

Also keep the gateway fake response at `allowedMinutes: 180`; do not expect cumulative 360/540.

- [ ] **Step 2: Run extension tests and verify the regression state**

Run: `npm test -- tests/booking-extension-policy.test.ts tests/google-apps-script.test.ts tests/timelock-extension-gateway.test.ts`

Expected: the new 15-minute-tail assertion must fail if either policy permits consuming the turnaround; existing local `allowedMinutes: 180` assertions must remain green.

- [ ] **Step 3: Keep one explicit overlap rule in both policy implementations**

For every non-terminal Booking on the same machine, reject when `next.startAt < proposedEndAt && currentEndAt < next.endAt`. Do not subtract or consume the 15-minute turnaround, do not shift the next Booking, and keep Apps Script `const allowedMinutes = 180`.

- [ ] **Step 4: Run extension tests and verify GREEN**

Run: `npm test -- tests/booking-extension-policy.test.ts tests/google-apps-script.test.ts tests/timelock-extension-gateway.test.ts`

Expected: PASS for exact-end allowance, 15-minute queued conflict, midnight, limit, idempotency and per-extension 180-minute allowance.

- [ ] **Step 5: Commit extension queue safety and the preserved 180-minute changes**

```bash
git add lib/booking/extension-policy.ts tests/booking-extension-policy.test.ts scripts/google-apps-script/Code.gs tests/google-apps-script.test.ts tests/timelock-extension-gateway.test.ts
git commit -m "fix: protect queued bookings from extensions"
```

### Task 8: Document the queue and WPF rollout contract

**Files:**
- Modify: `docs/booking-api-contract.md`
- Modify: `README.md`
- Modify: `tests/timelock-api.test.ts`
- Modify: `tests/booking-sheet-repository.test.ts`

**Interfaces:**
- Documents: machine-only create boundary, authoritative returned slot, stable error codes, TimeLock half-open window and current-only sync.
- Produces: an explicit WPF rollout checklist; WPF source remains outside this repository.

- [ ] **Step 1: Add an executable contract source test**

Extend `tests/timelock-api.test.ts` to assert login responses never include password verifier fields and that eligibility errors expose only `{ ok, code }`. Extend `tests/booking-sheet-repository.test.ts` to assert the mutation request contains no `startAt`/`endAt`.

- [ ] **Step 2: Run contract tests before documentation**

Run: `npm test -- tests/timelock-api.test.ts tests/booking-sheet-repository.test.ts`

Expected: PASS, proving the examples to be documented match executable behavior.

- [ ] **Step 3: Update the API contract with exact examples**

Document `BOOKING_ALREADY_ACTIVE`, `BOOKING_CROSSES_MIDNIGHT`, `BOOKING_MACHINE_UNAVAILABLE`, `BOOKING_ATOMIC_BUSY`, `BOOKING_NOT_STARTED`, `BOOKING_EXPIRED`, and `EXTENSION_NEXT_BOOKING_CONFLICT`. State that sync omits future/expired accounts and WPF must schedule a fresh `/api/timelock/sync` at the displayed `startAt`, discard offline verifiers at `endAt`, and show the returned code without attempting offline fallback before start.

- [ ] **Step 4: Add rollout and manual verification steps to README**

Record this exact order: deploy Apps Script; deploy BookingAiLab; update WPF; then test one machine with two accounts. Include checks that account B cannot offline-login early, can sync/login at its fixed scheduled start, and account A cannot book any machine until its own Booking ends or becomes terminal.

- [ ] **Step 5: Verify docs and commit**

Run: `git diff --check`

Expected: no whitespace errors.

```bash
git add docs/booking-api-contract.md README.md tests/timelock-api.test.ts tests/booking-sheet-repository.test.ts
git commit -m "docs: define machine queue rollout contract"
```

### Task 9: Run full verification and prepare the deployment handoff

**Files:**
- No production files unless a concrete verification failure requires a scoped fix and regression test.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: a verified commit series ready for Apps Script-first deployment; does not deploy WPF because its source is outside this repository.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: every Vitest test passes, including queue, Apps Script, UI, TimeLock, extension and previous credential-revocation coverage.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: Next.js 16.3.1 production compilation, TypeScript checks and route generation complete successfully.

- [ ] **Step 3: Check formatting and worktree scope**

Run: `git diff --check` and `git status --short`

Expected: no whitespace errors; only intentional queue work or preserved user-owned `.gitignore`, `AGENTS.md`, and `CLAUDE.md` changes remain.

- [ ] **Step 4: Review commit and rollout order**

Run: `git log --oneline --decorate -12`

Expected: focused commits for queue policy, authority boundary, Apps Script mutation, public contract/UI, TimeLock eligibility, extension safety and docs. Deploy Apps Script before pushing the Backend/UI release, and do not enable production queueing until the WPF scheduled-resync dependency is confirmed.
