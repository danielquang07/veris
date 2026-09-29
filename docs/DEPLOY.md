# Deploy Veris lên Vercel

Chỉ cần Vercel: Vercel chạy cả giao diện lẫn các API `/api/*`.

1. Vercel → **Add New → Project** → import repo `danielquang07/veris`.
2. Framework: Next.js, giữ nguyên lệnh build mặc định.
3. Biến môi trường (đều tùy chọn):

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_RPC_URL` | RPC Solana devnet (để trống = RPC công cộng) |
| `BLACKLIST_SOURCES` | Ví admin nguồn sổ đen, cách nhau dấu phẩy |

4. **Deploy**. Kiểm tra: mở `https://<ten-du-an>.vercel.app/api/health` → thấy `"status":"ok"`.

Push lên nhánh `main` là Vercel tự deploy lại.

## Smart contract

Program `veris_market` đã deploy trên Solana **devnet**, địa chỉ nằm trong `lib/idl/veris_market.json`, web tự dùng, không cần cấu hình.
Mã nguồn và test: `anchor/programs/veris_market`.

## Ghép vào source chính (team Tùng)

- Các API: xem `docs/INTEGRATION.md` (`withdraw-check`, `trade-check`, `temp-wallet`); `GET /api/health` để kiểm tra còn sống.
- Gọi API từ domain khác: đặt `ALLOWED_ORIGINS` = domain của source chính (để trống = cho mọi nguồn).
- Chép code: `app/api/*`, `lib/*`, `proxy.ts`, `components/payment/*`, `components/market/*`.
