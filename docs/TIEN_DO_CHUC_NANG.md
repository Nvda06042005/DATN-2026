# Tiến độ theo danh sách chức năng, đánh giá và đề xuất

Nguồn: `fuction list/DanhSachChucNang_GameHoa_LichSu_ThoiTran.xlsx` (259 chức năng, 27 nhóm, 4 giai đoạn gợi ý GĐ1–GĐ4,
cùng các sheet Phân quyền, Quy trình, Quy tắc hệ thống, Điểm cần chốt). Cập nhật ngày 31/10/2026.

Cách đọc: **Xong** = có mã nguồn và kiểm thử tương ứng; **Một phần** = có nền nhưng thiếu ý chính của chức năng hoặc mới
lưu dữ liệu chưa nối vào game/AI; **Chưa** = chưa có. Đây là đối chiếu theo mã nguồn và test tự động, chưa phải nghiệm thu
từng mục với người dùng thật. Cột “Trạng thái” trong file Excel vẫn là “Chưa cập nhật” vì chưa ai ghi vào đó.

## 1. Tiến độ

Đã đối chiếu từng mục ở 12 nhóm (113/259 chức năng): **82 xong, 16 một phần, 15 chưa**. Các nhóm còn lại chỉ đánh giá ở mức nhóm.

| Nhóm | Số mục | Xong | Một phần | Chưa | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| 01 Tài khoản và xác thực | 8 | 4 | 2 | 2 | Đăng nhập/xuất, trang theo vai trò, đổi mật khẩu xong. Hồ sơ cá nhân (004) chưa có màn riêng; quên mật khẩu (007) chỉ cho hai cổng quản trị; **chưa** sửa thông tin cá nhân (005) và học sinh tự đăng ký (008). |
| 02 Phân quyền và bảo mật | 7 | 6 | 1 | 0 | RBAC, cách ly theo trường/lớp, Bcrypt, JWT thu hồi, nhật ký. 007 (bảng xếp hạng công bố theo chính sách trường) chưa có. |
| 03 QTV – Trường học | 11 | 11 | 0 | 0 | `docs/SCHOOL_ADMIN.md` |
| 04 QTV – Thống kê | 8 | 8 | 0 | 0 | `docs/ADMIN_REPORTS.md` |
| 05 QTV – Nội dung & cấu hình | 6 | 2 | 4 | 0 | Mới ngày 31/10. Câu hỏi (002) và nhật ký (006) xong; chương trình (001), kho sử liệu AI (003), thẻ (004), luật EXP (005) mới lưu, chưa nối vào game/AI. `docs/ADMIN_CONTENT.md` |
| 06 QTV trường – Tổng quan | 11 | 10 | 0 | 1 | 003 (QTV trường sửa liên hệ trường mình) chưa: hiện chỉ quản trị tổng sửa hồ sơ trường. |
| 07 QTV trường – Khối/lớp | 9 | 9 | 0 | 0 | **Mới trong lượt này**, xem mục 2. 005 mới hỗ trợ một giáo viên phụ trách chính. |
| 08 QTV trường – Tài khoản | 6 | 6 | 0 | 0 | |
| 09 Nhập Excel | 12 | 5 | 4 | 3 | Có một mẫu chung giáo viên + học sinh. Chưa có mẫu riêng (001–003) và mẫu tùy chọn (004), **chưa** nhập lớp (007), **chưa** xem trước trước khi ghi (008) vì hiện ghi ngay. |
| 10 Giáo viên – Quản lý lớp | 10 | 7 | 2 | 1 | Đặt/đổi mật khẩu lớp và đóng/mở đăng ký **mới**. Chưa có duyệt yêu cầu gia nhập (007, mục “đề xuất bổ sung”). Tìm/lọc học sinh mới có tìm theo tên. |
| 15 Giáo viên – Thi đấu trực tiếp | 16 | 10 | 3 | 3 | Phòng thi có PIN, khóa, bắt đầu/mở đáp án/câu kế, bảng xếp hạng, kết thúc và lưu. Không thấy cấu hình thời gian trả lời từng câu (003), thưởng EXP của giáo viên (015), nhiệm vụ AI ôn câu sai sau thi (016). |
| 18 Học sinh – Lớp học và học liệu | 9 | 4 | 0 | 5 | Danh sách lớp mở đăng ký **mới**. Tài liệu, sa bàn, thông báo ôn tập/điểm phụ thuộc nhóm 11 và 16. |

Chỉ đánh giá ở mức nhóm:

| Nhóm | Số mục | Trạng thái |
| --- | --- | --- |
| 11 GV – Tài liệu, bài giảng, sa bàn | 11 | Chưa |
| 12 GV – Công việc & thông báo | 9 | Chưa |
| 13 GV – Lộ trình & bài tập | 9 | Chưa |
| 14 GV – Ngân hàng câu hỏi | 10 | Chưa (chỉ có AI soạn đề cho giáo viên) |
| 16 GV – Báo cáo và bảng điểm | 9 | Một phần: tổng quan lớp, tiến độ chiến dịch, xuất CSV; chưa có phổ điểm, bảng điểm công bố, xuất Excel |
| 17 Chatbot, chuyển tuyến giáo viên | 10 | Một phần: trò chuyện AI có; **toàn bộ phần chuyển tuyến và nhắn tin với giáo viên chưa có** |
| 19 HS – Tự học, nhiệm vụ | 10 | Một phần: luyện tập, mức độ, ôn phần yếu có; bài tập giáo viên giao chưa |
| 20 HS – Thi đấu và phòng chơi | 7 | Phần lớn có (vào bằng PIN, trả lời, bảng xếp hạng, kết quả); thưởng EXP từ giáo viên chưa |
| 21 Bản đồ 3 cuộc kháng chiến | 9 | Phần lớn có trong game (chiến dịch, bản đồ, mở khóa, sao) |
| 22 Game 2D nhập vai | 15 | Một phần: thế giới 2D “Hành Trình Đông A” và giao tranh có; chưa đối chiếu từng mục (checkpoint, đồng bộ LMS) |
| 23 Bộ sưu tập thẻ & đội hình | 8 | Phần lớn có (Sử Ký, Doanh Trại, đội hình) |
| 24 AI gia sư & sử liệu RAG | 12 | Một phần: hỏi đáp có truy xuất từ kho tri thức, nhân vật, nguồn; **kho sử liệu quản trị chưa nối**, chưa lưu phiên chat |
| 25 EXP, học vị, streak, thành tích | 12 | Một phần: EXP, cấp, streak, bảng xếp hạng lớp có; học vị khoa cử, huy hiệu chiến dịch, xếp hạng khối/trường chưa |
| 26 Thông báo & xuất bản | 7 | Một phần: hộp thông báo và đánh dấu đã đọc có; các loại thông báo còn lại chờ nhóm 11, 12, 16, 17 |
| 27 Kỹ thuật & chất lượng | 8 | Một phần: PostgreSQL, responsive, log có; chunking/embedding/pgvector cho RAG và sao lưu chưa |

## 2. Làm trong lượt này: nhóm 07 và 10 (vòng đời lớp)

**Vì sao chọn:** đây là chỗ hổng lớn nhất của GĐ1 và là nền của luồng F01 (thiết lập trường và lớp), cũng là điều kiện để
nhóm 11–16 (giáo viên chỉ làm việc với lớp được phân công) có ý nghĩa. Trước đó giáo viên tự xin mở lớp rồi chờ duyệt, trái với ma
trận phân quyền (“Quản trị viên trường tạo lớp; giáo viên không tự tạo lớp”).

Luồng mới (migration `012_class_lifecycle.sql`, `class.service.ts`, `ClassManagement.tsx`):

1. QTV trường (hoặc tổng) **bật khối 6–9 theo năm học** (SCH-CLASS.001/002). Ngưng khối chỉ được khi hết lớp đang hoạt động.
2. **Tạo lớp** (003): khối phải đang bật, mã duy nhất theo trường và năm học. Lớp mới đã duyệt, chưa có giáo viên, chưa có mật khẩu.
3. **Phân công / đổi / hủy giáo viên** (005/006): giáo viên cùng trường, đang hoạt động; giáo viên được thông báo. Khi đổi hoặc hủy,
   **mật khẩu lớp cũ bị thu hồi** (người cũ biết mật khẩu), học sinh đã vào lớp không bị ảnh hưởng; giáo viên cũ mất quyền với lớp.
4. Giáo viên **đặt/đổi mật khẩu lớp, đóng/mở đăng ký** (T-CLASS.003–005). Mật khẩu cũ hết hiệu lực ngay, chỉ lưu băm.
5. Học sinh xem **lớp đang mở đăng ký** trong trường và nhập mật khẩu để vào (S-CLASS.001/002). Thông báo “lớp đang đóng” chỉ hiện
   khi mật khẩu đúng, để không dò được lớp nào tồn tại.
6. **Chuyển học sinh** giữa các lớp cùng trường (008): giữ điểm và tiến độ, ghi lịch sử, thông báo hai phía. **Đóng/mở lớp** (009)
   giữ thành viên, điểm và lịch sử thi đấu. Mọi bước ghi `app_class_events` (chỉ thêm, không lưu mật khẩu).

Luồng cũ (giáo viên xin mở lớp, quản trị duyệt) **được giữ nguyên** để không phá dữ liệu hiện có. Quản trị trường nay sửa được lớp
của trường mình (trước chỉ quản trị tổng); quản trị trường chỉ thấy lớp trường mình (RLS), lớp trường khác trả 404.

Kiểm thử: `backend/test/classes.spec.ts` (6 nhóm kiểm thử trên PostgreSQL tạm, gồm cách ly hai trường, thu hồi mật khẩu khi đổi giáo viên,
giữ điểm khi chuyển lớp, RLS bảng mới) và cập nhật `migrations.spec.ts`, `school-management.spec.ts`.

## 3. Đánh giá độ hợp lý của danh sách chức năng

### 3.1 Mâu thuẫn trong chính file

1. **Điều kiện qua ải 70% với 3–5 câu/trạm** (Quy tắc 5, 6): 70% của 3 câu là 2,1 nên thực tế phải đúng 3/3; của 4 câu là 2,8, phải 3/4;
   chỉ 5 câu mới là 4/5. Nên chốt “đúng ít nhất X câu” theo từng số câu hoặc cố định số câu, rồi để quản trị cấu hình (Điểm cần chốt 9).
2. **Hai bộ trạng thái xuất bản khác nhau:** Quy tắc 25 “Nháp → Kiểm tra → Đã gửi”, T-TODO.008 “Cần làm, Nháp, Đang thực hiện, Đã xong, Đã gửi”,
   còn T-TODO.004 dùng “Đã xong/Đã gửi”. Cần **một** máy trạng thái chung cho mọi nội dung phát hành (bài giảng, bộ đề, bảng điểm).
3. **Trùng chức năng:** T-TODO.004–006 lặp lại T-MATERIAL.010/011, T-QUIZ.005/006 và T-REPORT.009; NOTICE.002–004 lặp lại chính
   các hành động phát hành đó. Nên làm một lần: mỗi nội dung có trạng thái phát hành và sinh thông báo khi chuyển sang “Đã gửi”;
   TODO chỉ còn là danh sách việc cá nhân.
4. **Thứ tự giai đoạn bị đảo:** S-CLASS.005–009 (GĐ1) cần tài liệu/điểm của T-MATERIAL, T-REPORT (GĐ2); T-QUIZ (GĐ2) dùng câu chuẩn
   do SA-CONTENT.002 duyệt (GĐ3); F04 bước 3 và S-STUDY.006 (GĐ2) cần game 2D RPG (GĐ3); NOTICE.006 (GĐ2) thông báo phản hồi chat
   trong khi CHAT (GĐ3). Nên dời các mục phụ thuộc về cùng giai đoạn với phần chúng cần.
5. **Quyền tạo lớp:** ma trận #5 nói giáo viên không tự tạo lớp, nhưng tài liệu trước đó và mã nguồn cũ cho giáo viên xin mở lớp.
   Mã nguồn đang giữ cả hai; cần bạn chốt bỏ luồng cũ hay giữ (xem mục 5).
6. **Tham gia lớp:** ma trận #17 ghi giáo viên “Duyệt”, T-CLASS.007 lại là tùy chọn “nếu bật xét duyệt”. Cần mặc định rõ: vào thẳng bằng mật khẩu (hiện tại) hay chờ duyệt.
7. **Kiến trúc AI ghi trong Quy tắc 20 (BGE-M3 1024 chiều, chunk 300–500 token, pgvector Top-K)** khác thực tế (mô hình NLP cục bộ + kho tri thức
   JSON, pgvector chỉ dùng đối chiếu dòng nhập thiếu). Hoặc sửa tài liệu cho đúng, hoặc xây thật; không nên để báo cáo khóa luận nói một đằng, hệ thống làm một nẻo.
8. **Mục kỹ thuật lẫn vào danh sách chức năng:** TECH.001, 003–005, 007 là yêu cầu phi chức năng/chi tiết cài đặt. Chuyển sang mục “Yêu cầu phi chức năng”
   với tiêu chí đo được (độ trễ, hỗ trợ trình duyệt, dung lượng).

### 3.2 Chưa chặt hoặc thiếu

- **Ưu tiên bị “lạm phát”:** 213/259 mục (82%) là “Cao”, 43 “Trung bình”, 3 “Thấp”. Không phân biệt được cái gì làm trước khi thiếu thời gian.
- **Nguồn yêu cầu:** 195 mục “Yêu cầu của bạn”, 41 “Tài liệu MD”, 23 “Đề xuất bổ sung”. 23 mục sau chưa được xác nhận nhưng nằm cùng bậc ưu tiên “Cao”.
- **Điểm số chưa định nghĩa:** “bảng điểm” (T-REPORT) gồm những thành phần nào (luyện tập, bài tập, thi đấu) và trọng số ra sao? Báo cáo hiện tính “điểm luyện tập TB /10”,
  không phải điểm học kỳ. Cần chốt công thức trước khi công bố cho học sinh.
- **Học vị khoa cử (GAME.003, Quy tắc 13):** chuỗi Tú tài → Cử nhân → Tiến sĩ → Bảng nhãn → Trạng nguyên. Theo hiểu biết của tôi, “Tú tài/Cử nhân” là danh xưng của các triều sau,
  còn thời Trần có kỳ thi Thái học sinh và Tam khôi (Trạng nguyên, Bảng nhãn, Thám hoa) từ giữa thế kỷ XIII. **Cần đối chiếu nguồn (Wikipedia tiếng Việt, SGK) hoặc nhờ giáo viên lịch sử
  xác nhận** trước khi đưa vào game, vì tiêu đề chức năng là “thời Trần”. Tôi chưa kiểm chứng điều này.
- **Vòng quay nhận thẻ (CARD.002):** cơ chế ngẫu nhiên cho học sinh THCS cần nêu rõ tỷ lệ, không có nạp tiền (Quy tắc đã ghi), nên có bảo đảm nhận đủ thẻ sau số lần nhất định để không bất công.
- **Học sinh tự đăng ký (AUTH.008):** thu dữ liệu của trẻ vị thành niên, không gắn trường nên lọt ngoài mọi phạm vi quản trị và báo cáo. Điểm cần chốt 2 còn bỏ ngỏ. Đề xuất chỉ cho đăng ký khi có mã mời của trường hoặc bỏ chức năng.
- **An toàn trẻ em chưa có chức năng riêng:** lưu phiên chat AI (AI.011), nhắn tin giáo viên–học sinh (CHAT.007) không có thời hạn lưu, lọc nội dung, nút báo cáo, hay đồng ý của phụ huynh (Điểm cần chốt 5 chưa chốt).
- **Cấu hình thưởng EXP:** Quy tắc 9–12 nêu thưởng theo sự kiện (qua ải +100, mini-game +50, AI đúng +20, giáo viên thưởng có hạn mức) nhưng luật EXP hiện chỉ có thưởng theo từng câu trả lời và trần Ấn Tín mỗi ngày;
  EXP/câu hiện là 10, không khớp +20 của Quy tắc 11.

## 4. Đề xuất mới (theo thứ tự nên làm)

**Ưu tiên cao**

1. **Chốt “khung MVP” cho khóa luận** và gắn lại ưu tiên: giữ trọn 4 luồng có thể trình diễn (F01 thiết lập lớp, F05 thi đấu trực tiếp, F06 AI giải thích sai + gặp giáo viên, F08 bảng điểm);
   dời sa bàn (nhóm 11), bản đồ nhiệm vụ giáo viên (13) và các mục “Thấp” sang giai đoạn sau. 259 mục trong một đồ án là rủi ro lớn hơn lợi ích.
2. **Luật EXP theo sự kiện:** mở rộng cấu hình (SA-CONTENT.005) thêm mức thưởng qua ải, mini-game, AI đúng, hạn mức thưởng của giáo viên theo phiên/lớp, và trần chống cày EXP theo nguồn. Làm trước khi viết GAME.001/012 và CONTEST.015.
3. **Một máy trạng thái phát hành chung** (Nháp → Đã gửi → Lưu trữ) kèm nhật ký và thông báo tự động, dùng cho tài liệu, bộ đề, bảng điểm; thay cho T-TODO.002/004–006 và NOTICE.002–004.
4. **Quyền riêng tư và an toàn trẻ em:** ghi nhận đồng ý điều khoản (đã có trang điều khoản) theo phiên bản, thời hạn lưu chat với tự xóa như thùng rác 45 ngày, nút báo cáo tin nhắn, lọc từ nhạy cảm, nhật ký mỗi lần quản trị xem chat.
5. **Xem trước khi nhập Excel (IMP.008) và nhập lớp (IMP.007):** hiện nhập ghi ngay vào CSDL; một file sai có thể tạo hàng loạt tài khoản sai. Đây là rủi ro vận hành thực, nên làm trước các tính năng giao diện mới.

**Ưu tiên vừa**

6. **Cảnh báo sớm cho giáo viên:** học sinh không học từ 7 ngày, mức nắm vững giảm, điểm danh sách “cần hỗ trợ”, dùng dữ liệu BKT sẵn có. Chi phí thấp, hiệu quả trình diễn cao.
7. **Hàng đợi ôn tập ngắt quãng** từ câu sai (khớp S-STUDY.009 và F06 bước 6), thay vì chỉ gợi ý chủ đề yếu.
8. **Xuất kết quả cuộc thi** (Excel) và báo cáo sau thi cho giáo viên.
9. **Chỉ báo “máy chủ đang khởi động”** trên gói Render miễn phí (dịch vụ ngủ sau 15 phút không dùng, lần gọi đầu có thể mất cả phút) để học sinh không nghĩ ứng dụng bị hỏng.
10. **Ghi nguồn cho mỗi câu AI trả lời** (mã tư liệu, phiên bản mô hình, phiên bản prompt) phục vụ AI.009 và kiểm toán.

**Hỗ trợ viết khóa luận**

11. **Xuất dữ liệu học tập ẩn danh** để đánh giá hiệu quả (so sánh trước/sau, nhóm dùng game và nhóm đối chứng), cùng bảng khảo sát khả dụng (SUS) và bộ câu hỏi kiểm thử độ đúng của AI (đã có `ai/KET_QUA_DANH_GIA.md`). Đây là phần chương đánh giá của đề tài cần mà danh sách chưa có.
12. **Tài liệu kiểm thử chấp nhận** theo từng luồng F01–F08 với dữ liệu giả, để chứng minh “chức năng hoạt động” bằng bằng chứng chứ không bằng mô tả.

## 5. Cần bạn quyết định

1. Giữ hay bỏ luồng **giáo viên xin mở lớp** (hiện giữ song song với luồng QTV trường tạo lớp)?
2. **Nhiều giáo viên cùng một lớp** (Điểm cần chốt 4): hiện chỉ một giáo viên phụ trách chính. Nếu cần nhiều, phải đổi cách lưu và các nơi dùng `teacher_id`.
3. Học sinh **tự đăng ký** (AUTH.008): bỏ, hay chỉ cho phép với mã mời của trường?
4. Chuỗi **học vị** và nguồn sử liệu cho nó (nhờ giáo viên lịch sử xác nhận).
5. Công thức **bảng điểm** và số câu/điều kiện qua ải.
6. Muốn tôi làm tiếp theo: (a) hoàn tất GĐ1 còn thiếu (xem trước/nhập lớp Excel, hồ sơ cá nhân, QTV trường sửa liên hệ), hay (b) nối các mục “mới lưu” của nhóm 05 vào game/AI, hay (c) bắt đầu GĐ2 bằng ngân hàng câu hỏi giáo viên và hoàn thiện thi đấu (thưởng EXP, thống kê)?
