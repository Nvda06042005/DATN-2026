# Giao diện học sinh – 20/11/2026

> **Từ 25/11/2026 trang học sinh theo hướng "Binh thư Sát Thát" (mục cuối tệp).** Các mục 20/11, 23/11 và 25/11 bên dưới chỉ còn để tra lịch sử: sảnh mở đầu, lộ trình uốn lượn, cột phải và thanh đầu có menu Trang chủ đã thay.

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

## Bỏ 5 mục, thanh đầu chữ như trang chủ, sảnh nền giấy – 25/11/2026

Người dùng (kèm ảnh dải nút có huy hiệu, ảnh menu sổ xuống HOME của một trang mẫu, ảnh khối "Các vị vua thời Trần" của trang chủ công khai và ảnh sảnh mở đầu): "Xóa hết Câu hỏi ôn tập, Kỳ thi, Tư liệu, Bộ thẻ, Tin nhắn bên trang học sinh; thêm trang chủ và trang chủ sổ xuống; để kiểu chữ lại không dùng icon nữa, học hỏi bên trang chủ chính; sảnh dùng background như trang chủ, cái nào màu tím đỏ thì đổi lại giống giao diện trang chủ".

- **Bỏ hẳn 5 mục của học sinh**: Câu hỏi ôn tập, Kỳ thi, Tư liệu, Bộ thẻ, Tin nhắn. Đã xóa `SagaExtras.tsx` (Ôn tập, Bộ thẻ, Tư liệu), hộp thư `StudentInbox` (`StudentClasses.tsx`) và màn `StudentExams` (`LibraryExams.tsx`); bỏ ô Ôn tập / Kỳ thi ở cột phải, nút "Ôn N câu đã sai" ở bảng chặng; nút "Nên ôn lại" ở màn tổng kết nay mở lại phần luyện tập của chặng. Đường dẫn cũ `tab=cau-hoi|ky-thi|tu-lieu|bo-the|tin-nhan` rơi về Trang chủ; thông báo bài thi / tin nhắn mở Chiến dịch. **API và dữ liệu máy chủ giữ nguyên** (giáo viên, quản trị trường dùng chung): giáo viên vẫn "Tổ chức thi" và gửi tin nhắn được nhưng học sinh không còn chỗ làm bài thi / đọc hộp thư trên trang này; mã lớp vẫn nhập ở trang đăng ký lớp.
- **Thanh đầu** (`StudentWorkspace.tsx`) theo thanh điều hướng của trang chủ công khai (`Header` trong `components/home.tsx`): viên thuốc trắng trên nền giấy kem, logo, các mục **chỉ có chữ** (màu mực, mục đang mở đỏ – lấy thẳng từ `PALETTES.light`, không theo bảng màu riêng của học sinh), cờ Việt Nam, chỉ số, cài đặt, thông báo, hồ sơ, đăng xuất. Các mục: **Trang chủ ▾**, Chiến dịch, Nhập vai, Hỏi Tiểu Tướng, Trợ giúp (chưa vào lớp: Trang chủ, Chiến dịch, Trợ giúp). **Trang chủ** mở sảnh mở đầu; **menu sổ xuống** (thẻ trắng có mũi nhọn như ảnh mẫu) liệt kê các phần của sảnh – Giới thiệu, Nhân vật, Bảng vàng, Thư viện, Hướng dẫn (`HALL_SECTIONS`); rê chuột vào chữ / mũi tên / menu thì mở, rời ra thì đóng, **bấm mũi tên cũng mở** (không chỉ dựa vào rê chuột), Esc hoặc bấm ra ngoài thì đóng; phần đang xem được tô đỏ. Bấm một phần khi đang ở mục khác thì chuyển về Trang chủ rồi cuộn tới phần đó (vị trí đo lúc bấm và đo lại sau khi cuộn vì phía trên còn đổi chiều cao). Màn dưới 900 px dùng **nút menu** như trang chủ công khai: bảng liên kết chữ thả xuống ở góc phải (Trang chủ và các phần thụt vào, các mục, Đăng xuất); **không còn thanh mục dưới đáy có biểu tượng** và vẫn không có menu trái.
- **Sảnh mở đầu** (`StudentHall.tsx`) nằm trong khung chung (không còn thanh neo riêng) và dùng bảng màu trang chủ công khai cho cả sảnh: sau màn Hoàng thành là dải mây vàng nối khối, các phần Giới thiệu, Nhân vật (5 bậc danh hiệu / 9 nhân vật), Bảng vàng, Thư viện đều **nền giấy kem có hoa văn mờ + hai vòng vàng**, nối nhau bằng dải mây vàng (`CloudPair`, `SectionCloud`), tiêu đề hai màu `SectionHeading` (dòng nhỏ đỏ, chữ đậm màu mực, dòng nghiêng đỏ), thẻ giấy mờ như `PAPER_CARD`. **Bỏ nền chuyển sắc xanh – tím – đỏ** của khu Nhân vật và **sân khấu cam đỏ có rèm** của Bảng vàng (khung gỗ có Vua Trần, Trần Hưng Đạo giữ nguyên trên màn rộng; màn hẹp là bảng chữ viền vàng); nút / chip đỏ son như trang chủ; Hướng dẫn phủ màu mực, chân trang màu mực, nút lên đầu trang đen như trang chủ. Thẻ giới thiệu thứ ba đổi thành "Hỏi Tiểu Tướng" (không còn nói tới ôn câu sai / thi đấu).

Kiểm tra: `npm run typecheck`, `npm test` (bài 25/11/2026 trong `tests/student-nav.test.cjs`, cập nhật `assessment-ui.test.cjs`), chụp bản web xuất (1366 × 860 và 390 × 844): rê chuột / bấm mũi tên mở menu, đi chuột xuống menu vẫn mở, bấm từng phần cuộn đúng chỗ, phần đang xem tô đỏ, Esc đóng, từ Chiến dịch bấm "Thư viện" về đúng phần, đường dẫn cũ `tab=cau-hoi` / `tab=ky-thi` về Trang chủ, các mục Chiến dịch / Nhập vai / Hỏi Tiểu Tướng / Trợ giúp trong khung mới.

## "Binh thư Sát Thát" – 25–26/11/2026

Người dùng gửi bản vẽ 15 màn điện thoại (artifact trên claude.ai) và yêu cầu "làm theo"; chọn qua câu hỏi: **giữ thế giới khối 3D làm phần thêm**, **bỏ sảnh mở đầu** (đăng nhập vào thẳng Doanh trại, Trợ giúp chuyển vào Hồ sơ), **máy tính dùng thanh đầu chữ + bố cục rộng**.

### Điều hướng

- Năm mục chính: **Doanh trại · Chiến dịch · Binh thư · Tiểu Tướng · Bảng vàng**. Điện thoại (< 900 px): thanh 5 mục dưới đáy (biểu tượng + chữ, mục đang mở màu nhấn), ẩn ở các bước trong chặng và các màn phụ có nút quay lại. Máy tính: thanh đầu viên thuốc chỉ có chữ, chuỗi ngày, vàng, Cài đặt, Thông báo, ảnh đại diện (→ Hồ sơ), Đăng xuất. Không có menu trái.
- Mục phụ: Hồ sơ, Chợ phiên Thăng Long, Giao diện, Luyện binh riêng, Trợ giúp, Lớp học (danh sách lớp, đăng ký bằng mã), Nhập vai (thế giới khối 3D).
- URL: `tab`, `c` (khối 6–9), `s` (chặng), `v` (bước: `quan-lenh`, `tham-su`, `hoi-dong`, `xuat-tran`, `su-quan`, `kham-pha`). Đường dẫn cũ tự chuyển: `tab=trang-chu` → Doanh trại, `tab=hoi|ai` → Tiểu Tướng, `v=hoc|luyen|tran|tong-ket` → bước mới, `c=1–3` → khối 6–8.
- Chưa vào lớp nào: chỉ có danh sách lớp, Hồ sơ, Giao diện, Trợ giúp.
- **26/11/2026 (người dùng chọn "Lớp học trước, rồi Doanh trại")**: đăng nhập xong luôn mở trang **LỚP HỌC** (băng rôn + thẻ lớp, `StudentClasses.tsx`) trước, bấm **VÀO LỚP** mới tới Doanh trại – không còn tự vào lớp đầu tiên. Tải lại trang (F5) vẫn ở lớp đang vào; đăng nhập lại (token mới) bắt đầu lại từ trang Lớp học (sessionStorage chỉ giữ mã người dùng, mã lớp và một dấu băm ngắn của lần đăng nhập, không giữ token). Mở bằng đường dẫn tới thẳng một mục / chặng thì vào lớp xong mở đúng chỗ đó. Doanh trại có liên kết **Đổi lớp**; trang Lớp học trên điện thoại có thanh gọn (logo, Hồ sơ, Đăng xuất), khi đã ở trong lớp thì vẫn có thanh 5 mục dưới đáy.

### Các màn (theo bản vẽ)

| Màn | Tệp | Nội dung |
| --- | --- | --- |
| Doanh trại | `SagaHome.tsx` `HomeScreen` | lời chào + bậc Khoa bảng, 3 ô chỉ số, chặng đang học (5 vạch bước, nút đi tiếp), nhiệm vụ hôm nay, gợi ý Luyện binh riêng của Tiểu Tướng, chiến dịch của khối, chuỗi ngày |
| Chiến dịch | `CampaignScreen` | 4 tab Khối 6–9, dải tối của khối (vai, mức nhận thức, dạng câu, số câu, số trận, phần thưởng), danh sách chặng có hòm báu xen giữa; kiểu xem **Bản đồ gốc** giữ bản đồ Wikipedia kiểu sa bàn (Khối 6–8) |
| Quân lệnh (bước 1) | `OrderScreen` | lời giao nhiệm vụ (ghi rõ là lời dẫn của trò chơi), mục tiêu, năm bước, "Khám phá thêm (3D, không bắt buộc)", phần thưởng lần đầu |
| Thám sử (bước 2) | `SagaLearn.tsx` `ThamSuScreen` | cảnh bản đồ có điểm sáng + danh sách thẻ; mỗi thẻ có dữ kiện, mục tiêu, nguồn; "Nhận thẻ vào Binh thư", "Hỏi Tiểu Tướng về thẻ này" |
| Hội đồng quân sự (bước 3) | `HoiDongScreen` | 5 mẫu câu hỏi do máy chủ chấm, "Gợi ý chiến thuật" (mua ở Chợ phiên) gạch một phương án sai |
| Xuất trận (bước 4) | `SagaPlay.tsx` | trận chiến thuật, Bạch Đằng 1288, **trận hội đồng** (`CouncilHost`: hội thoại theo lượt, thanh chỉ số, phương án chưa chọn không lộ điểm) |
| Sử quan (bước 5) | `SuQuanScreen` | sao, bảng "Em và lịch sử", nhận xét của Tiểu Tướng, diễn biến có nguồn, phần sáng tạo, phần thưởng (một lần), chặng tiếp |
| Luyện binh riêng | `LuyenBinhScreen` | lượt 6 câu tính giờ (đồng hồ do máy chủ giữ) gom câu hay sai |
| Binh thư | `BinhThuScreen` | ngăn Nhân vật / Kế sách / Địa danh, thẻ danh tướng (tranh của nhóm cho 6 nhân vật, ghi rõ là tranh minh họa cách điệu) |
| Tiểu Tướng | `SagaAsk.tsx` | hỏi đáp kèm nguồn, câu hỏi gợi ý / hỏi tiếp, nói thay gõ khi trình duyệt có nhận dạng giọng nói tiếng Việt, nút Trung tâm AI (`StudentAiHub`) |
| Bảng vàng | `BoardScreen` | giải đấu tuần, bảng Lớp / Toàn trường, "So với tuần trước" (▲ ▼ do máy chủ tính), Khoa bảng, huy hiệu |
| Hồ sơ | `SagaLook.tsx` `ProfileScreen` | ảnh có khung + cờ hiệu, Cấp / KN / Vàng / Sao, chuỗi ngày và mốc, bảng "Cách kiếm", thang Khoa bảng, ảnh nhân vật, danh hiệu, nút Chợ phiên / Giao diện / Tài khoản / Lớp học / Trợ giúp / Đăng xuất |
| Chợ phiên Thăng Long | `ShopScreen` | xem thử khung / cờ hiệu, mua bằng vàng (mua xong tự trang bị), vật phẩm giới hạn tuần, món thành tích không có nút mua |
| Giao diện | `ThemeScreen` | xem thử trên khung điện thoại, dùng / mua; Hoàng thành chỉ cho Trạng nguyên |

### Màu và chữ

- `StudentDesign.tsx`: `BtTheme` + 4 giao diện `BT_THEMES` (Thăng Long mặc định, Sông Bạch Đằng, **Đêm Đông Bộ Đầu – tối**, Hoàng thành); `StudentApp` bọc `BtProvider` và `ThemeContext` bằng `themePalette(bt)` nên cả các thành phần dùng chung (Txt, Sheet, ô nhập) đổi màu theo. Kiểm thử `student-nav.test.cjs` đo tương phản WCAG của 21 cặp chữ / nền ở cả bốn giao diện (≥ 4,5:1).
- Chỉ dùng Manrope (nội dung) và Newsreader (tiêu đề, đoạn sử liệu). Nút / ô chạm ≥ 44 px, mọi nút biểu tượng có nhãn trợ năng, hoạt ảnh dừng khi bật giảm chuyển động.

### Kiểm tra trên trình duyệt (26/11/2026)

Chạy bản xuất web với máy chủ thật và cơ sở dữ liệu thử đã có tiến độ (migration 083 áp dụng lên dữ liệu cũ không lỗi) ở 390 px và 1366 px: Doanh trại, bốn khối, bản đồ gốc, Quân lệnh, Thám sử (nhặt đủ 5 thẻ), Hội đồng (6/6 câu), trận hội đồng Bạch Đằng 938 (thắng, 3 sao), Sử quan + hộp thưởng + lên cấp, Bảng vàng, Binh thư, Tiểu Tướng (máy AI chưa chạy thì báo dễ hiểu và giữ câu hỏi), Hồ sơ, Chợ phiên (mua Gợi ý), Giao diện (mua và đổi sang giao diện tối – cả trang đổi màu).

### Đối chiếu lại bản vẽ – 26/11/2026

- **Màn 10 "Luyện binh riêng – xếp dòng thời gian"**: câu xếp trình tự hiện các mốc thời gian theo thứ tự trên một đường dọc (mốc không có thời điểm ghi "Mốc n"); em chọn một thẻ sự kiện rồi chạm vào mốc. Máy chủ chấm từng lần đặt: đúng thì thẻ nằm lại (xanh, ✓), sai thì thẻ hiện đỏ một lúc và Tiểu Tướng gợi ý sự kiện xảy ra sớm hơn hay muộn hơn mốc vừa chọn. Đặt đúng hết ngay lần đầu mới trọn điểm, sai 1–2 lần được nửa điểm. Dùng cả ở Hội đồng quân sự. Màn Luyện binh riêng có nút đóng + thanh tiến độ "k/6", dòng "LUYỆN BINH RIÊNG · TIỂU TƯỚNG ĐỀ XUẤT", lý do Tiểu Tướng chọn lượt, và lịch ôn của từng câu ("Hẹn ôn lại sau 3 ngày" / "Đã nhớ chắc" / "Hỏi lại ở lượt sau") – ôn giãn cách theo migration 084.
- Hội đồng quân sự hiện **"Thẻ Binh thư em đang có"** (bấm để đọc lại ở Thám sử).
- Doanh trại: ô thứ ba là số chặng đã xong của khối em, thêm **thanh kinh nghiệm của cấp**, nhiệm vụ ghi "làm mới sau N giờ".
- Bảng vàng: lưới huy hiệu gồm cả huy hiệu chưa có (ô mờ có ổ khóa, chữ vẫn đủ tương phản).
- Binh thư (ngăn Nhân vật): **thẻ danh tướng nổi bật** (tranh, độ hiếm, giới thiệu, chặng mở thẻ, Xem đầy đủ, Hỏi Tiểu Tướng) + lưới thẻ; bấm một thẻ để xem.
- Chưa làm: vật phẩm **"Đổi tướng hiệu"** (100 vàng) của Chợ phiên – học sinh hiện đổi biệt danh miễn phí trong hồ sơ, bán việc đổi tên sẽ bỏ quyền đó nên chờ người dùng quyết.
- Sửa tương phản: các hàng "còn khóa" (chặng, bước, bậc Khoa bảng, huy hiệu) không làm mờ cả chữ bằng độ trong suốt nữa – chỉ làm mờ biểu tượng.
