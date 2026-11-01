# Đối chiếu ver0.1 và ver0.2 (Sprint 5–8) và các điểm cần chốt

Ngày lập: 01/11/2026. Nguồn: `fuction list/HaoKhiDongA_DanhSachChucNang_ver0.1 (1).xlsx` và `fuction list/HaoKhiDongA_DanhSachChucNang_ver0.2.xlsx`.

## 1. Kết quả đối chiếu

- Không mất chức năng nào: 348/348 mã của ver0.1 vẫn còn ở ver0.2. Sprint 1–4 và 9–12 giữ nguyên hoàn toàn.
- Ver0.2 thêm 60 mã mới và sửa 10 mã. Số chức năng mỗi sprint: S5 = 43, S6 = 45, S7 = 44, S8 = 38; tổng 408. Các con số này khớp với sheet "Quy ước & Sprint" và sheet "Thay đổi ver0.2".
- Những chỗ còn mơ hồ nằm bên trong ver0.2 (mục 2). Mỗi điểm dưới đây có: vấn đề là gì, ví dụ cho dễ hình dung, cách tôi xử lý mặc định khi làm, và cách sửa gợi ý trong Excel.

## 2. Các điểm cần làm rõ

### A. Có nhắc tới nhưng không có chức năng nào định nghĩa

**A1. "Binh thư" (loại tiền mới)**

- Vấn đề: bốn chức năng nhắc tới Binh thư (HS.120 rương, HS.127 nâng cấp thẻ, HS.056 kết quả trận, SYS.021 đồng bộ học–game) nhưng không chức năng nào nói Binh thư là gì, kiếm thế nào, xem ở đâu, tốn bao nhiêu để nâng cấp.
- Ví dụ: học sinh mở rương được "5 Binh thư". Em xem số Binh thư ở đâu? Nâng thẻ Trần Hưng Đạo từ cấp 2 lên cấp 3 tốn bao nhiêu Binh thư? Giáo viên hay quản trị viên đổi con số này ở đâu?
- Mặc định tôi làm: Binh thư là tài nguyên học tập, chỉ dùng để nâng cấp thẻ tướng (Sprint 6), không mua được bằng vàng hay tiền thật. Kiếm khi hoàn thành nút lần đầu (số lượng theo loại nút), mở rương, thắng trận. Có sổ cái riêng như vàng, không âm, hiện trên thanh thông tin cạnh vàng. Quản trị viên tổng đặt mức mặc định theo loại nút trong "Cấu hình trò chơi hóa" và đặt riêng cho từng nút. Chi phí nâng cấp theo cấp nằm ở HK.AD.048 (Sprint 6).
- Sửa Excel gợi ý: thêm một dòng vào HK.HS.013 (hồ sơ/thanh thông tin): "hiển thị số Binh thư"; thêm vào HK.AD.054 (cấu hình trò chơi hóa): "số Binh thư theo loại nút"; HK.AD.048: "Binh thư cần cho mỗi cấp".

**A2. "Nhật ký hành quân"**

- Vấn đề: HS.116 nói xem lại hội thoại cốt truyện "trong Nhật ký hành quân" nhưng không chức năng nào mô tả mục này.
- Ví dụ: học sinh lỡ tua nhanh đoạn Trần Thủ Độ nói "Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo". Nhật ký ở đâu để đọc lại?
- Mặc định tôi làm (Sprint 6): Nhật ký hành quân là danh sách các đoạn hội thoại em đã xem, nằm trong màn bản đồ hành quân, bấm vào để xem lại; không cần chức năng riêng, gộp vào HS.116.
- Sửa Excel gợi ý: ghi rõ ở mô tả HS.116 "Nhật ký hành quân = danh sách đoạn hội thoại đã xem, xem lại được".

**A3. Chế độ "Đánh trùm cả lớp"**

- Vấn đề 1 – không có chỗ quản lý trùm: GV.101 cho chọn trùm (Thoát Hoan, Ô Mã Nhi…) và "máu trùm tự tính theo sĩ số" nhưng không nói trùm lấy từ đâu và công thức máu.
- Vấn đề 2 – kết quả/bục/báo cáo chưa nói đến trùm: các chức năng kết quả từng câu (HS.082, GV.054), bục vinh quang (HS.083, GV.055), báo cáo (GV.056) và đồng bộ thời gian thực (SYS.016) chỉ mô tả thi đua giữa các học sinh, chưa nói khi đánh trùm thì hiện gì.
- Ví dụ: lớp 40 em đánh trùm Thoát Hoan. Trùm có bao nhiêu máu? Kết thúc là "cả lớp thắng/thua" hay vẫn có bục top 3? Báo cáo có cột "sát thương gây ra" không?
- Mặc định tôi làm (Sprint 8): trùm lấy từ danh sách chỉ huy địch có sẵn trong Sổ tay chỉ huy (HS.130) và HK.AD.084; máu trùm = số học sinh trong phòng × 100 × 3 (ghi rõ để chỉnh); câu đúng gây sát thương = điểm câu đúng nhanh/chậm; câu sai làm cả đội mất máu. Kết thúc: cả lớp thắng nếu máu trùm về 0 trước khi hết câu. Vẫn có bục top 3 theo sát thương gây ra; báo cáo thêm cột "sát thương" và dòng "kết quả: thắng/thua trùm"; SYS.016 phát thanh máu trùm theo thời gian thực.
- Sửa Excel gợi ý: bổ sung 1 dòng AD "Quản lý danh sách trùm và công thức máu" (hoặc ghi chú trong AD.084), và thêm ý "khi đánh trùm" vào mô tả HS.082–083, GV.054–056, SYS.016.

**A4. Giới hạn thời gian chơi game**

- Vấn đề: giáo viên đặt "giới hạn thời gian chơi mỗi ngày" (GV.060, theo lớp) và quản trị viên trường đặt "khung giờ + tối đa mỗi ngày" (QT.056, toàn trường), nhưng không chức năng nào đếm giờ thật, không có màn hình báo cho học sinh, và không nói cấp nào thắng khi các cấp đặt khác nhau.
- Ví dụ: trường cho chơi tối đa 30 phút/ngày, lớp 7A cho 60 phút. Em 7A được chơi bao nhiêu? Hết giờ thì màn hình hiện gì? Giờ reset lúc nào?
- Mặc định tôi làm (Sprint 6–7): áp dụng giá trị nhỏ nhất trong ba cấp (hệ thống, trường, lớp); máy chủ đếm thời gian chơi trong ngày theo giờ Việt Nam, reset 00:00; khi hết giờ hoặc ngoài khung giờ, vào game thấy màn "Hôm nay em đã chơi đủ thời gian" (học và làm bài vẫn bình thường).
- Sửa Excel gợi ý: thêm 1 chức năng SYS "Kiểm soát thời gian chơi theo ngày" và 1 chức năng HS "Xem thông báo hết giờ chơi"; ghi trong GV.060/QT.056 "áp dụng giá trị nhỏ nhất".

**A5. Giáo viên "chơi thử" trận đánh và mini-game**

- Vấn đề: sheet Phân quyền cho giáo viên ✅ "chơi thử" trận đánh/mini-game nhưng không có chức năng giáo viên nào cho việc này; GV.025 chỉ là xem trước hành trình.
- Ví dụ: cô giáo muốn thử trận Bạch Đằng trước khi giao cho lớp nhưng không biết bấm ở đâu.
- Mặc định tôi làm (Sprint 6–7): trên trang giáo viên có nút "Chơi thử" cho mỗi trận đánh và mini-game, chạy ở chế độ xem trước (không ghi tiến độ, điểm, thẻ).
- Sửa Excel gợi ý: thêm 1 chức năng GV "Chơi thử trận đánh và mini-game".

**A6. Tắt game cho toàn hệ thống**

- Vấn đề: ma trận Phân quyền cho quản trị viên tổng bật/tắt tính năng toàn hệ thống, nhưng công cụ duy nhất là cờ tính năng AD.071 nằm ở Sprint 11, sau khi game ra mắt ở Sprint 6.
- Mặc định tôi làm (Sprint 6): có một công tắc "Bật game mô phỏng" trong Cấu hình trò chơi hóa của quản trị viên tổng; AD.071 ở Sprint 11 sẽ gom lại thành cờ tính năng.
- Sửa Excel gợi ý: ghi chú ở AD.054 hoặc AD.071 để khớp.

### B. Mức ưu tiên chưa nhất quán

**B1. HS.140 "Vào lại phòng khi rớt mạng" đang là Trung bình.**

- Lý do nên là Cao: khóa phòng tự động mặc định bật (GV.096) và GV.095, SYS.023 là Cao. Nếu em rớt mạng sau khi trận bắt đầu mà không vào lại được thì em bị mất phần thi.
- Mặc định tôi làm: làm HS.140 cùng lúc với khóa phòng (coi như Cao).

**B2. HS.141 "Xin vào phòng khóa" là Thấp, còn GV.097 "Duyệt vào muộn" là Trung bình.**

- Hai bên là một cặp: học sinh xin, giáo viên duyệt. Nên cùng mức.
- Mặc định tôi làm: coi cả hai là Trung bình.

### C. Thứ tự sprint

**C1. Rương và "Bộ thẻ" ở Sprint 5 trong khi thẻ tướng sang Sprint 6.**

- Vấn đề: HS.120 (S5) nói rương cho "mảnh thẻ tướng" và HS.125 (S5) có mục "Bộ thẻ", nhưng hệ thống mảnh thẻ chỉ có ở S6.
- Mặc định tôi làm: ở Sprint 5 rương cho vàng và Binh thư; mảnh thẻ bật lên ở Sprint 6. Mục "Bộ thẻ" giữ lại và dùng bộ sưu tập thẻ hiện có (đã làm ở bản ver0.1), nâng cấp thành thẻ tướng ở S6; không ẩn đi vì chức năng đã chạy.

**C2. Nút "Tạo" bằng AI trong soạn Quiz (GV.086, S8) cần GV.038 (S9).**

- Mặc định tôi làm: ẩn nút này ở S8, hiện khi làm S9.

**C3. Sprint 6 quá nặng.**

- Số liệu: S6 có 45 chức năng, trong đó 27 mức Cao (ver0.1 chỉ có 7). So sánh: S5 có 19 Cao, S7 có 22, S8 có 24. Gồm cả động cơ đánh thẻ theo lượt, bản đồ hành quân, quản trị nội dung, tài nguyên đồ họa và Sa bàn 3D.
- Gợi ý chia: giữ ở S6 phần lõi (bản đồ hành quân, thẻ tướng, đánh thẻ theo lượt 2D, SYS.021, SYS.022, AD.081–085); chuyển Sa bàn 3D (HS.137), GV.084 và AD.086 (cân bằng/chạy thử) sang cuối S6 hoặc đầu S7 nếu thiếu thời gian. Mặc định tôi làm: làm S6 theo đúng thứ tự trên, 3D làm sau cùng.

### D. Những điểm chưa rõ

**D1. Loại câu hỏi trong Quiz tương tác.** GV.088 chỉ nêu 2 loại (Trắc nghiệm 4 lựa chọn, Đúng/Sai), trong khi ngân hàng câu hỏi (Sprint 4) có 6 loại (1 đáp án, nhiều đáp án, đúng/sai, điền khuyết, sắp xếp, kéo thả bản đồ).

- Mặc định tôi làm: Quiz tương tác dùng được cả 6 loại; riêng chế độ nút hình–màu ▲◆●■ (HS.139) áp dụng cho các loại có 2–4 đáp án chọn; các loại còn lại học sinh làm trên màn hình thiết bị.

**D2. Mặc định hiện hay ẩn câu hỏi trên máy học sinh.** HS.081 (ver0.1) nói câu hỏi hiện đồng bộ trên máy học sinh, còn HS.139 và GV.100 nói chỉ hiện trên màn chiếu để chống tra cứu.

- Mặc định tôi làm: mặc định ẩn (máy học sinh chỉ có nút hình–màu); giáo viên bật "Hiện câu hỏi trên máy học sinh" cho học từ xa (đúng như ghi chú của HS.139).

**D3. Một tài khoản vào từ 2 thiết bị (GV.098) so với vào lại khi rớt mạng (HS.140).**

- Ví dụ: em rớt mạng, mở lại trên điện thoại khác. Máy cũ có còn "đang kết nối" trong phòng không?
- Mặc định tôi làm: thiết bị vào sau thắng, máy cũ bị ngắt khỏi phòng kèm thông báo; nhờ vậy em vẫn vào lại được còn một tài khoản không thể đồng thời dùng 2 máy.

## 3. Tác động lên phần đã code

| Sprint | Việc mới theo ver0.2 | Trạng thái |
|---|---|---|
| 5 | Lộ trình dạng đường đi (HS.117–125, AD.080), thẻ chuyển sang S6 | Đang làm theo tài liệu này |
| 6 | 27 chức năng: bản đồ hành quân, thẻ tướng nâng cấp, đánh thẻ theo lượt, 3D, quản trị nội dung | Chưa làm |
| 7 | GV.083, GV.084, sửa GV.060 | Chưa làm |
| 8 | 22 chức năng: soạn Quiz, khóa phòng, duyệt vào muộn, chống tra cứu, Đánh trùm; đảo ngược việc cho vào muộn | Chưa làm |
