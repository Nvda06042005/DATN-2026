# Đông A – Frontend

Giao diện học Lịch sử 7 (Ba lần kháng chiến chống quân Mông – Nguyên). Phong cách Duolingo kết hợp Kahoot/Quizizz và linh vật heo đất "Bé Ủn".

## Cấu trúc

```
src/
  App.tsx     toàn bộ giao diện (giáo viên + học sinh) trong một file
  main.tsx    điểm khởi chạy React
  index.css   hệ thiết kế (màu, nút 3D, hiệu ứng)
  assets/     ảnh bản đồ và tranh trận Bạch Đằng
```

Địa chỉ backend lấy từ biến môi trường `VITE_API_URL` (mặc định `http://localhost:8000`).

## Đăng nhập & dữ liệu thật

Có hai trang riêng, dùng chung backend:

| Trang | Địa chỉ | Ai đăng nhập được |
| --- | --- | --- |
| Trang chủ (chọn vai trò) | `/` | — |
| Trang học sinh | `/hoc-sinh` | Chỉ học sinh |
| Trang giáo viên | `/giao-vien` | Chỉ giáo viên |
| Trang quản trị | `/admin` | Chỉ quản trị viên |

Bản 1 file mở trực tiếp dùng `index.html#/hoc-sinh`, `#/giao-vien`, `#/admin`. Đăng nhập sai trang sẽ bị từ chối và được chỉ sang đúng trang; phiên đăng nhập của mỗi trang tách riêng.

- Tài khoản quản trị tạo sẵn ở lần chạy backend đầu tiên: **`admin` / `admin@123`** (đổi bằng `ADMIN_USERNAME`, `ADMIN_PASSWORD`). Tài khoản này chỉ đăng nhập được ở `/admin`. Phiếu tài khoản (CSV / in) tự ghi đúng trang đăng nhập cho học sinh và giáo viên.
- Quản trị viên cấp tài khoản giáo viên/học sinh theo lớp (từng người hoặc dán cả danh sách), phát mật khẩu tạm (CSV / in phiếu), đặt lại mật khẩu, khoá/xoá và xem tiến độ từng học sinh.
- Giáo viên, học sinh đăng nhập bằng mật khẩu tạm và đổi mật khẩu ở lần đầu.
- Dữ liệu học tập lưu theo từng tài khoản trên backend: KN, đá quý, chuỗi ngày học, số chặng đã học, độ chính xác, mức nắm vững BKT, heo đất. Giáo viên thấy học sinh thật của lớp mình (cùng tên lớp), học sinh thấy bảng xếp hạng thật của lớp.

## Lệnh

| Lệnh | Kết quả |
| --- | --- |
| `npm install` | Cài thư viện |
| `npm run dev` | Chạy thử tại http://localhost:5173 (cần backend đang chạy để đăng nhập) |
| `npm run build` | Bản triển khai web trong `dist/` |
| `npm run build:single` | Một file duy nhất `dist-single/index.html`, mở bằng trình duyệt là chạy |

File `dist-single/index.html` đã chứa sẵn JS, CSS và ảnh. Font chữ Nunito, ảnh minh họa từ Unsplash vẫn cần mạng; đăng nhập và các tính năng AI cần backend đang chạy.
