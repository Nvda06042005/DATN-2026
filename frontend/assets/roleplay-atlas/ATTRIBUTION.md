# Nền địa hình cho bản đồ dẫn nhập 2D

**Made with Natural Earth.** `eurasia-relief.webp` là dữ liệu địa hình thật, không phải ảnh AI và không lấy từ video tham khảo.

- Tác giả dữ liệu: Natural Earth, Tom Patterson, Nathaniel Vaughn Kelso và cộng tác viên.
- Bộ dữ liệu: **Cross-blended Hypsometric Tints with Shaded Relief and Water**, `HYP_50M_SR_W`, tỉ lệ 1:50 triệu, bản tải được trang nguồn ghi là 3.2.0.
- Trang nguồn: https://www.naturalearthdata.com/downloads/50m-raster-data/50m-cross-blend-hypso/
- Tệp nguồn trực tiếp: https://naturalearth.s3.amazonaws.com/50m_raster/HYP_50M_SR_W.zip
- Giấy phép: **Public domain** theo https://www.naturalearthdata.com/about/terms-of-use/ ; được dùng, chỉnh sửa và phân phối, kể cả trong sản phẩm thương mại. Dự án vẫn ghi công nguồn.
- Ngày chuẩn bị: 21/11/2026.

## Phép chiếu và chuyển đổi

Nguồn `HYP_50M_SR_W.tif` là lưới kinh/vĩ độ toàn cầu 10.800 × 5.400 pixel. World file ghi kích thước pixel `1/30° × -1/30°`, tâm pixel đầu `(-179.98333333333333°, 89.98333333333333°)`, tương ứng mép ảnh `180°W..180°E, 90°N..90°S`.

Ảnh xuất có giới hạn chính xác: **10°E–150°E, 5°N–70°N**, không đổi phép chiếu. Cắt hộp pixel nguồn `(5700, 600, 9900, 2550)` rồi giảm từ 4.200 × 1.950 xuống **2.800 × 1.300** bằng LANCZOS; nén WebP quality 86. Không nhuộm màu, phát sinh địa hình, thêm biên giới hiện đại hoặc dùng tài nguyên video.

Đổi kinh/vĩ độ sang ảnh: `x = (longitude - 10) / 140 * 2800`, `y = (70 - latitude) / 65 * 1300`. Khi đổi sang viewBox khác, dùng đúng cùng tỉ lệ. Mọi góc camera đều cắt/thu phóng trên cùng hệ tọa độ này. Chi tiết checksum của ZIP và ảnh xuất nằm trong `relief-metadata.json`.

Đã mở và kiểm tra trực quan đường bờ, biển Đen, biển Caspi, Nhật Bản, tiểu lục địa Ấn Độ và bờ biển Đại Việt. Điểm đối chiếu trên đất liền: khu vực Mông Cổ, Mát-xcơ-va, Kyiv, Thăng Long; điểm biển: biển Đen, vịnh Bengal, Biển Đông. Các mẫu điểm biển/đất khớp tọa độ và không bị đảo trục.

Đây là **nền địa hình hiện đại để định hướng không gian**, không phải bản đồ chính trị thế kỉ XIII. Các miền tô màu và đường tiến quân do trò chơi vẽ thêm cần ghi rõ là sơ đồ khái quát; không trình bày chúng như biên giới hoặc lộ trình được khảo chứng chính xác.

## Đối chiếu sử liệu cho lời dẫn

- Royal Armouries Museum, *Rise of the Mongols*: năm 1206 thống nhất dưới Thành Cát Tư Hãn; các chiến dịch mở rộng; Thành Cát Tư Hãn mất năm 1227; chiến dịch của Batu và Kyiv năm 1240. https://royalarmouries.org/objects-and-stories/stories/the-mongols/rise-of-the-mongols
- University of Washington, *Chronology of the Early History of Moscow*: Mát-xcơ-va bị quân Mông Cổ đánh chiếm năm 1238. https://faculty.washington.edu/dwaugh/hstam443/m-chron.html
- Canadian Institute of Ukrainian Studies, *Kalka River*: liên quân Rus’–Cuman thất bại năm 1223. https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CK%5CA%5CKalkaRiver.htm
- Đại bách khoa thư Ukraina, *Битва на Калці 1223*: vị trí chính xác của trận Kalka còn tranh luận; dùng nhãn khu vực và dấu hiệu ước lệ. https://vue.gov.ua/Битва_на_Калці_1223

Không đổi `1206` thành `2006`, không đổi `1223` thành `1233`, không gọi toàn bộ Rus’ là lãnh thổ nước Nga hiện nay, không quy các cuộc chinh phạt sau năm 1227 cho sự chỉ huy trực tiếp của Thành Cát Tư Hãn. Câu “vó ngựa đến đâu cỏ không mọc đến đó” không được dùng như một kết luận sinh thái hoặc trích dẫn xác thực của nhân vật.
