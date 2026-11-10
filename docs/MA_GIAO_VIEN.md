# Mã giáo viên theo trường

Yêu cầu 09/11/2026: cùng quy tắc cho form Thêm/Sửa, Excel và danh sách giáo viên.

`GOT2615031985001` = `GOT` (THCS Giồng Ông Tố) + `26` (năm nhập 2026, giờ Việt Nam) + `15031985` (ngày sinh 15/03/1985) + `001` (STT trong trường). Tên trường khác dùng viết tắt của chính trường đó, bỏ tiền tố cấp học và dấu tiếng Việt. STT tối thiểu ba chữ số, không cắt mất số khi vượt 999.

Migration `056_school_teacher_identity_codes.sql` lưu STT/năm trên tài khoản và bộ đếm riêng mỗi trường (`app_teacher_code_counters`, có RLS). Trigger PostgreSQL cấp số trong giao dịch; tạo đồng thời không trùng số, xóa giáo viên không lùi bộ đếm. Xem trước không giữ chỗ; kết quả lưu là mã chính thức. Giữ các bộ sinh HS/LH hiện có.

**Tài khoản đã có:** theo yêu cầu cập nhật lại danh sách, migration đánh STT theo thời điểm tạo/id, lấy năm từ `created_at` và ngày sinh đã lưu rồi đổi `user_code`. Không đổi id, username, mật khẩu, phiên, trường, lớp hoặc dữ liệu nghiệp vụ. Tài khoản thiếu ngày sinh giữ mã đang có; Thêm/Sửa trên web yêu cầu ngày sinh, bổ sung sẽ sinh mã đúng. Khi sửa ngày sinh, phần ngày sinh trong mã được cập nhật; năm/STT giữ nguyên. Tên đăng nhập vẫn dùng được.

**Excel:** giữ ví dụ riêng; theo yêu cầu mới, STT/mã ở dòng trống đều trống và chỉ hiện khi đủ họ tên, email, ngày sinh. STT liên tiếp qua dòng trống, không đánh sẵn 1–1000. Mẫu tải mới tiếp nối bộ đếm của trường; cột mã tự hiện khi có họ tên và ngày sinh kiểu ngày, chuỗi `dd/mm/yyyy` hoặc ISO. Không dùng DATEVALUE phụ thuộc locale. Import chỉ nhận đúng công thức do mẫu tạo; máy chủ tự tính lại mã theo trường/ngày sinh/năm nhập, không tin tiền tố do người tải lên sửa. Mẫu cũ vẫn đọc được; nếu có người khác thêm tài khoản kể từ lúc tải file, hệ thống chốt lại số khi lưu và trả mã thật trong kết quả. File cũ thiếu ngày sinh vẫn tương thích; không tự đặt một ngày sinh giả.

Kiểm thử: API với PostgreSQL tạm (tiền tố có dấu, ngày không hợp lệ, xem trước, tạo đồng thời, sửa/lấy danh sách, RLS và truy cập chéo trường); nâng 055→056 với dữ liệu fixture; hồi quy nhập/xuất Excel và kiểm tra công thức bằng phiên bảng tính riêng. Không tạo/sửa tài khoản thật để kiểm thử production.

## Mẫu Excel không macro (cập nhật 10/11/2026)

Yêu cầu mới nhất ngày 10/11/2026 bỏ phụ thuộc macro. Vào Giáo viên → Nhập từ Excel → Tải file mẫu. File tải là `file_mau_giao-vien_truong_giong-ong-to.xlsx` (tên trường thay tự động), không có VBA/ActiveX, không cần bật macro.

Điền Họ tên, Giới tính, SĐT, Email và Ngày sinh. Khi đủ họ tên, email, ngày sinh rồi nhấn Enter lưu ô, công thức hiện STT/mã. Dòng trống/chưa đủ dữ liệu vẫn trống, không có dãy 1–1000. Nếu Excel đang tính thủ công, chọn Formulas → Calculation Options → Automatic. Enter di chuyển theo cài đặt Excel, không tự về cột Họ tên dòng tiếp theo. Lưu file, quay về website chọn file để xem trước rồi lưu danh sách. Tải mẫu không tạo tài khoản hoặc gửi thư.

Theo lựa chọn mới nhất ngày 10/11, dùng **Lịch Đông A riêng**, cài một lần trong Microsoft Excel Windows từ nút Cài lịch Đông A. Bấm tháng/năm để chọn nhanh, chọn ngày ghi cột G; dòng đủ dữ liệu tính STT/mã rồi chọn Họ tên dòng tiếp. Mẫu mới không còn Vertex42. Giữ xác nhận quyền Office, không tắt bảo vệ. Chi tiết: [Lịch Excel](LICH_EXCEL.md).

Chỉ nhận đúng tên mẫu `.xlsx` hoặc bản `.xlsm` cũ cùng tên, tối đa 2 MB/1000 dòng. File tải trùng có hậu tố `(1)` cần đổi về đúng tên. Import chỉ đọc dữ liệu, không chạy VBA từ file người dùng. `GET /api/admin/teachers/import-spec` trả tên file, tiền tố và số kế tiếp theo trường đã xác thực. `GET /api/admin/teachers/template` trả .xlsx với công thức, không nhúng binary VBA. Điểm vào workbook/bảng web đã gỡ. API vẫn kiểm tra vai trò và trường, không dựa vào tên file để cấp quyền.
