# Khung năm học và học kỳ

Từ 08/11/2026, form chỉ chọn năm học rồi xem hai thẻ học kỳ chỉ đọc; không còn bảng gợi ý, nút điền/xóa học kỳ hay các ô cấu hình ngày. Máy chủ lấy quy tắc đã xác minh từ hàm PostgreSQL `school_year_framework(label)` (migration 051). Danh sách chọn tăng theo năm hiện tại ở Việt Nam, có lịch từ 2020 và hai năm tiếp theo. Quyết định 2308 áp dụng từ 2026-2027 và các năm sau; đây là áp dụng văn bản đang hiệu lực, không phải tự thu thập hay tự phê duyệt văn bản mới từ Internet. Khi Bộ thay đổi khung, phải thêm migration chứa nguồn đã đối chiếu.

Mỗi dòng hiển thị **tuần thực học** và **hạn hoàn thành trước ngày**. Không lấy số ngày chia 7 để gọi là tuần thực học; không hiển thị “tuần 10/20”. Học kỳ 1 cần 18 tuần và học kỳ 2 cần 17 tuần; ngày nghỉ, tuần dự phòng và lịch dạy của từng địa phương không suy ra được chỉ từ các hạn quốc gia. Không tự lấy thứ Bảy làm ngày kết thúc rồi gọi là ngày của Bộ.

Nguồn được lưu theo năm:

| Năm bắt đầu | Quyết định | HK1 hoàn thành trước | HK2 hoàn thành trước | Nguồn |
| --- | --- | --- | --- | --- |
| 2020 | 2084/QĐ-BGDĐT | 16/01 | 25/05 | [Bản Bộ ký, website THCS Văn Yên](https://thcsvanyen.pgdhadong.edu.vn/uploads/thcsvanyen/laws/2084_qd-bgddt_448197.pdf) |
| 2021 | 2551/QĐ-BGDĐT | 16/01 | 25/05 | [Website giáo dục Hà Nội](https://mnquangtrung.hanoi.edu.vn/hoat-dong-chung/thong-bao-ve-thoi-gian-thuc-hien-chuong-trinh-giao-duc-nam-hoc-2021-2022/ctmb/5188/86192) |
| 2022 | 2159/QĐ-BGDĐT | 15/01 | 25/05 | [Cổng Đảng bộ Lâm Đồng](https://www.lamdong.dcs.vn/tin-tuc-su-kien/type/detail/id/33882/task/143) |
| 2023 | 2171/QĐ-BGDĐT | 15/01 | 25/05 | [Cổng thông tin Bình Phước, có bản Bộ ký đính kèm](https://binhphuoc.gov.vn/vi/news/tin-tuc-su-kien-421/khung-ke-hoach-thoi-gian-nam-hoc-2023-2024-33021.html) |
| 2024 | 2045/QĐ-BGDĐT | 18/01 | 31/05 | [Bản Bộ ký](https://storage-edu.vnpt.vn/edu-tnh/1668/thang8/quyet-dinh-2045-qd-bgddt-khung-ke-hoach-thoi-gian-nam-hoc-2024-2025.pdf) |
| 2025 | 2269/QĐ-BGDĐT | 18/01 | 31/05 | [Bản Bộ ký, website TH Khương Đình](https://quantrithanhxuan.hanoi.shieldixcloud.com/data/doc/2025/thkhuongdinh/2025_8/14/2269qdbgddtkhung-thoi-gian-nam-hoc-2025-2026_148202517.pdf) |
| Từ 2026 | 2308/QĐ-BGDĐT | 18/01 | 31/05 | [Văn bản trên cổng giáo dục TP.HCM](https://thnguyenviethongnhabe.hcm.edu.vn/van-ban/quyet-dinh-2308qd-bgddt-ban-hanh-khung-ke-hoach-thoi-gian-nam-hoc-doi-voi-giao/vbct/78613/1404297) |

Các năm đều khai giảng 05/09, kết thúc năm học trước 31/05 của năm sau. Cột HK2 2020–2023 khác hạn kết thúc năm học.

`calendar_mode=national` lưu khoảng phân loại dữ liệu nội bộ: từ khai giảng tới ngày ngay trước hạn HK1; khoảng HK2 từ hạn HK1 tới ngày ngay trước hạn HK2. Những khoảng này **không khẳng định ngày bắt đầu giảng dạy HK2 hay ngày nghỉ thực tế của địa phương**. UI chỉ trình bày mốc hạn đã công bố. `manual` giữ lịch riêng có sẵn; API cũ vẫn hỗ trợ lịch riêng và kiểm tra ràng buộc ngày/RLS.

Migration 051 điền các năm còn thiếu học kỳ có ngày bắt đầu/kết thúc đúng mẫu trước đây; sửa các bộ ngày trùng hoàn toàn với thuật toán gợi ý 050. Không đụng lịch riêng khác mẫu, ID, trường, lớp, trạng thái hoặc `ended_at`. Bao gồm năm đã kết thúc nếu chỉ bổ sung/đính chính khung tham chiếu; không mở lại năm hay dữ liệu lớp. Không tạo tenant/năm học mới hàng loạt.

Kiểm tra: PostgreSQL tạm kiểm tra mốc theo từng quyết định, năm kế tiếp, backfill và giữ lịch riêng; API kiểm tra chọn năm, bỏ qua ngày giả từ client khi dùng national, RLS và năm đã kết thúc. Giao diện kiểm tra máy tính/điện thoại: danh sách năm, không có ô gợi ý/ngày, nội dung 18/17 tuần và mốc “trước ngày”.
