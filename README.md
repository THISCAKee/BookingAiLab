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

## ขอบเขตเริ่มต้น

โฟลเดอร์นี้เป็นเอกสารออกแบบสำหรับนำไปสร้างโปรเจกต์ Next.js ต่อบน MacBook ยังไม่มีโค้ดระบบ Production และยังไม่มี Secret ใด ๆ อยู่ในโฟลเดอร์นี้

## การพัฒนาบน MacBook

1. คัดลอกโฟลเดอร์ `BookingAiLab` ไปยังเครื่อง MacBook
2. สร้าง Next.js App ภายในโฟลเดอร์นี้หรือตามโครงสร้างที่ทีมกำหนด
3. ตั้งค่า Environment Variables จากไฟล์ตัวอย่างของระบบจริง โดยห้าม Commit Secret
4. อ่าน Design Spec และ API Contract ก่อนเริ่มแก้ฐานข้อมูลหรือ WPF

## TimeLock Gateway

ระบบ TimeLock รุ่นใหม่ไม่อ่าน Google Sheet จากเครื่องลูกโดยตรงแล้ว เส้นทางข้อมูลคือ
`Private Google Sheet → BookingAiLab API → Supabase → TimeLockApp`

ก่อน deploy:

1. เพิ่มคอลัมน์ `MachineCode` ต่อจาก `IsActive` ในชีต `Users` และกำหนดค่า เช่น `PC-001`
2. ตั้ง Google Sheet เป็น Private และแชร์ให้ service account ของ Backend เท่านั้น
3. ตั้ง Environment Variables ตาม `.env.example` ใน Vercel (ห้ามใช้ service-role key ในตัว TimeLockApp)
4. รัน migration `202608190001_timelock_gateway.sql` บน Supabase
5. สร้าง/หมุน Device Token ที่หน้า `/admin/machines` แล้วกรอก Token ครั้งเดียวตอนเปิด TimeLockApp ครั้งแรก

TimeLockApp ส่ง heartbeat ทุก 15 วินาที หน้า Dashboard ถือว่า Offline เมื่อขาด heartbeat เกิน 45 วินาที
บัญชี offline cache ใช้ได้ 24 ชั่วโมง ผูกกับ MachineCode และถูกป้องกันด้วย Windows DPAPI
