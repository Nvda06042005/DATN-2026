# Hào Khí Đông A

Website hiện có ba trang công khai và trang đăng nhập quản trị tổng:

- `/`: trang chủ.
- `/dieu-khoan-su-dung`: Điều khoản sử dụng, kèm thông tin ghi công hình ảnh.
- `/cau-hoi-thuong-gap`: Câu hỏi thường gặp.
- `/admin`: đăng nhập quản trị tổng với giao diện cũ, quên mật khẩu bằng OTP, xác nhận phiên và đổi mật khẩu lần đầu. Trang độc lập, không có liên kết từ trang chủ.

Backend, dịch vụ AI, game và các cổng học sinh/giáo viên/quản trị đã được gỡ theo yêu cầu ngày 31/10/2026. Theo yêu cầu tiếp theo cùng ngày, riêng trang đăng nhập `/admin` được khôi phục trên bản chính thức. Các màn quản lý sau đăng nhập và bản Sprint 1–2 vẫn ở nhánh `feat/hao-khi-sprint-1-2`; không được gộp trong lần khôi phục này.

## Chạy và kiểm tra

Từ thư mục `frontend/`:

```sh
npm ci
npm run web
```

Kiểm tra TypeScript bằng `npm run typecheck`, kiểm thử hợp đồng xác thực bằng `npm test`, xuất bản web bằng `npm run build` (kết quả trong `frontend/dist/`). Frontend dùng Expo Router, React Native Web, Manrope và Newsreader. Ba trang công khai không cần API. Trang `/admin` dùng `EXPO_PUBLIC_API_URL` (xem `frontend/.env.example`); thiếu cấu hình thì hiện lỗi rõ ràng khi gửi form và không gửi thông tin đăng nhập tới địa chỉ mặc định.

## Cấu trúc còn lại

- `frontend/app/`: ba trang công khai, `admin.tsx` và `_layout.tsx` dùng chung.
- `frontend/components/`, `constants/`, `hooks/`, `lib/`, `types/`: mã và dữ liệu được các trang sử dụng; `frontend/api/` gọi API xác thực của `/admin`.
- `frontend/assets/`: ảnh, video, biểu tượng phục vụ giao diện.
- `fuction list/HaoKhiDongA_DanhSachChucNang_ver0.1 (1).xlsx`: giữ lại theo yêu cầu riêng của người dùng; không được nạp vào website.

Website không sử dụng database. Thư mục `database/` và 13 migration SQL cũ đã được xóa theo yêu cầu của người dùng; dữ liệu đang tồn tại trên Supabase không bị tác động.

## Triển khai

Website chính thức: https://datn-2026-indol.vercel.app/. Vercel xây dựng thư mục `frontend/` từ nhánh `main`; cấu hình nằm ở `frontend/vercel.json`. Đăng nhập, OTP, kiểm tra phiên, đổi mật khẩu và đăng xuất gọi API xác thực đã được người vận hành cấu hình bằng `EXPO_PUBLIC_API_URL` (cấu hình cũ `VITE_API_URL` được chuyển sang biến Expo khi build). Khôi phục trang này không triển khai backend, chạy migration hoặc thay đổi dữ liệu trên nhà cung cấp.

## Ghi công

Nguồn và giấy phép ảnh nhân vật được giữ trong `frontend/assets/hero-photos/ATTRIBUTION.md` và phần “Thông tin hình ảnh” cuối trang Điều khoản sử dụng. Ba bản đồ của Lưu Ly thuộc phạm vi công cộng; liên kết nguồn nằm trong `frontend/constants/map-credits.ts` và cùng phần ghi công trên website.

Các hiệu ứng có mã từ React Bits giữ thông báo giấy phép trong `frontend/third-party/react-bits/LICENSE.md` và nguồn tham khảo trong README cùng thư mục.
