# Danh mục trường, mã nội bộ và nguồn nhận diện

## Phạm vi

Danh mục là gợi ý để chọn trường, không phải lệnh tạo sẵn hàng nghìn trường hoặc tài khoản. Chỉ khi quản lý tổng bấm Tạo trường, backend mới lưu trường và quản trị viên trường đầu tiên trong cùng giao dịch. Trường đã tạo và tài khoản đó xuất hiện trong Trường học/Người dùng; form tạo thêm quản trị viên tìm trực tiếp từ API có phân trang, không giới hạn ở 200 trường tải ban đầu.

Nguồn gốc: [danh sách THCS ngày 06/10/2020](https://gist.github.com/ngoan98tv/b9111580b75562b45185f90d00e5b1ff), 11.391 dòng. Bản danh mục trước đây chỉ giữ mã số tối đa 8 ký tự. `school-directory-extra.json` bổ sung 242 bản ghi có mã chữ hoặc mã dài; mã nguồn được giữ làm khóa tham chiếu. `TEST01` được ghi nhận trong báo cáo loại trừ vì là bản ghi thử nghiệm. Danh mục không coi dữ liệu 2020 là danh sách đã xác minh toàn bộ cho năm 2026.

`school-confirmed-2026.json` lưu các thay đổi có nguồn xác nhận và tên cũ để tìm lại. Ví dụ [công bố của Hải Phòng](https://haiphong.gov.vn/tin-tuc-su-kien/phuong-bach-dang-cong-bo-cac-quyet-dinh-sap-xep-co-so-giao-duc-to-chuc-dang-va-cong-tac-can-bo-s-950874): Minh Tân/Trần Nhật Duật → THCS Bạch Đằng, Minh Đức/Ngũ Lão → THCS Trần Quốc Bảo, phường Bạch Đằng. Không suy đoán sáp nhập chỉ vì trùng tên. Không gộp/xóa dữ liệu hoặc tài khoản các trường đã đăng ký khi cập nhật danh mục.

## Mã trường

Migration **042** thêm `app_schools.directory_code` và bộ sinh mã tám chữ số. Mã đăng ký Đông A tăng bằng sequence ở PostgreSQL; mã tham chiếu Bộ/người cung cấp dữ liệu được lưu riêng. Hai quản trị tạo đồng thời vẫn có mã khác nhau; cùng chọn một trường được bảo vệ bằng khóa giao dịch và chỉ mục duy nhất. Sequence có thể để lại khoảng trống khi giao dịch thất bại và không cấp lại các mã đã dùng.

Giao diện mới không gửi `school_code`; máy chủ sinh mã khi lưu. API cũ còn hỗ trợ mã được gửi rõ để giữ tương thích; không đổi mã/đường dẫn của trường đã có. Nếu chọn từ danh mục, máy chủ tự tra lại tên, tỉnh/thành, khu vực và địa chỉ đã đối chiếu; không tin tên/địa bàn bị sửa trong request. Trường tự nhập vẫn được sinh mã và có thể bổ sung địa chỉ thủ công.

Form đã bỏ các ô Người liên hệ/Email liên hệ/Điện thoại liên hệ. Thông tin của **Quản trị viên trường đầu tiên** được tách thành một nhóm họ tên/email/điện thoại. Các cột dữ liệu liên hệ cũ được giữ nguyên, không có migration xóa thông tin người dùng.

Trường đã tạo bằng mã ngắn như `0001` có thể chọn **Sửa → tên trường trong danh mục → Lưu** để liên kết nhận diện chính thức. Backend giữ nguyên ID, mã trường, tài khoản; đường dẫn cũ vẫn dùng được. Không tự đoán trường khi có nhiều trường cùng tên: Phú Mỹ tại Bình Thạnh, Thủ Dầu Một và Tân Thành là những đơn vị khác nhau. Danh mục đã liên kết không được gán cho hai trường đăng ký khác nhau.

## Tìm nhanh

Trong **Người dùng → Tạo tài khoản quản trị**, họ tên và email có danh sách cuộn từ các quản trị viên trường đã lưu. Bấm ô hoặc mũi tên để mở, gõ để tìm, bấm **Xem thêm người** để tải tiếp; mỗi mục hiện tên, email và trường để phân biệt người trùng tên. Chọn trường trước thì danh sách người chỉ thuộc trường đó. Chọn họ tên hoặc email tự điền cả họ tên, email, số điện thoại và trường theo ID, không phụ thuộc trang kết quả hiện tại.

Quản trị viên trường đầu tiên được tạo cùng trường đã nằm trong danh sách này ngay khi mở form; không cần tạo lại tài khoản. Chọn người đã có chuyển nút chính thành **Mở hồ sơ tài khoản**; nút **Nhập người mới** xóa lựa chọn để cấp thêm người. Trường có danh sách phân trang riêng từ các trường đã đăng ký, không lấy từ danh mục gợi ý chưa tạo. Tra cứu luôn gọi API quản trị có xác thực, không lưu họ tên/email vào localStorage. Không thêm bảng hay migration cho hành vi này.

Tìm có dấu/không dấu, mã tham chiếu, địa bàn, tên cũ và chữ viết tắt. `T,S` hoặc `TS` tìm theo chữ đầu tên riêng, không khớp mọi trường chỉ vì đều có tiền tố THCS. Một ký tự cũng có gợi ý. Kết quả nằm trong danh sách cuộn, trả tối đa 30 mục mỗi lần; có thể gõ thêm để thu hẹp.

## Logo và địa chỉ

`scripts/refresh-school-metadata.py` đọc cổng Sở, các đường dẫn danh bạ công khai được cổng dẫn tới, rồi trang trường. Logo phải được chính trang trường khai báo; ảnh quá nhỏ, quá dài giống biểu ngữ hoặc biểu tượng dùng chung được loại. Trường trùng tên cần mã hoặc địa bàn phân biệt. Không lấy logo từ kết quả tìm kiếm ảnh và không tạo logo giả.

`backend/src/admin/school-metadata.json` lưu website, địa chỉ đối chiếu được, nguồn và ngày kiểm tra. `scripts/school-logos.json` lưu nguồn từng ảnh WebP. Không tự dựng số nhà/đường hoặc đổi tên trường khi chưa có chứng cứ. Trường thiếu ảnh giữ khung trung tính; địa chỉ thiếu có thể bổ sung khi tạo hoặc sửa.

Chạy cập nhật (Python, BeautifulSoup, Pillow):

```powershell
python -X utf8 scripts/refresh-school-metadata.py --cache ../../downloads/school-research/cache --all-provinces --workers 12
```

Mỗi tên miền có tối đa hai yêu cầu cùng lúc. HTML/ảnh gốc lưu ngoài Git; `coverage.json` liệt kê nguồn không truy cập được, tên trùng hoặc chưa ghép được. Một website không công bố logo hoặc không mở được không được tính là đã có logo. Lần chạy lại cùng đợt có thể dùng `--cached-portals` để tái sử dụng các cổng đã tải.

## Lưu trong Supabase và tải từng logo

Migration **043** tạo app_school_directory và app_school_logo_assets; **044** nhập danh mục cùng WebP đã nén. Ảnh tối đa 160 × 160 px, dưới 80 KB/ảnh, lưu bytea trong PostgreSQL/Supabase; không cần khóa Storage trên trình duyệt. Không nén ZIP thêm vì WebP đã nén và trình duyệt cần đọc trực tiếp.

Asset có khóa SHA-256 duy nhất và kiểm tra checksum trong PostgreSQL. Hai trường được xác minh dùng cùng logo có thể tham chiếu một asset; không gán chéo chỉ vì ảnh giống. Bảng bật RLS, không có policy công khai. Backend trả riêng GET /api/school-logos/<sha256>.webp, image/webp, nosniff, ETag và cache immutable một năm. Gợi ý chỉ trả URL; giao diện tải ảnh đang hiển thị, không nhận hàng trăm ảnh base64 trong JSON. PUBLIC_API_URL có thể đặt địa chỉ HTTPS backend; mặc định dùng RENDER_EXTERNAL_URL trên Render.

Đối chiếu **07/11/2026**: đã thử 3.085 website, ghép được 1.727, 420 còn trùng tên, 394 chưa ghép, 544 không truy cập được. Metadata 1.732 trường (kể cả nguồn trước), 1.374 địa chỉ. Đã xem 518 ảnh, loại 96 ảnh không phù hợp hoặc chưa chắc gán đúng; giữ **422 logo**, **4.153.024 byte**, hiện có SHA-256 khác nhau. Đây là độ phủ xác minh, chưa đủ ảnh/địa chỉ toàn bộ 11.371 trường hay mọi vụ sáp nhập 2026. Danh sách loại: scripts/school-logo-review.json.

Sau khi duyệt ảnh, tạo migration số mới (script từ chối ghi đè):

```powershell
npm --prefix backend run build
python -X utf8 scripts/build-school-catalog-seed.py 0XX_school_catalog_update.sql
```

SQL là nguồn seed; không sửa file 044 đã phát hành hoặc chỉnh Supabase riêng. Tỉnh/thành được quy đổi 34 đơn vị; vùng/huyện nguồn cũ giữ nguyên nếu chưa xác minh phường/xã mới, không tự suy ra địa chỉ 2026.

Migration **045** xác minh địa chỉ THCS Phú Mỹ từ footer website trường: 120B Ngô Tất Tố, phường Thạnh Mỹ Tây, TP.HCM. Tìm theo khu vực cũ Bình Thạnh vẫn trỏ đúng mã 79765507.

## Rà soát tiếp ngày 07/11/2026

- Bỏ câu hướng dẫn tìm kiếm mà người dùng yêu cầu; không bỏ khả năng tìm nhanh.
- Đối chiếu thêm tên cũ/tên mới từ thông báo chính quyền hoặc chính website trường. `school-confirmed-2026.json` có nguồn cho từng quan hệ; mã bắt đầu `hn-`, `tn-`, `ht-`, `kh-` là khóa tham chiếu nội bộ khi chưa có mã ngành mới, không phải mã Bộ tự suy đoán. Ngày không được nguồn ghi rõ được để trống, không tự đặt ngày sáp nhập.
- Thêm kiểm tra trường đã đăng ký bằng `directory_code` cũ: mã cũ và mã mới cùng được xem là đã có. Không tạo trùng trường/tài khoản và không tự gộp dữ liệu của các trường đã đăng ký.
- Nguồn tìm kiếm chỉ để khám phá URL. Tên miền hạ tầng Sở ràng buộc lại tỉnh/thành; không lấy tỉnh của truy vấn tìm kiếm để gán một trường trùng tên ở nơi khác. Các tên mới chưa đủ chứng cứ nối với mã cũ được giữ trong danh sách chờ đối chiếu.
- Bộ đọc theo cả liên kết/option/ô website của danh bạ và trang chi tiết công khai mà JavaScript của chính cổng dẫn tới. Không đoán API riêng tư. `http://#` là ô chưa có website, không phải một trường đã được kiểm tra.
- Ưu tiên ảnh cấu hình và favicon riêng của trường, bỏ ảnh bài tin/thông báo, ảnh tập thể và biểu tượng ngành dùng chung. Vẫn phải xem bảng ảnh và đối chiếu chữ/địa bàn trước khi đưa vào danh mục. Logo giống nhau chỉ được dùng chung khi cùng nhận diện đã xác minh; SHA-256 khử trùng bytes, không chứng minh hai trường là một.
- `currentSchoolLogo` làm mới URL ảnh tham chiếu trong response danh sách/chi tiết/trang đăng nhập theo danh mục đã duyệt; không ghi đè URL logo riêng của trường, không sửa ID/mã đăng nhập/đường dẫn hay tài khoản. Checksum trong metadata phải khớp asset của migration; bytes vẫn tải từng ảnh từ PostgreSQL.

Rà trong vùng staging trước khi phát hành:

```powershell
python -X utf8 scripts/refresh-school-metadata.py --cache ../../downloads/school-research/cache --input-sites ../../downloads/school-research/websites.json --output ../../downloads/school-review --neighbor-rounds 1 --workers 12
python -X utf8 scripts/test-school-logo-tools.py
```

`--skip-unavailable` chỉ tái sử dụng các URL lỗi ở báo cáo ngay trước đó khi rà lại cùng đợt; lần nghiên cứu mới không dùng tùy chọn này. `--only-codes` dùng rà lại ảnh đã bị loại hoặc nguồn logo mới của các mã cụ thể. Thư mục staging và HTML ngoài Git; không tự phát hành ảnh vừa tải mà chưa duyệt.

Kết quả vòng tiếp: đã đi 740 trang nguồn/danh bạ công khai và 3.399 website trường; vòng đầy đủ có 1.510 khớp, 326 cần đối chiếu tên hiện tại, 11 trang lịch sử, 537 chưa khớp, 445 còn trùng tên, 570 không truy cập được. Sau đó rà riêng 321 website có ảnh cấu hình; xem thêm 184 ảnh và loại 39 ảnh không phù hợp. Bộ hiện hành **460 trường có logo**, **4.299.330 byte**, gồm **80 trường mới có logo**; đã rút 42 liên kết cũ chưa chắc đúng hoặc thuộc mã trước sáp nhập. **45 trường** nằm trong danh sách chờ đối chiếu nhận diện, không hiển thị logo đang nghi ngờ. Số ảnh khác với số trường trong danh mục: **11.349 gợi ý hiện hành** sau khi nối thêm 31 mã cũ vào các trường hiện tại. Danh mục xác nhận có 19 hồ sơ (17 hồ sơ sáp nhập/đổi tên, Phú Mỹ và Lam Sơn quận 6 đối chiếu địa chỉ/website). Chưa xác nhận logo/địa chỉ/sáp nhập cho toàn bộ Gist.

Migration **047** chỉ thêm 141 asset chưa từng lưu và cập nhật 370 dòng tham chiếu. `app_school_directory` vẫn giữ bản ghi lịch sử nên số dòng SQL có thể lớn hơn số gợi ý đang hiện. Bytes ảnh cũ giữ nguyên cho lịch sử; không xóa ảnh hay URL tùy chỉnh do trường cung cấp. Metadata hiện có 1.805 hồ sơ, trong đó 1.760 được dùng để bổ sung danh mục.

## Xóa mục cũ đã sáp nhập (048, 07/11/2026)

Theo yêu cầu tiếp theo của người dùng, migration **048** xóa các dòng cũ trong `app_school_directory` khi trường thay thế đã có trong bảng. Danh sách cố định gồm 52 mã cũ đã xác minh; 31 mục trong số này còn tồn tại sau migration 047, các mã còn lại đã không được seed từ trước. Danh mục hiện hành vẫn có 11.349 trường. Không xóa theo tên gần giống hoặc trường chỉ đang chờ xác minh.

Nguồn JSON được dọn thêm 34 dòng cũ, giữ riêng quan hệ `merged`/`previous_codes` và tên cũ làm từ khóa tìm trường hiện tại. Mã cũ không còn là một mục chọn riêng. Bộ dựng danh mục và phần bổ sung loại các mã đã xác nhận trước khi ghi; chạy lại từ Gist 2020 không đưa các mục này trở lại. Seed generator tiếp theo cũng xóa đúng các mục tham chiếu cũ sau khi trường thay thế có mặt.

Không sửa migration 044/047 đã phát hành. `app_schools`, `app_users`, lớp, kết quả học tập và bytes ảnh lịch sử được giữ; trường đã đăng ký bằng mã tham chiếu cũ vẫn truy ra trường hiện tại và không bị tạo trùng. Kiểm thử nâng 047 → 048 chụp và so sánh toàn bộ dòng fixture trường/người dùng, kiểm tra trường trùng tên khác địa bàn vẫn còn và chạy lại migration không có thay đổi.
