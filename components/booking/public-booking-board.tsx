"use client";

import { useActionState, useState } from "react";
import { bookMachineAction, type BookingFormState } from "@/app/booking/actions";
import { BookingResultPanel } from "@/components/booking/booking-result-panel";
import type { PublicBookingOptions } from "@/lib/booking/actions";
import type { QueueOperationalStatus } from "@/lib/booking/queue-policy";

const initialState: BookingFormState = { ok: false, code: "", message: "", retryable: true };

function StepHeading({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-display grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-xs font-bold text-amber-700">{number}</span>
      <h2 className="font-display text-sm font-semibold tracking-wide text-[#0b1324]">{title}</h2>
    </div>
  );
}

const statusLabels: Record<QueueOperationalStatus, string> = {
  available: "ว่าง",
  in_use: "ใช้งานอยู่",
  queued: "มีคิว",
  full_today: "คิวเต็มสำหรับวันนี้",
};

export function PublicBookingBoard({
  initialOptions,
  initialMessage,
}: {
  initialOptions: PublicBookingOptions;
  initialMessage?: string;
}) {
  const [selectedMachine, setSelectedMachine] = useState("");
  const [state, formAction, isPending] = useActionState(bookMachineAction, initialState);
  const hasBookableMachine = initialOptions.machines.some((machine) => machine.bookable);
  const loadMessage = initialMessage ?? "";

  if (state.ok) {
    return <BookingResultPanel state={state} />;
  }

  const machines = initialOptions.machines;

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
              กำลังยืนยันการจอง
            </h2>
            <p role="status" className="mt-2 text-sm leading-6 text-slate-600">
              ระบบกำลังตรวจสอบเครื่องที่เลือก กรุณารอสักครู่
            </p>
          </div>
        </div>
      ) : null}
      {state.code ? (
        <BookingResultPanel state={state} onRetry={() => setSelectedMachine("")} />
      ) : null}
      <form action={formAction} className="mt-8 grid gap-5 lg:grid-cols-[330px_1fr] lg:items-start">
        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_22px_60px_-48px_rgba(11,19,36,0.55)] sm:p-6 lg:sticky lg:top-5">
          <section>
            <StepHeading number="01" title="ข้อมูลผู้จอง" />
            <p className="mt-4 text-sm leading-6 text-slate-600">ใช้บัญชี Google @msu.ac.th ที่เข้าสู่ระบบอยู่ ระบบจะบันทึกชื่อและอีเมลจากบัญชีนั้นโดยอัตโนมัติ</p>
          </section>

          <section className="mt-6 border-t border-slate-100 pt-6">
            <StepHeading number="02" title="ช่วงเวลาการใช้งาน" />
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">รอบละ 180 นาที</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-amber-950">ระบบจัดเวลาให้ต่อจากคิวล่าสุดโดยเว้น 15 นาที</p>
              <p className="mt-2 text-xs leading-5 text-amber-800">เวลาจะเริ่มนับเมื่อ login เข้า TimeLock และคิวถัดไปเปิดหลังผู้จองก่อนหน้าเริ่มใช้งาน</p>
            </div>
          </section>
        </aside>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_22px_60px_-48px_rgba(11,19,36,0.55)] sm:p-6 lg:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <StepHeading number="03" title="เลือกเครื่องคอมพิวเตอร์" />
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              <span className={`h-2 w-2 rounded-full ${initialOptions.viewerCanBook && hasBookableMachine ? "bg-[#16a34a]" : "bg-slate-300"}`} aria-hidden="true" />
              {initialOptions.viewerCanBook && hasBookableMachine ? "มีช่วงเวลาที่จองได้" : "จองเพิ่มไม่ได้"}
            </div>
          </div>

          {!initialOptions.viewerCanBook && initialOptions.viewerBlockReason === "BOOKING_ALREADY_ACTIVE" ? (
            <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
              กรุณารอให้ Session หรือการจองปัจจุบันสิ้นสุดก่อนจองใหม่
            </p>
          ) : null}

          <div className="mt-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3" aria-label="เครื่องคอมพิวเตอร์">
            {machines.map((machine, index) => {
              const selectable = initialOptions.viewerCanBook && machine.bookable;
              return (
              <label key={machine.id} className={`group relative min-h-60 overflow-hidden rounded-2xl border p-5 transition focus-within:ring-4 focus-within:ring-amber-100 ${selectable ? "cursor-pointer border-slate-200 bg-white hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg has-[:checked]:border-amber-400 has-[:checked]:bg-[#171717] has-[:checked]:text-white has-[:checked]:shadow-xl" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"}`}>
                <input type="radio" name="machineId" value={machine.id} disabled={!selectable} checked={selectedMachine === machine.id} onChange={() => setSelectedMachine(machine.id)} className="sr-only" />
                <span className={`absolute inset-x-0 top-0 h-1 ${machine.bookable ? "bg-[#16a34a]" : "bg-slate-300"}`} aria-hidden="true" />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-xs font-bold uppercase tracking-[0.15em]">{machine.machineCode}</p>
                    <p className="mt-1 text-[11px] opacity-60">{machine.machineName}</p>
                  </div>
                  <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${machine.bookable ? "bg-emerald-50 text-emerald-700 group-has-[:checked]:bg-white/10 group-has-[:checked]:text-emerald-200" : "bg-slate-200 text-slate-600"}`}>{statusLabels[machine.operationalStatus]}</span>
                </div>
                <div className="mt-5 border-t border-current/10 pt-4 text-xs leading-5">
                  {machine.bookable ? (
                    <p className="font-semibold">ใช้งานได้ 3 ชั่วโมง</p>
                  ) : <p className="font-semibold">ไม่มีช่วงเวลาว่างภายในวันนี้</p>}
                  {machine.queueCount > 0 ? <p className="mt-1 opacity-75">คิวรอ {machine.queueCount} รายการ</p> : null}
                </div>
                <p className="font-display absolute bottom-4 right-5 text-4xl font-semibold leading-none tracking-[-0.08em] opacity-15">{String(index + 1).padStart(2, "0")}</p>
              </label>
              );
            })}
          </div>

          {machines.length === 0 ? (
            <div className="mt-5 grid min-h-44 place-items-center rounded-2xl border border-dashed border-slate-200 bg-[#f8fafc] px-5 text-center">
              <div><p className="font-display font-semibold text-slate-700">ยังไม่มีข้อมูลเครื่อง</p><p className="mt-1 text-sm text-slate-500">กรุณาติดต่อผู้ดูแลระบบ</p></div>
            </div>
          ) : null}

          {loadMessage ? <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{loadMessage}</p> : null}
          <button type="submit" disabled={isPending || !initialOptions.viewerCanBook || !selectedMachine} className="mt-5 w-full rounded-xl bg-[#171717] px-6 py-4 text-base font-semibold text-white transition hover:bg-amber-400 hover:text-[#171717] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
            {isPending ? "กำลังยืนยันการจอง…" : selectedMachine ? "ยืนยันการจองเครื่องที่เลือก" : "เลือกเครื่องเพื่อดำเนินการต่อ"}
          </button>
        </section>
      </form>
    </>
  );
}
