-- Học kỳ của năm học: học kỳ 1 và học kỳ 2 (ngày bắt đầu, ngày kết thúc) để quản trị viên trường đặt theo khung kế hoạch thời gian năm học
-- của Bộ GD&ĐT (Quyết định 2308/QĐ-BGDĐT ngày 6/8/2026: khai giảng 5/9, học kỳ I 18 tuần kết thúc trước 18/1, học kỳ II 17 tuần, kết thúc năm học trước 31/5)
-- và kế hoạch của địa phương. Chỉ thêm cột: năm học đang có giữ nguyên và chưa có học kỳ cho tới khi quản trị viên trường đặt (hoặc nhận gợi ý trên giao diện).
ALTER TABLE public.app_school_years
  ADD COLUMN IF NOT EXISTS term1_starts_on DATE,
  ADD COLUMN IF NOT EXISTS term1_ends_on DATE,
  ADD COLUMN IF NOT EXISTS term2_starts_on DATE,
  ADD COLUMN IF NOT EXISTS term2_ends_on DATE;

-- Hoặc chưa đặt học kỳ (cả bốn ngày trống), hoặc đặt đủ cả hai học kỳ nối tiếp nhau và nằm trong năm học.
ALTER TABLE public.app_school_years
  ADD CONSTRAINT app_school_years_terms_ok CHECK (
    (term1_starts_on IS NULL AND term1_ends_on IS NULL AND term2_starts_on IS NULL AND term2_ends_on IS NULL)
    OR (
      term1_starts_on IS NOT NULL AND term1_ends_on IS NOT NULL AND term2_starts_on IS NOT NULL AND term2_ends_on IS NOT NULL
      AND term1_starts_on >= starts_on
      AND term1_starts_on <= term1_ends_on
      AND term1_ends_on < term2_starts_on
      AND term2_starts_on <= term2_ends_on
      AND term2_ends_on <= ends_on
    )
  );

COMMENT ON COLUMN public.app_school_years.term1_starts_on IS 'Học kỳ 1: ngày bắt đầu (thường là ngày khai giảng 5/9)';
COMMENT ON COLUMN public.app_school_years.term1_ends_on IS 'Học kỳ 1: ngày kết thúc (khung của Bộ: trước ngày 18/1)';
COMMENT ON COLUMN public.app_school_years.term2_starts_on IS 'Học kỳ 2: ngày bắt đầu (sau khi học kỳ 1 kết thúc)';
COMMENT ON COLUMN public.app_school_years.term2_ends_on IS 'Học kỳ 2: ngày kết thúc, cũng là ngày kết thúc năm học (khung của Bộ: trước ngày 31/5)';
