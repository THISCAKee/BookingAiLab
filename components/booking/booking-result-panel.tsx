import type { BookingFormState } from "@/app/booking/actions";

export function BookingResultPanel({
  state,
  onRetry,
  actionHref = "/my-bookings",
  actionLabel = "ข้อมูลการจองนี้",
  onCancel,
  isCancelling = false,
  cancelMessage,
}: {
  state: BookingFormState;
  onRetry?: () => void;
  actionHref?: string;
  actionLabel?: string;
  onCancel?: () => void;
  isCancelling?: boolean;
  cancelMessage?: string;
}) {
  if (!state.ok) {
    return (
      <section className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900 sm:p-6" role="alert">
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-500 font-bold text-white" aria-hidden="true">!</span>
          <div>
            <h2 className="font-display text-lg font-semibold">จองไม่สำเร็จ</h2>
            <p className="mt-1 text-sm leading-6 text-rose-800">{state.message}</p>
            {state.retryable && onRetry ? (
              <button type="button" onClick={onRetry} className="mt-4 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200">
                ลองเลือกเครื่องใหม่
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  const booking = state.booking;
  const isActive = booking.status === "active";
  const statusLabel = isActive ? "กำลังใช้งาน" : booking.status === "cancelled" ? "ยกเลิกแล้ว" : "ยืนยันแล้ว";
  const canCancel = onCancel && !isActive && booking.status !== "cancelled" && booking.status !== "completed" && booking.status !== "expired";
  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-7">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500 text-sm font-bold text-white" aria-hidden="true">✓</span>
        <div>
          <p className="font-display font-semibold text-[#171717]">ยืนยันการจองแล้ว</p>
          <p className="text-xs text-slate-500">{booking.machineCode} จองคิวสำเร็จ</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          สถานะการจอง: {statusLabel}
        </span>
      </div>

      <div className="p-5 sm:p-7">
        <div className="timelock-highlight rounded-2xl bg-[#171717] p-5 text-white sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-sm font-semibold text-[#facc15]">ข้อมูลสำหรับ TimeLock</p>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">ใช้สำหรับเข้าเครื่องที่จอง</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/10 sm:col-span-2">
              <p className="text-xs font-medium text-slate-400">ชื่อผู้ใช้งาน</p>
              <p className="mt-1 break-words text-lg font-semibold leading-tight">{booking.name}</p>
            </div>
            <div className="rounded-xl bg-white px-4 py-4 text-[#171717]">
              <p className="text-xs font-medium text-slate-500">User</p>
              <p className="timelock-username-value mt-1 break-all text-3xl font-semibold leading-tight">{booking.timelockUsername}</p>
            </div>
            <div className="rounded-xl bg-white px-4 py-4 text-[#171717]">
              <p className="text-xs font-medium text-slate-500">Password · แสดงครั้งเดียว</p>
              <p className="timelock-password-value mt-1 break-all text-3xl font-semibold leading-tight tracking-[0.04em]">{booking.timelockPassword}</p>
            </div>
          </div>
        </div>

        <div className="booking-duration-section mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-slate-200 px-5 py-4">
          <p className="font-semibold text-[#171717]">ใช้งานได้ 3 ชั่วโมง</p>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">รอบใช้งาน 180 นาที</span>
          <p className="w-full text-sm text-slate-600">เวลาจะเริ่มนับเมื่อ login เข้า TimeLock</p>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">
          ใช้ User และ Password เพื่อเข้าเครื่องที่จอง{isActive ? " ขณะนี้กำลังใช้งานอยู่" : " โปรดบันทึกรหัสผ่านก่อนปิดหน้า เพราะระบบจะแสดง password เพียงครั้งเดียว"}
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a href={actionHref} className="inline-flex w-full justify-center rounded-xl bg-[#ffffff] px-5 py-3 font-semibold text-[#171717] transition hover:bg-[#eab308] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 sm:w-auto">{actionLabel}</a>
          {canCancel ? <button type="button" onClick={onCancel} disabled={isCancelling} className="w-full rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60 sm:w-auto">{isCancelling ? "กำลังยกเลิก…" : "ยกเลิกการจอง"}</button> : null}
        </div>
        {cancelMessage ? <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{cancelMessage}</p> : null}
      </div>
    </section>
  );
}
