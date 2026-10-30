# Quản lý phân quyền và xác thực (GĐ1)

| Mã | Chức năng | Cách sử dụng / API |
| --- | --- | --- |
| TM.SEC.001 | Đăng nhập bằng tài khoản được cấp, đăng xuất, tạo quản trị | Bốn vai trò đi đúng cổng; `POST /api/auth/login`, `/api/auth/logout`. Quản lý tổng chọn **Tạo tài khoản quản trị**, chọn quản trị tổng hoặc trường. |
| TM.SEC.002 | Danh sách, tìm kiếm và lọc | `/api/admin/users`: từ khóa không dấu, vai trò, trạng thái, trường, khối, năm học, khu vực/thành phố; phân trang. |
| TM.SEC.003 | Chi tiết tài khoản | Bấm tên hoặc Thao tác → Xem chi tiết; `GET /api/admin/users/:id`, hồ sơ, trường, lớp liên quan và phạm vi truy cập. Không trả hash mật khẩu. |
| TM.SEC.004 | Phân quyền | Trong khung chi tiết, chọn vai trò và trường → Lưu phân quyền; `PATCH /api/admin/users/:id/role`. Phiên cũ bị thu hồi, bỏ lựa chọn lớp đang dùng; tiến độ và lịch sử được giữ. |
| TM.SEC.005 | Khóa / mở khóa | Thao tác trong danh sách; `PATCH /api/admin/users/:id` với `is_active`. Mở khóa không làm token cũ hoạt động lại. |
| TM.SEC.006 | Lịch sử đăng nhập và nhật ký thao tác | Hai tab lịch sử có tìm kiếm, kết quả, trường (root), phân trang; `GET /api/admin/login-history`, `/api/admin/audit-history`. Chỉ ghi sự kiện mới từ khi triển khai. |

Quản lý tổng thao tác toàn hệ thống và tạo được quản trị khác. Không tự khóa/xóa hoặc tự đổi quyền tài khoản đang dùng.
Quản trị trường chỉ thấy dữ liệu thuộc trường được gán và chỉ quản lý giáo viên/học sinh. Giao diện ẩn thao tác không có quyền;
API vẫn kiểm tra độc lập. Phân quyền dùng bốn vai trò RBAC, không có bộ quyền tùy ý theo từng nút.
Giáo viên chỉ lấy danh sách học sinh/điểm của lớp được duyệt do mình phụ trách và các thành viên của lớp đó.
Hai trường có cùng mã lớp không dùng chung bảng xếp hạng hoặc phòng thi đấu. API chat AI thuộc người dùng;
chức năng này không tạo thêm module giao bài/chat lớp chưa có trong ứng dụng.

Mật khẩu mới băm Bcrypt cost 12, nhập Excel dùng cost 10; không lưu bản rõ trong cột mật khẩu.
[Bcrypt giới hạn 72 byte](https://github.com/dcodeIO/bcrypt.js), nên backend từ chối mật khẩu mới vượt giới hạn,
không cắt ngầm. Hash PBKDF2 cũ vẫn xác minh được; đăng nhập đúng nâng cấp sang Bcrypt nếu không vượt 72 byte.
Mật khẩu dài cũ được giữ tương thích cho đến khi chủ tài khoản đổi. Không thể đổi thuật toán hàng loạt từ hash.
Thông tin tài khoản cấp thủ công/mật khẩu tạm chỉ trả một lần theo luồng cấp hiện có; không đưa vào lịch sử.

JWT được kiểm tra hạn dùng, vai trò hiện tại, trường, phiên bản thu hồi và dấu vân tay mật khẩu tại mỗi API.
Đăng xuất chỉ thu hồi token hiện tại; khóa/đổi quyền/đổi mật khẩu thu hồi mọi phiên của tài khoản.
WebSocket kiểm tra lại token ở mỗi tin nhắn, nên token đã thu hồi không tiếp tục gửi thao tác được.

Nhật ký HTTP ghi người thực hiện, vai trò, thời gian, route mẫu, ID đối tượng, trường và kết quả;
các lần gửi câu trả lời/nhập file/cập nhật tài khoản được ghi qua interceptor, không ghi payload hay nội dung mật khẩu.
Nhập nhiều trường ghi riêng từng batch/trường. Kết quả thi đấu có sự kiện `LIVE grade_results` lưu cùng transaction với bảng điểm, gắn giáo viên tổ chức và ID trận.
Lịch sử không phục dựng quá khứ và không tự theo dõi chỉnh sửa trực tiếp bằng SQL/Dashboard.

Migration **008_account_security.sql** là nguồn cấu trúc, giữ nguyên dữ liệu hiện có. Backend tự áp dụng sau triển khai
với URL Supabase. Bảng mới có RLS, không có policy đọc/ghi công khai; quản trị trường chỉ đọc lịch sử trường mình.
Chạy `npm run build`, `npm run migrate -- check`, `npm test` ở backend và `npm run typecheck`, `npx expo export -p web` ở frontend.
Kiểm thử HTTP/WebSocket dùng PostgreSQL tạm, không dùng tài khoản thật.
