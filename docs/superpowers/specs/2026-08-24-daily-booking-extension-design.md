# Daily Booking and Time Extension Design

## Objective

ปรับระบบ BookingAiLab ให้จองเครื่องได้เฉพาะวันปัจจุบันตลอด 24 ชั่วโมงทุกวัน ผู้ใช้หนึ่งคนเริ่มใช้งานทันทีครั้งละ 3 ชั่วโมง และต่อเวลาได้จนมีเวลารวมสูงสุด 9 ชั่วโมงต่อวัน เฉพาะเมื่อไม่มีคิวถัดไปของเครื่องเดียวกันและยังเหลือเวลาก่อน 00:00 ครบ 3 ชั่วโมง

หมายเหตุการปรับล่าสุด: ยกเลิกการแสดงและเลือก slot เวลา หน้าเว็บให้เลือกเฉพาะเครื่อง และ backend คำนวณ `startAt` จากเวลาปัจจุบันของเซิร์ฟเวอร์เสมอ ช่วงเริ่มต้นที่ทำให้จบหลังเที่ยงคืนจะถูกปฏิเสธ

Google Sheet ยังคงเป็นแหล่งข้อมูลหลักเพียงแห่งเดียว ระบบไม่ใช้ Supabase runtime

## Confirmed Rules

- หน้าเว็บแสดงและรับการจองเฉพาะวันปัจจุบันตามเขตเวลา `Asia/Bangkok`
- เปิดให้จองทุกวัน วันจันทร์ถึงวันอาทิตย์
- หนึ่งช่วงมีระยะเวลา 180 นาที
- รอบแรกนับเป็นช่วงที่ 1 ผู้ใช้ต่อเวลาได้อีกไม่เกิน 2 ครั้ง รวมสูงสุด 3 ช่วงหรือ 540 นาทีต่อวัน
- การต่อเวลาแต่ละครั้งต้องเพิ่มเต็ม 180 นาทีเท่านั้น
- ต่อเวลาได้เกินเวลาปิดปกติใน `Settings.closingTime` แต่เวลาสิ้นสุดใหม่ต้องไม่เกิน 00:00 ของวันเดียวกัน
- ถ้าเวลาที่เหลือก่อน 00:00 น้อยกว่า 180 นาที ห้ามต่อเวลา
- ถ้ามีรายการจองที่ยัง active ของเครื่องเดียวกันซ้อนกับช่วงต่อเวลาใหม่ ห้ามต่อเวลา
- เวลา 00:00 ให้ลบข้อมูลแถวของวันเก่าออกจาก `Bookings` และลบบัญชีชั่วคราวออกจาก `Users`
- ไม่ลบ `Identities`, `Machines`, `Settings`, `Events` หรือ `AuditLog`
- popup ต่อเวลาแสดงใน WPF TimeLockApp บนเครื่องที่กำลังใช้งาน ไม่แสดงในเว็บ

## Scope

### In Scope for This Repository

- กติกาเลือกเครื่องและสร้างช่วงเริ่มทันทีเฉพาะวันนี้
- การบังคับใช้ระยะเวลา 180 นาทีและเปิดทุกวันทั้งฝั่ง Next.js และ Apps Script
- API สำหรับ WPF ตรวจสิทธิ์ต่อเวลาและยืนยันการต่อเวลา
- การบันทึก TimeLock session ลง `Events` เพื่อผูก `sessionId` กับ Booking เครื่อง และบัญชีที่ผ่านการยืนยัน
- atomic mutation ใน Apps Script สำหรับต่อเวลาโดยตรวจคิวซ้ำภายใต้ script lock
- schema ของ `Bookings` สำหรับนับจำนวนช่วง
- การเพิ่ม `endAt` ของ Booking และ `allowedMinutes` ของบัญชี TimeLock เมื่อยืนยันต่อเวลา
- Apps Script time-driven trigger สำหรับล้าง `Bookings` และ `Users` เวลา 00:00
- API contract และคำแนะนำสำหรับนำไปทำ popup ใน WPF อีกเครื่อง
- automated tests ของกติกา API parsing และ repository boundary

### Out of Scope

- การแก้ซอร์ส WPF TimeLockApp เพราะซอร์สอยู่บนคอมพิวเตอร์อีกเครื่อง
- การ deploy WPF executable ไปยังเครื่องทั้ง 6
- การลบข้อมูลจาก `Events`, `AuditLog` หรือ `Identities`
- การนำ Supabase กลับมาใช้

## Architecture

ระบบแบ่งความรับผิดชอบดังนี้:

1. Next.js คำนวณเวลาปัจจุบันของเซิร์ฟเวอร์ สร้างช่วง 180 นาที และให้ API ที่ตรวจสอบ Device Token และรูปแบบ request จาก WPF
2. Google Apps Script เป็นเจ้าของ mutation ที่ต้องป้องกัน race condition ได้แก่สร้าง Booking ยืนยันต่อเวลา และล้างข้อมูลรายวัน
3. Google Sheet เป็นข้อมูลจริงของ Booking บัญชี TimeLock เครื่อง และค่าตั้งระบบ
4. WPF TimeLockApp จับเวลาบนเครื่อง เมื่อครบช่วงเรียก API ตรวจสิทธิ์ แสดง popup เมื่อ `canExtend` เป็นจริง และเรียก API ยืนยันเมื่อผู้ใช้กดต่อเวลา

การตรวจสิทธิ์เบื้องต้นใน Next.js ช่วยตอบผลได้ชัดเจน แต่การยืนยันต่อเวลาต้องตรวจทุกเงื่อนไขซ้ำใน Apps Script ภายใต้ `LockService` เสมอ เพื่อให้การจองคิวใหม่และการต่อเวลาไม่สามารถยึดช่วงเวลาเดียวกันพร้อมกันได้

## Google Sheet Schema

เพิ่มคอลัมน์ต่อไปนี้ท้ายแท็บ `Bookings`:

- `extensionCount`: จำนวนครั้งที่ต่อเวลา ค่าเริ่มต้น `0` และค่าสูงสุด `2`

`endAt` เป็นเวลาสิ้นสุดล่าสุดหลังต่อเวลา ส่วนเวลารวมของ TimeLock คำนวณเป็น `(extensionCount + 1) * 180` นาที ไม่ต้องเพิ่มคอลัมน์ซ้ำสำหรับเวลารวม

แท็บ `Users` ใช้ `allowedMinutes` เดิม:

- สร้าง Booking: `180`
- ต่อครั้งที่ 1: `360`
- ต่อครั้งที่ 2: `540`

`sourceBookingId` เชื่อมบัญชีใน `Users` กับ Booking ที่กำลังใช้งาน

แท็บ `Events` ใช้ schema เดิมบันทึก lifecycle ของ TimeLock session:

- เมื่อ login สำเร็จ เพิ่ม event `session_started` ที่มี `sessionId`, `bookingId`, `machineCode`, `username` และ `status = active`
- เมื่อ logout หรือหมดเวลา เพิ่ม event `session_ended` ที่อ้าง `sessionId` เดิมและสถานะปลายทาง
- extension API ยอมรับเฉพาะ `sessionId` ที่มี `session_started` ตรงกับเครื่องและยังไม่มี `session_ended`

## Daily Booking Flow

1. เว็บคำนวณวันที่วันนี้ใน `Asia/Bangkok` และแสดงตัวเลือกวันเดียว
2. ระบบสร้างช่วง 180 นาทีจากเวลาปัจจุบัน หากไม่ข้ามเที่ยงคืน
3. ผู้ใช้เลือกเครื่อง จากนั้น Next.js ตรวจ policy จากข้อมูล Sheet
4. Apps Script ตรวจวัน เวลา เครื่อง คิวซ้อน ผู้ใช้ซ้อน และ idempotency ภายใต้ lock
5. เมื่อสำเร็จ Apps Script เพิ่ม Booking โดยตั้ง `extensionCount = 0` และ upsert บัญชี `Users.allowedMinutes = 180`
6. Booking ของวันอื่นถูกปฏิเสธด้วย `BOOKING_DATE_NOT_ALLOWED` แม้ client ส่ง request เอง

หน้าเว็บไม่รับวันที่พรุ่งนี้อีกต่อไป การตั้งค่า `serviceWeekdays` จะถูกกำหนดเป็น `1,2,3,4,5,6,7`

## Time Extension Flow

### Eligibility Check

เมื่อเวลาของช่วงปัจจุบันกำลังจะหมด WPF เรียก endpoint ตรวจสิทธิ์ โดยส่ง `sessionId` และข้อมูล Device Token ตาม contract เดิม Backend resolve session ที่ยัง active จาก `Events` แล้วระบุบัญชีและ Booking จากข้อมูล server ไม่เชื่อค่า `bookingId`, `username` หรือ `machineCode` ที่ client เลือกเอง

ผลตรวจประกอบด้วย:

- `canExtend`: อนุญาตให้แสดง popup หรือไม่
- `reason`: เหตุผลแบบ machine-readable
- `currentEndAt`: เวลาสิ้นสุดปัจจุบัน
- `proposedEndAt`: เวลาสิ้นสุดหลังต่อ 180 นาทีเมื่ออนุญาต
- `extensionCount`: จำนวนครั้งที่ต่อแล้ว
- `maxExtensionCount`: ค่า `2`

เหตุผลที่ไม่อนุญาต:

- `EXTENSION_LIMIT_REACHED`: ใช้ครบ 3 ช่วงแล้ว
- `EXTENSION_CROSSES_MIDNIGHT`: เวลาที่เหลือก่อน 00:00 ไม่ครบ 180 นาที
- `EXTENSION_NEXT_BOOKING_CONFLICT`: มีคิวถัดไปซ้อนกับช่วงใหม่
- `EXTENSION_BOOKING_INACTIVE`: Booking ไม่อยู่ในสถานะใช้งาน
- `EXTENSION_ACCOUNT_MISMATCH`: บัญชี Session เครื่อง และ Booking ไม่ตรงกัน

### Confirmation

เมื่อผู้ใช้กดต่อเวลา WPF เรียก endpoint ยืนยันพร้อม idempotency key Apps Script ทำงานภายใต้ script lock และ:

1. โหลด Booking และบัญชี `Users` ใหม่
2. ตรวจว่า Booking ยัง active และอยู่กับเครื่อง/บัญชีที่ร้องขอ
3. ตรวจ `extensionCount < 2`
4. คำนวณ `proposedEndAt = currentEndAt + 180 นาที`
5. ตรวจว่า `proposedEndAt` ไม่เกิน 00:00 ใน `Asia/Bangkok`
6. ตรวจ Booking active อื่นของเครื่องเดียวกันว่าซ้อนกับช่วง `[currentEndAt, proposedEndAt)` หรือไม่
7. ถ้าผ่านทั้งหมด อัปเดต `Bookings.endAt`, เพิ่ม `extensionCount` หนึ่ง และตั้ง `Users.allowedMinutes = (extensionCount + 1) * 180`
8. บันทึก Event/Audit ของผลการต่อเวลาโดยไม่เก็บ secret

หากมีผู้จองคิวถัดไประหว่างที่ popup เปิดอยู่ การยืนยันต้องคืน `EXTENSION_NEXT_BOOKING_CONFLICT` และ WPF ต้องปิด popup แล้วจบ session ตามเวลาเดิม

## API Contract

เพิ่ม endpoint สำหรับ WPF:

- `POST /api/timelock/extension/check`
- `POST /api/timelock/extension/confirm`

ทั้งสอง endpoint ต้องใช้ header ระบุเครื่องและ Device Token แบบเดียวกับ TimeLock API เดิม และคืน JSON เท่านั้น

ตัวอย่างผล check ที่อนุญาต:

```json
{
  "ok": true,
  "data": {
    "canExtend": true,
    "reason": "EXTENSION_AVAILABLE",
    "currentEndAt": "2026-08-24T04:30:00.000Z",
    "proposedEndAt": "2026-08-24T07:30:00.000Z",
    "extensionCount": 0,
    "maxExtensionCount": 2
  }
}
```

ตัวอย่างผล check เมื่อมีคิวถัดไป:

```json
{
  "ok": true,
  "data": {
    "canExtend": false,
    "reason": "EXTENSION_NEXT_BOOKING_CONFLICT",
    "currentEndAt": "2026-08-24T04:30:00.000Z",
    "proposedEndAt": null,
    "extensionCount": 0,
    "maxExtensionCount": 2
  }
}
```

Confirm request ต้องมี `sessionId` และ `idempotencyKey` หาก request เดิมถูกส่งซ้ำต้องได้ผลเดิมโดยไม่เพิ่มเวลาอีกครั้ง

## WPF Integration Contract

งานบนเครื่อง WPF ภายหลังต้องทำตามลำดับนี้:

1. ก่อนหมดเวลาเล็กน้อยหรือทันทีที่ครบ 180 นาที เรียก extension check
2. แสดง popup เฉพาะเมื่อ `canExtend` เป็น `true`
3. เมื่อครบเวลา popup ต้องบังการใช้งานเครื่อง มีปุ่ม “ต่อเวลา 3 ชั่วโมง” และ “ออกจากระบบ” พร้อม countdown 60 วินาที ถ้าไม่มีการเลือกให้จบ session และออกจากระบบอัตโนมัติ
4. เมื่อกดต่อเวลา สร้าง idempotency key หนึ่งค่าและเรียก confirm
5. เพิ่มเวลาบน client เฉพาะเมื่อ confirm คืนสำเร็จ ห้ามเพิ่มเวลาก่อน server ยืนยัน
6. ถ้า confirm ถูกปฏิเสธ ปิด popup แสดงเหตุผลภาษาไทย และบังคับจบ session ตามเวลาเดิม
7. หลังต่อสำเร็จ sync บัญชีใหม่เพื่อให้ offline cache ได้ `allowedMinutes` ล่าสุด

## Midnight Cleanup

Apps Script มีฟังก์ชันติดตั้ง time-driven trigger และ cleanup function แยกจาก initializer:

- trigger ทำงานทุก 1 นาทีและตรวจวันที่ตาม timezone ของ Spreadsheet คือ `Asia/Bangkok` เนื่องจาก Apps Script ไม่รับประกันการเรียกตรงวินาที 00:00
- installer ตั้ง Script Property `LAST_DAILY_CLEANUP_DATE` เป็นวันที่ติดตั้ง เพื่อไม่ให้การติดตั้งกลางวันลบรายการของวันปัจจุบัน
- เมื่อวันที่ปัจจุบันไม่ตรงกับ `LAST_DAILY_CLEANUP_DATE` cleanup ลบข้อมูลทั้งหมดใน `Bookings` และ `Users` แล้วอัปเดต property เป็นวันปัจจุบัน ทำให้โดยปกติถูกลบภายในประมาณ 1 นาทีหลัง 00:00
- cleanup ใช้ script lock ป้องกันชนกับ create/extend mutation
- ลบ data rows ทั้งหมดใน `Bookings` โดยคง header
- ลบ data rows ทั้งหมดใน `Users` โดยคง header
- เขียน AuditLog สรุปจำนวนแถวที่ลบและเวลาที่ทำงานเฉพาะเมื่อมีข้อมูลถูกลบ
- การเรียก cleanup ซ้ำในวันเดียวกันต้องปลอดภัยและได้ผลเป็นศูนย์แถวเมื่อไม่มีข้อมูล

ระบบ booking และ TimeLock API ต้องปฏิเสธข้อมูลที่ไม่ใช่วันปัจจุบันตาม policy ด้วย จึงไม่มีช่วงที่ข้อมูลเมื่อวานกลับมาใช้งานได้ระหว่างรอ trigger รอบแรกหลัง 00:00

## Error Handling and Security

- Device Token ถูกตรวจด้วย hash เดิมและไม่ส่งกลับใน response
- Apps Script secret อยู่เฉพาะ server environment และ Script Properties
- mutation ทุกชนิดใช้ script lock และ idempotency key
- client ไม่สามารถกำหนดจำนวนเวลาหรือ `proposedEndAt` เอง Server คำนวณเป็น 180 นาทีเสมอ
- ข้อผิดพลาด API ใช้ code คงที่ ส่วน WPF เป็นผู้แปลเป็นข้อความภาษาไทย
- ถ้า Google Sheet หรือ Apps Script ติดต่อไม่ได้ WPF ต้องไม่ต่อเวลาและจบ session ตามเวลาเดิม
- cleanup ไม่ลบประวัติ Audit และไม่ลบข้อมูล OAuth identity

## Testing Strategy

Automated tests ต้องครอบคลุม:

- หน้าเว็บมีเฉพาะวันนี้และเปิดทุก weekday
- สร้าง Booking วันอื่นถูกปฏิเสธ
- extension check อนุญาตเมื่อไม่มีคิวและเวลาเหลือครบ 180 นาที
- ปฏิเสธเมื่อครบ 2 extensions
- ปฏิเสธเมื่อช่วงใหม่ข้าม 00:00
- ปฏิเสธเมื่อมีคิวถัดไปซ้อนแม้เพียงบางส่วน
- confirm rechecks คิวหลัง check
- confirm ซ้ำด้วย idempotency key เดิมไม่เพิ่มเวลาซ้ำ
- confirm อัปเดต Booking และ Users สอดคล้องกัน
- login บันทึก active session ใน `Events` และ extension API ปฏิเสธ session ที่จบแล้วหรือไม่ตรงเครื่อง
- cleanup คง header ลบเฉพาะ data rows ของ `Bookings` และ `Users`
- cleanup ซ้ำได้อย่างปลอดภัย
- API ปฏิเสธ Device Token หรือ request body ที่ไม่ถูกต้อง
- regression suite เดิมผ่านและไม่มี Supabase runtime

Manual verification ต้องตรวจ Google Sheet จริง การติดตั้ง trigger ทุก 1 นาที และ request/response ของ API ด้วย Device Token ทดสอบ ส่วน popup WPF และ forced logout จะตรวจบนอีกเครื่องเมื่อซอร์ส WPF พร้อม

## Deployment Sequence

1. เพิ่มคอลัมน์ `extensionCount` ใน Sheet และอัปเดต initializer
2. deploy Apps Script เวอร์ชันใหม่และติดตั้ง midnight trigger
3. deploy Next.js backend พร้อม extension endpoints
4. ทดสอบ create/check/confirm กับ Sheet จริง
5. นำ API contract ไปแก้ WPF บนอีกเครื่อง
6. ทดสอบ end-to-end โดยจำลองกรณีไม่มีคิว มีคิวถัดไป ครบโควตา และใกล้ 00:00

Backend deployment สามารถเกิดก่อน WPF ได้ โดย extension endpoint จะยังไม่ถูกเรียกจนกว่า WPF เวอร์ชันใหม่ถูกติดตั้ง
