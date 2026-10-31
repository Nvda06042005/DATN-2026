# Hào Khí Đông A

Nền tảng học lịch sử game hóa về ba lần kháng chiến chống Nguyên – Mông thời Trần cho học sinh THCS (đề tài khóa luận).
Đặc tả: `fuction list/HaoKhiDongA_DanhSachChucNang_ver0.1 (1).xlsx` (348 chức năng, 12 sprint). **Đã làm: Sprint 1 và 2** – xem
[docs/TIEN_DO_HAO_KHI.md](docs/TIEN_DO_HAO_KHI.md) (từng mã HK.*, quyết định, phần chưa làm).

## Trang web

- `/`, `/dieu-khoan-su-dung`, `/cau-hoi-thuong-gap`: trang công khai (trang chủ, điều khoản kèm ghi công hình ảnh, câu hỏi thường gặp).
- `/portal`: đăng nhập chung của giáo viên và học sinh; `/hoc-sinh`: hồ sơ, tham gia lớp bằng mã 6 ký tự; `/giao-vien`: hồ sơ và lớp được phân công.
- `/school-manager-admin`: quản trị viên trường học – trường và năm học, khối lớp, giáo viên, học sinh, lớp, nhập/xuất Excel, nhân bản lớp sang năm mới.
- `/admin`: quản trị tổng – trường học, người dùng toàn hệ thống, **kho dữ liệu lịch sử** (cuộc kháng chiến, nhân vật, sự kiện, địa điểm trên bản đồ, trận đánh, dòng thời gian, tư liệu gốc, thuật ngữ; kiểm chứng và công bố; lịch sử chỉnh sửa; nhập/xuất).
- Hai cổng quản trị không có liên kết từ trang chủ.

## Cấu trúc

- `frontend/`: Expo (React Native + web, Expo Router), Manrope và Newsreader. `app/` (route), `components/admin/` (cổng quản trị), `components/portal/`, `api/`, `types/`.
- `backend/`: NestJS 11 + PostgreSQL. `src/auth` (đăng nhập, OTP, hồ sơ), `src/admin` (trường, năm học, tài khoản, lớp, Excel, hàng đợi email), `src/history` (kho lịch sử), `src/student` (vào lớp bằng mã), `test/` (Jest, PostgreSQL tạm).
- `database/migrations/`: SQL theo số thứ tự, nguồn thay đổi cơ sở dữ liệu duy nhất; xem [README của thư mục](database/migrations/README.md).
- `docs/`: [tiến độ theo mã HK.*](docs/TIEN_DO_HAO_KHI.md), [đối chiếu đặc tả với hệ thống](docs/DOI_CHIEU_HAO_KHI_V01.md).
- `render.yaml`: dịch vụ `dong-a-api` trên Render. `frontend/vercel.json`: Vercel build thư mục `frontend/`.

## Chạy trên máy

Backend (cần PostgreSQL; chuỗi kết nối đặt trong `backend/.env`, mẫu ở `backend/.env.example`):

```sh
cd backend
npm ci
npm run build
npm run migrate -- check     # kiểm tra file migration, không cần CSDL
npm run start                # tự chạy migration mới khi khởi động; tạo tài khoản quản trị tổng lần đầu (ADMIN_USERNAME/ADMIN_PASSWORD)
npm test                     # tự dựng PostgreSQL tạm (initdb/pg_ctl); đặt POSTGRES_BIN nếu không tìm thấy
```

Frontend (địa chỉ backend đặt bằng `EXPO_PUBLIC_API_URL`, mặc định `http://localhost:8000`):

```sh
cd frontend
npm ci
npm run web
npm run typecheck
npm run build                # xuất web vào frontend/dist/
```

Gửi thư (mật khẩu tạm, mã OTP) cần `SMTP_URL`/`SMTP_*` hoặc cầu `MAIL_RELAY_*` (xem `backend/.env.example`, `backend/mail-relay.gs`); chưa cấu hình thì mật khẩu tạm vẫn hiện một lần trên trang quản trị nhưng OTP quên mật khẩu không gửi được. Đăng nhập Google của học sinh cần `GOOGLE_CLIENT_ID` (backend) và `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (frontend).

## Triển khai

Website chính thức: https://datn-2026-indol.vercel.app/ (Vercel chỉ triển khai nhánh `main`). Backend trên Render (`render.yaml`), cơ sở dữ liệu Supabase PostgreSQL; backend áp dụng migration mới khi khởi động. Công việc Sprint 1–2 nằm ở nhánh `feat/hao-khi-sprint-1-2` cho tới khi được gộp vào `main`.

## Ghi công

Nguồn và giấy phép ảnh nhân vật: `frontend/assets/hero-photos/ATTRIBUTION.md` và phần “Thông tin hình ảnh” cuối trang Điều khoản sử dụng. Ba bản đồ của Lưu Ly thuộc phạm vi công cộng; liên kết nguồn nằm trong `frontend/constants/map-credits.ts` và cùng phần ghi công trên website.
Bản đồ chọn tọa độ của quản trị tổng dùng Leaflet (giấy phép BSD-2) và dữ liệu nền © OpenStreetMap, ghi công hiển thị ngay trên bản đồ. Các hiệu ứng có mã từ React Bits giữ thông báo giấy phép trong `frontend/third-party/react-bits/LICENSE.md`.
