const ADMIN_EMAIL = "admin@msu.ac.th";

export function normalizeAdminUsername(value: unknown) {
  if (typeof value !== "string" || value.trim().toLowerCase() !== "admin") {
    return null;
  }

  return ADMIN_EMAIL;
}
