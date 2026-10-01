import { redirect } from "next/navigation";
import { MachineDashboard } from "@/components/admin/machine-dashboard";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminIdentity } from "@/lib/auth/identity";
import { getTimelockSyncHealth, listMachineDashboard } from "@/lib/machines/queries";

export default async function AdminDashboardPage() {
  await requireAdminIdentity().catch(() => redirect("/admin"));

  const [machines, syncHealth] = await Promise.all([
    listMachineDashboard(),
    getTimelockSyncHealth(),
  ]);

  return (
    <main className="min-h-screen bg-white text-[#171717]">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <AdminNav />

        <PageHeader
          eyebrow="Live Room Monitor"
          title={<>สถานะห้องคอม <span className="text-amber-600">เรียลไทม์</span></>}
          description="ดูการเชื่อมต่อ TimeLockApp ผู้ที่กำลัง Login และรายการจองปัจจุบันของทุกเครื่องในหน้าเดียว"
        />

        <MachineDashboard machines={machines} syncHealth={syncHealth} />
      </div>
    </main>
  );
}
