-- Khung quốc gia là các mốc hạn + tuần thực học, không phải lịch học/nghỉ cụ thể của địa phương.
-- Nguồn và phạm vi: docs/LICH_NAM_HOC.md. 2308/QĐ-BGDĐT áp dụng từ 2026-2027 và các năm tiếp theo.
-- Không sửa migration 050; giữ lịch trường đã nhập khác mẫu tự sinh trước đây.
CREATE FUNCTION public.school_year_framework(p_label text) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public AS $$
  WITH parsed AS (
    SELECT CASE WHEN p_label ~ '^[0-9]{4}-[0-9]{4}$' THEN left(p_label,4)::int END AS y,
           CASE WHEN p_label ~ '^[0-9]{4}-[0-9]{4}$' THEN right(p_label,4)::int END AS z
  ), rules(y, decision, term1_day, term2_day, source_url) AS (VALUES
    (2020, '2084/QĐ-BGDĐT', 16, 25, 'https://thcsvanyen.pgdhadong.edu.vn/uploads/thcsvanyen/laws/2084_qd-bgddt_448197.pdf'),
    (2021, '2551/QĐ-BGDĐT', 16, 25, 'https://mnquangtrung.hanoi.edu.vn/hoat-dong-chung/thong-bao-ve-thoi-gian-thuc-hien-chuong-trinh-giao-duc-nam-hoc-2021-2022/ctmb/5188/86192'),
    (2022, '2159/QĐ-BGDĐT', 15, 25, 'https://www.lamdong.dcs.vn/tin-tuc-su-kien/type/detail/id/33882/task/143'),
    (2023, '2171/QĐ-BGDĐT', 15, 25, 'https://binhphuoc.gov.vn/vi/news/tin-tuc-su-kien-421/khung-ke-hoach-thoi-gian-nam-hoc-2023-2024-33021.html'),
    (2024, '2045/QĐ-BGDĐT', 18, 31, 'https://storage-edu.vnpt.vn/edu-tnh/1668/thang8/quyet-dinh-2045-qd-bgddt-khung-ke-hoach-thoi-gian-nam-hoc-2024-2025.pdf'),
    (2025, '2269/QĐ-BGDĐT', 18, 31, 'https://quantrithanhxuan.hanoi.shieldixcloud.com/data/doc/2025/thkhuongdinh/2025_8/14/2269qdbgddtkhung-thoi-gian-nam-hoc-2025-2026_148202517.pdf'),
    (2026, '2308/QĐ-BGDĐT', 18, 31, 'https://thnguyenviethongnhabe.hcm.edu.vn/van-ban/quyet-dinh-2308qd-bgddt-ban-hanh-khung-ke-hoach-thoi-gian-nam-hoc-doi-voi-giao/vbct/78613/1404297')
  )
  SELECT jsonb_build_object(
    'label', p_label, 'decision', r.decision, 'source_url', r.source_url,
    'opening_on', make_date(p.y,9,5), 'term1_finish_before', make_date(p.z,1,r.term1_day),
    'term2_finish_before', make_date(p.z,5,r.term2_day), 'year_finish_before', make_date(p.z,5,31),
    'term1_teaching_weeks', 18, 'term2_teaching_weeks', 17,
    -- Khoảng nội bộ để phân loại dữ liệu theo học kỳ; UI hiển thị mốc "trước ngày", không gọi đây là lịch địa phương.
    'starts_on', make_date(p.y,9,5), 'ends_on', make_date(p.z,5,31)-1,
    'term1_starts_on', make_date(p.y,9,5), 'term1_ends_on', make_date(p.z,1,r.term1_day)-1,
    'term2_starts_on', make_date(p.z,1,r.term1_day), 'term2_ends_on', make_date(p.z,5,r.term2_day)-1
  ) FROM parsed p JOIN rules r ON r.y = least(p.y,2026)
  WHERE p.y BETWEEN 2020 AND 9998 AND p.z = p.y+1
$$;
REVOKE ALL ON FUNCTION public.school_year_framework(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_year_framework(text) TO dong_a_school_scope;

ALTER TABLE public.app_school_years ADD COLUMN calendar_mode text NOT NULL DEFAULT 'manual'
  CHECK (calendar_mode IN ('manual','national'));
COMMENT ON COLUMN public.app_school_years.calendar_mode IS
  'national: khung Bộ theo năm, mốc hạn không phải lịch nghỉ/thực học địa phương; manual: giữ lịch riêng đã nhập';

-- Chỉ điền năm trống học kỳ theo mẫu chuẩn hoặc sửa đúng bộ ngày mà giao diện 050 từng tự suy đoán.
-- Không đổi ID, trường, tên năm, trạng thái, lớp, thời điểm kết thúc hay lịch riêng đã được nhập khác mẫu.
WITH source AS (
  SELECT y.*, public.school_year_framework(y.label) AS f FROM public.app_school_years y
), candidates AS (
  SELECT y.id, y.f FROM source y
  WHERE y.starts_on = (y.f->>'opening_on')::date
    AND y.ends_on = (y.f->>'year_finish_before')::date
    AND (
      y.term1_starts_on IS NULL
      OR (y.term1_starts_on = y.starts_on AND y.term2_ends_on = y.ends_on
        AND y.term1_ends_on = make_date(extract(year FROM (y.f->>'year_finish_before')::date)::int,1,17)
          - ((extract(dow FROM make_date(extract(year FROM (y.f->>'year_finish_before')::date)::int,1,17))::int+1)%7)
        AND y.term2_starts_on = y.term1_ends_on+2)
    )
)
UPDATE public.app_school_years y SET
  starts_on = (c.f->>'starts_on')::date, ends_on = (c.f->>'ends_on')::date,
  term1_starts_on = (c.f->>'term1_starts_on')::date, term1_ends_on = (c.f->>'term1_ends_on')::date,
  term2_starts_on = (c.f->>'term2_starts_on')::date, term2_ends_on = (c.f->>'term2_ends_on')::date,
  calendar_mode = 'national', updated_at = now()
FROM candidates c WHERE y.id=c.id AND c.f IS NOT NULL;
