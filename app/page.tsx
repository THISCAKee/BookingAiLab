import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-950">
      <section className="w-full max-w-2xl rounded-3xl bg-white p-10 shadow-sm ring-1 ring-slate-200">
        <p className="mb-3 text-sm font-medium text-blue-700">BookingAiLab</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          ระบบจองเครื่องคอมพิวเตอร์
        </h1>
        <p className="mt-4 text-slate-600">เลือกวัน รอบเวลา และเครื่องคอมพิวเตอร์ได้ในหน้าเดียว โดยใช้รหัสนิสิตหรืออีเมล @msu.ac.th</p>
        <Link
          href="/booking"
          className="mt-7 inline-block rounded-xl bg-blue-700 px-5 py-3 font-medium text-white hover:bg-blue-800"
        >
          จองเครื่องคอมพิวเตอร์
        </Link>
        <Link href="/my-bookings" className="ml-4 text-sm font-semibold text-slate-500 hover:text-slate-800">จัดการการจอง</Link>
      </section>
    </main>
  );
}
