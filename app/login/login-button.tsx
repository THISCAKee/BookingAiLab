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
      aria-label="เข้าสู่ระบบด้วย Google"
      aria-busy={isLoading}
      className="login-google-button flex w-full items-center justify-center gap-3 rounded-2xl bg-[#facc15] px-5 py-4 font-semibold text-[#1f2937] transition hover:bg-[#fde047] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-200/50 disabled:cursor-wait disabled:opacity-70"
    >
      {isLoading ? (
        <span className="flex items-center gap-3">
          <span className="login-spinner" aria-hidden="true" />
          กำลังเชื่อมต่อ...
        </span>
      ) : (
        <>
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.25-.2-1.8H12v3.4h5.37a4.59 4.59 0 0 1-1.99 3.01v2.47h3.22c1.89-1.74 2.75-4.3 2.75-7.08Z" />
            <path fill="#34A853" d="M12 21.8c2.7 0 4.96-.89 6.61-2.42l-3.22-2.47c-.89.6-2.02.96-3.39.96-2.61 0-4.83-1.76-5.62-4.13H3.05v2.55A9.98 9.98 0 0 0 12 21.8Z" />
            <path fill="#FBBC05" d="M6.38 13.74A6 6 0 0 1 6.06 12c0-.6.11-1.19.32-1.74V7.71H3.05A9.98 9.98 0 0 0 2 12c0 1.55.37 3.02 1.05 4.29l3.33-2.55Z" />
            <path fill="#EA4335" d="M12 6.13c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 3.16 14.7 2.2 12 2.2a9.98 9.98 0 0 0-8.95 5.51l3.33 2.55C7.17 7.89 9.39 6.13 12 6.13Z" />
          </svg>
          เข้าสู่ระบบด้วย Google
        </>
      )}
    </button>
  );
}
