import Link from "next/link";

export function PublicBookingNav() {
  return (
    <nav className="flex items-center justify-between gap-4" aria-label="เมนูหลัก">
      <Link href="/" className="group inline-flex items-center gap-3 text-[#0b1324]">
        <span className="grid h-9 w-9 grid-cols-2 gap-0.5 rounded-xl bg-[#0b1324] p-2" aria-hidden="true">
          <span className="rounded-sm bg-white" />
          <span className="rounded-sm bg-[#06b6d4]" />
          <span className="rounded-sm bg-[#2563eb]" />
          <span className="rounded-sm bg-white" />
        </span>
        <span className="font-display text-sm font-bold tracking-[0.16em] sm:text-base">
          BOOKING<span className="text-[#2563eb]">AI</span>LAB
        </span>
      </Link>
      <Link
        href="/my-bookings"
        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-[#2563eb]/30 hover:text-[#2563eb] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
      >
        จัดการการจอง
      </Link>
    </nav>
  );
}
