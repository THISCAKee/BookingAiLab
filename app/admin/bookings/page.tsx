import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminCancelBookingButton } from "@/components/admin/admin-cancel-booking-button";
import { requireActiveAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const dateTime = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" });
const allowedStatuses = ["all", "confirmed", "app_pending", "app_received", "active", "completed", "cancelled", "expired"];

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = "", status = "all" } = await searchParams;
  const selectedStatus = allowedStatuses.includes(status) ? status : "all";
  const supabase = await createSupabaseServerClient();
  await requireActiveAdmin(supabase).catch(() => redirect("/admin"));

  let query = supabase.from("bookings").select("id, booking_number, start_at, end_at, status, machines(machine_code), customer_profiles(university_email, display_name)").order("start_at", { ascending: false }).limit(200);
  if (selectedStatus !== "all") query = query.eq("status", selectedStatus);
  const { data, error } = await query;
  if (error) throw error;
  const normalizedQuery = q.trim().toLowerCase();
  const rows = ((data ?? []) as unknown as Array<{ id: string; booking_number: string; start_at: string; end_at: string; status: string; machines: { machine_code: string } | null; customer_profiles: { university_email: string; display_name: string } | null }>).filter((row) => !normalizedQuery || [row.booking_number, row.machines?.machine_code, row.customer_profiles?.university_email, row.customer_profiles?.display_name].some((value) => value?.toLowerCase().includes(normalizedQuery)));

  return <main className="min-h-screen bg-[#f4f6f8] text-slate-950"><div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12"><AdminNav /><header className="mt-14"><p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-600">BOOKING OPERATIONS</p><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">รายการจองทั้งหมด</h1></header><form className="mt-8 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4"><input name="q" defaultValue={q} placeholder="ค้นหาเลขที่การจอง" className="min-w-64 flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-amber-500" /><select name="status" defaultValue={selectedStatus} className="rounded-xl border border-slate-200 px-4 py-3"><option value="all">ทุกสถานะ</option>{allowedStatuses.slice(1).map((value) => <option key={value} value={value}>{value}</option>)}</select><button className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white">ค้นหา</button></form><section className="mt-6 overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-4">Booking</th><th className="p-4">ผู้จอง</th><th className="p-4">เครื่อง</th><th className="p-4">เวลา</th><th className="p-4">สถานะ</th><th className="p-4">จัดการ</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id}><td className="p-4 font-semibold">{row.booking_number}</td><td className="p-4"><p>{row.customer_profiles?.display_name}</p><p className="text-xs text-slate-500">{row.customer_profiles?.university_email}</p></td><td className="p-4 font-semibold">{row.machines?.machine_code}</td><td className="p-4"><p>{dateTime.format(new Date(row.start_at))}</p><p className="text-xs text-slate-500">ถึง {dateTime.format(new Date(row.end_at))}</p></td><td className="p-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{row.status}</span></td><td className="p-4">{!["completed", "cancelled", "expired"].includes(row.status) ? <AdminCancelBookingButton bookingId={row.id} /> : "—"}</td></tr>)}{rows.length === 0 ? <tr><td colSpan={6} className="p-14 text-center text-slate-500">ไม่พบรายการจอง</td></tr> : null}</tbody></table></section></div></main>;
}
