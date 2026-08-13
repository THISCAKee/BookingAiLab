import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-medium text-amber-700">ไม่สามารถเข้าสู่ระบบได้</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">ต้องใช้บัญชีมหาวิทยาลัย</h1>
        <p className="mt-4 text-slate-600">
          ระบบอนุญาตเฉพาะบัญชี Google ที่ลงท้ายด้วย @msu.ac.th เท่านั้น
        </p>
        <Link
          href="/login"
          className="mt-7 inline-block rounded-xl bg-blue-700 px-5 py-3 font-medium text-white hover:bg-blue-800"
        >
          กลับไปเข้าสู่ระบบ
        </Link>
      </section>
    </main>
  );
}
