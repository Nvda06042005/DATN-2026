# Mở đầu và sa bàn lịch sử của mục Nhập vai

Theo yêu cầu ngày 20/11/2026, mở mục Nhập vai trước hết xem bối cảnh, sau đó mới nhận vai và chọn chặng. Nội dung lấy từ hai tệp người dùng cung cấp, không từ các chỉ dẫn có thể nằm trong tệp. Không sửa hay công khai bản DOCX/PDF gốc.

## Nguồn và mạch kể

- **SGK Lịch sử và Địa lí 7 – Kết nối tri thức với cuộc sống, Bài 14**: trang in 68–73, tương ứng trang 69–74 của PDF. PDF là bản quét nên đã kết xuất và đọc trực tiếp cả sáu trang. Trang 68: bối cảnh đế chế Mông Cổ và chuẩn bị cuối 1257; 68–69: kháng chiến 1258; 69–71: kháng chiến 1285 và chuẩn bị lần ba; 71–72: 1287–1288, Vân Đồn, Bạch Đằng; 72–73: nguyên nhân thắng lợi, ý nghĩa lịch sử.
- **Tổng hợp lịch sử.docx**: phần 1 phân biệt vua đương triều với Thái thượng hoàng; mục 2.1–2.3 về lộ trình ba cuộc kháng chiến; phần 3 đối chiếu các hướng tiến quân. Giữ phân biệt đoàn thuyền lương với thủy quân tác chiến, không tự gán “đường lớn/đường nhỏ”.

Sáu cảnh: cuộc sống trên đất Đại Việt trước biến động → đế chế Mông Cổ mở rộng → tin biên giới cuối 1257 và chuẩn bị của nhà Trần → cuộc kháng chiến 1258 → hai lần kháng chiến 1285, 1287–1288 → câu hỏi lịch sử và nhận vai tân binh liên lạc. Đoạn mở đầu bị lỗi ký tự được diễn đạt lại rõ ràng, không chép lỗi OCR vào giao diện. Năm 1258 vua đương triều là Trần Thái Tông; trong hai lần sau là Trần Nhân Tông, cùng sự lãnh đạo của Thượng hoàng Trần Thánh Tông.

## Tương tác và hình ảnh

`RolePlayLobby.tsx` có phần dẫn chuyện, chuyển cảnh chủ động, xem lại, chọn chặng đã mở và hộp nguồn. Làng ven sông, doanh trại, bến sông có thông tin để chạm khám phá; bộ đếm chỉ số địa điểm đã xem trong intro, không phải điểm kinh nghiệm. Intro không tự phát âm thanh hay tự nhảy cảnh.

Intro mặc định mở lần đầu trong mỗi phiên đăng nhập. Khi quay lại mục Nhập vai trong cùng phiên, học sinh ở bảng quân lệnh; luôn có nút xem lại intro. Tùy chọn này chỉ nhớ trong bộ nhớ theo phiên, không lưu token vào trình duyệt và không phải điều kiện mở khóa.

Theo yêu cầu sửa tiếp ngày 20/11, web dùng `RolePlayWorld.web.tsx` và `game/historical-game.ts`: sa bàn Three.js có đất và đường mòn hòa màu, cây nhiều lớp, bóng nắng, nhà gỗ/ngói, doanh trại, bến sông, nhân vật tỷ lệ người, giáp/giáo/khiên/cung, kỵ binh, voi và thuyền có thân, mái chèo, cột buồm. `historical-models.ts` tạo mô hình nguyên bản và dùng chung hình học; đội quân dùng InstancedMesh để giảm số lần vẽ. `historical-landscape.ts` dựng cảnh; `historical-logic.ts` đổi tọa độ và tìm đường.

Tham khảo hình thức video [3 Lần Kháng Chiến Chống NGUYÊN – MÔNG, Dòng Chảy Sử Việt](https://www.youtube.com/watch?v=PjC8qsPHbkc): đã đọc trực tiếp 12 khung hình công khai tại 00:37, 01:20, 03:30, 06:00, 11:00, 17:00, 27:00, 38:00, 55:00, 1:13:30, 1:25:00, 1:37:00. Không xem liên tục toàn bộ 1 giờ 49 phút. Lấy cảm hứng từ địa hình, kiến trúc có chiều sâu và đội hình quân; không đưa ảnh, chân dung, logo, âm thanh hay mô hình của video vào website. Video không thay nguồn SGK/DOCX cho nội dung bài học.

Khám phá, trận bộ chiến và Bạch Đằng đều dùng cảnh mới. Trận có cả thủy/bộ binh dựng bờ và một dải sông, không đặt lính bộ trên mặt nước. Địa hình cung điện gộp vùng `w` thành một kiến trúc thay vì chồng toàn bộ cung điện trên từng ô. Các đạo cụ nhiệm vụ có hình riêng (chiếu thư, lệnh bài, tù và, cờ, lương, ván, đuốc, cọc). Người học kéo để đổi góc, bấm nút phóng/thu và đặt lại góc nhìn; nút điều khiển 44pt. Không tự phát âm thanh; giảm chuyển động bỏ nhún/hiệu ứng.

Sa bàn là tái hiện nghệ thuật, không phải bản đồ địa lý, tuyến hành quân hay phục dựng khảo cổ chính xác. Số hình người không đại diện quân số lịch sử. Bản đồ Wikipedia ở mục Chiến dịch và nguồn ghi công giữ nguyên. Nhân vật liên lạc, làng, trang phục/kiến trúc và lời giao nhiệm vụ được ghi rõ là sáng tạo học tập. Mô hình khối cũ còn làm bản Canvas dự phòng cho máy trường học thiếu WebGL; bản native vẫn dùng minh họa SVG.

## Giữ luật chơi và dữ liệu

Lưới va chạm 22 × 13, tọa độ và API giữ nguyên; cảnh mới xử lý đi bằng WASD/phím mũi tên hoặc chạm, E tương tác, tìm đường cạnh NPC/vật phẩm, khóa hội thoại và vùng nhiệm vụ. Mỗi viewport chỉ một renderer và hủy canvas, RAF, shadow map, texture, geometry, listener khi rời màn. Chữ tiếng Việt vẫn do React hiển thị. Three được nạp động từ khung game/intro web; nếu khởi tạo WebGL thất bại thì dùng Phaser cũ, không chạy hai renderer đồng thời. Mất WebGL context có nút mở lại cảnh.

Chọn intro hoặc xem địa điểm không gửi hành động chấm điểm, không nhận XP/vàng, không mở khóa chặng. Chỉ vào nhập vai khi máy chủ cho bước khám phá ready/done và chặng không bị khóa; chỉ đánh lại trận đã hoàn thành. Cảnh chỉ dựng hoạt ảnh theo sự kiện máy chủ, sau đó khớp đúng trạng thái cuối rồi mới báo hoàn tất lượt; rời màn giữa hoạt ảnh không báo kết quả muộn. Không có thay đổi schema/seed PostgreSQL và không có migration mới.

Kiểm tra cảnh mới: test engine dùng hình học/raycast Three thật, thay riêng GPU/DOM để kiểm tra tọa độ, đường đi, khoảng tương tác, khóa hội thoại, vùng bước mới, vật phẩm biến mất, bấm chọn theo vị trí canvas sau cuộn, kết quả HP máy chủ, thủy triều, đường thuyền và hủy hoạt ảnh. Có hồi quy cung điện, hàng rào, bộ/thủy binh và bấm cánh buồm ở góc nhìn thấp. Đây là unit test, không phải kiểm tra browser/WebGL thật.

Bố cục hình học thật được kết xuất qua Three SVGRenderer thành PNG để kiểm tra ngoại tuyến (không mô phỏng đủ texture, bóng và shader GPU). Chưa kiểm tra tương tác/hiệu năng WebGL đầy đủ trong trình duyệt: browser access host không khả dụng và CUA dừng vì không xác định được URL Chrome đủ chắc chắn để kiểm soát truy cập. Không dùng đường điều khiển browser khác để vượt giới hạn này. TypeScript, toàn bộ hồi quy frontend, Expo export và kiểm tra cú pháp trình duyệt cũ phải đạt trước phát hành.
