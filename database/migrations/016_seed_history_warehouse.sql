-- HK.AD.028–042: nội dung khởi tạo cho kho dữ liệu lịch sử, lấy từ nội dung đã có trong dự án (hồ sơ danh tướng, kho tri thức, bản đồ chiến dịch).
-- Mọi bản ghi ở trạng thái "Nháp": quản trị tổng phải kiểm chứng với sách giáo khoa/sử liệu rồi mới chuyển "Đã kiểm chứng" và "Công bố".
-- Không ghi số quân của kháng chiến lần hai và ba vì các nguồn chưa thống nhất (chỉ giữ "3 vạn quân Mông Cổ" năm 1258 như kho tri thức của dự án). Tọa độ chỉ điền khi vị trí hiện nay không tranh cãi; các địa điểm còn lại
-- để trống cho quản trị tổng chọn trực tiếp trên bản đồ. Chạy lại không tạo trùng (ON CONFLICT theo slug). Không chứa dữ liệu tài khoản.

INSERT INTO public.hist_campaigns (slug, title, year_label, start_year, end_year, summary, sort_order, search_text) VALUES ('khang-chien-lan-1-1258', 'Kháng chiến chống Mông Cổ lần thứ nhất', '1258', 1258, 1258, 'Tháng 1/1258, 3 vạn quân Mông Cổ do Ngột Lương Hợp Thai chỉ huy xâm lược Đại Việt. Vua Trần Thái Tông chặn giặc ở Bình Lệ Nguyên rồi rút lui bảo toàn lực lượng, thực hiện "Vườn không nhà trống" ở Thăng Long. Ngày 29/1/1258, quân Trần phản công thắng lợi tại Đông Bộ Đầu, quét sạch giặc khỏi bờ cõi.', 1, 'khang chien chong mong co lan thu nhat 1258') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_campaigns (slug, title, year_label, start_year, end_year, summary, sort_order, search_text) VALUES ('khang-chien-lan-2-1285', 'Kháng chiến chống Nguyên lần thứ hai', '1285', 1282, 1285, 'Đầu năm 1285, Thoát Hoan đem quân Nguyên từ phía Bắc phối hợp Toa Đô từ phía Nam đánh Đại Việt. Triều Trần rút lui bảo toàn lực lượng rồi phản công: tháng 5 – 6/1285 quân Trần đại thắng ở Tây Kết, Hàm Tử, Chương Dương, giải phóng Thăng Long. Toa Đô bị chém đầu, Thoát Hoan phải tháo chạy về nước.', 2, 'khang chien chong nguyen lan thu hai 1285') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_campaigns (slug, title, year_label, start_year, end_year, summary, sort_order, search_text) VALUES ('khang-chien-lan-3-1287-1288', 'Kháng chiến chống Nguyên lần thứ ba', '1287 – 1288', 1287, 1288, 'Cuối 1287 – tháng 4/1288, Thoát Hoan đem quân cùng đoàn thuyền lương của Trương Văn Hổ xâm lược lần thứ ba. Trần Khánh Dư thắng ở Vân Đồn, Trần Hưng Đạo thắng lớn ở Bạch Đằng, đập tan hoàn toàn mộng xâm lăng của nhà Nguyên.', 3, 'khang chien chong nguyen lan thu ba 1287 – 1288') ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.hist_places (slug, name, old_name, province, lat, lng, description, search_text) VALUES ('thang-long', 'Thăng Long', 'Kinh thành Thăng Long', 'Hà Nội', 21.0367, 105.84, 'Kinh đô của Đại Việt thời Trần, nay thuộc Hà Nội. Nơi diễn ra kế sách "Vườn không nhà trống" (1258) và là mục tiêu giải phóng năm 1285.', 'thang long kinh thanh thang long ha noi') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_places (slug, name, old_name, province, lat, lng, description, search_text) VALUES ('binh-le-nguyen', 'Bình Lệ Nguyên', 'Bình Lệ Nguyên', 'Vĩnh Phúc', NULL, NULL, 'Nơi vua Trần Thái Tông đón đánh quân Mông Cổ tháng 1/1258 rồi rút lui bảo toàn lực lượng. Vị trí chính xác cần chọn trên bản đồ sau khi đối chiếu tài liệu.', 'binh le nguyen binh le nguyen vinh phuc') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_places (slug, name, old_name, province, lat, lng, description, search_text) VALUES ('dong-bo-dau', 'Đông Bộ Đầu', 'Bến Đông Bộ Đầu', 'Hà Nội', NULL, NULL, 'Bến sông ở Thăng Long nơi quân Trần phản công đánh tan quân Mông Cổ ngày 29/1/1258. Vị trí chính xác cần chọn trên bản đồ sau khi đối chiếu tài liệu.', 'dong bo dau ben dong bo dau ha noi') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_places (slug, name, old_name, province, lat, lng, description, search_text) VALUES ('ham-tu', 'Hàm Tử', 'Hàm Tử quan', 'Hưng Yên', NULL, NULL, 'Nơi Trần Nhật Duật đại thắng quân Nguyên tháng 5 – 6/1285. Vị trí chính xác cần chọn trên bản đồ sau khi đối chiếu tài liệu.', 'ham tu ham tu quan hung yen') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_places (slug, name, old_name, province, lat, lng, description, search_text) VALUES ('chuong-duong', 'Chương Dương', 'Chương Dương độ', 'Hà Nội', NULL, NULL, 'Bến sông nơi Trần Quang Khải đại phá quân Nguyên, mở đường giải phóng Thăng Long (1285). Vị trí chính xác cần chọn trên bản đồ sau khi đối chiếu tài liệu.', 'chuong duong chuong duong do ha noi') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_places (slug, name, old_name, province, lat, lng, description, search_text) VALUES ('tay-ket', 'Tây Kết', NULL, NULL, NULL, NULL, 'Nơi diễn ra một trận phản công của quân Trần tháng 5 – 6/1285. Chưa có mô tả chi tiết, cần bổ sung và kiểm chứng.', 'tay ket') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_places (slug, name, old_name, province, lat, lng, description, search_text) VALUES ('van-don', 'Vân Đồn', 'Vân Đồn', 'Quảng Ninh', 21.0545, 107.4337, 'Cửa biển ở Quảng Ninh, nơi Trần Khánh Dư phục kích đánh đắm đoàn thuyền lương của Trương Văn Hổ (đầu năm 1288).', 'van don van don quang ninh') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_places (slug, name, old_name, province, lat, lng, description, search_text) VALUES ('bach-dang', 'Sông Bạch Đằng', 'Bạch Đằng giang', 'Quảng Ninh – Hải Phòng', NULL, NULL, 'Cửa sông nơi Trần Hưng Đạo bố trí bãi cọc ngầm, đánh tan thủy quân Nguyên tháng 4/1288. Vị trí chính xác của bãi cọc cần chọn trên bản đồ sau khi đối chiếu tài liệu.', 'song bach dang bach dang giang quang ninh – hai phong') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_places (slug, name, old_name, province, lat, lng, description, search_text) VALUES ('van-kiep', 'Vạn Kiếp', 'Vạn Kiếp', 'Hải Dương', NULL, NULL, 'Căn cứ của Trần Hưng Đạo; Thoát Hoan tháo chạy qua đây tháng 6/1285.', 'van kiep van kiep hai duong') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_places (slug, name, old_name, province, lat, lng, description, search_text) VALUES ('binh-than', 'Bình Than', 'Bến Bình Than', NULL, NULL, NULL, 'Bến sông nơi vua Trần Nhân Tông triệu tập Hội nghị Bình Than tháng 10/1282.', 'binh than ben binh than') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_places (slug, name, old_name, province, lat, lng, description, search_text) VALUES ('dien-hong', 'Điện Diên Hồng', 'Điện Diên Hồng', 'Hà Nội', NULL, NULL, 'Nơi Thượng hoàng Trần Thánh Tông họp các bô lão đầu năm 1285.', 'dien dien hong dien dien hong ha noi') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_places (slug, name, old_name, province, lat, lng, description, search_text) VALUES ('da-mac', 'Đà Mạc', 'Bãi Đà Mạc', NULL, NULL, NULL, 'Nơi Trần Bình Trọng chặn quân Nguyên để hai vua Trần rút lui (1285). Vị trí chính xác cần đối chiếu tài liệu.', 'da mac bai da mac') ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.hist_figures (slug, name, honorific, figure_group, birth_year, death_year, role_text, biography, famous_quote, source_note, search_text) VALUES ('tran-thai-tong', 'Trần Thái Tông', 'Vua Trần Thái Tông (Trần Cảnh)', 'king', 1218, 1277, 'Hoàng đế Đại Việt (1226 – 1258), sau là Thái thượng hoàng; trực tiếp lãnh đạo kháng chiến lần thứ nhất', 'Tên thật Trần Cảnh, vị hoàng đế đầu tiên của nhà Trần, sinh ở Hương Tức Mặc, phủ Thiên Trường (Nam Định). Năm 1258 ông thân chinh chống quân Mông Cổ: thất lợi ở Bình Lệ Nguyên, rút lui giữ lực lượng rồi phản công thắng ở Đông Bộ Đầu. Ông cùng Trần Thủ Độ cải tổ luật pháp, hành chính; là thiền sư, tác giả Khóa hư lục.', NULL, 'Theo hồ sơ danh tướng của dự án; cần đối chiếu Đại Việt sử ký toàn thư.', 'tran thai tong vua tran thai tong (tran canh) hoang de dai viet (1226 – 1258), sau la thai thuong hoang; truc tiep lanh dao khang chien lan thu nhat') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_figures (slug, name, honorific, figure_group, birth_year, death_year, role_text, biography, famous_quote, source_note, search_text) VALUES ('tran-thanh-tong', 'Trần Thánh Tông', 'Vua Trần Thánh Tông (Trần Hoảng)', 'king', 1240, 1290, 'Hoàng đế Đại Việt (1258 – 1278), sau là Thái thượng hoàng; triệu tập Hội nghị Diên Hồng (1285)', 'Con trưởng của Trần Thái Tông, tên thật Trần Hoảng. Lên ngôi năm 1258, nhường ngôi cho con là Trần Nhân Tông năm 1278 và làm Thái thượng hoàng; đầu năm 1285 ông triệu tập các bô lão họp ở điện Diên Hồng.', NULL, 'Cần đối chiếu Đại Việt sử ký toàn thư trước khi kiểm chứng.', 'tran thanh tong vua tran thanh tong (tran hoang) hoang de dai viet (1258 – 1278), sau la thai thuong hoang; trieu tap hoi nghi dien hong (1285)') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_figures (slug, name, honorific, figure_group, birth_year, death_year, role_text, biography, famous_quote, source_note, search_text) VALUES ('tran-nhan-tong', 'Trần Nhân Tông', 'Vua Trần Nhân Tông (Trần Khâm); Phật hoàng', 'king', 1258, 1308, 'Hoàng đế (1278 – 1293); sơ tổ Thiền phái Trúc Lâm; cùng Thượng hoàng và Trần Quốc Tuấn lãnh đạo hai cuộc kháng chiến 1285 và 1287 – 1288', 'Vị vua thứ ba của nhà Trần, lên ngôi năm 1278 khi chưa đầy 20 tuổi. Ông mở Hội nghị Bình Than (cuối 1282), năm 1283 phong Trần Quốc Tuấn làm Quốc công Tiết chế, cùng Thượng hoàng và Hưng Đạo vương đánh bật quân Nguyên. Năm 1299 ông lên Yên Tử tu hành, lập Thiền phái Trúc Lâm.', NULL, 'Theo hồ sơ danh tướng của dự án; cần đối chiếu nguồn.', 'tran nhan tong vua tran nhan tong (tran kham); phat hoang hoang de (1278 – 1293); so to thien phai truc lam; cung thuong hoang va tran quoc tuan lanh dao hai cuoc khang chien 1285 va 1287 – 1288') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_figures (slug, name, honorific, figure_group, birth_year, death_year, role_text, biography, famous_quote, source_note, search_text) VALUES ('tran-thu-do', 'Trần Thủ Độ', 'Thái sư; truy tặng Thượng phụ Thái sư Trung Vũ đại vương', 'official', 1194, 1264, 'Thái sư (tể tướng) nhà Trần; chú họ của vua Trần Thái Tông', 'Nhà chính trị có vai trò then chốt khi lập nên nhà Trần, giúp Thái Tông dẹp giặc trong nước, chỉnh đốn mọi việc để Đại Việt đủ mạnh chống Mông Cổ. Sử cũ vừa đề cao tài lược, vừa phê phán một số việc làm của ông.', 'Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo!', 'Theo hồ sơ danh tướng của dự án; cách chép câu nói khác nhau giữa các nguồn, cần đối chiếu.', 'tran thu do thai su; truy tang thuong phu thai su trung vu dai vuong thai su (te tuong) nha tran; chu ho cua vua tran thai tong') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_figures (slug, name, honorific, figure_group, birth_year, death_year, role_text, biography, famous_quote, source_note, search_text) VALUES ('le-phu-tran', 'Lê Phụ Trần', 'Lê Tần; Bảo Văn hầu', 'general', NULL, NULL, 'Ngự sử đại phu, sau là Thủy quân đại tướng quân; danh tướng ba đời vua Thái Tông, Thánh Tông, Nhân Tông', 'Người Ái Châu (Thanh Hóa). Ở Bình Lệ Nguyên (1258), khi quân Trần núng thế, ông một ngựa xông pha, can vua tạm lánh giặc và lấy ván thuyền che tên cho vua. Năm 1274 làm Thiếu sư, dạy học Thái tử Trần Khâm. Sử không ghi năm sinh, năm mất.', NULL, 'Theo hồ sơ danh tướng của dự án; cần đối chiếu nguồn.', 'le phu tran le tan; bao van hau ngu su dai phu, sau la thuy quan dai tuong quan; danh tuong ba doi vua thai tong, thanh tong, nhan tong') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_figures (slug, name, honorific, figure_group, birth_year, death_year, role_text, biography, famous_quote, source_note, search_text) VALUES ('tran-hung-dao', 'Trần Hưng Đạo', 'Trần Quốc Tuấn; Quốc công Tiết chế; Hưng Đạo Đại vương', 'general', NULL, 1300, 'Tổng chỉ huy quân đội trong hai cuộc kháng chiến 1285 và 1287 – 1288; tác giả Hịch tướng sĩ và Binh thư yếu lược', 'Tên thật Trần Quốc Tuấn, con của Trần Liễu, nhà chiến lược quân sự lớn nhất của nhà Trần. Được phong Quốc công Tiết chế năm 1283; rút lui bảo toàn lực lượng rồi phản công, giải phóng Thăng Long (1285); năm 1288 bố trí bãi cọc ngầm trên sông Bạch Đằng, tiêu diệt thủy quân của Ô Mã Nhi. Mất ngày 5/10/1300 (năm sinh chưa thống nhất); dân gian tôn là Đức Thánh Trần.', NULL, 'Theo hồ sơ danh tướng của dự án; năm sinh để trống vì các nguồn chưa thống nhất.', 'tran hung dao tran quoc tuan; quoc cong tiet che; hung dao dai vuong tong chi huy quan doi trong hai cuoc khang chien 1285 va 1287 – 1288; tac gia hich tuong si va binh thu yeu luoc') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_figures (slug, name, honorific, figure_group, birth_year, death_year, role_text, biography, famous_quote, source_note, search_text) VALUES ('tran-quang-khai', 'Trần Quang Khải', 'Chiêu Minh Đại vương; Thượng tướng Thái sư', 'general', 1241, 1294, 'Thượng tướng Thái sư, Thừa tướng; chỉ huy trận Chương Dương (1285)', 'Con thứ ba vua Trần Thái Tông, đại thần đầu triều qua ba đời vua. Năm 1285 ông giữ mặt trận Thanh Hóa – Nghệ An rồi chỉ huy đánh tan quân Nguyên ở Chương Dương, giải phóng Thăng Long. Ông còn giỏi thơ, có tập Lạc đạo và bài "Tụng giá hoàn kinh sư".', 'Đoạt sáo Chương Dương độ, Cầm hồ Hàm Tử quan.', 'Theo hồ sơ danh tướng của dự án; cần đối chiếu nguồn.', 'tran quang khai chieu minh dai vuong; thuong tuong thai su thuong tuong thai su, thua tuong; chi huy tran chuong duong (1285)') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_figures (slug, name, honorific, figure_group, birth_year, death_year, role_text, biography, famous_quote, source_note, search_text) VALUES ('tran-binh-trong', 'Trần Bình Trọng', 'Bảo Nghĩa hầu; truy phong Bảo Nghĩa vương', 'general', 1259, 1285, 'Danh tướng chỉ huy quân Thánh Dực chặn quân Nguyên truy đuổi hai vua Trần (1285)', 'Sinh ở xã Bảo Thái (nay thuộc Ninh Bình), dòng dõi Lê Hoàn. Được giao giữ vùng Đà Mạc – Thiên Mạc để chặn quân Nguyên, nhờ đó quân Nguyên mất dấu bộ chỉ huy kháng chiến. Bị bắt và dụ hàng, ông không khuất phục rồi hy sinh khi mới 26 tuổi.', 'Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!', 'Theo hồ sơ danh tướng của dự án; cần đối chiếu nguồn.', 'tran binh trong bao nghia hau; truy phong bao nghia vuong danh tuong chi huy quan thanh duc chan quan nguyen truy duoi hai vua tran (1285)') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_figures (slug, name, honorific, figure_group, birth_year, death_year, role_text, biography, famous_quote, source_note, search_text) VALUES ('tran-nhat-duat', 'Trần Nhật Duật', 'Chiêu Văn vương', 'general', 1255, 1330, 'Chỉ huy trận thắng lớn ở Hàm Tử (1285); sau là Thái úy Quốc công, Tể tướng', 'Con thứ sáu vua Trần Thái Tông, hoàng tử hiếu học, thông thạo tiếng Tống, tiếng Chiêm Thành. Năm 1285 ông đón đánh quân Nguyên ở Hàm Tử; năm 1287 – 1288 chỉ huy quân giữ mặt trận phía Việt Trì.', NULL, 'Theo hồ sơ danh tướng của dự án; cần đối chiếu nguồn.', 'tran nhat duat chieu van vuong chi huy tran thang lon o ham tu (1285); sau la thai uy quoc cong, te tuong') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_figures (slug, name, honorific, figure_group, birth_year, death_year, role_text, biography, famous_quote, source_note, search_text) VALUES ('tran-quoc-toan', 'Trần Quốc Toản', 'Hoài Văn hầu; truy tặng Hoài Văn vương', 'general', NULL, NULL, 'Thiếu niên tôn thất nhà Trần, dựng cờ "Phá cường địch, báo hoàng ân"', 'Năm 1282, vì còn nhỏ không được dự Hội nghị Bình Than, ông bóp nát quả cam trong tay, về huy động hơn nghìn gia nô, thân tộc dựng lá cờ sáu chữ vàng. Năm 1285 ông luôn đi đầu trong các trận phản công ở Hàm Tử – Tây Kết và Chương Dương. Năm sinh, năm mất chưa được sử cũ thống nhất.', 'Phá cường địch, báo hoàng ân.', 'Theo hồ sơ danh tướng của dự án; năm sinh – mất để trống vì các nguồn chưa thống nhất.', 'tran quoc toan hoai van hau; truy tang hoai van vuong thieu nien ton that nha tran, dung co "pha cuong dich, bao hoang an"') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_figures (slug, name, honorific, figure_group, birth_year, death_year, role_text, biography, famous_quote, source_note, search_text) VALUES ('tran-khanh-du', 'Trần Khánh Dư', 'Nhân Huệ vương', 'general', NULL, 1339, 'Phó đô tướng quân trấn giữ Vân Đồn; tiêu diệt đoàn thuyền lương Trương Văn Hổ (1288)', 'Quê Chí Linh (Hải Dương), cháu nội Trần Thủ Độ. Từng bị tước hết quan tước, phải về Chí Linh bán than; vua Nhân Tông gặp ông ở bến Bình Than, tha tội và phục chức. Đầu năm 1288 ông phục kích ở Vân Đồn, khiến quân Nguyên thiếu lương: bước ngoặt cuộc chiến lần thứ ba. Năm sinh còn nghi vấn nên để trống.', NULL, 'Theo hồ sơ danh tướng của dự án; cần đối chiếu nguồn.', 'tran khanh du nhan hue vuong pho do tuong quan tran giu van don; tieu diet doan thuyen luong truong van ho (1288)') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_figures (slug, name, honorific, figure_group, birth_year, death_year, role_text, biography, famous_quote, source_note, search_text) VALUES ('yet-kieu', 'Yết Kiêu', 'Phạm Hữu Thế; gia tướng của Hưng Đạo Vương', 'general', 1242, 1303, 'Đô soái thủy quân, gia tướng trung thành của Trần Hưng Đạo, giỏi bơi lặn', 'Tên thật Phạm Hữu Thế, quê làng Hạ Bì (nay thuộc Hải Phòng). Toàn thư chép ông giữ thuyền ở bãi Tân chờ chủ tướng; dân gian kể ông lặn xuống đục thủng thuyền giặc trong đêm. Vua Trần cho lập đền thờ ở Hạ Bì.', NULL, 'Theo hồ sơ danh tướng của dự án; phần giai thoại cần phân biệt với chính sử.', 'yet kieu pham huu the; gia tuong cua hung dao vuong do soai thuy quan, gia tuong trung thanh cua tran hung dao, gioi boi lan') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_figures (slug, name, honorific, figure_group, birth_year, death_year, role_text, biography, famous_quote, source_note, search_text) VALUES ('pham-ngu-lao', 'Phạm Ngũ Lão', 'Điện súy Thượng tướng quân; Quan nội hầu', 'general', 1255, 1320, 'Danh tướng nhà Trần, lập công trong cả hai cuộc kháng chiến 1285 và 1287 – 1288; tác giả bài thơ "Thuật hoài"', 'Người làng Phù Ủng (nay thuộc Hưng Yên). Giai thoại kể ông ngồi đan sọt, mải nghĩ việc binh đến nỗi bị giáo đâm vào đùi cũng không hay nên được Hưng Đạo Vương trọng dụng. Từ năm 1290 ông cai quản quân Thánh Dực.', NULL, 'Theo hồ sơ danh tướng của dự án; phần giai thoại cần phân biệt với chính sử.', 'pham ngu lao dien suy thuong tuong quan; quan noi hau danh tuong nha tran, lap cong trong ca hai cuoc khang chien 1285 va 1287 – 1288; tac gia bai tho "thuat hoai"') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_figures (slug, name, honorific, figure_group, birth_year, death_year, role_text, biography, famous_quote, source_note, search_text) VALUES ('ngot-luong-hop-thai', 'Ngột Lương Hợp Thai', NULL, 'other', NULL, NULL, 'Tướng Mông Cổ chỉ huy quân xâm lược Đại Việt năm 1258', 'Chỉ huy đạo quân Mông Cổ tiến vào Đại Việt tháng 1/1258, bị đánh bại ở Đông Bộ Đầu.', NULL, 'Theo kho tri thức của dự án; cần đối chiếu nguồn.', 'ngot luong hop thai tuong mong co chi huy quan xam luoc dai viet nam 1258') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_figures (slug, name, honorific, figure_group, birth_year, death_year, role_text, biography, famous_quote, source_note, search_text) VALUES ('thoat-hoan', 'Thoát Hoan', NULL, 'other', NULL, NULL, 'Chủ tướng quân Nguyên xâm lược Đại Việt năm 1285 và 1287 – 1288', 'Tháng 6/1285, khi tháo chạy qua Vạn Kiếp, vì sợ bị trúng tên tẩm thuốc độc của quân dân nhà Trần, ông chui vào ống đồng đặt trên xe cho lính kéo về nước. Năm 1287 – 1288 ông chỉ huy cuộc xâm lược lần thứ ba.', NULL, 'Theo kho tri thức của dự án; cần đối chiếu nguồn.', 'thoat hoan chu tuong quan nguyen xam luoc dai viet nam 1285 va 1287 – 1288') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_figures (slug, name, honorific, figure_group, birth_year, death_year, role_text, biography, famous_quote, source_note, search_text) VALUES ('toa-do', 'Toa Đô', NULL, 'other', NULL, 1285, 'Tướng Nguyên đánh lên từ phía Nam năm 1285', 'Phối hợp với Thoát Hoan đánh Đại Việt từ phía Nam; bị chém đầu trong đợt phản công tháng 5 – 6/1285.', NULL, 'Theo kho tri thức của dự án; cần đối chiếu nguồn.', 'toa do tuong nguyen danh len tu phia nam nam 1285') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_figures (slug, name, honorific, figure_group, birth_year, death_year, role_text, biography, famous_quote, source_note, search_text) VALUES ('o-ma-nhi', 'Ô Mã Nhi', NULL, 'other', NULL, NULL, 'Tướng thủy quân Nguyên, bị bắt sống ở Bạch Đằng (1288)', 'Chỉ huy thủy quân Nguyên; tháng 4/1288 bị Trần Hưng Đạo đánh tan ở sông Bạch Đằng và bị bắt sống cùng Phàn Tiếp.', NULL, 'Theo kho tri thức của dự án; cần đối chiếu nguồn.', 'o ma nhi tuong thuy quan nguyen, bi bat song o bach dang (1288)') ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.hist_sources (slug, title, kind, original_text, transliteration, translation, annotation, citation, search_text) VALUES ('tung-gia-hoan-kinh-su', 'Tụng giá hoàn kinh sư', 'tho_van', '奪槊章陽渡
擒胡鹹子關
太平須努力
萬古此江山', 'Đoạt sáo Chương Dương độ,
Cầm hồ Hàm Tử quan.
Thái bình tu nỗ lực,
Vạn cổ thử giang san.', 'Chương Dương cướp giáo giặc,
Hàm Tử bắt quân thù.
Thái bình nên gắng sức,
Non nước ấy nghìn thu.', 'Bài thơ của Trần Quang Khải làm sau chiến thắng 1285, khi theo vua trở về kinh sư. "Sáo": cây giáo dài.', 'Trần Quang Khải, "Tụng giá hoàn kinh sư" (1285). Cần đối chiếu nguồn trích dẫn gốc và người dịch trước khi kiểm chứng.', 'tung gia hoan kinh su tran quang khai, "tung gia hoan kinh su" (1285). can doi chieu nguon trich dan goc va nguoi dich truoc khi kiem chung.') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_sources (slug, title, kind, original_text, transliteration, translation, annotation, citation, search_text) VALUES ('hich-tuong-si-trich-doan', 'Hịch tướng sĩ (trích đoạn)', 'hich', NULL, NULL, 'Ta thường tới bữa quên ăn, nửa đêm vỗ gối, ruột đau như cắt, nước mắt đầm đìa; chỉ giận chưa thể lột da, ăn gan, uống máu quân thù. Dẫu cho trăm thân này phơi ngoài nội cỏ, nghìn xác này gói trong da ngựa, ta cũng vui lòng.', 'Do Trần Quốc Tuấn soạn (tên chữ: Dụ chư tỳ tướng hịch văn) khoảng năm 1284 để khích lệ tướng sĩ. Chỉ là trích đoạn bản dịch phổ biến.', 'Trần Quốc Tuấn, Hịch tướng sĩ. Cần đối chiếu bản gốc chữ Hán và bản dịch được dùng trong sách giáo khoa trước khi kiểm chứng.', 'hich tuong si (trich doan) tran quoc tuan, hich tuong si. can doi chieu ban goc chu han va ban dich duoc dung trong sach giao khoa truoc khi kiem chung.') ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.hist_terms (slug, term, definition, search_text) VALUES ('thai-thuong-hoang', 'Thái thượng hoàng', 'Vua đã nhường ngôi cho con nhưng vẫn cùng coi việc nước. Nhà Trần thường để vua nhường ngôi sớm cho con và làm Thái thượng hoàng để kèm cặp người kế vị; ví dụ Trần Thái Tông, Trần Thánh Tông.', 'thai thuong hoang') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_terms (slug, term, definition, search_text) VALUES ('tiet-che', 'Quốc công Tiết chế', 'Chức tổng chỉ huy quân đội. Năm 1283, Trần Quốc Tuấn được vua Trần Nhân Tông phong làm Quốc công Tiết chế để thống lĩnh quân đội kháng chiến.', 'quoc cong tiet che') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_terms (slug, term, definition, search_text) VALUES ('hich-tuong-si', 'Hịch tướng sĩ', 'Bài hịch do Trần Quốc Tuấn soạn khoảng năm 1284 để khích lệ tướng sĩ, phê phán lối sống hưởng thụ, nêu cao quyết tâm đánh giặc và khuyên luyện tập theo Binh thư yếu lược.', 'hich tuong si') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_terms (slug, term, definition, search_text) VALUES ('vuon-khong-nha-trong', 'Vườn không nhà trống', 'Kế sách sơ tán toàn bộ nhân dân và lương thực khỏi nơi giặc tiến đến, khiến giặc không cướp được lương ăn, rơi vào đói kiệt và hoang mang.', 'vuon khong nha trong') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_terms (slug, term, definition, search_text) VALUES ('sat-that', 'Sát Thát', 'Hai chữ (殺韃) nghĩa là "giết giặc Thát" (người Mông Cổ). Nhiều quân sĩ nhà Trần xăm hai chữ này lên cánh tay để thể hiện quyết tâm đánh giặc.', 'sat that') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_terms (slug, term, definition, search_text) VALUES ('ngu-binh-u-nong', 'Ngụ binh ư nông', 'Chính sách "gửi binh ở nhà nông": thời bình, binh lính được luân phiên về quê làm ruộng; khi có chiến tranh, triều đình điều động họ ra trận.', 'ngu binh u nong') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_terms (slug, term, definition, search_text) VALUES ('coc-ngam', 'Cọc ngầm', 'Hàng cọc nhọn đóng dưới lòng sông, chìm khi nước triều lên và lộ ra khi triều rút. Năm 1288, Trần Hưng Đạo bố trí bãi cọc ngầm trên sông Bạch Đằng để chặn và phá thuyền Nguyên.', 'coc ngam') ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_terms (slug, term, definition, search_text) VALUES ('binh-thu-yeu-luoc', 'Binh thư yếu lược', 'Sách binh pháp do Trần Quốc Tuấn biên soạn từ binh pháp các nhà để dạy các tướng cách cầm quân.', 'binh thu yeu luoc') ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.hist_events (slug, name, year_from, year_to, date_text, description, significance, campaign_id, place_id, sort_order, search_text)
SELECT 'su-gia-mong-co-bi-bat-giam', 'Vua Trần cự tuyệt sứ giả Mông Cổ đòi mượn đường', 1258, NULL, 'Trước tháng 1/1258', 'Trước hành vi nghênh ngang đòi mượn đường của sứ giả Mông Cổ, vua Trần Thái Tông kiên quyết cự tuyệt, hạ lệnh bắt giam sứ giả và ban lệnh cho cả nước sẵn sàng kháng chiến.', 'Thể hiện quyết tâm bảo vệ độc lập của triều Trần ngay từ đầu.',
       (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-1-1258'), (SELECT id FROM public.hist_places WHERE slug = 'thang-long'), 1, 'vua tran cu tuyet su gia mong co doi muon duong truoc thang 1/1258'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_events (slug, name, year_from, year_to, date_text, description, significance, campaign_id, place_id, sort_order, search_text)
SELECT 'tran-binh-le-nguyen-1258', 'Trận Bình Lệ Nguyên', 1258, NULL, '17/1/1258', 'Vua Trần Thái Tông thân chinh đón đánh quân Mông Cổ ở Bình Lệ Nguyên; tướng Lê Tần (Lê Phụ Trần) lấy ván thuyền che tên cho vua và khuyên vua rút lui bảo toàn lực lượng.', 'Rút lui có chủ đích để bảo toàn lực lượng, chuẩn bị cho kế sách "Vườn không nhà trống".',
       (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-1-1258'), (SELECT id FROM public.hist_places WHERE slug = 'binh-le-nguyen'), 2, 'tran binh le nguyen 17/1/1258'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_events (slug, name, year_from, year_to, date_text, description, significance, campaign_id, place_id, sort_order, search_text)
SELECT 'vuon-khong-nha-trong-1258', 'Kế sách "Vườn không nhà trống" ở Thăng Long', 1258, NULL, 'Tháng 1/1258', 'Triều đình và nhân dân sơ tán toàn bộ người và lương thực khỏi kinh thành Thăng Long, làm giặc không cướp được lương ăn, rơi vào cảnh đói kiệt và hoang mang.', 'Làm suy yếu sức bền của quân Mông Cổ trước khi phản công.',
       (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-1-1258'), (SELECT id FROM public.hist_places WHERE slug = 'thang-long'), 3, 'ke sach "vuon khong nha trong" o thang long thang 1/1258'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_events (slug, name, year_from, year_to, date_text, description, significance, campaign_id, place_id, sort_order, search_text)
SELECT 'dai-thang-dong-bo-dau-1258', 'Đại thắng Đông Bộ Đầu', 1258, NULL, '29/1/1258', 'Quân Trần phản công đánh tan quân Mông Cổ tại bến Đông Bộ Đầu. Tàn quân tháo chạy qua Quy Hóa bị chủ trại Hà Khuất chặn đánh tan tác.', 'Kết thúc thắng lợi cuộc kháng chiến lần thứ nhất chỉ trong chưa đầy một tháng.',
       (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-1-1258'), (SELECT id FROM public.hist_places WHERE slug = 'dong-bo-dau'), 4, 'dai thang dong bo dau 29/1/1258'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_events (slug, name, year_from, year_to, date_text, description, significance, campaign_id, place_id, sort_order, search_text)
SELECT 'hoi-nghi-binh-than-1282', 'Hội nghị Bình Than', 1282, NULL, 'Tháng 10/1282', 'Vua Trần Nhân Tông triệu tập vương hầu, trăm quan họp ở bến Bình Than bàn kế đánh giặc. Trần Quốc Toản còn nhỏ không được dự, bóp nát quả cam trong tay.', 'Thống nhất ý chí đánh giặc của vương hầu, quan lại trước cuộc xâm lược thứ hai; năm 1283 Trần Quốc Tuấn được phong Quốc công Tiết chế.',
       (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-2-1285'), (SELECT id FROM public.hist_places WHERE slug = 'binh-than'), 1, 'hoi nghi binh than thang 10/1282'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_events (slug, name, year_from, year_to, date_text, description, significance, campaign_id, place_id, sort_order, search_text)
SELECT 'hoi-nghi-dien-hong-1285', 'Hội nghị Diên Hồng', 1285, NULL, 'Đầu năm 1285', 'Thượng hoàng Trần Thánh Tông triệu tập các bậc bô lão cả nước họp ở điện Diên Hồng, hỏi "Nên đánh hay nên hòa?". Muôn người đồng thanh hô vang một tiếng "ĐÁNH!".', 'Biểu tượng của khối đại đoàn kết toàn dân trong kháng chiến.',
       (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-2-1285'), (SELECT id FROM public.hist_places WHERE slug = 'dien-hong'), 2, 'hoi nghi dien hong dau nam 1285'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_events (slug, name, year_from, year_to, date_text, description, significance, campaign_id, place_id, sort_order, search_text)
SELECT 'tran-binh-trong-da-mac-1285', 'Trần Bình Trọng chặn giặc ở Đà Mạc', 1285, NULL, 'Tháng 2/1285', 'Trần Bình Trọng chặn quân Nguyên để bảo vệ hai vua Trần rút lui. Bị bắt và dụ hàng phong vương, ông khẳng khái từ chối rồi hy sinh.', 'Giúp bộ chỉ huy kháng chiến rút lui an toàn để bảo toàn lực lượng.',
       (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-2-1285'), (SELECT id FROM public.hist_places WHERE slug = 'da-mac'), 3, 'tran binh trong chan giac o da mac thang 2/1285'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_events (slug, name, year_from, year_to, date_text, description, significance, campaign_id, place_id, sort_order, search_text)
SELECT 'tong-phan-cong-ham-tu-chuong-duong-1285', 'Tổng phản công Tây Kết – Hàm Tử – Chương Dương', 1285, NULL, 'Tháng 5 – 6/1285', 'Quân Trần đại phản công ở Tây Kết, Hàm Tử, Chương Dương. Trần Nhật Duật thắng lớn ở Hàm Tử, Trần Quang Khải đại phá giặc ở Chương Dương, giải phóng Thăng Long; Toa Đô bị chém đầu.', 'Bước ngoặt đánh bật quân Nguyên khỏi kinh thành.',
       (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-2-1285'), (SELECT id FROM public.hist_places WHERE slug = 'chuong-duong'), 4, 'tong phan cong tay ket – ham tu – chuong duong thang 5 – 6/1285'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_events (slug, name, year_from, year_to, date_text, description, significance, campaign_id, place_id, sort_order, search_text)
SELECT 'thoat-hoan-chui-ong-dong-1285', 'Thoát Hoan chui ống đồng tháo chạy', 1285, NULL, 'Tháng 6/1285', 'Khi tháo chạy qua Vạn Kiếp, vì quá sợ bị trúng tên tẩm thuốc độc của quân dân nhà Trần, Thoát Hoan chui vào ống đồng đặt trên xe cho lính kéo về nước.', 'Kết thúc thất bại của cuộc xâm lược lần thứ hai.',
       (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-2-1285'), (SELECT id FROM public.hist_places WHERE slug = 'van-kiep'), 5, 'thoat hoan chui ong dong thao chay thang 6/1285'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_events (slug, name, year_from, year_to, date_text, description, significance, campaign_id, place_id, sort_order, search_text)
SELECT 'hai-chien-van-don-1288', 'Hải chiến Vân Đồn', 1288, NULL, 'Cuối 12/1287 – đầu 1/1288', 'Nhân Huệ vương Trần Khánh Dư phục kích đánh đắm và thu giữ đoàn thuyền chở lương của Trương Văn Hổ.', 'Quân Nguyên thiếu lương, buộc phải rút lui: bước ngoặt của cuộc kháng chiến lần thứ ba.',
       (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-3-1287-1288'), (SELECT id FROM public.hist_places WHERE slug = 'van-don'), 1, 'hai chien van don cuoi 12/1287 – dau 1/1288'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_events (slug, name, year_from, year_to, date_text, description, significance, campaign_id, place_id, sort_order, search_text)
SELECT 'dai-thang-bach-dang-1288', 'Đại thắng Bạch Đằng', 1288, NULL, 'Tháng 4/1288', 'Trần Hưng Đạo bố trí bãi cọc ngầm trên sông Bạch Đằng, nhử thuyền giặc vào lúc triều lên rồi tổng công kích khi triều rút; đánh chìm và bắt sống thủy quân giặc, bắt sống Ô Mã Nhi và Phàn Tiếp.', 'Đập tan hoàn toàn mộng xâm lược của nhà Nguyên.',
       (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-3-1287-1288'), (SELECT id FROM public.hist_places WHERE slug = 'bach-dang'), 2, 'dai thang bach dang thang 4/1288'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.hist_battles (slug, name, year, date_text, context, forces, course, result, campaign_id, place_id, event_id, minigame_key, sort_order, search_text)
SELECT 'dong-bo-dau', 'Trận Đông Bộ Đầu', 1258, '29/1/1258', 'Quân Mông Cổ vào Thăng Long trống không, thiếu lương, đói kiệt sau kế sách "Vườn không nhà trống".', 'Quân Mông Cổ do Ngột Lương Hợp Thai chỉ huy (3 vạn người theo kho tri thức của dự án) và quân Trần do vua Trần Thái Tông chỉ huy.', 'Đêm 28/1/1258, vua Trần Thái Tông cùng Thái tử Trần Hoảng ngự lâu thuyền đánh vào Đông Bộ Đầu; quân Trần phản công buộc giặc bỏ Thăng Long.', 'Quân Trần thắng lợi, tàn quân Mông Cổ chạy qua Quy Hóa bị chặn đánh.',
       (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-1-1258'), (SELECT id FROM public.hist_places WHERE slug = 'dong-bo-dau'), (SELECT id FROM public.hist_events WHERE slug = 'dai-thang-dong-bo-dau-1258'),
       'dong_bo_dau', 1, 'tran dong bo dau 29/1/1258'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_battles (slug, name, year, date_text, context, forces, course, result, campaign_id, place_id, event_id, minigame_key, sort_order, search_text)
SELECT 'ham-tu', 'Trận Hàm Tử', 1285, 'Tháng 5 – 6/1285', 'Trong cuộc tổng phản công mùa hè 1285, quân Trần đón đánh quân Nguyên ở Hàm Tử.', NULL, 'Trần Nhật Duật chỉ huy trận đánh; theo hồ sơ danh tướng của dự án, ông đưa cả người Tống cũ vào đội hình.', 'Quân Trần thắng lớn ở Hàm Tử.',
       (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-2-1285'), (SELECT id FROM public.hist_places WHERE slug = 'ham-tu'), (SELECT id FROM public.hist_events WHERE slug = 'tong-phan-cong-ham-tu-chuong-duong-1285'),
       'ham_tu', 2, 'tran ham tu thang 5 – 6/1285'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_battles (slug, name, year, date_text, context, forces, course, result, campaign_id, place_id, event_id, minigame_key, sort_order, search_text)
SELECT 'chuong-duong', 'Trận Chương Dương', 1285, 'Tháng 5 – 6/1285', 'Mở đường giải phóng Thăng Long trong cuộc tổng phản công 1285.', NULL, 'Trần Quang Khải chỉ huy, cùng Phạm Ngũ Lão và Trần Quốc Toản đánh quân Nguyên ở Chương Dương, đốt cháy hoặc chiếm phần lớn chiến thuyền địch.', 'Đại phá giặc ở Chương Dương, giải phóng Thăng Long.',
       (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-2-1285'), (SELECT id FROM public.hist_places WHERE slug = 'chuong-duong'), (SELECT id FROM public.hist_events WHERE slug = 'tong-phan-cong-ham-tu-chuong-duong-1285'),
       'chuong_duong', 3, 'tran chuong duong thang 5 – 6/1285'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_battles (slug, name, year, date_text, context, forces, course, result, campaign_id, place_id, event_id, minigame_key, sort_order, search_text)
SELECT 'tay-ket', 'Trận Tây Kết', 1285, 'Tháng 5 – 6/1285', 'Một trận trong cuộc tổng phản công mùa hè 1285. Chưa có mô tả chi tiết, cần bổ sung và kiểm chứng.', NULL, NULL, NULL,
       (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-2-1285'), (SELECT id FROM public.hist_places WHERE slug = 'tay-ket'), (SELECT id FROM public.hist_events WHERE slug = 'tong-phan-cong-ham-tu-chuong-duong-1285'),
       'tay_ket', 4, 'tran tay ket thang 5 – 6/1285'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_battles (slug, name, year, date_text, context, forces, course, result, campaign_id, place_id, event_id, minigame_key, sort_order, search_text)
SELECT 'van-don', 'Trận Vân Đồn', 1288, 'Cuối 12/1287 – đầu 1/1288', 'Quân Nguyên xâm lược lần thứ ba dựa vào đoàn thuyền lương của Trương Văn Hổ.', NULL, 'Trần Khánh Dư, trấn giữ cửa biển Vân Đồn, phục kích đoàn thuyền lương.', 'Đánh đắm và thu giữ đoàn thuyền lương; quân Nguyên thiếu lương.',
       (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-3-1287-1288'), (SELECT id FROM public.hist_places WHERE slug = 'van-don'), (SELECT id FROM public.hist_events WHERE slug = 'hai-chien-van-don-1288'),
       'van_don', 5, 'tran van don cuoi 12/1287 – dau 1/1288'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.hist_battles (slug, name, year, date_text, context, forces, course, result, campaign_id, place_id, event_id, minigame_key, sort_order, search_text)
SELECT 'bach-dang', 'Trận Bạch Đằng', 1288, 'Tháng 4/1288', 'Thủy quân Nguyên rút theo đường sông Bạch Đằng sau khi thiếu lương.', NULL, 'Đóng cọc ngầm → nhử thuyền giặc vào khi triều lên → đợi nước triều rút → tổng tấn công.', 'Đánh chìm và bắt sống thủy quân giặc, bắt sống Ô Mã Nhi và Phàn Tiếp.',
       (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-3-1287-1288'), (SELECT id FROM public.hist_places WHERE slug = 'bach-dang'), (SELECT id FROM public.hist_events WHERE slug = 'dai-thang-bach-dang-1288'),
       'bach_dang', 6, 'tran bach dang thang 4/1288'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-1-1258' AND b.slug = 'tran-thai-tong'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-1-1258' AND b.slug = 'tran-thu-do'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-1-1258' AND b.slug = 'le-phu-tran'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-1-1258' AND b.slug = 'ngot-luong-hop-thai'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-2-1285' AND b.slug = 'tran-thanh-tong'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-2-1285' AND b.slug = 'tran-nhan-tong'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-2-1285' AND b.slug = 'tran-hung-dao'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-2-1285' AND b.slug = 'tran-quang-khai'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-2-1285' AND b.slug = 'tran-binh-trong'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-2-1285' AND b.slug = 'tran-nhat-duat'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-2-1285' AND b.slug = 'tran-quoc-toan'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-2-1285' AND b.slug = 'pham-ngu-lao'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-2-1285' AND b.slug = 'thoat-hoan'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-2-1285' AND b.slug = 'toa-do'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-3-1287-1288' AND b.slug = 'tran-nhan-tong'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-3-1287-1288' AND b.slug = 'tran-hung-dao'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-3-1287-1288' AND b.slug = 'tran-khanh-du'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-3-1287-1288' AND b.slug = 'yet-kieu'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-3-1287-1288' AND b.slug = 'pham-ngu-lao'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-3-1287-1288' AND b.slug = 'tran-nhat-duat'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-3-1287-1288' AND b.slug = 'thoat-hoan'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'campaign', a.id, 'figure', b.id FROM public.hist_campaigns a, public.hist_figures b WHERE a.slug = 'khang-chien-lan-3-1287-1288' AND b.slug = 'o-ma-nhi'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'su-gia-mong-co-bi-bat-giam' AND b.slug = 'tran-thai-tong'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'tran-binh-le-nguyen-1258' AND b.slug = 'tran-thai-tong'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'tran-binh-le-nguyen-1258' AND b.slug = 'le-phu-tran'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'vuon-khong-nha-trong-1258' AND b.slug = 'tran-thu-do'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'dai-thang-dong-bo-dau-1258' AND b.slug = 'tran-thai-tong'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'dai-thang-dong-bo-dau-1258' AND b.slug = 'ngot-luong-hop-thai'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'hoi-nghi-binh-than-1282' AND b.slug = 'tran-nhan-tong'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'hoi-nghi-binh-than-1282' AND b.slug = 'tran-hung-dao'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'hoi-nghi-binh-than-1282' AND b.slug = 'tran-quoc-toan'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'hoi-nghi-dien-hong-1285' AND b.slug = 'tran-thanh-tong'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'tran-binh-trong-da-mac-1285' AND b.slug = 'tran-binh-trong'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'tong-phan-cong-ham-tu-chuong-duong-1285' AND b.slug = 'tran-nhat-duat'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'tong-phan-cong-ham-tu-chuong-duong-1285' AND b.slug = 'tran-quang-khai'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'tong-phan-cong-ham-tu-chuong-duong-1285' AND b.slug = 'pham-ngu-lao'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'tong-phan-cong-ham-tu-chuong-duong-1285' AND b.slug = 'tran-quoc-toan'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'tong-phan-cong-ham-tu-chuong-duong-1285' AND b.slug = 'toa-do'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'thoat-hoan-chui-ong-dong-1285' AND b.slug = 'thoat-hoan'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'hai-chien-van-don-1288' AND b.slug = 'tran-khanh-du'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'dai-thang-bach-dang-1288' AND b.slug = 'tran-hung-dao'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'dai-thang-bach-dang-1288' AND b.slug = 'o-ma-nhi'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'figure', b.id FROM public.hist_events a, public.hist_figures b WHERE a.slug = 'dai-thang-bach-dang-1288' AND b.slug = 'pham-ngu-lao'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'battle', a.id, 'figure', b.id FROM public.hist_battles a, public.hist_figures b WHERE a.slug = 'dong-bo-dau' AND b.slug = 'tran-thai-tong'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'battle', a.id, 'figure', b.id FROM public.hist_battles a, public.hist_figures b WHERE a.slug = 'dong-bo-dau' AND b.slug = 'ngot-luong-hop-thai'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'battle', a.id, 'figure', b.id FROM public.hist_battles a, public.hist_figures b WHERE a.slug = 'ham-tu' AND b.slug = 'tran-nhat-duat'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'battle', a.id, 'figure', b.id FROM public.hist_battles a, public.hist_figures b WHERE a.slug = 'ham-tu' AND b.slug = 'tran-quoc-toan'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'battle', a.id, 'figure', b.id FROM public.hist_battles a, public.hist_figures b WHERE a.slug = 'chuong-duong' AND b.slug = 'tran-quang-khai'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'battle', a.id, 'figure', b.id FROM public.hist_battles a, public.hist_figures b WHERE a.slug = 'chuong-duong' AND b.slug = 'pham-ngu-lao'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'battle', a.id, 'figure', b.id FROM public.hist_battles a, public.hist_figures b WHERE a.slug = 'chuong-duong' AND b.slug = 'tran-quoc-toan'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'battle', a.id, 'figure', b.id FROM public.hist_battles a, public.hist_figures b WHERE a.slug = 'tay-ket' AND b.slug = 'tran-quoc-toan'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'battle', a.id, 'figure', b.id FROM public.hist_battles a, public.hist_figures b WHERE a.slug = 'van-don' AND b.slug = 'tran-khanh-du'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'battle', a.id, 'figure', b.id FROM public.hist_battles a, public.hist_figures b WHERE a.slug = 'bach-dang' AND b.slug = 'tran-hung-dao'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'battle', a.id, 'figure', b.id FROM public.hist_battles a, public.hist_figures b WHERE a.slug = 'bach-dang' AND b.slug = 'o-ma-nhi'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'figure', a.id, 'source', b.id FROM public.hist_figures a, public.hist_sources b WHERE a.slug = 'tran-quang-khai' AND b.slug = 'tung-gia-hoan-kinh-su'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'event', a.id, 'source', b.id FROM public.hist_events a, public.hist_sources b WHERE a.slug = 'tong-phan-cong-ham-tu-chuong-duong-1285' AND b.slug = 'tung-gia-hoan-kinh-su'
ON CONFLICT DO NOTHING;
INSERT INTO public.hist_links (a_type, a_id, b_type, b_id)
SELECT 'figure', a.id, 'source', b.id FROM public.hist_figures a, public.hist_sources b WHERE a.slug = 'tran-hung-dao' AND b.slug = 'hich-tuong-si-trich-doan'
ON CONFLICT DO NOTHING;

-- Phiên bản 1 của mỗi bản ghi khởi tạo (để xem lịch sử, so sánh và khôi phục); định dạng bằng với phiên bản backend lưu khi sửa.
INSERT INTO public.hist_versions (entity, entity_id, version_no, action, snapshot, links, note)
SELECT 'campaign', t.id, 1, 'create', to_jsonb(t) - ARRAY['id','version_no','search_text','verified_by','verified_at','published_by','published_at','created_by','created_at','updated_by','updated_at'], '{}'::jsonb, 'Dữ liệu khởi tạo từ nội dung dự án'
FROM public.hist_campaigns t WHERE NOT EXISTS (SELECT 1 FROM public.hist_versions v WHERE v.entity = 'campaign' AND v.entity_id = t.id);
INSERT INTO public.hist_versions (entity, entity_id, version_no, action, snapshot, links, note)
SELECT 'figure', t.id, 1, 'create', to_jsonb(t) - ARRAY['id','version_no','search_text','verified_by','verified_at','published_by','published_at','created_by','created_at','updated_by','updated_at'], '{}'::jsonb, 'Dữ liệu khởi tạo từ nội dung dự án'
FROM public.hist_figures t WHERE NOT EXISTS (SELECT 1 FROM public.hist_versions v WHERE v.entity = 'figure' AND v.entity_id = t.id);
INSERT INTO public.hist_versions (entity, entity_id, version_no, action, snapshot, links, note)
SELECT 'event', t.id, 1, 'create', to_jsonb(t) - ARRAY['id','version_no','search_text','verified_by','verified_at','published_by','published_at','created_by','created_at','updated_by','updated_at'], '{}'::jsonb, 'Dữ liệu khởi tạo từ nội dung dự án'
FROM public.hist_events t WHERE NOT EXISTS (SELECT 1 FROM public.hist_versions v WHERE v.entity = 'event' AND v.entity_id = t.id);
INSERT INTO public.hist_versions (entity, entity_id, version_no, action, snapshot, links, note)
SELECT 'place', t.id, 1, 'create', to_jsonb(t) - ARRAY['id','version_no','search_text','verified_by','verified_at','published_by','published_at','created_by','created_at','updated_by','updated_at'], '{}'::jsonb, 'Dữ liệu khởi tạo từ nội dung dự án'
FROM public.hist_places t WHERE NOT EXISTS (SELECT 1 FROM public.hist_versions v WHERE v.entity = 'place' AND v.entity_id = t.id);
INSERT INTO public.hist_versions (entity, entity_id, version_no, action, snapshot, links, note)
SELECT 'battle', t.id, 1, 'create', to_jsonb(t) - ARRAY['id','version_no','search_text','verified_by','verified_at','published_by','published_at','created_by','created_at','updated_by','updated_at'], '{}'::jsonb, 'Dữ liệu khởi tạo từ nội dung dự án'
FROM public.hist_battles t WHERE NOT EXISTS (SELECT 1 FROM public.hist_versions v WHERE v.entity = 'battle' AND v.entity_id = t.id);
INSERT INTO public.hist_versions (entity, entity_id, version_no, action, snapshot, links, note)
SELECT 'source', t.id, 1, 'create', to_jsonb(t) - ARRAY['id','version_no','search_text','verified_by','verified_at','published_by','published_at','created_by','created_at','updated_by','updated_at'], '{}'::jsonb, 'Dữ liệu khởi tạo từ nội dung dự án'
FROM public.hist_sources t WHERE NOT EXISTS (SELECT 1 FROM public.hist_versions v WHERE v.entity = 'source' AND v.entity_id = t.id);
INSERT INTO public.hist_versions (entity, entity_id, version_no, action, snapshot, links, note)
SELECT 'term', t.id, 1, 'create', to_jsonb(t) - ARRAY['id','version_no','search_text','verified_by','verified_at','published_by','published_at','created_by','created_at','updated_by','updated_at'], '{}'::jsonb, 'Dữ liệu khởi tạo từ nội dung dự án'
FROM public.hist_terms t WHERE NOT EXISTS (SELECT 1 FROM public.hist_versions v WHERE v.entity = 'term' AND v.entity_id = t.id);
