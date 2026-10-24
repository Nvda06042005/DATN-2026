# Hào Khí Đông A – Học Lịch sử 7 qua game

Ứng dụng học Lịch sử 7 (ba lần kháng chiến chống quân Mông – Nguyên, 1258 – 1288) dạng game chiến thuật cho học sinh, kèm trang giáo viên và trang quản trị. Một mã nguồn React Native chạy trên **Android, iOS và web**. Thiết kế game: [KE_HOACH_GAME_HAO_KHI_DONG_A.md](KE_HOACH_GAME_HAO_KHI_DONG_A.md).

## Kiến trúc

```
React Native (Expo) ──HTTPS / WebSocket──► NestJS (Node.js) ──SQL──► PostgreSQL (Supabase)
  frontend/                                  backend/          │
                                                               └─HTTPS + token─► Dịch vụ AI Python (FastAPI)
                                                                               ai/: NLP + RAG + LLM, BKT
```

| Thư mục | Công nghệ | Vai trò |
| --- | --- | --- |
| `frontend/` | Expo SDK 58, React Native 0.88, expo-router, react-native-svg | Giao diện cho 3 vai trò. Route: `/` chọn vai trò, `/hoc-sinh` (game), `/giao-vien`, `/admin`. |
| `backend/` | NestJS 11, TypeScript, `pg`, JWT, WebSocket (`ws`) | Đăng nhập & phân quyền, tài khoản, tiến độ, ngân hàng câu hỏi (server giữ đáp án và chấm), trạng thái game, thi đấu cả lớp thời gian thực, gọi dịch vụ AI, chạy migration PostgreSQL. |
| `ai/` | Python 3.11, FastAPI, scikit-learn | Quân Sư AI: mô hình NLP phân loại ý định + truy xuất kho tri thức (RAG) + Gemini/Hugging Face; Bayesian Knowledge Tracing; soạn đề, soạn truyện. Chỉ backend gọi (khóa `AI_SERVICE_TOKEN`). |
| `database/` | SQL | `migrations/*.sql` đánh số – nguồn duy nhất của mọi thay đổi schema. |

Cấu trúc `frontend/`: `app/` (5 route), `api/` (gọi backend), `components/` (`ui.tsx`, `art.tsx`, `auth.tsx`, `live.tsx`, `game/`, `teacher/`, `admin/`), `constants/`, `hooks/`, `lib/`, `types/`, `assets/`.
Cấu trúc `backend/src/`: `auth/`, `admin/`, `student/`, `teacher/`, `live/`, `ai/`, `database/`, `app.module.ts`, `main.ts`, `config.ts`; kiểm thử ở `backend/test/`.

### Xác thực

- Mật khẩu băm PBKDF2-SHA256 (240.000 vòng, muối ngẫu nhiên); token JWT HS256 ký bằng `AUTH_SECRET_KEY`, hết hạn sau 12 giờ, tự mất hiệu lực khi đổi mật khẩu hoặc khóa tài khoản.
- Mỗi vai trò đăng nhập ở trang riêng; quản trị viên cấp tài khoản, người dùng đổi mật khẩu tạm ở lần đầu. Khóa đăng nhập 60 giây sau 5 lần sai.
- Điện thoại lưu phiên trong kho bảo mật của hệ điều hành (expo-secure-store); web lưu trong localStorage.

## Game của học sinh

| Tab | Nội dung |
| --- | --- |
| Điền Trang | 8 công trình, ruộng tự sinh Lương Thảo, nâng cấp phải trả lời đúng 1 câu, sự kiện “Giặc cướp lương” (vườn không nhà trống), nhiệm vụ ngày. |
| Doanh Trại | 14 tướng theo 5 hệ, tiến hóa theo giai đoạn cuộc đời, Hội Quán Vạn Kiếp (thẻ Nhân lực + thẻ Sự kiện → lệnh bài → câu hỏi), cổ vật. |
| Chiến Dịch | 3 màn × 3 pha, đánh theo lượt 3v3, kế sách lịch sử của từng trận, thủy triều Bạch Đằng. |
| Quốc Tử Giám | Thi đấu cả lớp (mã PIN), luyện nhanh, theo chủ đề, Tháp Khảo Thí 10 tầng, ôn điểm yếu theo BKT, đề do Quân Sư AI soạn. |
| Sử Ký | Dòng thời gian trên lược đồ, thẻ tri thức từ kho tri thức, trò chuyện với Quân Sư AI (có trích nguồn). |

Câu hỏi do server chọn và chấm; Ấn Tín và XP chỉ tăng khi trả lời đúng (tối đa 300 Ấn Tín/ngày). Trạng thái game tự lưu lên server, có chế độ tối “Đêm Bạch Đằng” và tùy chọn giảm chuyển động.

**Thi đấu cả lớp:** giáo viên mở phòng (5/10/15 câu, phạm vi từng lần kháng chiến), đọc mã PIN; học sinh cùng lớp vào bằng PIN hoặc link `/hoc-sinh?pin=…`. Mỗi câu 20 giây, điểm theo tốc độ và chuỗi câu đúng; mỗi câu trả lời cộng vào tiến độ thật; trận kết thúc lưu vào lịch sử lớp. Kết nối WebSocket `/api/live/ws`, token gửi trong tin nhắn đầu tiên; mất mạng tự vào lại đúng phòng.

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

Quản trị viên mặc định: `admin` / `admin@123` (đặt `ADMIN_PASSWORD` khi triển khai thật).

## Kiểm thử

```bash
cd backend && npm test                   # Jest: API, game, chấm điểm, thi đấu WebSocket, migration (PostgreSQL tạm bằng initdb)
cd ai && python test_server.py           # dịch vụ AI: chat RAG, BKT, soạn đề
cd ai && python test_model.py && python test_regression_suite.py   # đánh giá chatbot (ai/KET_QUA_DANH_GIA.md)
cd frontend && npm run typecheck && npx expo export -p web         # kiểu TypeScript và gói web
```

Bài kiểm thử backend tự tạo cụm PostgreSQL tạm (cần `initdb`/`pg_ctl`; đặt `POSTGRES_BIN` nếu không ở vị trí mặc định) và thay dịch vụ AI bằng bản giả.

## Triển khai

| Phần | Nơi chạy | Cấu hình |
| --- | --- | --- |
| `frontend/` (web) | Vercel, thư mục gốc `frontend` | `frontend/vercel.json`: `expo export -p web`, thư mục `dist`. Biến `EXPO_PUBLIC_API_URL` = địa chỉ backend (nếu chưa đặt sẽ dùng `VITE_API_URL` cũ). |
| `frontend/` (Android/iOS) | EAS Build | `npx eas-cli build -p android` (cần tài khoản Expo); đặt `EXPO_PUBLIC_API_URL` trong môi trường build. |
| `backend/` + `ai/` | Render (Blueprint `render.yaml`) | 2 dịch vụ Free `dong-a-api` (Node) và `dong-a-ai` (Python); đặt `DATABASE_URL` (Supabase Session pooler), `ADMIN_PASSWORD`, `GEMINI_API_KEY` trong Render. Backend chạy một instance (phòng thi đấu nằm trong bộ nhớ). |
| Database | Supabase PostgreSQL | Migration trong `database/migrations/`, xem [database/migrations/README.md](database/migrations/README.md). |

Blueprint lấy URL HTTPS của AI từ `RENDER_EXTERNAL_URL`, rồi gán cho `AI_SERVICE_URL` của backend. Hai dịch vụ Free không dùng `hostport` private network. Render tự tạo `AI_SERVICE_TOKEN` cho AI và cấp cùng giá trị cho backend; các API nghiệp vụ AI yêu cầu header `X-AI-Token`. Không đưa token này vào frontend. `/health` chỉ dùng kiểm tra dịch vụ nên không yêu cầu token. Nếu dùng Hugging Face, thêm `HF_TOKEN` trực tiếp vào môi trường `dong-a-ai` (không bắt buộc khi dùng Gemini).

Free có thể ngủ khi không có truy cập, nên lần gọi đầu sau thời gian nghỉ có thể chậm. Sau triển khai, kiểm tra `/health` của AI, `/api/health` và `/api/database/health` của backend; thử gọi API AI không có token phải nhận HTTP 401. Đặt `EXPO_PUBLIC_API_URL` trên Vercel bằng URL HTTPS thực tế của `dong-a-api`, rồi triển khai lại frontend để cập nhật giá trị trong gói web.

Không đặt `DATABASE_URL`, mật khẩu hay khóa bí mật vào biến `EXPO_PUBLIC_*` – các biến này nằm công khai trong gói app.

## Lưu ý

- Module trong `ai/` giữ tên phẳng (`create_model`, `context_manager`, …) vì `ai/models/dong_a_nlp_model.joblib` được pickle theo các tên này; mô hình tạo bằng scikit-learn 1.7.x + numpy 2.x.
- Ngân hàng câu hỏi của game: `ai/data/game_content.json` (backend đọc khi khởi động). Không sửa tay `knowledge_base.json`/`q_matrix.json` (sinh bởi `ai/data_splitter.py`).
- Tài khoản và mật khẩu cũ vẫn dùng được (cùng định dạng băm); sau khi chuyển backend, người dùng chỉ cần đăng nhập lại một lần.
