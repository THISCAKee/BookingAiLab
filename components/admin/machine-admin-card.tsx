"use client";

import { useActionState } from "react";
import { rotateMachineTokenAction, updateMachineAction } from "@/app/admin/machines/actions";

type Machine = { id: string; machine_code: string; machine_name: string; location: string | null; status: string; hasToken: boolean };

const fieldClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#171717] focus:ring-4 focus:ring-amber-100";

export function MachineAdminCard({ machine }: { machine: Machine }) {
  const [saveState, saveAction, saving] = useActionState(updateMachineAction, { ok: false });
  const [tokenState, tokenAction, rotating] = useActionState(rotateMachineTokenAction, { ok: false });
  const available = machine.status === "available";
  return (
    <article className="admin-glass card-tilt flex flex-col rounded-2xl border-2 border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold leading-tight">{machine.machine_code}</h2>
          <p className="text-xs text-slate-500">{machine.machine_name}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${available ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${available ? "bg-emerald-500" : "bg-slate-400"}`} aria-hidden="true" />
          {available ? "พร้อมให้จอง" : "ปิดรับจอง"}
        </span>
      </div>

      <form action={saveAction} className="mt-5 space-y-3">
        <input type="hidden" name="machineId" value={machine.id} />
        <label className="block text-xs font-semibold text-slate-600">ชื่อเครื่อง
          <input name="machineName" defaultValue={machine.machine_name} required className={`mt-1.5 ${fieldClass}`} />
        </label>
        <label className="block text-xs font-semibold text-slate-600">สถานที่
          <input name="location" defaultValue={machine.location ?? ""} placeholder="สถานที่" className={`mt-1.5 ${fieldClass}`} />
        </label>
        <label className="block text-xs font-semibold text-slate-600">สถานะ
          <select name="status" defaultValue={machine.status} className={`mt-1.5 ${fieldClass}`}>
            <option value="available">พร้อมให้จอง</option>
            <option value="maintenance">ซ่อมบำรุง</option>
            <option value="inactive">ยังไม่เปิดใช้</option>
            <option value="disabled">ปิดใช้งาน</option>
          </select>
        </label>
        <button disabled={saving} className="w-full rounded-xl bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60">{saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}</button>
        {saveState.message ? <p className={`text-xs font-semibold ${saveState.ok ? "text-emerald-700" : "text-rose-700"}`}>{saveState.message}</p> : null}
      </form>

      <div className="mt-5 border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">TimeLockApp Token</p>
          <span className={`text-xs font-medium ${machine.hasToken ? "text-emerald-700" : "text-slate-500"}`}>{machine.hasToken ? "ตั้งค่าแล้ว" : "ยังไม่มี"}</span>
        </div>
        <form action={tokenAction} className="mt-3">
          <input type="hidden" name="machineId" value={machine.id} />
          <button disabled={rotating} className="w-full rounded-xl bg-[#facc15] px-4 py-2.5 text-sm font-semibold text-[#171717] transition hover:bg-[#eab308] disabled:cursor-wait disabled:opacity-60">{rotating ? "กำลังสร้าง…" : machine.hasToken ? "หมุนเวียน Token" : "สร้าง Token"}</button>
        </form>
        {tokenState.deviceToken ? (
          <div className="mt-3 rounded-xl bg-[#171717] p-3 text-white">
            <p className="text-xs font-semibold text-[#facc15]">แสดงครั้งเดียว — คัดลอกตอนนี้</p>
            <code className="mt-2 block break-all text-xs">{tokenState.deviceToken}</code>
          </div>
        ) : null}
        {tokenState.message ? <p className={`mt-2 text-xs ${tokenState.ok ? "text-emerald-700" : "text-rose-700"}`}>{tokenState.message}</p> : null}
      </div>
    </article>
  );
}
