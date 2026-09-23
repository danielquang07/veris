"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { ghiBangChung } from "@/lib/ghiChain";

export function NutGhiBangChung() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [link, setLink] = useState<string | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangChay, setDangChay] = useState(false);

  async function xuLy() {
    if (!publicKey) {
      setLoi("Hay ket noi vi truoc");
      return;
    }
    setDangChay(true);
    setLoi(null);
    setLink(null);
    try {
      // Dinh dang memo: SCAMREG|phien ban|loai|thoi gian
      const noiDung = `SCAMREG|v1|test|${new Date().toISOString()}`;
      const kq = await ghiBangChung(
        connection,
        publicKey,
        sendTransaction,
        noiDung
      );
      setLink(kq.linkSolscan);
    } catch (e) {
      setLoi((e as Error).message);
    } finally {
      setDangChay(false);
    }
  }

  return (
    <div className="w-full">
      <button
        onClick={xuLy}
        disabled={dangChay || !publicKey}
        className="rounded-lg bg-black px-5 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {dangChay ? "Đang ghi lên chain..." : "Ghi bằng chứng lên Solana"}
      </button>

      {!publicKey && (
        <p className="mt-3 text-sm text-zinc-500">
          Kết nối ví ở trên trước khi ghi.
        </p>
      )}

      {link && (
        <div className="mt-4 rounded-lg border border-green-600/30 bg-green-50 p-4 dark:bg-green-950/30">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">
            ✅ Đã ghi thành công lên Solana devnet
          </p>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block break-all text-sm text-green-700 underline dark:text-green-400"
          >
            {link}
          </a>
        </div>
      )}

      {loi && (
        <div className="mt-4 rounded-lg border border-red-600/30 bg-red-50 p-4 dark:bg-red-950/30">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            Lỗi: {loi}
          </p>
        </div>
      )}
    </div>
  );
}
