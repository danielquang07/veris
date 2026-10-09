# Veris — Hào Khí Đại Việt + AI Scam Detector

Next.js game + DEX trên Solana devnet, tích hợp lớp AI cảnh báo lừa đảo tiếng Việt.

## Tổng quan — 3 tầng

1. **On-chain (Anchor):** `scam_detector` (MLP int8 `predict([i8;256]) → u8`)
   + `veris_registry` (sổ cái report scam + AI result log).
2. **Off-chain AI (FastAPI + XLM-R):** NLP tiếng Việt + legal rules
   (BLHS) + on-chain context → `risk_score` 0–100.
3. **Frontend (Next.js):** Swap → guard AI (`useAnalyzeBeforeSign`) →
   modal cảnh báo → user quyết định ký/hủy.

## Kiến trúc

```
                 ┌────────────────────────────┐
                 │  On-chain (Anchor)         │
                 │  - scam_detector           │
                 │    MLP 256→16→1 (int8),    │
                 │    predict([i8;256]) → u8  │
                 │  - veris_registry          │
                 │    sổ cái report + AI log  │
                 └────────────┬───────────────┘
                              │ RPC (devnet)
                 ┌────────────▼───────────────┐
                 │  Off-chain AI (FastAPI)    │
                 │  XLM-R vi + legal rules +  │
                 │  on-chain context → score  │
                 └────────────┬───────────────┘
                              │ POST /api/analyze
                 ┌────────────▼───────────────┐
                 │  Frontend (Next.js 16)     │
                 │  Swap → guard → modal warn │
                 └────────────────────────────┘
```

- `final_risk = clamp(0, 100, 0.6 * nlp_risk + 0.4 * on_chain_risk + bonus)`
- `bonus`: +15 nếu địa chỉ bị báo cáo > 3 lần trên `veris_registry`;
  +10 nếu ví < 7 ngày tuổi với ≥ 5 giao dịch gần đây.

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

1. **Swap:** mở web, kết nối Phantom (devnet), tab Swap → pool USDC,
   nhập amount → bấm "Ký và đổi".
2. **AI check:** hook `useAnalyzeBeforeSign` gọi `POST /api/analyze`
   (proxy → AI service `/analyze`, ~1–3s) với text swap + mint pool.
3. **Modal warning:** `risk_score ≥ 70` → `RiskWarningModal` hiện điểm,
   signals, trích dẫn luật, `on_chain_context` → user **Hủy giao dịch**.
4. **Sign:** `risk_score < 70` → ký ngay, không modal. AI lỗi/timeout
   → fail-open, swap đi tiếp bình thường.

## Env vars

| Var | Default | Meaning |
|-----|---------|---------|
| `NEXT_PUBLIC_AI_ENABLED` | `true` | Bật guard AI trước khi ký swap |
| `AI_SERVICE_URL` | `http://localhost:8000` | URL AI service (proxy `/api/analyze`) |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | RPC cho on-chain context |
| `VERIS_REGISTRY_PROGRAM_ID` | `9ukmHJe...SbEE` (khớp `declare_id!` trong `veris_registry`) | Program id `veris_registry` — TODO thay sau khi deploy devnet; tới lúc đó `report_count`=0 |
| `SCAM_MODEL` | `nxtcute/xlm-r-...-vi` | Model HF chính |

## Known limitations

- `REGISTRY_PROGRAM_ID` chưa deploy devnet → `report_count` luôn 0 cho tới khi deploy.
- Rate limit in-memory, không share giữa instances.
- Model XLM-R chạy CPU, load lazy ở request `/analyze` đầu tiên.
- Hook `useAnalyzeBeforeSign` fail-open khi AI lỗi/timeout > 3s.

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
