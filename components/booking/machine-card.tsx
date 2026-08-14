"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { bookMachineAction, type BookingFormState } from "@/app/booking/actions";
import type { Machine } from "@/lib/booking/queries";

const initialState: BookingFormState = { ok: false };

export function MachineCard({ machine }: { machine: Machine }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(bookMachineAction, initialState);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [router, state.ok]);

  return (
    <article className="group relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:border-amber-300">
      <div className="absolute right-5 top-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
        ว่าง
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
        {machine.machine_code}
      </p>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
        {machine.machine_name}
      </h2>
      <p className="mt-2 min-h-6 text-sm text-slate-500">
        {machine.location || "พื้นที่ห้องปฏิบัติการ"}
      </p>
      <div className="my-6 border-t border-dashed border-slate-200" />
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-400">รอบการใช้งาน</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">3 ชั่วโมง</p>
        </div>
        <form action={formAction}>
          <input type="hidden" name="machineId" value={machine.id} />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-500 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-amber-200 disabled:cursor-wait disabled:opacity-60"
          >
            {isPending ? "กำลังจอง..." : "จองเครื่องนี้"}
          </button>
        </form>
      </div>
      {state.message ? (
        <p
          className={`mt-4 rounded-xl px-3 py-2 text-sm ${
            state.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
          }`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </article>
  );
}
