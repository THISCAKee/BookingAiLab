"use client";

import { useActionState } from "react";
import { adminCancelBookingAction } from "@/app/admin/bookings/actions";

export function AdminCancelBookingButton({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(adminCancelBookingAction, { ok: false });
  return <form action={action}><input type="hidden" name="bookingId" value={bookingId} /><button disabled={pending} className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 disabled:opacity-50">{pending ? "กำลังยกเลิก…" : "ยกเลิก"}</button>{state.message ? <p className={`mt-2 text-xs ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p> : null}</form>;
}
