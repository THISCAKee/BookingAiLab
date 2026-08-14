import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  let isSignedIn = false;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    isSignedIn = Boolean(user);
  } catch {
    isSignedIn = false;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-950">
      <section className="w-full max-w-2xl rounded-3xl bg-white p-10 shadow-sm ring-1 ring-slate-200">
        <p className="mb-3 text-sm font-medium text-blue-700">BookingAiLab</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          ระบบจองเครื่องคอมพิวเตอร์
        </h1>
        <p className="mt-4 text-slate-600">
          Foundation พร้อมสำหรับพัฒนา Authentication และ Booking Flow ใน Phase ถัดไป
        </p>
        <Link
          href={isSignedIn ? "/booking" : "/login"}
          className="mt-7 inline-block rounded-xl bg-blue-700 px-5 py-3 font-medium text-white hover:bg-blue-800"
        >
          {isSignedIn ? "ไปหน้าจองเครื่อง" : "เข้าสู่ระบบ"}
        </Link>
        {isSignedIn ? (
          <Link href="/my-bookings" className="ml-4 text-sm font-semibold text-slate-500 hover:text-slate-800">
            ดูการจองของฉัน
          </Link>
        ) : null}
      </section>
    </main>
  );
}
