-- Danh mục trường: gỡ các trường THCS đã sáp nhập và thêm trường mới hình thành sau sáp nhập.
-- Nguồn: danh sách trường TP.HCM sáp nhập, đổi tên (Dân trí, cập nhật 02/09/2026); quyết định thành lập THCS Thạch Hà (Hà Tĩnh, 22/8/2026) và THCS An Phong (Ninh Bình, 19/8/2026).
-- Yêu cầu của người dùng 2026-11-07: trường đã sáp nhập (ví dụ THCS Cửu Long gộp vào THCS Phú Mỹ) không còn là một mục trong danh mục.
-- Chỉ dữ liệu tham chiếu public.app_school_directory; không sửa trường đã đăng ký, tài khoản, lớp, kết quả hay ảnh logo.
-- Tên và mã cũ vẫn tìm ra trường hiện tại qua previous_codes (CSDL) và tên gọi khác (mã nguồn backend/src/admin/school-confirmed-2026.json).
-- Mục cũ chỉ bị xóa khi trường còn lại đã có trong danh mục.

-- 1) Trường mới hình thành sau sáp nhập (tên theo nguồn, có thể được điều chỉnh khi cơ quan có thẩm quyền ban hành quyết định chính thức).
INSERT INTO public.app_school_directory(code,name,city,region,address,website,source_url,source_date,note,previous_codes,logo_sha256,logo_source_url,checked_at) VALUES
  ('hcm-tandinh-2026','Tiểu học - THCS Tân Định','Thành phố Hồ Chí Minh','Phường Tân Định',NULL,NULL,'https://dantri.com.vn/giao-duc/danh-sach-chi-tiet-cac-truong-hoc-sap-nhap-doi-ten-o-tphcm-20260824111612695.htm',DATE '2026-09-02',NULL,'["79760505"]'::jsonb,NULL,NULL,DATE '2026-11-07'),
  ('hcm-phanvantri-2026','Tiểu học - THCS Phan Văn Trị','Thành phố Hồ Chí Minh','Phường Cầu Ông Lãnh',NULL,NULL,'https://dantri.com.vn/giao-duc/danh-sach-chi-tiet-cac-truong-hoc-sap-nhap-doi-ten-o-tphcm-20260824111612695.htm',DATE '2026-09-02',NULL,'["79760507"]'::jsonb,NULL,NULL,DATE '2026-11-07'),
  ('hcm-tanthoi-2026','Tiểu học - THCS Tân Thới','Thành phố Hồ Chí Minh','Phường Lái Thiêu',NULL,NULL,'https://dantri.com.vn/giao-duc/danh-sach-chi-tiet-cac-truong-hoc-sap-nhap-doi-ten-o-tphcm-20260824111612695.htm',DATE '2026-09-02',NULL,'["74725512"]'::jsonb,NULL,NULL,DATE '2026-11-07'),
  ('hcm-vinhphu-2026','Tiểu học - THCS Vĩnh Phú','Thành phố Hồ Chí Minh','Phường Lái Thiêu',NULL,NULL,'https://dantri.com.vn/giao-duc/danh-sach-chi-tiet-cac-truong-hoc-sap-nhap-doi-ten-o-tphcm-20260824111612695.htm',DATE '2026-09-02',NULL,'["74725508"]'::jsonb,NULL,NULL,DATE '2026-11-07'),
  ('hcm-binhduong-2026','THCS Bình Dương','Thành phố Hồ Chí Minh','Phường Bình Dương',NULL,NULL,'https://dantri.com.vn/giao-duc/danh-sach-chi-tiet-cac-truong-hoc-sap-nhap-doi-ten-o-tphcm-20260824111612695.htm',DATE '2026-09-02',NULL,'["74718514", "74723513"]'::jsonb,NULL,NULL,DATE '2026-11-07'),
  ('hcm-phuochoa-2026','Tiểu học và THCS Phước Hòa','Thành phố Hồ Chí Minh','Phường Tân Phước',NULL,NULL,'https://dantri.com.vn/giao-duc/danh-sach-chi-tiet-cac-truong-hoc-sap-nhap-doi-ten-o-tphcm-20260824111612695.htm',DATE '2026-09-02',NULL,'["77754503"]'::jsonb,NULL,NULL,DATE '2026-11-07'),
  ('hcm-chuvanan-hotram-2026','Tiểu học và THCS Chu Văn An','Thành phố Hồ Chí Minh','Xã Hồ Tràm',NULL,NULL,'https://dantri.com.vn/giao-duc/danh-sach-chi-tiet-cac-truong-hoc-sap-nhap-doi-ten-o-tphcm-20260824111612695.htm',DATE '2026-09-02',NULL,'["77751506"]'::jsonb,NULL,NULL,DATE '2026-11-07'),
  ('ht-thachha-2026','Trường THCS Thạch Hà','Tỉnh Hà Tĩnh','Xã Thạch Hà',NULL,NULL,'https://thcsphanhuychu.edu.vn/tin-tuc-nha-truong/quyet-dinh-thanh-lap-truong-thcs-thach-ha-tren-co-so-sap-nhap-truong-thcs-phan-huy-chu-va-truong-thcs-long-son-244.html',DATE '2026-08-27',NULL,'["42445505", "42445504"]'::jsonb,NULL,NULL,DATE '2026-11-07'),
  ('nb-anphong-2026','Trường THCS An Phong','Tỉnh Ninh Bình','Phường Nam Hoa Lư',NULL,NULL,'https://namhoalu.ninhbinh.gov.vn/vanban/chitietvb-71.html',DATE '2026-08-19',NULL,'["37374516", "37369510"]'::jsonb,NULL,NULL,DATE '2026-11-07')
ON CONFLICT (code) DO NOTHING;

-- 2) Ghi mã cũ vào previous_codes của trường còn lại.
WITH retired(old_code,current_code) AS (
  VALUES
  ('37369510','nb-anphong-2026'),
  ('37374516','nb-anphong-2026'),
  ('42445504','ht-thachha-2026'),
  ('42445505','ht-thachha-2026'),
  ('74718514','hcm-binhduong-2026'),
  ('74723513','hcm-binhduong-2026'),
  ('74725508','hcm-vinhphu-2026'),
  ('74725512','hcm-tanthoi-2026'),
  ('77751503','77751510'),
  ('77751506','hcm-chuvanan-hotram-2026'),
  ('77751513','77751510'),
  ('77754503','hcm-phuochoa-2026'),
  ('79760505','hcm-tandinh-2026'),
  ('79760507','hcm-phanvantri-2026'),
  ('79760508','79760504'),
  ('79764510','79764503'),
  ('79765508','79765507'),
  ('79776504','79776505'),
  ('79776512','79776509')
)
UPDATE public.app_school_directory cur
SET previous_codes = (
  SELECT COALESCE(jsonb_agg(merged.code ORDER BY merged.code), '[]'::jsonb) FROM (
    SELECT jsonb_array_elements_text(cur.previous_codes) AS code
    UNION
    SELECT old_code FROM retired WHERE retired.current_code = cur.code
  ) merged)
WHERE cur.code IN (SELECT current_code FROM retired);

-- 3) Xóa các mục cũ đã gộp.
WITH retired(old_code,current_code) AS (
  VALUES
  ('37369510','nb-anphong-2026'),
  ('37374516','nb-anphong-2026'),
  ('42445504','ht-thachha-2026'),
  ('42445505','ht-thachha-2026'),
  ('74718514','hcm-binhduong-2026'),
  ('74723513','hcm-binhduong-2026'),
  ('74725508','hcm-vinhphu-2026'),
  ('74725512','hcm-tanthoi-2026'),
  ('77751503','77751510'),
  ('77751506','hcm-chuvanan-hotram-2026'),
  ('77751513','77751510'),
  ('77754503','hcm-phuochoa-2026'),
  ('79760505','hcm-tandinh-2026'),
  ('79760507','hcm-phanvantri-2026'),
  ('79760508','79760504'),
  ('79764510','79764503'),
  ('79765508','79765507'),
  ('79776504','79776505'),
  ('79776512','79776509')
)
DELETE FROM public.app_school_directory old
USING retired r
WHERE old.code = r.old_code AND old.code <> r.current_code
  AND EXISTS (SELECT 1 FROM public.app_school_directory cur WHERE cur.code = r.current_code);
