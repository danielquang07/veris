# Veris — Demo 3 phút (cho BTC / reviewer)

Mục tiêu: chứng minh flow **swap → AI check → cảnh báo → quyết định** hoạt động end-to-end.

## Chuẩn bị (trước demo)

1. AI service chạy local:
   ```bash
   # Từ repo root (khuyến nghị):
   ai-service\.venv\Scripts\python.exe -X utf8 -m uvicorn ai-service.main:app --port 8000

   # Hoặc từ trong ai-service/:
   # cd ai-service
   # ..\ai-service\.venv\Scripts\python.exe -X utf8 -m uvicorn main:app --port 8000
   ```
   Verify: mở `http://localhost:8000/health` → `{"status":"ok",...}`.
2. Frontend chạy local:
   ```bash
   npm run dev
   ```
   Mở `http://localhost:3000`, tab **Swap**.
3. Ví Phantom ở chế độ **Devnet**, có sẵn ≥ 0.2 SOL test.
4. `.env.local` có `NEXT_PUBLIC_AI_ENABLED=true` (bật AI guard).
5. Backup nếu AI service down: hook **fail-open** → swap vẫn đi tiếp bình thường, không chặn.

## Kịch bản

### Phút 1 — Swap bình thường
1. Kết nối Phantom (Devnet).
2. Tab **Swap** → pool USDC, nhập `0.1` SOL → SOL.
3. Bấm **"Ký và đổi"**.
4. Hook gọi `POST /api/analyze` (proxy → AI service `/analyze`, ~1-3s).
5. Text swap bình thường → `risk_score` thấp (< 70) → giao dịch ký ngay, không modal.

### Phút 2 — Giao dịch rủi ro cao (modal cảnh báo)
1. Nhập text gợi ý scam vào ô phân tích (hoặc swap token có `report_count` cao trên registry).
2. AI trả `risk_score ≥ 70` + `signals` + `legal_refs` (ví dụ BLHS Điều 174).
3. Modal **"⚠ Cảnh báo rủi ro cao"** hiện lên:
   - Điểm rủi ro to, label `SCAM`.
   - Danh sách dấu hiệu (OTP, trúng thưởng, link lạ...).
   - Trích dẫn luật: Điều / Khoản / link văn bản.
   - `on_chain_context`: `report_count`, `recent_tx_count`, `wallet_age_days` (nếu có).
4. Bấm **"Hủy giao dịch"** → swap dừng, không ký.

### Phút 3 — Chỉ vào log AI service
1. Console `uvicorn` hiện request `/analyze` với `risk_score`, `signals`, `legal_refs`.
2. Giải thích công thức:
   ```
   final_risk = clamp(0, 100, on_chain_risk > 0 ? (0.6 * nlp_risk + 0.4 * on_chain_risk + bonus) : (nlp_risk + bonus))
   ```
   - `bonus`: cộng điểm từ sổ đen SCAMREG (Solana Memo) và heuristics ví mới (< 7 ngày tuổi với ≥ 5 giao dịch gần đây).
3. Kết luận: 3 tầng:
   - On-chain (Solana Memo): Sổ đen `SCAMREG` + Ghi nhận bằng chứng `VERISAI` + Raydium CPMM (roadmap: Anchor programs `scam_detector` MLP int8, `veris_registry`).
   - Off-chain AI: FastAPI (XLM-R + luật BLHS + SCAMREG / on-chain context).
   - Frontend: Next.js 16 (DEX + Veris Shield `/shield`).

## Ghi chú kỹ thuật

- Tầng on-chain đang chạy sử dụng Solana SPL Memo program (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) để đọc sổ đen `SCAMREG` và ghi nhận bằng chứng `VERISAI`.
- Anchor programs `scam_detector` và `veris_registry` đã pass `cargo check`, thuộc roadmap mở rộng on-chain.
- Rate limit in-memory: 10 req/phút/IP cho `/analyze`. Bấm demo nhanh liên tiếp
  quá 10 lần trong 1 phút sẽ gặp `429` — chờ 60s rồi tiếp tục.
- Audio upload (`/speech-to-text`) giới hạn 5MB; các endpoint còn lại 16KB.

## Pre-demo checklist

- [ ] .env.local tồn tại với NEXT_PUBLIC_AI_ENABLED=true
- [ ] BLACKLIST_SOURCES có ví admin đã ghi SCAMREG
- [ ] AI Service chạy tại localhost:8000
- [ ] Model đã cache (lần đầu chạy tải ~1GB)
- [ ] Web Next.js chạy cùng máy với AI service

