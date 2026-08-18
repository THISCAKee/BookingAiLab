"use server";

import { revalidatePath } from "next/cache";
import { requireActiveAdmin } from "@/lib/auth/admin";
import { validateMachineId } from "@/lib/booking/action-utils";
import { validateMachineStatus } from "@/lib/machines/administration";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MachineAdminState = { ok: boolean; message?: string; deviceToken?: string; machineCode?: string };

export async function updateMachineAction(_previous: MachineAdminState, formData: FormData): Promise<MachineAdminState> {
  const machineId = validateMachineId(formData.get("machineId"));
  const status = validateMachineStatus(formData.get("status"));
  const machineName = String(formData.get("machineName") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  if (!machineId || !status || !machineName) return { ok: false, message: "ข้อมูลเครื่องไม่ครบหรือสถานะไม่ถูกต้อง" };
  try {
    const supabase = await createSupabaseServerClient();
    await requireActiveAdmin(supabase);
    const { error } = await supabase.from("machines").update({ machine_name: machineName, location: location || null, status }).eq("id", machineId);
    if (error) return { ok: false, message: "บันทึกข้อมูลเครื่องไม่สำเร็จ" };
    revalidatePath("/admin/machines"); revalidatePath("/admin/dashboard"); revalidatePath("/booking");
    return { ok: true, message: "บันทึกข้อมูลเครื่องแล้ว" };
  } catch { return { ok: false, message: "ไม่มีสิทธิ์แก้ไขข้อมูลเครื่อง" }; }
}

export async function rotateMachineTokenAction(_previous: MachineAdminState, formData: FormData): Promise<MachineAdminState> {
  const machineId = validateMachineId(formData.get("machineId"));
  if (!machineId) return { ok: false, message: "ไม่พบเครื่อง" };
  try {
    const supabase = await createSupabaseServerClient();
    await requireActiveAdmin(supabase);
    const { data, error } = await supabase.rpc("rotate_machine_device_token", { p_machine_id: machineId });
    if (error || !data) return { ok: false, message: "สร้าง Device Token ไม่สำเร็จ" };
    const result = data as { deviceToken: string; machineCode: string };
    revalidatePath("/admin/machines");
    return { ok: true, message: "สร้าง Token ใหม่แล้ว — Token เดิมใช้ไม่ได้ทันที", deviceToken: result.deviceToken, machineCode: result.machineCode };
  } catch { return { ok: false, message: "ไม่มีสิทธิ์สร้าง Device Token" }; }
}
