# BookingAiLab Authentication Design — Phase 2

## Goal

เพิ่ม Google OAuth ผ่าน Supabase สำหรับผู้ใช้มหาวิทยาลัย โดยอนุญาตเฉพาะอีเมลที่ลงท้ายด้วย `@msu.ac.th` และบังคับตรวจสอบสิทธิ์ฝั่ง Server

## Architecture

ใช้ `@supabase/ssr` เพื่อจัดการ Supabase session ผ่าน cookies ใน Next.js App Router โดยมี client สำหรับ Browser ใช้เริ่ม Google OAuth และ server client สำหรับอ่าน/แก้ session ใน Server Components, Route Handler และ Middleware

`middleware.ts` จะ refresh session และป้องกัน route ที่ต้อง Login ส่วน callback route จะแลก OAuth code เป็น session จากนั้นตรวจสอบอีเมลจาก Supabase User ฝั่ง Server หากไม่ผ่าน domain จะ sign out และ redirect ไป `/auth/unauthorized`

## Routes

- `/login`: public page สำหรับเริ่ม Google OAuth
- `/auth/callback`: รับ OAuth code, สร้าง session และ redirect
- `/auth/unauthorized`: แจ้งว่าต้องใช้บัญชี `@msu.ac.th`
- `/`: public foundation page ใน Phase นี้
- `/booking`, `/my-bookings`, `/admin`: protected route สำหรับ Phase ถัดไป

## Security Rules

- ตรวจ `user.email` ที่ได้จาก Supabase Auth ฝั่ง Server เท่านั้น
- normalize email ด้วย lowercase และ trim ก่อนตรวจสอบ
- อนุญาตเฉพาะ `@msu.ac.th` แบบ exact suffix
- ไม่ใช้ Service Role Key
- ค่า environment ที่เปิดเผยได้มีเฉพาะ Supabase URL และ anon key
- ผู้ใช้ที่ไม่ผ่าน domain ต้องถูก sign out ก่อน redirect

## Error Handling

- OAuth error หรือไม่มี `code` ให้ redirect ไป `/login?error=oauth`
- Supabase session exchange error ให้ redirect ไป `/login?error=callback`
- ผู้ใช้ email ไม่ผ่านเงื่อนไขให้ redirect ไป `/auth/unauthorized`
- หน้า Login แสดงข้อความที่เหมาะสมตาม error query โดยไม่เปิดเผยรายละเอียดภายใน

## Testing

- domain ที่ถูกต้องผ่าน
- domain ที่ใกล้เคียงหรือปลอม suffix ไม่ผ่าน
- email ตัวพิมพ์ใหญ่และ whitespace ถูก normalize
- callback และ middleware ใช้ server-side user identity เป็นแหล่งตัดสินสิทธิ์
