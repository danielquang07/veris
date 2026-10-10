"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShieldCheck, MessageSquare, Wallet, Sparkles, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ResultCard } from "@/components/scam-check/ResultCard";
import { extractAddresses } from "@/lib/address";
import type { RiskAnalysis } from "@/lib/risk-types";

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const SAMPLES = [
  {
    label: "Trúng thưởng & OTP",
    text: "Chúc mừng bạn đã trúng thưởng iPhone 16 Pro Max, vui lòng cung cấp mã OTP để xác nhận nhận quà trong 5 phút.",
  },
  {
    label: "Khóa thẻ ngân hàng",
    text: "Tài khoản ngân hàng của bạn tạm thời bị khóa do giao dịch bất thường. Bấm vào link để xác minh ngay lập tức.",
  },
  {
    label: "Tin nhắn an toàn",
    text: "Hôm nay mình gửi file báo cáo doanh thu tuần này qua email nhé, bạn kiểm tra giúp mình.",
  },
];

export default function CheckScamPage() {
  const [mode, setMode] = useState<"text" | "wallet">("text");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isValidWallet = mode === "wallet" ? BASE58_REGEX.test(input.trim()) : true;
  const isInputEmpty = !input.trim();
  const isButtonDisabled = loading || isInputEmpty || (mode === "wallet" && !isValidWallet);

  const handleAnalyze = async () => {
    if (isButtonDisabled) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // Text mode: a Solana address pasted inside the message is checked against the chain too
      const walletInText =
        mode === "text" ? extractAddresses(input).find((a) => a.chain === "sol")?.address ?? null : null;
      const payload = {
        text: mode === "text" ? input.trim() : "",
        subject_pubkey: mode === "wallet" ? input.trim() : walletInText,
        tx_type: "other",
      };

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Dịch vụ phản hồi lỗi (mã ${res.status}). Vui lòng kiểm tra AI service.`);
      }

      const data: RiskAnalysis = await res.json();
      setResult(data);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Yêu cầu quá hạn (timeout 10s). Vui lòng thử lại.");
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || "Không thể kết nối tới máy chủ phân tích.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Quay lại DEX
          </Link>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-zinc-400 font-mono">AI Guard v1.0</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10 w-full flex-1 space-y-6">
        {/* Page Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 border border-accent/30 text-accent">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
                Kiểm tra lừa đảo bằng AI
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400">
                Nhập tin nhắn hoặc địa chỉ ví để phân tích với mô hình XLM-RoBERTa và bộ luật Việt Nam
              </p>
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setMode("text");
              setInput("");
              setResult(null);
              setError(null);
            }}
            className={`flex-1 min-h-[42px] px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 flex items-center justify-center gap-2 ${
              mode === "text"
                ? "bg-accent text-white shadow-sm font-semibold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
            }`}
          >
            <MessageSquare className="h-4 w-4" /> Nội dung tin nhắn
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("wallet");
              setInput("");
              setResult(null);
              setError(null);
            }}
            className={`flex-1 min-h-[42px] px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 flex items-center justify-center gap-2 ${
              mode === "wallet"
                ? "bg-accent text-white shadow-sm font-semibold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
            }`}
          >
            <Wallet className="h-4 w-4" /> Địa chỉ ví Solana
          </button>
        </div>

        {/* Input Card */}
        <Card className="border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-lg">
          {mode === "text" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Nội dung cần phân tích
                </label>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Sparkles className="h-3.5 w-3.5 text-accent" /> Hỗ trợ tiếng Việt
                </div>
              </div>
              <textarea
                rows={5}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Dán tin nhắn nghi ngờ lừa đảo, trúng thưởng, đe dọa khóa tài khoản vào đây..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent outline-none font-sans leading-relaxed resize-y"
              />

              {/* Sample Chips */}
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] text-zinc-400">Gợi ý mẫu thử nhanh:</p>
                <div className="flex flex-wrap gap-2">
                  {SAMPLES.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setInput(s.text)}
                      className="rounded-full border border-zinc-700 bg-zinc-800/60 px-3 py-1 text-xs text-zinc-300 hover:border-accent hover:text-accent transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
                Địa chỉ ví Solana (Public Key)
              </label>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ví dụ: 9ukmHJeMxEUtzSJf6gsdqgUgcEL8P9LJyeamW2RiSbEE"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-accent outline-none font-mono"
              />
              {input && !isValidWallet && (
                <p className="text-xs text-danger">
                  Địa chỉ không hợp lệ (phải là chuỗi Base58 từ 32–44 ký tự).
                </p>
              )}
            </div>
          )}

          {/* Action Button */}
          <Button
            variant="primary"
            size="lg"
            className="w-full py-3 mt-2 flex items-center justify-center gap-2"
            onClick={handleAnalyze}
            disabled={isButtonDisabled}
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Đang chạy mô hình AI...
              </>
            ) : (
              "Phân tích rủi ro"
            )}
          </Button>
        </Card>

        {/* Error message */}
        {error && (
          <div className="rounded-xl border border-red-800/60 bg-red-950/40 p-4 text-sm text-red-300">
            ⚠ {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <Card className="border-zinc-800 bg-zinc-900/40 p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-10 w-20" />
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
          </Card>
        )}

        {/* Result Card */}
        {result && !loading && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 px-1">
              Kết quả kiểm tra AI
            </h3>
            <ResultCard result={result} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-xs text-zinc-500 text-center py-8 border-t border-zinc-900 mt-auto">
        Veris AI Scam Detection Engine · XLM-RoBERTa vi-VN · Bộ luật Hình sự 2015
      </footer>
    </div>
  );
}
