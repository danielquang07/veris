import { NextResponse } from "next/server";
import { chamDiemOnChain, type BaoCao } from "@/lib/chamDiem";

// Goi Gemini bang REST truc tiep - khong can cai SDK, khong lo lech phien ban.
// Neu ten model duoi day bao loi "not found", vao aistudio.google.com,
// xem danh sach model dang duoc ho tro mien phi va thay ten o day.
const MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `Ban la chuyen gia nhan dien lua dao truc tuyen tai Viet Nam.

LUAT BAT BUOC, khong duoc vi pham:
1. CHI dung dung so lieu on-chain duoc cung cap. KHONG tu tinh toan lai con so nao.
2. KHONG khang dinh ai do LA ke lua dao. Chi duoc neu "co N dau hieu thuong thay o lua dao".
3. Trich dan dau hieu bang dung cum tu co that trong noi dung, khong bia them.
4. Neu noi dung khong du can cu, chon loai_thu_doan = "khong_ro" va noi ro la khong du du lieu.
5. KHONG dua loi khuyen dau tu duoi bat ky hinh thuc nao.

Viet tieng Viet, ngan gon, cho nguoi lon tuoi khong ranh cong nghe cung hieu.
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
  },
  required: [
    "loai_thu_doan",
    "dau_hieu",
    "do_tin_cay",
    "giai_thich",
    "loi_khuyen",
  ],
};

export type KetQuaPhanTich = {
  loai_thu_doan: string;
  dau_hieu: string[];
  do_tin_cay: number;
  giai_thich: string;
  loi_khuyen: string;
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

    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    });

    if (!response.ok) {
      const chiTietLoi = await response.text();
      console.error("Gemini báo lỗi:", response.status, chiTietLoi);
      return NextResponse.json(
        {
          loi: "AI không phản hồi được. Kiểm tra GEMINI_API_KEY còn hiệu lực không.",
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
