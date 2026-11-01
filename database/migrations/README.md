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

Kiểm chứng trên PostgreSQL tạm bằng `cd backend && npm run build && npm test` trước khi triển khai.

GitHub Actions cũng chạy bước kiểm tra file SQL và toàn bộ kiểm thử trên PostgreSQL 16 tạm; không dùng `DATABASE_URL` của Supabase. Job không coi các bài kiểm thử bị bỏ qua là đạt. Xem [CI và Check status](../../docs/GITHUB_ACTIONS.md).

## Kiểm tra build Render

Render dùng Node 22.21.0 và npm 10. Khi đổi dependency backend, tạo lockfile bằng
`npx --yes npm@10.9.4 install` rồi kiểm tra `npx --yes npm@10.9.4 ci`, `npm run build`,
`npm run migrate -- check`. Không đổi Build Command sang `npm install` để bỏ qua lỗi lockfile.
Lỗi `npm ci` báo thiếu `webpack@5.112.2` đã xuất hiện lại sau Sprint 8: lockfile do npm khác phiên bản
tạo ra thiếu optional peer mà npm 10 cần. Giữ entry này trong `backend/package-lock.json`.
Kiểm thử `migrations.spec.ts` có lượt nâng từ schema 24, xác minh tài khoản, điểm, vàng và nút cũ được giữ.

Xem [tiến độ theo mã HK.*](../../docs/TIEN_DO_HAO_KHI.md).
