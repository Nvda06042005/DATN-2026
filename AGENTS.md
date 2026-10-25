# Database migrations

Với mọi thay đổi schema PostgreSQL hoặc seed/reference data, luôn thêm migration SQL đánh số tiếp theo trong `database/migrations/`, giữ nguyên các migration đã chạy, và kiểm tra bằng `cd backend && npm run build && npm run migrate -- check` cùng `npm test` (có bài kiểm thử migration trên PostgreSQL tạm).

Backend NestJS tự áp dụng migration mới khi khởi động với `DATABASE_URL` (`backend/src/database/migrator.ts`, lịch sử ở `public.app_schema_migrations`). Không đưa dữ liệu tài khoản thật hoặc bí mật vào migration. Không nhúng DDL PostgreSQL vào code TypeScript/Python.

# Cấu trúc dự án

- `frontend/`: app Expo (React Native) cho Android, iOS, web. Route trong `app/` (`_layout.tsx`, `index.tsx`, `portal.tsx`, `hoc-sinh.tsx`, `giao-vien.tsx`, `root-system-admin.tsx`, `school-manager-admin.tsx` – expo-router bắt buộc tên `index` cho `/`). `api/` gọi backend (không `fetch` trong component), `components/ui.tsx` (thành phần dùng chung), `components/art.tsx` (hình SVG), `components/auth.tsx` (phiên đăng nhập theo trang), `components/live.tsx`, `components/provisioning.tsx` (nhập Excel, thư, thùng rác, duyệt lớp, chuông thông báo – dùng chung cho quản trị và giáo viên), `components/game|teacher|admin/`, `constants/`, `hooks/` (`use-*.ts`), `lib/`, `types/`. Import bằng `@/…`. Màu chỉ lấy từ `constants/theme.ts` qua `useTheme()`; mọi nút dùng `Btn`/`Pressable` có nhãn trợ năng, vùng chạm ≥ 44pt.
- Expo SDK 58 thay đổi nhiều: trước khi dùng API Expo/React Native, đọc tài liệu đúng phiên bản (`https://docs.expo.dev/versions/v58.0.0/`), cài thư viện bằng `npx expo install`, chạy `npm run typecheck` và `npx expo export -p web` trước khi báo xong.
- Không mở hai `Modal` chồng nhau: trong màn toàn màn hình (trận đánh, thi đấu) dùng `InlineSheet`; chuỗi hỏi đáp trong một bảng dùng `QuizPanel`; mở bảng tiếp theo sau khi bảng trước đóng bằng `afterSheet`.
- `backend/`: NestJS – `src/auth`, `admin`, `student` (ngân hàng câu hỏi `content.service.ts`, quy tắc tiến độ `progress.ts`), `teacher`, `live` (WebSocket), `ai` (gọi dịch vụ Python), `database` (pg + migrator + CLI). Kiểm thử Jest ở `backend/test/`.
- Lockfile backend phải cài được bằng npm 10.9.4 đi kèm Node.js 22.21.0 trên Render. Sau khi đổi dependency, dùng npm 10.9.4 đồng bộ `package-lock.json` và chạy `npm ci` bằng phiên bản đó trước khi build/kiểm thử; không chỉ dựa vào `node_modules` đã có trên máy.
- `ai/`: dịch vụ FastAPI `server.py` + BKT, RAG, Gemini/Hugging Face, mô hình NLP, dữ liệu. Giữ tên module phẳng (`create_model`, `context_manager`, ...) vì `models/dong_a_nlp_model.joblib` được pickle theo các tên này.
- `database/`: chỉ chứa `migrations/` và tài liệu.

# Game Hào Khí Đông A (trang học sinh)

- Mã game: `frontend/components/game/` (`GameShell.tsx` khung + lưu trạng thái, các tab, `quiz.tsx` câu hỏi, `LiveArena.tsx`, `WorldScreen.tsx`), dữ liệu `frontend/constants/{game,heroes,campaigns,world}.ts`, logic `frontend/lib/{game-state,battle-engine,world-engine,pixel-art}.ts`. Thiết kế theo `KE_HOACH_GAME_HAO_KHI_DONG_A.md`.
- Câu hỏi nằm ở `ai/data/game_content.json`; server giữ đáp án và tự chấm (`backend/src/student/content.service.ts`). Ấn Tín (cột `gems`) và XP chỉ được cộng ở server khi chấm; client chỉ được tiêu Ấn Tín.
- Nội dung câu hỏi phải khớp `ai/data/knowledge_base.json`; không sửa tay `knowledge_base.json`/`q_matrix.json` (sinh từ `ai/data_splitter.py`).
- Lưu tiến độ ở server không ghi `game_state` (chỉ `PUT /api/student/game` ghi), để không đè trạng thái client vừa lưu.
- Hành Trình Đông A (thế giới 2D pixel): màn `components/game/WorldScreen.tsx` (toàn màn hình, hộp thoại bằng `InlineSheet`, lượt hỏi bằng `QuizPanel`), dữ liệu vùng đất/nhân vật/nhiệm vụ/cây trồng `constants/world.ts`, luật đi lại – tìm đường – nhiệm vụ – khôi phục bản lưu `lib/world-engine.ts`, hình pixel `lib/pixel-art.ts` (vẽ bằng `PixelArt` trong `components/art.tsx`). Trạng thái nằm trong `GameState.world` (lưu chung `game_state`, không cần migration). Nhân vật là người hư cấu; phần kiến thức hiện từ thẻ Sử Ký, câu hỏi lấy theo `units` phải có trong `ai/data/game_content.json`. Sửa bản đồ: mọi hàng cùng độ dài, ký tự có trong `TILE_INFO`, vật đặt trên ô đi được (cọc và đội thuyền đặt trên nước) và tới được từ điểm xuất phát.

# Hai cổng quản trị và cấp tài khoản

- `/root-system-admin` (vai trò `root_admin`) và `/school-manager-admin` (`school_admin`) dùng chung `components/admin/AdminHome.tsx`; không render nút hay liên kết về trang chủ, `/portal` hay cổng khác. Trang chủ công khai không liên kết tới cổng quản trị.
- Nghiệp vụ ở `backend/src/admin/school.service.ts`: quản trị tổng chạy truy vấn toàn hệ thống; vai trò khác chạy trong `DatabaseService.scoped(school_id)` (vai trò PostgreSQL `dong_a_school_scope` + RLS), luôn kèm điều kiện `school_id` trong SQL. Không mở quyền công khai để chạy được migration.
- File Excel mẫu do `ai/excel_provisioning.py` tạo và ký (HMAC-SHA256 bằng `EXCEL_SIGNING_KEY`); giữ đúng 11 cột và thứ tự trong `COLUMNS`, đổi cấu trúc thì tăng `TEMPLATE_VERSION`. Python không truy cập CSDL: backend đọc ứng viên (pgvector khi có) rồi gửi Python quyết định khớp.
- Mật khẩu mặc định không được trả về trong phản hồi nhập file, chỉ đi qua thư (`mail.service.ts`, nội dung mã hóa và xóa sau khi gửi) hoặc CSV tài khoản chưa gửi thư của quản trị.
- Xóa tài khoản = thùng rác 45 ngày (`deleted_at`, `purge_at`); cron 00:00 giờ Việt Nam xóa vĩnh viễn.

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
