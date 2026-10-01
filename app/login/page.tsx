import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";
import { LoginButton } from "./login-button";

const errorMessages: Record<string, string> = {
  oauth: "ไม่สามารถเริ่มการเข้าสู่ระบบด้วย Google ได้ กรุณาลองใหม่",
  callback: "การเข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main
      className="login-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 py-10 sm:px-8"
      data-testid="login-shell"
      data-theme="light-signal"
    >
      <section className="login-card w-full max-w-[26rem]">
        <div className="flex justify-center text-[#1f2937]">
          <BrandMark />
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.4)] sm:p-8">
          <header className="text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              MSU AI Lab
            </p>
            <h1 className="font-display mt-4 text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-[#1f2937] sm:text-3xl">
              เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัย
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              เข้าใช้เพื่อจองเครื่องคอมพิวเตอร์และจัดการรายการจองของคุณ
            </p>
          </header>

          {error && errorMessages[error] ? (
            <div className="login-error mt-6 flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm leading-6" role="alert">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose-100 text-xs font-bold text-rose-700" aria-hidden="true">!</span>
              <p>{errorMessages[error]}</p>
            </div>
          ) : null}

          <div className="mt-6">
            <LoginButton />
          </div>

          <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
            <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#171717] text-[10px] font-bold text-[#facc15]" aria-hidden="true">@</span>
            <span>ใช้บัญชี Google ของมหาวิทยาลัยมหาสารคามที่ลงท้ายด้วย <strong className="font-semibold text-[#1f2937]">@msu.ac.th</strong></span>
          </p>
        </div>

        <Link href="/" className="mt-6 block text-center text-sm font-semibold text-slate-500 transition hover:text-[#1f2937] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100">
          ← กลับหน้าหลัก
        </Link>
      </section>
    </main>
  );
}
