# SQL migrations

Thêm file mới theo số thứ tự, ví dụ `009_add_student_badges.sql`.
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
