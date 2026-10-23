# Đông A – Frontend

Giao diện web học Lịch sử 7 (Ba lần kháng chiến chống quân Mông – Nguyên): game **Hào Khí Đông A** cho học sinh, trang giáo viên (thi đấu cả lớp, báo cáo, học liệu) và trang quản trị. React 19 + TypeScript + Tailwind v4, chạy bằng Vite.

## Cấu trúc thư mục

Theo cách chia của [tronect-mobile-app](https://github.com/NhatHaoDev3324/tronect-mobile-app): mỗi thư mục giữ một loại code, import bằng đường dẫn `@/…` tính từ thư mục `frontend/`.

```
frontend/
├── main.tsx              điểm khởi chạy React, nạp global.css và app/_layout
├── global.css            hệ thiết kế: màu Đông A, phông chữ, nút, hiệu ứng (Tailwind v4)
├── index.html
├── app/                  màn hình theo trang (đặt tên như expo-router)
│   ├── _layout.tsx       khung gốc: phiên đăng nhập, chọn trang, thông báo
│   ├── index.tsx         trang chủ chọn vai trò
│   ├── (auth)/           đăng nhập, đổi mật khẩu
│   ├── student/          game Hào Khí Đông A
│   │   ├── _layout.tsx   khung game: thanh trên, điều hướng, tự lưu, GameContext
│   │   ├── (tabs)/       Điền Trang (index), Doanh Trại, Chiến Dịch, Quốc Tử Giám, Sử Ký
│   │   └── live/         thi đấu cả lớp (nhập mã PIN)
│   ├── teacher/          trang giáo viên: _layout, live, library, quests, groups
│   └── admin/            trang quản trị tài khoản
├── api/                  hàm gọi backend theo nhóm: auth, admin, student, teacher, live, chatbot, quiz, story
├── components/
│   ├── ui/               thành phần dùng chung, không gắn nghiệp vụ (button, sheet, progress-bar, …)
│   └── customs/          thành phần riêng của Đông A: Mascot, BrandLogo, game/, teacher/, library/, admin/, live/
├── constants/            dữ liệu cố định: tướng, chiến dịch, công trình, màu đáp án, dữ liệu mẫu của giáo viên
├── hooks/                hook dùng chung: use-game, use-live-socket, use-countdown, use-now
├── lib/                  logic thuần: định tuyến, âm báo, bộ máy trận đánh, chỉ số tướng
├── providers/            React context (GameContext)
├── store/                trạng thái lưu trữ: token đăng nhập, trạng thái game, phòng thi đấu đang chơi
├── types/                kiểu dữ liệu dùng chung (*Type.ts)
├── utils/                tiện ích: client HTTP (http.ts), định dạng số/ngày, mã phòng
└── assets/images/        ảnh bản đồ và tranh trận Bạch Đằng
```

Khi thêm code mới:

- Gọi API: thêm hàm vào `api/<nhóm>Api.ts` (dùng `apiRequest` trong `utils/http.ts`), không gọi `fetch` thẳng trong component. Trong game, gọi qua `request` của `useGame()` để hết phiên thì tự về màn đăng nhập: `request((t) => studentApi.getLeaderboard(t))`.
- Màn hình mới đặt trong `app/`, thành phần dùng lại đặt trong `components/`. Kiểu dữ liệu dùng ở nhiều nơi đặt trong `types/`; kiểu chỉ dùng trong một file thì để ngay trong file đó.
- File component chỉ export component (lint kiểm tra quy tắc này). Hằng số, hàm tiện ích, hook đặt ở thư mục riêng.
- Câu hỏi và đáp án của game nằm ở backend (`ai/data/game_content.json`); frontend không chứa đáp án.

Địa chỉ backend lấy từ biến môi trường `VITE_API_URL` (mặc định `http://localhost:8000`).

## Các trang

| Trang | Địa chỉ | Ai đăng nhập được |
| --- | --- | --- |
| Trang chủ (chọn vai trò) | `/` | — |
| Trang học sinh | `/hoc-sinh` | Chỉ học sinh |
| Trang giáo viên | `/giao-vien` | Chỉ giáo viên |
| Trang quản trị | `/admin` | Chỉ quản trị viên |

Bản một file mở trực tiếp dùng `index.html#/hoc-sinh`, `#/giao-vien`, `#/admin`. Đăng nhập sai trang sẽ bị từ chối và được chỉ sang đúng trang; phiên đăng nhập của mỗi trang tách riêng. Học sinh có thể vào thẳng phòng thi đấu bằng đường link `…/hoc-sinh?pin=123456`.

- Tài khoản quản trị tạo sẵn ở lần chạy backend đầu tiên: **`admin` / `admin@123`** (đổi bằng `ADMIN_USERNAME`, `ADMIN_PASSWORD`).
- Quản trị viên cấp tài khoản giáo viên/học sinh theo lớp, phát mật khẩu tạm, đặt lại mật khẩu, khoá/xoá tài khoản.
- Giáo viên, học sinh đăng nhập bằng mật khẩu tạm và đổi mật khẩu ở lần đầu.

## Lệnh

| Lệnh | Kết quả |
| --- | --- |
| `npm install` | Cài thư viện |
| `npm run dev` | Chạy thử tại http://localhost:5173 (cần backend đang chạy để đăng nhập) |
| `npx tsc -b` / `npm run lint` | Kiểm tra kiểu TypeScript / lint (oxlint) |
| `npm run build` | Bản triển khai web trong `dist/` (Vercel dùng lệnh này) |
| `npm run build:single` | Một file duy nhất `dist-single/index.html`, mở bằng trình duyệt là chạy |

File `dist-single/index.html` đã chứa sẵn JS, CSS và ảnh; phông chữ Google Fonts vẫn cần mạng. Đăng nhập, câu hỏi và tính năng AI cần backend đang chạy.
