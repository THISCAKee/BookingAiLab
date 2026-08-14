"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  cancelBookingAction,
  type CancelFormState,
} from "@/app/my-bookings/actions";

const labels: Record<string, string> = {
  confirmed: "กำลังรอใช้งาน",
  app_pending: "กำลังส่งข้อมูลไปยังเครื่อง",
  app_received: "เครื่องได้รับข้อมูลแล้ว",
  active: "กำลังใช้งาน",
  completed: "ใช้งานเสร็จแล้ว",
  cancelled: "ยกเลิกแล้ว",
  expired: "หมดเวลาเนื่องจากไม่เริ่มใช้งาน",
};

const initialState: CancelFormState = { ok: false };

export function BookingStatus({ bookingId, status }: { bookingId: string; status: string }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(cancelBookingAction, initialState);
  const canCancel = status === "confirmed" || status === "app_pending";

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [router, state.ok]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
        {labels[status] || status}
      </span>
      {canCancel ? (
        <form action={formAction}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <button
            type="submit"
            disabled={isPending}
            className="text-sm font-semibold text-rose-700 underline decoration-rose-200 underline-offset-4 hover:text-rose-900 disabled:opacity-50"
          >
            {isPending ? "กำลังยกเลิก..." : "ยกเลิกการจอง"}
          </button>
        </form>
      ) : null}
      {state.message ? (
        <p className={state.ok ? "w-full text-sm text-emerald-700" : "w-full text-sm text-rose-700"} role="status">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
