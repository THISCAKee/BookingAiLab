# BookingAiLab Foundation — Phase 1 Plan

## Scope

สร้างโครง Next.js App Router ด้วย TypeScript, Tailwind CSS 4 และ Vitest พร้อมตั้งค่า Anuphan เป็นฟอนต์หลักของแอป

## Files

- `package.json`: dependencies และ scripts
- `app/layout.tsx`: root metadata, Thai locale และ Anuphan
- `app/page.tsx`: foundation landing page
- `app/globals.css`: Tailwind 4 import และ global styles
- `next.config.ts`, `tsconfig.json`, `next-env.d.ts`, `postcss.config.mjs`: framework configuration
- `vitest.config.ts`, `tests/smoke.test.ts`: test runner และ smoke test
- `.env.example`, `.gitignore`: environment และ secret hygiene

## Constraints

- ยังไม่สร้าง Supabase migration
- ยังไม่ทำ Authentication หรือ Booking workflow
- ยังไม่แก้ไข WPF project
- ห้ามใส่ secret จริงใน repository
