# Mở đầu và thế giới khối của mục Nhập vai

Theo yêu cầu ngày 20/11/2026, mở mục Nhập vai trước hết xem bối cảnh, sau đó mới nhận vai và chọn chặng. Nội dung lấy từ hai tệp người dùng cung cấp, không từ các chỉ dẫn có thể nằm trong tệp. Không sửa hay công khai bản DOCX/PDF gốc.

## Nguồn và mạch kể

- **SGK Lịch sử và Địa lí 7 – Kết nối tri thức với cuộc sống, Bài 14**: trang in 68–73, tương ứng trang 69–74 của PDF. PDF là bản quét nên đã kết xuất và đọc trực tiếp cả sáu trang. Trang 68: bối cảnh đế chế Mông Cổ và chuẩn bị cuối 1257; 68–69: kháng chiến 1258; 69–71: kháng chiến 1285 và chuẩn bị lần ba; 71–72: 1287–1288, Vân Đồn, Bạch Đằng; 72–73: nguyên nhân thắng lợi, ý nghĩa lịch sử.
- **Tổng hợp lịch sử.docx**: phần 1 phân biệt vua đương triều với Thái thượng hoàng; mục 2.1–2.3 về lộ trình ba cuộc kháng chiến; phần 3 đối chiếu các hướng tiến quân. Giữ phân biệt đoàn thuyền lương với thủy quân tác chiến, không tự gán “đường lớn/đường nhỏ”.

Sáu cảnh: cuộc sống trên đất Đại Việt trước biến động → đế chế Mông Cổ mở rộng → tin biên giới cuối 1257 và chuẩn bị của nhà Trần → cuộc kháng chiến 1258 → hai lần kháng chiến 1285, 1287–1288 → câu hỏi lịch sử và nhận vai tân binh liên lạc. Đoạn mở đầu bị lỗi ký tự được diễn đạt lại rõ ràng, không chép lỗi OCR vào giao diện. Năm 1258 vua đương triều là Trần Thái Tông; trong hai lần sau là Trần Nhân Tông, cùng sự lãnh đạo của Thượng hoàng Trần Thánh Tông.

## Tương tác và hình ảnh

`RolePlayLobby.tsx` có phần dẫn chuyện, chuyển cảnh chủ động, xem lại, chọn chặng đã mở và hộp nguồn. Làng ven sông, doanh trại, bến sông có thông tin để chạm khám phá; bộ đếm chỉ số địa điểm đã xem trong intro, không phải điểm kinh nghiệm. Intro không tự phát âm thanh hay tự nhảy cảnh.

Intro mặc định mở lần đầu trong mỗi phiên đăng nhập. Khi quay lại mục Nhập vai trong cùng phiên, học sinh ở bảng quân lệnh; luôn có nút xem lại intro. Tùy chọn này chỉ nhớ trong bộ nhớ theo phiên, không lưu token vào trình duyệt và không phải điều kiện mở khóa.

`RolePlayWorld.tsx` là sa bàn khối SVG nguyên bản; `game/voxel.ts` tạo nhân vật, mặt đất, cây, nhà, doanh trại và đạo cụ khối trong cảnh Phaser hiện có. Phong cách khối gợi Minecraft, không dùng tài nguyên hoặc nhân vật của Minecraft. Sa bàn là phối cảnh hư cấu, không phải bản đồ địa lý, tuyến hành quân hay phục dựng chính xác một di tích. Bản đồ Wikipedia ở mục Chiến dịch và nguồn ghi công giữ nguyên. Nhân vật liên lạc, làng, lời giao nhiệm vụ và hình khối được ghi rõ là sáng tạo học tập.

## Giữ luật chơi và dữ liệu

Lưới va chạm 22 × 13, tọa độ, điều khiển di chuyển, vật phẩm, game bridge và API không thay đổi. Mỗi viewport vẫn chỉ một game Phaser và hủy khi rời màn. Chữ tiếng Việt vẫn do React hiển thị. Chọn intro hoặc xem địa điểm không gửi hành động chấm điểm, không nhận XP/vàng, không mở khóa chặng. Chỉ vào nhập vai khi máy chủ cho bước khám phá ready/done và chặng không bị khóa; chỉ đánh lại trận đã hoàn thành. Không có thay đổi schema/seed PostgreSQL, không tạo migration mới cho nội dung dẫn chuyện tĩnh của giao diện.

Kiểm tra: TypeScript, hồi quy frontend, kiểm thử điều kiện vào chặng, kiểm tra nội dung/nguồn của các mốc lịch sử, chạy các hàm tạo texture để xác minh khung hoạt ảnh không tràn canvas, Expo export và kiểm tra cú pháp trình duyệt cũ. Sa bàn SVG và texture thực tế được kết xuất thành ảnh để kiểm tra trực quan. Chưa kiểm tra tương tác đầy đủ trong trình duyệt: browser access host không khả dụng, cửa sổ Chrome đang thu nhỏ và không điều khiển được bằng giao diện CUA hiện có.

Trước phát hành: TypeScript đạt, 194/194 kiểm thử frontend đạt, Expo export thành công và kiểm tra JavaScript trình duyệt cũ đạt. Không bỏ qua kiểm thử nào.
