"use server";

import {
  getViewerBookings,
  cancelViewerBooking,
} from "@/lib/booking/actions";

export async function loadMyBookingsAction() {
  return getViewerBookings();
}

export async function cancelMyBookingAction(bookingId: string) {
  return cancelViewerBooking(bookingId);
}
