import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { MachineAdminCard } from "@/components/admin/machine-admin-card";
import { requireActiveAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminMachinesPage() {
  const supabase = await createSupabaseServerClient();
  await requireActiveAdmin(supabase).catch(() => redirect("/admin"));
  const { data, error } = await supabase.from("machines").select("id, machine_code, machine_name, location, status, device_token_hash").order("machine_code");
  if (error) throw error;
  const machines = (data ?? []).map(({ device_token_hash, ...machine }) => ({ ...machine, hasToken: Boolean(device_token_hash) }));
  return <main className="min-h-screen bg-[#f4f6f8] text-slate-950"><div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12"><AdminNav /><header className="mt-14 max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-600">MACHINE PROVISIONING</p><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">จัดการเครื่องคอมพิวเตอร์</h1><p className="mt-4 leading-7 text-slate-600">แก้สถานะและสร้าง Device Token สำหรับเชื่อม TimeLockApp แต่ละเครื่อง Token ใหม่จะแสดงเพียงครั้งเดียว</p></header><section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{machines.map((machine) => <MachineAdminCard key={machine.id} machine={machine} />)}</section></div></main>;
}
