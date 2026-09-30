"use client";

import { useState } from "react";
import { priceImpact, type PoolSymbol } from "@/lib/raydium";
import { ErrorBox, Label, Panel, inputClass, secondaryButtonClass } from "@/components/payment/ui";
import { PoolPicker, fmt, usePoolStats } from "@/components/dex/shared";

const SAMPLE_SIZES = [0.1, 0.5, 1, 5];

/**
 * Read the pool straight from chain: reserves, price, TVL, fee, and how much a trade of a given
 * size would move the price (x * y = k). Tells the player whether the pool is deep enough.
 */
export function LiquidityCheck() {
  const [symbol, setSymbol] = useState<PoolSymbol>("USDC");
  const [custom, setCustom] = useState("1");
  const { stats, error, refresh, loading, updatedAt } = usePoolStats(symbol);

  const customNum = Number(custom.replace(",", ".")) || 0;
  const customImpact = stats ? priceImpact(stats, customNum, true) : null;
  const maxFor1Pct = stats ? stats.solReserve * 0.01 : 0;

  return (
    <div className="w-full space-y-4">
      <PoolPicker value={symbol} onChange={setSymbol} />

      {!stats && !error && <p className="text-sm text-zinc-500">Đang đọc pool trên Solana Devnet...</p>}
      {error && <ErrorBox message={error} />}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["SOL trong pool", `${fmt(stats.solReserve, 3)}`],
              [`${symbol} trong pool`, `${fmt(stats.tokenReserve, 3)}`],
              ["Giá", `${fmt(stats.price, 4)} ${symbol}/SOL`],
              ["Tổng thanh khoản (TVL)", `≈ ${fmt(stats.tvlSol, 2)} SOL`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="text-xs text-zinc-500">{k}</p>
                <p className="mt-1 font-semibold">{v}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            Phí pool {fmt(stats.feePercent, 2)}% (trả cho người cung cấp thanh khoản) ·{" "}
            <a
              className="underline"
              href={`https://solscan.io/account/${stats.poolId}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
            >
              pool {stats.poolId.slice(0, 6)}…
            </a>{" "}
            ·{" "}
            <button type="button" className="underline" onClick={refresh} disabled={loading}>
              {loading ? "đang đọc…" : "làm mới"}
            </button>
            {updatedAt && ` · cập nhật lúc ${updatedAt.toLocaleTimeString("vi-VN")} (tự đọc lại mỗi 15 giây)`}
          </p>

          <div>
            <Label>Bán SOL vào pool thì giá lệch bao nhiêu?</Label>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="py-1">Lệnh</th>
                  <th>Nhận được</th>
                  <th className="text-right">Tác động giá (chưa gồm phí)</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_SIZES.map((size) => {
                  const q = priceImpact(stats, size, true);
                  return (
                    <tr key={size} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="py-1">{fmt(size)} SOL</td>
                      <td>
                        {fmt(q.out, 4)} {symbol}
                      </td>
                      <td
                        className={`text-right font-medium ${q.impactPercent > 5 ? "text-red-600" : q.impactPercent > 1 ? "text-amber-600" : "text-green-700"}`}
                      >
                        {fmt(q.impactPercent, 2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="w-40">
              <Label>Thử lệnh của bạn (SOL)</Label>
              <input value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="decimal" className={inputClass} />
            </div>
            {customImpact && (
              <p className="pb-2 text-sm">
                → nhận ≈ {fmt(customImpact.out, 4)} {symbol}, lệch giá <b>{fmt(customImpact.impactPercent, 2)}%</b>
              </p>
            )}
          </div>

          <Panel tone={maxFor1Pct < 0.5 ? "red" : maxFor1Pct < 5 ? "yellow" : "green"}>
            <p className="text-sm font-medium">
              {maxFor1Pct < 0.5 ? "🔴 Pool mỏng" : maxFor1Pct < 5 ? "🟡 Pool trung bình" : "🟢 Pool sâu"} — lệnh tối đa khoảng{" "}
              {fmt(maxFor1Pct, 3)} SOL để giá lệch dưới ~1% (phí pool tính riêng).
            </p>
            <p className="mt-1 text-xs">
              Pool càng nhiều tiền, đổi càng ít lệch giá. Muốn pool sâu hơn: cung cấp thanh khoản ở tab bên cạnh và nhận phí{" "}
              {fmt(stats.feePercent, 2)}% mỗi lệnh.
            </p>
          </Panel>

          <button type="button" className={secondaryButtonClass} onClick={refresh} disabled={loading}>
            {loading ? "Đang đọc pool trên chain…" : "↻ Đọc lại pool"}
          </button>
        </>
      )}
    </div>
  );
}
