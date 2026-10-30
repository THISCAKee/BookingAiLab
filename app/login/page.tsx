import Link from "next/link";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { BrandMark } from "@/components/ui/brand-mark";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { LoginButton } from "./login-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale).login;

  return (
    <main
      className="login-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-8"
      data-testid="login-shell"
      data-theme="light-signal"
    >
      <section className="login-card w-full max-w-[52rem]">
        <div className="login-panel">
          <div className="login-header flex items-center justify-between gap-3">
            <BrandMark />
            <LanguageSwitcher locale={locale} />
          </div>

          <div className="login-content mt-8">
            <header className="text-center">
              <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-[#1f2937] sm:text-3xl">
                {t.title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {t.description}
              </p>
            </header>

            {error && t.errors[error] ? (
              <div className="login-error mt-6 flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm leading-6" role="alert">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose-100 text-xs font-bold text-rose-700" aria-hidden="true">!</span>
                <p>{t.errors[error]}</p>
              </div>
            ) : null}

            <div className="mt-6">
              <LoginButton label={t.button} connectingLabel={t.connecting} />
            </div>

            <p className="login-domain-note mt-4 rounded-xl px-4 py-3 text-xs leading-5">
              {t.domainNote} <strong className="font-semibold text-[#1f2937]">@msu.ac.th</strong>
            </p>

            <section className="login-guide mt-7 border-t border-slate-200/80 pt-6" aria-labelledby="login-guide-title">
              <h2 id="login-guide-title" className="login-guide-title font-display text-base font-semibold text-[#1f2937]">
                {t.guideTitle}
              </h2>
              <ol className="login-guide-steps mt-4 grid gap-2">
                {t.guideSteps.map((step, index) => (
                  <li key={step} className="login-guide-step flex items-start gap-3 rounded-2xl px-3 py-3 text-sm leading-6">
                    <span className="login-guide-number grid h-8 w-8 shrink-0 place-items-center rounded-full border border-amber-200 bg-amber-50 text-sm font-bold text-amber-700" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>

        <Link href="/" className="login-back-link mt-6 block text-center text-sm font-semibold text-slate-500 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100">
          {t.back}
        </Link>
      </section>
    </main>
  );
}
