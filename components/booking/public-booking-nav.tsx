import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";

export function PublicBookingNav() {
  return (
    <nav className="flex items-center justify-between gap-4" aria-label="เมนูหลัก">
      <Link href="/booking" className="text-[#171717] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100">
        <BrandMark />
      </Link>
      <Link
        href="/my-bookings"
        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#171717] hover:text-[#171717] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100"
      >
        ข้อมูลการจอง
      </Link>
    </nav>
  );
}
