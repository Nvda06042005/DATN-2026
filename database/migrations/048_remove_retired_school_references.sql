-- Remove only reference entries whose confirmed merger target is present.
-- User request 2026-11-07: old merged schools must no longer remain as catalogue rows.
-- Alias mappings remain in source so old names/codes find the current school.
-- Does not modify registered schools, users, classes, results or image assets.
WITH confirmed_mergers(old_code,current_code) AS (
  VALUES
  ('01004502','01004503'),
  ('01016504','hn-lythuongkiet-daphuc-2026'),
  ('01018506','01018503'),
  ('01018508','hn-thuanan-2026'),
  ('01018512','hn-thuanan-2026'),
  ('01018513','hn-thuanan-2026'),
  ('01020510','hn-vuongthuavu-2026'),
  ('01020513','hn-dongocdu-2026'),
  ('01020514','hn-dongocdu-2026'),
  ('01020516','hn-vuongthuavu-2026'),
  ('01278513','hn-thanhoai-2026'),
  ('01278516','hn-thanhoai-2026'),
  ('01278517','hn-thanhoai-2026'),
  ('01279528','01279522'),
  ('19164519','tn-daiphuc-2026'),
  ('19164521','tn-daiphuc-2026'),
  ('19172508','tn-daiphuc-2026'),
  ('19173505','tn-phubinh1-2026'),
  ('19173506','tn-phubinh1-2026'),
  ('19173512','tn-phubinh1-2026'),
  ('30292524','30292523'),
  ('31305501','31305506'),
  ('31311522','hp-tranquocbao-2026'),
  ('31311523','hp-bachdang-2026'),
  ('31311524','hp-tranquocbao-2026'),
  ('42442511','ht-danhai-2026'),
  ('42442512','ht-danhai-2026'),
  ('56568501','kh-nhatrang-2026'),
  ('56568502','kh-nhatrang-2026'),
  ('56568515','kh-nhatrang-2026'),
  ('56568516','kh-nhatrang-2026'),
  ('56568517','kh-nhatrang-2026'),
  ('56568520','kh-nhatrang-2026'),
  ('56568525','kh-nhatrang-2026'),
  ('77750512','77750506'),
  ('77750514','77750505'),
  ('77751509','77751507'),
  ('79762512','79762502'),
  ('79765501','79765511'),
  ('79766506','79766512'),
  ('79766513','79766511'),
  ('79767513','79767510'),
  ('79768504','79768501'),
  ('79770505','79770502'),
  ('79770508','79770511'),
  ('79770510','79770501'),
  ('79771507','79771504'),
  ('79776502','79776501'),
  ('79783505','79783522'),
  ('79783507','79783522'),
  ('79783520','79783513'),
  ('79786506','79786507')
)
DELETE FROM public.app_school_directory old
USING confirmed_mergers merged
WHERE old.code=merged.old_code AND old.code<>merged.current_code
  AND EXISTS (SELECT 1 FROM public.app_school_directory current WHERE current.code=merged.current_code);
