"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";

const navigation = [
  { href: "/admin/dashboard", label: "ภาพรวมห้อง" },
  { href: "/admin/bookings", label: "รายการจอง" },
  { href: "/admin/machines", label: "จัดการเครื่อง" },
  { href: "/admin/settings", label: "ตั้งค่า" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_50px_-42px_rgba(11,19,36,0.65)]" aria-label="เมนูผู้ดูแลระบบ">
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin/dashboard" className="flex shrink-0 items-center gap-3 rounded-xl px-2 py-2 text-[#0b1324] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
          <span className="grid h-9 w-9 grid-cols-2 gap-0.5 rounded-xl bg-[#0b1324] p-2" aria-hidden="true">
            <span className="rounded-sm bg-white" />
            <span className="rounded-sm bg-[#06b6d4]" />
            <span className="rounded-sm bg-[#2563eb]" />
            <span className="rounded-sm bg-white" />
          </span>
          <span className="hidden sm:block">
            <span className="font-display block text-sm font-bold tracking-[0.12em]">BOOKING<span className="text-[#2563eb]">AI</span>LAB</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Control room</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navigation.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${active ? "bg-[#0b1324] text-white" : "text-slate-500 hover:bg-slate-50 hover:text-[#0b1324]"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <LogoutButton redirectTo="/admin" />
      </div>

      <div className="mt-2 flex gap-1 overflow-x-auto border-t border-slate-100 pt-2 lg:hidden">
        {navigation.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${active ? "bg-[#0b1324] text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
