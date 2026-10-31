# SQL migrations

Thêm file mới theo số thứ tự, ví dụ `011_add_student_badges.sql`.
Tạo file bằng lệnh (từ thư mục `backend/`): `npm run build && npm run migrate -- new add_student_badges`.

Không sửa migration đã chạy, không chứa bí mật/dữ liệu tài khoản thật,
không thêm transaction wrapper. Bảng mới chứa dữ liệu người dùng phải bật RLS.
Runner của backend NestJS tự chạy khi khởi động với `DATABASE_URL` và ghi lịch sử vào
`public.app_schema_migrations`.

`006_schools_provisioning.sql`: trường học, vai trò `root_admin`/`school_admin` (tài khoản `admin` cũ thành
`root_admin`), cột hồ sơ tài khoản, thùng rác, lớp học, thông báo, lượt nhập Excel, dòng thiếu thông tin,
hàng đợi thư; vai trò `dong_a_school_scope` + chính sách RLS theo `app.school_id`. Phần `pg_trgm`, `vector`
(pgvector) và vai trò RLS được bọc khối an toàn: CSDL không hỗ trợ thì bỏ qua, backend dùng cách dự phòng.

`007_password_reset.sql`: bảng `app_password_resets` cho chức năng "Quên mật khẩu" (băm SHA-256 của mã đặt lại,
hạn dùng, đã dùng chưa); bật RLS và không cấp quyền cho vai trò nào ngoài chủ bảng (backend).

Xem [hướng dẫn cấu hình và triển khai](../../README.md#triển-khai).

`008_account_security.sql` (TM.SEC): `app_users.token_version` thu hồi toàn bộ phiên khi khóa/đổi quyền;
`app_revoked_tokens` chỉ lưu SHA-256 của token đã đăng xuất và hạn dùng;
`app_login_events` ghi kết quả đăng nhập và `app_audit_events` ghi thao tác có xác thực.
Cả ba bảng mới đều bật RLS. Chỉ `dong_a_school_scope` được đọc hai bảng lịch sử theo `app.school_id`;
không có quyền/policy công khai, không lưu mật khẩu, raw token, nội dung file nhập hoặc request body.
Không băm lại mật khẩu trong SQL: Bcrypt áp dụng cho mật khẩu mới; tài khoản PBKDF2 được nâng cấp khi đăng nhập đúng.
Kiểm chứng trên PostgreSQL tạm bằng `cd backend && npm run build && npm run migrate -- check && npm test` trước khi triển khai.

`009_school_management.sql`: bổ sung địa chỉ, liên hệ, `is_active` cho trường; khối và `is_active` cho lớp.
Giữ nguyên RLS, chính sách scope, tài khoản và dữ liệu hiện có. Chỉ suy khối từ mã lớp cũ bắt đầu rõ ràng bằng 6–9
(ví dụ 7A1); các mã khác giữ NULL. `GET /api/database/health` trả thêm `schema_version` đọc từ lịch sử migration,
để kiểm chứng backend Production đã áp dụng migration mà không cần lộ thông tin kết nối.

`010_reporting_scope.sql`: lưu trường/lớp/năm/khối của trận thi đấu và RLS chỉ đọc theo trường cho
hai bảng kết quả hiện có. Trận cũ giữ nguyên nội dung/điểm, chỉ gán trường hiện tại của giáo viên;
không đoán năm học. Trận mới chép ngữ cảnh trường của phòng và năm/khối nếu khớp đúng một lớp.
Xem [dashboard, bộ lọc và giới hạn số liệu](../../docs/ADMIN_REPORTS.md).

`011_content_management.sql`: sáu bảng nội dung/cấu hình của quản trị tổng (lịch sử cập nhật, chương trình, lớp chỉnh sửa
ngân hàng câu hỏi, kho sử liệu AI, thẻ danh tướng, luật EXP), bật RLS và không cấp quyền cho vai trò theo trường. Dữ liệu gốc
(3 cuộc kháng chiến, 9 ải, 14 thẻ, luật EXP phiên bản 1) lấy từ nội dung game hiện có; không thay đổi bảng hay dữ liệu cũ.
Xem [nội dung và cấu hình](../../docs/ADMIN_CONTENT.md).

`012_class_lifecycle.sql`: lớp có thể chưa có giáo viên và chưa có mật khẩu gia nhập (hai cột cho phép NULL), thêm
`join_open`, sĩ số dự kiến, người tạo, thời điểm đóng; bảng khối theo trường và năm học; lịch sử vòng đời lớp (chỉ thêm).
Lớp và học sinh hiện có giữ nguyên, lớp cũ vẫn nhận học sinh như trước. Xem [vòng đời lớp](../../docs/TIEN_DO_CHUC_NANG.md).
