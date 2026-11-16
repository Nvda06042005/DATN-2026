# Phaser dùng trong trang học sinh (Hành trình Đông A)

Phaser 3.90.0 – Copyright (c) 2024 Richard Davey, Phaser Studio Inc. Giấy phép MIT, giữ nguyên văn tại [LICENSE.md](LICENSE.md). Trang chủ: https://phaser.io

- Cài qua npm (`phaser` trong `frontend/package.json`), không sửa mã của thư viện.
- Chỉ dùng trên web cho ba cảnh game trong `frontend/game/` (nhập vai khám phá, trận đánh theo lượt, màn Bạch Đằng), nạp động từ `components/portal/GameViewport.web.tsx` nên nằm trong một gói tải riêng.
- Mọi hình trong game (nhân vật, thuyền, voi, cây, nhà, cọc, hiệu ứng) do dự án tự vẽ bằng mã trong `frontend/game/pixel.ts`; không dùng tài nguyên hình ảnh, âm thanh hay ví dụ mẫu của Phaser.
