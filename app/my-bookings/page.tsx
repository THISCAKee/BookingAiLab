import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureCustomerProfile, requireUniversityUser } from "@/lib/auth/profile";
import { listMyBookings } from "@/lib/booking/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BookingStatus } from "@/components/booking/booking-status";

const bangkokDateTime = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function MyBookingsPage() {
  const supabase = await createSupabaseServerClient();
  let bookings;

  try {
    const user = await requireUniversityUser(supabase);
    await ensureCustomerProfile(supabase, user);
    bookings = await listMyBookings(supabase);
  } catch {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-slate-950">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <nav className="flex items-center justify-between">
          <Link href="/" className="text-sm font-bold tracking-[0.2em] text-slate-950">
            BOOKING<span className="text-amber-500">AI</span>LAB
          </Link>
          <Link href="/booking" className="text-sm font-semibold text-slate-500 hover:text-slate-950">
            จองเครื่องเพิ่ม
          </Link>
        </nav>

        <section className="mt-16">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-600">Your bookings</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">การจองของฉัน</h1>
          <p className="mt-4 text-slate-600">ตรวจสอบเวลาใช้งานและยกเลิกรายการที่ยังไม่เริ่มได้จากหน้านี้</p>
        </section>

        <section className="mt-10 space-y-4" aria-label="รายการจองของฉัน">
          {bookings.length > 0 ? bookings.map((booking) => (
            <article key={booking.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{booking.booking_number}</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    {booking.machine?.machine_code || "เครื่องที่จอง"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {booking.machine?.machine_name || "ระบบกำลังเตรียมข้อมูลเครื่อง"}
                  </p>
                </div>
                <BookingStatus bookingId={booking.id} status={booking.status} />
              </div>
              <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-slate-400">เริ่มใช้งาน</p>
                  <p className="mt-1 font-semibold text-slate-800">{bangkokDateTime.format(new Date(booking.start_at))}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400">สิ้นสุด</p>
                  <p className="mt-1 font-semibold text-slate-800">{bangkokDateTime.format(new Date(booking.end_at))}</p>
                </div>
              </div>
            </article>
          )) : (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <p className="text-lg font-semibold text-slate-800">ยังไม่มีรายการจอง</p>
              <Link href="/booking" className="mt-4 inline-block font-semibold text-amber-700 underline underline-offset-4">ไปเลือกเครื่องที่ว่าง</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
