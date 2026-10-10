# Deploy Veris lên Vercel

Vercel chạy giao diện và các API `/api/*`. **AI service (FastAPI) không chạy trên Vercel**: nó cần một máy chủ riêng có khoảng 2 GB RAM. Nếu không có máy chủ đó, trang Kiểm tra lừa đảo trả lỗi 503 và Swap không hiện cảnh báo.

1. Vercel → **Add New → Project** → import repo `danielquang07/veris`.
2. Framework: Next.js, giữ nguyên lệnh build mặc định.
3. Biến môi trường:

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_RPC_URL` | RPC Solana devnet (để trống = RPC công cộng) |
| `BLACKLIST_SOURCES` | Ví admin nguồn sổ đen `SCAMREG`, cách nhau dấu phẩy |
| `NEXT_PUBLIC_AI_ENABLED` | `true` để bật AI guard (cần build lại sau khi đổi) |
| `AI_SERVICE_URL` | URL công khai của AI service (không dùng được `localhost`) |

4. **Deploy**. Kiểm tra: mở `https://<ten-du-an>.vercel.app/api/health` → thấy `"status":"ok"`.

Push lên nhánh `main` là Vercel tự deploy lại.

## Trang web

- `/`: **Veris DEX**. Swap token có Veris Shield kiểm tra token trước khi ký, kiểm tra thanh khoản, cung cấp thanh khoản, cầu nối cross-chain (mô phỏng). Dùng program Raydium CPMM Devnet và 2 pool thử có sẵn (SOL/USDC thử, SOL/USDT thử), không cần deploy gì thêm.
- `/shield`: **Veris Shield**: quét token (on-chain + AI đọc tin nhắn), quét ví, thu hồi quyền rút; `/check-scam` chuyển hướng về đây.

## API

- `GET /api/token-check?mint=`: báo cáo rủi ro token, đọc on-chain (chạy được trên Vercel, không cần AI service).
- `GET /api/wallet-scan?owner=`: quét ví: token nguy hiểm, quyền rút đã cấp, token bị khóa.
- `POST /api/analyze`: proxy sang AI service, cộng thêm điểm từ sổ đen `SCAMREG`.
- `GET /api/health`: kiểm tra còn sống.
- Gọi API từ domain khác: đặt `ALLOWED_ORIGINS` (để trống = cho mọi nguồn).
