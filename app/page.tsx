"use client";

import dynamic from "next/dynamic";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { NutGhiBangChung } from "@/components/NutGhiBangChung";

// Nut ket noi vi phai tat SSR, neu khong se loi "hydration mismatch"
// vi trang thai vi tren server va tren trinh duyet khac nhau.
const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default function Home() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [soDu, setSoDu] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setSoDu(null);
      return;
    }
    connection
      .getBalance(publicKey)
      .then((lamports) => setSoDu(lamports / LAMPORTS_PER_SOL))
      .catch(() => setSoDu(null));
  }, [publicKey, connection]);

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            CanhBaoScam
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            AI cảnh báo lừa đảo tiếng Việt — bằng chứng ghi trên Solana
          </p>
        </header>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Bước 1 — Kết nối ví
          </h2>

          <WalletMultiButton />

          {publicKey && (
            <div className="mt-4 space-y-1 text-sm">
              <p className="text-zinc-600 dark:text-zinc-400">
                Địa chỉ ví:{" "}
                <span className="break-all font-mono text-zinc-900 dark:text-zinc-200">
                  {publicKey.toBase58()}
                </span>
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                Số dư devnet:{" "}
                <span className="font-mono text-zinc-900 dark:text-zinc-200">
                  {soDu === null ? "đang tải..." : `${soDu.toFixed(4)} SOL`}
                </span>
              </p>
              {soDu !== null && soDu === 0 && (
                <p className="text-amber-600 dark:text-amber-500">
                  Ví chưa có SOL devnet. Xin miễn phí tại faucet.solana.com
                </p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Bước 2 — Ghi bằng chứng lên chain
          </h2>
          <NutGhiBangChung />
        </section>
      </main>
    </div>
  );
}
