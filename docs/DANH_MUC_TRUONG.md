# Danh mục trường, mã nội bộ và nguồn nhận diện

## Phạm vi

Danh mục là gợi ý để chọn trường, không phải lệnh tạo sẵn hàng nghìn trường hoặc tài khoản. Chỉ khi quản lý tổng bấm Tạo trường, backend mới lưu trường và quản trị viên trường đầu tiên trong cùng giao dịch. Trường đã tạo và tài khoản đó xuất hiện trong Trường học/Người dùng; form tạo thêm quản trị viên tìm trực tiếp từ API có phân trang, không giới hạn ở 200 trường tải ban đầu.

Nguồn gốc: [danh sách THCS ngày 06/10/2020](https://gist.github.com/ngoan98tv/b9111580b75562b45185f90d00e5b1ff), 11.391 dòng. Bản danh mục trước đây chỉ giữ mã số tối đa 8 ký tự. `school-directory-extra.json` bổ sung 242 bản ghi có mã chữ hoặc mã dài; mã nguồn được giữ làm khóa tham chiếu. `TEST01` được ghi nhận trong báo cáo loại trừ vì là bản ghi thử nghiệm. Danh mục không coi dữ liệu 2020 là danh sách đã xác minh toàn bộ cho năm 2026.

`school-confirmed-2026.json` lưu các thay đổi có nguồn xác nhận và tên cũ để tìm lại. Ví dụ [công bố của Hải Phòng](https://haiphong.gov.vn/tin-tuc-su-kien/phuong-bach-dang-cong-bo-cac-quyet-dinh-sap-xep-co-so-giao-duc-to-chuc-dang-va-cong-tac-can-bo-s-950874): Minh Tân/Trần Nhật Duật → THCS Bạch Đằng, Minh Đức/Ngũ Lão → THCS Trần Quốc Bảo, phường Bạch Đằng. Không suy đoán sáp nhập chỉ vì trùng tên. Không gộp/xóa dữ liệu hoặc tài khoản các trường đã đăng ký khi cập nhật danh mục.

## Mã trường

Migration **042** thêm `app_schools.directory_code` và bộ sinh mã tám chữ số. Mã đăng ký Đông A tăng bằng sequence ở PostgreSQL; mã tham chiếu Bộ/người cung cấp dữ liệu được lưu riêng. Hai quản trị tạo đồng thời vẫn có mã khác nhau; cùng chọn một trường được bảo vệ bằng khóa giao dịch và chỉ mục duy nhất. Sequence có thể để lại khoảng trống khi giao dịch thất bại và không cấp lại các mã đã dùng.

Giao diện mới không gửi `school_code`; máy chủ sinh mã khi lưu. API cũ còn hỗ trợ mã được gửi rõ để giữ tương thích; không đổi mã/đường dẫn của trường đã có. Nếu chọn từ danh mục, máy chủ tự tra lại tên, tỉnh/thành, khu vực và địa chỉ đã đối chiếu; không tin tên/địa bàn bị sửa trong request. Trường tự nhập vẫn được sinh mã và có thể bổ sung địa chỉ thủ công.

Form đã bỏ các ô Người liên hệ/Email liên hệ/Điện thoại liên hệ. Thông tin của **Quản trị viên trường đầu tiên** được tách thành một nhóm họ tên/email/điện thoại. Các cột dữ liệu liên hệ cũ được giữ nguyên, không có migration xóa thông tin người dùng.

## Tìm nhanh

Tìm có dấu/không dấu, mã tham chiếu, địa bàn, tên cũ và chữ viết tắt. `T,S` hoặc `TS` tìm theo chữ đầu tên riêng, không khớp mọi trường chỉ vì đều có tiền tố THCS. Một ký tự cũng có gợi ý. Kết quả nằm trong danh sách cuộn, trả tối đa 30 mục mỗi lần; có thể gõ thêm để thu hẹp.

## Logo và địa chỉ

`scripts/refresh-school-metadata.py` đọc cổng Sở, các đường dẫn danh bạ công khai được cổng dẫn tới, rồi trang trường. Logo phải được chính trang trường khai báo; ảnh quá nhỏ, quá dài giống biểu ngữ hoặc biểu tượng dùng chung được loại. Trường trùng tên cần mã hoặc địa bàn phân biệt. Không lấy logo từ kết quả tìm kiếm ảnh và không tạo logo giả.

`backend/src/admin/school-metadata.json` lưu website, địa chỉ đối chiếu được, nguồn và ngày kiểm tra. `scripts/school-logos.json` lưu nguồn từng ảnh WebP. Không tự dựng số nhà/đường hoặc đổi tên trường khi chưa có chứng cứ. Trường thiếu ảnh giữ khung trung tính; địa chỉ thiếu có thể bổ sung khi tạo hoặc sửa.

Chạy cập nhật (Python, BeautifulSoup, Pillow):

```powershell
python -X utf8 scripts/refresh-school-metadata.py --cache ../../downloads/school-research/cache --all-provinces --workers 12
```

Mỗi tên miền có tối đa hai yêu cầu cùng lúc. HTML/ảnh gốc lưu ngoài Git; `coverage.json` liệt kê nguồn không truy cập được, tên trùng hoặc chưa ghép được. Một website không công bố logo hoặc không mở được không được tính là đã có logo. Lần chạy lại cùng đợt có thể dùng `--cached-portals` để tái sử dụng các cổng đã tải.

## L?u trong Supabase v? t?i t?ng logo

Migration **043** t?o `app_school_directory` v? `app_school_logo_assets`; **044** nh?p d? li?u tham chi?u c?ng ?nh WebP ?? n?n v?o PostgreSQL/Supabase. Kh?ng c?n bucket ho?c kh?a Storage ph?a tr?nh duy?t. ?nh t?i ?a 160 ? 160 px, d??i 80 KB/?nh; `bytea` l?u nguy?n WebP, kh?ng n?n ZIP th?m v? tr?nh duy?t c?n ??c tr?c ti?p ?nh.

Asset c? kh?a SHA-256 v? ki?m tra checksum trong PostgreSQL. Hai tr??ng ???c x?c minh d?ng c?ng m?t logo c? th? tham chi?u m?t asset; kh?ng t? g?n cho tr??ng kh?c ch? v? ?nh gi?ng nhau. B?ng b?t RLS, kh?ng c? policy c?ng khai; backend tr? ri?ng `GET /api/school-logos/<sha256>.webp`, k?m `image/webp`, `nosniff`, ETag v? cache immutable m?t n?m. Danh s?ch g?i ? ch? tr? URL, kh?ng t?i h?ng tr?m ?nh/base64 trong JSON. Giao di?n ch? t?i c?c logo ?ang hi?n th?.

L?n ??i chi?u **07/11/2026** ?? th? 3.085 website: gh?p ???c 1.727 website v?i tr??ng, 420 tr??ng h?p c?n tr?ng t?n, 394 ch?a gh?p, 544 kh?ng truy c?p ???c. Metadata g?m 1.732 tr??ng (gi? c? ngu?n ?? ??i chi?u tr??c), trong ?? 1.373 ??a ch?. ?? xem b?ng ?nh 518 ?ng vi?n, lo?i 96 ?nh kh?ng ph? h?p ho?c g?n ch?a ch?c ch?n; gi? **422 logo**, t?ng **4.153.024 byte**, t?t c? hi?n c? n?i dung SHA-256 kh?c nhau. C?c s? n?y l? ?? ph? ?? x?c minh, kh?ng ph?i kh?ng ??nh ?? logo/??a ch? c?a c? 11.371 tr??ng hay ?? m?i v? s?p nh?p n?m 2026. Danh s?ch lo?i ?nh v? ngu?n: `scripts/school-logo-review.json`. Website kh?ng c?ng b? ?nh ri?ng gi? ? trung t?nh.

T?o migration tham chi?u l?n sau, sau khi duy?t ?nh (ch?n s? SQL m?i, script t? ch?i ghi ??):

```powershell
npm --prefix backend run build
python -X utf8 scripts/build-school-catalog-seed.py 0XX_school_catalog_update.sql
```

Script sinh SQL l? ngu?n seed. Kh?ng ch?nh Supabase Dashboard ri?ng, kh?ng s?a file 044 ?? ph?t h?nh. C?c tr??ng s?p nh?p ch? c?p nh?t khi c? quy?t ??nh ho?c ngu?n ch?nh th?c, gi? t?n/m? c? ?? t?m l?i. T?nh/th?nh ?? quy ??i theo 34 ??n v?; v?ng/huy?n ? ngu?n c? ???c gi? n?u ch?a x?c minh ph??ng/x? m?i, kh?ng t? suy ra ??a ch? n?m 2026.
