# Chính sách gợi ý nội bộ chung

Theo yêu cầu ngày 06/11/2026, thuật toán chỉ tính nền. Admin không có tab cấu hình, nút lưu hoặc nút tính lại. Học sinh không có thẻ “Hôm nay nên học gì?”, nút làm mới hoặc đánh giá gợi ý. API hiển thị, cấu hình, phản hồi và tính lại thủ công đã được gỡ (404).

## Một bộ quy tắc cho toàn hệ thống

Nguồn cấu hình nội bộ duy nhất là `hk_reco_settings`, dòng `id=1` (khóa kiểm tra của database không cho có dòng khác). Không có tham số theo học sinh hoặc trường. Một lượt nền đọc chính sách chung một lần và dùng cùng các giá trị đó cho mọi lô.

Các giá trị khởi tạo chung từ migration 031:

| Quy tắc | Giá trị |
| --- | --- |
| Trọng số điểm yếu / thời gian / độ khó | 3 / 1 / 1 |
| Ngưỡng chủ đề yếu | Dưới 60% đúng |
| Số câu tối thiểu để phân loại chủ đề | 3 |
| Tuổi kết quả cần tính lại | 6 giờ |
| Số kết quả tối đa, tối đa hai kết quả cùng loại | 3 |
| Số câu của lượt luyện tập theo chủ đề | 8 |
| Hệ số giảm điểm từ phản hồi lịch sử chưa hữu ích | 0,5 |

Migration 041 giữ nguyên chính sách chung đã lưu, không đặt lại giá trị mà quản trị từng cấu hình. Từ nay, thay đổi chính sách/dữ liệu tham chiếu cần migration SQL mới; không có API chỉnh từ trình duyệt.

Máy chủ chấm các ứng viên học tiếp, ôn tập, chủ đề yếu, bài tập gần hạn và duy trì chuỗi theo cùng công thức/trọng số trong `backend/src/analytics/reco.service.ts`. Lưu kết quả riêng theo `user_id` chỉ để gắn đúng dữ liệu đầu vào và giữ phạm vi trường; đây không phải bộ tham số riêng cho từng người. Các phản hồi cũ được giữ làm dữ liệu lịch sử, không nhận đánh giá mới qua giao diện.

## Lịch chạy

- Sau khi backend và database sẵn sàng: lên lịch chạy sau 10 giây; sau đó kiểm tra mỗi giờ.
- Chỉ xử lý tài khoản học sinh đang hoạt động, chưa xóa, có sự kiện trong 14 ngày và kết quả đã quá hạn hoặc chưa có.
- Mỗi lô tối đa 200 người trong job hiện tại. Phân trang theo ID cho đến hết người đủ điều kiện, không dừng sau lô đầu; lỗi của một người không chặn lô tiếp theo.
- Mỗi người chạy trong `withWorkspace` với RLS theo trường. Kết quả giữ trong database tối đa 30 ngày; không đẩy lên giao diện.
- Máy chủ dừng/ngủ thì lịch tạm dừng; khi khởi động lại sẽ lên lịch tính nền trở lại. `ANALYTICS_JOB=off` dùng để tắt lịch trong kiểm thử.

Các màn điểm mạnh/yếu, luyện tập và kế hoạch ôn tập vẫn hoạt động qua mục **Kế hoạch học**. Những màn này không tải hay tự sinh thẻ gợi ý.

Kiểm thử: `analytics.spec.ts` kiểm tra API đã gỡ, một chính sách chung, kết quả tính nền, tuổi dữ liệu và nhiều lô; `analytics-job.spec.ts` kiểm tra tự lên lịch và dừng lịch; `migrations.spec.ts` kiểm tra 041 giữ chính sách hiện có và không ghi đè FAQ quản trị tự sửa.
