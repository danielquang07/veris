"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  ShieldCheck,
  CircleAlert,
  ExternalLink,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { RiskAnalysis } from "@/lib/risk-types";

type Props = {
  result: RiskAnalysis;
};

export function ResultCard({ result }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const score = result.risk_score;
  const ctx = result.on_chain_context;
  const hasOnchainReports = Boolean(ctx && typeof ctx.report_count === "number" && ctx.report_count > 0);

  const getTier = () => {
    if (score >= 85) {
      return {
        badgeVariant: "danger" as const,
        icon: <ShieldAlert className="h-5 w-5 animate-pulse text-danger" />,
        title: "Nguy hiểm cao",
        textColor: "text-danger",
        pulse: true,
      };
    }
    if (score >= 70) {
      return {
        badgeVariant: "warning" as const,
        icon: <AlertTriangle className="h-5 w-5 text-warning" />,
        title: "Cảnh báo rủi ro",
        textColor: "text-warning",
        pulse: false,
      };
    }
    if (score >= 40) {
      return {
        badgeVariant: "warning" as const,
        icon: <Info className="h-5 w-5 text-amber-400" />,
        title: "Đáng ngờ",
        textColor: "text-amber-400",
        pulse: false,
      };
    }
    return {
      badgeVariant: "safe" as const,
      icon: <ShieldCheck className="h-5 w-5 text-emerald-400" />,
      title: "Có vẻ an toàn",
      textColor: "text-emerald-400",
      pulse: false,
    };
  };

  const tier = getTier();

  const handleSpeak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Trình duyệt không hỗ trợ Web Speech API.");
      return;
    }
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }

    synth.cancel();
    const signalsSummary =
      result.signals && result.signals.length > 0
        ? `Các dấu hiệu gồm: ${result.signals.join(", ")}.`
        : "Không phát hiện dấu hiệu lừa đảo rõ ràng.";
    const textToRead = `Kết quả phân tích: ${tier.title}, điểm rủi ro ${score} trên 100. ${signalsSummary}`;

    const utter = new SpeechSynthesisUtterance(textToRead);
    utter.lang = "vi-VN";
    const voices = synth.getVoices();
    const viVoice = voices.find((v) => v.lang.toLowerCase().startsWith("vi"));
    if (viVoice) utter.voice = viVoice;

    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utter);
  };

  return (
    <Card className="border-zinc-800 bg-zinc-900/90 p-5 sm:p-6 space-y-5 animate-fade-in shadow-xl">
      {/* Header status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800/80 border border-zinc-700/60">
            {tier.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-base font-bold ${tier.textColor}`}>{tier.title}</span>
              <Badge variant={tier.badgeVariant} className={tier.pulse ? "animate-pulse" : ""}>
                {result.label}
              </Badge>
            </div>
            <p className="text-xs text-zinc-400">Đánh giá bởi mô hình XLM-RoBERTa và cơ sở dữ liệu pháp lý</p>
          </div>
        </div>

        {/* Big score */}
        <div className="flex items-baseline gap-1.5 ml-auto">
          <span className={`text-3xl sm:text-4xl font-extrabold ${tier.textColor}`}>{score}</span>
          <span className="text-xs font-semibold text-zinc-500">/ 100</span>
        </div>
      </div>

      {/* Voice Readout Button */}
      <div className="flex items-center justify-between bg-zinc-950/60 border border-zinc-800/60 rounded-lg px-3 py-2">
        <span className="text-xs text-zinc-400">Trợ lý đọc thông báo kết quả:</span>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={handleSpeak}
          className="text-xs flex items-center gap-1.5"
        >
          {speaking ? (
            <>
              <VolumeX className="h-3.5 w-3.5 text-danger" /> Dừng đọc
            </>
          ) : (
            <>
              <Volume2 className="h-3.5 w-3.5 text-accent" /> Nghe cảnh báo
            </>
          )}
        </Button>
      </div>

      {/* Signals */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
          Dấu hiệu phát hiện
        </h4>
        {result.signals && result.signals.length > 0 ? (
          <ul className="space-y-2">
            {result.signals.map((sig, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-200">
                <CircleAlert className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <span>{sig}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500 italic">Không phát hiện dấu hiệu bất thường.</p>
        )}
      </div>

      {/* Legal References */}
      {result.legal_refs && result.legal_refs.length > 0 && (
        <div className="pt-2 border-t border-zinc-800/60">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Căn cứ pháp lý tham chiếu
          </h4>
          <ul className="space-y-2">
            {result.legal_refs.map((ref, i) => (
              <li key={i} className="rounded-lg bg-zinc-950/70 border border-zinc-800 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between text-zinc-200 font-semibold">
                  <span>
                    Điều {ref.dieu} Khoản {ref.khoan} {ref.van_ban ? `(${ref.van_ban})` : ""}
                  </span>
                  {ref.link && (
                    <a
                      href={ref.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-accent hover:underline text-xs"
                    >
                      Xem văn bản <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p className="line-clamp-3 text-zinc-400 leading-relaxed">{ref.noi_dung}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* On-chain context (ONLY when report_count > 0) */}
      {hasOnchainReports && ctx && (
        <div className="pt-2 border-t border-zinc-800/60">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Dữ liệu on-chain Solana
          </h4>
          <dl className="grid grid-cols-2 gap-2 text-xs bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
            <dt className="text-zinc-500">Số báo cáo lừa đảo:</dt>
            <dd className="text-right font-medium text-danger">{ctx.report_count}</dd>
            <dt className="text-zinc-500">Giao dịch gần đây:</dt>
            <dd className="text-right font-medium text-zinc-200">{ctx.recent_tx_count}</dd>
            <dt className="text-zinc-500">Tuổi đời ví:</dt>
            <dd className="text-right font-medium text-zinc-200">
              {ctx.wallet_age_days ? `${ctx.wallet_age_days} ngày` : "—"}
            </dd>
          </dl>
        </div>
      )}
    </Card>
  );
}
