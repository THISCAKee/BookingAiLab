"use client";

import { useActionState } from "react";
import { cancelBookingAction, lookupBookingAction, type LookupState } from "@/app/my-bookings/actions";

const initialState: LookupState = { ok: false };
export function ManageBookingForm() {
  const [state, lookupAction, isLooking] = useActionState(lookupBookingAction, initialState);
  const [cancelState, cancelAction, isCancelling] = useActionState(cancelBookingAction, initialState);
  const shown = cancelState.ok ? cancelState : state;

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[360px_1fr]">
      <form action={lookupAction} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700">เลขที่การจอง<input name="bookingNumber" required placeholder="BK-20260819-XXXXXXXX" className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 uppercase outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100" /></label>
        <label className="mt-5 block text-sm font-semibold text-slate-700">รหัสจัดการ 12 ตัว<input name="manageCode" required placeholder="XXXXXXXXXXXX" className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono uppercase tracking-wider outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100" /></label>
        <button disabled={isLooking} className="mt-6 w-full rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-amber-500 hover:text-slate-950 disabled:opacity-50">{isLooking ? "กำลังตรวจสอบ…" : "ค้นหาการจอง"}</button>
        {!state.ok && state.message ? <p role="alert" className="mt-4 text-sm font-semibold text-rose-700">{state.message}</p> : null}
      </form>

      <section className="min-h-80 rounded-[1.75rem] border border-slate-200 bg-white p-6 sm:p-8">
        {shown.ok ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{shown.booking.bookingNumber}</p><h2 className="mt-2 text-3xl font-semibold">{shown.booking.machineCode}</h2><p className="mt-1 text-slate-500">{shown.booking.machineName}</p></div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">{shown.booking.status}</span>
            </div>
            <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4"><p className="text-xs text-slate-400">ระยะเวลาใช้งาน</p><p className="mt-1 text-lg font-semibold">ใช้งานได้ 3 ชั่วโมง</p><p className="mt-1 text-sm text-slate-500">เวลาจะเริ่มนับเมื่อ login เข้า TimeLock</p></div>
            {shown.booking.canCancel ? <form action={cancelAction} className="mt-8"><input type="hidden" name="bookingNumber" value={shown.bookingNumber} /><input type="hidden" name="manageCode" value={shown.manageCode} /><button disabled={isCancelling} className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 font-semibold text-rose-700 hover:bg-rose-600 hover:text-white">{isCancelling ? "กำลังยกเลิก…" : "ยกเลิกการจอง"}</button></form> : <p className="mt-8 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">รายการนี้ไม่สามารถยกเลิกได้แล้ว</p>}
            {cancelState.message ? <p className="mt-4 text-sm font-semibold text-emerald-700">{cancelState.message}</p> : null}
          </>
        ) : <div className="flex min-h-64 items-center justify-center text-center"><div><p className="text-5xl font-semibold text-slate-200">BK</p><p className="mt-3 text-slate-500">กรอกข้อมูลด้านซ้ายเพื่อดูรายละเอียดการจอง</p></div></div>}
      </section>
    </div>
  );
}
