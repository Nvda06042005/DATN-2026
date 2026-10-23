# PostgreSQL / Supabase và SQL migrations

Mọi thay đổi database từ nay có file SQL đánh số trong `database/migrations/`.
Khi backend khởi động với `DATABASE_URL`, migration runner tự áp dụng các file mới
trước khi mở kho tài khoản. Cả `python run.py` và lệnh Uvicorn trên Render đều chạy bước này.

## Cấu hình một lần

1. Mở dự án Supabase **Do An Tot Nghiep Gaminication Lich su**.
2. Vào **Connect**, sao chép URI của **Session pooler** (IPv4, port 5432).
3. Đặt URI có mật khẩu thật trong `backend/.env` khi chạy local, hoặc biến môi trường
   `DATABASE_URL` của backend Render. URL-encode mật khẩu có ký tự đặc biệt.
4. Triển khai bản code có thư mục migrations và khởi động lại backend.

Ví dụ mẫu, không phải thông tin kết nối thật:

```dotenv
DATABASE_URL=postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@YOUR_POOLER_HOST:5432/postgres?sslmode=require
```

Không đưa URI có mật khẩu lên GitHub hoặc vào biến `VITE_*` của frontend.
`https://PROJECT_REF.supabase.co` là API URL, không phải URI PostgreSQL.
Chi tiết các kiểu kết nối: [tài liệu Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Thêm thay đổi database

Chạy từ thư mục gốc dự án:

```powershell
python database/migrate.py new add_student_badges
```

Lệnh tạo `006_add_student_badges.sql` nếu hiện có 001–005. Viết SQL vào file mới,
ví dụ thêm cột, bảng, index hoặc seed/reference data. File mới tạo chỉ có hướng dẫn;
lệnh kiểm tra/khởi động sẽ từ chối file này cho đến khi có SQL thật.

```sql
ALTER TABLE public.app_progress
    ADD COLUMN badges TEXT NOT NULL DEFAULT '[]';
```

Sau đó:

```powershell
python database/migrate.py check
python database/migrate.py status
python database/migrate.py up
```

- `check`: kiểm tra số thứ tự, tên file và các quy tắc SQL cơ bản, không kết nối database.
  Đây không phải bộ phân tích toàn bộ cú pháp PostgreSQL; luôn kiểm tra bằng database thử nghiệm.
- `status`: chỉ đọc lịch sử, liệt kê `APPLIED` / `PENDING`.
- `up`: áp dụng file mới vào database mà `DATABASE_URL` trỏ tới.
- Khi deploy code mới lên Render, startup tự làm bước `up`; không cần dán SQL thủ công.
- Build Render chạy `check` để phát hiện file chưa hoàn thành trước lúc startup.

Không sửa/đổi tên/xóa file đã chạy. Nếu cần điều chỉnh, tạo migration số tiếp theo.
Không thêm `BEGIN`, `COMMIT`, `ROLLBACK`, `VACUUM` hoặc `CREATE INDEX CONCURRENTLY`:
runner quản lý một transaction cho cả đợt file mới. Khi một file lỗi, toàn bộ đợt mới
rollback và backend dừng khởi động. Các đợt đã chạy thành công trước đó được giữ lại.

Lịch sử nằm trong `public.app_schema_migrations`, gồm tên file, phiên bản, SHA-256 và
thời điểm áp dụng. Runner kiểm tra checksum và dùng transaction advisory lock để các
worker không cùng chạy migration. Cách quản lý transaction dựa trên
[Psycopg](https://www.psycopg.org/psycopg3/docs/basic/transactions.html) và
[PostgreSQL advisory locks](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS).

## Các migration ban đầu

| File | Nội dung |
| --- | --- |
| `001_initial_postgres_schema.sql` | Baseline của `User`, `Profile`, `UserSettings`, `_prisma_migrations` và enum `UserRole` đã nhập từ `do_an_tot_nghiep`. Giữ dữ liệu và lịch sử Prisma đang có. |
| `002_app_users.sql` | Bảng tài khoản `app_users` mà Python backend đang sử dụng. |
| `003_app_progress.sql` | Bảng tiến độ học tập `app_progress`. |
| `004_app_progress_game_state.sql` | Cột cho game Hào Khí Đông A trong `app_progress`: `game_state` (trạng thái game, tối đa 16 KB), `question_stats` (số lần trả lời/sai theo câu), `day_gems`, `week_xp`, `week_key`, `freeze_week`. Không xóa hay đổi dữ liệu cũ. |
| `005_app_live_sessions.sql` | Lịch sử thi đấu cả lớp: `app_live_sessions` (trận, giáo viên, lớp, thống kê từng câu) và `app_live_results` (hạng, điểm, số câu đúng của từng học sinh). Khóa ngoại tới `app_users` với `ON DELETE CASCADE`, bật RLS, không có policy công khai. Chỉ tạo bảng mới. |

Baseline không chứa dữ liệu tài khoản thật. Bộ bốn bảng Prisma và các bảng `app_*`
là hai schema ứng dụng khác nhau; migration không chuyển đổi tài khoản giữa chúng.
Các bảng mới bật RLS, không tạo policy công khai. Backend kết nối bằng role có đủ
quyền chạy DDL và truy cập các bảng của ứng dụng (ví dụ role `postgres` trong URI của Supabase).

## Phạm vi tự đồng bộ

File SQL mới → deploy/restart backend với `DATABASE_URL` Supabase → tự áp dụng lên Supabase.
Đây là đồng bộ các thay đổi được ghi thành migration. Một lần sửa trực tiếp trong pgAdmin,
hoặc thêm dòng vào một database local riêng, không tự xuất hiện trên Supabase.
Dữ liệu phát sinh qua API sẽ ghi thẳng vào Supabase khi backend dùng URI Supabase.
Nếu không có `DATABASE_URL`, backend vẫn dùng SQLite local và không chạy migration PostgreSQL.

## Kiểm tra

```powershell
python -m unittest discover -s database/tests -p "test_migrations.py" -v
```

Các kiểm thử tích hợp tự tạo PostgreSQL cluster tạm bằng `initdb`/`pg_ctl`, bind localhost,
dùng dữ liệu giả và dừng/xóa cluster sau khi chạy. Không dùng database local thật hoặc Supabase.
Đặt `POSTGRES_BIN` nếu công cụ PostgreSQL không nằm trong PATH/vị trí cài mặc định.
Các bài tích hợp sẽ báo skip nếu không tìm thấy PostgreSQL binaries.

Kiểm tra triển khai: `/api/database/health`, rồi `python database/migrate.py status` trên môi trường
backend để xác nhận các migration đã được áp dụng.
