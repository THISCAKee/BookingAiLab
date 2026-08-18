import Link from "next/link";
import { redirect } from "next/navigation";
import { MachineDashboard } from "@/components/admin/machine-dashboard";
import { requireUniversityUser } from "@/lib/auth/profile";
import { listMachineDashboard } from "@/lib/machines/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const user = await requireUniversityUser(supabase).catch(() => redirect("/login"));
  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile?.is_active) redirect("/auth/unauthorized");

  const machines = await listMachineDashboard(supabase);

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-slate-950">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <nav className="flex items-center justify-between">
          <Link href="/" className="text-sm font-bold tracking-[0.2em] text-slate-950">BOOKING<span className="text-amber-500">AI</span>LAB</Link>
          <div className="flex gap-4 text-sm font-semibold text-slate-500">
            <Link href="/admin/settings" className="hover:text-slate-950">ตั้งค่า</Link>
            <Link href="/" className="hover:text-slate-950">หน้าหลัก</Link>
          </div>
        </nav>

        <section className="mt-16 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-600">Operations / live room view</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">ห้องคอมกำลังเป็นอย่างไร</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">ดูว่าเครื่องไหนเชื่อมต่ออยู่และกำลัง Login ใน TimeLockApp โดยไม่ต้องไล่เช็กทีละเครื่อง</p>
        </section>

        <MachineDashboard machines={machines} />
      </div>
    </main>
  );
}
