# Mã học sinh và nhập danh sách theo trường

Yêu cầu 09/11/2026: học sinh dùng cùng bố cục và thao tác nhập như giáo viên, khác cấu trúc mã.

`HSGOT2615032013001` = `HS` (học sinh) + `GOT` (THCS Giồng Ông Tố) + `26` (năm nhập 2026 theo giờ Việt Nam) + `15032013` (ngày sinh 15/03/2013) + `001` (số thứ tự được cấp). Số thứ tự có ít nhất ba chữ số, không cắt khi vượt 999. Mã do máy chủ chốt trong giao dịch; xem trước hoặc tải Excel không giữ chỗ số. Nếu có người khác thêm tài khoản trong lúc nhập, kết quả lưu trả về mã chính thức.

Migration `057_school_student_identity_codes.sql` bổ sung bộ đếm và thông tin năm/STT cho học sinh. Dữ liệu có ngày sinh thật được cập nhật mã theo thông tin đã lưu; thiếu ngày sinh giữ mã cũ, không suy đoán ngày sinh. Giữ id, tên đăng nhập, mật khẩu, trường, lớp, tiến độ và lịch sử. Sửa ngày sinh cập nhật phần ngày sinh của mã, giữ năm và số đã cấp. Không sửa migration 056 của giáo viên.

## Nhập trực tiếp trong Excel Windows

Vào Học sinh → Nhập từ Excel → Tải file mẫu. Mở `file_mau_hoc-sinh_truong_giong-ong-to.xlsm` trong Microsoft Excel Windows. Bảy cột như giáo viên: STT, Mã học sinh, Họ tên, Giới tính, SĐT, Email, Ngày sinh. Họ tên/ngày sinh bắt buộc; email học sinh tùy chọn, có nhập thì phải đúng định dạng.

Bấm biểu tượng lịch bên phải ô ngày sinh hoặc bấm chính ô ngày sinh để chọn tháng/năm/ngày. Biểu tượng đi theo dòng đang nhập. Nhấn Enter ở ô ngày sinh để xác nhận dòng, sinh STT/mã rồi về Họ tên dòng tiếp theo. Sửa dữ liệu cần xác nhận lại. Không có dãy STT 1–1000 ở dòng trống. Lưu file và tải lên để xem trước, xác nhận nhập mới tạo tài khoản. Không còn bảng nhập trên website.

File `.xlsm` chứa macro cục bộ cho lịch và bàn phím, không gọi mạng. Chỉ cho phép nội dung của đúng mẫu đã tải nếu Excel yêu cầu; không tắt bảo vệ macro toàn cục. Excel web/WPS có thể không hỗ trợ chức năng này.

Chỉ nhận chính xác tên mẫu `.xlsm` hoặc bản `.xlsx` cũ cùng tên (tối đa 2 MB/1000 dòng). Hậu tố tải trùng `(1)` cần bỏ trước khi nhập. Tên file không thay kiểm tra quyền/trường. API chỉ đọc dữ liệu, không thực thi VBA tải lên; máy chủ chốt mã theo bộ đếm nên không tin mã người nhập tự sửa. Lớp/Email phụ huynh trong file cũ vẫn được đọc, giữ quy trình xếp lớp hiện có.

## API

- `GET /api/admin/students/import-spec`: quy tắc tên file, tiền tố và số tiếp theo theo trường đã xác thực.
- `GET /api/admin/students/template`: mẫu theo trường.
- `POST /api/admin/students/import`: xem trước/lưu danh sách với kiểm tra tên file và quyền trường.
- `GET /api/admin/registration-code/student`: xem trước mã khi có ngày sinh; số chính thức chỉ cấp khi lưu.

Kiểm tra bằng PostgreSQL tạm và dữ liệu giả: nâng 056→057, tạo đồng thời, bảo toàn mã giáo viên và dữ liệu học sinh, xác thực/RLS, mẫu/nhập/xuất Excel, công thức lưu lại bởi Excel; giao diện máy tính và điện thoại dùng API giả lập. Không tạo hoặc sửa tài khoản thật để kiểm thử production.
