import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SolanaProvider } from "@/components/WalletProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Veris",
  description:
    "Veris — lớp chống lừa đảo cho mục Thanh toán của Hào Khí Đại Việt: kiểm tra rút ví, kèo người–người qua temp wallet, sổ đen trên Solana. UniHackfest 2026",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SolanaProvider>{children}</SolanaProvider>
      </body>
    </html>
  );
}
