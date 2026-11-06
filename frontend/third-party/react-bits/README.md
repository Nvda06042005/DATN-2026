# React Bits dùng trong ba trang công khai

Copyright (c) 2026 David Haz. Giữ thông báo MIT + Commons Clause tại [LICENSE.md](LICENSE.md).

- Shape Magic: `lib/cloud-morph.ts` tham khảo nhịp morph từ [vector exporter](https://github.com/DavidHDev/react-bits/blob/main/src/tools/shape-magic/export/vector.js). `section-cloud.tsx` dùng các đường mây của ứng dụng; không phân phối trình biên tập hoặc công cụ xuất tài nguyên.
- Metallic Paint: `components/react-bits/metallic-paint.web.tsx` điều chỉnh từ [component TypeScript chính thức](https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Animations/MetallicPaint/MetallicPaint.tsx). Hiệu ứng chữ trang chủ giữ chữ/SVG dự phòng khi WebGL lỗi, trên điện thoại và khi giảm chuyển động.
- Hai dải sóng dùng Canvas/SVG tự viết tại `components/flowing-waves.web.tsx` và `lib/flowing-waves.ts`, tham khảo hình người dùng cung cấp và phong cách https://nhathaodev.com/; không sao chép mã hay tài nguyên trang đó.

Các module Threads và cấu hình âm thanh cũ đã được xóa. Mây nối các khối không phát âm thanh.
