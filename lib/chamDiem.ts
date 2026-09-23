export type BaoCao = {
  chuKy: string; // chu ky giao dich tren Solana
  viBaoCao: string; // ai gui bao cao nay
  viBiToCao: string; // dia chi bi to cao
  thoiGian: string;
  mucDo: number; // 1-5
};

/**
 * Cham diem rui ro cua mot dia chi dua tren cac bao cao da co tren chain.
 * Toan bo la cong thuc co dinh - chay 10 lan ra 10 ket qua giong het nhau.
 * AI KHONG tham gia buoc nay.
 */
export function chamDiemOnChain(baoCaos: BaoCao[], viCanKiemTra: string) {
  const lienQuan = baoCaos.filter((b) => b.viBiToCao === viCanKiemTra);

  // Dem theo SO VI KHAC NHAU, khong dem so giao dich
  // -> chan duoc mot nguoi spam 10 bao cao gia
  const viDaBaoCao = new Set(lienQuan.map((b) => b.viBaoCao));
  const soNguoiBaoCao = viDaBaoCao.size;

  const mucDoTrungBinh =
    lienQuan.length > 0
      ? lienQuan.reduce((s, b) => s + b.mucDo, 0) / lienQuan.length
      : 0;

  const lanDauBiBaoCao =
    lienQuan.length > 0 ? lienQuan.map((b) => b.thoiGian).sort()[0] : null;

  // Nguong lay tu logic ScamRegistry cu: du 10 nguoi bao cao -> gan co
  const daGanCo = soNguoiBaoCao >= 10;

  return {
    viCanKiemTra,
    soBaoCao: lienQuan.length,
    soNguoiBaoCao,
    mucDoTrungBinh: Number(mucDoTrungBinh.toFixed(2)),
    lanDauBiBaoCao,
    daGanCo,
  };
}
