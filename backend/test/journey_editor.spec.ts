/**
 * Sprint 7, trình soạn hành trình (HK.GV.022–028, HK.HS.019–022 với bản đồ rẽ nhánh): vị trí nút và đường nối, điều kiện mở khóa, phần thưởng riêng của nút,
 * xem trước như học sinh, giao cho lớp theo lịch (nhiều hành trình), nhân bản sang lớp khác, tiến độ lớp và học sinh chậm.
 * HTTP thật trên PostgreSQL tạm; nội dung học khởi tạo (migration 019) được công bố để dùng làm nút.
 */
import { call, hasPostgres, Started, startApp } from './harness';
import { bootstrap, Fixture, publishSeed } from './fixture';
import type { DatabaseService } from '../src/database/database.service';

let s: Started, f: Fixture, db: DatabaseService;
const HOUR = 3_600_000, DAY = 86_400_000;
const as = (who: { token: string }) => (method: string, path: string, body?: unknown) => call(s.base, method, path, body, who.token);
const api = (method: string, path: string, body?: unknown, token = f.T1.token) => call(s.base, method, path, body, token);
const keys = new Map<number, { qtype: string; data: any }>();
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

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

/** Làm hết một nút câu hỏi; `right(i)` cho biết câu thứ i trả lời đúng hay sai */
async function playNode(who: { token: string }, nodeId: number, right: (index: number) => boolean = () => true) {
  const start = await as(who)('POST', `/api/play/nodes/${nodeId}/attempts`);
  expect(start.status).toBe(200);
  let state = start.body;
  let last: any;
  for (let i = 0; i < state.total; i++) {
    if (state.waiting_next) state = (await as(who)('POST', `/api/play/attempts/${state.id}/next`)).body;
    const q = state.current.question;
    last = (await as(who)('POST', `/api/play/attempts/${state.id}/answer`, { question_id: q.id, answer: answerOf(q.id, right(i)) })).body;
    if (last.finished) break;
    state = { ...state, waiting_next: true };
  }
  return last;
}

(hasPostgres() ? describe : describe.skip)('Sprint 7 – trình soạn hành trình', () => {
  let campaignId: number, classId: number, ownClass: number;
  let quizzes: number[], cardId: number, badgeId: number;
  let J: number; // hành trình của giáo viên: A → (B, C) → D
  let A: number, B: number, C: number, D: number;
  const stateOf = (view: any, id: number) => view.nodes.find((n: any) => n.id === id);
  const mapOf = async (who: { token: string }) => (await as(who)('GET', `/api/play/campaigns/${campaignId}/map`)).body;

  beforeAll(async () => {
    s = await startApp('journey_editor_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken, true);
    await publishSeed(s.base, f.root);
    classId = f.class7a.id;
    for (const row of await db.query<{ id: number; qtype: string; data: any }>('SELECT id, qtype, data FROM hk_questions')) keys.set(row.id, row);
    campaignId = (await db.query<{ id: number }>("SELECT id FROM hist_campaigns WHERE status = 'published' ORDER BY sort_order, id LIMIT 1"))[0].id;
    quizzes = (await db.query<{ id: number }>("SELECT z.id FROM hk_quizzes z WHERE z.scope = 'system' AND (SELECT count(*) FROM hk_quiz_questions k WHERE k.quiz_id = z.id) >= 3 ORDER BY z.id LIMIT 4")).map((r) => r.id);
    cardId = (await db.query<{ id: number }>('SELECT id FROM hk_cards WHERE is_active ORDER BY id LIMIT 1'))[0].id;
    badgeId = (await db.query<{ id: number }>("SELECT id FROM hk_badges WHERE scope = 'system' AND is_active ORDER BY id LIMIT 1"))[0].id;
    ownClass = (await api('POST', '/api/classroom/classes', { name: '7A9', grade: 7 })).body.id;
  });
  afterAll(async () => { await s?.close(); });

  // ------------------------------------------------------------------ dựng hành trình
  test('dựng hành trình: giáo viên tạo hành trình riêng và thêm bốn nút (hai câu hỏi rẽ nhánh, một câu hỏi, trận Quyết chiến)', async () => {
    const created = await api('POST', '/api/content/journeys', { title: 'Hành trình rẽ nhánh', campaign_id: campaignId });
    expect(created.status).toBe(201);
    J = created.body.id;
    const add = async (body: Record<string, unknown>) => (await api('POST', `/api/content/journeys/${J}/nodes`, body)).body;
    await add({ kind: 'quiz', quiz_id: quizzes[0], title: 'Nút A: khởi đầu', pass_percent: 40 });
    await add({ kind: 'quiz', quiz_id: quizzes[1 % quizzes.length], title: 'Nút B: nhánh phải' });
    await add({ kind: 'quiz', quiz_id: quizzes[2 % quizzes.length], title: 'Nút C: nhánh trái' });
    const full = await add({ kind: 'final', quiz_id: quizzes[0], title: 'Nút D: quyết chiến' });
    [A, B, C, D] = full.nodes.map((n: any) => n.id);
    expect(full.nodes.map((n: any) => n.kind)).toEqual(['quiz', 'quiz', 'quiz', 'final']);
    expect(full.edges).toEqual([]);
    expect(full.nodes[0]).toMatchObject({ pos_x: null, pos_y: null, min_percent: null, reward_gold: 0 });
  });

  // ------------------------------------------------------------------ HK.GV.022
  test('HK.GV.022 kéo thả vị trí nút và nối đường: kiểm tra vị trí, nút lạ, vòng lặp, nút Quyết chiến; hợp lệ thì lưu', async () => {
    const layout = (body: unknown, token = f.T1.token) => api('PUT', `/api/content/journeys/${J}/layout`, body, token);
    expect((await layout({ nodes: [{ id: A, x: 120, y: 10 }] })).status).toBe(400); // ngoài khoảng phần trăm
    expect((await layout({ nodes: [{ id: A, x: -1, y: 10 }] })).status).toBe(400);
    expect((await layout({ nodes: [{ id: 987654, x: 10, y: 10 }] })).status).toBe(400); // nút không thuộc hành trình
    expect((await layout({ edges: [{ from: A, to: A }] })).status).toBe(400);
    expect((await layout({ edges: [{ from: A, to: 987654 }] })).status).toBe(400);
    expect((await layout({ edges: [{ from: A, to: B }, { from: B, to: A }, { from: B, to: D }] })).status).toBe(422); // vòng lặp
    expect((await layout({ edges: [{ from: A, to: B }] })).status).toBe(422); // trận Quyết chiến chưa có đường vào
    expect((await layout({ edges: [{ from: A, to: B }, { from: B, to: D }, { from: D, to: C }] })).status).toBe(422); // trận Quyết chiến là nút cuối
    expect((await layout({ nodes: [{ id: A, x: 50, y: 5 }] }, f.T2.token)).status).toBe(404); // hành trình riêng của giáo viên khác
    expect((await layout({ nodes: [{ id: A, x: 50, y: 5 }] }, f.S1.token)).status).toBe(403);

    const ok = await layout({
      nodes: [{ id: A, x: 50, y: 8.126 }, { id: B, x: 25, y: 35 }, { id: C, x: 75, y: 35 }, { id: D, x: 50, y: 70 }],
      edges: [{ from: A, to: B }, { from: A, to: C }, { from: B, to: D }, { from: C, to: D }, { from: A, to: B }], // đường trùng được gộp
    });
    expect(ok.status).toBe(200);
    expect(ok.body.edges).toHaveLength(4);
    expect(ok.body.nodes.map((n: any) => [n.pos_x, n.pos_y])).toEqual([[50, 8.13], [25, 35], [75, 35], [50, 70]]);
    // xóa vị trí của một nút (về tự xếp) và đặt lại
    expect((await layout({ nodes: [{ id: C, x: null, y: null }] })).body.nodes[2]).toMatchObject({ pos_x: null, pos_y: null });
    await layout({ nodes: [{ id: C, x: 75, y: 35 }] });
    expect((await api('GET', `/api/content/journeys/${J}`)).body.edges).toHaveLength(4);
  });

  // ------------------------------------------------------------------ HK.GV.023, 024, 025
  test('HK.GV.023 điều kiện mở khóa: điểm tối thiểu, số sao, ngày giờ mở; kiểm tra khoảng giá trị', async () => {
    const upd = (id: number, body: Record<string, unknown>) => api('PUT', `/api/content/nodes/${id}`, body);
    expect((await upd(B, { min_percent: 0 })).status).toBe(400);
    expect((await upd(B, { min_percent: 101 })).status).toBe(400);
    expect((await upd(B, { min_stars: 4 })).status).toBe(400);
    expect((await upd(B, { opens_at: 'không phải ngày' })).status).toBe(400);
    const res = await upd(B, { min_percent: 80, min_stars: 2 });
    expect(res.body.nodes[1]).toMatchObject({ min_percent: 80, min_stars: 2 });
    const opens = iso(48 * HOUR);
    const r2 = await upd(C, { opens_at: opens });
    expect(new Date(r2.body.nodes[2].opens_at).toISOString()).toBe(opens);
    expect((await upd(C, { opens_at: null })).body.nodes[2].opens_at).toBeNull(); // bỏ điều kiện
    await upd(C, { opens_at: opens });
  });

  test('HK.GV.024 phần thưởng riêng của nút: vàng, thẻ nhân vật, huy hiệu; kiểm tra tồn tại và giới hạn', async () => {
    const upd = (id: number, body: Record<string, unknown>) => api('PUT', `/api/content/nodes/${id}`, body);
    const options = (await api('GET', '/api/content/reward-options')).body; // thẻ và huy hiệu có thể đặt làm thưởng
    expect(options.cards.map((x: any) => x.id)).toContain(cardId);
    expect(options.badges.map((x: any) => x.id)).toContain(badgeId);
    expect((await api('GET', '/api/content/reward-options', undefined, f.S1.token)).status).toBe(403);
    expect((await upd(B, { reward_gold: 1001 })).status).toBe(400);
    expect((await upd(B, { reward_gold: -1 })).status).toBe(400);
    expect((await upd(B, { reward_card_id: 987654 })).status).toBe(400);
    expect((await upd(B, { reward_badge_id: 987654 })).status).toBe(400);
    const res = await upd(B, { reward_gold: 30, reward_card_id: cardId, reward_badge_id: badgeId, reward_points: 80 });
    expect(res.body.nodes[1]).toMatchObject({ reward_gold: 30, reward_card_id: cardId, reward_badge_id: badgeId, reward_points: 80 });
    // đổi nội dung nút vẫn giữ điều kiện và thưởng đã đặt
    expect((await upd(B, { title: 'Nút B: nhánh phải (đổi tên)' })).body.nodes[1]).toMatchObject({ min_percent: 80, reward_gold: 30 });
  });

  test('HK.GV.025 xem trước như học sinh: trạng thái nút theo danh sách nút đánh dấu hoàn thành, điều kiện giờ mở; không ghi vào dữ liệu học sinh', async () => {
    const preview = async (completed: number[], hours = 0) => (await api('POST', `/api/content/journeys/${J}/preview`, { completed, hours })).body;
    const p0 = await preview([]);
    expect(p0.edges).toHaveLength(4);
    expect(p0.nodes.map((n: any) => n.state)).toEqual(['available', 'locked', 'locked', 'locked']);
    expect(stateOf(p0, B).lock_reason).toBe('Hoàn thành "Nút A: khởi đầu" trước');
    expect(stateOf(p0, B).preds).toEqual([A]);
    expect(stateOf(p0, D).preds.sort()).toEqual([B, C].sort());
    expect(p0.totals).toEqual({ nodes: 4, done: 0 });
    const p1 = await preview([A]); // xong A: rẽ nhánh, B mở; C còn chờ ngày mở
    expect(p1.nodes.map((n: any) => n.state)).toEqual(['done', 'available', 'locked', 'locked']);
    expect(stateOf(p1, C).lock_reason).toMatch(/^Mở lúc /);
    expect(stateOf(await preview([A], 72), C).state).toBe('available'); // sau 72 giờ nút C đã mở
    const p2 = await preview([A, B], 72);
    expect(stateOf(p2, D).state).toBe('locked'); // trận Quyết chiến cần cả hai nhánh
    expect(stateOf(p2, D).lock_reason).toBe('Hoàn thành "Nút C: nhánh trái" trước');
    expect(stateOf(await preview([A, B, C], 72), D).state).toBe('available');
    expect((await preview([A, B, C, D], 72)).totals.done).toBe(4);
    expect(Number((await db.query<any>('SELECT count(*) AS n FROM hk_node_progress p JOIN hk_nodes n ON n.id = p.node_id WHERE n.journey_id = $1', [J]))[0].n)).toBe(0);
    expect((await api('POST', `/api/content/journeys/${J}/preview`, { completed: [A] }, f.T2.token)).status).toBe(404);
  });

  // ------------------------------------------------------------------ HK.GV.026
  test('HK.GV.026 giao cho lớp theo lịch: kiểm tra lớp và ngày; chưa tới ngày bắt đầu thì học sinh vẫn học hành trình mặc định', async () => {
    const assign = (body: unknown, id = J, token = f.T1.token) => api('POST', `/api/content/journeys/${id}/classes`, body, token);
    expect((await assign({ class_ids: [f.class7b.id] })).status).toBe(403); // lớp của giáo viên khác
    expect((await assign({ class_ids: [] })).status).toBe(400);
    expect((await assign({ class_ids: [classId], ends_at: iso(-HOUR) })).status).toBe(400);
    expect((await assign({ class_ids: [classId], starts_at: iso(3 * DAY), ends_at: iso(DAY) })).status).toBe(400);
    expect((await assign({ class_ids: [classId], starts_at: 'mai' })).status).toBe(400);
    const future = await assign({ class_ids: [classId], starts_at: iso(2 * DAY), ends_at: iso(30 * DAY) });
    expect(future.status).toBe(200);
    expect(future.body.status).toBe('published'); // việc giao tự phát hành
    expect(future.body.classes[0]).toMatchObject({ id: classId, name: '7A1' });
    expect(future.body.classes[0].starts_at).toBeTruthy();
    // chưa tới ngày bắt đầu: học sinh học hành trình mặc định của hệ thống
    const before = await mapOf(f.S1);
    expect(before.journey).toMatchObject({ from_class: false, is_default: true });
    expect((await api('PUT', `/api/content/journeys/${J}/classes/${classId}/schedule`, { starts_at: iso(DAY), ends_at: iso(-HOUR) })).status).toBe(400);
    expect((await api('PUT', `/api/content/journeys/${J}/classes/${f.class7b.id}/schedule`, { starts_at: null, ends_at: null })).status).toBe(404);
    expect((await api('PUT', `/api/content/journeys/${J}/classes/${classId}/schedule`, { starts_at: null, ends_at: iso(30 * DAY) })).status).toBe(200); // bắt đầu ngay
    const now = await mapOf(f.S1);
    expect(now.journey).toMatchObject({ id: J, from_class: true });
    expect(now.nodes.map((n: any) => n.state)).toEqual(['available', 'locked', 'locked', 'locked']);
    // bản đồ rẽ nhánh gửi cho học sinh vị trí, đường vào và lý do khóa
    expect(now.nodes[0]).toMatchObject({ pos_x: 50, pos_y: 8.13, preds: [], lock_reason: null });
    expect(now.nodes[1]).toMatchObject({ preds: [A], lock_reason: 'Hoàn thành "Nút A: khởi đầu" trước', min_percent: 80, reward_gold: 30, has_reward_card: true, has_reward_badge: true });
    expect(now.nodes[3].preds.sort()).toEqual([B, C].sort());
    expect(now.current_node_id).toBe(A);
    expect((await as(f.S1)('GET', `/api/classroom/my-classes/${classId}`)).body.journeys.find((j: any) => j.journey_id === J)).toMatchObject({ state: 'running' });
    // hết hạn: học sinh quay về hành trình mặc định và lớp không còn liệt kê hành trình đó
    await db.query('UPDATE hk_class_journeys SET ends_at = now() - interval \'1 hour\' WHERE journey_id = $1', [J]);
    expect((await mapOf(f.S1)).journey).toMatchObject({ from_class: false });
    expect((await as(f.S1)('GET', `/api/classroom/my-classes/${classId}`)).body.journeys.find((j: any) => j.journey_id === J)).toBeUndefined();
    await db.query('UPDATE hk_class_journeys SET ends_at = now() + interval \'30 days\' WHERE journey_id = $1', [J]);
  });

  // ------------------------------------------------------------------ học sinh học trên bản đồ rẽ nhánh
  test('HK.HS.019–022 học sinh học trên bản đồ rẽ nhánh: điểm tối thiểu giữ khóa nhánh, làm lại đạt điểm thì mở; phần thưởng nút trao một lần', async () => {
    const r1 = await playNode(f.S1, A, (i) => i !== 0); // 2/3 câu đúng, đạt (điểm đạt của nút là 40%) nhưng dưới 80%
    expect(r1.finished).toBe(true);
    let map = await mapOf(f.S1);
    expect(stateOf(map, A)).toMatchObject({ state: 'done' });
    expect(stateOf(map, A).best_percent).toBeLessThan(80);
    expect(stateOf(map, B)).toMatchObject({ state: 'locked', lock_reason: 'Đạt ít nhất 80% ở "Nút A: khởi đầu"' });
    expect(stateOf(map, C).state).toBe('locked'); // còn chờ ngày mở
    await playNode(f.S1, A, () => true);
    map = await mapOf(f.S1);
    expect(stateOf(map, A).best_percent).toBe(100);
    expect(stateOf(map, B).state).toBe('available');
    expect((await as(f.S1)('POST', `/api/play/nodes/${C}/attempts`)).status).toBe(409); // nút còn khóa không làm được

    const goldRows = async () => Number((await db.query<any>("SELECT count(*) AS n FROM hk_gold_ledger WHERE user_id = $1 AND ref_key = $2", [f.S1.id, `nodegold:${B}`]))[0].n);
    const cardRows = async () => Number((await db.query<any>('SELECT count(*) AS n FROM hk_card_drops WHERE user_id = $1 AND node_id = $2', [f.S1.id, B]))[0].n);
    const badgeRows = async () => Number((await db.query<any>('SELECT count(*) AS n FROM hk_user_badges WHERE user_id = $1 AND badge_id = $2', [f.S1.id, badgeId]))[0].n);
    const goldBefore = (await as(f.S1)('GET', '/api/game/me')).body.gold;
    const done = await playNode(f.S1, B, () => true);
    expect(done.summary.node_result).toMatchObject({ first_completion: true, rewards: { gold: 30, card: true, badge: expect.any(String) } });
    expect((await as(f.S1)('GET', '/api/game/me')).body.gold - goldBefore).toBeGreaterThanOrEqual(30);
    expect([await goldRows(), await cardRows(), await badgeRows()]).toEqual([1, 1, 1]);
    const again = await playNode(f.S1, B, () => true); // chơi lại: không thưởng thêm
    expect(again.summary.node_result.rewards).toEqual({ gold: 0, card: false, badge: null });
    expect([await goldRows(), await cardRows(), await badgeRows()]).toEqual([1, 1, 1]);
    // hành trình đã có học sinh học: không đổi đường nối nhưng vẫn đổi được vị trí
    const layout = (body: unknown) => api('PUT', `/api/content/journeys/${J}/layout`, body);
    expect((await layout({ edges: [{ from: A, to: B }, { from: B, to: C }, { from: C, to: D }] })).status).toBe(409);
    expect((await layout({ nodes: [{ id: B, x: 20, y: 38 }] })).status).toBe(200);
    expect((await layout({ edges: [{ from: A, to: B }, { from: A, to: C }, { from: B, to: D }, { from: C, to: D }] })).status).toBe(200); // giữ nguyên
    expect((await api('PUT', `/api/content/nodes/${A}`, { quiz_id: quizzes[3 % quizzes.length], pass_percent: 50 })).status).toBe(409); // đã có người hoàn thành
  });

  // ------------------------------------------------------------------ HK.GV.028, HK.GV.007
  test('HK.GV.028 tiến độ lớp trên bản đồ: số học sinh đã xong và đang ở từng nút, học sinh học chậm; HK.GV.007 danh sách lớp có tiến độ trung bình', async () => {
    const pr = (await api('GET', `/api/classroom/classes/${classId}/progress`)).body;
    expect(pr.journey).toMatchObject({ id: J, title: 'Hành trình rẽ nhánh' });
    expect(pr.journeys.map((j: any) => j.id)).toEqual([J]);
    expect(pr.nodes.map((n: any) => [n.id, n.done])).toEqual([[A, 1], [B, 1], [C, 0], [D, 0]]);
    const byId = Object.fromEntries(pr.students.map((x: any) => [x.id, x]));
    expect(byId[f.S1.id]).toMatchObject({ done: 2, total: 4, percent: 50, behind: false, current_node: null });
    expect(byId[f.S2.id]).toMatchObject({ done: 0, percent: 0, current_node: 'Nút A: khởi đầu', behind: true, reason: 'Chưa học trong 7 ngày gần đây' });
    expect(pr.students[0].id).toBe(f.S2.id); // học sinh chậm xếp trước
    expect(pr.summary).toMatchObject({ avg_percent: 25, behind: 1, students: 2 });
    expect((await api('GET', `/api/classroom/classes/${classId}/progress?journey_id=987654`)).status).toBe(404);
    expect((await api('GET', `/api/classroom/classes/${classId}/progress`, undefined, f.T2.token)).status).toBe(404);
    const list = (await api('GET', '/api/classroom/classes')).body.find((c: any) => c.id === classId);
    expect(list.journeys).toEqual([{ id: J, title: 'Hành trình rẽ nhánh', percent: 25 }]);
    expect(list.avg_progress).toBe(25);
  });

  // ------------------------------------------------------------------ HK.GV.027
  test('HK.GV.027 nhân bản sang lớp khác hoặc năm học mới: sao cả nút, đường nối, vị trí, điều kiện, thưởng; có thể giao ngay; nhiều hành trình cho một lớp', async () => {
    const copy = await api('POST', `/api/content/journeys/${J}/copy`, { title: 'Bản sao cho 7A9', class_ids: [ownClass], ends_at: iso(60 * DAY) });
    expect(copy.status).toBe(200);
    const c = copy.body;
    expect(c).toMatchObject({ title: 'Bản sao cho 7A9', copied_from: J, scope: 'teacher', status: 'published' });
    expect(c.nodes).toHaveLength(4);
    expect(c.edges).toHaveLength(4);
    expect(c.nodes.map((n: any) => [n.kind, n.pos_x, n.min_percent, n.reward_gold])).toEqual([['quiz', 50, null, 0], ['quiz', 20, 80, 30], ['quiz', 75, null, 0], ['final', 50, null, 0]]);
    expect(c.nodes[1]).toMatchObject({ reward_card_id: cardId, reward_badge_id: badgeId });
    expect(c.nodes[2].opens_at).toBeNull(); // ngày mở không sao chép sang năm học mới
    expect(c.classes).toMatchObject([{ id: ownClass, name: '7A9' }]);
    expect(c.nodes.every((n: any) => ![A, B, C, D].includes(n.id))).toBe(true);
    // bản sao hoạt động độc lập: sửa bản sao không đổi bản gốc; xóa một nút xóa luôn đường nối của nút đó
    const [cA, cB, cC, cD] = c.nodes.map((n: any) => n.id);
    const removed = await api('DELETE', `/api/content/nodes/${cC}`);
    expect(removed.body.nodes).toHaveLength(3);
    expect(removed.body.edges.map((e: any) => [e.from_node, e.to_node]).sort()).toEqual([[cA, cB], [cB, cD]].sort());
    expect((await api('GET', `/api/content/journeys/${J}`)).body.nodes).toHaveLength(4);
    expect((await api('POST', `/api/content/journeys/${J}/copy`, { title: 'Không được', class_ids: [f.class7b.id] })).status).toBe(403);
    expect((await api('POST', `/api/content/journeys/${J}/copy`, {}, f.T2.token)).status).toBe(404);

    // nhiều hành trình cho một lớp: bản sao giao thêm cho 7A1 với lịch bắt đầu sau; học sinh học bản mới nhất đang chạy
    const second = (await api('POST', `/api/content/journeys/${J}/copy`, { title: 'Hành trình bổ sung', class_ids: [classId], starts_at: iso(2 * DAY) })).body;
    expect((await mapOf(f.S1)).journey.id).toBe(J); // bản bổ sung chưa tới ngày
    await api('PUT', `/api/content/journeys/${second.id}/classes/${classId}/schedule`, { starts_at: null, ends_at: null });
    expect((await mapOf(f.S1)).journey.id).toBe(second.id); // mới giao nhất thì ưu tiên
    expect((await api('GET', `/api/classroom/classes/${classId}/progress`)).body.journeys.map((j: any) => j.id)).toEqual([second.id, J]);
    expect((await api('GET', `/api/classroom/classes/${classId}/progress?journey_id=${J}`)).body.journey.id).toBe(J);
    expect((await api('GET', '/api/content/my-classes')).body.find((x: any) => x.id === classId).journeys.map((j: any) => j.id).sort()).toEqual([J, second.id].sort());
    await api('DELETE', `/api/content/journeys/${second.id}/classes/${classId}`);
    expect((await mapOf(f.S1)).journey.id).toBe(J); // hủy giao: quay lại bản trước
  });
});
