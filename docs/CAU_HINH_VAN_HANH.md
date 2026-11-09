# Cấu hình vận hành nội bộ và hồ sơ cá nhân

Theo yêu cầu ngày 06/11/2026, cổng quản lý tổng không còn màn **Hệ thống** và các tab cấu hình chung, tính năng, mẫu thư, giới hạn trường, phân quyền, giám sát, sao lưu. Thành phần giao diện kỹ thuật đã được gỡ, gồm các ô trống và ghi chú triển khai. Không xóa các bảng đang phục vụ vận hành, phân quyền hoặc bảo vệ dữ liệu trường.

Menu quản lý tổng hiện có bảy mục nghiệp vụ: Trường học, Người dùng, Thống kê hệ thống, Thông báo, Nhật ký, Hướng dẫn và FAQ, Yêu cầu hỗ trợ.

## Tự nhận cấu hình

`SystemService.settings()` trả cấu hình có hiệu lực. Khi chưa có ghi đè đã lưu, máy chủ tự nhận:

| Nội dung | Nguồn nội bộ |
| --- | --- |
| Giới hạn theo IP | `RATE_IP_PER_MIN`, nếu chưa đặt dùng chính sách 600 yêu cầu/phút |
| Giới hạn theo tài khoản | `RATE_USER_PER_MIN`, nếu chưa đặt dùng 300 yêu cầu/phút |
| Giới hạn câu hỏi AI | `RATE_AI_PER_MIN`, nếu chưa đặt dùng 20 yêu cầu/phút |
| Địa chỉ gửi thư | Giá trị đã lưu hoặc `MAIL_FROM` của dịch vụ gửi thư được cấu hình trên máy chủ |
| Tên, logo, múi giờ | Thông tin đã lưu; logo trống dùng tài nguyên thương hiệu có sẵn ở frontend |
| Lịch sao lưu | Chính sách đã lưu trong `hk_system_settings`; khởi tạo là bật, giờ 02 theo múi giờ hệ thống và giữ 7 bản |

Giá trị tự nhận không bị ghi ngược thành ghi đè trong database khi sửa một thông tin khác. Khi thay cấu hình triển khai, những giá trị chưa có ghi đè tiếp tục nhận giá trị mới. Cấu hình hiện có được giữ nguyên, không đặt lại đồng loạt.

Các API bảo trì vẫn kiểm tra vai trò/cấp quản trị như trước; chúng không có màn điều khiển trong giao diện người dùng. Phân quyền tài khoản nghiệp vụ vẫn nằm trong mục Người dùng, RLS và giới hạn phạm vi trường vẫn được máy chủ kiểm tra.

## Tác vụ vận hành

`PlatformJob` lên lịch ở `onApplicationBootstrap`, sau khi migration/database khởi tạo xong. Mỗi phút xử lý lịch thông báo/khảo sát, mỗi 5 phút kiểm tra thông báo tự động, mỗi giờ kiểm tra sao lưu hằng ngày và dọn dữ liệu vận hành hết hạn. Sao lưu vẫn tuân theo giờ, múi giờ, giới hạn dung lượng và số bản giữ lại; không tạo một bản cho mỗi phút. Máy chủ dừng/ngủ thì lịch tạm dừng và được khởi tạo khi máy chủ hoạt động trở lại.

Kiểm thử khởi động Nest với database khởi tạo chậm xác nhận lịch vẫn được tạo, sao lưu được kiểm tra tự động và lịch dừng khi máy chủ đóng. `PLATFORM_JOB=off` giữ lịch tắt trong kiểm thử.

## Bảo mật trong Hồ sơ cá nhân

Quản lý tổng và quản trị trường mở **Hồ sơ cá nhân** để xem/cập nhật thông tin và dùng phần **Đăng nhập và bảo mật**. Menu Bảo mật riêng được gỡ. Xác thực bằng ứng dụng/email, xác nhận mã trước khi bật, mật khẩu + mã khi tắt, mã dự phòng và kiểm tra vai trò đều giữ nguyên. Cập nhật email trong hồ sơ sẽ tải lại trạng thái để lựa chọn nhận mã qua email phản ánh email đã lưu.

Không đưa phần 2FA của quản trị vào hồ sơ học sinh/giáo viên. `ProfileSheet` chỉ nhận nội dung bổ sung từ `AdminWorkspace`, không tự biết token hoặc cấp quyền.

Thay đổi này không sửa cấu trúc hay dữ liệu tham chiếu PostgreSQL, nên không tạo migration mới; schema hiện tại vẫn là 41.
