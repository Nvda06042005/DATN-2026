# Quản lý trường học – GĐ1

Giữ hai cấp quản trị. Quản trị tổng có thể xem và quản lý tất cả trường; quản trị trường chỉ truy cập trường được gán.
Ví dụ nền tảng có 64 trường: tổng xem 64, tài khoản trường A chỉ thấy A; đổi URL/ID/query sang 63 trường khác không mở được dữ liệu.

| Chức năng | Giao diện và API |
| --- | --- |
| TM.SA-SCHOOL.003 – Chi tiết trường | Trường học → Xem chi tiết: tên/mã, địa chỉ/liên hệ, số khối/lớp/GV/HS, thống kê từng khối, danh sách quản trị trường. GET /api/admin/schools/:id. |
| TM.SA-SCHOOL.004 – Chỉnh sửa trường | Quản trị tổng chọn Chỉnh sửa trường, sửa tên/địa bàn/địa chỉ/liên hệ/trạng thái. PATCH /api/admin/schools/:id; trường khác không có quyền sửa. |
| Cấp tài khoản giáo viên/phân quyền, khóa/mở | Mục Giáo viên hoặc nút trong chi tiết trường. Dùng chức năng tài khoản TM.SEC hiện có; scope/role vẫn được kiểm tra ở API. |
| TM.SA-SCHOOL.007 – Lọc lớp | Khối và lớp: trường (root), cấp THCS, khối 6–9, hoạt động, kết quả duyệt, khu vực, tỉnh/thành, năm học và tìm mã/tên. |
| TM.SA-SCHOOL.009 – Tất cả khối/lớp | Danh mục phân trang, số lớp theo từng khối, giáo viên phụ trách và số thành viên thực. GET /api/admin/class-directory. |
| TM.SA-SCHOOL.010 – Tất cả giáo viên | Danh sách vai trò teacher, trường, lớp đã duyệt/đang bật và trạng thái tài khoản; root thấy toàn hệ thống, trường chỉ scope của mình. |
| TM.SA-SCHOOL.011 – Tất cả học sinh | Danh sách vai trò student, lọc trường/khối/lớp/trạng thái; từ danh mục lớp mở đúng membership. |

Giáo viên/Học sinh dùng bộ lọc độc lập; chọn mục ở sidebar mở lại danh sách đúng đối tượng.
Tên lớp trùng giữa hai trường không làm lẫn membership. Không có bản ghi lớp/nhân sự giả để lấp giao diện.
Cấp học bám chương trình hiện có: THCS, khối 6–9. Mã lớp chưa biết khối hiển thị “Chưa rõ khối”.
Duyệt lớp (chờ/đã duyệt/từ chối) và cờ cho phép hoạt động là hai trạng thái riêng.

Trường tạm ngưng sẽ thu hồi phiên và chặn đăng nhập các tài khoản thuộc trường; dữ liệu học tập và cờ khóa riêng từng tài khoản vẫn giữ.
Mở lại trường không khôi phục token cũ và không tự mở tài khoản đã khóa riêng. Quản trị tổng vẫn quản lý được trường tạm ngưng.
Lớp tạm ngưng giữ dữ liệu, không được chọn/vào/mở phòng thi đấu mới.

Migration **009_school_management.sql** chỉ thêm cột/chỉ mục và suy khối từ mã rõ ràng; giữ RLS và tài khoản.
Sau deploy, `/api/database/health` phải báo `schema_version: 9` (hoặc lớn hơn nếu có migration mới).
Kiểm thử dùng 64 trường tạm trong `backend/test/school-management.spec.ts`, không tạo trường thử trên Supabase.
