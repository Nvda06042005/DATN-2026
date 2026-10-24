# SQL migrations

Thêm file mới theo số thứ tự, ví dụ `006_add_student_badges.sql`.
Tạo file bằng lệnh (từ thư mục `backend/`): `npm run build && npm run migrate -- new add_student_badges`.

Không sửa migration đã chạy, không chứa bí mật/dữ liệu tài khoản thật,
không thêm transaction wrapper. Bảng mới chứa dữ liệu người dùng phải bật RLS.
Runner của backend NestJS tự chạy khi khởi động với `DATABASE_URL` và ghi lịch sử vào
`public.app_schema_migrations`.

Xem [hướng dẫn cấu hình và triển khai](../HUONG_DAN_SUPABASE.md).
