import { PublicBookingBoard } from "@/components/booking/public-booking-board";
import { PublicBookingNav } from "@/components/booking/public-booking-nav";
import { PageHeader } from "@/components/ui/page-header";
import { getPublicBookingOptions, type PublicBookingOptions } from "@/lib/booking/actions";
import { getSelectableBookingDates } from "@/lib/booking/schedule";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

export default async function BookingPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).bookingPage;
  const dates = getSelectableBookingDates();
  const initial = await getPublicBookingOptions(dates[0].value);
  const options: PublicBookingOptions = initial.ok
    ? initial.data
    : {
        date: dates[0].value,
        viewerCanBook: false,
        viewerBlockReason: null,
        viewerBookingEndAt: null,
        viewerBookingStarted: false,
        machines: [],
      };

  return (
    <main className="booking-shell min-h-screen bg-white text-[#0b1324]">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <PublicBookingNav locale={locale} />

        <PageHeader
          eyebrow={t.eyebrow}
          title={<>{t.titlePrefix} <span className="text-amber-600">AI CORNER</span></>}
          description={t.description}
        />

        <PublicBookingBoard initialOptions={options} initialMessage={initial.ok ? undefined : initial.message} locale={locale} />
      </div>
    </main>
  );
}
