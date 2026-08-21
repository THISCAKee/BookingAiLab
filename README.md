# BookingAiLab

ระบบ Booking แยกจาก TimeLockApp สำหรับให้ผู้ใช้มหาวิทยาลัยมหาสารคามจองเครื่องคอมพิวเตอร์ผ่านเว็บ

## เป้าหมาย

- ใช้ Next.js App Router และ Tailwind CSS 4
- Login ด้วย Google OAuth เฉพาะบัญชี `@msu.ac.th`
- จองเครื่องคอมพิวเตอร์ฟรี
- สร้าง Username/Password สำหรับ TimeLockApp ทันทีหลังจอง
- ส่งข้อมูลการจองให้ผู้จองทาง Email
- แจ้งเตือน Admin
- เชื่อมต่อกับ WPF TimeLockApp ผ่าน API

## เอกสาร

- [Design Spec](docs/booking-design-spec.md)
- [API Contract](docs/booking-api-contract.md)

## Backend

ระบบใช้ Google OAuth โดยตรงและใช้ Private Google Sheet เป็นแหล่งข้อมูลหลักทั้งหมด ไม่มีการใช้ Supabase ใน runtime

## การพัฒนาบน MacBook

1. ติดตั้ง dependencies ด้วย `npm install`
2. ตั้งค่า Environment Variables ตาม `.env.example` โดยห้าม Commit Secret
3. สร้าง Google OAuth redirect URI เป็น `/api/auth/google/callback`
4. สร้าง Google Sheet ใหม่แบบว่าง ห้ามใช้ Sheet ID เดิม
5. เปิด Extensions → Apps Script แล้ววางโค้ดจาก `scripts/google-apps-script/Code.gs`
6. รัน `initializeSpreadsheet()` หนึ่งครั้ง เพื่อสร้างทุกแท็บ, settings และเครื่อง `PC-001` ถึง `PC-006`
7. ตั้ง Script Property ชื่อ `ATOMIC_MUTATION_SECRET` ให้ตรงกับ `GOOGLE_ATOMIC_MUTATION_SECRET`
8. Deploy Apps Script เป็น Web app แล้วนำ URL ใส่ `GOOGLE_ATOMIC_MUTATION_URL`
9. แชร์ Private Google Sheet ให้ service account ของ Backend และนำ Sheet ID ใหม่ใส่ `GOOGLE_SHEET_ID`

## Google Sheet tabs

- `Settings`: `Key`, `Value`, `UpdatedAt`
- `Machines`: `machineId`, `machineCode`, `machineName`, `location`, `status`, `deviceTokenHash`, `lastSeenAt`, `updatedAt`
- `Bookings`: `bookingId`, `bookingNumber`, `email`, `name`, `hd`, `emailPrefix`, `machineId`, `machineCode`, `startAt`, `endAt`, `status`, `manageCodeHash`, `createdAt`, `updatedAt`, `idempotencyKey`
- `Users`: `userId`, `email`, `name`, `emailPrefix`, `username`, `role`, `machineCode`, `passwordAlgorithm`, `passwordIterations`, `passwordSalt`, `passwordHash`, `allowedMinutes`, `isActive`, `sourceBookingId`, `updatedAt`

`emailPrefix` เป็น username สำหรับ TimeLock ส่วน password จะถูกสร้างใหม่เมื่อจอง เก็บใน Sheet เฉพาะ PBKDF2 verifier และแสดงรหัสจริงแก่ผู้ใช้ครั้งเดียว

## TimeLock Gateway

ระบบ TimeLock ไม่อ่าน Google Sheet จากเครื่องลูกโดยตรง เส้นทางข้อมูลคือ
`Private Google Sheet → BookingAiLab API → TimeLockApp`

ก่อน deploy:

1. เพิ่มคอลัมน์ `MachineCode` ต่อจาก `IsActive` ในชีต `Users` และกำหนดค่า เช่น `PC-001`
2. ตั้ง Google Sheet เป็น Private และแชร์ให้ service account ของ Backend เท่านั้น
3. ตั้ง Environment Variables ตาม `.env.example` ใน Vercel
4. สร้าง/หมุน Device Token ที่หน้า `/admin/machines` แล้วกรอก Token ครั้งเดียวตอนเปิด TimeLockApp ครั้งแรก

TimeLockApp ส่ง heartbeat ทุก 15 วินาที หน้า Dashboard ถือว่า Offline เมื่อขาด heartbeat เกิน 45 วินาที
บัญชี offline cache ใช้ได้ 24 ชั่วโมง ผูกกับ MachineCode และถูกป้องกันด้วย Windows DPAPI
