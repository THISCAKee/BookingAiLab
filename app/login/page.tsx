import Link from "next/link";
import { LoginButton } from "./login-button";

const errorMessages: Record<string, string> = {
  oauth: "ไม่สามารถเริ่มการเข้าสู่ระบบด้วย Google ได้ กรุณาลองใหม่",
  callback: "การเข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-medium text-blue-700">BookingAiLab</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">เข้าสู่ระบบ</h1>
        <p className="mt-3 text-slate-600">
          ใช้บัญชี Google ของมหาวิทยาลัยมหาสารคามที่ลงท้ายด้วย @msu.ac.th
        </p>
        {error && errorMessages[error] ? (
          <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">
            {errorMessages[error]}
          </p>
        ) : null}
        <div className="mt-7">
          <LoginButton />
        </div>
        <Link href="/" className="mt-6 block text-center text-sm text-slate-500 hover:text-slate-700">
          กลับหน้าหลัก
        </Link>
      </section>
    </main>
  );
}
