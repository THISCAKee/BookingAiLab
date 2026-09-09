"use client";

import { useEffect, useState, useTransition } from "react";
import { cancelMyBookingAction, loadMyBookingsAction, lookupBookingAction, type LookupState } from "@/app/my-bookings/actions";
import type { BookingFormState } from "@/app/booking/actions";
import { BookingResultPanel } from "@/components/booking/booking-result-panel";
import { clearStoredBooking, loadStoredBooking, storeBooking } from "@/lib/booking/client-storage";

const initialState: LookupState = { ok: false };
export function ManageBookingForm() {
  const [storedBooking, setStoredBooking] = useState<BookingFormState | null>(null);
  const [cancelMessage, setCancelMessage] = useState("");
  const [isCancelling, startCancelling] = useTransition();
  const cancelBookingId = storedBooking?.ok ? storedBooking.booking.bookingId : undefined;

  useEffect(() => {
    const stored = loadStoredBooking(window.localStorage);
    void loadMyBookingsAction().then((result) => {
      if (!result.ok || result.data.length === 0) {
        if (stored) setStoredBooking(stored);
        return;
      }
      const latest = result.data[0];
      const matchingStored = stored?.booking.bookingId === latest.bookingId ? stored.booking : null;
      const next: BookingFormState = {
        ok: true,
        code: "BOOKING_CONFIRMED",
        message: "ข้อมูลการจองของคุณ",
        booking: {
          bookingId: latest.bookingId,
          bookingNumber: latest.bookingNumber,
          manageCode: matchingStored?.manageCode ?? "",
          timelockUsername: latest.timelockUsername,
          timelockPassword: latest.timelockPassword ?? matchingStored?.timelockPassword ?? "ไม่สามารถแสดงซ้ำได้",
          machineCode: latest.machineCode,
          startAt: latest.startAt,
          endAt: latest.endAt,
          status: latest.status,
        },
      };
      setStoredBooking(next);
      if (matchingStored) storeBooking(window.localStorage, next);
    }).catch(() => {
      if (stored) setStoredBooking(stored);
    });

    if (!stored) return;

    const credentials = new FormData();
    credentials.set("bookingNumber", stored.booking.bookingNumber);
    credentials.set("manageCode", stored.booking.manageCode);
    void lookupBookingAction(initialState, credentials).then((result) => {
      if (result.ok && result.booking.status === "active") {
        const activeBooking: BookingFormState = {
          ...stored,
          booking: { ...stored.booking, status: "active", bookingNumber: "", manageCode: "" },
        };
        storeBooking(window.localStorage, activeBooking);
        setStoredBooking(activeBooking);
        return;
      }
      setStoredBooking(stored);
    }).catch(() => setStoredBooking(stored));
  }, []);

  useEffect(() => {
    const refreshBooking = async () => {
      const result = await loadMyBookingsAction();
      if (result.ok && result.data.length === 0) {
        clearStoredBooking(window.localStorage);
        setStoredBooking(null);
      }
    };
    const timer = window.setInterval(() => void refreshBooking(), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="mt-10">
      {storedBooking ? <BookingResultPanel
        state={storedBooking}
        actionHref="/booking"
        actionLabel="กลับไปจองเครื่อง"
        onCancel={() => startCancelling(async () => {
          if (!cancelBookingId) return;
          setCancelMessage("");
          const result = await cancelMyBookingAction(cancelBookingId);
          if (result.ok) {
            clearStoredBooking(window.localStorage);
            setStoredBooking(null);
          } else {
            setCancelMessage(result.message);
          }
        })}
        isCancelling={isCancelling}
        cancelMessage={cancelMessage}
      /> : <section className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-600">ยังไม่มีข้อมูลการจองของคุณ</section>}
    </div>
  );
}
