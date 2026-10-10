"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { ShieldCheck, Activity } from "lucide-react";
import { CrossChainDemo } from "@/components/dex/CrossChainDemo";
import { LiquidityCheck } from "@/components/dex/LiquidityCheck";
import { ProvideLiquidity } from "@/components/dex/ProvideLiquidity";
import { SwapToken } from "@/components/dex/SwapToken";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// The wallet button must skip SSR to avoid hydration mismatch
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

type Tab = "swap" | "bridge" | "check" | "provide";

const TABS: { id: Tab; label: string; hint: string }[] = [
  {
    id: "swap",
    label: "Swap Token",
    hint: "Đổi SOL ↔ token qua pool Raydium CPMM trên Solana Devnet. Veris Shield kiểm tra token trên chain trước khi ví mở ra.",
  },
  {
    id: "bridge",
    label: "Cầu nối Cross-Chain",
    hint: "Chuyển tài sản giữa Solana và Sui theo cơ chế khóa & đúc. Bản mô phỏng kiểm tra địa chỉ hợp lệ.",
  },
  {
    id: "check",
    label: "Kiểm tra thanh khoản",
    hint: "Đọc trực tiếp dữ liệu pool on-chain: số dư tài sản, tỉ giá hiện tại và độ trượt giá dự kiến.",
  },
  {
    id: "provide",
    label: "Cung cấp thanh khoản",
    hint: "Nạp SOL + token theo tỉ lệ pool để nhận LP token và chia sẻ phí. Veris Shield kiểm tra token trước khi nạp.",
  },
];

export default function DexPage() {
  const [tab, setTab] = useState<Tab>("swap");
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-accent selection:text-white">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 border border-accent/30 text-accent font-bold text-sm">
              V
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-100">
                  Veris DEX
                </h1>
                <Badge variant="safe" className="hidden sm:inline-flex text-[10px]">
                  Devnet
                </Badge>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">
                Sàn giao dịch phi tập trung có Veris Shield chống token lừa đảo
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <Link
              href="/shield"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 text-xs font-semibold transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Veris Shield
            </Link>
            <WalletMultiButton className="!bg-zinc-800 hover:!bg-zinc-700 !text-zinc-100 !text-xs !h-9 !rounded-lg !font-medium !transition-colors" />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 py-6 w-full flex-1">
        {/* Navigation Tabs (Touch target >= 44px) */}
        <div className="mb-6 flex overflow-x-auto no-scrollbar gap-2 p-1 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 whitespace-nowrap flex items-center justify-center ${
                tab === t.id
                  ? "bg-accent text-white shadow-sm font-semibold"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="mb-6 text-xs sm:text-sm text-zinc-400 px-1">
          {current.hint}
        </p>

        {/* Responsive Layout Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Main Action Column */}
          <div className="w-full">
            <div className={tab === "swap" ? "" : "hidden"}>
              <SwapToken />
            </div>
            <div className={tab === "bridge" ? "" : "hidden"}>
              <CrossChainDemo />
            </div>
            <div className={tab === "check" ? "" : "hidden"}>
              <LiquidityCheck />
            </div>
            <div className={tab === "provide" ? "" : "hidden"}>
              <ProvideLiquidity />
            </div>
          </div>

          {/* Sidebar / Auxiliary Insights Column */}
          <div className="space-y-4">
            {/* Veris Shield Overview Card */}
            <Card className="border-zinc-800 bg-zinc-900/70 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-accent" />
                  <h3 className="text-sm font-semibold text-zinc-200">Veris Shield</h3>
                </div>
                <Badge variant="safe">Đang bảo vệ</Badge>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Mỗi lần bạn mua token hoặc nạp thanh khoản, Veris tự đọc token trên Solana trước khi ví mở ra:
              </p>
              <ul className="text-xs text-zinc-400 space-y-1.5 pl-1">
                {[
                  "Người tạo còn quyền in thêm token?",
                  "Người tạo còn quyền khóa token trong ví bạn?",
                  "Token không tên, hoặc mạo danh USDC/USDT?",
                  "Token có trong sổ đen cộng đồng?",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/shield"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
              >
                Quét một token bất kỳ →
              </Link>
            </Card>

            {/* Devnet Environment Info */}
            <Card className="border-zinc-800/60 bg-zinc-900/40 p-4">
              <div className="flex items-center gap-2 text-zinc-400 mb-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wider">Thông số mạng</span>
              </div>
              <dl className="grid grid-cols-2 gap-1.5 text-xs">
                <dt className="text-zinc-500">Mạng kết nối:</dt>
                <dd className="text-right text-zinc-300 font-mono">Solana Devnet</dd>
                <dt className="text-zinc-500">Giao thức AMM:</dt>
                <dd className="text-right text-zinc-300 font-mono">Raydium CPMM</dd>
                <dt className="text-zinc-500">Kiểm tra token:</dt>
                <dd className="text-right text-zinc-300 font-mono">Đọc trực tiếp on-chain</dd>
                <dt className="text-zinc-500">AI đọc tin nhắn:</dt>
                <dd className="text-right text-zinc-300 font-mono">XLM-R tiếng Việt</dd>
              </dl>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-xs text-zinc-500 text-center py-8 border-t border-zinc-900 mt-auto">
        Veris DEX · Solana Devnet · UniHackfest 2026
      </footer>
    </div>
  );
}
