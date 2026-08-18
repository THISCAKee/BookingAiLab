"use client";

import { useActionState } from "react";
import { adminCancelBookingAction } from "@/app/admin/bookings/actions";

export function AdminCancelBookingButton({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(adminCancelBookingAction, { ok: false });
  return <form action={action}><input type="hidden" name="bookingId" value={bookingId} /><button disabled={pending} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-600 hover:text-white disabled:opacity-50">{pending ? "กำลังยกเลิก…" : "ยกเลิก"}</button>{state.message ? <p className={`mt-2 text-xs ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p> : null}</form>;
}
