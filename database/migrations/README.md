# Lịch sử migration SQL

Giữ nguyên 13 file SQL từ `001_initial_postgres_schema.sql` đến `013_profiles_and_otp.sql`. Các file này ghi lại lịch sử schema và seed/reference data của phiên bản có backend; không sửa, đổi tên hoặc xóa migration đã áp dụng.

Từ 31/10/2026, website chỉ còn ba trang công khai. Backend và migration runner đã được gỡ, nên bản này không kết nối PostgreSQL và không tự áp dụng migration khi khởi động. Không còn dùng được các lệnh `npm run migrate` của backend cũ. Dữ liệu trên Supabase không bị xóa khi gỡ mã nguồn.

Nếu có yêu cầu thay đổi database sau này, thêm migration số tiếp theo (`014_ten_thay_doi.sql`), kiểm tra trên PostgreSQL thử nghiệm và cung cấp runner quản lý transaction/khóa chạy đồng thời. Không thêm BEGIN, COMMIT, ROLLBACK hoặc lệnh chỉ chạy ngoài transaction. Không lưu bí mật hay dữ liệu tài khoản thật; bảng mới có dữ liệu người dùng phải bật RLS. Không tự sửa `_prisma_migrations` hoặc `app_schema_migrations`.
