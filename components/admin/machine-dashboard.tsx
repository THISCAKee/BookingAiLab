"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  filterDashboardMachines,
  summarizeDashboardMachines,
  type DashboardFilter,
} from "@/lib/machines/dashboard-view";
import type { MachineDashboardRow, TimelockSyncHealth } from "@/lib/machines/queries";

const sessionLabels = {
  logged_in: "กำลัง Login",
  idle: "พักหน้าจอ",
  logged_out: "ยังไม่ได้ Login",
} as const;

const machineLabels: Record<string, string> = {
  available: "พร้อมใช้งาน",
  maintenance: "ซ่อมบำรุง",
  inactive: "ยังไม่เปิดใช้",
  disabled: "ปิดการใช้งาน",
};

function formatTime(value: string | null) {
  if (!value) return "ยังไม่มีข้อมูล";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function connectionTone(machine: MachineDashboardRow) {
  if (machine.operationalStatus === "offline") {
    return { dot: "bg-slate-400", label: "Offline", labelTone: "bg-slate-100 text-slate-600 ring-slate-200" };
  }
  if (machine.operationalStatus === "active") {
    return { dot: "bg-emerald-500", label: "Active", labelTone: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  }
  return { dot: "bg-amber-500", label: "Online", labelTone: "bg-amber-50 text-amber-800 ring-amber-200" };
}

const filterCards: Array<{ key: DashboardFilter; label: string; countKey: "all" | "online" | "active" | "offline"; dot: string }> = [
  { key: "all", label: "เครื่องทั้งหมด", countKey: "all", dot: "bg-[#171717]" },
  { key: "online", label: "กำลัง Online", countKey: "online", dot: "bg-amber-500" },
  { key: "active", label: "กำลังใช้งาน", countKey: "active", dot: "bg-emerald-500" },
  { key: "offline", label: "Offline", countKey: "offline", dot: "bg-slate-400" },
];

export function MachineDashboard({ machines, syncHealth }: { machines: MachineDashboardRow[]; syncHealth: TimelockSyncHealth | null }) {
  const router = useRouter();
  const [filter, setFilter] = useState<DashboardFilter>("all");

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [router]);

  const counts = summarizeDashboardMachines(machines);
  const visibleMachines = filterDashboardMachines(machines, filter);

  return (
    <section className="mt-8 pb-12">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="ตัวกรองสถานะเครื่อง">
        {filterCards.map((item) => {
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(item.key)}
              className={`admin-filter rounded-2xl border-2 p-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 sm:p-5 ${active ? "border-[#171717] bg-[#fffbea]" : "border-slate-200 bg-white hover:border-slate-300"}`}
            >
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-600 sm:text-sm">
                <span className={`h-2 w-2 rounded-full ${item.dot}`} aria-hidden="true" />
                {item.label}
              </p>
              <p className="font-display mt-2 text-2xl font-semibold tabular-nums sm:text-3xl text-[#171717]">{counts[item.countKey]}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">เครื่องในห้อง</h2>
          <p className="mt-1 text-sm text-slate-600">
            แสดง {visibleMachines.length} จาก {machines.length} เครื่อง
            <span className="text-slate-400"> · รีเฟรชอัตโนมัติทุก 15 วินาที</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-full bg-slate-50 px-3 py-1.5 ring-1 ring-inset ring-slate-200">Google Sheet: <strong className={syncHealth?.lastError ? "text-rose-600" : "text-[#171717]"}>{syncHealth?.lastError ? "Sync มีปัญหา" : syncHealth?.lastSuccessAt ? formatTime(syncHealth.lastSuccessAt) : "ยังไม่เคย Sync"}</strong></span>
          <span className="rounded-full bg-slate-50 px-3 py-1.5 ring-1 ring-inset ring-slate-200">บัญชีล่าสุด: <strong className="text-[#171717]">{syncHealth?.syncedRowCount ?? 0}</strong></span>
          <span className="rounded-full bg-slate-50 px-3 py-1.5 ring-1 ring-inset ring-slate-200">รอเขียนกลับ: <strong className={syncHealth?.pendingOutboxCount ? "text-amber-700" : "text-[#171717]"}>{syncHealth?.pendingOutboxCount ?? 0}</strong></span>
        </div>
      </div>

      {visibleMachines.length > 0 ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visibleMachines.map((machine) => {
            const tone = connectionTone(machine);
            return (
              <article key={machine.id} className="admin-glass card-tilt flex flex-col rounded-2xl border-2 border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-[#171717]" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-semibold leading-tight">{machine.machineCode}</h3>
                      <p className="text-xs text-slate-500">{machine.machineName} · {machine.location ?? "ยังไม่ระบุตำแหน่ง"}</p>
                    </div>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tone.labelTone}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
                    {tone.label}
                  </span>
                </div>

                <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">Session</p>
                  <p className="mt-0.5 font-semibold">{sessionLabels[machine.sessionStatus]}</p>
                  {machine.username ? <p className="mt-0.5 truncate text-xs text-amber-700" title={machine.username}>{machine.username}</p> : null}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-slate-500">Last heartbeat</dt>
                    <dd className="mt-0.5 font-medium text-slate-700">{formatTime(machine.lastSeenAt)}</dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-slate-500">Machine status</dt>
                    <dd className="mt-0.5 font-medium text-slate-700">{machineLabels[machine.machineStatus] ?? machine.machineStatus}</dd>
                  </div>
                </dl>

                <p className={`mt-4 border-t border-slate-100 pt-4 text-xs ${machine.booking ? "font-semibold text-[#171717]" : "text-slate-500"}`}>
                  {machine.booking ? <>Booking · {machine.booking.bookingNumber}</> : "ไม่มีรายการจองที่กำลังใช้งาน"}
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="admin-glass mt-5 grid min-h-56 place-items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 text-center">
          <div><p className="font-display font-semibold text-slate-700">ไม่พบเครื่องในสถานะนี้</p><p className="mt-1 text-sm text-slate-500">เลือกตัวกรองอื่นเพื่อดูเครื่องทั้งหมด</p></div>
        </div>
      )}
    </section>
  );
}
