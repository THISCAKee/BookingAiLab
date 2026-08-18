"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminLoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(formData: FormData) {
    setLoading(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
      });
      if (error) {
        setMessage("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        return;
      }
      router.replace("/admin/dashboard");
      router.refresh();
    } catch {
      setMessage("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={submit} className="mt-8 space-y-5">
      <label className="block text-sm font-semibold text-slate-700">อีเมลผู้ดูแล<input name="email" type="email" autoComplete="username" required className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100" /></label>
      <label className="block text-sm font-semibold text-slate-700">รหัสผ่าน<input name="password" type="password" autoComplete="current-password" required className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100" /></label>
      {message ? <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{message}</p> : null}
      <button disabled={loading} className="w-full rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-amber-500 hover:text-slate-950 disabled:opacity-50">{loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ Admin"}</button>
    </form>
  );
}
