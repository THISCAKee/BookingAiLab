import Link from "next/link";
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
      className="login-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-5 py-10 sm:px-8"
      data-testid="login-shell"
      data-theme="light-signal"
    >
      <section className="login-card relative w-full max-w-[27rem] overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_-28px_rgba(55,65,81,0.28)]">
        <div className="login-accent-bar" aria-hidden="true" />
        <div className="p-7 sm:p-9">
          <header className="text-center">
            <div className="flex items-center justify-center gap-2.5">
              <span className="login-logo-mark" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <p className="font-display text-sm font-bold tracking-[0.16em] text-[#1f2937]">
                BOOKING<span className="text-[#facc15]">AI</span>LAB
              </p>
            </div>
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.22em] text-[#facc15]">
              MSU COMPUTER LAB
            </p>
            <h1 className="font-display mt-3 text-[2rem] font-semibold leading-tight tracking-[-0.035em] text-[#1f2937] sm:text-[2.15rem]">
              เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัย
            </h1>
            <p className="mt-4 text-[0.95rem] leading-7 text-slate-600">
              เข้าใช้เพื่อจองเครื่องคอมพิวเตอร์และจัดการรายการจองของคุณ
            </p>
          </header>

        {error && errorMessages[error] ? (
          <div className="login-error mt-6 flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm leading-6" role="alert">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose-100 font-bold text-rose-700" aria-hidden="true">
              !
            </span>
            <p>{errorMessages[error]}</p>
          </div>
        ) : null}

          <div className="login-access-note login-access-note--light mt-7 flex items-start gap-3 rounded-2xl px-4 py-3.5">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-yellow-300/15 text-xs font-bold text-[#facc15]" aria-hidden="true">
              @
            </span>
            <p className="text-sm leading-6 text-amber-950">
              ใช้บัญชี Google ของมหาวิทยาลัยมหาสารคามที่ลงท้ายด้วย <strong className="font-bold text-[#facc15]">@msu.ac.th</strong>
            </p>
          </div>

          <div className="mt-5">
            <LoginButton />
          </div>

          <div className="mt-7 flex items-center gap-3 text-xs text-slate-400" aria-hidden="true">
            <span className="h-px flex-1 bg-slate-200" />
            <span>ปลอดภัยด้วย Google</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <Link href="/" className="mt-6 block text-center text-sm font-semibold text-slate-400 transition hover:text-[#facc15] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-200/40">
            กลับหน้าหลัก
          </Link>
        </div>
      </section>
    </main>
  );
}
