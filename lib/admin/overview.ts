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
