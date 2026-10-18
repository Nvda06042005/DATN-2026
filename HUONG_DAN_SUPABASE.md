# Hướng dẫn nối Supabase với backend Render

> Bản chỉnh sửa này chỉ **kết nối / kiểm tra PostgreSQL**, chưa tự động lưu các Quiz, Story, Folder hay tài khoản. Hiện Frontend còn dùng dữ liệu mock; cần viết CRUD + xác thực trước khi lưu dữ liệu người dùng thật.

## 1. Lấy connection string đúng từ Supabase

1. Mở Supabase > Project "Do An Tot Nghiep Gamification".
2. Bấm nút **Connect** màu xanh ở phía trên dashboard.
3. Ở phần database connection, chọn **Session pooler** (thường cổng **5432**, chạy IPv4 và phù hợp Render).
4. Copy **Connection string URI** đầy đủ của Supabase. Không tự đoán hostname của pooler.
5. Thay `[YOUR-PASSWORD]` bằng **database password** đặt khi tạo Supabase. Nếu password có ký tự đặc biệt (`@`, `#`, `%`, `?`, `/` ...), URL-encode phần password trước khi gắn vào URI (hoặc đặt lại password dễ mã hoá). Tuyệt đối không chia sẻ URI có mật khẩu.

URI ví dụ (chỉ là mẫu, KHÔNG dùng nguyên văn):

```
postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@YOUR_POOLER_HOST:5432/postgres?sslmode=require
```

**Chú ý:** `https://...supabase.co` trên trang chủ là Project API URL, **không** dùng làm `DATABASE_URL` kết nối Postgres.

## 2. Cài biến môi trường trên Render

1. Render Dashboard > chọn **Web Service backend** của dự án.
2. **Environment** > **Add Environment Variable**:

```
Key: DATABASE_URL
Value: URI Supabase Session pooler có mật khẩu thật
```

3. Save, sau đó **Manual Deploy > Deploy latest commit** (nếu Render chưa tự deploy).
4. Trong Render cần dùng bản mã nguồn đã bổ sung `backend/app/api/database.py`, cập nhật `backend/app/main.py`, và cài `psycopg[binary]` ở `backend/requirements.txt`.
5. Đừng đưa mật khẩu lên GitHub, Vercel hay code Frontend.

## 3. Test

Mở trang sau, với `ten-backend` là tên web service Render của bạn:

```
https://ten-backend.onrender.com/api/database/health
```

Nếu thành công:

```json
{"status":"connected","database":"postgresql"}
```

Nếu trả 503: kiểm tra `DATABASE_URL` chưa khai báo, mật khẩu sai, URI pooler không đúng, hostname/port, và log Render. Không công khai log chứa bí mật.

## 4. Hướng đi tiếp để dữ liệu thực sự lưu xuống Supabase

- Thiết kế schema `users`/`folders`/`quizzes`/`stories`/`student_progress` theo yêu cầu thực tế, tránh tạo bảng không khớp dữ liệu ứng dụng.
- Thêm API CRUD có **authentication + authorization**. Không mở các API ghi/xóa công khai dùng quyền quản trị Supabase.
- Thay React state/mock ở `frontend/src/views/LibraryView.tsx` bằng các lệnh đọc/ghi API backend.
- Rà soát Supabase RLS trước khi dùng Data API trực tiếp từ frontend.

### Phân biệt biến môi trường

- Backend Render: `DATABASE_URL` là connection string **Postgres** của Supabase, chỉ ở phía server.
- Frontend Vercel: `VITE_API_URL` là URL backend Render (code có sẵn ở `frontend/src/config/api.ts`).
- Không được đặt `DATABASE_URL`, secret key / service role key vào biến `VITE_*` vì sẽ lộ ra trình duyệt.
