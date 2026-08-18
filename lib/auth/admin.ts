import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function requireActiveAdmin(supabase: SupabaseClient): Promise<User> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("AUTH_REQUIRED");

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile?.is_active) throw new Error("ADMIN_REQUIRED");
  return user;
}
