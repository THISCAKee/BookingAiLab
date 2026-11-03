import type { BookingFormState } from "@/app/booking/actions";
import { defaultLocale, getDictionary, type Locale } from "@/lib/i18n/dictionaries";

export function BookingResultPanel({
  state,
  onRetry,
  actionHref = "/my-bookings",
  actionLabel,
  onCancel,
  isCancelling = false,
  cancelMessage,
  locale = defaultLocale,
}: {
  state: BookingFormState;
  onRetry?: () => void;
  actionHref?: string;
  actionLabel?: string;
  onCancel?: () => void;
  isCancelling?: boolean;
  cancelMessage?: string;
  locale?: Locale;
}) {
  const t = getDictionary(locale).result;
  if (!state.ok) {
    return (
      <section className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900 sm:p-6" role="alert">
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-500 font-bold text-white" aria-hidden="true">!</span>
          <div>
            <h2 className="font-display text-lg font-semibold">{t.failedTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-rose-800">{t.errors[state.code] ?? state.message}</p>
            {state.retryable && onRetry ? (
              <button type="button" onClick={onRetry} className="mt-4 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200">
                {t.retry}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  const booking = state.booking;
  const isActive = booking.status === "active";
  const statusLabel = isActive ? t.statusActive : booking.status === "cancelled" ? t.statusCancelled : t.statusConfirmed;
  const canCancel = onCancel && !isActive && booking.status !== "cancelled" && booking.status !== "completed" && booking.status !== "expired";
  return (
    <section className="booking-glass mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-7">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500 text-sm font-bold text-white" aria-hidden="true">✓</span>
        <div>
          <p className="font-display font-semibold text-[#171717]">{t.confirmedTitle}</p>
          <p className="text-xs text-slate-500">{t.bookedOk(booking.machineCode)}</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          {t.statusPrefix} {statusLabel}
        </span>
      </div>

      <div className="p-5 sm:p-7">
        <div className="timelock-highlight rounded-2xl bg-[#171717] p-5 text-white sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-sm font-semibold text-[#facc15]">{t.timelockTitle}</p>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">{t.timelockHint}</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/10 sm:col-span-2">
              <p className="text-xs font-medium text-slate-400">{t.displayName}</p>
              <p className="mt-1 break-words text-lg font-semibold leading-tight">{booking.name}</p>
            </div>
            <div className="rounded-xl bg-white px-4 py-4 text-[#171717]">
              <p className="text-xs font-medium text-slate-500">{t.user}</p>
              <p className="timelock-username-value mt-1 break-all text-3xl font-semibold leading-tight">{booking.timelockUsername}</p>
            </div>
            <div className="rounded-xl bg-white px-4 py-4 text-[#171717]">
              <p className="text-xs font-medium text-slate-500">{t.passwordOnce}</p>
              <p className="timelock-password-value mt-1 break-all text-3xl font-semibold leading-tight tracking-[0.04em]">{booking.timelockPassword}</p>
            </div>
          </div>
        </div>

        <div className="booking-duration-section booking-inset mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-slate-200 px-5 py-4">
          <p className="font-semibold text-[#171717]">{t.usable}</p>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{t.cycle}</span>
          <p className="w-full text-sm text-slate-600">{t.timerStarts}</p>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">
          {t.usageNote}{isActive ? t.usageNoteActive : t.usageNoteSave}
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a href={actionHref} className="inline-flex w-full justify-center rounded-xl bg-[#facc15] px-5 py-3 font-semibold text-[#171717] transition hover:bg-[#eab308] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 sm:w-auto">{actionLabel ?? t.viewBooking}</a>
          {canCancel ? <button type="button" onClick={onCancel} disabled={isCancelling} className="w-full rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60 sm:w-auto">{isCancelling ? t.cancelling : t.cancel}</button> : null}
        </div>
        {cancelMessage ? <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{cancelMessage}</p> : null}
      </div>
    </section>
  );
}
