# TimeLock Login-Based Timing Design

**Status:** Draft for review

## Goal

เปลี่ยนระบบจากการบังคับให้ผู้ใช้เข้า TimeLock ภายในช่วงเวลา `startAt/endAt` ที่สร้างตอนจอง เป็นระบบที่เริ่มนับเวลาเมื่อ login สำเร็จจริง และไม่เปิดให้สร้าง booking คิวถัดไปจนกว่าผู้จองก่อนหน้าจะ login เข้าใช้งานแล้ว

## Current behavior

- Apps Script สร้าง booking slot ยาว 180 นาทีทันที โดยกำหนด `startAt` เป็นเวลาปัจจุบันหรือ 15 นาทีหลัง `endAt` ล่าสุด
- Backend TimeLock ปฏิเสธ login ก่อน `startAt` ด้วย `BOOKING_NOT_STARTED` และหลัง `endAt` ด้วย `BOOKING_EXPIRED`
- Session response ใช้ `Bookings.endAt` เป็นเวลาสิ้นสุด
- Apps Script สามารถสร้าง booking ถัดไปจาก booking ที่ยัง active ได้ แม้ booking ก่อนหน้าจะยังไม่มี `session_started`

พฤติกรรมนี้ทำให้เวลาที่ไม่ได้ใช้งานจริงถูกนับรวม และสามารถมีคิวถัดไปก่อนผู้จองคนก่อนเริ่มใช้งาน

## Target behavior

### Booking creation

1. Booking แรกของเครื่องยังสร้างได้ทันทีตามเวลาปัจจุบัน และใช้เวลา 180 นาทีเป็นเวลา provisional สำหรับแสดงคิว
2. ถ้ามี booking ที่ยังไม่เป็น terminal (`cancelled`, `completed`, `expired`) อยู่บนเครื่อง ระบบต้องตรวจ Events ก่อนสร้าง booking ใหม่
3. ถ้า booking ล่าสุดยังไม่มี `session_started` ให้ปฏิเสธด้วย `BOOKING_PREVIOUS_NOT_STARTED`
4. ถ้า booking ล่าสุดมี `session_started` แล้ว ให้สร้าง booking ใหม่ต่อจาก `endAt` ปัจจุบันของ booking ล่าสุด โดยเว้น turnaround 15 นาที
5. การตรวจผู้จองซ้ำ เครื่องว่าง และข้อจำกัดไม่ให้ slot ข้ามวันยังคงทำงานเหมือนเดิม

การใช้ booking ล่าสุดหมายถึง booking ที่มีลำดับเวลาสิ้นสุดล่าสุดในชุด booking ที่ยังไม่เป็น terminal ของเครื่องนั้น การมี `session_started` เพียงพอสำหรับเปิดให้จองคิวถัดไป แม้ session ก่อนหน้าจะยังไม่ส่ง logout เพราะ slot ถัดไปยังเริ่มหลังเวลาสิ้นสุด authoritative ของ session เดิม

### TimeLock login

1. Backend ยังคงตรวจ Device Token, machine, account, password และ booking ที่สัมพันธ์กัน
2. Backend ไม่ตรวจ `now < booking.startAt` หรือ `now >= booking.endAt` อีกต่อไป จึงไม่มีการปฏิเสธด้วย `BOOKING_NOT_STARTED` หรือ `BOOKING_EXPIRED` สำหรับ booking ที่ยัง active
3. เมื่อ login สำเร็จ ให้กำหนด:

   - `startedAt = now`
   - `endAt = startedAt + allowedMinutes`

4. Backend อัปเดต booking แถวเดิมด้วยเวลาเริ่ม/สิ้นสุดจริงและสถานะ `active` ก่อนคืน session response
5. Backend append `session_started` ที่มี `startedAt` เดียวกับ response โดยไม่บันทึก password หรือ verifier
6. Session response ใช้ `startedAt` และ `endAt` ที่คำนวณจาก login เป็น authority สำหรับ WPF และ extension flow

การจองยังคงใช้กติกาของวันเดียวกันและไม่อนุญาตให้ช่วงใช้งานจริงข้ามเที่ยงคืน เพื่อให้สอดคล้องกับ daily cleanup และ queue เดิม หาก login ช้าเกินกว่าจะให้เวลาเต็มภายในวัน ระบบจะตอบ stable code `BOOKING_CROSSES_MIDNIGHT` โดยไม่สร้าง session

### Sync and queue display

- TimeLock sync ต้องส่ง account ที่ยัง active และมี booking ที่ยังไม่เป็น terminal โดยไม่กรองทิ้งเพียงเพราะเวลาประมาณการเดิมผ่านไปแล้ว
- หลัง login สำเร็จ `Bookings.startAt/endAt` จะกลายเป็นเวลาจริง ทำให้ sync, dashboard, queue preview และ extension เห็นเวลาชุดเดียวกัน
- หน้า booking ต้องสื่อสารว่าเวลาการใช้งานจริงเริ่มนับเมื่อ login เข้า TimeLock ไม่ใช่เมื่อกดจอง และเวลาที่แสดงก่อน login เป็นเวลาโดยประมาณของคิว
- หน้าและ API ไม่เปิดเผย password verifier หรือข้อมูลลับเพิ่มเติม

### Logout and extension

- Logout ยังคงปิด User, เปลี่ยน Booking เป็น `completed` และ append `session_ended`
- Extension ใช้ `Bookings.endAt` ที่ถูกปรับตอน login เป็น current end และยังคงใช้กติกา extension count, midnight และ next-booking conflict เดิม
- การขยายเวลาจะไม่เปิดทางให้ booking ใหม่ทับช่วงเวลาที่ authoritative ถูกขยาย

## Data flow

```text
create booking
  ├─ no active booking → provisional start/end
  └─ active latest booking
       ├─ no session_started → BOOKING_PREVIOUS_NOT_STARTED
       └─ session_started → next slot after latest end + 15 minutes

TimeLock login
  ├─ validate device/account/password/booking
  ├─ calculate startedAt=now, endAt=now+allowedMinutes
  ├─ update Bookings startAt/endAt/status
  ├─ append Events session_started
  └─ return authoritative session
```

## Error handling

- `BOOKING_PREVIOUS_NOT_STARTED` is a conflict (`409`) for booking attempts blocked by an unstarted predecessor
- `BOOKING_CROSSES_MIDNIGHT` remains a conflict (`409`) when a full login-based allowance cannot fit in the Bangkok service day
- `BOOKING_NOT_STARTED` and `BOOKING_EXPIRED` are removed from the normal login eligibility path
- Existing authentication and machine-isolation errors remain unchanged
- Partial provider failures must use existing safe fallback boundaries and must not include password, hash, token, or raw provider data

## Files and responsibilities

- `scripts/google-apps-script/Code.gs`: enforce predecessor login before queue creation and keep queue timing based on the latest authoritative booking end
- `lib/timelock/sheet-gateway.ts`: calculate login-based session end, persist the updated booking, and return the actual session window
- `lib/timelock/sheet-records.ts`: retain/extend event resolution helpers needed to identify a predecessor session
- `lib/booking/queue-policy.ts`: derive public queue state from active bookings while preserving the new predecessor rule in server authority
- `lib/timelock/offline-cache.ts` and sync path: avoid expiring an unstarted account solely from provisional booking time
- `lib/timelock/http.ts` and booking error mapping: expose stable safe conflict codes
- relevant TimeLock, Apps Script, queue, UI, and API tests: prove red/green behavior and protect existing logout/extension/security guarantees
- `docs/booking-api-contract.md` and user-facing booking copy: document login-based timing and the predecessor-login rule

## Testing strategy

Tests must cover observable behavior:

- login after the provisional `endAt` succeeds, starts at the login instant, and returns an `endAt` exactly `allowedMinutes` later
- login updates the stored booking window and appends a matching `session_started`
- a booking attempt after an unstarted predecessor returns `BOOKING_PREVIOUS_NOT_STARTED` and does not append rows
- a booking attempt after a predecessor with `session_started` uses the predecessor's updated `endAt` plus 15 minutes
- sync does not discard an active unstarted booking because its provisional end has passed
- extension and logout continue to use the adjusted authoritative end
- API responses expose only `{ ok, code }` on failure and never expose credentials/verifiers
- full Vitest suite, TypeScript/build, and `git diff --check` pass before completion

## Migration and compatibility

- Existing rows created under the old fixed-window behavior remain readable. An active row with no `session_started` is treated as an unstarted predecessor and cannot be bypassed by a new queue booking.
- A row with an existing `session_started` keeps its current `endAt` until a future login or extension mutation changes it.
- No new Sheet columns are required.
- The WPF client must use the returned session `endAt` after online login and must not locally derive a fixed booking start requirement. Direct WPF source changes are outside this repository.

## Out of scope

- changing the 180-minute allowance or 15-minute turnaround
- allowing a session to cross Bangkok midnight
- changing Google Sheets as the source of truth
- replacing the WPF application or its local UI
- unrelated booking, authentication, or admin refactors
