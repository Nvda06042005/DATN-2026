/**
 * Sinh migration nội dung khởi tạo của Hành trình Đông A từ các tệp soạn thảo trong thư mục này.
 *   cd backend && npm run build && node scripts/saga-seed/build.cjs <số migration> <tên>      (ví dụ: 066 seed_saga_journey)
 * Mọi chặng và câu luyện tập được kiểm tra bằng đúng các hàm chuẩn hóa của máy chủ (dist/saga) trước khi ghi ra SQL; sai cấu trúc thì dừng, không sinh tệp.
 * Migration đã áp dụng thì KHÔNG sinh lại: nội dung về sau sửa qua trang quản trị, hoặc soạn chặng mới rồi sinh một migration số mới.
 */
const fs = require('fs');
const path = require('path');
const dist = path.resolve(__dirname, '../../dist/saga');
const { normalizeStage } = require(path.join(dist, 'content.js'));
const { normalizeItem } = require(path.join(dist, 'practice.js'));
const { maps, cards, docs, badges } = require('./extras.cjs');
const stages = [...require('./stages-1.cjs'), ...require('./stages-2.cjs'), ...require('./stages-3.cjs')];

const [number, name] = process.argv.slice(2);
if (!/^\d{3}$/.test(number ?? '') || !/^[a-z0-9_]+$/.test(name ?? '')) { console.error('Cách dùng: node build.cjs <số 3 chữ số> <ten_migration>'); process.exit(1); }

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
const codes = new Set();
const positions = new Set();
for (const s of stages) {
  if (codes.has(s.code) || positions.has(s.position)) fail(s.code, new Error('mã hoặc thứ tự chặng bị trùng'));
  codes.add(s.code); positions.add(s.position);
  try { s.content = normalizeStage(s.content); } catch (e) { fail(`chặng ${s.code}`, e); }
  if (s.kind === 'battle' && !s.content.battle) fail(s.code, new Error('chặng trận đánh phải có kịch bản trận'));
  if (s.card_code && !cards.some((c) => c.code === s.card_code)) fail(s.code, new Error(`không có thẻ ${s.card_code}`));
  if (s.badge_code && !badges.some((b) => b.code === s.badge_code)) fail(s.code, new Error(`không có huy hiệu ${s.badge_code}`));
  if (s.items.filter((i) => i.usage !== 'review').length < 3) fail(s.code, new Error('cần ít nhất 3 câu luyện tập'));
  s.items.forEach((item, i) => {
    try { item.data = normalizeItem(item.kind, item.data); } catch (e) { fail(`câu ${item.code}`, e); }
    if (!s.content.objectives.some((o) => o.id === item.objective)) fail(item.code, new Error(`mục tiêu ${item.objective} không có trong chặng`));
    if (!s.content.sources.some((x) => x.key === item.source)) fail(item.code, new Error(`nguồn ${item.source} không có trong chặng`));
    if (item.kind === 'locate' && item.data.campaign_no !== s.campaign_no) fail(item.code, new Error('câu chọn địa điểm phải dùng bản đồ của chính cuộc kháng chiến'));
    item.position = i + 1;
  });
}
for (const s of stages) if (s.unlock_after && !codes.has(s.unlock_after)) fail(s.code, new Error(`chặng điều kiện ${s.unlock_after} không tồn tại`));
for (const d of docs) if (d.unlock_stage && !codes.has(d.unlock_stage)) fail(d.code, new Error(`chặng mở tư liệu ${d.unlock_stage} không tồn tại`));
const itemCodes = stages.flatMap((s) => s.items.map((i) => i.code));
if (new Set(itemCodes).size !== itemCodes.length) fail('câu luyện tập', new Error('mã câu bị trùng'));

// ---------------------------------------------------------------------- ghi SQL
const NOTE = 'Nội dung khởi tạo ngày 15/11/2026: dữ kiện đã đối chiếu với các bài Wikipedia tiếng Việt về ba cuộc kháng chiến chống Mông – Nguyên và hai bài của Bảo tàng Lịch sử quốc gia về Bạch Đằng. Cần giáo viên Lịch sử rà soát lại; quản trị tổng có thể đưa chặng về Nháp bất cứ lúc nào.';
const out = [];
out.push(`-- Nội dung khởi tạo của Hành trình Đông A (sinh bằng backend/scripts/saga-seed/build.cjs, đã kiểm tra bằng các hàm chuẩn hóa của máy chủ).`);
out.push(`-- ${stages.length} chặng của ba cuộc kháng chiến (${[1, 2, 3].map((n) => stages.filter((s) => s.campaign_no === n).length).join(' + ')}), ${itemCodes.length} câu luyện tập, ${cards.length} thẻ nhân vật, ${docs.length} mục tư liệu, ${badges.length} huy hiệu.`);
out.push('-- Dữ kiện lịch sử đối chiếu với Wikipedia tiếng Việt (ba bài "Chiến tranh Nguyên Mông – Đại Việt lần 1/2/3", "Trận Bạch Đằng (1288)", các bài nhân vật) và Bảo tàng Lịch sử quốc gia.');
out.push('-- Lời thoại, nhân vật phụ và chỉ số trận đánh là phần sáng tạo của trò chơi. Không chứa dữ liệu tài khoản. Chạy lại không tạo trùng (ON CONFLICT DO NOTHING).');
out.push('');
out.push('INSERT INTO public.hk_saga_maps (campaign_no, title, short_title, years, enemy, places, summary, image_key, image_w, image_h, credit, credit_url) VALUES');
out.push(maps.map((m) => `    (${[m.campaign_no, q(m.title), q(m.short_title), q(m.years), q(m.enemy), q(m.places), q(m.summary), q(m.image_key), m.image_w, m.image_h, q(m.credit), q(m.credit_url.replace('%3A', ':'))].join(', ')})`).join(',\n'));
out.push('ON CONFLICT (campaign_no) DO NOTHING;');
out.push('');
out.push('INSERT INTO public.hk_saga_cards (code, name, title, rarity, years, intro, role_text, quote, quote_source, source, source_url, portrait, sort_order) VALUES');
out.push(cards.map((c, i) => `    (${[q(c.code), q(c.name), q(c.title), q(c.rarity), q(c.years), q(c.intro), q(c.role_text), q(c.quote), q(c.quote_source), q(c.source), q(c.source_url), q(c.portrait), i + 1].join(', ')})`).join(',\n'));
out.push('ON CONFLICT (code) DO NOTHING;');
out.push('');
out.push('-- Huy hiệu của hành trình: không có luật tự động (rule rỗng), máy chủ trao khi học sinh hoàn thành đúng chặng');
out.push('INSERT INTO public.hk_badges (code, name, description, icon, color, rule, sort_order) VALUES');
out.push(badges.map((b) => `    (${[q(b.code), q(b.name), q(b.description), q(b.icon), q(b.color), 'NULL', b.sort_order].join(', ')})`).join(',\n'));
out.push('ON CONFLICT (code) DO NOTHING;');
for (const s of stages) {
  out.push('');
  out.push(`-- ---------------------------------------------------------------------- chặng ${s.position}: ${s.title} (${s.date_label})`);
  out.push('INSERT INTO public.hk_saga_stages (code, campaign_no, position, title, place, date_label, kind, icon, summary, map_x, map_y, anchor_x, anchor_y, unlock_after, pass_percent, reward_xp, reward_gold, card_code, badge_code, content, status, review_note) VALUES');
  out.push(`    (${[q(s.code), s.campaign_no, s.position, q(s.title), q(s.place), q(s.date_label), q(s.kind), q(s.icon), q(s.summary), s.map_x, s.map_y, q(s.anchor_x), q(s.anchor_y), q(s.unlock_after), s.pass_percent, s.reward_xp, s.reward_gold, q(s.card_code), q(s.badge_code)].join(', ')},`);
  out.push(`     ${json(s.content)},`);
  out.push(`     'published', ${q(NOTE)})`);
  out.push('ON CONFLICT (code) DO NOTHING;');
  out.push('INSERT INTO public.hk_saga_items (stage_id, code, position, kind, usage, objective, prompt, data, explanation, source)');
  out.push('SELECT s.id, v.code, v.position, v.kind, v.usage, v.objective, v.prompt, v.data, v.explanation, v.source FROM public.hk_saga_stages s, (VALUES');
  out.push(s.items.map((i) => `    (${[q(i.code), i.position, q(i.kind), q(i.usage), q(i.objective), q(i.prompt), json(i.data), q(i.explanation), q(i.source)].join(', ')})`).join(',\n'));
  out.push(`) AS v(code, position, kind, usage, objective, prompt, data, explanation, source) WHERE s.code = ${q(s.code)}`);
  out.push('ON CONFLICT (code) DO NOTHING;');
}
out.push('');
out.push('-- ---------------------------------------------------------------------- kho tư liệu: văn bản gốc và mốc niên biểu');
out.push('INSERT INTO public.hk_saga_docs (code, kind, campaign_no, title, subtitle, body, source, source_url, unlock_stage, sort_order) VALUES');
out.push(docs.map((d, i) => `    (${[q(d.code), q(d.kind), d.campaign_no, q(d.title), q(d.subtitle), json(d.body), q(d.source), q(d.source_url), q(d.unlock_stage), d.sort_order ?? (i + 1) * 10].join(', ')})`).join(',\n'));
out.push('ON CONFLICT (code) DO NOTHING;');
out.push('');

const file = path.resolve(__dirname, '../../../database/migrations', `${number}_${name}.sql`);
if (fs.existsSync(file) && !process.argv.includes('--overwrite')) { console.error(`✗ ${path.basename(file)} đã tồn tại. Migration đã áp dụng thì không sinh lại; thêm --overwrite chỉ khi tệp chưa từng được phát hành.`); process.exit(1); }
fs.writeFileSync(file, out.join('\n'), 'utf8');
console.log(`✓ ${path.basename(file)}: ${stages.length} chặng, ${itemCodes.length} câu, ${cards.length} thẻ, ${docs.length} tư liệu, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
