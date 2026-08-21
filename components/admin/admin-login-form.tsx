"use client";

import { useState } from "react";

export function AdminLoginForm() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setMessage("");
    window.location.assign("/api/auth/google");
  }

  return (
    <form action={submit} className="mt-8 space-y-5">
      <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">ผู้ดูแลระบบเข้าสู่ระบบด้วย Google Workspace ของมหาวิทยาลัย และต้องอยู่ในรายการอีเมลผู้ดูแล</p>
      {message ? <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{message}</p> : null}
      <button disabled={loading} className="w-full rounded-xl bg-[#2563eb] px-5 py-3.5 font-semibold text-white transition hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-wait disabled:bg-slate-300">{loading ? "กำลังเชื่อมต่อ Google…" : "เข้าสู่ระบบด้วย Google"}</button>
    </form>
  );
}
