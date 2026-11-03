import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { MachineAdminCard } from "@/components/admin/machine-admin-card";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminIdentity } from "@/lib/auth/identity";
import { listAdminMachines } from "@/lib/admin/sheet-repository";

export default async function AdminMachinesPage() {
  await requireAdminIdentity().catch(() => redirect("/admin"));
  const machines = await listAdminMachines();
  return (
    <main className="admin-shell min-h-screen bg-white text-[#171717]">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <AdminNav />
        <PageHeader
          eyebrow="Machine Provisioning"
          title="จัดการเครื่องคอมพิวเตอร์"
          description="แก้สถานะและสร้าง Device Token สำหรับเชื่อม TimeLockApp แต่ละเครื่อง Token ใหม่จะแสดงเพียงครั้งเดียว"
        />
        <section className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {machines.map((machine) => <MachineAdminCard key={machine.id} machine={machine} />)}
        </section>
      </div>
    </main>
  );
}
