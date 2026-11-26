/**
 * Hành trình Đông A qua API thật trên PostgreSQL tạm (migration 065–066, 083): bốn chiến dịch theo khối 6–9, khóa theo khối, vòng 5 bước của chặng
 * (Quân lệnh → Thám sử nhặt thẻ Binh thư → Hội đồng quân sự → Xuất trận → Sử quan tổng kết), phần thưởng theo câu đúng và sao, trận hội đồng,
 * hòm báu, Chợ phiên Thăng Long, chuỗi ngày, chống gửi lặp, thứ tự lệnh, quyền sở hữu phiên, ôn tập (Luyện binh riêng), bộ sưu tập, kho tư liệu.
 * Chỉ học sinh dùng được /api/saga: mục Hành trình Đông A của quản trị tổng và báo cáo của giáo viên đã xóa theo yêu cầu ngày 16/11/2026.
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

/** Trận hội đồng (25/11/2026): đọc kịch bản từ cơ sở dữ liệu, chọn phương án như lịch sử (hoặc kém nhất khi `worst`) */
async function playCouncil(view: any, code: string, token: string, worst = false): Promise<any> {
  const { autoCouncil, normalizeCouncil } = await import('../src/saga/council');
  const scn = normalizeCouncil((await content(code)).battle);
  let seq: number = view.seq;
  let res: any = null;
  for (let guard = 0; guard < 10; guard++) {
    const engine = (await sessionState(view.session_id)).engine;
    if (engine.status !== 'active') break;
    res = await act(view.session_id, seq, autoCouncil(scn, engine, worst) as any, token);
    expect(res.status).toBe(200);
    seq = res.body.seq;
  }
  return res.body;
}

const todayVN = "(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date";

(hasPostgres() ? describe : describe.skip)('Hành trình Đông A (API)', () => {
  beforeAll(async () => {
    s = await startApp('saga_spec');
    const root = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, root);
    clock = s.moduleRef.get((await import('../src/game/clock')).GameClock);
    stageId = Object.fromEntries((await sql<{ code: string; id: number }>(s.url, 'SELECT code, id FROM hk_saga_stages')).map((r) => [r.code, r.id]));
    for (const r of await sql<{ id: number; kind: string; data: any }>(s.url, 'SELECT id, kind, data FROM hk_saga_items')) keys.set(r.id, r);
    // 21/11/2026: cả 13 chặng nay mở thế giới khối ở bước khám phá thêm (thử ở world.spec.ts). Bỏ nhiệm vụ khối trong cơ sở dữ liệu thử để tệp này
    // thử luồng dự phòng của máy chủ (cảnh nhập vai 2D theo content.explore) cùng các bước chính
    await sql(s.url, "UPDATE hk_saga_stages SET content = content - 'world'");
    // 25/11/2026: chặng của khối cao hơn khối của lớp bị khóa; lớp thử của tệp này là khối 9 để mở cả bốn khối (khóa khối thử riêng ở dưới)
    await sql(s.url, 'UPDATE app_classes SET grade = 9 WHERE id = $1', [f.class7a.id]);
  }, 240_000);
  afterAll(async () => { clock?.reset(); await s?.close(); });

  it('nội dung: bốn chiến dịch theo khối 6–9 (24 câu Hội đồng mỗi khối), ba cuộc kháng chiến vẫn giữ bản đồ gốc, Doanh trại có nhiệm vụ, chuỗi ngày, bậc Khoa bảng', async () => {
    const home = await api('GET', '/api/saga/home');
    expect(home.status).toBe(200);
    expect(home.body.grade).toBe(9);
    expect(home.body.grades.map((g: any) => [g.grade, g.stages, g.questions, g.battles, g.state])).toEqual([[6, 4, 24, 4, 'open'], [7, 6, 24, 5, 'open'], [8, 4, 24, 3, 'open'], [9, 4, 24, 2, 'current']]);
    expect(home.body.grades[0]).toMatchObject({ tag: 'KHỐI 6 · TÂN BINH', role: 'Tân binh', level: 'Nhận biết' });
    expect(home.body.campaigns.map((c: any) => [c.campaign_no, c.years, c.stages, c.done, c.is_new])).toEqual([[1, '1258', 3, 0, true], [2, '1285', 6, 0, true], [3, '1287–1288', 4, 0, true]]);
    // chặng đang học: ưu tiên khối của em
    expect(home.body.next).toMatchObject({ stage_id: stageId['so-sanh-ba-lan'], grade: 9, order: 1, of: 4 });
    expect(home.body.next.steps).toMatchObject({ lesson: 'ready', practice: 'locked', battle: 'none', next: 'lesson' });
    expect(home.body.rank).toMatchObject({ level: 0, name: 'Học trò', next_name: 'Thái học sinh', next: { done: 0, total: 4, unit: 'chặng', grade: 6 } });
    expect(home.body.quests.map((x: any) => x.metric).sort()).toEqual(['ai_questions', 'correct_answers', 'lore_collected']);
    expect(home.body.streak.milestones.map((m: any) => [m.days, m.reached])).toEqual([[3, false], [7, false], [14, false], [30, false]]);
    expect(home.body.streak.week).toHaveLength(7);
    expect(home.body.suggest).toBeNull();
    // chiến dịch Khối 6: Bạch Đằng 938 mở đầu, hòm báu của cuộc kháng chiến lần thứ nhất đặt đúng sau chặng của nó, bản đồ gốc phần 1
    const g6 = (await api('GET', '/api/saga/grades/6')).body;
    expect(g6.stages.map((x: any) => [x.code, x.state, x.order])).toEqual([['bach-dang-938', 'ready', 1], ['binh-le-nguyen', 'ready', 2], ['vuon-khong-nha-trong', 'locked', 3], ['dong-bo-dau', 'locked', 4]]);
    expect(g6.chests.map((c: any) => [c.key, c.after])).toEqual([[`s${stageId['binh-le-nguyen']}`, 2], [`s${stageId['vuon-khong-nha-trong']}`, 3], ['p1', 4]]);
    expect(g6.maps.map((m: any) => m.campaign_no)).toEqual([1]);
    expect(g6.stages[0]).toMatchObject({ campaign_no: null, battle_mode: 'council', lore: { have: 0, total: 5 } });
    expect((await api('GET', '/api/saga/grades/9')).body.stages.map((x: any) => [x.code, x.state])).toEqual([['so-sanh-ba-lan', 'ready'], ['hoi-dong-dai-cuc', 'locked'], ['tu-lieu-tranh-bien', 'locked'], ['thu-thach-lich-su', 'locked']]);
    expect((await api('GET', '/api/saga/grades/5')).status).toBe(404);
    const map = await api('GET', '/api/saga/campaigns/1');
    expect(map.body.map).toMatchObject({ image_key: 'ban-do-khang-chien-1', image_w: 1500, image_h: 1052 });
    expect(map.body.map.credit).toMatch(/Wikimedia Commons/);
    expect(map.body.stages.map((x: any) => [x.code, x.state, x.map_order])).toEqual([['binh-le-nguyen', 'ready', 1], ['vuon-khong-nha-trong', 'locked', 2], ['dong-bo-dau', 'locked', 3]]);
    for (const st of map.body.stages) { expect(st.map_x).toBeGreaterThan(0); expect(st.map_x).toBeLessThan(1); expect(st.map_y).toBeGreaterThan(0); expect(st.map_y).toBeLessThan(1); }
    expect(map.body.stages[1].lock_reason).toMatch(/Bình Lệ Nguyên/);
    expect((await api('GET', '/api/saga/campaigns/9')).status).toBe(404);
    // Quân lệnh: lời dẫn, mục tiêu, vòng 5 bước, trận đánh; không lộ nội dung bài, đáp án, kịch bản trận
    const detail = await api('GET', `/api/saga/stages/${stageId['vuon-khong-nha-trong']}`);
    expect(detail.body).toMatchObject({ state: 'locked', pass_percent: 70, cards_count: 4, grade: 6, battle: { mode: 'council', won: false } });
    expect(detail.body.order_text.text.length).toBeGreaterThan(20);
    expect(detail.body.objectives).toHaveLength(2);
    expect(detail.body.practice.items).toBe(6);
    for (const secret of ['correct', 'feedback', 'cards', 'explore_script', 'steps_script', 'effect', 'rounds', 'reply']) expect(keysOf(detail.body).has(secret)).toBe(false);
  });

  it('khóa theo khối: chặng của khối cao hơn khối của lớp chỉ mở khi em lên lớp đó; khối thấp hơn vẫn học / ôn được', async () => {
    await sql(s.url, 'UPDATE app_classes SET grade = 7 WHERE id = $1', [f.class7a.id]);
    try {
      const g8 = (await api('GET', '/api/saga/grades/8')).body;
      expect(g8.grade).toMatchObject({ state: 'locked', lock_reason: 'Mở khi em lên lớp 8' });
      expect(g8.stages.every((x: any) => x.state === 'locked' && x.lock_reason === 'Mở khi em lên lớp 8')).toBe(true);
      expect((await api('GET', `/api/saga/stages/${stageId['chuan-bi-1287']}/lesson`)).status).toBe(409);
      const home = (await api('GET', '/api/saga/home')).body;
      expect(home.grades.map((g: any) => g.state)).toEqual(['open', 'current', 'locked', 'locked']);
      expect(home.next).toMatchObject({ stage_id: stageId['binh-than'], grade: 7 });
    } finally {
      await sql(s.url, 'UPDATE app_classes SET grade = 9 WHERE id = $1', [f.class7a.id]);
    }
    expect((await api('GET', `/api/saga/stages/${stageId['chuan-bi-1287']}/lesson`)).status).toBe(200);
  });

  it('chặng khóa không mở được bằng cách gọi thẳng API; trong một chặng phải đi đúng thứ tự Thám sử → Hội đồng → Xuất trận', async () => {
    const locked = stageId['vuon-khong-nha-trong'];
    expect((await api('GET', `/api/saga/stages/${locked}/lesson`)).status).toBe(409);
    expect((await api('POST', `/api/saga/stages/${locked}/lore/c1`, {})).status).toBe(409);
    expect((await api('POST', `/api/saga/stages/${locked}/lesson/complete`, {})).status).toBe(409);
    for (const kind of ['practice', 'explore', 'battle']) expect([kind, (await api('POST', `/api/saga/stages/${locked}/${kind}`, {})).status]).toEqual([kind, 409]);
    expect((await api('GET', `/api/saga/stages/${locked}/summary`)).status).toBe(409);
    const open = stageId['binh-le-nguyen'];
    expect((await api('POST', `/api/saga/stages/${open}/practice`, {})).body.detail).toMatch(/Thám sử/);
    expect((await api('POST', `/api/saga/stages/${open}/explore`, {})).body.detail).toMatch(/70%/);
    expect((await api('POST', `/api/saga/stages/${open}/battle`, {})).body.detail).toMatch(/Hội đồng quân sự/);
    expect((await api('GET', `/api/saga/stages/999999`)).status).toBe(404);
  });

  it('Thám sử: nhặt từng thẻ Binh thư (có nguồn), nhặt đủ là xong bước và chỉ thưởng một lần; nhiệm vụ "nhặt 2 thẻ"; bộ sưu tập Binh thư', async () => {
    const id = stageId['binh-le-nguyen'];
    const lesson = (await api('GET', `/api/saga/stages/${id}/lesson`)).body;
    expect(lesson.cards).toHaveLength(4);
    expect(lesson).toMatchObject({ lore: [], done: false });
    for (const c of lesson.cards) { expect(c.source.url).toMatch(/^https:\/\//); expect(typeof c.objective_text).toBe('string'); expect(['nhan-vat', 'ke-sach', 'dia-danh']).toContain(c.shelf); expect(c.tag.length).toBeGreaterThan(2); }
    const ids = lesson.cards.map((c: any) => c.id);
    const one = await api('POST', `/api/saga/stages/${id}/lore/${ids[0]}`, {});
    expect(one.body).toMatchObject({ fresh: true, done: false, lore: [ids[0]], total: 4, xp: 0 });
    expect((await api('POST', `/api/saga/stages/${id}/lore/${ids[0]}`, {})).body).toMatchObject({ fresh: false, lore: [ids[0]] });
    expect((await api('POST', `/api/saga/stages/${id}/lore/khong-co`, {})).status).toBe(404);
    expect((await api('POST', `/api/saga/stages/${id}/lore/SAI!`, {})).status).toBe(404);
    let last: any = null;
    for (const c of ids.slice(1)) last = (await api('POST', `/api/saga/stages/${id}/lore/${c}`, {})).body;
    expect(last).toMatchObject({ done: true, first_done: true, xp: 10 });
    expect((await api('POST', `/api/saga/stages/${id}/lesson/complete`, {})).body).toMatchObject({ first: false, xp: 0 });
    expect(await count('SELECT count(*) AS n FROM hk_points WHERE user_id = $1 AND ref_key = $2', [f.S1.id, `hq:lesson:${id}`])).toBe(1);
    const quest = (await api('GET', '/api/game/quests')).body.daily.find((x: any) => x.metric === 'lore_collected');
    expect(quest).toMatchObject({ title: 'Thu thập 2 thẻ Binh thư', progress: 2, target: 2 });
    expect(quest.completed_at).not.toBeNull();
    const lore = (await api('GET', '/api/saga/lore')).body;
    expect(lore.owned).toBe(4);
    expect(lore.total).toBeGreaterThanOrEqual(18 * 3);
    expect(Object.values(lore.shelves).reduce((n: number, x: any) => n + x.total, 0)).toBe(lore.total);
    expect(lore.cards.find((c: any) => !c.owned).body).toBeUndefined(); // thẻ chưa nhặt chỉ lộ tên
    expect(lore.cards.find((c: any) => c.owned && c.stage_id === id).source.url).toMatch(/^https:/);
  });

  it('Hội đồng quân sự: đề không có đáp án; đúng một câu lần đầu +10 KN +2 vàng; dưới ngưỡng thì chưa đạt; câu sai vào danh sách ôn; Gợi ý chiến thuật gạch một phương án sai', async () => {
    const id = stageId['binh-le-nguyen'];
    const start = await api('POST', `/api/saga/stages/${id}/practice`, {});
    expect(start.body).toMatchObject({ kind: 'practice', total: 6, index: 0, pass_percent: 70, resumed: false });
    // mốc của câu xếp dòng thời gian có nhãn thời điểm (`slots`) nhưng thẻ sự kiện thì không; chưa mốc nào có thẻ
    const noSlots = start.body.items.map(({ slots, ...rest }: any) => rest);
    for (const secret of ['correct', 'feedback', 'score_key', 'tokens', 'explanation', 'when']) expect(keysOf(noSlots).has(secret)).toBe(false);
    expect(start.body.items.flatMap((i: any) => i.slots ?? []).every((x: any) => x.card === null)).toBe(true);
    expect(start.body.items.map((i: any) => i.kind).sort()).toEqual(['locate', 'pairs', 'quiz', 'quiz', 'sequence', 'tactic']);
    expect((await api('POST', `/api/saga/stages/${id}/practice`, {})).body).toMatchObject({ session_id: start.body.session_id, resumed: true });
    const fail = await playItems(start.body, f.S1.token, 3);
    expect(fail.finished).toMatchObject({ percent: 50, passed: false, stars: 0, first_pass: false, xp: 30, gold: 6, pass_percent: 70 });
    expect(fail.completion).toBeNull();
    expect((await api('POST', `/api/saga/stages/${id}/battle`, {})).status).toBe(409); // chưa đạt thì chưa xuất trận
    expect((await api('GET', '/api/saga/review')).body.due).toHaveLength(3);
    const pass = await practice('binh-le-nguyen', f.S1.token, 1);
    expect(pass.finished).toMatchObject({ percent: 83, passed: true, stars: 1, first_pass: true, xp: 20, gold: 4, best: 83 });
    const again = await practice('binh-le-nguyen', f.S1.token);
    expect(again.finished).toMatchObject({ percent: 100, passed: true, stars: 3, first_pass: false, xp: 10, gold: 2, best: 100 });
    expect(await count("SELECT count(*) AS n FROM hk_points WHERE user_id = $1 AND ref_key LIKE 'hq:ans:%'", [f.S1.id])).toBe(6);
    expect(await count("SELECT count(*) AS n FROM hk_gold_ledger WHERE user_id = $1 AND reason = 'answer'", [f.S1.id])).toBe(6);
    expect(await count('SELECT count(*) AS n FROM hk_points WHERE user_id = $1 AND ref_key = $2', [f.S1.id, `hq:practice:${id}`])).toBe(0);
    const detail = (await api('GET', `/api/saga/stages/${id}`)).body;
    expect(detail.practice).toMatchObject({ best: 100, tries: 3, passed: true });
    expect(detail.state).toBe('learning');
    expect(detail.steps).toMatchObject({ lesson: 'done', practice: 'done', battle: 'ready', next: 'battle' });
    // Gợi ý chiến thuật: vật phẩm mua ở Chợ phiên (ở đây đặt sẵn một cái)
    await sql(s.url, `UPDATE hk_players SET buffs = jsonb_set(COALESCE(buffs, '{}'::jsonb), '{goi_y}', '1'::jsonb) WHERE user_id = $1`, [f.S1.id]);
    const h = (await api('POST', `/api/saga/stages/${id}/practice`, {})).body;
    const q = h.items.find((i: any) => i.kind === 'quiz' && i.hintable);
    expect(q.removed).toEqual([]);
    const used = await act(h.session_id, h.seq, { type: 'hint', item_id: q.id });
    expect(used.status).toBe(200);
    expect(used.body.outcome).toMatchObject({ hint: true, hints_left: 0, item_id: q.id });
    expect(used.body.outcome.removed).not.toBe(keys.get(q.id)!.data.correct);
    expect(used.body.view.items.find((i: any) => i.id === q.id)).toMatchObject({ removed: [used.body.outcome.removed], hintable: false });
    expect((await act(h.session_id, used.body.seq, { type: 'hint', item_id: q.id })).status).toBe(409);
    const seqItem = h.items.find((i: any) => i.kind === 'sequence');
    expect((await act(h.session_id, used.body.seq, { type: 'hint', item_id: seqItem.id })).status).toBe(409);
    await playItems(used.body.view, f.S1.token);
  });

  it('gửi lặp một lệnh nhận lại kết quả cũ và không cộng thưởng lần hai; lệnh lệch thứ tự bị từ chối; phiên của người khác không chạm được', async () => {
    const id = stageId['binh-le-nguyen'];
    const start = (await api('POST', `/api/saga/stages/${id}/practice`, {})).body;
    const first = start.items.find((i: any) => i.kind === 'quiz');
    const actionId = randomUUID();
    const xpBefore = (await api('GET', '/api/game/me')).body.xp;
    const one = await act(start.session_id, start.seq, { type: 'answer', item_id: first.id, answer: answerOf(first.id, true) }, f.S1.token, actionId);
    expect(one.body).toMatchObject({ seq: 1, replayed: false });
    const dup = await act(start.session_id, start.seq, { type: 'answer', item_id: first.id, answer: answerOf(first.id, false) }, f.S1.token, actionId);
    expect(dup.status).toBe(200);
    expect(dup.body).toMatchObject({ seq: 1, replayed: true });
    expect(dup.body.outcome).toEqual(one.body.outcome);
    expect(await count('SELECT count(*) AS n FROM hk_saga_answers WHERE session_id = $1', [start.session_id])).toBe(1);
    expect(await count('SELECT count(*) AS n FROM hk_saga_actions WHERE session_id = $1', [start.session_id])).toBe(1);
    const other = start.items.find((i: any) => i.kind === 'locate');
    expect((await act(start.session_id, 0, { type: 'answer', item_id: other.id, answer: answerOf(other.id, true) })).status).toBe(409);
    expect((await api('GET', `/api/saga/sessions/${start.session_id}`)).body).toMatchObject({ seq: 1, index: start.items.findIndex((i: any) => i.id !== first.id && !i.done) });
    expect((await act(start.session_id, 1, { type: 'answer', item_id: first.id, answer: answerOf(first.id, true) })).status).toBe(400);
    expect((await api('POST', `/api/saga/sessions/${start.session_id}/actions`, { action_id: 'ngan', seq: 1, action: { type: 'answer' } })).status).toBe(422);
    expect((await api('POST', `/api/saga/sessions/${start.session_id}/actions`, { action_id: randomUUID(), seq: 1, action: 'x' })).status).toBe(422);
    expect((await api('GET', `/api/saga/sessions/${start.session_id}`, undefined, f.S2.token)).status).toBe(404);
    expect((await act(start.session_id, 1, { type: 'answer', item_id: other.id, answer: answerOf(other.id, true) }, f.S2.token)).status).toBe(404);
    expect((await api('GET', '/api/game/me')).body.xp).toBe(xpBefore); // câu đã thưởng ở lượt trước không thưởng lại
    await playItems((await api('GET', `/api/saga/sessions/${start.session_id}`)).body, f.S1.token);
  });

  it('Xuất trận ngay sau Hội đồng; thắng là xong chặng (thưởng một lần, mở chặng sau); mỗi sao lần đầu +30 KN +10 vàng; Sử quan có bảng so sánh; khám phá thêm không bắt buộc', async () => {
    const id = stageId['binh-le-nguyen'];
    const battle = await api('POST', `/api/saga/stages/${id}/battle`, {});
    expect(battle.body).toMatchObject({ kind: 'battle', mode: 'tactics', status: 'active', resumed: false });
    expect(keysOf(battle.body).has('correct')).toBe(false);
    expect(battle.body.units.filter((u: any) => u.side === 'ally')).toHaveLength(4);
    expect((await api('POST', `/api/saga/stages/${id}/battle`, {})).body).toMatchObject({ session_id: battle.body.session_id, resumed: true });
    const fresh = await api('POST', `/api/saga/stages/${id}/battle`, { restart: true });
    expect(fresh.body.session_id).not.toBe(battle.body.session_id);
    expect((await sql(s.url, 'SELECT status FROM hk_saga_sessions WHERE id = $1', [battle.body.session_id]))[0]).toEqual({ status: 'abandoned' });
    expect((await act(battle.body.session_id, 0, { type: 'defend' })).status).toBe(409);
    expect((await act(fresh.body.session_id, fresh.body.seq, { type: 'attack', target: 'khong_co' })).status).toBe(400);
    expect((await act(fresh.body.session_id, fresh.body.seq, { type: 'thang_luon' })).status).toBe(400);
    const won = await playTactics(fresh.body, 'binh-le-nguyen', f.S1.token);
    expect(won.finished).toMatchObject({ won: true, first_win: true });
    expect(won.finished.stars).toBeGreaterThanOrEqual(1);
    expect(won.finished).toMatchObject({ xp: 30 * won.finished.stars, gold: 10 * won.finished.stars });
    expect(won.finished.compare.map((r: any) => r.label)).toEqual(['Mưu kế: Lui quân có trật tự', 'Kết quả']);
    expect(won.completion).toMatchObject({ first: true, stars: 3, knowledge_percent: 100, campaign_done: false, grade_done: false, grade: 6, rank_up: null });
    expect(won.completion.rewards).toMatchObject({ xp: 100, gold: 30, badge: null });
    expect(won.completion.rewards.card).toMatchObject({ code: 'le-phu-tran', name: 'Lê Phụ Trần' });
    expect(won.completion.next).toMatchObject({ id: stageId['vuon-khong-nha-trong'], grade: 6 });
    const map = (await api('GET', '/api/saga/campaigns/1')).body;
    expect(map.stages.map((x: any) => x.state)).toEqual(['review', 'ready', 'locked']);
    expect(map.stages[0]).toMatchObject({ stars: 3, knowledge_percent: 100, review_due: 3 });
    // Sử quan tổng kết: bảng so sánh của trận, lời nhận xét, diễn biến lịch sử có nguồn và ghi chú phần sáng tạo
    const summary = (await api('GET', `/api/saga/stages/${id}/summary`)).body;
    expect(summary.compare).toHaveLength(2);
    expect(summary.comment.length).toBeGreaterThan(10);
    expect(summary.debrief.paragraphs.length).toBeGreaterThanOrEqual(3);
    expect(summary.debrief.sources[0].url).toMatch(/^https:\/\//);
    expect(summary.debrief.fiction).toMatch(/sáng tạo/);
    expect(summary).toMatchObject({ rank: { level: 0 }, rewards: { xp: 100, gold: 30 }, next: { id: stageId['vuon-khong-nha-trong'] } });
    // chơi lại không được thưởng lần hai; sao đã nhận không nhận lại
    const replay = await practice('binh-le-nguyen', f.S1.token);
    expect(replay.completion).toMatchObject({ first: false });
    expect(replay.completion.rewards).toMatchObject({ xp: 0, gold: 0, card: null });
    const again = await playTactics((await api('POST', `/api/saga/stages/${id}/battle`, {})).body, 'binh-le-nguyen', f.S1.token);
    expect(again.finished.first_win).toBe(false);
    expect(again.finished.xp).toBe(30 * Math.max(0, again.finished.stars - won.finished.stars));
    // khám phá thêm (cảnh 2D dự phòng / thế giới khối): mở sau Hội đồng, không bắt buộc, thưởng một lần
    const explored = await playExplore('binh-le-nguyen', f.S1.token, { battle: (b) => playTactics(b, 'binh-le-nguyen', f.S1.token) });
    expect(explored.finished).toMatchObject({ first: true, xp: 20 });
    expect(explored.completion).toMatchObject({ first: false });
    for (const ref of [`hq:stage:${id}`, `hq:explore:${id}`, `hq:star:${id}:1`]) expect([ref, await count('SELECT count(*) AS n FROM hk_points WHERE user_id = $1 AND ref_key = $2', [f.S1.id, ref])]).toEqual([ref, 1]);
    expect(await count('SELECT count(*) AS n FROM hk_points WHERE user_id = $1 AND ref_key = $2', [f.S1.id, `hq:battle:${id}`])).toBe(0);
    expect(await count('SELECT count(*) AS n FROM hk_gold_ledger WHERE user_id = $1 AND ref_key = $2', [f.S1.id, `hq:stage:${id}`])).toBe(1);
    expect(await count('SELECT count(*) AS n FROM hk_saga_user_cards WHERE user_id = $1', [f.S1.id])).toBe(1);
  }, 180_000);

  it('hòm báu trên bản đồ: hòm giữa hai chặng mở khi xong chặng trước, hòm cuối phần mở khi xong cả phần; máy chủ kiểm tra điều kiện, mỗi hòm chỉ thưởng một lần', async () => {
    const id = stageId['binh-le-nguyen'], id2 = stageId['vuon-khong-nha-trong'];
    const map = (await api('GET', '/api/saga/campaigns/1')).body;
    expect(map.chests.map((c: any) => [c.key, c.kind, c.after, c.state, c.max_gold])).toEqual([[`s${id}`, 'stage', 1, 'ready', 100], [`s${id2}`, 'stage', 2, 'locked', 100], ['p1', 'part', 3, 'locked', 100]]);
    expect(map.chests[0].odds).toEqual([{ rarity: 'common', percent: 55 }, { rarity: 'rare', percent: 30 }, { rarity: 'epic', percent: 12 }, { rarity: 'legendary', percent: 3 }]);
    expect(map.chests[2].odds.map((o: any) => o.rarity)).toEqual(['rare', 'epic', 'legendary']);
    for (const c of map.chests) expect(Object.keys(c)).not.toContain('rarity');
    expect((await api('POST', `/api/saga/chests/s${id2}/open`, {})).status).toBe(409);
    expect((await api('POST', '/api/saga/chests/p1/open', {})).status).toBe(409);
    expect((await api('POST', `/api/saga/chests/s${stageId['dong-bo-dau']}/open`, {})).status).toBe(404); // chặng cuối phần không có hòm "sau chặng"
    expect((await api('POST', `/api/saga/chests/s${stageId['bach-dang-938']}/open`, {})).status).toBe(404); // chặng không thuộc cuộc kháng chiến nào
    for (const bad of ['xyz', 'p9', 's99999']) expect((await api('POST', `/api/saga/chests/${bad}/open`, {})).status).toBe(404);
    expect((await api('POST', `/api/saga/chests/s${id}/open`, {}, f.S2.token)).status).toBe(409);
    const gold = async () => Number((await sql<{ gold: number }>(s.url, 'SELECT gold FROM hk_players WHERE user_id = $1', [f.S1.id]))[0].gold);
    const before = await gold();
    const opened = await api('POST', `/api/saga/chests/s${id}/open`, {});
    expect(opened.status).toBe(200);
    expect(opened.body).toMatchObject({ key: `s${id}`, kind: 'stage', first: true, opened: 1, total: 13, next: { name: 'Hiệu úy Đông A', left: 2 } });
    expect(['common', 'rare', 'epic', 'legendary']).toContain(opened.body.rarity);
    expect(opened.body.gold).toBeGreaterThanOrEqual(10);
    expect(opened.body.gold).toBeLessThanOrEqual(115);
    expect(opened.body.unlocked).toEqual([{ kind: 'title', code: 'tan-binh-sat-that', name: 'Tân binh Sát Thát', rarity: 'common', equipped: true }]);
    expect((await api('POST', `/api/saga/chests/s${id}/open`, {})).body).toMatchObject({ first: false, rarity: opened.body.rarity, gold: 0, xp: 0, freeze: 0, unlocked: [] });
    expect(await gold()).toBe(before + opened.body.gold);
    expect(await count("SELECT count(*) AS n FROM hk_gold_ledger WHERE user_id = $1 AND reason = 'chest' AND ref_key = $2", [f.S1.id, `hq:chest:s${id}`])).toBe(1);
    expect((await api('GET', '/api/saga/campaigns/1')).body.chests[0].state).toBe('opened');
    expect((await api('GET', '/api/saga/grades/6')).body.chests[0].state).toBe('opened');
    expect((await api('GET', '/api/saga/campaigns/1', undefined, f.S2.token)).body.chests[0].state).toBe('locked');
  });

  it('hòm báu bí ẩn: độ hiếm theo tỉ lệ công bố, cố định theo học sinh và hòm, phần thưởng đúng khoảng của độ hiếm', async () => {
    const { rollChest } = await import('../src/saga/saga.service');
    const tally = (kind: 'stage' | 'part') => { const n: Record<string, number> = {}; for (let u = 1; u <= 4000; u += 1) { const r = rollChest(u, kind === 'stage' ? 's7' : 'p2', kind); n[r.rarity] = (n[r.rarity] ?? 0) + 1; } return n; };
    const st = tally('stage'), pt = tally('part');
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

  it('Chợ phiên Thăng Long: khung / cờ hiệu / giao diện mua bằng vàng một lần, món thành tích không mua được, vật phẩm giới hạn mỗi tuần; trang bị chỉ món đã có', async () => {
    const w = (await api('GET', '/api/saga/shop')).body;
    expect(w).toMatchObject({ opened: 1, total: 13, equipped: { frame: null, title: { code: 'tan-binh-sat-that', rarity: 'common' }, avatar: null, flag: null, theme: 'thang-long' } });
    expect(w.frames.map((x: any) => [x.code, x.unlocked, x.price])).toEqual([
      ['go-moc', true, null], ['dong-co', false, 300], ['dong-bo-dau', false, null], ['lua-dong-a', false, null], ['chuong-duong', false, null], ['rong-thoi-tran', false, 900], ['bach-dang', false, null], ['hoa-sen-vang', false, null]]);
    expect(w.frames.find((x: any) => x.code === 'bach-dang')).toMatchObject({ name: 'Sóng Bạch Đằng' });
    expect(w.frames.find((x: any) => x.code === 'bach-dang').need).toMatch(/Khối 8/);
    expect(w.frames.find((x: any) => x.code === 'hoa-sen-vang').need).toBe('Đỗ Trạng nguyên');
    expect(w.flags.map((x: any) => [x.code, x.unlocked])).toEqual([['sat-that', true], ['thuyen-chien', false], ['pha-cuong-dich', false], ['rong-cuon', false], ['coc-bach-dang', false], ['an-dong-a', false]]);
    expect(w.themes.map((x: any) => [x.code, x.unlocked, x.price])).toEqual([['thang-long', true, null], ['bach-dang', false, 600], ['dem-dong-bo-dau', false, 600], ['hoang-thanh', false, null]]);
    expect(w.items.map((x: any) => [x.code, x.price, x.weekly, x.bought_week])).toEqual([['lenh-bai', 150, 2, 0], ['goi-y', 50, 3, 0], ['doi-ten', 100, 1, 0]]);
    expect(w.titles.map((x: any) => x.unlocked)).toEqual([true, false, false, false, false, false, false]);
    expect((await api('GET', '/api/saga/home')).body.look).toEqual(w.equipped);
    expect((await api('POST', '/api/saga/cosmetics/equip', { frame: 'bach-dang' })).status).toBe(409);
    expect((await api('POST', '/api/saga/cosmetics/equip', { title: 'hieu-uy-dong-a' })).status).toBe(409);
    expect((await api('POST', '/api/saga/cosmetics/equip', { title: 'khong-co' })).status).toBe(404);
    expect((await api('POST', '/api/saga/cosmetics/equip', { title: 'Sai Định Dạng!' })).status).toBe(422);
    expect((await api('POST', '/api/saga/cosmetics/equip', { title: null })).body.equipped).toEqual({ frame: null, title: null, avatar: null, flag: null, theme: 'thang-long' });
    expect((await api('POST', '/api/saga/cosmetics/equip', { title: 'tan-binh-sat-that', frame: 'go-moc', flag: 'sat-that' })).body.equipped).toMatchObject({ title: { code: 'tan-binh-sat-that' }, frame: { code: 'go-moc' }, flag: { code: 'sat-that' } });
    expect(w.avatars).toHaveLength(12);
    expect((await api('POST', '/api/saga/cosmetics/equip', { avatar: 'rong-con-vua' })).body.equipped.avatar).toBe('rong-con-vua');
    expect((await api('POST', '/api/saga/cosmetics/equip', { avatar: 'khong-co' })).status).toBe(404);
    // mua bằng vàng
    await sql(s.url, 'UPDATE hk_players SET gold = 1000, freezes = 0 WHERE user_id = $1', [f.S1.id]);
    const frame = await api('POST', '/api/saga/shop/buy', { kind: 'frame', code: 'dong-co' });
    expect(frame.status).toBe(200);
    expect(frame.body).toMatchObject({ bought: { kind: 'frame', code: 'dong-co', price: 300 }, gold: 700, equipped: { frame: { code: 'dong-co' } } });
    expect((await api('POST', '/api/saga/shop/buy', { kind: 'frame', code: 'dong-co' })).status).toBe(409);
    expect((await api('POST', '/api/saga/shop/buy', { kind: 'frame', code: 'bach-dang' })).body.detail).toMatch(/thành tích/);
    expect((await api('POST', '/api/saga/shop/buy', { kind: 'frame', code: 'khong-co' })).status).toBe(404);
    expect((await api('POST', '/api/saga/shop/buy', { kind: 'xyz', code: 'dong-co' })).status).toBe(422);
    const theme = await api('POST', '/api/saga/shop/buy', { kind: 'theme', code: 'dem-dong-bo-dau' });
    expect(theme.body).toMatchObject({ gold: 100, equipped: { theme: 'dem-dong-bo-dau' } });
    expect((await api('POST', '/api/saga/cosmetics/equip', { theme: 'thang-long' })).body.equipped.theme).toBe('thang-long');
    expect((await api('POST', '/api/saga/shop/buy', { kind: 'item', code: 'lenh-bai' })).body.detail).toMatch(/Chưa đủ vàng/);
    await sql(s.url, 'UPDATE hk_players SET gold = 1000 WHERE user_id = $1', [f.S1.id]);
    expect((await api('POST', '/api/saga/shop/buy', { kind: 'item', code: 'lenh-bai' })).body).toMatchObject({ freezes: 1, gold: 850 });
    expect((await api('POST', '/api/saga/shop/buy', { kind: 'item', code: 'lenh-bai' })).body).toMatchObject({ freezes: 2, gold: 700 });
    expect((await api('POST', '/api/saga/shop/buy', { kind: 'item', code: 'lenh-bai' })).status).toBe(409); // hết giới hạn tuần (và đủ tối đa)
    expect((await api('POST', '/api/saga/shop/buy', { kind: 'item', code: 'goi-y' })).body).toMatchObject({ hints: 1, gold: 650 });
    expect(await count("SELECT count(*) AS n FROM hk_gold_ledger WHERE user_id = $1 AND reason = 'shop' AND ref_key LIKE 'hq:shop:%'", [f.S1.id])).toBe(5);
    // cờ hiệu thành tích: cần thẻ Trần Quốc Toản
    expect((await api('POST', '/api/saga/cosmetics/equip', { flag: 'pha-cuong-dich' })).status).toBe(409);
    await sql(s.url, "INSERT INTO hk_saga_user_cards (user_id, card_code) VALUES ($1, 'tran-quoc-toan')", [f.S1.id]);
    expect((await api('POST', '/api/saga/cosmetics/equip', { flag: 'pha-cuong-dich' })).body.equipped.flag).toMatchObject({ code: 'pha-cuong-dich' });
    await sql(s.url, "DELETE FROM hk_saga_user_cards WHERE user_id = $1 AND card_code = 'tran-quoc-toan'", [f.S1.id]);
    // học sinh khác chưa có gì
    expect((await api('GET', '/api/saga/shop', undefined, f.S2.token)).body).toMatchObject({ opened: 0, equipped: { frame: null, title: null, avatar: null, flag: null, theme: 'thang-long' } });
    const look = (await sql<{ appearance: Record<string, unknown> }>(s.url, 'SELECT appearance FROM hk_players WHERE user_id = $1', [f.S1.id]))[0].appearance;
    expect(look).toMatchObject({ saga_title: 'tan-binh-sat-that', saga_avatar: 'rong-con-vua', saga_frame: 'dong-co', saga_theme: 'thang-long' });
  });

  it('Đổi tướng hiệu: đặt biệt danh lần đầu miễn phí, đổi lại cần một lượt mua ở Chợ phiên (giữ tối đa 1 lượt, máy chủ trừ lượt khi lưu)', async () => {
    const as2 = (m: string, p: string, b?: unknown) => api(m, p, b, f.S2.token);
    const item = (w: any) => w.items.find((x: any) => x.code === 'doi-ten');
    await sql(s.url, 'UPDATE app_users SET nickname = NULL WHERE id = $1', [f.S2.id]);
    const before = (await as2('GET', '/api/saga/shop')).body;
    const gold0 = before.gold;
    await sql(s.url, 'UPDATE hk_players SET gold = 500 WHERE user_id = $1', [f.S2.id]);
    expect(item(before)).toMatchObject({ name: 'Đổi tướng hiệu', price: 100, weekly: 1, have: 0 });
    expect(item(before).block).toMatch(/miễn phí/);
    // chưa có biệt danh: chưa cần mua, lần đặt đầu tiên miễn phí
    expect((await as2('POST', '/api/saga/shop/buy', { kind: 'item', code: 'doi-ten' })).status).toBe(409);
    expect((await as2('GET', '/api/auth/profile')).body.nickname_change).toEqual({ free: true, tokens: 0, price: 100 });
    const first = await as2('PATCH', '/api/auth/profile', { nickname: 'Cờ Lau' });
    expect(first.status).toBe(200);
    expect(first.body.user.nickname).toBe('Cờ Lau');
    expect(first.body.nickname_change).toEqual({ free: false, tokens: 0, price: 100 });
    // lưu lại đúng biệt danh đang có (kèm ô khác) không cần lượt
    expect((await as2('PATCH', '/api/auth/profile', { nickname: 'Cờ Lau', bio: 'Em thích sử' })).status).toBe(200);
    // đổi lần hai hoặc xóa: cần lượt
    const denied = await as2('PATCH', '/api/auth/profile', { nickname: 'Sóng Bạch Đằng' });
    expect(denied.status).toBe(409);
    expect(denied.body.detail).toMatch(/Đổi tướng hiệu/);
    expect((await as2('PATCH', '/api/auth/profile', { nickname: null })).status).toBe(409);
    expect((await as2('GET', '/api/auth/profile')).body.user.nickname).toBe('Cờ Lau');
    // mua một lượt (giữ tối đa 1 lượt chưa dùng)
    const bought = await as2('POST', '/api/saga/shop/buy', { kind: 'item', code: 'doi-ten' });
    expect(bought.status).toBe(200);
    expect(bought.body).toMatchObject({ gold: 400, renames: 1, nickname: 'Cờ Lau' });
    expect(item(bought.body)).toMatchObject({ have: 1, bought_week: 1 });
    expect(item(bought.body).block).toMatch(/chưa dùng/);
    expect((await as2('POST', '/api/saga/shop/buy', { kind: 'item', code: 'doi-ten' })).status).toBe(409);
    expect((await as2('GET', '/api/auth/profile')).body.nickname_change).toEqual({ free: false, tokens: 1, price: 100 });
    const renamed = await as2('PATCH', '/api/auth/profile', { nickname: 'Sóng Bạch Đằng' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.user.nickname).toBe('Sóng Bạch Đằng');
    expect(renamed.body.nickname_change).toEqual({ free: false, tokens: 0, price: 100 });
    expect((await as2('PATCH', '/api/auth/profile', { nickname: 'Lần Ba' })).status).toBe(409);
    // tuần này đã mua 1 lượt
    expect((await as2('POST', '/api/saga/shop/buy', { kind: 'item', code: 'doi-ten' })).body.detail).toMatch(/Mỗi tuần/);
    const buffs = (await sql<{ buffs: Record<string, number> }>(s.url, 'SELECT buffs FROM hk_players WHERE user_id = $1', [f.S2.id]))[0].buffs;
    expect(buffs.doi_ten ?? 0).toBe(0);
    expect(await count("SELECT count(*) AS n FROM hk_gold_ledger WHERE user_id = $1 AND reason = 'shop' AND ref_key LIKE 'hq:shop:item:doi-ten:%'", [f.S2.id])).toBe(1);
    await sql(s.url, 'UPDATE app_users SET nickname = NULL, bio = NULL WHERE id = $1', [f.S2.id]);
    await sql(s.url, 'UPDATE hk_players SET gold = $2 WHERE user_id = $1', [f.S2.id, gold0]);
  });

  it('đăng nhập lại vẫn đúng tiến độ; thẻ nhân vật và tư liệu mở theo kết quả học', async () => {
    const username = (await sql<{ username: string }>(s.url, 'SELECT username FROM app_users WHERE id = $1', [f.S1.id]))[0].username;
    const login = await call(s.base, 'POST', '/api/auth/login', { username, password: PW, portal: 'student' });
    expect(login.status).toBe(200);
    const home = (await api('GET', '/api/saga/home', undefined, login.body.token)).body;
    expect(home.campaigns[0]).toMatchObject({ done: 1, stars: 3, is_new: false, percent: 33 });
    expect(home.grades[0]).toMatchObject({ grade: 6, done: 1, stars: 3 });
    expect(home.next).toMatchObject({ stage_id: stageId['so-sanh-ba-lan'] });
    expect(home.suggest).toMatchObject({ kind: 'review', wrong: 3 });
    expect(home.hud.xp).toBeGreaterThanOrEqual(200);
    const cards = (await api('GET', '/api/saga/cards', undefined, login.body.token)).body;
    expect([cards.total, cards.owned, cards.latest_code]).toEqual([14, 1, 'le-phu-tran']);
    expect(cards.cards.find((c: any) => c.code === 'le-phu-tran').intro.length).toBeGreaterThan(20);
    const hidden = cards.cards.find((c: any) => c.code === 'tran-hung-dao');
    expect(hidden).toMatchObject({ owned: false, stage_title: 'Bạch Đằng' });
    expect(hidden.intro).toBeUndefined();
    expect(cards.cards.find((c: any) => c.code === 'ngo-quyen')).toMatchObject({ owned: false, stage_title: 'Bạch Đằng 938' });
    const archive = (await api('GET', '/api/saga/archive', undefined, login.body.token)).body;
    expect(archive.maps).toHaveLength(3);
    expect(archive.timeline.length).toBeGreaterThanOrEqual(18);
    const doc = archive.texts.find((t: any) => t.code === 'loi-tran-thu-do');
    expect(doc).toMatchObject({ locked: true, lock: { stage_title: 'Vườn không nhà trống' } });
    expect(doc.body).toBeUndefined();
  });

  it('trận hội đồng (Vườn không nhà trống): đề không lộ điểm / tác động; chọn sai thì thua, chọn như lịch sử thì thắng 3 sao; xong chặng mở thẻ và tư liệu', async () => {
    const code = 'vuon-khong-nha-trong';
    await learn(code, f.S1.token);
    await practice(code, f.S1.token);
    const start = (await api('POST', `/api/saga/stages/${stageId[code]}/battle`, {})).body;
    expect(start).toMatchObject({ kind: 'battle', mode: 'council', style: 'command', status: 'active', round: 1, rounds: 3, history: [], result: null });
    expect(start.meters).toEqual([{ id: 'luong', label: 'Lương không về tay giặc', value: 30, win: 70 }, { id: 'luc', label: 'Lực lượng được giữ', value: 40, win: 70 }]);
    expect(start.current.options.every((o: any) => Object.keys(o).sort().join() === 'id,tag,text')).toBe(true);
    for (const secret of ['effect', 'reply', 'score', 'history_text']) expect(keysOf(start.current).has(secret)).toBe(false);
    expect((await act(start.session_id, start.seq, { type: 'play', option: 'zz' })).status).toBe(400);
    const lost = await playCouncil(start, code, f.S1.token, true);
    expect(lost.finished).toMatchObject({ won: false, stars: 0, xp: 0, first_win: false });
    expect(lost.completion).toBeNull();
    const again = (await api('POST', `/api/saga/stages/${stageId[code]}/battle`, {})).body;
    const won = await playCouncil(again, code, f.S1.token);
    expect(won.finished).toMatchObject({ won: true, stars: 3, xp: 90, gold: 30, first_win: true, historic: 3 });
    expect(won.finished.compare.map((r: any) => [r.label, r.ok])).toEqual([['Lương thực trong làng', true], ['Kinh thành Thăng Long', true], ['Lời bàn trên sông Thiên Mạc', true]]);
    expect(won.view.history.map((h: any) => h.score)).toEqual([2, 2, 2]);
    expect(won.completion).toMatchObject({ first: true, battle: { stars: 3 } });
    expect(won.completion.rewards.card).toMatchObject({ code: 'tran-thu-do' });
    expect(won.completion.rewards.docs.map((d: any) => d.title)).toEqual(['Lời Thái sư Trần Thủ Độ']);
    const summary = (await api('GET', `/api/saga/stages/${stageId[code]}/summary`)).body;
    expect(summary.compare).toHaveLength(3);
    expect(summary.compare[2].history).toMatch(/Đầu thần chưa rơi xuống đất/);
    const archive = (await api('GET', '/api/saga/archive')).body;
    expect(archive.texts.find((t: any) => t.code === 'loi-tran-thu-do').body.lines[0]).toMatch(/Đầu thần/);
  });

  it('Luyện binh riêng (ôn tập): ưu tiên câu đã sai, đồng hồ do máy chủ giữ, đúng một câu +10 KN +2 vàng mỗi ngày, câu đúng ra khỏi danh sách ôn', async () => {
    const before = (await api('GET', '/api/saga/review')).body;
    expect(before.due).toHaveLength(3);
    expect(before.can_start).toBe(true);
    expect(before.suggest).toMatchObject({ kind: 'review', wrong: 3, size: 3 });
    const start = (await api('POST', '/api/saga/review/start', {})).body;
    expect(start).toMatchObject({ kind: 'review', stage: null, index: 0 });
    expect(start.items.length).toBe(Math.min(6, before.pool));
    expect(start.items.every((i: any) => i.kind !== 'pairs')).toBe(true);
    expect(start.timer.left_ms).toBeGreaterThan(15_000);
    const dueIds = before.due.map((d: any) => d.item_id).sort();
    expect(start.items.slice(0, 3).map((i: any) => i.id).sort()).toEqual(dueIds);
    expect((await act(start.session_id, 0, { type: 'answer', item_id: start.items[1].id, answer: answerOf(start.items[1].id, true) })).status).toBe(400);
    const one = await act(start.session_id, 0, { type: 'answer', item_id: start.items[0].id, answer: answerOf(start.items[0].id, true) });
    expect(one.body.outcome).toMatchObject({ correct: true, timeout: false, streak: 1, xp: 10, gold: 2 });
    expect(one.body.view.timer).toBeNull();
    clock.advance(60_000);
    const ready = await act(start.session_id, 1, { type: 'ready' });
    expect(ready.body.outcome).toMatchObject({ ready: true, item_id: start.items[1].id });
    expect(ready.body.view.timer.left_ms).toBeGreaterThan(15_000);
    clock.advance(120_000);
    const late = await act(start.session_id, 2, { type: 'answer', item_id: start.items[1].id, answer: answerOf(start.items[1].id, true) });
    expect(late.body.outcome).toMatchObject({ correct: false, timeout: true, streak: 0, xp: 0 });
    clock.advance(200_000);
    const skipped = await act(start.session_id, 3, { type: 'answer', item_id: start.items[2].id, answer: answerOf(start.items[2].id, true) });
    expect(skipped.body.outcome).toMatchObject({ correct: false, timeout: true });
    clock.reset();
    const rest = await playItems(skipped.body.view, f.S1.token);
    expect(rest.finished).toMatchObject({ total: start.items.length, right: start.items.length - 2, xp: 10 * (start.items.length - 2) });
    const stillWrong = [start.items[1].id, start.items[2].id].sort();
    expect((await api('GET', '/api/saga/review')).body.due.map((d: any) => d.item_id).sort()).toEqual(stillWrong);
    const second = (await api('POST', '/api/saga/review/start', {})).body;
    const firstAgain = await act(second.session_id, 0, { type: 'answer', item_id: second.items[0].id, answer: answerOf(second.items[0].id, true) });
    expect(firstAgain.body.outcome.correct).toBe(true);
    expect(second.items.slice(0, 2).map((i: any) => i.id).sort()).toEqual(stillWrong);
    await playItems(firstAgain.body.view, f.S1.token);
    expect((await api('GET', '/api/saga/review')).body.due).toEqual([]);
    expect(await count("SELECT count(*) AS n FROM hk_points WHERE user_id = $1 AND ref_key LIKE 'hq:rv:%'", [f.S1.id])).toBe(new Set([...start.items, ...second.items].map((i: any) => i.id)).size);
    expect((await api('GET', '/api/saga/campaigns/1')).body.stages[0].state).toBe('done');
  });

  it('xếp dòng thời gian (26/11/2026): đặt từng thẻ vào mốc, máy chủ chấm ngay; sai thì gợi ý sớm / muộn hơn; đủ thẻ mới xong câu, sai một lần được nửa điểm', async () => {
    const id = stageId['binh-le-nguyen'];
    expect((await api('POST', `/api/saga/stages/${id}/lesson/complete`, {}, f.S2.token)).status).toBeLessThan(300);
    const start = (await api('POST', `/api/saga/stages/${id}/practice`, { restart: true }, f.S2.token)).body;
    const item = start.items.find((i: any) => i.kind === 'sequence');
    const want = keys.get(item.id)!.data.items as Array<{ id: string; text: string; when?: string }>;
    // các mốc theo thứ tự thời gian chỉ có nhãn thời điểm, chưa lộ thẻ nào ở mốc nào
    expect(item.slots).toEqual(want.map((o, i) => ({ i, when: o.when ?? null, card: null })));
    expect(item.misses).toBe(0);
    const last = want.length - 1;
    const wrong = await act(start.session_id, start.seq, { type: 'answer', item_id: item.id, answer: { place: { card: want[last].id, slot: 0 } } }, f.S2.token);
    expect(wrong.status).toBe(200);
    expect(wrong.body.outcome).toMatchObject({ done: false, correct: false, detail: { ok: false, placed: 0, total: want.length, misses: 1 } });
    expect(wrong.body.outcome.detail.hint).toMatch(/diễn ra sau .*muộn hơn/);
    expect(wrong.body.outcome.explanation).toBeUndefined(); // chưa xong câu thì chưa có lời giải
    expect((await act(start.session_id, wrong.body.seq, { type: 'answer', item_id: item.id, answer: { place: { card: 'khong-co', slot: 0 } } }, f.S2.token)).status).toBe(400);
    expect((await act(start.session_id, wrong.body.seq, { type: 'answer', item_id: item.id, answer: { place: { card: want[0].id, slot: 99 } } }, f.S2.token)).status).toBe(400);
    let seq: number = wrong.body.seq;
    let res: any = null;
    for (const [i, o] of want.entries()) {
      res = await act(start.session_id, seq, { type: 'answer', item_id: item.id, answer: { place: { card: o.id, slot: i } } }, f.S2.token);
      expect(res.status).toBe(200);
      seq = res.body.seq;
      if (i < last) {
        expect(res.body.outcome).toMatchObject({ done: false, correct: true, detail: { ok: true, placed: i + 1 } });
        expect(res.body.view.items.find((x: any) => x.id === item.id).slots[i].card).toMatchObject({ id: o.id });
        // mốc đã có thẻ không nhận thẻ khác
        if (i === 0) expect((await act(start.session_id, seq, { type: 'answer', item_id: item.id, answer: { place: { card: want[1].id, slot: 0 } } }, f.S2.token)).status).toBe(400);
      }
    }
    expect(res.body.outcome).toMatchObject({ done: true, correct: true, score: 0.5, detail: { misses: 1, total: want.length } });
    expect(res.body.outcome.detail.order.map((o: any) => o.id)).toEqual(want.map((o) => o.id));
    expect(typeof res.body.outcome.explanation).toBe('string');
    // nửa điểm chưa tính là đúng: câu vào hàng ôn (tới hạn ngay)
    await playItems(res.body.view, f.S2.token);
    expect((await api('GET', '/api/saga/review', undefined, f.S2.token)).body.due.map((d: any) => d.item_id)).toContain(item.id);
  });

  it('Luyện binh riêng ôn giãn cách (migration 084): đúng câu tới hạn thì hẹn ôn lại sau 3 ngày; tới hạn đúng thêm lần nữa thì ra khỏi hàng ôn', async () => {
    const seqItem = (await api('GET', '/api/saga/review', undefined, f.S2.token)).body.due.map((d: any) => d.item_id)
      .find((id: number) => keys.get(id)!.kind === 'sequence') as number;
    expect(seqItem).toBeDefined();
    const want = keys.get(seqItem)!.data.items as Array<{ id: string }>;
    /** làm một lượt ôn: câu xếp dòng thời gian đặt đúng từng thẻ, các câu khác trả lời đúng */
    const round = async (): Promise<any> => {
      const start = (await api('POST', '/api/saga/review/start', { restart: true }, f.S2.token)).body;
      expect(start.items[0].id).toBe(seqItem); // câu tới hạn đứng đầu
      let seq: number = start.seq;
      let res: any = null;
      for (const [i, o] of want.entries()) {
        res = await act(start.session_id, seq, { type: 'answer', item_id: seqItem, answer: { place: { card: o.id, slot: i } } }, f.S2.token);
        expect(res.status).toBe(200);
        seq = res.body.seq;
      }
      expect(res.body.outcome).toMatchObject({ done: true, correct: true, score: 1, timeout: false });
      const outcome = res.body.outcome;
      await playItems(res.body.view, f.S2.token);
      return outcome;
    };
    const first = await round();
    expect(first.review).toMatchObject({ next: 'later', days: 3 });
    let info = (await api('GET', '/api/saga/review', undefined, f.S2.token)).body;
    expect(info.due.map((d: any) => d.item_id)).not.toContain(seqItem);
    expect(info.later).toMatchObject({ gap_days: 3 });
    expect(info.later.count).toBeGreaterThanOrEqual(1);
    expect(await count('SELECT count(*) AS n FROM hk_saga_review WHERE user_id = $1 AND item_id = $2 AND box = 1 AND cleared_at IS NULL', [f.S2.id, seqItem])).toBe(1);
    // chưa tới hạn: số câu cần ôn của chặng không tính câu đã hẹn
    clock.advance(3 * 86_400_000 + 60_000);
    try {
      info = (await api('GET', '/api/saga/review', undefined, f.S2.token)).body;
      expect(info.due.map((d: any) => d.item_id)).toContain(seqItem);
      const second = await round();
      expect(second.review).toMatchObject({ next: 'done' });
      expect(await count('SELECT count(*) AS n FROM hk_saga_review WHERE user_id = $1 AND item_id = $2 AND cleared_at IS NOT NULL', [f.S2.id, seqItem])).toBe(1);
      expect((await api('GET', '/api/saga/review', undefined, f.S2.token)).body.due.map((d: any) => d.item_id)).not.toContain(seqItem);
    } finally { clock.reset(); }
  });

  it('màn Bạch Đằng (Khối 8) qua API: thua khi bày trận sai, thắng khi chơi đúng 3 sao; xong chặng nhận thẻ, huy hiệu, cờ hiệu Cọc Bạch Đằng; bảng vàng so với tuần trước', async () => {
    const id = stageId['bach-dang'];
    expect((await api('GET', `/api/saga/stages/${id}/lesson`, undefined, f.S2.token)).status).toBe(409);
    await sql(s.url, 'UPDATE hk_saga_stages SET unlock_after = NULL WHERE id = $1', [id]);
    expect((await api('GET', '/api/saga/grades/8', undefined, f.S2.token)).body.stages.map((x: any) => x.state)).toEqual(['ready', 'locked', 'locked', 'ready']);
    await learn('bach-dang', f.S2.token);
    const p = await practice('bach-dang', f.S2.token);
    expect(p.finished).toMatchObject({ percent: 100, passed: true, total: 6 });
    const first = (await api('POST', `/api/saga/stages/${id}/battle`, {}, f.S2.token)).body;
    expect(first).toMatchObject({ mode: 'bachdang', phase: 'prepare' });
    expect(first.tide).toMatchObject({ level: 2, label: 'Cao' });
    const lost = await playBachDang(first, f.S2.token, BD_STAKES, [{ type: 'provoke' }, { type: 'move', to: [5, 2] }, { type: 'move', to: [7, 2] }, { type: 'move', to: [9, 2] }, { type: 'move', to: [10, 2] }]);
    expect(lost.finished).toMatchObject({ won: false, stars: 0, first_win: false, xp: 0 });
    expect(lost.finished.mistakes.map((m: any) => m.code)).toContain('no_strand');
    expect(lost.completion).toBeNull();
    expect((await api('GET', `/api/saga/stages/${id}`, undefined, f.S2.token)).body.battle).toMatchObject({ won: false, tries: 1 });
    const second = (await api('POST', `/api/saga/stages/${id}/battle`, {}, f.S2.token)).body;
    const won = await playBachDang(second, f.S2.token);
    expect(won.finished).toMatchObject({ won: true, stars: 3, stranded: 3, escaped: 0, first_win: true, xp: 90, gold: 30 });
    expect(won.view.result.mistakes).toEqual([]);
    expect(won.finished.compare.map((r: any) => [r.label, r.ok])).toEqual([['Bãi cọc', true], ['Nhử giặc', true], ['Thời điểm đánh', true], ['Thuyền chỉ huy', true]]);
    expect(won.completion).toMatchObject({ first: true, stars: 3, campaign_done: false, grade_done: false, next: { id: stageId['chuan-bi-1287'] } });
    expect(won.completion.rewards).toMatchObject({ xp: 200, gold: 80 });
    expect(won.completion.rewards.card).toMatchObject({ code: 'tran-hung-dao', rarity: 'legendary' });
    expect(won.completion.rewards.badge).toMatchObject({ name: 'Bạch Đằng' });
    expect(won.completion.rewards.docs.map((d: any) => d.title)).toEqual(expect.arrayContaining(['Toàn thư chép trận Bạch Đằng']));
    expect((await api('GET', '/api/game/badges', undefined, f.S2.token)).body.find((b: any) => b.code === 'saga-bach-dang')).toMatchObject({ earned: true });
    expect((await api('GET', '/api/saga/shop', undefined, f.S2.token)).body.flags.find((x: any) => x.code === 'coc-bach-dang')).toMatchObject({ unlocked: true });
    expect((await api('GET', `/api/saga/stages/${id}/summary`, undefined, f.S2.token)).body.compare).toHaveLength(4);
    // bảng vàng tuần của lớp: có so với tuần trước (hạng tuần trước của bạn có điểm tuần trước)
    await sql(s.url, `INSERT INTO hk_points (user_id, points, reason, ref_key, created_at) VALUES ($1, 500, 'teacher', 'test:tuan-truoc', now() - interval '8 days')`, [f.S2.id]);
    const board = (await api('GET', '/api/game/leaderboard?scope=class&period=week', undefined, f.S2.token)).body;
    expect(board.compare).toBe(true);
    const me = board.entries.find((e: any) => e.me);
    expect(me.xp).toBeGreaterThanOrEqual(350);
    expect(board.entries).toHaveLength(2);
    expect(me.delta === null || typeof me.delta === 'number').toBe(true);
  }, 180_000);

  it('Hội nghị Diên Hồng: đưa thẻ thuyết phục các bô lão, thanh "Đồng lòng" thay đổi theo thẻ; muôn người như một thì thắng', async () => {
    const code = 'dien-hong';
    await sql(s.url, 'UPDATE hk_saga_stages SET unlock_after = NULL WHERE code = $1', [code]);
    await learn(code, f.S2.token);
    await practice(code, f.S2.token);
    const start = (await api('POST', `/api/saga/stages/${stageId[code]}/battle`, {}, f.S2.token)).body;
    expect(start).toMatchObject({ mode: 'council', style: 'persuade', rounds: 3, meters: [{ id: 'dong_long', value: 40, win: 80 }] });
    expect(start.cast.filter((c: any) => c.fictional)).toHaveLength(3);
    expect(start.current.who).toBe('Bô lão Đông Triều');
    const r1 = await act(start.session_id, start.seq, { type: 'play', option: 'a' }, f.S2.token);
    expect(r1.body.outcome.events[0]).toMatchObject({ t: 'play', score: 2, meters: { dong_long: 65 } });
    expect(r1.body.view.history[0]).toMatchObject({ option: 'a', score: 2 });
    const won = await playCouncil(r1.body.view, code, f.S2.token);
    expect(won.finished).toMatchObject({ won: true, stars: 3 });
    expect(won.finished.text).toMatch(/Đánh!/);
  });

  it('chuỗi ngày: đạt mục tiêu ngày ba hôm liền thì nhận mốc +30 vàng một lần; Doanh trại hiện tuần học và mốc đã đạt', async () => {
    await sql(s.url, `UPDATE hk_players SET streak_current = 2, streak_longest = 2, streak_last_day = ${todayVN} - 1 WHERE user_id = $1`, [f.S2.id]);
    await sql(s.url, `UPDATE hk_daily SET reached = false, xp = 0, goal = 10 WHERE user_id = $1 AND day = ${todayVN}`, [f.S2.id]);
    expect((await api('POST', `/api/saga/stages/${stageId['so-sanh-ba-lan']}/lesson/complete`, {}, f.S2.token)).body).toMatchObject({ first: true, xp: 10 });
    expect(await count("SELECT count(*) AS n FROM hk_gold_ledger WHERE user_id = $1 AND reason = 'streak' AND ref_key = 'hq:streak:3'", [f.S2.id])).toBe(1);
    const home = (await api('GET', '/api/saga/home', undefined, f.S2.token)).body;
    expect(home.streak).toMatchObject({ current: 3 });
    expect(home.streak.milestones[0]).toMatchObject({ days: 3, reached: true });
    expect(home.streak.week[6].state).toBe('done');
  });

  it('chỉ học sinh dùng được /api/saga; mục Hành trình Đông A của quản trị tổng và báo cáo lớp của giáo viên đã xóa hẳn (404)', async () => {
    expect((await call(s.base, 'GET', '/api/saga/home')).status).toBe(401);
    expect((await call(s.base, 'GET', '/api/saga/home', undefined, f.T1.token)).status).toBe(403);
    expect((await call(s.base, 'GET', '/api/saga/shop', undefined, f.A.token)).status).toBe(403);
    expect((await call(s.base, 'GET', '/api/saga/home', undefined, f.root)).status).toBe(403);
    const gone: Array<[string, string, string]> = [
      ['GET', '/api/saga/admin/overview', f.root], ['GET', `/api/saga/admin/stages/${stageId['bach-dang']}`, f.root], ['PUT', '/api/saga/admin/maps/1', f.root],
      ['PUT', `/api/saga/admin/stages/${stageId['bach-dang']}/position`, f.root], ['PUT', `/api/saga/admin/stages/${stageId['bach-dang']}`, f.root],
      ['PATCH', `/api/saga/admin/stages/${stageId['bach-dang']}/status`, f.root], ['PUT', '/api/saga/admin/items/1', f.root],
      ['GET', `/api/saga/teacher/classes/${f.class7a.id}`, f.T1.token], ['GET', `/api/saga/teacher/classes/${f.class7a.id}`, f.A.token],
    ];
    for (const [method, path, token] of gone) expect([method, path, (await call(s.base, method, path, method === 'GET' ? undefined : {}, token)).status]).toEqual([method, path, 404]);
  });

  it('các bảng bật RLS: vai trò theo trường chỉ đọc nội dung mẫu (cả thông tin bốn khối) và chỉ thấy tiến độ của trường mình', async () => {
    const tables = ['hk_saga_maps', 'hk_saga_stages', 'hk_saga_stage_versions', 'hk_saga_items', 'hk_saga_cards', 'hk_saga_docs', 'hk_saga_progress', 'hk_saga_sessions', 'hk_saga_actions', 'hk_saga_answers', 'hk_saga_review', 'hk_saga_user_cards', 'hk_saga_grades'];
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
      expect(Number((await scoped(f.B.schoolId, f.TB.id, 'SELECT count(*) AS n FROM hk_saga_stages'))[0].n)).toBe(18); // nội dung mẫu đọc được ở mọi trường
      expect(Number((await scoped(f.B.schoolId, f.TB.id, 'SELECT count(*) AS n FROM hk_saga_grades'))[0].n)).toBe(4);
      await expect(scoped(f.B.schoolId, f.TB.id, "UPDATE hk_saga_stages SET title = 'x'")).rejects.toThrow(/permission denied/);
      await expect(scoped(f.B.schoolId, f.TB.id, "UPDATE hk_saga_grades SET tag = 'x'")).rejects.toThrow(/permission denied/);
      await expect(scoped(f.B.schoolId, f.TB.id, `INSERT INTO hk_saga_progress (user_id, stage_id) VALUES (${f.S1.id}, ${stageId['tay-ket']})`)).rejects.toThrow();
    } finally { await client.end(); }
  });
});
