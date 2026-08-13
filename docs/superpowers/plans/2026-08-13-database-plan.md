# Database Foundation Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้าง Supabase PostgreSQL schema, booking overlap protection, indexes และ RLS สำหรับ BookingAiLab พร้อม database-backed pgTAP tests

**Architecture:** แยก migration เป็น schema, constraints/indexes และ RLS เพื่อให้แต่ละส่วนทดสอบได้อิสระ Browser ใช้ authenticated JWT แต่ไม่มีสิทธิ์เขียน workflow tables โดยตรง ขณะที่ Admin authorization ใช้ security-definer helpers ใน `private` schema ที่ไม่เปิดผ่าน Data API

**Tech Stack:** Supabase CLI, PostgreSQL, pgTAP, SQL migrations, Docker-compatible local runtime

## Phase 3 Closure — 2026-08-13

**Status:** Complete and deployed to the linked `TimeLock` Supabase project.

- Applied migrations `202608130000` through `202608130003`; local and remote migration histories match.
- Verified all eight BookingAiLab tables exist and the database lint reports no schema errors.
- Ran all three pgTAP files against the linked database in transactions: 11 schema, 6 overlap/constraint and 15 RLS assertions passed (32 total), with every test rolled back.
- Confirmed the transactional pgTAP extension did not persist after the tests.
- Verified one active `super_admin` exists; the bootstrap identity was applied operationally and is not stored in source code or migrations.
- Application verification passed: 6 Vitest tests, TypeScript check, Next.js production build, `git diff --check` and tracked-file secret scan.
- Docker was intentionally not installed at the user's request. Local `db:start`, `db:reset`, `db:test` and RED runs were therefore not executed; equivalent final database checks were performed against the linked project through `supabase db query --linked` and `supabase db lint --linked`.
- No payment code, Booking RPC, credential generator, email worker, Admin UI, Machine API or WPF changes were added in this phase.

The task checkboxes below preserve the original TDD/local-Docker execution plan. This closure record is the source of truth for the approved Docker-free execution path used for this project.

## Global Constraints

- ใช้ Supabase Migration สำหรับการเปลี่ยนแปลง Database
- ผู้จองต้องใช้ Google OAuth และอีเมลลงท้ายด้วย `@msu.ac.th`
- Browser และ WPF ห้ามมี Supabase Service Role Key
- Booking เครื่องเดียวกันและ Customer คนเดียวกันต้องไม่มีช่วงเวลาซ้อน
- ไม่มีระบบชำระเงิน
- Phase นี้ไม่สร้าง Booking RPC, Credential generator, Email worker, Admin UI หรือ WPF API
- `security definer` authorization helpers ต้องอยู่ใน `private` schema ไม่ใช่ exposed `public` schema

---

### Task 1: Local Supabase Toolchain

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `supabase/config.toml`

**Interfaces:**
- Consumes: Node.js/npm และ Docker-compatible runtime
- Produces: scripts `db:start`, `db:reset`, `db:test`, `db:lint` และ local Supabase configuration

- [ ] **Step 1: Create the implementation branch**

Run:

```bash
git switch -c agent/phase-3-database
```

Expected: current branch is `agent/phase-3-database`.

- [ ] **Step 2: Install the project-scoped Supabase CLI**

Run:

```bash
npm install --save-dev supabase
```

Expected: `supabase` appears in `devDependencies` and `package-lock.json` changes.

- [ ] **Step 3: Initialize Supabase**

Run:

```bash
npx supabase init
```

Expected: `supabase/config.toml` is created. Do not add OAuth Client Secret, Service Role Key, production database passwords or other secrets to this file.

- [ ] **Step 4: Add database scripts to `package.json`**

Add these exact scripts:

```json
{
  "db:start": "supabase start",
  "db:reset": "supabase db reset --local",
  "db:test": "supabase test db --local",
  "db:lint": "supabase db lint --local --level warning"
}
```

Preserve existing Next.js and Vitest scripts.

- [ ] **Step 5: Verify tool availability**

Run:

```bash
npx supabase --version
docker info
```

Expected: both commands exit 0. If `docker info` fails, install/start Docker Desktop or another Supabase-compatible container runtime before continuing; database-backed verification cannot be skipped.

- [ ] **Step 6: Commit the toolchain**

```bash
git add package.json package-lock.json supabase/config.toml
git commit -m "chore: add local Supabase toolchain"
```

---

### Task 2: Core Schema Migration

**Files:**
- Create: `supabase/tests/database/01_schema.test.sql`
- Create: `supabase/migrations/202608130001_extensions_and_schema.sql`

**Interfaces:**
- Consumes: local Supabase stack from Task 1
- Produces: `customer_profiles`, `admin_profiles`, `machines`, `bookings`, `app_credentials`, `machine_events`, `notifications`, `audit_logs`, and shared `set_updated_at()` trigger

- [ ] **Step 1: Write the failing schema test**

Create `supabase/tests/database/01_schema.test.sql`:

```sql
begin;
select plan(11);

select has_table('public', 'customer_profiles', 'customer_profiles exists');
select has_table('public', 'admin_profiles', 'admin_profiles exists');
select has_table('public', 'machines', 'machines exists');
select has_table('public', 'bookings', 'bookings exists');
select has_table('public', 'app_credentials', 'app_credentials exists');
select has_table('public', 'machine_events', 'machine_events exists');
select has_table('public', 'notifications', 'notifications exists');
select has_table('public', 'audit_logs', 'audit_logs exists');
select has_column('public', 'bookings', 'start_at', 'bookings.start_at exists');
select col_type_is('public', 'bookings', 'start_at', 'timestamp with time zone', 'start_at is timestamptz');
select has_function('public', 'set_updated_at', array[]::text[], 'updated_at trigger function exists');

select * from finish();
rollback;
```

- [ ] **Step 2: Start the local stack and verify RED**

Run:

```bash
npm run db:start
npm run db:test
```

Expected: the schema test fails because Phase 3 tables do not exist.

- [ ] **Step 3: Create extensions and trigger function**

Start `202608130001_extensions_and_schema.sql` with:

```sql
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

- [ ] **Step 4: Add profile and machine tables**

Append:

```sql
create table public.customer_profiles (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users(id) on delete restrict,
  university_email text unique not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_profiles_email_normalized check (
    university_email = lower(trim(university_email))
  ),
  constraint customer_profiles_email_domain check (
    university_email ~ '^[^@[:space:]]+@msu[.]ac[.]th$'
  ),
  constraint customer_profiles_display_name_not_blank check (
    length(trim(display_name)) > 0
  )
);

create table public.admin_profiles (
  auth_user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_profiles_role_valid check (role in ('admin', 'super_admin'))
);

create table public.machines (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  machine_code text unique not null,
  machine_name text not null,
  location text,
  device_token_hash text not null,
  status text not null default 'inactive',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint machines_code_normalized check (
    machine_code = upper(trim(machine_code)) and length(machine_code) > 0
  ),
  constraint machines_name_not_blank check (length(trim(machine_name)) > 0),
  constraint machines_token_hash_not_blank check (length(trim(device_token_hash)) > 0),
  constraint machines_status_valid check (
    status in ('inactive', 'available', 'maintenance', 'disabled')
  )
);
```

- [ ] **Step 5: Add booking and workflow tables**

Append the complete definitions:

```sql
create table public.bookings (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  booking_number text unique not null,
  customer_id uuid not null references public.customer_profiles(id) on delete restrict,
  machine_id uuid not null references public.machines(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_number_not_blank check (length(trim(booking_number)) > 0),
  constraint bookings_time_valid check (start_at < end_at),
  constraint bookings_status_valid check (
    status in ('confirmed', 'app_pending', 'app_received', 'active', 'completed', 'cancelled', 'expired')
  )
);

create table public.app_credentials (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  booking_id uuid unique not null references public.bookings(id) on delete restrict,
  username text unique not null,
  password_hash text not null,
  password_encrypted text not null,
  expires_at timestamptz not null,
  first_login_at timestamptz,
  created_at timestamptz not null default now(),
  constraint app_credentials_username_not_blank check (length(trim(username)) > 0),
  constraint app_credentials_hash_not_blank check (length(trim(password_hash)) > 0),
  constraint app_credentials_encrypted_not_blank check (length(trim(password_encrypted)) > 0),
  constraint app_credentials_first_login_valid check (
    first_login_at is null or first_login_at >= created_at
  )
);

create table public.machine_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint machine_events_type_not_blank check (length(trim(event_type)) > 0),
  constraint machine_events_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint machine_events_status_valid check (
    status in ('pending', 'delivered', 'processed', 'failed')
  )
);

create table public.notifications (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  recipient_type text not null,
  recipient text not null,
  notification_type text not null,
  status text not null default 'pending',
  provider_message_id text,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint notifications_recipient_type_valid check (
    recipient_type in ('customer', 'admin')
  ),
  constraint notifications_recipient_not_blank check (length(trim(recipient)) > 0),
  constraint notifications_type_not_blank check (length(trim(notification_type)) > 0),
  constraint notifications_status_valid check (
    status in ('pending', 'sent', 'failed', 'retrying')
  ),
  constraint notifications_attempt_count_valid check (attempt_count >= 0),
  constraint notifications_sent_at_valid check (status <> 'sent' or sent_at is not null)
);

create table public.audit_logs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_not_blank check (length(trim(action)) > 0),
  constraint audit_logs_entity_type_not_blank check (length(trim(entity_type)) > 0),
  constraint audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);
```

- [ ] **Step 6: Add updated-at triggers**

Append:

```sql
create trigger customer_profiles_set_updated_at
before update on public.customer_profiles
for each row execute function public.set_updated_at();

create trigger admin_profiles_set_updated_at
before update on public.admin_profiles
for each row execute function public.set_updated_at();

create trigger machines_set_updated_at
before update on public.machines
for each row execute function public.set_updated_at();

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();
```

- [ ] **Step 7: Reset database and verify GREEN**

Run:

```bash
npm run db:reset
npm run db:test -- supabase/tests/database/01_schema.test.sql
```

Expected: migration applies and all 11 schema assertions pass.

- [ ] **Step 8: Commit core schema**

```bash
git add supabase/tests/database/01_schema.test.sql supabase/migrations/202608130001_extensions_and_schema.sql
git commit -m "feat: add booking database schema"
```

---

### Task 3: Booking Constraints and Indexes

**Files:**
- Create: `supabase/tests/database/02_booking_constraints.test.sql`
- Create: `supabase/migrations/202608130002_booking_constraints.sql`

**Interfaces:**
- Consumes: tables from Task 2
- Produces: concurrency-safe machine/customer overlap constraints and query indexes

- [ ] **Step 1: Write the failing overlap test**

Create a pgTAP test that inserts two auth users, customer profiles and two machines as `postgres`. Use fixed IDs and these required assertions:

```sql
begin;
select plan(6);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'one@msu.ac.th', '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{}'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'two@msu.ac.th', '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{}');

insert into public.customer_profiles (id, auth_user_id, university_email, display_name) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'one@msu.ac.th', 'User One'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'two@msu.ac.th', 'User Two');

insert into public.machines (id, machine_code, machine_name, device_token_hash, status) values
  ('30000000-0000-0000-0000-000000000001', 'PC-001', 'PC 001', 'hash-001', 'available'),
  ('30000000-0000-0000-0000-000000000002', 'PC-002', 'PC 002', 'hash-002', 'available');

insert into public.bookings (
  id, booking_number, customer_id, machine_id, start_at, end_at, status
) values (
  '40000000-0000-0000-0000-000000000001', 'BK-BASE',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '2026-08-20 10:00:00+07', '2026-08-20 12:00:00+07', 'confirmed'
);

select throws_ok(
  $$insert into public.bookings (booking_number, customer_id, machine_id, start_at, end_at)
    values ('BK-BAD-TIME', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '2026-08-20 12:00:00+07', '2026-08-20 11:00:00+07')$$,
  '23514', null, 'end_at must be after start_at'
);

select throws_ok(
  $$insert into public.bookings (booking_number, customer_id, machine_id, start_at, end_at)
    values ('BK-MACHINE-OVERLAP', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '2026-08-20 11:00:00+07', '2026-08-20 13:00:00+07')$$,
  '23P01', null, 'same machine cannot overlap'
);

select throws_ok(
  $$insert into public.bookings (booking_number, customer_id, machine_id, start_at, end_at)
    values ('BK-CUSTOMER-OVERLAP', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '2026-08-20 11:00:00+07', '2026-08-20 13:00:00+07')$$,
  '23P01', null, 'same customer cannot overlap'
);

select lives_ok(
  $$insert into public.bookings (booking_number, customer_id, machine_id, start_at, end_at)
    values ('BK-ADJACENT', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '2026-08-20 12:00:00+07', '2026-08-20 13:00:00+07')$$,
  'adjacent booking is allowed'
);

update public.bookings set status = 'cancelled' where booking_number = 'BK-BASE';

select lives_ok(
  $$insert into public.bookings (booking_number, customer_id, machine_id, start_at, end_at)
    values ('BK-AFTER-CANCEL', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '2026-08-20 10:00:00+07', '2026-08-20 12:00:00+07')$$,
  'cancelled booking releases the slot'
);

update public.bookings set status = 'expired' where booking_number = 'BK-AFTER-CANCEL';

select lives_ok(
  $$insert into public.bookings (booking_number, customer_id, machine_id, start_at, end_at)
    values ('BK-AFTER-EXPIRE', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '2026-08-20 10:00:00+07', '2026-08-20 12:00:00+07')$$,
  'expired booking releases the slot'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run db:test -- supabase/tests/database/02_booking_constraints.test.sql
```

Expected: overlap assertions fail because exclusion constraints do not exist.

- [ ] **Step 3: Add exclusion constraints**

Create `202608130002_booking_constraints.sql`:

```sql
alter table public.bookings
  add constraint bookings_machine_time_no_overlap
  exclude using gist (
    machine_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (status not in ('cancelled', 'expired'));

alter table public.bookings
  add constraint bookings_customer_time_no_overlap
  exclude using gist (
    customer_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (status not in ('cancelled', 'expired'));
```

- [ ] **Step 4: Add indexes**

Append:

```sql
create index bookings_customer_start_idx on public.bookings (customer_id, start_at desc);
create index bookings_machine_start_idx on public.bookings (machine_id, start_at desc);
create index bookings_status_start_idx on public.bookings (status, start_at);
create index machine_events_machine_status_created_idx on public.machine_events (machine_id, status, created_at);
create index machine_events_booking_idx on public.machine_events (booking_id);
create index notifications_status_created_idx on public.notifications (status, created_at);
create index notifications_booking_idx on public.notifications (booking_id);
create index machines_status_code_idx on public.machines (status, machine_code);
create index audit_logs_entity_created_idx on public.audit_logs (entity_type, entity_id, created_at desc);
```

- [ ] **Step 5: Reset and verify GREEN**

Run:

```bash
npm run db:reset
npm run db:test -- supabase/tests/database/02_booking_constraints.test.sql
```

Expected: all six assertions pass.

- [ ] **Step 6: Commit constraints and indexes**

```bash
git add supabase/tests/database/02_booking_constraints.test.sql supabase/migrations/202608130002_booking_constraints.sql
git commit -m "feat: prevent overlapping bookings"
```

---

### Task 4: RLS and Admin Authorization

**Files:**
- Create: `supabase/tests/database/03_rls.test.sql`
- Create: `supabase/migrations/202608130003_rls_policies.sql`

**Interfaces:**
- Consumes: all Phase 3 tables and indexes
- Produces: private authorization helpers, explicit grants, customer policies, Admin policies and deny-by-default Machine behavior

- [ ] **Step 1: Write RLS structure tests first**

Create `supabase/tests/database/03_rls.test.sql` with the complete test below:

```sql
begin;
select plan(15);

select has_schema('private', 'private schema exists');
select has_function('private', 'is_active_admin', array[]::text[], 'active admin helper exists');
select has_function('private', 'is_super_admin', array[]::text[], 'super admin helper exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.customer_profiles'::regclass),
  true,
  'customer_profiles has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.bookings'::regclass),
  true,
  'bookings has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.app_credentials'::regclass),
  true,
  'app_credentials has RLS enabled'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('11000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'customer.one@msu.ac.th', '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{}'),
  ('11000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'customer.two@msu.ac.th', '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{}'),
  ('11000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@msu.ac.th', '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{}'),
  ('11000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inactive.admin@msu.ac.th', '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{}'),
  ('11000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'super.admin@msu.ac.th', '', now(), now(), now(), '{"provider":"google","providers":["google"]}', '{}');

insert into public.customer_profiles (id, auth_user_id, university_email, display_name) values
  ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'customer.one@msu.ac.th', 'Customer One'),
  ('21000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', 'customer.two@msu.ac.th', 'Customer Two');

insert into public.admin_profiles (auth_user_id, role, is_active) values
  ('11000000-0000-0000-0000-000000000003', 'admin', true),
  ('11000000-0000-0000-0000-000000000004', 'admin', false),
  ('11000000-0000-0000-0000-000000000005', 'super_admin', true);

insert into public.machines (id, machine_code, machine_name, device_token_hash, status) values
  ('31000000-0000-0000-0000-000000000001', 'PC-RLS-001', 'Available PC', 'hash-rls-001', 'available'),
  ('31000000-0000-0000-0000-000000000002', 'PC-RLS-002', 'Maintenance PC', 'hash-rls-002', 'maintenance');

insert into public.bookings (id, booking_number, customer_id, machine_id, start_at, end_at) values
  ('41000000-0000-0000-0000-000000000001', 'BK-RLS-001', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '2026-08-21 09:00:00+07', '2026-08-21 10:00:00+07'),
  ('41000000-0000-0000-0000-000000000002', 'BK-RLS-002', '21000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', '2026-08-21 10:00:00+07', '2026-08-21 11:00:00+07');

insert into public.app_credentials (
  booking_id, username, password_hash, password_encrypted, expires_at
) values (
  '41000000-0000-0000-0000-000000000001', 'booking_rls_001', 'test-hash', 'test-encrypted', '2026-08-21 10:00:00+07'
);

insert into public.notifications (
  booking_id, recipient_type, recipient, notification_type
) values
  ('41000000-0000-0000-0000-000000000001', 'customer', 'customer.one@msu.ac.th', 'booking_confirmed'),
  ('41000000-0000-0000-0000-000000000002', 'customer', 'customer.two@msu.ac.th', 'booking_confirmed');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);

select results_eq(
  $$select count(*)::bigint from public.customer_profiles$$,
  array[1::bigint],
  'customer sees only own profile'
);
select results_eq(
  $$select count(*)::bigint from public.bookings$$,
  array[1::bigint],
  'customer sees only own booking'
);
select results_eq(
  $$select count(*)::bigint from public.machines$$,
  array[1::bigint],
  'customer sees only available machines'
);
select results_eq(
  $$select count(*)::bigint from public.notifications$$,
  array[1::bigint],
  'customer sees only own notification'
);
select results_eq(
  $$select count(*)::bigint from public.app_credentials$$,
  array[0::bigint],
  'customer cannot read credentials'
);

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
select results_eq(
  $$select count(*)::bigint from public.customer_profiles$$,
  array[2::bigint],
  'active admin sees all customer profiles'
);
select throws_ok(
  $$insert into public.admin_profiles (auth_user_id, role)
    values ('11000000-0000-0000-0000-000000000002', 'admin')$$,
  '42501',
  null,
  'regular admin cannot grant admin access'
);

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000004', true);
select results_eq(
  $$select count(*)::bigint from public.customer_profiles$$,
  array[0::bigint],
  'inactive admin receives no admin visibility'
);

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000005', true);
select lives_ok(
  $$insert into public.admin_profiles (auth_user_id, role)
    values ('11000000-0000-0000-0000-000000000002', 'admin')$$,
  'super admin can grant admin access'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run db:test -- supabase/tests/database/03_rls.test.sql
```

Expected: helper/schema/RLS assertions fail because migration 003 is absent.

- [ ] **Step 3: Create private authorization helpers**

Start `202608130003_rls_policies.sql`:

```sql
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles
    where auth_user_id = (select auth.uid())
      and is_active = true
  );
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles
    where auth_user_id = (select auth.uid())
      and is_active = true
      and role = 'super_admin'
  );
$$;

revoke all on function private.is_active_admin() from public;
revoke all on function private.is_super_admin() from public;
grant execute on function private.is_active_admin() to authenticated;
grant execute on function private.is_super_admin() to authenticated;
```

- [ ] **Step 4: Enable RLS and set explicit grants**

Append:

```sql
alter table public.customer_profiles enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.machines enable row level security;
alter table public.bookings enable row level security;
alter table public.app_credentials enable row level security;
alter table public.machine_events enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table public.customer_profiles from anon;
revoke all on table public.admin_profiles from anon;
revoke all on table public.machines from anon;
revoke all on table public.bookings from anon;
revoke all on table public.app_credentials from anon;
revoke all on table public.machine_events from anon;
revoke all on table public.notifications from anon;
revoke all on table public.audit_logs from anon;

grant select, insert, update, delete on public.customer_profiles to authenticated;
grant select, insert, update, delete on public.admin_profiles to authenticated;
grant select, insert, update, delete on public.machines to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;
grant select, insert, update, delete on public.app_credentials to authenticated;
grant select, insert, update, delete on public.machine_events to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select on public.audit_logs to authenticated;
```

These SQL grants allow PostgreSQL to evaluate policies; absent customer write policies still deny Browser writes.

- [ ] **Step 5: Add Customer SELECT policies**

Append:

```sql
create policy customer_read_own_profile
on public.customer_profiles for select to authenticated
using ((select auth.uid()) = auth_user_id);

create policy customer_read_available_machines
on public.machines for select to authenticated
using (status = 'available');

create policy customer_read_own_bookings
on public.bookings for select to authenticated
using (
  customer_id in (
    select id from public.customer_profiles
    where auth_user_id = (select auth.uid())
  )
);

create policy customer_read_own_notifications
on public.notifications for select to authenticated
using (
  recipient_type = 'customer'
  and booking_id in (
    select b.id
    from public.bookings b
    join public.customer_profiles c on c.id = b.customer_id
    where c.auth_user_id = (select auth.uid())
  )
);
```

Do not create customer policies for `app_credentials`, `machine_events` or `audit_logs`.

- [ ] **Step 6: Add Admin policies**

Append the six exact management policies:

```sql
create policy active_admin_manage_customer_profiles
on public.customer_profiles for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

create policy active_admin_manage_machines
on public.machines for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

create policy active_admin_manage_bookings
on public.bookings for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

create policy active_admin_manage_app_credentials
on public.app_credentials for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

create policy active_admin_manage_machine_events
on public.machine_events for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

create policy active_admin_manage_notifications
on public.notifications for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));
```

Add Admin profile policies:

```sql
create policy active_admin_read_admin_profiles
on public.admin_profiles for select to authenticated
using ((select private.is_active_admin()));

create policy super_admin_insert_admin_profiles
on public.admin_profiles for insert to authenticated
with check ((select private.is_super_admin()));

create policy super_admin_update_admin_profiles
on public.admin_profiles for update to authenticated
using ((select private.is_super_admin()))
with check ((select private.is_super_admin()));

create policy super_admin_delete_admin_profiles
on public.admin_profiles for delete to authenticated
using ((select private.is_super_admin()));

create policy active_admin_read_audit_logs
on public.audit_logs for select to authenticated
using ((select private.is_active_admin()));
```

Do not create insert/update/delete policies on `audit_logs` in this phase.

- [ ] **Step 7: Complete behavioral RLS tests and verify GREEN**

Run:

```bash
npm run db:reset
npm run db:test -- supabase/tests/database/03_rls.test.sql
```

Expected: all 15 assertions pass, including customer isolation, notification isolation, inactive Admin denial and super Admin role management.

- [ ] **Step 8: Commit RLS**

```bash
git add supabase/tests/database/03_rls.test.sql supabase/migrations/202608130003_rls_policies.sql
git commit -m "feat: secure booking data with RLS"
```

---

### Task 5: Full Database and Application Verification

**Files:**
- Modify only files required to fix a demonstrated migration/test defect

**Interfaces:**
- Consumes: all Phase 3 migrations and tests
- Produces: evidence that the database rebuilds from zero and all existing application checks remain green

- [ ] **Step 1: Rebuild from an empty local database**

Run:

```bash
npm run db:reset
```

Expected: all three migrations apply in timestamp order with exit code 0.

- [ ] **Step 2: Run all database tests**

Run:

```bash
npm run db:test
```

Expected: all pgTAP files pass with `Result: PASS`.

- [ ] **Step 3: Run database lint**

Run:

```bash
npm run db:lint
```

Expected: exit code 0 and no security errors. Review warnings rather than suppressing them globally.

- [ ] **Step 4: Run application verification**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: Vitest passes, TypeScript exits 0, and Next.js production build exits 0. Network access may be required for `next/font/google` to fetch Anuphan.

- [ ] **Step 5: Verify secret hygiene and scope**

Run:

```bash
git status --short
git diff --check
git grep -n -E 'SUPABASE_SERVICE_ROLE|service_role|GOOGLE_CLIENT_SECRET|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY' -- ':!docs/**'
```

Expected: no secret match; `.env.local` remains untracked; only Phase 3 files and planned dependency/config changes appear.

- [ ] **Step 6: Review Phase 3 requirements**

Confirm from fresh command output:

- Eight tables exist.
- Two overlap constraints reject concurrent conflicts.
- Adjacent, cancelled and expired slots behave as designed.
- Every public table has RLS enabled.
- Customer isolation works.
- Active Admin visibility works.
- Only super Admin manages Admin profiles.
- Customer and Machine Agent cannot read credentials.
- No Booking RPC, payment code or WPF code was added.

- [ ] **Step 7: Commit verification corrections, if any**

If verification required a code correction, stage only those exact files and commit:

```bash
git add package.json package-lock.json supabase/config.toml \
  supabase/migrations/202608130001_extensions_and_schema.sql \
  supabase/migrations/202608130002_booking_constraints.sql \
  supabase/migrations/202608130003_rls_policies.sql \
  supabase/tests/database/01_schema.test.sql \
  supabase/tests/database/02_booking_constraints.test.sql \
  supabase/tests/database/03_rls.test.sql
git commit -m "fix: correct database migration verification"
```

If no correction was required, do not create an empty commit.

## Deployment Boundary

This plan validates migrations locally only. Applying migrations to the linked production Supabase project is a separate deployment action requiring explicit approval after local database tests pass. Do not run `supabase db push --linked`, remote `db reset`, or SQL Editor mutations as part of Phase 3 implementation without that approval.
