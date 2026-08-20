import { redirect } from "next/navigation";
import { MachineDashboard } from "@/components/admin/machine-dashboard";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireActiveAdmin } from "@/lib/auth/admin";
import { getTimelockSyncHealth, listMachineDashboard } from "@/lib/machines/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  await requireActiveAdmin(supabase).catch(() => redirect("/admin"));

  const [machines, syncHealth] = await Promise.all([
    listMachineDashboard(supabase),
    getTimelockSyncHealth(supabase),
  ]);

  return (
    <main className="min-h-screen bg-[#f3f6fa] text-[#0b1324]">
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-7 sm:py-7 lg:px-10">
        <AdminNav />

        <header className="mt-9 grid gap-6 border-b border-slate-200/80 pb-8 lg:grid-cols-[1fr_430px] lg:items-end">
          <div>
            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#2563eb]">
              <span className="h-px w-8 bg-[#2563eb]" aria-hidden="true" />
              LIVE ROOM MONITOR
            </div>
            <h1 className="font-display mt-4 max-w-4xl text-[2.65rem] font-semibold leading-[1.08] tracking-[-0.045em] sm:text-6xl">สถานะห้องคอม<br className="hidden sm:block" />แบบเรียลไทม์</h1>
          </div>
          <p className="max-w-xl text-sm leading-7 text-slate-600 sm:text-base">ดูการเชื่อมต่อ TimeLockApp ผู้ที่กำลัง Login และรายการจองปัจจุบันของเครื่องทั้ง 6 ในหน้าเดียว</p>
        </header>

        <MachineDashboard machines={machines} syncHealth={syncHealth} />
      </div>
    </main>
  );
}
