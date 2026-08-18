import { PublicBookingBoard } from "@/components/booking/public-booking-board";
import { PublicBookingNav } from "@/components/booking/public-booking-nav";
import { getPublicBookingOptions, type PublicBookingOptions } from "@/lib/booking/actions";
import { getSelectableBookingDates } from "@/lib/booking/schedule";

export const dynamic = "force-dynamic";

export default async function BookingPage() {
  const dates = getSelectableBookingDates();
  const initial = await getPublicBookingOptions(dates[0].value);
  const options: PublicBookingOptions = initial.ok
    ? initial.data
    : { date: dates[0].value, slots: [] };

  return (
    <main className="min-h-screen bg-[#f3f6fa] text-[#0b1324]">
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-7 sm:py-7 lg:px-10">
        <PublicBookingNav />

        <header className="mt-10 grid gap-6 border-b border-slate-200/80 pb-8 lg:grid-cols-[1fr_440px] lg:items-end">
          <div>
            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#2563eb]">
              <span className="h-px w-8 bg-[#2563eb]" aria-hidden="true" />
              MSU AI LAB · WORKSTATION BOOKING
            </div>
            <h1 className="font-display mt-4 max-w-4xl text-[2.65rem] font-semibold leading-[1.08] tracking-[-0.045em] sm:text-6xl">
              จองเครื่องใน AI Lab
              <span className="ml-3 whitespace-nowrap text-[#2563eb]">6 เครื่อง</span>
            </h1>
          </div>
          <p className="max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
            กรอกรหัสนิสิต เลือกวันและรอบเวลา จากนั้นเลือกเครื่องที่มีสถานะว่าง ระบบจะแสดงรหัสจัดการหลังยืนยันการจอง
          </p>
        </header>

        <PublicBookingBoard dates={dates} initialOptions={options} initialMessage={initial.ok ? undefined : initial.message} />
      </div>
    </main>
  );
}
