-- 18/11/2026: ảnh minh họa / video của mục Hướng dẫn và FAQ có thể là tệp quản trị tổng tải lên kho tệp của hệ thống (hk_media,
-- phục vụ ở /api/content/media/<mã 32 ký tự hex>), ngoài liên kết https như trước. Chỉ nới ràng buộc kiểm tra; không đổi dữ liệu đang có.
ALTER TABLE public.hk_faq DROP CONSTRAINT IF EXISTS hk_faq_image_url_check;
ALTER TABLE public.hk_faq DROP CONSTRAINT IF EXISTS hk_faq_video_url_check;
ALTER TABLE public.hk_faq ADD CONSTRAINT hk_faq_image_url_check CHECK (image_url IS NULL OR image_url ~ '^https://' OR image_url ~ '^/api/content/media/[0-9a-f]{32}$');
ALTER TABLE public.hk_faq ADD CONSTRAINT hk_faq_video_url_check CHECK (video_url IS NULL OR video_url ~ '^https://' OR video_url ~ '^/api/content/media/[0-9a-f]{32}$');
COMMENT ON COLUMN public.hk_faq.image_url IS 'Ảnh minh họa: liên kết https hoặc tệp tải lên /api/content/media/<mã> (từ migration 075)';
COMMENT ON COLUMN public.hk_faq.video_url IS 'Video hướng dẫn: liên kết https hoặc tệp tải lên /api/content/media/<mã> (từ migration 075)';
