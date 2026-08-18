"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  bookMachineAction,
  loadBookingOptionsAction,
  type BookingFormState,
} from "@/app/booking/actions";
import type { PublicBookingOptions } from "@/lib/booking/actions";

const initialState: BookingFormState = { ok: false };

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
      <section className="mt-10 overflow-hidden rounded-[2rem] border border-emerald-200 bg-white shadow-[0_30px_80px_-45px_rgba(15,23,42,0.5)]">
        <div className="bg-emerald-500 px-6 py-4 text-sm font-bold tracking-wide text-emerald-950">BOOKING CONFIRMED</div>
        <div className="p-6 sm:p-10">
          <p className="text-sm font-semibold text-emerald-700">จอง {booking.machineCode} สำเร็จ</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">เก็บข้อมูลสองรายการนี้ไว้</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-950 p-5 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">เลขที่การจอง</p>
              <p className="mt-3 break-all text-xl font-semibold">{booking.bookingNumber}</p>
            </div>
            <div className="rounded-2xl bg-amber-400 p-5 text-slate-950">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-900/70">รหัสจัดการ — แสดงครั้งเดียว</p>
              <p className="mt-3 break-all font-mono text-2xl font-bold tracking-[0.12em]">{booking.manageCode}</p>
            </div>
          </div>
          <p className="mt-5 text-sm leading-7 text-slate-600">ใช้เลขที่การจองและรหัสจัดการเพื่อตรวจสอบหรือยกเลิกที่หน้า “จัดการการจอง” ระบบไม่สามารถแสดงรหัสนี้ซ้ำได้</p>
          <a href="/my-bookings" className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-amber-500 hover:text-slate-950">ไปหน้าจัดการการจอง</a>
        </div>
      </section>
    );
  }

  const machines = slot?.machines ?? [];

  return (
    <form action={formAction} className="mt-10 grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.6)] lg:sticky lg:top-6 lg:self-start">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">01 / ผู้จอง</p>
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          รหัสนิสิต หรืออีเมลมหาวิทยาลัย
          <input name="identity" required placeholder="65012345 หรือ name@msu.ac.th" className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100" />
        </label>
        <p className="mt-2 text-xs leading-5 text-slate-500">ต้องเป็นบัญชี Google @msu.ac.th ที่เคยมีอยู่ในระบบ</p>

        <div className="mt-7 border-t border-slate-100 pt-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">02 / วันที่</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {dates.map((date) => (
              <label key={date.value} className="cursor-pointer rounded-xl border border-slate-200 p-3 has-[:checked]:border-slate-950 has-[:checked]:bg-slate-950 has-[:checked]:text-white">
                <input type="radio" name="bookingDate" value={date.value} defaultChecked={date.value === options.date} onChange={() => changeDate(date.value)} className="sr-only" />
                <span className="block text-sm font-semibold">{date.label}</span>
                <span className="mt-1 block text-[11px] opacity-60">{date.value}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-7 border-t border-slate-100 pt-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">03 / รอบเวลา</p>
          <div className="mt-3 space-y-2">
            {options.slots.map((item) => (
              <label key={item.startAt} className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3 has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50">
                <span className="font-semibold">{item.label}</span>
                <input type="radio" name="slotPicker" value={item.startAt} checked={selectedSlot === item.startAt} onChange={() => { setSelectedSlot(item.startAt); setSelectedMachine(""); }} className="h-4 w-4 accent-amber-500" />
              </label>
            ))}
            {isLoadingSlots ? <p className="text-sm text-slate-500">กำลังโหลดรอบเวลา…</p> : null}
            {!isLoadingSlots && options.slots.length === 0 ? <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">วันนี้ไม่มีรอบที่เปิดจองแล้ว</p> : null}
          </div>
        </div>
      </aside>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">04 / เลือกเครื่อง</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">เครื่องทั้งหมด 6 เครื่อง</h2>
          </div>
          <p className="text-sm text-slate-500">{slot ? `รอบ ${slot.label}` : "เลือกรอบเวลาก่อน"}</p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {machines.map((machine, index) => (
            <label key={machine.id} className={`relative min-h-52 overflow-hidden rounded-[1.5rem] border p-5 transition ${machine.available ? "cursor-pointer border-slate-200 bg-white hover:-translate-y-1 hover:border-amber-400 hover:shadow-xl has-[:checked]:border-slate-950 has-[:checked]:ring-4 has-[:checked]:ring-amber-300" : "cursor-not-allowed border-slate-200 bg-slate-200/70 text-slate-400"}`}>
              <input type="radio" name="machineId" value={machine.id} disabled={!machine.available} checked={selectedMachine === machine.id} onChange={() => setSelectedMachine(machine.id)} className="sr-only" />
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.18em]">{machine.machineCode}</span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${machine.available ? "bg-emerald-100 text-emerald-700" : "bg-slate-300 text-slate-600"}`}>{machine.available ? "ว่าง" : "ถูกจอง"}</span>
              </div>
              <p className="mt-5 text-7xl font-semibold leading-none tracking-[-0.08em]">{String(index + 1).padStart(2, "0")}</p>
              <div className={`absolute inset-x-0 bottom-0 h-2 ${machine.available ? "bg-emerald-500" : "bg-slate-400"}`} />
            </label>
          ))}
        </div>

        <input type="hidden" name="startAt" value={selectedSlot} />
        {(state.message || loadMessage) ? <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{state.message || loadMessage}</p> : null}
        <button type="submit" disabled={isPending || !selectedSlot || !selectedMachine} className="mt-6 w-full rounded-2xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white transition hover:bg-amber-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
          {isPending ? "กำลังยืนยันการจอง…" : selectedMachine ? "ยืนยันการจองเครื่องที่เลือก" : "เลือกเครื่องเพื่อดำเนินการต่อ"}
        </button>
      </section>
    </form>
  );
}
