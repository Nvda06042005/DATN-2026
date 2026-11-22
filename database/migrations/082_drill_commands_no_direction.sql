-- 082 (22/11/2026): hiệu lệnh luyện đội hình ở chặng Diên Hồng (thế giới khối, migration 081) không dựa vào hướng trái / phải và không nhắc
-- "cờ đỏ". Lý do (phát hiện khi tự chơi trên trình duyệt): em xoay được góc nhìn nên "bên phải / bên trái" không cố định, và trên sân luyện quân
-- không có lá cờ đỏ nào. Ô sáng và mũi tên vẫn chỉ đúng vị trí tiếp theo; thứ tự và vị trí không đổi, không đổi dữ liệu học sinh.
-- Chỉ cập nhật khi nội dung còn đúng bản của 081 (đã sửa tay hoặc migration khác đổi rồi thì giữ nguyên).

UPDATE public.hk_saga_stages
SET content = jsonb_set(content, '{world,steps,6,commands}', $j$[
  "Đứng vào hàng đầu, ở vị trí 1.",
  "Tiến ngang sang vị trí 2, giữ thẳng hàng.",
  "Lùi về hàng sau, vào vị trí 3 che cho đồng đội.",
  "Khép kín hàng sau ở vị trí 4.",
  "Về vị trí chỉ huy, cả đội vào hàng."
]$j$::jsonb)
WHERE code = 'dien-hong'
  AND content #>> '{world,steps,6,type}' = 'drill'
  AND content #>> '{world,steps,6,commands,0}' = 'Đứng vào hàng đầu, dưới cờ đỏ (vị trí 1).';

UPDATE public.hk_saga_maps m
SET world = jsonb_set(m.world, '{zones}', (
  SELECT jsonb_agg(CASE WHEN e.z->>'id' = 'doi_1' THEN jsonb_set(e.z, '{name}', '"Vị trí 1"'::jsonb) ELSE e.z END ORDER BY e.ord)
  FROM jsonb_array_elements(m.world->'zones') WITH ORDINALITY AS e(z, ord)
))
WHERE m.campaign_no = 2
  AND m.world IS NOT NULL
  AND m.world->'zones' @> '[{"id": "doi_1", "name": "Vị trí 1 (cờ đỏ)"}]'::jsonb;
