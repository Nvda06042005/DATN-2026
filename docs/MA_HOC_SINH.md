# Mã học sinh và nhập danh sách theo trường

Yêu cầu 09/11/2026: học sinh dùng cùng bố cục và thao tác nhập như giáo viên, khác cấu trúc mã.

`HSGOT2615032013001` = `HS` (học sinh) + `GOT` (THCS Giồng Ông Tố) + `26` (năm nhập 2026 theo giờ Việt Nam) + `15032013` (ngày sinh 15/03/2013) + `001` (số thứ tự được cấp). Số thứ tự có ít nhất ba chữ số, không cắt khi vượt 999. Mã do máy chủ chốt trong giao dịch; xem trước hoặc tải Excel không giữ chỗ số. Nếu có người khác thêm tài khoản trong lúc nhập, kết quả lưu trả về mã chính thức.

Migration `057_school_student_identity_codes.sql` bổ sung bộ đếm và thông tin năm/STT cho học sinh. Dữ liệu có ngày sinh thật được cập nhật mã theo thông tin đã lưu; thiếu ngày sinh giữ mã cũ, không suy đoán ngày sinh. Giữ id, tên đăng nhập, mật khẩu, trường, lớp, tiến độ và lịch sử. Sửa ngày sinh cập nhật phần ngày sinh của mã, giữ năm và số đã cấp. Không sửa migration 056 của giáo viên.

## Mẫu Excel không macro (cập nhật 10/11/2026)

Vào Học sinh → Nhập từ Excel → Tải file mẫu. File mới là `file_mau_hoc-sinh_truong_giong-ong-to.xlsx`, không có VBA/ActiveX và không cần bật macro. Bảy cột như giáo viên: STT, Mã học sinh, Họ tên, Giới tính, SĐT, Email, Ngày sinh. Họ tên/ngày sinh bắt buộc; email học sinh tùy chọn, có nhập thì phải đúng định dạng.

Nhập đủ họ tên và ngày sinh rồi nhấn Enter để lưu ô: công thức tự tính STT/mã, không phụ thuộc macro. Dòng trống hoặc thiếu dữ liệu không hiện STT/mã; không đánh sẵn 1–1000. STT đếm liên tiếp qua dòng trống. Đổi ngày sinh cập nhật phần ngày trong mã. Nếu Excel đang tính thủ công, chọn Formulas → Calculation Options → Automatic. Lưu file và tải lên để xem trước; xác nhận nhập mới tạo tài khoản. Không khôi phục bảng nhập trên website.

Theo lựa chọn mới nhất ngày 10/11, dùng **Lịch Đông A riêng**, cài một lần trong Microsoft Excel Windows từ nút Cài lịch Đông A. Bấm tháng/năm để chọn nhanh, chọn ngày ghi cột G; dòng đủ họ tên/ngày sinh tính STT/mã rồi chọn Họ tên dòng tiếp. Email học sinh vẫn tùy chọn. Mẫu mới không còn Vertex42. Chi tiết: [Lịch Excel](LICH_EXCEL.md).

Enter di chuyển theo cài đặt Excel; file không macro không chặn phím để tự nhảy từ ngày sinh về Họ tên dòng kế. Chỉ nhận chính xác tên mẫu `.xlsx` hoặc bản `.xlsm` cũ cùng tên (tối đa 2 MB/1000 dòng). Hậu tố tải trùng `(1)` cần bỏ trước khi nhập. Tên file không thay kiểm tra quyền/trường. API chỉ đọc dữ liệu, không thực thi VBA tải lên; máy chủ chốt mã theo bộ đếm nên không tin mã người nhập tự sửa. Lớp/Email phụ huynh trong file cũ vẫn được đọc, giữ quy trình xếp lớp hiện có.

## API

- `GET /api/admin/students/import-spec`: quy tắc tên file, tiền tố và số tiếp theo theo trường đã xác thực.
- `GET /api/admin/students/template`: mẫu theo trường.
- `POST /api/admin/students/import`: xem trước/lưu danh sách với kiểm tra tên file và quyền trường.
- `GET /api/admin/registration-code/student`: xem trước mã khi có ngày sinh; số chính thức chỉ cấp khi lưu.

Kiểm tra bằng PostgreSQL tạm và dữ liệu giả: nâng 056→057, tạo đồng thời, bảo toàn mã giáo viên và dữ liệu học sinh, xác thực/RLS, mẫu/nhập/xuất Excel, công thức lưu lại bởi Excel; giao diện máy tính và điện thoại dùng API giả lập. Không tạo hoặc sửa tài khoản thật để kiểm thử production.
