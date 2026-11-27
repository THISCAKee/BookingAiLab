import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminCancelBookingButton } from "@/components/admin/admin-cancel-booking-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminIdentity } from "@/lib/auth/identity";
import { listAdminBookings, listAdminMachines } from "@/lib/admin/sheet-repository";
import { bookingMachineOffline, bookingOverdue } from "@/lib/machines/queries";

const allowedStatuses = ["all", "confirmed", "app_pending", "app_received", "active", "completed", "cancelled", "expired"];

const statusBadges: Record<string, { label: string; tone: string }> = {
  confirmed: { label: "ยืนยันแล้ว", tone: "bg-amber-50 text-amber-800 ring-amber-200" },
  app_pending: { label: "รอส่งเข้าเครื่อง", tone: "bg-amber-50 text-amber-800 ring-amber-200" },
  app_received: { label: "เครื่องรับแล้ว", tone: "bg-amber-50 text-amber-800 ring-amber-200" },
  active: { label: "กำลังใช้งาน", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  completed: { label: "เสร็จสิ้น", tone: "bg-slate-100 text-slate-600 ring-slate-200" },
  cancelled: { label: "ยกเลิกแล้ว", tone: "bg-rose-50 text-rose-700 ring-rose-200" },
  expired: { label: "หมดอายุ", tone: "bg-slate-100 text-slate-600 ring-slate-200" },
};

const fallbackBadgeTone = "bg-slate-100 text-slate-600 ring-slate-200";
const overdueBadge = { label: "เกินเวลา", tone: "bg-orange-50 text-orange-700 ring-orange-200" };

function bookingBadge(row: { status: string; endAt: string; machineId: string }, now: Date) {
  if (bookingOverdue(row, now)) return overdueBadge;
  return statusBadges[row.status] ?? { label: row.status, tone: fallbackBadgeTone };
}

const bangkokDate = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });
const bangkokTime = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Bangkok" });

// "27 พ.ย. 2569 · 08:50–11:50 น."; the end carries its own date only when the booking crosses midnight.
function bookingSchedule(row: { startAt: string; endAt: string; createdAt: string }) {
  const start = new Date(row.startAt);
  const end = new Date(row.endAt);
  const endDate = bangkokDate.format(end);
  const sameDay = bangkokDate.format(start) === endDate;
  return {
    window: `${bangkokDate.format(start)} · ${bangkokTime.format(start)}–${sameDay ? "" : `${endDate} `}${bangkokTime.format(end)} น.`,
    created: `จองเมื่อ ${bangkokDate.format(new Date(row.createdAt))} ${bangkokTime.format(new Date(row.createdAt))} น.`,
  };
}

function MachineOfflineBadge() {
  return <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200" title="รายการจองยังไม่ถูกปิด แต่เครื่องไม่ได้ส่งสัญญาณมาเกิน 45 วินาที">เครื่อง Offline</span>;
}

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = "", status = "all" } = await searchParams;
  const selectedStatus = allowedStatuses.includes(status) ? status : "all";
  await requireAdminIdentity().catch(() => redirect("/admin"));
  const normalizedQuery = q.trim().toLowerCase();
  const [bookings, machines] = await Promise.all([listAdminBookings(), listAdminMachines()]);
  const now = new Date();
  const machinesById = new Map(machines.map((machine) => [machine.id, machine]));
  const rows = bookings.filter((row) => (selectedStatus === "all" || row.status === selectedStatus) && (!normalizedQuery || [row.bookingNumber, row.machineCode, row.email, row.name].some((value) => value.toLowerCase().includes(normalizedQuery))));

  return (
    <main className="admin-shell min-h-dvh bg-white text-[#171717]">
      <div className="mx-auto max-w-6xl px-4 2xl:max-w-7xl py-5 sm:px-6 sm:py-7 lg:px-8">
        <AdminNav />
        <PageHeader
          eyebrow="Booking Operations"
          title="รายการจองทั้งหมด"
          description={`พบ ${rows.length} รายการ · ค้นหาด้วยเลขที่การจอง เครื่อง ชื่อ หรืออีเมล`}
        />

        <form className="mt-8 flex flex-col gap-2 sm:flex-row">
          <input name="q" defaultValue={q} placeholder="ค้นหาเลขที่การจอง เครื่อง ชื่อ หรืออีเมล" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#171717] focus:ring-4 focus:ring-amber-100" />
          <select name="status" defaultValue={selectedStatus} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#171717] focus:ring-4 focus:ring-amber-100">
            <option value="all">ทุกสถานะ</option>
            {allowedStatuses.slice(1).map((value) => <option key={value} value={value}>{statusBadges[value]?.label ?? value}</option>)}
          </select>
          <button className="rounded-xl bg-[#facc15] px-6 py-3 text-sm font-semibold text-[#171717] transition hover:bg-[#eab308] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200">ค้นหา</button>
        </form>

        <section className="mt-5 space-y-3 md:hidden" aria-label="รายการจอง">
          {rows.map((row) => {
            const badge = bookingBadge(row, now);
            const schedule = bookingSchedule(row);
            return (
              <article key={row.bookingId} className="admin-glass rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-semibold">{row.bookingNumber} <span className="font-normal text-slate-500">· {row.machineCode}</span></p>
                    <p className="mt-1 break-words text-sm font-medium">{row.name}</p>
                    <p className="break-all text-xs text-slate-500">{row.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badge.tone}`}>{badge.label}</span>
                    {bookingMachineOffline(row, machinesById.get(row.machineId), now) ? <MachineOfflineBadge /> : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3">
                  <div className="text-xs"><p className="font-medium text-[#171717]">{schedule.window}</p><p className="text-slate-500">{schedule.created}</p></div>
                  {!["completed", "cancelled", "expired"].includes(row.status) ? <AdminCancelBookingButton bookingId={row.bookingId} /> : null}
                </div>
              </article>
            );
          })}
          {rows.length === 0 ? <p className="admin-glass rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">ไม่พบรายการจอง</p> : null}
        </section>

        <section className="admin-glass mt-5 hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
              <tr><th className="px-5 py-3.5">Booking</th><th className="px-5 py-3.5">ผู้จอง</th><th className="px-5 py-3.5">เครื่อง</th><th className="px-5 py-3.5">วันเวลาจอง</th><th className="px-5 py-3.5">สถานะ</th><th className="px-5 py-3.5 text-right">จัดการ</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const badge = bookingBadge(row, now);
                const schedule = bookingSchedule(row);
                return (
                  <tr key={row.bookingId} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4 font-display font-semibold">{row.bookingNumber}</td>
                    <td className="px-5 py-4"><p className="font-medium">{row.name}</p><p className="text-xs text-slate-500">{row.email}</p></td>
                    <td className="px-5 py-4 font-display font-semibold">{row.machineCode}</td>
                    <td className="px-5 py-4"><p className="whitespace-nowrap font-medium">{schedule.window}</p><p className="text-xs text-slate-500">{schedule.created}</p></td>
                    <td className="px-5 py-4"><div className="flex flex-wrap gap-1.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badge.tone}`}>{badge.label}</span>{bookingMachineOffline(row, machinesById.get(row.machineId), now) ? <MachineOfflineBadge /> : null}</div></td>
                    <td className="px-5 py-4 text-right">{!["completed", "cancelled", "expired"].includes(row.status) ? <AdminCancelBookingButton bookingId={row.bookingId} /> : <span className="text-slate-400">—</span>}</td>
                  </tr>
                );
              })}
              {rows.length === 0 ? <tr><td colSpan={6} className="px-5 py-16 text-center text-slate-500">ไม่พบรายการจอง</td></tr> : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
