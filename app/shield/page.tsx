"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, ScanSearch, Coins, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TokenReportCard } from "@/components/shield/TokenReportCard";
import { ResultCard } from "@/components/scam-check/ResultCard";
import { WalletScan } from "@/components/shield/WalletScan";
import { extractAddresses } from "@/lib/address";
import { DEX_POOLS } from "@/lib/raydium";
import type { RiskAnalysis } from "@/lib/risk-types";
import type { TokenRiskReport } from "@/lib/tokenRisk";

// The wallet button must skip SSR to avoid hydration mismatch
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const SAMPLES = [
  { label: "Token USDC thử", text: DEX_POOLS.USDC.mint },
  { label: "Token USDT thử", text: DEX_POOLS.USDT.mint },
  {
    label: "Tin nhắn hô mua token",
    text: `Kèo thơm anh em ơi! Token mới sắp lên sàn lớn, x10 trong tuần này. Mua ngay kẻo lỡ, chỉ còn 2 tiếng! Địa chỉ token: ${DEX_POOLS.USDC.mint}`,
  },
];

const TIMEOUT_MS = 20_000;

async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as T };
  } finally {
    clearTimeout(timer);
  }
}

export default function ShieldPage() {
  const [tab, setTab] = useState<"token" | "wallet">("token");
  const [walletPreset, setWalletPreset] = useState("");
  const [walletHint, setWalletHint] = useState<string | null>(null);
  // The approval simulator mimics a drainer request, so it only shows on /shield?demo
  const [showDemo] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo"));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<TokenRiskReport | null>(null);
  const [message, setMessage] = useState<RiskAnalysis | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  const scan = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setLoading(true);
    setToken(null);
    setMessage(null);
    setNotes([]);
    setWalletHint(null);

    // A bare address means "scan this token"; anything longer is a message that may contain one
    const address = extractAddresses(text).find((a) => a.chain === "sol")?.address ?? null;
    const isMessage = text !== address;
    const found: string[] = [];

    const [tokenRes, aiRes] = await Promise.allSettled([
      address ? postJson<TokenRiskReport & { error?: string }>("/api/token-check", { mint: address }) : Promise.resolve(null),
      isMessage
        ? postJson<RiskAnalysis & { error?: string }>("/api/analyze", { text, subject_pubkey: null, tx_type: "other" })
        : Promise.resolve(null),
    ]);

    if (tokenRes.status === "fulfilled" && tokenRes.value) {
      if (tokenRes.value.ok) setToken(tokenRes.value.data);
      else if ((tokenRes.value.data as { kind?: string }).kind === "wallet" && address) setWalletHint(address);
      else found.push(tokenRes.value.data.error ?? `Không kiểm tra được token (mã ${tokenRes.value.status}).`);
    } else if (tokenRes.status === "rejected") {
      found.push("Không kiểm tra được token lúc này (mạng chậm), thử lại sau.");
    }
    if (isMessage && !address) found.push("Không thấy địa chỉ token nào trong tin nhắn — chỉ phân tích nội dung.");

    if (aiRes.status === "fulfilled" && aiRes.value) {
      if (aiRes.value.ok) setMessage(aiRes.value.data);
      else
        found.push(
          aiRes.value.status === 503
            ? "Bản online chỉ kiểm tra token. Phần AI đọc tin nhắn chạy trên máy chủ AI riêng, có trong bản demo trực tiếp."
            : `AI đọc tin nhắn chưa phản hồi (mã ${aiRes.value.status}), thử lại sau.`
        );
    } else if (aiRes.status === "rejected") {
      found.push("AI đọc tin nhắn chưa phản hồi, thử lại sau.");
    }

    setNotes(found);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-100">
            <ArrowLeft className="h-4 w-4" /> Quay lại DEX
          </Link>
          <WalletMultiButton className="!bg-zinc-800 hover:!bg-zinc-700 !text-zinc-100 !text-xs !h-9 !rounded-lg !font-medium" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 w-full flex-1 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 border border-accent/30 text-accent">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Veris Shield</h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              Lớp bảo mật trước khi bạn ký: quét token sắp mua, quét ví đang giữ. Dữ liệu đọc thẳng từ Solana.
            </p>
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
          {(
            [
              ["token", "Quét token", Coins],
              ["wallet", "Quét ví", Wallet],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 min-h-[42px] px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                tab === id ? "bg-accent text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div className={tab === "wallet" ? "" : "hidden"}>
          <WalletScan key={walletPreset} presetOwner={walletPreset} showDemo={showDemo} />
        </div>

        <div className={tab === "token" ? "space-y-6" : "hidden"}>
          <p className="text-xs text-zinc-400 -mb-2">Dán địa chỉ token, hoặc dán nguyên tin nhắn đang rủ bạn mua token.</p>

          <Card className="bg-zinc-900/60 p-5 space-y-4">
            <textarea
              rows={4}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ví dụ: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU, hoặc: 'Token mới x10, mua ngay! Địa chỉ: ...'"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500">Thử nhanh:</span>
              {SAMPLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setInput(s.text)}
                  className="text-xs px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
                >
                  {s.label}
                </button>
              ))}
            </div>
            <Button variant="primary" size="lg" className="w-full" onClick={scan} disabled={loading || !input.trim()}>
              <ScanSearch className="h-4 w-4" /> {loading ? "Đang đọc dữ liệu trên Solana..." : "Quét"}
            </Button>
          </Card>

          {loading && (
            <Card className="p-5 space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </Card>
          )}

          {walletHint && (
            <div className="text-xs text-zinc-300 bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
              <span>Đây là địa chỉ <b>ví</b>, không phải token.</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setWalletPreset(walletHint);
                  setTab("wallet");
                }}
              >
                Quét ví này
              </Button>
            </div>
          )}

          {notes.map((n) => (
            <p key={n} className="text-xs text-zinc-400 bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
              {n}
            </p>
          ))}

          {token && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 px-1">Token</h2>
              <TokenReportCard report={token} />
            </section>
          )}

          {message && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 px-1">Tin nhắn (AI tiếng Việt)</h2>
              <ResultCard result={message} />
            </section>
          )}
        </div>
      </main>

      <footer className="text-xs text-zinc-500 text-center py-6 border-t border-zinc-900">
        Veris Shield · dữ liệu đọc trực tiếp trên Solana Devnet
      </footer>
    </div>
  );
}
