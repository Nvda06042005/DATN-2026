# Phạm vi dự án hiện tại

Ngày 31/10/2026 dự án từng được rút gọn còn trang chủ, Điều khoản sử dụng và Câu hỏi thường gặp. Cùng ngày, theo yêu cầu mới của người dùng ("đọc danh sách chức năng `fuction list/HaoKhiDongA_DanhSachChucNang_ver0.1 (1).xlsx` rồi triển khai Sprint 1 và 2"), dự án có lại backend NestJS, cơ sở dữ liệu PostgreSQL và bốn cổng đăng nhập theo đặc tả mới (mã `HK.*`). Bản game/AI/thi đấu trực tiếp cũ **không** được khôi phục; chúng sẽ được xây lại theo các sprint sau của đặc tả. Tiến độ và quyết định nằm ở `docs/TIEN_DO_HAO_KHI.md`; cập nhật tài liệu này mỗi khi xong một nhóm chức năng.

- `frontend/app/`: `index.tsx`, `dieu-khoan-su-dung.tsx`, `cau-hoi-thuong-gap.tsx` (công khai), `portal.tsx`, `hoc-sinh.tsx`, `giao-vien.tsx`, `school-manager-admin.tsx`, `admin.tsx` và `_layout.tsx`. Hai cổng quản trị không có liên kết từ trang chủ. Cổng quản trị: `components/admin/` (giao diện phẳng qua `AdminUiContext`, thành phần dùng chung trong `kit.tsx`).
- `backend/`: NestJS. Quyền theo vai trò (`root_admin`, `school_admin`, `teacher`, `student`) kiểm tra ở mọi route; dữ liệu quản trị trường chạy trong `db.scoped(school_id)` (Row-Level Security). Kho lịch sử chỉ quản trị tổng. Kiểm thử bằng `cd backend && npm run build && npm test` (PostgreSQL tạm; cần Program Files/PostgreSQL hoặc `POSTGRES_BIN`).
- Import mã `src` trong kiểm thử phải dùng `import()` động sau khi `startApp` đặt biến môi trường (cấu hình đọc khi import).
- Dùng bảng màu sáng trong `constants/theme.ts`, `useTheme()` và các phông Manrope/Newsreader đã nạp ở `_layout.tsx`. Nút có nhãn trợ năng và vùng chạm ít nhất 44pt.
- Ghi công ảnh và bản đồ nằm cuối trang điều khoản, `assets/hero-photos/ATTRIBUTION.md` và `constants/map-credits.ts`. Giữ thông báo giấy phép của mã bên thứ ba còn dùng (React Bits, Leaflet).
- Kiểm tra giao diện bằng `cd frontend`, `npm run typecheck`, `npm run build`; thay đổi cổng quản trị nên chụp thử trên bản web (xem ghi chú dự án về Chrome CDP).

# Database migrations

Mọi thay đổi cấu trúc PostgreSQL và dữ liệu seed/reference phải có một file SQL mới trong `database/migrations/` (đánh số tăng dần; hiện tới `016`). Không sửa, đổi tên hoặc xóa migration đã áp dụng (runner từ chối). Ngày 31/10/2026 thư mục này từng bị xóa theo yêu cầu rồi được khôi phục nguyên văn từ Git (001–013) vì Supabase vẫn giữ lịch sử đó; xem `database/migrations/README.md`. Kiểm tra lịch sử migration của database đích trước khi chọn số tiếp theo; không tự coi đó là database mới.

Không nhúng DDL vào TypeScript/Python, không chứa bí mật hay dữ liệu tài khoản thật. Không thêm BEGIN/COMMIT/ROLLBACK hoặc lệnh chỉ chạy ngoài transaction. Bảng mới chứa dữ liệu người dùng phải bật RLS, không mở quyền công khai; bảng chỉ backend dùng (kho lịch sử) không cấp quyền cho vai trò theo trường. Kiểm tra bằng PostgreSQL thử nghiệm trước khi áp dụng; thay đổi phá hủy dữ liệu cần được người dùng cho phép rõ ràng. Không tự sửa `_prisma_migrations` hay lịch sử `app_schema_migrations`. Dữ liệu nghiệp vụ phát sinh qua API dùng truy vấn có tham số, không tạo migration cho từng thao tác của người dùng.

# Tự động đồng bộ sau khi hoàn tất công việc

Người dùng đã cho phép tự động cập nhật dự án sau mỗi yêu cầu sửa đổi hoàn tất; không cần hỏi lại để commit, push hoặc triển khai các thay đổi thuộc yêu cầu đó. Đây là quy trình kết thúc mỗi lần làm việc của agent, không phải dịch vụ theo dõi mọi lần lưu file khi agent không hoạt động.

- Chạy kiểm tra phù hợp với thay đổi; xử lý lỗi trước khi phát hành. Không tự đưa thay đổi không liên quan hoặc bí mật vào commit (xem `git status`: người dùng có thể đang sửa file khác, chỉ `git add` đúng file thuộc yêu cầu).
- Commit và push lên `https://github.com/Nvda06042005/DATN-2026`. Thư mục dự án chính là repo Git: xem lại `git status`/`git diff` trước khi push; không force-push. Thay đổi kiến trúc lớn (đổi backend/runtime, thêm lại backend) đưa lên nhánh riêng trước (hiện `feat/hao-khi-sprint-1-2`), chỉ gộp vào `main` khi dịch vụ Render tương ứng đã sẵn sàng và người dùng đồng ý.
- Website chính thức duy nhất: `https://datn-2026-indol.vercel.app/`. Vercel chỉ tự triển khai từ nhánh `main` (thư mục `frontend`, `frontend/vercel.json`); không dùng URL Preview hoặc URL có mã deployment để bàn giao. Kiểm tra trạng thái triển khai và website sau khi gộp vào `main`.
- Render triển khai backend `dong-a-api` từ GitHub theo `render.yaml`. Kiểm tra `/api/health`, `/api/database/health` (có `schema_version`) và API liên quan. Dịch vụ `dong-a-ai` của bản cũ không còn trong `render.yaml`. Nếu thiếu quyền truy cập, báo rõ phần chưa hoàn tất.
- Supabase: thay đổi schema hoặc seed/reference data phải có migration mới theo quy tắc ở trên. Backend áp dụng migration khi khởi động; xác minh bằng `schema_version` của `/api/database/health`.
- Chỉ báo đồng bộ thành công khi có bằng chứng cho từng dịch vụ; nêu rõ lỗi triển khai hoặc thiếu kết nối.
