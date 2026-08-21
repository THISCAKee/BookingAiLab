import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { requireAdminIdentity } from "@/lib/auth/identity";

export default async function AdminLoginPage() {
  try {
    await requireAdminIdentity();
    redirect("/admin/dashboard");
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
  }

  return (
    <main className="min-h-screen bg-[#f3f6fa] px-4 py-5 text-[#0b1324] sm:px-7 sm:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_35px_90px_-58px_rgba(11,19,36,0.7)] sm:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#0b1324] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute inset-x-0 top-0 grid grid-cols-6 gap-px opacity-20" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} className={`h-1 ${index < 4 ? "bg-[#06b6d4]" : "bg-slate-600"}`} />
            ))}
          </div>

          <div>
            <Link href="/" className="inline-flex items-center gap-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/30">
              <span className="grid h-10 w-10 grid-cols-2 gap-0.5 rounded-xl bg-white p-2.5" aria-hidden="true">
                <span className="rounded-sm bg-[#0b1324]" />
                <span className="rounded-sm bg-[#06b6d4]" />
                <span className="rounded-sm bg-[#2563eb]" />
                <span className="rounded-sm bg-[#0b1324]" />
              </span>
              <span className="font-display text-sm font-bold tracking-[0.16em]">BOOKING<span className="text-cyan-300">AI</span>LAB</span>
            </Link>

            <p className="mt-20 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">MSU AI LAB · OPERATIONS</p>
            <p className="font-display mt-5 max-w-lg text-5xl font-semibold leading-[1.08] tracking-[-0.04em] xl:text-6xl">ห้องควบคุม<br />เครื่องคอมพิวเตอร์</p>
            <p className="mt-6 max-w-md text-sm leading-7 text-slate-300">ตรวจสถานะ TimeLockApp การเข้าสู่ระบบ และรายการจองของเครื่องทั้ง 6 ได้จากจุดเดียว</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {["LIVE STATUS", "6 WORKSTATIONS", "15S REFRESH"].map((label, index) => (
              <div key={label} className="border-t border-white/15 pt-4">
                <span className={`mb-3 block h-2 w-2 rounded-full ${index === 0 ? "bg-[#16a34a]" : "bg-[#06b6d4]"}`} />
                <p className="font-display text-[10px] font-semibold tracking-[0.12em] text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center px-6 py-12 sm:px-12 lg:px-14 xl:px-20">
          <div className="mx-auto w-full max-w-md">
            <div className="flex items-center gap-3 lg:hidden">
              <span className="grid h-9 w-9 grid-cols-2 gap-0.5 rounded-xl bg-[#0b1324] p-2" aria-hidden="true">
                <span className="rounded-sm bg-white" /><span className="rounded-sm bg-[#06b6d4]" /><span className="rounded-sm bg-[#2563eb]" /><span className="rounded-sm bg-white" />
              </span>
              <span className="font-display text-sm font-bold tracking-[0.14em]">BOOKING<span className="text-[#2563eb]">AI</span>LAB</span>
            </div>

            <div className="mt-12 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[#2563eb] lg:mt-0">
              <span className="h-px w-8 bg-[#2563eb]" aria-hidden="true" />
              Admin access
            </div>
            <h1 className="font-display mt-4 text-4xl font-semibold tracking-[-0.035em]">เข้าสู่ระบบผู้ดูแล</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">ใช้ชื่อผู้ใช้ <strong className="font-semibold text-[#0b1324]">admin</strong> และรหัสผ่านที่กำหนดไว้</p>

            <AdminLoginForm />

            <Link href="/booking" className="mt-7 inline-flex text-sm font-semibold text-slate-500 transition hover:text-[#2563eb] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
              ← กลับหน้าจองเครื่อง
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
