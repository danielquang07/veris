# Veris — DEX trên Solana có Veris Shield chống token lừa đảo

Sàn swap trên Solana Devnet (Raydium CPMM). Trước khi người dùng ký, **Veris Shield** đọc thẳng dữ liệu token và ví trên Solana để cảnh báo token lừa đảo; AI tiếng Việt đọc tin nhắn "hô" mua token.

## Veris Shield (chung kết)

| Tính năng | Ở đâu | Làm gì |
|---|---|---|
| **Quét token** | `/shield` → Quét token, `GET /api/token-check?mint=` | Đọc on-chain: còn quyền in thêm (mint authority), còn quyền đóng băng (freeze authority), có metadata không, mạo danh USDC/USDT/SOL…, tuổi token, sổ đen SCAMREG → điểm rủi ro 0–100 |
| **Dán tin nhắn** | `/shield` → Quét token | AI (XLM-R tiếng Việt) chấm tin nhắn + tự tách địa chỉ token trong tin để quét |
| **Quét ví** | `/shield` → Quét ví, `GET /api/wallet-scan?owner=` | Liệt kê token đang giữ, tô đỏ token nguy hiểm, phát hiện **quyền rút đã cấp cho ví lạ** (SPL delegate) và token bị khóa |
| **Thu hồi quyền** | `/shield` → Quét ví | Gửi lệnh SPL Token `Revoke` thật trên devnet |
| **Gác cổng tự động** | Swap, Cung cấp thanh khoản | Token nguy hiểm → popup chặn **trước khi Phantom mở** |
| **Lưu bằng chứng** | Báo cáo token / tin nhắn | Memo `VERISHIELD` / `VERISAI` kèm SHA-256 của báo cáo |

## Tổng quan — 3 tầng

1. **On-chain (Solana Devnet):** đọc mint account, Metaplex metadata, token account (delegate, frozen), lịch sử chữ ký; ghi memo `SCAMREG` (sổ đen), `VERISHIELD`/`VERISAI` (bằng chứng); swap/LP qua Raydium CPMM; lệnh SPL Token `Revoke`.
   Roadmap: Anchor `veris_registry` (sổ cái báo cáo) + `scam_detector`, đã viết và test, chưa deploy.
2. **Off-chain AI (FastAPI + XLM-R):** NLP tiếng Việt + đối chiếu BLHS 2015 → `risk_score` 0–100 cho tin nhắn.
3. **Frontend (Next.js 16):** DEX + `/shield`; popup Veris Shield trước khi ký.

## Kiến trúc

```
                 ┌──────────────────────────────────────────────┐
                 │  On-chain Solana (Devnet)                    │
                 │  - Sổ đen SCAMREG (Solana Memo)              │
                 │  - Ghi nhận bằng chứng VERISAI (Solana Memo) │
                 │  - Raydium CPMM Liquidity Pool               │
                 │  - [Roadmap] scam_detector + veris_registry  │
                 └──────────────────────┬───────────────────────┘
                                        │ RPC (devnet)
                 ┌──────────────────────▼───────────────────────┐
                 │  Off-chain AI (FastAPI)                      │
                 │  XLM-R vi + legal rules (BLHS) +             │
                 │  SCAMREG memo / on-chain context → score     │
                 └──────────────────────┬───────────────────────┘
                                        │ POST /api/analyze
                 ┌──────────────────────▼───────────────────────┐
                 │  Frontend (Next.js 16)                       │
                 │  Swap DEX + /shield + popup trước khi ký     │
                 └──────────────────────────────────────────────┘
```

- `final_risk = clamp(0, 100, on_chain_risk > 0 ? (0.6 * nlp_risk + 0.4 * on_chain_risk + bonus) : (nlp_risk + bonus))`
- `bonus`: cộng điểm từ sổ đen SCAMREG memo trên Solana và heuristics ví mới.

## Cách chạy local

```bash
# 1. Frontend deps
npm install

# 2. Anchor programs (check + test)
cargo check --manifest-path anchor/Cargo.toml -p scam_detector
cargo check --manifest-path anchor/Cargo.toml -p veris_registry

# 3. AI service
# Từ repo root (khuyến nghị):
ai-service\.venv\Scripts\python.exe -X utf8 -m uvicorn ai-service.main:app --port 8000
# Hoặc từ thư mục ai-service/:
# cd ai-service && ..\ai-service\.venv\Scripts\python.exe -X utf8 -m uvicorn main:app --port 8000

# 4. Frontend dev
npm run dev
```

Chi tiết AI service: xem `ai-service/README.md`. Kịch bản demo 3 phút: xem `docs/DEMO.md`.

## Demo flow

1. **Gác cổng khi swap:** kết nối Phantom (devnet), tab Swap → cặp **SOL / USDC thử** → "Ký và đổi"
   → popup Veris Shield: token còn quyền in thêm + quyền đóng băng → **Hủy**.
2. **Token sạch:** đổi sang **SOL / USDT thử** → "Ký và đổi" → không popup, Phantom mở, swap thành công.
3. **Quét tin nhắn:** `/shield` → "Tin nhắn hô mua token" → Quét → báo cáo token + AI chấm tin nhắn
   → "Lưu báo cáo lên Solana" → Solscan → Program Logs → `VERISHIELD|v1|…`.
4. **Quét ví:** `/shield` → Quét ví → "Mô phỏng cấp quyền" (devnet) → thấy cảnh báo quyền rút → **Thu hồi quyền**.

Kiểm tra token mà RPC lỗi/timeout → fail-open, giao dịch vẫn đi tiếp.

## Env vars

| Var | Default | Meaning |
|-----|---------|---------|
| `NEXT_PUBLIC_AI_ENABLED` | `true` | Bật AI đọc tin nhắn (`/api/analyze`) |
| `AI_SERVICE_URL` | `http://localhost:8000` | URL AI service (proxy `/api/analyze`) |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | RPC cho on-chain context |
| `VERIS_REGISTRY_PROGRAM_ID` | `9ukmHJe...SbEE` (khớp `declare_id!` trong `veris_registry`) | Program id `veris_registry` — TODO thay sau khi deploy devnet; tới lúc đó `report_count`=0 |
| `SCAM_MODEL` | `nxtcute/xlm-r-...-vi` | Model HF chính |

## Known limitations

- `REGISTRY_PROGRAM_ID` chưa deploy devnet → `report_count` luôn 0 cho tới khi deploy.
- Rate limit in-memory, không share giữa instances.
- Model XLM-R chạy CPU, load lazy ở request `/analyze` đầu tiên.
- Veris Shield fail-open khi RPC lỗi/timeout > 15s; RPC devnet công cộng hay giới hạn tần suất (429).

---

## Getting Started (Next.js default)

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.


You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
