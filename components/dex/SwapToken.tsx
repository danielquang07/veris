"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { buildSwapTx, explainTxError, fromBaseUnits, priceImpact, sendTx, type PoolSymbol } from "@/lib/raydium";
import { ErrorBox, Label, Panel, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/payment/ui";
import { PoolPicker, TxList, WalletHint, fmt, usePoolStats, useWalletBalances, type TxLog } from "@/components/dex/shared";

const SLIPPAGES = [10, 50, 100];

/** Swap SOL <-> test token through the Raydium CPMM pool (same pools as the main game's DEX) */
export function SwapToken() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [symbol, setSymbol] = useState<PoolSymbol>("USDC");
  const [solToToken, setSolToToken] = useState(true);
  const [amount, setAmount] = useState("0.1");
  const [slippageBps, setSlippageBps] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<TxLog[]>([]);
  const { stats, error: poolError, refresh } = usePoolStats(symbol);
  const { balances, refresh: refreshBalances } = useWalletBalances(symbol);

  const inSym = solToToken ? "SOL" : symbol;
  const outSym = solToToken ? symbol : "SOL";
  const amountNum = Number(amount.replace(",", ".")) || 0;
  const quote = stats ? priceImpact(stats, amountNum, solToToken) : null;
  const minOut = quote ? quote.out * (1 - slippageBps / 10_000) : 0;

  async function swap() {
    if (!publicKey) return setError("Kết nối ví Phantom (Devnet) trước.");
    setBusy(true);
    setError(null);
    try {
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

      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
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
        <div className="my-3 flex justify-center">
          <button type="button" className={secondaryButtonClass} onClick={() => setSolToToken((v) => !v)}>
            ⇅ Đảo chiều
          </button>
        </div>
        <Label>Bạn nhận (ước tính)</Label>
        <p className="text-2xl font-semibold">
          {quote ? fmt(quote.out, 6) : "—"} {outSym}
        </p>
      </div>

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
        <Panel tone={quote.impactPercent > 5 ? "red" : quote.impactPercent > 1 ? "yellow" : "neutral"}>
          <dl className="grid grid-cols-2 gap-1 text-sm">
            <dt>Giá pool</dt>
            <dd className="text-right">1 SOL = {fmt(stats.price, 6)} {symbol}</dd>
            <dt>Nhận tối thiểu</dt>
            <dd className="text-right">{fmt(minOut, 6)} {outSym}</dd>
            <dt>Tác động giá</dt>
            <dd className="text-right font-medium">{fmt(quote.impactPercent, 2)}%</dd>
            <dt>Phí pool</dt>
            <dd className="text-right">{fmt(stats.feePercent, 2)}%</dd>
          </dl>
          {quote.impactPercent > 5 && (
            <p className="mt-2 text-xs">⚠ Pool mỏng so với lệnh này — xem tab Kiểm tra thanh khoản hoặc giảm số lượng.</p>
          )}
        </Panel>
      )}

      <button onClick={swap} disabled={busy || !publicKey || amountNum <= 0} className={primaryButtonClass}>
        {busy ? "Đang mô phỏng & chờ ký ví..." : `Ký và đổi ${inSym} → ${outSym}`}
      </button>

      {(error || poolError) && <ErrorBox message={error ?? poolError!} />}
      <TxList logs={logs} />
    </div>
  );
}
