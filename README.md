# Hào Khí Đông A

Nền tảng học lịch sử game hóa về ba lần kháng chiến chống Nguyên – Mông thời Trần cho học sinh THCS (đề tài khóa luận).
Đặc tả: `fuction list/HaoKhiDongA_DanhSachChucNang_ver0.1 (1).xlsx` (348 chức năng, 12 sprint). **Đã làm: Sprint 1 đến 9** (Sprint 9: AI Tutor "Tiểu Tướng") – xem
[docs/TIEN_DO_HAO_KHI.md](docs/TIEN_DO_HAO_KHI.md) (từng mã HK.*, quyết định, phần chưa làm).
Đặc tả `ver0.2` (408 chức năng, viết lại Sprint 5–8) đang được làm tiếp theo thứ tự Sprint 5 → 8 (đã xong: Sprint 5 lộ trình dạng đường đi và Sprint 6 game thẻ tướng, trừ Sa bàn 3D); đối chiếu và các điểm cần chốt ở
[docs/DOI_CHIEU_HAO_KHI_V02.md](docs/DOI_CHIEU_HAO_KHI_V02.md).

## Trang web

- `/`, `/dieu-khoan-su-dung`, `/cau-hoi-thuong-gap`: trang công khai (trang chủ, điều khoản kèm ghi công hình ảnh, câu hỏi thường gặp).
- `/portal`: đăng nhập chung của giáo viên và học sinh.
- `/hoc-sinh`: trang chủ ba cuộc kháng chiến, bản đồ nhiệm vụ (bài học, trận đánh, câu hỏi, tư liệu, Quyết chiến), làm bài có đồng hồ, thư viện lịch sử, dòng thời gian, bản đồ, kho tư liệu, nhiệm vụ (kèm nhiệm vụ ngày/tuần), lịch sử làm bài, luyện câu sai, vào lớp bằng mã 6 ký tự; trò chơi hóa: nhân vật, tim, điểm – cấp độ, chuỗi ngày, cửa hàng, huy hiệu, thẻ nhân vật, quà hằng ngày, bảng xếp hạng lớp/trường/hệ thống, giải đấu tuần, sự kiện của trường; mô phỏng trận đánh theo lượt (quyết định, bố trí lực lượng trên bản đồ, hoạt ảnh diễn biến) và ba mini-game (ghép thẻ, sắp xếp dòng thời gian, ô chữ).
- `/giao-vien`: lớp phụ trách, hành trình học (mẫu, tạo, giao cho lớp), ngân hàng câu hỏi, bộ đề (làm thử), nội dung đã gửi duyệt, cơ chế tim theo lớp và trao huy hiệu của trường.
- `/school-manager-admin`: quản trị viên trường học – trường và năm học, khối lớp, giáo viên, học sinh, lớp, nhập/xuất Excel, nhân bản lớp sang năm mới, duyệt nội dung giáo viên chia sẻ, hành trình mẫu của trường, ngân hàng câu hỏi và bộ đề của trường.
- `/admin`: quản trị tổng – trường học, người dùng toàn hệ thống, **kho dữ liệu lịch sử** (cuộc kháng chiến, nhân vật, sự kiện, địa điểm trên bản đồ, trận đánh, dòng thời gian, tư liệu gốc, thuật ngữ; kiểm chứng và công bố; lịch sử chỉnh sửa; nhập/xuất), **hành trình mẫu, bài học, ngân hàng câu hỏi, bộ đề, duyệt đề xuất của các trường**.
- Hai cổng quản trị không có liên kết từ trang chủ.

## Cấu trúc

- `frontend/`: Expo (React Native + web, Expo Router), Manrope và Newsreader. `app/` (route), `components/admin/` (cổng quản trị), `components/portal/` (trang học sinh và giáo viên), `api/`, `types/`.
- `backend/`: NestJS 11 + PostgreSQL. `src/auth` (đăng nhập, OTP, hồ sơ), `src/admin` (trường, năm học, tài khoản, lớp, Excel, hàng đợi email), `src/history` (kho lịch sử), `src/content` (câu hỏi, bộ đề, bài học, hành trình, chia sẻ/duyệt), `src/student` (vào lớp, đọc kho lịch sử, học và làm bài chấm ở máy chủ), `test/` (Jest, PostgreSQL tạm).
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
npm test                     # kiểm thử hợp đồng xác thực của lớp gọi API (không cần máy chủ)
npm run build                # xuất web vào frontend/dist/
```

Bản chính thức không đoán địa chỉ máy chủ: nếu thiếu `EXPO_PUBLIC_API_URL` thì các cổng báo lỗi rõ ràng và không gửi thông tin đăng nhập đi đâu cả (chỉ khi chạy `npm run web` mới mặc định `http://localhost:8000`).

Gửi thư (mật khẩu tạm, mã OTP) cần `SMTP_URL`/`SMTP_*` hoặc cầu `MAIL_RELAY_*` (xem `backend/.env.example`, `backend/mail-relay.gs`); chưa cấu hình thì mật khẩu tạm vẫn hiện một lần trên trang quản trị nhưng OTP quên mật khẩu không gửi được. Đăng nhập Google của học sinh cần `GOOGLE_CLIENT_ID` (backend) và `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (frontend).

## Triển khai

GitHub Actions chạy build/test backend, PostgreSQL migration, frontend và bộ tự đồng bộ trên mỗi push/pull request: [cách xem Check status](docs/GITHUB_ACTIONS.md).

Theo dõi code local, kiểm tra rồi tự gộp/push và xác minh GitHub → Render/Supabase/Vercel: [hướng dẫn tự đồng bộ](docs/TU_DONG_DONG_BO.md). Bộ theo dõi chạy ẩn trên Windows khi được bật bằng `scripts/auto-sync.ps1`; không cần giữ cuộc chat mở.

Website chính thức: https://datn-2026-indol.vercel.app/ (Vercel chỉ triển khai nhánh `main`; `frontend/vercel.json` lấy địa chỉ API từ `EXPO_PUBLIC_API_URL`, nếu chưa đặt thì dùng biến cũ `VITE_API_URL`, và cuối cùng là backend chính thức `https://dong-a-api.onrender.com`; địa chỉ này công khai, không chứa bí mật). Backend trên Render (`render.yaml`), cơ sở dữ liệu Supabase PostgreSQL; backend áp dụng migration mới khi khởi động. Sprint 1–2 đã được gộp vào `main` ngày 31/10/2026; Sprint 3–4 (migration 017–019) sau khi gộp cần backend khởi động lại để áp dụng migration.

## Ghi công

Nguồn và giấy phép ảnh nhân vật: `frontend/assets/hero-photos/ATTRIBUTION.md` và trang “Thông tin hình ảnh” (`/thong-tin-hinh-anh`), mở từ footer. Ba bản đồ của Lưu Ly thuộc phạm vi công cộng; liên kết nguồn nằm trong `frontend/constants/map-credits.ts` và cùng trang ghi công trên website.
Bản đồ chọn tọa độ của quản trị tổng dùng Leaflet (giấy phép BSD-2) và dữ liệu nền © OpenStreetMap, ghi công hiển thị ngay trên bản đồ. Các hiệu ứng có mã từ React Bits giữ thông báo giấy phép trong `frontend/third-party/react-bits/LICENSE.md`.
