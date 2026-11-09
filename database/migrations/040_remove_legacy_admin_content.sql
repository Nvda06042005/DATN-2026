-- Theo yêu cầu ngày 06/11/2026: quản lý tổng chỉ giữ trường học, người dùng,
-- thống kê hệ thống, thông báo, nhật ký, hướng dẫn/FAQ, bảo mật, hệ thống và hỗ trợ.
-- Sáu bảng này thuộc trang quản trị nội dung cũ (migration 011), không còn được
-- backend/frontend hiện tại sử dụng. Các kho hist_*/hk_* của trường vẫn giữ nguyên.
-- RESTRICT ngăn xóa lan sang một bảng/phụ thuộc ngoài danh sách được duyệt.
DROP TABLE IF EXISTS public.app_content_history,
                     public.app_curriculum_nodes,
                     public.app_question_bank,
                     public.app_ai_sources,
                     public.app_hero_cards,
                     public.app_exp_rules RESTRICT;
