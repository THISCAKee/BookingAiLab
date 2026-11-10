"use client";

import { appPath } from "@/lib/app-path";

import { useEffect, useState, useTransition } from "react";
import { cancelMyBookingAction, loadMyBookingsAction } from "@/app/my-bookings/actions";
import type { BookingFormState } from "@/app/booking/actions";
import { BookingResultPanel } from "@/components/booking/booking-result-panel";
import { clearStoredBooking, loadStoredBooking, storeBooking } from "@/lib/booking/client-storage";
import { defaultLocale, getDictionary, type Locale } from "@/lib/i18n/dictionaries";

export function ManageBookingForm({ locale = defaultLocale }: { locale?: Locale }) {
  const t = getDictionary(locale).myBookings;
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
        message: t.title,
        booking: {
          bookingId: latest.bookingId,
          bookingNumber: latest.bookingNumber,
          name: latest.name,
          timelockUsername: latest.timelockUsername,
          timelockPassword: latest.timelockPassword ?? matchingStored?.timelockPassword ?? t.passwordUnavailable,
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
  }, [t.passwordUnavailable, t.title]);

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
    <div className="mt-8">
      {storedBooking ? <BookingResultPanel
        state={storedBooking}
        actionHref="/booking"
        actionLabel={t.backToBooking}
        locale={locale}
        onCancel={() => startCancelling(async () => {
          if (!cancelBookingId) return;
          setCancelMessage("");
          const result = await cancelMyBookingAction(cancelBookingId);
          if (result.ok) {
            clearStoredBooking(window.localStorage);
            setStoredBooking(null);
          } else {
            setCancelMessage(locale === "en" ? getDictionary(locale).result.errors[result.code] ?? "Unable to cancel your booking. Please try again." : result.message);
          }
        })}
        isCancelling={isCancelling}
        cancelMessage={cancelMessage}
      /> : <section className="booking-glass grid place-items-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold text-[#171717]">{t.emptyTitle}</p>
        <p className="mt-1 text-sm text-slate-500">{t.emptyBody}</p>
        <a href={appPath("/booking")} className="mt-5 rounded-xl bg-[#facc15] px-5 py-3 text-sm font-semibold text-[#171717] transition hover:bg-[#eab308] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200">{t.goToBooking}</a>
      </section>}
    </div>
  );
}
