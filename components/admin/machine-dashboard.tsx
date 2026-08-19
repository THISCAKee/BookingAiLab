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
    return { rail: "bg-slate-300", dot: "bg-slate-300", label: "Offline", labelTone: "bg-slate-100 text-slate-600" };
  }
  if (machine.operationalStatus === "active") {
    return { rail: "bg-[#16a34a]", dot: "bg-[#16a34a]", label: "Active", labelTone: "bg-emerald-50 text-emerald-700" };
  }
  return { rail: "bg-[#06b6d4]", dot: "bg-[#06b6d4]", label: "Online", labelTone: "bg-cyan-50 text-cyan-700" };
}

const filterCards: Array<{ key: DashboardFilter; label: string; countKey: "all" | "online" | "active" | "offline"; dot: string }> = [
  { key: "all", label: "เครื่องทั้งหมด", countKey: "all", dot: "bg-[#2563eb]" },
  { key: "online", label: "กำลัง Online", countKey: "online", dot: "bg-[#06b6d4]" },
  { key: "active", label: "กำลังใช้งาน", countKey: "active", dot: "bg-[#16a34a]" },
  { key: "offline", label: "Offline", countKey: "offline", dot: "bg-slate-300" },
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
    <section className="mt-7 pb-12">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="ตัวกรองสถานะเครื่อง">
        {filterCards.map((item) => {
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(item.key)}
              className={`group rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 sm:p-5 ${active ? "border-[#0b1324] bg-[#0b1324] text-white shadow-lg" : "border-slate-200 bg-white text-[#0b1324] hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} aria-hidden="true" />
                <span className={`font-display text-3xl font-semibold tabular-nums ${active ? "text-white" : "text-[#0b1324]"}`}>{counts[item.countKey]}</span>
              </div>
              <p className={`mt-3 text-xs font-semibold sm:text-sm ${active ? "text-slate-300" : "text-slate-500"}`}>{item.label}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
        <div>
          <h2 className="font-display font-semibold">Workstation live view</h2>
          <p className="mt-1 text-xs text-slate-500">แสดง {visibleMachines.length} จาก {machines.length} เครื่อง</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#16a34a]" aria-hidden="true" />
          รีเฟรชอัตโนมัติทุก 15 วินาที
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 text-xs text-slate-500">
        <span>Google Sheet: <strong className={syncHealth?.lastError ? "text-rose-600" : "text-slate-700"}>{syncHealth?.lastError ? "Sync มีปัญหา" : syncHealth?.lastSuccessAt ? formatTime(syncHealth.lastSuccessAt) : "ยังไม่เคย Sync"}</strong></span>
        <span>บัญชีล่าสุด: <strong className="text-slate-700">{syncHealth?.syncedRowCount ?? 0}</strong></span>
        <span>รอเขียนกลับ: <strong className={syncHealth?.pendingOutboxCount ? "text-amber-600" : "text-slate-700"}>{syncHealth?.pendingOutboxCount ?? 0}</strong></span>
      </div>

      {visibleMachines.length > 0 ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleMachines.map((machine) => {
            const tone = connectionTone(machine);
            const machineNumber = machine.machineCode.match(/\d+/)?.[0]?.padStart(2, "0") ?? "--";
            return (
              <article key={machine.id} className="group relative min-h-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_55px_-48px_rgba(11,19,36,0.8)] transition hover:-translate-y-0.5 hover:shadow-lg sm:p-6">
                <span className={`absolute inset-x-0 top-0 h-1 ${tone.rail}`} aria-hidden="true" />

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-xs font-bold uppercase tracking-[0.15em] text-slate-500">{machine.machineCode}</p>
                    <h3 className="mt-1 font-semibold text-[#0b1324]">{machine.machineName}</h3>
                    <p className="mt-1 text-xs text-slate-400">{machine.location ?? "ยังไม่ระบุตำแหน่ง"}</p>
                  </div>
                  <span className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${tone.labelTone}`}>
                    <span className={`h-2 w-2 rounded-full ${tone.dot}`} aria-hidden="true" />
                    {tone.label}
                  </span>
                </div>

                <div className="mt-7 flex items-end justify-between border-b border-slate-100 pb-6">
                  <p className="font-display text-7xl font-semibold leading-none tracking-[-0.09em] text-slate-100 transition group-hover:text-blue-50" aria-hidden="true">{machineNumber}</p>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Session</p>
                    <p className="mt-1 font-semibold text-[#0b1324]">{sessionLabels[machine.sessionStatus]}</p>
                    {machine.username ? <p className="mt-1 max-w-44 truncate text-xs text-[#2563eb]" title={machine.username}>{machine.username}</p> : null}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Last heartbeat</p>
                    <p className="mt-1 text-xs font-medium text-slate-600">{formatTime(machine.lastSeenAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Machine status</p>
                    <p className="mt-1 text-xs font-medium text-slate-600">{machineLabels[machine.machineStatus] ?? machine.machineStatus}</p>
                  </div>
                </div>

                <div className={`mt-5 rounded-xl px-3.5 py-3 text-xs ${machine.booking ? "bg-blue-50 text-blue-800" : "bg-slate-50 text-slate-500"}`}>
                  {machine.booking ? <><span className="font-semibold">Booking</span><span className="mx-2 text-blue-300">·</span>{machine.booking.bookingNumber}</> : "ไม่มีรายการจองที่กำลังใช้งาน"}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 grid min-h-56 place-items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center">
          <div><p className="font-display font-semibold text-slate-700">ไม่พบเครื่องในสถานะนี้</p><p className="mt-1 text-sm text-slate-500">เลือกตัวกรองอื่นเพื่อดูเครื่องทั้งหมด</p></div>
        </div>
      )}
    </section>
  );
}
