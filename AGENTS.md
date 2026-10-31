# Phạm vi dự án hiện tại

Theo yêu cầu ngày 31/10/2026, dự án chỉ giữ trang chủ, Điều khoản sử dụng và Câu hỏi thường gặp. Backend, AI, game, đăng nhập và các cổng quản lý đã được xóa; không khôi phục các chức năng đó nếu chưa có yêu cầu mới. Giữ file `fuction list/HaoKhiDongA_DanhSachChucNang_ver0.1 (1).xlsx` theo yêu cầu riêng của người dùng.

- `frontend/app/`: chỉ có `index.tsx`, `dieu-khoan-su-dung.tsx`, `cau-hoi-thuong-gap.tsx` và `_layout.tsx`.
- Giữ các thành phần, dữ liệu, hook và tài nguyên mà ba trang sử dụng. Import bằng `@/…`.
- Dùng bảng màu sáng trong `constants/theme.ts`, `useTheme()` và các phông Manrope/Newsreader đã nạp ở `_layout.tsx`. Nút có nhãn trợ năng và vùng chạm ít nhất 44pt.
- Ghi công ảnh và bản đồ nằm cuối trang điều khoản, `assets/hero-photos/ATTRIBUTION.md` và `constants/map-credits.ts`. Giữ thông báo giấy phép của mã bên thứ ba còn dùng.
- Kiểm tra bằng `cd frontend`, `npm run typecheck`, `npm run build` và kiểm tra ba route khi thay đổi điều hướng.

# Database migrations

Giữ nguyên lịch sử `database/migrations/001_*.sql` đến `013_*.sql` và dữ liệu đang có. Bản website hiện tại không có backend/migration runner và không kết nối database.

Nếu sau này có thay đổi PostgreSQL hoặc seed/reference data, thêm file SQL với số tiếp theo trong `database/migrations/`; không sửa, đổi tên hay xóa migration đã áp dụng. Không nhúng DDL vào TypeScript/Python, không chứa bí mật hay dữ liệu tài khoản thật. Không thêm BEGIN/COMMIT/ROLLBACK hoặc lệnh chỉ chạy ngoài transaction. Bảng mới chứa dữ liệu người dùng phải bật RLS, không mở quyền công khai. Kiểm tra bằng PostgreSQL thử nghiệm trước khi áp dụng; thay đổi phá hủy dữ liệu cần được người dùng cho phép rõ ràng. Không tự sửa `_prisma_migrations` hay lịch sử `app_schema_migrations`.

# Phạm vi đồng bộ của bản ba trang

Quy trình đồng bộ được giữ bên dưới. Các bước liên quan Render, backend hoặc Supabase chỉ áp dụng khi có yêu cầu khôi phục hoặc sửa các dịch vụ đó; bản website ba trang chỉ cần kiểm tra frontend và Vercel. Việc xóa mã không cho phép tự ý xóa dịch vụ hay dữ liệu trên nhà cung cấp.
# Tự động đồng bộ sau khi hoàn tất công việc

Người dùng đã cho phép tự động cập nhật dự án sau mỗi yêu cầu sửa đổi hoàn tất; không cần hỏi lại để commit, push hoặc triển khai các thay đổi thuộc yêu cầu đó. Đây là quy trình kết thúc mỗi lần làm việc của agent, không phải dịch vụ theo dõi mọi lần lưu file khi agent không hoạt động.

- Chạy kiểm tra phù hợp với thay đổi; xử lý lỗi trước khi phát hành. Không tự đưa thay đổi không liên quan hoặc bí mật vào commit.
- Commit và push lên `https://github.com/Nvda06042005/DATN-2026`. Thư mục dự án chính là repo Git (không còn bản sao `deploy-sync/`): commit trực tiếp, xem lại `git status`/`git diff` trước khi push; không force-push. Thay đổi kiến trúc lớn (đổi backend/runtime) đưa lên nhánh riêng trước, chỉ gộp vào `main` khi dịch vụ Render tương ứng đã sẵn sàng.
- Website chính thức duy nhất: `https://datn-2026-indol.vercel.app/`. Vercel chỉ tự triển khai từ nhánh `main` của GitHub (thư mục `frontend`, `frontend/vercel.json`); không dùng URL Preview hoặc URL có mã deployment để bàn giao. Kiểm tra trạng thái triển khai và website sau push.
- Render triển khai backend từ GitHub theo `render.yaml` (dịch vụ `dong-a-api` và `dong-a-ai`). Kiểm tra `/api/health`, `/api/database/health` và API liên quan đến thay đổi. Nếu thiếu quyền truy cập, báo rõ phần chưa hoàn tất.
- Supabase: thay đổi schema hoặc seed/reference data phải có migration mới theo quy tắc ở trên. Backend áp dụng migration khi khởi động; xác minh migration đã chạy.
- Chỉ báo đồng bộ thành công khi có bằng chứng cho từng dịch vụ; nêu rõ lỗi triển khai hoặc thiếu kết nối.
