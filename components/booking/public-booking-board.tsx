"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  bookMachineAction,
  loadBookingOptionsAction,
  type BookingFormState,
} from "@/app/booking/actions";
import type { PublicBookingOptions } from "@/lib/booking/actions";

const initialState: BookingFormState = { ok: false };

function StepHeading({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-display grid h-8 w-8 place-items-center rounded-lg bg-[#e8f0ff] text-xs font-bold text-[#2563eb]">
        {number}
      </span>
      <h2 className="font-display text-sm font-semibold tracking-wide text-[#0b1324]">{title}</h2>
    </div>
  );
}

export function PublicBookingBoard({
  dates,
  initialOptions,
  initialMessage,
}: {
  dates: { value: string; label: string; kind: string }[];
  initialOptions: PublicBookingOptions;
  initialMessage?: string;
}) {
  const [options, setOptions] = useState(initialOptions);
  const [selectedSlot, setSelectedSlot] = useState(initialOptions.slots[0]?.startAt ?? "");
  const [selectedMachine, setSelectedMachine] = useState("");
  const [loadMessage, setLoadMessage] = useState(initialMessage ?? "");
  const [isLoadingSlots, startLoadingSlots] = useTransition();
  const [state, formAction, isPending] = useActionState(bookMachineAction, initialState);

  const slot = useMemo(
    () => options.slots.find((item) => item.startAt === selectedSlot),
    [options.slots, selectedSlot],
  );

  function changeDate(date: string) {
    setSelectedMachine("");
    setLoadMessage("");
    startLoadingSlots(async () => {
      const result = await loadBookingOptionsAction(date);
      if (!result.ok || !result.data) {
        setOptions({ date, slots: [] });
        setSelectedSlot("");
        setLoadMessage(result.message ?? "โหลดรอบเวลาไม่สำเร็จ");
        return;
      }
      setOptions(result.data);
      setSelectedSlot(result.data.slots[0]?.startAt ?? "");
    });
  }

  if (state.ok) {
    const booking = state.booking;
    return (
      <section className="mt-8 overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-[0_24px_70px_-45px_rgba(11,19,36,0.45)]">
        <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-6 py-4 text-sm font-semibold text-emerald-800">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-white" aria-hidden="true">✓</span>
          ยืนยันการจองแล้ว
        </div>
        <div className="p-6 sm:p-9">
          <p className="text-sm font-semibold text-emerald-700">{booking.machineCode} พร้อมสำหรับรอบที่เลือก</p>
          <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight">บันทึกข้อมูลนี้ไว้ก่อนปิดหน้า</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">เลขที่การจอง</p>
              <p className="font-display mt-3 break-all text-xl font-semibold">{booking.bookingNumber}</p>
            </div>
            <div className="rounded-2xl bg-[#0b1324] p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">รหัสจัดการ · แสดงครั้งเดียว</p>
              <p className="font-display mt-3 break-all text-2xl font-bold tracking-[0.12em]">{booking.manageCode}</p>
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600">ใช้ข้อมูลทั้งสองรายการเพื่อตรวจสอบหรือยกเลิกการจอง ระบบไม่สามารถแสดงรหัสจัดการนี้ซ้ำได้</p>
          <a href="/my-bookings" className="mt-6 inline-flex rounded-xl bg-[#2563eb] px-5 py-3 font-semibold text-white transition hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">จัดการการจองนี้</a>
        </div>
      </section>
    );
  }

  const machines = slot?.machines ?? [];

  return (
    <form action={formAction} className="mt-8 grid gap-5 lg:grid-cols-[330px_1fr] lg:items-start">
      <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_22px_60px_-48px_rgba(11,19,36,0.55)] sm:p-6 lg:sticky lg:top-5">
        <section>
          <StepHeading number="01" title="ข้อมูลผู้จอง" />
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            รหัสนิสิตหรืออีเมลมหาวิทยาลัย
            <input
              name="identity"
              required
              autoComplete="email"
              placeholder="67012345 หรือ name@msu.ac.th"
              className="mt-2 block w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5 text-base text-[#0b1324] outline-none transition placeholder:text-slate-400 focus:border-[#2563eb] focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-slate-500">ใช้บัญชี Google @msu.ac.th ที่มีอยู่ในระบบ</p>
        </section>

        <section className="mt-6 border-t border-slate-100 pt-6">
          <StepHeading number="02" title="เลือกวันที่" />
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {dates.map((date) => (
              <label key={date.value} className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 transition hover:border-blue-300 has-[:checked]:border-[#2563eb] has-[:checked]:bg-[#eff6ff] has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-blue-100">
                <input type="radio" name="bookingDate" value={date.value} defaultChecked={date.value === options.date} onChange={() => changeDate(date.value)} className="sr-only" />
                <span className="block text-sm font-semibold text-[#0b1324]">{date.label}</span>
                <span className="font-display mt-1 block text-[11px] text-slate-500">{date.value}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="mt-6 border-t border-slate-100 pt-6">
          <StepHeading number="03" title="เลือกรอบเวลา" />
          <div className="mt-4 space-y-2.5">
            {options.slots.map((item) => (
              <label key={item.startAt} className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3.5 transition hover:border-blue-300 has-[:checked]:border-[#2563eb] has-[:checked]:bg-[#eff6ff] has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-blue-100">
                <span className="font-display font-semibold">{item.label}</span>
                <input type="radio" name="slotPicker" value={item.startAt} checked={selectedSlot === item.startAt} onChange={() => { setSelectedSlot(item.startAt); setSelectedMachine(""); }} className="h-4 w-4 accent-[#2563eb]" />
              </label>
            ))}
            {isLoadingSlots ? <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">กำลังโหลดรอบเวลา…</p> : null}
            {!isLoadingSlots && options.slots.length === 0 ? <p className="rounded-xl bg-slate-100 p-3.5 text-sm leading-6 text-slate-600">วันที่เลือกไม่มีรอบที่เปิดจอง ลองเลือกวันถัดไป</p> : null}
          </div>
        </section>
      </aside>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_22px_60px_-48px_rgba(11,19,36,0.55)] sm:p-6 lg:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <StepHeading number="04" title="เลือกเครื่องคอมพิวเตอร์" />
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
            <span className={`h-2 w-2 rounded-full ${slot ? "bg-[#16a34a]" : "bg-slate-300"}`} aria-hidden="true" />
            {slot ? `รอบ ${slot.label}` : "เลือกรอบเวลาก่อน"}
          </div>
        </div>

        <div className="mt-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3" aria-label="เครื่องคอมพิวเตอร์ 6 เครื่อง">
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
            <div><p className="font-display font-semibold text-slate-700">เลือกวันและรอบเวลาก่อน</p><p className="mt-1 text-sm text-slate-500">สถานะเครื่องทั้ง 6 จะแสดงที่นี่</p></div>
          </div>
        ) : null}

        <input type="hidden" name="startAt" value={selectedSlot} />
        {(state.message || loadMessage) ? <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{state.message || loadMessage}</p> : null}
        <button type="submit" disabled={isPending || !selectedSlot || !selectedMachine} className="mt-5 w-full rounded-xl bg-[#2563eb] px-6 py-4 text-base font-semibold text-white transition hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
          {isPending ? "กำลังยืนยันการจอง…" : selectedMachine ? "ยืนยันการจองเครื่องที่เลือก" : "เลือกเครื่องเพื่อดำเนินการต่อ"}
        </button>
      </section>
    </form>
  );
}
