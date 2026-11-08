# Kho dữ liệu đã xóa, giữ một năm

Migration 052 tạo `public.app_deleted_records` trong Supabase hiện có. Không tạo project/database thứ hai. Dữ liệu hard delete trước khi có kho không thể dựng lại; hội thoại AI xóa mềm còn bản gốc được nhập kho với ngày xóa cũ nếu chưa quá một năm.

## Kiểm tra trong Supabase

Mở Table Editor → public → app_deleted_records bằng tài khoản chủ dự án, hoặc SQL Editor:

```sql
SELECT id, operation_id, source_table, record_key, actor_name, actor_role,
       actor_school_id, school_id, route, delete_kind, deleted_at, expires_at,
       row_data, related_data
FROM public.app_deleted_records
WHERE expires_at > now()
ORDER BY deleted_at DESC, id DESC
LIMIT 100;
```

`operation_id` nhóm mọi dòng của cùng yêu cầu, kể cả xóa dây chuyền. `record_key` là khóa chính/khóa ghép, `row_data` là dữ liệu trước xóa, `related_data` chứa tin nhắn/báo cáo khi ẩn hội thoại AI. JSONB dùng TOAST cho dữ liệu lớn. Một số bảng con không có school_id: tra cùng operation_id với trường/tài khoản gốc. actor_school_id là trường của người thao tác, không phải lúc nào cũng là trường đích.

Kho chỉ phục vụ kiểm tra; chưa có chức năng khôi phục trên website. Không dựng nút khôi phục từ JSON mà bỏ kiểm tra quan hệ, mã trùng và quyền.

## Cách lưu và quyền

`DeletionArchiveInterceptor` gắn ngữ cảnh từ AuthGuard cho các yêu cầu ghi của cả bốn vai trò; DatabaseService đặt ngữ cảnh theo giao dịch. Không lấy actor/trường từ body/query. Trigger BEFORE DELETE của các bảng nghiệp vụ app_*, hk_*, hist_* ghi OLD vào kho; CASCADE cũng được lưu, cùng giao dịch. Gồm DELETE, POST xóa thông báo, dòng liên kết bị gỡ khi sửa danh sách. Ghi kho lỗi thì xóa hoàn tác. Các quyền/RLS xóa gốc vẫn có hiệu lực. Yêu cầu bị từ chối hoặc không xóa dòng nào không sinh bản lưu.

RLS kho bật, không có policy cho người dùng. Thu hồi quyền bảng/hàm trực tiếp của PUBLIC, anon, authenticated, service_role và hai vai trò RLS trường/workspace. Trigger dùng SECURITY DEFINER có search_path cố định, chỉ ghi OLD; các vai trò ứng dụng không gọi được hàm cài trigger/purge. Không có API đọc kho, kể cả cổng admin; chủ dự án kiểm tra qua Supabase.

Không lưu bảng phiên/token, mã reset/signup/OTP, 2FA, email outbox chứa mật khẩu, cache chỉ mục AI/gợi ý, heartbeat và lịch sử migration. Redaction loại khóa password/hash/secret/API key/OTP/token đăng nhập, kể cả JSON lồng nhau. hk_media.token là mã nhận diện tệp nên được giữ. hk_backups chỉ lưu metadata, bỏ binary gzip có thể chứa credential và tạo bản sao kéo dài hạn giữ. Các phần bị loại không thể khôi phục từ kho.

Kho không có FK về tài khoản/trường, vì vậy không mất theo nguồn. Metadata lưu mẫu route, không lưu URL thật có mã tệp, token, request body hay query.

## Tự hết hạn

expires_at = deleted_at + interval '1 year' (một năm lịch, không cố định 365 ngày). Xem kho không gia hạn. Job `dong-a-deleted-records-retention` chạy phút 17 mỗi giờ bằng [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart), gọi `public.app_purge_deleted_records()`, độc lập Render Free. Backend dự phòng dọn lúc khởi động và mỗi giờ. Health trả deletion_archive.database_schedule để xác nhận lịch thật sự được bật; false nghĩa là chỉ có dự phòng backend và cần kiểm tra quyền/extension.

Purge chỉ xóa bản lưu hết hạn và bản gốc hội thoại AI đã ẩn đủ một năm; không tạo kho mới cho dữ liệu hết hạn. Dọn ở lượt kế tiếp, thường trong một giờ sau hạn; SQL kiểm tra ở trên loại bản hết hạn ngay. Nhật ký nghiệp vụ có chính sách riêng.

BackupService bỏ app_deleted_records khỏi backup/restore ứng dụng để không nhân bản kho hoặc đưa lại dữ liệu hết hạn. Sao lưu/PITR bên ngoài ứng dụng, của Supabase hay file người quản lý tải về, có chính sách riêng; chức năng này quản lý kho và bản gốc AI ẩn trong database đang chạy.

## Phát triển

Bảng nghiệp vụ mới phải gọi `SELECT public.app_install_delete_archives()` trong migration mới; không sửa 052 đã áp dụng. Kiểm thử đối chiếu mọi bảng và chạy HTTP/PostgreSQL tạm: bốn vai trò, CASCADE, khóa ghép, xóa mềm, RLS/ACL, redaction, rollback, ngữ cảnh đồng thời, hết hạn và loại khỏi backup. Không thử xóa tài khoản thật trên production.
