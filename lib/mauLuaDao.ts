/**
 * Mau tin nhan lua dao tieng Viet dung de demo.
 *
 * LUU Y: day la vi du TU SOAN de minh hoa cac thu doan pho bien,
 * khong phai tin nhan that cua nguoi that. So tai khoan, so dien thoai
 * deu la so gia. Khi thu thap mau that tu nguoi dung, phai che het
 * thong tin ca nhan truoc khi dua vao day.
 */
export type MauLuaDao = {
  nhan: string;
  noiDung: string;
};

export const MAU_LUA_DAO: MauLuaDao[] = [
  {
    nhan: "Hứa lợi nhuận",
    noiDung:
      "Chào anh chị, bên em đang có kèo đầu tư lợi nhuận 30%/tháng, bảo hiểm vốn 100%, chỉ còn 2 suất cuối. Anh chị chuyển khoản vào STK 0912345678 Ngân hàng ABC chủ tài khoản NGUYEN VAN A để giữ suất nhé.",
  },
  {
    nhan: "Việc nhẹ lương cao",
    noiDung:
      "Tuyển CTV chốt đơn tại nhà, không cần kinh nghiệm, thu nhập 500-800k/ngày. Bạn chỉ cần nạp 200k tiền cọc nhiệm vụ vào số tài khoản 19001234567 rồi bên mình hoàn lại ngay kèm hoa hồng.",
  },
  {
    nhan: "Đòi nạp thêm để rút",
    noiDung:
      "Tài khoản của bạn hiện có 45.000.000đ nhưng đang bị treo do sai cú pháp. Vui lòng nạp thêm 3 triệu phí xác minh vào ví 9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin để hệ thống mở khoá lệnh rút.",
  },
  {
    nhan: "Mạo danh tổ chức",
    noiDung:
      "Chi cục Thuế thông báo: bạn có khoản truy thu chưa nộp. Đề nghị liên hệ số 0987654321 và chuyển khoản vào STK 0334455667 trong hôm nay, quá hạn sẽ chuyển hồ sơ sang cơ quan điều tra.",
  },
  {
    nhan: "Tin bình thường (để so sánh)",
    noiDung:
      "Chào bạn, mai lớp mình họp lúc 8h tại phòng A305 nhé. Ai bận thì báo lại lớp trưởng trước 9h tối nay.",
  },
];
