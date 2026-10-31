# Tiến độ xây dựng Hào Khí Đông A (theo mã HK.*)

Nguồn: `fuction list/HaoKhiDongA_DanhSachChucNang_ver0.1 (1).xlsx` (348 chức năng, 12 sprint). Tài liệu này ghi **Sprint 1 và Sprint 2**
(85 chức năng) đã làm được gì, quyết định đã chọn khi đặc tả chưa nói rõ, và những gì cố ý chưa làm. Phân tích đối chiếu ban đầu: `DOI_CHIEU_HAO_KHI_V01.md`.

Kiểm thử: `cd backend && npm run build && npm test` (PostgreSQL tạm, HTTP thật; 73 bài, gồm migration trên dữ liệu cũ, Sprint 1, quản trị trường, kho lịch sử);
`cd frontend && npm run typecheck && npm run build`. Mỗi bài kiểm thử ghi mã HK.* trong tên.

## Sprint 1 – xác thực, tài khoản, hồ sơ, trường học, người dùng (40 chức năng)

| Mã | Trạng thái | Ghi chú |
| --- | --- | --- |
| HK.HS.001, HK.GV.001, HK.QT.001, HK.AD.001 | Xong | Đăng nhập bằng tên đăng nhập, email hoặc mã học sinh; 5 lần sai khóa 15 phút **theo tài khoản** (đổi qua lại tên/email/mã không né được); mỗi vai trò một cổng (`/hoc-sinh`, `/giao-vien`, `/school-manager-admin`, `/admin`, `/portal` chung cho giáo viên và học sinh) |
| HK.HS.002 | Xong, **cần cấu hình** | Máy chủ kiểm tra mã Google qua `oauth2.googleapis.com/tokeninfo`, chỉ học sinh và chỉ khi email trùng đúng một tài khoản. Cần `GOOGLE_CLIENT_ID` (backend) và `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (frontend); chưa có thì nút ẩn. Kiểm thử dùng bản giả lập, chưa thử với Google thật |
| HK.HS.003 | Xong | Đăng ký tự học bằng email + OTP 5 phút; tài khoản không thuộc trường, không vào lớp được (trả lời rõ ràng). Đặc tả ghi "cân nhắc bỏ" nhưng ma trận phân quyền cho phép nên đã làm |
| HK.HS.004 | Xong | Mật khẩu tạm chặn mọi route trừ đổi mật khẩu / hồ sơ / đăng xuất; sau đó học sinh xác nhận hồ sơ (họ tên, mã, ngày sinh, trường, lớp, email) |
| HK.HS.005, HK.GV.002, HK.QT.002 | Xong | Quên mật khẩu bằng OTP 6 số, 5 phút, dùng một lần, sai 5 lần thì vô hiệu; luôn trả lời giống nhau để không lộ tài khoản; cần cấu hình gửi thư |
| HK.HS.006/007, HK.GV.003/004, HK.QT.003/004, HK.AD.003/004 | Xong | Đổi mật khẩu (tối thiểu 8 ký tự, có chữ và số, phải khác mật khẩu cũ) làm token cũ hết hiệu lực; đăng xuất thu hồi đúng phiên đó |
| HK.HS.008 | Xong | Mã lớp 6 ký tự (không có I, O, 0, 1), không mật khẩu; học sinh thuộc nhiều lớp; mã của trường khác trả như mã sai; lớp lưu trữ, tắt tự tham gia, năm học đã kết thúc đều từ chối |
| HK.HS.009/010, HK.GV.005/006, HK.QT.005, HK.AD.005 | Xong | Mỗi vai trò chỉ tự sửa trường được phép (học sinh: biệt danh, ảnh, giới thiệu; giáo viên: điện thoại, ảnh, giới thiệu; quản trị: họ tên, email, điện thoại, ảnh). **Ảnh đại diện chỉ nhận liên kết https**, chưa tải tệp lên |
| HK.AD.011–016 | Xong | Danh sách/lọc trường; thêm trường **kèm quản trị viên đầu tiên và thư mật khẩu tạm**; sửa (có logo https); vô hiệu hóa thu hồi mọi phiên của trường; xóa chỉ khi trường chưa có dữ liệu |
| HK.AD.018–025 | Xong | Danh sách/lọc người dùng; tạo quản trị tổng cấp 1/2 và quản trị viên trường; sửa; đổi vai trò; khóa **bắt buộc ghi lý do** (hiện lý do khi họ đăng nhập); đặt lại mật khẩu; xóa chỉ khi chưa phát sinh dữ liệu |
| HK.SYS.015 | Xong | JWT + vai trò kiểm tra ở mọi route; quản trị trường chạy trong Row-Level Security của trường mình (kiểm thử truy vấn thiếu `WHERE school_id`); nhật ký thao tác không ghi mật khẩu |

## Sprint 2 – trường, năm học, giáo viên, học sinh, lớp, kho dữ liệu lịch sử (45 chức năng)

| Mã | Trạng thái | Ghi chú |
| --- | --- | --- |
| HK.QT.010/011 | Xong | Xem và sửa tên hiển thị, logo, địa chỉ, liên hệ; không tự đổi mã trường hay vô hiệu hóa |
| HK.QT.012 | Xong | Năm học là bảng riêng; mỗi trường một năm đang hoạt động; kích hoạt, kết thúc; **năm đã kết thúc không sửa được** lớp, học sinh trong lớp, khối |
| HK.QT.013 | Xong | Thêm/bật/tắt/xóa khối 6–9 theo năm học; không tắt/xóa khối còn lớp; năm mới chép khối từ năm trước |
| HK.QT.014–016, 018–021, 023 | Xong | Giáo viên: thêm (email bắt buộc), tìm/lọc (tên, email, bộ môn, trạng thái), sửa, khóa/mở khóa, đặt lại mật khẩu, xóa khi chưa có dữ liệu, xuất Excel |
| HK.QT.017 | Xong | Nhập Excel có **xem trước** báo lỗi từng dòng (trùng email trong file và trong hệ thống, thiếu dữ liệu, sai định dạng) rồi lưu các dòng hợp lệ; trả mật khẩu tạm một lần và tải CSV |
| HK.QT.022 | Xong | Một lớp nhiều giáo viên (`app_class_teachers`); cột `teacher_id` cũ chỉ còn để đọc dữ liệu trước đây |
| HK.QT.024–028, 030–032, 034 | Xong | Học sinh: thêm (mã, ngày sinh, giới tính, lớp), tìm/lọc (tên, mã, khối, lớp, trạng thái), sửa, nhập Excel có xem trước (kể cả cột Lớp), khóa, đặt lại mật khẩu, xóa, xuất Excel. Mã học sinh duy nhất trong trường, được phép trùng giữa các trường (nên đăng nhập bằng mã chỉ dùng được khi mã là duy nhất toàn hệ thống; luôn dùng được tên đăng nhập hoặc email) |
| HK.QT.029 | Xong | Chuyển lớp **cùng khối và cùng năm học**; dữ liệu học giữ nguyên (lên lớp dùng nhân bản lớp) |
| HK.QT.035–038 | Xong | Danh sách lớp (lọc năm, khối, giáo viên, từ khóa), tạo (khối phải đang bật, tên không trùng trong năm), sửa, lưu trữ/khôi phục, xóa **chỉ khi lớp chưa có học sinh** |
| HK.QT.039 | Xong | Xếp nhiều học sinh vào lớp (chọn hoặc Excel có xem trước), gỡ khỏi lớp |
| HK.QT.040 | Xong | Nhân bản lớp sang năm học mới: khối + 1, học sinh và giáo viên được chọn; lớp khối 9, lớp trùng tên, khối chưa bật được bỏ qua kèm lý do |
| HK.AD.028–031 | Xong | Cuộc kháng chiến, nhân vật (vua, tướng lĩnh, quan lại, khác), tìm/lọc, thêm |
| HK.AD.032/033 | Xong | Sửa lưu phiên bản; không xóa khi còn liên kết hoặc đang công bố |
| HK.AD.034–036, 038, 039 | Xong | Sự kiện, địa điểm (tên gọi xưa – nay, **chọn tọa độ trên bản đồ**, bản web), trận đánh (nối sự kiện, địa điểm, nhân vật, mã mini-game), tư liệu gốc, thuật ngữ |
| HK.AD.037 | Một phần | Xem dòng thời gian theo cuộc kháng chiến và đổi thứ tự **bằng nút mũi tên**, chưa kéo thả; mỗi lần đổi lưu một phiên bản |
| HK.AD.038 (tệp đính kèm) | Một phần | Tư liệu nhận **liên kết https** tới ảnh/PDF, chưa tải tệp lên (cần kho lưu trữ tệp) |
| HK.AD.040 | Xong | Nháp → Đã kiểm chứng → Công bố: không nhảy cấp; công bố phải sau khi cha (cuộc kháng chiến, địa điểm, sự kiện) đã công bố; **sửa nội dung bản ghi đã kiểm chứng/công bố đưa nó về Nháp**; ghi người và thời điểm |
| HK.AD.041 | Xong | Xuất JSON và Excel; nhập JSON/Excel có xem trước; mọi bản ghi nhập vào ở trạng thái Nháp |
| HK.AD.042 | Xong | Danh sách phiên bản, so sánh hai phiên bản (kể cả liên kết), khôi phục (về Nháp) |

Dữ liệu khởi tạo (migration 016): 3 cuộc kháng chiến, 17 nhân vật, 12 địa điểm, 11 sự kiện, 6 trận đánh, 2 tư liệu, 8 thuật ngữ, lấy từ nội dung đã có trong dự án.
**Tất cả ở trạng thái Nháp** vì chưa ai kiểm chứng với sách giáo khoa; không ghi số quân của kháng chiến lần hai và ba (các nguồn chưa thống nhất);
chỉ 2 địa điểm (Thăng Long, Vân Đồn) có tọa độ vì vị trí hiện nay không tranh cãi, còn lại để quản trị tổng chọn trên bản đồ.

## Quyết định khi đặc tả chưa nói rõ

- **Quản trị tổng cấp 2 (HK.AD.020):** có cột `admin_level`. Cấp 2 quản lý quản trị viên trường học nhưng không tạo/sửa/khóa/xóa quản trị tổng, không tạo hay xóa trường. Ma trận RBAC thực sự (HK.AD.026) thuộc Sprint 11.
- **"Chưa phát sinh dữ liệu" (HK.AD.016/025, HK.QT.021/032):** tài khoản đã đăng nhập, có tiến độ học, có thao tác trong nhật ký, hoặc giáo viên đang được phân công lớp thì chỉ khóa được. Trường đã có lớp, giáo viên/học sinh, hoặc quản trị viên đã dùng hệ thống thì chỉ vô hiệu hóa được. Thay cho thùng rác 45 ngày của bản cũ.
- **Mật khẩu tạm:** sinh ngẫu nhiên, hiện một lần cho người tạo và gửi qua hàng đợi email (bcrypt cost 8 cho lô lớn); thư bị hủy nếu người dùng đã đổi mật khẩu.
- **Mật khẩu lớp cũ (migration 012):** thay bằng mã tham gia; cột `join_password_hash` còn trong CSDL nhưng không dùng nữa.
- **Cột lớp học sinh `class_name` và giáo viên `teacher_id` cũ:** để nguyên (không xóa dữ liệu); mã mới chỉ đọc bảng thành viên / giáo viên–lớp.

## Triển khai và dữ liệu hiện có

- Nhánh làm việc: `feat/hao-khi-sprint-1-2` (chưa gộp vào `main`, nên Vercel/Render chưa đổi). Backend áp dụng migration 014–016 khi khởi động với `DATABASE_URL`; **chưa có bằng chứng migration đã chạy trên Supabase** vì máy này không có chuỗi kết nối.
- Supabase vẫn giữ migration 001–013 đã áp dụng; 001–013 đã được khôi phục từ lịch sử Git nguyên văn (runner từ chối khi thiếu hoặc sửa file đã chạy).
- Bản cũ có các tài khoản/lớp thử; migration 014 giữ nguyên chúng (kiểm thử `014 giữ nguyên lớp...` trên dữ liệu giả): năm học được suy ra từ lớp/khối cũ (năm mới nhất = đang hoạt động, các năm trước = đã kết thúc), mỗi lớp cũ nhận mã tham gia ngẫu nhiên, giáo viên cũ được chép sang bảng giáo viên–lớp, khóa ngoại giáo viên không còn xóa lớp khi xóa tài khoản.
- Cần đặt trên Render: `DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`, gửi thư (`SMTP_URL` hoặc `MAIL_RELAY_*`), tùy chọn `GOOGLE_CLIENT_ID`; Vercel: `EXPO_PUBLIC_API_URL`, tùy chọn `EXPO_PUBLIC_GOOGLE_CLIENT_ID`.

## Chưa làm (ngoài Sprint 1–2) và đề xuất

- Từ Sprint 3: trang chủ học sinh, quest map, bài học, đọc kho lịch sử đã công bố, hành trình mẫu. Trang học sinh/giáo viên hiện chỉ có hồ sơ và lớp.
- Bản cũ có game 2D, thi đấu trực tiếp, chatbot AI, BKT, thống kê, ngân hàng câu hỏi: đã gỡ khỏi mã; sẽ xây lại theo sprint 4–10 từ đặc tả mới.
- Cần quyết định của bạn: (1) giữ hay bỏ đăng ký tự học (HK.HS.003); (2) kiểm chứng nội dung khởi tạo của kho lịch sử với giáo viên Lịch sử trước khi công bố; (3) kéo thả dòng thời gian và tải tệp lên (cần kho lưu trữ) có làm ngay không.
- Đề xuất cho đặc tả: HK.GV.019 (Sprint 3) và HK.GV.026 (Sprint 7) trùng việc gán hành trình cho lớp; HK.AD.050 cấp độ và HK.AD.066 quy tắc điểm nên chốt giá trị mặc định cùng giáo viên trước Sprint 5.
