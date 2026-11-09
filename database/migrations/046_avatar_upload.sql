-- HK: ảnh đại diện tải lên thay cho liên kết https tự dán (hồ sơ cá nhân của học sinh, giáo viên, quản trị viên trường, quản trị tổng).
--  - Ảnh đại diện lưu trong kho tải lên hk_media (chỉ ảnh PNG, JPEG, WEBP, GIF, tối đa 1,5 MB; backend xác định loại bằng nội dung thật) với tên riêng 'avatar:user',
--    nên không tính vào hạn mức ảnh Quiz và không hiện trong thư viện của giáo viên. app_users.avatar_url giữ đường dẫn /api/content/media/<mã 32 ký tự>.
-- Không tạo bảng mới và không đổi dữ liệu hiện có: chỉ nới ràng buộc CHECK của app_users.avatar_url (liên kết https đã lưu trước đây vẫn hợp lệ).

DO $mig$
DECLARE c RECORD;
BEGIN
    FOR c IN SELECT con.conname FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace n ON n.oid = rel.relnamespace
             WHERE n.nspname = 'public' AND rel.relname = 'app_users' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%avatar_url%'
    LOOP
        EXECUTE format('ALTER TABLE public.app_users DROP CONSTRAINT %I', c.conname);
    END LOOP;
END
$mig$;
ALTER TABLE public.app_users ADD CONSTRAINT app_users_avatar_url_check
    CHECK (avatar_url IS NULL OR ((avatar_url ~ '^https://' OR avatar_url ~ '^/api/content/media/[0-9a-f]{32}$') AND length(avatar_url) <= 500));
