import type { SheetBooking } from "@/lib/google/sheet-types";
import type { MachineDashboardRow } from "@/lib/machines/queries";

export function summarizeAdminOverview(
  bookings: ReadonlyArray<Pick<SheetBooking, "status">>,
  machines: ReadonlyArray<Pick<MachineDashboardRow, "operationalStatus">>,
) {
  return {
    totalBookings: bookings.length,
    openBookings: bookings.filter(({ status }) => !["completed", "cancelled", "expired"].includes(status)).length,
    onlineMachines: machines.filter(({ operationalStatus }) => operationalStatus !== "offline").length,
    offlineMachines: machines.filter(({ operationalStatus }) => operationalStatus === "offline").length,
  };
}

/** Counts bookings created on each of the past seven Bangkok calendar days. */
export function bookingActivity(bookings: ReadonlyArray<Pick<SheetBooking, "createdAt">>, now = new Date()) {
  const dayMs = 86_400_000;
  const bangkokOffset = 7 * 60 * 60 * 1000;
  const today = Math.floor((now.getTime() + bangkokOffset) / dayMs);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = today - 6 + index;
    return { date: new Date(day * dayMs).toISOString().slice(0, 10), count: 0 };
  });
  for (const booking of bookings) {
    const timestamp = Date.parse(booking.createdAt);
    if (!Number.isFinite(timestamp)) continue;
    const index = Math.floor((timestamp + bangkokOffset) / dayMs) - today + 6;
    if (index >= 0 && index < days.length) days[index].count += 1;
  }
  return days;
}
