import Link from "next/link";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { BrandMark } from "@/components/ui/brand-mark";
import { defaultLocale, getDictionary, type Locale } from "@/lib/i18n/dictionaries";

export function PublicBookingNav({ locale = defaultLocale }: { locale?: Locale }) {
  const t = getDictionary(locale).nav;
  return (
    <nav className="booking-nav flex items-center justify-between gap-3" aria-label={t.mainMenu}>
      <Link href="/booking" className="min-w-0 text-[#171717] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100">
        <BrandMark />
      </Link>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <LanguageSwitcher locale={locale} />
        <Link
          href="/my-bookings"
          className="rounded-full border border-slate-200 bg-white whitespace-nowrap px-3 py-2 text-xs font-semibold text-slate-700 sm:px-4 sm:text-sm transition hover:border-[#171717] hover:text-[#171717] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-100"
        >
          {t.myBookings}
        </Link>
      </div>
    </nav>
  );
}
