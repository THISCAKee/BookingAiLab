"use client";

import { useState } from "react";

export function LoginButton() {
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    setIsLoading(true);
    window.location.assign("/api/auth/google");
  }

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={isLoading}
      className="w-full rounded-xl bg-blue-700 px-5 py-3 font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoading ? "กำลังเชื่อมต่อ..." : "เข้าสู่ระบบด้วย Google"}
    </button>
  );
}
