# SQL migrations

Thêm file mới theo số thứ tự, ví dụ `007_add_student_badges.sql`.
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
