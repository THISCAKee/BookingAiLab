import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAllowedUniversityEmail } from "@/lib/auth/domain";
import { normalizeDisplayName } from "@/lib/booking/action-utils";

export async function requireUniversityUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("AUTH_REQUIRED");
  }

  if (!isAllowedUniversityEmail(user.email)) {
    throw new Error("CUSTOMER_EMAIL_NOT_ALLOWED");
  }

  return user;
}

export async function ensureCustomerProfile(
  supabase: SupabaseClient,
  user: User,
) {
  const { data, error } = await supabase.rpc("ensure_customer_profile", {
    p_display_name: normalizeDisplayName(user),
  });

  if (error) {
    throw error;
  }

  return data;
}
