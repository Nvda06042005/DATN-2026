/**
 * Thế giới khối của bước Nhập vai (migration 080, 21/11/2026) qua API thật trên PostgreSQL tạm:
 *  - nội dung khởi tạo hợp lệ (bản đồ khối phần 3 + nhiệm vụ 4 chặng) theo đúng hàm kiểm tra của máy chủ;
 *  - luật thuần: thu thập phải đứng gần, chế tạo cần đủ nguyên liệu, đóng cọc chỉ khi nước rút, vùng đặt vật, yêu cầu "em ít nhất N, cả lớp ít nhất M";
 *  - chơi trọn "Bí mật lòng sông" (Bạch Đằng) bằng đúng lệnh của người chơi, gồm trận đánh sẵn có, rồi ghi tiến độ nhập vai + điểm một lần;
 *  - hai bạn cùng lớp chung một phòng: khối bạn đã đặt tính vào phần "cả lớp" của mình; học sinh không có lớp / chọn lớp không phải của mình bị chặn;
 *  - kênh Socket.IO /world: vào phòng, thấy bạn đi lại, thấy ô vừa thu hoạch; học sinh không có lớp không vào được.
 * Đáp án lấy thẳng từ cơ sở dữ liệu (học sinh không bao giờ nhận được qua API).
 */
import { randomUUID } from 'crypto';
import { io, type Socket } from 'socket.io-client';
import { call, hasPostgres, sql, Started, startApp } from './harness';
import { bootstrap, Fixture } from './fixture';
import type { GameClock } from '../src/game/clock';

let s: Started, f: Fixture, clock: GameClock;
let stageId: Record<string, number> = {};
const api = (method: string, path: string, body?: unknown, token = f.S1.token) => call(s.base, method, path, body, token);
const act = (sessionId: number, seq: number, action: Record<string, unknown>, token = f.S1.token) =>
  api('POST', `/api/saga/sessions/${sessionId}/actions`, { action_id: randomUUID(), seq, action }, token);
const content = async (code: string): Promise<any> => (await sql<{ content: any }>(s.url, 'SELECT content FROM hk_saga_stages WHERE code = $1', [code]))[0].content;
const worldRaw = async (no = 3): Promise<any> => (await sql<{ world: any }>(s.url, 'SELECT world FROM hk_saga_maps WHERE campaign_no = $1', [no]))[0].world;
function keysOf(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => keysOf(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysOf(x, out); }
  return out;
}

/** Mở sẵn các chặng trước (đánh dấu đã xong) và cho chặng cần thử đã học + đạt luyện tập, để tới thẳng bước nhập vai */
async function unlockFor(userId: number, code: string): Promise<void> {
  const pos = (await sql<{ position: number }>(s.url, 'SELECT position FROM hk_saga_stages WHERE code = $1', [code]))[0].position;
  await sql(s.url, `INSERT INTO hk_saga_progress (user_id, stage_id, lesson_done_at, practice_best, practice_tries, practice_passed_at, explore_done_at, battle_won_at, stars, completed_at)
    SELECT $1, id, now(), 100, 1, now(), now(), CASE WHEN content ? 'battle' AND jsonb_typeof(content->'battle') = 'object' THEN now() END, 3, now() FROM hk_saga_stages WHERE position < $2
    ON CONFLICT (user_id, stage_id) DO NOTHING`, [userId, pos]);
  await sql(s.url, `INSERT INTO hk_saga_progress (user_id, stage_id, lesson_done_at, practice_best, practice_tries, practice_passed_at) VALUES ($1, $2, now(), 100, 1, now())
    ON CONFLICT (user_id, stage_id) DO UPDATE SET lesson_done_at = now(), practice_best = 100, practice_passed_at = now()`, [userId, stageId[code]]);
}

/** Tua đồng hồ của trò chơi tới đúng con nước */
async function tideTo(state: 'low' | 'high'): Promise<void> {
  const { tideAt } = await import('../src/saga/world');
  const t = tideAt(clock.now().getTime());
  if (t.state !== state) clock.advance(t.until - clock.now().getTime() + 1000);
}

/** Màn Bạch Đằng chỉ qua API (giống saga.spec): đóng cọc theo con nước, nhử, phản công bằng lựa chọn máy chủ đưa ra */
async function playBachDang(start: any, token: string): Promise<any> {
  let view = start;
  let res: any = null;
  const send = async (action: Record<string, unknown>) => { res = await act(view.session_id, view.seq, action, token); expect(res.status).toBe(200); view = res.body.view; };
  const todo: Array<[number, number]> = [[5, 1], [6, 1], [7, 1], [8, 1], [7, 0], [8, 0]];
  for (let guard = 0; view.phase === 'prepare' && guard < 40; guard++) {
    if (view.tide.level === 0 && todo.length && view.stakes_turn_left > 0) await send({ type: 'stake', at: todo.shift() });
    else await send(todo.length ? { type: 'wait' } : { type: 'ready' });
  }
  for (const a of [{ type: 'provoke' }, { type: 'move', to: [5, 1] }, { type: 'move', to: [6, 1] }, { type: 'move', to: [7, 1] }, { type: 'move', to: [8, 0] }]) if (view.status === 'active' && view.phase === 'lure') await send(a);
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

/** Ô tài nguyên còn dùng được và một ô đi được ngay cạnh để đứng thu thập */
/** Ô đi được sát ô cần đặt để đứng: không phải ô có vật / người / bàn, và đặt xong vẫn còn lối ra (máy chủ từ chối đặt lên chỗ mình đứng hay tự nhốt mình) */
function besideCell(map: any, terrain: any, at: [number, number], skip: Set<string> = new Set()): [number, number] {
  const solid = new Set([...skip, `${at[0]},${at[1]}`, ...map.npcs.map((n: any) => `${n.at[0]},${n.at[1]}`), ...map.stations.map((st: any) => `${st.at[0]},${st.at[1]}`)]);
  const free = (x: number, z: number): boolean => x >= 0 && z >= 0 && z < map.rows.length && x < map.rows[0].length && !solid.has(`${x},${z}`) && Boolean(terrain[map.rows[z][x]]?.walk);
  for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -2], [0, 2], [-2, 0], [2, 0]]) {
    const x = at[0] + dx, z = at[1] + dz;
    if (free(x, z) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ex, ez]) => free(x + ex, z + ez))) return [x, z];
  }
  throw new Error(`không có ô đứng cạnh ${at}`);
}

function resourceSpots(map: any, terrain: any, res: string): Array<{ at: [number, number]; from: [number, number] }> {
  const out: Array<{ at: [number, number]; from: [number, number] }> = [];
  for (let z = 0; z < map.h; z++) for (let x = 0; x < map.w; x++) {
    if (terrain[map.rows[z][x]]?.res !== res) continue;
    const from = ([[0, 1], [1, 0], [0, -1], [-1, 0]] as Array<[number, number]>).map(([dx, dz]) => [x + dx, z + dz] as [number, number])
      .find(([fx, fz]) => fx >= 0 && fz >= 0 && fx < map.w && fz < map.h && terrain[map.rows[fz][fx]]?.walk && !map.npcs.some((n: any) => n.at[0] === fx && n.at[1] === fz));
    if (from) out.push({ at: [x, z], from });
  }
  return out;
}

/** Chơi trọn một nhiệm vụ thế giới khối bằng lệnh của người chơi; `skipPlaceBeyondOwn`: chỉ đặt đủ phần của em (bạn cùng lớp đã đặt phần còn lại) */
async function playWorld(code: string, token: string, opts: { classId?: number } = {}): Promise<{ last: any; view: any; placed: number }> {
  const quest = (await content(code)).world;
  const start = await api('POST', `/api/saga/stages/${stageId[code]}/explore`, opts.classId ? { class_id: opts.classId } : {}, token);
  expect(start.status).toBe(200);
  let view = start.body;
  expect(view.world).toBe(true);
  let res: any = null;
  let placed = 0;
  const used = new Set<string>();
  const send = async (action: Record<string, unknown>) => {
    res = await act(view.session_id, view.seq, action, token);
    expect([JSON.stringify(action), res.status, res.body?.detail]).toEqual([JSON.stringify(action), 200, undefined]);
    view = res.body.view;
    return res.body;
  };
  for (let guard = 0; view.status === 'active' && guard < 120; guard++) {
    const step = quest.steps[view.progress.step];
    expect(view.current.goal).toBe(step.goal);
    if (step.type === 'talk') await send({ type: 'interact', target: `npc:${step.npc}` });
    else if (step.type === 'ask') { await send({ type: 'interact', target: `npc:${step.npc}` }); await send({ type: 'answer', choice: step.correct }); }
    else if (step.type === 'zone') { if (step.tide) await tideTo(step.tide); await send({ type: 'zone', zone: step.zone }); }
    else if (step.type === 'give') await send({ type: 'interact', target: `npc:${step.npc}` });
    else if (step.type === 'pick') { for (const z of step.zones.filter((x: string) => x !== step.correct).slice(0, 1)) await send({ type: 'zone', zone: z }); await send({ type: 'zone', zone: step.correct }); }
    else if (step.type === 'drill') { for (const z of step.zones) await send({ type: 'zone', zone: z }); }
    else if (step.type === 'gather') {
      const spot = resourceSpots(view.map, view.terrain, step.res).find((p) => !used.has(p.at.join(',')))!;
      used.add(spot.at.join(','));
      await send({ type: 'gather', at: spot.at, from: spot.from });
    } else if (step.type === 'craft') {
      const have = view.progress.inventory[step.item] ?? 0;
      await send({ type: 'craft', recipe: step.item, station: view.map.stations[0].id, times: Math.max(1, Math.min(10, step.count - have)) });
    } else if (step.type === 'place') {
      // thiếu vật (phải đặt thêm cho đủ phần cả lớp): làm thêm từ nguyên liệu đang có, hết nguyên liệu thì thu thập thêm
      if (!(view.progress.inventory[step.item] > 0)) {
        const recipe = view.recipes[step.item];
        const [needItem, needN] = Object.entries(recipe.needs)[0] as [string, number];
        if ((view.progress.inventory[needItem] ?? 0) < needN) {
          const spot = resourceSpots(view.map, view.terrain, needItem).find((p) => !used.has(p.at.join(',')))!;
          used.add(spot.at.join(','));
          await send({ type: 'gather', at: spot.at, from: spot.from });
          continue;
        }
        await send({ type: 'craft', recipe: step.item, station: view.map.stations[0].id });
        continue;
      }
      const zone = view.map.zones.find((z: any) => z.id === step.zone);
      if (zone.tide) await tideTo(zone.tide);
      const taken = new Set((view.blocks as any[]).map((b) => `${b.x},${b.z}`));
      let cell: [number, number] | null = null;
      for (let z = zone.rect[1]; z < zone.rect[1] + zone.rect[3] && !cell; z++) for (let x = zone.rect[0]; x < zone.rect[0] + zone.rect[2] && !cell; x++) {
        if (zone.on.includes(view.map.rows[z][x]) && !taken.has(`${x},${z}`)) cell = [x, z];
      }
      // đứng ở chính ô cần đặt hoặc ô đi được sát đó
      await send({ type: 'place', at: cell!, from: besideCell(view.map, view.terrain, cell!, taken), item: step.item });
      placed += 1;
    } else {
      const out = await send({ type: 'zone', zone: step.zone });
      expect(out.outcome.events.map((e: any) => e.t)).toEqual(['battle']);
      const battle = await api('POST', `/api/saga/stages/${stageId[code]}/battle`, {}, token);
      expect(battle.status).toBe(200);
      const done = await playBachDang(battle.body, token);
      expect(done.finished.won).toBe(true);
      await send({ type: 'zone', zone: step.zone });
    }
  }
  return { last: res.body, view, placed };
}

(hasPostgres() ? describe : describe.skip)('Thế giới khối – bước Nhập vai (API)', () => {
  beforeAll(async () => {
    s = await startApp('world_spec');
    const root = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, root);
    clock = s.moduleRef.get((await import('../src/game/clock')).GameClock);
    stageId = Object.fromEntries((await sql<{ code: string; id: number }>(s.url, 'SELECT code, id FROM hk_saga_stages')).map((r) => [r.code, r.id]));
  }, 240_000);
  afterAll(async () => { clock?.reset(); await s?.close(); });

  it('nội dung khởi tạo hợp lệ: bản đồ khối của cả 3 phần và nhiệm vụ của đủ 13 chặng (không còn chặng nào dùng cảnh 2D); dấu ấn, tuyến, Sổ sử', async () => {
    const { normalizeWorldMap, normalizeWorldQuest } = await import('../src/saga/world');
    const map = normalizeWorldMap(await worldRaw());
    expect([map.w, map.h, map.rows.length]).toEqual([48, 36, 36]);
    expect(map.zones.find((z) => z.id === 'baicoc')).toMatchObject({ accepts: ['coc'], on: ',', tide: 'low', cap: 16 }); // 24 ô bãi bồi, sức chứa luôn nhỏ hơn số ô
    const raw = await worldRaw();
    expect(() => normalizeWorldMap({ ...raw, zones: [{ id: 'z', name: 'Vùng thử', rect: [30, 22, 4, 1], kind: 'build', accepts: ['coc'], on: ',', cap: 4 }] })).toThrow(/nhỏ hơn 4 ô/);
    const withWorld = (await sql<{ code: string; campaign_no: number }>(s.url, "SELECT code, campaign_no FROM hk_saga_stages WHERE content ? 'world' ORDER BY position")).map((r) => r);
    expect(withWorld.length).toBe(13);
    expect(Number((await sql<{ n: string }>(s.url, "SELECT count(*) AS n FROM hk_saga_stages WHERE NOT (content ? 'world')"))[0].n)).toBe(0);
    const maps = Object.fromEntries(await Promise.all([1, 2, 3].map(async (no) => [no, normalizeWorldMap(await worldRaw(no))] as const)));
    // 082: hiệu lệnh luyện đội hình không dựa vào hướng (em xoay được góc nhìn) và không nhắc lá cờ không có trên sân
    const drill = (await content('dien-hong')).world.steps.find((x: any) => x.type === 'drill');
    expect(drill.commands).toHaveLength(5);
    for (const c of drill.commands) expect(c).not.toMatch(/phải|trái|cờ đỏ/);
    expect(maps[2].zones.find((z) => z.id === 'doi_1')?.name).toBe('Vị trí 1');
    for (const no of [1, 2, 3]) {
      expect([no, maps[no].book?.events.length ?? 0]).toEqual([no, expect.any(Number)]);
      expect(maps[no].book!.events.length).toBeGreaterThanOrEqual(5);
      expect(maps[no].changes.length).toBeGreaterThanOrEqual(3);
    }
    expect(maps[1].routes.map((r) => r.id)).toEqual(['song-hong-1258']);
    expect(maps[2].routes.map((r) => r.id)).toEqual(['tiep-te-1285']);
    const awards: string[] = [];
    for (const { code, campaign_no } of withWorld) {
      const c = await content(code);
      const quest = normalizeWorldQuest(c.world, maps[campaign_no]);
      for (const st of quest.steps) if (st.award) awards.push(st.award);
      // chặng có trận đánh thì nhiệm vụ có đúng một bước ra trận, chặng không có trận thì không có
      expect([code, quest.steps.filter((x) => x.type === 'battle').length]).toEqual([code, c.battle ? 1 : 0]);
      expect(c.explore.steps.length).toBeGreaterThan(0); // dữ liệu cảnh 2D cũ vẫn giữ trong cơ sở dữ liệu (không xóa), giao diện không còn dùng
    }
    // bảng phần thưởng người dùng gửi: "Người giữ làng", "Đồng lòng giữ nước", mở tuyến vận chuyển
    expect(awards.sort()).toEqual(['route:song-hong-1258', 'route:tiep-te-1285', 'title:dong-long-giu-nuoc', 'title:nguoi-giu-lang']);
    const bd = normalizeWorldQuest((await content('bach-dang')).world, map);
    expect(bd.title).toBe('Bí mật lòng sông');
    // đúng 5 bước người dùng mô tả: khám phá con nước → thu thập → chế tạo → xây dựng khi nước rút → nhử khi nước lên, rồi 3 câu giải thích
    expect(bd.steps.map((x) => x.type)).toEqual(['talk', 'zone', 'talk', 'gather', 'gather', 'craft', 'craft', 'place', 'talk', 'zone', 'battle', 'ask', 'ask', 'ask']);
    expect(bd.steps.filter((x) => x.type === 'ask').map((x) => (x as any).prompt)).toEqual(['Tại sao phải giấu bãi cọc dưới nước?', 'Vì sao phải chờ đúng con nước?', 'Đã có bãi cọc, vì sao vẫn cần nhiều lực lượng cùng phối hợp?']);
  });

  it('luật thuần: đứng gần mới thu thập, đủ nguyên liệu mới chế tạo, đóng cọc khi nước rút trong đúng vùng, em ít nhất N và cả lớp ít nhất M', async () => {
    const w = await import('../src/saga/world');
    const map = w.normalizeWorldMap(await worldRaw());
    const quest = w.normalizeWorldQuest((await content('bach-dang')).world, map);
    const st = w.newWorld(1);
    let total = 0;
    const ctx = (tide: 'low' | 'high'): any => ({ battleWon: false, tide, nodeReady: () => true, occupied: () => false, zoneTotal: () => total });
    expect(w.tideAt(0)).toEqual({ state: 'low', until: 40_000, period: 80_000 });
    expect(w.tideAt(50_000).state).toBe('high');
    // bước 1: hỏi nhầm người chỉ nghe lời chào, không qua bước
    expect(w.applyWorld(quest, map, st, { type: 'interact', target: 'npc:vua' }, ctx('low')).events[0].t).toBe('say');
    expect(st.step).toBe(0);
    w.applyWorld(quest, map, st, { type: 'interact', target: 'npc:lao_chai' }, ctx('low'));
    w.applyWorld(quest, map, st, { type: 'zone', zone: 'moc' }, ctx('low'));
    w.applyWorld(quest, map, st, { type: 'interact', target: 'npc:hung_dao' }, ctx('low'));
    expect(quest.steps[st.step].type).toBe('gather');
    // cây ở (15,14); đứng ở (15,13) thì với tới, đứng ở (15,10) thì quá xa
    expect(() => w.applyWorld(quest, map, st, { type: 'gather', at: [15, 14], from: [15, 10] }, ctx('low'))).toThrow(/gần hơn/);
    expect(() => w.applyWorld(quest, map, st, { type: 'gather', at: [6, 13], from: [6, 14] }, ctx('low'))).toThrow(/không có tài nguyên/);
    const g = w.applyWorld(quest, map, st, { type: 'gather', at: [15, 14], from: [15, 13] }, ctx('low'));
    expect(g.effects).toEqual([{ kind: 'take', x: 15, z: 14, res: 'go' }]);
    expect(st.inventory.go).toBe(2);
    expect(w.applyWorld(quest, map, st, { type: 'gather', at: [16, 14], from: [16, 13] }, { ...ctx('low'), nodeReady: () => false }).events[0].t).toBe('wait');
    st.inventory = { go: 6, tre: 1 };
    // thiếu tre: chưa làm được bè; lệnh này vẫn cho qua bước "lấy 6 gỗ" vì túi đã đủ gỗ
    expect(w.applyWorld(quest, map, st, { type: 'craft', recipe: 'be', station: 'ban_song' }, ctx('low')).events[0].text).toMatch(/Chưa đủ nguyên liệu/);
    expect(quest.steps[st.step]).toMatchObject({ type: 'gather', res: 'tre' });
    st.inventory.tre = 4;
    w.applyWorld(quest, map, st, { type: 'craft', recipe: 'be', station: 'ban_song' }, ctx('low')); // làm vật của bước sau trước cũng được
    expect(quest.steps[st.step]).toMatchObject({ type: 'craft', item: 'coc' });
    expect(() => w.applyWorld(quest, map, st, { type: 'craft', recipe: 'coc', station: 'khong_co' }, ctx('low'))).toThrow(/bàn chế tạo/);
    w.applyWorld(quest, map, st, { type: 'craft', recipe: 'coc', station: 'ban_song', times: 4 }, ctx('low'));
    expect(quest.steps[st.step].type).toBe('place'); // đã có sẵn bè: bước làm bè qua luôn
    expect(st.inventory).toEqual({ go: 2, tre: 2, coc: 4, be: 1 });
    // nước lên thì chưa đóng được cọc; ngoài vùng, ô trên lạch sâu, ô đã có vật đều không đặt được
    expect(w.applyWorld(quest, map, st, { type: 'place', at: [30, 22], from: [30, 22], item: 'coc' }, ctx('high')).events[0].text).toMatch(/Nước đang lên/);
    expect(w.applyWorld(quest, map, st, { type: 'place', at: [30, 28], from: [30, 28], item: 'coc' }, ctx('low')).events[0].t).toBe('wait');
    expect(() => w.applyWorld(quest, map, st, { type: 'place', at: [35, 22], from: [33, 22], item: 'coc' }, ctx('low'))).not.toThrow();
    expect(w.applyWorld(quest, map, st, { type: 'place', at: [31, 22], from: [31, 22], item: 'coc' }, { ...ctx('low'), occupied: () => true }).events[0].text).toMatch(/đã có vật/);
    // không đặt vật lên chính chỗ mình đứng hay chỗ bạn cùng lớp đang đứng (người bị kẹt trong khối)
    expect(w.applyWorld(quest, map, st, { type: 'place', at: [31, 22], from: [31, 22], item: 'coc' }, ctx('low')).events[0].text).toMatch(/Em đang đứng ở ô này/);
    expect(w.applyWorld(quest, map, st, { type: 'place', at: [31, 22], from: [31, 23], item: 'coc' }, { ...ctx('low'), standing: (x: number, z: number) => x === 31 && z === 22 }).events[0].text).toMatch(/Bạn cùng lớp đang đứng/);
    // đặt xong mà chỗ đứng không còn ô kề nào đi được (ba phía có vật, phía còn lại là ô định đặt) thì không cho – tránh tự nhốt mình
    const walled = (x: number, z: number): boolean => (x === 30 && z === 23) || (x === 32 && z === 23) || (x === 31 && z === 24);
    expect(w.applyWorld(quest, map, st, { type: 'place', at: [31, 22], from: [31, 23], item: 'coc' }, { ...ctx('low'), occupied: walled }).events[0].text).toMatch(/vây kín/);
    expect(w.hasExit(map, walled, [31, 23], null)).toBe(true);
    for (const x of [30, 31, 32, 33]) {
      const r = w.applyWorld(quest, map, st, { type: 'place', at: [x, 23], from: [x, 24], item: 'coc' }, ctx('low'));
      expect(r.effects[0]).toMatchObject({ kind: 'place', block: 'coc', zone: 'baicoc' });
      total += 1;
    }
    // em đã đóng đủ 4 nhưng cả lớp mới có 4/10: chưa qua bước; bạn cùng lớp đóng thêm thì lệnh bất kỳ tiếp theo cũng qua bước
    expect(quest.steps[st.step].type).toBe('place');
    total = 10;
    w.applyWorld(quest, map, st, { type: 'interact', target: 'npc:vua' }, ctx('low'));
    expect(quest.steps[st.step]).toMatchObject({ type: 'talk', npc: 'nguyen_khoai' });
    const pub = w.publicWorld(quest, map, st, { zoneTotal: () => total });
    expect(keysOf(pub).has('correct')).toBe(false);
    expect(keysOf(pub).has('right')).toBe(false);
  });

  it('luật thuần của bước mới: đưa đồ cho người, chọn đúng đường (mở tuyến), luyện đội hình (danh hiệu chỉ khi không lệch hàng), dân làng góp sức', async () => {
    const w = await import('../src/saga/world');
    const ctx: any = { battleWon: true, tide: 'low', nodeReady: () => true, occupied: () => false, zoneTotal: () => 99 };
    const m1 = w.normalizeWorldMap(await worldRaw(1)), m2 = w.normalizeWorldMap(await worldRaw(2));
    // Bình Lệ Nguyên: đưa ván che tên cho Lê Tần
    const q1 = w.normalizeWorldQuest((await content('binh-le-nguyen')).world, m1);
    const s1 = w.newWorld(1);
    s1.step = q1.steps.findIndex((x) => x.type === 'give');
    expect(w.applyWorld(q1, m1, s1, { type: 'interact', target: 'npc:le_tan' }, ctx).events[0].lines![0]).toMatch(/2 ván che tên/);
    s1.inventory = { van: 2 };
    const gave = w.applyWorld(q1, m1, s1, { type: 'interact', target: 'npc:le_tan' }, ctx);
    expect(gave.events[0]).toMatchObject({ t: 'gave', n: 2 });
    expect(s1.inventory).toEqual({});
    // Vườn không nhà trống: chọn sai bến tính một lần sai, chọn đúng mở tuyến thuyền; dân làng góp sức khi thu thập
    const q2 = w.normalizeWorldQuest((await content('vuon-khong-nha-trong')).world, m1);
    const s2 = w.newWorld(1);
    s2.step = q2.steps.findIndex((x) => x.type === 'pick');
    expect(w.applyWorld(q2, m1, s2, { type: 'zone', zone: 'ben_cho' }, ctx).events[0].t).toBe('wrong');
    expect(s2.mistakes).toBe(1);
    const ok = w.applyWorld(q2, m1, s2, { type: 'zone', zone: 'ben_nam' }, ctx);
    expect(ok.effects).toContainEqual({ kind: 'award', code: 'route:song-hong-1258' });
    expect(q2.steps[s2.step].type).toBe('place');
    const g = w.applyWorld(q2, m1, s2, { type: 'gather', at: [1, 27], from: [1, 26] }, { ...ctx, bonusYield: w.VILLAGE_BONUS });
    expect(g.events[0].text).toMatch(/\+3 lúa \(dân làng góp sức\)/);
    // Diên Hồng: đi đúng thứ tự vị trí đội hình thì nhận "Đồng lòng giữ nước"; lệch hàng thì làm lại từ đầu và không nhận danh hiệu
    const q3 = w.normalizeWorldQuest((await content('dien-hong')).world, m2);
    const drill = q3.steps.findIndex((x) => x.type === 'drill');
    const s3 = w.newWorld(1); s3.step = drill;
    const zones = (q3.steps[drill] as any).zones as string[];
    let last: any = null;
    for (const z of zones) last = w.applyWorld(q3, m2, s3, { type: 'zone', zone: z }, ctx);
    expect(last.effects).toContainEqual({ kind: 'award', code: 'title:dong-long-giu-nuoc' });
    const s4 = w.newWorld(1); s4.step = drill;
    w.applyWorld(q3, m2, s4, { type: 'zone', zone: zones[0] }, ctx);
    expect(w.applyWorld(q3, m2, s4, { type: 'zone', zone: zones[2] }, ctx).events[0].t).toBe('wrong'); // lệch hàng
    expect(s4.drill).toBe(0);
    for (const z of zones) last = w.applyWorld(q3, m2, s4, { type: 'zone', zone: z }, ctx);
    expect(q3.steps[s4.step].type).toBe('ask');
    expect(last.effects.some((e: any) => e.kind === 'award')).toBe(false);
    expect(w.publicWorld(q3, m2, w.newWorld(1), { zoneTotal: () => 0 })).toBeTruthy();
  });

  it('chơi trọn "Bí mật lòng sông" qua API: trận Bạch Đằng ở giữa, xong thì ghi tiến độ nhập vai và thưởng điểm một lần; bạn cùng lớp dùng chung bãi cọc', async () => {
    await unlockFor(f.S1.id, 'bach-dang');
    // học sinh chọn lớp không phải của mình bị chặn; không chọn thì vào lớp của em
    expect((await api('POST', `/api/saga/stages/${stageId['bach-dang']}/explore`, { class_id: f.class7b.id })).status).toBe(403);
    const first = await api('POST', `/api/saga/stages/${stageId['bach-dang']}/explore`, {});
    expect(first.body).toMatchObject({ world: true, room: { class_id: f.class7a.id, class_name: '7A1', campaign_no: 3 }, current: { type: 'talk', marker: 'npc:lao_chai' } });
    expect(first.body.map.rows).toHaveLength(36);
    expect(first.body.tide.state).toMatch(/low|high/);
    for (const secret of ['correct', 'right', 'wrong', 'lines', 'steps']) expect([secret, keysOf(first.body).has(secret)]).toEqual([secret, false]);
    const xpBefore = Number((await sql<{ n: string }>(s.url, 'SELECT COALESCE(sum(points),0) AS n FROM hk_points WHERE user_id = $1', [f.S1.id]))[0].n);
    const played = await playWorld('bach-dang', f.S1.token);
    expect(played.last.finished).toMatchObject({ first: true, xp: 20 });
    expect(played.placed).toBe(4); // chơi một mình: em đóng đủ phần của em, dân binh tới đóng nốt phần còn thiếu của cả lớp
    const p = (await sql<any>(s.url, 'SELECT explore_done_at, battle_won_at FROM hk_saga_progress WHERE user_id = $1 AND stage_id = $2', [f.S1.id, stageId['bach-dang']]))[0];
    expect(p.explore_done_at).not.toBeNull();
    expect(p.battle_won_at).not.toBeNull();
    const xpAfter = Number((await sql<{ n: string }>(s.url, 'SELECT COALESCE(sum(points),0) AS n FROM hk_points WHERE user_id = $1', [f.S1.id]))[0].n);
    expect(xpAfter).toBeGreaterThan(xpBefore);
    const room = (await sql<{ id: number }>(s.url, 'SELECT id FROM hk_world_rooms WHERE class_id = $1 AND campaign_no = 3', [f.class7a.id]))[0].id;
    expect(Number((await sql<{ n: string }>(s.url, "SELECT count(*) AS n FROM hk_world_blocks WHERE room_id = $1 AND zone = 'baicoc' AND block = 'coc'", [room]))[0].n)).toBe(10);
    expect(Number((await sql<{ n: string }>(s.url, "SELECT count(*) AS n FROM hk_world_blocks WHERE room_id = $1 AND zone = 'baicoc' AND user_id IS NULL", [room]))[0].n)).toBe(6); // khối của dân binh

    // bạn cùng lớp: thấy 10 cọc của bạn (không phải của mình), chỉ cần đóng 4 cọc của mình là qua bước
    await unlockFor(f.S2.id, 'bach-dang');
    const mate = await api('POST', `/api/saga/stages/${stageId['bach-dang']}/explore`, {}, f.S2.token);
    expect(mate.body.room.id).toBe(room);
    expect(mate.body.blocks.filter((b: any) => b.zone === 'baicoc')).toHaveLength(10);
    // dấu ấn chỉ có ở các chặng bạn đã xong bước nhập vai: bạn chưa xong Bạch Đằng nên chưa có dấu ấn của chặng này
    expect(mate.body.changes.map((c: any) => c.stage)).toEqual(['chuan-bi-1287', 'van-don', 'van-kiep-1288']);
    expect(mate.body.blocks.every((b: any) => b.mine === false)).toBe(true);
    const second = await playWorld('bach-dang', f.S2.token);
    expect(second.placed).toBe(4);
    expect(second.last.finished.first).toBe(true);
    expect(Number((await sql<{ n: string }>(s.url, "SELECT count(*) AS n FROM hk_world_blocks WHERE room_id = $1 AND zone = 'baicoc'", [room]))[0].n)).toBe(14);
  }, 120_000);

  it('vùng đầy thì khối cũ nhất dời sang ô còn trống (cập nhật, không xóa, không sinh bản ghi xóa); học sinh chưa vào lớp nào không vào được thế giới khối', async () => {
    const room = (await sql<{ id: number }>(s.url, 'SELECT id FROM hk_world_rooms WHERE class_id = $1 AND campaign_no = 3', [f.class7a.id]))[0].id;
    const map = await worldRaw();
    const zone = map.zones.find((z: any) => z.id === 'baicoc');
    const blocksOf = async () => sql<{ x: number; z: number }>(s.url, "SELECT x, z FROM hk_world_blocks WHERE room_id = $1 AND zone = 'baicoc' ORDER BY placed_at, x, z", [room]);
    const taken = new Set((await blocksOf()).map((b) => `${b.x},${b.z}`));
    const free: Array<[number, number]> = [];
    for (let z = zone.rect[1]; z < zone.rect[1] + zone.rect[3]; z++) for (let x = zone.rect[0]; x < zone.rect[0] + zone.rect[2]; x++) if (map.rows[z][x] === ',' && !taken.has(`${x},${z}`)) free.push([x, z]);
    expect(taken.size + free.length).toBe(24);
    // lấp tới sức chứa 16 bằng dữ liệu thử
    while (taken.size < 16) { const [x, z] = free.shift()!; taken.add(`${x},${z}`); await sql(s.url, "INSERT INTO hk_world_blocks (room_id, x, z, block, zone, user_id) VALUES ($1, $2, $3, 'coc', 'baicoc', $4)", [room, x, z, f.S2.id]); }
    const oldest = (await blocksOf())[0];
    let view = (await api('POST', `/api/saga/stages/${stageId['bach-dang']}/explore`, { restart: true })).body;
    await sql(s.url, `UPDATE hk_saga_sessions SET state = jsonb_set(state, '{inventory}', '{"coc": 2}'::jsonb) WHERE id = $1`, [view.session_id]);
    await tideTo('low');
    const archived = Number((await sql<{ n: string }>(s.url, 'SELECT count(*) AS n FROM app_deleted_records'))[0].n);
    const stand = besideCell(view.map, view.terrain, free[0], new Set([...taken]));
    let res = await act(view.session_id, view.seq, { type: 'place', at: free[0], from: stand, item: 'coc' });
    expect([res.status, res.body.outcome.events[0].t]).toEqual([200, 'placed']);
    const after = await blocksOf();
    expect(after).toHaveLength(16);
    expect(after.some((b) => b.x === oldest.x && b.z === oldest.z)).toBe(false);
    expect(after.some((b) => b.x === free[0][0] && b.z === free[0][1])).toBe(true);
    expect(Number((await sql<{ n: string }>(s.url, 'SELECT count(*) AS n FROM app_deleted_records'))[0].n)).toBe(archived);
    view = res.body.view;
    res = await act(view.session_id, view.seq, { type: 'place', at: free[0], from: stand, item: 'coc' });
    expect(res.body.outcome.events[0].text).toMatch(/đã có vật/);

    await unlockFor(f.S3.id, 'bach-dang');
    const lone = await api('POST', `/api/saga/stages/${stageId['bach-dang']}/explore`, {}, f.S3.token);
    expect([lone.status, lone.body.detail]).toEqual([409, 'Em cần vào một lớp để cùng các bạn khám phá thế giới khối']);
  }, 60_000);

  it('sơ tán (Vườn không nhà trống) qua API: mở tuyến thuyền và danh hiệu "Người giữ làng", trang bị danh hiệu, dân làng góp sức; dấu ấn trên bản đồ; Sổ sử Đông A', async () => {
    await unlockFor(f.S1.id, 'vuon-khong-nha-trong');
    const played = await playWorld('vuon-khong-nha-trong', f.S1.token);
    expect(played.placed).toBe(4); // 2 bao + 2 lều của em; dân binh đặt nốt phần cả lớp
    const awards = (await sql<{ code: string }>(s.url, 'SELECT code FROM hk_world_awards WHERE user_id = $1 ORDER BY code', [f.S1.id])).map((r) => r.code);
    expect(awards).toEqual(['route:song-hong-1258', 'title:nguoi-giu-lang']);
    const again = (await api('POST', `/api/saga/stages/${stageId['vuon-khong-nha-trong']}/explore`, { restart: true })).body;
    expect(again).toMatchObject({ routes_open: ['song-hong-1258'], village_help: true });
    expect(again.awards.sort()).toEqual(['route:song-hong-1258', 'title:nguoi-giu-lang']);
    expect(again.changes.map((c: any) => c.stage)).toEqual(expect.arrayContaining(['vuon-khong-nha-trong', 'binh-le-nguyen', 'dong-bo-dau']));
    // dân làng góp sức: mỗi lần thu thập thêm 1
    const spot = resourceSpots(again.map, again.terrain, 'lua')[5];
    const g = await act(again.session_id, again.seq, { type: 'gather', at: spot.at, from: spot.from });
    expect(g.body.outcome.events[0]).toMatchObject({ t: 'got', n: 3 });
    // danh hiệu nằm trong kho trang phục, trang bị được
    const wardrobe = (await api('GET', '/api/saga/cosmetics')).body;
    expect(wardrobe.titles.find((t: any) => t.code === 'nguoi-giu-lang')).toMatchObject({ name: 'Người giữ làng', unlocked: true });
    expect(wardrobe.titles.find((t: any) => t.code === 'dong-long-giu-nuoc')).toMatchObject({ unlocked: false });
    expect((await api('POST', '/api/saga/cosmetics/equip', { title: 'nguoi-giu-lang' })).body.equipped.title).toMatchObject({ code: 'nguoi-giu-lang' });
    expect((await api('POST', '/api/saga/cosmetics/equip', { title: 'dong-long-giu-nuoc' })).status).toBe(409);
    // Sổ sử Đông A: phần đã xong mọi chặng thì xếp sự kiện; xếp sai báo số vị trí đúng, xếp đúng hoàn thiện trang (thưởng điểm một lần)
    const book = (await api('GET', '/api/saga/world/book')).body.pages;
    expect(book.map((p: any) => p.campaign_no)).toEqual([1, 2, 3]);
    const p1 = book[0];
    expect(p1).toMatchObject({ unlocked: true, done: false });
    const right = (await worldRaw(1)).book.events.map((e: any) => e.id);
    expect(p1.events.map((e: any) => e.id)).not.toEqual(right); // đã xáo, không lộ thứ tự đúng
    expect(p1.events.map((e: any) => e.id).sort()).toEqual([...right].sort());
    const wrong = await api('POST', '/api/saga/world/book/1', { order: [...right].reverse() });
    expect(wrong.body).toMatchObject({ correct: false, total: right.length });
    expect((await api('POST', '/api/saga/world/book/1', { order: right.slice(1) })).status).toBe(400);
    const done = await api('POST', '/api/saga/world/book/1', { order: right });
    expect(done.body).toMatchObject({ correct: true, first: true, xp: 30 });
    expect(done.body.pages[0]).toMatchObject({ done: true });
    expect(done.body.pages[0].events.map((e: any) => e.id)).toEqual(right);
    expect((await api('POST', '/api/saga/world/book/1', { order: right })).body).toMatchObject({ correct: true, first: false, xp: 0 });
    // phần chưa xong hết các chặng thì trang Sổ sử còn khóa (học sinh 3 chưa xong chặng Bạch Đằng)
    const lone = (await api('GET', '/api/saga/world/book', undefined, f.S3.token)).body.pages;
    expect(lone.find((p: any) => p.campaign_no === 3)).toMatchObject({ unlocked: false, done: false, events: [] });
    expect((await api('POST', '/api/saga/world/book/3', { order: ['a', 'b', 'c', 'd', 'e'] }, f.S3.token)).status).toBe(409);
  }, 120_000);

  it('tự tạo nhân vật: lưu lựa chọn hợp lệ, từ chối giá trị ngoài danh sách', async () => {
    const before = await api('GET', '/api/saga/world/look');
    expect(before.body.look.chosen).toBe(false);
    expect((await api('POST', '/api/saga/world/look', { gender: 'nu', robe: '#b8261b', hat: 'khan', skin: '#eec39a' })).body.look).toEqual({ gender: 'nu', robe: '#b8261b', hat: 'khan', skin: '#eec39a', chosen: true });
    expect((await api('POST', '/api/saga/world/look', { gender: 'nu', robe: '#ff00ff', hat: 'khan', skin: '#eec39a' })).status).toBe(422);
    expect((await api('GET', '/api/saga/world/look', undefined, f.T1.token)).status).toBe(403);
  });

  it('kênh Socket.IO /world: cùng lớp thấy nhau đi lại và thấy ô vừa thu hoạch; học sinh không có lớp không vào được phòng', async () => {
    const connect = async (token: string): Promise<Socket> => {
      const sock = io(`${s.base}/world`, { path: '/api/live/ws', auth: { token }, transports: ['websocket'], forceNew: true, reconnection: false });
      await new Promise<void>((resolve, reject) => { sock.on('connect', () => resolve()); sock.on('connect_error', (e) => { sock.close(); reject(e); }); });
      return sock;
    };
    const emit = (c: Socket, event: string, body: unknown) => new Promise<any>((resolve) => c.emit(event, body, resolve));
    const next = (c: Socket, event: string) => new Promise<any>((resolve) => c.once(event, resolve));
    await expect(connect(f.T1.token)).rejects.toBeTruthy(); // chỉ học sinh
    const a = await connect(f.S1.token), b = await connect(f.S2.token), lone = await connect(f.S3.token);
    try {
      const ja = await emit(a, 'world:join', { class_id: f.class7a.id, campaign_no: 3 });
      expect(ja).toMatchObject({ ok: true, data: { me: f.S1.id, players: [] } });
      const joined = next(a, 'world:joined');
      const jb = await emit(b, 'world:join', { class_id: f.class7a.id, campaign_no: 3 });
      expect(jb.data.players.map((p: any) => [p.id, p.name])).toEqual([[f.S1.id, 'Phạm Minh Một']]);
      expect((await joined).id).toBe(f.S2.id);
      const moved = next(b, 'world:moved');
      a.emit('world:move', { x: 12.5, z: 13, ry: 1.2 });
      expect(await moved).toEqual({ id: f.S1.id, x: 12.5, z: 13, ry: 1.2 });
      const said = next(b, 'world:said');
      expect(await emit(a, 'world:say', { code: 'need_wood' })).toEqual({ ok: true });
      expect(await said).toEqual({ id: f.S1.id, code: 'need_wood' });
      expect((await emit(a, 'world:say', { code: 'chu tu do' })).ok).toBe(false); // không có chat tự do
      // thu hoạch qua API: cả phòng nhận ô chờ mọc lại
      const view = (await api('POST', `/api/saga/stages/${stageId['bach-dang']}/explore`, {})).body;
      const node = next(b, 'world:node');
      const g = await act(view.session_id, view.seq, { type: 'gather', at: [21, 14], from: [21, 13] });
      expect(g.status).toBe(200);
      expect(await node).toMatchObject({ x: 21, z: 14 });
      expect((await emit(lone, 'world:join', { class_id: f.class7a.id, campaign_no: 3 })).ok).toBe(false);
      expect((await emit(b, 'world:join', { class_id: f.class7b.id, campaign_no: 3 })).status).toBe(403);
    } finally { a.close(); b.close(); lone.close(); }
  }, 30_000);
});
