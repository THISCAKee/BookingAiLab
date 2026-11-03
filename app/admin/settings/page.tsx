import { redirect } from "next/navigation";
import { requireAdminIdentity } from "@/lib/auth/identity";
import { getBookingSettings } from "@/lib/booking/settings";
import { BookingSettingsForm } from "@/components/admin/booking-settings-form";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageHeader } from "@/components/ui/page-header";

export default async function AdminSettingsPage() {
  await requireAdminIdentity().catch(() => redirect("/admin"));

  const settings = await getBookingSettings();

  return (
    <main className="admin-shell min-h-screen bg-white text-[#171717]">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <AdminNav />

        <PageHeader
          eyebrow="Admin Control"
          title="ตั้งค่าการให้บริการ"
          description="แก้กติกาสำหรับการจองใหม่ การจองที่ยืนยันแล้วจะไม่เปลี่ยนแปลงตาม Settings นี้"
        />

        <section className="admin-glass mt-8 max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <BookingSettingsForm settings={settings} canEdit />
        </section>
      </div>
    </main>
  );
}
