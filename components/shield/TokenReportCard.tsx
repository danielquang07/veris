"use client";

import React, { useState } from "react";
import { Buffer } from "buffer";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { CircleCheck, CircleHelp, CircleX, TriangleAlert, ExternalLink, FileCheck, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { buildEvidenceTx } from "@/lib/writeChain";
import { DEX_POOLS } from "@/lib/raydium";
import type { CheckStatus, RiskLevel, TokenRiskReport } from "@/lib/tokenRisk";

// Test tokens of this DEX have no on-chain name; label them so users recognise what they swapped into
const DEX_TOKEN_NAMES: Record<string, string> = {
  [DEX_POOLS.USDC.mint]: "USDC thử của sàn",
  [DEX_POOLS.USDT.mint]: "USDT thử của sàn",
};

export function tokenDisplayName(mint: string, symbol: string | null) {
  const known = DEX_TOKEN_NAMES[mint];
  if (symbol) return known ? `${symbol} (${known})` : symbol;
  return known ? `${known}, không có tên trên chain` : "Token không tên";
}

export const LEVEL_UI: Record<RiskLevel, { title: string; badge: "danger" | "warning" | "safe"; text: string }> = {
  danger: { title: "Nguy hiểm", badge: "danger", text: "text-red-400" },
  caution: { title: "Cần cẩn thận", badge: "warning", text: "text-amber-400" },
  safe: { title: "An toàn", badge: "safe", text: "text-emerald-400" },
};

const STATUS_ICON: Record<CheckStatus, React.ReactNode> = {
  pass: <CircleCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />,
  warn: <TriangleAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />,
  fail: <CircleX className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />,
  unknown: <CircleHelp className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />,
};

/** VERISHIELD memo: verdict in clear text + SHA-256 of the full report, so the report can be verified later */
async function buildShieldMemo(report: TokenRiskReport): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(report)));
  const hash = Buffer.from(digest).toString("hex");
  return `VERISHIELD|v1|mint=${report.mint}|level=${report.level}|score=${report.riskScore}|sha256=${hash}`;
}

export function TokenChecklist({ report }: { report: TokenRiskReport }) {
  return (
    <ul className="space-y-2.5">
      {report.checks.map((c) => (
        <li key={c.id} className="flex gap-2.5">
          {STATUS_ICON[c.status]}
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-200">{c.label}</p>
            <p className="text-xs text-zinc-400 leading-relaxed">{c.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TokenReportCard({ report }: { report: TokenRiskReport }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const ui = LEVEL_UI[report.level];

  const saveEvidence = async () => {
    if (!publicKey) {
      setSaveError("Kết nối ví Phantom (Devnet) ở góc trên để lưu báo cáo lên Solana.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const tx = await buildEvidenceTx(connection, publicKey, await buildShieldMemo(report));
      const sig = await sendTransaction(tx, connection);
      const blockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, ...blockhash }, "confirmed");
      setLink(`https://solscan.io/tx/${sig}?cluster=devnet`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Không lưu được báo cáo lên Solana.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5 space-y-5 bg-zinc-900/90 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`text-lg font-bold ${ui.text}`}>{ui.title}</h3>
            <Badge variant={ui.badge}>{tokenDisplayName(report.mint, report.symbol)}</Badge>
          </div>
          <p className="text-sm text-zinc-300 mt-1">{report.summary}</p>
          <p className="text-xs text-zinc-500 font-mono mt-1 break-all">{report.mint}</p>
        </div>
        <div className="text-right shrink-0">
          <span className={`text-3xl font-bold ${ui.text}`}>{report.riskScore}</span>
          <span className="text-xs text-zinc-500">/100</span>
          <p className="text-[11px] text-zinc-500">điểm rủi ro</p>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
          Kiểm tra trực tiếp trên Solana
        </h4>
        <TokenChecklist report={report} />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button variant="secondary" size="sm" onClick={saveEvidence} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang ghi lên Solana...
            </>
          ) : (
            <>
              <FileCheck className="h-3.5 w-3.5 text-accent" /> Lưu báo cáo lên Solana
            </>
          )}
        </Button>
        <a
          href={`https://solscan.io/token/${report.mint}?cluster=devnet`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-zinc-400 hover:text-zinc-200 underline inline-flex items-center gap-1"
        >
          Xem token trên Solscan <ExternalLink className="h-3 w-3" />
        </a>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 underline inline-flex items-center gap-1">
            Đã lưu báo cáo (Solscan) <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      {saveError && <p className="text-xs text-red-400">⚠ {saveError}</p>}
    </Card>
  );
}
