-- Bộ môn của giáo viên: nền tảng chỉ dạy Lịch sử nên không còn nhập hay hiển thị bộ môn; bỏ cột và dữ liệu cũ (theo yêu cầu quản trị trường 08/11/2026).
-- Không đụng tới cột nào khác của app_users. CHECK độ dài của cột (migration 013) mất theo cột; không bảng, khung nhìn hay chỉ mục nào khác dùng cột này.
ALTER TABLE public.app_users DROP COLUMN IF EXISTS subject;
