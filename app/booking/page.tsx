import Link from "next/link";
import { PublicBookingBoard } from "@/components/booking/public-booking-board";
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
    <main className="min-h-screen bg-[#f4f6f8] text-slate-950">
      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-10">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-sm font-bold tracking-[0.2em]">BOOKING<span className="text-amber-500">AI</span>LAB</Link>
          <div className="flex items-center gap-5 text-sm font-semibold text-slate-500"><Link href="/my-bookings" className="hover:text-slate-950">จัดการการจอง</Link><Link href="/admin" className="hover:text-slate-950">ผู้ดูแลระบบ</Link></div>
        </nav>

        <header className="mt-12 grid gap-6 border-b border-slate-200 pb-9 lg:grid-cols-[1fr_auto] lg:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-600">AI LAB / SCHEDULE BOARD</p><h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">จองเครื่องคอม<br className="hidden sm:block" />ให้ตรงกับเวลาของคุณ</h1></div>
          <p className="max-w-md text-sm leading-7 text-slate-600">ไม่ต้องเข้าสู่ระบบ กรอกรหัสนิสิตหรืออีเมล Google @msu.ac.th ที่มีอยู่ในระบบ แล้วเลือกหนึ่งใน 6 เครื่องได้ในหน้าเดียว</p>
        </header>

        <PublicBookingBoard dates={dates} initialOptions={options} initialMessage={initial.ok ? undefined : initial.message} />
      </div>
    </main>
  );
}
