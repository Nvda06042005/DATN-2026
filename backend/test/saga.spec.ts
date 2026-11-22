/**
 * Hành trình Đông A qua API thật trên PostgreSQL tạm (migration 065–066): bản đồ, mở khóa chặng, học – luyện tập – nhập vai – trận đánh, hoàn thành chặng và phần thưởng,
 * chống gửi lặp, thứ tự lệnh, quyền sở hữu phiên, ôn tập, bộ sưu tập, kho tư liệu. Chỉ học sinh dùng được /api/saga: mục Hành trình Đông A của quản trị tổng
 * và báo cáo của giáo viên đã xóa theo yêu cầu ngày 16/11/2026.
 * Đáp án lấy thẳng từ cơ sở dữ liệu (học sinh không bao giờ nhận được dữ liệu này qua API).
 */
import { randomUUID } from 'crypto';
import { call, hasPostgres, sql, Started, startApp } from './harness';
import { bootstrap, Fixture, PW } from './fixture';
import type { GameClock } from '../src/game/clock';

let s: Started, f: Fixture, clock: GameClock;
let stageId: Record<string, number> = {};
const keys = new Map<number, { kind: string; data: any }>();
const api = (method: string, path: string, body?: unknown, token = f.S1.token) => call(s.base, method, path, body, token);
const act = (sessionId: number, seq: number, action: Record<string, unknown>, token = f.S1.token, actionId: string = randomUUID()) =>
  api('POST', `/api/saga/sessions/${sessionId}/actions`, { action_id: actionId, seq, action }, token);

function keysOf(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => keysOf(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysOf(x, out); }
  return out;
}
const count = async (text: string, params: unknown[] = []): Promise<number> => Number((await sql<{ n: string }>(s.url, text, params))[0].n);
const sessionState = async (id: number): Promise<any> => (await sql<{ state: any }>(s.url, 'SELECT state FROM hk_saga_sessions WHERE id = $1', [id]))[0].state;
const content = async (code: string): Promise<any> => (await sql<{ content: any }>(s.url, 'SELECT content FROM hk_saga_stages WHERE code = $1', [code]))[0].content;

/** Câu trả lời đúng (hoặc cố ý sai) của một câu luyện tập không phải ghép cặp */
function answerOf(itemId: number, right: boolean): unknown {
  const { kind, data } = keys.get(itemId)!;
  if (kind === 'quiz' || kind === 'locate') return { choice: right ? data.correct : '__sai__' };
  if (kind === 'tactic') return { choice: data.options.find((o: any) => (right ? o.score === 2 : o.score === 0)).id };
  const order = data.items.map((i: any) => i.id);
  return { order: right ? order : [order[1], order[0], ...order.slice(2)] };
}

/** Làm hết một lượt luyện tập hoặc ôn tập; `wrong` là số câu (không phải ghép cặp) cố ý trả lời sai */
async function playItems(view: any, token: string, wrong = 0): Promise<any> {
  let seq: number = view.seq;
  let res: any = null;
  let missed = 0;
  for (const item of view.items as any[]) {
    if (item.done) continue;
    if (item.kind === 'pairs') {
      const tokens = (await sessionState(view.session_id)).slots.find((x: any) => x.item_id === item.id).tokens as Record<string, string>;
      for (const left of Object.keys(tokens).filter((k) => k.startsWith('l'))) {
        const right = Object.keys(tokens).find((k) => k.startsWith('r') && tokens[k] === tokens[left])!;
        res = await act(view.session_id, seq, { type: 'answer', item_id: item.id, answer: { left, right } }, token);
        expect([res.status, res.body.outcome.correct]).toEqual([200, true]);
        seq = res.body.seq;
      }
      continue;
    }
    const right = missed >= wrong;
    if (!right) missed += 1;
    res = await act(view.session_id, seq, { type: 'answer', item_id: item.id, answer: answerOf(item.id, right) }, token);
    expect([item.prompt, res.status, res.body.outcome.correct]).toEqual([item.prompt, 200, right]);
    expect(typeof res.body.outcome.explanation).toBe('string'); // giải thích chỉ có sau khi trả lời
    seq = res.body.seq;
  }
  return res.body;
}

/** Trận đánh theo lượt: đọc trạng thái chuẩn của máy chủ rồi đánh bằng người chơi máy của động cơ */
async function playTactics(view: any, code: string, token: string): Promise<any> {
  const { autoTactics, normalizeTactics } = await import('../src/saga/tactics');
  const scn = normalizeTactics((await content(code)).battle);
  let seq: number = view.seq;
  let res: any = null;
  for (let guard = 0; guard < 200; guard++) {
    const engine = (await sessionState(view.session_id)).engine;
    if (engine.status !== 'active') break;
    res = await act(view.session_id, seq, autoTactics(scn, engine) as any, token);
    expect(res.status).toBe(200);
    seq = res.body.seq;
  }
  return res.body;
}

const BD_STAKES: Array<[number, number]> = [[5, 1], [6, 1], [7, 1], [8, 1], [7, 0], [8, 0]];
const BD_LURE = [{ type: 'provoke' }, { type: 'move', to: [5, 1] }, { type: 'move', to: [6, 1] }, { type: 'move', to: [7, 1] }, { type: 'move', to: [8, 0] }];
/** Màn Bạch Đằng chỉ qua API (không đọc trạng thái nội bộ): đóng cọc theo con nước, nhử theo `lure`, phản công bằng các lựa chọn máy chủ đưa ra */
async function playBachDang(start: any, token: string, stakes = BD_STAKES, lure: Array<Record<string, unknown>> = BD_LURE): Promise<any> {
  let view = start;
  let res: any = null;
  const send = async (action: Record<string, unknown>) => {
    res = await act(view.session_id, view.seq, action, token);
    expect([JSON.stringify(action), res.status]).toEqual([JSON.stringify(action), 200]);
    view = res.body.view;
  };
  const todo = [...stakes];
  for (let guard = 0; view.phase === 'prepare' && guard < 40; guard++) {
    if (view.tide.level === 0 && todo.length && view.stakes_turn_left > 0) await send({ type: 'stake', at: todo.shift() });
    else await send(todo.length ? { type: 'wait' } : { type: 'ready' });
  }
  for (const a of lure) if (view.status === 'active' && view.phase === 'lure') await send(a);
  for (let guard = 0; view.status === 'active' && view.phase === 'lure' && guard < 10; guard++) await send({ type: 'wait' });
  for (let guard = 0; view.status === 'active' && guard < 200; guard++) {
    const allies = view.options.allies as Array<{ unit: string; moves: Array<{ to: [number, number]; attack: string[]; fire: string[] }> }>;
    if (!allies.length) { await send({ type: 'end_turn' }); continue; }
    const units = Object.fromEntries((view.units as any[]).map((u) => [u.id, u]));
    const foes = (view.units as any[]).filter((u) => u.side === 'enemy' && ['free', 'slow', 'stuck'].includes(u.state));
    let best: { sc: number; a: Record<string, unknown> } | null = null;
    const consider = (sc: number, a: Record<string, unknown>) => { if (!best || sc > best.sc) best = { sc, a }; };
    for (const ally of allies) for (const m of ally.moves) {
      for (const t of m.fire) if (units[t].state !== 'free' && units[t].burn === 0) consider(70 + (units[t].flagship ? 8 : 0), { type: 'order', unit: ally.unit, to: m.to, fire: t });
      for (const t of m.attack) consider((units[t].state === 'stuck' ? 50 : 45) + (units[t].flagship ? 8 : 0) - units[t].hp * 0.5, { type: 'order', unit: ally.unit, to: m.to, attack: t });
      if (!m.attack.length) consider(10 - Math.min(...foes.map((e) => Math.abs(m.to[0] - e.x) + Math.abs(m.to[1] - e.y))), { type: 'order', unit: ally.unit, to: m.to });
    }
    await send(best!.a);
  }
  return res.body;
}

/** Đi hết cảnh khám phá bằng đúng thao tác của người chơi; tới điểm chạm trán thì đánh trận rồi quay lại cảnh */
async function playExplore(code: string, token: string, opts: { battle?: (start: any) => Promise<any>; stopAtBattle?: boolean } = {}): Promise<any> {
  const id = stageId[code];
  const script = (await content(code)).explore;
  const start = await api('POST', `/api/saga/stages/${id}/explore`, {}, token);
  expect(start.status).toBe(200);
  let view = start.body;
  let res: any = null;
  const send = async (action: Record<string, unknown>) => {
    res = await act(view.session_id, view.seq, action, token);
    expect([JSON.stringify(action), res.status]).toEqual([JSON.stringify(action), 200]);
    view = res.body.view;
  };
  for (let guard = 0; view.status === 'active' && guard < 60; guard++) {
    const step = script.steps[view.progress.step];
    expect(view.current.goal).toBe(step.goal);
    if (step.type === 'talk' || step.type === 'find' || step.type === 'give') await send({ type: 'interact', target: `npc:${step.npc}` });
    else if (step.type === 'pickup') await send({ type: 'interact', target: `item:${step.item}` });
    else if (step.type === 'ask') { await send({ type: 'interact', target: `npc:${step.npc}` }); await send({ type: 'answer', choice: step.correct }); }
    else if (step.type === 'zone') await send({ type: 'interact', target: `zone:${step.zone}` });
    else {
      await send({ type: 'interact', target: `zone:${step.zone}` });
      if (res.body.outcome.events.some((e: any) => e.t === 'battle')) {
        if (opts.stopAtBattle) return { view, at_battle: true };
        const battle = await api('POST', `/api/saga/stages/${id}/battle`, {}, token);
        expect(battle.status).toBe(200);
        const done = await opts.battle!(battle.body);
        expect(done.finished.won).toBe(true);
        await send({ type: 'interact', target: `zone:${step.zone}` });
      }
    }
  }
  return res.body;
}

async function learn(code: string, token: string): Promise<void> {
  expect((await api('GET', `/api/saga/stages/${stageId[code]}/lesson`, undefined, token)).status).toBe(200);
  expect((await api('POST', `/api/saga/stages/${stageId[code]}/lesson/complete`, {}, token)).status).toBe(200);
}
async function practice(code: string, token: string, wrong = 0): Promise<any> {
  const start = await api('POST', `/api/saga/stages/${stageId[code]}/practice`, {}, token);
  expect(start.status).toBe(200);
  return playItems(start.body, token, wrong);
}

(hasPostgres() ? describe : describe.skip)('Hành trình Đông A (API)', () => {
  beforeAll(async () => {
    s = await startApp('saga_spec');
    const root = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, root);
    clock = s.moduleRef.get((await import('../src/game/clock')).GameClock);
    stageId = Object.fromEntries((await sql<{ code: string; id: number }>(s.url, 'SELECT code, id FROM hk_saga_stages')).map((r) => [r.code, r.id]));
    for (const r of await sql<{ id: number; kind: string; data: any }>(s.url, 'SELECT id, kind, data FROM hk_saga_items')) keys.set(r.id, r);
    // 21/11/2026: cả 13 chặng nay mở thế giới khối ở bước nhập vai (thử ở world.spec.ts). Bỏ nhiệm vụ khối trong cơ sở dữ liệu thử để tệp này tiếp tục thử
    // luồng dự phòng của máy chủ (cảnh nhập vai 2D theo content.explore) cùng học, luyện tập, trận đánh, hoàn thành chặng và phần thưởng
    await sql(s.url, "UPDATE hk_saga_stages SET content = content - 'world'");
  }, 240_000);
  afterAll(async () => { clock?.reset(); await s?.close(); });

  it('nội dung khởi tạo đã công bố: ba cuộc kháng chiến, 13 chặng trên bản đồ, vị trí điểm theo tỉ lệ ảnh', async () => {
    const home = await api('GET', '/api/saga/home');
    expect(home.status).toBe(200);
    expect(home.body.campaigns.map((c: any) => [c.campaign_no, c.years, c.stages, c.done, c.is_new])).toEqual([[1, '1258', 3, 0, true], [2, '1285', 6, 0, true], [3, '1287–1288', 4, 0, true]]);
    expect(home.body.next).toMatchObject({ stage_id: stageId['binh-le-nguyen'] });
    expect(home.body.hud.level.level).toBe(1);
    const map = await api('GET', '/api/saga/campaigns/1');
    expect(map.body.map).toMatchObject({ image_key: 'ban-do-khang-chien-1', image_w: 1500, image_h: 1052 });
    expect(map.body.map.credit).toMatch(/Wikimedia Commons/);
    expect(map.body.stages.map((x: any) => [x.code, x.state, x.order])).toEqual([['binh-le-nguyen', 'ready', 1], ['vuon-khong-nha-trong', 'locked', 2], ['dong-bo-dau', 'locked', 3]]);
    for (const st of map.body.stages) { expect(st.map_x).toBeGreaterThan(0); expect(st.map_x).toBeLessThan(1); expect(st.map_y).toBeGreaterThan(0); expect(st.map_y).toBeLessThan(1); }
    expect(map.body.stages[1].lock_reason).toMatch(/Bình Lệ Nguyên/);
    expect((await api('GET', '/api/saga/campaigns/9')).status).toBe(404);
    // thẻ của điểm trên bản đồ: kiến thức sẽ học, yêu cầu mở khóa, kết quả cũ; không lộ nội dung bài và đáp án
    const detail = await api('GET', `/api/saga/stages/${stageId['vuon-khong-nha-trong']}`);
    expect(detail.body).toMatchObject({ state: 'locked', pass_percent: 70, cards_count: 4 });
    expect(detail.body.objectives).toHaveLength(2);
    expect(detail.body.practice.items).toBe(6);
    for (const secret of ['correct', 'feedback', 'cards', 'explore_script', 'steps_script']) expect(keysOf(detail.body).has(secret)).toBe(false);
  });

  it('chặng khóa không mở được bằng cách gọi thẳng API; trong một chặng phải đi đúng thứ tự học → luyện tập → nhập vai → trận đánh', async () => {
    const locked = stageId['vuon-khong-nha-trong'];
    expect((await api('GET', `/api/saga/stages/${locked}/lesson`)).status).toBe(409);
    expect((await api('POST', `/api/saga/stages/${locked}/lesson/complete`, {})).status).toBe(409);
    for (const kind of ['practice', 'explore', 'battle']) expect([kind, (await api('POST', `/api/saga/stages/${locked}/${kind}`, {})).status]).toEqual([kind, 409]);
    expect((await api('GET', `/api/saga/stages/${locked}/summary`)).status).toBe(409);
    const open = stageId['binh-le-nguyen'];
    expect((await api('POST', `/api/saga/stages/${open}/practice`, {})).body.detail).toMatch(/học xong/);
    expect((await api('POST', `/api/saga/stages/${open}/explore`, {})).body.detail).toMatch(/70%/);
    expect((await api('POST', `/api/saga/stages/${open}/battle`, {})).status).toBe(409);
    expect((await api('GET', `/api/saga/stages/999999`)).status).toBe(404);
  });

  it('học ngắn: 3–5 thẻ kiến thức kèm nguồn; hoàn thành bài học chỉ được thưởng một lần', async () => {
    const id = stageId['binh-le-nguyen'];
    const lesson = await api('GET', `/api/saga/stages/${id}/lesson`);
    expect(lesson.body.cards).toHaveLength(4);
    for (const c of lesson.body.cards) { expect(c.source.url).toMatch(/^https:\/\//); expect(typeof c.objective_text).toBe('string'); }
    const done = await api('POST', `/api/saga/stages/${id}/lesson/complete`, {});
    expect(done.body).toMatchObject({ done: true, first: true, xp: 10 });
    expect((await api('POST', `/api/saga/stages/${id}/lesson/complete`, {})).body).toMatchObject({ first: false, xp: 0 });
    expect(await count("SELECT count(*) AS n FROM hk_points WHERE user_id = $1 AND ref_key = $2", [f.S1.id, `hq:lesson:${id}`])).toBe(1);
  });

  it('luyện tập: đề không có đáp án; dưới ngưỡng thì chưa đạt và được làm lại; câu sai vào danh sách ôn; đạt lần đầu mới thưởng', async () => {
    const id = stageId['binh-le-nguyen'];
    const start = await api('POST', `/api/saga/stages/${id}/practice`, {});
    expect(start.body).toMatchObject({ kind: 'practice', total: 6, index: 0, pass_percent: 70, resumed: false });
    for (const secret of ['correct', 'feedback', 'score_key', 'tokens', 'explanation', 'when']) expect(keysOf(start.body.items).has(secret)).toBe(false);
    expect(start.body.items.map((i: any) => i.kind).sort()).toEqual(['locate', 'pairs', 'quiz', 'quiz', 'sequence', 'tactic']);
    // gọi lại (tải lại trang) nhận đúng phiên đang mở
    expect((await api('POST', `/api/saga/stages/${id}/practice`, {})).body).toMatchObject({ session_id: start.body.session_id, resumed: true });
    const fail = await playItems(start.body, f.S1.token, 3);
    expect(fail.finished).toMatchObject({ percent: 50, passed: false, stars: 0, first_pass: false, xp: 0, pass_percent: 70 });
    expect(fail.completion).toBeNull();
    expect((await api('POST', `/api/saga/stages/${id}/explore`, {})).status).toBe(409); // chưa đạt thì chưa được nhập vai
    expect((await api('GET', '/api/saga/review')).body.due).toHaveLength(3);
    const pass = await practice('binh-le-nguyen', f.S1.token, 1);
    expect(pass.finished).toMatchObject({ percent: 83, passed: true, stars: 1, first_pass: true, xp: 30, best: 83 });
    const again = await practice('binh-le-nguyen', f.S1.token);
    expect(again.finished).toMatchObject({ percent: 100, passed: true, stars: 3, first_pass: false, xp: 0, best: 100 });
    expect(await count('SELECT count(*) AS n FROM hk_points WHERE user_id = $1 AND ref_key = $2', [f.S1.id, `hq:practice:${id}`])).toBe(1);
    const detail = (await api('GET', `/api/saga/stages/${id}`)).body;
    expect(detail.practice).toMatchObject({ best: 100, tries: 3, passed: true });
    expect(detail.state).toBe('learning');
  });

  it('gửi lặp một lệnh nhận lại kết quả cũ và không cộng thưởng lần hai; lệnh lệch thứ tự bị từ chối; phiên của người khác không chạm được', async () => {
    const id = stageId['binh-le-nguyen'];
    const start = (await api('POST', `/api/saga/stages/${id}/practice`, {})).body;
    const first = start.items.find((i: any) => i.kind === 'quiz');
    const actionId = randomUUID();
    const xpBefore = (await api('GET', '/api/game/me')).body.xp;
    const one = await act(start.session_id, start.seq, { type: 'answer', item_id: first.id, answer: answerOf(first.id, true) }, f.S1.token, actionId);
    expect(one.body).toMatchObject({ seq: 1, replayed: false });
    // cùng mã lệnh gửi lại (bấm hai lần, mạng chập chờn): kết quả cũ, không xử lý lại
    const dup = await act(start.session_id, start.seq, { type: 'answer', item_id: first.id, answer: answerOf(first.id, false) }, f.S1.token, actionId);
    expect(dup.status).toBe(200);
    expect(dup.body).toMatchObject({ seq: 1, replayed: true });
    expect(dup.body.outcome).toEqual(one.body.outcome);
    expect(await count('SELECT count(*) AS n FROM hk_saga_answers WHERE session_id = $1', [start.session_id])).toBe(1);
    expect(await count('SELECT count(*) AS n FROM hk_saga_actions WHERE session_id = $1', [start.session_id])).toBe(1);
    // lệnh mới nhưng dựa trên trạng thái cũ (seq 0): từ chối, trạng thái không đổi
    const other = start.items.find((i: any) => i.kind === 'locate');
    const stale = await act(start.session_id, 0, { type: 'answer', item_id: other.id, answer: answerOf(other.id, true) });
    expect(stale.status).toBe(409);
    expect((await api('GET', `/api/saga/sessions/${start.session_id}`)).body).toMatchObject({ seq: 1, index: start.items.findIndex((i: any) => i.id !== first.id && !i.done) });
    // trả lời lại câu đã trả lời, sai định dạng lệnh
    expect((await act(start.session_id, 1, { type: 'answer', item_id: first.id, answer: answerOf(first.id, true) })).status).toBe(400);
    expect((await api('POST', `/api/saga/sessions/${start.session_id}/actions`, { action_id: 'ngan', seq: 1, action: { type: 'answer' } })).status).toBe(422);
    expect((await api('POST', `/api/saga/sessions/${start.session_id}/actions`, { action_id: randomUUID(), seq: 1, action: 'x' })).status).toBe(422);
    // học sinh khác: không xem, không gửi lệnh vào phiên của bạn
    expect((await api('GET', `/api/saga/sessions/${start.session_id}`, undefined, f.S2.token)).status).toBe(404);
    expect((await act(start.session_id, 1, { type: 'answer', item_id: other.id, answer: answerOf(other.id, true) }, f.S2.token)).status).toBe(404);
    expect((await api('GET', '/api/game/me')).body.xp).toBe(xpBefore);
    // làm nốt lượt này để không còn phiên dở
    await playItems((await api('GET', `/api/saga/sessions/${start.session_id}`)).body, f.S1.token);
  });

  it('vòng chơi đầu – cuối của một chặng có trận đánh: nhập vai tới điểm chạm trán, đánh trận, quay lại cảnh, tổng kết, thưởng một lần và mở chặng sau', async () => {
    const id = stageId['binh-le-nguyen'];
    const stopped = await playExplore('binh-le-nguyen', f.S1.token, { stopAtBattle: true });
    expect(stopped.view.current).toMatchObject({ type: 'battle', marker: 'zone:front' });
    expect(keysOf(stopped.view).has('correct')).toBe(false);
    // trận đánh: máy chủ giữ trạng thái; mở lại nhận đúng phiên; `restart` bỏ phiên cũ
    const battle = await api('POST', `/api/saga/stages/${id}/battle`, {});
    expect(battle.body).toMatchObject({ kind: 'battle', mode: 'tactics', status: 'active', resumed: false });
    expect(keysOf(battle.body).has('correct')).toBe(false);
    expect(battle.body.units.filter((u: any) => u.side === 'ally')).toHaveLength(4);
    expect((await api('POST', `/api/saga/stages/${id}/battle`, {})).body).toMatchObject({ session_id: battle.body.session_id, resumed: true });
    const fresh = await api('POST', `/api/saga/stages/${id}/battle`, { restart: true });
    expect(fresh.body.session_id).not.toBe(battle.body.session_id);
    expect((await sql(s.url, 'SELECT status FROM hk_saga_sessions WHERE id = $1', [battle.body.session_id]))[0]).toEqual({ status: 'abandoned' });
    expect((await act(battle.body.session_id, 0, { type: 'defend' })).status).toBe(409); // phiên đã bỏ không nhận lệnh
    // lệnh không hợp lệ bị máy chủ từ chối và không làm đổi trạng thái
    expect((await act(fresh.body.session_id, fresh.body.seq, { type: 'attack', target: 'khong_co' })).status).toBe(400);
    expect((await act(fresh.body.session_id, fresh.body.seq, { type: 'thang_luon' })).status).toBe(400);
    expect((await api('GET', `/api/saga/sessions/${fresh.body.session_id}`)).body.seq).toBe(fresh.body.seq);
    const won = await playTactics(fresh.body, 'binh-le-nguyen', f.S1.token);
    expect(won.finished).toMatchObject({ won: true, first_win: true, xp: 50 });
    expect(won.finished.stars).toBeGreaterThanOrEqual(1);
    expect(won.completion).toBeNull(); // còn phải quay lại cảnh và báo cáo
    // quay lại đúng cảnh và đúng bước đang làm
    const back = (await api('POST', `/api/saga/stages/${id}/explore`, {})).body;
    expect(back).toMatchObject({ resumed: true, session_id: stopped.view.session_id });
    expect(back.current.type).toBe('battle');
    expect(back.battle.won).toBe(true);
    const done = await playExplore('binh-le-nguyen', f.S1.token);
    expect(done.finished).toMatchObject({ hints: 0, mistakes: 0, first: true, xp: 20 });
    expect(done.completion).toMatchObject({ first: true, stars: 3, knowledge_percent: 100, campaign_done: false });
    expect(done.completion.rewards).toMatchObject({ xp: 100, gold: 30, badge: null });
    expect(done.completion.rewards.card).toMatchObject({ code: 'le-phu-tran', name: 'Lê Phụ Trần' });
    expect(done.completion.next).toMatchObject({ id: stageId['vuon-khong-nha-trong'] });
    // bản đồ: chặng xong, chặng sau mở
    const map = (await api('GET', '/api/saga/campaigns/1')).body;
    // chặng đã xong nhưng còn 3 câu từng trả lời sai chưa ôn lại nên mang trạng thái "cần ôn"
    expect(map.stages.map((x: any) => x.state)).toEqual(['review', 'ready', 'locked']);
    expect(map.stages[0]).toMatchObject({ stars: 3, knowledge_percent: 100, review_due: 3 });
    expect(map.stages[0].battle_stars).toBeGreaterThanOrEqual(1);
    // tổng kết: diễn biến lịch sử đã kiểm chứng kèm nguồn và ghi chú phần sáng tạo
    const summary = (await api('GET', `/api/saga/stages/${id}/summary`)).body;
    expect(summary.debrief.paragraphs.length).toBeGreaterThanOrEqual(3);
    expect(summary.debrief.sources[0].url).toMatch(/^https:\/\//);
    expect(summary.debrief.fiction).toMatch(/sáng tạo/);
    // chơi lại không được thưởng lần hai
    const replay = await practice('binh-le-nguyen', f.S1.token);
    expect(replay.completion).toMatchObject({ first: false });
    expect(replay.completion.rewards).toMatchObject({ xp: 0, gold: 0, card: null });
    const again = await playExplore('binh-le-nguyen', f.S1.token, { battle: (b) => playTactics(b, 'binh-le-nguyen', f.S1.token) });
    expect(again.finished).toMatchObject({ first: false, xp: 0 });
    for (const ref of [`hq:stage:${id}`, `hq:explore:${id}`, `hq:battle:${id}`]) expect([ref, await count('SELECT count(*) AS n FROM hk_points WHERE user_id = $1 AND ref_key = $2', [f.S1.id, ref])]).toEqual([ref, 1]);
    expect(await count('SELECT count(*) AS n FROM hk_gold_ledger WHERE user_id = $1 AND ref_key = $2', [f.S1.id, `hq:stage:${id}`])).toBe(1);
    expect(await count('SELECT count(*) AS n FROM hk_saga_user_cards WHERE user_id = $1', [f.S1.id])).toBe(1);
  });

  it('hòm báu trên bản đồ: hòm giữa hai chặng mở khi xong chặng trước, hòm cuối phần mở khi xong cả phần; máy chủ kiểm tra điều kiện, mỗi hòm chỉ thưởng một lần', async () => {
    const id = stageId['binh-le-nguyen'], id2 = stageId['vuon-khong-nha-trong'];
    const map = (await api('GET', '/api/saga/campaigns/1')).body;
    expect(map.chests.map((c: any) => [c.key, c.kind, c.after, c.state, c.max_gold])).toEqual([[`s${id}`, 'stage', 1, 'ready', 100], [`s${id2}`, 'stage', 2, 'locked', 100], ['p1', 'part', 3, 'locked', 100]]);
    // hòm bí ẩn: không lộ độ hiếm trước khi mở, công bố tỉ lệ; hòm cuối phần không có loại Thường
    expect(map.chests[0].odds).toEqual([{ rarity: 'common', percent: 55 }, { rarity: 'rare', percent: 30 }, { rarity: 'epic', percent: 12 }, { rarity: 'legendary', percent: 3 }]);
    expect(map.chests[2].odds.map((o: any) => o.rarity)).toEqual(['rare', 'epic', 'legendary']);
    for (const c of map.chests) expect(Object.keys(c)).not.toContain('rarity');
    expect((await api('POST', `/api/saga/chests/s${id2}/open`, {})).status).toBe(409);
    expect((await api('POST', '/api/saga/chests/p1/open', {})).status).toBe(409);
    expect((await api('POST', `/api/saga/chests/s${stageId['dong-bo-dau']}/open`, {})).status).toBe(404); // chặng cuối phần không có hòm "sau chặng"
    for (const bad of ['xyz', 'p9', 's99999']) expect((await api('POST', `/api/saga/chests/${bad}/open`, {})).status).toBe(404);
    // học sinh khác chưa xong chặng thì không mở được hòm của chặng đó
    expect((await api('POST', `/api/saga/chests/s${id}/open`, {}, f.S2.token)).status).toBe(409);
    const gold = async () => Number((await sql<{ gold: number }>(s.url, 'SELECT gold FROM hk_players WHERE user_id = $1', [f.S1.id]))[0].gold);
    const before = await gold();
    const opened = await api('POST', `/api/saga/chests/s${id}/open`, {});
    expect(opened.status).toBe(200);
    expect(opened.body).toMatchObject({ key: `s${id}`, kind: 'stage', first: true, opened: 1, total: 13, next: { name: 'Hiệu úy Đông A', left: 2 } });
    expect(['common', 'rare', 'epic', 'legendary']).toContain(opened.body.rarity);
    expect(opened.body.gold).toBeGreaterThanOrEqual(10);
    expect(opened.body.gold).toBeLessThanOrEqual(115);
    // hòm đầu tiên mở khóa danh hiệu "Tân binh Sát Thát" và tự trang bị vì ô danh hiệu đang trống
    expect(opened.body.unlocked).toEqual([{ kind: 'title', code: 'tan-binh-sat-that', name: 'Tân binh Sát Thát', rarity: 'common', equipped: true }]);
    // mở lại: cùng độ hiếm (không đổi được kết quả), không thưởng thêm
    expect((await api('POST', `/api/saga/chests/s${id}/open`, {})).body).toMatchObject({ first: false, rarity: opened.body.rarity, gold: 0, xp: 0, freeze: 0, unlocked: [] });
    expect(await gold()).toBe(before + opened.body.gold);
    expect(await count("SELECT count(*) AS n FROM hk_gold_ledger WHERE user_id = $1 AND reason = 'chest' AND ref_key = $2", [f.S1.id, `hq:chest:s${id}`])).toBe(1);
    expect((await api('GET', '/api/saga/campaigns/1')).body.chests[0].state).toBe('opened');
    expect((await api('GET', '/api/saga/campaigns/1', undefined, f.S2.token)).body.chests[0].state).toBe('locked');
  });

  it('hòm báu bí ẩn: độ hiếm theo tỉ lệ công bố, cố định theo học sinh và hòm, phần thưởng đúng khoảng của độ hiếm', async () => {
    const { rollChest } = await import('../src/saga/saga.service');
    const count = (kind: 'stage' | 'part') => { const n: Record<string, number> = {}; for (let u = 1; u <= 4000; u += 1) { const r = rollChest(u, kind === 'stage' ? 's7' : 'p2', kind); n[r.rarity] = (n[r.rarity] ?? 0) + 1; } return n; };
    const st = count('stage'), pt = count('part');
    expect(st.common / 4000).toBeGreaterThan(0.5); expect(st.common / 4000).toBeLessThan(0.6);
    expect(st.legendary / 4000).toBeGreaterThan(0.015); expect(st.legendary / 4000).toBeLessThan(0.045);
    expect(pt.common ?? 0).toBe(0);
    expect(pt.legendary / 4000).toBeGreaterThan(0.12); expect(pt.legendary / 4000).toBeLessThan(0.18);
    expect(rollChest(42, 's3', 'stage')).toEqual(rollChest(42, 's3', 'stage'));
    for (let u = 1; u <= 300; u += 1) {
      const r = rollChest(u, 'p1', 'part');
      const range = { common: [10, 20], rare: [20, 35], epic: [35, 60], legendary: [60, 100] }[r.rarity];
      expect(r.gold).toBeGreaterThanOrEqual(range[0]); expect(r.gold).toBeLessThanOrEqual(range[1]);
      expect(r.xp).toBe({ common: 0, rare: 10, epic: 25, legendary: 50 }[r.rarity] + 20);
      expect(r.freeze).toBe(r.rarity === 'epic' || r.rarity === 'legendary' ? 1 : 0);
    }
  });

  it('khung ảnh đại diện và danh hiệu từ hòm báu: kho theo số hòm đã mở, chỉ trang bị món đã mở khóa, trang chủ trả món đang trang bị', async () => {
    const w = (await api('GET', '/api/saga/cosmetics')).body;
    expect(w).toMatchObject({ opened: 1, total: 13, equipped: { frame: null, title: { code: 'tan-binh-sat-that', rarity: 'common' } } });
    expect(w.frames.map((x: any) => [x.code, x.rarity, x.unlocked])).toEqual([['dong-bo-dau', 'rare', false], ['chuong-duong', 'epic', false], ['bach-dang', 'legendary', false]]);
    expect(w.titles.map((x: any) => x.unlocked)).toEqual([true, false, false, false, false, false, false]); // + 2 danh hiệu của thế giới khối (21/11/2026)
    expect(w.titles.slice(5).map((x: any) => x.code)).toEqual(['nguoi-giu-lang', 'dong-long-giu-nuoc']);
    expect(w.titles[4]).toMatchObject({ code: 'dai-tuong-hao-khi', need: 'Mở 13 hòm báu trên bản đồ' });
    expect((await api('GET', '/api/saga/home')).body.look).toEqual(w.equipped);
    expect((await api('POST', '/api/saga/cosmetics/equip', { frame: 'bach-dang' })).status).toBe(409);
    expect((await api('POST', '/api/saga/cosmetics/equip', { title: 'hieu-uy-dong-a' })).status).toBe(409);
    expect((await api('POST', '/api/saga/cosmetics/equip', { title: 'khong-co' })).status).toBe(404);
    expect((await api('POST', '/api/saga/cosmetics/equip', { title: 'Sai Định Dạng!' })).status).toBe(422);
    const off = await api('POST', '/api/saga/cosmetics/equip', { title: null });
    expect(off.status).toBe(200);
    expect(off.body.equipped).toEqual({ frame: null, title: null, avatar: null });
    expect((await api('POST', '/api/saga/cosmetics/equip', { title: 'tan-binh-sat-that' })).body.equipped.title).toMatchObject({ code: 'tan-binh-sat-that' });
    // ảnh đại diện có sẵn (Rồng Con, danh tướng): chọn tự do, mã lạ bị từ chối, null = dùng ảnh của em
    expect(w.avatars).toHaveLength(12);
    expect(w.avatars).toEqual(expect.arrayContaining(['rong-con-vui', 'tran-hung-dao']));
    expect((await api('POST', '/api/saga/cosmetics/equip', { avatar: 'rong-con-vua' })).body.equipped.avatar).toBe('rong-con-vua');
    expect((await api('POST', '/api/saga/cosmetics/equip', { avatar: 'khong-co' })).status).toBe(404);
    expect((await api('GET', '/api/saga/home')).body.look.avatar).toBe('rong-con-vua');
    expect((await api('POST', '/api/saga/cosmetics/equip', { avatar: 'tran-hung-dao' }, f.S2.token)).body.equipped).toMatchObject({ avatar: 'tran-hung-dao', frame: null });
    expect((await api('POST', '/api/saga/cosmetics/equip', { avatar: null }, f.S2.token)).body.equipped.avatar).toBeNull();
    // học sinh khác chưa mở hòm nào: không trang bị được khung / danh hiệu
    expect((await api('POST', '/api/saga/cosmetics/equip', { title: 'tan-binh-sat-that' }, f.S2.token)).status).toBe(409);
    expect((await api('GET', '/api/saga/cosmetics', undefined, f.S2.token)).body).toMatchObject({ opened: 0, equipped: { frame: null, title: null, avatar: null } });
    // trang bị nằm trong hk_players.appearance, không làm mất ngoại hình nhân vật cũ
    const look = (await sql<{ appearance: Record<string, unknown> }>(s.url, 'SELECT appearance FROM hk_players WHERE user_id = $1', [f.S1.id]))[0].appearance;
    expect(look).toMatchObject({ saga_title: 'tan-binh-sat-that', saga_avatar: 'rong-con-vua' });
  });

  it('đăng nhập lại vẫn đúng tiến độ; thẻ nhân vật và tư liệu mở theo kết quả học', async () => {
    const username = (await sql<{ username: string }>(s.url, 'SELECT username FROM app_users WHERE id = $1', [f.S1.id]))[0].username;
    const login = await call(s.base, 'POST', '/api/auth/login', { username, password: PW, portal: 'student' });
    expect(login.status).toBe(200);
    const home = (await api('GET', '/api/saga/home', undefined, login.body.token)).body;
    expect(home.campaigns[0]).toMatchObject({ done: 1, stars: 3, is_new: false, percent: 33 });
    expect(home.next).toMatchObject({ stage_id: stageId['vuon-khong-nha-trong'] });
    expect(home.hud.xp).toBeGreaterThanOrEqual(210);
    const cards = (await api('GET', '/api/saga/cards', undefined, login.body.token)).body;
    expect([cards.total, cards.owned, cards.latest_code]).toEqual([13, 1, 'le-phu-tran']);
    expect(cards.cards.find((c: any) => c.code === 'le-phu-tran')).toMatchObject({ owned: true });
    expect(cards.cards.find((c: any) => c.code === 'le-phu-tran').intro.length).toBeGreaterThan(20);
    const hidden = cards.cards.find((c: any) => c.code === 'tran-hung-dao');
    expect(hidden).toMatchObject({ owned: false, stage_title: 'Bạch Đằng' });
    expect(hidden.intro).toBeUndefined(); // thẻ chưa mở không lộ phần giới thiệu
    const archive = (await api('GET', '/api/saga/archive', undefined, login.body.token)).body;
    expect(archive.maps).toHaveLength(3);
    expect(archive.timeline.length).toBeGreaterThanOrEqual(13);
    const doc = archive.texts.find((t: any) => t.code === 'loi-tran-thu-do');
    expect(doc).toMatchObject({ locked: true, lock: { stage_title: 'Vườn không nhà trống' } });
    expect(doc.body).toBeUndefined();
  });

  it('chặng không có trận đánh hoàn thành bằng nhiệm vụ khám phá; xem lại manh mối và hỏi nhầm người được ghi nhận để gợi ý ôn tập', async () => {
    const code = 'vuon-khong-nha-trong';
    await learn(code, f.S1.token);
    await practice(code, f.S1.token);
    expect((await api('POST', `/api/saga/stages/${stageId[code]}/battle`, {})).body.detail).toMatch(/không có trận đánh/);
    const start = (await api('POST', `/api/saga/stages/${stageId[code]}/explore`, {})).body;
    expect(start.battle).toBeNull();
    // hỏi nhầm người ở bước đầu chỉ nhận câu chào; xem lại manh mối sau khi đã nghe lệnh được tính là một lần gợi ý
    const idle = await act(start.session_id, start.seq, { type: 'interact', target: 'npc:boy' });
    expect(idle.body.outcome.events[0]).toMatchObject({ t: 'say' });
    expect(idle.body.view.progress).toMatchObject({ step: 0, mistakes: 0 });
    const talk = await act(start.session_id, idle.body.seq, { type: 'interact', target: 'npc:chief' });
    const hint = await act(start.session_id, talk.body.seq, { type: 'hint' });
    expect(hint.body.outcome.events[0].t).toBe('clue');
    expect(hint.body.view.progress).toMatchObject({ step: 1, hints: 1 });
    const done = await playExplore(code, f.S1.token);
    expect(done.finished).toMatchObject({ hints: 1, mistakes: 0, first: true });
    expect(done.completion).toMatchObject({ first: true, battle: null });
    expect(done.completion.rewards.card).toMatchObject({ code: 'tran-thu-do' });
    expect(done.completion.rewards.docs.map((d: any) => d.title)).toEqual(['Lời Thái sư Trần Thủ Độ']);
    const archive = (await api('GET', '/api/saga/archive')).body;
    expect(archive.texts.find((t: any) => t.code === 'loi-tran-thu-do')).toMatchObject({ locked: false });
    expect(archive.texts.find((t: any) => t.code === 'loi-tran-thu-do').body.lines[0]).toMatch(/Đầu thần/);
  });

  it('ôn tập: ưu tiên câu đã sai, đồng hồ do máy chủ giữ, trả lời đúng thì câu ra khỏi danh sách ôn và mỗi câu chỉ thưởng một lần trong ngày', async () => {
    const before = (await api('GET', '/api/saga/review')).body;
    expect(before.due).toHaveLength(3);
    expect(before.can_start).toBe(true);
    const start = (await api('POST', '/api/saga/review/start', {})).body;
    expect(start).toMatchObject({ kind: 'review', stage: null, index: 0 });
    expect(start.items.length).toBe(Math.min(10, before.pool));
    expect(start.items.every((i: any) => i.kind !== 'pairs')).toBe(true);
    expect(start.timer.left_ms).toBeGreaterThan(15_000);
    const dueIds = before.due.map((d: any) => d.item_id).sort();
    expect(start.items.slice(0, 3).map((i: any) => i.id).sort()).toEqual(dueIds);
    // phải trả lời đúng câu đang hiển thị
    expect((await act(start.session_id, 0, { type: 'answer', item_id: start.items[1].id, answer: answerOf(start.items[1].id, true) })).status).toBe(400);
    const one = await act(start.session_id, 0, { type: 'answer', item_id: start.items[0].id, answer: answerOf(start.items[0].id, true) });
    expect(one.body.outcome).toMatchObject({ correct: true, timeout: false, streak: 1, xp: 5 });
    // đồng hồ của câu sau chỉ chạy khi học sinh mở câu đó: thời gian đọc lời giải thích không bị trừ
    expect(one.body.view.timer).toBeNull();
    clock.advance(60_000);
    const ready = await act(start.session_id, 1, { type: 'ready' });
    expect(ready.body.outcome).toMatchObject({ ready: true, item_id: start.items[1].id });
    expect(ready.body.view.timer.left_ms).toBeGreaterThan(15_000);
    // quá giờ: dù gửi đáp án đúng vẫn tính sai và chuỗi đúng về 0
    clock.advance(120_000);
    const late = await act(start.session_id, 2, { type: 'answer', item_id: start.items[1].id, answer: answerOf(start.items[1].id, true) });
    expect(late.body.outcome).toMatchObject({ correct: false, timeout: true, streak: 0, xp: 0 });
    // không báo mở câu mà để quá lâu (hơn 90 giây đọc giải thích cộng giờ làm bài) thì vẫn bị tính hết giờ
    clock.advance(200_000);
    const skipped = await act(start.session_id, 3, { type: 'answer', item_id: start.items[2].id, answer: answerOf(start.items[2].id, true) });
    expect(skipped.body.outcome).toMatchObject({ correct: false, timeout: true });
    clock.reset();
    const rest = await playItems(skipped.body.view, f.S1.token);
    expect(rest.finished).toMatchObject({ total: start.items.length, right: start.items.length - 2 });
    const stillWrong = [start.items[1].id, start.items[2].id].sort();
    const after = (await api('GET', '/api/saga/review')).body;
    expect(after.due.map((d: any) => d.item_id).sort()).toEqual(stillWrong);
    // lượt ôn thứ hai cùng ngày: câu đã thưởng không thưởng nữa
    const second = (await api('POST', '/api/saga/review/start', {})).body;
    const firstAgain = await act(second.session_id, 0, { type: 'answer', item_id: second.items[0].id, answer: answerOf(second.items[0].id, true) });
    expect(firstAgain.body.outcome.correct).toBe(true);
    expect(second.items.slice(0, 2).map((i: any) => i.id).sort()).toEqual(stillWrong); // các câu còn sai lên đầu
    await playItems(firstAgain.body.view, f.S1.token);
    expect((await api('GET', '/api/saga/review')).body.due).toEqual([]);
    expect(await count("SELECT count(*) AS n FROM hk_points WHERE user_id = $1 AND ref_key LIKE 'hq:rv:%'", [f.S1.id])).toBe(start.items.length);
    expect((await api('GET', '/api/saga/campaigns/1')).body.stages[0].state).toBe('done');
  });

  it('màn Bạch Đằng chơi trọn vẹn qua API: thua khi bày trận sai, thắng khi chơi đúng, nhận thẻ và huy hiệu', async () => {
    const id = stageId['bach-dang'];
    expect((await api('GET', `/api/saga/stages/${id}/lesson`, undefined, f.S2.token)).status).toBe(409);
    // mở sẵn chặng cuối cho học sinh 2 (như một migration nội dung đổi điều kiện mở khóa; không còn trang quản trị để chỉnh)
    await sql(s.url, 'UPDATE hk_saga_stages SET unlock_after = NULL WHERE id = $1', [id]);
    expect((await api('GET', '/api/saga/campaigns/3', undefined, f.S2.token)).body.stages.map((x: any) => x.state)).toEqual(['ready', 'locked', 'locked', 'ready']);
    await learn('bach-dang', f.S2.token);
    const p = await practice('bach-dang', f.S2.token);
    expect(p.finished).toMatchObject({ percent: 100, passed: true, total: 7 });
    const stopped = await playExplore('bach-dang', f.S2.token, { stopAtBattle: true });
    expect(stopped.at_battle).toBe(true);
    // lần 1: nhử theo lạch sâu, nước rút không thuyền nào vướng cọc
    const first = (await api('POST', `/api/saga/stages/${id}/battle`, {}, f.S2.token)).body;
    expect(first).toMatchObject({ mode: 'bachdang', phase: 'prepare' });
    expect(first.tide).toMatchObject({ level: 2, label: 'Cao' });
    expect(first.grid.revealed).toBe(false);
    expect(first.rules.length).toBeGreaterThanOrEqual(6);
    const lost = await playBachDang(first, f.S2.token, BD_STAKES, [{ type: 'provoke' }, { type: 'move', to: [5, 2] }, { type: 'move', to: [7, 2] }, { type: 'move', to: [9, 2] }, { type: 'move', to: [10, 2] }]);
    expect(lost.finished).toMatchObject({ won: false, stars: 0, first_win: false, xp: 0 });
    expect(lost.finished.mistakes.map((m: any) => m.code)).toContain('no_strand');
    expect(lost.completion).toBeNull();
    expect((await api('GET', `/api/saga/stages/${id}`, undefined, f.S2.token)).body.battle).toMatchObject({ won: false, tries: 1 });
    // thua thì chưa qua được điểm chạm trán
    const still = await act(stopped.view.session_id, stopped.view.seq, { type: 'interact', target: 'zone:river' }, f.S2.token);
    expect(still.body.outcome.events).toEqual([{ t: 'battle' }]);
    // lần 2: chơi đúng
    const second = (await api('POST', `/api/saga/stages/${id}/battle`, {}, f.S2.token)).body;
    expect(second.session_id).not.toBe(first.session_id);
    const won = await playBachDang(second, f.S2.token);
    expect(won.finished).toMatchObject({ won: true, stars: 3, stranded: 3, escaped: 0, first_win: true, xp: 50 });
    expect(won.view.result.mistakes).toEqual([]);
    const done = await playExplore('bach-dang', f.S2.token);
    expect(done.completion).toMatchObject({ first: true, stars: 3, campaign_done: false, next: null });
    expect(done.completion.rewards).toMatchObject({ xp: 200, gold: 80 });
    expect(done.completion.rewards.card).toMatchObject({ code: 'tran-hung-dao', rarity: 'legendary' });
    expect(done.completion.rewards.badge).toMatchObject({ name: 'Bạch Đằng' });
    expect(done.completion.rewards.docs.map((d: any) => d.title)).toEqual(expect.arrayContaining(['Toàn thư chép trận Bạch Đằng']));
    expect((await api('GET', '/api/game/badges', undefined, f.S2.token)).body.find((b: any) => b.code === 'saga-bach-dang')).toMatchObject({ earned: true });
    // bảng xếp hạng tuần của lớp tính cả điểm của hành trình
    const board = (await api('GET', '/api/game/leaderboard?scope=class&period=week', undefined, f.S2.token)).body;
    expect(board.entries.find((e: any) => e.me).xp).toBeGreaterThanOrEqual(310);
    expect(board.entries).toHaveLength(2);
  }, 180_000);

  it('chỉ học sinh dùng được /api/saga; mục Hành trình Đông A của quản trị tổng và báo cáo lớp của giáo viên đã xóa hẳn (404)', async () => {
    expect((await call(s.base, 'GET', '/api/saga/home')).status).toBe(401);
    expect((await call(s.base, 'GET', '/api/saga/home', undefined, f.T1.token)).status).toBe(403);
    expect((await call(s.base, 'GET', '/api/saga/home', undefined, f.A.token)).status).toBe(403);
    expect((await call(s.base, 'GET', '/api/saga/home', undefined, f.root)).status).toBe(403);
    const gone: Array<[string, string, string]> = [
      ['GET', '/api/saga/admin/overview', f.root], ['GET', `/api/saga/admin/stages/${stageId['bach-dang']}`, f.root], ['PUT', '/api/saga/admin/maps/1', f.root],
      ['PUT', `/api/saga/admin/stages/${stageId['bach-dang']}/position`, f.root], ['PUT', `/api/saga/admin/stages/${stageId['bach-dang']}`, f.root],
      ['PATCH', `/api/saga/admin/stages/${stageId['bach-dang']}/status`, f.root], ['PUT', '/api/saga/admin/items/1', f.root],
      ['GET', `/api/saga/teacher/classes/${f.class7a.id}`, f.T1.token], ['GET', `/api/saga/teacher/classes/${f.class7a.id}`, f.A.token],
    ];
    for (const [method, path, token] of gone) expect([method, path, (await call(s.base, method, path, method === 'GET' ? undefined : {}, token)).status]).toEqual([method, path, 404]);
  });

  it('các bảng mới bật RLS: vai trò theo trường chỉ đọc nội dung mẫu và chỉ thấy tiến độ của trường mình', async () => {
    const tables = ['hk_saga_maps', 'hk_saga_stages', 'hk_saga_stage_versions', 'hk_saga_items', 'hk_saga_cards', 'hk_saga_docs', 'hk_saga_progress', 'hk_saga_sessions', 'hk_saga_actions', 'hk_saga_answers', 'hk_saga_review', 'hk_saga_user_cards'];
    expect(await count('SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relname = ANY($2) AND c.relrowsecurity', ['public', tables])).toBe(tables.length);
    expect(await count("SELECT count(*) AS n FROM information_schema.role_table_grants WHERE table_name = ANY($1) AND grantee = 'PUBLIC'", [tables])).toBe(0);
    const { Client } = await import('pg');
    const client = new Client({ connectionString: s.url.replace('?sslmode=disable', '') });
    await client.connect();
    const scoped = async (schoolId: number, userId: number, text: string): Promise<any[]> => {
      await client.query('BEGIN');
      try {
        await client.query('SET LOCAL ROLE dong_a_workspace_scope');
        await client.query("SELECT set_config('app.school_id', $1, true), set_config('app.user_id', $2, true)", [String(schoolId), String(userId)]);
        return (await client.query(text)).rows;
      } finally { await client.query('ROLLBACK'); }
    };
    try {
      expect(Number((await scoped(f.A.schoolId, f.S1.id, 'SELECT count(*) AS n FROM hk_saga_progress'))[0].n)).toBeGreaterThanOrEqual(2);
      expect(Number((await scoped(f.B.schoolId, f.TB.id, 'SELECT count(*) AS n FROM hk_saga_progress'))[0].n)).toBe(0);
      expect(Number((await scoped(f.B.schoolId, f.TB.id, 'SELECT count(*) AS n FROM hk_saga_sessions'))[0].n)).toBe(0);
      expect(Number((await scoped(f.B.schoolId, f.TB.id, 'SELECT count(*) AS n FROM hk_saga_answers'))[0].n)).toBe(0);
      expect(Number((await scoped(f.B.schoolId, f.TB.id, 'SELECT count(*) AS n FROM hk_saga_stages'))[0].n)).toBe(13); // nội dung mẫu đọc được ở mọi trường
      await expect(scoped(f.B.schoolId, f.TB.id, "UPDATE hk_saga_stages SET title = 'x'")).rejects.toThrow(/permission denied/);
      await expect(scoped(f.B.schoolId, f.TB.id, `INSERT INTO hk_saga_progress (user_id, stage_id) VALUES (${f.S1.id}, ${stageId['tay-ket']})`)).rejects.toThrow();
    } finally { await client.end(); }
  });
});
