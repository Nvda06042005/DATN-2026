# Hành trình Đông A – trang học sinh (xây dựng lại 15–16/11/2026)

Trang học sinh (`/hoc-sinh` và đường dẫn riêng của trường với `role=student`) là một vòng chơi học lịch sử về ba lần kháng chiến chống quân Mông – Nguyên (1258, 1285, 1287–1288):

**đăng nhập → chọn lớp (chưa tham gia thì nhập mã thầy cô gửi) → chọn cuộc kháng chiến → chọn chặng trên bản đồ → học kiến thức ngắn → minigame luyện tập → nhập vai khám phá và ghi nhớ → chạm trán (nếu có) → tổng kết, ôn tập → nhận thưởng, lưu tiến độ, mở chặng tiếp theo.**

Giao diện bám theo các khung hình của video giới thiệu (`HaoKhiDongA_promo_1080p_v3.mp4`); nền bản đồ là **bản đồ gốc của ba bài Wikipedia tiếng Việt** "Chiến tranh Nguyên Mông – Đại Việt lần 1 / 2 / 3" (tác giả Lưu Ly, phạm vi công cộng), không dùng bản đồ do AI vẽ.

## 1. Các mục của trang học sinh

| Mục (tab trên URL) | Nội dung |
| --- | --- |
| Chiến dịch (`chien-dich`) | Chọn cuộc kháng chiến; bản đồ chiến dịch; bảng thông tin chặng; các bước học, luyện tập, nhập vai, trận đánh, tổng kết |
| Nhập vai (`nhap-vai`) | Danh sách cảnh nhập vai và trận đánh đã mở để chơi lại |
| Câu hỏi ôn tập (`cau-hoi`) | Ôn tập tính giờ: ưu tiên câu từng sai và mục tiêu còn yếu; chuỗi đúng; thanh cấp độ |
| Tư liệu (`tu-lieu`) | Kho tư liệu: văn bản gốc (mở dần theo chặng), nhân vật, niên biểu, bản đồ; đều ghi nguồn |
| Bộ thẻ (`bo-the`) | Thẻ nhân vật đã mở, huy chương, bảng xếp hạng tuần của lớp |
| Hỏi Tiểu Tướng (`hoi`), Trợ giúp (`tro-giup`) | Trợ lý lịch sử có trích nguồn; hướng dẫn và gửi hỗ trợ |
| Kỳ thi (`ky-thi`), Tin nhắn (`tin-nhan`) | Bài kiểm tra thầy cô tổ chức; hộp thư và mã tham gia lớp |
| Khung học sinh | Logo ở menu, tên mục và trường ở thanh đầu; các chỉ số thành tích thật trên màn hình rộng, cài đặt, thông báo, hồ sơ, đăng xuất; menu có Đổi mật khẩu. Âm thanh mặc định tắt, không có nút loa trên thanh đầu |

**Giao diện hiện hành (20/11/2026):** khung riêng `StudentWorkspace`, bảng màu sáng xanh ngọc – vàng, nút có chiều sâu, sảnh chọn lớp và ba cổng chiến dịch có phong cảnh minh họa. Cấp độ, vàng, chuỗi ngày, tiến độ và nhiệm vụ lấy từ máy chủ. Các màn học dùng tiêu đề Manrope và bộ thành phần hiện có với bảng màu học sinh; giữ nguyên bản đồ gốc. Mục Khảo sát không khôi phục. Khung `AdminWorkspace` của giáo viên / quản trị giữ nguyên. Xem [thiết kế và giới hạn kiểm tra](GIAO_DIEN_HOC_SINH.md).

Mục đang mở nằm trên URL: `tab`, `c` (cuộc kháng chiến 1–3), `s` (mã số chặng), `v` (bước: `hoc`, `luyen`, `kham-pha`, `tran`, `tong-ket`). Back / Forward / tải lại giữ đúng chỗ. Mở và đóng bảng thông tin chặng, đổi bản đồ không thêm bước vào lịch sử trình duyệt; một bước chơi vừa kết thúc thì bước sau thay thế nó (không quay lại "màn kết quả cũ").

## 2. Nguyên tắc bắt buộc

- **Máy chủ quyết định mọi kết quả.** Đáp án, điểm, sao, phần thưởng, thắng thua và việc mở khóa đều tính ở máy chủ (`/api/saga`). Đề gửi cho học sinh không chứa đáp án; lời giải thích và nguồn chỉ gửi sau khi đã trả lời. Thẻ ghép cặp mang mã ngẫu nhiên theo phiên.
- **Mỗi lệnh có mã riêng và số thứ tự.** `POST /api/saga/sessions/:id/actions` nhận `{ action_id, seq, action }`. Gửi lặp (bấm hai lần, mạng chập chờn) nhận lại đúng kết quả cũ; lệnh lệch trạng thái bị từ chối (409) và giao diện tải lại trạng thái chuẩn.
- **Phần thưởng chỉ trao một lần.** Điểm và vàng đi qua sổ cái sẵn có của trò chơi hóa (`hk_points` có khóa duy nhất theo `hq:lesson:<id>`, `hq:practice:<id>`, `hq:explore:<id>`, `hq:battle:<id>`, `hq:stage:<id>`, `hq:rv:<câu>:<ngày>`). Làm lại không được thưởng lần hai.
- **Mức hiểu kiến thức tách khỏi điểm trận đánh.** Sao của chặng tính theo phần luyện tập (đạt ngưỡng: 1 sao, từ 85%: 2 sao, từ 95%: 3 sao); trận đánh có sao và điểm riêng.
- **Quyền.** `/api/saga` chỉ dành cho học sinh: học sinh chỉ đọc nội dung đã công bố và chỉ chạm được phiên, tiến độ của mình. Mục Hành trình Đông A của quản trị tổng và giáo viên đã xóa ngày 16/11/2026 (không còn API `/api/saga/admin/*`, `/api/saga/teacher/*`). Bảng dữ liệu người dùng đều bật RLS theo trường (`dong_a_workspace_scope`).
- **Dữ kiện lịch sử có nguồn; phần sáng tạo ghi rõ.** Thẻ kiến thức, câu hỏi và phần tổng kết dẫn nguồn. Nhân vật em điều khiển, nhân vật phụ, lời thoại, chỉ số và lưới ô của trận đánh là phần sáng tạo, được ghi chú ở cảnh nhập vai, màn trận và màn tổng kết.

## 3. Kiến trúc

### Cơ sở dữ liệu (migration 065, 066)

- `065_saga_journey.sql`: nội dung `hk_saga_maps` (ảnh nền, kích thước, ghi nguồn), `hk_saga_stages` (chặng: vị trí `map_x`, `map_y`, điểm địa danh `anchor_x`, `anchor_y` theo **tỉ lệ 0–1 trên ảnh**, điều kiện mở `unlock_after`, ngưỡng đạt, thưởng, nội dung JSON, phiên bản, trạng thái `draft` / `reviewed` / `published`), `hk_saga_stage_versions`, `hk_saga_items` (câu luyện tập và ôn tập), `hk_saga_cards`, `hk_saga_docs`; dữ liệu người dùng `hk_saga_progress`, `hk_saga_sessions`, `hk_saga_actions`, `hk_saga_answers`, `hk_saga_review`, `hk_saga_user_cards`. Tất cả bật RLS; bảng nội dung chỉ đọc với vai trò phạm vi trường; bảng người dùng theo quy tắc chủ sở hữu trong trường; có lưu kho dữ liệu đã xóa (`app_install_delete_archives()`).
- `066_seed_saga_journey.sql`: nội dung khởi tạo gồm 3 bản đồ, 13 chặng (3 + 6 + 4), 79 câu (33 trắc nghiệm, 14 quyết định chiến thuật, 12 xếp trình tự, 12 ghép cặp, 8 chọn địa điểm), 13 thẻ nhân vật, 14 mục tư liệu (8 văn bản, 6 mốc niên biểu) và 5 huy hiệu. Tệp sinh từ `backend/scripts/saga-seed/` (đã kiểm tra bằng đúng các hàm chuẩn hóa của máy chủ). **Không sinh lại migration đã áp dụng**: sửa nội dung qua trang quản trị, hoặc soạn thêm rồi sinh một migration số mới (`cd backend && npm run build && node scripts/saga-seed/build.cjs <số> <tên>`).

### Máy chủ (`backend/src/saga/`)

| Tệp | Vai trò |
| --- | --- |
| `practice.ts` | Năm mẫu minigame: kiểm tra dữ liệu, dạng gửi cho học sinh (không đáp án), chấm điểm, tổng kết lượt |
| `explore.ts` | Cảnh nhập vai: kiểm tra kịch bản, các bước nhiệm vụ, xử lý tương tác, đếm gợi ý và lần sai |
| `tactics.ts` | Trận đánh theo lượt: binh chủng, khắc chế, hàng trước / sau, quân lương, kỹ năng, mưu kế, máy điều khiển quân địch |
| `bachdang.ts` | Màn Bạch Đằng 1288: con nước, đóng cọc, nhử địch theo vệt nước, mắc cạn, phản công, kết quả và lời giải thích |
| `content.ts` | Cấu trúc nội dung một chặng (mục tiêu, thẻ kiến thức, nguồn, cảnh, trận, tổng kết) |
| `saga.service.ts`, `saga.controller.ts` | Tiến độ, khóa chặng, phiên chơi, lệnh, phần thưởng, ôn tập, bộ thẻ, kho tư liệu |

API chính (đều cần đăng nhập): `GET /api/saga/home`, `GET /campaigns/:no`, `GET /stages/:id`, `GET /stages/:id/lesson`, `POST /stages/:id/lesson/complete`, `POST /stages/:id/practice|explore|battle`, `GET /stages/:id/summary`, `GET /sessions/:id`, `POST /sessions/:id/actions`, `GET /review`, `POST /review/start`, `GET /cards`, `GET /archive` (học sinh); `GET /teacher/classes/:classId` (giáo viên, quản trị trường); `GET /admin/overview`, `GET /admin/stages/:id`, `PUT /admin/maps/:no`, `PUT /admin/stages/:id/position`, `PUT /admin/stages/:id`, `PATCH /admin/stages/:id/status`, `PUT /admin/items/:id` (quản trị tổng).

Thứ tự trong một chặng do máy chủ giữ: luyện tập cần học xong; nhập vai cần đạt ngưỡng luyện tập (mặc định 70%); trận đánh lần đầu chỉ mở khi cảnh nhập vai đang ở bước chạm trán; chặng sau mở khi chặng điều kiện hoàn thành. Gọi thẳng API không vượt được các điều kiện này.

### Giao diện (`frontend/`)

| Tệp | Vai trò |
| --- | --- |
| `components/portal/StudentApp.tsx` | Khung trang: `AdminWorkspace` (menu bên trái, thanh trên cùng), điều hướng theo URL, thông báo "Lên cấp" |
| `components/portal/SagaKit.tsx` | Phần riêng của trò chơi: màu trạng thái chặng và ba cuộc kháng chiến, chân dung và huy chương (tranh tự vẽ bằng SVG), ô phương án, thanh tiến độ, nguồn tham khảo, phím tắt; đầu trang dùng `PageHeader` của trang quản trị |
| `components/portal/SagaHome.tsx` | Chọn cuộc kháng chiến, bản đồ chiến dịch, bảng thông tin chặng, mục Nhập vai |
| `components/portal/SagaLearn.tsx` | Thẻ kiến thức, năm mẫu minigame, tổng kết và nhận thưởng |
| `components/portal/SagaPlay.tsx` | Nhập vai, trận đánh theo lượt, màn Bạch Đằng (nối với game Phaser) |
| `components/portal/SagaExtras.tsx` | Câu hỏi ôn tập, Bộ thẻ và bảng xếp hạng, Kho tư liệu |
| `components/portal/GameViewport.web.tsx` | Khung chứa game: **một khung một game Phaser**, nạp động, hủy sạch khi rời màn |
| `game/*.ts` | Ba cảnh Phaser (nhập vai, chiến trường, khúc sông Bạch Đằng), tranh điểm ảnh vẽ bằng mã, cầu nối sự kiện với React |
| `lib/saga-api.ts`, `types/saga.ts`, `lib/saga-sound.ts` | Gọi API, kiểu dữ liệu, âm thanh tổng hợp (mặc định tắt) |

Phaser 3.90 chỉ nằm trong một gói tải riêng (khoảng 1,5 MB), nạp khi học sinh mở cảnh nhập vai hoặc trận đánh; các trang khác không tải. Chữ tiếng Việt luôn do React hiển thị (canvas chỉ có hình và con số). React và Phaser trao đổi theo sự kiện qua `GameBridge`, không cập nhật React theo từng khung hình. Mỗi lần chuyển mục, màn cũ không còn được xem sẽ gỡ hết nội dung nên lúc nào cũng chỉ có một game đang chạy.

## 4. Nội dung khởi tạo

| # | Lần | Chặng | Thời gian | Loại | Trận đánh | Thẻ nhân vật |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | I | Bình Lệ Nguyên | 17/1/1258 | Trận đánh | Trụ vững ở Bình Lệ Nguyên | Lê Phụ Trần |
| 2 | I | Vườn không nhà trống | 18 – 27/1/1258 | Kế sách | không | Trần Thủ Độ |
| 3 | I | Đông Bộ Đầu | Đêm 28/1/1258 | Trận đánh | Đánh úp Đông Bộ Đầu | Trần Thái Tông |
| 4 | II | Hội nghị Bình Than | Cuối năm 1282 | Hội nghị | không | Trần Quốc Toản |
| 5 | II | Hội nghị Diên Hồng | Đầu năm 1285 | Hội nghị | không | Trần Thánh Tông |
| 6 | II | Rút lui chiến lược | Tháng 2/1285 | Kế sách | Chặn giặc ở bãi Đà Mạc | Trần Bình Trọng |
| 7 | II | Hàm Tử | Tháng 5/1285 | Trận đánh | Trận Hàm Tử | Trần Nhật Duật |
| 8 | II | Chương Dương | Tháng 6/1285 | Trận đánh | Trận Chương Dương | Trần Quang Khải |
| 9 | II | Tây Kết | 24/6/1285 | Trận đánh | Trận Tây Kết | Trần Nhân Tông |
| 10 | III | Thế giặc năm nay dễ phá | Năm 1287 | Chuẩn bị | không | Phạm Ngũ Lão |
| 11 | III | Vân Đồn | Cuối 12/1287 – đầu 1/1288 | Trận đánh | Trận Vân Đồn | Trần Khánh Dư |
| 12 | III | Giặc cạn lương ở Vạn Kiếp | Tháng 2 – 3/1288 | Kế sách | không | Nguyễn Khoái |
| 13 | III | Bạch Đằng | 9/4/1288 | Trận đánh | Trận Bạch Đằng 1288 (ba giai đoạn) | Trần Hưng Đạo |

Mỗi chặng có 4–5 thẻ kiến thức (ai, ở đâu, khi nào, vì sao, diễn biến), 6–7 câu luyện tập, một cảnh nhập vai 7 bước trở xuống và phần tổng kết có nguồn. Chặng đầu của mỗi cuộc kháng chiến mở sẵn; các chặng sau mở lần lượt.

**Nguồn đã đối chiếu** (tải ngày 15/11/2026): ba bài "Chiến tranh Nguyên Mông – Đại Việt lần 1 / 2 / 3", bài "Trận Bạch Đằng (1288)" và các bài nhân vật của Wikipedia tiếng Việt; hai bài của Bảo tàng Lịch sử quốc gia ("Cọc Bạch Đằng", "Trận thủy chiến Bạch Đằng: Những mảnh ghép"). Liên kết nằm trong từng thẻ, từng câu hỏi và phần tổng kết.

**Chỗ các nguồn chép khác nhau thì không khẳng định**: người chỉ huy trận Tây Kết (không nêu tên), hoàn cảnh Trần Quốc Toản mất, chuyện Thoát Hoan chui ống đồng (ghi "tương truyền"). Không dùng lời trích dài của Hịch tướng sĩ vì chưa đối chiếu được bản dịch.

**Cần giáo viên Lịch sử rà lại.** Nội dung do nhóm phát triển biên soạn từ các nguồn trên và đang ở trạng thái Công bố để trang học sinh dùng được ngay; mỗi chặng có ghi chú duyệt nói rõ điều này. Giáo viên rà xong có thể ghi chú và đổi trạng thái ở trang quản trị.

## 5. Năm mẫu minigame (dùng lại cho mọi chặng)

| Dạng (`kind`) | Cách chơi | Chấm điểm |
| --- | --- | --- |
| `quiz` | Trắc nghiệm 2–4 phương án (phím 1–4 hoặc A–D) | Đúng 1, sai 0 |
| `tactic` | Tình huống, chọn quyết định; mỗi phương án có phản hồi | Tốt nhất 1, tạm được 0,5, sai 0 |
| `sequence` | Xếp trình tự bằng nút lên / xuống (không cần kéo thả) | Đúng cả chuỗi 1, còn lại 0 |
| `pairs` | Lật thẻ rồi ghép một thẻ mỗi cột | Sai tối đa 2 lần: 1; tối đa 5 lần: 0,5; hơn nữa: 0 |
| `locate` | Chọn điểm đánh chữ trên bản đồ của cuộc kháng chiến (hoặc nút chữ) | Đúng 1, sai 0 |

Ngưỡng đạt của lượt luyện tập là cột `pass_percent` của chặng (mặc định 70). Câu trả lời sai vào danh sách ôn; trả lời đúng ở mục Câu hỏi thì ra khỏi danh sách. Đồng hồ ôn tập do máy chủ giữ và chỉ chạy khi câu được mở (đọc lời giải thích của câu trước không bị trừ giờ; trình duyệt bỏ qua bước báo mở câu cũng không né được đồng hồ).

## 6. Cảnh nhập vai

Cảnh là lưới 22 × 13 ô nhìn từ trên xuống (làng, doanh trại, bến sông, thềm điện, bãi đóng cọc). Di chuyển bằng W A S D hoặc phím mũi tên, hoặc chạm vào nơi muốn tới (nhân vật tự tìm đường); tới gần người / vật rồi nhấn E / Enter hoặc bấm nút hiện trên cảnh. Các loại bước: `talk` (nghe lệnh), `find` (tìm đúng người theo mô tả), `pickup`, `give`, `ask` (nhắc lại điều đã nghe), `zone` (đi tới một vùng), `battle` (chạm vùng địch, mở trận). "Xem lại manh mối" được ghi nhận; hỏi nhầm người hoặc trả lời sai tính một lần sai; từ ba lần trở lên thì chặng được đánh dấu "Cần ôn". Thắng trận xong, học sinh quay lại đúng cảnh và bước đang làm.

Ký hiệu ô: đi được `.` cỏ, `,` cỏ hoa, `=` đường đất, `_` sân gạch, `:` cát, `+` cầu ván; vật cản `T` cây, `B` tre, `H` nhà, `h` lều, `#` rào, `%` ruộng, `~` nước, `b` thuyền, `D` trống, `f` cờ, `c` bao lương, `W` giếng, `P` cột, `w` mái điện, `L` gỗ, `S` cọc, `F` bếp lửa, `R` đá.

## 7. Trận đánh theo lượt

Mỗi phe có hàng trước và hàng sau; đơn vị đánh gần chỉ với tới hàng trước khi hàng trước còn quân, đơn vị bắn xa với tới mọi hàng. Mỗi lượt chọn **Tấn công**, **Phòng thủ** (giảm nửa sát thương, thêm 1 quân lương) hoặc **Kỹ năng** (tốn quân lương, có thời gian hồi). Khắc chế: bộ binh thắng kỵ binh, kỵ binh thắng cung thủ, cung thủ thắng bộ binh và tượng binh, tượng binh thắng bộ binh và kỵ binh (sát thương × 1,3). **Mưu kế** dùng một lần mỗi trận kèm một câu hỏi kiến thức: trả lời đúng thì hiệu quả trọn vẹn, sai thì yếu. Hiểu bài tốt được lợi thế đầu trận (luyện tập từ 70%: +1 quân lương; từ 90%: +2 quân lương và +10% sức đánh). Mục tiêu theo trận: diệt hết, trụ vững đủ số vòng, diệt đủ mục tiêu (đoàn thuyền lương) hoặc hạ một đơn vị. Quân địch do máy chủ điều khiển theo luật (ưu tiên mục tiêu kết liễu được, mục tiêu cần bảo vệ, rồi mục tiêu chịu sát thương lớn nhất). Sao trận: không mất đơn vị nào 3 sao, mất một 2 sao, còn lại 1 sao.

## 8. Màn Bạch Đằng 1288

Khúc sông là lưới 12 × 5 ô: lạch sâu, bãi cạn, hai cửa sông nhánh, ghềnh đá, hai bờ. Con nước đổi theo từng lượt và có thanh dự báo.

1. **Đóng cọc lòng sông.** Khi nước cao, bãi cạn và lạch sâu trông như nhau; chờ nước thấp mới thấy và mới đóng được cọc, chỉ trên bãi cạn, tối đa 3 cụm mỗi con nước thấp, tổng 6 cụm. Đóng cọc ở cửa sông nhánh sẽ chặn chính cánh quân mai phục của ta (có cảnh báo).
2. **Nhử địch vào trận.** Nước cao, cọc chìm. Thuyền nhẹ khiêu chiến rồi lui; thuyền địch đã bị khiêu chiến bám theo **vệt nước** của thuyền nhẹ, 2 ô mỗi lượt. Trước khi đi, giao diện cho xem trước vị trí thuyền địch sau lượt đó (máy chủ tính). Đứng trong tầm áp sát thì thuyền nhẹ bị đánh.
3. **Phản công khi nước rút.** Thuyền địch đang ở ô có cọc thì vướng cọc (đứng yên, hư hại, bị đánh áp mạn nặng hơn một nửa); ở bãi cạn thì mắc cạn; ở lạch sâu thì chạy ra biển. Thủy quân mai phục đổ ra từ hai cửa sông nhánh; bè lửa chỉ trúng thuyền đã vướng cọc hoặc mắc cạn; cung nỏ hai bờ bắn thuyền vướng cọc mỗi lượt.

Thua khi thuyền chỉ huy địch hoặc hai đoàn thuyền thoát ra biển, khi mất thuyền nhẹ lúc đang nhử, khi mất cánh quân chủ lực, hoặc khi nước lên lại mà chưa diệt xong. Màn kết quả giải thích từng lỗi (bãi cọc quá thưa, chắn cửa sông, chưa khiêu chiến, không thuyền nào vướng cọc, thuyền chỉ huy thoát, thuyền nhẹ đứng quá gần, bè lửa thả sớm…). Ba sao khi cả đoàn thuyền địch vướng cọc, không để thoát và giữ được lực lượng. Lưới ô, số lượt và các chỉ số là **mô hình dạy học**, không phải số liệu lịch sử; điều này ghi ngay trên màn chơi.

## 9. Tiến độ và phần thưởng

- Điểm kinh nghiệm: học xong thẻ 10, đạt luyện tập lần đầu 30, xong nhập vai lần đầu 20, thắng trận lần đầu 50, hoàn thành chặng theo cấu hình chặng (100–200) kèm vàng, thẻ nhân vật, huy hiệu (5 chặng) và tư liệu mở thêm; ôn tập đúng 5 điểm mỗi câu, một lần mỗi ngày.
- Cấp độ, chuỗi ngày, nhiệm vụ hằng ngày, huy hiệu và bảng xếp hạng dùng lại hệ trò chơi hóa sẵn có (`/api/game`).
- Trạng thái chặng (luôn hiện bằng màu, biểu tượng và chữ): Chưa mở, Sẵn sàng, Đang học, Đã xong, Cần ôn.

## 10. Quản trị và giáo viên

Ngày 16/11/2026 người dùng yêu cầu **xóa vĩnh viễn** mục "Hành trình Đông A" ở quản trị tổng và giáo viên ("không có liên quan"). Đã xóa trang `SagaAdmin.tsx` (chỉnh ảnh nền bản đồ, vị trí chặng, nội dung, trạng thái duyệt; báo cáo lớp của giáo viên) cùng các API `/api/saga/admin/*` và `/api/saga/teacher/*`. Bảng `hk_saga_*` giữ nguyên.

- Muốn đổi ảnh bản đồ, vị trí chặng, ngưỡng đạt, phần thưởng hay nội dung: viết **migration số mới** (`UPDATE hk_saga_stages …`, `hk_saga_items`, `hk_saga_maps`), không sửa migration 066. Vị trí chặng vẫn lưu theo tỉ lệ 0–1 trên ảnh nên đổi ảnh không phải đặt lại điểm.
- Tiến độ của học sinh vẫn tính vào điểm, cấp độ, huy hiệu và bảng xếp hạng chung của trò chơi hóa (`/api/game`).

## 11. Chạy thử trên máy

```
cd backend && npm ci && npm run build
# đặt DATABASE_URL tới một PostgreSQL thử nghiệm, AUTH_SECRET_KEY, ADMIN_PASSWORD (xem backend/.env.example; không ghi bí mật vào Git)
node dist/main.js            # tự chạy migration 001–066 khi khởi động

cd frontend && npm ci
set EXPO_PUBLIC_API_URL=http://localhost:8000 && npm run web
```

**Tài khoản thử.** Migration không tạo tài khoản mẫu (quy tắc của dự án: không đưa dữ liệu tài khoản vào migration / Git). Tạo như khi dùng thật: đăng nhập `/admin` bằng tài khoản quản trị tổng đặt qua biến môi trường → thêm trường (kèm quản trị viên trường) → quản trị trường tạo năm học, giáo viên, lớp, học sinh → học sinh đăng nhập bằng đường dẫn của trường. Bài kiểm thử `backend/test/saga.spec.ts` làm đúng các bước này trên PostgreSQL tạm.

## 12. Kiểm thử

- `backend/test/saga_engine.spec.ts`: luật minigame, cảnh nhập vai, trận theo lượt, màn Bạch Đằng (thắng 3 sao theo lời giải mẫu; các lỗi điển hình thua đúng lý do), toàn bộ 13 chặng khởi tạo hợp lệ và mọi trận đánh thắng được.
- `backend/test/saga.spec.ts`: chạy qua API thật trên PostgreSQL tạm: khóa chặng, thứ tự các bước, đề không lộ đáp án, gửi lặp, lệch thứ tự, phiên của người khác (404), trọn một vòng có trận đánh, đăng nhập lại còn tiến độ, chặng không có trận, ôn tập và đồng hồ, màn Bạch Đằng (thua rồi thắng), chỉ học sinh dùng được `/api/saga` và các đường dẫn quản trị / giáo viên đã xóa trả 404, RLS.
- `frontend/tests/stale-bundle.test.cjs`: `frontend/api/` không quá 12 tệp (giới hạn Serverless Function của Vercel gói Hobby; vì vậy tệp gọi API của Hành trình Đông A nằm ở `lib/saga-api.ts`).
- `frontend/tests/student-nav.test.cjs`: khung trang, năm mục, ba kiểu điều hướng, màn không còn được xem phải gỡ nội dung, Phaser chỉ nạp động và đo lại vị trí canvas trước mỗi thao tác, giao diện không giữ đáp án, trang học sinh dùng khung và thành phần của cổng quản trị (không còn bộ nút khối, nền trời, pháo giấy); `frontend/tests/admin-shell.test.cjs`: quản trị tổng và giáo viên không còn mục Hành trình Đông A, không còn `SagaAdmin.tsx`.
- Chạy thật trên trình duyệt (PostgreSQL tạm + backend + bản web + Chrome điều khiển qua CDP) ở 1280 px và 390 px, giao diện sáng và tối: đi trọn chặng đầu bằng thao tác thật (học, sáu câu luyện tập đủ năm dạng, nhập vai bằng chạm và phím, trận theo lượt bằng nút lệnh và bằng bấm lên chiến trường, nhận thưởng), màn Bạch Đằng thắng và thua (kể cả tải lại giữa trận rồi chơi tiếp, đóng cọc bằng bàn phím), ôn tập, bộ thẻ và bảng xếp hạng lớp, tư liệu, Back / Forward / tải lại, bấm lên canvas sau khi cuộn trang, chế độ giảm chuyển động, trang quản trị (bấm lên ảnh đổi vị trí, học sinh thấy ngay), báo cáo lớp của giáo viên.
- **Chưa kiểm**: ứng dụng Android / iOS dựng thật (chỉ kiểm bản web ở bề ngang điện thoại); trình duyệt Safari và Firefox; nhiều học sinh chơi cùng lúc với tải lớn; trình đọc màn hình thật (mới kiểm nhãn trợ năng trong mã).

## 13. Ghi công và giấy phép

- **Bản đồ**: `Chongquannguyenlan1.svg`, `…2.svg`, `…3.svg` của Lưu Ly trên Wikimedia Commons, phạm vi công cộng; bản hiển thị là ảnh WebP đã đổi kích thước trong `frontend/assets/`. Liên kết gốc nằm ở từng bản đồ, mục Tư liệu → Bản đồ, `frontend/constants/map-credits.ts` và trang `/thong-tin-hinh-anh`.
- **Phaser 3.90** (giấy phép MIT, © Richard Davey, Phaser Studio Inc.): thông báo giấy phép giữ ở `frontend/third-party/phaser/LICENSE.md`.
- **Hình trong game** (nhân vật, lính, thuyền, voi, cây, nhà, cọc…), linh vật Tiểu Tướng, chân dung trên thẻ và huy chương đều do dự án tự vẽ bằng mã (canvas / SVG); **chân dung là tranh minh họa cách điệu, không phải chân dung lịch sử**. Âm thanh là tiếng tổng hợp bằng Web Audio, không dùng tệp âm thanh.
- Phần nhập vai chỉ tham khảo **kiểu tương tác** của trò "văn phòng điểm ảnh" (đi lại trên bản đồ ô, tới gần để tương tác). Không sao chép mã nguồn, hệ thống hooks, Electron, nhân vật hay tài sản hình ảnh của bất kỳ dự án hay trò chơi nào khác.

## 14. Khác với đặc tả và việc chưa làm

- **Trợ lý hỏi đáp (RAG)**: dùng lại trợ lý Tiểu Tướng sẵn có của dự án (tra cứu trong kho tư liệu nhà trường công bố, có trích nguồn), mở từ mục "Hỏi Tiểu Tướng" ở menu bên trái. Nội dung của Hành trình Đông A **chưa được đưa vào chỉ mục** của trợ lý; kho tư liệu của trợ lý trống thì trợ lý báo chưa trả lời được.
- **Ứng dụng điện thoại (Android / iOS)**: phần học, luyện tập, ôn tập, bộ thẻ, tư liệu dùng được; cảnh nhập vai và trận đánh cần trình duyệt (Phaser chạy trên canvas của web), bản điện thoại hiện thông báo thay cho màn chơi. Trên **trình duyệt của điện thoại** thì chơi được đầy đủ bằng chạm.
- **Bàn phím**: mọi nút lệnh, trắc nghiệm, xếp trình tự, lời thoại và di chuyển trong cảnh dùng được bằng bàn phím. Trận theo lượt có danh sách mục tiêu bấm bằng nút (không bắt buộc bấm lên canvas). Khúc sông Bạch Đằng có **ô chọn bằng bàn phím**: phím mũi tên hoặc W A S D di chuyển ô chọn, phím E chọn ô. Minigame "định vị trên bản đồ" có hàng nút chữ bên dưới bản đồ. Riêng việc **kéo** bản đồ chiến dịch cần chuột / chạm; thay vào đó có nút phóng to, thu nhỏ và danh sách chặng bấm được ở bên dưới bản đồ.
- **Giảm chuyển động**: khi hệ điều hành / trình duyệt bật "giảm chuyển động", cảnh game bỏ rung và chớp màn hình, thẻ ghép cặp lật ngay không có hoạt ảnh; các chuyển động còn lại là di chuyển của đơn vị để học sinh theo dõi được diễn biến.
- **Thi đấu trực tiếp** của học sinh (phòng thi kiểu Kahoot) chưa có giao diện trong trang học sinh mới; API và phần của giáo viên vẫn còn.
- Không còn trang chỉnh nội dung / bản đồ cho quản trị tổng và báo cáo Hành trình Đông A cho giáo viên (xóa theo yêu cầu 16/11/2026): nội dung chỉ đổi bằng migration số mới.
- Giao diện học sinh dùng giao diện sáng như các cổng quản trị; lựa chọn sáng / tối trong Cài đặt đã bỏ (giá trị cũ vẫn lưu nhưng không dùng).
- Các bảng và API của hành trình học, bản đồ nhiệm vụ, thẻ tướng cũ vẫn giữ nguyên trong cơ sở dữ liệu (không xóa), trang học sinh mới không dùng tới.

## 15. Chiến dịch theo khối và vòng 5 bước – "Binh thư Sát Thát" (25/11/2026, migration 083)

**Bốn chiến dịch không trùng nội dung** (`hk_saga_grades`, `hk_saga_stages.grade`):

| Khối | Vai | Nội dung | Mức nhận thức | Chặng |
| --- | --- | --- | --- | --- |
| 6 | Tân binh | Bạch Đằng 938 (chặng mới) + kháng chiến lần thứ nhất 1258 | nhận biết | 4 |
| 7 | Đội trưởng | kháng chiến lần thứ hai 1285 | thông hiểu | 6 |
| 8 | Tướng quân | kháng chiến lần thứ ba 1287–1288 | vận dụng | 4 |
| 9 | Nguyên soái | tổng kết: so sánh ba lần, Hội đồng Đại cục, tư liệu – tranh biện, thử thách "nếu… thì" (4 chặng mới) | vận dụng cao | 4 |

Mỗi khối đúng 24 câu luyện tập (13 câu cũ chuyển sang chỉ dùng ôn tập). Khối học sinh lấy từ khối của lớp (`app_classes.grade`, hoặc chữ số đầu tên lớp); khối cao hơn bị khóa "Mở khi em lên lớp N" nhưng vẫn xem danh sách; không có khối (tài khoản thử) thì không khóa theo khối. Nội dung mới đối chiếu Wikipedia tiếng Việt "Trận Bạch Đằng (938)", "Ngô Quyền" (dẫn *Đại Việt sử ký toàn thư*); nhân vật hư cấu trong trận hội đồng được ghi rõ.

**Vòng 5 bước** (`steps()` của máy chủ): Quân lệnh (`order_text` của chặng, lời dẫn của trò chơi) → Thám sử (nhặt từng thẻ: `POST /api/saga/stages/:id/lore/:card`, đủ thẻ thì bài học xong, +10 KN) → Hội đồng quân sự (luyện tập; đạt ngưỡng) → Xuất trận (chỉ cần qua Hội đồng; không còn bắt buộc đi nhập vai trước) → Sử quan (`GET …/summary` có `compare`, `comment`, `battle_text`). Thế giới khối 3D là phần thêm sau Hội đồng (+20 KN), không chặn hoàn thành chặng.

**Trận hội đồng** (`backend/src/saga/council.ts`, `battle.mode = council`): 2–6 lượt, mỗi lượt một người hỏi, 3 phương án (đúng một phương án điểm 2), 1–3 thanh chỉ số; thắng khi mọi thanh đạt ngưỡng; sao theo tỉ lệ điểm. Kiểu `persuade` (Diên Hồng), `command` (Vườn không nhà trống, Vạn Kiếp 1288, Hội đồng Đại cục, Bạch Đằng 938), `whatif` (Thử thách lịch sử). Phương án chưa chọn không lộ điểm / tác động; kết quả có bảng so sánh với lịch sử.

**Kinh tế** (`saga.service.ts`, sổ cái `hk_gold_ledger` khóa duy nhất nên chơi lại không thưởng lần hai): đúng 1 câu lần đầu +10 KN +2 vàng (Luyện binh riêng: mỗi câu mỗi ngày); mỗi sao trận lần đầu +30 KN +10 vàng; xong chặng lần đầu theo `reward_xp` / `reward_gold`; nhiệm vụ ngày (trả lời đúng 10 câu, nhặt 2 thẻ Binh thư, hỏi Tiểu Tướng 1 câu). Mốc chuỗi ngày 3 / 7 / 14 / 30 → +30 vàng / khung Lửa Đông A / +200 vàng / cờ Ấn Đông A. KN chỉ để lên cấp; vàng chỉ tiêu ở Chợ phiên.

**Khoa bảng**: Học trò → Thái học sinh (xong Khối 6) → Thám hoa (Khối 7) → Bảng nhãn (Khối 8) → Trạng nguyên (Khối 9 và đủ sao cả bốn khối). Học sinh đã xong phần 1 cũ cần xong thêm chặng Bạch Đằng 938 mới đủ Khối 6.

**Chợ phiên Thăng Long** (`GET /api/saga/shop`, `POST /api/saga/shop/buy {kind, code}`; trang bị `POST /api/saga/cosmetics/equip {frame|title|avatar|flag|theme}`): khung (Gỗ mộc miễn phí, Đồng cổ 300, Rồng thời Trần 900; Đông Bộ Đầu / Chương Dương / Sóng Bạch Đằng mở bằng hòm báu, Lửa Đông A bằng chuỗi 7 ngày, Hoa sen vàng khi đỗ Trạng nguyên), cờ hiệu (Sát Thát miễn phí, Thuyền chiến 350, Rồng cuộn 600; Phá cường địch khi có thẻ Trần Quốc Toản, Cọc Bạch Đằng khi 3 sao trận Bạch Đằng, Ấn Đông A bằng chuỗi 30 ngày), giao diện (Thăng Long miễn phí, Sông Bạch Đằng 600, Đêm Đông Bộ Đầu 600, Hoàng thành cho Trạng nguyên), vật phẩm (Lệnh bài giữ chuỗi 150 vàng, tối đa 2 / tuần; Gợi ý chiến thuật 50 vàng, tối đa 3 / tuần). Món thành tích không bán.

**API mới**: `GET /api/saga/grades/:grade`, `GET /api/saga/lore`, `POST /api/saga/stages/:id/lore/:card`, `GET /api/saga/shop`, `POST /api/saga/shop/buy`; `GET /api/saga/home` thêm `grades`, `grade`, `rank`, `quests`, `suggest`, `streak` (tuần + mốc), `look` (cờ hiệu, giao diện), `hints`; bảng xếp hạng tuần thêm `delta` (đổi hạng so với tuần trước) và `compare`. Tiểu Tướng đếm lượt hỏi được trả lời cho nhiệm vụ `ai_questions`.

**Nội dung**: soạn ở `backend/scripts/saga-seed/grades.cjs`, sinh migration bằng `npm run build` rồi `node scripts/saga-seed/build-grades.cjs <số> <tên>` (kiểm tra bằng bộ chuẩn hóa của máy chủ). Kiểm thử: `test/saga.spec.ts` (khối, khóa theo lớp, Thám sử, Hội đồng + gợi ý, trận hội đồng, Sử quan, hòm báu, Chợ phiên, chuỗi ngày, bảng tuần so với tuần trước, RLS của `hk_saga_grades`), `test/world.spec.ts`, `test/migrations.spec.ts`.
