"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOutUser } from "@/lib/auth/logout";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LogoutButton({ redirectTo = "/login" }: { redirectTo?: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleLogout() {
    setIsPending(true);
    setMessage(null);

    const supabase = createSupabaseBrowserClient();
    const result = await signOutUser(supabase.auth);

    if (!result.ok) {
      setMessage(result.message);
      setIsPending(false);
      return;
    }

    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleLogout}
        disabled={isPending}
        className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-wait disabled:opacity-60"
      >
        {isPending ? "กำลังออก..." : "ออกจากระบบ"}
      </button>
      {message ? (
        <p className="absolute right-0 top-full z-10 mt-2 w-56 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 shadow-lg" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
