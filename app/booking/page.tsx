import { PublicBookingBoard } from "@/components/booking/public-booking-board";
import { PublicBookingNav } from "@/components/booking/public-booking-nav";
import { PageHeader } from "@/components/ui/page-header";
import { getPublicBookingOptions, type PublicBookingOptions } from "@/lib/booking/actions";
import { getSelectableBookingDates } from "@/lib/booking/schedule";

export const dynamic = "force-dynamic";

export default async function BookingPage() {
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
    <main className="min-h-screen bg-white text-[#0b1324]">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <PublicBookingNav />

        <PageHeader
          eyebrow="MSU AI Lab · Workstation Booking"
          title={<>จองเครื่องใน <span className="text-amber-600">AI Lab</span></>}
          description="เลือกเครื่องที่ว่าง กดยืนยัน แล้วนำ User และ Password ไป login ที่เครื่อง ใช้งานได้รอบละ 3 ชั่วโมง"
        />

        <PublicBookingBoard initialOptions={options} initialMessage={initial.ok ? undefined : initial.message} />
      </div>
    </main>
  );
}
