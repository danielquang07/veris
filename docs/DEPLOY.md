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

## Trang web

- `/` — **Veris DEX** (Track 2): Cầu nối cross-chain (mô phỏng), Swap token, Kiểm tra thanh khoản, Cung cấp thanh khoản.
  Dùng đúng program và pool Raydium CPMM Devnet của DEX game chính (SOL/USDC thử, SOL/USDT thử), không cần deploy gì thêm.
- `/payments` — công cụ phụ cho game: kiểm tra rút ví, kèo người–người, escrow on-chain cho Chợ tướng.

## Ghép vào DEX của game chính (team Tùng)

Repo game chính: `github.com/duynguyen658/gamedefi` — DEX đã có Swap; Veris bổ sung 2 phần còn thiếu:

| Phần | File Veris | Ghép vào |
|---|---|---|
| Kiểm tra thanh khoản | `components/dex/LiquidityCheck.tsx` + `getPoolStats`, `priceImpact` trong `lib/raydium.ts` | Trang DEX, cạnh `DexSwapPanel` |
| Cung cấp thanh khoản | `components/dex/ProvideLiquidity.tsx` + `buildAddLiquidityTx`, `buildWithdrawLiquidityTx` trong `lib/raydium.ts` | Trang DEX (hoặc module "Tiết kiệm") |
| Cầu nối (mô phỏng) | `components/dex/CrossChainDemo.tsx` | Mục mới trong "Kinh Tế On-Chain" |

`lib/raydium.ts` dùng cùng phiên bản `@raydium-io/raydium-sdk-v2@0.2.73-alpha` và cùng pool ID với `frontend/src/services/raydiumSwap.ts` của game chính. Mọi giao dịch được mô phỏng trên Devnet trước khi mở ví ký, giống cách game chính làm với swap.

Escrow cho Chợ tướng ("Trao Đổi Tướng P2P – đang chờ escrow on-chain"): program Anchor `anchor/programs/veris_market` (4 test LiteSVM), client `lib/market.ts`, giao diện `components/market/EscrowTrade.tsx`. Chưa deploy lên devnet.

## API

- `docs/INTEGRATION.md`: `withdraw-check`, `trade-check`, `temp-wallet`; `GET /api/health` để kiểm tra còn sống.
- Gọi API từ domain khác: đặt `ALLOWED_ORIGINS` = domain của source chính (để trống = cho mọi nguồn).
