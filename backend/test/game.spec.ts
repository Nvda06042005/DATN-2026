/**
 * Sprint 5, trò chơi hóa (HK.HS.011–014, 024, 047, 062–070, 073–078, HK.QT.044–046, HK.AD.048–054, 066, HK.SYS.001–006, 008):
 * nhân vật, điểm – cấp độ – vàng, tim, chuỗi ngày, nhiệm vụ, huy hiệu, thẻ, cửa hàng, quà, bảng xếp hạng, giải đấu tuần, sự kiện cấp trường, danh mục và cấu hình.
 * HTTP thật trên PostgreSQL tạm; thời gian được "tua" bằng GameClock (đồng hồ của trò chơi hóa), không đổi đồng hồ hệ thống.
 */
import { call, hasPostgres, Started, startApp } from './harness';
import { bootstrap, Fixture, flattenSeedJourneys, publish } from './fixture';
import type { DatabaseService } from '../src/database/database.service';
import type { GameClock } from '../src/game/clock';
import type { GameService } from '../src/game/game.service';
import type { GameJob } from '../src/game/game.job';

let s: Started, f: Fixture, db: DatabaseService, clock: GameClock, game: GameService, job: GameJob;
const DAY = 86_400_000;
const api = (method: string, path: string, body?: unknown, token = f.S1.token) => call(s.base, method, path, body, token);
const root = (method: string, path: string, body?: unknown) => api(method, path, body, f.root);
const keys = new Map<number, { qtype: string; data: any }>();

/** Đáp án đúng / sai tính từ dữ liệu gốc trong cơ sở dữ liệu (học sinh không có dữ liệu này) */
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

async function playAttempt(token: string, start: any, right: (index: number) => boolean = () => true) {
  let state = start;
  let last: any;
  for (let i = 0; i < state.total; i++) {
    if (state.waiting_next) state = (await api('POST', `/api/play/attempts/${state.id}/next`, undefined, token)).body;
    const q = state.current.question;
    last = (await api('POST', `/api/play/attempts/${state.id}/answer`, { question_id: q.id, answer: answerOf(q.id, right(i)) }, token)).body;
    if (last.finished) break;
    state = { ...state, waiting_next: true };
  }
  return last;
}

async function mapOf(token: string, campaignIndex = 0) {
  const home = (await api('GET', '/api/play/home', undefined, token)).body;
  return (await api('GET', `/api/play/campaigns/${home.campaigns[campaignIndex].id}/map`, undefined, token)).body;
}

async function doLesson(token: string, nodeId: number) {
  const lesson = (await api('GET', `/api/play/nodes/${nodeId}/lesson`, undefined, token)).body;
  await api('POST', `/api/play/nodes/${nodeId}/lesson/progress`, { read_percent: 100 }, token);
  return (await api('POST', `/api/play/nodes/${nodeId}/lesson/complete`, { answers: lesson.checks.map((c: any) => ({ question_id: c.id, answer: answerOf(c.id, true) })) }, token)).body;
}

const quizNode = async (token: string, nodeId: number, right?: (i: number) => boolean) => playAttempt(token, (await api('POST', `/api/play/nodes/${nodeId}/attempts`, undefined, token)).body, right);
const me = async (token = f.S1.token) => (await api('GET', '/api/game/me', undefined, token)).body;
const tx = <T>(run: (q: any) => Promise<T>) => db.tx(run as never) as Promise<T>;
const userRow = async (id: number) => (await db.query<any>('SELECT * FROM app_users WHERE id = $1', [id]))[0];

(hasPostgres() ? describe : describe.skip)('Sprint 5 – trò chơi hóa', () => {
  beforeAll(async () => {
    s = await startApp('game_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    clock = s.moduleRef.get((await import('../src/game/clock')).GameClock);
    game = s.moduleRef.get((await import('../src/game/game.service')).GameService);
    job = s.moduleRef.get((await import('../src/game/game.job')).GameJob);
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken, true);
    await flattenSeedJourneys(s.url);
    for (const entity of ['campaigns', 'places', 'figures', 'sources', 'terms', 'events', 'battles']) {
      for (const item of (await api('GET', `/api/admin/history/${entity}?limit=100`, undefined, f.root)).body.items) await publish(s.base, f.root, entity, item.id);
    }
    for (const l of (await api('GET', '/api/content/lessons', undefined, f.root)).body) await api('PATCH', `/api/content/lessons/${l.id}/status`, { status: 'published' }, f.root);
    for (const j of (await api('GET', '/api/content/journeys?store=system', undefined, f.root)).body) {
      await api('PATCH', `/api/content/journeys/${j.id}/status`, { status: 'published' }, f.root);
      await api('PATCH', `/api/content/journeys/${j.id}/default`, { value: true }, f.root);
    }
    for (const row of await db.query<{ id: number; qtype: string; data: any }>('SELECT id, qtype, data FROM hk_questions')) keys.set(row.id, row);
    expect((await root('PUT', '/api/game/admin/settings', { leaderboard_cache_seconds: 0 })).status).toBe(200);
  });
  afterAll(async () => { clock?.reset(); await s?.close(); });

  // ------------------------------------------------------------------ HK.HS.011–014
  test('HK.HS.011/013 tạo nhân vật (3 lớp) và thanh chỉ số: tim, điểm, cấp, vàng, chuỗi ngày', async () => {
    const hud = await me();
    expect(hud).toMatchObject({ has_character: false, xp: 0, gold: 0, hearts: { current: 5, max: 5, enabled: true }, streak: { current: 0, longest: 0 }, level: { level: 1, title: 'Lính mới', next_xp: 100 }, daily: { goal: 50, xp: 0, reached: false } });
    const classes = await api('GET', '/api/game/classes');
    expect(classes.body.map((c: any) => c.code)).toEqual(['tuong_quan', 'quan_su', 'luong_y']);
    expect(classes.body[0].stats).toMatchObject({ hp: 120 });
    expect(classes.body[1].skills.map((k: any) => k.code)).toEqual(['muu_ke', 'tran_do']);
    expect((await api('POST', '/api/game/character', { class_id: 99999 })).status).toBe(400);
    const chosen = await api('POST', '/api/game/character', { class_id: classes.body[1].id });
    expect(chosen.body).toMatchObject({ has_character: true, class: { code: 'quan_su', name: 'Quân sư' } });
    expect((await api('GET', '/api/game/me', undefined, f.T1.token)).status).toBe(403);
    expect((await call(s.base, 'GET', '/api/game/me')).status).toBe(401);
  });

  test('HK.HS.014 mục tiêu hằng ngày chỉ nhận 50 / 100 / 200 điểm', async () => {
    expect((await api('PUT', '/api/game/goal', { goal: 75 })).status).toBe(400);
    expect((await api('PUT', '/api/game/goal', { goal: 100 })).body.daily).toMatchObject({ goal: 100, selected: 100 });
    expect((await api('PUT', '/api/game/goal', { goal: 50 })).body.daily.goal).toBe(50);
  });

  test('HK.HS.012 ngoại hình: mặc định là đồ miễn phí, chỉ mặc được đồ đã sở hữu và đúng loại', async () => {
    const shop = await api('GET', '/api/game/shop');
    const item = (code: string) => shop.body.items.find((i: any) => i.code === code);
    expect((await me()).appearance).toMatchObject({ outfit: { name: 'Áo dân binh' }, weapon: { name: 'Gậy tre' }, banner: { name: 'Cờ Đông A' } });
    expect(item('giap-sat')).toMatchObject({ owned: false, price: 150 });
    expect(item('giap-da')).toMatchObject({ owned: false, locked: true, free_unlock: true });
    expect((await api('PUT', '/api/game/appearance', { outfit_id: item('giap-sat').id })).status).toBe(403); // chưa mua
    expect((await api('PUT', '/api/game/appearance', { outfit_id: item('kiem-sat').id })).status).toBe(400); // sai loại
    expect((await api('PUT', '/api/game/appearance', { weapon_id: item('gay-tre').id, banner_id: item('co-dong-a').id })).body.weapon.name).toBe('Gậy tre');
    expect((await api('POST', `/api/game/shop/${item('giap-sat').id}/buy`)).status).toBe(409); // chưa đủ vàng
    expect((await api('POST', `/api/game/shop/${item('ao-dan-binh').id}/buy`)).status).toBe(409); // đồ miễn phí không cần mua
  });

  // ------------------------------------------------------------------ HK.HS.062–064, 068, HK.SYS.001/008
  test('HK.HS.062/063 + SYS.001 hoàn thành nút cộng điểm và vàng, đạt mục tiêu ngày, lên cấp có thưởng và chúc mừng', async () => {
    const map = await mapOf(f.S1.token);
    const [lesson, quiz, battle, final] = map.nodes;
    const lessonDone = await doLesson(f.S1.token, lesson.id);
    expect(lessonDone.completed).toBe(true);
    let hud = await me();
    expect(hud).toMatchObject({ daily: { reached: true }, streak: { current: 1, longest: 1 }, level: { level: 1 } });
    expect(hud.xp).toBeGreaterThanOrEqual(50); // thưởng nút bài học (có thể kèm thưởng nhiệm vụ hằng ngày)
    expect(hud.gold).toBeGreaterThanOrEqual(10 + 5); // 10 vàng nút lần đầu + 5 vàng đạt mục tiêu ngày
    const quizDone = await quizNode(f.S1.token, quiz.id);
    expect(quizDone.summary.node_result.points_awarded).toBeGreaterThan(300);
    hud = await me();
    expect(hud.level.level).toBeGreaterThanOrEqual(3); // hơn 350 điểm: cấp 3 (250) trở lên
    const celebrations = (await api('GET', '/api/game/celebrations')).body;
    expect(celebrations.map((c: any) => c.kind)).toEqual(expect.arrayContaining(['goal', 'level_up']));
    expect(celebrations.find((c: any) => c.kind === 'level_up').payload).toMatchObject({ level: 2, title: 'Dân binh', reward_gold: 20 });
    await api('POST', '/api/game/celebrations/ack', { ids: celebrations.map((c: any) => c.id) });
    expect((await api('GET', '/api/game/celebrations')).body).toEqual([]);
    expect(hud.gold).toBeGreaterThanOrEqual(15 + 10 + 20 + 30); // vàng nút, thưởng cấp 2 và cấp 3
    // chơi lại không nhận thưởng lần hai
    const before = (await me()).xp;
    await quizNode(f.S1.token, quiz.id);
    expect((await me()).xp - before).toBeLessThanOrEqual(40);
    void battle; void final;
  });

  test('HK.HS.068/069 + SYS.008 hoàn thành trận đánh làm rơi thẻ theo độ hiếm; lật thẻ vào bộ sưu tập; thẻ trùng đổi lấy vàng', async () => {
    clock.random = () => 0.01; // Thường (tỉ lệ 70%), thẻ đầu tiên của độ hiếm đó
    const [, , battle] = (await mapOf(f.S1.token)).nodes;
    await quizNode(f.S1.token, battle.id);
    const drops = (await api('GET', '/api/game/drops')).body;
    expect(drops).toHaveLength(1);
    expect((await me()).pending_drops).toBe(1);
    expect((await api('POST', `/api/game/drops/${drops[0].id}/flip`, undefined, f.S2.token)).status).toBe(404); // thẻ của người khác
    const flipped = await api('POST', `/api/game/drops/${drops[0].id}/flip`);
    expect(flipped.body).toMatchObject({ duplicate: false, gold: 0, card: { rarity: 'common', owned: true, copies: 1 } });
    expect(flipped.body.card.figure).toMatchObject({ name: expect.any(String), biography: expect.any(String) }); // tiểu sử lấy từ kho lịch sử đã công bố
    expect((await api('POST', `/api/game/drops/${drops[0].id}/flip`)).status).toBe(409);
    const album = (await api('GET', '/api/game/cards')).body;
    expect(album).toMatchObject({ total: 17, owned: 1 }); // 13 thẻ tướng + 4 thẻ chiến thuật (migration 029)
    expect(album.cards.filter((c: any) => !c.owned).every((c: any) => c.name === null)).toBe(true); // thẻ chưa có chỉ lộ độ hiếm
    const owned = album.cards.find((c: any) => c.owned);
    expect((await api('GET', `/api/game/cards/${owned.id}`)).status).toBe(200);
    const locked = album.cards.find((c: any) => !c.owned);
    expect((await api('GET', `/api/game/cards/${locked.id}`)).status).toBe(403);

    // Thẻ trùng: nhận vàng thay thế
    const goldBefore = (await me()).gold;
    await tx((q) => game.dropCard(q, { id: f.S1.id, school_id: f.A.schoolId } as never, 'node', null));
    const again = (await api('GET', '/api/game/drops')).body[0];
    const dup = await api('POST', `/api/game/drops/${again.id}/flip`);
    expect(dup.body).toMatchObject({ duplicate: true, gold: 5 });
    expect((await me()).gold).toBe(goldBefore + 5);
    expect((await api('GET', '/api/game/cards')).body.cards.find((c: any) => c.owned).copies).toBe(2);
    clock.random = () => 0.999;
    await tx((q) => game.dropCard(q, { id: f.S1.id, school_id: f.A.schoolId } as never, 'node', null));
    const legendary = (await api('GET', '/api/game/drops')).body[0];
    expect((await api('POST', `/api/game/drops/${legendary.id}/flip`)).body.card.rarity).toBe('legendary');
    clock.random = Math.random;
  });

  test('HK.HS.066/067 + SYS.002 huy hiệu tự trao khi đạt điều kiện; bộ sưu tập hiện đã đạt / chưa đạt', async () => {
    const [, , , final] = (await mapOf(f.S1.token)).nodes;
    await quizNode(f.S1.token, final.id);
    const badges = (await api('GET', '/api/game/badges')).body;
    const byCode = Object.fromEntries(badges.map((b: any) => [b.code, b]));
    expect(byCode['lan-1-chien-thang']).toMatchObject({ earned: true, name: 'Chiến thắng Đông Bộ Đầu' });
    expect(byCode['diem-tuyet-doi'].earned).toBe(true);
    expect(byCode['hoc-gia'].earned).toBe(true); // hơn 1000 điểm
    expect(byCode['lan-2-chien-thang'].earned).toBe(false);
    expect(byCode['bay-ngay-lien-tiep']).toMatchObject({ earned: false, rule: { type: 'streak_days', value: 7 } });
    expect(badges[0].earned).toBe(true); // huy hiệu đã đạt xếp trước
    const kinds = (await api('GET', '/api/game/celebrations')).body.map((c: any) => c.kind);
    expect(kinds.filter((k: string) => k === 'badge').length).toBeGreaterThanOrEqual(3);
  });

  // ------------------------------------------------------------------ HK.HS.047, HK.SYS.004
  test('HK.HS.047 + SYS.004 mỗi câu sai mất 1 tim; hết tim không bắt đầu được bài ở nút, chờ hồi theo giờ hoặc luyện tập; xem trước không mất tim', async () => {
    const [lesson, quiz] = (await mapOf(f.S2.token)).nodes;
    await doLesson(f.S2.token, lesson.id);
    const a1 = await quizNode(f.S2.token, quiz.id, () => false); // 3 câu sai
    expect(a1.summary).toMatchObject({ passed: false, wrong: 3 });
    expect((await me(f.S2.token)).hearts).toMatchObject({ current: 2, max: 5, enabled: true });
    expect((await me(f.S2.token)).hearts.next_in_ms).toBeGreaterThan(3.9 * 3600_000);
    await quizNode(f.S2.token, quiz.id, (i) => i >= 2); // 2 câu sai, 1 đúng
    expect((await me(f.S2.token)).hearts.current).toBe(0);
    const blocked = await api('POST', `/api/play/nodes/${quiz.id}/attempts`, undefined, f.S2.token);
    expect(blocked.status).toBe(409);
    expect(blocked.body.detail).toContain('hết tim');
    // Luyện lại câu sai hồi tim
    const practice = await api('POST', '/api/play/practice/start', undefined, f.S2.token);
    expect(practice.status).toBe(200);
    await playAttempt(f.S2.token, practice.body);
    expect((await me(f.S2.token)).hearts.current).toBeGreaterThanOrEqual(1);
    // Hồi theo thời gian: 4 giờ một tim
    const before = (await me(f.S2.token)).hearts.current;
    clock.advance(4 * 3600_000 + 60_000);
    expect((await me(f.S2.token)).hearts.current).toBe(before + 1);
    clock.advance(40 * 3600_000);
    expect((await me(f.S2.token)).hearts).toMatchObject({ current: 5, next_in_ms: null });
    expect((await api('POST', `/api/play/nodes/${quiz.id}/attempts`, undefined, f.S2.token)).status).toBe(200);
  });

  test('HK.HS.047 giáo viên tắt tim theo lớp: không mất tim và không bị chặn; quản trị trường xem được mọi lớp', async () => {
    const [classes] = [(await api('GET', '/api/game/class-settings', undefined, f.T1.token)).body];
    expect(classes.map((c: any) => [c.name, c.hearts_enabled, c.students])).toEqual([['7A1', true, 2]]);
    expect((await api('PUT', `/api/game/class-settings/${f.class7b.id}`, { hearts_enabled: false }, f.T1.token)).status).toBe(404); // lớp của giáo viên khác
    expect((await api('PUT', `/api/game/class-settings/${f.class7a.id}`, { hearts_enabled: false }, f.S1.token)).status).toBe(403);
    expect((await api('PUT', `/api/game/class-settings/${f.class7a.id}`, { hearts_enabled: false }, f.T1.token)).body).toEqual({ class_id: f.class7a.id, hearts_enabled: false });
    expect((await me(f.S2.token)).hearts).toMatchObject({ enabled: false, current: 5 });
    const quiz = (await mapOf(f.S2.token)).nodes[1];
    await quizNode(f.S2.token, quiz.id, () => false);
    expect((await me(f.S2.token)).hearts.current).toBe(5);
    expect((await api('GET', '/api/game/class-settings', undefined, f.A.token)).body.map((c: any) => c.name)).toEqual(['7A1', '7A2']);
    await api('PUT', `/api/game/class-settings/${f.class7a.id}`, { hearts_enabled: true }, f.A.token);
    expect((await me(f.S2.token)).hearts.enabled).toBe(true);
  });

  // ------------------------------------------------------------------ HK.HS.070
  test('HK.HS.070 cửa hàng: mua bằng vàng, giới hạn đóng băng/gợi ý, hồi tim; gợi ý 50/50 loại đáp án sai do máy chủ chọn', async () => {
    const shop = (await api('GET', '/api/game/shop', undefined, f.S1.token)).body;
    const item = (code: string) => shop.items.find((i: any) => i.code === code);
    await tx((q) => game.addGold(q, { id: f.S1.id } as never, 1000, 'gift', 'test-fund'));
    expect((await api('POST', `/api/game/shop/${item('goi-y-50-50').id}/buy`)).body).toMatchObject({ item: 'Gợi ý 50/50' });
    expect((await me()).hints).toBe(1);
    expect((await api('POST', `/api/game/shop/${item('hoi-tim').id}/buy`)).status).toBe(409); // tim đã đầy
    expect((await api('POST', `/api/game/shop/${item('dong-bang-chuoi').id}/buy`)).status).toBe(200);
    expect((await api('POST', `/api/game/shop/${item('dong-bang-chuoi').id}/buy`)).status).toBe(200);
    expect((await api('POST', `/api/game/shop/${item('dong-bang-chuoi').id}/buy`)).status).toBe(409); // tối đa 2
    expect((await me()).streak.freezes).toBe(2);
    expect((await api('POST', `/api/game/shop/${item('chien-bao-do').id}/buy`)).status).toBe(200); // đã đủ cấp 5 và đủ vàng
    expect((await api('POST', `/api/game/shop/${item('chien-bao-do').id}/buy`)).status).toBe(409); // đã sở hữu
    expect((await api('PUT', '/api/game/appearance', { outfit_id: item('chien-bao-do').id })).body.outfit.name).toBe('Chiến bào đỏ Đông A');
  });

  // ------------------------------------------------------------------ HK.HS.064/065, HK.SYS.003
  const earn = async (id: number, xp: number, key: string) => { const u = await userRow(id); return tx((q) => game.awardXp(q, u, xp, 'node', key)); };

  test('HK.HS.064/065 + SYS.003 chuỗi ngày chỉ tăng khi đạt mục tiêu ngày; bỏ lỡ thì về 0, đóng băng giữ chuỗi; lịch chuỗi và chuỗi dài nhất; huy hiệu 7 ngày', async () => {
    await earn(f.S3.id, 50, 'streak-0');
    expect((await me(f.S3.token)).streak).toMatchObject({ current: 1, longest: 1, at_risk: false });
    await earn(f.S3.id, 10, 'streak-0b');
    expect((await me(f.S3.token)).streak.current).toBe(1); // cùng ngày không tăng thêm
    clock.advance(DAY);
    expect((await me(f.S3.token)).streak).toMatchObject({ current: 1, at_risk: true }); // chưa học hôm nay: chuỗi còn nhưng sắp mất
    await earn(f.S3.id, 50, 'streak-1');
    expect((await me(f.S3.token)).streak).toMatchObject({ current: 2, longest: 2, at_risk: false });
    clock.advance(2 * DAY); // bỏ lỡ một ngày, không có vật phẩm đóng băng
    expect((await me(f.S3.token)).streak).toMatchObject({ current: 0, longest: 2 });
    await earn(f.S3.id, 50, 'streak-3');
    expect((await me(f.S3.token)).streak).toMatchObject({ current: 1, longest: 2 });

    await tx((q) => game.addGold(q, { id: f.S3.id } as never, 500, 'gift', 'fund-s3'));
    const freeze = (await api('GET', '/api/game/shop', undefined, f.S3.token)).body.items.find((i: any) => i.code === 'dong-bang-chuoi');
    await api('POST', `/api/game/shop/${freeze.id}/buy`, undefined, f.S3.token);
    expect((await me(f.S3.token)).streak.freezes).toBe(1);
    clock.advance(2 * DAY); // bỏ lỡ một ngày, đóng băng giữ chuỗi
    expect((await me(f.S3.token)).streak).toMatchObject({ current: 1, freezes: 0 });
    await earn(f.S3.id, 50, 'streak-5');
    expect((await me(f.S3.token)).streak.current).toBe(2);

    for (let d = 6; d <= 10; d++) { clock.advance(DAY); await earn(f.S3.id, 50, `streak-${d}`); }
    expect((await me(f.S3.token)).streak).toMatchObject({ current: 7, longest: 7 });
    const badges = (await api('GET', '/api/game/badges', undefined, f.S3.token)).body;
    expect(badges.find((b: any) => b.code === 'bay-ngay-lien-tiep').earned).toBe(true);
    const calendar = (await api('GET', '/api/game/streak', undefined, f.S3.token)).body;
    expect(calendar).toMatchObject({ current: 7, longest: 7 });
    expect(calendar.days).toHaveLength(35);
    expect(calendar.days.filter((d: any) => d.reached).length).toBeGreaterThanOrEqual(7);
    expect(calendar.days[34]).toMatchObject({ today: true, reached: true });
  });

  test('HK.SYS.003 việc chạy nền bù chuỗi ngày cho người đã nghỉ lâu', async () => {
    clock.advance(10 * DAY);
    const result = await job.run();
    expect(result.streaks).toBeGreaterThanOrEqual(1);
    const today = clock.now().toISOString().slice(0, 10);
    expect((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM hk_players WHERE streak_current > 0 AND streak_last_day < $1::date - 2', [today]))[0].n).toBe(0);
    expect((await me(f.S3.token)).streak).toMatchObject({ current: 0, longest: 7 }); // chuỗi dài nhất được giữ lại
  });

  // ------------------------------------------------------------------ HK.HS.073
  test('HK.HS.073 quà hằng ngày tăng dần theo số ngày liên tiếp; bỏ lỡ thì về ngày 1; ngày 7 tặng thêm đóng băng chuỗi', async () => {
    const t = f.S2.token;
    const claim = () => api('POST', '/api/game/gift/claim', undefined, t);
    const first = await claim();
    expect(first.body).toMatchObject({ day: 1, gold: 10, streak: 1 });
    expect((await claim()).status).toBe(409); // một lần mỗi ngày
    expect((await api('GET', '/api/game/gift', undefined, t)).body).toMatchObject({ claimed_today: true, streak: 1 });
    clock.advance(DAY);
    expect((await claim()).body).toMatchObject({ day: 2, gold: 15 });
    clock.advance(2 * DAY);
    expect((await claim()).body).toMatchObject({ day: 1, gold: 10, streak: 1 }); // bỏ lỡ một ngày: bắt đầu lại
    const freezesBefore = (await me(t)).streak.freezes;
    let seventh: any;
    for (let d = 2; d <= 7; d++) { clock.advance(DAY); seventh = await claim(); }
    expect(seventh.body).toMatchObject({ day: 7, gold: 50, freeze: true });
    expect((await me(t)).streak.freezes).toBe(freezesBefore + 1);
    expect((await api('GET', '/api/game/gift', undefined, t)).body.days.map((d: any) => d.gold)).toEqual([10, 15, 20, 25, 30, 40, 50]);
    expect((await api('POST', '/api/game/gift/claim', undefined, f.T1.token)).status).toBe(403);
  });

  // ------------------------------------------------------------------ HK.HS.024, HK.AD.053
  test('HK.HS.024 nhiệm vụ hằng ngày / tuần giao theo mẫu, đổi mới theo ngày; hoàn thành thì thưởng điểm, vàng và chúc mừng, không thưởng lần hai', async () => {
    const t = f.S1.token;
    const quests = (await api('GET', '/api/game/quests', undefined, t)).body;
    expect(quests.daily).toHaveLength(3);
    expect(quests.weekly).toHaveLength(2);
    const again = (await api('GET', '/api/game/quests', undefined, t)).body;
    expect(again.daily.map((x: any) => x.id)).toEqual(quests.daily.map((x: any) => x.id)); // cùng ngày không đổi nhiệm vụ

    const fresh = quests.daily.find((x: any) => !x.completed_at && x.progress === 0) ?? quests.daily[0];
    const before = await me(t);
    await tx(async (q) => { await game.bumpQuests(q, await userRow(f.S1.id), fresh.metric, fresh.target); });
    const done = (await api('GET', '/api/game/quests', undefined, t)).body.daily.find((x: any) => x.id === fresh.id);
    expect(done.progress).toBe(fresh.target);
    expect(done.completed_at).toBeTruthy();
    const after = await me(t);
    if (!fresh.completed_at) {
      expect(after.gold - before.gold).toBeGreaterThanOrEqual(fresh.reward_gold);
      expect(after.xp - before.xp).toBeGreaterThanOrEqual(fresh.reward_xp);
      expect((await api('GET', '/api/game/celebrations', undefined, t)).body.some((c: any) => c.kind === 'quest' && c.payload.title === fresh.title)).toBe(true);
    }
    const xpNow = after.xp;
    await tx(async (q) => { await game.bumpQuests(q, await userRow(f.S1.id), fresh.metric, 5); });
    expect((await api('GET', '/api/game/quests', undefined, t)).body.daily.find((x: any) => x.id === fresh.id).progress).toBe(fresh.target); // không vượt mục tiêu
    expect((await me(t)).xp).toBe(xpNow); // không thưởng lần hai

    clock.advance(DAY);
    const next = (await api('GET', '/api/game/quests', undefined, t)).body;
    expect(next.daily).toHaveLength(3);
    expect(next.daily.every((x: any) => x.progress === 0 && !x.completed_at)).toBe(true);
    expect(next.daily.map((x: any) => x.id)).not.toEqual(quests.daily.map((x: any) => x.id));
    const [, quiz] = (await mapOf(t)).nodes;
    await quizNode(t, quiz.id); // chơi thật: câu đúng và nút hoàn thành làm tăng tiến độ
    const played = (await api('GET', '/api/game/quests', undefined, t)).body;
    const list = [...played.daily, ...played.weekly];
    expect(list.some((x: any) => x.progress > 0)).toBe(true);
  });

  // ------------------------------------------------------------------ HK.HS.074–076, HK.QT.044
  test('HK.HS.074/075 bảng xếp hạng lớp, trường, hệ thống; trường/hệ thống chỉ hiện biệt danh; nổi bật vị trí của em', async () => {
    await db.query("UPDATE app_users SET nickname = 'Hào Khí' WHERE id = $1", [f.S1.id]);
    const all = await api('GET', '/api/game/leaderboard?scope=class&period=all', undefined, f.S1.token);
    expect(all.body.entries.map((e: any) => [e.rank, e.name, e.me])).toEqual([[1, 'Em', true], [2, 'Hoàng Thị Hai', false]]);
    expect(all.body).toMatchObject({ label: 'Lớp 7A1', me: { rank: 1 } });
    expect((await api('GET', '/api/game/leaderboard?scope=class&period=all', undefined, f.S3.token)).status).toBe(403); // chưa vào lớp
    expect((await api('GET', `/api/game/leaderboard?scope=class&class_id=${f.class7b.id}`, undefined, f.S1.token)).status).toBe(403); // lớp không thuộc em

    await earn(f.S2.id, 30, 'board-s2');
    const week = await api('GET', '/api/game/leaderboard?scope=class&period=week', undefined, f.S2.token);
    const xps = week.body.entries.map((e: any) => e.xp);
    expect(xps).toEqual([...xps].sort((a: number, b: number) => b - a)); // xếp theo điểm giảm dần
    expect(week.body.entries.find((e: any) => e.me).xp).toBeGreaterThanOrEqual(30);
    expect(week.body.me.rank).toBe(1 + xps.filter((x: number) => x > week.body.me.xp).length);

    const school = await api('GET', '/api/game/leaderboard?scope=school', undefined, f.S2.token);
    expect(school.body.label).toBe('Toàn trường');
    expect(school.body.entries.map((e: any) => e.name)).toEqual(expect.arrayContaining(['Em']));
    expect(JSON.stringify(school.body)).not.toContain('Phạm Minh Một'); // không lộ họ tên thật
    const system = await api('GET', '/api/game/leaderboard?scope=system', undefined, f.S1.token);
    expect(system.body.label).toBe('Toàn hệ thống');
    expect(JSON.stringify(system.body)).not.toMatch(/Hoàng Thị Hai|Đỗ Văn Ba/);
    expect((await api('GET', '/api/game/leaderboard?scope=lop', undefined, f.S1.token)).status).toBe(422);
    expect((await api('GET', '/api/game/leaderboard?scope=class', undefined, f.T1.token)).status).toBe(403);
  });

  test('HK.QT.044 quản trị trường bật/tắt bảng xếp hạng, đổi phạm vi (khối / toàn trường) và chu kỳ (tuần / tháng)', async () => {
    expect((await api('GET', '/api/game/school-settings', undefined, f.A.token)).body).toEqual({ leaderboard_enabled: true, leaderboard_scope: 'school', leaderboard_period: 'week' });
    expect((await api('PUT', '/api/game/school-settings', { leaderboard_enabled: false }, f.T1.token)).status).toBe(403);
    expect((await api('PUT', '/api/game/school-settings', { leaderboard_scope: 'lop' }, f.A.token)).status).toBe(422);
    expect((await api('PUT', '/api/game/school-settings', { leaderboard_enabled: false }, f.A.token)).body.leaderboard_enabled).toBe(false);
    const blocked = await api('GET', '/api/game/leaderboard?scope=school', undefined, f.S1.token);
    expect(blocked.status).toBe(403);
    expect(blocked.body.detail).toContain('tắt bảng xếp hạng');
    expect((await api('GET', '/api/game/leaderboard?scope=system', undefined, f.S1.token)).status).toBe(403);
    expect((await api('GET', '/api/game/leaderboard?scope=class&period=all', undefined, f.S1.token)).status).toBe(200); // bảng lớp không phụ thuộc cấu hình trường
    await db.query('UPDATE app_users SET grade = 7 WHERE id = ANY($1)', [[f.S1.id, f.S2.id, f.S3.id]]);
    await api('PUT', '/api/game/school-settings', { leaderboard_enabled: true, leaderboard_scope: 'grade', leaderboard_period: 'month' }, f.A.token);
    const grade = await api('GET', '/api/game/leaderboard?scope=school', undefined, f.S1.token);
    expect(grade.body).toMatchObject({ label: 'Khối 7 của trường', period: 'month' });
    await api('PUT', '/api/game/school-settings', { leaderboard_scope: 'school', leaderboard_period: 'week' }, f.A.token);
    expect((await api('GET', `/api/game/school-settings?school_id=${f.B.schoolId}`, undefined, f.root)).body.leaderboard_enabled).toBe(true);
  });

  // ------------------------------------------------------------------ HK.HS.077, HK.SYS.006
  test('HK.HS.077 + SYS.006 giải đấu tuần: nhóm cùng hạng, top thăng hạng khi chốt tuần; mỗi tuần chỉ chốt một lần', async () => {
    await job.run(); // chốt các tuần đã qua trong lúc kiểm thử "tua" thời gian
    const first = (await api('GET', '/api/game/league', undefined, f.S1.token)).body;
    expect(first.saved_tier).toBeGreaterThanOrEqual(1); // S1 đứng đầu tuần đầu nên đã thăng hạng
    const celebrations = (await api('GET', '/api/game/celebrations', undefined, f.S1.token)).body.filter((c: any) => c.kind === 'league');
    expect(celebrations.some((c: any) => c.payload.result === 'promote')).toBe(true);
    const weeksBefore = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM hk_league_weeks'))[0].n;
    await job.run();
    expect((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM hk_league_weeks'))[0].n).toBe(weeksBefore);

    clock.advance(8 * DAY);
    await job.run();
    await earn(f.S2.id, 100, 'league-s2');
    await earn(f.S3.id, 10, 'league-s3');
    const league = (await api('GET', '/api/game/league', undefined, f.S2.token)).body;
    expect(league.entries[0]).toMatchObject({ rank: 1, me: true, name: 'Em' });
    expect(league.entries[0].xp).toBeGreaterThanOrEqual(100);
    const tierBefore = league.saved_tier;
    clock.advance(7 * DAY);
    const next = (await api('GET', '/api/game/league', undefined, f.S2.token)).body;
    expect(next.saved_tier).toBe(league.size >= 2 ? Math.min(3, tierBefore + 1) : tierBefore); // top nhóm thăng hạng khi chốt tuần
    expect(next.size).toBe(1); // tuần mới bắt đầu lại với điểm 0
  });

  // ------------------------------------------------------------------ HK.QT.046, HK.AD.049
  let schoolBadge: number;
  test('HK.QT.046 quản trị trường tạo huy hiệu riêng của trường; giáo viên trao cho học sinh trong lớp mình phụ trách', async () => {
    const made = await api('POST', '/api/game/admin/badges', { code: 'chuyen-can', name: 'Chuyên cần', description: 'Đi học đầy đủ', icon: 'award', color: '#58cc02' }, f.A.token);
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject({ scope: 'school', school_id: f.A.schoolId, rule: null, code: `s${f.A.schoolId}-chuyen-can` });
    schoolBadge = made.body.id;
    expect((await api('GET', '/api/game/admin/badges', undefined, f.A.token)).body.map((b: any) => b.code)).toEqual([`s${f.A.schoolId}-chuyen-can`]); // chỉ thấy huy hiệu của trường mình
    expect((await api('GET', '/api/game/admin/badges', undefined, f.B.token)).body).toEqual([]);
    expect((await api('PUT', `/api/game/admin/badges/${schoolBadge}`, { name: 'Chuyên cần (sửa)' }, f.B.token)).status).toBe(404);
    expect((await api('PUT', `/api/game/admin/badges/${schoolBadge}`, { name: 'Chuyên cần chăm chỉ', rule_type: 'level', rule_value: 3 }, f.A.token)).body).toMatchObject({ name: 'Chuyên cần chăm chỉ', rule: {type:'level',value:3} }); // huy hiệu trường luôn trao tay
    expect((await api('POST', '/api/game/admin/cards', { code: 'x-card', name: 'Thẻ lạ', rarity: 'rare', drop_weight: 5 }, f.A.token)).status).toBe(201);

    const award = await api('POST', `/api/game/badges/${schoolBadge}/award`, { user_ids: [f.S1.id, f.S2.id] }, f.T1.token);
    expect(award.body).toMatchObject({ awarded: 2, already: 0 });
    expect((await api('POST', `/api/game/badges/${schoolBadge}/award`, { user_ids: [f.S1.id] }, f.T1.token)).body).toMatchObject({ awarded: 0, already: 1 });
    expect((await api('POST', `/api/game/badges/${schoolBadge}/award`, { user_ids: [f.S3.id] }, f.T1.token)).status).toBe(403); // học sinh chưa vào lớp của thầy
    expect((await api('POST', `/api/game/badges/${schoolBadge}/award`, { user_ids: [f.S3.id] }, f.A.token)).body.awarded).toBe(1); // quản trị trường trao cho mọi học sinh của trường
    expect((await api('POST', `/api/game/badges/${schoolBadge}/award`, { user_ids: [f.S1.id] }, f.TB.token)).status).toBe(404); // trường khác
    // danh sách phục vụ màn trao huy hiệu: huy hiệu trường mình và học sinh trong lớp mình phụ trách
    expect((await api('GET', '/api/game/school-badges', undefined, f.T1.token)).body.map((b: any) => b.id)).toEqual([schoolBadge]);
    expect((await api('GET', '/api/game/school-badges', undefined, f.TB.token)).body).toEqual([]);
    const roster = await api('GET', `/api/game/class-students/${f.class7a.id}`, undefined, f.T1.token);
    expect(roster.status).toBe(200);
    expect(roster.body.map((r: any) => r.id)).toContain(f.S1.id);
    expect(Object.keys(roster.body[0]).sort()).toEqual(['full_name', 'id', 'user_code']); // không lộ trường dữ liệu khác
    expect((await api('GET', `/api/game/class-students/${f.class7a.id}`, undefined, f.TB.token)).status).toBe(404); // giáo viên trường khác
    expect((await api('GET', `/api/game/class-students/${f.class7a.id}`, undefined, f.S1.token)).status).toBe(403); // học sinh không dùng được
    const mine = (await api('GET', '/api/game/badges', undefined, f.S1.token)).body.find((b: any) => b.id === schoolBadge);
    expect(mine).toMatchObject({ earned: true, scope: 'school' });
    const systemBadge = (await api('GET', '/api/game/admin/badges', undefined, f.root)).body.find((b: any) => b.scope === 'system');
    expect((await api('POST', `/api/game/badges/${systemBadge.id}/award`, { user_ids: [f.S1.id] }, f.T1.token)).status).toBe(404); // huy hiệu hệ thống tự trao, không trao tay
  });

  // ------------------------------------------------------------------ HK.QT.045
  test('HK.QT.045 sự kiện / giải đấu cấp trường: lớp tham gia, thời gian, phần thưởng; bảng riêng; trao thưởng một lần khi kết thúc', async () => {
    const now = clock.now();
    const iso = (ms: number) => new Date(now.getTime() + ms).toISOString();
    const body = { title: 'Giải đấu Hào khí 7A1', description: 'Thi đua học tập', starts_at: iso(-3600_000), ends_at: iso(2 * DAY), class_ids: [f.class7a.id], rewards: { first: 100, second: 50, third: 20, participation: 10 }, badge_id: schoolBadge };
    expect((await api('POST', '/api/game/admin/contests', body, f.T1.token)).status).toBe(403);
    expect((await api('POST', '/api/game/admin/contests', { ...body, ends_at: iso(-7200_000) }, f.A.token)).status).toBe(400);
    expect((await api('POST', '/api/game/admin/contests', { ...body, class_ids: [999999] }, f.A.token)).status).toBe(400);
    expect((await api('POST', '/api/game/admin/contests', { ...body, rewards: { first: 99999 } }, f.A.token)).status).toBe(400);
    const created = await api('POST', '/api/game/admin/contests', body, f.A.token);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: 'active', classes: [{ name: '7A1' }], settled_at: null });
    const id = created.body.id;
    expect((await api('GET', '/api/game/admin/contests', undefined, f.B.token)).body).toEqual([]);
    expect((await api('DELETE', `/api/game/admin/contests/${id}`, undefined, f.B.token)).status).toBe(404);
    expect((await api('PUT', `/api/game/admin/contests/${id}`, { title: 'Đổi tên' }, f.A.token)).status).toBe(409); // đã bắt đầu

    await earn(f.S1.id, 200, 'contest-s1');
    await earn(f.S2.id, 120, 'contest-s2');
    await earn(f.S3.id, 500, 'contest-s3'); // không thuộc lớp tham gia nên không vào bảng
    const list = (await api('GET', '/api/game/contests', undefined, f.S1.token)).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: 'Giải đấu Hào khí 7A1', status: 'active', my_rank: 1, my_xp: 200, participants: 2 });
    expect((await api('GET', '/api/game/contests', undefined, f.S3.token)).body).toEqual([]);
    const board = (await api('GET', `/api/game/contests/${id}/board`, undefined, f.S2.token)).body;
    expect(board.entries.map((e: any) => [e.rank, e.xp, e.me])).toEqual([[1, 200, false], [2, 120, true]]);
    expect((await api('GET', `/api/game/contests/${id}/board`, undefined, f.S3.token)).status).toBe(404);

    const gold1 = (await me(f.S1.token)).gold;
    const gold2 = (await me(f.S2.token)).gold;
    clock.advance(3 * DAY);
    await job.run();
    expect((await me(f.S1.token)).gold - gold1).toBe(110); // hạng nhất 100 + tham gia 10
    expect((await me(f.S2.token)).gold - gold2).toBe(60); // hạng nhì 50 + tham gia 10
    expect((await api('GET', '/api/game/celebrations', undefined, f.S1.token)).body.some((c: any) => c.kind === 'contest' && c.payload.rank === 1 && c.payload.gold === 110)).toBe(true);
    expect((await api('GET', '/api/game/admin/contests', undefined, f.A.token)).body[0]).toMatchObject({ status: 'ended' });
    expect((await api('GET', '/api/game/admin/contests', undefined, f.A.token)).body[0].settled_at).toBeTruthy();
    await job.run();
    expect((await me(f.S1.token)).gold - gold1).toBe(110); // chỉ trao một lần
    expect((await api('DELETE', `/api/game/admin/contests/${id}`, undefined, f.A.token)).status).toBe(409);

    const future = await api('POST', '/api/game/admin/contests', { ...body, title: 'Sự kiện sắp tới', starts_at: new Date(clock.now().getTime() + DAY).toISOString(), ends_at: new Date(clock.now().getTime() + 3 * DAY).toISOString() }, f.A.token);
    expect((await api('PUT', `/api/game/admin/contests/${future.body.id}`, { title: 'Sự kiện đã đổi tên' }, f.A.token)).body.title).toBe('Sự kiện đã đổi tên');
    expect((await api('DELETE', `/api/game/admin/contests/${future.body.id}`, undefined, f.A.token)).status).toBe(204);
  });

  // ------------------------------------------------------------------ HK.AD.048–053
  test('HK.AD.048–053 quản trị tổng quản lý cấp độ, lớp nhân vật, huy hiệu, thẻ, vật phẩm, mẫu nhiệm vụ; kiểm tra dữ liệu và không xóa mục đang dùng', async () => {
    const specs = (await api('GET', '/api/game/admin/specs', undefined, f.root)).body;
    expect(specs.entities.map((e: any) => e.entity)).toEqual(['levels', 'classes', 'badges', 'cards', 'items', 'quests']);
    expect(specs.badge_rules.map((r: any) => r.value)).toContain('campaign_complete');

    // cấp độ: điểm phải tăng dần, cấp 1 không xóa được
    expect((await api('POST', '/api/game/admin/levels', { level: 11, title: 'Huyền thoại', xp_required: 4000, reward_gold: 200 }, f.root)).status).toBe(201);
    expect((await api('POST', '/api/game/admin/levels', { level: 12, title: 'Sai thứ tự', xp_required: 3900 }, f.root)).status).toBe(400);
    expect((await api('PUT', '/api/game/admin/levels/11', { xp_required: 3100 }, f.root)).status).toBe(400);
    expect((await api('PUT', '/api/game/admin/levels/11', { reward_gold: 250 }, f.root)).body.reward_gold).toBe(250);
    expect((await api('DELETE', '/api/game/admin/levels/1', undefined, f.root)).status).toBe(409);
    expect((await api('DELETE', '/api/game/admin/levels/11', undefined, f.root)).status).toBe(204);

    // lớp nhân vật: kỹ năng theo dòng "mã | tên | mô tả | chi phí"
    const cls = await api('POST', '/api/game/admin/classes', { code: 'cung_thu', name: 'Cung thủ', description: 'Bắn xa', hp: 80, attack: 100, wisdom: 50, support: 20, skills: 'bach_phat | Bách phát | Bắn trúng liên tiếp | 4' }, f.root);
    expect(cls.status).toBe(201);
    expect(cls.body).toMatchObject({ stats: { hp: 80, attack: 100 }, hp: 80, attack: 100, wisdom: 50, support: 20 });
    expect(cls.body.skills).toBe('bach_phat | Bách phát | Bắn trúng liên tiếp | 4');
    expect((await api('PUT', `/api/game/admin/classes/${cls.body.id}`, { skills: 'sai dinh dang' }, f.root)).status).toBe(400);
    expect((await api('POST', '/api/game/admin/classes', { code: 'cung_thu', name: 'Trùng mã' }, f.root)).status).toBe(409);
    const used = (await api('GET', '/api/game/admin/classes', undefined, f.root)).body.find((c: any) => c.code === 'quan_su');
    expect((await api('DELETE', `/api/game/admin/classes/${used.id}`, undefined, f.root)).status).toBe(409); // đang có học sinh dùng
    expect((await api('DELETE', `/api/game/admin/classes/${cls.body.id}`, undefined, f.root)).status).toBe(204);

    // thẻ: không xóa thẻ đã có người sưu tầm
    const figure = (await api('GET', '/api/content/history-options?type=figure', undefined, f.root)).body[0];
    const card = await api('POST', '/api/game/admin/cards', { code: 'the-moi', name: 'Thẻ mới', rarity: 'rare', drop_weight: 20, figure_id: figure.id }, f.root);
    expect(card.status).toBe(201);
    expect((await api('POST', '/api/game/admin/cards', { code: 'the-sai', name: 'Thẻ sai', rarity: 'hiem', drop_weight: 20 }, f.root)).status).toBe(400);
    expect((await api('PUT', `/api/game/admin/cards/${card.body.id}`, { drop_weight: 5000 }, f.root)).status).toBe(400);
    expect((await api('PUT', `/api/game/admin/cards/${card.body.id}`, { drop_weight: 50, is_active: false }, f.root)).body).toMatchObject({ drop_weight: 50, is_active: false });
    const owned = (await api('GET', '/api/game/admin/cards', undefined, f.root)).body.find((c: any) => c.code === 'tran-hung-dao' || c.code === 'tran-thai-tong');
    const ownedId = (await db.query<{ card_id: number }>('SELECT card_id FROM hk_user_cards LIMIT 1'))[0].card_id;
    expect((await api('DELETE', `/api/game/admin/cards/${ownedId}`, undefined, f.root)).status).toBe(409);
    expect((await api('DELETE', `/api/game/admin/cards/${card.body.id}`, undefined, f.root)).status).toBe(204);
    void owned;

    // vật phẩm: không xóa vật phẩm có người đang giữ
    const item = await api('POST', '/api/game/admin/items', { code: 'khien-go', kind: 'outfit', name: 'Khiên gỗ', price: 80, min_level: 2, icon: 'shield', color: '#8d6e63' }, f.root);
    expect(item.status).toBe(201);
    expect((await api('POST', '/api/game/admin/items', { code: 'sai-gia', kind: 'outfit', name: 'Sai giá', price: -5 }, f.root)).status).toBe(400);
    expect((await api('POST', '/api/game/admin/items', { code: 'sai-loai', kind: 'phi-thuyen', name: 'Sai loại', price: 5 }, f.root)).status).toBe(400);
    expect((await api('POST', '/api/game/admin/items', { code: 'sai-mau', kind: 'outfit', name: 'Sai màu', price: 5, color: 'đỏ' }, f.root)).status).toBe(400);
    const hint = (await api('GET', '/api/game/admin/items', undefined, f.root)).body.find((i: any) => i.code === 'goi-y-50-50');
    expect((await api('DELETE', `/api/game/admin/items/${hint.id}`, undefined, f.root)).status).toBe(409);
    expect((await api('DELETE', `/api/game/admin/items/${item.body.id}`, undefined, f.root)).status).toBe(204);

    // mẫu nhiệm vụ
    const quest = await api('POST', '/api/game/admin/quests', { code: 'ngay-thu', period: 'daily', title: 'Nhiệm vụ thử', metric: 'xp_earned', target: 20, reward_xp: 5, reward_gold: 1 }, f.root);
    expect(quest.status).toBe(201);
    expect((await api('POST', '/api/game/admin/quests', { code: 'ngay-sai', period: 'daily', title: 'Sai', metric: 'bay_len_troi', target: 20 }, f.root)).status).toBe(400);
    expect((await api('POST', '/api/game/admin/quests', { code: 'ngay-0', period: 'daily', title: 'Mục tiêu 0', metric: 'xp_earned', target: 0 }, f.root)).status).toBe(400);
    expect((await api('DELETE', `/api/game/admin/quests/${quest.body.id}`, undefined, f.root)).status).toBe(204);

    // huy hiệu hệ thống có điều kiện tự trao
    const badge = await api('POST', '/api/game/admin/badges', { code: 'tich-luy-1', name: 'Khởi đầu', rule_type: 'xp_total', rule_value: 1, icon: 'star' }, f.root);
    expect(badge.body).toMatchObject({ scope: 'system', rule: { type: 'xp_total', value: 1 }, rule_type: 'xp_total' });
    expect((await api('POST', '/api/game/admin/badges', { code: 'thieu-dk', name: 'Thiếu điều kiện', rule_type: 'level' }, f.root)).status).toBe(400);
    expect((await api('POST', '/api/game/admin/badges', { code: 'thieu-lan', name: 'Thiếu chiến dịch', rule_type: 'campaign_complete' }, f.root)).status).toBe(400);
    await earn(f.S2.id, 5, 'badge-trigger');
    expect((await api('GET', '/api/game/badges', undefined, f.S2.token)).body.find((b: any) => b.code === 'tich-luy-1').earned).toBe(true);
    expect((await api('DELETE', `/api/game/admin/badges/${badge.body.id}`, undefined, f.root)).status).toBe(409); // đã trao
    expect((await api('GET', '/api/game/admin/levels', undefined, f.T1.token)).status).toBe(403);
    expect((await call(s.base, 'GET', '/api/game/admin/levels')).status).toBe(401);
    expect((await api('GET', '/api/game/admin/khong-co', undefined, f.root)).status).toBe(404);
  });

  // ------------------------------------------------------------------ HK.AD.054, 066
  test('HK.AD.054/066 cấu hình mặc định: kiểm tra từng khóa; đổi hệ số thưởng tốc độ, số tim, tỉ lệ rơi thẻ có hiệu lực ngay', async () => {
    const view = (await api('GET', '/api/game/admin/settings', undefined, f.root)).body;
    expect(view.values).toMatchObject({ hearts: { max: 5, regen_hours: 4 }, speed_bonus_ratio: 0.5, practice_correct_xp: 10, league: { group_size: 30, promote: 10, demote: 5 } });
    expect(view.rules['hearts.max'].label).toContain('tim');
    for (const bad of [{ hearts: { max: 11 } }, { hearts: { max: 2.5 } }, { speed_bonus_ratio: 2 }, { unknown: 1 }, { hearts: { enabled: 'có' } }, { daily_goal: { default: 75 } }, { cards: { rates: { common: 0, rare: 0, legendary: 0 } } }, { league: { promote: 30, demote: 30 } }, { gift: { gold: [1, 2, 3] } }, 'text']) {
      expect([JSON.stringify(bad), (await api('PUT', '/api/game/admin/settings', bad as never, f.root)).status]).toEqual([JSON.stringify(bad), 400]);
    }
    expect((await api('PUT', '/api/game/admin/settings', { speed_bonus_ratio: 0 }, f.T1.token)).status).toBe(403);

    await api('PUT', '/api/game/admin/settings', { speed_bonus_ratio: 0 }, f.root);
    const [, quiz] = (await mapOf(f.S1.token)).nodes;
    const none = await quizNode(f.S1.token, quiz.id);
    expect(none.summary.bonus_points).toBe(0); // không còn thưởng tốc độ
    await api('PUT', '/api/game/admin/settings', { speed_bonus_ratio: 0.5 }, f.root);

    await api('PUT', '/api/game/admin/settings', { cards: { rates: { common: 0, rare: 0, legendary: 100 } }, gift: { gold: [1, 2, 3, 4, 5, 6, 7] } }, f.root);
    clock.random = () => 0.5;
    await tx(async (q) => { await game.dropCard(q, await userRow(f.S1.id), 'node', null); });
    const drop = (await api('GET', '/api/game/drops', undefined, f.S1.token)).body.pop();
    expect((await api('POST', `/api/game/drops/${drop.id}/flip`, undefined, f.S1.token)).body.card.rarity).toBe('legendary');
    clock.random = Math.random;
    expect((await api('GET', '/api/game/gift', undefined, f.S1.token)).body.days.map((d: any) => d.gold)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    await api('PUT', '/api/game/admin/settings', { cards: { rates: { common: 70, rare: 25, legendary: 5 } }, gift: { gold: [10, 15, 20, 25, 30, 40, 50] }, hearts: { enabled: false } }, f.root);
    const [, , , final] = (await mapOf(f.S2.token)).nodes;
    await quizNode(f.S2.token, final.id, () => false);
    expect((await me(f.S2.token)).hearts).toMatchObject({ enabled: false, current: 5 }); // tắt tim toàn hệ thống
    await api('PUT', '/api/game/admin/settings', { hearts: { enabled: true } }, f.root);
    expect((await api('GET', '/api/game/config', undefined, f.S1.token)).body).toMatchObject({ hearts: { max: 5 }, daily_goal_options: [50, 100, 200], league_tiers: ['Đồng', 'Bạc', 'Vàng', 'Kim cương'] });
  });

  test('phân quyền: học sinh không dùng API quản trị, giáo viên không dùng API của học sinh, không có token bị từ chối', async () => {
    for (const path of ['/api/game/admin/levels', '/api/game/admin/settings', '/api/game/admin/contests', '/api/game/class-settings', '/api/game/school-settings']) {
      expect([path, (await api('GET', path, undefined, f.S1.token)).status]).toEqual([path, 403]);
    }
    for (const path of ['/api/game/me', '/api/game/shop', '/api/game/quests', '/api/game/gift', '/api/game/league', '/api/game/cards', '/api/game/badges']) {
      expect([path, (await api('GET', path, undefined, f.T1.token)).status]).toEqual([path, 403]);
      expect([path, (await call(s.base, 'GET', path)).status]).toEqual([path, 401]);
    }
    expect((await api('GET', '/api/game/admin/cards', undefined, f.A.token)).status).toBe(200);
    expect((await api('GET', '/api/game/admin/contests', undefined, f.T1.token)).status).toBe(403);
  });
});
