-- Tin nhắn kèm mã tham gia lớp (16/11/2026): giáo viên gửi mã lớp cho học sinh qua mục "Tin nhắn"; học sinh mở tin nhắn thấy lớp và mã,
-- bấm để vào trang đăng ký lớp. Cột tùy chọn, tin nhắn cũ để trống; bảng đã bật RLS (migration 070), không đổi quyền, không đổi dữ liệu.
ALTER TABLE public.hk_messages ADD COLUMN class_id INTEGER REFERENCES public.app_classes(id) ON DELETE SET NULL;
CREATE INDEX hk_messages_class_idx ON public.hk_messages (class_id) WHERE class_id IS NOT NULL;
COMMENT ON COLUMN public.hk_messages.class_id IS 'Lớp có mã tham gia được gửi kèm tin nhắn (giáo viên phụ trách lớp)';
