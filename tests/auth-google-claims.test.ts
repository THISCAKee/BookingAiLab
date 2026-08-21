import { describe, expect, it } from "vitest";
import { validateGoogleClaims } from "@/lib/auth/google-claims";

describe("validateGoogleClaims", () => {
  it("requires both the MSU email suffix and exact hosted domain", () => {
    expect(() =>
      validateGoogleClaims({
        email: "student@msu.ac.th",
        email_verified: true,
        hd: "gmail.com",
        name: "Student",
      }),
    ).toThrow("AUTH_DOMAIN_NOT_ALLOWED");

    expect(() =>
      validateGoogleClaims({
        email: "student@msu.ac.th",
        email_verified: true,
        name: "Student",
      }),
    ).toThrow("AUTH_DOMAIN_NOT_ALLOWED");
  });

  it("normalizes the email and derives the TimeLock identifier", () => {
    expect(
      validateGoogleClaims({
        email: " Student.Name@MSU.AC.TH ",
        email_verified: true,
        hd: "msu.ac.th",
        name: "Student Name",
      }),
    ).toEqual({
      email: "student.name@msu.ac.th",
      name: "Student Name",
      hd: "msu.ac.th",
      emailPrefix: "student.name",
    });
  });

  it("rejects unverified and malformed claims", () => {
    expect(() => validateGoogleClaims({ email: "student@msu.ac.th", hd: "msu.ac.th" })).toThrow(
      "AUTH_EMAIL_NOT_VERIFIED",
    );
    expect(() =>
      validateGoogleClaims({ email: "not-an-email", email_verified: true, hd: "msu.ac.th" }),
    ).toThrow("AUTH_EMAIL_INVALID");
  });
});
