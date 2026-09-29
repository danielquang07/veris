# Deploy Veris — backend Render, frontend Vercel

Cùng một repo, deploy 2 nơi. Backend trên Render phục vụ `/api/*`; frontend trên Vercel gọi sang Render qua `NEXT_PUBLIC_API_URL`.

## 1. Backend — Render (Web Service)

| Mục | Giá trị |
|---|---|
| Repo | `danielquang07/veris`, nhánh `main` |
| Runtime | Node |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Auto-Deploy | Bật (push lên `main` là tự deploy lại) |

Biến môi trường:

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_RPC_URL` | RPC Solana devnet (để trống = RPC công cộng) |
| `BLACKLIST_SOURCES` | Ví admin nguồn sổ đen, cách nhau dấu phẩy |
| `ALLOWED_ORIGINS` | URL frontend Vercel, ví dụ `https://veris.vercel.app` (để trống = cho mọi nguồn) |

Kiểm tra: mở `https://<ten-render>.onrender.com/api/health` → thấy `"status":"ok"`.

## 2. Frontend — Vercel

- Import repo `danielquang07/veris`, Framework: Next.js, giữ nguyên lệnh build mặc định.
- Biến môi trường:

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL Render, ví dụ `https://veris-api.onrender.com` (không có `/` ở cuối) |
| `NEXT_PUBLIC_RPC_URL` | Giống bên Render |

Biến `NEXT_PUBLIC_*` được gắn vào lúc build, nên đổi biến xong phải **Redeploy**.

## 3. Giữ backend không ngủ

Render free ngủ sau ~15 phút không có request. Workflow `.github/workflows/keep-alive.yml` gọi `/api/health` 5 phút một lần.

- GitHub → Settings → Secrets and variables → Actions → **Variables** → thêm `BACKEND_URL` = URL Render.
- Chạy thử: tab Actions → keep-alive → Run workflow.

## 4. Ghép vào source chính (team Tùng)

- Chỉ cần các API: xem `docs/INTEGRATION.md` (request/response của `withdraw-check`, `trade-check`, `temp-wallet`); `GET /api/health` để kiểm tra backend còn sống.
- Gọi từ source chính: trỏ tới URL Render, thêm domain của source chính vào `ALLOWED_ORIGINS`.
- Muốn chép code vào: các file cần là `app/api/*`, `lib/*`, `proxy.ts`, `components/payment/*` (giao diện mẫu).
