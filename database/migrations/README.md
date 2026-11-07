# SQL migrations

Thêm file mới theo số thứ tự, ví dụ `020_ten_thay_doi.sql`.
Tạo file bằng lệnh (từ thư mục `backend/`): `npm run build && npm run migrate -- new ten_thay_doi`.

Không sửa migration đã chạy, không chứa bí mật/dữ liệu tài khoản thật, không thêm transaction wrapper.
Bảng mới chứa dữ liệu người dùng phải bật RLS. Runner của backend NestJS tự chạy khi khởi động với `DATABASE_URL`
và ghi lịch sử vào `public.app_schema_migrations`; kiểm tra không cần CSDL bằng `npm run migrate -- check`.

Ngày 31/10/2026 thư mục này từng bị xóa theo yêu cầu (website chỉ còn ba trang) rồi được khôi phục khi bắt đầu Sprint 1–2 của
`HaoKhiDongA_DanhSachChucNang_ver0.1`. Supabase vẫn giữ lịch sử 001–013 nên các file đó được lấy lại nguyên văn từ Git
(commit 46d312a); đổi nội dung hay tên một file đã chạy sẽ bị runner từ chối. Số tiếp theo luôn là số lớn nhất ở đây cộng một.

| File | Nội dung |
| --- | --- |
| `001_initial_postgres_schema.sql` | Mốc ban đầu của `do_an_tot_nghiep` (bảng `User`, `Profile`, `UserSettings`, `_prisma_migrations` đã nhập vào Supabase; giữ nguyên) |
| `002_app_users.sql` | `app_users` |
| `003`–`005` | Tiến độ học, trạng thái game, thi đấu trực tiếp của bản cũ (bảng vẫn còn, bản mới chưa dùng) |
| `006_schools_provisioning.sql` | Trường học, vai trò `root_admin`/`school_admin`, lớp, thành viên lớp, thông báo, hàng đợi email, vai trò RLS `dong_a_school_scope` và chính sách theo `app.school_id` |
| `007_password_reset.sql`, `013_profiles_and_otp.sql` | Mã đặt lại mật khẩu (OTP), cột hồ sơ cá nhân |
| `008_account_security.sql` | Thu hồi token, nhật ký đăng nhập, nhật ký thao tác |
| `009`, `010`, `011`, `012` | Liên hệ trường, báo cáo, nội dung game cũ, vòng đời lớp (bảng khối theo năm, lịch sử lớp) |
| `014_hk_accounts_years_classes.sql` | Lý do khóa, cấp quản trị tổng, xác nhận hồ sơ, OTP đăng ký tự học, **bảng năm học** (suy từ lớp/khối/tài khoản cũ), **mã tham gia lớp 6 ký tự** (lớp cũ nhận mã ngẫu nhiên), **bảng giáo viên–lớp** (chép từ `teacher_id`), khóa ngoại giáo viên không còn xóa lớp, thêm loại sự kiện lớp, RLS theo trường cho bảng mới. Dữ liệu cũ giữ nguyên |
| `015_history_warehouse.sql` | Kho dữ liệu lịch sử: `hist_campaigns`, `hist_places`, `hist_figures`, `hist_events`, `hist_battles`, `hist_sources`, `hist_terms`, `hist_links`, `hist_versions`; RLS bật, **không** cấp quyền cho vai trò theo trường (chỉ backend đọc/ghi) |
| `016_seed_history_warehouse.sql` | Nội dung khởi tạo của kho (tất cả ở trạng thái Nháp, kèm phiên bản 1 và liên kết); chạy lại không tạo trùng |
| `017_question_bank.sql` | Ngân hàng câu hỏi nhiều dạng (`hk_questions`), liên kết với kho lịch sử, lịch sử chỉnh sửa, bộ đề (`hk_quizzes`, `hk_quiz_questions`), yêu cầu chia sẻ/duyệt (`hk_shares`); RLS bật, chỉ backend đọc/ghi |
| `018_learning_journeys.sql` | Bài học, hành trình, nút, giao cho lớp, tiến độ học sinh, mở khóa tư liệu, lượt làm bài và đáp án, câu sai, sổ điểm, ghi chú, yêu thích, nhật ký sự kiện học tập; RLS bật, chỉ backend đọc/ghi |
| `019_seed_learning_content.sql` | Nội dung học khởi tạo: 27 câu hỏi, 9 bộ đề, 3 bài học, 3 hành trình mẫu (bài học và hành trình ở trạng thái Nháp); chạy lại không tạo trùng |
| `020_gamification.sql` | Trò chơi hóa: nhân vật học sinh (`hk_players`), lớp nhân vật, cấp độ, sổ vàng, nhiệm vụ ngày/tuần (mẫu và bản giao), huy hiệu và thẻ nhân vật (kể cả thẻ rơi chờ lật), cửa hàng và túi đồ, chuỗi ngày, mục tiêu ngày, chúc mừng chờ hiển thị, giải đấu tuần, cấu hình trường và lớp, sự kiện cấp trường, cấu hình chung (`hk_settings`); RLS bật, chỉ backend đọc/ghi |
| `021_seed_gamification.sql` | Nội dung khởi tạo: 10 cấp, 3 lớp nhân vật và kỹ năng, vật phẩm cửa hàng, mẫu nhiệm vụ, huy hiệu hệ thống, thẻ nhân vật gắn với nhân vật trong kho lịch sử; chạy lại không tạo trùng |
| `022_battle_simulation.sql` | Mô phỏng trận đánh và mini-game: kịch bản trận đánh (`hk_scenarios`, JSON), mini-game (`hk_minigames`), lượt chơi có lưu dở (`hk_game_runs`); thêm lý do điểm và vàng `battle`, `minigame`; RLS bật, chỉ backend đọc/ghi |
| `023_seed_battle_content.sql` | Nội dung khởi tạo: 6 kịch bản trận đánh kèm hoạt ảnh và 4 mini-game, tất cả ở trạng thái Nháp; chạy lại không tạo trùng |
| `024_classroom.sql` | Lớp học (Sprint 7): đội và thành viên, yêu cầu rời lớp, thưởng/phạt, hộp quà, bài tập và bài nộp, lượt dùng kỹ năng, đường nối nút; cột vị trí – điều kiện – thưởng của nút, lịch giao hành trình, điểm hành động; bảng mới bật RLS, không tạo dữ liệu người dùng |
| `025_live_quiz.sql` | Thi đấu trực tiếp (Sprint 8): phòng thi kèm bản chụp câu hỏi và mã PIN (duy nhất giữa các phòng chưa kết thúc), người chơi, câu trả lời; lý do điểm `live`; bảng mới bật RLS, không tạo dữ liệu người dùng |
| `026_learning_path.sql` | Lộ trình dạng đường đi (Sprint 5 theo ver0.2): Cửa của hành trình (`hk_gates`), cột Cửa / âm thanh / lời kể / Binh thư của nút, bốn loại nút mới (luyện tập, nghe kể chuyện, rương, kiểm tra cuối cửa), Binh thư của người chơi và sổ cái riêng; bảng mới bật RLS, không tạo dữ liệu người dùng |
| `027_seed_learning_path.sql` | Nội dung khởi tạo (bản nháp): chia ba hành trình mẫu thành các Cửa và thêm nút nghe kể chuyện, luyện tập, rương, kiểm tra cuối cửa; chỉ động vào hành trình mẫu còn nháp, chưa có học sinh học và chưa chia Cửa; chạy lại không nhân đôi |
| `028_war_game.sql` | Game thẻ tướng (Sprint 6 theo ver0.2): độ hiếm Sử thi, thẻ tướng / thẻ chiến thuật (binh chủng, chỉ số, số mảnh), chiêu thức, cấp và sao của thẻ, mảnh thẻ, đội hình, chỉ huy đối phương và sổ tay, màn chơi, trận đang chơi, tiến độ màn, bản đồ hành quân (điểm, đường nối, vị trí, lượt đến), hội thoại và nhật ký, kho tài nguyên (bắt buộc nguồn và giấy phép), cài đặt game của trường, giờ chơi mỗi ngày; mọi bảng mới bật RLS |
| `029_seed_war_content.sql` | Nội dung khởi tạo (bản nháp, chờ giáo viên Lịch sử kiểm chứng): chỉ số, độ hiếm và 31 chiêu thức kèm giai thoại của 13 tướng, 4 thẻ chiến thuật, 5 chỉ huy đối phương, 6 màn chơi, 3 bản đồ hành quân, 6 hội thoại; màn, bản đồ, hội thoại, chỉ huy đều ở trạng thái Nháp; chạy lại không nhân đôi |
| `030_ai_tutor.sql` | AI Tutor "Tiểu Tướng" (Sprint 9): cấu hình mô hình một dòng (khóa API chỉ lưu mã hóa, không có khóa trong migration), hạn mức theo trường, tài liệu và đoạn tư liệu đã lập chỉ mục (vector nhúng `REAL[]`, không cần pgvector), hội thoại, tin nhắn, báo cáo câu trả lời sai; mọi bảng bật RLS |
| `031_analytics_recommendations.sql` | Gợi ý học tập và báo cáo (Sprint 10): cấu hình thuật toán gợi ý một dòng (trọng số, ngưỡng điểm yếu, tần suất, hệ số giảm điểm), gợi ý đã sinh cho từng học sinh kèm đánh giá hữu ích / chưa hữu ích, nhật ký thư nhận xét giáo viên gửi, loại thư `feedback` cho hàng đợi email và giá token AI (USD / 1 triệu token) để ước tính chi phí; bảng mới bật RLS, báo cáo đọc từ dữ liệu có sẵn nên không thêm bảng số liệu |
| `032_platform.sql` | Nền tảng hệ thống (Sprint 11): tùy chọn người dùng (giao diện sáng / tối, nhắc học), thông báo hàng loạt có hẹn giờ và khóa chống gửi trùng, yêu cầu hỗ trợ kèm ảnh, hướng dẫn / FAQ, cấu hình hệ thống một dòng, cờ bật / tắt tính năng, mẫu thư đã chỉnh, giới hạn theo trường, ma trận phân quyền (38 nhóm × 4 vai trò theo đặc tả), xác thực hai lớp (bí mật TOTP chỉ lưu mã hóa), nhật ký lỗi, nhịp việc nền, sao lưu; thêm IP và thiết bị cho nhật ký đăng nhập; mọi bảng mới bật RLS |
| `033_seed_help_content.sql` | Nội dung hướng dẫn và câu hỏi thường gặp khởi tạo theo vai trò (bản nháp chữ, quản trị tổng sửa được) |
| `034_surveys_research.sql` | Khảo sát và nghiên cứu (Sprint 12): mẫu khảo sát (3 mẫu khởi tạo), khảo sát của trường, câu trả lời (mỗi người một lần), nhóm thử nghiệm và lớp thuộc nhóm; mọi bảng bật RLS |
| `035_live_quiz_v2.sql` | Soạn Quiz và thi đấu nâng cao (ver0.2 Sprint 8): ảnh tải lên, ảnh bìa – giao diện – loại điểm của Quiz, bản nháp tự lưu, video câu hỏi; khóa phòng, tên theo hồ sơ, chống tra cứu, chế độ Đánh trùm, yêu cầu vào phòng và nhật ký phòng; mọi bảng mới bật RLS |
| `036_class_battle_sandtable.sql` | Luật lớp bật / tắt game trận đánh và giới hạn phút (ver0.2 Sprint 7), gắn cửa học với trận đánh của lớp, Sa bàn 3D của trận kèm sa bàn khởi tạo cho 6 trận (Nháp) |
| `037_league_tiers.sql` | Giải đấu tuần cấu hình số hạng (HK.AD.054): nới ràng buộc hạng của người chơi và thành viên nhóm từ 0–3 lên 0–9, không đổi dữ liệu; tên hạng và ngày chốt nằm trong `hk_settings` |
| `038_poll_and_media.sql` | Loại câu "Bình chọn" (HK.GV.088), video và nhạc tải lên (HK.GV.092, HK.GV.093): nới ràng buộc CHECK của `hk_questions.qtype`, `hk_questions.video_url` và của `hk_media` (thêm mp4, webm, mp3, ogg; tối đa 8 MB, ảnh vẫn 1,5 MB); không tạo bảng, không đổi dữ liệu |

Kiểm chứng trên PostgreSQL tạm bằng `cd backend && npm run build && npm test` trước khi triển khai.

GitHub Actions cũng chạy bước kiểm tra file SQL và toàn bộ kiểm thử trên PostgreSQL 16 tạm; không dùng `DATABASE_URL` của Supabase. Job không coi các bài kiểm thử bị bỏ qua là đạt. Xem [CI và Check status](../../docs/GITHUB_ACTIONS.md).

## Kiểm tra build Render

Render dùng Node 22.21.0 và npm 10. Khi đổi dependency backend, tạo lockfile bằng
`npx --yes npm@10.9.4 install` rồi kiểm tra `npx --yes npm@10.9.4 ci`, `npm run build`,
`npm run migrate -- check`. Không đổi Build Command sang `npm install` để bỏ qua lỗi lockfile.
Lỗi `npm ci` báo thiếu `webpack@5.112.2` đã xuất hiện lại sau Sprint 8: lockfile do npm khác phiên bản
tạo ra thiếu optional peer mà npm 10 cần. Giữ entry này trong `backend/package-lock.json`.
Kiểm thử `migrations.spec.ts` có lượt nâng từ schema 24, xác minh tài khoản, điểm, vàng và nút cũ được giữ.

## Không gian quản lý riêng của trường (039)

`039_school_workspaces.sql` giữ dữ liệu cũ làm mẫu hệ thống và thêm chủ sở hữu trường cho kho lịch sử, bài học, danh mục game, mô phỏng, AI và nghiên cứu. Mẫu dùng chung chỉ đọc trong cổng trường. Cấu hình game/AI mặc định được kế thừa cho đến khi trường lưu thay đổi riêng. Khóa AI hệ thống không được sao chép vào cấu hình của trường.

Backend lấy phạm vi từ tài khoản đã xác thực qua `WorkspaceInterceptor` và `DatabaseService.withWorkspace`, chạy truy vấn bằng vai trò nội bộ `dong_a_workspace_scope`. Không nhận phạm vi từ `school_id` do trình duyệt gửi. RLS bảo vệ đọc/ghi; trigger kiểm tra FK ngăn liên kết sang dữ liệu của trường khác. Không cấp quyền cho `anon`, `authenticated` hoặc `PUBLIC`. Nếu không đổi được vai trò RLS, yêu cầu thất bại, không chạy lại bằng kết nối có toàn quyền.

Hành trình mặc định, chỉ mục AI, bộ nhớ đệm và dấu chốt tuần cũng tách theo trường. Tác vụ nền giữ phạm vi trường và không giữ lại kết nối giao dịch đã đóng. `backend/test/workspaces.spec.ts` kiểm tra API thật và PostgreSQL tạm với hai trường, gồm truy cập chéo ID, giả phạm vi, FK, yêu cầu đồng thời và RAG.

## Dọn bảng quản trị nội dung cũ (040)

Theo yêu cầu xóa phần quản trị ngoài chín mục còn giữ ngày 06/11/2026, `040_remove_legacy_admin_content.sql` xóa đúng sáu bảng của migration 011: `app_content_history`, `app_curriculum_nodes`, `app_question_bank`, `app_ai_sources`, `app_hero_cards`, `app_exp_rules`. Backend và frontend hiện tại không còn tham chiếu các bảng này. Dữ liệu trong sáu bảng cũ được xóa theo yêu cầu; không dùng `CASCADE` để tránh xóa lan.

Giữ nguyên `app_users`, các bảng trường/lớp, thông báo, audit/login, FAQ, bảo mật, hệ thống/hỗ trợ và các kho `hist_*`/`hk_*` đang phục vụ quản trị trường, giáo viên, học sinh. Không sửa hoặc xóa migration 011 đã áp dụng; không đụng `_prisma_migrations`. Kiểm thử nâng 039 → 040 xác nhận chỉ sáu bảng bị xóa và mọi dòng ở các bảng còn lại giữ nguyên.

## Chính sách gợi ý chỉ chạy nền (041)

`041_background_recommendation_policy.sql` ghi rõ hai bảng gợi ý là dữ liệu nội bộ và cập nhật liên kết hướng dẫn mẫu từ “Gợi ý học tập” sang “Kế hoạch học”. Không đặt lại chính sách toàn hệ thống, không xóa kết quả cũ và không sửa câu trả lời FAQ do quản trị đã biên tập. Cấu hình vẫn chỉ có một dòng `hk_reco_settings(id=1)`; không thêm cấu hình theo trường/học sinh. Xem [quy ước thuật toán](../../docs/THUAT_TOAN_GOI_Y.md).

## Mã đăng ký trường độc lập với danh mục (042)

`042_school_catalog_identity.sql` thêm khóa tham chiếu danh mục và sequence sinh mã trường tám chữ số. Giữ nguyên mã, tài khoản và dữ liệu hiện có; không nhập hàng loạt trường từ danh mục. Quyền sequence/function không mở cho PUBLIC. Chọn cùng một trường đồng thời được backend khóa giao dịch và chặn trùng bằng chỉ mục; mã gốc có chữ/dài hơn tám số không còn bị cắt để làm mã đăng nhập. Xem [danh mục trường](../../docs/DANH_MUC_TRUONG.md).

## Ảnh đại diện tải lên (046)

`046_avatar_upload.sql` chỉ nới ràng buộc CHECK của `app_users.avatar_url`: ngoài liên kết `https://` đã lưu trước đây, nhận thêm đường dẫn kho tệp `/api/content/media/<mã 32 ký tự>`. Không tạo bảng, không đổi dữ liệu. Ảnh đại diện nằm trong `hk_media` với tên riêng `avatar:user` (chỉ ảnh PNG/JPEG/WEBP/GIF tối đa 1,5 MB, backend xác định loại bằng nội dung thật), mỗi người một ảnh; ảnh này không tính vào hạn mức ảnh Quiz và không hiện trong thư viện của giáo viên. Hồ sơ không còn nhận liên kết dán tay.

Xem [tiến độ theo mã HK.*](../../docs/TIEN_DO_HAO_KHI.md).

- **043_school_catalog_logo_store.sql**: bảng danh mục và asset WebP bytea, SHA-256 duy nhất, kiểm tra định dạng/kích thước, RLS không có policy công khai.
- **044_national_school_catalog_seed.sql**: 11.371 gợi ý, 422 logo đã rà (4.153.024 byte ảnh), không tạo trường/người dùng; API tải từng ảnh. Xem docs/DANH_MUC_TRUONG.md.

- **045_phu_my_verified_address.sql**: địa chỉ và phường hiện hành của THCS Phú Mỹ theo website trường; chỉ dữ liệu tham chiếu.

- **047_verified_school_logos_and_mergers.sql**: 370 dòng tham chiếu thay đổi, 141 asset mới (gồm phiên bản ảnh rõ hơn); bộ hiện hành 460 logo WebP. Đối chiếu thêm sáp nhập/đổi tên có nguồn. Giữ bản ghi lịch sử, chỉ bỏ liên kết ảnh của mã đã sáp nhập hoặc chưa chắc đúng. Không tạo/gộp/xóa trường đăng ký, tài khoản hoặc dữ liệu học tập. SQL sinh dạng chênh lệch từ snapshot tham chiếu, không chép lại toàn bộ 044 và không sửa migration cũ.

- **048_remove_retired_school_references.sql**: theo yêu cầu xóa mục cũ sau sáp nhập, xóa đúng dòng danh mục tham chiếu có trường thay thế đã xác minh; 52 mã được bao phủ, 31 dòng còn tồn tại sau 047 được xóa. Không xóa trường đăng ký, người dùng, lớp, dữ liệu học hoặc ảnh. Tên/mã cũ là alias về trường hiện tại; các bộ dựng nguồn đã chặn nhập lại mã cũ từ Gist 2020.
