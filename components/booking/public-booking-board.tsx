"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bookMachineAction, type BookingFormState } from "@/app/booking/actions";
import { BookingResultPanel } from "@/components/booking/booking-result-panel";
import type { PublicBookingOptions } from "@/lib/booking/actions";
import type { QueueOperationalStatus } from "@/lib/booking/queue-policy";
import { clearStoredBooking, loadStoredBooking, storeBooking } from "@/lib/booking/client-storage";
import { defaultLocale, getDictionary, type Locale } from "@/lib/i18n/dictionaries";

const initialState: BookingFormState = { ok: false, code: "", message: "", retryable: true };

const statusTones: Record<QueueOperationalStatus, { dot: string; badge: string }> = {
  available: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  in_use: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-800 ring-amber-200" },
  queued: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-800 ring-amber-200" },
  waiting_for_login: { dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600 ring-slate-200" },
  full_today: { dot: "bg-rose-400", badge: "bg-rose-50 text-rose-700 ring-rose-200" },
};

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

export function PublicBookingBoard({
  initialOptions,
  initialMessage,
  locale = defaultLocale,
}: {
  initialOptions: PublicBookingOptions;
  initialMessage?: string;
  locale?: Locale;
}) {
  const dictionary = getDictionary(locale);
  const t = dictionary.board;
  const timeOnly = new Intl.DateTimeFormat(dictionary.dateLocale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Bangkok" });
  const router = useRouter();
  const [selectedMachine, setSelectedMachine] = useState("");
  const [storedState, setStoredState] = useState<BookingFormState | null>(null);
  const [state, formAction, isPending] = useActionState(bookMachineAction, initialState);
  const hasBookableMachine = initialOptions.machines.some((machine) => machine.bookable);
  const selectedMachineBookable = initialOptions.machines.some(
    (machine) => machine.id === selectedMachine && machine.bookable,
  );
  const loadMessage = initialMessage ?? "";

  useEffect(() => {
    setStoredState(loadStoredBooking(window.localStorage));
  }, []);

  useEffect(() => {
    if (state.ok) storeBooking(window.localStorage, state);
  }, [state]);

  useEffect(() => {
    if (initialOptions.viewerBookingStarted) {
      clearStoredBooking(window.localStorage);
      setStoredState(null);
    }
    if (initialOptions.viewerCanBook && initialOptions.viewerBookingEndAt === null) {
      clearStoredBooking(window.localStorage);
      setStoredState(null);
    }
  }, [initialOptions.viewerBookingStarted, initialOptions.viewerCanBook, initialOptions.viewerBookingEndAt]);

  useEffect(() => {
    const refresh = () => router.refresh();
    const timer = window.setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  useEffect(() => {
    if (selectedMachine && !selectedMachineBookable) setSelectedMachine("");
  }, [selectedMachine, selectedMachineBookable]);

  const visibleState = initialOptions.viewerBookingStarted
    ? initialState
    : state.ok ? state : storedState ?? state;

  const machines = initialOptions.machines;
  const bookableCount = machines.filter((machine) => machine.bookable).length;
  const selectedMachineCode = selectedMachineBookable
    ? machines.find((machine) => machine.id === selectedMachine)?.machineCode
    : undefined;

  return (
    <>
      {isPending ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#171717]/45 px-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-loading-title"
        >
          <div className="w-full max-w-sm rounded-3xl border border-amber-200 bg-white p-7 text-center shadow-[0_24px_70px_-30px_rgba(23,23,23,0.65)]">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100" aria-hidden="true">
              <span className="booking-loading-spinner" />
            </div>
            <h2 id="booking-loading-title" className="font-display mt-5 text-xl font-semibold text-[#171717]">
              {t.loadingTitle}
            </h2>
            <p role="status" className="mt-2 text-sm leading-6 text-slate-600">
              {t.loadingBody}
            </p>
          </div>
        </div>
      ) : null}
      {visibleState.code ? (
        <BookingResultPanel state={visibleState} onRetry={() => setSelectedMachine("")} locale={locale} />
      ) : null}
      <ol className="mt-8 grid gap-3 sm:grid-cols-3" aria-label={t.stepsLabel}>
        {t.steps.map((step, index) => (
          <li key={step.title} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <span className="font-display grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#171717] text-sm font-bold text-[#facc15]">{index + 1}</span>
            <div>
              <p className="text-sm font-semibold text-[#171717]">{step.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-slate-600">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <form action={formAction} className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">{t.chooseMachine}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {machines.length > 0 ? t.summary(bookableCount, machines.length) : t.noMachines}
              <span className="text-slate-400"> · {t.autoRefresh}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
            <span className={`h-2 w-2 rounded-full ${initialOptions.viewerCanBook && hasBookableMachine ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden="true" />
            {initialOptions.viewerCanBook && hasBookableMachine ? t.canBook : t.cannotBook}
          </div>
        </div>

        {!initialOptions.viewerCanBook && initialOptions.viewerBlockReason === "BOOKING_ALREADY_ACTIVE" ? (
          <p role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-400 text-xs font-bold text-[#171717]" aria-hidden="true">!</span>
            {t.alreadyActive}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={t.machinesLabel}>
          {machines.map((machine) => {
            const selectable = initialOptions.viewerCanBook && machine.bookable;
            const tone = statusTones[machine.operationalStatus];
            return (
              <label
                key={machine.id}
                className={`group relative flex flex-col rounded-2xl border-2 p-5 transition focus-within:ring-4 focus-within:ring-amber-200 ${selectable ? "cursor-pointer border-slate-200 bg-white hover:border-slate-300 hover:shadow-[0_12px_32px_-20px_rgba(15,23,42,0.45)] has-[:checked]:border-[#171717] has-[:checked]:bg-[#fffbea] has-[:checked]:shadow-[0_16px_40px_-24px_rgba(15,23,42,0.55)]" : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-500"}`}
              >
                <input type="radio" name="machineId" value={machine.id} disabled={!selectable} checked={selectedMachine === machine.id} onChange={() => setSelectedMachine(machine.id)} className="sr-only" />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`grid h-11 w-11 place-items-center rounded-xl ${selectable ? "bg-slate-100 text-[#171717] group-has-[:checked]:bg-[#171717] group-has-[:checked]:text-[#facc15]" : "bg-slate-200/70 text-slate-400"}`}>
                      <MonitorIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-display text-lg font-semibold leading-tight">{machine.machineCode}</p>
                      <p className="text-xs text-slate-500">{machine.machineName}</p>
                    </div>
                  </div>
                  {selectable ? (
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-slate-300 text-transparent transition group-has-[:checked]:border-[#171717] group-has-[:checked]:bg-[#171717] group-has-[:checked]:text-[#facc15]">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </div>

                <span className={`mt-4 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tone.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
                  {t.statusLabels[machine.operationalStatus]}
                </span>

                <div className="mt-4 flex flex-1 flex-col gap-2 text-sm leading-6">
                  {machine.operationalStatus === "waiting_for_login" ? (
                    <p className="text-slate-600">{t.waitingForLogin}</p>
                  ) : machine.bookable ? (
                    <p className="font-semibold text-[#171717]">{t.usable}</p>
                  ) : (
                    <p className="text-slate-600">{t.noSlotToday}</p>
                  )}
                  {machine.currentEndAt !== null && machine.currentRemainingMinutes !== null ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-700">
                      <span className="font-semibold">{t.remaining(Math.floor(machine.currentRemainingMinutes / 60), machine.currentRemainingMinutes % 60)}</span>
                      <span>{t.endsAt(timeOnly.format(new Date(machine.currentEndAt)))}</span>
                    </div>
                  ) : null}
                  {machine.queueCount > 0 ? <p className="text-xs text-slate-500">{t.queue(machine.queueCount)}</p> : null}
                </div>
              </label>
            );
          })}
        </div>

        {machines.length === 0 ? (
          <div className="mt-5 grid min-h-44 place-items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 text-center">
            <div><p className="font-display font-semibold text-slate-700">{t.noMachines}</p><p className="mt-1 text-sm text-slate-500">{t.contactAdmin}</p></div>
          </div>
        ) : null}

        {loadMessage ? <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{loadMessage}</p> : null}

        <div className="sticky bottom-4 z-20 mt-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.5)] backdrop-blur sm:flex-row sm:items-center sm:pl-5">
            <p className="text-sm text-slate-600 sm:flex-1">
              {selectedMachineCode ? (
                <>{t.selected} <span className="font-display font-semibold text-[#171717]">{selectedMachineCode}</span> · {t.usable}</>
              ) : t.notSelected}
            </p>
            <button type="submit" disabled={isPending || !initialOptions.viewerCanBook || !selectedMachineBookable} className="w-full rounded-xl bg-[#facc15] px-6 py-3.5 text-base font-semibold text-[#171717] transition hover:bg-[#eab308] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 sm:w-auto">
              {isPending ? t.confirming : selectedMachineBookable ? t.confirm : t.selectToContinue}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
