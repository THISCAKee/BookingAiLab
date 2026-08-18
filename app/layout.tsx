import type { Metadata } from "next";
import { Anuphan, Chakra_Petch } from "next/font/google";
import "./globals.css";

const anuphan = Anuphan({
  subsets: ["thai", "latin"],
  variable: "--font-anuphan",
  display: "swap",
});

const chakraPetch = Chakra_Petch({
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-chakra-petch",
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
      <body className={`${anuphan.variable} ${chakraPetch.variable}`}>{children}</body>
    </html>
  );
}
