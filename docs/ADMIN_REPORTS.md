# Dashboard và nhận diện hai cấp quản trị

| Tài khoản | Cổng | Nhãn luôn hiển thị | Phạm vi |
| --- | --- | --- | --- |
| root_admin | `/admin` | Quản trị tổng · Toàn hệ thống | Mọi trường và quản trị trường. Có thể lọc một trường để xem sâu. |
| school_admin | `/school-manager-admin` | Quản trị trường · Trường được gán | Tên/mã trường được gán; không truy cập trường khác. |

Vai trò lấy từ tài khoản được server xác thực, không lấy từ URL hoặc do người dùng tự chọn.
Nhãn hiện trên desktop lẫn điện thoại, kể cả khi đóng sidebar; màn đăng nhập cũng giải thích hai phạm vi.
Trong Tài khoản, cột Vai trò và chi tiết/phân quyền cho biết từng người là tổng, trường, giáo viên hay học sinh.
Chỉ tổng được cấp/phân quyền tài khoản quản trị. Nhóm TM.SA-SCHOOL tiếp tục dùng chức năng [quản lý trường](SCHOOL_ADMIN.md).

Một mục **Dashboard hệ thống** (tổng) hoặc **Dashboard trường** (trường) có đủ TM.SA-REPORT.001–008:

- Tổng trường, hoạt động/tạm ngưng và cấp học chương trình THCS 6–9; chưa giả lập cấp tiểu học/THPT.
- Khối đếm theo cặp trường–khối, có lớp hoặc học sinh; không nhầm với số học sinh hay bốn tên khối.
- Lớp theo khối/năm, số lớp hoạt động và đã duyệt. Hoạt động là cờ lớp + cờ trường; duyệt là trạng thái riêng.
- Giáo viên tổng/hoạt động/có lớp đang dạy/chưa có lớp; học sinh tổng/hoạt động/đã vào/chưa vào lớp.
  Phân lớp dùng lớp thật đã duyệt, đang hoạt động, membership; nhiều lớp không nhân đôi số người.
- So sánh trường: hoàn thành lượt học, điểm luyện tập TB (/10), tỷ lệ tham gia luyện tập/game.
- Thi đấu: trận đã kết thúc/được lưu, lượt tham gia, học sinh khác nhau, tỷ lệ đúng theo trường.
- Excel `.xlsx` với toàn bộ kết quả lọc (không chỉ trang so sánh hiện thấy), gồm 5 sheet:
  Tổng quan, Theo trường, Khối, Lớp theo năm, Phạm vi và cách tính. Tỷ lệ là số thực định dạng %;
  ô chưa có điểm để trống. Web tải bằng Bearer header, không đặt token vào URL; native hiển thị số liệu và hướng dẫn dùng web để xuất.

`GET /api/admin/reports/dashboard` và `GET /api/admin/reports/export` nhận school_id, school_year,
region, city, active (trạng thái trường). API chỉ cho hai vai trò quản trị; tổng dùng transaction hệ thống,
trường dùng `db.scoped`/RLS cùng SQL giới hạn trường từ actor. school_id giả không vượt được scope;
cả facets lẫn file Excel cũng bị giới hạn.

## Cách tính và giới hạn dữ liệu

- Không tính tài khoản trong thùng rác. Hoạt động của tài khoản đòi hỏi tài khoản và trường đều đang bật.
- Khi không lọc trường/địa bàn/trạng thái trường, tổng vẫn tính nhân sự cũ chưa gán trường vào tổng và
  chỉ số học tập; hiển thị số chưa gán riêng, không đưa vào so sánh theo trường.
- Lọc năm chọn lớp đúng năm; nhân sự có năm hồ sơ hoặc được phân công/tham gia lớp năm đó. Số trường
  là số trường trong phạm vi đã lọc. Tiến độ là tích lũy hiện có của nhóm học sinh, **không phải lịch sử tiến độ theo năm**.
- Hoàn thành = số HS có `lessons_completed > 0` / số HS; đây là hoàn thành ít nhất một lượt học/trận,
  không phải hoàn thành toàn bộ chương trình. Tham gia = số HS có câu trả lời được server chấm / số HS.
- Điểm TB = trung bình từng HS có trả lời của `10 × questions_correct / questions_answered`;
  không phải điểm học kỳ. Không có mẫu thì UI hiển thị —, Excel trống.
- Thi đấu chỉ tính bảng kết quả đã lưu. Một HS tham gia hai trận là hai lượt; số HS khác nhau đếm DISTINCT toàn phạm vi.
  Tỷ lệ đúng = tổng correct / tổng answered, không lấy trung bình % từng trận. Không dùng XP làm điểm kiểm tra.

Migration `010_reporting_scope.sql` giữ các kết quả cũ, thêm school_id/class_id/school_year/grade vào trận
và hai policy RLS chỉ đọc cho scoped role. Trận cũ gán trường hiện tại của giáo viên tại thời điểm chuyển đổi;
không đoán năm học. Trận mới giữ trường từ phòng; chỉ lấy năm/khối khi tìm được đúng một lớp.
Chưa rõ năm sẽ bị loại khi lọc năm và được đếm trong chú thích. Không suy đoán lại lịch sử từ tên lớp tái sử dụng.
Đổi trường của giáo viên/học sinh không chuyển quyền xem trận đã lưu sang trường mới.

Kiểm chứng: `backend/test/reports.spec.ts` (số liệu, không đếm trùng, filter, scope, RLS, XLSX,
chuyển trường, mẫu rỗng, người chưa gán); `migrations.spec.ts` kiểm chứng bảo toàn kết quả cũ.
Chạy build/migrate check/npm test; frontend typecheck + Expo web export.
Sau deploy database health cần `schema_version >= 10`.
