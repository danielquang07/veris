# Tích hợp Veris vào mục Thanh toán — Hào Khí Đại Việt

Veris là lớp chống lừa đảo gắn vào mục Thanh toán của game. Game gọi 3 API dưới đây **trước khi ký giao dịch**.
Veris không giữ tiền, không ký giao dịch: game giữ tiền và tự chuyển, Veris chỉ kiểm tra và tính luật.

Demo chạy được ở `/` (mục Thanh toán).

**Sổ đen được ghi từ đâu:** khi admin phân xử một bên sai trong kèo người–người, ví của bên đó được ghi lên Solana thành memo `SCAMREG`, ký bằng ví admin. Các API kiểm tra đọc lại sổ đen từ những ví admin này (`BLACKLIST_SOURCES`).

| Hình thức | API | Khi nào gọi |
|---|---|---|
| ① Tự rút về ví | `POST /api/withdraw-check` | Người chơi bấm Rút |
| ② Trao đổi người–người | `POST /api/trade-check` | Hai bên chốt kèo, trước khi mở temp wallet |
| ② Trao đổi người–người | `POST /api/temp-wallet` | Mỗi bước của kèo (cọc, trả nốt, giao, quá hạn, đóng băng, admin xử) |

---

## 1. `POST /api/withdraw-check` — Tự rút về ví

Chỉ dùng code, không gọi AI. Nếu người chơi rút đúng ví của mình thì game không hiện gì thêm.

```json
// request
{
  "chain": "sol",                       // "sol" | "sui"
  "to": "Df9HVX...K98D3Y",              // địa chỉ nhận
  "linkedWallets": ["<ví SOL>", "<ví SUI>"],  // ví đã liên kết với tài khoản game
  "blacklistSources": []                // (tùy chọn) ví nguồn sổ đen thêm
}
// response
{
  "level": "green" | "red",
  "action": "withdraw" | "warn" | "block",
  "title": "Ví của bạn — rút ngay",     // tiếng Việt, hiện thẳng cho người chơi
  "reasons": ["..."],
  "reportCount": 0
}
```

Game xử lý như sau:
- `withdraw`: ký và rút luôn.
- `warn`: hiện popup gồm 2 nút **Hủy** và **Vẫn rút**.
- `block`: không cho rút, vì địa chỉ sai chuỗi và gửi sang là mất tiền.

## 2. `POST /api/trade-check` — Kiểm tra kèo người–người

```json
// request
{
  "chain": "sol",
  "value": 100,
  "buyer": "<ví người mua>",
  "seller": "<ví người bán>",
  "chat": "<đoạn chat chốt kèo>",       // tùy chọn, có thì AI đọc
  "tempWalletAddress": "<nếu đã có>"     // tùy chọn, để không bị tính là "ví lạ trong chat"
}
// response (rút gọn)
{
  "depositRate": 0.3, "deposit": 30,
  "level": "green" | "yellow" | "red",
  "recommendation": "continue" | "warn" | "freeze",
  "reasons": ["..."],                    // tiếng Việt
  "buyer":  { "reportCount": 0, "isNewWallet": true, "firstFunder": null, "funderBlacklisted": false, ... },
  "seller": { ... },
  "strangerAddressesInChat": ["..."],
  "ai": { "tactics": ["fake_admin", ...], "risk": 0.95, "evidence": ["..."], "explanation": "...", "advice": "..." } | null,
  "aiError": null
}
```

- `continue`: mở temp wallet bình thường.
- `warn`: hiện cảnh báo cho cả hai bên, người chơi tự quyết có tiếp tục hay không.
- `freeze`: vẫn mở temp wallet nhưng **đóng băng ngay**, đồng thời báo admin xem xét.

**Code quyết định, không phải AI.** AI chỉ phân loại thủ đoạn và chấm điểm rủi ro. Chỉ khi có thủ đoạn nguy hiểm (giả admin, địa chỉ cọc giả, lệnh hệ thống giả) **và** rủi ro ≥ 0.8 thì code mới chuyển sang `freeze`.

**Nếu AI lỗi**, API vẫn trả kết quả dựa trên phần code, kèm ghi chú. Kèo vẫn được bảo vệ bởi tiền cọc.

## 3. `POST /api/temp-wallet` — Luật temp wallet

API không lưu trạng thái. **Backend game giữ đối tượng `trade`**: mỗi lần gửi `trade` kèm một sự kiện, nhận lại `trade` mới. Khi kèo kết thúc, `trade.payouts` cho biết cần chuyển bao nhiêu cho ai.

```json
{ "create": { "id": "K1", "chain": "sol", "value": 100, "buyer": "...", "seller": "..." } }
{ "trade": { ... }, "event": { "type": "deposit", "role": "buyer" } }
```

| `event.type` | Ai được gọi | Ý nghĩa |
|---|---|---|
| `deposit` (`role`: buyer/seller) | người chơi | Cọc 30% (dưới ngưỡng) hoặc 50% |
| `pay_remainder` | người mua | Trả nốt phần còn lại **vào temp wallet** |
| `deliver` | **chỉ game server** | Hệ thống xác nhận đã giao hàng → tự giải ngân cho người bán |
| `timeout` | game server (hẹn giờ) | Bên bùng mất cọc cho bên kia |
| `freeze` (`by`: veris/admin) | Veris / admin | Đóng băng, tiền nằm yên |
| `unfreeze`, `admin_resolve` | **chỉ admin** | Mở băng / phân xử: `buyer_right`, `seller_right`, `refund_both` |

Ví dụ kèo 100 SOL, cọc 30%:

| Tình huống | Kết quả giải ngân |
|---|---|
| Suôn sẻ | Người bán nhận 130 (100 tiền hàng + 30 cọc). Người mua trả tổng đúng 100 |
| Người mua không trả nốt | Người bán nhận 60 (cọc của mình + cọc người mua) |
| Người bán không giao | Người mua nhận 130 (100 đã trả + 30 cọc người bán) |

**Chốt an toàn:** mọi lệnh chi trả chỉ được đi về đúng 2 ví của kèo, và tổng phải bằng đúng số dư. Sai một trong hai điều này thì lệnh bị chặn. Nhờ vậy, kể cả khi AI bị lừa bởi chat, tiền vẫn không thể đi sai chỗ.

---

## Cần team Tùng chốt

1. **Thứ tự bước 4–5 đã đổi so với sơ đồ đầu tiên:** người mua **trả nốt vào temp wallet trước**, người bán giao hàng sau. Nếu giao trước, người mua có thể nhận món hàng giá 100, bỏ 30 cọc và vẫn lời 70. Khi đó tiền cọc không bảo vệ được người bán.
2. **Ngưỡng chuyển từ cọc 30% sang 50%** hiện là số tạm: 200 SOL / 2000 SUI (`HIGH_DEPOSIT_THRESHOLD` trong `lib/tempWallet.ts`).
3. **Cọc của người mua được tính vào tiền hàng**, nên tổng người mua trả đúng bằng giá trị kèo.
4. **Sổ đen**: là các memo `SCAMREG` trên Solana do các ví nguồn ký. Khai báo ví nguồn (ví admin game, ví nhóm Veris) trong biến `BLACKLIST_SOURCES` của `.env.local`.
5. **Sui**: hiện chỉ kiểm tra định dạng địa chỉ và đối chiếu sổ đen. Chưa đọc lịch sử ví Sui (tuổi ví, ví nạp tiền đầu tiên); tính năng này mới có cho Solana.
6. **Đọc chat ngầm**: cần ghi vào điều khoản sử dụng của game, vì chat là dữ liệu cá nhân (Nghị định 13/2023).
