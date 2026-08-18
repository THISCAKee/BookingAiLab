import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";

export function AdminNav() {
  return <nav className="flex flex-wrap items-center justify-between gap-4"><Link href="/admin/dashboard" className="text-sm font-bold tracking-[0.2em]">BOOKING<span className="text-amber-500">AI</span>LAB <span className="text-slate-400">/ ADMIN</span></Link><div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-500"><Link href="/admin/dashboard" className="hover:text-slate-950">Dashboard</Link><Link href="/admin/bookings" className="hover:text-slate-950">รายการจอง</Link><Link href="/admin/machines" className="hover:text-slate-950">เครื่อง</Link><Link href="/admin/settings" className="hover:text-slate-950">ตั้งค่า</Link><LogoutButton redirectTo="/admin" /></div></nav>;
}
