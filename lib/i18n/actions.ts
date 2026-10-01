"use server";

import { cookies } from "next/headers";
import { isLocale, localeCookieName } from "@/lib/i18n/dictionaries";

// Setting a cookie in a Server Action makes Next.js re-render the current route,
// so the page switches language without a client-side refresh.
export async function setLocaleAction(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(localeCookieName, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
