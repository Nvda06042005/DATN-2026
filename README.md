# Hào Khí Đông A – Học Lịch sử 7 qua game

Ứng dụng học Lịch sử 7 (ba lần kháng chiến chống quân Mông – Nguyên, 1258 – 1288) dạng game chiến thuật cho học sinh, kèm trang giáo viên và hai cổng quản trị độc lập (quản trị tổng, quản trị trường) cấp tài khoản cho học sinh khối 6 – 9 bằng file Excel mẫu. Một mã nguồn React Native chạy trên **Android, iOS và web**. Thiết kế game: [KE_HOACH_GAME_HAO_KHI_DONG_A.md](KE_HOACH_GAME_HAO_KHI_DONG_A.md).

## Kiến trúc

```
React Native (Expo) ──HTTPS / WebSocket──► NestJS (Node.js) ──SQL──► PostgreSQL (Supabase)
  frontend/                                  backend/          │
                                                               └─HTTPS + token─► Dịch vụ AI Python (FastAPI)
                                                                               ai/: NLP + RAG + LLM, BKT
```

| Thư mục | Công nghệ | Vai trò |
| --- | --- | --- |
| `frontend/` | Expo SDK 58, React Native 0.88, expo-router, react-native-svg, expo-document-picker | Giao diện cho 4 vai trò. Route: `/` trang chủ công khai, `/dieu-khoan-su-dung` điều khoản sử dụng và quyền riêng tư, `/cau-hoi-thuong-gap` câu hỏi thường gặp, `/portal` đăng nhập chung giáo viên – học sinh, `/hoc-sinh` (game), `/giao-vien`, `/admin` (quản trị tổng), `/school-manager-admin` (quản trị trường). |
| `backend/` | NestJS 11, TypeScript, `pg`, JWT, WebSocket (`ws`) | Đăng nhập & phân quyền, tài khoản, tiến độ, ngân hàng câu hỏi (server giữ đáp án và chấm), trạng thái game, thi đấu cả lớp thời gian thực, gọi dịch vụ AI, chạy migration PostgreSQL. |
| `ai/` | Python 3.11, FastAPI, scikit-learn, openpyxl | Quân Sư AI: mô hình NLP phân loại ý định + truy xuất kho tri thức (RAG) + Gemini/Hugging Face; Bayesian Knowledge Tracing; soạn đề, soạn truyện; tạo – ký – kiểm tra file Excel mẫu và so khớp dòng nhập lại (`excel_provisioning.py`). Chỉ backend gọi (khóa `AI_SERVICE_TOKEN`). |
| `database/` | SQL | `migrations/*.sql` đánh số – nguồn duy nhất của mọi thay đổi schema. |

Cấu trúc `frontend/`: `app/` (7 route), `api/` (gọi backend), `components/` (`ui.tsx`, `art.tsx`, `auth.tsx`, `live.tsx`, `provisioning.tsx`, `game/`, `teacher/`, `admin/`), `constants/`, `hooks/`, `lib/`, `types/`, `assets/`.
Cấu trúc `backend/src/`: `auth/`, `admin/` (`admin.controller.ts`, `school.service.ts` – trường, tài khoản, nhập Excel, lớp, thùng rác; `mail.service.ts` – hàng đợi thư), `student/`, `teacher/`, `live/`, `ai/`, `database/`, `app.module.ts`, `main.ts`, `config.ts`; kiểm thử ở `backend/test/`.

### Ảnh bìa trang chủ

Tiêu đề “Hào Khí Đông A” dùng `components/hero-title.web.tsx` và component [Metallic Paint của React Bits](https://reactbits.dev/animations/metallic-paint) tại `components/react-bits/metallic-paint.web.tsx`. Phần “Hào Khí” giữ Manrope trắng; “Đông A” dùng chính nét logo gốc màu đỏ son, gồm Đ, ô và A có dải lượn đỏ. `components/brand-wordmark.tsx` và `constants/brand.ts` chứa đường SVG đồ lại từ `assets/logo.jpg`, dùng chung cho header/footer, trang điều khoản, FAQ và hai cổng quản trị; không thay thế bằng một phông gần giống. Lớp WebGL trong suốt dùng mặt nạ đo trực tiếp từ chữ Manrope (gồm dấu tiếng Việt, giãn chữ và đường cơ sở) hoặc từ SVG logo gốc, phủ ánh kim chuyển động chậm; chữ HTML bên dưới vẫn đọc, chọn và sao chép được. Không tạo tiêu đề trùng trong cây trợ năng. Hiệu ứng giới hạn 30 khung hình/giây, dừng ngoài màn hình hoặc khi chuyển tab và giải phóng tài nguyên khi tháo. Điện thoại, Giảm chuyển động, trình duyệt thiếu WebGL hoặc mất context giữ chữ tĩnh; bản native ở `components/hero-title.tsx`. Lời mời cuối trang “Cùng cả lớp ra trận với Đông A!” dùng `ClosingTitle` trong cùng module: Manrope trắng, “Đông A” theo nét logo gốc đỏ son và cùng hiệu ứng Metallic Paint; màn hẹp/Giảm chuyển động/native giữ chữ tĩnh. Nguồn và giấy phép được giữ trong `frontend/third-party/react-bits/`.

Dải hoa văn sóng nước `WaveBand` có một bản ngay dưới ảnh bìa và trước “Chín màn chiến dịch”, cùng một bản ở đầu chân trang. Cả hai giữ họa tiết đỏ/vàng nhưng toàn bộ dải chỉ có opacity `0.2` (20%, không gradient hay làm nhòe).

### Gallery chiến dịch và Threads

`components/phase-gallery.web.tsx` dựng gallery hình trụ ngang: kéo để xoay, dùng mũi tên/chấm hoặc phím trái/phải. Mỗi thẻ mở một cửa sổ nhỏ có đầy đủ diễn biến trận đánh từ `PHASE_REAL`; đóng bằng X, nền tối hoặc Escape và trở lại thẻ vừa chọn. Xoay tự động chậm dừng khi hover/focus, mở chi tiết, ra ngoài màn hình hoặc ẩn tab. Điện thoại hỗ trợ vuốt; Giảm chuyển động và native dùng dải cuộn phẳng. Bố cục tham khảo [demo Motion Barrel](https://motion.dev/examples/react-gallery-barrel); mã bố trí được viết riêng với API miễn phí `animate`/`motionValue` của `motion`, không dùng mã ví dụ Motion+.

Năm tiêu đề Chín màn chiến dịch, Nơi học sinh khám phá lịch sử, Các vị vua thời Trần, Lời ông cha còn vang mãi và Cách hoạt động đều giữ một dòng ngay tại khối hiện tại (`SectionHeading singleLine`), tự giảm cỡ chữ trên màn hẹp. Nhãn, tiêu đề và mô tả căn giữa; Manrope và Newsreader vẫn dùng cho nội dung thông thường.

`components/threads-background.web.tsx` dùng [React Bits Threads](https://reactbits.dev/backgrounds/threads) chỉ bên trong **hai dải sóng mỏng 24px** (`threaded-wave-band.tsx`), ngay dưới hero và đầu chân trang: đỏ/vàng theo logo, opacity 20%, chế độ compact 14 nét, amplitude 0.45, thickness 0.7, angle 0, fade 0, tốc độ 0.18, tối đa 30fps và canvas 1280px. Renderer tự dừng ngoài màn hình hoặc ẩn tab, không chặn tương tác. Điện thoại, native và Giảm chuyển động dùng SVG tĩnh. Bản gốc và các điều chỉnh được ghi ở `frontend/third-party/react-bits/README.md`.

### Video giới thiệu trên trang chủ

`frontend/components/home-video.tsx` nằm sau “Chín màn chiến dịch” và trước “Nơi học sinh khám phá lịch sử”. Trên web màn rộng, cuộn hoặc giữ chuột kéo lên trên khung sẽ phóng video từ khung nhỏ ra kín màn hình; cuộn ngược thu nhỏ lại. Bấm vào khung (hoặc Enter khi đang chọn khung) mở trình phát có âm thanh, tua và toàn màn hình; đóng bằng nút X, Escape hoặc bấm nền tối. Video xem trước phát tiếng gốc khi ít nhất nửa khung hiện trong màn hình; dừng khi cuộn qua, ẩn tab hoặc khi trình phát lớn mở. Nếu trình duyệt chưa cho phép tự phát có tiếng, hình vẫn chạy và có nút “Bật tiếng video” trong khung. Có thể tắt tiếng tại cùng nút; lựa chọn này được giữ khi cuộn ra/vào trong lần ghé trang. Điện thoại dùng khung gọn; bật Giảm chuyển động sẽ bỏ hiệu ứng ghim/phóng và tự phát xem trước.

Video và ảnh chờ ở `frontend/assets/gioi-thieu-dong-a.mp4` / `gioi-thieu-dong-a-poster.jpg` (H.264/AAC, MP4 fast start). Màu nền lấy từ `logoInk`, `logoRed`, `logoGold`, `logoPaper` trong `constants/theme.ts`. Khi thay video, giữ bản web gọn, cập nhật ảnh chờ và kiểm tra cuộn/kéo, mở/đóng, âm thanh, bàn phím, khung điện thoại và Giảm chuyển động trước khi phát hành. Không cần migration database.

Khối “Nơi học sinh khám phá lịch sử” dùng `components/history-showcase.tsx`: nền kem và viền xanh mực theo logo, điểm nhấn đỏ/vàng. Tab “Khám phá” dùng đúng `assets/ban-do-khang-chien-1.webp`, hiển thị nguyên bản đồ bằng `contain`; phần chú giải trên màn rộng nêu Phù Lỗ (18/1/1258), Thăng Long (18 – 28/1/1258, vườn không nhà trống) và Đông Bộ Đầu (đêm 28/1/1258, phản công). Mô tả bên dưới giải thích mũi tên đỏ là quân Đại Việt, đen là quân Mông Cổ; không còn mô tả làng pixel trong tab này. Trên web màn rộng, cuộn hoặc kéo lần lượt hiện tiêu đề, khung máy tính bảng phủ mây mờ (các đám mây trượt ra hai bên và lớp sương mỏng dần), rồi nội dung cùng bốn tab; cuộn ngược đảo các bước. Tab chưa hiện được loại khỏi thứ tự bàn phím và cây trợ năng. Điện thoại, màn thấp và Giảm chuyển động hiện đầy đủ ngay, không ghim cảnh. Hook `hooks/use-drag-scroll.ts` dùng chung với video; khi kéo chuột sẽ ngắt đà cuộn mượt để không giằng vị trí.

`components/section-cloud.tsx` nối sáu ranh giới hiện có, không thêm khoảng trống hay thay đổi nội dung. Bốn ranh giới giữa các khối nền một màu (chín màn → video, khám phá → ba lần kháng chiến → danh tướng → lời ông cha) dùng `CloudPair`: hai lớp chồng nhau, lớp mây màu treo xuống từ khối trên (màu nền khối trên, không có tiếng gió) và lớp Shape Magic mọc lên từ khối dưới (màu nền khối dưới), giữa hai lớp là dải vàng be bóng (mép trên là các múi treo xuống, mép dưới là các múi tròn mọc lên, hai mép mờ dần vào nền khối). Hai ranh giới còn lại có một lớp vì một bên là video hoặc ảnh phim, không có màu phẳng để treo hoặc mọc; cả mây kem treo xuống ảnh phim ở cuối trang và mây mọc lên ngay sau video đều có viền vàng be (`rim`), cùng nhịp morph 20 giây. Mây sau video vẫn ngửa lên với hình dạng variant 1; chỉ đổi hiệu ứng, không lật hướng. Khối “Lời ông cha còn vang mãi” cùng bảng màu logo: nền giấy kem, bốn thẻ đỏ cờ, vàng cổ, mực xanh và giấy trắng. Theo yêu cầu mới, đã bỏ tiếng gió và nút loa hiệu ứng trên thanh đầu trang. Video xem trước và trình phát lớn cùng dùng âm thanh gốc. Hai khung phát luân phiên: mở trình phát lớn thì dừng xem trước; đóng trình phát lớn thì chỉ tiếp tục xem trước khi video còn trong màn hình. Nút bật/tắt tiếng nằm trong khung xem trước, không điều khiển các dải mây. Mây vàng be (`material="gold"`) dùng nhịp morph SVG từ bộ xuất **Shape Magic**, đổi dáng nhẹ, ánh bóng di chuyển, viền sáng và bóng đổ; màu lấy từ `cloudGold*` trong bảng màu. Hình dạng và ánh bóng đứng yên trên điện thoại hoặc khi bật Giảm chuyển động. Nguồn, thiết lập xuất và giấy phép được giữ trong [frontend/third-party/react-bits](frontend/third-party/react-bits/README.md).

Thanh điều hướng có sáu mục (Trang chủ, Tính năng, Kháng chiến, Danh tướng, Cách hoạt động, Câu hỏi thường gặp; hiện từ 1240 px trở lên, chân trang luôn có đủ liên kết). “Tính năng” cuộn tới cảnh “Nơi học sinh khám phá lịch sử” ở đoạn nội dung đã hiện đủ (`landing` do `history-showcase.tsx` báo cho `app/index.tsx`). Hai khối “Cách hoạt động” (bốn bước từ nhà trường cấp tài khoản đến thi đấu cả lớp) và “Câu hỏi thường gặp” (hai cột: nhãn, tiêu đề và nút “Xem tất cả câu hỏi” (mở trang `/cau-hoi-thuong-gap`) bên trái, sáu câu mở/đóng bên phải, mở được nhiều câu cùng lúc, có `aria-expanded`, không có hiệu ứng trượt hay hiện dần; dưới 1000 px xếp dọc) nằm trong `components/home.tsx` sau “Lời ông cha”. Hai trang thông tin dùng chung khung `components/info-page.tsx` (`InfoShell`): đúng thanh điều hướng viên thuốc kính, cờ, nút “Vào học ngay”, chân trang tối, nút lên đầu trang và cuộn mượt của trang chủ (`Header`, `FooterSection`, `BackToTop`, `Band`, `GoldRings` xuất từ `components/home.tsx`; `Header` nhận thêm `items`: trang chủ giữ sáu mục mặc định, hai trang này truyền Trang chủ, Điều khoản sử dụng, Câu hỏi thường gặp và `paper` để logo dùng chữ tối vì nền là giấy kem; thanh vẫn to ở đầu trang rồi co thành viên thuốc kính khi cuộn như trang chủ). Chữ chỉ gồm Manrope và Newsreader như cả ứng dụng. Liên kết ở chân trang tới khối của trang chủ dùng địa chỉ dạng `/#cau-hoi`, `/#khang-chien`; `app/index.tsx` đọc phần sau dấu `#` và tự cuộn tới khối đó khi mở trang. Câu hỏi – trả lời hiển thị bằng `QaRow` giống khối câu hỏi ở trang chủ (đường kẻ mảnh, câu hỏi đậm, dấu cộng/đóng). Trang `/dieu-khoan-su-dung` (`app/dieu-khoan-su-dung.tsx`, giao diện `components/terms-page.tsx`, nội dung `constants/terms.ts`) có tiêu đề `SectionHeading` rồi bố cục học từ trang chính sách của EduPath AI: cột “Danh mục” (hai nhóm “Điều khoản sử dụng” và “Quyền riêng tư và bảo mật”, 9 mục, mục đang xem sáng đỏ) và cột “Thông tin mô tả” (các câu của mục đang chọn, mở sẵn, bấm để đóng/mở), dòng “Cập nhật lần cuối” (`TERMS_UPDATED`); mỗi mục có địa chỉ riêng theo dấu `#` (ví dụ `/dieu-khoan-su-dung#bm-bao-ve`); điện thoại xếp dọc và tự cuộn tới nội dung khi chọn mục. Trang `/cau-hoi-thuong-gap` (`app/cau-hoi-thuong-gap.tsx`, giao diện `components/faq-page.tsx`) dựng như khối “Câu hỏi thường gặp” của trang chủ (hai cột từ 1000 px: nhãn, tiêu đề và nút bên trái; các câu bên phải, đóng sẵn, mỗi câu mở/đóng độc lập, gom theo bốn nhóm bằng nhãn đỏ nhỏ); nội dung ở `constants/faq.ts`, dùng chung với sáu câu rút gọn ở trang chủ (mục có `home`). Cả hai trang không có hiệu ứng hiện dần hay trượt và chỉ ghi điều có thật trong ứng dụng; nội dung điều khoản được viết từ cách ứng dụng thực sự hoạt động, không phải tư vấn pháp lý, cần chủ dự án rà soát trước khi công bố chính thức. Địa chỉ cũ `/cau-hoi-thuong-gap#nt-bao-mat` vẫn mở được trang câu hỏi, còn phần quyền riêng tư nay ở `/dieu-khoan-su-dung`.

Chân trang gồm logo và mô tả, cột “Khám phá”, cột “Khám phá lịch sử thời Trần” kèm liên kết “Trang quản lý” tới `/admin`, liên kết “Thông tin hình ảnh” và thanh bản quyền “© 2026 · Đông A” có “Về đầu trang”. `constants/map-credits.ts` chứa ba nguồn gốc (Lưu Ly, phạm vi công cộng), chỉ hiển thị ở `/thong-tin-hinh-anh` cùng thông tin 14 ảnh nhân vật; không liệt kê riêng ba nguồn ở chân trang.

Khối “Các vị vua thời Trần” dùng `components/hero-gallery.tsx`: ban đầu chỉ hiển thị lưới ảnh nhân vật, không tự chọn hoặc hiện sơ yếu lý lịch. Bấm thẻ mới mở chi tiết của người đó; bấm lại thẻ đang chọn để đóng. Trên máy tính, lưới dùng hết bề rộng khi chưa chọn, sau khi chọn thì khung chi tiết nằm bên phải; trên điện thoại, chi tiết nằm ngay dưới hàng vừa bấm. Không tự cuộn, không trượt/hiện dần/nhấc thẻ và khung chi tiết không sticky. Ảnh tượng, phù điêu và tư liệu dùng `components/hero-photo.tsx` cùng `constants/hero-photos.ts`; ghi công đầy đủ ở `/thong-tin-hinh-anh`. Sơ yếu lý lịch (sinh – mất, chức tước, xuất thân, kháng chiến tham gia, công trạng) lấy từ `HERO_PROFILE` trong `constants/heroes.ts`; giữ nguyên dữ liệu, danh sách nhân vật và liên kết vào game.

Khối “Ba lần kháng chiến chống Nguyên – Mông” hiển thị bản đồ của Wikipedia tiếng Việt thay cho lược đồ minh họa: `frontend/assets/ban-do-khang-chien-1.webp`, `-2.webp`, `-3.webp` (Chongquannguyenlan1/2/3.svg trên Wikimedia Commons, tác giả Lưu Ly, phạm vi công cộng), bấm vào bản đồ để phóng to (điện thoại kéo ngang). Các dòng thời gian, đối phương, lãnh đạo, lực lượng, diễn biến chính và kết quả nằm ở `CAMPAIGN_FACTS` trong `components/home.tsx`, theo hộp thông tin và nội dung ba bài Wikipedia; số quân là ước tính, các nguồn chép khác nhau.

### Giao diện quản trị

Hai cổng dùng chung `components/admin/AdminWorkspace.tsx`, tham khảo bố cục tài khoản EduPath trong ảnh người dùng cung cấp: thanh đầu trắng, menu đỏ bên trái, nền chính trung tính và các bảng trắng viền mảnh. Mặc định mở Tài khoản; menu điện thoại mở/đóng bằng nút ở thanh đầu. Nút đổi mật khẩu nằm cuối sidebar, đăng xuất ở thanh đầu.

Bảng tài khoản có các cột STT, người dùng, vai trò, trạng thái, đăng nhập gần nhất và menu ba chấm; dưới 1180px chuyển thành thẻ để đọc trên màn hẹp. Tìm kiếm, bộ lọc vai trò/khối/trường/năm học/khu vực và phân trang dùng API hiện có. Cấp tài khoản, đặt lại mật khẩu, khóa/mở và thùng rác giữ quy trình cũ; không tạo dữ liệu hoặc lịch sử đăng nhập giả để lấp bảng. Quản trị trường giữ phạm vi dữ liệu và quyền riêng. `AdminUiContext` chỉ làm phẳng nút/thẻ/ô nhập trong admin, giao diện học sinh và giáo viên giữ phong cách hiện có.

Tiêu đề “Điều khoản sử dụng” cũng giữ một dòng theo bề rộng màn hình, dùng Manrope và Newsreader.

### Xác thực

- Mật khẩu băm PBKDF2-SHA256 (240.000 vòng, muối ngẫu nhiên; mật khẩu mặc định cấp từ file Excel 20.000 vòng vì bắt buộc đổi ở lần đầu); token JWT HS256 ký bằng `AUTH_SECRET_KEY` (kèm mã trường `sid`), hết hạn sau 12 giờ, tự mất hiệu lực khi đổi mật khẩu, khóa hoặc xóa tài khoản.
- Vai trò: `root_admin` (quản trị tổng, toàn hệ thống), `school_admin` (quản trị một trường), `teacher`, `student`. Hai cổng quản trị là trang độc lập, không có nút hay liên kết về trang chủ; giáo viên, học sinh đăng nhập ở `/portal` (hoặc `/giao-vien`, `/hoc-sinh`). Khóa đăng nhập 60 giây sau 5 lần sai.
- Lần đầu đăng nhập bằng mật khẩu được cấp: màn hình chính bị khóa, cửa sổ đặt mật khẩu mới không đóng được cho tới khi đổi xong (hoặc đăng xuất).
- Quản trị trường, giáo viên, học sinh chỉ thấy dữ liệu trường mình: server lọc theo `school_id` trong tài khoản và chạy truy vấn dưới vai trò PostgreSQL `dong_a_school_scope` với Row-Level Security (`app.school_id`).
- Điện thoại lưu phiên trong kho bảo mật của hệ điều hành (expo-secure-store); web lưu trong localStorage.

## Game của học sinh

| Tab | Nội dung |
| --- | --- |
| Điền Trang | 8 công trình, ruộng tự sinh Lương Thảo, nâng cấp phải trả lời đúng 1 câu, sự kiện “Giặc cướp lương” (vườn không nhà trống), nhiệm vụ ngày. |
| Doanh Trại | 14 tướng theo 5 hệ, tiến hóa theo giai đoạn cuộc đời, Hội Quán Vạn Kiếp (thẻ Nhân lực + thẻ Sự kiện → lệnh bài → câu hỏi), cổ vật. |
| Chiến Dịch | 3 màn × 3 pha, đánh theo lượt 3v3, kế sách lịch sử của từng trận, thủy triều Bạch Đằng. |
| Quốc Tử Giám | Thi đấu cả lớp (mã PIN), luyện nhanh, theo chủ đề, Tháp Khảo Thí 10 tầng, ôn điểm yếu theo BKT, đề do Quân Sư AI soạn. |
| Sử Ký | Dòng thời gian trên lược đồ, thẻ tri thức từ kho tri thức, trò chuyện với Quân Sư AI (có trích nguồn). |

**Hành Trình Đông A (thế giới 2D):** nút “Hành Trình” trên thanh trên cùng (hoặc thẻ ở Điền Trang) mở một thế giới pixel kiểu nông trại – phiêu lưu gồm 3 vùng đất mở dần: Làng Đông A (1258), Bến Bình Than – Vạn Kiếp (1282 – 1285), cửa sông Bạch Đằng (1287 – 1288). Em đi lại bằng phím mũi tên/WASD, nút điều hướng hoặc chạm vào chỗ muốn đến; gặp người dân nghe kể chuyện xưa (lấy từ thẻ Sử Ký), trả lời câu hỏi để làm nhiệm vụ và mở đường sang vùng mới; gieo trồng trên luống đất (cây lớn theo thời gian thực, chín rồi không hỏng; trả lời đúng một câu để “bón phân tri thức”); đuổi thám báo đi tuần; đóng cọc Bạch Đằng rồi đánh đội thuyền giặc. Nhân vật đều là người hư cấu kể lại chuyện người thật. Phần thưởng là Lương Thảo, Quân Lực và thẻ chiêu mộ dùng ở Hội Quán; XP, Ấn Tín vẫn chỉ do server cộng khi trả lời đúng. Có nhật ký nhiệm vụ, nút Chỉ đường, chế độ đêm và chế độ giảm chuyển động.

Câu hỏi do server chọn và chấm; Ấn Tín và XP chỉ tăng khi trả lời đúng (tối đa 300 Ấn Tín/ngày). Trạng thái game tự lưu lên server, có chế độ tối “Đêm Bạch Đằng” và tùy chọn giảm chuyển động.

**Thi đấu cả lớp:** giáo viên mở phòng (5/10/15 câu, phạm vi từng lần kháng chiến), đọc mã PIN; học sinh cùng lớp vào bằng PIN hoặc link `/hoc-sinh?pin=…`. Mỗi câu 20 giây, điểm theo tốc độ và chuỗi câu đúng; mỗi câu trả lời cộng vào tiến độ thật; trận kết thúc lưu vào lịch sử lớp. Kết nối WebSocket `/api/live/ws`, token gửi trong tin nhắn đầu tiên; mất mạng tự vào lại đúng phòng.

## Cấp tài khoản bằng file Excel

- **File mẫu** tải công khai ở trang chủ (`GET /api/public/excel-template`, không cần đăng nhập): trang `Danh sach` có đúng 11 cột – Mã số người dùng, Trường, Mã số trường, Khu vực, Thành phố, Tên, Ngày tháng năm sinh (DD/MM/YYYY), Năm học (2025-2026), Email, Khối (6/7/8/9), Vai trò (GV/HS); trang ẩn `_sys_signature` (khóa mật khẩu) chứa chữ ký HMAC-SHA256 của cấu trúc cột cùng thuộc tính tùy chỉnh của workbook.
- **Kiểm tra khi nhập**: chỉ nhận `.xlsx` (đuôi file, MIME, chữ ký nhị phân ZIP), tối đa 2 MB / 1.000 dòng, không macro; từ chối file tự tạo, file thêm/xóa/đổi tên/đổi thứ tự cột hoặc thêm trang.
- **Tên đăng nhập** `[tên gọi không dấu].[2 số năm học][4 số mã trường][khối][3 số cuối năm vào lớp 6][3 số thứ tự]@ACCOUNT_DOMAIN`, ví dụ `anh.2504807024001@donga.local`; **mật khẩu mặc định** `[chữ cái đầu họ tên, chữ đầu viết hoa][ddmmyyyy]VN@`, ví dụ `Nvda06042012VN@`. Mật khẩu không bao giờ nằm trong phản hồi API.
- **Thư thông tin đăng nhập** đi qua hàng đợi trong PostgreSQL (`app_email_outbox`, nội dung mã hóa AES-256-GCM, xóa sau khi gửi; thử lại theo lũy thừa) và Nodemailer (`SMTP_URL` hoặc `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`, `MAIL_FROM`). Chưa cấu hình SMTP thì thư nằm chờ; quản trị tải danh sách CSV tài khoản chưa gửi để phát tay.
- **Dòng thiếu thông tin** chưa được cấp tài khoản, ghi vào `app_incomplete_import_logs` kèm vector đặc trưng 128 chiều (cột `embedding_vec` pgvector khi CSDL có extension `vector`, nếu không thì so khớp bằng mảng số). **Nhập lại** cùng file đã bổ sung: hệ thống đối chiếu (Smart Delta) và chỉ cấp tài khoản, gửi thư cho dòng vừa đủ thông tin; người đã có tài khoản không nhận lại thư.
- **Quản trị tổng** nhập cho mọi trường (trường chưa có tự tạo từ cột Trường, Mã số trường); **quản trị trường** chỉ nhận dòng của trường mình; **giáo viên** chỉ nhập học sinh của trường mình.
- **Lớp học**: giáo viên gửi yêu cầu mở lớp (mã lớp, năm học, tên lớp, mật khẩu lớp) → trạng thái `PENDING`; quản trị trường duyệt (`APPROVED`) hoặc từ chối → giáo viên nhận thông báo trong app (chuông, tự cập nhật mỗi 20 giây) và email; học sinh vào lớp bằng mã lớp + mật khẩu lớp ở mục Hồ sơ của game.
- **Thùng rác**: xóa tài khoản là chuyển vào thùng rác 45 ngày (đếm ngược, khôi phục được, không đăng nhập được); tác vụ lịch `@nestjs/schedule` xóa vĩnh viễn lúc 00:00 giờ Việt Nam (và bù khi máy chủ khởi động lại).
- Tìm kiếm, lọc nhanh theo trường, khu vực, thành phố, năm học, khối, vai trò dùng chỉ mục B-Tree và GIN `pg_trgm` trên cột `search_text` không dấu; chỉ mục duy nhất `(user_code, school_code, email)` chống trùng.

## Chạy trên máy

Cần Node.js 22, Python 3.11 và một PostgreSQL (Supabase hoặc cài trên máy).

```bash
# 1. Dịch vụ AI – http://localhost:8001
cd ai
pip install -r requirements.txt
cp .env.example .env        # GEMINI_API_KEY (tùy chọn)
uvicorn server:app --port 8001

# 2. Backend NestJS – http://localhost:8000 (tự chạy migration khi khởi động)
cd backend
npm install
cp .env.example .env        # DATABASE_URL, AUTH_SECRET_KEY, AI_SERVICE_URL=http://localhost:8001
npm run build && npm start  # hoặc: npm run dev

# 3. App Expo
cd frontend
npm install
cp .env.example .env        # EXPO_PUBLIC_API_URL=http://localhost:8000 (điện thoại: http://<IP-máy-tính>:8000)
npm run web                 # trình duyệt; hoặc npm start rồi quét mã bằng Expo Go / npm run android
```

Quản trị tổng mặc định: `admin` / `admin@123`, đăng nhập tại `/admin` (đặt `ADMIN_PASSWORD` khi triển khai thật). Quản trị tổng thêm trường và cấp tài khoản quản trị trường; quản trị trường đăng nhập tại `/school-manager-admin`.

**Đăng nhập, đăng xuất, quên mật khẩu của hai cổng quản trị** (nhóm "01. Tài khoản và xác thực" trong danh sách chức năng, giai đoạn 1): trang đăng nhập `components/admin/AdminLogin.tsx` có bố cục hai cột trên desktop, nền giấy kem và hoa văn `PatternOverlay` như trang chủ phủ cả hai phía. Chỉ giữ logo nhỏ, bỏ khẩu hiệu lớn và ảnh phim; màn hẹp xếp dọc. Form chỉ đăng nhập bằng tài khoản được cấp (không đăng ký tự do) – TM.AUTH.001; nút "Đăng xuất" ở thanh trên cùng xóa phiên và quay về trang đăng nhập – TM.AUTH.002. "Quên mật khẩu?" – TM.AUTH.007: nhập tên đăng nhập hoặc email, backend (`POST /api/auth/forgot-password`) gửi email liên kết `…/admin?reset=<mã>` (hiệu lực 30 phút, dùng một lần, CSDL chỉ lưu băm SHA-256 ở `app_password_resets`); mở liên kết để đặt mật khẩu mới (`POST /api/auth/reset-password`), mọi phiên cũ mất hiệu lực. Luôn trả lời giống nhau dù tài khoản có tồn tại hay không, mỗi tên chỉ được yêu cầu 3 lần/15 phút. Cần cấu hình gửi thư (`SMTP_*`, `MAIL_FROM`; chưa có thì API trả 503) và tài khoản phải có email: đặt `ADMIN_EMAIL` cho quản trị tổng (điền vào tài khoản chưa có email lúc backend khởi động), quản trị trường dùng email trong hồ sơ.

Trên website Vercel, đường dẫn cũ `/root-system-admin` tự chuyển hướng vĩnh viễn (HTTP 308) sang `/admin`.

## Kiểm thử

```bash
cd backend && npm test                   # Jest: API, game, chấm điểm, thi đấu WebSocket, migration (PostgreSQL tạm bằng initdb)
cd ai && python test_server.py           # dịch vụ AI: chat RAG, BKT, soạn đề
cd ai && python test_model.py && python test_regression_suite.py   # đánh giá chatbot (ai/KET_QUA_DANH_GIA.md)
cd frontend && npm run typecheck && npx expo export -p web         # kiểu TypeScript và gói web
```

Bài kiểm thử backend tự tạo cụm PostgreSQL tạm (cần `initdb`/`pg_ctl`; đặt `POSTGRES_BIN` nếu không ở vị trí mặc định) và thay dịch vụ AI bằng bản giả.

Backend trên Render dùng Node.js 22.21.0 và npm 10.9.4. Khi thay đổi dependency, đồng bộ lockfile bằng `npx --yes npm@10.9.4 install --package-lock-only`, rồi kiểm tra cài đặt sạch bằng `npx --yes npm@10.9.4 ci` trước khi build và chạy kiểm thử. Lockfile tạo bằng npm khác có thể thiếu peer dependency mà npm 10 yêu cầu.

## Triển khai

Website chính thức: **https://datn-2026-indol.vercel.app/**. Mã nguồn đang sử dụng nằm trên nhánh **`main`** của [GitHub DATN-2026](https://github.com/Nvda06042005/DATN-2026/tree/main). Vercel chỉ tự triển khai từ `main` theo `frontend/vercel.json`; không dùng URL Preview hoặc URL có mã deployment làm địa chỉ bàn giao. Mỗi lần cập nhật vẫn có lịch sử deployment và URL kỹ thuật do Vercel tự tạo, còn địa chỉ chính thức luôn giữ nguyên.

`dong-a-api` và `dong-a-ai` là hai dịch vụ backend của cùng ứng dụng, cùng lấy mã từ `main`; chúng không phải hai website để người dùng lựa chọn.

| Phần | Nơi chạy | Cấu hình |
| --- | --- | --- |
| `frontend/` (web) | Vercel, thư mục gốc `frontend` | `frontend/vercel.json`: `expo export -p web`, thư mục `dist`. Biến `EXPO_PUBLIC_API_URL` = địa chỉ backend (nếu chưa đặt sẽ dùng `VITE_API_URL` cũ). |
| `frontend/` (Android/iOS) | EAS Build | `npx eas-cli build -p android` (cần tài khoản Expo); đặt `EXPO_PUBLIC_API_URL` trong môi trường build. |
| `backend/` + `ai/` | Render (Blueprint `render.yaml`) | 2 dịch vụ Free `dong-a-api` (Node) và `dong-a-ai` (Python); đặt `DATABASE_URL` (Supabase Session pooler), `ADMIN_PASSWORD`, `ADMIN_EMAIL` (email nhận liên kết "Quên mật khẩu" của quản trị tổng), `GEMINI_API_KEY`, và để gửi thư: `SMTP_URL`, `MAIL_FROM` trong Render. Render tự tạo `EXCEL_SIGNING_KEY` (khóa ký file Excel mẫu) cho `dong-a-ai`. Backend chạy một instance (phòng thi đấu nằm trong bộ nhớ). |
| Database | Supabase PostgreSQL | Migration trong `database/migrations/`, xem [database/migrations/README.md](database/migrations/README.md). |

Blueprint lấy URL HTTPS của AI từ `RENDER_EXTERNAL_URL`, rồi gán cho `AI_SERVICE_URL` của backend. Hai dịch vụ Free không dùng `hostport` private network. Render tự tạo `AI_SERVICE_TOKEN` cho AI và cấp cùng giá trị cho backend; các API nghiệp vụ AI yêu cầu header `X-AI-Token`. Không đưa token này vào frontend. `/health` chỉ dùng kiểm tra dịch vụ nên không yêu cầu token. Nếu dùng Hugging Face, thêm `HF_TOKEN` trực tiếp vào môi trường `dong-a-ai` (không bắt buộc khi dùng Gemini).

Free có thể ngủ khi không có truy cập, nên lần gọi đầu sau thời gian nghỉ có thể chậm. Sau triển khai, kiểm tra `/health` của AI, `/api/health` và `/api/database/health` của backend; thử gọi API AI không có token phải nhận HTTP 401. Đặt `EXPO_PUBLIC_API_URL` trên Vercel bằng URL HTTPS thực tế của `dong-a-api`, rồi triển khai lại frontend để cập nhật giá trị trong gói web.

Không đặt `DATABASE_URL`, mật khẩu hay khóa bí mật vào biến `EXPO_PUBLIC_*` – các biến này nằm công khai trong gói app.

### Gửi thư qua Brevo trên Render Free

[Render Free chặn cổng SMTP 25, 465 và 587](https://render.com/docs/free). Dùng [Brevo SMTP](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP) cổng **2525**; backend bắt buộc nâng cấp STARTTLS và kiểm tra chứng chỉ máy chủ.

1. Tạo tài khoản Brevo Free, hoàn tất xác minh và xác nhận dịch vụ Transactional đang hoạt động. Thêm địa chỉ người gửi và xác minh email theo hướng dẫn của Brevo.
2. Lấy **SMTP login** và tạo **SMTP key** trên trang SMTP của Brevo. SMTP login có thể khác email đăng nhập tài khoản. Không dùng API key, mật khẩu Gmail hoặc SMTP login làm địa chỉ From.
3. Trong Render → `dong-a-api` → Environment, đặt `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=2525`, `SMTP_USER` bằng SMTP login, `SMTP_PASS` bằng SMTP key, `MAIL_FROM` theo mẫu `Đông A EDU <dia-chi-da-xac-minh>`. Xóa/để trống `SMTP_URL` để không ghi đè các biến riêng; để trống `MAIL_TRANSPORT` khi gửi thật. Nhập bí mật trực tiếp trên Render, không lưu vào Git hay chat.
4. Ban đầu đặt `MAIL_WORKER=off`, lưu và triển khai. Backend kiểm tra kết nối/xác thực mà **không gửi thư**; log thành công: `SMTP: kết nối TLS và xác thực thành công`. Việc này chưa xác nhận Brevo chấp nhận địa chỉ From hoặc thư đã vào hộp thư người nhận. Lỗi SMTP không làm dừng API; log chỉ ghi mã lỗi, không ghi tài khoản hoặc khóa.
5. Trong cổng quản trị tổng → Thư, bấm **Gửi thư kiểm tra** và xác nhận địa chỉ nhận. Backend gửi về chính `MAIL_FROM`, tối đa một lần/60 giây/tiến trình; không thay đổi hàng đợi tài khoản. Nút này chỉ dành cho quản trị tổng (`POST /api/admin/outbox/test`); trường không được xem địa chỉ kiểm tra hoặc gọi API này. Kiểm tra hộp thư và Transactional Logs của Brevo: phản hồi API chỉ xác nhận máy chủ SMTP đã nhận thư, chưa xác nhận đã giao vào hộp thư. Hoàn tất bước Verification của Brevo khi thấy log gửi thư thành công.
6. Kiểm tra hàng đợi ở trang quản trị trước khi bật. Sau khi xác nhận cấu hình/người gửi và thư chờ hợp lệ, đặt `MAIL_WORKER=on` và triển khai lại. Thư chờ đến hạn sẽ được gửi tự động; xem trạng thái ở trang quản trị và Transactional Logs của Brevo. Trang Thư phân biệt SMTP đã cấu hình với tiến trình gửi tự động đang bật/tạm dừng. Khi Render Free ngủ, worker dừng và tiếp tục khi dịch vụ hoạt động trở lại.

### Gửi thư bằng Gmail qua cầu Apps Script (không cần SMTP, chạy được trên Render Free)

Render Free chặn cổng SMTP nhưng cho HTTPS, nên backend có thể gửi thư bằng cách gọi một Web App Google Apps Script của chính chủ Gmail (`backend/mail-relay.gs`); script gửi bằng `MailApp`, thư đi từ Gmail đó. Khi có cả `MAIL_RELAY_URL` và `MAIL_RELAY_SECRET`, cầu được ưu tiên hơn SMTP. Mật khẩu ứng dụng Google không dùng ở cách này.

1. Làm theo các bước trong phần chú thích đầu `backend/mail-relay.gs` (tạo script, đặt thuộc tính `MAIL_RELAY_SECRET`, chạy `authorize`, triển khai Ứng dụng web chạy bằng "Tôi", truy cập "Bất kỳ ai"), lấy URL kết thúc bằng `/exec`.
2. Trong Render → `dong-a-api` → Environment đặt `MAIL_RELAY_URL` (URL `/exec`), `MAIL_RELAY_SECRET` (trùng thuộc tính trong Apps Script), `MAIL_FROM=Đông A EDU <gmail-của-bạn>` (thư kiểm tra gửi về địa chỉ này), `ADMIN_EMAIL`; đặt `MAIL_WORKER=off` cho lần triển khai đầu để thư đang chờ trong hàng đợi chưa bị gửi ngay. Bí mật nhập trực tiếp trên Render, không đưa vào Git hay chat.
3. Sau khi triển khai, log phải có `Cầu gửi thư (Apps Script): kết nối và xác thực thành công` (chỉ kiểm tra địa chỉ và khóa, không gửi thư). Lỗi chỉ ghi mã: `ERELAYAUTH` sai khóa, `ERELAYRESPONSE` URL không phải bản triển khai hợp lệ (script chưa triển khai cho "Bất kỳ ai" hoặc URL sai), `ERELAYCONNECT` không kết nối được, `ERELAYSEND` Google từ chối gửi (thường hết hạn mức).
4. Bấm **Gửi thư kiểm tra** ở cổng quản trị tổng, thử "Quên mật khẩu", rồi bật `MAIL_WORKER=on` như bước 6 của mục Brevo.

Giới hạn: Gmail cá nhân chỉ gửi khoảng 100 người nhận mỗi ngày qua Apps Script (Workspace khoảng 1.500), nên nhập Excel cấp tài khoản cho vài trăm người sẽ vượt hạn mức; các thư quá hạn mức thử lại theo hàng đợi hoặc dùng CSV tài khoản chưa gửi. Ai biết URL và khóa bí mật đều gửi được thư từ Gmail đó, nên giữ kín khóa và đặt chuỗi dài, ngẫu nhiên.

Brevo có thể [thay địa chỉ From dùng Gmail bằng địa chỉ relay](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders). Dùng tên miền riêng đã xác thực nếu cần giữ địa chỉ From theo tên miền. Các biến `sync: false` của Blueprint không tự bổ sung vào dịch vụ đã tồn tại; cập nhật Environment trên `dong-a-api`.

## Lưu ý

- Module trong `ai/` giữ tên phẳng (`create_model`, `context_manager`, …) vì `ai/models/dong_a_nlp_model.joblib` được pickle theo các tên này; mô hình tạo bằng scikit-learn 1.7.x + numpy 2.x.
- Ngân hàng câu hỏi của game: `ai/data/game_content.json` (backend đọc khi khởi động). Không sửa tay `knowledge_base.json`/`q_matrix.json` (sinh bởi `ai/data_splitter.py`).
- Tài khoản và mật khẩu cũ vẫn dùng được (cùng định dạng băm); sau khi chuyển backend, người dùng chỉ cần đăng nhập lại một lần.
