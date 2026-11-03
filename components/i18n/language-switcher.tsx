import { setLocaleAction } from "@/lib/i18n/actions";
import { getDictionary, locales, type Locale } from "@/lib/i18n/dictionaries";

const labels: Record<Locale, string> = { th: "TH", en: "EN" };

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  return (
    <form action={setLocaleAction} role="group" aria-label={getDictionary(locale).nav.language} className="language-switcher relative inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold" data-locale={locale}>
      <span className="language-switcher-indicator" aria-hidden="true" />
      {locales.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="submit"
            name="locale"
            value={option}
            lang={option}
            aria-pressed={active}
            className={`language-switcher-button relative z-10 rounded-full px-3 py-1.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100 ${active ? "text-white" : "text-slate-600 hover:text-[#171717]"}`}
          >
            {labels[option]}
          </button>
        );
      })}
    </form>
  );
}
