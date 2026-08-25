"use client";

import { useActionState, useState } from "react";
import { bookMachineAction, type BookingFormState } from "@/app/booking/actions";
import { BookingResultPanel } from "@/components/booking/booking-result-panel";
import type { PublicBookingOptions } from "@/lib/booking/actions";

const initialState: BookingFormState = { ok: false, code: "", message: "", retryable: true };

function StepHeading({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-display grid h-8 w-8 place-items-center rounded-lg bg-[#e8f0ff] text-xs font-bold text-[#2563eb]">{number}</span>
      <h2 className="font-display text-sm font-semibold tracking-wide text-[#0b1324]">{title}</h2>
    </div>
  );
}

const dateTime = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

export function PublicBookingBoard({
  initialOptions,
  initialMessage,
}: {
  initialOptions: PublicBookingOptions;
  initialMessage?: string;
}) {
  const [selectedMachine, setSelectedMachine] = useState("");
  const [state, formAction, isPending] = useActionState(bookMachineAction, initialState);
  const hasWindow = Boolean(initialOptions.startAt && initialOptions.endAt);
  const loadMessage = initialMessage ?? (!hasWindow ? "วันนี้เหลือเวลาไม่ถึง 3 ชั่วโมงก่อนเที่ยงคืน ไม่สามารถจองได้" : "");

  if (state.ok) {
    return <BookingResultPanel state={state} />;
  }

  const machines = initialOptions.machines;
  const windowLabel = hasWindow
    ? `${dateTime.format(new Date(initialOptions.startAt!))} – ${dateTime.format(new Date(initialOptions.endAt!))}`
    : "ไม่พร้อมสำหรับการจองวันนี้";

  return (
    <>
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
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">เริ่มทันที · 3 ชั่วโมง</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-blue-950">{windowLabel}</p>
              <p className="mt-2 text-xs leading-5 text-blue-800">ระบบใช้เวลาปัจจุบันของเซิร์ฟเวอร์และไม่รับเวลาจากเครื่องผู้ใช้</p>
            </div>
          </section>
        </aside>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_22px_60px_-48px_rgba(11,19,36,0.55)] sm:p-6 lg:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <StepHeading number="03" title="เลือกเครื่องคอมพิวเตอร์" />
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              <span className={`h-2 w-2 rounded-full ${hasWindow ? "bg-[#16a34a]" : "bg-slate-300"}`} aria-hidden="true" />
              {hasWindow ? "พร้อมจองทันที" : "จองวันนี้ไม่ได้"}
            </div>
          </div>

          <div className="mt-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3" aria-label="เครื่องคอมพิวเตอร์">
            {machines.map((machine, index) => (
              <label
                key={machine.id}
                className={`group relative min-h-44 overflow-hidden rounded-2xl border p-5 transition focus-within:ring-4 focus-within:ring-blue-100 ${machine.available ? "cursor-pointer border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg has-[:checked]:border-[#2563eb] has-[:checked]:bg-[#0b1324] has-[:checked]:text-white has-[:checked]:shadow-xl" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"}`}
              >
                <input type="radio" name="machineId" value={machine.id} disabled={!machine.available} checked={selectedMachine === machine.id} onChange={() => setSelectedMachine(machine.id)} className="sr-only" />
                <span className={`absolute inset-x-0 top-0 h-1 ${machine.available ? "bg-[#16a34a]" : "bg-slate-300"}`} aria-hidden="true" />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-xs font-bold uppercase tracking-[0.15em]">{machine.machineCode}</p>
                    <p className="mt-1 text-[11px] opacity-55">AI LAB WORKSTATION</p>
                  </div>
                  <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${machine.available ? "bg-emerald-50 text-emerald-700 group-has-[:checked]:bg-white/10 group-has-[:checked]:text-emerald-200" : "bg-slate-200 text-slate-500"}`}>{machine.available ? "ว่าง" : "ถูกจอง"}</span>
                </div>
                <div className="mt-6 flex items-end justify-between">
                  <p className="font-display text-6xl font-semibold leading-none tracking-[-0.08em]">{String(index + 1).padStart(2, "0")}</p>
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-current/15 text-sm opacity-60" aria-hidden="true">↗</span>
                </div>
              </label>
            ))}
          </div>

          {machines.length === 0 ? (
            <div className="mt-5 grid min-h-44 place-items-center rounded-2xl border border-dashed border-slate-200 bg-[#f8fafc] px-5 text-center">
              <div><p className="font-display font-semibold text-slate-700">ยังไม่มีข้อมูลเครื่อง</p><p className="mt-1 text-sm text-slate-500">กรุณาติดต่อผู้ดูแลระบบ</p></div>
            </div>
          ) : null}

          {loadMessage ? <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{loadMessage}</p> : null}
          <button type="submit" disabled={isPending || !hasWindow || !selectedMachine} className="mt-5 w-full rounded-xl bg-[#2563eb] px-6 py-4 text-base font-semibold text-white transition hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
            {isPending ? "กำลังยืนยันการจอง…" : selectedMachine ? "ยืนยันการจองเครื่องที่เลือก" : "เลือกเครื่องเพื่อดำเนินการต่อ"}
          </button>
        </section>
      </form>
    </>
  );
}
