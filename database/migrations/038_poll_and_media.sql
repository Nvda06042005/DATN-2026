-- HK ver0.2 Sprint 8 (hoàn thiện): loại câu "Bình chọn" không có đáp án đúng (HK.GV.088), video tải lên cho câu hỏi (HK.GV.092) và tệp nhạc chờ tải lên (HK.GV.093).
--  - Câu bình chọn lưu trong ngân hàng câu hỏi như mọi câu khác (qtype = 'poll', data = {options}); chỉ phòng thi trực tiếp dùng, các luồng chấm điểm bỏ qua.
--  - Kho tải lên hk_media nhận thêm video (mp4, webm) và âm thanh (mp3, ogg); ảnh vẫn tối đa 1,5 MB, video và nhạc tối đa 8 MB mỗi tệp.
--    Hạn mức theo từng giáo viên do backend kiểm tra. Tệp nằm trong cơ sở dữ liệu (như ảnh) nên chỉ có trong sao lưu của Supabase.
-- Không tạo bảng mới và không đổi dữ liệu hiện có: chỉ nới các ràng buộc CHECK.

-- ------------------------------------------------------------------ loại câu hỏi "Bình chọn"
DO $mig$
DECLARE c RECORD;
BEGIN
    FOR c IN SELECT con.conname FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace n ON n.oid = rel.relnamespace
             WHERE n.nspname = 'public' AND rel.relname = 'hk_questions' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%qtype%'
    LOOP
        EXECUTE format('ALTER TABLE public.hk_questions DROP CONSTRAINT %I', c.conname);
    END LOOP;
END
$mig$;
ALTER TABLE public.hk_questions ADD CONSTRAINT hk_questions_qtype_check
    CHECK (qtype IN ('single', 'multiple', 'truefalse', 'fill', 'order', 'map', 'poll'));

-- ------------------------------------------------------------------ video câu hỏi: liên kết https hoặc đường dẫn tới video đã tải lên
DO $mig$
DECLARE c RECORD;
BEGIN
    FOR c IN SELECT con.conname FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace n ON n.oid = rel.relnamespace
             WHERE n.nspname = 'public' AND rel.relname = 'hk_questions' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%video_url%'
    LOOP
        EXECUTE format('ALTER TABLE public.hk_questions DROP CONSTRAINT %I', c.conname);
    END LOOP;
END
$mig$;
ALTER TABLE public.hk_questions ADD CONSTRAINT hk_questions_video_url_check
    CHECK (video_url IS NULL OR ((video_url ~ '^https://' OR video_url ~ '^/api/content/media/[0-9a-f]{32}$') AND length(video_url) <= 500));

-- ------------------------------------------------------------------ kho tải lên: thêm video và nhạc
DO $mig$
DECLARE c RECORD;
BEGIN
    FOR c IN SELECT con.conname FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace n ON n.oid = rel.relnamespace
             WHERE n.nspname = 'public' AND rel.relname = 'hk_media' AND con.contype = 'c'
               AND (pg_get_constraintdef(con.oid) LIKE '%mime%' OR pg_get_constraintdef(con.oid) LIKE '%size_bytes%')
    LOOP
        EXECUTE format('ALTER TABLE public.hk_media DROP CONSTRAINT %I', c.conname);
    END LOOP;
END
$mig$;
ALTER TABLE public.hk_media ADD CONSTRAINT hk_media_mime_check
    CHECK (mime IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg'));
ALTER TABLE public.hk_media ADD CONSTRAINT hk_media_size_bytes_check
    CHECK (size_bytes BETWEEN 1 AND 8388608 AND (mime NOT LIKE 'image/%' OR size_bytes <= 1572864));
