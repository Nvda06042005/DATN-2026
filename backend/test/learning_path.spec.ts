/**
 * Sprint 5 theo ver0.2, lộ trình học dạng đường đi (HK.HS.117–123, 125; HK.AD.080): Phần – Cửa, nút bài học từng bước, nghe kể chuyện, luyện tập,
 * rương, kiểm tra cuối cửa, Cẩm nang, Binh thư; quản trị Cửa và các loại nút mới. HTTP thật trên PostgreSQL tạm với nội dung học mẫu (migration 019, 027).
 */
import { call, hasPostgres, Started, startApp } from './harness';
import { bootstrap, Fixture, publishSeed } from './fixture';
import type { DatabaseService } from '../src/database/database.service';

let s: Started, f: Fixture, db: DatabaseService;
const as = (who: { token: string }) => (method: string, path: string, body?: unknown) => call(s.base, method, path, body, who.token);
const keys = new Map<number, { qtype: string; data: any }>();

function answerOf(questionId: number, right: boolean): unknown {
  const { qtype, data } = keys.get(questionId)!;
  switch (qtype) {
    case 'single': return { choice: right ? data.correct : data.options.find((o: any) => o.id !== data.correct).id };
    case 'multiple': return { choices: right ? data.correct : [data.options.find((o: any) => !data.correct.includes(o.id)).id] };
    case 'truefalse': return { value: right ? data.correct : !data.correct };
    case 'fill': return { blanks: data.blanks.map((b: any) => (right ? b.accept[0] : 'sai')) };
    case 'order': return { order: right ? data.items.map((i: any) => i.id) : [...data.items.map((i: any) => i.id)].reverse() };
    default: return { placements: Object.fromEntries(data.targets.map((t: any) => [t.id, right ? { lat: t.lat, lng: t.lng } : { lat: 10.0, lng: 106.0 }])) };
  }
}

/** Làm hết lượt của một nút; `wrong` là số câu đầu tiên trả lời sai. Trả về kết quả câu cuối cùng và số câu của lượt. */
async function playNode(who: { token: string }, nodeId: number, wrong = 0) {
  const start = await as(who)('POST', `/api/play/nodes/${nodeId}/attempts`);
  expect(start.status).toBe(200);
  let state = start.body;
  const total = state.total as number;
  let last: any;
  for (let i = 0; i < total; i++) {
    if (state.waiting_next) state = (await as(who)('POST', `/api/play/attempts/${state.id}/next`)).body;
    const q = state.current.question;
    last = (await as(who)('POST', `/api/play/attempts/${state.id}/answer`, { question_id: q.id, answer: answerOf(q.id, i >= wrong) })).body;
    if (last.finished) break;
    state = { ...state, waiting_next: true };
  }
  return { last, total };
}

(hasPostgres() ? describe : describe.skip)('Sprint 5 (ver0.2) – lộ trình dạng đường đi', () => {
  let nodes: Record<string, any>; // nút của Phần 1 theo tên ngắn
  let me: (who?: { token: string }) => Promise<any>;
  let binhThu = 0;

  beforeAll(async () => {
    s = await startApp('learning_path_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken, true);
    await publishSeed(s.base, f.root);
    for (const row of await db.query<{ id: number; qtype: string; data: any }>('SELECT id, qtype, data FROM hk_questions')) keys.set(row.id, row);
    me = async (who = f.S1) => (await as(who)('GET', '/api/game/me')).body;
  });
  afterAll(async () => { await s?.close(); });

  const refill = () => db.query('UPDATE hk_players SET hearts = 5 WHERE user_id = $1', [f.S1.id]);

  // ------------------------------------------------------------------ HK.HS.117: xem lộ trình
  test('đường đi gồm 3 Phần, mỗi Phần chia 2 Cửa; chỉ nút đầu mở, nút hiện tại nằm ở Phần 1 – Cửa 1', async () => {
    const res = await as(f.S1)('GET', '/api/play/path');
    expect(res.status).toBe(200);
    const { parts, current } = res.body;
    expect(parts).toHaveLength(3);
    expect(parts.map((p: any) => p.no)).toEqual([1, 2, 3]);
    expect(parts.map((p: any) => p.gates.length)).toEqual([2, 2, 2]);
    expect(parts.map((p: any) => p.totals.nodes)).toEqual([9, 11, 9]);
    const g1 = parts[0].gates[0], g2 = parts[0].gates[1];
    expect(g1.nodes.map((n: any) => n.kind)).toEqual(['lesson', 'listen', 'quiz', 'practice', 'chest', 'gate_test']);
    expect(g2.nodes.map((n: any) => n.kind)).toEqual(['battle', 'chest', 'final']);
    expect(g1.nodes.map((n: any) => n.state)).toEqual(['available', 'locked', 'locked', 'locked', 'locked', 'locked']);
    expect(g1.state).toBe('current');
    expect(g2.state).toBe('locked');
    expect(g1.title).toMatch(/Bình Lệ Nguyên/);
    expect(current).toMatchObject({ part_no: 1, gate_no: 1, node_id: g1.nodes[0].id });
    // Vòng tiến độ của bài học: số bước = số thẻ kiến thức + số câu kiểm tra nhanh
    expect(g1.nodes[0].steps.total).toBeGreaterThanOrEqual(4);
    expect(g1.nodes[0].steps.done).toBe(0);
    nodes = { lesson: g1.nodes[0], listen: g1.nodes[1], quiz: g1.nodes[2], practice: g1.nodes[3], chest: g1.nodes[4], test: g1.nodes[5], battle: g2.nodes[0], chest2: g2.nodes[1], gate1: g1.id, gate3: parts[2].gates[0].id };
  });

  test('nút bị khóa không bắt đầu được: nghe kể chuyện, luyện tập và kiểm tra cuối cửa trả 409', async () => {
    expect((await as(f.S1)('GET', `/api/play/nodes/${nodes.listen.id}/listen`)).status).toBe(409);
    expect((await as(f.S1)('POST', `/api/play/nodes/${nodes.practice.id}/attempts`)).status).toBe(409);
    expect((await as(f.S1)('POST', `/api/play/nodes/${nodes.test.id}/attempts`)).status).toBe(409);
    expect((await as(f.S1)('POST', `/api/play/nodes/${nodes.chest.id}/complete`)).status).toBe(409);
    expect((await as(f.S3)('GET', '/api/play/path')).status).toBe(200); // học sinh chưa vào lớp vẫn học hành trình mặc định
  });

  // ------------------------------------------------------------------ HK.HS.118–119: bài học từng bước
  test('chi tiết nút cho biết số câu, điểm thưởng và Binh thư trước khi vào học', async () => {
    const d = (await as(f.S1)('GET', `/api/play/nodes/${nodes.lesson.id}`)).body;
    expect(d).toMatchObject({ kind: 'lesson', state: 'available', can_start: true, reward_points: 50 });
    expect(d.question_count).toBeGreaterThanOrEqual(1);
    expect(d.reward_binh_thu).toBe(2);
    expect(d.gate.title).toMatch(/Bình Lệ Nguyên/);
    const chest = (await as(f.S1)('GET', `/api/play/nodes/${nodes.chest.id}`)).body;
    expect(chest).toMatchObject({ kind: 'chest', can_start: false, reward_binh_thu: 5 });
    const test = (await as(f.S1)('GET', `/api/play/nodes/${nodes.test.id}`)).body;
    expect(test).toMatchObject({ kind: 'gate_test', needs_quiz: true, pass_percent: 70 });
    expect(test.question_count).toBeGreaterThanOrEqual(3);
  });

  test('học từng bước: câu sai mất một tim, có giải thích và được ghi vào câu cần luyện lại; đọc hết và trả lời đúng mới xong bài, nhận Binh thư', async () => {
    const lesson = (await as(f.S1)('GET', `/api/play/nodes/${nodes.lesson.id}/lesson`)).body;
    expect(lesson.blocks.length).toBeGreaterThanOrEqual(3);
    expect(lesson.checks.length).toBeGreaterThanOrEqual(1);
    const hearts0 = (await me()).hearts.current;
    const qid = lesson.checks[0].id;
    const wrong = await as(f.S1)('POST', `/api/play/nodes/${nodes.lesson.id}/lesson/check`, { question_id: qid, answer: answerOf(qid, false) });
    expect(wrong.status).toBe(200);
    expect(wrong.body.correct).toBe(false);
    expect((await me()).hearts.current).toBe(hearts0 - 1);
    expect((await as(f.S1)('GET', '/api/play/practice')).body.some((x: any) => x.question_id === qid)).toBe(true);
    const right = await as(f.S1)('POST', `/api/play/nodes/${nodes.lesson.id}/lesson/check`, { question_id: qid, answer: answerOf(qid, true) });
    expect(right.body.correct).toBe(true);
    expect((await me()).hearts.current).toBe(hearts0 - 1); // đúng không mất tim
    // câu không thuộc bài học này thì không chấm
    expect((await as(f.S1)('POST', `/api/play/nodes/${nodes.lesson.id}/lesson/check`, { question_id: 999999, answer: {} })).status).toBe(404);
    // chưa đọc hết thì chưa hoàn thành được
    const answers = lesson.checks.map((c: any) => ({ question_id: c.id, answer: answerOf(c.id, true) }));
    expect((await as(f.S1)('POST', `/api/play/nodes/${nodes.lesson.id}/lesson/complete`, { answers })).status).toBe(409);
    await as(f.S1)('POST', `/api/play/nodes/${nodes.lesson.id}/lesson/progress`, { read_percent: 100 });
    const done = await as(f.S1)('POST', `/api/play/nodes/${nodes.lesson.id}/lesson/complete`, { answers });
    expect(done.body.completed).toBe(true);
    expect(done.body.node.rewards.binh_thu).toBe(2);
    binhThu += 2;
    expect((await me()).binh_thu).toBe(binhThu);
    const path = (await as(f.S1)('GET', '/api/play/path')).body;
    const first = path.parts[0].gates[0].nodes[0];
    expect(first.state).toBe('done');
    expect(first.steps.done).toBe(first.steps.total);
    expect(path.parts[0].gates[0].nodes[1].state).toBe('available');
  });

  // ------------------------------------------------------------------ HK.HS.121: nghe kể chuyện, luyện tập
  test('nghe kể chuyện: lời kể tách thành dòng phụ đề, nghe xong hoàn thành nút và nhận Binh thư một lần', async () => {
    const l = (await as(f.S1)('GET', `/api/play/nodes/${nodes.listen.id}/listen`)).body;
    expect(l.lines.length).toBeGreaterThanOrEqual(3);
    expect(l.audio_url).toBeNull();
    expect(l.has_quiz).toBe(false);
    const done = await as(f.S1)('POST', `/api/play/nodes/${nodes.listen.id}/complete`);
    expect(done.status).toBe(200);
    expect(done.body.rewards.binh_thu).toBe(2);
    binhThu += 2;
    const again = await as(f.S1)('POST', `/api/play/nodes/${nodes.listen.id}/complete`);
    expect(again.body.rewards.binh_thu).toBe(0); // không thưởng lần hai
    expect((await me()).binh_thu).toBe(binhThu);
    // nút bài học không dùng đường nghe kể chuyện
    expect((await as(f.S1)('GET', `/api/play/nodes/${nodes.lesson.id}/listen`)).status).toBe(409);
  });

  test('luyện tập tự ghép tối đa 8 câu đã gặp trong Cửa; sai không mất tim, chỉ cần đúng một câu để hoàn thành', async () => {
    expect((await playNode(f.S1, nodes.quiz.id)).last.finished).toBe(true);
    const quiz = (await as(f.S1)('GET', `/api/play/campaigns/${(await as(f.S1)('GET', '/api/play/home')).body.campaigns[0].id}/map`)).body.nodes.find((n: any) => n.id === nodes.quiz.id);
    expect(quiz.state).toBe('done');
    await refill();
    const hearts = (await me()).hearts.current;
    const { last, total } = await playNode(f.S1, nodes.practice.id, 1);
    expect(total).toBeGreaterThanOrEqual(3);
    expect(total).toBeLessThanOrEqual(8);
    expect(last.finished).toBe(true);
    expect((await me()).hearts.current).toBe(hearts); // luyện tập: sai không mất tim
    const path = (await as(f.S1)('GET', '/api/play/path')).body;
    expect(path.parts[0].gates[0].nodes[3].state).toBe('done');
    binhThu += 2 + 1; // nút câu hỏi (mặc định 2) + luyện tập (mặc định 1)
    expect((await me()).binh_thu).toBe(binhThu);
  });

  // ------------------------------------------------------------------ HK.HS.120, 122: rương và kiểm tra cuối cửa
  test('mở rương: nhận vàng và Binh thư riêng của nút một lần', async () => {
    const goldBefore = (await me()).gold;
    const open = await as(f.S1)('POST', `/api/play/nodes/${nodes.chest.id}/complete`);
    expect(open.status).toBe(200);
    expect(open.body.rewards).toMatchObject({ gold: 10, binh_thu: 5 });
    // Sprint 6 ver0.2: rương trao thêm mảnh của một thẻ tướng (thường và hiếm 2 mảnh, sử thi và huyền thoại 1 mảnh), chỉ ở lần mở đầu tiên
    expect(open.body.rewards.fragments).toHaveLength(1);
    expect(open.body.rewards.fragments[0].qty).toBeGreaterThanOrEqual(1);
    const frag = (await db.query<{ qty: number; owned: boolean }>('SELECT COALESCE(sum(f.qty), 0)::int AS qty, EXISTS (SELECT 1 FROM hk_user_cards u WHERE u.user_id = $1) AS owned FROM hk_card_fragments f WHERE f.user_id = $1', [f.S1.id]))[0];
    expect(frag.qty + (frag.owned ? 1 : 0)).toBeGreaterThanOrEqual(1);
    binhThu += 5;
    const hud = await me();
    expect(hud.binh_thu).toBe(binhThu);
    expect(hud.gold).toBeGreaterThanOrEqual(goldBefore + 10);
    expect((await as(f.S1)('POST', `/api/play/nodes/${nodes.chest.id}/complete`)).body.rewards).toMatchObject({ gold: 0, binh_thu: 0, fragments: [] });
    expect((await db.query<{ n: string }>('SELECT count(*) AS n FROM hk_binh_thu_ledger WHERE user_id = $1', [f.S1.id]))[0].n).toBe('5');
  });

  test('kiểm tra cuối cửa: dưới 70% chưa qua cửa, từ 70% mới mở Cửa kế tiếp', async () => {
    await refill();
    const total = (await as(f.S1)('GET', `/api/play/nodes/${nodes.test.id}`)).body.question_count as number;
    const failed = await playNode(f.S1, nodes.test.id, Math.ceil(total * 0.4));
    expect(failed.last.summary.passed).toBe(false);
    let path = (await as(f.S1)('GET', '/api/play/path')).body;
    expect(path.parts[0].gates[0].nodes[5].state).toBe('available');
    expect(path.parts[0].gates[1].nodes[0].state).toBe('locked');
    await refill();
    const passed = await playNode(f.S1, nodes.test.id, 0);
    expect(passed.last.finished).toBe(true);
    path = (await as(f.S1)('GET', '/api/play/path')).body;
    expect(path.parts[0].gates[0].state).toBe('done');
    expect(path.parts[0].gates[1].state).toBe('current');
    expect(path.parts[0].gates[1].nodes[0].state).toBe('available');
    expect(path.current).toMatchObject({ part_no: 1, gate_no: 2, node_id: nodes.battle.id });
    binhThu += 6; // kiểm tra cuối cửa lần đầu (mặc định 6)
    expect((await me()).binh_thu).toBe(binhThu);
  });

  // ------------------------------------------------------------------ HK.HS.123: Cẩm nang
  test('Cẩm nang tự tạo từ kho lịch sử: mốc thời gian, nhân vật, địa danh, thuật ngữ; Cửa lạ trả 404', async () => {
    const g = (await as(f.S1)('GET', `/api/play/gates/${nodes.gate3}/guide`)).body;
    expect(g.gate.title).toMatch(/Vân Đồn/);
    expect(g.milestones.some((m: any) => m.type === 'battle' && /Vân Đồn/.test(m.name))).toBe(true);
    expect(g.milestones.map((m: any) => m.year)).toEqual([...g.milestones.map((m: any) => m.year)].sort((a: number, b: number) => a - b));
    expect(g.figures.length).toBeGreaterThanOrEqual(1);
    const first = (await as(f.S1)('GET', `/api/play/gates/${nodes.gate1}/guide`)).body;
    expect(first.figures.length + first.milestones.length).toBeGreaterThan(0);
    expect((await as(f.S1)('GET', '/api/play/gates/999999/guide')).status).toBe(404);
  });

  test('Binh thư chỉ ghi một lần cho mỗi nút và cấu hình mặc định sửa được ở trang quản trị tổng', async () => {
    const dup = await db.query('INSERT INTO hk_binh_thu_ledger (user_id, delta, reason, ref_key) VALUES ($1, 3, $2, $3) ON CONFLICT DO NOTHING RETURNING id', [f.S1.id, 'node', `node:${nodes.lesson.id}`]);
    expect(dup).toHaveLength(0);
    const rules = (await call(s.base, 'GET', '/api/game/admin/settings', undefined, f.root)).body;
    expect(rules.rules['binh_thu.chest_default']).toBeDefined();
    expect(rules.values.binh_thu).toEqual({ node_first: 2, practice_first: 1, gate_test_first: 6, battle_first: 4, final_first: 10, chest_default: 5 });
    expect((await call(s.base, 'PUT', '/api/game/admin/settings', { binh_thu: { chest_default: 2000 } }, f.root)).status).toBe(400);
    const saved = await call(s.base, 'PUT', '/api/game/admin/settings', { binh_thu: { chest_default: 7 } }, f.root);
    expect(saved.body.values.binh_thu.chest_default).toBe(7);
    // nút rương không đặt riêng dùng mức mặc định mới
    const chestRow = (await db.query<{ id: number }>("SELECT id FROM hk_nodes WHERE kind = 'chest' ORDER BY id LIMIT 1"))[0];
    await db.query('UPDATE hk_nodes SET reward_binh_thu = NULL WHERE id = $1', [chestRow.id]);
    expect((await as(f.S1)('GET', `/api/play/nodes/${chestRow.id}`)).body.reward_binh_thu).toBe(7);
    await call(s.base, 'PUT', '/api/game/admin/settings', { binh_thu: { chest_default: 5 } }, f.root);
  });

  // ------------------------------------------------------------------ HK.AD.080: quản trị Cửa và nút mới
  describe('quản trị Cửa và các loại nút mới', () => {
    let J: number, G: number, G2: number, campaign: number, lessonId: number;
    const T = () => f.T1;

    beforeAll(async () => {
      campaign = (await db.query<{ id: number }>("SELECT id FROM hist_campaigns WHERE status = 'published' ORDER BY sort_order, id LIMIT 1"))[0].id;
      lessonId = (await db.query<{ id: number }>("SELECT l.id FROM hk_lessons l WHERE l.status = 'published' AND EXISTS (SELECT 1 FROM hk_lesson_checks k WHERE k.lesson_id = l.id) ORDER BY l.id LIMIT 1"))[0].id;
    });

    test('tạo Cửa; Cửa trống thì luyện tập chưa phát hành được (không có câu để ôn)', async () => {
      J = (await as(T())('POST', '/api/content/journeys', { title: 'Hành trình thử Cửa', campaign_id: campaign })).body.id;
      const withGate = await as(T())('POST', `/api/content/journeys/${J}/gates`, { title: 'Cửa một', summary: 'Mở đầu', guide_note: 'Nhớ các mốc năm' });
      expect(withGate.status).toBe(201);
      G = withGate.body.gates[0].id;
      expect(withGate.body.gates[0]).toMatchObject({ title: 'Cửa một', position: 1, guide_note: 'Nhớ các mốc năm' });
      expect((await as(T())('POST', `/api/content/journeys/${J}/gates`, { title: 'x' })).status).toBe(400);
      const practice = await as(T())('POST', `/api/content/journeys/${J}/nodes`, { kind: 'practice', gate_id: G });
      expect(practice.status).toBe(201);
      const node = practice.body.nodes[0];
      expect(node).toMatchObject({ kind: 'practice', kind_label: 'Luyện tập', icon: 'dumbbell', pass_percent: 1, gate_id: G });
      expect(practice.body.problems.join(' ')).toMatch(/Cửa chưa có bài học hoặc bộ câu hỏi/);
      // thêm bài học có câu kiểm tra vào Cửa thì Cửa đã có câu để ôn
      const lesson = await as(T())('POST', `/api/content/journeys/${J}/nodes`, { kind: 'lesson', lesson_id: lessonId, gate_id: G });
      expect(lesson.status).toBe(201);
      expect(lesson.body.problems.join(' ')).not.toMatch(/Cửa chưa có bài học/);
      // nút mới của Cửa chèn vào cuối Cửa: bài học đứng sau luyện tập (cùng Cửa, thêm sau)
      expect(lesson.body.nodes.map((n: any) => n.kind)).toEqual(['practice', 'lesson']);
    });

    test('kiểm tra nội dung từng loại nút mới: nghe kể chuyện, rương, Cửa và Binh thư', async () => {
      const add = (body: Record<string, unknown>) => as(T())('POST', `/api/content/journeys/${J}/nodes`, body);
      expect((await add({ kind: 'listen', gate_id: G })).status).toBe(400); // thiếu lời kể và âm thanh
      expect((await add({ kind: 'listen', gate_id: G, audio_url: 'http://example.com/a.mp3' })).status).toBe(400);
      expect((await add({ kind: 'chest', gate_id: G, reward_binh_thu: 2000 })).status).toBe(400);
      expect((await add({ kind: 'chest', gate_id: 999999 })).status).toBe(400);
      const listen = await add({ kind: 'listen', gate_id: G, title: 'Nghe thử', transcript: 'Dòng một.\nDòng hai.', audio_url: 'https://example.com/a.mp3' });
      expect(listen.status).toBe(201);
      const l = listen.body.nodes.find((n: any) => n.kind === 'listen');
      expect(l).toMatchObject({ audio_url: 'https://example.com/a.mp3', transcript: 'Dòng một.\nDòng hai.', gate_id: G, reward_points: 30 });
      const chest = await add({ kind: 'chest', gate_id: G, reward_gold: 12, reward_binh_thu: 0 });
      const c = chest.body.nodes.find((n: any) => n.kind === 'chest');
      expect(c).toMatchObject({ reward_binh_thu: 0, reward_gold: 12, icon: 'chest' });
      // kiểm tra cuối cửa mặc định 70% và có thể kèm bộ đề riêng
      const test = await add({ kind: 'gate_test', gate_id: G });
      expect(test.body.nodes.find((n: any) => n.kind === 'gate_test')).toMatchObject({ pass_percent: 70, quiz_id: null });
      // đổi Cửa của nút: chỉ nhận Cửa cùng hành trình
      const other = (await as(T())('POST', '/api/content/journeys', { title: 'Hành trình khác', campaign_id: campaign })).body.id;
      G2 = (await as(T())('POST', `/api/content/journeys/${other}/gates`, { title: 'Cửa khác' })).body.gates[0].id;
      expect((await as(T())('PUT', `/api/content/nodes/${c.id}`, { gate_id: G2 })).status).toBe(400);
      expect((await as(T())('PUT', `/api/content/nodes/${c.id}`, { gate_id: null, reward_binh_thu: null })).body.nodes.find((n: any) => n.id === c.id)).toMatchObject({ gate_id: null, reward_binh_thu: null });
    });

    test('nhân bản hành trình sao cả Cửa; xóa Cửa chỉ gỡ nhóm, các nút còn nguyên', async () => {
      const copy = await as(T())('POST', `/api/content/journeys/${J}/copy`, {});
      expect(copy.status).toBe(200);
      expect(copy.body.gates).toHaveLength(1);
      expect(copy.body.gates[0].id).not.toBe(G);
      expect(copy.body.nodes.filter((n: any) => n.gate_id === copy.body.gates[0].id).length).toBeGreaterThanOrEqual(3);
      expect(copy.body.nodes.every((n: any) => n.gate_id !== G)).toBe(true);
      const before = (await as(T())('GET', `/api/content/journeys/${J}`)).body.nodes.length;
      const removed = await as(T())('DELETE', `/api/content/gates/${G}`);
      expect(removed.status).toBe(200);
      expect(removed.body.gates).toHaveLength(0);
      expect(removed.body.nodes).toHaveLength(before);
      expect(removed.body.nodes.every((n: any) => n.gate_id === null)).toBe(true);
      // người khác không sửa được Cửa của giáo viên
      expect((await as(f.T2)('PUT', `/api/content/gates/${copy.body.gates[0].id}`, { title: 'Chiếm quyền' })).status).toBe(404);
    });
  });
});
