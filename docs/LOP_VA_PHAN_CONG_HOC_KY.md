# Mã định danh và phân công lớp theo học kỳ

Migration 053 giữ một lớp xuyên suốt năm học. Form Tạo lớp có Mã lớp (chỉ đọc), Tên lớp, Khối, Học kỳ, Giáo viên phụ trách lớp, Sĩ số dự kiến và Mô tả. Một giáo viên có thể phụ trách nhiều lớp; khóa chính `(class_id,semester)` bảo đảm mỗi học kỳ có tối đa một giáo viên. Có thể để chưa phân công để nhà trường bổ sung sau.

Học kỳ 1/2 dùng ngày đã lưu của năm học tại Trường và năm học, cùng khung năm học của migration 051; không tạo lịch riêng cho lớp. Khi tới ngày bắt đầu học kỳ 2, view `app_current_class_teachers` chuyển quyền theo phân công học kỳ 2 ngay khi truy vấn. Năm chưa có lịch dùng học kỳ 1 cho đến khi nhà trường có lịch. Các API lớp, học sinh thuộc lớp, báo cáo, AI, hành trình, thi đấu và thông báo đọc phân công đang có hiệu lực; không cấp quyền giáo viên mới bằng cách thêm một vai trò chung.

Sửa lớp cho chọn học kỳ cần cập nhật. Chọn học kỳ khác sẽ nạp đúng giáo viên đã phân công của học kỳ đó. Phân công ở học kỳ chưa có hiệu lực có thể đổi với xác nhận `confirm_reassignment`. Trong học kỳ đang có hiệu lực của năm học hoạt động, không đổi/gỡ trực tiếp: giáo viên A đang phụ trách mở lớp → Đề nghị đổi giáo viên → chọn giáo viên B cùng trường → Gửi đề nghị. A giữ nguyên quyền, B chưa có quyền cho tới khi quản trị trường duyệt ở Lớp học → Đề nghị đổi giáo viên. Sau khi duyệt, A hết quyền phụ trách ở học kỳ đó, B có quyền ngay; dữ liệu lớp và học kỳ khác được giữ nguyên. Có thể từ chối, người gửi có thể hủy đề nghị đang chờ. Không liệt kê lý do cá nhân.

Migration 055 lưu `app_class_teacher_change_requests` với RLS theo trường, chỉ một đề nghị đang chờ cho lớp/học kỳ. API chỉ nhận đề nghị từ giáo viên đang phụ trách; giáo viên tiếp nhận phải đang hoạt động và đúng trường. Duyệt khóa lớp và đề nghị, kiểm tra lại phân công, học kỳ, năm học, trạng thái giáo viên; không duyệt lặp hoặc đề nghị đã lỗi thời. Phân công, quyết định, nhật ký và thông báo trong ứng dụng cùng giao dịch; lỗi ghi thì hoàn tác. Thông báo gửi quản trị trường khi có đề nghị, gửi hai giáo viên khi có quyết định. Năm đã kết thúc vẫn chỉ xem. Bảng mới được đăng ký kho xóa một năm.

## Mã tự sinh

- Giáo viên: `GV00000001`, học sinh: `HS00000001`, lớp: `LH00000001`.
- Ba sequence PostgreSQL độc lập, không dùng số lượng dòng hoặc giá trị từ trình duyệt. Preview không cấp số/giữ chỗ; nếu có người tạo đồng thời, kết quả lưu trả mã chính thức mới nhất. Xóa không tái sử dụng mã. Sequence có thể có khoảng trống khi giao dịch hoàn tác.
- Giữ mọi `user_code` đã nhập; chỉ bổ sung mã còn trống. Nhập Excel có thể để trống mã để tự cấp; vẫn nhận mã cũ, kiểm tra trùng theo trường như trước. Form thêm từng người chỉ xem mã tự sinh.
- `app_classes.registration_code` là mã định danh ổn định mới, khác `class_code` cũ theo tên và mã tham gia ngẫu nhiên 6 ký tự `join_code`. Đổi tên hoặc làm mới mã tham gia không đổi mã định danh.

## Nâng cấp và quyền dữ liệu

Giữ bảng `app_class_teachers` cũ để không mất phân công trước đây. Lớp cũ có đúng một giáo viên hợp lệ được chép sang cả hai học kỳ, giữ quyền hiện có cho đến khi trường phân công lại. Lớp cũ có nhiều giáo viên không tự chọn người thay nhà trường: học kỳ đang hoạt động cần giáo viên gửi đề nghị và quản trị trường duyệt; học kỳ chưa diễn ra có thể phân công trực tiếp. Quyền cũ được giữ tới lần phân công đầu tiên. Lần đó chuyển lớp sang hai ô học kỳ, học kỳ chưa chọn để trống. Không xóa dòng phân công cũ.

`app_class_term_teachers` có RLS theo trường, FK ghép lớp/trường và trigger kiểm tra giáo viên đúng vai trò/trường. Hai view dùng `security_invoker`; thu hồi quyền công khai và các vai trò API Supabase. Thay đổi mã/phân công không bỏ kiểm tra tài khoản đang hoạt động hoặc phạm vi trường. Hàm cấp mã chỉ cho backend và vai trò RLS nội bộ, endpoint preview yêu cầu quản trị. Bảng mới đã đăng ký vào kho dữ liệu xóa một năm. Xóa tài khoản giáo viên giữ lớp, xóa liên kết và đưa liên kết đã xóa vào kho.

Kiểm thử PostgreSQL tạm: preview không cấp số, tạo đồng thời, phân công hai học kỳ, đổi giáo viên cần xác nhận, chuyển quyền theo ngày, chặn trường khác, mã không đổi khi sửa tên, giữ dữ liệu khi nâng từ 052, RLS và kho xóa. Kiểm tra web bằng dữ liệu/API giả lập ở 1440px và 390px; không tạo hay xóa dữ liệu thật trên production.
