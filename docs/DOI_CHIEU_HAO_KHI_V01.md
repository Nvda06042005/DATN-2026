# Đối chiếu danh sách chức năng Hào Khí Đông A ver0.1 với hệ thống hiện tại

Nguồn: `fuction list/HaoKhiDongA_DanhSachChucNang_ver0.1 (1).xlsx` (ngày lập 31/10/2026): 348 chức năng, mã `HK.<phân hệ>.<số>`,
sheet “Phân quyền” (31 nhóm) và “Quy ước & Sprint” (12 sprint × 2 tuần). File này **thay thế** bản `TM.*` cũ; từ nay tiến độ theo mã `HK.*`.

Cách đọc mức hiện trạng: **Có** = đã có và có kiểm thử; **Một phần** = có nền nhưng khác hoặc thiếu ý chính của đặc tả; **Chưa**.
Đây là ước lượng theo mã nguồn ở mức nhóm, chưa phải đối chiếu từng mã.

## 1. Những gì file mới cho biết

**Sản phẩm:** nền tảng học lịch sử game hóa cho học sinh THCS về ba lần kháng chiến chống Nguyên – Mông, phục vụ 5 mục tiêu đề cương:
(1) kho dữ liệu lịch sử có cấu trúc, (2) game hóa, (3) AI gia sư dùng RAG, (4) gợi ý học tập cá nhân hóa, (5) đánh giá hiệu quả (khảo sát, nhóm thử nghiệm, xuất dữ liệu nghiên cứu).

**Năm phân hệ:**

| Tiền tố | Phân hệ | Số chức năng | Cao / Trung bình / Thấp |
| --- | --- | --- | --- |
| HK.HS | Học sinh | 112 | 59 / 34 / 19 |
| HK.GV | Giáo viên | 82 | 46 / 24 / 12 |
| HK.QT | Quản trị viên trường học | 55 | 34 / 16 / 5 |
| HK.AD | Quản trị viên tổng | 79 | 46 / 21 / 12 |
| HK.SYS | AI và hệ thống (tự động) | 20 | 12 / 7 / 1 |

Mức “Cao” (197/348) là phạm vi MVP để thử nghiệm với lớp học; đây là cách phân ưu tiên chặt hơn bản cũ (82% là “Cao”).

**Kế hoạch 12 sprint:** S1 xác thực, tài khoản, hồ sơ (40) · S2 trường, năm học, giáo viên, học sinh, lớp và **kho dữ liệu lịch sử** (45) ·
S3 trang chủ, quest map, dòng thời gian, bản đồ, bài học, tư liệu (32) · S4 ngân hàng câu hỏi, bộ đề (24) · S5 trò chơi hóa (38) ·
S6 mô phỏng trận đánh và mini-game (14) · S7 quản lý lớp, giao bài, kiểu Classcraft (42) · S8 thi đấu trực tiếp (16) · S9 AI Tutor RAG (24) ·
S10 gợi ý cá nhân hóa, dashboard (26) · S11 thông báo, cấu hình, 2FA, hỗ trợ, nhật ký (39) · S12 khảo sát, nghiên cứu, triển khai (8).

**Quy tắc đáng chú ý (đọc từ cột Mô tả/Note):**
- Đăng nhập sai 5 lần liên tiếp khóa tạm 15 phút (mọi vai trò). Quên mật khẩu bằng **OTP email hiệu lực 5 phút**. Mật khẩu mới tối thiểu 8 ký tự, có chữ và số.
- **Tham gia lớp bằng mã lớp 6 ký tự do giáo viên cung cấp, không có mật khẩu lớp**; một học sinh thuộc **nhiều lớp**; giáo viên có thể **tạo lại mã**.
- **Giáo viên tạo lớp** được; nhưng “lớp do trường tạo thì giáo viên chỉ được phân công”. QTV trường gán **một hoặc nhiều giáo viên** cho lớp theo năm học.
- **Năm học là thực thể quản lý** (thêm, sửa, kích hoạt, kết thúc); năm học đã kết thúc không được sửa dữ liệu. Có “nhân bản lớp sang năm học mới” (lên lớp).
- Xóa chỉ khi chưa phát sinh dữ liệu, nếu không chỉ khóa hoặc lưu trữ (giáo viên, học sinh, lớp, trường, tài khoản).
- Nhập Excel phải **báo lỗi dòng trùng/sai định dạng trước khi lưu** (xem trước).
- Nội dung lịch sử có vòng đời **Nháp → Đã kiểm chứng → Công bố**; chỉ nội dung đã công bố hiển thị cho học sinh **và được dùng cho AI**; có lịch sử chỉnh sửa, so sánh, khôi phục.
- Câu hỏi do AI sinh bắt buộc giáo viên duyệt. Bảng xếp hạng học sinh chỉ thấy biệt danh. Trò chuyện nhập vai với nhân vật lịch sử cần bộ lọc an toàn.
- Công nghệ gợi ý trong Note: JWT hoặc Firebase Auth, Socket.IO, Redis (bảng xếp hạng), Leaflet + OpenStreetMap, Phaser/Canvas, pgvector hoặc Qdrant.
  Đây là gợi ý, không phải ràng buộc; xem mục 4.

## 2. Đối chiếu theo phân hệ

| Phân hệ | Đã có (ước lượng) | Phải làm hoặc đổi |
| --- | --- | --- |
| **Quản trị viên tổng (AD)** | Một phần lớn: đăng nhập, đổi/đặt lại mật khẩu, trường (thêm, sửa, khóa), người dùng, phân quyền, khóa/mở khóa, thùng rác, nhật ký, dashboard, ngân hàng câu hỏi, luật EXP | **Kho dữ liệu lịch sử có cấu trúc** (cuộc kháng chiến, nhân vật, sự kiện, địa điểm có tọa độ, trận đánh, dòng thời gian, tư liệu, thuật ngữ, kiểm chứng/công bố, lịch sử phiên bản); quản lý AI (nguồn RAG, chỉ mục, prompt, playground, hạn mức); nội dung game (kịch bản trận đánh, thẻ, huy hiệu, cửa hàng, nhiệm vụ, league); cấu hình, FAQ, email mẫu, thông báo toàn hệ thống, feature flag, sao lưu; hỗ trợ/báo lỗi; khảo sát mẫu, nhóm thử nghiệm, xuất dữ liệu nghiên cứu; 2FA; hồ sơ cá nhân |
| **QTV trường học (QT)** | Một phần lớn: tài khoản giáo viên/học sinh, khối và lớp, phân công, chuyển lớp, nhập Excel, thùng rác, dashboard và báo cáo, nhật ký | **Năm học thành thực thể** và nhân bản lớp sang năm mới; **nhiều giáo viên/lớp**; nhập Excel có xem trước; QTV trường sửa thông tin trường/logo; duyệt câu hỏi, bộ đề, hành trình do giáo viên chia sẻ; cấu hình bảng xếp hạng, sự kiện, huy hiệu riêng; khảo sát; thông báo chung; yêu cầu hỗ trợ; hồ sơ cá nhân |
| **Giáo viên (GV)** | Một phần nhỏ: đăng nhập, đổi mật khẩu, xem lớp, danh sách học sinh, thi đấu trực tiếp (PIN, khóa, điều khiển, bảng xếp hạng), AI soạn đề, tiến độ lớp | Tạo/sửa/lưu trữ lớp, **mã lớp 6 ký tự**, thêm/xóa học sinh, chia đội; **quest map** (thư viện mẫu, soạn, kéo thả, điều kiện mở khóa, gán lớp, tiến độ); **ngân hàng câu hỏi riêng** + Excel + chia sẻ; **bộ đề**; **giao bài, chấm, nhận xét, nhắc**; thưởng/phạt kiểu Classcraft; báo cáo, dashboard; AI trợ lý; thông báo; hồ sơ; quên mật khẩu OTP |
| **Học sinh (HS)** | Một phần: luyện tập, câu hỏi nhiều dạng, EXP, cấp, streak, thẻ, bảng xếp hạng lớp, chiến dịch, thế giới 2D, thi đấu trực tiếp, chatbot, gợi ý theo BKT, vào lớp | **Làm lại trải nghiệm theo đặc tả:** nhân vật và lớp nhân vật, HUD, trang chủ → chọn cuộc kháng chiến → **quest map**; dòng thời gian, bản đồ tương tác, bài học, **kho dữ liệu lịch sử và tư liệu gốc** (đọc từ CSDL, không từ file tĩnh); tim, đóng băng streak, huy hiệu, cửa hàng, nhiệm vụ ngày/tuần, league; **mô phỏng trận đánh nhập vai chỉ huy** + mini-game ghép thẻ/niên biểu/ô chữ; bài tập được giao; hồ sơ, đổi giao diện, nhắc học; Google login; khảo sát |
| **Hệ thống (SYS)** | Một phần: xác thực và phân quyền API, tính điểm/cấp/streak, thi đấu thời gian thực, gửi thư, rate limit, ghi log | Xét huy hiệu, hồi tim, làm mới bảng xếp hạng, league tuần, mở khóa nút/tư liệu theo điều kiện, rơi thẻ theo tỉ lệ, pipeline RAG + bộ lọc an toàn + lập chỉ mục khi công bố, gợi ý định kỳ, learning analytics, backup |

Phần nên tái sử dụng (đã có kiểm thử): phân quyền 4 vai trò và cách ly dữ liệu theo trường (RLS), JWT thu hồi và khóa 5 lần sai, quên mật khẩu, nhật ký đăng nhập/thao tác,
trường/người dùng/thùng rác, nhập Excel có ký chữ ký, báo cáo thống kê và xuất XLSX, ngân hàng câu hỏi dùng chung, luật EXP có phiên bản, phòng thi đấu thời gian thực, tiến độ BKT, dịch vụ AI Python.

## 3. Chỗ file mới khác với những gì đã xây (cần sửa, không chỉ thêm)

1. **Mã tham gia lớp.** Đặc tả: mã 6 ký tự do giáo viên cấp, không mật khẩu, tạo lại được. Hiện tại (và phần vòng đời lớp làm ngày 31/10): mã lớp kiểu `7A1` cộng **mật khẩu lớp**.
   Cần đổi thành mã tham gia ngẫu nhiên có thể tạo lại; tên lớp và mã tham gia tách nhau. Phần mật khẩu lớp vừa làm sẽ được thay.
2. **Học sinh thuộc nhiều lớp.** Bảng thành viên đã nhiều-nhiều, nhưng nhiều chỗ (phòng thi, bảng xếp hạng, giáo viên chọn “lớp đang dạy”) dựa vào `class_name` một giá trị. Cần bỏ dần.
3. **Nhiều giáo viên mỗi lớp** (QT.022). Hiện một `teacher_id` mỗi lớp (đã nêu là chờ quyết định, nay đặc tả đã quyết). Cần bảng giáo viên–lớp theo năm học.
4. **Năm học** hiện chỉ là chuỗi trên lớp và người dùng; cần bảng năm học (kích hoạt, kết thúc, khóa sửa).
5. **Giáo viên tạo lớp** được (GV.008) và **quản trị trường tạo lớp rồi phân công**: cả hai luồng cùng tồn tại (đã có đủ, chỉ cần thống nhất mã tham gia).
6. **Quên mật khẩu bằng OTP 5 phút** cho cả bốn vai trò; hiện là liên kết 30 phút chỉ cho hai cổng quản trị.
7. **Hồ sơ cá nhân** cần các cột mới: số điện thoại, ảnh đại diện, giới thiệu, biệt danh, giới tính, bộ môn, email phụ huynh. Bảng người dùng hiện chưa có.
8. **Đăng nhập bằng mã học sinh/email** (tên đăng nhập hiện do hệ thống sinh); Google login chỉ khi email trùng hồ sơ.
9. **Nội dung lịch sử đọc từ CSDL** có kiểm chứng/công bố/phiên bản; hiện là file JSON và hằng số trong mã (`knowledge_base.json`, `campaigns.ts`, `heroes.ts`). Đây là nền cho quest map, AI RAG, câu hỏi, thẻ; nên làm sớm (S2).
10. **Trải nghiệm game của học sinh** theo đặc tả (quest map, nhân vật, trận đánh nhập vai, cửa hàng, league) khác thiết kế game hiện tại (Điền Trang, Doanh Trại, Quốc Tử Giám, thế giới 2D). Cần quyết định giữ phần nào, thay phần nào.
11. **Nhập Excel** phải xem trước và báo lỗi trước khi lưu; hiện ghi ngay.

## 4. Chỗ cần làm rõ trong file mới

- HK.HS.003 (tự đăng ký, “Thấp”, “cân nhắc bỏ”) nhưng sheet Phân quyền ghi học sinh ✅ tự đăng ký. Hai chỗ nói khác nhau; đề xuất bỏ hoặc để cuối.
- HK.AD.020 nhắc “quản trị viên tổng cấp 2”, trong khi ma trận chỉ có 4 vai trò; cần định nghĩa quyền cấp 2 hoặc bỏ.
- GV.019 (S3) “tạo hành trình cho lớp” nhưng gán hành trình cho lớp và đặt lịch là GV.026 (S7); cần nói rõ S3 chỉ soạn hành trình, S7 mới gán.
- HS.047 (tim, S5) và HS.043 (làm bài, S4): cần chốt trước khi viết model câu trả lời để không phải sửa lại.
- Stack trong Note khác stack hiện tại (ứng dụng Expo/React Native web, `ws`, không Redis). Đề xuất giữ stack hiện tại: bản đồ Leaflet chỉ dùng trên web, WebSocket `ws` đã có kiểm thử, bảng xếp hạng tính bằng PostgreSQL,
  Phaser/Canvas chỉ khi cần cho mô phỏng trận đánh. Không đổi sang Firebase vì đã có JWT thu hồi.
- Email phụ huynh (QT.028) là dữ liệu của trẻ vị thành niên; cần chính sách dùng và đồng ý trước khi gửi thông báo cho phụ huynh.
- Quy tắc tính điểm, số tim, tỉ lệ rơi thẻ, mốc cấp, giá cửa hàng chưa có số liệu; nên để cấu hình được (AD.050, AD.051, AD.066) và chốt giá trị mặc định cùng giáo viên.

## 5. Tiến độ xây dựng lại (cập nhật khi xong mỗi mốc)

| Mốc | Sprint | Nội dung | Trạng thái |
| --- | --- | --- | --- |
| 1 | S1 | Đăng nhập bằng tên/email/mã, khóa 15 phút, mật khẩu 8 ký tự có chữ và số, quên mật khẩu OTP 5 phút cho mọi vai trò, hồ sơ cá nhân bốn vai trò (HK.HS.001/004–007/009/010, HK.GV.001–006, HK.QT.001–005, HK.AD.001/003–005) | **Xong** (migration 013, `profile.spec.ts`) |
| 2a | S2 | Năm học thành thực thể, nhiều giáo viên mỗi lớp, mã tham gia lớp 6 ký tự thay mật khẩu lớp, nhiều lớp mỗi học sinh, nhân bản lớp | Chưa |
| 2b | S2 | Kho dữ liệu lịch sử có cấu trúc (AD.028–042) và chuyển dữ liệu hiện có vào CSDL | Chưa |
| 2c | S2 | Nhập Excel giáo viên/học sinh có xem trước; QTV trường sửa thông tin trường; xóa trường khi chưa có dữ liệu | Chưa |
| 3+ | S3–S12 | Theo kế hoạch ở mục 6 | Chưa |

Chưa làm trong S1: đăng nhập Google (HS.002, “Trung bình”), tự đăng ký tự học (HS.003, “Thấp”, đề xuất bỏ), bước xác nhận hồ sơ ở lần đăng nhập đầu, tải ảnh đại diện (hiện chỉ nhận liên kết https).

## 6. Đề xuất cách xây dựng lại

Làm theo đúng thứ tự sprint của file, mỗi sprint một khối gọn: migration, API, giao diện bốn cổng, kiểm thử, cập nhật tài liệu này. Theo dõi tiến độ theo mã `HK.*` trong tài liệu, không dùng mã `TM.*` nữa.

1. **S1 (40):** hoàn thiện xác thực cho cả bốn vai trò (OTP quên mật khẩu, đăng nhập bằng mã/email, hồ sơ cá nhân và cột mới, Google tùy chọn). Phần lớn đã có; chủ yếu đổi và bổ sung.
2. **S2 (45):** năm học thành thực thể, nhiều giáo viên/lớp, mã tham gia 6 ký tự (thay mật khẩu lớp), nhập Excel có xem trước, nhân bản lớp; **và kho dữ liệu lịch sử** (nhân vật, sự kiện, địa điểm, trận đánh, dòng thời gian, tư liệu, thuật ngữ) với vòng Nháp → Đã kiểm chứng → Công bố. Nên chuyển dữ liệu đang có trong file/hằng số vào đây bằng migration.
3. **S3–S4:** trang chủ, quest map, dòng thời gian, bản đồ, bài học, tư liệu cho học sinh đọc từ kho dữ liệu; câu hỏi, bộ đề, câu hỏi riêng của giáo viên.
4. **S5–S6:** trò chơi hóa theo đặc tả, mô phỏng trận đánh và mini-game.
5. **S7–S12:** lớp học kiểu Classcraft và giao bài, thi đấu trực tiếp (nối vào phần đã có), AI Tutor RAG, gợi ý, dashboard, thông báo/cấu hình/2FA, khảo sát và xuất dữ liệu nghiên cứu.

Về giao diện: bốn cổng cần chung một bộ khung và thành phần (đã có `AdminWorkspace`, `ui.tsx`); Figma “cập nhật sau” nên chưa thể bám theo, tôi sẽ giữ phong cách hiện tại và chỉnh khi có Figma.
