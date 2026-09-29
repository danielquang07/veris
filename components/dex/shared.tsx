"use client";

import BN from "bn.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import { DEX_POOLS, getBalances, getPoolStats, type PoolStats, type PoolSymbol } from "@/lib/raydium";
import { Label } from "@/components/payment/ui";

export const POOL_SYMBOLS: PoolSymbol[] = ["USDC", "USDT"];

export function PoolPicker({ value, onChange }: { value: PoolSymbol; onChange: (s: PoolSymbol) => void }) {
  return (
    <div>
      <Label>Cặp giao dịch (Raydium CPMM · Devnet)</Label>
      <div className="flex gap-2">
        {POOL_SYMBOLS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              value === s
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            SOL / {s} thử
          </button>
        ))}
      </div>
    </div>
  );
}

/** Pool reserves, refreshed every 15s and on demand */
export function usePoolStats(symbol: PoolSymbol) {
  const { connection } = useConnection();
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStats(await getPoolStats(connection, symbol));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [connection, symbol]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refresh]);

  return { stats: stats?.symbol === symbol ? stats : null, error, refresh };
}

/** SOL, pool token and LP balances of the connected wallet */
export function useWalletBalances(symbol: PoolSymbol, lpMint?: string) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balances, setBalances] = useState<{ sol: BN; token: BN; lp: BN } | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) return setBalances(null);
    try {
      const mints = [DEX_POOLS[symbol].mint, ...(lpMint ? [lpMint] : [])];
      const res = await getBalances(connection, publicKey, mints);
      setBalances({
        sol: res.sol,
        token: res.tokens[DEX_POOLS[symbol].mint],
        lp: lpMint ? res.tokens[lpMint] : new BN(0),
      });
    } catch {
      // keep the previous numbers; the next refresh will retry
    }
  }, [connection, publicKey, symbol, lpMint]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 20_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refresh]);

  return { balances, refresh };
}

export type TxLog = { label: string; link: string };

export function TxList({ logs }: { logs: TxLog[] }) {
  if (logs.length === 0) return null;
  return (
    <div>
      <Label>Giao dịch đã ký</Label>
      <ul className="space-y-1 text-xs">
        {logs.map((l, i) => (
          <li key={i}>
            ✓ {l.label} —{" "}
            <a className="underline" href={l.link} target="_blank" rel="noreferrer">
              xem trên Solscan
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WalletHint() {
  const { publicKey } = useWallet();
  if (publicKey) return null;
  return (
    <p className="rounded-lg border border-dashed border-zinc-300 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
      Kết nối ví Phantom ở đầu trang và chuyển Phantom sang <b>Solana Devnet</b> để giao dịch. Xem số liệu pool thì không cần ví.
    </p>
  );
}

export const fmt = (n: number, digits = 4) => n.toLocaleString("vi-VN", { maximumFractionDigits: digits });
