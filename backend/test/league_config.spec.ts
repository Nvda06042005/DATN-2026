/**
 * HK.AD.054 quản lý giải đấu: quản trị tổng đặt số hạng (2–8) và tên từng hạng, số người thăng / giáng, ngày chốt bảng. HTTP thật trên PostgreSQL tạm;
 * thời gian được "tua" bằng GameClock. Kiểm tra cả cấu hình lưu từ trước khi có hai khóa này (phải dùng mặc định) và việc đổi ngày chốt không làm lệch tuần đang chạy.
 */
import { call, hasPostgres, Started, startApp } from './harness';
import { bootstrap, Fixture } from './fixture';
import type { DatabaseService } from '../src/database/database.service';
import type { GameClock } from '../src/game/clock';
import type { GameService } from '../src/game/game.service';
import type { GameJob } from '../src/game/game.job';
import type { SettingsService } from '../src/game/settings';

let s: Started, f: Fixture, db: DatabaseService, clock: GameClock, game: GameService, job: GameJob, settings: SettingsService;
let dayKey: (d: Date) => string, addDays: (key: string, n: number) => string, daysBetween: (a: string, b: string) => number, dayStart: (key: string) => Date;
const DAY = 86_400_000;
const api = (method: string, path: string, body?: unknown, token = f.S1.token) => call(s.base, method, path, body, token);
const root = (method: string, path: string, body?: unknown) => api(method, path, body, f.root);
const setLeague = (league: Record<string, unknown>) => root('PUT', '/api/game/admin/settings', { league });
const userRow = async (id: number) => (await db.query<any>('SELECT * FROM app_users WHERE id = $1', [id]))[0];
const earn = async (id: number, xp: number, key: string) => { const u = await userRow(id); return db.tx(((q: any) => game.awardXp(q, u, xp, 'node', key)) as never); };
const tierOf = async (id: number) => (await db.query<{ league_tier: number }>('SELECT league_tier FROM hk_players WHERE user_id = $1', [id]))[0].league_tier;
const place = (id: number, tier: number) => db.query('INSERT INTO hk_players (user_id, league_tier) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET league_tier = $2', [id, tier]);
const SIX = ['Sắt', 'Đồng', 'Bạc', 'Vàng', 'Bạch kim', 'Kim cương'];

(hasPostgres() ? describe : describe.skip)('HK.AD.054 – cấu hình giải đấu: số hạng và ngày chốt', () => {
  beforeAll(async () => {
    s = await startApp('league_cfg_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    const clockMod = await import('../src/game/clock');
    clock = s.moduleRef.get(clockMod.GameClock);
    ({ dayKey, addDays, daysBetween, dayStart } = clockMod);
    game = s.moduleRef.get((await import('../src/game/game.service')).GameService);
    job = s.moduleRef.get((await import('../src/game/game.job')).GameJob);
    settings = s.moduleRef.get((await import('../src/game/settings')).SettingsService);
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken);
  });
  afterAll(async () => { clock?.reset(); await s?.close(); });

  test('cấu hình lưu từ trước khi có số hạng và ngày chốt vẫn đọc được: dùng mặc định 4 hạng, chốt thứ Hai, không ghi lịch khi chưa đổi gì', async () => {
    await db.query(`INSERT INTO hk_settings (key, value) VALUES ('game', '{"league":{"group_size":30,"promote":10,"demote":5}}') ON CONFLICT (workspace_key,key) DO UPDATE SET value = EXCLUDED.value`);
    settings.invalidate();
    const view = (await root('GET', '/api/game/admin/settings')).body;
    expect(view.values.league).toEqual({ group_size: 30, promote: 10, demote: 5, tiers: ['Đồng', 'Bạc', 'Vàng', 'Kim cương'], close_weekday: 1 });
    expect(view.league_schedule).toMatchObject({ weekday: 1, next: null });
    const league = (await api('GET', '/api/game/league')).body;
    expect(league).toMatchObject({ tier: 0, tier_name: 'Đồng', tiers: ['Đồng', 'Bạc', 'Vàng', 'Kim cương'], close_weekday: 1, next_close: null });
    expect(new Date(league.ends_at).getTime()).toBe(dayStart(addDays(league.week, 7)).getTime()); // mặc định: tuần 7 ngày bắt đầu thứ Hai như trước
    expect(await db.query("SELECT 1 FROM hk_settings WHERE key = 'league_schedule'")).toHaveLength(0); // chưa đổi gì thì không ghi
  });

  test('kiểm tra cấu hình: 2–8 hạng, tên 1–20 ký tự không trùng; ngày chốt 1–7; chỉ quản trị tổng được sửa', async () => {
    const bad: Array<[Record<string, unknown>, RegExp]> = [
      [{ tiers: ['Đồng'] }, /từ 2 đến 8 hạng/],
      [{ tiers: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] }, /từ 2 đến 8 hạng/],
      [{ tiers: ['Bạc', 'bạc'] }, /không được trùng/],
      [{ tiers: ['Bạc', '   '] }, /1 đến 20 ký tự/],
      [{ tiers: ['Bạc', 'x'.repeat(21)] }, /1 đến 20 ký tự/],
      [{ tiers: 'Đồng, Bạc' }, /danh sách tên/],
      [{ close_weekday: 0 }, /chỉ nhận 1, 2, 3, 4, 5, 6, 7/],
      [{ close_weekday: 8 }, /chỉ nhận/],
      [{ close_weekday: 2.5 }, /số nguyên|chỉ nhận/],
      [{ close_weekday: 'thứ hai' }, /phải là số/],
    ];
    for (const [league, message] of bad) {
      const res = await setLeague(league);
      expect([JSON.stringify(league), res.status]).toEqual([JSON.stringify(league), 400]);
      expect(JSON.stringify(res.body)).toMatch(message);
    }
    expect((await call(s.base, 'GET', '/api/game/admin/settings', undefined, f.A.token)).status).toBe(200); // quản trị trường
    expect((await call(s.base, 'PUT', '/api/game/admin/settings', { league: { tiers: SIX } }, f.T1.token)).status).toBe(403);
    const ok = await setLeague({ tiers: ['  Sắt ', 'Đồng', 'Bạc', 'Vàng', 'Bạch  kim', 'Kim cương'] });
    expect(ok.status).toBe(200);
    expect(ok.body.values.league.tiers).toEqual(SIX); // bỏ khoảng trắng thừa
    expect((await api('GET', '/api/game/config')).body.league_tiers).toEqual(SIX);
    // cấu hình thăng / giáng vẫn bị ràng buộc theo cỡ nhóm
    expect((await setLeague({ group_size: 10, promote: 8, demote: 5 })).status).toBe(400);
  });

  test('6 hạng: người ở hạng thứ tư được thăng lên hạng thứ năm (không bị chặn ở mức 4 hạng cũ); lời chúc mừng nêu đúng tên hạng', async () => {
    await place(f.S2.id, 3);
    await place(f.S3.id, 3);
    await earn(f.S2.id, 100, 'cfg-s1-w1');
    await earn(f.S3.id, 10, 'cfg-s2-w1');
    const view = (await api('GET', '/api/game/league', undefined, f.S2.token)).body;
    expect(view).toMatchObject({ tier: 3, tier_name: 'Vàng', size: 2, promote: 1 });
    expect(view.tiers).toEqual(SIX);
    clock.advance(8 * DAY);
    await job.run();
    expect(await tierOf(f.S2.id)).toBe(4); // Bạch kim
    expect(await tierOf(f.S3.id)).toBe(3); // nhóm 2 người nên không ai bị giáng
    const celebration = (await api('GET', '/api/game/celebrations', undefined, f.S2.token)).body.find((c: any) => c.kind === 'league');
    expect(celebration.payload).toMatchObject({ from: 'Vàng', to: 'Bạch kim', result: 'promote', rank: 1 });
    expect((await api('GET', '/api/game/me', undefined, f.S2.token)).body.league).toEqual({ tier: 4, name: 'Bạch kim' });
  });

  test('giảm số hạng: người ở hạng cao hơn được xếp vào hạng cao nhất còn lại, không lỗi và không thăng quá hạng cuối', async () => {
    expect((await setLeague({ tiers: ['Đồng', 'Bạc', 'Vàng'] })).status).toBe(200);
    expect((await api('GET', '/api/game/me', undefined, f.S2.token)).body.league).toEqual({ tier: 2, name: 'Vàng' }); // đang lưu hạng 4 nhưng chỉ còn 3 hạng
    await earn(f.S2.id, 100, 'cfg-s1-w2');
    await earn(f.S3.id, 10, 'cfg-s2-w2');
    const view = (await api('GET', '/api/game/league', undefined, f.S2.token)).body;
    expect(view).toMatchObject({ tier: 2, tier_name: 'Vàng', saved_tier: 2, size: 2 });
    expect(view.tiers).toHaveLength(3);
    clock.advance(8 * DAY);
    await job.run();
    expect(await tierOf(f.S2.id)).toBe(2); // đứng đầu nhưng đã ở hạng cao nhất
    expect(await tierOf(f.S3.id)).toBe(2);
    expect((await api('GET', '/api/game/celebrations', undefined, f.S2.token)).body.filter((c: any) => c.kind === 'league').some((c: any) => c.payload.to === 'Vàng' && c.payload.from === 'Vàng')).toBe(true);
  });

  test('đổi ngày chốt: tuần đang chạy giữ nguyên, ngày mới có hiệu lực từ tuần kế tiếp, tuần chuyển tiếp ngắn rồi đủ 7 ngày; đổi lại thì hủy', async () => {
    await earn(f.S1.id, 40, 'cfg-s1-w3');
    const before = (await root('GET', '/api/game/admin/settings')).body.league_schedule;
    expect(before).toMatchObject({ weekday: 1, next: null });
    const target = 4; // thứ Năm; lịch mặc định luôn chốt vào thứ Hai nên khác nhau ở mọi thời điểm chạy kiểm thử
    expect((await setLeague({ close_weekday: target })).status).toBe(200);
    const pending = (await root('GET', '/api/game/admin/settings')).body.league_schedule;
    expect(pending).toMatchObject({ week: before.week, ends_on: before.ends_on, weekday: 1, next: { weekday: target, from: before.ends_on } });
    const week = (await api('GET', '/api/game/league')).body;
    expect(week.week).toBe(before.week);
    expect(new Date(week.ends_at).getTime()).toBe(dayStart(before.ends_on).getTime()); // tuần đang chạy vẫn hết đúng giờ cũ
    expect(week).toMatchObject({ close_weekday: 1, next_close: { weekday: target, from: before.ends_on } });

    // đổi lại trước khi có hiệu lực: hủy lịch chờ
    await setLeague({ close_weekday: 1 });
    expect((await root('GET', '/api/game/admin/settings')).body.league_schedule.next).toBeNull();
    await setLeague({ close_weekday: target });
    expect((await root('GET', '/api/game/admin/settings')).body.league_schedule.next).toMatchObject({ weekday: target, from: before.ends_on });

    // sang ngày hẹn: tuần chuyển tiếp bắt đầu đúng ngày hẹn, kết thúc ở thứ Năm đầu tiên sau đó
    const members = async (key: string) => (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM hk_league_members WHERE week_key = $1', [key]))[0].n;
    expect(await members(before.week)).toBeGreaterThan(0);
    clock.advance(daysBetween(dayKey(clock.now()), before.ends_on) * DAY);
    await job.run();
    expect((await db.query('SELECT 1 FROM hk_league_weeks WHERE week_key = $1 AND school_id=$2', [before.week,f.A.schoolId])).length).toBe(1); // tuần cũ đã chốt đúng một lần
    const transition = (await api('GET', '/api/game/league')).body;
    expect(transition.week).toBe(before.ends_on);
    const thursday = addDays(before.ends_on, 3); // ngày hẹn là thứ Hai
    expect(new Date(transition.ends_at).getTime()).toBe(dayStart(thursday).getTime());
    expect(transition).toMatchObject({ close_weekday: target, next_close: null });
    // tới thứ Năm: tuần mới bắt đầu, dài 7 ngày
    clock.advance(3 * DAY);
    const regular = (await api('GET', '/api/game/league')).body;
    expect(regular.week).toBe(thursday);
    expect(new Date(regular.ends_at).getTime()).toBe(dayStart(addDays(thursday, 7)).getTime());
    expect((await db.query('SELECT 1 FROM hk_league_weeks WHERE week_key = $1 AND school_id=$2', [before.ends_on,f.A.schoolId])).length).toBe(1); // tuần chuyển tiếp cũng chốt đúng một lần
    // lịch đã lưu một dòng duy nhất
    const stored = await db.query<{ value: any }>("SELECT value FROM hk_settings WHERE key = 'league_schedule' AND school_id=$1",[f.A.schoolId]);
    expect(stored).toHaveLength(1);
    expect(stored[0].value).toMatchObject({ weekday: target, from: before.ends_on, next: null });
  });
});
