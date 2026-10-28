# HÀO KHÍ ĐÔNG A — Kế hoạch dựng lại giao diện (bản 2)

Bản này viết lại kế hoạch gốc sau khi rà soát bằng skill ui-ux-pro-max, tham khảo các game cùng thể loại và đối chiếu lại các mốc lịch sử với nguồn và với `ai/data/knowledge_base.json`.

- **Mục 0–10:** yêu cầu triển khai, dùng trực tiếp để dựng game.
- **Phụ lục A:** những chỗ đã sửa so với bản gốc và lý do.
- **Phụ lục B:** game tham khảo.
- **Phụ lục C:** nguồn.

## Trạng thái triển khai (23/10/2026)

Đã dựng đủ 4 giai đoạn ở mục 10, gồm cả **Thi đấu lớp thời gian thực** (WebSocket `/api/live/ws`, lịch sử trận ở migration 005). Chatbot đã học 4 chủ đề mới; số liệu đánh giá trước/sau ở `ai/KET_QUA_DANH_GIA.md`.

Ngày 24/10/2026, frontend được viết lại bằng React Native (Expo) và chia thư mục theo vai trò như repo tham khảo tronect-mobile-app (`app/`, `api/`, `components/`, `constants/`, `hooks/`, `lib/`, `types/`; khác mục 2); backend chính là NestJS, Python chỉ còn dịch vụ AI. Xem `README.md`.

Cũng trong ngày 24/10/2026, thêm **Hành Trình Đông A** – thế giới 2D pixel tham khảo lối chơi nông trại – phiêu lưu của Bonnievale Online (Phụ lục B): 3 vùng đất theo 3 lần kháng chiến, mỗi vùng một chuỗi 7 việc chính và các việc phụ (cuộn sử, thám báo, người dân kể chuyện). Nguyên tắc “kiến thức là vũ khí” giữ nguyên: muốn qua việc phải nghe chuyện xưa (thẻ Sử Ký) rồi trả lời đúng câu hỏi server chấm; vùng sau chỉ mở khi xong việc chính của vùng trước.

Khác với kế hoạch, kèm lý do:

| Kế hoạch | Đã làm | Lý do |
|---|---|---|
| Ngân hàng câu hỏi nằm trong App | Đặt ở server: `ai/data/game_content.json`, 133 câu, 5 dạng | Server giữ đáp án và tự chấm. Nhờ vậy Ấn Tín, XP thật sự chỉ tăng khi trả lời đúng. |
| Thêm chủ đề mới vào `knowledge_base.json`, `q_matrix.json` | Thêm vào `ai/data_splitter.py` (nguồn sinh ra hai file này), sinh lại dữ liệu và huấn luyện lại chatbot | Hai file được sinh tự động, sửa tay sẽ bị ghi đè. Dữ liệu cũ giữ nguyên từng mẫu; trên 115 câu kiểm thử cũ, số liệu không đổi. |
| Thi đấu lớp: mã phòng, giáo viên điều khiển | Thêm: chỉ học sinh cùng lớp vào được, câu trả lời cộng vào tiến độ thật, trận lưu lịch sử | Phòng thi đấu dùng cùng ngân hàng câu hỏi và cách chấm với game, nên kết quả trận vào thẳng BKT và bảng của giáo viên. |
| Câu hỏi về Nón Ma Lôi | Chỉ giữ cổ vật, nhãn “Dân gian – cần đối chiếu” | Chưa có nguồn học thuật, không nên kiểm tra như kiến thức. |
| Pha “Giữ chân địch (Thiên Mạc)” | Pha “Chặn giặc, giữ đường rút”, không ghi địa danh | Nguồn ghi Thiên Mạc, còn `knowledge_base.json` ghi bãi Tự Nhiên. Không ghi địa danh để chatbot và game không nói ngược nhau. |
| `quiz-complete` cộng XP, đá quý theo số câu client báo | XP, Ấn Tín cộng theo từng câu server chấm; `quiz-complete` chỉ ghi lượt học | Chống gian lận. |

---

## 0. Vai trò và bối cảnh

Đóng vai Senior Game Designer, Game System Architect, chuyên gia Game-Based Learning và Frontend Engineer. Dựng lại **toàn bộ giao diện cổng học sinh** của ứng dụng Đông A thành web-game **"Hào Khí Đông A — 3 lần kháng chiến chống quân Mông – Nguyên"**. Game lấy cảm hứng từ:

| Lấy cảm hứng | Phần dùng |
|---|---|
| Clash of Clans, Hay Day | Xây và nâng cấp căn cứ trên lưới ô, chạm để thu hoạch |
| Idle Tycoon | Tài nguyên tự sinh theo thời gian, có trần kho |
| Monster Legends | Doanh trại theo hệ, công thức kết hợp, 3 giai đoạn tiến hóa |
| Prodigy | Đánh theo lượt, muốn ra chiêu phải trả lời đúng câu hỏi |

**Người chơi.** Học sinh lớp 7 (12–13 tuổi). Phần lớn chơi trên điện thoại, mỗi phiên 5–10 phút (khởi động tiết học, ôn bài ở nhà). Giáo viên có thể chiếu game lên máy chiếu.

**Mục tiêu học tập.** Bám theo bài "Ba lần kháng chiến chống quân xâm lược Mông – Nguyên" (Lịch sử và Địa lí 7: Bài 14 bộ Kết nối tri thức, Bài 17 bộ Cánh diều). Chơi hết chiến dịch, học sinh phải:

1. Trình bày được diễn biến chính của 3 lần kháng chiến (1258, 1285, 1287–1288), đúng trình tự và đúng trên lược đồ.
2. Giải thích được các kế sách: rút lui để bảo toàn lực lượng, "vườn không nhà trống", đánh vào hậu cần của địch (Vân Đồn), dựa vào địa hình và thủy triều (Bạch Đằng).
3. Nêu được vai trò của các nhân vật tiêu biểu.
4. Rút ra được nguyên nhân thắng lợi và ý nghĩa lịch sử.

## 1. Năm nguyên tắc bắt buộc

1. **Kiến thức là vũ khí.** Mọi sức mạnh quan trọng đều cần trả lời đúng câu hỏi về chính sự kiện đó: chiêu mộ tướng, tiến hóa, tung tuyệt chiêu, kích hoạt kế sách. Không dùng mô hình "trả lời quiz lấy vàng rồi sang tab khác chơi". Nghiên cứu của Habgood & Ainsworth (2011) cho thấy khi kiến thức nằm ngay trong cơ chế chính, trẻ học tốt hơn và tự nguyện chơi lâu hơn khoảng 7 lần so với bản "quiz rồi thưởng".
2. **Mỗi cơ chế dạy đúng một kế sách có thật** (bảng ánh xạ ở mục 4 và 6).
3. **Đúng sử, ghi rõ phần hư cấu.** Mọi thẻ tướng, cổ vật và màn chơi mang một trong ba nhãn: `Chính sử`, `Giai thoại – truyền thuyết`, `Sáng tạo của game`. Nội dung phải khớp `ai/data/knowledge_base.json`, để chatbot Quân Sư và game không nói ngược nhau.
4. **Tôn trọng nhân vật lịch sử.** Không "lai ghép", "ấp trứng" hay biến người thật thành quái vật. Không chế giễu anh hùng. Quân địch được thể hiện là đội quân xâm lược, không miệt thị dân tộc.
5. **Thân thiện với lớp học.**
   - Trả lời sai không bị phạt nặng, và luôn có giải thích.
   - Không nạp tiền, không hộp quà may rủi.
   - Không phạt người chơi vì không vào game mỗi ngày.
   - Chơi trọn vẹn được khi tắt âm thanh.

## 2. Ràng buộc kỹ thuật

| Hạng mục | Quy định |
|---|---|
| Mã nguồn | Viết trong `frontend/src/App.tsx` (React 19 + Tailwind v4, một file như hiện tại). Vẫn xuất **1 file HTML duy nhất** bằng `npm run build:single`, ra file `frontend/dist-single/index.html`. Không viết lại bằng Vanilla JS, vì sẽ mất đăng nhập 3 cổng và dữ liệu thật. |
| Phạm vi | Thay giao diện cổng `/hoc-sinh` bằng game. Các trang `/`, `/giao-vien`, `/admin` giữ nguyên chức năng, chỉ đổi theo bộ màu và font mới (mục 8). |
| Đồ họa | SVG nội tuyến + CSS. Không dùng ảnh nặng, không WebGL/3D. Icon chức năng dùng `lucide-react` (đã cài); không dùng emoji làm icon. |
| Thời gian nhàn rỗi | Tính theo mốc thời gian lưu sẵn (`lastCollectedAt`) và có trần kho, nên tắt máy vẫn tích lũy đến mức trần. Không cộng dồn bằng `setInterval`. Hoạt ảnh chỉ chạy khi màn hình đó đang mở. |
| Lưu trạng thái | Thêm cột `game_state` (JSON, tối đa 16 KB) vào bảng `app_progress` bằng migration **mới** `database/migrations/004_app_progress_game_state.sql`. Không sửa 001–003; bảng này đã bật RLS. Thêm cột tương ứng cho SQLite trong `database/user_store.py`, và API `GET/PUT /api/student/game`. |
| Chống gian lận | Client chỉ lưu bố cục công trình, tướng, cổ vật và mốc thời gian. **Ấn Tín (cột `gems`) và XP chỉ do server cộng** khi chấm câu trả lời. Sửa `POST /api/student/gems` để chỉ nhận số âm (tiêu Ấn Tín): hiện client có thể tự cộng tới 100.000 mỗi lần gọi. Bảng xếp hạng lớp dùng XP của server. |
| Câu hỏi | Có hai nguồn: ngân hàng câu hỏi cố định trong App (để chạy được khi mất mạng hoặc hết quota AI) và câu do `/api/quiz/generate` sinh ra (RAG + Gemini trên `ai/data`). Mỗi câu gắn một `unit_id` trong `ai/data/q_matrix.json`. Mỗi lần trả lời gửi `POST /api/student/answer` để BKT cập nhật; câu ôn tập lấy từ `GET /api/student/recommendations`. |

## 3. Vòng lặp cốt lõi

```
  Quốc Tử Giám (trả lời câu hỏi) ──► Ấn Tín + XP (server cộng)
          ▲                                   │
          │                                   ▼
  Sử Ký mở chương mới ◄── Chiến dịch 3v3 ◄── Điền Trang & Doanh Trại
  (tóm tắt bài học)     (ra chiêu = trả lời)   (Lương Thảo, Quân Lực, tướng)
```

- **Mỗi phiên (5–10 phút):** thu hoạch, làm 1 lượt khảo thí 5 câu, rồi nâng 1 công trình hoặc đánh 1 trận.
- **Mỗi ngày:**
  - 3 nhiệm vụ ngày.
  - Chuỗi ngày học (streak) có 1 "ngày nghỉ phép" mỗi tuần, thay vì mất trắng chuỗi.
  - Tối đa 1 đợt "Giặc cướp lương".
- **Dài hạn:** 3 màn chiến dịch, mỗi màn tối đa 3 sao; bộ sưu tập tướng và cổ vật; bảng xếp hạng lớp làm mới theo tuần.

### Tài nguyên

| Tài nguyên | Nguồn | Dùng để | Giá trị khởi điểm (chỉnh khi chơi thử) |
|---|---|---|---|
| Lương Thảo | Ruộng Ngụ Binh, tự sinh | Nuôi quân, nâng công trình | Cấp 1: 60/giờ; trần kho bằng 8 giờ sản lượng; mỗi cấp +50% |
| Quân Lực | Trại Ngụ Binh, đổi từ Lương Thảo | Ra trận, phòng thủ | 10 Lương Thảo đổi 1 Quân Lực |
| Ấn Tín | **Chỉ khi trả lời đúng** (server cộng) | Chiêu mộ, tiến hóa, mở cổ vật, nâng cấp lớn | 10/câu đúng, 15 nếu câu thuộc unit đang yếu (BKT); tối đa 300/ngày |
| Hào Khí | Trả lời đúng trong trận | Nạp tuyệt chiêu | Đầy sau 3 câu đúng; về 0 khi hết trận |
| XP / Cấp độ | Mọi hoạt động học | Mở tính năng, xếp hạng lớp | Dùng cột `xp` hiện có |

Thời gian nâng cấp ngắn để một phiên vẫn thấy kết quả: 30 giây ở cấp 2, 2 phút ở cấp 3, tối đa 10 phút. Chi phí tăng ×1,6 mỗi cấp.

## 4. Phần 1 — Điền Trang Đông A (căn cứ và tài nguyên nhàn rỗi)

Bản đồ căn cứ là lưới 6×6 ô, nhìn từ trên xuống hơi chéo. Chạm vào công trình để thu hoạch hoặc mở bảng nâng cấp. **Mỗi lần nâng cấp phải trả lời đúng 1 câu** thuộc unit gắn với công trình đó.

| Công trình | Chức năng | Kiến thức gắn kèm (`unit_id`) |
|---|---|---|
| Ruộng Ngụ Binh | Sinh Lương Thảo | Chính sách "ngụ binh ư nông" *(chưa có unit, cần bổ sung)* |
| Trại Ngụ Binh | Sinh Quân Lực: thời bình làm ruộng, có giặc thì ra trận | Ngụ binh ư nông *(cần bổ sung)* |
| Kho Bí Mật | Giữ lương an toàn khi bật "Vườn không nhà trống" | `KC1_VUON_KHONG_NHA_TRONG` |
| Xưởng Cọc Bạch Đằng | Chế bẫy cọc, có 3 cấp | `KC3_BACH_DANG_HOW` |
| Bến Vân Đồn | Đội thuyền phục kích đoàn lương địch | `KC3_VAN_DON` |
| Doanh Trại (5 hệ) | Nơi ở của tướng và lính theo hệ | `DANH_TUONG_GIA_THAN`, ... |
| Hội Quán Vạn Kiếp | Chiêu mộ, kết nghĩa, tiến hóa tướng (mục 5.2) | Theo công thức |
| Quốc Tử Giám | Khảo thí (mục 7) | Mọi unit |

### Sự kiện "Giặc Mông – Nguyên cướp lương"

**Khi nào xảy ra.** Chỉ khi học sinh đang mở game, sau mỗi 3 phiên học, tối đa 1 lần/ngày. Không chạy theo giờ thật, để học sinh không bị phạt vì vắng mặt.

**Diễn biến.**

1. Báo động 30 giây, đồng hồ đếm ngược hiển thị bằng số.
2. Người chơi chọn một trong hai cách:
   - **Vườn không nhà trống.** Trả lời 1 câu dạng "Vì sao…?".
     - Đúng: toàn bộ lương vào Kho Bí Mật. Giặc vào điền trang trống, thanh **Sức bền** tụt dần mỗi lượt vì không cướp được lương, cuối cùng phải rút. Người chơi được thưởng.
     - Sai: hiện giải thích, vẫn giấu được 50% lương.
   - **Đánh chặn.** Vào một trận phòng thủ ngắn, 1 lượt.
3. Kết quả xấu nhất: mất 10% Lương Thảo đang để ngoài kho. Không mất tướng, không mất công trình.

**Bài học hiện sau sự kiện.** Quân xâm lược đi xa, phải dựa vào lương cướp tại chỗ và đoàn vận lương. Mất nguồn lương thì kiệt sức và phải rút. Nội dung này khớp SGK và `KC1_VUON_KHONG_NHA_TRONG`.

### Bẫy và kế sách

- **Trận địa cọc Bạch Đằng**, 3 cấp:
  1. Cọc gỗ đẽo nhọn.
  2. Cọc gỗ đầu bịt sắt.
  3. Trận địa cọc kết hợp mai phục: Đại thắng Bạch Đằng, tháng 4/1288.
- **Phục kích Vân Đồn** (thay cho "Hỏa công"): chặn đánh, đánh đắm và thu lương của đoàn thuyền Trương Văn Hổ (cuối 1287 – đầu 1288). Nếu vẫn muốn có hiệu ứng lửa, phải gắn nhãn `Sáng tạo của game`.

## 5. Phần 2 — Doanh Trại, Hội Quán Vạn Kiếp, tiến hóa và cổ vật

### 5.1 Năm hệ quân (doanh trại theo địa danh)

| Hệ | Doanh trại | Lính | Tướng | Vai trò trong trận |
|---|---|---|---|---|
| Thủy | Thủy trại Vạn Kiếp – Bạch Đằng | Thủy binh | Yết Kiêu, Trần Khánh Dư | Đánh thuyền, phục kích đường sông |
| Mộc (rừng) | Thiên Trường – Trường Yên | Du kích, Quân Sát Thát | Phạm Ngũ Lão | Đánh kỵ binh trong địa hình rừng, đầm lầy |
| Thổ (núi, biên ải) | Nội Bàng – Chí Linh | Cung nỏ, dân binh miền núi | Trần Nhật Duật | Thủ chỗ hiểm, chặn đường tiến |
| Hỏa (hào khí) | Hội thề Bình Than – Diên Hồng | Quân Thánh Dực (cấm quân) | Trần Quốc Toản, Trần Bình Trọng | Tăng sĩ khí cả đội |
| Thống soái | Phủ đệ Hưng Đạo Vương | — | Trần Hưng Đạo, Trần Quang Khải, Trần Nhân Tông, Trần Thái Tông, Trần Thủ Độ | Kỹ năng chiến lược, đổi thế trận |

Mỗi hệ hiển thị bằng **màu + hình + chữ**: giọt nước, lá, núi, ngọn lửa, ấn triện. Không dùng màu đơn thuần.

### Điểm yếu của giặc (khắc chế = bài học)

| Loại quân địch | Mạnh ở | Bị khắc bởi (×1,5 sát thương) | Bài học lịch sử |
|---|---|---|---|
| Thiết kỵ Mông Cổ | Tốc độ, càn quét đồng bằng | Mộc, Thổ; hiệu ứng "Đói" | Kỵ binh khó xoay trở nơi rừng núi, sông nước; thiếu lương thì kiệt sức |
| Chiến thuyền Nguyên | Thuyền lớn, quân đông | Thủy, khi thủy triều rút + có trận cọc | Bạch Đằng 1288: thuyền địch mắc cọc khi triều rút |
| Đoàn thuyền lương | Nuôi cả phe địch (hồi phục mỗi lượt) | Thủy (phục kích) | Vân Đồn: mất lương, quân Nguyên lâm vào thế phải rút |
| Tướng giặc (boss) | Kỹ năng riêng | Theo màn | Mục 6 |

### 5.2 Hội Quán Vạn Kiếp — Chiêu mộ và kết nghĩa (thay cho "Lò lai ghép")

Cách chơi:

1. Đặt 2 thẻ vào Hội Quán: một thẻ Nhân lực và một thẻ Sự kiện hoặc Văn kiện.
2. Nhận một **Lệnh bài triệu tập** (thay cho "trứng"), chờ 1–5 phút.
3. Mở lệnh bài, trả lời 1–3 câu về sự kiện đó.
4. Tướng gia nhập.

Mỗi công thức dạy một quan hệ nhân – quả: vì sao người này được biết đến.

| Công thức | Kết quả | Bậc | Câu chuyện (nhãn) | Unit mở khóa |
|---|---|---|---|---|
| Dân binh Ngụ Binh + Hịch tướng sĩ | Quân Sát Thát (thích chữ "Sát Thát" lên tay) | Hiếm | Hịch tướng sĩ khích lệ quân sĩ trước kháng chiến lần 2 (Chính sử) | `HICH_TUONG_SI` |
| Quân Sát Thát + Hội nghị Bình Than (10/1282) | Hoài Văn hầu Trần Quốc Toản | Sử thi | Bóp nát quả cam; về lập đội quân dưới cờ "Phá cường địch, báo hoàng ân" (Chính sử) | `TQT_WHY_ORANGE`, `TQT_SIX_GOLDEN_WORDS` |
| Thủy binh + Người buôn than Chí Linh | Nhân Huệ vương Trần Khánh Dư | Huyền thoại | Từng bị tước quan tước, về Chí Linh buôn than; năm 1282 được dùng lại, sau lập công ở Vân Đồn (Chính sử) | `KC3_VAN_DON` + unit mới về Khánh Dư |
| Tướng hoàng tộc + Binh thư yếu lược | Hưng Đạo Đại vương Trần Quốc Tuấn | Tiết Chế | Được cử làm Quốc công Tiết chế (1282); tác giả Hịch tướng sĩ, Binh thư yếu lược (Chính sử) | `TRAN_HUNG_DAO_PORTRAIT` |
| Dân binh + Sọt tre bên đường | Phạm Ngũ Lão | Sử thi | Ngồi đan sọt mải nghĩ việc nước, bị giáo đâm vào đùi vẫn không hay (Giai thoại) | `PHAM_NGU_LAO` |
| Thủy binh + Sông sâu | Yết Kiêu | Hiếm | Gia thần của Trần Hưng Đạo, giỏi bơi lặn, lặn đục thuyền giặc (Truyền thuyết) | `YET_KIEU_DA_TUONG` |

**Các bậc:** Hiếm, Sử thi, Huyền thoại, và **Tiết Chế** (bậc riêng cho Trần Hưng Đạo, đặt theo chức Quốc công Tiết chế). Không dùng "Thần thoại", vì từ này ngụ ý nhân vật không có thật. Bậc chỉ phản ánh phạm vi chỉ huy trong game, không xếp hạng công lao.

### 5.3 Tiến hóa = các giai đoạn cuộc đời (thay cho Baby → Juvenile → Adult)

**Điều kiện tiến hóa:** đủ số trận, rồi trả lời đúng 2 câu về giai đoạn tiếp theo. Mỗi lần tiến hóa luyện thêm kỹ năng nhớ mốc thời gian.

| Đối tượng | Giai đoạn 1 | Giai đoạn 2 | Giai đoạn 3 |
|---|---|---|---|
| Trần Nhân Tông | Hoàng thái tử Trần Khâm (lập năm 1274) | Vua kháng chiến (lên ngôi 1278; Hội nghị Bình Than 1282; kháng chiến 1285 và 1287–1288) | Phật hoàng Trúc Lâm (xuất gia ở Yên Tử năm 1299) |
| Trần Quốc Toản | Thiếu niên ở Bình Than (1282) | Chủ tướng đội quân cờ sáu chữ vàng | Xông pha tuyến đầu trong cuộc phản công 1285 |
| Trần Hưng Đạo | Quốc công Tiết chế (1282) | Tác giả Hịch tướng sĩ (trước kháng chiến lần 2) | Đại thắng Bạch Đằng (1288) |
| Trận địa Bạch Đằng | Cọc gỗ đẽo nhọn | Cọc đầu bịt sắt | Đại trận Bạch Đằng (4/1288) |

Trần Nhân Tông sinh cuối năm 1258, sau kháng chiến lần 1. Vì vậy ông **không xuất hiện ở Màn 1**.

### 5.4 Cổ vật

| Cổ vật | Hiệu ứng | Nhãn | Câu chuyện / unit |
|---|---|---|---|
| Hịch tướng sĩ | Hồi 100% Sức bền cho cả đội, 1 lần/trận | Chính sử | Trần Hưng Đạo viết trước kháng chiến lần 2 (`HICH_TUONG_SI`) |
| Cờ thêu sáu chữ vàng | Hồi sinh 1 tướng, 1 lần/trận | Chính sử | "Phá cường địch, báo hoàng ân" của Trần Quốc Toản (`TQT_SIX_GOLDEN_WORDS`) |
| Thơ "Tụng giá hoàn kinh sư" | +50% tốc độ cho cả đội trong 2 lượt | Chính sử | Trần Quang Khải viết khi phò giá về kinh sau chiến thắng 1285: "Đoạt sáo Chương Dương độ, Cầm Hồ Hàm Tử quan" |
| Binh thư yếu lược | Xem trước ý đồ địch thêm 1 lượt | Chính sử | Tác phẩm của Trần Hưng Đạo *(cần bổ sung unit)* |
| Nón Ma Lôi | +Né tránh cho Thủy binh | Dân gian, cần đối chiếu | Nguồn phổ thông gắn nón Ma Lôi với thủy binh của Trần Khánh Dư. Bỏ hiệu ứng "ban đêm" vì không có căn cứ |

## 6. Phần 3 — Chiến dịch 3 màn (đánh theo lượt 3v3)

### 6.1 Luật trận đấu

**Đội hình và lượt.** 3 tướng ta đấu 3 đơn vị địch (1 boss + 2 lính). Thứ tự lượt theo chỉ số Tốc độ, hiện trên thanh lượt.

**Mỗi tướng có 3 chiêu:**

| Chiêu | Điều kiện | Kết quả |
|---|---|---|
| Đánh thường | Miễn phí | — |
| Kế sách | Trả lời 1 câu | Đúng: chiêu ×1,5 và nạp Hào Khí. Sai: chiêu còn 50% sức, hiện giải thích, **không mất lượt**. |
| Tuyệt chiêu | Thanh Hào Khí đầy | — |

**Thông tin hiển thị cho người chơi:**

- **Ý đồ của địch hiện trước**, theo kiểu Slay the Spire: biểu tượng chiêu lượt sau của địch, để học sinh lập kế. Ví dụ: thấy "Càn quét" thì bật "Vườn không nhà trống".
- **Thanh Sức bền của địch** tụt mỗi lượt khi nguồn lương đã bị cắt, mô phỏng việc giặc kiệt sức vì thiếu lương.

**Câu hỏi trong trận.**

- Mỗi câu tối đa 20 giây, có nút "Thêm thời gian".
- Đếm giờ tắt được trong Cài đặt, cho học sinh đọc chậm.

**Thua trận.** Chỉ mất lượt chơi, kèm gợi ý "Ôn lại 3 câu này rồi đánh lại".

**3 sao mỗi màn:**

- ★ Thắng trận.
- ★ Dùng đúng kế sách lịch sử của màn.
- ★ Trả lời đúng từ 80% số câu trở lên.

**Trước và sau trận.**

- Trước trận: "Tình báo" 30 giây, lược đồ hướng tiến quân của địch, có nút Bỏ qua.
- Sau trận: thẻ **Sử Ký** tóm tắt diễn biến, kết quả, ý nghĩa (lấy từ knowledge_base) và lưu vào tab Sử Ký.

### 6.2 Màn 1 — 1258: Từ Bình Lệ Nguyên đến Đông Bộ Đầu

- **Địch:** Ngột Lương Hợp Thai (boss) + 2 đạo thiết kỵ.
- **Đội hình gợi ý:** Trần Thái Tông, Trần Thủ Độ, Lê Phụ Trần.

| Pha | Diễn biến | Kế sách / chiêu | Đạt sao kế sách khi |
|---|---|---|---|
| 1. Bình Lệ Nguyên (tháng 1/1258) | Địch quá mạnh. Mục tiêu là **rút lui bảo toàn lực lượng**, không phải thắng. | Lê Phụ Trần "Hộ giá": che chắn cho vua rút | Rút đúng lúc |
| 2. Thăng Long bỏ trống | Địch vào kinh thành trống. | Kích hoạt "Vườn không nhà trống": địch mất Sức bền mỗi lượt. Trần Thủ Độ "Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo": cả đội miễn hiệu ứng hoảng sợ. | — |
| 3. Đông Bộ Đầu (29/1/1258) | Phản công khi địch đã suy yếu. | Trần Thái Tông "Thân chinh" | — |

- **Unit:** `KC1_OVERVIEW`, `KC1_WHY_INVADE`, `KC1_BINH_LE_NGUYEN`, `KC1_VUON_KHONG_NHA_TRONG`, `KC1_TRAN_THU_DO_QUOTE`, `KC1_DONG_BO_DAU`.
- **Lưu ý:** không ghi "giặc đói 9 ngày" vì chưa có nguồn khớp. Thời gian giặc kiệt sức tính bằng số lượt.

### 6.3 Màn 2 — 1285: Phá gọng kìm 50 vạn quân

- **Địch:**
  - Thoát Hoan (boss, đánh từ phía Bắc).
  - Toa Đô (từ Chăm-pa đánh lên ở phía Nam).
  - Ô Mã Nhi (thủy quân).
- **Đội hình gợi ý:** Trần Hưng Đạo, Trần Quang Khải, Trần Bình Trọng. Đổi được sang Trần Quốc Toản hoặc Trần Nhật Duật.

| Pha | Diễn biến | Kế sách / chiêu |
|---|---|---|
| 1. Giữ chân địch (Thiên Mạc) | Đội phải rút an toàn trong khi địch truy đuổi. | Trần Bình Trọng "Thà làm quỷ nước Nam": khiêu khích, hút đòn về mình 2 lượt cho đội rút. Ông hy sinh: thể hiện trang trọng bằng một thẻ tưởng niệm; không có hồi sinh kiểu game. |
| 2. Tổng phản công (tháng 5–6/1285) | Đánh lần lượt các cứ điểm của địch. | Trần Nhật Duật thắng ở Hàm Tử. Tuyệt chiêu của Trần Quang Khải "Đoạt sáo Chương Dương độ": đánh bến Chương Dương, mở đường về Thăng Long. |
| 3. Tây Kết và Vạn Kiếp | Hai trận cuối, hai kết cục khác nhau. | Toa Đô tử trận ở Tây Kết, là một trận của cuộc tổng phản công; **không gán cho tuyệt chiêu của Trần Quang Khải**. Ở Vạn Kiếp, Trần Hưng Đạo chặn đánh; Thoát Hoan chui ống đồng tháo chạy. Boss **trốn thoát**, không bị bắt, đúng như sử. |

- **Unit:** `KC2_OVERVIEW`, `KC2_TRAN_BINH_TRONG`, `KC2_HAM_TU_CHUONG_DUONG`, `KC2_THOAT_HOAN_COPPER_PIPE`, `DIEN_HONG_CONFERENCE`, `HICH_TUONG_SI`.

### 6.4 Màn 3 — 1287–1288: Vân Đồn và Bạch Đằng

- **Địch:**
  - Thoát Hoan (boss).
  - Trương Văn Hổ (đoàn thuyền lương).
  - Ô Mã Nhi (thủy quân).
- **Đội hình gợi ý:** Trần Hưng Đạo, Trần Khánh Dư, Yết Kiêu.

| Pha | Diễn biến | Kế sách / chiêu |
|---|---|---|
| 1. Vân Đồn (cuối 1287 – đầu 1288) | Chặn đường tiếp tế của địch ngay lượt đầu. | Trần Khánh Dư "Phục kích Vân Đồn": đánh đắm, thu lương, Trương Văn Hổ rời trận. Từ đó địch không còn hồi phục và mất Sức bền mỗi lượt (quân Nguyên ở Thăng Long thiếu lương, phải tính đường rút). |
| 2. Nhử địch vào Bạch Đằng | **Đồng hồ thủy triều** chạy theo lượt: Lên → Đứng → Rút. Cọc ngầm chỉ phát huy khi triều rút. | Tung tuyệt chiêu "Đại trận Bạch Đằng" đúng lúc triều rút: thuyền địch mắc cọc và vỡ. Tung sai lúc thì chiêu yếu đi và hiện giải thích vì sao. |
| 3. Kết thúc (tháng 4/1288) | Kết thúc chiến dịch. | Bắt sống Ô Mã Nhi. Thoát Hoan rút chạy về nước. |

- **Unit:** `KC3_VAN_DON`, `KC3_BACH_DANG_HOW`, `KC3_OVERVIEW`, và sau cùng `ALL_3_WARS_SUMMARY`, `CAUSES_OF_VICTORY`, `HISTORICAL_SIGNIFICANCE` cho phần tổng kết.

### 6.5 Tướng giặc

| Tướng giặc | Màn | Đặc điểm trong game | Kết cục (chính sử) |
|---|---|---|---|
| Ngột Lương Hợp Thai | 1 | Thiết kỵ càn quét | Rút khỏi Thăng Long sau trận Đông Bộ Đầu |
| Thoát Hoan | 2, 3 | Chỉ huy chính, gọi thêm quân | 1285 chui ống đồng tháo chạy; 1288 rút chạy về nước |
| Toa Đô | 2 | Đánh từ phía Nam lên | Tử trận ở Tây Kết (1285) |
| Ô Mã Nhi | 2, 3 | Thủy quân | Bị bắt sống ở Bạch Đằng (1288) |
| Trương Văn Hổ | 3 | Đoàn lương, hồi phục cho cả phe địch | Mất đoàn thuyền lương ở Vân Đồn |

Thể hiện tướng giặc là đối thủ đáng gờm, có kỹ năng rõ ràng. Không biếm họa ngoại hình, không dùng từ miệt thị.

## 7. Phần 4 — Quốc Tử Giám (khảo thí), Sử Ký và Quân Sư AI

### 7.1 Các chế độ khảo thí

| Chế độ | Cách chơi | Thưởng |
|---|---|---|
| Luyện nhanh | 5 câu, khoảng 2 phút | Ấn Tín |
| Tháp Khảo Thí | 10 tầng, mỗi tầng 3 câu. Độ khó tăng dần theo `cognitive_level` (NHAN_BIET → THONG_HIEU → VAN_DUNG). Tầng 5 và 10 là "Đình thí". Trả lời sai không bị rớt tầng, chỉ dừng lượt. | Cổ vật ở tầng 5 và 10 |
| Ôn điểm yếu | Câu lấy từ `GET /api/student/recommendations` (BKT) | Ấn Tín +50% |
| Thi đấu lớp (kiểu Kahoot/Quizizz) | Giáo viên mở phòng, cả lớp trả lời cùng lúc trên máy chiếu | Bảng vàng của lớp |

Chế độ Thi đấu lớp hiện vẫn dùng dữ liệu mẫu. Muốn chạy thật cần backend thời gian thực (WebSocket), nên xếp ở giai đoạn 4.

### 7.2 Câu hỏi và phản hồi

**Dạng câu hỏi:**

- Trắc nghiệm 4 lựa chọn.
- Đúng/Sai.
- Sắp xếp mốc thời gian.
- Nối nhân vật với sự kiện.
- Điền câu nói nổi tiếng.
- Chọn địa danh trên lược đồ.
- "Vì sao…?" (nguyên nhân – kết quả).

**Phản hồi:**

- Đúng: hiệu ứng ngắn và một dòng kiến thức mở rộng.
- Sai: đáp án đúng, giải thích 1–2 câu, nguồn trích (`GroundingSource` từ RAG), và nút "Hỏi Quân Sư" mở chatbot RAG hiện có.

### 7.3 Sử Ký và Quân Sư AI

**Sử Ký** là bách khoa thu nhỏ, giống Civilopedia trong Civilization:

- Dòng thời gian 1258–1288 kèm lược đồ.
- Thẻ tướng và thẻ sự kiện, mở dần khi gặp trong game. Mỗi thẻ có nhãn chính sử / hư cấu.

**Quân Sư AI** là chatbot hiện có, đóng vai quân sư.

Lưu ý về hình ảnh: Quốc Tử Giám có từ năm 1076. Không dùng hình Khuê Văn Các vì công trình này xây năm 1805, thời Nguyễn.

## 8. Giao diện và trải nghiệm (rà soát bằng ui-ux-pro-max)

### 8.1 Phong cách

Skill gợi ý **Claymorphism + Micro-interactions** cho app giáo dục và **Tactile / Deformable UI** cho game casual: nút "jelly" lún xuống khi bấm rồi nảy lại. Phong cách này được phủ chất liệu thời Trần:

- Nền giấy dó.
- Men ngọc gốm Trần.
- Sơn son thếp vàng.
- Họa tiết sóng nước Bạch Đằng.

Không dùng 3D/Hyperrealism: chính skill đánh giá chi phí hiệu năng cao và rủi ro accessibility cao, và ghi chú "tránh 3D" cho đúng nhóm sản phẩm này.

### 8.2 Bảng màu (token)

Hai chế độ: sáng "Giấy dó" và tối "Đêm Bạch Đằng". Đã kiểm tra tương phản WCAG: mọi cặp chữ/nền ≥ 4,5:1.

| Token | Sáng | Tối | Tương phản |
|---|---|---|---|
| `--color-bg` / `--color-fg` | `#FBF6EA` / `#1C1917` | `#0B1220` / `#F5EFE0` | 16,2 / 16,3 |
| `--color-card` | `#FFFDF7` | `#131C2E` | — |
| `--color-primary` (đỏ son) + chữ | `#B91C1C` + `#FFFFFF` | `#DC2626` + `#FFFFFF` | 6,5 / 4,8 |
| `--color-secondary` (men ngọc) | `#0F766E` + `#FFFFFF` | `#14B8A6` trên nền tối | 5,5 / 7,5 |
| `--color-accent` (vàng đồng) + chữ | `#D97706` + `#1C1917` | `#F59E0B` + `#1C1917` | 5,5 / 8,1 |
| `--color-muted` / `--color-muted-fg` | `#F3EAD7` / `#57534E` | — / `#A8A29E` | 6,4 / 6,8 |
| `--color-danger` | `#DC2626` + `#FFFFFF` | như sáng | 4,8 |
| Hệ Thủy · Mộc · Thổ · Hỏa · Thống soái | `#0369A1` · `#15803D` · `#A16207` · `#C2410C` · `#7E22CE` | `#38BDF8` · `#4ADE80` · `#FACC15` · `#FB923C` · `#C084FC` | ≥ 4,8 / ≥ 6,4 |

Dùng token ở mọi nơi; không viết mã màu trực tiếp trong component.

### 8.3 Font chữ

Hai cặp font skill gợi ý đầu tiên đều **không có bộ ký tự tiếng Việt** (theo `google-fonts.csv` của skill): Fredoka + Nunito, và Baloo 2 + Comic Neue. Với Fredoka và Comic Neue, chữ có dấu sẽ bị rơi về font khác, trông lệch. Chọn bộ sau:

| Vai trò | Font | Ghi chú |
|---|---|---|
| Tiêu đề, số lớn, nút, nội dung | **Manrope** (400–800) | Không chân, hiện đại, có đủ chữ tiếng Việt; dùng cho cả trang chủ, học sinh, giáo viên, quản trị |
| Thẻ Sử Ký, trích dẫn, chữ nghiêng nhấn | **Newsreader** (400, 700, 700 nghiêng) | Có chân dáng báo chí, có đủ chữ tiếng Việt, chất "sử sách" |

> Cập nhật 28/10/2026: đã đổi từ Baloo 2 + Be Vietnam Pro + Noto Serif sang Manrope + Newsreader trên toàn ứng dụng.

**Quy định chữ:**

- Cỡ chữ cơ bản 16px.
- Khoảng cách dòng ≥ 1,5, vì dấu chồng như "ữ", "ẫ" cần chỗ.
- Số tài nguyên và đồng hồ dùng `font-variant-numeric: tabular-nums` để không bị nhảy chữ.

**Chạy offline:** nếu cần mở trên lớp không có mạng, nhúng woff2 subset `vietnamese` vào file build.

### 8.4 Điều hướng và bố cục

**Thanh điều hướng dưới, 5 mục, mỗi mục có icon + chữ** (skill: tối đa 5 mục, phải có nhãn):

- Điền Trang
- Doanh Trại
- Chiến Dịch
- Quốc Tử Giám
- Sử Ký

Hội Quán Vạn Kiếp nằm trong Doanh Trại. Hồ sơ, Bảng xếp hạng và Cài đặt mở từ avatar.

**Thanh HUD trên cùng:** Lương Thảo, Quân Lực, Ấn Tín, chuỗi ngày, avatar. HUD không được che nội dung và phải tránh tai thỏ, thanh cử chỉ (safe-area).

**Kích thước màn hình:** thiết kế dọc cho 375px trước, mở rộng ở 768 / 1024 / 1440px. Trên máy chiếu hiển thị 2 cột.

**Liên kết sâu:** giữ hash routing hiện có (chạy được cả khi mở file://), ví dụ `#/hoc-sinh/chien-dich/2`.

### 8.5 Tương tác, hoạt ảnh, âm thanh

**Chạm và thao tác:**

- Vùng chạm ≥ 44×44px, các nút cách nhau ≥ 8px.
- Không có thao tác nào chỉ dùng được bằng hover.
- Mọi thao tác kéo thả đều có cách bấm thay thế.

**Phản hồi:**

- Nút có trạng thái nhấn: `scale(0.95)` rồi nảy lại khoảng 400ms. Không làm xê dịch bố cục.
- Thao tác lâu hơn 300ms hiện trạng thái đang tải.
- Khi chờ AI sinh câu hỏi, hiện skeleton.

**Hoạt ảnh:**

- Mỗi màn hình tối đa 1–2 hoạt ảnh nổi bật.
- Hiệu ứng thưởng ≤ 800ms.
- Không nhấp nháy quá 3 lần/giây.
- Khi `prefers-reduced-motion` bật: tắt rung màn hình, hạt và parallax.

**Âm thanh:** mặc định **tắt** vì dùng trong lớp học; mọi phản hồi đều có hình hoặc chữ, không chỉ âm thanh.

### 8.6 Khả năng tiếp cận

- Tương phản chữ ≥ 4,5:1 ở cả hai chế độ; icon mang thông tin ≥ 3:1.
- Hệ quân và hiệu ứng trạng thái dùng màu + hình + chữ.
- Dùng được hoàn toàn bằng bàn phím, có viền focus rõ.
- Nút chỉ có icon phải có `aria-label`.
- Hướng dẫn chơi lần đầu có nút Bỏ qua và Quay lại.

### 8.7 Hình ảnh nhân vật

- **Chân dung dạng huy hiệu SVG:** khung theo hệ cùng vật biểu trưng của từng người. Ví dụ: quả cam và lá cờ của Quốc Toản, sọt tre và ngọn giáo của Ngũ Lão, cọc gỗ của Bạch Đằng.
- Không vẽ "chân dung thật" khi không có tư liệu hình ảnh, để tránh gây hiểu nhầm.
- Trang phục, thuyền, vũ khí tham khảo tư liệu thời Trần.
- Không dùng hình ảnh triều Nguyễn hay trang phục hiện đại.
- Hành Trình Đông A: nhân vật pixel đều là người hư cấu (bô lão, lính trạm, lái đò, thầy đồ, thám báo…) kể lại chuyện của người thật; không vẽ danh nhân. Cây trồng chỉ dùng loại có ở Đại Việt thời Trần (lúa nước, đậu, khoai sọ – không có ngô).

### 8.8 Kiểm tra trước khi bàn giao (theo checklist của skill)

- [ ] Thử ở màn 375px và màn ngang; bật reduced-motion; phóng chữ lớn nhất.
- [ ] Kiểm tra tương phản chế độ tối riêng, không suy ra từ chế độ sáng.
- [ ] Mọi vùng chạm ≥ 44px; không có nội dung bị che bởi safe-area.
- [ ] Không dùng emoji làm icon; icon cùng một bộ, cùng độ dày nét.
- [ ] Trạng thái nhấn không làm xê dịch bố cục; chỉ dùng token màu.
- [ ] `npm run build:single` mở được trực tiếp từ file://.

## 9. Cổng giáo viên và quản trị

- **Giáo viên** — bảng lớp gồm:
  - Màn và số sao từng học sinh đang có.
  - Tỉ lệ đúng theo từng unit (BKT).
  - 5 câu cả lớp sai nhiều nhất.
  - Danh sách học sinh cần hỗ trợ.
  - Xuất CSV (đã có) và mở phòng "Thi đấu lớp".
- **Quản trị:** hai cổng độc lập `/admin` (quản trị tổng) và `/school-manager-admin` (quản trị trường), cấp tài khoản bằng file Excel mẫu, duyệt lớp, thùng rác 45 ngày – xem README, mục “Cấp tài khoản bằng file Excel”.

## 10. Lộ trình và tiêu chí hoàn thành

**Việc làm trước** (nội dung còn thiếu trong `ai/data`). Thêm vào `knowledge_base.json` và `q_matrix.json`:

- Ngụ binh ư nông.
- Trần Khánh Dư buôn than ở Chí Linh.
- Binh thư yếu lược.
- Các giai đoạn đời Trần Nhân Tông.
- Nón Ma Lôi (nếu giữ cổ vật này).

Unit mới trong q_matrix là đủ để BKT chấm. Muốn chatbot trả lời được các chủ đề mới thì phải huấn luyện lại mô hình bằng `ai/create_model.py` và chạy `ai/test_regression_suite.py`.

| Giai đoạn | Nội dung | Hoàn thành khi |
|---|---|---|
| 1. Nền móng | Token màu, font, HUD, thanh 5 mục; Điền Trang (Ruộng, Trại, Kho); sự kiện cướp lương + Vườn không nhà trống; Luyện nhanh; migration 004 + API `game_state`; khóa `/api/student/gems` | Học sinh đăng nhập, thu hoạch, trả lời 5 câu, thoát ra vào lại vẫn còn tiến độ; Ấn Tín chỉ tăng qua server |
| 2. Trận đầu | Hệ thống trận 3v3, Màn 1, 6 tướng đầu, Sử Ký, Tháp Khảo Thí | Đánh xong Màn 1 đạt 3 sao; BKT cập nhật theo `KC1_*`; mọi câu sai đều có giải thích |
| 3. Sưu tập | Hội Quán Vạn Kiếp, tiến hóa, cổ vật, Màn 2 | 6 công thức chiêu mộ chạy được; các bước tiến hóa đúng mốc năm |
| 4. Đại thắng | Màn 3 + đồng hồ thủy triều, bảng giáo viên mới, Thi đấu lớp (nếu có backend thời gian thực) | Checklist 8.8 đạt hết; bản build:single chạy được |

**Gợi ý đánh giá cho khóa luận.** Hai cách đo hiệu quả:

- Làm bài kiểm tra 10 câu trước và sau khi chơi.
- Ghi số liệu: tỉ lệ đúng theo unit, thời gian chơi, số lần ôn điểm yếu. Các số này lấy được từ `bkt_state` và bảng giáo viên.

---

## Phụ lục A — Những chỗ đã sửa so với bản gốc

| # | Bản gốc | Vấn đề | Bản mới |
|---|---|---|---|
| 1 | 1 file HTML viết bằng Vanilla JS | Phải viết lại đăng nhập 3 cổng, API, dữ liệu thật | Giữ React trong `App.tsx`; vẫn xuất 1 file HTML |
| 2 | Quốc Tử Giám là tab riêng để kiếm tài nguyên | Học tách khỏi chơi ("bọc đường") | Câu hỏi nằm trong mọi cơ chế chính (nguyên tắc 1) |
| 3 | "Lai ghép tướng", "trứng" với người thật | Thiếu tôn trọng anh hùng dân tộc, dễ bị nhà trường phản đối | "Chiêu mộ – kết nghĩa", "Lệnh bài triệu tập" |
| 4 | Bậc "Mythic" cho Trần Hưng Đạo | "Thần thoại" ngụ ý nhân vật không có thật | Bậc "Tiết Chế" |
| 5 | Trần Nhân Tông "Thái tử (1258)" | Ông sinh cuối năm 1258, được lập Thái tử năm 1274 | Thái tử 1274 → Vua 1278 → xuất gia 1299; không có mặt ở Màn 1 |
| 6 | Tuyệt chiêu Trần Quang Khải "Cướp giáo Chương Dương, chém đầu Toa Đô ở Tây Kết" | Gộp 2 trận khác nhau: Quang Khải chỉ huy Chương Dương; Toa Đô tử trận ở Tây Kết | Tách thành 2 sự kiện (mục 6.3) |
| 7 | "Hỏa công đốt thuyền lương Trương Văn Hổ" | Nguồn và knowledge_base đều ghi phục kích, đánh đắm, thu lương; không nói đến hỏa công | "Phục kích Vân Đồn"; lửa chỉ là hiệu ứng có nhãn sáng tạo |
| 8 | "Cho giặc đói 9 ngày" | Chưa tìm được nguồn; các nguồn ghi Bình Lệ Nguyên khoảng 17/1 và Đông Bộ Đầu 29/1/1258 | Tính bằng số lượt, không ghi số ngày |
| 9 | Nón Ma Lôi "+80% né tránh ban đêm" | Chỉ có nguồn phổ thông, gắn với thủy binh Trần Khánh Dư; hiệu ứng ban đêm không có căn cứ | Gắn với Thủy binh, nhãn "dân gian, cần đối chiếu" |
| 10 | "Thánh Dực Dũng Nghĩa" | Có tài liệu về quân Thánh Dực (một đơn vị cấm quân thời Trần), nhưng chưa thấy nguồn cho cụm "Dũng Nghĩa" | "Quân Thánh Dực (cấm quân)" |
| 11 | "Đấu trường Bình Than – Diên Hồng" | Đây là hai hội nghị, không phải trận đánh; Hội nghị Diên Hồng do Thượng hoàng Trần Thánh Tông triệu tập | "Hội thề Bình Than – Diên Hồng"; ghi đúng người triệu tập |
| 12 | "Sói tấn công chuồng" theo chu kỳ | Nếu chạy theo giờ thật sẽ phạt học sinh vắng mặt | Chỉ xảy ra khi đang chơi, tối đa 1 lần/ngày, mất tối đa 10% |
| 13 | 4 tab | Không có nơi xem lại kiến thức | Thêm tab Sử Ký (vẫn ≤ 5 mục) |
| 14 | Không nói đến accessibility, hiệu năng, lưu dữ liệu | Thiếu tiêu chí bàn giao | Mục 2, 8, 10 |
| 15 | (Hệ thống hiện tại) `/api/student/gems` cho cộng tối đa ±100.000 mỗi lần | Học sinh tự cộng tiền được | Chỉ server cộng; endpoint chỉ nhận số âm |

## Phụ lục B — Game tham khảo

| Game | Học được gì | Không lấy |
|---|---|---|
| **Prodigy Math** | Ra chiêu phải trả lời đúng; sai thì có gợi ý và giải thích; câu hỏi thích ứng theo trình độ | Sai 2 lần là mất lượt (quá nặng với lớp học) |
| **Blooket** (Tower Defense, Factory, Gold Quest) | Trả lời câu hỏi → có tiền → xây tháp, nâng nhà máy; vòng chơi ngắn, hợp lớp học | Cướp vàng của bạn cùng lớp (dễ gây mâu thuẫn) |
| **Gimkit** | Kinh tế "trả lời → tiền → nâng cấp": thêm điểm mỗi câu, thưởng chuỗi đúng, "bảo hiểm" khi sai | — |
| **Bonnievale Online** (butastudio, game nông trại – phiêu lưu pixel) | Thung lũng pixel đi lại tự do; cây lớn theo thời gian thực, bỏ quên cũng không chết; người dân giao việc, vùng đất mở dần; cẩm nang tra cứu → Hành Trình Đông A | Chơi trực tuyến nhiều người, mã mời, nghề và trùm theo tổ đội |
| **Monster Legends** | Doanh trại theo hệ, công thức kết hợp, 3 giai đoạn tiến hóa | Chờ ấp hàng giờ, gói nạp tiền |
| **Clash of Clans, Hay Day** | Căn cứ trên lưới, chạm để thu, thời gian nâng cấp | Thời gian chờ dài, tấn công người chơi khác |
| **Slay the Spire** | Báo trước ý đồ địch, buộc người chơi lập kế | — |
| **Civilization** | Civilopedia, nguồn ý tưởng cho tab Sử Ký | — |
| **Zombie Division** (Habgood & Ainsworth) | Bằng chứng nghiên cứu cho nguyên tắc "kiến thức là vũ khí" | — |
| **Game sử Việt hiện có** (game trắc nghiệm của FPT với sử gia Lê Văn Lan, 2007; app "Giải Mã Danh Nhân") | Đều là trắc nghiệm. Chưa tìm thấy game chiến thuật nào về nhà Trần chống Mông – Nguyên: đây là điểm mới của khóa luận | — |

## Phụ lục C — Nguồn

**Game và nghiên cứu**

- [Prodigy — Parent's guide](https://prodigygame.com/blog/parents-guide-to-prodigy) · [Prodigy Math Game (Wikipedia)](https://en.wikipedia.org/wiki/Prodigy_Math_Game)
- [Monster Legends — Breeding guide (PocketGamer)](https://www.pocketgamer.com/monster-legends/a-guide-to-breeding) · [Evolution guide](https://www.pocketgamer.com/monster-legends/a-guide-to-evolution)
- Blooket, Gimkit: chỉ tìm được trang tổng hợp chất lượng thấp, nên đối chiếu thêm trên trang chính thức trước khi trích dẫn trong khóa luận.
- [Habgood & Ainsworth (2011) — Motivating children to learn effectively](https://shura.shu.ac.uk/3556/)
- [Học lịch sử Việt Nam qua game online (Nhân Dân)](https://nhandan.vn/ocop/hoc-lich-su-viet-nam-qua-game-online-post436406.html) · [Giải Mã Danh Nhân (App Store)](https://apps.apple.com/us/app/-/id6739932044)

**Lịch sử**

- [Lịch sử 7 KNTT Bài 14 (Loigiaihay)](https://loigiaihay.com/bai-14-ba-lan-khang-chien-chong-quan-xam-luoc-nguyen-mong-sgk-lich-su-va-dia-li-7-ket-noi-tri-thuc-a107729.html) · [Cánh diều Bài 17](https://loigiaihay.com/bai-17-ba-lan-khang-chien-chong-quan-xam-luoc-mong-nguyen-sgk-lich-su-va-dia-li-7-canh-dieu-a107988.html)
- [Trận Đông Bộ Đầu (Giáo dục Việt Nam)](https://giaoduc.net.vn/tran-dong-bo-dau-chien-cong-hien-hach-cua-quan-dan-ta-thoi-nha-tran-post184152.gd)
- [Mongol invasions of Vietnam (Wikipedia)](https://en.wikipedia.org/wiki/Mongol_invasions_of_Vietnam) · [Chương Dương – Hàm Tử (Znews)](https://znews.vn/hang-tram-nghin-giac-nguyen-mong-thua-tan-tac-o-chuong-duong-ham-tu-post909993.html)
- [Trần Khánh Dư (Wikipedia)](https://en.wikipedia.org/wiki/Tr%E1%BA%A7n_Kh%C3%A1nh_D%C6%B0) · [Trần Khánh Dư với chiến thắng Vân Đồn (Giáo dục Việt Nam)](https://giaoduc.net.vn/danh-tuong-tran-khanh-du-voi-chien-thang-van-don-dau-nam-1288-post184740.gd)
- [Battle of Bạch Đằng 1288 (Wikipedia)](https://en.wikipedia.org/wiki/Battle_of_B%E1%BA%A1ch_%C4%90%E1%BA%B1ng_(1288))
- [Hội nghị Diên Hồng (Báo Pháp luật)](https://baophapluat.vn/hoi-nghi-dien-hong-vang-mai-hao-khi-non-song-post415412.html)
- [Trần Nhân Tông (Giáo dục Việt Nam)](https://giaoduc.net.vn/tran-nhan-tong-vi-vua-anh-hung-cuu-nuoc-vi-su-to-cua-thien-phai-truc-lam-post165812.gd) · [Tạp chí Tòa án](https://tapchitoaan.vn/tran-nhan-tong-vi-vua-anh-minh)
- [Trần dynasty military organization (Wikipedia)](https://en.wikipedia.org/wiki/Tr%E1%BA%A7n_dynasty_military_tactics_and_organization)
- [Nón lá — Ma Lôi (nguồn phổ thông)](https://www.vietnammonpaysnatal.fr/conic-hat-non-la/)

Nhiều nguồn ở trên là tài liệu phổ thông. Khi đưa vào khóa luận, nên đối chiếu thêm với *Đại Việt sử ký toàn thư* và SGK đang dùng.
