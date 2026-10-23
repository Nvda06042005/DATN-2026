# Hào Khí Đông A – Học Lịch sử 7 qua game

Web-game về ba lần kháng chiến chống quân Mông – Nguyên (1258 – 1288) cho học sinh lớp 7, kèm trang giáo viên và trang quản trị. Thiết kế chi tiết: [KE_HOACH_GAME_HAO_KHI_DONG_A.md](KE_HOACH_GAME_HAO_KHI_DONG_A.md).

Dự án chia thành 4 phần độc lập:

| Thư mục | Nội dung |
| --- | --- |
| `frontend/` | Giao diện React + Vite + Tailwind, chia thư mục `app/` (màn hình theo trang), `api/`, `components/`, `constants/`, `hooks/`, `lib/`, `providers/`, `store/`, `types/`, `utils/` – xem `frontend/README.md`. Trang `/hoc-sinh` (game), `/giao-vien`, `/admin`. |
| `backend/` | Máy chủ FastAPI (`app/`): API đăng nhập, quản trị, học sinh (câu hỏi, chấm điểm, trạng thái game), giáo viên, chat, quiz, truyện. |
| `ai/` | BKT, RAG, Gemini/Hugging Face, mô hình NLP (`models/`), bộ dữ liệu (`data/`), ngân hàng câu hỏi của game (`data/game_content.json`). |
| `database/` | Kho tài khoản & tiến độ (`user_store.py`), migration PostgreSQL (`migrations/`, `migrate.py`), SQLite cục bộ (`data/users.db`). |

## Cổng học sinh: game Hào Khí Đông A

| Tab | Nội dung |
| --- | --- |
| Điền Trang | Bàn căn cứ 8 công trình, ruộng tự sinh Lương Thảo, nâng cấp phải trả lời đúng 1 câu, sự kiện “Giặc cướp lương” với kế “Vườn không nhà trống”, nhiệm vụ ngày. |
| Doanh Trại | 14 tướng theo 5 hệ, tiến hóa theo giai đoạn cuộc đời (có mốc năm), Hội Quán Vạn Kiếp (thẻ Nhân lực + thẻ Sự kiện → lệnh bài → câu hỏi), cổ vật. |
| Chiến Dịch | 3 màn × 3 pha, đánh theo lượt 3v3: ý đồ địch báo trước, sức bền (lương) của giặc, kế sách của màn, đồng hồ thủy triều Bạch Đằng. |
| Quốc Tử Giám | Thi đấu cả lớp (nhập mã PIN), luyện nhanh, theo chủ đề, Tháp Khảo Thí 10 tầng, ôn điểm yếu theo BKT, đề do Quân Sư AI soạn. |
| Sử Ký | Dòng thời gian 1258 – 1288 trên lược đồ, thẻ tri thức lấy từ `knowledge_base.json`, chat Quân Sư AI (RAG). |

Câu hỏi được server chọn và chấm, nên Ấn Tín và XP chỉ tăng khi trả lời đúng (tối đa 300 Ấn Tín/ngày). Trạng thái game (công trình, tướng, cổ vật…) tự lưu lên server.

## Thi đấu cả lớp (thời gian thực)

1. Giáo viên bấm **Thi đấu trực tiếp**, chọn số câu (5/10/15) và phạm vi (cả bài hoặc từng lần kháng chiến), rồi **Mở phòng**. Màn hình hiện mã PIN 6 chữ số và đường link có sẵn mã.
2. Học sinh cùng lớp vào **Quốc Tử Giám → Thi đấu cả lớp**, nhập PIN (hoặc mở link). Học sinh lớp khác không vào được.
3. Mỗi câu 20 giây. Server chấm, tính điểm theo tốc độ và chuỗi câu đúng, công bố đáp án khi hết giờ hoặc khi cả lớp đã trả lời. Giáo viên trình chiếu phân bố đáp án, bảng điểm, bục vinh quang.
4. Mỗi câu trả lời được cộng vào tiến độ thật (XP, Ấn Tín, BKT) như khi luyện tập. Kết quả trận lưu vào thẻ **Thi đấu gần đây** ở trang giáo viên.

Kết nối qua WebSocket `/api/live/ws`; mất mạng hoặc tải lại trang thì tự vào lại đúng phòng. Phòng đang chơi nằm trong bộ nhớ backend, nên backend phải chạy **một tiến trình**. Trang web chạy bằng `https` thì backend cũng phải có `https` (trình duyệt dùng `wss://`).

## Chạy trên máy

```bash
# 1. Cài thư viện Python (từ thư mục gốc)
pip install -r backend/requirements.txt

# 2. Backend – http://localhost:8000
cd backend
cp .env.example .env   # điền GEMINI_API_KEY, DATABASE_URL (nếu dùng Supabase)
python run.py

# 3. Frontend – http://localhost:5173
cd frontend
npm install
npm run dev            # hoặc: npm run build:single -> frontend/dist-single/index.html (1 file)
```

Không có `DATABASE_URL` thì backend dùng SQLite `database/data/users.db` (file cũ được tự bổ sung cột mới, giữ nguyên dữ liệu).
Đăng nhập quản trị tại `/admin` (mặc định `admin` / `admin@123`, đổi bằng `ADMIN_PASSWORD`).

## Kiểm thử

Chạy từ thư mục gốc:

```bash
python -m unittest discover -s backend/tests -v                          # API game, chấm điểm, Ấn Tín, bảng giáo viên, phòng thi đấu WebSocket
python database/migrate.py check                                         # kiểm tra file migration
python -m unittest discover -s database/tests -p "test_migrations.py" -v # migration PostgreSQL + SQLite
cd ai && python test_model.py && python test_regression_suite.py         # đánh giá chatbot (số liệu: ai/KET_QUA_DANH_GIA.md)
cd frontend && npx tsc -b && npx oxlint && npm run build
```

## Database

```bash
python database/migrate.py status   # xem migration đã chạy trên DATABASE_URL
```

Mọi thay đổi schema thêm file SQL đánh số mới trong `database/migrations/` – xem `AGENTS.md` và `database/HUONG_DAN_SUPABASE.md`. Migration mới nhất: `005_app_live_sessions.sql` (lịch sử thi đấu cả lớp).

## Lưu ý

- Module trong `ai/` giữ tên phẳng (`create_model`, `context_manager`, …) vì `ai/models/dong_a_nlp_model.joblib` được pickle theo các tên này. `backend/app/__init__.py` tự thêm thư mục gốc và `ai/` vào `sys.path`.
- Chatbot đã học 4 chủ đề mới của game (ngụ binh ư nông, Trần Khánh Dư ở Chí Linh, Binh thư yếu lược, Trần Nhân Tông). Số liệu trước/sau khi huấn luyện lại và cách chạy lại: `ai/KET_QUA_DANH_GIA.md`.
- Mô hình `.joblib` được tạo bằng scikit-learn 1.7.x và numpy 2.x (đã ghim trong `backend/requirements.txt`). Đổi phiên bản chính của hai thư viện này thì phải huấn luyện lại.
- Không đưa `DATABASE_URL` hay khoá bí mật vào biến `VITE_*` của frontend.
