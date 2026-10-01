import Link from "next/link";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { BrandMark } from "@/components/ui/brand-mark";
import { defaultLocale, getDictionary, type Locale } from "@/lib/i18n/dictionaries";

export function PublicBookingNav({ locale = defaultLocale }: { locale?: Locale }) {
  const t = getDictionary(locale).nav;
  return (
    <nav className="flex items-center justify-between gap-3" aria-label={t.mainMenu}>
      <Link href="/booking" className="text-[#171717] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100">
        <BrandMark />
      </Link>
      <div className="flex items-center gap-2">
        <LanguageSwitcher locale={locale} />
        <Link
          href="/my-bookings"
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#171717] hover:text-[#171717] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100"
        >
          {t.myBookings}
        </Link>
      </div>
    </nav>
  );
}
