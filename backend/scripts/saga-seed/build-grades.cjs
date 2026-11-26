/**
 * Sinh migration 083 – bốn chiến dịch theo khối 6–9 (25/11/2026, bản vẽ "Binh thư Sát Thát") từ grades.cjs:
 *   cd backend && npm run build && node scripts/saga-seed/build-grades.cjs 083 grade_campaigns_binh_thu
 * Mọi chặng mới, câu luyện tập và trận hội đồng được kiểm tra bằng đúng các hàm chuẩn hóa của máy chủ (dist/saga) trước khi ghi SQL;
 * trận hội đồng thêm vào ba chặng có sẵn cũng được kiểm tra cùng nội dung hiện có của chặng đó (stages-1/2/3.cjs). Sai thì dừng, không sinh tệp.
 * Migration đã áp dụng thì KHÔNG sinh lại: muốn sửa nội dung thì tạo migration số mới.
 */
const fs = require('fs');
const path = require('path');
const dist = path.resolve(__dirname, '../../dist/saga');
const { normalizeStage } = require(path.join(dist, 'content.js'));
const { normalizeItem } = require(path.join(dist, 'practice.js'));
const { normalizeCouncil } = require(path.join(dist, 'council.js'));
const { grades, cards, stages, councils, reviewOnly } = require('./grades.cjs');
const old = [...require('./stages-1.cjs'), ...require('./stages-2.cjs'), ...require('./stages-3.cjs')];

const [number, name] = process.argv.slice(2);
if (!/^\d{3}$/.test(number ?? '') || !/^[a-z0-9_]+$/.test(name ?? '')) { console.error('Cách dùng: node build-grades.cjs <số 3 chữ số> <ten_migration>'); process.exit(1); }
const TAG = '$hq$';
const q = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  if (s.includes(TAG)) throw new Error('Nội dung chứa chuỗi dành riêng ' + TAG);
  return `${TAG}${s}${TAG}`;
};
const json = (v) => `${q(JSON.stringify(v))}::jsonb`;
const fail = (where, e) => { console.error(`✗ ${where}: ${e.response?.message ?? e.message}`); process.exit(1); };

// ---------------------------------------------------------------------- kiểm tra
const oldCodes = new Set(old.map((s) => s.code));
const oldItems = new Set(old.flatMap((s) => s.items.map((i) => i.code)));
const codes = new Set(oldCodes);
for (const s of stages) {
  if (codes.has(s.code)) fail(s.code, new Error('mã chặng bị trùng'));
  codes.add(s.code);
  try { s.content = normalizeStage(s.content); } catch (e) { fail(`chặng ${s.code}`, e); }
  if (s.kind === 'battle' && !s.content.battle) fail(s.code, new Error('chặng trận đánh phải có kịch bản trận'));
  if (s.card_code && !cards.some((c) => c.code === s.card_code)) fail(s.code, new Error(`không có thẻ ${s.card_code}`));
  if (s.items.filter((i) => i.usage !== 'review').length < 3) fail(s.code, new Error('cần ít nhất 3 câu luyện tập'));
  s.items.forEach((item, i) => {
    if (oldItems.has(item.code)) fail(item.code, new Error('mã câu trùng với câu có sẵn'));
    if (item.kind === 'locate') fail(item.code, new Error('chặng không thuộc cuộc kháng chiến nào thì không có câu chọn địa điểm'));
    try { item.data = normalizeItem(item.kind, item.data); } catch (e) { fail(`câu ${item.code}`, e); }
    if (!s.content.objectives.some((o) => o.id === item.objective)) fail(item.code, new Error(`mục tiêu ${item.objective} không có trong chặng`));
    if (!s.content.sources.some((x) => x.key === item.source)) fail(item.code, new Error(`nguồn ${item.source} không có trong chặng`));
    item.position = i + 1;
  });
}
for (const s of stages) if (s.unlock_after && !codes.has(s.unlock_after)) fail(s.code, new Error(`chặng điều kiện ${s.unlock_after} không tồn tại`));
const newItems = stages.flatMap((s) => s.items.map((i) => i.code));
if (new Set(newItems).size !== newItems.length) fail('câu luyện tập', new Error('mã câu bị trùng'));
for (const [code, battle] of Object.entries(councils)) {
  const s = old.find((x) => x.code === code) ?? fail(code, new Error('không có chặng này'));
  if (s.content.battle) fail(code, new Error('chặng đã có trận đánh'));
  try { normalizeCouncil(battle); normalizeStage({ ...JSON.parse(JSON.stringify(s.content)), battle }); } catch (e) { fail(`trận hội đồng ${code}`, e); }
}
for (const c of reviewOnly) if (!oldItems.has(c)) fail(c, new Error('không có câu này'));
// mỗi khối đúng 24 câu Hội đồng (câu không phải "chỉ ôn tập")
const perGrade = { 6: 0, 7: 0, 8: 0, 9: 0 };
for (const s of old) perGrade[s.campaign_no + 5] += s.items.filter((i) => (i.usage ?? 'both') !== 'review' && !reviewOnly.includes(i.code)).length;
for (const s of stages) perGrade[s.grade] += s.items.filter((i) => i.usage !== 'review').length;
for (const [g, n] of Object.entries(perGrade)) if (n !== 24) fail(`Khối ${g}`, new Error(`có ${n} câu Hội đồng, cần đúng 24`));

// ---------------------------------------------------------------------- ghi SQL
const NOTE = 'Nội dung khởi tạo ngày 25/11/2026 (bốn chiến dịch theo khối): dữ kiện đối chiếu với các bài Wikipedia tiếng Việt “Trận Bạch Đằng (938)”, “Ngô Quyền” và các thẻ, tư liệu đã kiểm chứng của migration 066. Cần giáo viên Lịch sử rà soát lại.';
const order = ['bach-dang-938', ...old.map((s) => s.code), ...stages.filter((s) => s.grade === 9).map((s) => s.code)];
const out = [];
const add = (...lines) => out.push(...lines);
add('-- Bốn chiến dịch theo khối 6–9 (25/11/2026, theo bản vẽ "Binh thư Sát Thát" của người dùng; sinh bằng backend/scripts/saga-seed/build-grades.cjs).',
  '-- Khối 6 · Tân binh: Bạch Đằng 938 (chặng mới) + kháng chiến lần thứ nhất 1258; Khối 7 · Đội trưởng: lần thứ hai 1285; Khối 8 · Tướng quân: lần thứ ba 1287–1288;',
  '-- Khối 9 · Nguyên soái: bốn chặng tổng kết (không thêm sự kiện mới). Mỗi khối 24 câu Hội đồng, mỗi câu thuộc đúng một chặng nên không trùng giữa các khối.',
  '-- Vòng chơi mới của một chặng: Quân lệnh → Thám sử (nhặt thẻ Binh thư) → Hội đồng quân sự (luyện tập) → Xuất trận → Sử quan tổng kết; thế giới khối 3D là phần thêm.',
  '-- Thay đổi: cột hk_saga_stages.grade (chặng có sẵn: phần 1/2/3 → khối 6/7/8), campaign_no được để trống cho chặng không thuộc cuộc kháng chiến nào,',
  '-- bảng nội dung hk_saga_grades, cột hk_saga_progress.lore (thẻ Binh thư đã nhặt; điền lại cho chặng đã học xong), lý do sổ vàng answer / star / streak,',
  '-- hai chỉ số nhiệm vụ mới (thẻ Binh thư, câu hỏi Tiểu Tướng), ba nhiệm vụ hằng ngày theo bản vẽ, thẻ Ngô Quyền, 5 chặng mới với 30 câu, trận hội đồng cho',
  '-- Diên Hồng / Vườn không nhà trống / Vạn Kiếp (bản cũ lưu ở hk_saga_stage_versions) và 13 câu Khối 7–8 chuyển sang chỉ dùng ôn tập. Không xóa dữ liệu nào.',
  '');
add('-- ---------------------------------------------------------------------- khối của chặng',
  'ALTER TABLE public.hk_saga_stages ADD COLUMN IF NOT EXISTS grade SMALLINT CHECK (grade BETWEEN 6 AND 9);',
  'ALTER TABLE public.hk_saga_stages ALTER COLUMN campaign_no DROP NOT NULL;',
  'UPDATE public.hk_saga_stages SET grade = campaign_no + 5 WHERE grade IS NULL AND campaign_no BETWEEN 1 AND 3;',
  'CREATE INDEX IF NOT EXISTS hk_saga_stages_grade_idx ON public.hk_saga_stages(grade, position);',
  '',
  '-- Thông tin của bốn khối (nội dung mẫu hệ thống, chỉ đọc trong không gian của trường)',
  'CREATE TABLE IF NOT EXISTS public.hk_saga_grades (',
  '    grade SMALLINT PRIMARY KEY CHECK (grade BETWEEN 6 AND 9),',
  '    tag TEXT NOT NULL CHECK (length(btrim(tag)) BETWEEN 3 AND 60),',
  '    role TEXT NOT NULL CHECK (length(btrim(role)) BETWEEN 2 AND 40),',
  '    level TEXT NOT NULL CHECK (length(btrim(level)) BETWEEN 2 AND 40),',
  '    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 120),',
  '    forms TEXT NOT NULL CHECK (length(btrim(forms)) BETWEEN 3 AND 120),',
  '    note TEXT CHECK (note IS NULL OR length(note) <= 300),',
  '    reward TEXT NOT NULL CHECK (length(btrim(reward)) BETWEEN 3 AND 300)',
  ');',
  'ALTER TABLE public.hk_saga_grades ENABLE ROW LEVEL SECURITY;',
  'REVOKE ALL ON public.hk_saga_grades FROM PUBLIC;',
  'DO $$',
  'DECLARE r TEXT;',
  'BEGIN',
  "    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP",
  "        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON public.hk_saga_grades FROM %I', r); END IF;",
  '    END LOOP;',
  "    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dong_a_workspace_scope') THEN",
  "        EXECUTE 'GRANT SELECT ON public.hk_saga_grades TO dong_a_workspace_scope';",
  "        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hk_saga_grades' AND policyname = 'workspace_read') THEN",
  "            EXECUTE 'CREATE POLICY workspace_read ON public.hk_saga_grades FOR SELECT TO dong_a_workspace_scope USING (true)';",
  '        END IF;',
  '    END IF;',
  'END $$;',
  'INSERT INTO public.hk_saga_grades (grade, tag, role, level, title, forms, note, reward) VALUES',
  grades.map((g) => `    (${[g.grade, q(g.tag), q(g.role), q(g.level), q(g.title), q(g.forms), q(g.note), q(g.reward)].join(', ')})`).join(',\n'),
  'ON CONFLICT (grade) DO NOTHING;',
  '');
add('-- ---------------------------------------------------------------------- thẻ Binh thư đã nhặt ở bước Thám sử',
  "ALTER TABLE public.hk_saga_progress ADD COLUMN IF NOT EXISTS lore TEXT[] NOT NULL DEFAULT '{}';",
  '-- chặng đã học xong trước đây: coi như đã nhặt đủ thẻ của chặng đó (bộ sưu tập Binh thư phản ánh đúng những gì em đã học)',
  "UPDATE public.hk_saga_progress p SET lore = ARRAY(SELECT c->>'id' FROM public.hk_saga_stages s, jsonb_array_elements(s.content->'cards') c WHERE s.id = p.stage_id)",
  '    WHERE p.lesson_done_at IS NOT NULL AND cardinality(p.lore) = 0;',
  '');
add('-- ---------------------------------------------------------------------- sổ vàng và nhiệm vụ',
  '-- answer: đúng một câu (+2 vàng); star: mỗi sao trận đánh (+10 vàng); streak: mốc chuỗi ngày 3 / 14 ngày (+30 / +200 vàng)',
  'ALTER TABLE public.hk_gold_ledger DROP CONSTRAINT IF EXISTS hk_gold_ledger_reason_check;',
  "ALTER TABLE public.hk_gold_ledger ADD CONSTRAINT hk_gold_ledger_reason_check CHECK (reason IN ('node', 'quest', 'goal', 'gift', 'level', 'card', 'shop', 'contest', 'badge', 'battle', 'minigame', 'assignment', 'teacher', 'chest', 'answer', 'star', 'streak'));",
  'ALTER TABLE public.hk_quest_templates DROP CONSTRAINT IF EXISTS hk_quest_templates_metric_check;',
  "ALTER TABLE public.hk_quest_templates ADD CONSTRAINT hk_quest_templates_metric_check CHECK (metric IN ('correct_answers', 'nodes_completed', 'battles_completed', 'lessons_completed', 'xp_earned', 'perfect_quizzes', 'lore_collected', 'ai_questions'));",
  '-- ba nhiệm vụ hằng ngày của bản vẽ (mẫu hệ thống, school_id rỗng – migration 039): trả lời đúng 10 câu, nhặt 2 thẻ Binh thư, hỏi Tiểu Tướng 1 câu;',
  '-- các nhiệm vụ ngày khác của mẫu hệ thống tạm tắt (không xóa; nhiệm vụ tuần và nhiệm vụ riêng của trường giữ nguyên)',
  "UPDATE public.hk_quest_templates SET reward_xp = 20, reward_gold = 20, sort_order = 1 WHERE code = 'ngay-10-cau-dung' AND school_id IS NULL;",
  'INSERT INTO public.hk_quest_templates (code, period, title, metric, target, reward_xp, reward_gold, sort_order) VALUES',
  "    ('ngay-2-the-binh-thu', 'daily', 'Thu thập 2 thẻ Binh thư', 'lore_collected', 2, 20, 30, 2),",
  "    ('ngay-hoi-tieu-tuong', 'daily', 'Hỏi Tiểu Tướng 1 câu về sử Trần', 'ai_questions', 1, 20, 10, 3)",
  'ON CONFLICT (code) WHERE school_id IS NULL DO NOTHING;',
  "UPDATE public.hk_quest_templates SET is_active = false WHERE school_id IS NULL AND period = 'daily' AND code NOT IN ('ngay-10-cau-dung', 'ngay-2-the-binh-thu', 'ngay-hoi-tieu-tuong');",
  '');
add('-- ---------------------------------------------------------------------- thứ tự chặng: Bạch Đằng 938 đứng đầu, bốn chặng Khối 9 ở cuối',
  '-- dời tạm sang 51–63 rồi về 2–14 (thứ tự phải nằm trong 1–99 và không trùng ở mọi bước)',
  `UPDATE public.hk_saga_stages SET position = position + 50 WHERE position < 50 AND code IN (${old.map((s) => q(s.code)).join(', ')});`,
  'UPDATE public.hk_saga_stages SET position = position - 49 WHERE position > 50;',
  '');
add('-- ---------------------------------------------------------------------- thẻ nhân vật mới',
  'INSERT INTO public.hk_saga_cards (code, name, title, rarity, years, intro, role_text, quote, quote_source, source, source_url, portrait, sort_order) VALUES',
  cards.map((c) => `    (${[q(c.code), q(c.name), q(c.title), q(c.rarity), q(c.years), q(c.intro), q(c.role_text), q(c.quote), q(c.quote_source), q(c.source), q(c.source_url), q(c.portrait), 0].join(', ')})`).join(',\n'),
  'ON CONFLICT (code) DO NOTHING;');
for (const s of stages) {
  const pos = order.indexOf(s.code) + 1;
  add('', `-- ---------------------------------------------------------------------- Khối ${s.grade} · ${s.title} (${s.date_label})`,
    'INSERT INTO public.hk_saga_stages (code, campaign_no, grade, position, title, place, date_label, kind, icon, summary, map_x, map_y, anchor_x, anchor_y, unlock_after, pass_percent, reward_xp, reward_gold, card_code, badge_code, content, status, review_note) VALUES',
    `    (${[q(s.code), 'NULL', s.grade, pos, q(s.title), q(s.place), q(s.date_label), q(s.kind), q(s.icon), q(s.summary), s.map_x, s.map_y, 'NULL', 'NULL', q(s.unlock_after), s.pass_percent, s.reward_xp, s.reward_gold, q(s.card_code), q(s.badge_code)].join(', ')},`,
    `     ${json(s.content)},`,
    `     'published', ${q(NOTE)})`,
    'ON CONFLICT (code) DO NOTHING;',
    'INSERT INTO public.hk_saga_items (stage_id, code, position, kind, usage, objective, prompt, data, explanation, source)',
    'SELECT s.id, v.code, v.position, v.kind, v.usage, v.objective, v.prompt, v.data, v.explanation, v.source FROM public.hk_saga_stages s, (VALUES',
    s.items.map((i) => `    (${[q(i.code), i.position, q(i.kind), q(i.usage ?? 'both'), q(i.objective), q(i.prompt), json(i.data), q(i.explanation), q(i.source)].join(', ')})`).join(',\n'),
    `) AS v(code, position, kind, usage, objective, prompt, data, explanation, source) WHERE s.code = ${q(s.code)}`,
    'ON CONFLICT (code) DO NOTHING;');
}
add('', '-- ---------------------------------------------------------------------- trận hội đồng cho ba chặng trước đây không có trận (lưu bản cũ trước khi đổi)',
  `INSERT INTO public.hk_saga_stage_versions (stage_id, version, content, status) SELECT id, version, content, status FROM public.hk_saga_stages WHERE code IN (${Object.keys(councils).map(q).join(', ')}) AND content->'battle' IS NULL ON CONFLICT DO NOTHING;`);
for (const [code, battle] of Object.entries(councils)) {
  add(`UPDATE public.hk_saga_stages SET content = jsonb_set(content, '{battle}', ${json(normalizeCouncil(battle))}), version = version + 1, updated_at = now()`,
    `    WHERE code = ${q(code)} AND (content->'battle' IS NULL OR jsonb_typeof(content->'battle') = 'null');`);
}
add('', '-- ---------------------------------------------------------------------- Khối 7 – 8: mỗi khối 24 câu Hội đồng; các câu dưới đây chỉ còn dùng ở ôn tập',
  `UPDATE public.hk_saga_items SET usage = 'review' WHERE code IN (${reviewOnly.map(q).join(', ')});`,
  '', '-- Kho dữ liệu đã xóa (migration 052): bảng mới cũng được gắn trigger lưu trước khi xóa', 'SELECT public.app_install_delete_archives();', '');

const file = path.resolve(__dirname, '../../../database/migrations', `${number}_${name}.sql`);
if (fs.existsSync(file) && !process.argv.includes('--overwrite')) { console.error(`✗ ${path.basename(file)} đã tồn tại. Migration đã áp dụng thì không sinh lại; thêm --overwrite chỉ khi tệp chưa từng được phát hành.`); process.exit(1); }
fs.writeFileSync(file, out.join('\n'), 'utf8');
console.log(`✓ ${path.basename(file)}: ${stages.length} chặng mới, ${newItems.length} câu, ${Object.keys(councils).length} trận hội đồng, câu Hội đồng mỗi khối ${JSON.stringify(perGrade)}, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
