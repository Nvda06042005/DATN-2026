/**
 * Sprint 6, mô phỏng trận đánh và mini-game (HK.HS.028, 051–061, HK.AD.046–047): kịch bản JSON do quản trị soạn, chơi theo lượt có phản hồi lịch sử, kết quả – sao – điểm,
 * chơi lại chỉ tính điểm cao nhất, lưu lượt chơi dở, hoàn thành nút trận đánh trên bản đồ, hoạt ảnh, ghép thẻ, sắp xếp dòng thời gian, ô chữ.
 * HTTP thật trên PostgreSQL tạm; nội dung khởi tạo của migration 019 và 023 được giữ lại.
 */
import { call, hasPostgres, Started, startApp } from './harness';
import { bootstrap, Fixture, publish } from './fixture';
import type { DatabaseService } from '../src/database/database.service';
import type { GameClock } from '../src/game/clock';

let s: Started, f: Fixture, db: DatabaseService, clock: GameClock;
const api = (method: string, path: string, body?: unknown, token = f.S1.token) => call(s.base, method, path, body, token);
const root = (method: string, path: string, body?: unknown) => api(method, path, body, f.root);
const keys = new Map<number, { qtype: string; data: any }>();

const scenarioOf = async (slug: string) => (await db.query<{ id: number; content: any; battle_id: number }>(
  'SELECT s.id, s.content, s.battle_id FROM hk_scenarios s JOIN hist_battles b ON b.id = s.battle_id WHERE b.slug = $1', [slug]))[0];
const minigameOf = async (kind: string, title?: string) => (await db.query<{ id: number; params: any }>(
  `SELECT id, params FROM hk_minigames WHERE kind = $1 ${title ? 'AND title = $2' : ''} ORDER BY id LIMIT 1`, title ? [kind, title] : [kind]))[0];
const me = async (token = f.S1.token) => (await api('GET', '/api/game/me', undefined, token)).body;

/** Đáp án đúng / sai của một bước, tính từ nội dung gốc trong cơ sở dữ liệu (học sinh không có dữ liệu này) */
function bodyFor(step: any, view: any, right: boolean): Record<string, unknown> {
  if (step.type === 'decision') {
    const sorted = [...step.options].sort((a: any, b: any) => b.score - a.score);
    return { step_id: view.id, choice: (right ? sorted[0] : sorted[sorted.length - 1]).id };
  }
  const placements: Record<string, { lat: number; lng: number }> = {};
  for (const p of step.pieces) {
    const zone = right ? step.zones.find((z: any) => step.accept[p.id].includes(z.id)) : step.zones.find((z: any) => !step.accept[p.id].includes(z.id));
    placements[p.id] = { lat: zone.lat, lng: zone.lng };
  }
  return { step_id: view.id, placements };
}

async function play(token: string, runView: any, content: any, right: (index: number) => boolean = () => true) {
  let view = runView;
  let last: any;
  for (let i = 0; i < content.steps.length; i++) {
    const step = content.steps.find((x: any) => x.id === view.step.id);
    last = (await api('POST', `/api/battle/runs/${view.id}/answer`, bodyFor(step, view.step, right(i)), token)).body;
    view = last.run;
  }
  return last;
}

async function doLesson(token: string, nodeId: number) {
  const lesson = (await api('GET', `/api/play/nodes/${nodeId}/lesson`, undefined, token)).body;
  await api('POST', `/api/play/nodes/${nodeId}/lesson/progress`, { read_percent: 100 }, token);
  const answers = lesson.checks.map((c: any) => {
    const { qtype, data } = keys.get(c.id)!;
    return { question_id: c.id, answer: qtype === 'single' ? { choice: data.correct } : qtype === 'truefalse' ? { value: data.correct } : { choices: data.correct } };
  });
  return (await api('POST', `/api/play/nodes/${nodeId}/lesson/complete`, { answers }, token)).body;
}

(hasPostgres() ? describe : describe.skip)('Sprint 6 – mô phỏng trận đánh và mini-game', () => {
  beforeAll(async () => {
    s = await startApp('battle_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    clock = s.moduleRef.get((await import('../src/game/clock')).GameClock);
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken, true);
    for (const row of await db.query<{ id: number; qtype: string; data: any }>('SELECT id, qtype, data FROM hk_questions')) keys.set(row.id, row);
  });
  afterAll(async () => { clock?.reset(); await s?.close(); });

  // ------------------------------------------------------------------ HK.AD.046
  test('HK.AD.046 sáu kịch bản khởi tạo ở trạng thái Nháp; học sinh chưa thấy; phát hành cần hồ sơ trận đánh đã công bố', async () => {
    const list = await root('GET', '/api/battle/admin/scenarios');
    expect(list.body.map((x: any) => x.battle_name)).toEqual(['Trận Đông Bộ Đầu', 'Trận Hàm Tử', 'Trận Chương Dương', 'Trận Tây Kết', 'Trận Vân Đồn', 'Trận Bạch Đằng']);
    expect(list.body.every((x: any) => x.status === 'draft')).toBe(true);
    expect((await api('GET', '/api/battle/list')).body).toEqual({ battles: [], minigames: [] });
    const ham = await scenarioOf('tay-ket');
    expect((await root('POST', `/api/battle/admin/scenarios/${ham.id}/status`, { status: 'published' })).status).toBe(409); // hồ sơ trận đánh còn Nháp
    expect((await api('GET', `/api/battle/scenarios/${ham.id}`)).status).toBe(404); // học sinh không xem được bản nháp
    for (const entity of ['campaigns', 'places', 'figures', 'sources', 'terms', 'events', 'battles']) {
      for (const item of (await root('GET', `/api/admin/history/${entity}?limit=100`)).body.items) await publish(s.base, f.root, entity, item.id);
    }
    for (const l of (await root('GET', '/api/content/lessons')).body) await root('PATCH', `/api/content/lessons/${l.id}/status`, { status: 'published' });
    for (const j of (await root('GET', '/api/content/journeys?store=system')).body) {
      await root('PATCH', `/api/content/journeys/${j.id}/status`, { status: 'published' });
      await root('PATCH', `/api/content/journeys/${j.id}/default`, { value: true }, );
    }
    expect((await root('POST', `/api/battle/admin/scenarios/${ham.id}/status`, { status: 'published' })).body.status).toBe('published');
    expect((await root('POST', `/api/battle/admin/scenarios/${ham.id}/status`, { status: 'draft' })).body.status).toBe('draft');
    expect((await root('POST', `/api/battle/admin/scenarios/${ham.id}/status`, { status: 'nope' })).status).toBe(400);
    expect((await api('GET', '/api/battle/admin/scenarios')).status).toBe(403);
    expect((await api('GET', '/api/battle/admin/scenarios', undefined, f.T1.token)).status).toBe(403);
  });

  test('HK.AD.046 kiểm tra cấu trúc kịch bản: báo lỗi tiếng Việt chỉ rõ vị trí; mẫu hợp lệ; mỗi trận đánh một kịch bản', async () => {
    const template = (await root('GET', '/api/battle/admin/scenario-template')).body;
    expect((await root('POST', '/api/battle/admin/scenarios/validate', { content: template })).body).toMatchObject({ ok: true, steps: 2, max_score: 50 });
    const check = async (mutate: (c: any) => void, message: RegExp) => {
      const copy = JSON.parse(JSON.stringify(template));
      mutate(copy);
      const res = await root('POST', '/api/battle/admin/scenarios/validate', { content: copy });
      expect(res.status).toBe(400);
      expect(res.body.detail).toMatch(message);
    };
    await check((c) => { c.steps = c.steps.slice(0, 1); }, /từ 2 đến 10 bước/);
    await check((c) => { c.steps[0].options.forEach((o: any) => { o.score = 0; }); }, /ít nhất một lựa chọn được điểm/);
    await check((c) => { c.steps[0].options[1].id = 'a'; }, /mã không được trùng/);
    await check((c) => { c.steps[1].accept.p1 = ['nope']; }, /khu vực chấp nhận hợp lệ/);
    await check((c) => { c.steps[1].zones[0].lat = 60; }, /khung bản đồ Việt Nam/);
    await check((c) => { c.steps[0].type = 'fight'; }, /decision.*placement/);
    await check((c) => { delete c.intro; }, /giới thiệu/);
    await check((c) => { c.animation.frames = c.animation.frames.slice(0, 1); }, /từ 2 đến 12 khung/);
    // Mỗi trận đánh có tối đa một kịch bản
    const dbd = await scenarioOf('dong-bo-dau');
    expect((await root('POST', '/api/battle/admin/scenarios', { battle_id: dbd.battle_id, title: 'Trùng', content: template })).status).toBe(409);
    const options = (await root('GET', '/api/battle/admin/battles')).body;
    expect(options).toHaveLength(6);
    expect(options.every((o: any) => o.scenario_id !== null)).toBe(true);
    expect((await root('PUT', `/api/battle/admin/scenarios/${dbd.id}`, { content: { steps: [] } })).status).toBe(400);
  });

  // ------------------------------------------------------------------ HK.HS.051, 052, 053, 055, 056, 057, 061
  test('HK.HS.051/052 danh sách trận đánh mô phỏng có trạng thái mở khóa; màn giới thiệu không lộ đáp án', async () => {
    for (const slug of ['dong-bo-dau', 'tay-ket']) await root('POST', `/api/battle/admin/scenarios/${(await scenarioOf(slug)).id}/status`, { status: 'published' });
    const list = (await api('GET', '/api/battle/list')).body;
    expect(list.battles.map((b: any) => b.battle_name)).toEqual(['Trận Đông Bộ Đầu', 'Trận Tây Kết']);
    const dbd = list.battles.find((b: any) => b.battle_name === 'Trận Đông Bộ Đầu');
    const tk = list.battles.find((b: any) => b.battle_name === 'Trận Tây Kết');
    expect(dbd).toMatchObject({ locked: true, node_state: 'locked', best: { points: 0, stars: 0, plays: 0 }, active_run: null, has_animation: true });
    expect(tk).toMatchObject({ locked: false, node_id: null });
    const intro = (await api('GET', `/api/battle/scenarios/${tk.id}`)).body;
    expect(intro).toMatchObject({ title: expect.any(String), steps: 2, max_score: 50, pass_percent: 60, bonus_points: 150, battle: { name: 'Trận Tây Kết' } });
    expect(intro.intro.objective).toMatch(/Toa Đô/);
    expect(JSON.stringify(intro)).not.toMatch(/"score"|feedback|accept/); // không lộ điểm, phản hồi hay đáp án
    expect((await call(s.base, 'GET', `/api/battle/scenarios/${tk.id}`)).status).toBe(401);
    expect((await api('GET', '/api/battle/scenarios/99999')).status).toBe(404);
  });

  test('HK.HS.053/055/056 chơi theo lượt: phản hồi lịch sử sau mỗi bước, toàn thắng được +150, 3 sao; chơi lại chỉ tính điểm cao nhất', async () => {
    const sc = await scenarioOf('tay-ket');
    const before = (await me()).xp;
    const started = (await api('POST', `/api/battle/scenarios/${sc.id}/start`, {})).body;
    expect(started).toMatchObject({ kind: 'battle', mode: 'play', status: 'active', total: 2, index: 0, score: 0, max_score: 50, node_id: null });
    expect(started.step).toMatchObject({ type: 'decision', index: 0, total: 2 });
    expect(started.step.options.every((o: any) => Object.keys(o).sort().join() === 'id,text')).toBe(true); // lựa chọn không kèm điểm hay phản hồi
    const first = (await api('POST', `/api/battle/runs/${started.id}/answer`, bodyFor(sc.content.steps[0], started.step, true))).body;
    expect(first.feedback).toMatchObject({ correct: true, score: 25, max: 25 });
    expect(first.feedback.feedback).toMatch(/Trần Nhật Duật/);
    expect(first.feedback.consequence).toBeTruthy();
    expect(first.finished).toBe(false);
    // HK.HS.061: lượt chơi dở được lưu; bắt đầu lại sẽ tiếp tục đúng chỗ
    const resumed = (await api('POST', `/api/battle/scenarios/${sc.id}/start`, {})).body;
    expect(resumed).toMatchObject({ id: started.id, index: 1, score: 25 });
    expect(resumed.history).toHaveLength(1);
    expect((await api('GET', `/api/battle/runs/${started.id}`)).body.step.id).toBe(sc.content.steps[1].id);
    expect((await api('POST', `/api/battle/runs/${started.id}/answer`, { step_id: sc.content.steps[0].id, choice: 'a' })).status).toBe(409); // sai bước hiện tại
    const done = (await api('POST', `/api/battle/runs/${started.id}/answer`, bodyFor(sc.content.steps[1], resumed.step, true))).body;
    expect(done.finished).toBe(true);
    expect(done.run).toMatchObject({ status: 'done', score: 50, step: null, result: { passed: true, full: true, percent: 100, stars: 3, bonus: 150, outcome: 'full_win', xp_awarded: 200 } });
    expect((await me()).xp - before).toBeGreaterThanOrEqual(200);
    expect((await api('POST', `/api/battle/runs/${started.id}/answer`, bodyFor(sc.content.steps[1], resumed.step, true))).status).toBe(409); // lượt đã kết thúc
    // HK.HS.057: chơi lại không cộng thêm điểm khi không vượt kỷ lục
    const again = (await api('POST', `/api/battle/scenarios/${sc.id}/start`, {})).body;
    expect(again.id).not.toBe(started.id);
    const replay = await play(f.S1.token, again, sc.content);
    expect(replay.run.result).toMatchObject({ full: true, xp_awarded: 0 });
    const list = (await api('GET', '/api/battle/list')).body.battles.find((b: any) => b.id === sc.id);
    expect(list).toMatchObject({ best: { points: 200, percent: 100, stars: 3, wins: 2, plays: 2 }, active_run: null });
  });

  test('HK.HS.056 thua khi dưới ngưỡng thắng: không sao, không điểm, không thưởng; làm lại từ đầu bỏ lượt dở', async () => {
    const sc = await scenarioOf('tay-ket');
    const before = (await me(f.S2.token)).xp;
    const run = (await api('POST', `/api/battle/scenarios/${sc.id}/start`, {}, f.S2.token)).body;
    const lost = await play(f.S2.token, run, sc.content, () => false);
    expect(lost.run.result).toMatchObject({ passed: false, full: false, percent: 0, stars: 0, bonus: 0, outcome: 'lose', xp_awarded: 0 });
    expect((await me(f.S2.token)).xp).toBe(before);
    // chỉ đúng một nửa số bước (50%) vẫn dưới ngưỡng 60%
    const half = (await api('POST', `/api/battle/scenarios/${sc.id}/start`, {}, f.S2.token)).body;
    expect((await play(f.S2.token, half, sc.content, (i) => i === 0)).run.result).toMatchObject({ percent: 50, passed: false });
    const mid = (await api('POST', `/api/battle/scenarios/${sc.id}/start`, {}, f.S2.token)).body;
    const restart = (await api('POST', `/api/battle/scenarios/${sc.id}/start`, { restart: true }, f.S2.token)).body;
    expect(restart.id).not.toBe(mid.id);
    expect((await api('GET', `/api/battle/runs/${mid.id}`, undefined, f.S2.token)).status).toBe(404);
    expect((await api('GET', `/api/battle/runs/${restart.id}`)).status).toBe(404); // lượt của học sinh khác không xem được
  });

  test('HK.HS.054 bố trí lực lượng trên bản đồ: đúng khu vực được điểm, sai không; vị trí thiếu bị từ chối', async () => {
    const sc = await scenarioOf('tay-ket');
    const ham = await scenarioOf('ham-tu'); // chưa phát hành: kiểm tra qua xem trước của quản trị
    const preview = (await root('POST', `/api/battle/scenarios/${ham.id}/start`, { preview: true })).body;
    expect(preview).toMatchObject({ mode: 'preview', total: 4 });
    // bước 3 là bố trí: đi hai bước đầu rồi thử đặt sai / đúng
    let view = preview;
    for (let i = 0; i < 2; i++) view = (await root('POST', `/api/battle/runs/${view.id}/answer`, bodyFor(ham.content.steps[i], view.step, true))).body.run;
    expect(view.step).toMatchObject({ type: 'placement', pieces: [{ id: 'quantran' }] });
    expect(view.step.zones.length).toBe(3);
    expect(JSON.stringify(view.step)).not.toMatch(/accept|feedback/);
    expect((await root('POST', `/api/battle/runs/${view.id}/answer`, { step_id: view.step.id, placements: {} })).status).toBe(400);
    const wrong = (await root('POST', `/api/battle/runs/${view.id}/answer`, bodyFor(ham.content.steps[2], view.step, false))).body;
    expect(wrong.feedback).toMatchObject({ correct: false, score: 0, pieces: [{ id: 'quantran', ok: false }] });
    expect(wrong.feedback.best).toMatch(/Hàm Tử/);
    expect(wrong.feedback.feedback).toMatch(/Hàm Tử/);
    void sc;
  });

  test('HK.HS.056 chơi thử của giáo viên và quản trị không ghi điểm; học sinh không dùng chế độ xem trước; giáo viên không chơi thật', async () => {
    const sc = await scenarioOf('tay-ket');
    expect((await api('POST', `/api/battle/scenarios/${sc.id}/start`, { preview: true })).status).toBe(403);
    expect((await api('POST', `/api/battle/scenarios/${sc.id}/start`, {}, f.T1.token)).status).toBe(403);
    const run = (await api('POST', `/api/battle/scenarios/${sc.id}/start`, { preview: true }, f.T1.token)).body;
    expect(run).toMatchObject({ mode: 'preview' });
    const done = await play(f.T1.token, run, sc.content);
    expect(done.run.result).toMatchObject({ full: true, xp_awarded: 0, node_result: null });
    expect(Number((await db.query<{ n: string }>('SELECT count(*) AS n FROM hk_points WHERE user_id = $1', [f.T1.id]))[0].n)).toBe(0);
    const ham = await scenarioOf('ham-tu');
    expect((await api('POST', `/api/battle/scenarios/${ham.id}/start`, { preview: true }, f.T1.token)).status).toBe(404); // giáo viên chỉ xem trước bản đã phát hành
  });

  // ------------------------------------------------------------------ HK.HS.028
  test('HK.HS.028 hoạt ảnh diễn biến: các khung có vị trí hai bên; trận không có hoạt ảnh trả 404', async () => {
    const sc = await scenarioOf('tay-ket');
    const anim = (await api('GET', `/api/battle/scenarios/${sc.id}/animation`)).body;
    expect(anim.frames.length).toBe(3);
    expect(anim.frames[0].units.map((u: any) => u.side).sort()).toEqual(['dich', 'tran']);
    expect(anim.note).toMatch(/minh họa/);
    expect(anim.map.center).toHaveLength(2);
    expect((await api('GET', '/api/battle/scenarios/99999/animation')).status).toBe(404);
    const noAnim = await db.query('UPDATE hk_scenarios SET content = content - \'animation\' WHERE id = $1 RETURNING id', [sc.id]);
    expect(noAnim).toHaveLength(1);
    expect((await api('GET', `/api/battle/scenarios/${sc.id}/animation`)).status).toBe(404);
    await db.query('UPDATE hk_scenarios SET content = $2 WHERE id = $1', [sc.id, JSON.stringify(sc.content)]);
  });

  // ------------------------------------------------------------------ HK.HS.020 + HK.HS.056: nút trận đánh trên bản đồ
  test('nút trận đánh trên bản đồ: bị khóa tới khi đủ điều kiện; hoàn thành bằng chơi mô phỏng mở nút kế tiếp, thưởng nút và rơi thẻ', async () => {
    const dbd = await scenarioOf('dong-bo-dau');
    const home = (await api('GET', '/api/play/home')).body;
    const map = (await api('GET', `/api/play/campaigns/${home.campaigns[0].id}/map`)).body;
    const [lesson, quiz, battle, final] = map.nodes;
    expect(battle).toMatchObject({ kind: 'battle', state: 'locked' });
    expect((await api('POST', `/api/battle/scenarios/${dbd.id}/start`, {})).status).toBe(409);
    await doLesson(f.S1.token, lesson.id);
    // nút trận đánh có kịch bản đã phát hành thì phải chơi mô phỏng (không "đọc là xong")
    const quizAttempt = (await api('POST', `/api/play/nodes/${quiz.id}/attempts`)).body;
    expect(quizAttempt.current).toBeTruthy();
    for (let i = 0; i < quizAttempt.total; i++) {
      const state = i === 0 ? quizAttempt : (await api('POST', `/api/play/attempts/${quizAttempt.id}/next`)).body;
      const q = state.current.question;
      const { qtype, data } = keys.get(q.id)!;
      const answer = qtype === 'single' ? { choice: data.correct } : qtype === 'truefalse' ? { value: data.correct } : qtype === 'multiple' ? { choices: data.correct } : qtype === 'fill' ? { blanks: data.blanks.map((b: any) => b.accept[0]) } : qtype === 'order' ? { order: data.items.map((x: any) => x.id) } : { placements: Object.fromEntries(data.targets.map((t: any) => [t.id, { lat: t.lat, lng: t.lng }])) };
      await api('POST', `/api/play/attempts/${quizAttempt.id}/answer`, { question_id: q.id, answer });
    }
    expect((await api('GET', `/api/play/nodes/${battle.id}`)).body).toMatchObject({ state: 'available', has_sim: true, scenario_id: dbd.id });
    expect((await api('POST', `/api/play/nodes/${battle.id}/complete`)).status).toBe(409); // phải chơi mô phỏng hoặc làm bộ câu hỏi của nút
    clock.random = () => 0.01;
    const run = (await api('POST', `/api/battle/scenarios/${dbd.id}/start`, {})).body;
    expect(run).toMatchObject({ node_id: battle.id });
    const dropsBefore = (await api('GET', '/api/game/drops')).body.length;
    const done = await play(f.S1.token, run, dbd.content);
    expect(done.run.result).toMatchObject({ passed: true, full: true, stars: 3, card_drop: true });
    expect(done.run.result.node_result).toMatchObject({ first_completion: true, passed: true, next_node: { id: final.id }, points_awarded: expect.any(Number) });
    expect(done.run.result.xp_awarded).toBeGreaterThanOrEqual(100 + 150);
    expect((await api('GET', '/api/game/drops')).body.length).toBe(dropsBefore + 1);
    const after = (await api('GET', `/api/play/campaigns/${home.campaigns[0].id}/map`)).body.nodes;
    expect(after[2]).toMatchObject({ state: 'done', stars: 3 });
    expect(after[3].state).toBe('available');
    expect((await api('GET', '/api/battle/list')).body.battles.find((b: any) => b.id === dbd.id)).toMatchObject({ locked: false, node_state: 'done', best: { stars: 3, wins: 1 } });
    // chơi lại ở nút đã xong: không rơi thẻ lần hai
    const again = (await api('POST', `/api/battle/scenarios/${dbd.id}/start`, {})).body;
    const replay = await play(f.S1.token, again, dbd.content);
    expect(replay.run.result).toMatchObject({ card_drop: false, xp_awarded: 0 });
    expect(replay.run.result.node_result).toMatchObject({ first_completion: false });
  });

  // ------------------------------------------------------------------ HK.AD.047, HK.HS.058–060
  test('HK.AD.047 bốn mini-game khởi tạo ở trạng thái Nháp; kiểm tra tham số từng dạng; phát hành', async () => {
    const list = (await root('GET', '/api/battle/admin/minigames')).body;
    expect(list.map((m: any) => m.kind).sort()).toEqual(['crossword', 'match', 'match', 'timeline']);
    expect(list.every((m: any) => m.status === 'draft')).toBe(true);
    const bad = async (kind: string, params: any, message: RegExp) => {
      const res = await root('POST', '/api/battle/admin/minigames/validate', { kind, params });
      expect(res.status).toBe(400);
      expect(res.body.detail).toMatch(message);
    };
    await bad('match', { pairs: [{ left: 'A', right: 'B' }] }, /từ 3 đến 10 cặp/);
    await bad('match', { pairs: [{ left: 'A', right: 'B' }, { left: 'A', right: 'C' }, { left: 'D', right: 'E' }] }, /một cặp/);
    await bad('timeline', { items: [{ text: 'A', key: 1 }, { text: 'B', key: 2 }, { text: 'C', key: 2 }] }, /không được trùng/);
    await bad('crossword', { words: [{ answer: 'ABC', clue: 'x' }, { answer: 'XYZ', clue: 'y' }, { answer: 'QQQ', clue: 'z' }] }, /không xếp được/i);
    expect((await root('POST', '/api/battle/admin/minigames/validate', { kind: 'crossword', params: (await minigameOf('crossword')).params })).body.layout.words).toHaveLength(6);
    for (const m of list) expect((await root('POST', `/api/battle/admin/minigames/${m.id}/status`, { status: 'published' })).body.status).toBe('published');
    const created = await root('POST', '/api/battle/admin/minigames', { kind: 'timeline', title: 'Thử nghiệm', seconds: 60, points: 80, params: { items: [{ text: 'Một', key: 1 }, { text: 'Hai', key: 2 }, { text: 'Ba', key: 3 }] } });
    expect(created.status).toBe(201);
    expect((await root('PUT', `/api/battle/admin/minigames/${created.body.id}`, { kind: 'match' })).status).toBe(400); // không đổi dạng
    expect((await root('DELETE', `/api/battle/admin/minigames/${created.body.id}`)).status).toBe(204);
    expect((await api('GET', '/api/battle/list')).body.minigames).toHaveLength(4);
  });

  test('HK.HS.058 ghép thẻ: ghép đúng/sai do máy chủ kiểm tra, ghép sai bị trừ điểm, ghép đủ thì kết thúc; chỉ điểm vượt kỷ lục được cộng', async () => {
    const mg = await minigameOf('match', 'Ai gắn với trận nào?');
    const run = (await api('POST', `/api/battle/minigames/${mg.id}/start`, {})).body;
    expect(run).toMatchObject({ kind: 'match', status: 'active', points: 100, seconds: 120 });
    expect(run.game.lefts).toHaveLength(6);
    expect(run.game.rights.map((r: any) => r.id).sort()).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6']); // id bên phải không lộ cặp ghép
    expect(JSON.stringify(run.game)).not.toMatch(/"pair"/);
    expect(run.remaining_ms).toBeGreaterThan(100_000);
    const state = (await db.query<{ state: any }>('SELECT state FROM hk_game_runs WHERE id = $1', [run.id]))[0].state;
    const rightOf = (pairId: string) => state.rights.find((r: any) => r.pair === pairId).rid;
    const pairs = mg.params.pairs;
    // một lần ghép sai (trừ điểm), rồi ghép đúng tất cả
    const miss = (await api('POST', `/api/battle/runs/${run.id}/answer`, { left: pairs[0].id, right: rightOf(pairs[1].id) })).body;
    expect(miss).toMatchObject({ correct: false, finished: false, run: { game: { wrong: 1 } } });
    let last: any;
    for (const p of pairs) last = (await api('POST', `/api/battle/runs/${run.id}/answer`, { left: p.id, right: rightOf(p.id) })).body;
    expect(last.finished).toBe(true);
    expect(last.run.result).toMatchObject({ units: 6, total: 6, wrong: 1, passed: true, timed_out: false });
    expect(last.run.result.score).toBeLessThan(100);
    expect(last.run.result.score).toBeGreaterThanOrEqual(90);
    expect(last.run.result.xp_awarded).toBe(last.run.result.score);
    expect((await api('POST', `/api/battle/runs/${run.id}/answer`, { left: pairs[0].id, right: rightOf(pairs[0].id) })).status).toBe(409);
    // ghép sai thẻ đã ghép / thẻ không tồn tại
    const second = (await api('POST', `/api/battle/minigames/${mg.id}/start`, {})).body;
    const st2 = (await db.query<{ state: any }>('SELECT state FROM hk_game_runs WHERE id = $1', [second.id]))[0].state;
    const r2 = (pid: string) => st2.rights.find((r: any) => r.pair === pid).rid;
    expect((await api('POST', `/api/battle/runs/${second.id}/answer`, { left: 'zzz', right: 'r1' })).status).toBe(400);
    await api('POST', `/api/battle/runs/${second.id}/answer`, { left: pairs[0].id, right: r2(pairs[0].id) });
    expect((await api('POST', `/api/battle/runs/${second.id}/answer`, { left: pairs[0].id, right: r2(pairs[0].id) })).status).toBe(409);
    // kết thúc sớm: chỉ tính phần đã ghép, không đạt
    const early = (await api('POST', `/api/battle/runs/${second.id}/finish`)).body;
    expect(early.result).toMatchObject({ units: 1, passed: false, stars: 0 });
    // ghép hoàn hảo lần hai: chỉ cộng phần vượt kỷ lục
    const third = (await api('POST', `/api/battle/minigames/${mg.id}/start`, {})).body;
    const st3 = (await db.query<{ state: any }>('SELECT state FROM hk_game_runs WHERE id = $1', [third.id]))[0].state;
    let perfect: any;
    for (const p of pairs) perfect = (await api('POST', `/api/battle/runs/${third.id}/answer`, { left: p.id, right: st3.rights.find((r: any) => r.pair === p.id).rid })).body;
    expect(perfect.run.result).toMatchObject({ score: 100, stars: 3, wrong: 0 });
    expect(perfect.run.result.xp_awarded).toBe(100 - last.run.result.score);
  });

  test('HK.HS.059 sắp xếp dòng thời gian: chấm từng vị trí, hiện thứ tự đúng sau khi nộp; đáp án không lộ trước đó', async () => {
    const mg = await minigameOf('timeline');
    const run = (await api('POST', `/api/battle/minigames/${mg.id}/start`, {})).body;
    expect(run.game.items).toHaveLength(6);
    expect(JSON.stringify(run.game)).not.toMatch(/key|when/);
    const sorted = [...mg.params.items].sort((a: any, b: any) => a.key - b.key);
    expect(run.game.items.map((i: any) => i.id)).not.toEqual(sorted.map((i: any) => i.id)); // thứ tự hiển thị không phải thứ tự đúng
    expect((await api('POST', `/api/battle/runs/${run.id}/answer`, { order: ['e1', 'e1', 'e1', 'e1', 'e1', 'e1'] })).status).toBe(400);
    const wrongOrder = sorted.map((i: any) => i.id).reverse();
    const bad = (await api('POST', `/api/battle/runs/${run.id}/answer`, { order: wrongOrder })).body;
    expect(bad.run.result).toMatchObject({ units: 0, passed: false });
    expect(bad.run.result.detail.review.map((r: any) => r.id)).toEqual(sorted.map((i: any) => i.id));
    expect(bad.run.result.detail.review[0].when).toBeTruthy();
    const good = (await api('POST', `/api/battle/minigames/${mg.id}/start`, {})).body;
    const win = (await api('POST', `/api/battle/runs/${good.id}/answer`, { order: sorted.map((i: any) => i.id) })).body;
    expect(win.run.result).toMatchObject({ score: 100, percent: 100, stars: 3, passed: true, xp_awarded: 100 });
  });

  test('HK.HS.060 ô chữ: bố cục tự xếp, gợi ý hiện cho học sinh, đáp án so khớp không dấu; hết giờ tự kết thúc', async () => {
    const mg = await minigameOf('crossword');
    const run = (await api('POST', `/api/battle/minigames/${mg.id}/start`, {})).body;
    expect(run.game).toMatchObject({ rows: expect.any(Number), cols: expect.any(Number), total: 6 });
    expect(run.game.words[0].clue).toBeTruthy();
    expect(JSON.stringify(run.game)).not.toMatch(/answer|BACH|Bạch Đằng/i);
    const answers = Object.fromEntries(mg.params.words.map((w: any) => [w.id, w.answer]));
    // viết hoa, bỏ dấu và khoảng trắng vẫn đúng; một từ sai
    const given = { ...answers, w1: 'bach dang', w2: 'DONGBODAU', w3: 'sai' };
    const res = (await api('POST', `/api/battle/runs/${run.id}/answer`, { words: given })).body;
    expect(res.run.result).toMatchObject({ units: 5, total: 6, passed: true });
    expect(res.run.result.detail.review.find((r: any) => r.id === 'w3')).toMatchObject({ ok: false });
    // hết giờ: đặt hạn đã qua; mở lượt thì tự kết thúc với kết quả hiện có
    const late = (await api('POST', `/api/battle/minigames/${mg.id}/start`, {})).body;
    await db.query("UPDATE hk_game_runs SET deadline = now() - interval '1 minute' WHERE id = $1", [late.id]);
    const closed = (await api('GET', `/api/battle/runs/${late.id}`)).body;
    expect(closed).toMatchObject({ status: 'done', result: { timed_out: true, passed: false, score: 0 } });
    expect((await api('POST', `/api/battle/runs/${late.id}/answer`, { words: answers })).status).toBe(409);
  });

  test('HK.AD.046/047 không xóa kịch bản và mini-game đã có lượt chơi; xóa được khi chưa ai chơi; phân quyền chơi thử', async () => {
    const sc = await scenarioOf('tay-ket');
    expect((await root('DELETE', `/api/battle/admin/scenarios/${sc.id}`)).status).toBe(409);
    const vandon = await scenarioOf('van-don');
    expect((await root('DELETE', `/api/battle/admin/scenarios/${vandon.id}`)).status).toBe(204);
    const mg = await minigameOf('match', 'Ai gắn với trận nào?');
    expect((await root('DELETE', `/api/battle/admin/minigames/${mg.id}`)).status).toBe(409);
    const run = (await root('POST', `/api/battle/minigames/${mg.id}/start`, { preview: true })).body;
    expect(run).toMatchObject({ mode: 'preview', kind: 'match' });
    expect((await api('POST', `/api/battle/minigames/${mg.id}/start`, { preview: true })).status).toBe(403);
    expect((await api('GET', `/api/battle/runs/${run.id}`)).status).toBe(404);
  });
});
