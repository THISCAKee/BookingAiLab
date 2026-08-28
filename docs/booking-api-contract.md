# BookingAiLab — Booking และ WPF API Contract

เอกสารนี้เป็นข้อตกลงเบื้องต้นระหว่าง Booking Web และ WPF TimeLockApp ก่อนเริ่ม Implement จริง ทั้งสองโปรเจกต์ต้องใช้ชื่อ Field, Status และ Timezone ให้ตรงกัน

## หลักการ

- ทุก Endpoint ใช้ HTTPS
- WPF ส่ง `machine_code` และ Device Token ใน Header
- Server ตรวจสอบ Token ก่อนคืนข้อมูล
- Payload ใช้ JSON และเวลาใช้ ISO 8601 พร้อม Timezone
- Event ต้องประมวลผลแบบ Idempotent
- WPF ต้องตอบกลับด้วย `event_id` เดิมเพื่อป้องกันการประมวลผลซ้ำ

## Endpoints

### สร้าง Booking และคิวเครื่อง

หน้า Booking ส่งให้ Backend เฉพาะ `machineId` ส่วน Google identity มาจาก session ที่ Server ยืนยันแล้ว
Backend ส่ง Apps Script เฉพาะ machine reference, identity, one-time credential verifier และ idempotency key
โดยไม่มี `startAt` หรือ `endAt` จาก browser

Apps Script ใช้ Script Lock แล้วอ่านแท็บ `Bookings` ใหม่ทุกครั้ง:

- ถ้าเครื่องไม่มี Booking ที่ยังไม่จบ ช่วงใหม่เริ่มจากเวลาปัจจุบัน
- ถ้ามี Booking ก่อนหน้า ระบบตรวจ `Events` และต้องพบ `session_started` ของ Booking ล่าสุดก่อนจึงสร้างคิวใหม่ได้ หากยังไม่พบจะตอบ `BOOKING_PREVIOUS_NOT_STARTED`
- หน้า Public Booking ใช้เงื่อนไขเดียวกัน โดยแสดงสถานะ `waiting_for_login`, ปิดการเลือกเครื่องและปุ่มยืนยันจนกว่าจะพบ `session_started` จากนั้น refresh สถานะอัตโนมัติภายใน 10 วินาที เมื่อ session เริ่มแล้ว การ์ดแสดง `currentEndAt` และ `currentRemainingMinutes` จาก Booking สถานะ `active` เท่านั้น
- เมื่อ predecessor login แล้ว คิวใหม่เริ่ม 15 นาทีหลัง `endAt` จริงของ predecessor
- ทุกช่วงยาว 180 นาที และต้องสิ้นสุดไม่เกินเที่ยงคืน `Asia/Bangkok`
- ผู้ใช้ที่มี Booking ปัจจุบันหรืออนาคตบนเครื่องใดอยู่แล้วจะได้รับ `BOOKING_ALREADY_ACTIVE`
- Booking ที่ยืนยันแล้วไม่เลื่อนเวลาเมื่อ Booking ก่อนหน้ายกเลิกหรือ logout เร็ว

ผลสำเร็จคืน `startAt` และ `endAt` ของคิวโดยประมาณ หน้า confirmation ต้องสื่อสารว่าเวลาจริงจะเริ่มนับเมื่อผู้ใช้ login เข้า TimeLock และ Backend จะปรับ `startAt/endAt` เป็นเวลาจริงของ session ตอน login
การ retry ภายใน request ใช้ `idempotencyKey`, password verifier และ manage code ชุดเดิม จึงไม่สร้าง
Booking, User, Event หรือ Audit ซ้ำและรหัสที่แสดงยังตรงกับข้อมูลที่บันทึก

### Register Machine

```http
POST /api/machines/register
```

ใช้สำหรับลงทะเบียนหรือยืนยันเครื่องกับระบบกลาง โดยควรทำผ่านขั้นตอน Admin หรือ Setup Token ที่ออกให้เฉพาะเครื่อง

### Heartbeat

```http
POST /api/machines/heartbeat
```

ใช้สำหรับรายงานสถานะปัจจุบันของ TimeLockApp ทุก 15–30 วินาที โดยส่ง Device Token ผ่าน
`x-device-token` header เท่านั้น ระบบจะถือว่าเครื่องยัง Online เมื่อได้รับ heartbeat ล่าสุดไม่เกิน
45 วินาที และจะแสดงเป็น Offline/Stale หลังจากนั้น

Request:

```json
{
  "machineCode": "PC-001",
  "username": "student01",
  "sessionStatus": "logged_in",
  "appVersion": "1.0.0",
  "osVersion": "Windows",
  "reportedAt": "2026-08-20T09:55:00+07:00"
}
```

`sessionStatus` รองรับ `logged_in`, `logged_out` และ `idle` เมื่อเป็น `logged_out` ให้ส่ง
`username` เป็นค่าว่างหรือ `null` ได้

Response สำเร็จ:

```json
{
  "ok": true,
  "machine": {
    "machineId": "machine-id",
    "machineCode": "PC-001",
    "receivedAt": "2026-08-20T02:55:00.000Z"
  }
}
```

ข้อผิดพลาดหลัก: `INVALID_HEARTBEAT`, `MACHINE_TOKEN_INVALID`, `USERNAME_REQUIRED`

### TimeLock login

```http
POST /api/timelock/login
x-machine-code: PC-001
x-device-token: <device-token>
Content-Type: application/json
```

Request:

```json
{
  "username": "student",
  "password": "one-time-password"
}
```

เมื่อ login สำเร็จ Backend จะตรวจ `Users`, `Bookings` และ machine ให้สัมพันธ์กันก่อนสร้าง
`session_started` ใน `Events` แล้วคืนข้อมูล session ที่ WPF ใช้ตั้ง timer:

```json
{
  "ok": true,
  "session": {
    "sessionId": "session-id",
    "bookingId": "booking-id",
    "bookingNumber": "BK-20260825-0001",
    "machineCode": "PC-001",
    "username": "student",
    "startedAt": "2026-08-25T01:30:00.000Z",
    "endAt": "2026-08-25T04:30:00.000Z",
    "allowedMinutes": 180,
    "extensionCount": 0,
    "status": "active"
  }
}
```

`startedAt` คือเวลาที่ login สำเร็จจริง และ `endAt` คือ `startedAt + allowedMinutes` จาก Server เท่านั้น WPF ห้ามคำนวณหรือรับค่าแทนจาก client และต้องใช้ `endAt` เป็นเวลาสิ้นสุด authoritative ก่อนเรียก extension check/confirm

ระบบไม่บังคับให้ login ตรงกับ `Bookings.startAt/endAt` ที่เป็นเวลา provisional ตอนจอง ผู้ใช้ที่ login ช้ากว่าเวลาประมาณการยังได้รับเวลาเต็ม `allowedMinutes` จากเวลาที่ login หาก session ใหม่จะข้ามเที่ยงคืน ระบบตอบ HTTP 409:

```json
{ "ok": false, "code": "BOOKING_CROSSES_MIDNIGHT" }
```

ก่อน append `session_started` Backend จะปรับ Booking แถวเดิมเป็น `startAt = loginAt`, `endAt = loginAt + allowedMinutes` และสถานะ `active` response ห้ามมี password/verifier หรือข้อมูลภายใน

ข้อผิดพลาดหลัก: `MACHINE_TOKEN_INVALID`, `LOGIN_INVALID`, `CREDENTIALS_INVALID`,
`ACCOUNT_MACHINE_MISMATCH`, `BOOKING_CROSSES_MIDNIGHT`

### TimeLock offline sync

```http
POST /api/timelock/sync
x-machine-code: PC-001
x-device-token: <device-token>
```

Backend ส่งเฉพาะบัญชีที่ User ยัง active และผูกกับ Booking/เครื่องเดียวกันที่ยังไม่เป็น terminal เท่านั้น
เวลา `startAt/endAt` ก่อน login เป็นเวลา provisional จึงไม่ตัดบัญชีทิ้งเพียงเพราะเวลาประมาณการผ่านแล้ว
หลัง login สำเร็จ `expiresAt` และ session window ต้องอ้างอิง `Booking.endAt` ที่ถูกปรับเป็นเวลาจริง

WPF ต้อง Sync เพื่อรับข้อมูลล่าสุดก่อน login และต้องลบ/ปฏิเสธ verifier เมื่อ session จบหรือถึง `expiresAt`
ห้ามใช้ Offline Cache เป็น fallback เพื่อสร้าง session ที่ไม่ผ่านการยืนยันของ TimeLock Backend

### TimeLock logout และหมดเวลา

```http
POST /api/timelock/logout
x-machine-code: PC-001
x-device-token: <device-token>
Content-Type: application/json
```

```json
{
  "sessionId": "session-id-from-login",
  "usedSeconds": 10800,
  "status": "completed"
}
```

`status` รองรับ `logged_out`, `completed` และ `forced_logout` เมื่อรับรายการสำเร็จ Backend จะสร้าง
`session_ended`, ปิดบัญชี TimeLock ของ Booking เดิม และเปลี่ยน Booking เป็น `completed` รหัสผ่านเดิม
จึงใช้ Login ซ้ำไม่ได้ ผู้ใช้ต้องจองใหม่เพื่อรับรหัสผ่านใหม่ แต่ยังใช้ Username เดิมได้

WPF ต้องลบบัญชีดังกล่าวออกจาก Offline Cache ทันทีเมื่อ Session จบทุกสถานะ เพื่อไม่ให้ verifier
ที่เคย Sync ไปยังเครื่องถูกนำกลับมาใช้ระหว่างออฟไลน์

### ดึง Event ของเครื่อง

```http
GET /api/machines/PC-001/events?limit=20
```

เมื่อมีการจองสำเร็จ ระบบจะบันทึก Event ภายในชื่อ `booking_confirmed` พร้อม `bookingId`, `machineCode`,
`username` และ metadata ของเลขที่จอง/เวลา/โควตาเพื่อ audit และการตรวจสอบการส่งต่อข้อมูลให้ TimeLock
โดยไม่มี plaintext password หรือ password verifier อยู่ใน Event

Response:

```json
{
  "events": [
    {
      "eventId": "event-id",
      "eventType": "booking_confirmed",
      "bookingId": "booking-id",
      "bookingNumber": "BK-20260820-0001",
      "machineCode": "PC-001",
      "startAt": "2026-08-20T10:00:00+07:00",
      "endAt": "2026-08-20T12:00:00+07:00",
      "username": "booking_0001",
      "status": "confirmed",
      "payload": {
        "bookingNumber": "BK-20260820-0001",
        "allowedMinutes": 180
      }
    }
  ]
}
```

### ตอบรับ Event

```http
POST /api/machine-events/event-id/ack
```

Request:

```json
{
  "status": "processed",
  "processedAt": "2026-08-20T09:56:00+07:00",
  "message": null
}
```

### รายงานสถานะ Session

```http
POST /api/bookings/booking-id/session-status
```

Request:

```json
{
  "status": "active",
  "reportedAt": "2026-08-20T10:00:02+07:00",
  "usedSeconds": 2
}
```

## Error Codes

```text
MACHINE_NOT_REGISTERED
MACHINE_TOKEN_INVALID
BOOKING_NOT_FOUND
BOOKING_ALREADY_ACTIVE
BOOKING_PREVIOUS_NOT_STARTED
BOOKING_CROSSES_MIDNIGHT
BOOKING_MACHINE_UNAVAILABLE
BOOKING_ATOMIC_BUSY
EVENT_ALREADY_PROCESSED
INVALID_STATUS_TRANSITION
RATE_LIMITED
```

`BOOKING_ATOMIC_BUSY` และ `BOOKING_PREVIOUS_NOT_STARTED` เป็น error ที่ retry ได้ โดย request เดิมต้องใช้ idempotency key และ credential
payload ชุดเดิม ส่วน `BOOKING_ALREADY_ACTIVE` ต้องรอ Booking เดิมสิ้นสุดหรือยกเลิกก่อนจึงจองใหม่ได้

## ต่อเวลา TimeLock Session

ทุก request ใช้ header ของเครื่องเดิม:

```http
x-machine-code: PC-001
x-device-token: <device-token>
Content-Type: application/json
```

### ตรวจสิทธิ์ต่อเวลา

```http
POST /api/timelock/extension/check
```

```json
{
  "sessionId": "session-id-from-login"
}
```

Response เมื่ออนุญาต:

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

เมื่อ `canExtend` เป็น `false`, `proposedEndAt` เป็น `null` และ `reason` เป็นหนึ่งใน:

- `EXTENSION_LIMIT_REACHED`: ใช้ครบ 3 ช่วงหรือ 540 นาทีแล้ว
- `EXTENSION_CROSSES_MIDNIGHT`: เวลาใหม่จะเกิน 00:00 หรือเหลือเวลาไม่ครบ 180 นาที
- `EXTENSION_NEXT_BOOKING_CONFLICT`: มีคิวถัดไปของเครื่องเดียวกันซ้อนช่วงใหม่
- `EXTENSION_BOOKING_INACTIVE`: Booking จบแล้วหรือไม่ใช่ข้อมูลของวันปัจจุบัน
- `EXTENSION_ACCOUNT_MISMATCH`: Session, User, Booking หรือเครื่องไม่สัมพันธ์กัน

### ยืนยันต่อเวลา

```http
POST /api/timelock/extension/confirm
```

```json
{
  "sessionId": "session-id-from-login",
  "idempotencyKey": "new-uuid-for-this-confirmation"
}
```

Response สำเร็จ:

```json
{
  "ok": true,
  "data": {
    "bookingId": "booking-id",
    "endAt": "2026-08-24T07:30:00.000Z",
    "extensionCount": 1,
    "allowedMinutes": 180
  }
}
```

`allowedMinutes` คือจำนวนนาทีที่อนุญาตสำหรับช่วงที่เพิ่งต่อ จึงมีค่า `180` ทุกครั้งและไม่สะสมเป็น 360 หรือ 540 นาที
WPF ต้องใช้ `endAt` เป็นเวลาสิ้นสุดรวมที่ authoritative

WPF ต้องใช้ `idempotencyKey` เดิมเมื่อ retry request เดิม ห้ามสร้างค่าใหม่จนกว่าจะเป็นการกดต่อเวลาครั้งถัดไป Server จะคำนวณเวลาใหม่เองและไม่รับ `endAt`, `allowedMinutes`, `bookingId` หรือ `machineCode` จาก body

เมื่อครบเวลา WPF ต้องบังการใช้งานเครื่องและแสดง popup 60 วินาที มีปุ่ม “ต่อเวลา 180 นาที” กับ “ออกจากระบบ” หากไม่เลือกภายในเวลาให้ forced logout เมื่อผู้ใช้กดต่อเวลา ห้ามเพิ่มเวลาที่ client จนกว่า confirm จะสำเร็จ หาก confirm ถูกปฏิเสธเพราะมีคิวใหม่ ให้ปิด popup และจบ session ตามเวลาเดิม

ช่วงพัก 15 นาทีก่อน Booking ถัดไปไม่ใช่เวลาที่ Session ปัจจุบันนำไปใช้หรือต่อเวลาได้ หากการต่อ
180 นาทีทับ `startAt` ของคิวถัดไป Server จะคืน `EXTENSION_NEXT_BOOKING_CONFLICT` โดยไม่เปลี่ยน
Booking, User, Event หรือ Audit

## ข้อกำหนดด้านความปลอดภัย

- ห้ามส่ง Google Service Account Key หรือ Apps Script secret ให้ WPF
- ห้ามส่ง Credential ผ่าน Query String
- ห้ามบันทึก Password ลง Log
- จำกัด Event ตาม `machine_id` ของ Token
- หมุน Device Token ได้จาก Admin
- ยกเลิก Token ได้เมื่อเครื่องถูกถอดออกจากระบบ
