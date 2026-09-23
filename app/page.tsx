"use client";

import dynamic from "next/dynamic";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { NutGhiBangChung } from "@/components/NutGhiBangChung";
import { PhanTichAI, type KetQuaKemNoiDung } from "@/components/PhanTichAI";
import { SoDen } from "@/components/SoDen";

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

  // Ket qua Buoc 2 duoc giu o day de Buoc 3 dung - day la cho noi 2 buoc lai
  const [ketQuaAI, setKetQuaAI] = useState<KetQuaKemNoiDung | null>(null);
  // Tang len moi khi ghi xong 1 bao cao -> bao So den tai lai
  const [lanGhi, setLanGhi] = useState(0);

  useEffect(() => {
    if (!publicKey) {
      setSoDu(null);
      return;
    }
    connection
      .getBalance(publicKey)
      .then((lamports) => setSoDu(lamports / LAMPORTS_PER_SOL))
      .catch(() => setSoDu(null));
  }, [publicKey, connection, lanGhi]);

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Veris
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            AI đọc tin nhắn lừa đảo tiếng Việt, trích ra nơi nhận tiền, và ghi
            vào sổ đen chung không ai sửa được
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
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Bước 2 — AI đọc nội dung
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            AI phân loại thủ đoạn và trích ra số tài khoản / ví nhận tiền
          </p>
          <PhanTichAI onXong={setKetQuaAI} />
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Bước 3 — Ghi vào sổ đen
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            Ghi nơi nhận tiền + dấu vân tay (hash) của kết luận lên Solana
          </p>
          <NutGhiBangChung
            duLieu={ketQuaAI}
            onGhiXong={() => setLanGhi((n) => n + 1)}
          />
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Bước 4 — Sổ đen đã ghi
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            Đây là thứ người sau tra cứu được trước khi chuyển tiền
          </p>
          <SoDen lamMoiKhi={lanGhi} />
        </section>
      </main>
    </div>
  );
}
