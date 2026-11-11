# Lịch chọn ngày trong Excel máy tính

Người dùng đồng ý dùng **Mini Calendar and Date Picker của Vertex42** ngày 10/11/2026 sau khi biết quyền đọc/sửa workbook và kết nối Internet. Mẫu giáo viên và học sinh vẫn là .xlsx, không có VBA/ActiveX. STT và mã giữ công thức, không đánh sẵn ở dòng trống; bộ đếm chính thức trong PostgreSQL không đổi.

## Cách dùng

1. Tải lại mẫu mới từ Giáo viên/Học sinh → Nhập từ Excel → Tải file mẫu.
2. Mở bằng Microsoft Excel trên máy tính có Internet. Excel giữ quy trình xác nhận tiện ích thông thường; người dùng tự kiểm tra và chấp thuận Vertex42 nếu được hỏi. Không tắt bảo vệ Office hoặc thêm thư mục tin cậy.
3. Chọn ô ngày sinh cột G (G12 cho dòng đầu), rồi chọn ngày trên lịch nổi bên phải bảng. Tiện ích ghi ngày vào ô đang chọn, hiển thị dd/mm/yyyy. Bấm ô của dòng kế rồi chọn ngày tiếp theo. Lịch là đối tượng trên sheet, không tự hiện dưới từng ô như date input của trình duyệt.
4. Điền đủ họ tên/ngày sinh (và email với giáo viên), lưu ô để công thức tự tính STT/mã. Enter giữ hành vi bình thường của Excel, không tự chuyển về cột Họ tên.
5. Lưu đúng tên .xlsx rồi nhập lên Đông A để xem trước và xác nhận. Nếu lịch không hiện, vào Home → Add-ins → More Add-ins, tìm đúng tên và nhà phát hành Vertex42. Nếu tổ chức chặn Office Add-ins, liên hệ người quản lý Office; không vượt chặn.

## Cách đóng gói

`calendar-addin.ts` thêm **tham chiếu chính thức Office Store** `wa102957665`, catalog OMEX/en-US, vào Content Web Extension của workbook. Mỗi file có GUID riêng; không có token, cache trạng thái người dùng, mã JS/HTML của bên thứ ba hoặc snapshot lịch giả. Không sao chép nội dung/ảnh/VBA của workbook mẫu Vertex42. Backend không liên lạc Vertex42 khi tạo file; Excel mới tải tiện ích theo quyền người dùng cho phép.

Lịch đặt H1 cạnh bảy cột, không đè ô dữ liệu hoặc logo. Mẫu có/không logo đều có relationship DrawingML hợp lệ. Công thức, giá trị, định dạng, validation và tiêu đề import được giữ nguyên. Import không chạy tiện ích hoặc VBA do người dùng tải lên; vẫn kiểm tra quyền trường và chỉ nhận tên file đúng. Đây là thay đổi file Excel, không có migration Supabase mới.

## Nguồn

- [Microsoft hướng dẫn dùng tiện ích lịch trên Excel 64-bit](https://learn.microsoft.com/en-us/answers/questions/5418759/how-to-insert-a-date-picker).
- [Office Store: tiện ích, nhà phát hành và quyền](https://marketplace.microsoft.com/en-us/product/WA102957665).
- [Vertex42: lịch nhúng và chọn ngày vào ô hiện tại](https://www.vertex42.com/apps/minicalendar.html). Đã đối chiếu tham chiếu/relationship trong file mẫu công khai của nhà phát hành; không dùng file mẫu đó làm nền cho dữ liệu Đông A.
- [MS-OWEXML: Content Web Extension](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-owexml/d59d5543-252a-47dd-a566-1503dbf6a233).

## Giới hạn xác minh

Kết nối Windows Computer Use hiện báo `Computer Use native pipe is unavailable`; không có phiên Excel qua connector. Có thể kiểm tra cấu trúc Open XML, công thức và nhập lại file nhưng chưa xác nhận bằng thao tác lịch trực tiếp trong phiên Excel người dùng. Không ghi nhận đã cài/đã chấp thuận tiện ích trên máy khi chưa quan sát được.

## Ô ngày sinh (cập nhật 11/11/2026)

Ô ngày sinh của mẫu trống là ô chữ để Excel giữ nguyên ngày gõ `dd/mm/yyyy` trên mọi cài đặt vùng của Windows (máy kiểu Mỹ không còn báo lỗi hay đảo ngày/tháng). Ngày dạng số trong ô (ví dụ do lịch ghi vào) vẫn hợp lệ và hiện `dd/mm/yyyy` nhờ định dạng có điều kiện; khi nhập file, máy chủ đọc được cả hai dạng. Chi tiết trong `docs/TIEN_DO_HAO_KHI.md`.
