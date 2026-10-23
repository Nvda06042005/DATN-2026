# Database migrations

Với mọi thay đổi schema PostgreSQL hoặc seed/reference data, luôn thêm migration SQL đánh số tiếp theo trong `database/migrations/`, giữ nguyên các migration đã chạy, và kiểm tra bằng `python database/migrate.py check` (chạy từ thư mục gốc dự án) cùng các bài kiểm thử migration.

Backend tự áp dụng migration mới khi khởi động với `DATABASE_URL`. Các thay đổi database trong những lần làm việc tiếp theo cũng phải theo quy trình này. Không đưa dữ liệu tài khoản thật hoặc bí mật vào migration.

# Cấu trúc dự án

- `frontend/`: giao diện React (một file `src/App.tsx`).
- `backend/`: máy chủ FastAPI – API, xác thực, logic học tập (`app/`).
- `ai/`: BKT, RAG, Gemini/Hugging Face, mô hình NLP, huấn luyện/đánh giá, bộ dữ liệu. Giữ tên module phẳng (`create_model`, `context_manager`, ...) vì `models/dong_a_nlp_model.joblib` được pickle theo các tên này.
- `database/`: kho tài khoản & tiến độ (`user_store.py`), migration PostgreSQL (`migrator.py`, `migrate.py`, `migrations/`), SQLite cục bộ (`data/users.db`).

# Game Hào Khí Đông A (cổng học sinh)

- Mã game nằm trong `frontend/src/App.tsx`, giữa hai dấu `// @@GAME-BEGIN@@` và `// @@GAME-END@@`. Thiết kế theo `KE_HOACH_GAME_HAO_KHI_DONG_A.md`.
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
