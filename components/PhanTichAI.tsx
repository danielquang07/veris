"use client";

import { useState } from "react";
import type { KetQuaPhanTich } from "@/app/api/phan-tich/route";

const NHAN_LOAI_THU_DOAN: Record<string, string> = {
  hua_loi_nhuan: "Hứa lợi nhuận cố định",
  ap_luc_thoi_gian: "Tạo áp lực thời gian",
  doi_nap_them_de_rut: "Đòi nạp thêm để rút",
  mao_danh_to_chuc: "Mạo danh tổ chức",
  loi_dung_quan_he: "Lợi dụng quan hệ quen biết",
  viec_nhe_luong_cao: "Việc nhẹ lương cao",
  khong_ro: "Chưa đủ căn cứ để xác định",
};

export function PhanTichAI() {
  const [noiDung, setNoiDung] = useState("");
  const [dangChay, setDangChay] = useState(false);
  const [ketQua, setKetQua] = useState<KetQuaPhanTich | null>(null);
  const [loi, setLoi] = useState<string | null>(null);

  async function phanTich() {
    if (!noiDung.trim()) {
      setLoi("Dán một đoạn tin nhắn vào trước đã.");
      return;
    }
    setDangChay(true);
    setLoi(null);
    setKetQua(null);
    try {
      const res = await fetch("/api/phan-tich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noiDung,
          viCanKiemTra: "demo",
          baoCaos: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoi(data.loi ?? "Có lỗi xảy ra, thử lại sau.");
        return;
      }
      setKetQua(data.ketQua);
    } catch {
      setLoi("Không gọi được API. Kiểm tra kết nối mạng.");
    } finally {
      setDangChay(false);
    }
  }

  return (
    <div className="w-full">
      <textarea
        value={noiDung}
        onChange={(e) => setNoiDung(e.target.value)}
        placeholder="Dán nội dung tin nhắn đáng ngờ vào đây..."
        rows={4}
        className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />

      <button
        onClick={phanTich}
        disabled={dangChay}
        className="mt-3 rounded-lg bg-black px-5 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {dangChay ? "Đang phân tích..." : "Kiểm tra"}
      </button>

      {loi && (
        <div className="mt-4 rounded-lg border border-red-600/30 bg-red-50 p-4 dark:bg-red-950/30">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            {loi}
          </p>
        </div>
      )}

      {ketQua && (
        <div className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Loại thủ đoạn
            </p>
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              {NHAN_LOAI_THU_DOAN[ketQua.loai_thu_doan] ?? ketQua.loai_thu_doan}
              {" · "}
              <span className="font-normal text-zinc-500">
                độ tin cậy {Math.round(ketQua.do_tin_cay * 100)}%
              </span>
            </p>
          </div>

          {ketQua.dau_hieu.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Dấu hiệu
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
                {ketQua.dau_hieu.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Giải thích
            </p>
            <p className="text-sm text-zinc-800 dark:text-zinc-200">
              {ketQua.giai_thich}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Lời khuyên
            </p>
            <p className="text-sm text-zinc-800 dark:text-zinc-200">
              {ketQua.loi_khuyen}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
