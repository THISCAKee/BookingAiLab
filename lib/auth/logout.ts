type SignOutClient = {
  signOut: () => Promise<{ error: unknown | null }>;
};

export type SignOutResult =
  | { ok: true }
  | { ok: false; message: string };

export async function signOutUser(auth: SignOutClient): Promise<SignOutResult> {
  try {
    const { error } = await auth.signOut();

    if (error) {
      return { ok: false, message: "ออกจากระบบไม่สำเร็จ กรุณาลองใหม่" };
    }

    return { ok: true };
  } catch {
    return { ok: false, message: "ออกจากระบบไม่สำเร็จ กรุณาลองใหม่" };
  }
}
