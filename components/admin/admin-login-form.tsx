export function AdminLoginForm() {
  return (
    <form action="/api/admin/login" method="post" className="mt-6 space-y-4">
      <div>
        <label htmlFor="admin-username" className="mb-2 block text-sm font-semibold text-slate-700">Username</label>
        <input id="admin-username" name="username" type="text" defaultValue="admin" autoComplete="username" required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#171717] focus:ring-4 focus:ring-amber-100" />
      </div>
      <div>
        <label htmlFor="admin-password" className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
        <input id="admin-password" name="password" type="password" autoComplete="current-password" required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#171717] focus:ring-4 focus:ring-amber-100" />
      </div>
      <button type="submit" className="w-full rounded-xl bg-[#facc15] px-5 py-3.5 font-semibold text-[#171717] transition hover:bg-[#eab308] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200">เข้าสู่ระบบ Admin</button>
    </form>
  );
}
