"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { BrandMark } from "@/components/ui/brand-mark";

const navigation = [
  { href: "/admin/dashboard/overview", label: "แดชบอร์ด" },
  { href: "/admin/dashboard", label: "ภาพรวมห้อง" },
  { href: "/admin/bookings", label: "รายการจอง" },
  { href: "/admin/machines", label: "จัดการเครื่อง" },
  { href: "/admin/settings", label: "ตั้งค่า" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="เมนูผู้ดูแลระบบ">
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin/dashboard" className="min-w-0 text-[#171717] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100">
          <BrandMark caption="Control room" />
        </Link>

        <div className="hidden items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 lg:flex">
          {navigation.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100 ${active ? "bg-[#171717] text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-[#171717]"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <LogoutButton redirectTo="/admin" />
      </div>

      <div className="admin-nav-scroll mt-4 flex gap-1 overflow-x-auto rounded-full border border-slate-200 bg-slate-50 p-1 lg:hidden">
        {navigation.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${active ? "bg-[#171717] text-white" : "text-slate-600 hover:bg-white"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
