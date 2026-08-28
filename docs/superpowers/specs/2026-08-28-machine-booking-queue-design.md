# Machine Booking Queue Design

**Date:** 2026-08-28

**Scope:** Public booking availability, atomic Google Apps Script booking creation, TimeLock login/sync eligibility, booking confirmation UI, and API documentation

## Goal

เปลี่ยนระบบจากการจองแบบเริ่มทันทีเท่านั้นเป็นคิวต่อเครื่อง ผู้ใช้สามารถจองต่อท้ายเครื่องที่กำลังใช้งานอยู่ได้ โดย Booking ใหม่เริ่ม 15 นาทีหลัง Booking สุดท้ายของเครื่องและใช้งาน 180 นาที ระบบต้องแสดงเวลาเข้าใช้จริงก่อนยืนยัน ป้องกันผู้ใช้ที่มี Booking อยู่แล้วไม่ให้จองเพิ่ม และห้ามใช้ TimeLock ก่อนถึงเวลา

## Confirmed Rules

1. ใช้แท็บ `Bookings` เดิมเป็นข้อมูลจริงของคิว ไม่เพิ่มแท็บใหม่
2. เครื่องหนึ่งมีคิวต่อกันได้หลายรายการภายในวันปัจจุบัน
3. Booking แรกของเครื่องที่ไม่มีคิวเริ่มจากเวลาปัจจุบันและมีระยะเวลา 180 นาที
4. Booking ต่อท้ายเริ่ม 15 นาทีหลัง `endAt` ล่าสุดของคิวที่ยังมีผล และสิ้นสุดหลังจากนั้น 180 นาที
5. หาก Booking ใหม่สิ้นสุดหลังเที่ยงคืนตาม `Asia/Bangkok` ให้ปฏิเสธการจอง
6. เวลาของ Booking ที่ยืนยันแล้วเป็นเวลาคงที่ การยกเลิกหรือออกจากระบบก่อนเวลาของคิวก่อนหน้าไม่ทำให้คิวอื่นเลื่อนขึ้น
7. ผู้ใช้มี Booking ที่ยังมีผลได้เพียงหนึ่งรายการในระบบ ไม่ว่าจะเป็นเครื่องใดหรือเป็นคิวปัจจุบัน/อนาคต
8. Booking ที่สถานะ `cancelled`, `completed`, `expired` หรือมี `endAt` ผ่านไปแล้วไม่ขวางการจองใหม่
9. Username TimeLock เดิมใช้ซ้ำได้ แต่แต่ละ Booking สร้าง Password ใหม่
10. `endAt` เป็นเวลาสิ้นสุด authoritative ของ TimeLock และการต่อเวลาต้องไม่ทับ Booking ถัดไป

## Architecture

```text
Booking page
  -> read Settings, Machines, Bookings, signed-in identity
  -> derive a per-machine queue preview
  -> submit machineId only
  -> Apps Script acquires Script Lock
  -> re-read Bookings and recompute the authoritative queue slot
  -> append Booking, update TimeLock User, append Event/Audit
  -> return the authoritative startAt/endAt and credentials
```

การคำนวณบนหน้าเว็บมีไว้แสดงผลเท่านั้น Apps Script เป็นผู้ตัดสินเวลาสุดท้ายภายใต้ lock เพื่อป้องกันผู้จองพร้อมกันได้ช่วงเวลาเดียวกัน Client และ Next.js ห้ามกำหนดช่วงเวลาที่ Apps Script ต้องเชื่อถือ

## Queue Slot Algorithm

อินพุตคือ `machineId`, identity ที่ยืนยันแล้ว และเวลาปัจจุบันของ Server

1. ตรวจว่าเครื่องมีสถานะ `available`
2. ตรวจว่าผู้ใช้ไม่มี Booking ที่ยังมีผลบนเครื่องใด
3. เลือก Booking ของเครื่องเป้าหมายที่สถานะไม่ใช่ terminal และ `endAt > now`
4. ถ้าไม่มี Booking ดังกล่าว ให้ `startAt = now`
5. ถ้ามี ให้หา `endAt` มากที่สุด แล้วกำหนด `startAt = latestEndAt + 15 minutes`
6. กำหนด `endAt = startAt + 180 minutes`
7. ปฏิเสธหาก `startAt` ไม่ใช่วันปัจจุบัน หรือ `endAt` เกินเที่ยงคืนกรุงเทพฯ
8. บันทึก Booking ด้วยเวลา authoritative ที่คำนวณได้

คิวจะต่อท้าย Booking ที่ยังมีผลรายการสุดท้ายเสมอและไม่ขยับ Booking ที่ยืนยันแล้ว หากรายการท้ายสุดถูกยกเลิก ช่วงเวลาที่ถูกปล่อยสามารถนำกลับมาใช้กับคำขอใหม่ได้โดยไม่เปลี่ยนเวลาของคิวอื่น

## Public Booking Data Contract

`PublicBookingOptions` เปลี่ยนจากช่วงเวลารวมหนึ่งชุดเป็นข้อมูลต่อเครื่อง แต่ละ `PublicMachineOption` มีอย่างน้อย:

- `id`, `machineCode`, `machineName`, `location`
- `operationalStatus`: `available`, `in_use`, `queued`, หรือ `full_today`
- `bookable`: เลือกจองได้หรือไม่
- `nextStartAt`, `nextEndAt`: ช่วงเวลาที่คำขอใหม่จะได้รับตามข้อมูลล่าสุด
- `queueCount`: จำนวน Booking อนาคตที่มี `startAt > now` และยังมีผล
- `currentEndAt`: เวลาสิ้นสุดของ Booking ที่กำลังครอบคลุมเวลาปัจจุบัน หรือ `null`

ผลลัพธ์ระดับหน้ามี `viewerCanBook` และเหตุผลเมื่อผู้ใช้มี Booking อยู่แล้ว เพื่อให้ UI ปิดการเลือกทุกเครื่องก่อน Submit อย่างไรก็ตาม Apps Script ต้องตรวจซ้ำเสมอ

## UI Behavior

การ์ดเครื่องยังเลือกได้เมื่อสถานะ `in_use` หรือ `queued` ตราบใดที่ช่วงใหม่ไม่ข้ามเที่ยงคืน

- `available`: ป้าย “ว่าง” และข้อความ “เริ่มใช้งานได้ทันที”
- `in_use`: ป้าย “ใช้งานอยู่” พร้อมเวลาที่ Session ปัจจุบันสิ้นสุด
- `queued`: ป้าย “มีคิว” เมื่อไม่มี Session ครอบคลุมเวลาปัจจุบันแต่มี Booking อนาคต
- `full_today`: ป้าย “คิวเต็มสำหรับวันนี้” และปิดการเลือก
- การ์ดที่จองได้แสดง `เข้าใช้ได้ <start>–<end>` และจำนวนคิวที่รอ

เมื่อผู้ใช้มี Booking ที่ยังมีผล หน้าแสดงข้อความให้จบ Session หรือยกเลิก Booking เดิมก่อน และปิดปุ่มยืนยันทุกเครื่อง

หน้าผลลัพธ์และหน้าจัดการ Booking ใช้ `startAt/endAt` ที่ Apps Script คืนกลับมา ไม่ใช้ค่าพรีวิวเดิม

## TimeLock Eligibility

การสร้าง Booking คิวยังคงสร้าง Password และแสดงให้ผู้ใช้ครั้งเดียว แต่ Password ใช้ไม่ได้ก่อน `startAt`

### Online login

`POST /api/timelock/login` ต้องตรวจความสัมพันธ์ User/Booking/เครื่องและตรวจเวลา Server:

- ก่อน `startAt`: ปฏิเสธด้วย `BOOKING_NOT_STARTED` และคืนข้อมูล error ตาม contract โดยไม่สร้าง `session_started`
- ตั้งแต่ `startAt` จนก่อน `endAt`: อนุญาต Login
- ตั้งแต่ `endAt` เป็นต้นไป: ปฏิเสธด้วย `BOOKING_EXPIRED`

### Offline sync

`POST /api/timelock/sync` ส่งเฉพาะบัญชีที่ Booking อยู่ในช่วงเข้าใช้แล้ว (`startAt <= now < endAt`) บัญชีของคิวอนาคตจะไม่ถูกส่งเข้า Offline Cache ก่อนเวลา

WPF ต้อง Sync อีกครั้งเมื่อถึงเวลาที่แสดงแก่ผู้ใช้ และต้องไม่ใช้ verifier ที่หมดช่วงเวลาแล้ว Source WPF อยู่นอก repository นี้ จึงเป็น rollout dependency ของ contract ใหม่

## Extension Interaction

กติกาต่อเวลาเดิมยังใช้ต่อได้ โดย `proposedEndAt` เพิ่มครั้งละ 180 นาที หากมี Booking ถัดไปและช่วงต่อเวลาทับ `startAt` ของ Booking นั้น ให้คืน `EXTENSION_NEXT_BOOKING_CONFLICT`

ช่วงพัก 15 นาทีเป็นส่วนหนึ่งของตารางคิว ไม่ใช่เวลาที่ผู้ใช้ปัจจุบันนำไปต่อเวลาได้โดยอัตโนมัติ การต่อเวลาต้องผ่าน policy และ Apps Script ตามเดิม

## Cancellation and Session End

- การยกเลิกเปลี่ยนเฉพาะ Booking เป้าหมายเป็น `cancelled`
- คิวหลังจากนั้นคง `startAt/endAt` เดิม
- Logout, completed และ forced logout เปลี่ยน Booking ปัจจุบันเป็น `completed` และปิด credential ตาม contract ที่มีอยู่
- การอ่านคิวไม่นำ terminal Booking หรือ Booking ที่หมดเวลาแล้วมาขวางผู้ใช้

## Error Codes

- `BOOKING_ALREADY_ACTIVE`: ผู้ใช้มี Booking ที่ยังมีผลอยู่แล้ว
- `BOOKING_CROSSES_MIDNIGHT`: ช่วงคิวใหม่สิ้นสุดหลังเที่ยงคืนกรุงเทพฯ
- `BOOKING_MACHINE_UNAVAILABLE`: เครื่องปิดใช้งานหรือซ่อมบำรุง
- `BOOKING_NOT_STARTED`: ยังไม่ถึงเวลา Login ของ Booking
- `BOOKING_EXPIRED`: Booking หมดเวลาเข้าใช้แล้ว
- `BOOKING_ATOMIC_BUSY`: Apps Script lock ไม่พร้อม ให้ retry ด้วย idempotency key เดิม

ข้อความที่แสดงผู้ใช้ต้องบอกการดำเนินการถัดไปและไม่เปิดเผยข้อมูล credential ภายใน

## Idempotency and Concurrency

Apps Script ตรวจ `idempotencyKey` ก่อนสร้างผลข้างเคียงซ้ำ คำขอ retry เดิมคืน Booking เดิมพร้อมเวลาเดิม การจองคนละคำขอถูก serialize ด้วย Script Lock และแต่ละคำขอคำนวณปลายคิวใหม่หลังได้ lock จึงได้รับช่วงเวลาต่อกันโดยไม่ overlap

## Testing

### Unit and policy tests

- เครื่องว่างได้ช่วง `now` ถึง `now + 180 minutes`
- คิวหลายรายการเว้น 15 นาทีทุกช่วง
- terminal และหมดเวลาแล้วไม่ขวางคิวใหม่
- คิวใหม่ที่ข้ามเที่ยงคืนถูกปฏิเสธ
- ผู้ใช้ที่มี Booking ปัจจุบันหรืออนาคตจองเพิ่มไม่ได้
- การยกเลิกไม่เลื่อนเวลาคิวอื่น

### Apps Script tests

- Apps Script ไม่เชื่อถือเวลาจาก client และคำนวณเวลา authoritative เอง
- สองคำขอที่ต่อกันได้คนละ slot
- retry ด้วย idempotency key เดิมไม่สร้าง Booking, Event หรือ Audit row ซ้ำ
- การชนกับ Booking ถัดไปยังปฏิเสธ extension

### TimeLock tests

- Login ก่อนเวลาและหลังหมดเวลาถูกปฏิเสธโดยไม่สร้าง Event
- Login ในช่วงเวลาอนุญาตสำเร็จ
- Sync ไม่ส่งบัญชีอนาคตหรือหมดเวลา

### UI tests

- แสดงสถานะ `ว่าง`, `ใช้งานอยู่`, `มีคิว`, `คิวเต็มสำหรับวันนี้`
- แสดงช่วงเวลาเข้าใช้ต่อเครื่องและจำนวนคิว
- ปิดทุกเครื่องเมื่อผู้ใช้มี Booking ที่ยังมีผล
- หน้ายืนยันใช้เวลา authoritative จากผล create Booking

## Rollout

1. Deploy Apps Script version ที่รองรับการคำนวณคิว authoritative
2. Deploy BookingAiLab Backend/UI และ API contract ใหม่
3. อัปเดต WPF ให้ Sync เมื่อถึงเวลาและรองรับ `BOOKING_NOT_STARTED`/`BOOKING_EXPIRED`
4. ทดสอบแบบ end-to-end ด้วยเครื่องอย่างน้อยหนึ่งเครื่องและผู้ใช้สองบัญชี

ก่อนเปิดใช้งานจริงต้องยืนยันว่า WPF เรียก Sync อีกครั้งเมื่อถึงเวลาคิว มิฉะนั้นบัญชีอนาคตซึ่ง Backend จงใจไม่ส่งก่อนเวลาจะยัง Login แบบ Offline ไม่ได้
