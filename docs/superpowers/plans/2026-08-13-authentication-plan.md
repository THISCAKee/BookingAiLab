# Authentication Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม Supabase Google OAuth พร้อม server-side `@msu.ac.th` domain enforcement

**Architecture:** ใช้ `@supabase/ssr` สำหรับ cookie-based sessions, Browser client สำหรับเริ่ม OAuth, callback route สำหรับแลก code และ Middleware สำหรับ refresh/protect routes

**Tech Stack:** Next.js App Router, TypeScript, Supabase Auth, `@supabase/ssr`, Vitest

## Global Constraints

- ผู้ใช้ต้อง Login ด้วย Google OAuth
- อนุญาตเฉพาะอีเมลที่ลงท้ายด้วย `@msu.ac.th`
- การตรวจ Domain ต้องทำที่ Server จาก Supabase Auth User
- ห้ามใส่ Supabase Service Role Key ใน Browser หรือ WPF
- ยังไม่ทำ Booking, Database Migration หรือ WPF API ใน Phase นี้

### Task 1: Domain policy

**Files:**
- Create: `lib/auth/domain.ts`
- Test: `tests/auth-domain.test.ts`

- [ ] เขียนเทสต์สำหรับ valid, case normalization และ invalid suffix
- [ ] รัน `npm test -- tests/auth-domain.test.ts` และยืนยันว่า fail เพราะยังไม่มี module
- [ ] สร้าง `isAllowedUniversityEmail(email: string | null | undefined): boolean`
- [ ] รันเทสต์ซ้ำและยืนยันผ่าน

### Task 2: Supabase clients and environment

**Files:**
- Modify: `package.json`, `package-lock.json`, `.env.example`
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`

- [ ] ติดตั้ง `@supabase/supabase-js` และ `@supabase/ssr`
- [ ] สร้าง browser client จาก public env values
- [ ] สร้าง server client ที่อ่าน/เขียน auth cookies
- [ ] รักษา Service Role Key ให้อยู่นอกโค้ดทั้งหมด

### Task 3: OAuth routes and middleware

**Files:**
- Create: `middleware.ts`, `app/auth/callback/route.ts`
- Modify: `app/login/page.tsx`

- [ ] callback แลก `code` เป็น session
- [ ] callback ตรวจ user email ด้วย server client และ sign out unauthorized user
- [ ] middleware refresh session และป้องกัน protected route
- [ ] login page เริ่ม Google OAuth ด้วย callback URL ปัจจุบัน

### Task 4: User-facing pages

**Files:**
- Create: `app/login/login-button.tsx`, `app/auth/unauthorized/page.tsx`
- Modify: `app/page.tsx`

- [ ] แสดงปุ่ม Login และข้อความ error ที่ไม่เปิดเผยข้อมูลภายใน
- [ ] แสดงหน้า unauthorized ภาษาไทยพร้อมปุ่มกลับหน้า Login
- [ ] ปรับหน้าแรกให้มีทางเข้า Login

### Task 5: Verification

- [ ] รัน targeted tests และ full test suite
- [ ] รัน `npx tsc --noEmit`
- [ ] รัน production build ด้วย network access สำหรับ Google font
- [ ] ตรวจว่าไม่มี Service Role Key ใน source หรือ env example
