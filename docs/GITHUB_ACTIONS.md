# GitHub Actions và Check status

Workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) chạy khi push lên mọi nhánh, khi mở/cập nhật pull request vào `main`, hoặc khi bấm **Run workflow** tại [Actions → CI](https://github.com/Nvda06042005/DATN-2026/actions/workflows/ci.yml).

Ba nhóm kiểm tra:

- **Backend and PostgreSQL migrations:** npm 10.9.4, cài sạch lockfile, biên dịch TypeScript, kiểm tra migration SQL và toàn bộ kiểm thử backend trên PostgreSQL 16 tạm. Thiếu công cụ PostgreSQL hoặc có bài kiểm thử bị bỏ qua thì không báo đạt. Kết quả JSON được giữ 7 ngày trong artifact của lượt chạy.
- **Frontend typecheck, tests and build:** cài sạch, kiểm tra TypeScript, hợp đồng API và build web; xác minh SHA trong `build-info.json` trùng commit được kiểm tra.
- **Local auto-sync regression tests:** thử cơ chế chụp code, gộp/push, bảo vệ file đang sửa, SQL đã commit, dữ liệu bí mật và xác minh đúng phiên bản triển khai, bằng các repository Git tạm.

Dùng Ubuntu 24.04 và Node 22.21.0; các action chính thức được cố định bằng commit SHA. Token của workflow chỉ có `contents: read`; không cần thêm secret, không kết nối Supabase production và không tự chạy migration trên database thật. Migration thật vẫn do backend Render áp dụng khi khởi động.

## Hiểu dấu tích

- Màu vàng: đang chờ hoặc đang chạy. Xanh: toàn bộ nhóm kiểm tra đã đạt. Đỏ: mở lượt chạy để đọc tên bước lỗi và log.
- Check status gắn với từng commit, độc lập với việc nhánh đã gộp hay chưa. Thêm workflow không tạo kết quả ngược cho commit cũ; các nhánh cũ chưa chứa file workflow vẫn có thể để trống trạng thái. Commit mới chứa workflow sẽ tự chạy kiểm tra.
- CI xanh xác nhận build/test, không tự chứng minh Render/Vercel đã phục vụ bản mới. Xác minh cloud vẫn dùng SHA tại `/api/health`, `/build-info.json` và `schema_version` tại `/api/database/health`, như [quy trình tự đồng bộ](TU_DONG_DONG_BO.md).
- Chưa đặt quy tắc bảo vệ nhánh bắt buộc CI: workflow cung cấp kết quả kiểm tra, còn quyền push/gộp hiện có được giữ nguyên.

Tài liệu chính thức: [GitHub status checks](https://docs.github.com/en/pull-requests/reference/status-checks), [Ubuntu runner image](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md), [setup-node](https://github.com/actions/setup-node).
