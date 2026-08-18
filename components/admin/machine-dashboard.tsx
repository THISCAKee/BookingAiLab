"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MachineDashboardRow } from "@/lib/machines/queries";

const sessionLabels = {
  logged_in: "กำลัง Login",
  idle: "พักหน้าจอ",
  logged_out: "ยังไม่ได้ Login",
} as const;

const connectionLabels = {
  online: "Online",
  stale: "Offline / Stale",
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

function statusTone(machine: MachineDashboardRow) {
  if (machine.connectionStatus === "stale") return "border-slate-200 bg-slate-50";
  if (machine.sessionStatus === "logged_in") return "border-emerald-200 bg-emerald-50/70";
  return "border-amber-200 bg-amber-50/70";
}

export function MachineDashboard({ machines }: { machines: MachineDashboardRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [router]);

  const counts = useMemo(
    () => ({
      all: machines.length,
      online: machines.filter((machine) => machine.connectionStatus === "online").length,
      loggedIn: machines.filter((machine) => machine.sessionStatus === "logged_in").length,
      stale: machines.filter((machine) => machine.connectionStatus === "stale").length,
    }),
    [machines],
  );

  const visibleMachines = machines.filter((machine) => {
    if (filter === "online") return machine.connectionStatus === "online";
    if (filter === "logged_in") return machine.sessionStatus === "logged_in";
    if (filter === "stale") return machine.connectionStatus === "stale";
    return true;
  });

  return (
    <div className="mt-10">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["all", "เครื่องทั้งหมด", counts.all, "bg-slate-950 text-white"],
          ["online", "กำลัง Online", counts.online, "bg-white text-slate-950"],
          ["logged_in", "กำลัง Login", counts.loggedIn, "bg-emerald-50 text-emerald-950"],
          ["stale", "Offline / Stale", counts.stale, "bg-white text-slate-950"],
        ].map(([key, label, count, tone]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(String(key))}
            className={`rounded-2xl border border-slate-200 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone} ${filter === key ? "ring-2 ring-amber-400 ring-offset-2" : ""}`}
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-65">{label}</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums">{count}</p>
          </button>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="font-semibold text-slate-950">สถานะเครื่องแบบสด</h2>
            <p className="mt-1 text-sm text-slate-500">ระบบรีเฟรชอัตโนมัติทุก 15 วินาที</p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            รับข้อมูลจาก TimeLockApp
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {visibleMachines.length > 0 ? visibleMachines.map((machine) => (
            <article key={machine.id} className={`grid gap-5 px-6 py-5 lg:grid-cols-[1.3fr_1fr_1fr_auto] lg:items-center ${statusTone(machine)}`}>
              <div>
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${machine.connectionStatus === "online" ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <h3 className="font-semibold text-slate-950">{machine.machineCode}</h3>
                  <span className="text-xs font-medium text-slate-500">{machineLabels[machine.machineStatus] ?? machine.machineStatus}</span>
                </div>
                <p className="mt-1 pl-6 text-sm text-slate-600">{machine.machineName}{machine.location ? ` · ${machine.location}` : ""}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Session</p>
                <p className="mt-1 font-semibold text-slate-800">{sessionLabels[machine.sessionStatus]}</p>
                {machine.username ? <p className="mt-1 text-sm text-slate-600">{machine.username}</p> : null}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Heartbeat</p>
                <p className="mt-1 font-semibold text-slate-800">{connectionLabels[machine.connectionStatus]}</p>
                <p className="mt-1 text-xs text-slate-500">{formatTime(machine.lastSeenAt)}</p>
              </div>
              <div className="text-left lg:text-right">
                {machine.booking ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Booking</p>
                    <p className="mt-1 font-semibold text-slate-800">{machine.booking.bookingNumber}</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">ยังไม่มี Booking</p>
                )}
              </div>
            </article>
          )) : (
            <div className="px-6 py-16 text-center text-sm text-slate-500">ไม่พบเครื่องตามตัวกรองนี้</div>
          )}
        </div>
      </div>
    </div>
  );
}
