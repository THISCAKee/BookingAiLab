import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LoginPage from "@/app/login/page";

describe("login page", () => {
  it("presents a focused university sign-in entry point", async () => {
    const page = await LoginPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('data-testid="login-shell"');
    expect(html).toContain('data-theme="light-signal"');
    expect(html).toContain("bg-white");
    expect(html).toContain("text-[#1f2937]");
    expect(html).not.toContain("bg-[#11161c]");
    expect(html).toContain("bg-[#facc15]");
    expect(html).toContain("เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัย");
    expect(html).toContain("ใช้บัญชี Google ของมหาวิทยาลัยมหาสารคาม");
    expect(html).toContain('aria-label="เข้าสู่ระบบด้วย Google"');
    expect(html).toContain('href="/"');
  });
});
