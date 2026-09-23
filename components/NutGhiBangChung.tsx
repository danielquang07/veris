"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { ghiBangChung } from "@/lib/ghiChain";
import { sha256 } from "@/lib/hash";
import type { KetQuaKemNoiDung } from "@/components/PhanTichAI";

export function NutGhiBangChung({
  duLieu,
  onGhiXong,
}: {
  duLieu: KetQuaKemNoiDung | null;
  onGhiXong: () => void;
}) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [link, setLink] = useState<string | null>(null);
  const [memoDaGhi, setMemoDaGhi] = useState<string | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangChay, setDangChay] = useState(false);

  const sanSang = Boolean(publicKey && duLieu);

  async function xuLy() {
    if (!publicKey || !duLieu) return;
    setDangChay(true);
    setLoi(null);
    setLink(null);
    setMemoDaGhi(null);
    try {
      // Hash CA noi dung goc LAN ket luan cua AI.
      // Nho vay sau nay bat ky ai cung tai lap duoc: lay lai 2 thu nay,
      // bam hash, so voi hash tren chain - khop la ban goc, lech la da bi sua.
      const banGhi = JSON.stringify({
        noiDung: duLieu.noiDung,
        ketQua: duLieu.ketQua,
      });
      const hash = await sha256(banGhi);

      const noiNhan = duLieu.ketQua.noi_nhan_tien || "khong-xac-dinh";
      const memo = [
        "SCAMREG",
        "v1",
        `target=${noiNhan}`,
        `loai=${duLieu.ketQua.loai_thu_doan}`,
        `sha256=${hash.slice(0, 32)}`,
      ].join("|");

      const kq = await ghiBangChung(
        connection,
        publicKey,
        sendTransaction,
        memo
      );
      setLink(kq.linkSolscan);
      setMemoDaGhi(memo);
      onGhiXong();
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
        disabled={dangChay || !sanSang}
        className="rounded-lg bg-black px-5 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {dangChay ? "Đang ghi lên chain..." : "Gửi báo cáo lên sổ đen"}
      </button>

      {!publicKey && (
        <p className="mt-3 text-sm text-zinc-500">
          Kết nối ví ở Bước 1 trước.
        </p>
      )}
      {publicKey && !duLieu && (
        <p className="mt-3 text-sm text-zinc-500">
          Chạy Bước 2 trước — cần có kết quả phân tích thì mới có gì để ghi.
        </p>
      )}

      {memoDaGhi && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Nội dung đã ghi vĩnh viễn lên Solana
          </p>
          <p className="mt-1 break-all font-mono text-xs text-zinc-800 dark:text-zinc-200">
            {memoDaGhi}
          </p>
        </div>
      )}

      {link && (
        <div className="mt-3 rounded-lg border border-green-600/30 bg-green-50 p-4 dark:bg-green-950/30">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">
            ✅ Đã ghi thành công — không ai sửa được nữa, kể cả nhóm phát triển
          </p>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block break-all text-sm text-green-700 underline dark:text-green-400"
          >
            Xem bằng chứng trên Solscan
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
