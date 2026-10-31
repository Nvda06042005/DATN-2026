# Tiến độ xây dựng Hào Khí Đông A (theo mã HK.*)

Nguồn: `fuction list/HaoKhiDongA_DanhSachChucNang_ver0.1 (1).xlsx` (348 chức năng, 12 sprint). Tài liệu này ghi **Sprint 1 đến Sprint 4**
(141 chức năng) đã làm được gì, quyết định đã chọn khi đặc tả chưa nói rõ, và những gì cố ý chưa làm. Phân tích đối chiếu ban đầu: `DOI_CHIEU_HAO_KHI_V01.md`.

Kiểm thử: `cd backend && npm run build && npm test` (PostgreSQL tạm, HTTP thật; 118 bài, gồm migration trên dữ liệu cũ, Sprint 1–4, quản trị trường, kho lịch sử, chấm điểm, nội dung học mẫu);
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

## Sprint 3 – học sinh học trên bản đồ hành trình, đọc kho lịch sử (32 chức năng)

| Mã | Trạng thái | Ghi chú |
| --- | --- | --- |
| HK.HS.017/018 | Xong | Trang chủ ba cuộc kháng chiến: năm, địa danh tiêu biểu, % hoàn thành, sao; điểm, **chuỗi ngày học** (tính từ nhật ký học tập, chưa có việc chạy 0h và đóng băng chuỗi: Sprint 5); gợi ý nút kế tiếp và luyện câu đã sai |
| HK.HS.019 | Xong | Bản đồ nhiệm vụ gồm các nút nối tiếp (bài học, câu hỏi, trận đánh, tư liệu, Quyết chiến), avatar ở nút hiện tại. Dựng bằng thành phần React Native (không dùng SVG/Canvas); vị trí nút theo thứ tự, kéo thả vị trí và nhánh rẽ thuộc Sprint 7 (HK.GV.022) |
| HK.HS.020, HK.SYS.007 | Xong | Hoàn thành nút (đạt điểm tối thiểu) mới mở nút sau; trận Quyết chiến luôn ở cuối; tư liệu mở khi hoàn thành nút gắn với nó. Trạng thái mở khóa tính ở máy chủ khi đọc, không tin dữ liệu từ trình duyệt |
| HK.HS.021/022 | Xong | Chi tiết nút: loại, mục tiêu, thưởng, sao, điểm cao nhất, tư liệu sẽ mở. Sao: chưa đạt 0; đạt ngưỡng 1; đúng từ 80% thì 2; đúng tuyệt đối hoặc đúng từ 90% và dùng không quá 70% thời gian thì 3; chơi lại để tăng sao |
| HK.HS.023 | Một phần | Mỗi nút của hành trình đang học là một nhiệm vụ (đang làm / đã xong / chưa mở, điều kiện, thưởng). Nhiệm vụ hằng ngày, hằng tuần là HK.HS.024 (Sprint 5) |
| HK.HS.025/026 | Xong | Dòng thời gian sự kiện và trận đánh; lọc theo cuộc kháng chiến, nhân vật, địa điểm (API còn lọc theo năm, giao diện chưa có ô năm) |
| HK.HS.027 | Xong (web) | Bản đồ Leaflet + OpenStreetMap: bấm điểm xem địa danh, sự kiện, trận đánh, tư liệu. Trên điện thoại chỉ hiện danh sách địa danh |
| HK.HS.029/030 | Xong | Bài học gồm khối văn bản, hình, video (liên kết mở ngoài, chưa nhúng), bản đồ; thời lượng và tiến độ đọc (lưu ở máy chủ, chỉ tăng); hoàn thành khi đọc hết và đúng mọi câu kiểm tra nhanh (làm lại không giới hạn); sao 3 nếu đúng ngay lần đầu, 2 nếu sai trước đó |
| HK.HS.031/032/034 | Xong | Hồ sơ nhân vật (vua, tướng, quan, khác), sự kiện, địa điểm kèm nhân vật/trận đánh/tư liệu liên quan; chỉ nội dung **Công bố** |
| HK.HS.033 | Một phần | Hồ sơ trận đánh đủ bối cảnh, lực lượng, diễn biến, kết quả, bản đồ; mini-game tương ứng chưa có (Sprint 6, cột `minigame_key` đã chuẩn bị) |
| HK.HS.035/036 | Xong | Tìm không dấu trên nhân vật, sự kiện, địa điểm, trận đánh, tư liệu, thuật ngữ; từ điển thuật ngữ |
| HK.HS.037 | Xong | Một ghi chú riêng cho mỗi bài học hoặc tư liệu đã mở khóa |
| HK.HS.038–042 | Xong | Danh sách tư liệu với trạng thái khóa/mở (tư liệu khóa chỉ lộ tên và nút cần hoàn thành, **không lộ nội dung** kể cả trong tìm kiếm), lọc theo cuộc kháng chiến, loại, nhân vật, trạng thái, yêu thích; chi tiết nguyên văn – phiên âm – dịch nghĩa – chú giải – nguồn; yêu thích |
| HK.GV.018 | Xong | Thư viện hành trình mẫu của hệ thống và của trường (chỉ bản đã phát hành), xem nội dung từng nút |
| HK.GV.019 | Xong | Tạo trống hoặc từ mẫu cùng cuộc kháng chiến; giao cho lớp mình phụ trách (việc giao tự phát hành, phải đủ điều kiện). Học sinh trong lớp học theo hành trình giao mới nhất của cuộc kháng chiến đó, nếu không có thì theo hành trình mặc định của hệ thống. Ảnh nền hiển thị đầu bản đồ. Xếp lịch bắt đầu/kết thúc và nhiều hành trình cùng lúc: HK.GV.026 (Sprint 7) |
| HK.GV.020/021 | Xong | Thêm nút theo loại, nội dung chọn từ kho (bài học đã công bố, bộ đề của mình/trường/hệ thống, trận đánh, tư liệu); sửa, đổi thứ tự bằng nút mũi tên, xóa nút chưa có học sinh hoàn thành; khi đã có học sinh hoàn thành thì chỉ đổi tên, biểu tượng, mục tiêu, điểm thưởng |
| HK.AD.043 | Xong | Quản trị tổng soạn hành trình mẫu cho ba cuộc kháng chiến; phát hành (nội dung liên quan phải đã công bố, bộ câu hỏi không rỗng); đặt hành trình **mặc định** (mỗi cuộc kháng chiến một hành trình, phải kết thúc bằng Quyết chiến) |
| HK.AD.044 | Xong | Soạn bài học bằng khối nội dung (văn bản, hình, video, bản đồ chọn tọa độ), gắn dữ liệu lịch sử và tối đa 3 câu kiểm tra nhanh; nháp → công bố. Trình soạn là danh sách khối, chưa phải trình soạn văn bản có định dạng |
| HK.SYS.014 | Xong | Nhật ký sự kiện học tập (`hk_events`): trả lời, bắt đầu/kết thúc làm bài, hoàn thành nút và bài học, xem bài/tư liệu/nhân vật/sự kiện/trận đánh/địa điểm/bản đồ/dòng thời gian, tìm kiếm. Chỉ ghi cho học sinh, chưa có báo cáo hay AI đọc (các sprint sau) |

## Sprint 4 – ngân hàng câu hỏi, bộ đề, làm bài (24 chức năng)

| Mã | Trạng thái | Ghi chú |
| --- | --- | --- |
| HK.HS.043/044 | Xong | Làm bài ở nút: mỗi lần một câu, số câu và điểm hiện tại. Sáu dạng: một đáp án, nhiều đáp án, đúng/sai, điền khuyết, sắp xếp thứ tự (nút mũi tên), kéo thả địa danh lên bản đồ (chạm vào bản đồ để đặt; chỉ bản web). Máy chủ giữ đề, chấm điểm và chỉ gửi đáp án **sau khi đã trả lời** |
| HK.HS.045 | Xong | Đồng hồ mỗi câu (mặc định 20 giây, bộ đề/câu có thể đặt riêng) do máy chủ tính; trả lời muộn quá 3 giây ân hạn bị tính hết giờ; đúng và nhanh được thưởng tối đa nửa điểm gốc của câu. Đồng hồ câu kế chỉ chạy khi học sinh bấm sang câu |
| HK.HS.046 | Xong | Sau mỗi câu: đúng/sai/hết giờ (có chữ và biểu tượng, không chỉ màu), đáp án đúng, giải thích, mục lịch sử liên quan (chỉ mục đã công bố); sau bài: tổng kết, xem lại từng câu |
| HK.HS.048 | Xong (phần điểm) | Các câu sai gom lại; luyện tối đa 10 câu mỗi lượt, làm đúng thì gỡ khỏi danh sách và cộng 10 điểm (một lần cho mỗi lần sai). "Hồi tim" thuộc cơ chế tim HK.HS.047 (Sprint 5) |
| HK.HS.049 | Xong | Lịch sử làm bài có phân trang, điểm, đúng/sai, thời gian, xem lại từng câu |
| HK.HS.050 | Xong | Quyết chiến cuối chiến dịch: đạt từ 70% (đặt riêng được) mới hoàn thành; hoàn thành nút cuối là hoàn thành chiến dịch |
| HK.GV.030/031 | Xong | Danh sách theo kho (của tôi / trường / hệ thống) và theo chủ đề; lọc theo từ khóa không dấu, cuộc kháng chiến, dạng, độ khó, mục lịch sử gắn kèm; phân trang |
| HK.GV.032/033 | Xong | Tạo/sửa đủ sáu dạng; kiểm tra cấu trúc ở máy chủ (số lựa chọn, đáp án đúng, số chỗ trống khớp đề, địa danh trong khung Việt Nam…); mỗi lần sửa có đổi nội dung sinh một phiên bản, xem được lịch sử |
| HK.GV.034 | Xong | Chỉ xóa câu do mình soạn trong kho riêng, chưa nằm trong bộ đề, bài học và chưa có học sinh trả lời |
| HK.GV.035/036 | Xong | Nhập Excel theo mẫu (một đáp án, nhiều đáp án, đúng/sai, điền khuyết, sắp xếp) có xem trước báo lỗi từng dòng, lưu các dòng hợp lệ; xuất danh sách đã lọc. Dạng kéo thả bản đồ chỉ tạo trên giao diện |
| HK.GV.037 | Xong | Gắn câu hỏi với cuộc kháng chiến, nhân vật, sự kiện, địa điểm, trận đánh, tư liệu; lọc theo liên kết. Thống kê điểm yếu theo chủ đề sẽ dùng nhật ký sự kiện ở sprint báo cáo |
| HK.GV.039, HK.QT.041 | Xong | Giáo viên gửi câu hỏi/bộ đề/hành trình vào kho trường; quản trị viên trường xem nội dung, duyệt (nội dung được **sao** sang kho trường, bản của giáo viên giữ nguyên) hoặc từ chối kèm lý do bắt buộc; gửi lại sau khi bị từ chối; rút lại khi còn chờ. Bộ đề/hành trình được sao kèm các câu hỏi riêng của giáo viên |
| HK.GV.040–044 | Xong | Danh sách bộ đề (số câu, thời gian, số hành trình đang dùng, số lượt làm); tạo (chọn câu, thứ tự, điểm 10–1000, giây riêng, xáo trộn câu/đáp án, điểm đạt); **khóa chỉnh sửa khi đang nằm trong hành trình đã phát hành hoặc đã có học sinh làm** (nhân bản để sửa); xóa bộ đề chưa dùng; nhân bản; làm thử như học sinh (không ghi tiến độ, điểm, câu sai) |
| HK.QT.042 | Xong | Quản trị viên trường tạo, xem, sửa, xóa hành trình mẫu của trường; duyệt hành trình giáo viên chia sẻ |
| HK.AD.045 | Xong | Quản trị tổng soạn kho câu hỏi và bộ đề hệ thống, nhập/xuất Excel, duyệt nội dung các trường đề xuất (quản trị viên trường đề xuất từ kho trường lên hệ thống) |

Nội dung học khởi tạo (migration 019): 27 câu hỏi (đủ sáu dạng), 9 bộ đề, 3 bài học và 3 hành trình mẫu cho ba cuộc kháng chiến, chỉ dùng sự kiện đã có trong
kho lịch sử của migration 016. **Bài học và hành trình ở trạng thái Nháp**: học sinh chưa thấy gì cho đến khi quản trị tổng (cùng giáo viên Lịch sử) đối chiếu với sách giáo khoa,
công bố nội dung lịch sử liên quan, công bố bài học rồi phát hành và đặt mặc định ba hành trình. Kiểm thử `seed.spec.ts` chạy trọn quy trình đó và để một học sinh hoàn thành cả ba hành trình.

## Quyết định khi đặc tả chưa nói rõ

- **Quản trị tổng cấp 2 (HK.AD.020):** có cột `admin_level`. Cấp 2 quản lý quản trị viên trường học nhưng không tạo/sửa/khóa/xóa quản trị tổng, không tạo hay xóa trường. Ma trận RBAC thực sự (HK.AD.026) thuộc Sprint 11.
- **"Chưa phát sinh dữ liệu" (HK.AD.016/025, HK.QT.021/032):** tài khoản đã đăng nhập, có tiến độ học, có thao tác trong nhật ký, hoặc giáo viên đang được phân công lớp thì chỉ khóa được. Trường đã có lớp, giáo viên/học sinh, hoặc quản trị viên đã dùng hệ thống thì chỉ vô hiệu hóa được. Thay cho thùng rác 45 ngày của bản cũ.
- **Mật khẩu tạm:** sinh ngẫu nhiên, hiện một lần cho người tạo và gửi qua hàng đợi email (bcrypt cost 8 cho lô lớn); thư bị hủy nếu người dùng đã đổi mật khẩu.
- **Mật khẩu lớp cũ (migration 012):** thay bằng mã tham gia; cột `join_password_hash` còn trong CSDL nhưng không dùng nữa.
- **Ba kho nội dung (Sprint 4):** câu hỏi, bộ đề, hành trình thuộc kho giáo viên, kho trường hoặc kho hệ thống. Giáo viên chỉ sửa nội dung của mình trong kho riêng; kho trường do quản trị viên trường duyệt; kho hệ thống do quản trị tổng. Duyệt = sao nội dung sang kho đích để người gửi vẫn tự sửa bản của mình.
- **Học sinh học theo hành trình nào:** mỗi cuộc kháng chiến một hành trình – hành trình giáo viên giao cho lớp mới nhất, nếu không có thì hành trình mặc định của hệ thống. Tiến độ tính theo từng nút nên đổi hành trình thì tiến độ riêng.
- **Chống gian lận:** máy chủ giữ danh sách câu, đồng hồ, đáp án và chấm điểm; bản chụp câu hỏi được lưu theo lượt nên sửa câu hỏi giữa chừng không làm sai lượt đang làm. Điểm làm bài chỉ cộng phần vượt kỷ lục cũ nên chơi lại không "cày" điểm; sổ điểm có khóa duy nhất cho mỗi khoản thưởng.
- **Bộ đề không có trạng thái nháp/công bố:** dùng quy tắc khóa theo việc sử dụng (hành trình đã phát hành hoặc đã có học sinh làm). Hành trình của giáo viên tự phát hành khi giao cho lớp.
- **Cột lớp học sinh `class_name` và giáo viên `teacher_id` cũ:** để nguyên (không xóa dữ liệu); mã mới chỉ đọc bảng thành viên / giáo viên–lớp.

## Triển khai và dữ liệu hiện có

- Cập nhật trang công khai ngày 31/10/2026: toàn bộ ghi công bản đồ/ảnh được chuyển khỏi Điều khoản sử dụng sang `/thong-tin-hinh-anh`, mở từ footer chung. Trang riêng dùng `InfoShell`, nền và Manrope/Newsreader như Điều khoản sử dụng; giữ đủ tác giả, nguồn và giấy phép. Không thay đổi database.
- Sprint 1–2 đã gộp vào `main` ngày 31/10/2026 (nhánh `feat/hao-khi-sprint-1-2`); khi đó Render và Supabase đã chạy `schema_version` 16. Sprint 3–4 (nhánh `feat/hao-khi-sprint-3-4`) được gộp vào `main` cùng ngày. Backend áp dụng migration 014–019 khi khởi động với `DATABASE_URL`; xác minh bằng `schema_version` ở `/api/database/health` (mong đợi 19 sau khi Render khởi động bản mới).
- Supabase vẫn giữ migration 001–013 đã áp dụng; 001–013 đã được khôi phục từ lịch sử Git nguyên văn (runner từ chối khi thiếu hoặc sửa file đã chạy).
- Bản cũ có các tài khoản/lớp thử; migration 014 giữ nguyên chúng (kiểm thử `014 giữ nguyên lớp...` trên dữ liệu giả): năm học được suy ra từ lớp/khối cũ (năm mới nhất = đang hoạt động, các năm trước = đã kết thúc), mỗi lớp cũ nhận mã tham gia ngẫu nhiên, giáo viên cũ được chép sang bảng giáo viên–lớp, khóa ngoại giáo viên không còn xóa lớp khi xóa tài khoản.
- Cần đặt trên Render: `DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`, gửi thư (`SMTP_URL` hoặc `MAIL_RELAY_*`), tùy chọn `GOOGLE_CLIENT_ID`; Vercel: `EXPO_PUBLIC_API_URL`, tùy chọn `EXPO_PUBLIC_GOOGLE_CLIENT_ID`.

## Chưa làm (ngoài Sprint 1–4) và đề xuất

- Từ Sprint 5: trò chơi hóa (điểm cấp độ, huy hiệu, chuỗi ngày có job 0h và đóng băng, tim, nhiệm vụ hằng ngày/tuần, bảng xếp hạng), mini-game trận đánh (Sprint 6), kéo thả vị trí nút và nhánh rẽ, điều kiện mở khóa tùy chỉnh, xếp lịch giao hành trình, tiến độ lớp trên bản đồ (Sprint 7), thi trực tiếp (Sprint 8), trợ lý AI và sinh câu hỏi bằng AI (Sprint 9–10).
- Bản cũ có game 2D, thi đấu trực tiếp, chatbot AI, BKT, thống kê: đã gỡ khỏi mã; xây lại theo sprint sau từ đặc tả mới.
- Giới hạn đã biết của Sprint 3–4: câu hỏi kéo thả bản đồ và bản đồ tương tác chỉ có trên bản web; đổi thứ tự (nút hành trình, mục sắp xếp, khối bài học) bằng nút mũi tên chứ chưa kéo thả; video trong bài học mở bằng liên kết; thông báo cho giáo viên khi nội dung được duyệt/từ chối chưa có (thông báo trong ứng dụng thuộc Sprint 11) – người gửi xem ở mục "Nội dung đã gửi".
- Cần quyết định của bạn: (1) giữ hay bỏ đăng ký tự học (HK.HS.003); (2) **giáo viên Lịch sử kiểm chứng nội dung khởi tạo** (kho lịch sử, 27 câu hỏi, 3 bài học) trước khi công bố cho học sinh; (3) kéo thả dòng thời gian/nút hành trình và tải tệp lên (cần kho lưu trữ) có làm ngay không.
- Đề xuất cho đặc tả: HK.GV.019 (Sprint 3) và HK.GV.026 (Sprint 7) trùng việc gán hành trình cho lớp (đã làm phần gán ở Sprint 3, Sprint 7 thêm lịch); HK.AD.050 cấp độ và HK.AD.066 quy tắc điểm nên chốt giá trị mặc định cùng giáo viên trước Sprint 5.
