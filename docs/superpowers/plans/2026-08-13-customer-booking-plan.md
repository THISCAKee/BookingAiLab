# Phase 4 Customer Booking Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** ให้ผู้ใช้มหาวิทยาลัยจองเครื่องที่ว่างได้ทันทีครั้งละ 3 ชั่วโมง พร้อมยกเลิก/ดูรายการของตนเอง และให้ Super Admin ปรับกติกาเวลาใช้งานผ่านหน้าเว็บได้ โดยไม่มีระบบชำระเงิน

**Architecture:** ใช้ server actions/route handlers เป็น boundary ของการจองและตรวจ session จาก Supabase ทุกครั้ง การสร้าง Booking, การตรวจสิทธิ์จองซ้ำ และการสร้าง machine event จะอยู่ใน PostgreSQL function transaction เดียวเพื่อให้การกดพร้อมกันปลอดภัย Settings เป็น global row ใน `booking_settings` และแก้ได้เฉพาะ active `super_admin` ผ่าน RLS และ server validation

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 4, Supabase SSR, PostgreSQL migrations/RPC/RLS, Vitest, pgTAP ผ่าน `supabase db query --linked` (ไม่ใช้ Docker)

## Global Constraints

- Booking ฟรีเท่านั้น: ห้ามเพิ่ม payment provider, payment fields, payment status หรือ payment workflow
- อนุญาตเฉพาะ authenticated Google user ที่มี email ลงท้ายด้วย `@msu.ac.th`
- เวลาเริ่ม Booking ใช้เวลาปัจจุบันของ Server และแสดงผลใน `Asia/Bangkok`; ผู้ใช้ไม่เลือกเวลาและไม่เลือก duration
- ค่าเริ่มต้น: จันทร์–ศุกร์ `08:30–16:30`, duration `180` นาที, no-show grace `15` นาที
- หากเวลาปัจจุบันบวก duration เกินเวลาปิด จะไม่รับ Booking ใหม่
- ผู้ใช้มี Booking ที่ยังไม่เป็น terminal state ได้ไม่เกิน 1 รายการ
- ยกเลิกก่อนเริ่มแล้วจองใหม่ได้ทันที
- Booking ที่ไม่เริ่มภายใน grace period ต้องเปลี่ยนเป็น `expired` ก่อน slot จะถูกใช้ซ้ำ
- Browser และ WPF ห้ามมี Supabase Service Role Key
- ห้ามแก้ WPF และห้ามสร้าง Machine API ใน Phase 4
- การแก้ Settings มีผลเฉพาะ Booking ใหม่; Booking เดิมใช้ timestamp ที่บันทึกไว้

---

### Task 1: Booking policy domain rules

**Files:**
- Create: `lib/booking/policy.ts`
- Test: `tests/booking-policy.test.ts`

**Interfaces:**
- `BookingPolicySettings`: `{ weekdays: number[]; openingTime: string; closingTime: string; durationMinutes: number; graceMinutes: number; timezone: string }`
- `getBookingAvailability(now: Date, settings: BookingPolicySettings): { allowed: boolean; code: string; startAt: Date; endAt: Date }`
- `isBookingTerminal(status: BookingStatus): boolean`

- [ ] **Step 1: Write failing tests** for Bangkok weekday boundaries, fixed duration, 13:30 cutoff, weekend denial, invalid settings, terminal statuses and grace expiration calculation.
- [ ] **Step 2: Run `npm test tests/booking-policy.test.ts`** and confirm failure because the module does not exist.
- [ ] **Step 3: Implement pure UTC/`Intl.DateTimeFormat` conversion rules** without reading environment variables or Supabase inside the module.
- [ ] **Step 4: Run the focused test and then `npm test`**; all policy and existing tests must pass.
- [ ] **Step 5: Commit** with `feat: add booking policy rules`.

### Task 2: Booking settings migration and RLS

**Files:**
- Create: `supabase/migrations/202608140001_booking_settings.sql`
- Create: `supabase/tests/database/04_booking_settings.test.sql`
- Modify: `docs/superpowers/specs/2026-08-13-database-design.md` only if the stored settings contract needs documenting

**Interfaces:**
- Table `public.booking_settings`: one global row with `id`, `service_weekdays integer[]`, `opening_time time`, `closing_time time`, `duration_minutes integer`, `grace_minutes integer`, `timezone text`, timestamps
- RPC support functions may read the active settings row, but only server workflows may mutate Booking state

- [ ] **Step 1: Write pgTAP tests** for one valid default row, constraints (`duration_minutes = 180` default but Admin may change it; positive duration/grace; valid weekday values; closing after opening), RLS enabled, active Admin read access, ordinary Admin update denial and Super Admin update success.
- [ ] **Step 2: Run the test against the linked database** and confirm it fails because `booking_settings` does not exist.
- [ ] **Step 3: Create the migration** with one seeded global row using Monday–Friday, `08:30`, `16:30`, `180`, `15`, `Asia/Bangkok`; add unique singleton protection, validation constraints, timestamps and `updated_at` trigger.
- [ ] **Step 4: Add RLS and grants** so authenticated active Admins can select, only active Super Admins can update, and no anonymous role can access the table.
- [ ] **Step 5: Run the migration and pgTAP file** via `npx supabase db push --linked` and `npx supabase db query --linked --file ...`; all assertions must pass and fixtures must rollback.
- [ ] **Step 6: Commit** with `feat: add configurable booking settings`.

### Task 3: Transactional booking database workflows

**Files:**
- Create: `supabase/migrations/202608140002_booking_workflows.sql`
- Create: `supabase/tests/database/05_booking_workflows.test.sql`

**Interfaces:**
- `public.create_immediate_booking(p_machine_id uuid) returns jsonb`
- `public.cancel_booking(p_booking_id uuid) returns void`
- `public.expire_no_show_bookings() returns integer`

The functions must use `auth.uid()`, fixed `search_path`, explicit authorization checks and stable SQLSTATE/application error messages. The create function loads settings, uses server `now()`, expires the caller's eligible no-show booking, rejects an outstanding booking, validates the service window and machine status, inserts the Booking and pending `machine_events` row, and relies on the existing exclusion constraints for races. It must not return or create credentials.

- [ ] **Step 1: Write pgTAP tests** for successful immediate 3-hour booking, machine conflict, outstanding customer booking, cancellation/rebooking, no-show expiry after 15 minutes, closing cutoff, event creation and unauthorized caller denial.
- [ ] **Step 2: Run the test and verify RED** because the RPCs do not exist.
- [ ] **Step 3: Implement the functions** in a migration using `security invoker` where possible and a tightly scoped `security definer` only where required; use `set search_path = ''` and fully qualified names.
- [ ] **Step 4: Run the workflow pgTAP test remotely**; all fixture rows and status changes must rollback.
- [ ] **Step 5: Verify existing Phase 3 tests** 01–04 still pass.
- [ ] **Step 6: Commit** with `feat: add transactional booking workflows`.

### Task 4: Server actions and customer profile synchronization

**Files:**
- Create: `lib/booking/actions.ts`
- Create: `lib/booking/queries.ts`
- Create: `lib/auth/profile.ts`
- Create: `app/booking/actions.ts`
- Create: `app/booking/page.tsx`
- Create: `app/my-bookings/page.tsx`
- Create: `app/my-bookings/actions.ts`
- Create: `components/booking/machine-card.tsx`
- Create: `components/booking/booking-status.tsx`
- Test: `tests/booking-actions.test.ts`

**Interfaces:**
- `ensureCustomerProfile(): Promise<CustomerProfile>` validates the server session/email and upserts only the caller's profile
- `listAvailableMachines(): Promise<Machine[]>`
- `createBooking(machineId: string): Promise<ActionResult<BookingSummary>>`
- `cancelBooking(bookingId: string): Promise<ActionResult<void>>`
- `listMyBookings(): Promise<BookingSummary[]>`

- [ ] **Step 1: Write failing unit tests** for action validation, error-code mapping, profile normalization, and ensuring browser input cannot choose start/end/duration.
- [ ] **Step 2: Run focused tests and verify RED.**
- [ ] **Step 3: Implement server-only Supabase access** through `createSupabaseServerClient`, call the transactional RPC, revalidate `/booking` and `/my-bookings`, and never import server modules into client components.
- [ ] **Step 4: Build the pages** with Thai copy, accessible loading/error states, available machine cards, booking confirmation and cancellation action. Do not add payment UI or credential display.
- [ ] **Step 5: Run focused and full application tests, typecheck and build.**
- [ ] **Step 6: Commit** with `feat: add customer booking flow`.

### Task 5: Admin settings route and UI

**Files:**
- Create: `lib/booking/settings.ts`
- Create: `app/admin/settings/actions.ts`
- Create: `app/admin/settings/page.tsx`
- Create: `components/admin/booking-settings-form.tsx`
- Test: `tests/booking-settings.test.ts`

**Interfaces:**
- `getBookingSettings(): Promise<BookingSettings>`
- `updateBookingSettings(input: BookingSettingsInput): Promise<ActionResult<BookingSettings>>`

- [ ] **Step 1: Write failing tests** for field validation, weekday/time parsing, active Admin read access, ordinary Admin denial and Super Admin update path.
- [ ] **Step 2: Run focused tests and verify RED.**
- [ ] **Step 3: Implement server-side validation and update action**; do not trust role or settings values from the browser, and return stable error codes.
- [ ] **Step 4: Build the Admin form** for weekdays, opening/closing time, duration, grace period and timezone, with a clear warning that changes affect new bookings only.
- [ ] **Step 5: Run application tests, typecheck, build and remote settings pgTAP.**
- [ ] **Step 6: Commit** with `feat: add admin booking settings`.

### Task 6: Phase 4 verification and handoff

**Files:**
- Modify only files required by demonstrated test failures
- Update: `docs/superpowers/plans/2026-08-13-customer-booking-plan.md` with actual results

- [ ] **Step 1: Run all application tests** with `npm test`.
- [ ] **Step 2: Run `npx tsc --noEmit`, `npm run build` and `git diff --check`.**
- [ ] **Step 3: Run all remote database tests** 01–05 in separate `supabase db query --linked --file` calls; record assertion totals and confirm test fixtures rollback.
- [ ] **Step 4: Run `npx supabase db lint --linked --level warning` and migration history verification.**
- [ ] **Step 5: Scan tracked non-document files** for `service_role`, payment provider names, private keys and credentials.
- [ ] **Step 6: Verify the final scope**: no WPF changes, no Machine API, no Email worker, no credential generator and no payment implementation.
- [ ] **Step 7: Commit the verification record** only if documentation changed, using `docs: close phase 4 verification`.

## Execution boundary

Do not begin Task 2 or later until Task 1 tests pass. Before each file edit, announce the exact files being created or modified. Apply remote migrations only after the relevant SQL tests pass and after explicit confirmation that the linked Supabase project is the intended target.
