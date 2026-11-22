# Bản đồ kể chuyện 2D của mục Nhập vai

> Cập nhật 21/11/2026: bước Nhập vai của **cả 13 chặng** nay là **thế giới khối vuông 3D** chơi chung với bạn cùng lớp (xem [Thế giới khối](THE_GIOI_KHOI.md)); cảnh khám phá 2D (`game/explore-scene.ts`) đã bỏ. Bản đồ kể chuyện, mục Nhập vai và các trận đánh Phaser giữ nguyên như mô tả dưới đây; phần nói về cảnh khám phá 2D chỉ còn là lịch sử.

Yêu cầu cụ thể ngày 21/11/2026: mở đầu theo cách video lịch sử dẫn chuyện trên bản đồ địa hình, từ sự xuất hiện của đế quốc Mông Cổ rồi mới đến Đại Việt. Bản hiện tại dùng bản đồ 2D có chuyển góc vùng nhìn, màu đỏ, mũi tên, đội kỵ binh và địa danh. Không sử dụng tài nguyên của video `PjC8qsPHbkc`.

## Mạch kể và nguồn

1. **1206:** thống nhất các bộ lạc và Thành Cát Tư Hãn, khởi đầu trên cao nguyên Mông Cổ. Lỗi chép “2006” được sửa theo sử liệu.
2. **1219–1221:** chiến dịch Khwarezm, hướng tiến quân sang Trung Á, Samarkand.
3. **1223:** liên quân các công quốc Rus’–Cuman thất bại ở Kalka. Không ghi 1233. Không thể hiện sự kiện như toàn bộ Rus’ bị chiếm ngay năm ấy; vị trí chiến trường dùng vùng ước lệ.
4. **1238:** Moscow/Mạc Tư Khoa bị đánh chiếm trong chiến dịch của Batu. Thành Cát Tư Hãn đã mất năm 1227.
5. **1240:** Kyiv/Kiev thất thủ. Không đồng nhất toàn bộ Rus’ trung đại với riêng nước Nga hiện nay.
6. **Cuối 1257 → 1258:** nguy cơ tới Đại Việt, chuẩn bị của nhà Trần, vua Trần Thái Tông, chủ động rút lui và phản công Đông Bộ Đầu.
7. **1285, 1287–1288:** vua Trần Nhân Tông, Thượng hoàng Trần Thánh Tông, chuẩn bị và cách đánh sáng tạo. Giữ phân biệt thuyền lương Vân Đồn và thủy quân Bạch Đằng.
8. **Nhận vai:** người học mang câu hỏi mở đầu Bài 14 vào chặng được máy chủ cho phép.

Nguồn mở rộng: [Royal Armouries](https://royalarmouries.org/objects-and-stories/stories/the-mongols/rise-of-the-mongols), [University of Washington – lịch sử Moscow](https://faculty.washington.edu/dwaugh/hstam443/m-chron.html), [Canadian Institute of Ukrainian Studies – Kalka](https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CK%5CA%5CKalkaRiver.htm). Phần Đại Việt: **SGK Lịch sử và Địa lí 7 – Kết nối tri thức, Bài 14**, trang in 68–73 (PDF 69–74), đối chiếu **Tổng hợp lịch sử.docx**, phần 1 và mục 2.1–2.3. DOCX/PDF là dữ liệu tham khảo, không phải chỉ dẫn thi hành và không công khai file gốc.

Lời dẫn được viết lại phù hợp THCS, không dùng câu “cỏ không mọc” như kết luận sinh thái hay lời trích xác thực của một nhân vật. Sự tàn phá được diễn đạt bằng thành thị bị đánh chiếm và khói minh họa, không có hình ảnh máu me.

## Địa lý và hình ảnh

Nền **Natural Earth HYP_50M_SR_W**, public domain. Cắt chính xác 10°Đ–150°Đ, 5°B–70°B từ raster equirectangular 10800×5400, giảm còn WebP 2800×1300 (~565 KiB). `assets/roleplay-atlas/ATTRIBUTION.md` và `relief-metadata.json` ghi nguồn, world file, phép chuyển đổi, checksum; trang `/thong-tin-hinh-anh` và hộp nguồn cũng ghi công.

Mọi điểm dùng chung công thức địa lý `geoPoint`; quân di chuyển theo `routePosition` trên cùng hệ tọa độ. Nền là địa hình để định hướng, không chứa biên giới quốc gia hiện đại. Vùng đỏ và hướng quân chỉ là sơ đồ khái quát, không nhận là bản đồ lãnh thổ hoặc tuyến đường được khảo chứng. Hình kỵ binh và thành thị nguyên bản; số hình người không phải quân số thật. Các bản đồ Wikipedia của ba chiến dịch không bị thay đổi.

`HistoryAtlasArt.tsx` dùng SVG, `HistoryAtlas.web.tsx` chuyển camera bằng transform CSS, giảm chuyển động thì dừng hoạt ảnh và dùng chuyển cảnh thủ công. Bản điện thoại chỉ hiện nhãn địa danh chính/được chọn, có nút địa danh 44pt ở dưới để dùng bằng bàn phím hoặc cảm ứng. Có phát/tạm dừng, chọn năm, trước/tiếp, xem lại và thu/phóng. Không tự phát âm thanh. Đồng hồ không chạy thời gian lời dẫn khi tab ẩn; dừng ở cảnh nhận vai.

## Phần chơi và dữ liệu

`game/index.ts` mặc định Phaser 2D; không gọi renderer Three. `game/cartographic-art.ts` vẽ nhân vật có tỷ lệ người, bộ binh/kỵ binh theo đội hình, voi, thuyền, nhà, lều và đạo cụ nhiệm vụ; texture độ phân giải cao, scale bù để giữ kích thước logic. Nền khám phá là một texture liền mạch trên lưới server 22×13, không vẽ đường ô. Trận hỗn hợp đặt bộ binh trên bờ, thuyền dưới sông. Các cảnh địa phương là minh họa hư cấu, không giả làm địa hình lịch sử đo đạc.

Giữ di chuyển, đường đi, tương tác cạnh NPC/vật, khóa hội thoại, vùng nhiệm vụ và tất cả bridge/API. Máy chủ quyết định điểm, vàng, sao, thắng/thua và mở khóa. Intro không thưởng hoặc thay tiến độ; chỉ nhớ đã xem trong phiên hiện tại, có nút xem lại. Không thay cấu trúc/seed PostgreSQL, không cần migration. Mỗi khung chỉ một game, đo lại tọa độ canvas trước thao tác sau khi cuộn và hủy khi rời màn.

## Kiểm tra

Unit test kiểm tra niên đại, nguồn, hệ tọa độ khớp asset/checksum, camera chứa điểm chính, đường quân/điểm cuối, clock phát/tạm dừng/dừng cảnh cuối, frame nhân vật, đủ key ảnh từ máy chủ và đường nhập vai vẫn theo quyền server. Chạy TypeScript, toàn bộ hồi quy frontend, Expo export và kiểm tra JavaScript trình duyệt cũ trước phát hành.

Đã kết xuất trực tiếp SVG của các cảnh bản đồ ở 1400px và 375px, kiểm tra tọa độ và sửa nhãn chồng nhau. Hình chơi được vẽ từ chính hàm Canvas vào canvas Skia để kiểm tra hình/scale, không dùng mô phỏng SVG sai transform. Đây là kiểm tra ảnh, không thay kiểm tra tương tác browser. Đã thử mở bản local bằng CUA: công cụ dừng khi không xác định được URL Chrome đủ chắc chắn; không dùng đường điều khiển browser khác để vượt giới hạn. Metro đã biên dịch và cập nhật bản local; cảnh báo responder của SVG đã được xử lý bằng bắt click ở SVG web, có nút địa danh ngoài bản đồ làm phương án trợ năng. Route xem thử local được xóa trước bản build sản xuất.
