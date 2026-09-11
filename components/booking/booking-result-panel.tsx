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
      <section className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-[0_22px_60px_-48px_rgba(11,19,36,0.55)]" role="alert">
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
  const canShowBookingNumber = !isActive && Boolean(booking.bookingNumber);
  const statusLabel = isActive ? "กำลังใช้งาน" : booking.status === "cancelled" ? "ยกเลิกแล้ว" : "ยืนยันแล้ว";
  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-[0_24px_70px_-45px_rgba(11,19,36,0.45)]">
      <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-6 py-4 text-sm font-semibold text-emerald-800">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-white" aria-hidden="true">✓</span>
        ยืนยันการจองแล้ว
        <span className="ml-auto rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-emerald-800">สถานะการจอง: {statusLabel}</span>
      </div>
      <div className="p-6 sm:p-9">
        <p className="text-sm font-semibold text-emerald-700">{booking.machineCode} จองคิวสำเร็จ</p>
        <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight">บันทึกข้อมูลนี้ไว้ก่อนปิดหน้า</h2>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="booking-duration-section rounded-2xl border border-slate-200 bg-white p-6 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">ระยะเวลาใช้งาน</p>
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">รอบใช้งาน 180 นาที</span>
            </div>
            <p className="mt-4 text-2xl font-semibold text-slate-900">ใช้งานได้ 3 ชั่วโมง</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">เวลาจะเริ่มนับเมื่อ login เข้า TimeLock</p>
          </div>

          <div className="timelock-highlight rounded-2xl border-2 border-slate-300 bg-slate-100 p-7 text-slate-900 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.65)] sm:col-span-2 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-900">ข้อมูลสำหรับ TimeLock</p>
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-800">ใช้สำหรับเข้าเครื่องที่จอง</span>
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                <p className="text-sm font-medium text-slate-600">ชื่อผู้ใช้ TimeLock</p>
                <p className="timelock-username-value mt-2 break-all text-3xl font-semibold leading-tight text-[#171717]">{booking.timelockUsername}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                <p className="text-sm font-medium text-slate-600">รหัสผ่าน TimeLock · แสดงครั้งเดียว</p>
                <p className="timelock-password-value mt-2 break-all text-3xl font-semibold leading-tight tracking-[0.04em] text-[#171717]">{booking.timelockPassword}</p>
              </div>
            </div>
            <p className="mt-5 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800">
              เวลาจะเริ่มนับเมื่อ login เข้า TimeLock และได้รับเวลาใช้งานเต็ม 180 นาที
            </p>
          </div>

          {canShowBookingNumber ? <>
            <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">เลขที่การจอง</p>
              <p className="font-display mt-3 break-all text-lg font-semibold text-[#171717]">{booking.bookingNumber}</p>
              <p className="mt-3 text-xs leading-5 text-slate-500">ใช้สำหรับตรวจสอบรายละเอียดการจองของคุณ</p>
            </div>
          </> : null}
        </div>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600">ใช้ Username และ Password TimeLock เพื่อเข้าเครื่องที่จอง{isActive ? " ขณะนี้กำลังใช้งานอยู่" : " โปรดบันทึกรหัสผ่านก่อนปิดหน้า เพราะระบบจะแสดง password เพียงครั้งเดียว"}</p>
        <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
          {onCancel && !isActive && booking.status !== "cancelled" && booking.status !== "completed" && booking.status !== "expired" ? <button type="button" onClick={onCancel} disabled={isCancelling} className="w-full rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 font-semibold text-rose-700 transition hover:bg-rose-600 hover:text-white disabled:cursor-wait disabled:opacity-60 sm:w-auto">{isCancelling ? "กำลังยกเลิก…" : "ยกเลิกการจอง"}</button> : null}
          <a href={actionHref} className="inline-flex w-full justify-center rounded-xl bg-[#171717] px-5 py-3 font-semibold text-white transition hover:bg-amber-400 hover:text-[#171717] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 sm:w-auto">{actionLabel}</a>
        </div>
        {cancelMessage ? <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{cancelMessage}</p> : null}
      </div>
    </section>
  );
}
