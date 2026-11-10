import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdminIdentity } from "@/lib/auth/identity";
import { listAdminBookings } from "@/lib/admin/sheet-repository";
import { bookingActivity, summarizeAdminOverview } from "@/lib/admin/overview";
import { listMachineDashboard } from "@/lib/machines/queries";

const statusLabels: Record<string, string> = {
  confirmed: "ยืนยันแล้ว", app_pending: "รอส่งเข้าเครื่อง", app_received: "เครื่องรับแล้ว",
  active: "กำลังใช้งาน", completed: "เสร็จสิ้น", cancelled: "ยกเลิกแล้ว", expired: "หมดอายุ",
};

export default async function AdminOverviewPage() {
  await requireAdminIdentity().catch(() => redirect("/admin"));
  const [bookings, machines] = await Promise.all([listAdminBookings(), listMachineDashboard()]);
  const summary = summarizeAdminOverview(bookings, machines);
  const activity = bookingActivity(bookings);
  const activityTotal = activity.reduce((sum, day) => sum + day.count, 0);
  const activityMax = Math.max(1, ...activity.map((day) => day.count));
  const stats = [
    { label: "การจองทั้งหมด", value: summary.totalBookings, detail: "รายการที่บันทึกไว้", icon: "▤" },
    { label: "การจองที่ดำเนินอยู่", value: summary.openBookings, detail: "ยังไม่สิ้นสุดหรือยกเลิก", icon: "◷" },
    { label: "เครื่องออนไลน์", value: summary.onlineMachines, detail: "รวมเครื่องที่กำลังใช้งาน", icon: "◉" },
    { label: "เครื่องออฟไลน์", value: summary.offlineMachines, detail: "ไม่ได้เชื่อมต่อในขณะนี้", icon: "○" },
  ];
  return (
    <main className="overview-shell min-h-dvh text-[#1f2937]">
      <div className="mx-auto max-w-6xl px-4 2xl:max-w-7xl py-5 sm:px-6 sm:py-7 lg:px-8">
        <AdminNav />
        <header className="overview-header mt-8 sm:mt-14">
          <p className="text-sm font-semibold text-[#a16207]">พื้นที่ผู้ดูแลระบบ</p>
          <h1 className="mt-2 text-[1.75rem] font-bold tracking-tight sm:text-4xl">ภาพรวมหลังบ้าน</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#475569] sm:text-base">ติดตามการจองและสถานะเครื่องคอมพิวเตอร์ในห้องได้ในหน้าเดียว</p>
        </header>
        <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="สรุปข้อมูลหลังบ้าน">
          {stats.map((stat) => <article key={stat.label} className="overview-card card-tilt overview-stat p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2"><p className="min-w-0 text-xs font-semibold text-[#475569] sm:text-sm">{stat.label}</p><span aria-hidden="true" className="overview-icon">{stat.icon}</span></div>
            <p className="mt-3 text-2xl font-bold tabular-nums sm:mt-4 sm:text-4xl">{stat.value}</p>
            <p className="mt-1 text-xs leading-5 text-[#64748b]">{stat.detail}</p>
          </article>)}
        </section>
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
          <section className="overview-card analytics-chart min-w-0 p-5 sm:p-6" aria-labelledby="activity-title">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><h2 id="activity-title" className="text-lg font-bold">แนวโน้มการจอง</h2><p className="mt-1 text-sm text-slate-500">รายการที่สร้างใน 7 วันล่าสุด · เวลาไทย</p></div>
              <div className="text-right"><p className="text-3xl font-bold tabular-nums">{activityTotal}</p><p className="text-xs text-slate-500">รายการในช่วงนี้</p></div>
            </div>
            <div className="analytics-bars mt-7" role="list" aria-label="จำนวนการจองแต่ละวัน">
              {activity.map((day) => <div className="analytics-day" role="listitem" key={day.date} aria-label={`${day.date}: ${day.count} รายการ`}>
                <span className="analytics-count">{day.count}</span><span className="analytics-bar-track"><span className="analytics-bar-fill" style={{ height: `${day.count / activityMax * 100}%` }} /></span><span className="analytics-date">{day.date.slice(8, 10)}/{day.date.slice(5, 7)}</span>
              </div>)}
            </div>
          </section>
          <section className="overview-card p-5 sm:p-6">
            <h2 className="text-lg font-bold">สถานะเครื่อง</h2><p className="mt-1 text-sm text-[#64748b]">ภาพรวมการเชื่อมต่อในห้อง</p>
            <div className="analytics-machine-total"><strong>{machines.length}</strong><span>เครื่องทั้งหมด</span></div>
            <div className="mt-5 space-y-5">
              <div><div className="flex justify-between text-sm"><span>ออนไลน์</span><strong>{summary.onlineMachines} เครื่อง</strong></div><div className="overview-track mt-2"><div className="overview-bar" style={{ width: `${machines.length ? summary.onlineMachines / machines.length * 100 : 0}%` }} /></div></div>
              <div><div className="flex justify-between text-sm"><span>ออฟไลน์</span><strong>{summary.offlineMachines} เครื่อง</strong></div><div className="overview-track mt-2"><div className="overview-bar overview-bar-offline" style={{ width: `${machines.length ? summary.offlineMachines / machines.length * 100 : 0}%` }} /></div></div>
            </div>
            <Link className="overview-action mt-8" href="/admin/dashboard">ดูสถานะเครื่องทั้งหมด <span aria-hidden="true">→</span></Link>
          </section>
        </div>
        <div className="mt-5">
          <section className="overview-card min-w-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">รายการจองล่าสุด</h2><p className="mt-1 text-sm text-[#64748b]">รายการล่าสุดจากระบบจอง</p></div><Link className="overview-link" href="/admin/bookings">ดูทั้งหมด <span aria-hidden="true">→</span></Link></div>
            <div className="mt-5 divide-y divide-[#e2e8f0]">
              {bookings.slice(0, 5).map((booking) => <div key={booking.bookingId} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                <div className="min-w-0"><p className="font-semibold">{booking.bookingNumber} <span className="font-normal text-[#64748b]">· {booking.machineCode}</span></p><p className="mt-1 truncate text-xs text-[#64748b]">{booking.name}</p></div>
                <span className="overview-status">{statusLabels[booking.status] ?? booking.status}</span>
              </div>)}
              {bookings.length === 0 && <p className="py-8 text-center text-sm text-[#64748b]">ยังไม่มีรายการจอง</p>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
