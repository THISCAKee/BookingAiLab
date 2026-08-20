import { redirect } from "next/navigation";
import { requireActiveAdmin } from "@/lib/auth/admin";
import { getBookingSettings } from "@/lib/booking/settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BookingSettingsForm } from "@/components/admin/booking-settings-form";
import { AdminNav } from "@/components/admin/admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = await createSupabaseServerClient();
  await requireActiveAdmin(supabase).catch(() => redirect("/admin"));

  const settings = await getBookingSettings(supabase);

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-slate-950">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <AdminNav />

        <section className="mt-16 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-600">Admin control</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">ตั้งค่าการให้บริการ</h1>
          <p className="mt-4 leading-8 text-slate-600">แก้กติกาสำหรับการจองใหม่ การจองที่ยืนยันแล้วจะไม่เปลี่ยนแปลงตาม Settings นี้</p>
        </section>

        <section className="mt-10 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] sm:p-8">
          <BookingSettingsForm settings={settings} canEdit />
        </section>
      </div>
    </main>
  );
}
