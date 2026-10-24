# Database migrations

Với mọi thay đổi schema PostgreSQL hoặc seed/reference data, luôn thêm migration SQL đánh số tiếp theo trong `database/migrations/`, giữ nguyên các migration đã chạy, và kiểm tra bằng `cd backend && npm run build && npm run migrate -- check` cùng `npm test` (có bài kiểm thử migration trên PostgreSQL tạm).

Backend NestJS tự áp dụng migration mới khi khởi động với `DATABASE_URL` (`backend/src/database/migrator.ts`, lịch sử ở `public.app_schema_migrations`). Không đưa dữ liệu tài khoản thật hoặc bí mật vào migration. Không nhúng DDL PostgreSQL vào code TypeScript/Python.

# Cấu trúc dự án

- `frontend/`: app Expo (React Native) cho Android, iOS, web. Route trong `app/` (`_layout.tsx`, `index.tsx`, `hoc-sinh.tsx`, `giao-vien.tsx`, `admin.tsx` – expo-router bắt buộc tên `index` cho `/`). `api/` gọi backend (không `fetch` trong component), `components/ui.tsx` (thành phần dùng chung), `components/art.tsx` (hình SVG), `components/auth.tsx` (phiên đăng nhập theo trang), `components/live.tsx`, `components/game|teacher|admin/`, `constants/`, `hooks/` (`use-*.ts`), `lib/`, `types/`. Import bằng `@/…`. Màu chỉ lấy từ `constants/theme.ts` qua `useTheme()`; mọi nút dùng `Btn`/`Pressable` có nhãn trợ năng, vùng chạm ≥ 44pt.
- Expo SDK 58 thay đổi nhiều: trước khi dùng API Expo/React Native, đọc tài liệu đúng phiên bản (`https://docs.expo.dev/versions/v58.0.0/`), cài thư viện bằng `npx expo install`, chạy `npm run typecheck` và `npx expo export -p web` trước khi báo xong.
- Không mở hai `Modal` chồng nhau: trong màn toàn màn hình (trận đánh, thi đấu) dùng `InlineSheet`; chuỗi hỏi đáp trong một bảng dùng `QuizPanel`; mở bảng tiếp theo sau khi bảng trước đóng bằng `afterSheet`.
- `backend/`: NestJS – `src/auth`, `admin`, `student` (ngân hàng câu hỏi `content.service.ts`, quy tắc tiến độ `progress.ts`), `teacher`, `live` (WebSocket), `ai` (gọi dịch vụ Python), `database` (pg + migrator + CLI). Kiểm thử Jest ở `backend/test/`.
- `ai/`: dịch vụ FastAPI `server.py` + BKT, RAG, Gemini/Hugging Face, mô hình NLP, dữ liệu. Giữ tên module phẳng (`create_model`, `context_manager`, ...) vì `models/dong_a_nlp_model.joblib` được pickle theo các tên này.
- `database/`: chỉ chứa `migrations/` và tài liệu.

# Game Hào Khí Đông A (trang học sinh)

- Mã game: `frontend/components/game/` (`GameShell.tsx` khung + lưu trạng thái, các tab, `quiz.tsx` câu hỏi, `LiveArena.tsx`), dữ liệu `frontend/constants/{game,heroes,campaigns}.ts`, logic `frontend/lib/{game-state,battle-engine}.ts`. Thiết kế theo `KE_HOACH_GAME_HAO_KHI_DONG_A.md`.
- Câu hỏi nằm ở `ai/data/game_content.json`; server giữ đáp án và tự chấm (`backend/src/student/content.service.ts`). Ấn Tín (cột `gems`) và XP chỉ được cộng ở server khi chấm; client chỉ được tiêu Ấn Tín.
- Nội dung câu hỏi phải khớp `ai/data/knowledge_base.json`; không sửa tay `knowledge_base.json`/`q_matrix.json` (sinh từ `ai/data_splitter.py`).
- Lưu tiến độ ở server không ghi `game_state` (chỉ `PUT /api/student/game` ghi), để không đè trạng thái client vừa lưu.

# Thi đấu cả lớp (thời gian thực)

- WebSocket `/api/live/ws` (`backend/src/live/live.gateway.ts`), điều phối phòng ở `live.hub.ts`. Token gửi trong tin nhắn đầu tiên `{"type":"auth","token":...}`, không đặt trên URL.
- Phòng đang chơi nằm trong bộ nhớ: backend chạy MỘT instance. Proxy của Render làm mất mã đóng WebSocket tùy chỉnh (4000/4401 thành 1006), nên client dựa vào tin nhắn `replaced`/`error` của server.
- Chỉ học sinh cùng lớp vào được phòng. Câu trả lời đi qua `StudentService.recordAnswer` (BKT, XP, Ấn Tín) như khi luyện tập; trận kết thúc lưu vào `app_live_sessions`/`app_live_results`.

# Chatbot và BKT (dịch vụ AI)

- Backend gọi dịch vụ AI qua `AI_SERVICE_URL` với header `X-AI-Token` (`AI_SERVICE_TOKEN`); BKT không trạng thái (`/bkt/update`, `/bkt/recommend`: gửi state, nhận state mới); AI lỗi thì backend giữ nguyên mức nắm vững và dùng câu hỏi trong ngân hàng.
- Thêm/sửa chủ đề chatbot: sửa `KNOWLEDGE_UNITS` và `REAL_STUDENT_TEST_SET` trong `ai/data_splitter.py`, rồi từ `ai/` chạy `python data_splitter.py`, `python create_model.py`, `python test_model.py`, `python test_regression_suite.py`, `python test_server.py`. Ghi số liệu mới vào `ai/KET_QUA_DANH_GIA.md`.

# Tự động đồng bộ sau khi hoàn tất công việc

Người dùng đã cho phép tự động cập nhật dự án sau mỗi yêu cầu sửa đổi hoàn tất; không cần hỏi lại để commit, push hoặc triển khai các thay đổi thuộc yêu cầu đó. Đây là quy trình kết thúc mỗi lần làm việc của agent, không phải dịch vụ theo dõi mọi lần lưu file khi agent không hoạt động.

- Chạy kiểm tra phù hợp với thay đổi; xử lý lỗi trước khi phát hành. Không tự đưa thay đổi không liên quan hoặc bí mật vào commit.
- Commit và push lên `https://github.com/Nvda06042005/DATN-2026`. Thư mục dự án chính là repo Git (không còn bản sao `deploy-sync/`): commit trực tiếp, xem lại `git status`/`git diff` trước khi push; không force-push. Thay đổi kiến trúc lớn (đổi backend/runtime) đưa lên nhánh riêng trước, chỉ gộp vào `main` khi dịch vụ Render tương ứng đã sẵn sàng.
- Website chính thức duy nhất: `https://datn-2026-indol.vercel.app/`. Vercel chỉ tự triển khai từ nhánh `main` của GitHub (thư mục `frontend`, `frontend/vercel.json`); không dùng URL Preview hoặc URL có mã deployment để bàn giao. Kiểm tra trạng thái triển khai và website sau push.
- Render triển khai backend từ GitHub theo `render.yaml` (dịch vụ `dong-a-api` và `dong-a-ai`). Kiểm tra `/api/health`, `/api/database/health` và API liên quan đến thay đổi. Nếu thiếu quyền truy cập, báo rõ phần chưa hoàn tất.
- Supabase: thay đổi schema hoặc seed/reference data phải có migration mới theo quy tắc ở trên. Backend áp dụng migration khi khởi động; xác minh migration đã chạy.
- Chỉ báo đồng bộ thành công khi có bằng chứng cho từng dịch vụ; nêu rõ lỗi triển khai hoặc thiếu kết nối.
