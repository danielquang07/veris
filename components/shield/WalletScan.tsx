"use client";

import React, { useState } from "react";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ExternalLink, KeyRound, Lock, ScanSearch, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { LEVEL_UI, tokenDisplayName } from "@/components/shield/TokenReportCard";
import { isValidAddress, shortenAddress } from "@/lib/address";
import { explainTxError, sendTx } from "@/lib/raydium";
import { approveInstruction, revokeInstruction } from "@/lib/tokenInstructions";
import type { Holding, WalletScanResult } from "@/lib/walletScan";

/** presetOwner: address handed over from the token tab; showDemo: reveal the approval simulator (?demo in the URL) */
export function WalletScan({ presetOwner = "", showDemo = false }: { presetOwner?: string; showDemo?: boolean }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [owner, setOwner] = useState(presetOwner);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WalletScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAccount, setBusyAccount] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<{ label: string; link: string } | null>(null);

  const target = owner.trim() || publicKey?.toBase58() || "";
  const isOwnWallet = !!publicKey && result?.owner === publicKey.toBase58();

  const scan = async (address = target) => {
    if (!isValidAddress("sol", address)) return setError("Nhập địa chỉ ví Solana, hoặc kết nối Phantom ở góc trên.");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/wallet-scan?owner=${encodeURIComponent(address)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Lỗi ${res.status}`);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không quét được ví lúc này.");
    } finally {
      setLoading(false);
    }
  };

  const signAndRescan = async (h: Holding, label: string, build: () => Transaction) => {
    setBusyAccount(h.account);
    setError(null);
    try {
      const res = await sendTx(connection, sendTransaction, build());
      setLastTx({ label, link: res.solscanLink });
      await scan(result!.owner);
    } catch (e) {
      setError(explainTxError(e));
    } finally {
      setBusyAccount(null);
    }
  };

  const revoke = (h: Holding) =>
    signAndRescan(h, `Đã thu hồi quyền trên ${h.symbol ?? shortenAddress(h.mint)}`, () =>
      new Transaction().add(revokeInstruction(new PublicKey(h.account), publicKey!, new PublicKey(h.tokenProgram)))
    );

  // Devnet demo only: reproduce the "signed a malicious approval" mistake on one of your own tokens
  const simulateApproval = () => {
    const h = result?.holdings.find((x) => !x.delegate && !x.frozen && BigInt(x.rawAmount) > BigInt(0));
    if (!h) return setError("Ví chưa có token nào để mô phỏng. Swap một ít SOL lấy token trước.");
    const stranger = Keypair.generate().publicKey;
    return signAndRescan(h, `Mô phỏng: đã cấp quyền cho ví lạ ${shortenAddress(stranger.toBase58())}`, () =>
      new Transaction().add(
        approveInstruction(new PublicKey(h.account), stranger, publicKey!, BigInt(h.rawAmount), new PublicKey(h.tokenProgram))
      )
    );
  };

  return (
    <div className="space-y-5">
      <Card className="bg-zinc-900/60 p-5 space-y-4">
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder={publicKey ? `Để trống = quét ví đang kết nối (${shortenAddress(publicKey.toBase58())})` : "Địa chỉ ví Solana..."}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3.5 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 placeholder:font-sans focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <Button variant="primary" size="lg" className="w-full" onClick={() => scan()} disabled={loading || !target}>
          <ScanSearch className="h-4 w-4" /> {loading ? "Đang đọc ví trên Solana..." : "Quét ví"}
        </Button>
      </Card>

      {error && <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg p-3">⚠ {error}</p>}
      {lastTx && (
        <a href={lastTx.link} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 underline inline-flex items-center gap-1">
          {lastTx.label} (Solscan) <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {loading && !result && (
        <Card className="p-5 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </Card>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              [`${result.solBalance.toLocaleString("vi-VN", { maximumFractionDigits: 4 })}`, "SOL trong ví", "text-zinc-100"],
              [result.holdings.length, "Loại token khác", "text-zinc-100"],
              [result.approvals, "Quyền rút đang mở", result.approvals ? "text-red-400" : "text-emerald-400"],
              [result.dangerousTokens, "Token nguy hiểm", result.dangerousTokens ? "text-red-400" : "text-emerald-400"],
              [result.frozen, "Token bị khóa", result.frozen ? "text-red-400" : "text-emerald-400"],
            ].map(([n, label, color]) => (
              <Card key={label as string} className="p-3">
                <p className={`text-2xl font-bold ${color}`}>{n}</p>
                <p className="text-[11px] text-zinc-400">{label as string}</p>
              </Card>
            ))}
          </div>
          <p className="text-[11px] text-zinc-500 -mt-2">
            Đọc thẳng trên Solana: token đã ẩn trong Phantom vẫn hiện ở đây, vì ẩn chỉ là giấu khỏi màn hình ví.
          </p>

          <div className="space-y-3">
            {result.holdings.length === 0 && <p className="text-sm text-zinc-400">Ví này chưa giữ token nào.</p>}
            {result.holdings.map((h) => {
              const ui = h.level ? LEVEL_UI[h.level] : null;
              return (
                <Card key={h.account} className={`p-4 space-y-2 ${h.delegate ? "border-red-900/70" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-zinc-100">{tokenDisplayName(h.mint, h.symbol)}</span>
                        {ui && <Badge variant={ui.badge}>{ui.title}</Badge>}
                      </div>
                      <p className="text-[11px] text-zinc-500 font-mono break-all">{h.mint}</p>
                      {h.summary && h.level !== "safe" && <p className="text-xs text-zinc-400 mt-1">{h.summary}</p>}
                    </div>
                    <p className="text-sm font-medium text-zinc-200 shrink-0">{h.amount}</p>
                  </div>

                  {h.delegate && (
                    <div className="rounded-lg bg-red-950/40 border border-red-900/50 p-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-red-300 flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5 shrink-0" />
                        Ví lạ {shortenAddress(h.delegate)} được phép rút {h.delegatedAmount} token này mà không cần hỏi bạn.
                      </p>
                      {isOwnWallet && (
                        <Button variant="primary" size="sm" onClick={() => revoke(h)} disabled={!!busyAccount}>
                          {busyAccount === h.account ? "Đang thu hồi..." : "Thu hồi quyền"}
                        </Button>
                      )}
                    </div>
                  )}
                  {h.frozen && (
                    <p className="text-xs text-amber-300 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" /> Người tạo token đã khóa số token này trong ví bạn: không chuyển, không bán được.
                    </p>
                  )}
                </Card>
              );
            })}
          </div>

          {isOwnWallet && showDemo && (
            <div className="rounded-lg border border-dashed border-zinc-700 p-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> Demo devnet: tái hiện việc lỡ ký cấp quyền cho một ví lạ.
              </p>
              <Button variant="secondary" size="sm" onClick={simulateApproval} disabled={!!busyAccount}>
                Mô phỏng cấp quyền
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
