"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  updateBookingSettingsAction,
  type SettingsFormState,
} from "@/app/admin/settings/actions";
import type { BookingSettings } from "@/lib/booking/settings";

const initialState: SettingsFormState = { ok: false };
const weekdays = [
  [1, "จันทร์"],
  [2, "อังคาร"],
  [3, "พุธ"],
  [4, "พฤหัสบดี"],
  [5, "ศุกร์"],
  [6, "เสาร์"],
  [7, "อาทิตย์"],
] as const;

export function BookingSettingsForm({
  settings,
  canEdit,
}: {
  settings: BookingSettings;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateBookingSettingsAction, initialState);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [router, state.ok]);

  return (
    <form action={formAction} className="space-y-8">
      <fieldset disabled={!canEdit || isPending} className="space-y-8 disabled:opacity-75">
        <div>
          <p className="font-display font-semibold">วันที่เปิดให้บริการ</p>
          <p className="mt-1 text-xs text-slate-500">Service days</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {weekdays.map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 has-[:checked]:border-[#171717] has-[:checked]:bg-[#fffbea] has-[:checked]:text-[#171717]">
                <input
                  type="checkbox"
                  name="serviceWeekdays"
                  value={value}
                  defaultChecked={settings.serviceWeekdays.includes(value)}
                  className="h-4 w-4 accent-[#171717]"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-5 border-t border-slate-100 pt-8 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-slate-700">
            เวลาเปิดบริการ
            <input name="openingTime" type="time" defaultValue={settings.openingTime} className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-[#171717] focus:ring-4 focus:ring-amber-100" />
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-700">
            เวลาปิดบริการ
            <input name="closingTime" type="time" defaultValue={settings.closingTime} className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-[#171717] focus:ring-4 focus:ring-amber-100" />
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-700">
            ระยะเวลาจอง (นาที)
            <input name="durationMinutes" type="number" min="1" defaultValue={settings.durationMinutes} className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-[#171717] focus:ring-4 focus:ring-amber-100" />
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-700">
            Grace period (นาที)
            <input name="graceMinutes" type="number" min="0" defaultValue={settings.graceMinutes} className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-[#171717] focus:ring-4 focus:ring-amber-100" />
          </label>
        </div>

        <label className="block space-y-2 text-sm font-semibold text-slate-700">
          Timezone
          <input name="timezone" defaultValue={settings.timezone} className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-[#171717] focus:ring-4 focus:ring-amber-100" />
        </label>
      </fieldset>

      {!canEdit ? null : (
        <button type="submit" disabled={isPending} className="rounded-xl bg-[#facc15] px-6 py-3 font-semibold text-[#171717] transition hover:bg-[#eab308] focus:outline-none focus:ring-4 focus:ring-amber-200 disabled:cursor-wait disabled:opacity-60">
          {isPending ? "กำลังบันทึก..." : "บันทึก Settings"}
        </button>
      )}
      {state.message ? (
        <p role="status" className={state.ok ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-rose-700"}>{state.message}</p>
      ) : null}
    </form>
  );
}
