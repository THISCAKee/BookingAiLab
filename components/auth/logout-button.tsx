"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton({ redirectTo = "/login" }: { redirectTo?: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleLogout() {
    setIsPending(true);
    setMessage(null);

    window.location.assign(`/api/auth/logout?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={handleLogout}
        disabled={isPending}
        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100 disabled:cursor-wait disabled:opacity-60 sm:px-4 sm:text-sm"
      >
        {isPending ? "กำลังออก..." : "ออกจากระบบ"}
      </button>
      {message ? (
        <p className="absolute right-0 top-full z-10 mt-2 w-56 rounded-xl border border-rose-100 bg-white p-3 text-xs font-medium text-rose-700 shadow-xl" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
