import Link from "next/link";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { BrandMark } from "@/components/ui/brand-mark";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";

export default async function UnauthorizedPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).unauthorized;
  return (
    <main className="app-shell flex min-h-screen items-center justify-center bg-white px-4 py-10 text-[#171717]">
      <section className="w-full max-w-md">
        <div className="flex items-center justify-between gap-3">
          <BrandMark />
          <LanguageSwitcher locale={locale} />
        </div>
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-[0_24px_60px_-36px_rgba(15,23,42,0.4)] sm:p-8">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-xl font-bold text-rose-600 ring-1 ring-inset ring-rose-100" aria-hidden="true">!</span>
          <p className="mt-5 text-sm font-semibold text-rose-600">{t.kicker}</p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-[-0.03em]">{t.title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {t.bodyPrefix} <strong className="font-semibold text-[#171717]">@msu.ac.th</strong> {t.bodySuffix}
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex w-full justify-center rounded-xl bg-[#facc15] px-5 py-3.5 font-semibold text-[#171717] transition hover:bg-[#eab308] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
          >
            {t.back}
          </Link>
        </div>
      </section>
    </main>
  );
}
