import type { BookingFormState } from "@/app/booking/actions";

export const STORED_BOOKING_KEY = "booking-ai-lab:last-booking";

type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isStoredBooking(value: unknown): value is Extract<BookingFormState, { ok: true }> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { ok?: unknown; booking?: { bookingNumber?: unknown } };
  const booking = candidate.booking as Record<string, unknown> | undefined;
  return candidate.ok === true
    && typeof candidate.booking?.bookingNumber === "string"
    && !Object.prototype.hasOwnProperty.call(booking ?? {}, "manageCode");
}

export function storeBooking(storage: BrowserStorage, state: Extract<BookingFormState, { ok: true }>) {
  storage.setItem(STORED_BOOKING_KEY, JSON.stringify(state));
}

export function loadStoredBooking(storage: BrowserStorage): Extract<BookingFormState, { ok: true }> | null {
  try {
    const raw = storage.getItem(STORED_BOOKING_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredBooking(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearStoredBooking(storage: BrowserStorage) {
  storage.removeItem(STORED_BOOKING_KEY);
}
