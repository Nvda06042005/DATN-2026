# Lịch Đông A trong Excel máy tính

Ngày 10/11/2026 người dùng chọn thay Vertex42 bằng lịch Đông A riêng: bấm tháng/năm để hiện danh sách, bỏ liên kết Vertex42 trong lịch, dòng hoàn tất chuyển sang Họ tên dòng tiếp. Mẫu giáo viên/học sinh vẫn là .xlsx không VBA/ActiveX; giữ công thức STT/mã và bộ đếm PostgreSQL. Không khôi phục bảng nhập web.

## Cài một lần trên Windows

Từ Giáo viên/Học sinh → Nhập từ Excel → **Cài lịch Đông A**, tải gói, giải nén rồi chạy `Install-DongACalendar.ps1`. Bộ cài kiểm tra manifest, chép vào `%LOCALAPPDATA%\DongAEdu\ExcelCalendar` và đăng ký đúng ID `bc75b058-92b8-4dd1-84fb-8792db3f7e72` cho người dùng hiện tại. Đây là bản triển khai riêng theo cơ chế register của công cụ Microsoft, chưa phải ứng dụng trên Marketplace. Không tự đóng Excel có dữ liệu chưa lưu.

Lưu công việc, đóng/mở lại Microsoft Excel, tải mẫu mới và chấp thuận quyền Lịch Đông A nếu Office hỏi. Không cần quyền quản trị Windows. `-Action Status` kiểm tra đăng ký; `-Action Uninstall` gỡ đúng giá trị của tiện ích, giữ workbook/dữ liệu. Không đổi chính sách PowerShell, macro, Protected View, thư mục tin cậy, TLS hoặc debugger. Nếu tổ chức chặn script/tiện ích, người quản lý Office phải triển khai manifest; không vượt chặn.

## Sử dụng

- Nhập Họ tên → Giới tính → SĐT → Email → Ngày sinh; có thể dùng Tab giữa các cột.
- Bấm **Tháng** để chọn một trong 12 tháng. Bấm **Năm** để chọn trong nhóm 12 năm; mũi tên đổi nhóm. Chọn năm mở danh sách tháng, rồi chọn ngày.
- Chỉ chấp nhận đúng tiêu đề A11:G11, ô công thức STT/mã, dòng 12–1011 và một ô trong C–G. Ngày ghi vào G cùng dòng; không ghi ô ngoài bảng đang chọn nhầm.
- Ghi ngày Excel dạng số và dd/mm/yyyy, tính lại công thức. Dòng đủ họ tên/ngày sinh (thêm email hợp lệ với giáo viên) chuyển sang C dòng kế. Không ghi đè STT/mã bằng JavaScript hoặc cấp số database khi nhập trong Excel.
- Khi lịch đang mở, sửa riêng ô G rồi Enter cũng xử lý qua onChanged của Excel. Không bắt phím Enter toàn ứng dụng. Đóng/chưa cài lịch thì Enter bình thường, công thức vẫn tính. Paste nhiều ô, thay đổi từ người cộng tác hoặc bảng khác không tự chuyển con trỏ.
- Không chuyển khi thiếu dữ liệu; dòng cuối không chọn ô ngoài mẫu. Ngày từ 01/01/1940 đến hôm nay theo giờ Việt Nam.

## Đóng gói và quyền

Giao diện tĩnh `frontend/public/office-calendar/` qua HTTPS website chính, Office.js Microsoft, ExcelApi 1.7. Không analytics, API tài khoản, token, localStorage hoặc gửi dữ liệu workbook lên server. Quyền ReadWriteDocument cần để đọc đúng mẫu, ghi ngày, tính lại và chọn ô; Office giữ xác nhận quyền.

`calendar-addin.ts` tham chiếu Content Web Extension Registry/developer theo mẫu Microsoft, ID manifest ổn định, ID instance riêng cho từng workbook. Lịch ở H1 cạnh bảng; fallback chỉ là hướng dẫn, không là ảnh lịch giả. Menu quản lý/bảo mật do Excel vẫn hiện. Mẫu Vertex42 cũ không tự đổi; tải mẫu mới và giữ dữ liệu đã nhập.

Build frontend tạo ZIP bằng `scripts/calendar-package.mjs`: manifest, script cài, hướng dẫn. Không nhúng JavaScript vào .xlsx. Import không chạy tiện ích/macro được tải lên. Không có migration Supabase mới.

## Nguồn và xác minh

- [Microsoft: manifest Content Add-in](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/xml-manifest-overview).
- [Mẫu Content Add-in của Microsoft](https://github.com/OfficeDev/Office-Addin-Scripts/blob/master/packages/office-addin-dev-settings/templates/ExcelWorkbookWithContent.xlsx).
- [Microsoft: đăng ký trên Windows](https://github.com/OfficeDev/Office-Addin-Scripts/blob/master/packages/office-addin-dev-settings/src/dev-settings-windows.ts).
- [Microsoft: sự kiện thay đổi worksheet](https://learn.microsoft.com/en-us/javascript/api/excel/excel.worksheetchangedeventargs).

Kiểm thử quy tắc ngày/mẫu, mock Excel API, Open XML và giao diện trình duyệt không thay cho chạy Excel thật. Kết nối điều khiển Windows trước đó báo native pipe is unavailable; chỉ ghi nhận đã cài/chạy/kiểm tra Excel khi có bằng chứng tương ứng.
