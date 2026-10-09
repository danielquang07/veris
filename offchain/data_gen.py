"""Sinh 400 mau synthetic tieng Viet: 200 scam (label=1), 200 normal (label=0)."""
import json
import random
from pathlib import Path

random.seed(0)

SCAM_TEMPLATES = [
    "Chuc mung ban da trung thuong {gift}, click link {link} de nhan",
    "Tai khoan cua ban bi khoa, xac minh ngay tai {link}",
    "Chuyen tien gap cho toi, dang can lam {amount}",
    "Ban nhan duoc {amount} tu quy tu thien, cung cap so tai khoan {link}",
    "Cap nhat thong tin ngan hang ngay neu khong se bi khoa the {link}",
    "Cung cap OTP {otp} de xac minh tai khoan {link}",
    "Ban duoc hoan tien {amount}, nhap thong tin the tai {link}",
    "Nhan qua {gift} mien phi, chi can click {link} trong 5 phut",
    "Tai khoan vi cua ban bi khoa tam thoi, mo khoa tai {link}",
    "De nghi chuyen khoan gap {amount} cho nguoi than dang cap cuu",
]

SCAM_FILL = {
    "gift": ["iPhone 15", "xe SH", "5 trieu dong", "phieu mua hang 10 trieu", "laptop Dell"],
    "link": ["http://nhan-qua.xyz", "https://xac-minh-tk.top", "http://nap-tien-nhanh.info", "https://qua-tang-vip.cc"],
    "amount": ["2 trieu", "5 trieu", "10 trieu", "500k", "3 trieu dong"],
    "otp": ["482913", "110022", "778899", "334455"],
}

NORMAL_TEMPLATES = [
    "Hom nay troi dep qua {extra}",
    "Di an trua khong {name}",
    "Don hang cua ban da duoc giao {extra}",
    "Cam on ban da mua hang {extra}",
    "Hen gap lai sau nhe {name}",
    "Deadline tuan nay la thu 6 {extra}",
    "Hop luc 3h chieu nay nhe {name}",
    "Gui file cho minh nhe {name}",
    "Chuc mung sinh nhat {name}",
    "Chieu nay da bong khong {name}",
]

NORMAL_FILL = {
    "extra": ["nha", "ban oi", "nhe", "roi", ""],
    "name": ["ban", "Minh", "Lan", "anh", "chi", "moi nguoi"],
}


def fill(template, pool):
    out = template
    for k, vals in pool.items():
        if "{" + k + "}" in out:
            out = out.replace("{" + k + "}", random.choice(vals))
    return out.strip()


def main():
    rows = []
    for _ in range(200):
        t = random.choice(SCAM_TEMPLATES)
        rows.append({"text": fill(t, SCAM_FILL), "label": 1})
    for _ in range(200):
        t = random.choice(NORMAL_TEMPLATES)
        rows.append({"text": fill(t, NORMAL_FILL), "label": 0})
    random.shuffle(rows)
    out_path = Path(__file__).resolve().parent / "data" / "synthetic_vi.jsonl"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"wrote {len(rows)} rows -> {out_path}")


if __name__ == "__main__":
    main()
