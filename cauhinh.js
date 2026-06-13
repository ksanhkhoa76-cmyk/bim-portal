/* ============================================================
   ★★★ FILE CẤU HÌNH — NƠI DUY NHẤT BẠN CẦN SỬA THƯỜNG XUYÊN ★★★
   ------------------------------------------------------------
   - Đổi link Google Sheets / Apps Script: sửa các dòng LINK_...
   - Thêm / bớt nhân sự: sửa danh sách DANH_SACH_NHAN_SU
   - Đổi tên phòng: sửa TEN_DON_VI
   KHÔNG cần đụng tới giaodien.css hay xuly.js.
   ============================================================ */

const LINK_CSV         = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRTmIdgavLyCkeO1yUx5CvRdkYLH7cCW8tYlJ1QaSbKSpalHUP9pIexdo1dbiC5skg5d4_4L6pCd4lr/pub?gid=0&single=true&output=csv";
const LINK_CSV_NHIEMVU = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRTmIdgavLyCkeO1yUx5CvRdkYLH7cCW8tYlJ1QaSbKSpalHUP9pIexdo1dbiC5skg5d4_4L6pCd4lr/pub?gid=2130907067&single=true&output=csv";
const LINK_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbyUcTHBeIsUGGitZUkRxpl3NEcwNzK0nSqgUD4Rg2__IB1q8m9KBVHImZrbY0UFrKRxgA/exec";

const TEN_DON_VI = "Phòng BIM — KC1";

/* Danh sách nhân sự (dùng cho ô chọn người ở form). Thêm tên vào giữa 2 dấu " */
const DANH_SACH_NHAN_SU = [
  "Phạm Anh Khoa", "Huỳnh Minh Đức", "Hồ Công Bảo",
  "Vũ Minh Phúc", "Nguyễn Thành Cang", "Trần Khắc Trường", "Phan Gia Bảo"
];
