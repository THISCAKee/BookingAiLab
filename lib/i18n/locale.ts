import { cookies } from "next/headers";
import { defaultLocale, isLocale, localeCookieName, type Locale } from "@/lib/i18n/dictionaries";

export async function getLocale(): Promise<Locale> {
  try {
    const value = (await cookies()).get(localeCookieName)?.value;
    return isLocale(value) ? value : defaultLocale;
  } catch {
    // Outside a request (e.g. unit tests) there are no cookies to read.
    return defaultLocale;
  }
}
