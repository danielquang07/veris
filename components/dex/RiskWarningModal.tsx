"use client";

import { Panel, primaryButtonClass, secondaryButtonClass } from "@/components/payment/ui";
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
  const ctx = analysis?.on_chain_context;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-950">
        <h2 className="text-lg font-bold text-red-700 dark:text-red-400">⚠ Cảnh báo rủi ro cao</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          AI phát hiện dấu hiệu lừa đảo trong giao dịch này. Hãy kiểm tra kỹ trước khi ký.
        </p>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-4xl font-extrabold text-red-600">{score}</span>
          <span className="text-sm font-medium text-zinc-500">/ 100 · {analysis?.label ?? "UNKNOWN"}</span>
        </div>

        {!!analysis?.signals?.length && (
          <Panel tone="red">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide">Dấu hiệu</p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {analysis.signals.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </Panel>
        )}

        {!!analysis?.legal_refs?.length && (
          <Panel tone="yellow">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide">Căn cứ pháp lý tham khảo</p>
            <ul className="space-y-2 text-sm">
              {analysis.legal_refs.map((r, i) => (
                <li key={i}>
                  <span className="font-medium">
                    Điều {r.dieu} Khoản {r.khoan}
                  </span>
                  {" — "}
                  {r.noi_dung}
                  {r.link && (
                    <>
                      {" "}
                      <a href={r.link} target="_blank" rel="noreferrer" className="underline">
                        Xem văn bản
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {ctx && (
          <Panel tone="neutral">
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt>Số báo cáo on-chain</dt>
              <dd className="text-right font-medium">{ctx.report_count}</dd>
              <dt>Giao dịch gần đây</dt>
              <dd className="text-right font-medium">{ctx.recent_tx_count}</dd>
              <dt>Tuổi ví (ngày)</dt>
              <dd className="text-right font-medium">{ctx.wallet_age_days ?? "—"}</dd>
            </dl>
          </Panel>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button type="button" onClick={onCancel} className={primaryButtonClass}>
            Hủy giao dịch
          </button>
          <button type="button" onClick={onContinue} className={secondaryButtonClass}>
            Tiếp tục (tôi chấp nhận rủi ro)
          </button>
        </div>
      </div>
    </div>
  );
}
