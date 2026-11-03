import type { Metadata } from "next";
import { Anuphan } from "next/font/google";
import { getLocale } from "@/lib/i18n/locale";
import "./globals.css";

const anuphan = Anuphan({
  subsets: ["thai", "latin"],
  variable: "--font-anuphan",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BookingAiLab",
  description: "ระบบจองเครื่องคอมพิวเตอร์สำหรับมหาวิทยาลัยมหาสารคาม",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className={anuphan.variable}>{children}</body>
    </html>
  );
}
