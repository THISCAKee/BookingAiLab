import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-10 text-[#171717]">
      <section className="w-full max-w-md">
        <div className="flex justify-center">
          <BrandMark />
        </div>
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-[0_24px_60px_-36px_rgba(15,23,42,0.4)] sm:p-8">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-xl font-bold text-rose-600 ring-1 ring-inset ring-rose-100" aria-hidden="true">!</span>
          <p className="mt-5 text-sm font-semibold text-rose-600">ไม่สามารถเข้าสู่ระบบได้</p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-[-0.03em]">ต้องใช้บัญชีมหาวิทยาลัย</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            ระบบอนุญาตเฉพาะบัญชี Google ที่ลงท้ายด้วย <strong className="font-semibold text-[#171717]">@msu.ac.th</strong> เท่านั้น
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex w-full justify-center rounded-xl bg-[#facc15] px-5 py-3.5 font-semibold text-[#171717] transition hover:bg-[#eab308] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
          >
            กลับไปเข้าสู่ระบบ
          </Link>
        </div>
      </section>
    </main>
  );
}
