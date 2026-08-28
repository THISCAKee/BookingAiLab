type ActionUser = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

const bookingErrorMessages: Record<string, string> = {
  BOOKING_INPUT_INVALID: "เลือกเครื่องให้ครบ",
  MACHINE_NOT_FOUND: "ไม่พบเครื่องที่เลือก",
  AUTH_REQUIRED: "กรุณาเข้าสู่ระบบก่อนจองเครื่อง",
  CUSTOMER_PROFILE_REQUIRED: "ไม่พบข้อมูลผู้จอง กรุณาลองเข้าสู่ระบบใหม่",
  CUSTOMER_AUTH_NOT_ALLOWED: "บัญชีนี้ไม่ได้เข้าสู่ระบบด้วย Google ที่ยืนยันแล้ว",
  CUSTOMER_EMAIL_NOT_ALLOWED: "อนุญาตเฉพาะอีเมลมหาวิทยาลัยที่ลงท้ายด้วย @msu.ac.th",
  SERVICE_CLOSED: "ขณะนี้ปิดให้บริการจองเครื่อง",
  SERVICE_NOT_OPEN: "ยังไม่ถึงเวลาเปิดให้บริการ",
  INSUFFICIENT_SERVICE_TIME: "เหลือเวลาให้บริการไม่พอสำหรับการจอง 3 ชั่วโมง",
  MACHINE_UNAVAILABLE: "เครื่องนี้ไม่ว่างแล้ว กรุณาเลือกเครื่องอื่น",
  BOOKING_MACHINE_UNAVAILABLE: "เครื่องนี้ไม่ว่างแล้ว กรุณาเลือกเครื่องอื่น",
  BOOKING_MACHINE_OVERLAP: "เครื่องนี้ถูกจองในช่วงเวลาดังกล่าวแล้ว กรุณาเลือกเครื่องอื่น",
  BOOKING_CUSTOMER_OVERLAP: "คุณมีรายการจองทับช่วงเวลานี้อยู่แล้ว",
  BOOKING_OUTSIDE_SCHEDULE: "ช่วงเวลานี้อยู่นอกเวลาที่เปิดให้บริการ",
  BOOKING_CROSSES_MIDNIGHT: "เหลือเวลาไม่ถึง 3 ชั่วโมงก่อนเที่ยงคืน ไม่สามารถจองได้",
  BOOKING_ATOMIC_NOT_CONFIGURED: "ระบบจองยังตั้งค่าไม่ครบ กรุณาติดต่อผู้ดูแลระบบ",
  BOOKING_ATOMIC_FAILED: "ระบบบันทึกการจองขัดข้อง กรุณาลองใหม่อีกครั้ง",
  BOOKING_ATOMIC_TIMEOUT: "ระบบใช้เวลาตอบกลับนานเกินกำหนด กรุณาลองใหม่อีกครั้ง",
  BOOKING_ATOMIC_BUSY: "กำลังมีผู้จองพร้อมกัน กรุณาลองยืนยันอีกครั้ง",
  BOOKING_ALREADY_ACTIVE: "คุณยังมีการจองที่ไม่สิ้นสุดอยู่ ไม่สามารถจองซ้ำได้",
  BOOKING_PREVIOUS_NOT_STARTED: "คิวก่อนหน้ายังไม่ได้ login เข้า TimeLock กรุณารอสักครู่แล้วลองใหม่",
  BOOKING_CONFLICT: "มีผู้จองเครื่องนี้พร้อมกัน กรุณาเลือกเครื่องอื่น",
  BOOKING_REQUEST_NOT_ALLOWED: "ตรวจสอบรหัสนิสิตหรืออีเมล วัน เวลา และเครื่องที่เลือกอีกครั้ง",
  BOOKING_DATE_NOT_ALLOWED: "เลือกจองได้เฉพาะวันนี้",
  BOOKING_DURATION_INVALID: "รอบการจองต้องมีระยะเวลา 3 ชั่วโมง",
  BOOKING_ACCESS_DENIED: "ไม่พบรายการจองหรือรหัสจัดการไม่ถูกต้อง",
  BOOKING_NOT_FOUND: "ไม่พบรายการจองนี้",
  BOOKING_CANCELLATION_NOT_ALLOWED: "รายการนี้ไม่สามารถยกเลิกได้แล้ว",
  ADMIN_REQUIRED: "บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ",
};

export function normalizeDisplayName(user: ActionUser) {
  const metadata = user.user_metadata ?? {};
  const metadataName = [metadata.full_name, metadata.name].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  if (metadataName) {
    return metadataName.trim();
  }

  const emailLocalPart = user.email?.split("@", 1)[0]?.trim();
  return emailLocalPart || "ผู้ใช้มหาวิทยาลัย";
}

export function validateMachineId(input: unknown) {
  if (typeof input !== "string" || input.trim().length === 0) {
    return null;
  }

  return input.trim();
}

export function normalizeManagementCredentials(
  bookingNumberInput: unknown,
  manageCodeInput: unknown,
) {
  const bookingNumber =
    typeof bookingNumberInput === "string" ? bookingNumberInput.trim().toUpperCase() : "";
  const manageCode =
    typeof manageCodeInput === "string" ? manageCodeInput.trim().toUpperCase() : "";

  if (!bookingNumber || !manageCode) return null;
  return { bookingNumber, manageCode };
}

export function getBookingErrorMessage(error: unknown) {
  const rawMessage =
    typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : "";
  const errorCode = rawMessage.split(/[\s:]/, 1)[0];

  return (
    bookingErrorMessages[errorCode] ??
    "ไม่สามารถทำรายการจองได้ กรุณาลองใหม่อีกครั้ง"
  );
}

export type BookingFailure = {
  ok: false;
  code: string;
  message: string;
  retryable: boolean;
};

const nonRetryableBookingErrors = new Set([
  "AUTH_REQUIRED",
  "CUSTOMER_PROFILE_REQUIRED",
  "BOOKING_ATOMIC_NOT_CONFIGURED",
  "SERVICE_CLOSED",
  "SERVICE_NOT_OPEN",
  "INSUFFICIENT_SERVICE_TIME",
  "BOOKING_CROSSES_MIDNIGHT",
  "BOOKING_ALREADY_ACTIVE",
  "BOOKING_DATE_NOT_ALLOWED",
]);

export function toBookingFailure(error: unknown): BookingFailure {
  const rawMessage =
    typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : "BOOKING_FAILED";
  const code = rawMessage.split(/\s|:/, 1)[0] || "BOOKING_FAILED";
  return {
    ok: false,
    code,
    message: getBookingErrorMessage(error),
    retryable: !nonRetryableBookingErrors.has(code),
  };
}
