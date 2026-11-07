# Đăng nhập tại đường dẫn riêng và lịch sử menu

Cập nhật 07/11/2026 theo yêu cầu giữ khu vực của từng trường trong đường dẫn do quản trị tổng tạo.

- `/admin` là cổng quản lý tổng.
- `/donga_<mã>_<tên>_<khu vực>` mở Quản trị trường nếu không ghi vai trò. Bộ chọn vẫn có Học sinh, Giáo viên, Quản trị trường; URL `?role=...` chọn rõ vai trò. Chuyển vai trò không cấp quyền: API vẫn kiểm tra vai trò, trường, khóa tài khoản và 2FA.
- Đăng nhập mật khẩu/Google, đổi mật khẩu tạm, xác nhận hồ sơ, đổi mật khẩu chủ động và đăng xuất đều ở cùng cổng trường. Tên/logo và phần tên của đường dẫn lấy từ API theo mã trường; đường dẫn cũ sau đổi tên được thay bằng đường dẫn chuẩn, giữ role/tab.
- `/portal` vẫn là đăng nhập chung. Sau khi đăng nhập tài khoản có trường, client lấy link chuẩn từ máy chủ rồi mở link đó với vai trò được xác thực. `/school-manager-admin` chỉ còn chuyển tiếp các dấu trang cũ: đọc phiên đã lưu, tìm link đúng theo mã trường, thay địa chỉ trước khi vẽ trang hay yêu cầu đổi mật khẩu. Chưa có phiên thì tới `/portal?role=school_admin`.

## Phiên và Back/Forward

`usePortalTab` ghi mục menu vào tham số `tab` bằng router push, giữ role và đường dẫn hiện tại. Back/Forward trở lại mục trước/sau; tải lại dùng cùng tab. Link và cookie không chứa token; web vẫn lưu phiên trong localStorage, điện thoại dùng SecureStore như trước. Phiên riêng dùng khóa theo vai trò và mã trường; khóa vai trò cũ chỉ dùng tương thích, luôn kiểm tra `/api/auth/me` và mã trường trước khi nhận. Đăng xuất một trường không xóa phiên của trường khác. API/RLS tiếp tục là nơi quyết định quyền truy cập.

`PortalApp` kiểm tra lại phiên khi màn được focus, thay vì chỉ khi mount. Điều này ngăn Back mở lại dữ liệu của màn cũ đã nằm trong bộ nhớ của Expo Stack sau khi đăng xuất hoặc đổi mật khẩu. Back khi còn phiên hợp lệ không thực hiện logout. Màn chi tiết có nút quay lại riêng vẫn dùng nút của chính màn đó; lịch sử này áp dụng cho các mục menu chính.

Thư cấp tài khoản/đặt lại mật khẩu tạm tra lại trường của người nhận ở lúc gửi. Thư đang chờ từ trước khi trường đổi tên cũng nhận tên và URL hiện tại, kèm role; thư của quản lý tổng vẫn tới `/admin`. Không cập nhật template đã lưu hoặc seed; không cần migration mới.

## Các mục tạm ẩn

- Học sinh: Bộ thẻ, Kế hoạch học, Dòng thời gian, Bản đồ, Trận đánh. Cả thanh bên, Xem thêm trên điện thoại và lối tắt Trận đánh ở Luyện tập đều ẩn. URL tab cũ không mở lại mục đã ẩn.
- Giáo viên: Hành trình học và Bộ đề ẩn cả menu chính lẫn menu Tạo. Gỡ mục Trò chơi hóa của giáo viên. Giữ Quiz tương tác, soạn bằng AI, ngân hàng câu hỏi và thi đấu; trình soạn Quiz dùng mục nội bộ `studio`, không mở lại danh sách Bộ đề.
- Dữ liệu, tiến độ và chức năng quản trị trường tương ứng được giữ để bật lại sau.

## Kiểm tra

- `npm --prefix frontend run typecheck`, `npm --prefix frontend test`, `npm --prefix frontend run build`.
- `frontend/tests/school-session.test.cjs`: tách phiên trường/vai trò, chọn URL và role từ nhận diện mới trên máy chủ.
- `frontend/tests/school-navigation.browser.cjs`: chạy trên web export local; API giả lập với tài khoản `example.invalid`. Đặt `PLAYWRIGHT_MODULE`, `QA_URL`, tùy chọn `CHROME_PATH`, `QA_ARTIFACT_DIR`. Kiểm tra cả bốn vai trò ở 1440/390 px, đổi mật khẩu tạm ở trường, tên mới/URL cũ, Back/Forward/reload, chuyển tiếp link cũ, các mục ẩn, đăng xuất rồi Back, từ chối phiên trường khác. Không tạo tài khoản hay gửi thư production.
- `backend/test/smtp.spec.ts`: transport JSON giả lập kiểm tra thư của ba vai trò nhà trường tới link theo tên mới; quản lý tổng vẫn tới `/admin`. Kiểm thử phạm vi trường hiện có ở `school_link.spec.ts`.
