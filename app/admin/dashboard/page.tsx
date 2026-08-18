import { redirect } from "next/navigation";
import { MachineDashboard } from "@/components/admin/machine-dashboard";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireActiveAdmin } from "@/lib/auth/admin";
import { listMachineDashboard } from "@/lib/machines/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  await requireActiveAdmin(supabase).catch(() => redirect("/admin"));

  const machines = await listMachineDashboard(supabase);

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-slate-950">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <AdminNav />

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
