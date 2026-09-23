"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

type BanGhi = {
  chuKy: string;
  target: string;
  loai: string;
  thoiGian: string | null;
};

const NHAN_LOAI: Record<string, string> = {
  hua_loi_nhuan: "Hứa lợi nhuận",
  ap_luc_thoi_gian: "Áp lực thời gian",
  doi_nap_them_de_rut: "Đòi nạp thêm để rút",
  mao_danh_to_chuc: "Mạo danh tổ chức",
  loi_dung_quan_he: "Lợi dụng quan hệ",
  viec_nhe_luong_cao: "Việc nhẹ lương cao",
  khong_ro: "Chưa rõ",
};

/** Tach cac truong dang "khoa=gia tri" trong chuoi memo SCAMREG */
function docMemo(memo: string): Omit<BanGhi, "chuKy" | "thoiGian"> | null {
  if (!memo.startsWith("SCAMREG|")) return null;
  const phan = memo.split("|");
  const lay = (khoa: string) =>
    phan.find((p) => p.startsWith(`${khoa}=`))?.slice(khoa.length + 1) ?? "";
  const target = lay("target");
  if (!target) return null;
  return { target, loai: lay("loai") };
}

export function SoDen({ lamMoiKhi }: { lamMoiKhi: number }) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [danhSach, setDanhSach] = useState<BanGhi[]>([]);
  const [dangTai, setDangTai] = useState(false);

  const tai = useCallback(async () => {
    if (!publicKey) {
      setDanhSach([]);
      return;
    }
    setDangTai(true);
    try {
      const chuKys = await connection.getSignaturesForAddress(publicKey, {
        limit: 25,
      });
      if (chuKys.length === 0) {
        setDanhSach([]);
        return;
      }

      const giaoDichs = await connection.getParsedTransactions(
        chuKys.map((c) => c.signature),
        { maxSupportedTransactionVersion: 0 }
      );

      const ketQua: BanGhi[] = [];
      giaoDichs.forEach((gd, i) => {
        if (!gd) return;
        for (const ix of gd.transaction.message.instructions) {
          // Memo Program tra ve noi dung memo thang trong truong "parsed"
          const memo =
            "parsed" in ix && typeof ix.parsed === "string" ? ix.parsed : null;
          if (!memo) continue;
          const doc = docMemo(memo);
          if (!doc) continue;
          ketQua.push({
            ...doc,
            chuKy: chuKys[i].signature,
            thoiGian: gd.blockTime
              ? new Date(gd.blockTime * 1000).toLocaleString("vi-VN")
              : null,
          });
        }
      });

      setDanhSach(ketQua);
    } catch {
      setDanhSach([]);
    } finally {
      setDangTai(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    tai();
  }, [tai, lamMoiKhi]);

  if (!publicKey) {
    return (
      <p className="text-sm text-zinc-500">
        Kết nối ví ở Bước 1 để xem các báo cáo đã ghi.
      </p>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Đọc trực tiếp từ Solana devnet — không phải dữ liệu lưu trong app
        </p>
        <button
          onClick={tai}
          disabled={dangTai}
          className="rounded-md border border-zinc-300 px-3 py-1 text-xs text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {dangTai ? "Đang tải..." : "Tải lại"}
        </button>
      </div>

      {danhSach.length === 0 && !dangTai && (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
          Chưa có báo cáo nào. Chạy Bước 2 rồi Bước 3 để ghi báo cáo đầu tiên.
        </p>
      )}

      <div className="space-y-2">
        {danhSach.map((b) => (
          <div
            key={b.chuKy}
            className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <p className="break-all font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {b.target}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {NHAN_LOAI[b.loai] ?? b.loai}
              {b.thoiGian ? ` · ${b.thoiGian}` : ""}
            </p>
            <a
              href={`https://solscan.io/tx/${b.chuKy}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-blue-600 underline dark:text-blue-400"
            >
              Xem bằng chứng gốc
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
