# Database migrations

Với mọi thay đổi schema PostgreSQL hoặc seed/reference data, luôn thêm migration SQL đánh số tiếp theo trong `database/migrations/`, giữ nguyên các migration đã chạy, và kiểm tra bằng `python database/migrate.py check` (chạy từ thư mục gốc dự án) cùng các bài kiểm thử migration.

Backend tự áp dụng migration mới khi khởi động với `DATABASE_URL`. Các thay đổi database trong những lần làm việc tiếp theo cũng phải theo quy trình này. Không đưa dữ liệu tài khoản thật hoặc bí mật vào migration.

# Cấu trúc dự án

- `frontend/`: giao diện React chia thư mục theo vai trò (giống repo tham khảo tronect-mobile-app): `app/` màn hình theo trang (`_layout.tsx`, `(tabs)/`, …), `api/` hàm gọi backend, `components/ui` (dùng chung, kebab-case) và `components/customs` (riêng Đông A, PascalCase), `constants/`, `hooks/` (`use-*.ts`), `lib/`, `providers/`, `store/`, `types/` (`*Type.ts`), `utils/`, `assets/`. Import bằng `@/…`. Xem `frontend/README.md`.
- `backend/`: máy chủ FastAPI – API, xác thực, logic học tập (`app/`).
- `ai/`: BKT, RAG, Gemini/Hugging Face, mô hình NLP, huấn luyện/đánh giá, bộ dữ liệu. Giữ tên module phẳng (`create_model`, `context_manager`, ...) vì `models/dong_a_nlp_model.joblib` được pickle theo các tên này.
- `database/`: kho tài khoản & tiến độ (`user_store.py`), migration PostgreSQL (`migrator.py`, `migrate.py`, `migrations/`), SQLite cục bộ (`data/users.db`).

# Game Hào Khí Đông A (cổng học sinh)

- Mã game nằm trong `frontend/app/student/` (khung và các tab), `frontend/components/customs/game/`, `frontend/constants/game/`, `frontend/lib/game/` và `frontend/store/game.store.ts`. Thiết kế theo `KE_HOACH_GAME_HAO_KHI_DONG_A.md`.
- Gọi backend qua hàm trong `frontend/api/`, không gọi `fetch` thẳng trong component. File component chỉ export component (oxlint `only-export-components`).
- Câu hỏi của game nằm ở `ai/data/game_content.json`; server giữ đáp án và tự chấm (`backend/app/core/question_bank.py`). Ấn Tín (cột `gems`) và XP chỉ được cộng ở server khi chấm; client chỉ được tiêu Ấn Tín.
- Nội dung câu hỏi phải khớp `ai/data/knowledge_base.json`; không sửa tay `knowledge_base.json`/`q_matrix.json` (được sinh từ `ai/data_splitter.py`).
- Kiểm thử backend: `python -m unittest discover -s backend/tests -v` (từ thư mục gốc).

# Thi đấu cả lớp (thời gian thực)

- WebSocket `/api/live/ws` (`backend/app/api/live.py`), điều phối phòng ở `backend/app/core/live.py`. Token gửi trong tin nhắn đầu tiên `{"type":"auth","token":...}`, không đặt trên URL (URL WebSocket được ghi vào log truy cập).
- Phòng đang chơi chỉ nằm trong bộ nhớ của tiến trình backend: chạy MỘT tiến trình uvicorn (không `--workers` > 1). Cần `websockets` trong `backend/requirements.txt`.
- Chỉ học sinh cùng lớp với giáo viên vào được phòng. Câu trả lời đi qua `record_answer` (BKT, XP, Ấn Tín) như khi luyện tập; trận kết thúc lưu vào `app_live_sessions`/`app_live_results` (migration 005).
- Lưu tiến độ bằng `_save` trong `learning.py` (không ghi `game_state`), để không đè trạng thái game client vừa tự lưu.

# Chatbot (mô hình NLP)

- Thêm/sửa chủ đề: sửa `KNOWLEDGE_UNITS` và `REAL_STUDENT_TEST_SET` trong `ai/data_splitter.py`, rồi từ thư mục `ai/` chạy `python data_splitter.py`, `python create_model.py`, `python test_model.py`, `python test_regression_suite.py`. Ghi lại số liệu đánh giá mới (`ai/KET_QUA_DANH_GIA.md`).
- Mô hình được pickle bằng scikit-learn 1.7.x + numpy 2.x; đổi phiên bản chính thì phải huấn luyện lại.

# Tự động đồng bộ sau khi hoàn tất công việc

Người dùng đã cho phép tự động cập nhật dự án sau mỗi yêu cầu sửa đổi hoàn tất; không cần hỏi lại để commit, push hoặc triển khai các thay đổi thuộc yêu cầu đó. Đây là quy trình kết thúc mỗi lần làm việc của agent, không phải dịch vụ theo dõi mọi lần lưu file khi agent không hoạt động.

- Chạy kiểm tra phù hợp với thay đổi; xử lý lỗi trước khi phát hành. Không tự đưa thay đổi không liên quan hoặc bí mật vào commit.
- Commit và push lên nhánh `main` của `https://github.com/Nvda06042005/DATN-2026`. Nếu đang làm trong bản giải nén không có `.git`, dùng checkout Git liên kết đúng repo và đối chiếu thay đổi trước khi push; không force-push.
- Vercel triển khai frontend từ GitHub: `https://datn-2026-indol.vercel.app/`. Kiểm tra trạng thái triển khai và website sau push.
- Render triển khai backend từ GitHub: `https://datn-2026-gm5g.onrender.com/`. Kiểm tra `/api/health`, `/api/database/health` và API liên quan đến thay đổi. Nếu không tự triển khai, dùng kết nối Render được cấp để deploy; nếu thiếu quyền truy cập, báo rõ phần chưa hoàn tất.
- Supabase: thay đổi schema hoặc seed/reference data phải có migration mới theo quy tắc ở trên. Backend áp dụng migration khi khởi động; xác minh migration đã chạy. Không cần sửa database nếu yêu cầu không thay đổi database.
- Chỉ báo đồng bộ thành công khi có bằng chứng cho từng dịch vụ; nêu rõ lỗi triển khai hoặc thiếu kết nối. Không yêu cầu lại quyền triển khai đã được cấp trong mục này.
