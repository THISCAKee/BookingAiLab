import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureCustomerProfile, requireUniversityUser } from "@/lib/auth/profile";
import { listAvailableMachines } from "@/lib/booking/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MachineCard } from "@/components/booking/machine-card";

export default async function BookingPage() {
  const supabase = await createSupabaseServerClient();
  let machines;

  try {
    const user = await requireUniversityUser(supabase);
    await ensureCustomerProfile(supabase, user);
    machines = await listAvailableMachines(supabase);
  } catch {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-slate-950">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <nav className="flex items-center justify-between">
          <Link href="/" className="text-sm font-bold tracking-[0.2em] text-slate-950">
            BOOKING<span className="text-amber-500">AI</span>LAB
          </Link>
          <div className="flex gap-4 text-sm font-semibold text-slate-500">
            <Link href="/my-bookings" className="hover:text-slate-950">การจองของฉัน</Link>
            <Link href="/" className="hover:text-slate-950">หน้าหลัก</Link>
          </div>
        </nav>

        <section className="mt-16 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-600">Live availability</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
            เลือกเครื่องที่พร้อมใช้งาน
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">
            กดจองแล้วเริ่มใช้งานได้ทันที รอบละ 3 ชั่วโมง ระบบจะเลือกเวลาเริ่มจากเวลาปัจจุบันให้โดยอัตโนมัติ
          </p>
        </section>

        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="เครื่องที่ว่าง">
          {machines.length > 0 ? (
            machines.map((machine) => <MachineCard key={machine.id} machine={machine} />)
          ) : (
            <div className="col-span-full rounded-[1.75rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <p className="text-lg font-semibold text-slate-800">ยังไม่มีเครื่องว่างในขณะนี้</p>
              <p className="mt-2 text-sm text-slate-500">ลองกลับมาตรวจสอบอีกครั้งเมื่อมีเครื่องพร้อมใช้งาน</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
