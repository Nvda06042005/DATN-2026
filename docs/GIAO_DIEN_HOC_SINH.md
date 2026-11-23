# Giao diện học sinh – 20/11/2026

Theo yêu cầu làm lại giao diện học sinh cho lứa tuổi THCS và tăng tính trò chơi hóa, không gian học sinh có ngôn ngữ thiết kế riêng: xanh ngọc, vàng, nền sáng, nút có chiều sâu, thẻ bo góc, Rồng Con và phong cảnh thành lũy minh họa. Nhãn hành động bằng tiếng Việt; số liệu luôn lấy từ API của người đang đăng nhập.

Giữ các màu đỏ ngữ nghĩa hiện có cho câu trả lời sai, lỗi nhập liệu và lỗi API; không đổi phản hồi sai thành màu xanh của hành trình.

## Các màn chính

- **Sảnh chọn lớp:** chào học sinh, vào nhanh lớp đã tham gia; tìm theo lớp/giáo viên có hoặc không dấu; lọc tất cả/lớp đã tham gia; nhóm theo học kỳ; thẻ lớp có giáo viên và sĩ số. Lớp chưa tham gia vẫn cần mã thầy cô gửi trong Tin nhắn. Có trạng thái tải, lỗi kèm nút tải lại và kết quả tìm kiếm trống. Form mã lớp không gửi khi lớp đã đóng, đã tham gia hoặc đang gửi yêu cầu.
- **Trong lớp:** nút tiếp tục chặng từ `home.next`, ba chiến dịch với tiến độ và số sao; góc thành tích, nhiệm vụ ngày, giải đấu tuần, trang phục và các lối vào ôn tập/nhập vai/bộ thẻ. Chỉ chúc mừng đi trọn hành trình khi tổng chặng lớn hơn 0 và số chặng hoàn thành đã đạt tổng.
- **Khung chung của các màn học sinh (sửa 20/11/2026):** không còn menu trái; các mục là dải nút dưới thanh trên cùng (cuộn ngang trên màn hẹp, tự đưa mục đang mở vào khung nhìn). Hồ sơ (có Đổi mật khẩu), đăng xuất, cài đặt và thông báo giữ các API cũ. Bảng màu giới hạn ở cây `StudentApp`, các vai trò khác dùng khung và màu hiện có.
- **Sảnh trong lớp (20/11/2026, theo ảnh VL-LEGEND người dùng gửi – chỉ lấy thể loại):** trang cuộn dọc `StudentHall.tsx` gồm màn mở đầu cung điện + nút cuộn giấy VÀO TRẬN, giới thiệu Học – Luyện – Ra trận và ba chiến dịch, thang danh hiệu 5 bậc khoa cử thời Trần (`lib/scholar-rank.ts`), bảng vàng (bảng xếp hạng lớp / trường dạng sân khấu, ba bạn đầu là Tam khôi) và thư viện tranh. Bảng màu riêng của sảnh: sơn son `#b8261b`, vàng kim `#e3b244`, giấy `#fffaf0`, chữ `#2b1d16` / `#6b5644` (đạt ≥ 4,5 : 1 trên nền giấy).
- **Hình vẽ (`StudentArt.tsx`):** nhân vật chibi nam / nữ trong 5 bộ trang phục theo bậc, cung điện tưởng tượng, 5 tranh phong tục khoa cử – SVG tự vẽ, cách điệu, không phục dựng; áo Trạng nguyên đỏ son (không vàng hoàng bào). Nhân vật trên bục bảng vàng là một dáng chung đại diện danh hiệu, không đoán giới tính người đứng hạng. Nhân vật bập bênh nhẹ, đứng yên khi máy bật giảm chuyển động.

## Mã nguồn và dữ liệu

- `frontend/components/portal/StudentWorkspace.tsx`: bố cục và các hành động tài khoản, dùng lại `ProfileSheet` và API xác thực.
- `frontend/components/portal/StudentDesign.tsx`: màu, nút, chỉ số và phong cảnh SVG tự vẽ. Đây là minh họa trang trí của thế giới trò chơi, không phải bản đồ địa lý hay phục dựng một di tích cụ thể. Không dùng tài nguyên hoặc nhân vật sao chép từ website mẫu.
- `StudentClasses.tsx`, `SagaHome.tsx`, `SagaRail.tsx`, `SagaKit.tsx`: sảnh, lớp, chiến dịch, nhiệm vụ và bộ thành phần học tập; `StudentHall.tsx`, `StudentArt.tsx`, `lib/scholar-rank.ts`: sảnh cuộn dọc, hình vẽ và thang danh hiệu (20/11/2026).
- `StudentApp.tsx`: vẫn dùng `usePortalTab`, kiểm tra lớp, phiên và các API cũ; các màn đang ẩn không giữ game đang chạy. Cấp độ, kinh nghiệm, vàng, chuỗi ngày, tiến độ và mở khóa do máy chủ trả về. Không cộng thưởng ở frontend.
- Bản đồ chiến dịch tiếp tục dùng các ảnh Wikipedia gốc và nguồn đã ghi công. Không thay đổi database, seed, lịch sử migration hoặc dữ liệu học sinh; schema hiện hành là 079.

## Kiểm tra và phát hành

Chạy tại `frontend`: `npm run typecheck`, `npm test`, `npm run build`. Các kiểm tra điều hướng hiện có được cập nhật để xác minh khung học sinh riêng, cách giới hạn bảng màu, các API tài khoản và những luật học tập đã giữ.

Kết quả trước phát hành: TypeScript đạt, 189/189 bài kiểm thử đạt (không bỏ qua bài nào), Expo web export thành công. Bản dựng có cảnh báo CSS ảnh của Leaflet đã tồn tại, không gây lỗi export.

Triển khai từ `main` theo quy trình hiện có. Xác minh GitHub CI, SHA ở `/build-info.json` trên Vercel, `commit` ở `/api/health` trên Render và `schema_version` ở `/api/database/health` cho Supabase. Dữ liệu PostgreSQL không được sao chép hoặc dựng lại để đổi giao diện.

Giới hạn kiểm tra trong phiên thực hiện: trang VL Legend tham khảo không đọc được qua HTTPS tự động do lỗi chứng chỉ TLS. Công cụ điều khiển trình duyệt Windows đã dừng vì không xác định được URL hiện tại đủ tin cậy; chưa có kiểm tra hình ảnh trực tiếp hoặc thao tác bằng trình duyệt với giao diện mới. Không coi các kiểm tra mã và build là thay thế cho kiểm tra trực quan.

## "Sắc Việt" – giao diện kiểu trò chơi học tập mang bản sắc Việt – 23/11/2026

Yêu cầu của người dùng: "giao diện hiện giờ quá xấu… làm na ná Duolingo, mang đậm tính tự tôn dân tộc, bản sắc Việt Nam", kèm ảnh mẫu nhân vật chibi mặc áo nâu, áo tứ thân, quan phục, áo ngũ thân, một bảng xếp hạng sân khấu màu cam có rèm và đèn lồng. Người dùng chọn qua câu hỏi: **chỉ tham khảo – tự vẽ mới**, **làm lại toàn bộ trang học sinh**, **đường đi kiểu Duolingo** (bản đồ gốc Wikipedia vẫn mở bằng nút "Xem bản đồ"), **giữ dải nút trên cùng** (điện thoại dùng thanh mục dưới đáy, không thêm menu trái).

- **Bảng màu** (`STUDENT` / `STUDENT_PALETTE` trong `StudentDesign.tsx`, chỉ trong cây `StudentApp`): nền giấy dó `#fff8ec`, chữ nâu mực `#2b1d12` / `#6b5644`, đỏ son `#d6281e` (màu chính, vẫn là màu báo sai / lỗi), vàng `#ffc23a` cho phần thưởng và chặng đã xong, xanh tre `#46a840` cho tiến độ; thêm ngọc, chàm, cam cho huy hiệu các mục. Tên khóa cũ (`teal`, `mint`, `deep`) giữ lại để các màn khác không phải đổi, nay mang màu son. Màu chữ trên nền đều đạt ≥ 4,5 : 1.
- **Nút và thẻ khối dày** (`GameButton`, `BlockCard`, `IconBadge`; nút đáp án `OptionButton` của `SagaKit`): viền 2, viền đáy 4–6 đậm hơn, nhấn thì lún xuống; vùng chạm ≥ 44.
- **Hình tự vẽ** (`StudentArt.tsx`): 7 nhân vật chibi (`chibiG` / `Chibi`: trai làng áo nâu, thôn nữ áo tứ thân nón lá, thư sinh và thiếu nữ áo ngũ thân cầm quạt, quan văn, phu nhân áo đỏ, tướng nhà Trần cầm cờ) chung một kiểu mặt cười mắt nhắm; hoa văn mặt trống đồng (`DrumSun`); ba cảnh nền theo ba phần (`VnScene`: làng tre có cổng làng – 1258, đình làng có cờ – 1285, sông núi có bãi cọc và thuyền buồm – 1287–1288); phông sân khấu (`StageBackdrop`: tường cam son, rèm đỏ, đèn lồng, sàn gỗ). Trang phục cách điệu dân gian, không phục dựng riêng một thời kỳ; chỉ lấy thể loại của ảnh mẫu, không sao chép nét vẽ, nhân vật, tên gọi hay hình của sản phẩm nào.
- **Khung** (`StudentWorkspace.tsx`): dải hoa văn đỏ son chấm vàng trên cùng; thanh đầu có chỉ số gọn (chuỗi ngày, vàng, điểm), cài đặt, thông báo, hồ sơ, đăng xuất; dải nút các mục – mỗi mục một huy hiệu tròn màu, mục đang mở có viền khối. Màn dưới 760 px: dải nút trên cùng ẩn, **thanh mục dưới đáy** 4 mục đầu + "Thêm" (bảng các mục còn lại và Đăng xuất, mở ngay trong trang, không phải hộp thoại hay menu trái); chưa vào lớp (3 mục) thì hiện đủ 3 mục, Đăng xuất nằm trong Hồ sơ.
- **Danh sách lớp** (`StudentClasses.tsx`): ô chào có cảnh làng tre và đôi bạn chibi; thẻ lớp có cảnh nền theo khối, **biển lớp như bức hoành phi** (màu theo khối, viền vàng) và một nhân vật chibi; nút "VÀO HÀNH TRÌNH" khối đỏ son.
- **Trang chủ trong lớp** (`SagaHome.tsx` – `HomeScreen`): màn mở đầu VÀO TRẬN (gọn hơn, viền khối) → **lộ trình cả ba phần** cạnh cột "Góc thành tích" → giới thiệu → thang danh hiệu → bảng vàng → thư viện tranh. Lộ trình (`PathPart`): dải tiêu đề màu của phần (tiến độ, nút **Xem bản đồ** mở bản đồ gốc Wikipedia của phần đó), cảnh nền tự vẽ mờ dần vào nền giấy, con đường chấm uốn lượn qua các chặng; nút chặng tròn khối theo trạng thái máy chủ trả về (vàng + dấu tích: đã xong; màu của phần + sách / kiếm: đang mở; cam: cần ôn; be + khóa: chưa mở), nhãn "số. tên chặng" + sao hoặc ngày; chặng đang chờ có vòng sáng, bóng chữ **BẮT ĐẦU / HỌC TIẾP** nảy nhẹ và nhân vật dẫn đường (thư sinh / thiếu nữ / tướng theo phần); hòm báu nằm giữa hai chặng (mở bằng màn mở rương sẵn có). Bấm chặng mở **bảng thông tin chặng ngay trên trang chủ**.
- **Trang Hành trình** (`CampaignScreen`): hai kiểu xem **Lộ trình** (mặc định) / **Bản đồ gốc** (ba bản đồ Wikipedia như trước, Rồng Con, hòm, phóng to); nút "Xem bản đồ" ở trang chủ / màn mở đầu mở thẳng kiểu Bản đồ gốc; quay lại từ một bước của chặng giữ kiểu xem đã chọn.
- **Bảng vàng** (`StudentHall.tsx` – `HallBoard`): sân khấu cam có rèm, đèn lồng, quan văn và phu nhân cầm quạt hai bên (màn rộng), bảng hiệu BẢNG VÀNG nền sơn mài, bục Tam khôi vàng / bạc / đồng, danh sách tối với vòng số hạng nhiều màu, hàng "Em" nổi vàng.
- Không đổi API, cơ sở dữ liệu, luật chấm điểm, điều hướng URL hay bản đồ gốc; nhân vật đứng yên khi bật giảm chuyển động; âm thanh vẫn tắt.

Kiểm tra: `npm run typecheck`, `npm test` (thêm bài "Sắc Việt" trong `tests/student-nav.test.cjs`), chụp bản web xuất (Chrome CDP, 1366 × 860 và 390 × 844) với học sinh đang học dở và học sinh đã xong 13 chặng: danh sách lớp, trang chủ, lộ trình ba phần (13 nút chặng, 13 hòm, nhân vật dẫn đường), bảng chặng trên trang chủ, bảng vàng, trang Hành trình hai kiểu xem, thanh mục dưới đáy và bảng "Thêm", các mục Nhập vai / Câu hỏi ôn tập / luyện tập.
