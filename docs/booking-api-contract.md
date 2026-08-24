# BookingAiLab — WPF API Contract Draft

เอกสารนี้เป็นข้อตกลงเบื้องต้นระหว่าง Booking Web และ WPF TimeLockApp ก่อนเริ่ม Implement จริง ทั้งสองโปรเจกต์ต้องใช้ชื่อ Field, Status และ Timezone ให้ตรงกัน

## หลักการ

- ทุก Endpoint ใช้ HTTPS
- WPF ส่ง `machine_code` และ Device Token ใน Header
- Server ตรวจสอบ Token ก่อนคืนข้อมูล
- Payload ใช้ JSON และเวลาใช้ ISO 8601 พร้อม Timezone
- Event ต้องประมวลผลแบบ Idempotent
- WPF ต้องตอบกลับด้วย `event_id` เดิมเพื่อป้องกันการประมวลผลซ้ำ

## Endpoints

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

### ดึง Event ของเครื่อง

```http
GET /api/machines/PC-001/events?limit=20
```

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
      "password": "one-time-password"
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
EVENT_ALREADY_PROCESSED
BOOKING_EXPIRED
INVALID_STATUS_TRANSITION
RATE_LIMITED
```

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
    "allowedMinutes": 360
  }
}
```

WPF ต้องใช้ `idempotencyKey` เดิมเมื่อ retry request เดิม ห้ามสร้างค่าใหม่จนกว่าจะเป็นการกดต่อเวลาครั้งถัดไป Server จะคำนวณเวลาใหม่เองและไม่รับ `endAt`, `allowedMinutes`, `bookingId` หรือ `machineCode` จาก body

เมื่อครบเวลา WPF ต้องบังการใช้งานเครื่องและแสดง popup 60 วินาที มีปุ่ม “ต่อเวลา 3 ชั่วโมง” กับ “ออกจากระบบ” หากไม่เลือกภายในเวลาให้ forced logout เมื่อผู้ใช้กดต่อเวลา ห้ามเพิ่มเวลาที่ client จนกว่า confirm จะสำเร็จ หาก confirm ถูกปฏิเสธเพราะมีคิวใหม่ ให้ปิด popup และจบ session ตามเวลาเดิม

## ข้อกำหนดด้านความปลอดภัย

- ห้ามส่ง Google Service Account Key หรือ Apps Script secret ให้ WPF
- ห้ามส่ง Credential ผ่าน Query String
- ห้ามบันทึก Password ลง Log
- จำกัด Event ตาม `machine_id` ของ Token
- หมุน Device Token ได้จาก Admin
- ยกเลิก Token ได้เมื่อเครื่องถูกถอดออกจากระบบ
