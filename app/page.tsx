"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { ShieldCheck, Sparkles, Activity } from "lucide-react";
import { CrossChainDemo } from "@/components/dex/CrossChainDemo";
import { LiquidityCheck } from "@/components/dex/LiquidityCheck";
import { ProvideLiquidity } from "@/components/dex/ProvideLiquidity";
import { SwapToken } from "@/components/dex/SwapToken";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { VoiceInputField } from "@/components/ui/VoiceInputField";

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
    hint: "Đổi SOL ↔ token qua pool Raydium CPMM trên Solana Devnet. Tích hợp AI kiểm tra lừa đảo trước khi ký ví.",
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
    hint: "Nạp SOL + token theo tỉ lệ pool để nhận LP token và chia sẻ phí giao dịch trên pool Raydium.",
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
                <span className="text-xs text-zinc-500 font-normal">× Hào Khí Đại Việt</span>
                <Badge variant="safe" className="hidden sm:inline-flex text-[10px]">
                  Devnet
                </Badge>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">
                Sàn giao dịch phi tập trung tích hợp AI Scam Guard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <Link
              href="/check-scam"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 text-xs font-semibold transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Kiểm tra lừa đảo
            </Link>
            <Link
              href="/payments"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
            >
              P2P Chợ
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
            {/* AI Guard Overview Card */}
            <Card className="border-zinc-800 bg-zinc-900/70 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-accent" />
                  <h3 className="text-sm font-semibold text-zinc-200">AI Scam Guard 24/7</h3>
                </div>
                <Badge variant="safe">Hoạt động</Badge>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Mỗi giao dịch swap đều được mô phỏng và kiểm tra rủi ro tự động qua 3 lớp phòng vệ:
              </p>
              <ul className="text-xs text-zinc-400 space-y-1.5 pl-1">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <span>XLM-RoBERTa phân tích ngôn ngữ tự nhiên (NLP tiếng Việt)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <span>Căn cứ pháp lý Bộ luật Hình sự 2015 (Điều 174, 290)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <span>On-chain heuristics & Sổ cái báo cáo Solana devnet</span>
                </li>
              </ul>
            </Card>

            {/* Voice Input Assistant Card */}
            <Card className="border-zinc-800 bg-zinc-900/70 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                  <h3 className="text-sm font-semibold text-zinc-200">Trợ lý giọng nói (Web Speech)</h3>
                </div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">vi-VN</span>
              </div>
              <p className="text-xs text-zinc-400">
                Nhấn micro để nhập số lượng hoặc nội dung giao dịch bằng tiếng Việt trực tiếp trên trình duyệt.
              </p>
              <div className="pt-1">
                <VoiceInputField
                  placeholder="Nhấn micro để thử nhận diện giọng nói tiếng Việt..."
                  className="rounded-lg bg-zinc-950 border border-zinc-800/80 p-2.5"
                />
              </div>
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
                <dt className="text-zinc-500">Mô hình AI:</dt>
                <dd className="text-right text-zinc-300 font-mono">XLM-R Vi Phishing</dd>
                <dt className="text-zinc-500">Cơ chế an toàn:</dt>
                <dd className="text-right text-safe font-mono">Fail-open (3s)</dd>
              </dl>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-xs text-zinc-500 text-center py-8 border-t border-zinc-900 mt-auto">
        Veris DEX × Hào Khí Đại Việt · Solana Devnet · UniHackfest 2026
      </footer>
    </div>
  );
}
