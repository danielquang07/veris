"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TokenChecklist } from "@/components/shield/TokenReportCard";
import type { TokenRiskReport } from "@/lib/tokenRisk";

type Props = {
  report: TokenRiskReport | null;
  action: string; // Vietnamese verb shown in the title, e.g. "mua", "nạp thanh khoản"
  onCancel: () => void;
  onContinue: () => void;
};

/** Veris Shield popup shown before the wallet opens when the token is dangerous */
export function TokenGuardModal({ report, action, onCancel, onContinue }: Props) {
  if (!report) return null;

  const continueAnyway = () => {
    if (window.confirm(`Token này bị đánh giá NGUY HIỂM. Bạn vẫn muốn ${action}?`)) onContinue();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-zinc-950 border border-red-900/60 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-950/60 border border-red-800/60 text-red-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Veris Shield chặn lại</p>
            <h2 className="text-lg font-bold text-zinc-100">
              Token {report.symbol ?? "không tên"} nguy hiểm — {report.riskScore}/100
            </h2>
            <p className="text-sm text-zinc-300 mt-1">{report.summary}</p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Đọc trực tiếp trên Solana</p>
          <TokenChecklist report={report} />
        </div>

        <div className="space-y-2">
          <Button variant="primary" size="lg" className="w-full" onClick={onCancel}>
            Hủy, không {action}
          </Button>
          <button type="button" onClick={continueAnyway} className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1">
            Vẫn {action} (tôi tự chịu rủi ro)
          </button>
        </div>
      </div>
    </div>
  );
}
