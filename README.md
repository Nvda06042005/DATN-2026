# Hào Khí Đông A – Học Lịch sử 7 qua game

Ứng dụng học Lịch sử 7 (ba lần kháng chiến chống quân Mông – Nguyên, 1258 – 1288) dạng game chiến thuật cho học sinh, kèm trang giáo viên và hai cổng quản trị độc lập (quản trị tổng, quản trị trường) cấp tài khoản cho học sinh khối 6 – 9 bằng file Excel mẫu. Một mã nguồn React Native chạy trên **Android, iOS và web**. Thiết kế game: [KE_HOACH_GAME_HAO_KHI_DONG_A.md](KE_HOACH_GAME_HAO_KHI_DONG_A.md).

## Kiến trúc

```
React Native (Expo) ──HTTPS / WebSocket──► NestJS (Node.js) ──SQL──► PostgreSQL (Supabase)
  frontend/                                  backend/          │
                                                               └─HTTPS + token─► Dịch vụ AI Python (FastAPI)
                                                                               ai/: NLP + RAG + LLM, BKT
```

| Thư mục | Công nghệ | Vai trò |
| --- | --- | --- |
| `frontend/` | Expo SDK 58, React Native 0.88, expo-router, react-native-svg, expo-document-picker | Giao diện cho 4 vai trò. Route: `/` trang chủ công khai (tải file Excel mẫu), `/portal` đăng nhập chung giáo viên – học sinh, `/hoc-sinh` (game), `/giao-vien`, `/root-system-admin` (quản trị tổng), `/school-manager-admin` (quản trị trường). |
| `backend/` | NestJS 11, TypeScript, `pg`, JWT, WebSocket (`ws`) | Đăng nhập & phân quyền, tài khoản, tiến độ, ngân hàng câu hỏi (server giữ đáp án và chấm), trạng thái game, thi đấu cả lớp thời gian thực, gọi dịch vụ AI, chạy migration PostgreSQL. |
| `ai/` | Python 3.11, FastAPI, scikit-learn, openpyxl | Quân Sư AI: mô hình NLP phân loại ý định + truy xuất kho tri thức (RAG) + Gemini/Hugging Face; Bayesian Knowledge Tracing; soạn đề, soạn truyện; tạo – ký – kiểm tra file Excel mẫu và so khớp dòng nhập lại (`excel_provisioning.py`). Chỉ backend gọi (khóa `AI_SERVICE_TOKEN`). |
| `database/` | SQL | `migrations/*.sql` đánh số – nguồn duy nhất của mọi thay đổi schema. |

Cấu trúc `frontend/`: `app/` (7 route), `api/` (gọi backend), `components/` (`ui.tsx`, `art.tsx`, `auth.tsx`, `live.tsx`, `provisioning.tsx`, `game/`, `teacher/`, `admin/`), `constants/`, `hooks/`, `lib/`, `types/`, `assets/`.
Cấu trúc `backend/src/`: `auth/`, `admin/` (`admin.controller.ts`, `school.service.ts` – trường, tài khoản, nhập Excel, lớp, thùng rác; `mail.service.ts` – hàng đợi thư), `student/`, `teacher/`, `live/`, `ai/`, `database/`, `app.module.ts`, `main.ts`, `config.ts`; kiểm thử ở `backend/test/`.

### Xác thực

- Mật khẩu băm PBKDF2-SHA256 (240.000 vòng, muối ngẫu nhiên; mật khẩu mặc định cấp từ file Excel 20.000 vòng vì bắt buộc đổi ở lần đầu); token JWT HS256 ký bằng `AUTH_SECRET_KEY` (kèm mã trường `sid`), hết hạn sau 12 giờ, tự mất hiệu lực khi đổi mật khẩu, khóa hoặc xóa tài khoản.
- Vai trò: `root_admin` (quản trị tổng, toàn hệ thống), `school_admin` (quản trị một trường), `teacher`, `student`. Hai cổng quản trị là trang độc lập, không có nút hay liên kết về trang chủ; giáo viên, học sinh đăng nhập ở `/portal` (hoặc `/giao-vien`, `/hoc-sinh`). Khóa đăng nhập 60 giây sau 5 lần sai.
- Lần đầu đăng nhập bằng mật khẩu được cấp: màn hình chính bị khóa, cửa sổ đặt mật khẩu mới không đóng được cho tới khi đổi xong (hoặc đăng xuất).
- Quản trị trường, giáo viên, học sinh chỉ thấy dữ liệu trường mình: server lọc theo `school_id` trong tài khoản và chạy truy vấn dưới vai trò PostgreSQL `dong_a_school_scope` với Row-Level Security (`app.school_id`).
- Điện thoại lưu phiên trong kho bảo mật của hệ điều hành (expo-secure-store); web lưu trong localStorage.

## Game của học sinh

| Tab | Nội dung |
| --- | --- |
| Điền Trang | 8 công trình, ruộng tự sinh Lương Thảo, nâng cấp phải trả lời đúng 1 câu, sự kiện “Giặc cướp lương” (vườn không nhà trống), nhiệm vụ ngày. |
| Doanh Trại | 14 tướng theo 5 hệ, tiến hóa theo giai đoạn cuộc đời, Hội Quán Vạn Kiếp (thẻ Nhân lực + thẻ Sự kiện → lệnh bài → câu hỏi), cổ vật. |
| Chiến Dịch | 3 màn × 3 pha, đánh theo lượt 3v3, kế sách lịch sử của từng trận, thủy triều Bạch Đằng. |
| Quốc Tử Giám | Thi đấu cả lớp (mã PIN), luyện nhanh, theo chủ đề, Tháp Khảo Thí 10 tầng, ôn điểm yếu theo BKT, đề do Quân Sư AI soạn. |
| Sử Ký | Dòng thời gian trên lược đồ, thẻ tri thức từ kho tri thức, trò chuyện với Quân Sư AI (có trích nguồn). |

**Hành Trình Đông A (thế giới 2D):** nút “Hành Trình” trên thanh trên cùng (hoặc thẻ ở Điền Trang) mở một thế giới pixel kiểu nông trại – phiêu lưu gồm 3 vùng đất mở dần: Làng Đông A (1258), Bến Bình Than – Vạn Kiếp (1282 – 1285), cửa sông Bạch Đằng (1287 – 1288). Em đi lại bằng phím mũi tên/WASD, nút điều hướng hoặc chạm vào chỗ muốn đến; gặp người dân nghe kể chuyện xưa (lấy từ thẻ Sử Ký), trả lời câu hỏi để làm nhiệm vụ và mở đường sang vùng mới; gieo trồng trên luống đất (cây lớn theo thời gian thực, chín rồi không hỏng; trả lời đúng một câu để “bón phân tri thức”); đuổi thám báo đi tuần; đóng cọc Bạch Đằng rồi đánh đội thuyền giặc. Nhân vật đều là người hư cấu kể lại chuyện người thật. Phần thưởng là Lương Thảo, Quân Lực và thẻ chiêu mộ dùng ở Hội Quán; XP, Ấn Tín vẫn chỉ do server cộng khi trả lời đúng. Có nhật ký nhiệm vụ, nút Chỉ đường, chế độ đêm và chế độ giảm chuyển động.

Câu hỏi do server chọn và chấm; Ấn Tín và XP chỉ tăng khi trả lời đúng (tối đa 300 Ấn Tín/ngày). Trạng thái game tự lưu lên server, có chế độ tối “Đêm Bạch Đằng” và tùy chọn giảm chuyển động.

**Thi đấu cả lớp:** giáo viên mở phòng (5/10/15 câu, phạm vi từng lần kháng chiến), đọc mã PIN; học sinh cùng lớp vào bằng PIN hoặc link `/hoc-sinh?pin=…`. Mỗi câu 20 giây, điểm theo tốc độ và chuỗi câu đúng; mỗi câu trả lời cộng vào tiến độ thật; trận kết thúc lưu vào lịch sử lớp. Kết nối WebSocket `/api/live/ws`, token gửi trong tin nhắn đầu tiên; mất mạng tự vào lại đúng phòng.

## Cấp tài khoản bằng file Excel

- **File mẫu** tải công khai ở trang chủ (`GET /api/public/excel-template`, không cần đăng nhập): trang `Danh sach` có đúng 11 cột – Mã số người dùng, Trường, Mã số trường, Khu vực, Thành phố, Tên, Ngày tháng năm sinh (DD/MM/YYYY), Năm học (2025-2026), Email, Khối (6/7/8/9), Vai trò (GV/HS); trang ẩn `_sys_signature` (khóa mật khẩu) chứa chữ ký HMAC-SHA256 của cấu trúc cột cùng thuộc tính tùy chỉnh của workbook.
- **Kiểm tra khi nhập**: chỉ nhận `.xlsx` (đuôi file, MIME, chữ ký nhị phân ZIP), tối đa 2 MB / 1.000 dòng, không macro; từ chối file tự tạo, file thêm/xóa/đổi tên/đổi thứ tự cột hoặc thêm trang.
- **Tên đăng nhập** `[tên gọi không dấu].[2 số năm học][4 số mã trường][khối][3 số cuối năm vào lớp 6][3 số thứ tự]@ACCOUNT_DOMAIN`, ví dụ `anh.2504807024001@donga.local`; **mật khẩu mặc định** `[chữ cái đầu họ tên, chữ đầu viết hoa][ddmmyyyy]VN@`, ví dụ `Nvda06042012VN@`. Mật khẩu không bao giờ nằm trong phản hồi API.
- **Thư thông tin đăng nhập** đi qua hàng đợi trong PostgreSQL (`app_email_outbox`, nội dung mã hóa AES-256-GCM, xóa sau khi gửi; thử lại theo lũy thừa) và Nodemailer (`SMTP_URL` hoặc `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`, `MAIL_FROM`). Chưa cấu hình SMTP thì thư nằm chờ; quản trị tải danh sách CSV tài khoản chưa gửi để phát tay.
- **Dòng thiếu thông tin** chưa được cấp tài khoản, ghi vào `app_incomplete_import_logs` kèm vector đặc trưng 128 chiều (cột `embedding_vec` pgvector khi CSDL có extension `vector`, nếu không thì so khớp bằng mảng số). **Nhập lại** cùng file đã bổ sung: hệ thống đối chiếu (Smart Delta) và chỉ cấp tài khoản, gửi thư cho dòng vừa đủ thông tin; người đã có tài khoản không nhận lại thư.
- **Quản trị tổng** nhập cho mọi trường (trường chưa có tự tạo từ cột Trường, Mã số trường); **quản trị trường** chỉ nhận dòng của trường mình; **giáo viên** chỉ nhập học sinh của trường mình.
- **Lớp học**: giáo viên gửi yêu cầu mở lớp (mã lớp, năm học, tên lớp, mật khẩu lớp) → trạng thái `PENDING`; quản trị trường duyệt (`APPROVED`) hoặc từ chối → giáo viên nhận thông báo trong app (chuông, tự cập nhật mỗi 20 giây) và email; học sinh vào lớp bằng mã lớp + mật khẩu lớp ở mục Hồ sơ của game.
- **Thùng rác**: xóa tài khoản là chuyển vào thùng rác 45 ngày (đếm ngược, khôi phục được, không đăng nhập được); tác vụ lịch `@nestjs/schedule` xóa vĩnh viễn lúc 00:00 giờ Việt Nam (và bù khi máy chủ khởi động lại).
- Tìm kiếm, lọc nhanh theo trường, khu vực, thành phố, năm học, khối, vai trò dùng chỉ mục B-Tree và GIN `pg_trgm` trên cột `search_text` không dấu; chỉ mục duy nhất `(user_code, school_code, email)` chống trùng.

## Chạy trên máy

Cần Node.js 22, Python 3.11 và một PostgreSQL (Supabase hoặc cài trên máy).

```bash
# 1. Dịch vụ AI – http://localhost:8001
cd ai
pip install -r requirements.txt
cp .env.example .env        # GEMINI_API_KEY (tùy chọn)
uvicorn server:app --port 8001

# 2. Backend NestJS – http://localhost:8000 (tự chạy migration khi khởi động)
cd backend
npm install
cp .env.example .env        # DATABASE_URL, AUTH_SECRET_KEY, AI_SERVICE_URL=http://localhost:8001
npm run build && npm start  # hoặc: npm run dev

# 3. App Expo
cd frontend
npm install
cp .env.example .env        # EXPO_PUBLIC_API_URL=http://localhost:8000 (điện thoại: http://<IP-máy-tính>:8000)
npm run web                 # trình duyệt; hoặc npm start rồi quét mã bằng Expo Go / npm run android
```

Quản trị tổng mặc định: `admin` / `admin@123`, đăng nhập tại `/root-system-admin` (đặt `ADMIN_PASSWORD` khi triển khai thật). Quản trị tổng thêm trường và cấp tài khoản quản trị trường; quản trị trường đăng nhập tại `/school-manager-admin`.

## Kiểm thử

```bash
cd backend && npm test                   # Jest: API, game, chấm điểm, thi đấu WebSocket, migration (PostgreSQL tạm bằng initdb)
cd ai && python test_server.py           # dịch vụ AI: chat RAG, BKT, soạn đề
cd ai && python test_model.py && python test_regression_suite.py   # đánh giá chatbot (ai/KET_QUA_DANH_GIA.md)
cd frontend && npm run typecheck && npx expo export -p web         # kiểu TypeScript và gói web
```

Bài kiểm thử backend tự tạo cụm PostgreSQL tạm (cần `initdb`/`pg_ctl`; đặt `POSTGRES_BIN` nếu không ở vị trí mặc định) và thay dịch vụ AI bằng bản giả.

Backend trên Render dùng Node.js 22.21.0 và npm 10.9.4. Khi thay đổi dependency, đồng bộ lockfile bằng `npx --yes npm@10.9.4 install --package-lock-only`, rồi kiểm tra cài đặt sạch bằng `npx --yes npm@10.9.4 ci` trước khi build và chạy kiểm thử. Lockfile tạo bằng npm khác có thể thiếu peer dependency mà npm 10 yêu cầu.

## Triển khai

Website chính thức: **https://datn-2026-indol.vercel.app/**. Mã nguồn đang sử dụng nằm trên nhánh **`main`** của [GitHub DATN-2026](https://github.com/Nvda06042005/DATN-2026/tree/main). Vercel chỉ tự triển khai từ `main` theo `frontend/vercel.json`; không dùng URL Preview hoặc URL có mã deployment làm địa chỉ bàn giao. Mỗi lần cập nhật vẫn có lịch sử deployment và URL kỹ thuật do Vercel tự tạo, còn địa chỉ chính thức luôn giữ nguyên.

`dong-a-api` và `dong-a-ai` là hai dịch vụ backend của cùng ứng dụng, cùng lấy mã từ `main`; chúng không phải hai website để người dùng lựa chọn.

| Phần | Nơi chạy | Cấu hình |
| --- | --- | --- |
| `frontend/` (web) | Vercel, thư mục gốc `frontend` | `frontend/vercel.json`: `expo export -p web`, thư mục `dist`. Biến `EXPO_PUBLIC_API_URL` = địa chỉ backend (nếu chưa đặt sẽ dùng `VITE_API_URL` cũ). |
| `frontend/` (Android/iOS) | EAS Build | `npx eas-cli build -p android` (cần tài khoản Expo); đặt `EXPO_PUBLIC_API_URL` trong môi trường build. |
| `backend/` + `ai/` | Render (Blueprint `render.yaml`) | 2 dịch vụ Free `dong-a-api` (Node) và `dong-a-ai` (Python); đặt `DATABASE_URL` (Supabase Session pooler), `ADMIN_PASSWORD`, `GEMINI_API_KEY`, và để gửi thư: `SMTP_URL`, `MAIL_FROM` trong Render. Render tự tạo `EXCEL_SIGNING_KEY` (khóa ký file Excel mẫu) cho `dong-a-ai`. Backend chạy một instance (phòng thi đấu nằm trong bộ nhớ). |
| Database | Supabase PostgreSQL | Migration trong `database/migrations/`, xem [database/migrations/README.md](database/migrations/README.md). |

Blueprint lấy URL HTTPS của AI từ `RENDER_EXTERNAL_URL`, rồi gán cho `AI_SERVICE_URL` của backend. Hai dịch vụ Free không dùng `hostport` private network. Render tự tạo `AI_SERVICE_TOKEN` cho AI và cấp cùng giá trị cho backend; các API nghiệp vụ AI yêu cầu header `X-AI-Token`. Không đưa token này vào frontend. `/health` chỉ dùng kiểm tra dịch vụ nên không yêu cầu token. Nếu dùng Hugging Face, thêm `HF_TOKEN` trực tiếp vào môi trường `dong-a-ai` (không bắt buộc khi dùng Gemini).

Free có thể ngủ khi không có truy cập, nên lần gọi đầu sau thời gian nghỉ có thể chậm. Sau triển khai, kiểm tra `/health` của AI, `/api/health` và `/api/database/health` của backend; thử gọi API AI không có token phải nhận HTTP 401. Đặt `EXPO_PUBLIC_API_URL` trên Vercel bằng URL HTTPS thực tế của `dong-a-api`, rồi triển khai lại frontend để cập nhật giá trị trong gói web.

Không đặt `DATABASE_URL`, mật khẩu hay khóa bí mật vào biến `EXPO_PUBLIC_*` – các biến này nằm công khai trong gói app.

## Lưu ý

- Module trong `ai/` giữ tên phẳng (`create_model`, `context_manager`, …) vì `ai/models/dong_a_nlp_model.joblib` được pickle theo các tên này; mô hình tạo bằng scikit-learn 1.7.x + numpy 2.x.
- Ngân hàng câu hỏi của game: `ai/data/game_content.json` (backend đọc khi khởi động). Không sửa tay `knowledge_base.json`/`q_matrix.json` (sinh bởi `ai/data_splitter.py`).
- Tài khoản và mật khẩu cũ vẫn dùng được (cùng định dạng băm); sau khi chuyển backend, người dùng chỉ cần đăng nhập lại một lần.
