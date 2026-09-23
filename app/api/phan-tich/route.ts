import { NextResponse } from "next/server";
import { chamDiemOnChain, type BaoCao } from "@/lib/chamDiem";

// Goi Gemini bang REST truc tiep - khong can cai SDK, khong lo lech phien ban.
//
// Danh sach model theo thu tu uu tien. Goi lan luot tu tren xuong:
// goi dau tien tra ve ket qua thi dung luon, loi qua tai (503) thi thu model sau.
// Ly do can nhieu model: goi mien phi cua Google thuong xuyen bao 503 "high demand",
// neu chi dung 1 model thi dang demo truoc giam khao rat de bi treo.
// Dung ten co duoi "-latest" de Google co go phien ban cu thi app van chay.
const MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3-flash-preview",
  "gemini-flash-latest",
];

const urlCuaModel = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const SYSTEM_PROMPT = `Ban la chuyen gia nhan dien lua dao truc tuyen tai Viet Nam.

LUAT BAT BUOC, khong duoc vi pham:
1. CHI dung dung so lieu on-chain duoc cung cap. KHONG tu tinh toan lai con so nao.
2. KHONG khang dinh ai do LA ke lua dao. Chi duoc neu "co N dau hieu thuong thay o lua dao".
3. Trich dan dau hieu bang dung cum tu co that trong noi dung, khong bia them.
4. Neu noi dung khong du can cu, chon loai_thu_doan = "khong_ro" va noi ro la khong du du lieu.
5. KHONG dua loi khuyen dau tu duoi bat ky hinh thuc nao.
6. TRICH RA noi nhan tien neu co: so tai khoan ngan hang, so dien thoai,
   hoac dia chi vi crypto ma noi dung yeu cau chuyen tien toi.
   Chep DUNG NGUYEN chuoi so/dia chi, khong them bot ky tu nao.
   Khong tim thay thi de noi_nhan_tien = "" (chuoi rong).

QUAN TRONG VE NGON NGU: cac truong giai_thich va loi_khuyen phai viet
bang TIENG VIET CO DAU DAY DU (vi du: "Noi dung nay co dau hieu lua dao"
phai viet thanh "Nội dung này có dấu hiệu lừa đảo").
Nguoi doc la nguoi lon tuoi, khong ranh cong nghe - viet ngan gon, de hieu,
khong dung tu chuyen mon.
Rieng truong dau_hieu thi chep NGUYEN VAN cum tu trong noi dung goc,
giu dung dau/khong dau nhu ban goc.

Tra loi DUNG theo khuon JSON da cho, khong them chu nao ngoai JSON.`;

// Khuon du lieu ep AI phai theo - day la tang phong thu thu 2 chong hallucination
// (tang 1 la "chi dua vao so lieu da tinh san", tang 3 la hash ghi len chain o buoc sau)
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    loai_thu_doan: {
      type: "STRING",
      enum: [
        "hua_loi_nhuan",
        "ap_luc_thoi_gian",
        "doi_nap_them_de_rut",
        "mao_danh_to_chuc",
        "loi_dung_quan_he",
        "viec_nhe_luong_cao",
        "khong_ro",
      ],
    },
    dau_hieu: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Cac cum tu dang ngo trich tu chinh noi dung",
    },
    do_tin_cay: { type: "NUMBER", description: "Tu 0 den 1" },
    giai_thich: { type: "STRING" },
    loi_khuyen: { type: "STRING" },
    noi_nhan_tien: {
      type: "STRING",
      description:
        "So tai khoan / so dien thoai / dia chi vi ma noi dung yeu cau chuyen tien toi. Chuoi rong neu khong co.",
    },
  },
  required: [
    "loai_thu_doan",
    "dau_hieu",
    "do_tin_cay",
    "giai_thich",
    "loi_khuyen",
    "noi_nhan_tien",
  ],
};

export type KetQuaPhanTich = {
  loai_thu_doan: string;
  dau_hieu: string[];
  do_tin_cay: number;
  giai_thich: string;
  loi_khuyen: string;
  noi_nhan_tien: string;
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { loi: "Thiếu GEMINI_API_KEY trong .env.local" },
        { status: 500 }
      );
    }

    const { noiDung, viCanKiemTra, baoCaos } = (await req.json()) as {
      noiDung: string;
      viCanKiemTra: string;
      baoCaos: BaoCao[];
    };

    if (!noiDung || typeof noiDung !== "string") {
      return NextResponse.json(
        { loi: "Thiếu nội dung cần kiểm tra" },
        { status: 400 }
      );
    }

    // Code tinh so lieu TRUOC, AI chi nhan ket qua da tinh
    const soLieu = chamDiemOnChain(baoCaos ?? [], viCanKiemTra ?? "");

    const noiDungGui = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Nội dung cần kiểm tra:
"""
${noiDung}
"""

Số liệu on-chain đã được hệ thống tính sẵn (không tính lại):
${JSON.stringify(soLieu, null, 2)}

Hãy phân tích nội dung trên.`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    // Goi lan luot tung model trong danh sach cho den khi co model tra ve ket qua.
    // Chi chuyen sang model sau khi gap loi qua tai (429/5xx), con loi sai key (4xx khac)
    // thi dung luon vi thu model khac cung se sai y het.
    let response: Response | null = null;
    let loiCuoi = "";

    for (const model of MODELS) {
      const r = await fetch(`${urlCuaModel(model)}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: noiDungGui,
      });

      if (r.ok) {
        response = r;
        break;
      }

      loiCuoi = await r.text();
      console.error(`Gemini [${model}] loi ${r.status}:`, loiCuoi);

      const dangQuaTai = r.status === 429 || r.status >= 500;
      if (!dangQuaTai) break;
    }

    if (!response) {
      const thieuKey = loiCuoi.includes("API_KEY") || loiCuoi.includes("API key");
      return NextResponse.json(
        {
          loi: thieuKey
            ? "GEMINI_API_KEY không hợp lệ hoặc đã bị thu hồi."
            : "Hệ thống AI của Google đang quá tải. Thử lại sau ít giây.",
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    const vanBanJson: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!vanBanJson) {
      console.error("Gemini tra ve rong:", JSON.stringify(data));
      return NextResponse.json(
        { loi: "AI trả về rỗng, vui lòng thử lại." },
        { status: 502 }
      );
    }

    let ketQua: KetQuaPhanTich;
    try {
      ketQua = JSON.parse(vanBanJson);
    } catch {
      return NextResponse.json(
        { loi: "AI trả về sai định dạng JSON, vui lòng thử lại." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ketQua, soLieu });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { loi: "Không phân tích được. Kiểm tra lại kết nối mạng." },
      { status: 500 }
    );
  }
}
