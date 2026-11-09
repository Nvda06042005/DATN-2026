# Mã học sinh và nhập danh sách theo trường

Yêu cầu 09/11/2026: học sinh dùng cùng bố cục và thao tác nhập như giáo viên, khác cấu trúc mã.

`HSGOT2615032013001` = `HS` (học sinh) + `GOT` (THCS Giồng Ông Tố) + `26` (năm nhập 2026 theo giờ Việt Nam) + `15032013` (ngày sinh 15/03/2013) + `001` (số thứ tự được cấp). Số thứ tự có ít nhất ba chữ số, không cắt khi vượt 999. Mã do máy chủ chốt trong giao dịch; xem trước hoặc tải Excel không giữ chỗ số. Nếu có người khác thêm tài khoản trong lúc nhập, kết quả lưu trả về mã chính thức.

Migration `057_school_student_identity_codes.sql` bổ sung bộ đếm và thông tin năm/STT cho học sinh. Dữ liệu có ngày sinh thật được cập nhật mã theo thông tin đã lưu; thiếu ngày sinh giữ mã cũ, không suy đoán ngày sinh. Giữ id, tên đăng nhập, mật khẩu, trường, lớp, tiến độ và lịch sử. Sửa ngày sinh cập nhật phần ngày sinh của mã, giữ năm và số đã cấp. Không sửa migration 056 của giáo viên.

## Nhập trên website rồi tải Excel

Vào **Học sinh → Nhập từ Excel → Nhập trên bảng**. Bảng có bảy cột như giáo viên: Số thứ tự, Mã học sinh, Họ và tên, Giới tính, SĐT, Email, Ngày tháng năm sinh. Họ tên và ngày sinh bắt buộc; email học sinh vẫn không bắt buộc, nếu nhập thì phải đúng định dạng.

Chọn ngày sinh bằng lịch của trình duyệt, nhấn Enter tại ô ngày sinh để xác nhận dòng. Sau đó STT/mã xuất hiện và con trỏ chuyển sang Họ và tên dòng tiếp theo. Sửa thông tin cần xác nhận lại. Điện thoại có nút Xác nhận dòng tương đương Enter. Không đánh sẵn STT từ 1 đến 1000. Dòng trống cuối không được xuất; dòng có dữ liệu nhưng chưa xác nhận bị chặn tải.

Chọn **Tải Excel → Quay lại → Chọn file** để xem trước, rồi xác nhận nhập mới tạo tài khoản. Lịch và thao tác chuyển ô bằng Enter nằm trên bảng web theo lựa chọn giữ `.xlsx`; file không chứa VBA hay lịch tùy chỉnh cho WPS.

Tên file luôn lấy từ tên trường hiện tại, ví dụ `file_mau_hoc-sinh_truong_giong-ong-to.xlsx`. Cả website và API kiểm tra chính xác tên file của trường ở bước xem trước và lưu; bản tải trùng có hậu tố `(1)` cần đổi về đúng tên. Tên file không thay thế kiểm tra quyền và phạm vi trường. Giới hạn vẫn là 2 MB, tối đa 1000 dòng.

Lớp và email phụ huynh trong file cũ vẫn được đọc khi có; không đưa vào bảy cột của mẫu mới. Xếp lớp thực hiện ở mục Lớp học. Đối với file Excel có công thức, máy chủ chỉ đọc các mẫu công thức do hệ thống sinh, không thực thi công thức tùy ý và không tin mã người tải lên tự sửa.

## API

- `GET /api/admin/students/import-spec`: quy tắc tên file, tiền tố và số tiếp theo theo trường đã xác thực.
- `GET /api/admin/students/template`: mẫu theo trường.
- `POST /api/admin/students/workbook`: tạo file từ bảng nhập, không tạo tài khoản, không gửi thư, không cấp số.
- `POST /api/admin/students/import`: xem trước/lưu danh sách với kiểm tra tên file và quyền trường.
- `GET /api/admin/registration-code/student`: xem trước mã khi có ngày sinh; số chính thức chỉ cấp khi lưu.

Kiểm tra bằng PostgreSQL tạm và dữ liệu giả: nâng 056→057, tạo đồng thời, bảo toàn mã giáo viên và dữ liệu học sinh, xác thực/RLS, mẫu/nhập/xuất Excel, công thức lưu lại bởi Excel; giao diện máy tính và điện thoại dùng API giả lập. Không tạo hoặc sửa tài khoản thật để kiểm thử production.
