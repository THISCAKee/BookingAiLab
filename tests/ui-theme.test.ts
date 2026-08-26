import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const routeFiles = [
  "app/login/page.tsx",
  "app/booking/page.tsx",
  "app/my-bookings/page.tsx",
  "app/auth/unauthorized/page.tsx",
  "app/admin/page.tsx",
  "app/admin/dashboard/page.tsx",
  "app/admin/bookings/page.tsx",
  "app/admin/machines/page.tsx",
  "app/admin/settings/page.tsx",
];

describe("BookingAiLab UI theme", () => {
  it("defines the yellow, black, and gray palette on white canvas", () => {
    const css = readFileSync(`${root}/app/globals.css`, "utf8");

    expect(css).toContain("--theme-yellow");
    expect(css).toContain("--theme-ink");
    expect(css).toContain("--theme-gray");
    expect(css).toContain("--theme-canvas: #ffffff");
    expect(css).not.toContain("--theme-gradient");
    expect(css).not.toContain(".signal-gradient-block");
  });

  it("keeps every page canvas white", () => {
    for (const file of routeFiles) {
      const source = readFileSync(`${root}/${file}`, "utf8");
      expect(source, file).toMatch(/<main[^>]*bg-white/);
    }
  });
});
