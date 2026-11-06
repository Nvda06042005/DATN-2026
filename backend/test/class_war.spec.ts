/**
 * Ver0.2 Sprint 7 (phần còn lại): luật lớp có bật / tắt game trận đánh và giới hạn thời gian chơi (HK.GV.060), gắn cửa học với trận đánh của lớp (HK.GV.083),
 * Sa bàn 3D trận đánh (HK.HS.137, HK.GV.084). HTTP thật trên PostgreSQL tạm.
 */
import { call, hasPostgres, Started, startApp } from './harness';
import { bootstrap, Fixture, publishSeed } from './fixture';
import { dayKey } from '../src/game/clock';
import { cleanSandtable } from '../src/battle/sandtable';
import type { DatabaseService } from '../src/database/database.service';

let s: Started, f: Fixture, db: DatabaseService;
const as = (who: { token: string }) => (method: string, path: string, body?: unknown) => call(s.base, method, path, body, who.token);
const root = (method: string, path: string, body?: unknown) => call(s.base, method, path, body, f.root);
const t1 = as({ get token() { return f.T1.token; } });

const cardId = async (code: string): Promise<number> => (await db.query<{ id: number }>('SELECT id FROM hk_cards WHERE code = $1', [code]))[0].id;
const give = async (userId: number, code: string, level = 1, stars = 1) => {
  await db.query('INSERT INTO hk_user_cards (user_id, card_id, level, stars) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, card_id) DO UPDATE SET level = $3, stars = $4', [userId, await cardId(code), level, stars]);
};
/** Hoàn thành mọi nút đứng trước nút trận đánh trong hành trình mặc định của cuộc kháng chiến */
const learnToBattle = async (userId: number, campaignId: number, slug: string) => {
  const nodes = await db.query<{ id: number; kind: string; position: number; slug: string | null }>(
    "SELECT n.id, n.kind, n.position, b.slug FROM hk_nodes n JOIN hk_journeys j ON j.id = n.journey_id LEFT JOIN hist_battles b ON b.id = n.battle_id WHERE j.campaign_id = $1 AND j.is_default AND j.status = 'published' ORDER BY n.position", [campaignId]);
  const battle = nodes.find((n) => n.kind === 'battle' && n.slug === slug)!;
  for (const n of nodes.filter((x) => x.position < battle.position)) {
    await db.query('INSERT INTO hk_node_progress (user_id, node_id, best_percent, stars, completed_at) VALUES ($1, $2, 100, 3, now()) ON CONFLICT (user_id, node_id) DO UPDATE SET completed_at = now()', [userId, n.id]);
  }
};

(hasPostgres() ? describe : describe.skip)('Ver0.2 Sprint 7 – luật lớp, gắn cửa học với trận đánh, Sa bàn 3D', () => {
  let campaignId: number, stage: number, classId: number, gateId: number, finalNode: number;

  beforeAll(async () => {
    s = await startApp('class_war_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken, true);
    await publishSeed(s.base, f.root);
    const sourceId = (await db.query<{ id: number }>("SELECT id FROM hist_sources WHERE slug = 'hich-tuong-si-trich-doan'"))[0].id;
    for (const k of (await root('GET', '/api/war/admin/commanders')).body) await root('PUT', `/api/war/admin/commanders/${k.id}`, { status: 'published' });
    for (const d of (await root('GET', '/api/war/admin/dialogs')).body) {
      await root('PUT', `/api/war/admin/dialogs/${d.id}`, { source_ids: [sourceId] });
      await root('POST', `/api/war/admin/dialogs/${d.id}/status`, { status: 'published' });
    }
    for (const st of (await root('GET', '/api/war/admin/stages')).body) expect((await root('POST', `/api/war/admin/stages/${st.id}/status`, { status: 'published' })).status).toBe(200);
    for (const m of (await root('GET', '/api/war/admin/maps')).body) await root('POST', `/api/war/admin/maps/${m.id}/status`, { status: 'published' });
    classId = f.class7a.id;
    campaignId = (await db.query<{ id: number }>("SELECT id FROM hist_campaigns WHERE status = 'published' ORDER BY sort_order, id LIMIT 1"))[0].id;
    stage = (await db.query<{ id: number }>("SELECT s.id FROM hk_stages s JOIN hist_battles b ON b.id = s.battle_id WHERE b.slug = 'dong-bo-dau'"))[0].id;
    await db.query('INSERT INTO hk_players (user_id, level) VALUES ($1, 12), ($2, 12) ON CONFLICT (user_id) DO UPDATE SET level = 12', [f.S1.id, f.S2.id]);
    for (const code of ['tran-hung-dao', 'tran-quang-khai', 'tran-khanh-du']) await give(f.S1.id, code, 8, 4);
    // một cửa thử nghiệm chứa nút cuối của hành trình mặc định (đứng sau nút trận đánh nên học xong tới trận vẫn chưa hoàn thành cửa này)
    const journey = (await db.query<{ id: number }>("SELECT id FROM hk_journeys WHERE campaign_id = $1 AND is_default AND status = 'published'", [campaignId]))[0].id;
    finalNode = (await db.query<{ id: number }>("SELECT id FROM hk_nodes WHERE journey_id = $1 AND kind = 'final'", [journey]))[0].id;
    gateId = (await db.query<{ id: number }>("INSERT INTO hk_gates (journey_id, position, title) VALUES ($1, 90, 'Cửa thử nghiệm') RETURNING id", [journey]))[0].id;
    await db.query('UPDATE hk_nodes SET gate_id = $2 WHERE id = $1', [finalNode, gateId]);
    await learnToBattle(f.S1.id, campaignId, 'dong-bo-dau');
  });
  afterAll(async () => { await s?.close(); });

  // ------------------------------------------------------------------ HK.GV.060
  test('HK.GV.060 luật lớp: giáo viên tắt game trận đánh cho lớp thì học sinh của lớp không vào được nhưng vẫn học bình thường', async () => {
    const rules = (await t1('GET', `/api/classroom/classes/${classId}/rules`)).body;
    expect(rules).toMatchObject({ war_enabled: true, war_minutes: null, hearts_enabled: true });
    expect((await as(f.S1)('GET', '/api/war/status')).body).toMatchObject({ open: true });
    expect((await as(f.T2)('PUT', `/api/classroom/classes/${classId}/rules`, { war_enabled: false })).status).toBe(404);
    const off = await t1('PUT', `/api/classroom/classes/${classId}/rules`, { war_enabled: false });
    expect(off.status).toBe(200);
    expect(off.body).toMatchObject({ war_enabled: false, hearts_enabled: true });
    const status = (await as(f.S1)('GET', '/api/war/status')).body;
    expect(status.open).toBe(false);
    expect(status.reason).toMatch(/Giáo viên lớp 7A1 đang tắt game trận đánh/);
    const start = await as(f.S1)('POST', `/api/war/stages/${stage}/start`, { front: [await cardId('tran-hung-dao')], back: [] });
    expect(start.status).toBe(403);
    const learn = (await as(f.S1)('GET', '/api/learn/campaigns')).status; // học và làm bài vẫn bình thường
    expect((await t1('PUT', `/api/classroom/classes/${classId}/rules`, { war_enabled: true })).body.war_enabled).toBe(true);
    expect(learn).toBe(200);
    expect((await as(f.S1)('GET', '/api/war/status')).body.open).toBe(true);
  });

  test('HK.GV.060 giới hạn thời gian chơi mỗi ngày của lớp: 5–240 phút, cấp nào chặt hơn thì thắng; hết giờ thì đóng đến ngày mai', async () => {
    for (const bad of [3, 300, 'abc']) expect((await t1('PUT', `/api/classroom/classes/${classId}/rules`, { war_minutes: bad })).status).toBe(400);
    const on = await t1('PUT', `/api/classroom/classes/${classId}/rules`, { war_minutes: 10 });
    expect(on.body.war_minutes).toBe(10);
    expect((await as(f.S1)('GET', '/api/war/status')).body).toMatchObject({ open: true, limit_minutes: 10 });
    // hệ thống cho phép 15 phút, lớp 10 phút → lấy 10 (cấp chặt hơn); hệ thống 20 phút vẫn lấy 10
    await root('PUT', '/api/game/admin/settings', { war: { daily_minutes: 15 } });
    expect((await as(f.S1)('GET', '/api/war/status')).body.limit_minutes).toBe(10);
    await root('PUT', '/api/game/admin/settings', { war: { daily_minutes: 20 } });
    expect((await as(f.S1)('GET', '/api/war/status')).body.limit_minutes).toBe(10);
    await db.query('INSERT INTO hk_war_play (user_id, day, seconds) VALUES ($1, $2, 601) ON CONFLICT (user_id, day) DO UPDATE SET seconds = 601', [f.S1.id, dayKey(new Date())]);
    const closed = (await as(f.S1)('GET', '/api/war/status')).body;
    expect(closed.open).toBe(false);
    expect(closed.reason).toMatch(/chơi đủ thời gian/);
    expect((await t1('PUT', `/api/classroom/classes/${classId}/rules`, { war_minutes: null })).body.war_minutes).toBeNull();
    await db.query('DELETE FROM hk_war_play WHERE user_id = $1', [f.S1.id]);
    await root('PUT', '/api/game/admin/settings', { war: { daily_minutes: 0 } });
  });

  // ------------------------------------------------------------------ HK.GV.083
  test('HK.GV.083 gắn cửa học với trận đánh: danh sách cửa của lớp, màn chơi đã phát hành; kiểm tra dữ liệu và quyền', async () => {
    expect((await as(f.S1)('GET', `/api/war/classes/${classId}/battle-links`)).status).toBe(403);
    expect((await as(f.T2)('GET', `/api/war/classes/${classId}/battle-links`)).status).toBe(404);
    const opt = (await t1('GET', `/api/war/classes/${classId}/battle-links`)).body;
    expect(opt.class).toMatchObject({ id: classId, name: '7A1' });
    expect(opt.stages).toHaveLength(6);
    expect(opt.stages.find((x: any) => x.id === stage)).toMatchObject({ battle_name: expect.stringMatching(/Đông Bộ Đầu/), difficulty: 1, has_quiz: true });
    expect(opt.gates.map((g: any) => g.id)).toContain(gateId);
    expect(opt.links).toEqual([]);
    const put = (links: unknown, who = t1) => who('PUT', `/api/war/classes/${classId}/battle-links`, { links });
    expect((await put('x')).status).toBe(400);
    expect((await put(Array.from({ length: 31 }, (_, i) => ({ stage_id: i + 1 })))).status).toBe(400);
    expect((await put([{ stage_id: 999999 }])).status).toBe(400);
    expect((await put([{ stage_id: stage }, { stage_id: stage }])).status).toBe(400);
    expect((await put([{ stage_id: stage, gate_id: 999999 }])).status).toBe(400);
    expect((await put([{ stage_id: stage, difficulty: 4 }])).status).toBe(400);
    expect((await put([{ stage_id: stage, gate_id: gateId }], as(f.T2))).status).toBe(404);
  });

  let baseline: number[];
  test('HK.GV.083 trận bị khóa tới khi học sinh của lớp hoàn thành cửa đã gắn; mở khóa rồi vào được ở độ khó giáo viên chọn và tắt câu hỏi tuyệt kỹ', async () => {
    const front = [await cardId('tran-hung-dao')];
    // trước khi gắn: vào trận bình thường (độ khó gốc), ghi lại máu quân địch làm mốc
    const first = await as(f.S1)('POST', `/api/war/stages/${stage}/start`, { front, back: [], restart: true });
    expect(first.status).toBe(200);
    baseline = first.body.units.filter((u: any) => u.side === 'enemy').map((u: any) => u.max_hp);
    expect((await db.query<any>('SELECT state->\'opts\' AS opts FROM hk_war_battles WHERE id = $1', [first.body.id]))[0].opts).toBeNull();

    const saved = await t1('PUT', `/api/war/classes/${classId}/battle-links`, { links: [{ stage_id: stage, gate_id: gateId, difficulty: 3, skill_questions: false }] });
    expect(saved.status).toBe(200);
    expect(saved.body.links).toEqual([{ stage_id: stage, gate_id: gateId, difficulty: 3, skill_questions: false }]);
    // danh sách trận, giới thiệu và bản đồ hành quân cùng báo khóa
    const list = (await as(f.S1)('GET', '/api/war/stages')).body.stages.find((x: any) => x.id === stage);
    expect(list).toMatchObject({ locked: true, difficulty: 3 });
    expect(list.locked_reason).toMatch(/cửa "Cửa thử nghiệm"/);
    const intro = (await as(f.S1)('GET', `/api/war/stages/${stage}`)).body;
    expect(intro).toMatchObject({ difficulty: 3, class_link: { gate_title: 'Cửa thử nghiệm', gate_done: false, skill_questions: false } });
    const start = await as(f.S1)('POST', `/api/war/stages/${stage}/start`, { front, back: [], restart: true });
    expect(start.status).toBe(409);
    expect(start.body.detail).toMatch(/cửa "Cửa thử nghiệm"/);
    const map = (await as(f.S1)('GET', `/api/war/march/${campaignId}`)).body;
    const battlePoint = map.points.find((p: any) => p.stage_id === stage);
    expect(battlePoint.locked_reason ?? '').toMatch(/cửa "Cửa thử nghiệm"|điểm liền trước/);
    // học sinh lớp khác (S3 không thuộc lớp) không bị ảnh hưởng
    expect((await as(f.S3)('GET', '/api/war/stages')).body.stages.find((x: any) => x.id === stage).difficulty).toBe(1);

    // hoàn thành cửa → mở khóa; vào trận với quân địch mạnh hơn theo độ khó 3 (so với độ khó gốc 1) và ghi nhận tắt câu hỏi tuyệt kỹ
    await db.query('INSERT INTO hk_node_progress (user_id, node_id, best_percent, stars, completed_at) VALUES ($1, $2, 100, 3, now())', [f.S1.id, finalNode]);
    const open = await as(f.S1)('POST', `/api/war/stages/${stage}/start`, { front, back: [], restart: true });
    expect(open.status).toBe(200);
    const hp = open.body.units.filter((u: any) => u.side === 'enemy').map((u: any) => u.max_hp);
    hp.forEach((v: number, i: number) => expect(Math.abs(v - Math.round(baseline[i] * 1.5625))).toBeLessThanOrEqual(1));
    expect((await db.query<any>('SELECT state->\'opts\' AS opts FROM hk_war_battles WHERE id = $1', [open.body.id]))[0].opts).toEqual({ difficulty: 3, skill_questions: false });
    expect((await as(f.S1)('GET', '/api/war/stages')).body.stages.find((x: any) => x.id === stage)).toMatchObject({ locked: false, difficulty: 3 });
    // giáo viên chơi thử không bị ảnh hưởng bởi cấu hình lớp
    const preview = await as(f.T1)('POST', `/api/war/stages/${stage}/preview`);
    expect(preview.status).toBe(200);
    expect(preview.body.units.filter((u: any) => u.side === 'enemy').map((u: any) => u.max_hp)).toEqual(baseline);
    // bỏ gắn → trở lại như ban đầu
    expect((await t1('PUT', `/api/war/classes/${classId}/battle-links`, { links: [] })).body.links).toEqual([]);
    expect((await as(f.S1)('GET', '/api/war/stages')).body.stages.find((x: any) => x.id === stage)).toMatchObject({ locked: false, difficulty: 1 });
  });

  // ------------------------------------------------------------------ HK.HS.137, HK.GV.084
  test('HK.GV.084 + HK.HS.137 sa bàn 3D: sáu trận đều có cảnh hợp lệ; chỉ trận đã phát hành hiện cho học sinh và giáo viên', async () => {
    const list = (await as(f.S1)('GET', '/api/war/sandtables')).body;
    expect(list).toHaveLength(6);
    expect(list[0]).toMatchObject({ title: expect.any(String), battle_name: expect.any(String), steps: expect.any(Number) });
    expect((await t1('GET', '/api/war/sandtables')).body).toHaveLength(6);
    const bachDang = list.find((x: any) => /Bạch Đằng/.test(x.title));
    const detail = (await as(f.S1)('GET', `/api/war/sandtables/${bachDang.id}`)).body;
    expect(detail.stage).toMatchObject({ battle_name: expect.stringMatching(/Bạch Đằng/), year: 1288 });
    expect(detail.sandtable.note).toMatch(/minh họa/);
    expect(detail.sandtable.markers.map((m: any) => m.kind)).toContain('stakes');
    expect(detail.sandtable.steps.length).toBeGreaterThanOrEqual(3);
    expect(detail.sandtable.steps.some((st: any) => st.moves.some((m: any) => m.mode === 'retreat'))).toBe(true);
    expect(detail.sandtable.steps.some((st: any) => st.moves.some((m: any) => m.mode === 'advance'))).toBe(true);
    // mọi cảnh khởi tạo đều qua bộ kiểm tra của máy chủ (không đổi gì khi chuẩn hóa)
    for (const st of list) {
      const scene = (await as(f.S1)('GET', `/api/war/sandtables/${st.id}`)).body.sandtable;
      expect(cleanSandtable(scene)).toEqual(scene);
    }
    // màn chơi chuyển về bản nháp: học sinh / giáo viên không thấy, quản trị tổng vẫn thấy để kiểm tra
    await root('POST', `/api/war/admin/stages/${bachDang.id}/status`, { status: 'draft' });
    expect((await as(f.S1)('GET', '/api/war/sandtables')).body).toHaveLength(5);
    expect((await as(f.S1)('GET', `/api/war/sandtables/${bachDang.id}`)).status).toBe(404);
    expect((await t1('GET', `/api/war/sandtables/${bachDang.id}`)).status).toBe(404);
    expect((await root('GET', '/api/war/sandtables')).body).toHaveLength(6);
    expect((await root('GET', `/api/war/sandtables/${bachDang.id}`)).status).toBe(200);
    await root('POST', `/api/war/admin/stages/${bachDang.id}/status`, { status: 'published' });
    expect((await as(f.S1)('GET', '/api/war/sandtables/999999')).status).toBe(404);
  });

  test('HK.AD.084 quản trị tổng soạn sa bàn trong màn chơi: kiểm tra cấu trúc, tham chiếu quân, giới hạn; để trống thì gỡ sa bàn', async () => {
    const id = (await root('GET', '/api/war/admin/stages')).body.find((x: any) => /Hàm Tử/.test(x.title)).id;
    const cur = (await root('GET', `/api/war/admin/stages/${id}`)).body;
    const put = (sandtable: unknown) => root('PUT', `/api/war/admin/stages/${id}`, { sandtable });
    expect((await put('chuỗi')).body.detail).toMatch(/Sa bàn: dữ liệu phải là một đối tượng/);
    expect((await put({ armies: [], steps: [] })).body.detail).toMatch(/cần ít nhất 1 đội quân/);
    const army = { id: 'dich', side: 'nguyen', label: 'Quân địch', kind: 'foot', start: [10, 10] };
    expect((await put({ armies: [army], steps: [] })).body.detail).toMatch(/cần ít nhất 1 bước/);
    expect((await put({ armies: [army], steps: [{ label: 'Bước 1', moves: [{ army: 'la', to: [1, 1] }] }] })).body.detail).toMatch(/chưa khai báo/);
    expect((await put({ armies: [army, army], steps: [{ label: 'Bước 1', moves: [] }] })).body.detail).toMatch(/bị trùng/);
    expect((await put({ armies: [{ ...army, side: 'khac' }], steps: [{ label: 'Bước 1', moves: [] }] })).body.detail).toMatch(/Phe của đội 1/);
    expect((await put({ armies: [{ ...army, start: [500, 10] }], steps: [{ label: 'Bước 1', moves: [] }] })).body.detail).toMatch(/phải từ 0 đến 100/);
    expect((await put({ armies: [army], hills: Array.from({ length: 21 }, () => ({ x: 1, y: 1, r: 5, h: 2 })), steps: [{ label: 'Bước 1', moves: [] }] })).body.detail).toMatch(/tối đa 20/);
    const ok = await put({ armies: [army], steps: [{ label: 'Quân địch tiến', text: 'Mô tả', moves: [{ army: 'dich', to: [40, 30], mode: 'advance' }] }], note: 'Thử nghiệm' });
    expect(ok.status).toBe(200);
    expect(ok.body.sandtable).toMatchObject({ size: [100, 60], note: 'Thử nghiệm', armies: [{ id: 'dich' }], hills: [] });
    expect((await put(null)).body.sandtable).toBeNull();
    expect((await as(f.S1)('GET', `/api/war/sandtables/${id}`)).status).toBe(404); // không còn sa bàn
    expect((await root('PUT', `/api/war/admin/stages/${id}`, { sandtable: cur.sandtable })).body.sandtable).toEqual(cur.sandtable);
  });
});
