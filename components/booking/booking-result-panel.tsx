import type { BookingFormState } from "@/app/booking/actions";

const dateTime = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

export function BookingResultPanel({
  state,
  onRetry,
}: {
  state: BookingFormState;
  onRetry?: () => void;
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
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">ช่วงเวลาที่จอง</p>
            <p className="mt-3 text-sm font-semibold text-blue-950">{dateTime.format(new Date(booking.startAt))}</p>
            <p className="mt-1 text-sm font-semibold text-blue-950">ถึง {dateTime.format(new Date(booking.endAt))}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">รหัสจัดการ · แสดงครั้งเดียว</p>
            <p className="font-display mt-3 break-all text-2xl font-bold tracking-[0.12em]">{booking.manageCode}</p>
          </div>
          <div className="rounded-2xl bg-[#0b1324] p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">ข้อมูลสำหรับ TimeLock</p>
            <p className="mt-3 text-sm text-slate-300">ชื่อผู้ใช้ TimeLock</p>
            <p className="font-display break-all text-xl font-semibold">{booking.timelockUsername}</p>
            <p className="mt-3 text-sm text-slate-300">รหัสผ่าน TimeLock · แสดงครั้งเดียว</p>
            <p className="font-display break-all text-xl font-bold tracking-[0.08em]">{booking.timelockPassword}</p>
          </div>
        </div>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600">ใช้ Username และ Password TimeLock เพื่อเข้าเครื่องที่จอง โปรดบันทึกรหัสจัดการและรหัสผ่านก่อนปิดหน้า เพราะระบบจะแสดง password เพียงครั้งเดียว</p>
        <a href="/my-bookings" className="mt-6 inline-flex rounded-xl bg-[#2563eb] px-5 py-3 font-semibold text-white transition hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">จัดการการจองนี้</a>
      </div>
    </section>
  );
}
