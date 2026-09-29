"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { P2PTrade } from "@/components/payment/P2PTrade";
import { Withdraw } from "@/components/payment/Withdraw";

// The wallet button must skip SSR, otherwise "hydration mismatch"
// because wallet state differs between server and browser.
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

type Tab = "withdraw" | "p2p";

const TABS: { id: Tab; label: string; hint: string }[] = [
  {
    id: "withdraw",
    label: "① Tự rút về ví",
    hint: "Rút tiền chơi game (SUI / SOL) về ví của chính bạn. Rút đúng ví mình thì Veris không hỏi gì.",
  },
  {
    id: "p2p",
    label: "② Trao đổi người–người",
    hint: "Hai bên cùng cọc 30–50% vào temp wallet. Veris kiểm tra ví hai bên và địa chỉ ví lạ trong chat trước khi mở temp wallet.",
  },
];

export default function PaymentPage() {
  const [tab, setTab] = useState<Tab>("withdraw");
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Veris × Hào Khí Đại Việt — Thanh toán
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Chơi game → nhận tiền ảo → đổi ra SUI hoặc SOL → thanh toán. Veris kiểm tra trước khi ký,
            chỉ lên tiếng khi tiền có nguy cơ đi sai chỗ.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <WalletMultiButton />
            <p className="text-xs text-zinc-500">
              Kết nối Phantom (tùy chọn): ví này được coi là ví SOL đã liên kết, đồng thời đóng vai ví
              admin — ví admin ghi sổ đen sau khi phân xử, và sổ đen đó được dùng để kiểm tra.
            </p>
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

          {/* Keep both mounted so switching tabs does not wipe a running demo */}
          <div className={tab === "withdraw" ? "" : "hidden"}>
            <Withdraw />
          </div>
          <div className={tab === "p2p" ? "" : "hidden"}>
            <P2PTrade />
          </div>
        </section>
      </main>
    </div>
  );
}
