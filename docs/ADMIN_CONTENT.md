# Nội dung và cấu hình (TM.SA-CONTENT)

Chỉ **quản trị tổng** (`root_admin`) thấy hai mục **Nội dung & cấu hình** và **Nhật ký & sức khỏe** ở cổng `/admin`.
Quản trị trường, giáo viên, học sinh và khách nhận 403/401 ở mọi API `/api/admin/content/*` và `/api/admin/system/*`,
kể cả khi tự gõ đường dẫn. Mọi thay đổi tăng `version` và ghi một ảnh chụp vào `app_content_history`
(ai, lúc nào, nội dung gì); nội dung đã phát hành chỉ được gỡ, lưu trữ hoặc ẩn, không xóa vật lý.

Migration `011_content_management.sql` tạo sáu bảng, bật RLS, không có policy và không cấp quyền cho vai trò theo
trường, `anon` hay `authenticated`; chỉ kết nối tin cậy của backend đọc/ghi. Dữ liệu gốc được sinh từ nội dung game
đang dùng, không thêm tài khoản hay dữ liệu thật.

| Mã | Mục | Ghi dữ liệu | Có hiệu lực với học sinh chưa? |
| --- | --- | --- | --- |
| 001 | Chương trình lịch sử | `app_curriculum_nodes` | **Chưa.** Là cấu trúc quản trị; màn chơi vẫn đọc `frontend/constants/campaigns.ts`. |
| 002 | Ngân hàng câu hỏi | `app_question_bank` (lớp chỉnh sửa) | **Có, ngay khi xuất bản/ẩn.** |
| 003 | Kho sử liệu AI | `app_ai_sources` | **Chưa.** Có kiểm duyệt và tìm kiếm; chưa nối vào Quân Sư AI (xem bên dưới). |
| 004 | Thẻ danh tướng | `app_hero_cards` | **Chưa.** Thông tin quản trị; chỉ số chiến đấu và hình ảnh vẫn ở `constants/heroes.ts`. |
| 005 | Luật EXP và huy hiệu | `app_exp_rules` | **Một phần.** EXP, Ấn Tín, trần ngày, ngưỡng câu yếu có hiệu lực ngay; mốc cấp và huy hiệu chỉ lưu. |
| 006 | Nhật ký và sức khỏe | không ghi bảng mới | Chỉ đọc. |

## 001 Chương trình lịch sử

Cấp bậc: Cuộc kháng chiến › Chương › Bài › Ải › Trận đánh; cấp cha phải cao hơn cấp con (ải có thể nằm thẳng dưới cuộc
kháng chiến). Dữ liệu gốc là 3 cuộc kháng chiến (`KC1`–`KC3`) và 9 ải (`KC1.A1`…`KC3.A3`) lấy từ `CAMPAIGNS` và
`PHASE_REAL`, đã xuất bản. Nội dung mới bắt đầu ở bản nháp. Xuất bản cần cấp cha đã xuất bản; không gỡ một mục khi còn
mục con đang xuất bản (409). Lưu không đổi gì thì không tăng phiên bản. Quản trị có thể sửa cả những chỗ nội dung gốc còn
chép khác Wikipedia (xem AGENTS.md, “Chỗ lệch giữa dữ liệu game/AI và Wikipedia”), nhưng game chưa đọc bảng này.

## 002 Ngân hàng câu hỏi dùng chung

Ngân hàng gốc vẫn là `ai/data/game_content.json` (không bị sửa). Quản trị làm việc trên một lớp chồng lên nó:

- **Ẩn** một câu gốc: học sinh không nhận được câu đó nữa (câu đã phát ra mà chưa chấm sẽ báo không tồn tại). **Khôi phục
  bản gốc** xóa lớp chồng.
- **Sửa** câu gốc lần đầu tạo bản nháp; học sinh vẫn thấy bản gốc cho tới khi **xuất bản**. Sửa một câu đã xuất bản có hiệu
  lực ngay (có phiên bản mới trong lịch sử).
- **Thêm** câu mới: bản nháp, chỉ phục vụ học sinh sau khi xuất bản. Chỉ xóa được câu quản trị tạo khi đang nháp hoặc ẩn.
- Mỗi câu có đáp án, mức độ (nhận biết/thông hiểu/vận dụng), nguồn tham chiếu và thuộc một cụm tri thức có thật. Backend
  kiểm tra cùng quy tắc với ngân hàng gốc: 2–5 lựa chọn khác nhau, đáp án trong danh sách, 3–6 mục sắp xếp, 3–5 cặp nối,
  địa danh có trong lược đồ. Câu sai định dạng bị từ chối (422) và một dòng hỏng không làm hỏng cả ngân hàng khi khởi động.
- Lớp chồng được nạp khi backend khởi động và sau mỗi thay đổi. Backend chạy một instance (như phòng thi đấu).
- Chủ đề lấy theo cụm tri thức trong `q_matrix.json`/`knowledge_base.json`; không sửa tay hai file đó.

## 003 Kho sử liệu AI

Tải văn bản (dán hoặc chọn tệp `.txt`/`.md` trên web, tối đa 200.000 ký tự) kèm **nguồn trích dẫn bắt buộc**, loại
(chính sử, giai thoại, tham khảo) và chủ đề. Tư liệu mới ở `pending`; chỉ quản trị tổng duyệt (`approved`), từ chối (bắt
buộc ghi lý do), lưu trữ hoặc mở lại. Đổi nguồn/chủ đề của tư liệu đã duyệt đưa nó về chờ duyệt. Lịch sử chỉ lưu chữ ký
SHA-256 và độ dài của văn bản, không nhân bản nội dung.

`GET /api/admin/content/sources/search?q=` chỉ tìm trong tư liệu **đã duyệt** và trả trích đoạn kèm nguồn; tư liệu chờ
duyệt, bị từ chối hay lưu trữ không bao giờ xuất hiện. **Giới hạn hiện tại:** Quân Sư AI (dịch vụ Python, RAG trên
`knowledge_base.json`) chưa gọi hàm tìm kiếm này, nên tư liệu đã duyệt chưa ảnh hưởng câu trả lời của trợ lý. Nối vào AI
cần thêm đầu vào cho `/chat` ở `ai/` và bộ kiểm thử đi kèm.

## 004 Thẻ danh tướng

14 thẻ gốc lấy từ `HEROES`: độ hiếm (`hiem`, `su_thi`, `huyen_thoai`, `tiet_che`) và loại nội dung (`chinh_su`,
`giai_thoai`, `sang_tao`, `dan_gian`) dùng cùng mã với game, nên giai thoại phân biệt được với chính sử (12 chính sử,
2 giai thoại). Nguồn của thẻ gốc ghi theo cụm tri thức Đông A mà thẻ dùng, không phải thư mục sách. Mỗi thẻ có nguồn sử
liệu và điều kiện nhận bắt buộc. Thẻ thêm mới chưa có chỉ số chiến đấu hay hình ảnh trong game.

## 005 Luật EXP, cấp bậc, huy hiệu

Phiên bản 1 = đúng giá trị đang chạy: 10 EXP đúng / 2 EXP sai, 10 Ấn Tín đúng / 15 ở chủ đề yếu (P(L) < 60%), trần
300 Ấn Tín mỗi ngày, mốc cấp (cấp − 1)² × 40. Mỗi lần lưu là một phiên bản mới (v2, v3…); quay lại luật cũ cũng là phiên bản
mới. Backend kiểm tra: số nguyên không âm, EXP sai ≤ EXP đúng, trần ngày đủ một câu đúng, cấp đánh số liên tục từ 1 và mốc
tăng dần từ 0, mã huy hiệu duy nhất. Luật không đổi so với bản đang dùng bị từ chối (409).

**Luật mới chỉ áp dụng cho câu trả lời sau thời điểm lưu**; EXP, cấp, Ấn Tín, tiến độ và huy hiệu đã ghi nhận không bị tính
lại. `StudentService` đọc `activeRules()` ở `progress.ts` cho mỗi câu trả lời. **Giới hạn hiện tại:** màn chơi của học sinh
vẫn tính cấp bằng công thức `levelOf` ở `frontend/lib/game-state.ts` và chưa trao huy hiệu theo cấu hình; mốc cấp và huy
hiệu hiện được lưu, đánh phiên bản và hiển thị cho quản trị.

## 006 Nhật ký và sức khỏe hệ thống

`GET /api/admin/system/health`: API (thời gian chạy), CSDL (`schema_version`, số migration, RLS theo trường, pgvector),
dịch vụ AI (độ trễ; “Có lỗi” khi chưa khởi động), gửi thư (đã cấu hình, đang chờ/thất bại/đã gửi 24 giờ), nhập Excel 24
giờ, đăng nhập thất bại 24 giờ.

`GET /api/admin/system/events`: một dòng thời gian từ `app_login_events`, `app_audit_events`, lô nhập có dòng lỗi/thiếu và
thư gửi thất bại. Lọc theo từ ngày/đến ngày (giờ Việt Nam), trường, loại (`login|audit|import|mail`) và mức
(`info|warn|error`); phân trang. Không trả mật khẩu, token, nội dung thư hay địa chỉ email; lỗi thư chỉ hiện mã lỗi đã lưu.
Nhật ký thao tác là lịch sử API (xem [ADMIN_SECURITY.md](ADMIN_SECURITY.md)), không phải thay đổi trực tiếp từ Supabase Dashboard.

## Kiểm thử

`backend/test/content.spec.ts` chạy trên PostgreSQL tạm: phân quyền bốn vai trò, cấu trúc và phiên bản chương trình, ẩn/sửa/
xuất bản/khôi phục câu hỏi và chấm điểm câu mới, vòng duyệt sử liệu và tìm kiếm chỉ trên tư liệu đã duyệt, thẻ gốc và phân
biệt chính sử/giai thoại, luật EXP (kiểm tra đầu vào, XP trả về đúng luật mới, điểm cũ không đổi, quay lại luật cũ), nạp lại khi
khởi động, nhật ký/sức khỏe và việc không lộ bí mật, RLS sáu bảng. `migrations.spec.ts` cập nhật cho migration 011.
