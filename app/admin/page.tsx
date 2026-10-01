import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { BrandMark } from "@/components/ui/brand-mark";
import { requireAdminIdentity } from "@/lib/auth/identity";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  try {
    await requireAdminIdentity();
    redirect("/admin/dashboard");
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
  }

  const errorMessages: Record<string, string> = {
    credentials: "Username หรือ Password ไม่ถูกต้อง",
    config: "ยังไม่ได้ตั้งค่า ADMIN_PASSWORD ในระบบ",
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-10 text-[#171717] sm:px-8">
      <section className="w-full max-w-[26rem]">
        <div className="flex justify-center">
          <BrandMark caption="Control room" />
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.4)] sm:p-8">
          <p className="inline-flex items-center gap-2 rounded-full bg-[#171717] px-3 py-1 text-xs font-semibold text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-[#facc15]" aria-hidden="true" />
            Admin access
          </p>
          <h1 className="font-display mt-4 text-3xl font-semibold tracking-[-0.03em]">เข้าสู่ระบบผู้ดูแล</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">กรอก Username และ Password สำหรับผู้ดูแลระบบ</p>
          {error && errorMessages[error] ? <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{errorMessages[error]}</p> : null}

          <AdminLoginForm />
        </div>

        <Link href="/booking" className="mt-6 block text-center text-sm font-semibold text-slate-500 transition hover:text-[#171717] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100">
          ← กลับหน้าจองเครื่อง
        </Link>
      </section>
    </main>
  );
}
