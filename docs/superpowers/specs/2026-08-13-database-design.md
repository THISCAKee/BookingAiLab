# BookingAiLab Database Design — Phase 3

## Goal

สร้างโครงสร้าง PostgreSQL สำหรับระบบจองเครื่องคอมพิวเตอร์ พร้อม constraints, indexes และ Row Level Security (RLS) โดยใช้ Supabase migrations เท่านั้น

Phase นี้ไม่รวม Booking UI, transactional booking RPC, credential generation, email delivery, Admin Dashboard หรือ WPF API

## Migration Structure

แบ่ง migration ตามหน้าที่เพื่อให้ตรวจสอบและวินิจฉัยปัญหาได้ง่าย:

1. `202608130001_extensions_and_schema.sql` — extensions, helper trigger และตาราง
2. `202608130002_booking_constraints.sql` — exclusion constraints และ indexes
3. `202608130003_rls_policies.sql` — authorization helpers, RLS และ policies

ทุก migration ต้องรันซ้ำจากฐานข้อมูลว่างได้ตามลำดับ และห้ามพึ่งพา SQL ที่แก้ด้วยมือใน Dashboard ยกเว้นการเพิ่ม Admin คนแรกหลัง migration สำเร็จ

## PostgreSQL Extensions

- `pgcrypto` สำหรับสร้าง UUID ด้วย `gen_random_uuid()`
- `btree_gist` สำหรับ GiST exclusion constraints ที่ใช้ UUID ร่วมกับช่วงเวลา

## Shared Conventions

- Primary key ทุกตารางเป็น UUID และ default เป็น `gen_random_uuid()`
- เวลาใช้ `timestamptz` และ default `now()` เมื่อเป็นเวลาสร้าง/แก้ไขข้อมูล
- ตารางที่มี `updated_at` ใช้ trigger กลางเพื่ออัปเดตค่าเมื่อ row เปลี่ยน
- ชื่ออีเมลและ machine code ถูก normalize ก่อนจัดเก็บหรือบังคับด้วย check constraint
- ตารางสำคัญไม่ใช้ cascading delete หากจะทำให้ประวัติการจองหรือ audit หาย
- Browser และ WPF ไม่มี Supabase Service Role Key

## Tables

### `customer_profiles`

- `id uuid primary key`
- `auth_user_id uuid unique not null references auth.users(id) on delete restrict`
- `university_email text unique not null`
- `display_name text not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `university_email = lower(trim(university_email))`
- ต้องมี local part และลงท้ายด้วย `@msu.ac.th`
- `display_name` หลัง trim ต้องไม่ว่าง

Phase 3 จะไม่สร้าง profile จาก `auth.users` ด้วย trigger การสร้างหรือ upsert profile จะอยู่ใน Phase 4 หลัง Server ตรวจ provider, email verification และ domain แล้ว เพื่อไม่ให้ Database trigger ทำให้ OAuth signup ล้มเหลว

### `admin_profiles`

- `auth_user_id uuid primary key references auth.users(id) on delete restrict`
- `role text not null default 'admin'`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `role` เป็น `admin` หรือ `super_admin`

ไม่มี policy ให้ผู้ใช้เพิ่มหรือยกระดับสิทธิ์ตัวเอง Admin คนแรกต้องเพิ่มผ่าน SQL Editor โดยใช้ `auth_user_id` จาก `auth.users`

### `machines`

- `id uuid primary key`
- `machine_code text unique not null`
- `machine_name text not null`
- `location text`
- `device_token_hash text not null`
- `status text not null default 'inactive'`
- `last_seen_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `machine_code` เป็น uppercase และไม่ว่าง
- `machine_name` และ `device_token_hash` ไม่ว่าง
- `status` เป็น `inactive`, `available`, `maintenance` หรือ `disabled`

ค่า Device Token จริงห้ามจัดเก็บในตาราง เก็บเฉพาะ hash เท่านั้น

### `bookings`

- `id uuid primary key`
- `booking_number text unique not null`
- `customer_id uuid not null references customer_profiles(id) on delete restrict`
- `machine_id uuid not null references machines(id) on delete restrict`
- `start_at timestamptz not null`
- `end_at timestamptz not null`
- `status text not null default 'confirmed'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `start_at < end_at`
- `booking_number` ไม่ว่าง
- `status` เป็น `confirmed`, `app_pending`, `app_received`, `active`, `completed`, `cancelled` หรือ `expired`

### `app_credentials`

- `id uuid primary key`
- `booking_id uuid unique not null references bookings(id) on delete restrict`
- `username text unique not null`
- `password_hash text not null`
- `password_encrypted text not null`
- `expires_at timestamptz not null`
- `first_login_at timestamptz`
- `created_at timestamptz not null default now()`

Constraints:

- `username`, `password_hash` และ `password_encrypted` ไม่ว่าง
- `first_login_at` ต้องเป็น `null` หรือไม่มาก่อน `created_at`

`password_hash` ใช้ตรวจสอบ Login ส่วน `password_encrypted` ใช้ส่งให้ Machine API ตามกติกา one-time delivery ใน Phase หลัง และต้องเข้ารหัสด้วย Server-side secret

### `machine_events`

- `id uuid primary key`
- `machine_id uuid not null references machines(id) on delete restrict`
- `booking_id uuid not null references bookings(id) on delete restrict`
- `event_type text not null`
- `payload jsonb not null default '{}'::jsonb`
- `status text not null default 'pending'`
- `created_at timestamptz not null default now()`
- `processed_at timestamptz`

Constraints:

- `event_type` ไม่ว่าง
- `payload` ต้องเป็น JSON object
- `status` เป็น `pending`, `delivered`, `processed` หรือ `failed`

### `notifications`

- `id uuid primary key`
- `booking_id uuid not null references bookings(id) on delete restrict`
- `recipient_type text not null`
- `recipient text not null`
- `notification_type text not null`
- `status text not null default 'pending'`
- `provider_message_id text`
- `attempt_count integer not null default 0`
- `last_error text`
- `created_at timestamptz not null default now()`
- `sent_at timestamptz`

Constraints:

- `recipient_type` เป็น `customer` หรือ `admin`
- `recipient` และ `notification_type` ไม่ว่าง
- `status` เป็น `pending`, `sent`, `failed` หรือ `retrying`
- `attempt_count >= 0`
- หาก status เป็น `sent` ต้องมี `sent_at`

### `audit_logs`

- `id uuid primary key`
- `actor_auth_user_id uuid references auth.users(id) on delete set null`
- `action text not null`
- `entity_type text not null`
- `entity_id uuid`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Constraints:

- `action` และ `entity_type` ไม่ว่าง
- `metadata` ต้องเป็น JSON object

Audit logs ไม่มี update/delete policy และไม่ถูกลบตาม actor หรือ entity

## Booking Overlap Protection

ใช้ generated range expression `tstzrange(start_at, end_at, '[)')` เพื่อให้เวลาสิ้นสุดของรายการหนึ่งตรงกับเวลาเริ่มของอีกรายการได้โดยไม่ถือว่าซ้อนกัน

สร้าง exclusion constraints สองชุด:

1. `machine_id WITH =` และช่วงเวลา `WITH &&`
2. `customer_id WITH =` และช่วงเวลา `WITH &&`

constraints ทำงานเฉพาะ status ที่ไม่ใช่ `cancelled` และ `expired` ดังนั้นการยกเลิกหรือหมดอายุจะคืนช่วงเวลาให้จองใหม่ได้ ส่วน `completed` ยังคงนับเป็นประวัติที่ไม่อนุญาตให้มีข้อมูลช่วงเดียวกันซ้อนย้อนหลัง

Database constraints เป็นแนวป้องกัน concurrency หลัก แม้ requests หลายรายการจะเกิดพร้อมกัน PostgreSQL ต้องยอมรับได้เพียงรายการเดียว

## Indexes

- `bookings(customer_id, start_at desc)`
- `bookings(machine_id, start_at desc)`
- `bookings(status, start_at)`
- `machine_events(machine_id, status, created_at)`
- `machine_events(booking_id)`
- `notifications(status, created_at)`
- `notifications(booking_id)`
- `machines(status, machine_code)`
- `audit_logs(entity_type, entity_id, created_at desc)`

Unique constraints สร้าง index สำหรับ email, machine code, booking number, credential username และ booking-to-credential relation อยู่แล้ว จึงไม่สร้าง index ซ้ำ

## Authorization Helpers

สร้าง function `public.is_active_admin()` ที่:

- คืนค่า boolean
- ตรวจ `auth.uid()` กับ `admin_profiles.auth_user_id`
- ต้องพบ `is_active = true`
- เป็น `security definer`
- กำหนด `search_path` แบบคงที่
- revoke execute จาก `public` แล้ว grant เฉพาะ `authenticated`

Function นี้ช่วยลด policy ที่ซ้ำกันและหลีกเลี่ยง recursive policy lookup

## Row Level Security

เปิด RLS ทุกตารางใน `public` ที่สร้างใน Phase นี้

### Customer policies

- `customer_profiles`: อ่าน profile ที่ `auth_user_id = auth.uid()` ได้
- `machines`: authenticated user อ่านเครื่องสถานะ `available` ได้
- `bookings`: อ่าน Booking ที่เชื่อมกับ customer profile ของ `auth.uid()` ได้
- `notifications`: อ่าน notification ของ Booking ตัวเองได้เฉพาะ `recipient_type = 'customer'`
- ไม่มี direct insert/update/delete policy สำหรับ Booking, Credential, Event, Notification หรือ Audit Log
- Customer อ่าน `app_credentials` ไม่ได้ เพื่อไม่เปิด encrypted credential ให้ Browser

### Admin policies

Active Admin อ่านและจัดการ:

- `customer_profiles`
- `admin_profiles`
- `machines`
- `bookings`
- `app_credentials`
- `machine_events`
- `notifications`

Active Admin อ่าน `audit_logs` ได้ แต่ไม่มี update/delete policy สำหรับ audit logs การ insert audit log จะทำผ่าน Server workflow ที่กำหนดใน Phase หลัง

แม้ Admin อ่าน `app_credentials` ได้ UI ใน Phase หลังต้องไม่แสดง `password_encrypted` โดยตรง

### Machine policies

ไม่มี Machine Agent policy ใน Phase 3 WPF จะเข้าผ่าน Next.js Machine API หลัง Device Token contract พร้อม และจะไม่รับ Supabase Service Role Key

## Transaction Boundary

Phase 3 สร้าง schema และ database-level overlap protection เท่านั้น การสร้าง Booking พร้อม Credential, Machine Event และ Notification ใน transaction เดียวจะเพิ่มเป็น PostgreSQL function/RPC ใน Phase 4 หลังรายละเอียด input, booking policy และ credential generation ได้รับการยืนยัน

Browser จะไม่ insert ตารางเหล่านี้โดยตรง

## Validation and Testing

SQL tests ต้องตรวจอย่างน้อย:

- schema และ status constraints
- ปฏิเสธ `end_at <= start_at`
- ปฏิเสธ machine overlap
- ปฏิเสธ customer overlap
- อนุญาตช่วงเวลาติดกันแบบ end-to-start
- อนุญาตจองช่วงเดิมหลัง Booking เป็น `cancelled` หรือ `expired`
- Customer อ่านข้อมูลของตัวเองได้และอ่านของผู้อื่นไม่ได้
- Customer อ่านเฉพาะเครื่อง `available`
- Customer อ่าน credential ไม่ได้
- Active Admin อ่านข้อมูลระบบได้
- Inactive Admin ไม่มีสิทธิ์ Admin
- Audit Log ไม่มี update/delete policy

Verification ใช้ Supabase CLI local database หาก Docker และ CLI พร้อม หาก environment ไม่มีเครื่องมือดังกล่าว ต้องตรวจ migration syntax ด้วย PostgreSQL-compatible tooling และรายงานข้อจำกัดอย่างชัดเจน ห้ามอ้างว่า RLS ผ่านโดยไม่มี database-backed test

## Out of Scope

- ระบบชำระเงิน
- Booking UI และ Booking RPC
- Credential generator และ encryption implementation
- Email provider และ retry worker
- Admin Dashboard
- Machine registration/API และ WPF changes
- ERP-HR StaffInfo integration
