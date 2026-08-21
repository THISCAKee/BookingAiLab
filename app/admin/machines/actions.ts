"use server";

import { revalidatePath } from "next/cache";
import { requireAdminIdentity } from "@/lib/auth/identity";
import { validateMachineId } from "@/lib/booking/action-utils";
import { validateMachineStatus } from "@/lib/machines/administration";
import { rotateAdminMachineToken, updateAdminMachine } from "@/lib/admin/sheet-repository";

export type MachineAdminState = { ok: boolean; message?: string; deviceToken?: string; machineCode?: string };

export async function updateMachineAction(_previous: MachineAdminState, formData: FormData): Promise<MachineAdminState> {
  const machineId = validateMachineId(formData.get("machineId"));
  const status = validateMachineStatus(formData.get("status"));
  const machineName = String(formData.get("machineName") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  if (!machineId || !status || !machineName) return { ok: false, message: "ข้อมูลเครื่องไม่ครบหรือสถานะไม่ถูกต้อง" };
  try {
    await requireAdminIdentity();
    await updateAdminMachine({ machineId, machineName, location: location || null, status });
    revalidatePath("/admin/machines"); revalidatePath("/admin/dashboard"); revalidatePath("/booking");
    return { ok: true, message: "บันทึกข้อมูลเครื่องแล้ว" };
  } catch { return { ok: false, message: "ไม่มีสิทธิ์แก้ไขข้อมูลเครื่อง" }; }
}

export async function rotateMachineTokenAction(_previous: MachineAdminState, formData: FormData): Promise<MachineAdminState> {
  const machineId = validateMachineId(formData.get("machineId"));
  if (!machineId) return { ok: false, message: "ไม่พบเครื่อง" };
  try {
    await requireAdminIdentity();
    const result = await rotateAdminMachineToken(machineId);
    revalidatePath("/admin/machines");
    return { ok: true, message: "สร้าง Token ใหม่แล้ว — Token เดิมใช้ไม่ได้ทันที", deviceToken: result.deviceToken, machineCode: result.machineCode };
  } catch { return { ok: false, message: "ไม่มีสิทธิ์สร้าง Device Token" }; }
}
