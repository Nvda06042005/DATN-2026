# Hào Khí Đông A

Website hiện chỉ giữ ba trang công khai:

- `/`: trang chủ.
- `/dieu-khoan-su-dung`: Điều khoản sử dụng, kèm thông tin ghi công hình ảnh.
- `/cau-hoi-thuong-gap`: Câu hỏi thường gặp.

Backend, dịch vụ AI, game, đăng nhập, các cổng học sinh/giáo viên/quản trị và tài liệu triển khai cũ đã được gỡ theo yêu cầu ngày 31/10/2026. Các đoạn giới thiệu chức năng cũ được giữ trong nội dung hai trang thông tin, kèm thông báo về phạm vi hiện tại.

## Chạy và kiểm tra

Từ thư mục `frontend/`:

```sh
npm ci
npm run web
```

Kiểm tra TypeScript bằng `npm run typecheck`, xuất bản web bằng `npm run build` (kết quả trong `frontend/dist/`). Frontend dùng Expo Router, React Native Web, Manrope và Newsreader; không cần API hay biến môi trường kết nối backend.

## Cấu trúc còn lại

- `frontend/app/`: ba route và `_layout.tsx` dùng chung.
- `frontend/components/`, `constants/`, `hooks/`, `lib/`, `types/`: mã và dữ liệu hiển thị được ba trang sử dụng.
- `frontend/assets/`: ảnh, video, biểu tượng phục vụ giao diện.
- `database/migrations/`: giữ nguyên 13 migration SQL đã có để bảo toàn lịch sử. Bản website này không kết nối PostgreSQL và không có migration runner; việc xóa mã ứng dụng không xóa dữ liệu đã lưu trên Supabase.
- `fuction list/HaoKhiDongA_DanhSachChucNang_ver0.1 (1).xlsx`: giữ lại theo yêu cầu riêng của người dùng; không được nạp vào website.

## Triển khai

Website chính thức: https://datn-2026-indol.vercel.app/. Vercel xây dựng thư mục `frontend/` từ nhánh `main`, chạy `npm ci` và `npm run build`; cấu hình nằm ở `frontend/vercel.json`. Bản hiện tại không cần Render hay Supabase để chạy. Việc gỡ mã backend/AI trong repo không tự xóa các dịch vụ hoặc dữ liệu đang tồn tại ở nhà cung cấp.

## Ghi công

Nguồn và giấy phép ảnh nhân vật được giữ trong `frontend/assets/hero-photos/ATTRIBUTION.md` và phần “Thông tin hình ảnh” cuối trang Điều khoản sử dụng. Ba bản đồ của Lưu Ly thuộc phạm vi công cộng; liên kết nguồn nằm trong `frontend/constants/map-credits.ts` và cùng phần ghi công trên website.

Các hiệu ứng có mã từ React Bits giữ thông báo giấy phép trong `frontend/third-party/react-bits/LICENSE.md` và nguồn tham khảo trong README cùng thư mục.
