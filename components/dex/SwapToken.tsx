"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { buildSwapTx, DEX_POOLS, explainTxError, fromBaseUnits, priceImpact, sendTx, type PoolSymbol } from "@/lib/raydium";
import { useAnalyzeBeforeSign } from "@/hooks/useAnalyzeBeforeSign";
import { RiskWarningModal } from "@/components/dex/RiskWarningModal";
import { VoiceButton } from "@/components/dex/VoiceButton";
import { ErrorBox, Label, Panel, inputClass } from "@/components/payment/ui";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PoolPicker, TxList, WalletHint, fmt, usePoolStats, useWalletBalances, type TxLog } from "@/components/dex/shared";

const SLIPPAGES = [10, 50, 100];

/** Swap SOL <-> test token through the Raydium CPMM pool (same pools as the main game's DEX) */
export function SwapToken() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { checkBeforeSign, pending, analysis, loading, userContinue, userCancel } = useAnalyzeBeforeSign();
  const [symbol, setSymbol] = useState<PoolSymbol>("USDC");
  const [solToToken, setSolToToken] = useState(true);
  const [amount, setAmount] = useState("0.1");
  const [memo, setMemo] = useState("");
  const [slippageBps, setSlippageBps] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<TxLog[]>([]);
  const { stats, error: poolError, refresh } = usePoolStats(symbol);
  const { balances, refresh: refreshBalances } = useWalletBalances(symbol);

  const inSym = solToToken ? "SOL" : symbol;
  const outSym = solToToken ? symbol : "SOL";
  const amountNum = Math.max(0, Number(amount.replace(",", ".")) || 0);
  const quote = stats ? priceImpact(stats, amountNum, solToToken) : null;
  const minOut = quote ? quote.out * (1 - slippageBps / 10_000) : 0;

  async function swap() {
    if (!publicKey) return setError("Kết nối ví Phantom (Devnet) trước.");
    setBusy(true);
    setError(null);
    try {
      const decision = await checkBeforeSign({
        tokenMint: DEX_POOLS[symbol].mint,
        txType: "swap",
        // Only the user's own note is scored. The model rates the auto-generated English
        // "swap 0.1 SOL -> USDC" line as ~97% scam, so every plain swap would trigger the modal.
        text: memo.trim(),
        metadata: { symbol, amount, slippageBps },
      });
      if (!decision.proceed) {
        setBusy(false);
        return;
      }
      const { tx, expectedOut } = await buildSwapTx(connection, publicKey, symbol, solToToken, amount, slippageBps);
      const res = await sendTx(connection, sendTransaction, tx);
      setLogs((l) => [{ label: `Swap ${amount} ${inSym} → ~${expectedOut} ${outSym}`, link: res.solscanLink }, ...l]);
      await Promise.all([refresh(), refreshBalances()]);
    } catch (e) {
      setError(explainTxError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-4">
      <WalletHint />
      <PoolPicker value={symbol} onChange={setSymbol} />

      <Card className="p-4 space-y-3">
        <Label>Bạn bán</Label>
        <div className="flex gap-2">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={inputClass} />
          <span className="self-center font-medium">{inSym}</span>
        </div>
        {balances && (
          <p className="mt-1 text-xs text-zinc-500">
            Số dư: {solToToken ? fromBaseUnits(balances.sol, 9) : fromBaseUnits(balances.token, 6)} {inSym}
          </p>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>Ghi chú giao dịch (tùy chọn)</Label>
            <button
              type="button"
              onClick={() => setMemo("Chúc mừng bạn đã trúng thưởng 10 triệu, cung cấp OTP để nhận")}
              className="text-[11px] text-accent hover:underline flex items-center gap-1"
            >
              ⚡ Thử mẫu tin nhắn lừa đảo
            </button>
          </div>
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Nhập ghi chú hoặc bấm thử mẫu để test AI Scam Guard..."
            className={inputClass}
          />
          {memo && (
            <button
              type="button"
              onClick={() => setMemo("")}
              className="mt-1 text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              ✕ Xóa ghi chú (quay lại swap thông thường)
            </button>
          )}
        </div>

        <div className="mt-2">
          <VoiceButton
            onText={(t) => {
              const m = t.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
              if (m) setAmount(m[1]);
              else setMemo(t);
            }}
            speakText={
              analysis && analysis.risk_score >= 70
                ? `Cảnh báo rủi ro ${analysis.risk_score} phần trăm. ${analysis.signals.slice(0, 3).join(". ")}`
                : null
            }
          />
        </div>
        <div className="my-2 flex justify-center">
          <Button variant="secondary" size="sm" type="button" onClick={() => setSolToToken((v) => !v)}>
            <ArrowUpDown className="h-4 w-4" /> Đảo chiều
          </Button>
        </div>
        <Label>Bạn nhận (ước tính)</Label>
        <p className="text-2xl font-semibold">
          {quote ? fmt(quote.out, 6) : "—"} {outSym}
        </p>
      </Card>


      <div>
        <Label>Trượt giá chấp nhận</Label>
        <div className="flex gap-2">
          {SLIPPAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSlippageBps(s)}
              className={`rounded-full border px-3 py-1 text-xs ${slippageBps === s ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-zinc-300 dark:border-zinc-700"}`}
            >
              {(s / 100).toLocaleString("vi-VN")}%
            </button>
          ))}
        </div>
      </div>

      {stats && quote && (
        <Card className="p-4 border-zinc-800">
          <dl className="grid grid-cols-2 gap-1.5 text-sm">
            <dt className="text-zinc-400">Giá pool</dt>
            <dd className="text-right font-medium">1 SOL = {fmt(stats.price, 6)} {symbol}</dd>
            <dt className="text-zinc-400">Nhận tối thiểu</dt>
            <dd className="text-right font-medium">{fmt(minOut, 6)} {outSym}</dd>
            <dt className="text-zinc-400">Tác động giá</dt>
            <dd className={`text-right font-semibold ${quote.impactPercent > 5 ? "text-danger" : quote.impactPercent > 1 ? "text-warning" : "text-safe"}`}>
              {fmt(quote.impactPercent, 2)}%
            </dd>
            <dt className="text-zinc-400">Phí pool</dt>
            <dd className="text-right font-medium">{fmt(stats.feePercent, 2)}%</dd>
          </dl>
          {quote.impactPercent > 5 && (
            <p className="mt-2 text-xs text-danger">⚠ Pool mỏng so với lệnh này — xem tab Kiểm tra thanh khoản hoặc giảm số lượng.</p>
          )}
        </Card>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full py-3"
        onClick={swap}
        disabled={busy || loading || !publicKey || amountNum <= 0}
      >
        {loading ? "Đang kiểm tra rủi ro..." : busy ? "Đang mô phỏng & chờ ký ví..." : `Ký và đổi ${inSym} → ${outSym}`}
      </Button>

      {(error || poolError) && <ErrorBox message={error ?? poolError!} />}
      <TxList logs={logs} />
      <RiskWarningModal open={pending !== null} analysis={analysis} onContinue={userContinue} onCancel={userCancel} />
    </div>
  );
}
