/**
 * Sprint 6 theo ver0.2, game mô phỏng trận đánh bằng thẻ tướng (HK.HS.113–116, 124, 126–138; HK.QT.056; HK.AD.048, 081–086; HK.SYS.021–022):
 * bộ sưu tập thẻ, nâng cấp, mảnh thẻ, đội hình, bản đồ hành quân, màn chơi, trận đánh do máy chủ xử lý, giờ chơi và quản trị. HTTP thật trên PostgreSQL tạm.
 */
import { call, hasPostgres, Started, startApp } from './harness';
import { bootstrap, Fixture, publishSeed } from './fixture';
import type { DatabaseService } from '../src/database/database.service';
import type { GameService } from '../src/game/game.service';

let s: Started, f: Fixture, db: DatabaseService, game: GameService;
const as = (who: { token: string }) => (method: string, path: string, body?: unknown) => call(s.base, method, path, body, who.token);
const root = (method: string, path: string, body?: unknown) => call(s.base, method, path, body, f.root);
const keys = new Map<number, { qtype: string; data: any }>();
const tx = <T>(run: (q: any) => Promise<T>) => db.tx(run as never) as Promise<T>;

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

const cardId = async (code: string): Promise<number> => (await db.query<{ id: number }>('SELECT id FROM hk_cards WHERE code = $1', [code]))[0].id;
const give = async (userId: number, code: string, level = 1, stars = 1) => {
  await db.query('INSERT INTO hk_user_cards (user_id, card_id, level, stars) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, card_id) DO UPDATE SET level = $3, stars = $4', [userId, await cardId(code), level, stars]);
};
/** Hoàn thành mọi nút đứng trước nút trận đánh trong hành trình mặc định của cuộc kháng chiến (đồng bộ học → game) */
const learnToBattle = async (userId: number, campaignId: number, slug?: string) => {
  const nodes = await db.query<{ id: number; kind: string; position: number; slug: string | null }>('SELECT n.id, n.kind, n.position, b.slug FROM hk_nodes n JOIN hk_journeys j ON j.id = n.journey_id LEFT JOIN hist_battles b ON b.id = n.battle_id WHERE j.campaign_id = $1 AND j.is_default ORDER BY n.position', [campaignId]);
  const battle = nodes.find((n) => n.kind === 'battle' && (!slug || n.slug === slug))!;
  for (const n of nodes.filter((x) => x.position < battle.position)) await db.query('INSERT INTO hk_node_progress (user_id, node_id, best_percent, stars, completed_at) VALUES ($1, $2, 100, 3, now()) ON CONFLICT (user_id, node_id) DO UPDATE SET completed_at = now()', [userId, n.id]);
};
const GENERALS = ['tran-thai-tong', 'tran-thu-do', 'tran-quoc-toan', 'tran-binh-trong', 'tran-quang-khai', 'tran-khanh-du', 'tran-nhat-duat', 'tran-thanh-tong', 'pham-ngu-lao', 'yet-kieu', 'le-phu-tran', 'tran-nhan-tong'];

/** Đánh hết một trận: tự động đánh, gặp câu hỏi tuyệt kỹ thì trả lời (đúng hoặc sai theo yêu cầu) */
async function playOut(who: { token: string }, battleId: number, right = true) {
  let view: any = (await as(who)('GET', `/api/war/battles/${battleId}`)).body;
  for (let i = 0; i < 80 && view.status === 'active'; i += 1) {
    if (view.question) {
      const res = await as(who)('POST', `/api/war/battles/${battleId}/answer`, { answer: answerOf(view.question.view.id, right) });
      expect(res.status).toBe(200);
      view = res.body.battle;
    } else {
      const res = await as(who)('POST', `/api/war/battles/${battleId}/act`, { type: 'auto_run', steps: 30 });
      expect(res.status).toBe(200);
      view = res.body;
    }
  }
  return view;
}

(hasPostgres() ? describe : describe.skip)('Sprint 6 (ver0.2) – game thẻ tướng', () => {
  let campaigns: Array<{ id: number }>;
  let stageDongBoDau: number, stageBachDang: number;
  let sourceId: number;

  beforeAll(async () => {
    s = await startApp('war_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    game = s.moduleRef.get((await import('../src/game/game.service')).GameService);
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken, true);
    await publishSeed(s.base, f.root);
    for (const row of await db.query<{ id: number; qtype: string; data: any }>('SELECT id, qtype, data FROM hk_questions')) keys.set(row.id, row);
    sourceId = (await db.query<{ id: number }>("SELECT id FROM hist_sources WHERE slug = 'hich-tuong-si-trich-doan'"))[0].id;
    // phát hành nội dung khởi tạo như khi giáo viên Lịch sử đã kiểm chứng
    for (const k of (await root('GET', '/api/war/admin/commanders')).body) await root('PUT', `/api/war/admin/commanders/${k.id}`, { status: 'published' });
    for (const d of (await root('GET', '/api/war/admin/dialogs')).body) {
      await root('PUT', `/api/war/admin/dialogs/${d.id}`, { source_ids: [sourceId] });
      expect((await root('POST', `/api/war/admin/dialogs/${d.id}/status`, { status: 'published' })).status).toBe(200);
    }
    for (const st of (await root('GET', '/api/war/admin/stages')).body) expect((await root('POST', `/api/war/admin/stages/${st.id}/status`, { status: 'published' })).status).toBe(200);
    for (const m of (await root('GET', '/api/war/admin/maps')).body) expect((await root('POST', `/api/war/admin/maps/${m.id}/status`, { status: 'published' })).status).toBe(200);
    campaigns = await db.query<{ id: number }>("SELECT id FROM hist_campaigns WHERE status = 'published' ORDER BY sort_order, id");
    stageDongBoDau = (await db.query<{ id: number }>("SELECT s.id FROM hk_stages s JOIN hist_battles b ON b.id = s.battle_id WHERE b.slug = 'dong-bo-dau'"))[0].id;
    stageBachDang = (await db.query<{ id: number }>("SELECT s.id FROM hk_stages s JOIN hist_battles b ON b.id = s.battle_id WHERE b.slug = 'bach-dang'"))[0].id;
    await db.query('INSERT INTO hk_players (user_id, level) VALUES ($1, 1), ($2, 1) ON CONFLICT DO NOTHING', [f.S1.id, f.S2.id]);
  });
  afterAll(async () => { await s?.close(); });

  // ------------------------------------------------------------------ HK.HS.068/069/126: bộ sưu tập và chi tiết thẻ
  test('bộ sưu tập: 13 thẻ tướng và 4 thẻ chiến thuật; thẻ chưa có chỉ hiện độ hiếm; xem chi tiết thẻ chưa có bị từ chối', async () => {
    const res = await as(f.S2)('GET', '/api/war/cards');
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(17);
    expect(res.body.cards.filter((c: any) => c.kind === 'tactic')).toHaveLength(4);
    expect(res.body.cards.every((c: any) => !c.owned && c.name === null && c.rarity_label)).toBe(true);
    expect(res.body.cards.map((c: any) => c.rarity)).toContain('epic'); // độ hiếm Sử thi
    const any = res.body.cards[0];
    expect((await as(f.S2)('GET', `/api/war/cards/${any.id}`)).status).toBe(403);
    expect((await as(f.T1)('GET', '/api/war/cards')).status).toBe(403); // giáo viên không có bộ thẻ
  });

  test('chi tiết thẻ: chỉ số theo cấp và sao, chiêu thức kèm giai thoại, tiểu sử và các trận đã tham gia', async () => {
    for (const code of GENERALS) await give(f.S1.id, code);
    await give(f.S1.id, 'hich-tuong-si'); // thẻ chiến thuật
    const id = await cardId('tran-quoc-toan');
    const d = (await as(f.S1)('GET', `/api/war/cards/${id}`)).body;
    expect(d).toMatchObject({ owned: true, level: 1, stars: 1, kind: 'general', branch: 'ky', rarity: 'rare' });
    expect(d.stats).toEqual({ atk: 130, def: 55, hp: 800, spd: 15 });
    expect(d.power).toBeGreaterThan(0);
    expect(d.moves.map((m: any) => m.slot)).toEqual(['active', 'ultimate', 'passive']);
    expect(d.moves.find((m: any) => m.slot === 'passive')).toMatchObject({ name: 'Phá cường địch, báo hoàng ân', target: 'ally_all' });
    expect(d.moves.every((m: any) => m.slot !== 'passive' || m.anecdote)).toBe(true);
    expect(d.figure.name).toMatch(/Quốc Toản/);
    const khanhDu = (await as(f.S1)('GET', `/api/war/cards/${await cardId('tran-khanh-du')}`)).body;
    expect(khanhDu).toMatchObject({ rarity: 'epic', branch: 'thuy' });
    expect(khanhDu.battles.some((b: any) => /Vân Đồn/.test(b.name))).toBe(true);
    const col = (await as(f.S1)('GET', '/api/war/cards')).body;
    expect(col.summary).toMatchObject({ generals: 12, tactics: 1 });
  });

  // ------------------------------------------------------------------ HK.HS.127, 068: nâng cấp, mảnh thẻ
  test('nâng cấp: cấp thẻ không vượt cấp học tập, tốn Binh thư (2×cấp), không trừ hai lần; thăng sao tốn mảnh', async () => {
    const id = await cardId('tran-quoc-toan');
    await db.query("UPDATE hk_players SET binh_thu = 100 WHERE user_id = $1", [f.S1.id]);
    const capped = await as(f.S1)('POST', `/api/war/cards/${id}/upgrade`, { kind: 'level' });
    expect(capped.status).toBe(409);
    expect(capped.body.detail).toMatch(/không vượt cấp học tập/);
    await db.query('UPDATE hk_players SET level = 6 WHERE user_id = $1', [f.S1.id]);
    const up1 = await as(f.S1)('POST', `/api/war/cards/${id}/upgrade`, { kind: 'level' });
    expect(up1.status).toBe(200);
    expect(up1.body).toMatchObject({ level: 2, level_cost: 4 });
    expect(up1.body.stats.atk).toBe(143); // +10% mỗi cấp
    expect((await db.query<{ binh_thu: number }>('SELECT binh_thu FROM hk_players WHERE user_id = $1', [f.S1.id]))[0].binh_thu).toBe(98);
    expect((await as(f.S1)('POST', `/api/war/cards/${id}/upgrade`, { kind: 'level' })).body.level).toBe(3);
    expect((await db.query<{ binh_thu: number }>('SELECT binh_thu FROM hk_players WHERE user_id = $1', [f.S1.id]))[0].binh_thu).toBe(94);
    await db.query('UPDATE hk_players SET binh_thu = 1 WHERE user_id = $1', [f.S1.id]);
    expect((await as(f.S1)('POST', `/api/war/cards/${id}/upgrade`, { kind: 'level' })).body.detail).toMatch(/Cần 6 Binh thư/);
    // thăng sao bằng mảnh trùng
    expect((await as(f.S1)('POST', `/api/war/cards/${id}/upgrade`, { kind: 'star' })).status).toBe(409);
    await db.query('INSERT INTO hk_card_fragments (user_id, card_id, qty) VALUES ($1, $2, 10) ON CONFLICT (user_id, card_id) DO UPDATE SET qty = 10', [f.S1.id, id]);
    const star = await as(f.S1)('POST', `/api/war/cards/${id}/upgrade`, { kind: 'star' });
    expect(star.body).toMatchObject({ stars: 2, fragments: 8, star_cost: 3 });
    expect(star.body.stats.atk).toBe(Math.round(130 * 1.2 * 1.2));
    // thẻ chiến thuật không nâng cấp
    expect((await as(f.S1)('POST', `/api/war/cards/${await cardId('hich-tuong-si')}/upgrade`, { kind: 'level' })).status).toBe(409);
  });

  test('mảnh thẻ: thẻ chưa có đủ mảnh thì tự ghép; thẻ trùng khi lật thành một mảnh; mảnh đã dùng thì trừ', async () => {
    const id = await cardId('tran-hung-dao'); // cần 6 mảnh
    const a = await tx((q) => game.addFragments(q, f.S1.id, id, 4));
    expect(a).toEqual({ merged: false, fragments: 4 });
    const named = (await as(f.S1)('GET', '/api/war/cards')).body.cards.find((c: any) => c.id === id);
    expect(named).toMatchObject({ owned: false, fragments: 4, fragments_needed: 6 });
    expect(named.name).toBe('Trần Hưng Đạo'); // có mảnh thì biết tên thẻ
    const b = await tx((q) => game.addFragments(q, f.S1.id, id, 3));
    expect(b).toEqual({ merged: true, fragments: 1 });
    const owned = (await as(f.S1)('GET', '/api/war/cards')).body.cards.find((c: any) => c.id === id);
    expect(owned).toMatchObject({ owned: true, level: 1, stars: 1, fragments: 1 });
    // thẻ rơi trùng: nhận thêm một mảnh
    const drop = (await db.query<{ id: number }>("INSERT INTO hk_card_drops (user_id, card_id, source) VALUES ($1, $2, 'node') RETURNING id::int AS id", [f.S1.id, id]))[0].id;
    expect((await as(f.S1)('POST', `/api/game/drops/${drop}/flip`)).body.duplicate).toBe(true);
    expect((await as(f.S1)('GET', '/api/war/cards')).body.cards.find((c: any) => c.id === id).fragments).toBe(2);
  });

  // ------------------------------------------------------------------ HK.HS.128: đội hình
  test('đội hình: tối đa 3 đội, mỗi đội tối đa 5 thẻ tướng khác nhau đã sở hữu, kèm một thẻ chiến thuật', async () => {
    const ids = await Promise.all(['tran-hung-dao', 'tran-quang-khai', 'tran-khanh-du', 'tran-binh-trong', 'tran-thu-do'].map(cardId));
    const tactic = await cardId('hich-tuong-si');
    const ok = await as(f.S1)('PUT', '/api/war/formations/1', { name: 'Quân tiên phong', front: ids.slice(0, 2), back: ids.slice(2), tactic_card_id: tactic });
    expect(ok.status).toBe(200);
    expect(ok.body.slots[0]).toMatchObject({ slot: 1, name: 'Quân tiên phong', size: 5, tactic_card_id: tactic });
    expect(ok.body.slots[0].power).toBeGreaterThan(1000);
    expect(ok.body.slots[1]).toMatchObject({ slot: 2, size: 0 });
    const spare = await cardId('tran-thanh-tong');
    expect((await as(f.S1)('PUT', '/api/war/formations/2', { front: [...ids, spare] })).status).toBe(400); // 6 thẻ
    expect((await as(f.S1)('PUT', '/api/war/formations/2', { front: [ids[0], ids[0]] })).status).toBe(400); // trùng
    expect((await as(f.S2)('PUT', '/api/war/formations/1', { front: [ids[0]] })).status).toBe(400); // chưa sở hữu
    expect((await as(f.S1)('PUT', '/api/war/formations/2', { front: [tactic] })).status).toBe(400); // thẻ chiến thuật không đứng trong đội
    expect((await as(f.S1)('PUT', '/api/war/formations/2', { front: [ids[0]], tactic_card_id: ids[1] })).status).toBe(400); // không phải thẻ chiến thuật
    expect((await as(f.S1)('PUT', '/api/war/formations/4', { front: [ids[0]] })).status).toBe(400);
  });

  // ------------------------------------------------------------------ HK.HS.113–116, 124: bản đồ hành quân
  describe('bản đồ hành quân', () => {
    const map = async (who = f.S1, c = 0) => (await as(who)('GET', `/api/war/march/${campaigns[c].id}`)).body;
    const pointId = (m: any, code: string): number => m.points.find((p: any) => p.code === code).id;
    const stateOf = (m: any, code: string): string => m.points.find((p: any) => p.code === code).state;

    test('xem bản đồ: điểm xuất phát, các điểm nối tiếp mở dần, điểm trận đánh khóa tới khi học tới nơi', async () => {
      expect((await as(f.S1)('GET', '/api/war/march')).body).toHaveLength(3);
      const m = await map();
      expect(m.map.title).toMatch(/lần thứ nhất/);
      expect(m.points).toHaveLength(6);
      expect(m.edges).toHaveLength(6);
      expect(stateOf(m, 'thang-long')).toBe('current');
      expect(stateOf(m, 'binh-le-nguyen')).toBe('open');
      expect(stateOf(m, 'phu-thai-su')).toBe('open');
      expect(stateOf(m, 'hoi-quan')).toBe('locked'); // chưa nằm cạnh điểm nào đã đi
      expect(m.points.find((p: any) => p.code === 'dong-bo-dau')).toMatchObject({ state: 'locked', kind: 'battle', locked_reason: expect.stringMatching(/học xong/) });
      expect(m.progress).toEqual({ visited: 1, total: 6 });
      expect(m.war.open).toBe(true);
    });

    test('di chuyển theo đường nối: không đi tắt qua điểm chưa mở; hội thoại cốt truyện vào Nhật ký hành quân', async () => {
      const m = await map();
      expect((await as(f.S1)('POST', '/api/war/march/move', { point_id: pointId(m, 'hoi-quan') })).status).toBe(409); // chưa mở
      expect((await as(f.S1)('POST', '/api/war/march/move', { point_id: 999999 })).status).toBe(404);
      const go = await as(f.S1)('POST', '/api/war/march/move', { point_id: pointId(m, 'binh-le-nguyen') });
      expect(go.status).toBe(200);
      expect(go.body.path).toEqual([pointId(m, 'thang-long'), pointId(m, 'binh-le-nguyen')]);
      expect(go.body.event).toMatchObject({ kind: 'story', dialog: { title: 'Chặn giặc ở Bình Lệ Nguyên' } });
      expect(go.body.event.dialog.lines).toHaveLength(2);
      expect(go.body.event.dialog.sources[0].title).toMatch(/Hịch/);
      const after = await map();
      expect(stateOf(after, 'binh-le-nguyen')).toBe('current');
      expect(stateOf(after, 'thang-long')).toBe('visited');
      expect(stateOf(after, 'hoi-quan')).toBe('open'); // nằm cạnh điểm đã đi
      const phu = await as(f.S1)('POST', '/api/war/march/move', { point_id: pointId(m, 'phu-thai-su') });
      expect(phu.body.path).toEqual([pointId(m, 'binh-le-nguyen'), pointId(m, 'thang-long'), pointId(m, 'phu-thai-su')]); // đi lại qua điểm đã tới
      const speaker = phu.body.event.dialog.lines[1];
      expect(speaker).toMatchObject({ speaker: 'Trần Thủ Độ', text: expect.stringMatching(/Đầu thần chưa rơi xuống đất/) });
      expect(speaker.figure.name).toMatch(/Thủ Độ/);
      expect(phu.body.event.dialog.lines[2].choices[0].text).toMatch(/Vì sao/);
      const log = (await as(f.S1)('GET', '/api/war/march/log')).body;
      expect(log.map((l: any) => l.title).sort()).toEqual(['Chặn giặc ở Bình Lệ Nguyên', 'Đầu thần chưa rơi xuống đất']);
      // vị trí được lưu cho lần đăng nhập sau
      expect((await map()).current_point_id).toBe(pointId(m, 'phu-thai-su'));
    });

    test('sự kiện tại điểm: thử thách câu hỏi thưởng một lần; rương và mảnh thẻ chỉ nhận một lần', async () => {
      const m = await map();
      const quizAt = await as(f.S1)('POST', '/api/war/march/move', { point_id: pointId(m, 'hoi-quan') });
      expect(quizAt.status).toBe(200);
      expect(quizAt.body.event).toMatchObject({ kind: 'quiz', done: false });
      const q = quizAt.body.event.question;
      expect(q.prompt).toBeTruthy();
      expect(q.answer).toBeUndefined(); // không lộ đáp án
      const wrong = await as(f.S1)('POST', `/api/war/march/points/${pointId(m, 'hoi-quan')}/answer`, { answer: answerOf(q.id, false) });
      expect(wrong.body).toMatchObject({ correct: false, rewards: null, done: false });
      const goldBefore = (await db.query<{ gold: number }>('SELECT gold FROM hk_players WHERE user_id = $1', [f.S1.id]))[0].gold;
      const right = await as(f.S1)('POST', `/api/war/march/points/${pointId(m, 'hoi-quan')}/answer`, { answer: answerOf(q.id, true) });
      expect(right.body).toMatchObject({ correct: true, done: true, rewards: { gold: 8, binh_thu: 3 } });
      const again = await as(f.S1)('POST', `/api/war/march/points/${pointId(m, 'hoi-quan')}/answer`, { answer: answerOf(q.id, true) });
      expect(again.body.rewards).toBeNull();
      expect((await db.query<{ gold: number }>('SELECT gold FROM hk_players WHERE user_id = $1', [f.S1.id]))[0].gold).toBe(goldBefore + 8);
      // chưa tới điểm thì không trả lời được
      expect((await as(f.S2)('POST', `/api/war/march/points/${pointId(m, 'hoi-quan')}/answer`, { answer: {} })).status).toBe(409);
      // rương: vàng, Binh thư và mảnh thẻ một lần
      const chest = await as(f.S1)('POST', '/api/war/march/move', { point_id: pointId(m, 'kho-luong') });
      expect(chest.body.event).toMatchObject({ kind: 'chest', done: false, rewards: { gold: 15, binh_thu: 4, fragments: [{ card: 'Trần Thủ Độ', qty: 2 }] } });
      const back = await as(f.S1)('POST', '/api/war/march/move', { point_id: pointId(m, 'phu-thai-su') });
      expect(back.status).toBe(200);
      const chestAgain = await as(f.S1)('POST', '/api/war/march/move', { point_id: pointId(m, 'kho-luong') });
      expect(chestAgain.body.event).toMatchObject({ kind: 'chest', done: true });
      // điểm thẻ ở bản đồ lần hai: nhận mảnh Trần Quốc Toản một lần
      const m2 = await map(f.S1, 1);
      const toBinhThan = await as(f.S1)('POST', '/api/war/march/move', { point_id: pointId(m2, 'binh-than') });
      expect(toBinhThan.body.event.kind).toBe('story');
      const camp = await as(f.S1)('POST', '/api/war/march/move', { point_id: pointId(m2, 'dai-ban-doanh') });
      expect(camp.body.event).toMatchObject({ kind: 'card', done: false, card: { name: 'Trần Quốc Toản' }, qty: 2 });
      expect((await as(f.S1)('POST', '/api/war/march/move', { point_id: pointId(m2, 'binh-than') })).status).toBe(200);
      const campAgain = await as(f.S1)('POST', '/api/war/march/move', { point_id: pointId(m2, 'dai-ban-doanh') });
      expect(campAgain.body.event).toMatchObject({ kind: 'card', done: true });
    });

    test('đồng bộ học → game (HK.SYS.021, HK.HS.124): trận đánh chỉ mở khi đã học tới nút trận đánh trong hành trình', async () => {
      const m = await map();
      expect(stateOf(m, 'dong-bo-dau')).toBe('locked');
      const blocked = await as(f.S1)('POST', '/api/war/march/move', { point_id: pointId(m, 'dong-bo-dau') });
      expect(blocked.status).toBe(409);
      expect(blocked.body.detail).toMatch(/học xong/);
      expect((await as(f.S1)('POST', `/api/war/stages/${stageDongBoDau}/start`, { slot: 1 })).status).toBe(409); // vào thẳng cũng bị chặn
      // học xong các nút đứng trước nút trận đánh
      const nodes = await db.query<{ id: number; kind: string; position: number; battle_id: number | null }>(
        `SELECT n.id, n.kind, n.position, n.battle_id FROM hk_nodes n JOIN hk_journeys j ON j.id = n.journey_id WHERE j.campaign_id = $1 AND j.is_default ORDER BY n.position`, [campaigns[0].id]);
      const battle = nodes.find((n) => n.kind === 'battle')!;
      for (const n of nodes.filter((x) => x.position < battle.position)) {
        await db.query('INSERT INTO hk_node_progress (user_id, node_id, best_percent, stars, completed_at) VALUES ($1, $2, 100, 3, now()) ON CONFLICT (user_id, node_id) DO UPDATE SET completed_at = now()', [f.S1.id, n.id]);
      }
      const open = await map();
      expect(stateOf(open, 'dong-bo-dau')).toBe('open');
      const go = await as(f.S1)('POST', '/api/war/march/move', { point_id: pointId(open, 'dong-bo-dau') });
      expect(go.status).toBe(200);
      expect(go.body.event).toMatchObject({ kind: 'battle', stage_id: stageDongBoDau });
      expect(go.body.path.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ------------------------------------------------------------------ HK.HS.051–052, 131–133, 138: màn chơi và trận đánh
  describe('màn chơi và trận đánh', () => {
    test('danh sách và giới thiệu màn chơi: bối cảnh, mục tiêu, chỉ huy đối phương chưa lộ hồ sơ, gợi ý thẻ tướng từng tham gia', async () => {
      const list = (await as(f.S1)('GET', '/api/war/stages')).body;
      expect(list.stages).toHaveLength(6);
      expect(list.stages[0]).toMatchObject({ title: 'Phản công Đông Bộ Đầu', best_stars: 0, locked: false });
      expect(list.stages[0].commander_name).toBeNull(); // chưa chạm trán
      const intro = (await as(f.S1)('GET', `/api/war/stages/${stageDongBoDau}`)).body;
      expect(intro.battle.name).toMatch(/Đông Bộ Đầu/);
      expect(intro.objective).toMatch(/Ngột Lương Hợp Thai/);
      expect(intro.commander).toEqual({ id: expect.any(Number), name: 'Ngột Lương Hợp Thai', role_text: expect.any(String) }); // chỉ biết tên và vai trò
      expect(intro.enemies).toHaveLength(2);
      expect(intro.terrain_notes.join(' ')).toMatch(/vườn không nhà trống/);
      expect(intro.historical_figures.length).toBeGreaterThanOrEqual(1);
      expect(intro.suggested_cards.every((c: any) => c.owned !== undefined)).toBe(true);
      expect(intro.stars).toHaveLength(3);
      expect((await as(f.S1)('GET', '/api/war/stages/999999')).status).toBe(404);
    });

    test('vào trận: chỉ dùng thẻ đã có; trận hiện thứ tự lượt, chỉ số, chỉ huy địch; sổ tay chỉ huy mở sau khi chạm trán', async () => {
      for (const code of ['tran-hung-dao', 'tran-quang-khai', 'tran-khanh-du', 'tran-binh-trong', 'tran-thu-do']) await give(f.S1.id, code, 8, 4);
      await db.query('UPDATE hk_players SET level = 12 WHERE user_id = $1', [f.S1.id]);
      expect((await as(f.S1)('POST', `/api/war/stages/${stageDongBoDau}/start`, { front: [await cardId('tran-hung-dao')], back: [] })).status).toBe(200);
      const first: any = (await as(f.S1)('GET', '/api/war/stages')).body;
      expect(first.stages[0].commander_name).toBe('Ngột Lương Hợp Thai');
      const cmd = (await as(f.S1)('GET', '/api/war/commanders')).body;
      expect(cmd.filter((c: any) => c.seen).map((c: any) => c.name)).toEqual(['Ngột Lương Hợp Thai']);
      expect(cmd.find((c: any) => !c.seen)).toMatchObject({ name: null, tactics: null }); // chưa chạm trán thì chưa mở hồ sơ
      // trận đang dở thì vào lại là chơi tiếp
      const resume: any = (await as(f.S1)('POST', `/api/war/stages/${stageDongBoDau}/start`, { slot: 1 })).body;
      expect(resume.units.filter((u: any) => u.side === 'ally')).toHaveLength(1);
      const restart: any = (await as(f.S1)('POST', `/api/war/stages/${stageDongBoDau}/start`, { slot: 1, restart: true })).body;
      expect(restart.units.filter((u: any) => u.side === 'ally')).toHaveLength(5);
      expect(restart.units.filter((u: any) => u.side === 'enemy')).toHaveLength(3);
      expect(restart).toMatchObject({ status: 'active', turn: 1, max_turns: 15, wave: 1, waves: 2 });
      expect(restart.order.length).toBeGreaterThan(3);
      expect(restart.actor).toBeTruthy();
      expect(restart.available).toEqual(['normal']);
      expect((await as(f.S1)('POST', `/api/war/stages/${stageDongBoDau}/start`, { front: [await cardId('tran-thai-tong'), 99999], restart: true })).status).toBe(400); // thẻ không có
      await learnToBattle(f.S2.id, campaigns[0].id);
      expect((await as(f.S2)('POST', `/api/war/stages/${stageDongBoDau}/start`, { front: [await cardId('tran-thai-tong')], restart: true })).status).toBe(400); // chưa sở hữu
      // tướng từng tham gia trận trong lịch sử được "Hào khí" (+10% chỉ số)
      const intro = (await as(f.S1)('GET', `/api/war/stages/${stageDongBoDau}`)).body;
      const historical = intro.suggested_cards.filter((c: any) => c.owned);
      expect(historical.length).toBeGreaterThanOrEqual(1);
      const withHao: any = (await as(f.S1)('POST', `/api/war/stages/${stageDongBoDau}/start`, { front: historical.map((c: any) => c.id).slice(0, 5), restart: true })).body;
      const allies = withHao.units.filter((u: any) => u.side === 'ally');
      expect(allies.every((u: any) => u.hao_khi)).toBe(true);
      expect(allies.every((u: any) => u.max_hp > 0)).toBe(true);
      // dựng lại trận bằng đội hình đã lưu để các bước sau dùng
      expect((await as(f.S1)('POST', `/api/war/stages/${stageDongBoDau}/start`, { slot: 1, restart: true })).status).toBe(200);
    });

    test('mỗi lượt do máy chủ xử lý: đòn không hợp lệ bị từ chối; đòn thường, phòng thủ, thẻ chiến thuật; không đánh thay lượt người khác', async () => {
      const view: any = (await as(f.S1)('GET', `/api/war/battles/${(await db.query<{ id: number }>("SELECT id::int AS id FROM hk_war_battles WHERE user_id = $1 AND status = 'active'", [f.S1.id]))[0].id}`)).body;
      const id = view.id;
      expect((await as(f.S2)('GET', `/api/war/battles/${id}`)).status).toBe(404); // trận của người khác
      expect((await as(f.S1)('POST', `/api/war/battles/${id}/act`, { type: 'move', slot: 'ultimate' })).status).toBe(409); // chưa đủ nộ
      expect((await as(f.S1)('POST', `/api/war/battles/${id}/act`, { type: 'bay' })).status).toBe(400);
      expect((await as(f.S1)('POST', `/api/war/battles/${id}/answer`, { answer: {} })).status).toBe(409); // không có câu hỏi nào chờ
      const target = view.units.find((u: any) => u.side === 'enemy' && u.alive).id;
      const hit: any = (await as(f.S1)('POST', `/api/war/battles/${id}/act`, { type: 'move', slot: 'normal', target })).body;
      expect(hit.log.some((l: any) => l.kind === 'hit')).toBe(true);
      expect(hit.units.find((u: any) => u.id === target).hp).toBeLessThan(view.units.find((u: any) => u.id === target).hp);
      const guard = await as(f.S1)('POST', `/api/war/battles/${id}/act`, { type: 'guard' });
      expect(guard.status).toBe(200);
      expect(guard.body.units.some((u: any) => u.guard) || guard.body.log.some((l: any) => /phòng thủ/.test(l.text))).toBe(true);
    });

    test('tuyệt kỹ cần câu hỏi trong 15 giây: đúng kịp giờ gây sát thương lớn hơn rõ rệt so với trả lời sai hoặc quá giờ', async () => {
      const damageOf = async (mode: 'right' | 'wrong' | 'late') => {
        const start: any = (await as(f.S1)('POST', `/api/war/stages/${stageDongBoDau}/start`, { slot: 1, restart: true })).body;
        const id = start.id;
        // đẩy nộ của tướng đang tới lượt lên đầy để thử tuyệt kỹ
        await db.query(`UPDATE hk_war_battles SET state = jsonb_set(state, ARRAY['engine', 'units', $2, 'rage'], '100'::jsonb) WHERE id = $1`, [id, start.actor]);
        const before = start.stats.dealt;
        const ult: any = await as(f.S1)('POST', `/api/war/battles/${id}/act`, { type: 'move', slot: 'ultimate', target: start.units.find((u: any) => u.side === 'enemy').id });
        expect(ult.status).toBe(200);
        expect(ult.body.pending).toEqual({ unit: start.actor });
        expect(ult.body.question).toMatchObject({ seconds: 15 });
        expect(ult.body.question.view.prompt).toBeTruthy();
        expect((await as(f.S1)('POST', `/api/war/battles/${id}/act`, { type: 'auto' })).status).toBe(409); // phải trả lời câu hỏi trước
        if (mode === 'late') await db.query(`UPDATE hk_war_battles SET state = jsonb_set(state, ARRAY['question', 'served_at'], to_jsonb((extract(epoch FROM now()) * 1000)::bigint - 40000)) WHERE id = $1`, [id]);
        const res = await as(f.S1)('POST', `/api/war/battles/${id}/answer`, { answer: answerOf(ult.body.question.view.id, mode === 'right' || mode === 'late') });
        expect(res.status).toBe(200);
        expect(res.body.result).toMatchObject({ correct: mode !== 'wrong', in_time: mode !== 'late' });
        return { dealt: res.body.battle.stats.dealt - before, log: res.body.battle.log.map((l: any) => l.text).join(' ') };
      };
      const right = await damageOf('right'), wrong = await damageOf('wrong'), late = await damageOf('late');
      expect(right.log).toMatch(/phát huy tối đa/);
      expect(wrong.log).toMatch(/chưa đúng/);
      expect(late.log).toMatch(/quá giờ/);
      expect(right.dealt).toBeGreaterThan(wrong.dealt * 1.5);
      expect(right.dealt).toBeGreaterThan(late.dealt * 1.5);
    });

    test('thắng trận: thưởng lần đầu (vàng, Binh thư, điểm, mảnh thẻ) chỉ nhận một lần; thắng lại không nhận trùng; sao và tiến độ ghi nhận', async () => {
      await db.query('DELETE FROM hk_war_battles WHERE user_id = $1', [f.S1.id]);
      const gold0 = (await db.query<{ gold: number; binh_thu: number; xp: number }>('SELECT gold, binh_thu, xp FROM hk_players WHERE user_id = $1', [f.S1.id]))[0];
      const frag0 = Number((await db.query<{ qty: number }>('SELECT qty FROM hk_card_fragments WHERE user_id = $1 AND card_id = $2', [f.S1.id, await cardId('tran-thai-tong')]))[0]?.qty ?? 0);
      const start: any = (await as(f.S1)('POST', `/api/war/stages/${stageDongBoDau}/start`, { slot: 1 })).body;
      const end = await playOut(f.S1, start.id);
      expect(end.status).toBe('won');
      expect(end.result).toMatchObject({ won: true, first_clear: true });
      expect(end.result.stars).toBeGreaterThanOrEqual(1);
      expect(end.result.best_unit.name).toBeTruthy();
      expect(end.result.rewards).toMatchObject({ gold: 40, fragments: [{ card: 'Trần Thái Tông', qty: 2 }] });
      expect(end.result.rewards.binh_thu).toBeGreaterThanOrEqual(6);
      expect(end.result.rewards.xp).toBeGreaterThanOrEqual(120);
      const p1 = (await db.query<{ gold: number; binh_thu: number; xp: number }>('SELECT gold, binh_thu, xp FROM hk_players WHERE user_id = $1', [f.S1.id]))[0];
      expect(p1.gold).toBeGreaterThanOrEqual(gold0.gold + 40);
      expect(p1.binh_thu).toBeGreaterThanOrEqual(gold0.binh_thu + 6);
      expect(p1.xp).toBeGreaterThanOrEqual(gold0.xp + 120);
      expect(Number((await db.query<{ qty: number }>('SELECT qty FROM hk_card_fragments WHERE user_id = $1 AND card_id = $2', [f.S1.id, await cardId('tran-thai-tong')]))[0].qty)).toBe(frag0 + 2);
      const prog = (await db.query<{ best_stars: number; clears: number; attempts: number; first_clear_at: string }>('SELECT best_stars, clears, attempts, first_clear_at FROM hk_stage_progress WHERE user_id = $1 AND stage_id = $2', [f.S1.id, stageDongBoDau]))[0];
      expect(prog).toMatchObject({ best_stars: end.result.stars, clears: 1 });
      expect(prog.first_clear_at).toBeTruthy();
      // thắng lại: không có thưởng lần đầu
      const again: any = (await as(f.S1)('POST', `/api/war/stages/${stageDongBoDau}/start`, { slot: 1 })).body;
      const second = await playOut(f.S1, again.id);
      expect(second.status).toBe('won');
      expect(second.result.first_clear).toBe(false);
      expect(second.result.rewards.gold).toBe(0);
      expect(second.result.rewards.fragments).toEqual([]);
      const p2 = (await db.query<{ gold: number }>('SELECT gold FROM hk_players WHERE user_id = $1', [f.S1.id]))[0];
      expect(p2.gold).toBe(p1.gold);
      expect((await db.query<{ n: string }>("SELECT count(*) AS n FROM hk_gold_ledger WHERE user_id = $1 AND ref_key = $2", [f.S1.id, `stage:${stageDongBoDau}:first`]))[0].n).toBe('1');
      // trận đã kết thúc thì không đánh tiếp được
      expect((await as(f.S1)('POST', `/api/war/battles/${again.id}/act`, { type: 'auto' })).status).toBe(409);
    });

    test('"Sự thật lịch sử" sau trận, bỏ qua màn đã đạt 3 sao (một lần mỗi ngày) và sao mới được thưởng Binh thư một lần', async () => {
      const truth = (await as(f.S1)('GET', `/api/war/stages/${stageDongBoDau}/truth`)).body;
      expect(truth.battle.name).toMatch(/Đông Bộ Đầu/);
      expect(truth.battle.course || truth.battle.result).toBeTruthy();
      expect(truth.commander.outcome).toMatch(/Đông Bộ Đầu/);
      expect(truth.differences).toHaveLength(2);
      expect(truth.figures.length).toBeGreaterThanOrEqual(1);
      expect((await as(f.S2)('GET', `/api/war/stages/${stageDongBoDau}/truth`)).status).toBe(403); // chưa chơi màn này
      // bỏ qua chỉ khi đã 3 sao
      await db.query('UPDATE hk_stage_progress SET best_stars = 2 WHERE user_id = $1 AND stage_id = $2', [f.S1.id, stageDongBoDau]);
      expect((await as(f.S1)('POST', `/api/war/stages/${stageDongBoDau}/skip`)).status).toBe(409);
      await db.query('UPDATE hk_stage_progress SET best_stars = 3 WHERE user_id = $1 AND stage_id = $2', [f.S1.id, stageDongBoDau]);
      const skip = await as(f.S1)('POST', `/api/war/stages/${stageDongBoDau}/skip`);
      expect(skip.body).toMatchObject({ skipped: true, rewards: { binh_thu: 3, gold: 20 } });
      const skip2 = await as(f.S1)('POST', `/api/war/stages/${stageDongBoDau}/skip`);
      expect(skip2.body.rewards).toEqual({ binh_thu: 0, gold: 0 });
    });

    test('thua trận: hết số lượt hoặc hết quân; thua không nhận thưởng nhưng vẫn ghi lượt thử', async () => {
      const strong = await cardId('tran-thanh-tong');
      await give(f.S2.id, 'tran-thanh-tong', 1, 1);
      await learnToBattle(f.S2.id, campaigns[2].id, 'bach-dang'); // học tới nút trận Bạch Đằng thì màn mới mở
      const start: any = (await as(f.S2)('POST', `/api/war/stages/${stageBachDang}/start`, { front: [strong] })).body;
      const end = await playOut(f.S2, start.id);
      expect(end.status).toBe('lost');
      expect(end.result).toMatchObject({ won: false, stars: 0 });
      expect(end.result.rewards.gold).toBe(0);
      expect((await db.query<{ attempts: number; clears: number }>('SELECT attempts, clears FROM hk_stage_progress WHERE user_id = $1 AND stage_id = $2', [f.S2.id, stageBachDang]))[0]).toEqual({ attempts: 1, clears: 0 });
      expect((await as(f.S2)('GET', `/api/war/stages/${stageBachDang}/truth`)).status).toBe(200); // đã chơi thì xem được sự thật lịch sử
    });

    test('HK.HS.124: chi tiết nút trận đánh trong lộ trình trả mã màn chơi để hiện nút "Ra trận"; nút chưa mở thì không lộ', async () => {
      const nodes = await db.query<{ id: number }>("SELECT n.id FROM hk_nodes n JOIN hk_journeys j ON j.id = n.journey_id JOIN hist_battles b ON b.id = n.battle_id WHERE j.campaign_id = $1 AND j.is_default AND n.kind = 'battle' AND b.slug = 'bach-dang'", [campaigns[2].id]);
      const open = (await as(f.S2)('GET', `/api/play/nodes/${nodes[0].id}`)).body;
      expect(open.stage_id).toBe(stageBachDang);
      // "Ra trận" đưa học sinh tới đúng điểm trận đánh trên bản đồ hành quân của cuộc kháng chiến đó
      const point = (await db.query<{ id: number }>("SELECT p.id FROM hk_march_points p JOIN hk_march_maps m ON m.id = p.map_id WHERE m.campaign_id = $1 AND p.kind = 'battle' AND (p.payload->>'stage_id')::int = $2", [campaigns[2].id, stageBachDang]))[0];
      expect(point).toBeDefined();
      expect(open.march).toEqual({ campaign_id: campaigns[2].id, point_id: point.id });
      // bản đồ hành quân đưa chính điểm đó ra với trạng thái đúng để màn hình tô nổi
      const onMap = (await as(f.S2)('GET', `/api/war/march/${campaigns[2].id}`)).body.points.find((p: any) => p.id === point.id);
      expect(onMap).toMatchObject({ kind: 'battle', stage_id: stageBachDang });
      // cuộc kháng chiến lần II em S2 chưa học tới: nút trận đánh còn khóa nên không lộ mã màn chơi
      const lockedNodes = await db.query<{ id: number }>("SELECT n.id FROM hk_nodes n JOIN hk_journeys j ON j.id = n.journey_id WHERE j.campaign_id = $1 AND j.is_default AND n.kind = 'battle' ORDER BY n.position LIMIT 1", [campaigns[1].id]);
      const locked = (await as(f.S2)('GET', `/api/play/nodes/${lockedNodes[0].id}`)).body;
      expect(locked.can_start).toBe(false);
      expect(locked.stage_id).toBeNull();
      expect(locked.march).toBeNull();
      // màn không có điểm trên bản đồ (hoặc bản đồ chưa phát hành) thì chỉ có mã màn chơi, không có điểm để tới
      await db.query("UPDATE hk_march_maps SET status = 'draft' WHERE campaign_id = $1", [campaigns[2].id]);
      try {
        const noMap = (await as(f.S2)('GET', `/api/play/nodes/${nodes[0].id}`)).body;
        expect(noMap).toMatchObject({ stage_id: stageBachDang, march: null });
      } finally {
        await db.query("UPDATE hk_march_maps SET status = 'published' WHERE campaign_id = $1", [campaigns[2].id]);
      }
    });
  });

  // ------------------------------------------------------------------ HK.HS.053: quyết sách trước trận tạo lợi thế; HK.SYS.022: phát lại trận
  describe('quyết sách trước trận và phát lại trận', () => {
    let scenarioId: number;
    const introOf = async (who: { token: string }) => (await as(who)('GET', `/api/war/stages/${stageDongBoDau}`)).body;
    const startWith = (who: { token: string }, body: Record<string, unknown>) => as(who)('POST', `/api/war/stages/${stageDongBoDau}/start`, { slot: 1, restart: true, ...body });
    const runDone = async (userId: number, percent: number, hoursAgo = 0) => (await db.query<{ id: number }>(
      `INSERT INTO hk_game_runs (user_id, kind, scenario_id, mode, status, snapshot, finished_at, percent, score, max_score)
       VALUES ($1, 'battle', $2, 'play', 'done', '{}'::jsonb, now() - ($3 || ' hours')::interval, $4, $5, 100) RETURNING id::int AS id`, [userId, scenarioId, String(hoursAgo), percent, percent]))[0].id;
    const atkOf = (v: any): number[] => v.units.filter((u: any) => u.side === 'ally').map((u: any) => u.atk);
    const defOf = (v: any): number[] => v.units.filter((u: any) => u.side === 'ally').map((u: any) => u.def);

    beforeAll(async () => {
      scenarioId = (await db.query<{ id: number }>("UPDATE hk_scenarios SET status = 'published' WHERE battle_id = (SELECT id FROM hist_battles WHERE slug = 'dong-bo-dau') RETURNING id"))[0].id;
    });

    test('giới thiệu màn có bước quyết sách; chưa làm thì chưa có lợi thế và không dùng được; giáo viên không thấy', async () => {
      const intro = await introOf(f.S1);
      expect(intro.decision).toMatchObject({ scenario_id: scenarioId, hours: 12, ready: null });
      expect(Array.isArray(intro.recent)).toBe(true); // trận đã đánh ở các bài trước đều có nhật ký phát lại
      expect((await startWith(f.S1, { use_decision: true })).status).toBe(409);
      expect((await introOf(f.T1)).decision).toBeNull();
    });

    test('quyết sách tốt tăng công và thủ của cả đội, dùng cho một trận; đánh lại từ đầu thì được dùng lại', async () => {
      const base: any = (await startWith(f.S1, {})).body;
      expect(base.advantage).toBeNull();
      const good = await runDone(f.S1.id, 100);
      expect((await introOf(f.S1)).decision.ready).toEqual({ run_id: good, percent: 100, modifier_pct: 15 });
      const boosted: any = (await startWith(f.S1, { use_decision: true })).body;
      expect(boosted.advantage).toEqual({ percent: 100, modifier_pct: 15 });
      atkOf(boosted).forEach((v, i) => { expect(v).toBeGreaterThan(atkOf(base)[i]); expect(Math.abs(v - atkOf(base)[i] * 1.15)).toBeLessThanOrEqual(2); });
      defOf(boosted).forEach((v, i) => expect(v).toBeGreaterThan(defOf(base)[i]));
      // đã gắn vào trận đang chơi nên chưa dùng lại được cho trận khác
      expect((await introOf(f.S1)).decision.ready).toBeNull();
      expect((await as(f.S1)('GET', `/api/war/battles/${boosted.id}`)).body.advantage).toEqual({ percent: 100, modifier_pct: 15 });
      // đánh lại từ đầu (bỏ trận dở) thì kết quả quyết sách chưa bị tính là đã dùng
      const again: any = (await startWith(f.S1, {})).body;
      expect(again.advantage).toBeNull();
      expect((await introOf(f.S1)).decision.ready).toMatchObject({ run_id: good, modifier_pct: 15 });
      // trận đã kết thúc vẫn tính là đã dùng
      expect((await startWith(f.S1, { use_decision: true })).status).toBe(200);
      await db.query("UPDATE hk_war_battles SET status = 'lost', finished_at = now() WHERE user_id = $1 AND status = 'active'", [f.S1.id]);
      expect((await introOf(f.S1)).decision.ready).toBeNull();
      expect((await startWith(f.S1, { use_decision: true })).status).toBe(409);
    });

    test('quyết sách kém làm yếu quân; kết quả quá 12 giờ hết hiệu lực; học sinh khác không dùng được kết quả của bạn', async () => {
      const base: any = (await startWith(f.S1, {})).body;
      await runDone(f.S1.id, 0);
      expect((await introOf(f.S1)).decision.ready).toMatchObject({ percent: 0, modifier_pct: -15 });
      const weak: any = (await startWith(f.S1, { use_decision: true })).body;
      expect(weak.advantage).toEqual({ percent: 0, modifier_pct: -15 });
      atkOf(weak).forEach((v, i) => expect(v).toBeLessThan(atkOf(base)[i]));
      await db.query("UPDATE hk_war_battles SET status = 'lost', finished_at = now() WHERE user_id = $1 AND status = 'active'", [f.S1.id]);
      await runDone(f.S1.id, 100, 13);
      expect((await introOf(f.S1)).decision.ready).toBeNull();
      expect((await startWith(f.S1, { use_decision: true })).status).toBe(409);
      expect((await introOf(f.S2)).decision.ready).toBeNull();
      expect((await startWith(f.S2, { use_decision: true })).status).toBe(409);
    });

    test('phát lại trận: khung đầu là lúc bắt đầu, mỗi hành động thêm một khung, khung cuối khớp kết quả; chỉ người chơi xem được và phải đánh xong', async () => {
      const pv: any = (await as(f.T1)('POST', `/api/war/stages/${stageDongBoDau}/preview`, {})).body;
      expect((await as(f.T1)('GET', `/api/war/battles/${pv.id}/replay`)).status).toBe(409); // đang đánh dở
      const end = await playOut(f.T1, pv.id);
      expect(['won', 'lost']).toContain(end.status);
      const rp: any = (await as(f.T1)('GET', `/api/war/battles/${pv.id}/replay`)).body;
      expect(rp).toMatchObject({ id: pv.id, mode: 'preview', status: end.status, note: null, advantage: null });
      expect(rp.frames.length).toBeGreaterThan(2);
      expect(rp.frames[0]).toMatchObject({ n: 0, label: 'Bắt đầu trận', status: 'active', turn: 1 });
      expect(rp.frames.map((x: any) => x.n)).toEqual(rp.frames.map((_: unknown, i: number) => i));
      expect(rp.frames.at(-1).status).toBe(end.status);
      expect(rp.frames[0].units[0]).toHaveLength(7);
      expect(rp.frames.flatMap((x: any) => x.log).some((l: any) => l.kind === 'end')).toBe(true);
      const finalHp = Object.fromEntries(rp.frames.at(-1).units.map((u: any[]) => [u[0], u[3]]));
      for (const u of end.units) expect(finalHp[u.id]).toBe(u.hp);
      expect(rp.frames.slice(1).every((x: any) => typeof x.label === 'string' && x.label.length > 0)).toBe(true);
      expect((await as(f.S1)('GET', `/api/war/battles/${pv.id}/replay`)).status).toBe(404); // trận của người khác
    });

    test('trận thật của học sinh: có nhật ký phát lại và hiện trong "trận gần đây" của màn', async () => {
      const start: any = (await startWith(f.S1, {})).body;
      await playOut(f.S1, start.id);
      const rp: any = (await as(f.S1)('GET', `/api/war/battles/${start.id}/replay`)).body;
      expect(rp.mode).toBe('play');
      expect(rp.frames.length).toBeGreaterThan(3); // mỗi bước tự động đánh là một khung
      expect(rp.frames.slice(1).some((x: any) => /Tự động đánh/.test(x.label))).toBe(true);
      const recent = (await introOf(f.S1)).recent;
      expect(recent[0]).toMatchObject({ id: start.id });
      expect(recent.length).toBeLessThanOrEqual(3);
    });

    test('HK.HS.069: bộ sưu tập kèm cuộc kháng chiến của từng thẻ để lọc; chỉ liệt kê cuộc kháng chiến có thẻ', async () => {
      const col = (await as(f.S2)('GET', '/api/war/cards')).body;
      expect(col.campaigns.length).toBeGreaterThanOrEqual(1);
      expect(col.cards.every((c: any) => Array.isArray(c.campaign_ids))).toBe(true);
      for (const camp of col.campaigns) expect(col.cards.some((c: any) => c.campaign_ids.includes(camp.id))).toBe(true);
      const hungDao = col.cards.find((c: any) => c.code === 'tran-hung-dao');
      expect(hungDao.campaign_ids.length).toBeGreaterThanOrEqual(1);
      const tactic = col.cards.find((c: any) => c.kind === 'tactic');
      expect(tactic.campaign_ids).toEqual([]); // thẻ chiến thuật không gắn nhân vật
    });

    test('HK.HS.033: hồ sơ trận đánh có đường vào màn thẻ tướng, mô phỏng quyết định và mini-game cùng cuộc kháng chiến', async () => {
      await db.query("UPDATE hk_minigames SET status = 'published'");
      const battleId = (await db.query<{ id: number }>("SELECT id FROM hist_battles WHERE slug = 'dong-bo-dau'"))[0].id;
      const d = (await as(f.S1)('GET', `/api/learn/battles/${battleId}`)).body;
      expect(d.play.stage).toEqual({ id: stageDongBoDau, title: expect.any(String) });
      expect(d.play.scenario).toEqual({ id: scenarioId, title: expect.any(String) });
      expect(d.play.minigames.length).toBeGreaterThanOrEqual(1);
      expect(d.play.minigames.every((m: any) => ['match', 'timeline', 'crossword'].includes(m.kind))).toBe(true);
      // bản nháp thì không hiện
      await db.query("UPDATE hk_scenarios SET status = 'draft' WHERE id = $1", [scenarioId]);
      expect((await as(f.S1)('GET', `/api/learn/battles/${battleId}`)).body.play.scenario).toBeNull();
      await db.query("UPDATE hk_scenarios SET status = 'published' WHERE id = $1", [scenarioId]);
    });

    test('trận cũ chưa có nhật ký phát lại: trả danh sách khung rỗng kèm ghi chú, không lỗi', async () => {
      const old: any = (await startWith(f.S1, {})).body;
      await db.query("UPDATE hk_war_battles SET state = state - 'replay', status = 'lost', finished_at = now() WHERE id = $1", [old.id]);
      const rp: any = (await as(f.S1)('GET', `/api/war/battles/${old.id}/replay`)).body;
      expect(rp.frames).toEqual([]);
      expect(rp.note).toMatch(/trước khi hệ thống ghi/);
    });
  });

  // ------------------------------------------------------------------ HK.QT.056: bật/tắt và giờ chơi
  describe('kiểm soát giờ chơi', () => {
    const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

    test('nhà trường tắt game, giới hạn khối lớp và thời gian chơi mỗi ngày; giá trị chặt hơn thắng; học bài vẫn bình thường', async () => {
      const me = async () => (await as(f.S1)('GET', '/api/war/status')).body;
      expect(await me()).toMatchObject({ open: true, limit_minutes: null });
      const off = await as(f.A)('PUT', '/api/war/school-war', { war_enabled: false });
      expect(off.body.war_enabled).toBe(false);
      expect(await me()).toMatchObject({ open: false, reason: expect.stringMatching(/Nhà trường đang tắt/) });
      const blocked = await as(f.S1)('POST', '/api/war/march/move', { point_id: 1 });
      expect(blocked.status).toBe(403);
      expect(blocked.body.detail).toMatch(/Nhà trường đang tắt/);
      expect((await as(f.S1)('GET', '/api/play/path')).status).toBe(200); // việc học không bị chặn
      await as(f.A)('PUT', '/api/war/school-war', { war_enabled: true, war_grades: [8, 9] });
      expect((await me()).reason).toMatch(/khối 8, 9/);
      await as(f.A)('PUT', '/api/war/school-war', { war_grades: [] });
      // thời gian chơi mỗi ngày: nhà trường 10 phút, hệ thống 30 phút → lấy 10 phút
      const set = await as(f.A)('PUT', '/api/war/school-war', { war_minutes: 10 });
      expect(set.body.war_minutes).toBe(10);
      await root('PUT', '/api/game/admin/settings', { war: { daily_minutes: 30 } });
      expect(await me()).toMatchObject({ open: true, limit_minutes: 10 });
      await db.query('INSERT INTO hk_war_play (user_id, day, seconds) VALUES ($1, $2, 601) ON CONFLICT (user_id, day) DO UPDATE SET seconds = 601', [f.S1.id, today()]);
      const full = await me();
      expect(full).toMatchObject({ open: false, limit_minutes: 10 });
      expect(full.reason).toMatch(/đã chơi đủ thời gian/);
      expect((await as(f.S1)('POST', `/api/war/stages/${stageDongBoDau}/start`, { slot: 1 })).status).toBe(403);
      await db.query('DELETE FROM hk_war_play WHERE user_id = $1', [f.S1.id]); // sang ngày mới
      expect((await me()).open).toBe(true);
      // khung giờ: đặt khung giờ không chứa lúc này
      const vn = new Date(Date.now() + 7 * 3600_000);
      const hour = vn.getUTCHours();
      const away = (h: number) => `${String((hour + h + 24) % 24).padStart(2, '0')}:00`;
      await as(f.A)('PUT', '/api/war/school-war', { war_minutes: null, war_from: away(2), war_to: away(4) });
      expect((await me()).reason).toMatch(/chỉ mở từ/);
      expect((await as(f.A)('PUT', '/api/war/school-war', { war_from: away(-2), war_to: away(2) })).status).toBe(200); // khung giờ có thể qua nửa đêm
      expect((await me()).open).toBe(true);
      await as(f.A)('PUT', '/api/war/school-war', { war_from: null, war_to: null });
      // công tắc toàn hệ thống
      await root('PUT', '/api/game/admin/settings', { war: { enabled: false } });
      expect(await me()).toMatchObject({ open: false, reason: expect.stringMatching(/toàn hệ thống/) });
      await root('PUT', '/api/game/admin/settings', { war: { enabled: true, daily_minutes: 0 } });
      expect((await me()).open).toBe(true);
    });

    test('đặt cấu hình sai bị từ chối; giáo viên không đặt được; mỗi lượt đánh ghi thời gian chơi', async () => {
      expect((await as(f.A)('PUT', '/api/war/school-war', { war_grades: [3] })).status).toBe(400);
      expect((await as(f.A)('PUT', '/api/war/school-war', { war_from: '9h', war_to: '10:00' })).status).toBe(400);
      expect((await as(f.A)('PUT', '/api/war/school-war', { war_from: '07:00', war_to: null })).status).toBe(400);
      expect((await as(f.A)('PUT', '/api/war/school-war', { war_minutes: 2 })).status).toBe(400);
      expect((await as(f.T1)('PUT', '/api/war/school-war', { war_enabled: false })).status).toBe(403);
      const start: any = (await as(f.S1)('POST', `/api/war/stages/${stageDongBoDau}/start`, { slot: 1, restart: true })).body;
      await as(f.S1)('POST', `/api/war/battles/${start.id}/act`, { type: 'guard' });
      expect(Number((await db.query<{ s: string }>('SELECT COALESCE(sum(seconds), 0) AS s FROM hk_war_play WHERE user_id = $1', [f.S1.id]))[0].s)).toBeGreaterThanOrEqual(5);
    });
  });

  // ------------------------------------------------------------------ giáo viên chơi thử
  test('giáo viên chơi thử màn chơi: không ghi tiến độ, điểm hay thưởng', async () => {
    const run: any = (await as(f.T1)('POST', `/api/war/stages/${stageDongBoDau}/preview`)).body;
    expect(run.mode).toBe('preview');
    expect(run.units.filter((u: any) => u.side === 'ally')).toHaveLength(5);
    const end = await playOut(f.T1, run.id);
    expect(['won', 'lost']).toContain(end.status);
    expect(end.result.preview).toBe(true);
    expect((await db.query('SELECT 1 FROM hk_stage_progress WHERE user_id = $1', [f.T1.id])).length).toBe(0);
    expect((await db.query('SELECT 1 FROM hk_gold_ledger WHERE user_id = $1', [f.T1.id])).length).toBe(0);
    expect((await as(f.S1)('POST', `/api/war/stages/${stageDongBoDau}/preview`)).status).toBe(403); // học sinh không dùng đường chơi thử
    expect((await as(f.T1)('GET', `/api/war/stages/${stageDongBoDau}/truth`)).status).toBe(200);
  });

  // ------------------------------------------------------------------ quản trị (HK.AD.048, 081–086)
  describe('quản trị', () => {
    test('thẻ tướng nâng cao: chỉ số, binh chủng, mảnh, thẻ chiến thuật; chiêu thức kiểm tra từng trường', async () => {
      const id = await cardId('tran-thanh-tong');
      expect((await as(f.A)('GET', '/api/war/admin/cards')).status).toBe(200);
      expect((await root('GET', '/api/war/admin/cards')).body).toHaveLength(17);
      expect((await root('PUT', `/api/war/admin/cards/${id}`, { branch: 'khong' })).status).toBe(400);
      expect((await root('PUT', `/api/war/admin/cards/${id}`, { base_stats: { atk: 5000 } })).status).toBe(400);
      expect((await root('PUT', `/api/war/admin/cards/${id}`, { fragments_needed: 99 })).status).toBe(400);
      const ok = await root('PUT', `/api/war/admin/cards/${id}`, { branch: 'ky', base_stats: { atk: 111 }, fragments_needed: 4, source_text: 'Phần thưởng thử' });
      expect(ok.body).toMatchObject({ branch: 'ky', fragments_needed: 4, base_stats: { atk: 111, def: 80, hp: 950, spd: 9 } });
      expect((await root('PUT', `/api/war/admin/cards/${id}`, { kind: 'tactic' })).status).toBe(400); // thẻ chiến thuật cần hiệu ứng
      expect((await root('PUT', `/api/war/admin/cards/${id}`, { kind: 'tactic', tactic: { effect: 'atk_up', value: 5 } })).status).toBe(400);
      const move = (body: unknown) => root('PUT', `/api/war/admin/cards/${id}/moves/active`, body);
      expect((await move({ name: 'x' })).status).toBe(400);
      expect((await move({ name: 'Chiêu thử', target: 'mọi người' })).status).toBe(400);
      expect((await move({ name: 'Chiêu thử', power: 9 })).status).toBe(400);
      expect((await move({ name: 'Chiêu thử', effect: { type: 'nổ' } })).status).toBe(400);
      expect((await root('PUT', `/api/war/admin/cards/${id}/moves/bay`, { name: 'Chiêu thử' })).status).toBe(400);
      const saved = await move({ name: 'Chiêu thử nghiệm', description: 'Mô tả', anecdote: 'Giai thoại', target: 'enemy_all', power: 1.2, effect: { type: 'stun', turns: 1 }, rage_cost: 40, cooldown: 2 });
      expect(saved.body.moves.find((m: any) => m.slot === 'active')).toMatchObject({ name: 'Chiêu thử nghiệm', power: 1.2, effect: { type: 'stun', value: 0, turns: 1 } });
      expect((await root('DELETE', `/api/war/admin/cards/${id}/moves/active`)).body.moves.some((m: any) => m.slot === 'active')).toBe(false);
      // độ hiếm Sử thi chọn được ở danh mục thẻ chung
      const epic = await root('PUT', `/api/game/admin/cards/${id}`, { rarity: 'epic' });
      expect(epic.body.rarity).toBe('epic');
      await root('PUT', `/api/game/admin/cards/${id}`, { rarity: 'common' });
    });

    test('bản đồ hành quân: bố cục kiểm tra chặt (một điểm xuất phát, liên thông, tham chiếu tồn tại); phát hành cần màn chơi đã phát hành', async () => {
      const m = (await root('GET', '/api/war/admin/maps')).body[0];
      const full = (await root('GET', `/api/war/admin/maps/${m.id}`)).body;
      expect(full.points).toHaveLength(6);
      expect(full.problems).toEqual([]);
      const pts = (extra: Array<Record<string, unknown>> = []) => [...full.points.map((p: any) => ({ code: p.code, name: p.name, description: p.description, x: p.x, y: p.y, kind: p.kind, payload: p.payload })), ...extra];
      const edges = full.edges.map((e: any) => ({ from: e.from_code, to: e.to_code }));
      const put = (body: unknown) => root('PUT', `/api/war/admin/maps/${m.id}/layout`, body);
      expect((await put({ points: [], edges: [] })).status).toBe(400);
      expect((await put({ points: pts([{ code: 'moi', name: 'Điểm mới', x: 10, y: 10, kind: 'start', payload: {} }]), edges })).status).toBe(400); // hai điểm xuất phát
      expect((await put({ points: pts([{ code: 'moi', name: 'Điểm mới', x: 150, y: 10, kind: 'story', payload: {} }]), edges })).status).toBe(400); // ngoài bản đồ
      expect((await put({ points: pts([{ code: 'moi', name: 'Điểm mới', x: 10, y: 10, kind: 'story', payload: {} }]), edges })).status).toBe(422); // không nối được tới điểm xuất phát
      expect((await put({ points: pts([{ code: 'the', name: 'Điểm thẻ', x: 10, y: 10, kind: 'card', payload: { card_code: 'khong-co' } }]), edges: [...edges, { from: 'thang-long', to: 'the' }] })).status).toBe(400);
      expect((await put({ points: pts([{ code: 'moi', name: 'Điểm mới', x: 10, y: 10, kind: 'story', payload: {} }]), edges: [...edges, { from: 'thang-long', to: 'moi' }] })).status).toBe(200);
      const withNew = (await root('GET', `/api/war/admin/maps/${m.id}`)).body;
      expect(withNew.points).toHaveLength(7);
      expect(withNew.problems.join(' ')).toMatch(/Điểm mới.*chưa có hội thoại/); // điểm hội thoại cần có hội thoại đã phát hành
      // gỡ điểm mới (tiến độ học sinh ở các điểm khác giữ nguyên)
      expect((await put({ points: pts(), edges })).body.points).toHaveLength(6);
      expect((await root('POST', `/api/war/admin/maps/${m.id}/status`, { status: 'draft' })).body.status).toBe('draft');
      expect((await as(f.S1)('GET', `/api/war/march/${campaigns[0].id}`)).status).toBe(404); // bản nháp học sinh không thấy
      await root('POST', `/api/war/admin/stages/${stageDongBoDau}/status`, { status: 'draft' });
      const blocked = await root('POST', `/api/war/admin/maps/${m.id}/status`, { status: 'published' });
      expect(blocked.status).toBe(409);
      expect(blocked.body.detail).toMatch(/màn chơi trận đánh chưa phát hành/);
      await root('POST', `/api/war/admin/stages/${stageDongBoDau}/status`, { status: 'published' });
      expect((await root('POST', `/api/war/admin/maps/${m.id}/status`, { status: 'published' })).body.status).toBe('published');
      expect((await root('DELETE', `/api/war/admin/maps/${m.id}`)).status).toBe(409); // đã có học sinh hành quân
    });

    test('hội thoại: kiểm tra lời thoại; phát hành cần tư liệu nguồn đã công bố; sửa bản đã phát hành thì về bản nháp', async () => {
      const lines = [{ speaker: 'Trần Hưng Đạo', text: 'Bệ hạ chém đầu thần trước rồi hãy hàng.' }];
      expect((await root('POST', '/api/war/admin/dialogs', { title: 'x', lines })).status).toBe(400);
      expect((await root('POST', '/api/war/admin/dialogs', { title: 'Hội thoại thử', lines: [] })).status).toBe(400);
      expect((await root('POST', '/api/war/admin/dialogs', { title: 'Hội thoại thử', lines: [{ speaker: '', text: 'a' }] })).status).toBe(400);
      expect((await root('POST', '/api/war/admin/dialogs', { title: 'Hội thoại thử', lines, point_id: (await db.query<{ id: number }>("SELECT id FROM hk_march_points WHERE kind = 'quiz' LIMIT 1"))[0].id })).status).toBe(400); // chỉ gắn với điểm hội thoại
      const d = (await root('POST', '/api/war/admin/dialogs', { title: 'Hội thoại thử', lines })).body;
      expect(d.status).toBe('draft');
      const noSource = await root('POST', `/api/war/admin/dialogs/${d.id}/status`, { status: 'published' });
      expect(noSource.status).toBe(409);
      expect(noSource.body.detail).toMatch(/tư liệu nguồn/);
      const draftSource = (await db.query<{ id: number }>("INSERT INTO hist_sources (slug, title, kind) VALUES ('nguon-nhap', 'Nguồn nháp', 'su_lieu') RETURNING id"))[0].id;
      await root('PUT', `/api/war/admin/dialogs/${d.id}`, { source_ids: [draftSource] });
      expect((await root('POST', `/api/war/admin/dialogs/${d.id}/status`, { status: 'published' })).status).toBe(409); // nguồn chưa công bố
      await root('PUT', `/api/war/admin/dialogs/${d.id}`, { source_ids: [sourceId] });
      expect((await root('POST', `/api/war/admin/dialogs/${d.id}/status`, { status: 'published' })).body.status).toBe('published');
      expect((await root('PUT', `/api/war/admin/dialogs/${d.id}`, { title: 'Hội thoại thử (sửa)' })).body.status).toBe('draft');
      expect((await root('DELETE', `/api/war/admin/dialogs/${d.id}`)).status).toBe(204);
    });

    test('màn chơi: kiểm tra đợt quân, địa hình, thưởng; mỗi trận đánh một màn; cân bằng chỉ số bằng cách để máy tự đánh', async () => {
      const options = (await root('GET', '/api/war/admin/options')).body;
      expect(options.length).toBeGreaterThanOrEqual(6);
      const free = options.find((b: any) => !b.has_stage && b.status === 'published');
      const body = (over: Record<string, unknown> = {}) => ({ battle_id: free?.id ?? options[0].id, title: 'Màn thử', waves: [{ units: [{ name: 'Địch thử', hp: 300, atk: 50, def: 20, spd: 8 }] }], ...over });
      expect((await root('POST', '/api/war/admin/stages', body({ waves: [] }))).status).toBe(400);
      expect((await root('POST', '/api/war/admin/stages', body({ waves: [{ units: [{ name: 'Địch', hp: 10, atk: 50, def: 20, spd: 8 }] }] }))).status).toBe(400); // máu quá thấp
      expect((await root('POST', '/api/war/admin/stages', body({ terrain: { tide: { cycle: 99 } } }))).status).toBe(400);
      expect((await root('POST', '/api/war/admin/stages', body({ rewards: { fragments: [{ card_code: 'khong-co', qty: 1 }] } }))).status).toBe(400);
      expect((await root('POST', '/api/war/admin/stages', body({ battle_id: (await db.query<{ battle_id: number }>('SELECT battle_id FROM hk_stages LIMIT 1'))[0].battle_id }))).status).toBe(409); // trận đánh đã có màn
      if (free) {
        const created = await root('POST', '/api/war/admin/stages', body({ terrain: { hunger: { pct: 0.05 } }, rewards: { gold: 10, binh_thu: 2 } }));
        expect(created.status).toBe(201);
        expect(created.body.problems.join(' ')).toMatch(/Nên có một chỉ huy/);
        expect((await root('POST', `/api/war/admin/stages/${created.body.id}/status`, { status: 'published' })).body.status).toBe('published');
        expect((await root('DELETE', `/api/war/admin/stages/${created.body.id}`)).status).toBe(204);
      }
      // cân bằng: đội hình mẫu cấp 1 dễ thắng màn đầu và khó thắng màn Bạch Đằng; nâng cấp thì thắng được
      const lv1Easy = (await root('POST', `/api/war/admin/stages/${stageDongBoDau}/balance`, { level: 1, stars: 1, runs: 40 })).body;
      expect(lv1Easy).toMatchObject({ runs: 40, level: 1, stars: 1 });
      expect(lv1Easy.win_rate).toBeGreaterThanOrEqual(70);
      const lv1Hard = (await root('POST', `/api/war/admin/stages/${stageBachDang}/balance`, { level: 1, stars: 1, runs: 40 })).body;
      const lv10Hard = (await root('POST', `/api/war/admin/stages/${stageBachDang}/balance`, { level: 10, stars: 5, runs: 40 })).body;
      expect(lv1Hard.win_rate).toBeLessThan(lv1Easy.win_rate);
      expect(lv10Hard.win_rate).toBeGreaterThanOrEqual(80);
      expect((await root('POST', `/api/war/admin/stages/${stageBachDang}/balance`, { cards: [999999] })).status).toBe(400);
      expect((await as(f.S1)('POST', `/api/war/admin/stages/${stageBachDang}/balance`, {})).status).toBe(403);
    });

    test('chỉ huy đối phương và tài nguyên game: tạo/sửa/xóa, tài nguyên bắt buộc ghi nguồn và giấy phép', async () => {
      expect((await root('POST', '/api/war/admin/commanders', { code: 'Sai Ma', name: 'Tướng thử' })).status).toBe(400);
      const k = (await root('POST', '/api/war/admin/commanders', { code: 'tuong-thu', name: 'Tướng thử', role_text: 'Vai trò' })).body;
      expect((await root('POST', '/api/war/admin/commanders', { code: 'tuong-thu', name: 'Trùng' })).status).toBe(409);
      expect((await root('PUT', `/api/war/admin/commanders/${k.id}`, { status: 'published', outcome: 'Kết cục' })).body).toMatchObject({ status: 'published', outcome: 'Kết cục' });
      expect((await root('DELETE', `/api/war/admin/commanders/${k.id}`)).status).toBe(204);
      const asset = { kind: 'sprite', name: 'Lính Nguyên 4 hướng', url: 'https://example.com/linh.png', source: 'Wombo – AI Game Studio (acatovic/ai-game-studio)', license: 'MIT' };
      expect((await root('POST', '/api/war/admin/assets', { ...asset, license: '' })).status).toBe(400);
      expect((await root('POST', '/api/war/admin/assets', { ...asset, source: '' })).status).toBe(400);
      expect((await root('POST', '/api/war/admin/assets', { ...asset, url: 'http://example.com/a.png' })).status).toBe(400);
      expect((await root('POST', '/api/war/admin/assets', { ...asset, kind: 'video' })).status).toBe(400);
      const saved = (await root('POST', '/api/war/admin/assets', asset)).body;
      expect(saved).toMatchObject({ kind: 'sprite', license: 'MIT' });
      expect((await root('GET', '/api/war/admin/assets')).body.some((a: any) => a.id === saved.id)).toBe(true);
      expect((await root('DELETE', `/api/war/admin/assets/${saved.id}`)).status).toBe(204);
    });
  });
});
