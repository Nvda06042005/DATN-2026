# Giao diện học sinh – 20/11/2026

Theo yêu cầu làm lại giao diện học sinh cho lứa tuổi THCS và tăng tính trò chơi hóa, không gian học sinh có ngôn ngữ thiết kế riêng: xanh ngọc, vàng, nền sáng, nút có chiều sâu, thẻ bo góc, Rồng Con và phong cảnh thành lũy minh họa. Nhãn hành động bằng tiếng Việt; số liệu luôn lấy từ API của người đang đăng nhập.

Giữ các màu đỏ ngữ nghĩa hiện có cho câu trả lời sai, lỗi nhập liệu và lỗi API; không đổi phản hồi sai thành màu xanh của hành trình.

## Các màn chính

- **Sảnh chọn lớp:** chào học sinh, vào nhanh lớp đã tham gia; tìm theo lớp/giáo viên có hoặc không dấu; lọc tất cả/lớp đã tham gia; nhóm theo học kỳ; thẻ lớp có giáo viên và sĩ số. Lớp chưa tham gia vẫn cần mã thầy cô gửi trong Tin nhắn. Có trạng thái tải, lỗi kèm nút tải lại và kết quả tìm kiếm trống. Form mã lớp không gửi khi lớp đã đóng, đã tham gia hoặc đang gửi yêu cầu.
- **Trong lớp:** nút tiếp tục chặng từ `home.next`, ba chiến dịch với tiến độ và số sao; góc thành tích, nhiệm vụ ngày, giải đấu tuần, trang phục và các lối vào ôn tập/nhập vai/bộ thẻ. Chỉ chúc mừng đi trọn hành trình khi tổng chặng lớn hơn 0 và số chặng hoàn thành đã đạt tổng.
- **Khung chung của các màn học sinh:** desktop có menu trái; dưới 1080px có menu mở bằng nút, đóng bằng nền ngoài/nút đóng/Escape. Hồ sơ, đổi mật khẩu, đăng xuất, cài đặt và thông báo giữ các API cũ. Bảng màu giới hạn ở cây `StudentApp`, các vai trò khác dùng khung và màu hiện có.

## Mã nguồn và dữ liệu

- `frontend/components/portal/StudentWorkspace.tsx`: bố cục và các hành động tài khoản, dùng lại `ProfileSheet` và API xác thực.
- `frontend/components/portal/StudentDesign.tsx`: màu, nút, chỉ số và phong cảnh SVG tự vẽ. Đây là minh họa trang trí của thế giới trò chơi, không phải bản đồ địa lý hay phục dựng một di tích cụ thể. Không dùng tài nguyên hoặc nhân vật sao chép từ website mẫu.
- `StudentClasses.tsx`, `SagaHome.tsx`, `SagaRail.tsx`, `SagaKit.tsx`: sảnh, lớp, chiến dịch, nhiệm vụ và bộ thành phần học tập.
- `StudentApp.tsx`: vẫn dùng `usePortalTab`, kiểm tra lớp, phiên và các API cũ; các màn đang ẩn không giữ game đang chạy. Cấp độ, kinh nghiệm, vàng, chuỗi ngày, tiến độ và mở khóa do máy chủ trả về. Không cộng thưởng ở frontend.
- Bản đồ chiến dịch tiếp tục dùng các ảnh Wikipedia gốc và nguồn đã ghi công. Không thay đổi database, seed, lịch sử migration hoặc dữ liệu học sinh; schema hiện hành là 079.

## Kiểm tra và phát hành

Chạy tại `frontend`: `npm run typecheck`, `npm test`, `npm run build`. Các kiểm tra điều hướng hiện có được cập nhật để xác minh khung học sinh riêng, cách giới hạn bảng màu, các API tài khoản và những luật học tập đã giữ.

Kết quả trước phát hành: TypeScript đạt, 189/189 bài kiểm thử đạt (không bỏ qua bài nào), Expo web export thành công. Bản dựng có cảnh báo CSS ảnh của Leaflet đã tồn tại, không gây lỗi export.

Triển khai từ `main` theo quy trình hiện có. Xác minh GitHub CI, SHA ở `/build-info.json` trên Vercel, `commit` ở `/api/health` trên Render và `schema_version` ở `/api/database/health` cho Supabase. Dữ liệu PostgreSQL không được sao chép hoặc dựng lại để đổi giao diện.

Giới hạn kiểm tra trong phiên thực hiện: trang VL Legend tham khảo không đọc được qua HTTPS tự động do lỗi chứng chỉ TLS. Công cụ điều khiển trình duyệt Windows đã dừng vì không xác định được URL hiện tại đủ tin cậy; chưa có kiểm tra hình ảnh trực tiếp hoặc thao tác bằng trình duyệt với giao diện mới. Không coi các kiểm tra mã và build là thay thế cho kiểm tra trực quan.
