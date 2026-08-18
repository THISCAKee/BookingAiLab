import { describe, expect, it } from "vitest";
import { signOutUser } from "@/lib/auth/logout";

describe("signOutUser", () => {
  it("reports success after Supabase clears the session", async () => {
    const result = await signOutUser({
      signOut: async () => ({ error: null }),
    });

    expect(result).toEqual({ ok: true });
  });

  it("keeps the user on the page when Supabase cannot clear the session", async () => {
    const result = await signOutUser({
      signOut: async () => ({ error: { message: "network unavailable" } }),
    });

    expect(result).toEqual({
      ok: false,
      message: "ออกจากระบบไม่สำเร็จ กรุณาลองใหม่",
    });
  });

  it("returns a useful error when the sign-out request throws", async () => {
    const result = await signOutUser({
      signOut: async () => {
        throw new Error("offline");
      },
    });

    expect(result).toEqual({
      ok: false,
      message: "ออกจากระบบไม่สำเร็จ กรุณาลองใหม่",
    });
  });
});
