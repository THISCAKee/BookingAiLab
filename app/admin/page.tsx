import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminLoginPage() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("admin_profiles").select("is_active").eq("auth_user_id", user.id).maybeSingle();
      if (data?.is_active) redirect("/admin/dashboard");
    }
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) throw error;
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f4f6f8] px-5"><section className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_-45px_rgba(15,23,42,0.6)]"><p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-600">OPERATIONS ACCESS</p><h1 className="mt-4 text-3xl font-semibold tracking-tight">เข้าสู่ระบบผู้ดูแล</h1><p className="mt-3 text-sm leading-7 text-slate-600">ใช้บัญชี Email/Password ที่กำหนดใน Supabase Auth</p><AdminLoginForm /><Link href="/booking" className="mt-6 block text-center text-sm font-semibold text-slate-500 hover:text-slate-950">กลับหน้าจองเครื่อง</Link></section></main>;
}
