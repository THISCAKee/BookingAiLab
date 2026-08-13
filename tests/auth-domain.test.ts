import { describe, expect, it } from "vitest";
import { isAllowedUniversityEmail } from "@/lib/auth/domain";

describe("isAllowedUniversityEmail", () => {
  it("accepts a verified university email domain", () => {
    expect(isAllowedUniversityEmail("student@msu.ac.th")).toBe(true);
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(isAllowedUniversityEmail("  STUDENT@MSU.AC.TH  ")).toBe(true);
  });

  it("rejects a lookalike domain", () => {
    expect(isAllowedUniversityEmail("student@msu.ac.th.example.com")).toBe(false);
  });

  it("rejects an email without a local part", () => {
    expect(isAllowedUniversityEmail("@msu.ac.th")).toBe(false);
  });

  it("rejects missing email values", () => {
    expect(isAllowedUniversityEmail(undefined)).toBe(false);
    expect(isAllowedUniversityEmail(null)).toBe(false);
  });
});
