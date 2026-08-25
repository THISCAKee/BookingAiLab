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
9. รัน `installDailyCleanupTrigger()` หนึ่งครั้งและอนุญาตสิทธิ์ เพื่อสร้าง trigger ตรวจการข้ามวันทุก 1 นาที
10. แชร์ Private Google Sheet ให้ service account ของ Backend และนำ Sheet ID ใหม่ใส่ `GOOGLE_SHEET_ID`

## Admin login

หน้า `/admin` ใช้ Username/Password แยกจาก Google login ของผู้จอง โดยค่าเริ่มต้น Username คือ `admin` ให้ตั้ง `ADMIN_PASSWORD` เป็นรหัสผ่านจริงใน `.env.local` และ environment ของ Vercel ห้าม commit รหัสผ่านลง Git ระบบจะสร้าง `admin_session` แบบ HttpOnly และล้าง session เมื่อกดออกจากระบบ

เมื่อแก้ `Code.gs` ต้อง Deploy → Manage deployments → Edit → New version เพื่อให้ Web app `/exec` ใช้โค้ดล่าสุด การกด Save อย่างเดียวไม่เปลี่ยนเวอร์ชันที่ Backend เรียก

## Google Sheet tabs

- `Settings`: `Key`, `Value`, `UpdatedAt`
- `Machines`: `machineId`, `machineCode`, `machineName`, `location`, `status`, `deviceTokenHash`, `lastSeenAt`, `updatedAt`
- `Bookings`: `bookingId`, `bookingNumber`, `email`, `name`, `hd`, `emailPrefix`, `machineId`, `machineCode`, `startAt`, `endAt`, `status`, `manageCodeHash`, `createdAt`, `updatedAt`, `idempotencyKey`, `extensionCount`
- `Users`: `userId`, `email`, `name`, `emailPrefix`, `username`, `role`, `machineCode`, `passwordAlgorithm`, `passwordIterations`, `passwordSalt`, `passwordHash`, `allowedMinutes`, `isActive`, `sourceBookingId`, `updatedAt`
- `Identities`: `identityId`, `email`, `name`, `hd`, `emailPrefix`, `lastLoginAt`, `updatedAt`
- `Events`: `eventId`, `eventType`, `sessionId`, `bookingId`, `machineCode`, `username`, `status`, `payload`, `createdAt`, `updatedAt`
- `AuditLog`: `auditId`, `actorEmail`, `action`, `entityType`, `entityId`, `metadata`, `createdAt`

`emailPrefix` เป็น username สำหรับ TimeLock ส่วน password จะถูกสร้างใหม่เมื่อจอง เก็บใน Sheet เฉพาะ PBKDF2 verifier และแสดงรหัสจริงแก่ผู้ใช้ครั้งเดียว

## TimeLock Gateway

ระบบ TimeLock ไม่อ่าน Google Sheet จากเครื่องลูกโดยตรง เส้นทางข้อมูลคือ
`Private Google Sheet → BookingAiLab API → TimeLockApp`

กติกาการใช้งาน:

- จองได้ตลอด 24 ชั่วโมงทุกวัน เฉพาะวันปัจจุบัน โดยเริ่มจับเวลาทันที 180 นาทีหลังเลือกเครื่อง
- ถ้าเวลาเหลือก่อนเที่ยงคืนไม่ครบ 3 ชั่วโมง ระบบจะไม่รับการจองที่ข้ามวัน
- รอบแรกนับเป็นช่วงที่ 1 ต่อได้อีกไม่เกิน 2 ครั้ง รวมสูงสุด 540 นาที
- ต่อเวลาได้เฉพาะเมื่อไม่มีคิวถัดไปของเครื่องเดียวกันและเวลาใหม่ไม่เกิน 00:00
- เวลาเปลี่ยนวัน Apps Script จะลบ data rows ใน `Bookings` และ `Users` โดยคง header, Events, Audit และ Identities

ก่อน deploy TimeLockApp:

1. ตรวจว่าแท็บ `Users` ใช้ schema ตัวพิมพ์เล็กตามรายการด้านบนและมี `machineCode`, `isActive`, `sourceBookingId`
2. ตั้ง Google Sheet เป็น Private และแชร์ให้ service account ของ Backend เท่านั้น
3. ตั้ง Environment Variables ตาม `.env.example` ใน Vercel
4. สร้าง/หมุน Device Token ที่หน้า `/admin/machines` แล้วกรอก Token ครั้งเดียวตอนเปิด TimeLockApp ครั้งแรก
5. ให้ WPF เรียก extension check เมื่อครบเวลา แสดง popup แบบบังการใช้งาน 60 วินาที และเพิ่มเวลาเฉพาะหลัง confirm สำเร็จ

เมื่อผู้ใช้จองสำเร็จ หน้าเว็บจะแสดงเลขที่จอง, เครื่อง, ช่วงเวลา และ TimeLock username/password แบบใช้ครั้งเดียว
WPF ต้องใช้ username/password นั้นเรียก `POST /api/timelock/login` พร้อม `x-machine-code` และ `x-device-token`
จากนั้นใช้ `endAt` ใน response เป็นเวลาสิ้นสุดของ session ห้ามอ่าน Google Sheet หรือใช้เวลาที่คำนวณจาก client

TimeLockApp ส่ง heartbeat ทุก 15 วินาที หน้า Dashboard ถือว่า Offline เมื่อขาด heartbeat เกิน 45 วินาที
บัญชี offline cache ใช้ได้ 24 ชั่วโมง ผูกกับ MachineCode และถูกป้องกันด้วย Windows DPAPI
