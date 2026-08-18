import Link from "next/link";
import { ManageBookingForm } from "@/components/booking/manage-booking-form";

export default function MyBookingsPage() {
  return (
    <main className="min-h-screen bg-[#f4f6f8] text-slate-950">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <nav className="flex items-center justify-between"><Link href="/" className="text-sm font-bold tracking-[0.2em]">BOOKING<span className="text-amber-500">AI</span>LAB</Link><Link href="/booking" className="text-sm font-semibold text-slate-500 hover:text-slate-950">กลับไปจองเครื่อง</Link></nav>
        <header className="mt-16 max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-600">SELF SERVICE</p><h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">จัดการการจอง</h1><p className="mt-5 leading-8 text-slate-600">ใช้เลขที่การจองและรหัสจัดการ 12 ตัวที่ได้รับหลังจอง เพื่อตรวจสอบรายละเอียดหรือยกเลิกก่อนเวลาเริ่ม</p></header>
        <ManageBookingForm />
      </div>
    </main>
  );
}
