import { ManageBookingForm } from "@/components/booking/manage-booking-form";
import { PublicBookingNav } from "@/components/booking/public-booking-nav";
import { PageHeader } from "@/components/ui/page-header";

export default function MyBookingsPage() {
  return (
    <main className="min-h-screen bg-white text-[#171717]">
      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <PublicBookingNav />
        <PageHeader
          eyebrow="Booking Information"
          title="ข้อมูลการจอง"
          description="ดู User และ Password สำหรับ TimeLock หรือยกเลิกการจองที่ยังไม่เริ่มใช้งานได้ที่นี่"
        />
        <ManageBookingForm />
      </div>
    </main>
  );
}
