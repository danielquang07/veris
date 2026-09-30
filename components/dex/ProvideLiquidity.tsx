"use client";

import BN from "bn.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import {
  buildAddLiquidityTx,
  buildWithdrawLiquidityTx,
  explainTxError,
  fromBaseUnits,
  sendTx,
  type PoolSymbol,
} from "@/lib/raydium";
import { ErrorBox, Label, Panel, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/payment/ui";
import { PoolPicker, TxList, WalletHint, fmt, usePoolStats, useWalletBalances, type TxLog } from "@/components/dex/shared";

/**
 * Add liquidity: deposit SOL + token at the pool ratio, receive LP tokens and earn the pool fee.
 * Remove liquidity: burn LP tokens, get back your share of both reserves.
 */
export function ProvideLiquidity() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [symbol, setSymbol] = useState<PoolSymbol>("USDC");
  const [solAmount, setSolAmount] = useState("0.01");
  const [withdrawPct, setWithdrawPct] = useState(100);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<TxLog[]>([]);
  const { stats, error: poolError, refresh } = usePoolStats(symbol);
  const { balances, refresh: refreshBalances } = useWalletBalances(symbol, stats?.lpMint);

  const solNum = Math.max(0, Number(solAmount.replace(",", ".")) || 0);
  const tokenNeeded = stats ? solNum * stats.price : 0;
  const lpSupply = stats ? Number(stats.lpSupply.toString()) : 0;
  const myLp = balances ? Number(balances.lp.toString()) : 0;
  const myShare = lpSupply > 0 ? myLp / lpSupply : 0;
  const tokenBalance = balances ? Number(balances.token.toString()) / 1e6 : 0;
  const notEnoughToken = !!balances && tokenNeeded > tokenBalance;

  async function run(label: string, build: () => Promise<{ tx: import("@solana/web3.js").Transaction }>) {
    if (!publicKey) return setError("Kết nối ví Phantom (Devnet) trước.");
    setBusy(label);
    setError(null);
    try {
      const { tx } = await build();
      const res = await sendTx(connection, sendTransaction, tx);
      setLogs((l) => [{ label, link: res.solscanLink }, ...l]);
      await Promise.all([refresh(), refreshBalances()]);
    } catch (e) {
      setError(explainTxError(e));
    } finally {
      setBusy(null);
    }
  }

  const withdrawLp = balances ? balances.lp.muln(withdrawPct).divn(100) : new BN(0);

  return (
    <div className="w-full space-y-4">
      <WalletHint />
      <PoolPicker value={symbol} onChange={setSymbol} />

      {stats && (
        <p className="text-xs text-zinc-500">
          Pool hiện có {fmt(stats.solReserve, 3)} SOL + {fmt(stats.tokenReserve, 3)} {symbol} · phí {fmt(stats.feePercent, 2)}% mỗi
          lệnh swap được chia cho người giữ LP theo tỉ lệ.
        </p>
      )}

      {/* ---------- Add ---------- */}
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="font-medium">➕ Nạp thanh khoản</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Số SOL nạp</Label>
            <input value={solAmount} onChange={(e) => setSolAmount(e.target.value)} inputMode="decimal" className={inputClass} />
            {balances && <p className="mt-1 text-xs text-zinc-500">Số dư: {fromBaseUnits(balances.sol, 9)} SOL</p>}
          </div>
          <div>
            <Label>{symbol} đi kèm (theo tỉ lệ pool)</Label>
            <p className="rounded-lg border border-zinc-200 p-2.5 font-mono text-sm dark:border-zinc-800">≈ {fmt(tokenNeeded, 6)}</p>
            {balances && (
              <p className={`mt-1 text-xs ${notEnoughToken ? "text-red-600" : "text-zinc-500"}`}>
                Số dư: {fmt(tokenBalance, 6)} {symbol}
              </p>
            )}
          </div>
        </div>
        {notEnoughToken && (
          <p className="mt-2 text-xs text-red-600">
            Chưa đủ {symbol}. Qua tab <b>Swap token</b> đổi một ít SOL → {symbol} trước, rồi quay lại nạp.
          </p>
        )}
        <button
          className={`${primaryButtonClass} mt-3`}
          disabled={!!busy || !publicKey || solNum <= 0 || notEnoughToken}
          onClick={() =>
            run(`Nạp ${solAmount} SOL + ${fmt(tokenNeeded, 6)} ${symbol}`, () =>
              buildAddLiquidityTx(connection, publicKey!, symbol, solAmount)
            )
          }
        >
          {busy?.startsWith("Nạp") ? "Đang mô phỏng & chờ ký ví..." : "Ký và nạp thanh khoản"}
        </button>
      </div>

      {/* ---------- Position / remove ---------- */}
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="font-medium">📜 Vị thế của bạn</p>
        {!publicKey ? (
          <p className="mt-1 text-sm text-zinc-500">Kết nối ví để xem LP token.</p>
        ) : myLp === 0 ? (
          <p className="mt-1 text-sm text-zinc-500">Bạn chưa có LP token trong pool này.</p>
        ) : (
          stats && (
            <>
              <dl className="mt-2 grid grid-cols-2 gap-1 text-sm">
                <dt>LP token</dt>
                <dd className="text-right font-mono">{fromBaseUnits(balances!.lp, stats.lpDecimals, 9)}</dd>
                <dt>Tỉ lệ sở hữu pool</dt>
                <dd className="text-right">{fmt(myShare * 100, 4)}%</dd>
                <dt>Giá trị hiện tại</dt>
                <dd className="text-right">
                  ≈ {fmt(stats.solReserve * myShare, 6)} SOL + {fmt(stats.tokenReserve * myShare, 6)} {symbol}
                </dd>
              </dl>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Label>Rút</Label>
                {[25, 50, 100].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setWithdrawPct(p)}
                    className={`rounded-full border px-3 py-1 text-xs ${withdrawPct === p ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-zinc-300 dark:border-zinc-700"}`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
              <button
                className={`${secondaryButtonClass} mt-3`}
                disabled={!!busy || withdrawLp.isZero()}
                onClick={() =>
                  run(`Rút ${withdrawPct}% thanh khoản`, () =>
                    buildWithdrawLiquidityTx(connection, publicKey!, symbol, withdrawLp)
                  )
                }
              >
                {busy?.startsWith("Rút") ? "Đang mô phỏng & chờ ký ví..." : `Ký và rút ${withdrawPct}%`}
              </button>
            </>
          )
        )}
      </div>

      <Panel tone="neutral">
        <p className="text-xs">
          <b>Vì sao nên cung cấp thanh khoản?</b> Pool càng sâu thì người chơi đổi token càng ít bị lệch giá; đổi lại bạn nhận
          phần phí của mọi lệnh swap. Rủi ro: khi giá SOL/{symbol} đổi mạnh, tỉ lệ hai token bạn rút ra sẽ khác lúc nạp
          (tạm thời thua lỗ — impermanent loss).
        </p>
      </Panel>

      {(error || poolError) && <ErrorBox message={error ?? poolError!} />}
      <TxList logs={logs} />
    </div>
  );
}
