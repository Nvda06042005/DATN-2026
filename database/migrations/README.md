# SQL migrations

Thêm file mới theo số thứ tự, ví dụ `017_ten_thay_doi.sql`.
Tạo file bằng lệnh (từ thư mục `backend/`): `npm run build && npm run migrate -- new ten_thay_doi`.

Không sửa migration đã chạy, không chứa bí mật/dữ liệu tài khoản thật, không thêm transaction wrapper.
Bảng mới chứa dữ liệu người dùng phải bật RLS. Runner của backend NestJS tự chạy khi khởi động với `DATABASE_URL`
và ghi lịch sử vào `public.app_schema_migrations`; kiểm tra không cần CSDL bằng `npm run migrate -- check`.

Ngày 31/10/2026 thư mục này từng bị xóa theo yêu cầu (website chỉ còn ba trang) rồi được khôi phục khi bắt đầu Sprint 1–2 của
`HaoKhiDongA_DanhSachChucNang_ver0.1`. Supabase vẫn giữ lịch sử 001–013 nên các file đó được lấy lại nguyên văn từ Git
(commit 46d312a); đổi nội dung hay tên một file đã chạy sẽ bị runner từ chối. Số tiếp theo luôn là số lớn nhất ở đây cộng một.

| File | Nội dung |
| --- | --- |
| `001_initial_postgres_schema.sql` | Mốc ban đầu của `do_an_tot_nghiep` (bảng `User`, `Profile`, `UserSettings`, `_prisma_migrations` đã nhập vào Supabase; giữ nguyên) |
| `002_app_users.sql` | `app_users` |
| `003`–`005` | Tiến độ học, trạng thái game, thi đấu trực tiếp của bản cũ (bảng vẫn còn, bản mới chưa dùng) |
| `006_schools_provisioning.sql` | Trường học, vai trò `root_admin`/`school_admin`, lớp, thành viên lớp, thông báo, hàng đợi email, vai trò RLS `dong_a_school_scope` và chính sách theo `app.school_id` |
| `007_password_reset.sql`, `013_profiles_and_otp.sql` | Mã đặt lại mật khẩu (OTP), cột hồ sơ cá nhân |
| `008_account_security.sql` | Thu hồi token, nhật ký đăng nhập, nhật ký thao tác |
| `009`, `010`, `011`, `012` | Liên hệ trường, báo cáo, nội dung game cũ, vòng đời lớp (bảng khối theo năm, lịch sử lớp) |
| `014_hk_accounts_years_classes.sql` | Lý do khóa, cấp quản trị tổng, xác nhận hồ sơ, OTP đăng ký tự học, **bảng năm học** (suy từ lớp/khối/tài khoản cũ), **mã tham gia lớp 6 ký tự** (lớp cũ nhận mã ngẫu nhiên), **bảng giáo viên–lớp** (chép từ `teacher_id`), khóa ngoại giáo viên không còn xóa lớp, thêm loại sự kiện lớp, RLS theo trường cho bảng mới. Dữ liệu cũ giữ nguyên |
| `015_history_warehouse.sql` | Kho dữ liệu lịch sử: `hist_campaigns`, `hist_places`, `hist_figures`, `hist_events`, `hist_battles`, `hist_sources`, `hist_terms`, `hist_links`, `hist_versions`; RLS bật, **không** cấp quyền cho vai trò theo trường (chỉ backend đọc/ghi) |
| `016_seed_history_warehouse.sql` | Nội dung khởi tạo của kho (tất cả ở trạng thái Nháp, kèm phiên bản 1 và liên kết); chạy lại không tạo trùng |

Kiểm chứng trên PostgreSQL tạm bằng `cd backend && npm run build && npm test` trước khi triển khai.
Xem [tiến độ theo mã HK.*](../../docs/TIEN_DO_HAO_KHI.md).
