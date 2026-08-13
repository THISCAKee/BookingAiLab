import type { Metadata } from "next";
import { Anuphan } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className={anuphan.variable}>{children}</body>
    </html>
  );
}
