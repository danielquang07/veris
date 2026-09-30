"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { CrossChainDemo } from "@/components/dex/CrossChainDemo";
import { LiquidityCheck } from "@/components/dex/LiquidityCheck";
import { ProvideLiquidity } from "@/components/dex/ProvideLiquidity";
import { SwapToken } from "@/components/dex/SwapToken";

// The wallet button must skip SSR, otherwise "hydration mismatch"
// because wallet state differs between server and browser.
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

type Tab = "bridge" | "swap" | "check" | "provide";

const TABS: { id: Tab; label: string; hint: string }[] = [
  {
    id: "bridge",
    label: "Cầu nối cross-chain",
    hint: "Chuyển tài sản giữa Solana và Sui theo cơ chế khóa & đúc. Bản mô phỏng, có chặn gửi nhầm địa chỉ khác chain.",
  },
  {
    id: "swap",
    label: "Swap token",
    hint: "Đổi SOL ↔ token thử qua pool Raydium CPMM trên Solana Devnet. Xem giá, phí, tác động giá và số nhận tối thiểu trước khi ký.",
  },
  {
    id: "check",
    label: "Kiểm tra thanh khoản",
    hint: "Đọc trực tiếp pool trên chain: trong pool có bao nhiêu tiền, giá bao nhiêu, lệnh của bạn làm giá lệch bao nhiêu.",
  },
  {
    id: "provide",
    label: "Cung cấp thanh khoản",
    hint: "Nạp SOL + token theo tỉ lệ pool để nhận LP token và hưởng phí mỗi lệnh swap. Rút ra bất cứ lúc nào.",
  },
];

export default function DexPage() {
  const [tab, setTab] = useState<Tab>("swap");
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Veris DEX × Hào Khí Đại Việt
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Khu giao thương on-chain của game trên Solana Devnet: cầu nối, swap, kiểm tra và cung cấp thanh khoản — dùng chung pool
            Raydium với DEX của game chính.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <WalletMultiButton />
            <p className="text-xs text-zinc-500">Phantom → Settings → Developer Settings → bật Testnet Mode, chọn Solana Devnet.</p>
          </div>
        </header>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-4 flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  tab === t.id
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mb-5 text-sm text-zinc-500">{current.hint}</p>

          {/* Keep all mounted so switching tabs keeps what the player typed */}
          <div className={tab === "bridge" ? "" : "hidden"}>
            <CrossChainDemo />
          </div>
          <div className={tab === "swap" ? "" : "hidden"}>
            <SwapToken />
          </div>
          <div className={tab === "check" ? "" : "hidden"}>
            <LiquidityCheck />
          </div>
          <div className={tab === "provide" ? "" : "hidden"}>
            <ProvideLiquidity />
          </div>
        </section>

      </main>
    </div>
  );
}
