import type { Metadata, Viewport } from "next";
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
    "Veris DEX × Hào Khí Đại Việt — cầu nối cross-chain, swap token, kiểm tra và cung cấp thanh khoản trên Solana Devnet (Raydium CPMM). UniHackfest 2026",
};

export const viewport: Viewport = {
  themeColor: "#09090B",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="theme-color" content="#09090B" />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <SolanaProvider>{children}</SolanaProvider>
      </body>
    </html>
  );
}
