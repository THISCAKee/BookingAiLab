import { ManageBookingForm } from "@/components/booking/manage-booking-form";
import { PublicBookingNav } from "@/components/booking/public-booking-nav";
import { PageHeader } from "@/components/ui/page-header";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";

export default async function MyBookingsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).myBookings;
  return (
    <main className="min-h-screen bg-white text-[#171717]">
      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <PublicBookingNav locale={locale} />
        <PageHeader
          eyebrow={t.eyebrow}
          title={t.title}
          description={t.description}
        />
        <ManageBookingForm locale={locale} />
      </div>
    </main>
  );
}
