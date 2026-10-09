"use client";

import React from "react";
import { ShieldAlert, AlertTriangle, CircleAlert, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { RiskAnalysis } from "@/lib/risk-types";

type Props = {
  open: boolean;
  analysis: RiskAnalysis | null;
  onContinue: () => void;
  onCancel: () => void;
};

export function RiskWarningModal({ open, analysis, onContinue, onCancel }: Props) {
  if (!open) return null;

  const score = analysis?.risk_score ?? 0;
  const isSevere = score >= 70;
  const ctx = analysis?.on_chain_context;
  const hasOnchainReports = ctx && typeof ctx.report_count === "number" && ctx.report_count > 0;

  const handleContinueWithConfirm = () => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "CẢNH BÁO: Giao dịch có nguy cơ thất thoát tài sản. Bạn có chắc chắn muốn bỏ qua cảnh báo và tiếp tục ký?",
      );
      if (!confirmed) return;
    }
    onContinue();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="w-full sm:max-w-lg bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/50 animate-scale-in p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {isSevere ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
                <ShieldAlert className="h-6 w-6 animate-pulse" />
              </div>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                <AlertTriangle className="h-6 w-6" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-zinc-100">
                {isSevere ? "Nguy hiểm cao" : "Cảnh báo rủi ro"}
              </h2>
              <p className="text-xs text-zinc-400">
                AI phát hiện dấu hiệu bất thường. Hãy kiểm tra kỹ trước khi ký.
              </p>
            </div>
          </div>
          <Badge variant={isSevere ? "danger" : "warning"} className={isSevere ? "animate-pulse" : ""}>
            {isSevere ? "RỦI RO CAO" : "CẢNH BÁO"}
          </Badge>
        </div>

        {/* Risk Score */}
        <div className="mt-5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 p-4">
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-extrabold ${isSevere ? "text-danger" : "text-warning"}`}>
              {score}
            </span>
            <span className="text-sm font-medium text-zinc-500">/ 100</span>
            <span className="ml-auto text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {analysis?.label ?? "UNKNOWN"}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Điểm số tổng hợp từ mô hình phân tích ngôn ngữ tự nhiên (NLP) và lịch sử on-chain.
          </p>
        </div>

        {/* Signals */}
        {!!analysis?.signals?.length && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
              Dấu hiệu phát hiện ({analysis.signals.length})
            </p>
            <ul className="space-y-2">
              {analysis.signals.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                  <CircleAlert className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Legal Refs */}
        {!!analysis?.legal_refs?.length && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
              Căn cứ pháp lý tham khảo
            </p>
            <ul className="space-y-2.5">
              {analysis.legal_refs.map((r, i) => (
                <li key={i} className="rounded-lg bg-zinc-900/80 border border-zinc-800 p-2.5 text-xs">
                  <div className="flex items-center justify-between text-zinc-200 font-semibold mb-1">
                    <span>
                      Điều {r.dieu} Khoản {r.khoan}
                    </span>
                    {r.link && (
                      <a
                        href={r.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-accent hover:underline text-xs"
                      >
                        Văn bản luật <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="line-clamp-2 text-zinc-400 leading-relaxed">{r.noi_dung}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* On-chain context (ONLY shown when report_count > 0) */}
        {hasOnchainReports && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
              Dữ liệu on-chain
            </p>
            <dl className="grid grid-cols-2 gap-2 text-xs">
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

        {/* Footer Actions */}
        <div className="mt-6 flex flex-col gap-2.5">
          <Button variant="secondary" size="lg" className="w-full" onClick={onCancel}>
            Hủy giao dịch
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-zinc-500 hover:text-zinc-300"
            onClick={handleContinueWithConfirm}
          >
            Vẫn tiếp tục (tôi tự chịu rủi ro)
          </Button>
        </div>
      </div>
    </div>
  );
}
