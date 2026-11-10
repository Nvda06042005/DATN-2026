# Mã giáo viên theo trường

Yêu cầu 09/11/2026: cùng quy tắc cho form Thêm/Sửa, Excel và danh sách giáo viên.

`GOT2615031985001` = `GOT` (THCS Giồng Ông Tố) + `26` (năm nhập 2026, giờ Việt Nam) + `15031985` (ngày sinh 15/03/1985) + `001` (STT trong trường). Tên trường khác dùng viết tắt của chính trường đó, bỏ tiền tố cấp học và dấu tiếng Việt. STT tối thiểu ba chữ số, không cắt mất số khi vượt 999.

Migration `056_school_teacher_identity_codes.sql` lưu STT/năm trên tài khoản và bộ đếm riêng mỗi trường (`app_teacher_code_counters`, có RLS). Trigger PostgreSQL cấp số trong giao dịch; tạo đồng thời không trùng số, xóa giáo viên không lùi bộ đếm. Xem trước không giữ chỗ; kết quả lưu là mã chính thức. Giữ các bộ sinh HS/LH hiện có.

**Tài khoản đã có:** theo yêu cầu cập nhật lại danh sách, migration đánh STT theo thời điểm tạo/id, lấy năm từ `created_at` và ngày sinh đã lưu rồi đổi `user_code`. Không đổi id, username, mật khẩu, phiên, trường, lớp hoặc dữ liệu nghiệp vụ. Tài khoản thiếu ngày sinh giữ mã đang có; Thêm/Sửa trên web yêu cầu ngày sinh, bổ sung sẽ sinh mã đúng. Khi sửa ngày sinh, phần ngày sinh trong mã được cập nhật; năm/STT giữ nguyên. Tên đăng nhập vẫn dùng được.

**Excel:** giữ ví dụ riêng; theo yêu cầu mới, STT/mã ở dòng trống đều trống và chỉ hiện khi đủ họ tên, email, ngày sinh. STT liên tiếp qua dòng trống, không đánh sẵn 1–1000. Mẫu tải mới tiếp nối bộ đếm của trường; cột mã tự hiện khi có họ tên và ngày sinh kiểu ngày, chuỗi `dd/mm/yyyy` hoặc ISO. Không dùng DATEVALUE phụ thuộc locale. Import chỉ nhận đúng công thức do mẫu tạo; máy chủ tự tính lại mã theo trường/ngày sinh/năm nhập, không tin tiền tố do người tải lên sửa. Mẫu cũ vẫn đọc được; nếu có người khác thêm tài khoản kể từ lúc tải file, hệ thống chốt lại số khi lưu và trả mã thật trong kết quả. File cũ thiếu ngày sinh vẫn tương thích; không tự đặt một ngày sinh giả.

Kiểm thử: API với PostgreSQL tạm (tiền tố có dấu, ngày không hợp lệ, xem trước, tạo đồng thời, sửa/lấy danh sách, RLS và truy cập chéo trường); nâng 055→056 với dữ liệu fixture; hồi quy nhập/xuất Excel và kiểm tra công thức bằng phiên bảng tính riêng. Không tạo/sửa tài khoản thật để kiểm thử production.

## Nhập trực tiếp trong Excel Windows

Lựa chọn mới nhất ngày 09/11/2026 thay quy trình bảng web trước đó. Vào Giáo viên → Nhập từ Excel → Tải file mẫu. File tải là `file_mau_giao-vien_truong_giong-ong-to.xlsm` (tên trường thay tự động). Mở bằng Microsoft Excel Windows, cho phép nội dung macro của đúng file mẫu nếu Excel yêu cầu. Không tắt bảo vệ macro toàn cục.

Điền các cột Họ tên, Giới tính, SĐT, Email, bấm ô ngày sinh để mở lịch chọn tháng/năm/ngày. Nhấn Enter ở ô ngày sinh khi đủ họ tên, email và ngày sinh: STT/mã hiện, con trỏ về Họ tên dòng kế tiếp. Dòng trống không có dãy STT 1–1000; sửa thông tin sẽ xóa xác nhận và cần Enter lại. Lưu file, quay về website chọn file để xem trước rồi lưu danh sách. Tải mẫu không tạo tài khoản hoặc gửi thư.

Chỉ nhận đúng tên mẫu `.xlsm` hoặc bản `.xlsx` cũ cùng tên, tối đa 2 MB/1000 dòng. File tải trùng có hậu tố `(1)` cần đổi về đúng tên. Import chỉ đọc dữ liệu, không chạy VBA từ file người dùng. Lịch và điều khiển Enter dùng VBA cục bộ; Excel web/WPS không bảo đảm hỗ trợ.

`GET /api/admin/teachers/import-spec` trả tên file, tiền tố và số kế tiếp theo trường đã xác thực. `GET /api/admin/teachers/template` đính kèm binary VBA đã kiểm tra từ `backend/assets/excel-entry`, không tạo VBA từ nội dung người dùng. Điểm vào workbook/bảng web đã gỡ. API vẫn kiểm tra vai trò và trường, không dựa vào tên file để cấp quyền.
