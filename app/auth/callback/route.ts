import { NextResponse } from "next/server";
import { isAllowedUniversityEmail } from "@/lib/auth/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const loginUrl = new URL("/login", requestUrl.origin);

  if (!code) {
    loginUrl.searchParams.set("error", "oauth");
    return NextResponse.redirect(loginUrl);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      loginUrl.searchParams.set("error", "callback");
      return NextResponse.redirect(loginUrl);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAllowedUniversityEmail(user.email)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/auth/unauthorized", requestUrl.origin));
    }

    return NextResponse.redirect(new URL("/", requestUrl.origin));
  } catch {
    loginUrl.searchParams.set("error", "callback");
    return NextResponse.redirect(loginUrl);
  }
}
