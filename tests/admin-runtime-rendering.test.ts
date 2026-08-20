import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adminPages = [
  "app/admin/dashboard/page.tsx",
  "app/admin/machines/page.tsx",
  "app/admin/bookings/page.tsx",
  "app/admin/settings/page.tsx",
];

describe("admin pages runtime rendering", () => {
  it("does not prerender pages that require Supabase runtime configuration", () => {
    for (const page of adminPages) {
      const source = readFileSync(page, "utf8");
      expect(source, page).toContain('export const dynamic = "force-dynamic";');
    }
  });
});
