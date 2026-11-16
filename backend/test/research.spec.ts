/**
 * Sprint 12 – nhóm thử nghiệm, dữ liệu nghiên cứu ẩn danh và báo cáo so sánh nhóm (HK.AD.077–079). HTTP thật trên PostgreSQL tạm.
 * Khảo sát (HK.HS.109, HK.GV.079, HK.QT.049–050, HK.AD.070) đã xóa hẳn theo yêu cầu 16/11/2026: các đường dẫn khảo sát trả 404.
 */
import { activate, call, hasPostgres, sql, Started, startApp } from './harness';
import { bootstrap, Fixture, PW } from './fixture';

let s: Started, f: Fixture;
let S4: { id: number; token: string }, S5: { id: number; token: string }, S6: { id: number; token: string }, S7: { id: number; token: string };
const as = (who: { token: string }) => (method: string, path: string, body?: unknown) => call(s.base, method, path, body, who.token);
const root = (method: string, path: string, body?: unknown) => call(s.base, method, path, body, f.root);
const download = async (token: string, path: string) => {
  const res = await fetch(`${s.base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get('content-type') ?? '', buf, text: buf.toString('utf8'), disposition: res.headers.get('content-disposition') ?? '' };
};

(hasPostgres() ? describe : describe.skip)('Sprint 12 – nhóm thử nghiệm và nghiên cứu', () => {
  beforeAll(async () => {
    s = await startApp('research_test');
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken, true);
    const student = async (code: string, name: string, classId: number) => {
      const created = await as(f.A)('POST', '/api/admin/students', { user_code: code, full_name: name, birth_date: '2013-05-05', class_id: classId, phone: '0900000019', email: `${code.toLowerCase()}.research@example.edu.vn` });
      const active = await activate(s.base, created.body.user.username, created.body.temporary_password, PW, 'student');
      return { id: active.user.id, token: active.token };
    };
    S4 = await student('HS8004', 'Lê Quốc Bốn', f.class7a.id);
    S5 = await student('HS8005', 'Vũ Thị Năm', f.class7b.id);
    S6 = await student('HS8006', 'Đặng Văn Sáu', f.class7b.id);
    S7 = await student('HS8007', 'Bùi Thị Bảy', f.class7b.id);
  });
  afterAll(async () => { await s?.close(); });

  test('thống kê: trung bình, độ lệch chuẩn, kiểm định Welch và giá trị p khớp giá trị chuẩn', async () => {
    const m = await import('../src/platform/stats');
    expect(m.mean([2, 4, 6])).toBe(4);
    expect(m.mean([])).toBeNull();
    expect(m.sd([1, 2, 3, 4, 5])).toBeCloseTo(1.5811, 4);
    expect(m.sd([7])).toBeNull();
    expect(m.ibeta(0.5, 2, 2)).toBeCloseTo(0.5, 8);
    expect(m.tTwoSidedP(0, 10)).toBeCloseTo(1, 8);
    expect(m.tTwoSidedP(2.306, 8)).toBeCloseTo(0.05, 3); // giá trị tới hạn t(0,975; 8) = 2,306
    expect(m.tTwoSidedP(2.228, 10)).toBeCloseTo(0.05, 3);
    expect(m.tTwoSidedP(1, 8)).toBeCloseTo(0.3466, 3);
    const w = m.welch([1, 2, 3, 4, 5], [2, 3, 4, 5, 6])!;
    expect(w.diff).toBeCloseTo(1, 10);
    expect(w.t).toBeCloseTo(1, 8);
    expect(w.df).toBeCloseTo(8, 8);
    expect(w.p).toBeCloseTo(0.3466, 3);
    expect(w.cohen_d).toBeCloseTo(0.6325, 3);
    const big = m.welch([10, 11, 12, 13, 14, 15], [20, 21, 22, 23, 24, 25])!;
    expect(big.p!).toBeLessThan(0.0001);
    expect(m.welch([1, 2], [])).toBeNull();
    expect(m.welch([1], [2, 3])).toMatchObject({ diff: 1.5, p: null });
    expect(m.welch([5, 5, 5], [6, 6, 6])).toMatchObject({ diff: 1, p: null });
  });

  // ------------------------------------------------------------------ HK.AD.070
  test('khảo sát đã xóa hẳn (16/11/2026): mọi đường dẫn khảo sát và mẫu khảo sát trả 404 với mọi vai trò', async () => {
    for (const [who, method, path] of [[f.S1, 'GET', '/api/platform/surveys/mine'], [f.T1, 'GET', '/api/platform/surveys/mine'], [f.A, 'GET', '/api/platform/surveys'], [f.A, 'POST', '/api/platform/surveys'],
      [f.A, 'GET', '/api/platform/survey-templates'], [{ token: f.root }, 'POST', '/api/platform/survey-templates'], [f.T1, 'POST', '/api/platform/surveys/1/respond']] as Array<[{ token: string }, string, string]>) {
      expect([method, path, (await as(who)(method, path, method === 'GET' ? undefined : {})).status]).toEqual([method, path, 404]);
    }
  });

  test('nhóm thử nghiệm: tạo nhóm, gán lớp; lớp không có trò chơi hóa hoặc AI thì học sinh bị chặn đúng tính năng, giáo viên và lớp khác không ảnh hưởng', async () => {
    const control = await root('POST', '/api/platform/experiments/groups', { name: 'Đối chứng', description: 'Không trò chơi hóa, không AI', gamification: false, ai: false });
    const treat = await root('POST', '/api/platform/experiments/groups', { name: 'Thử nghiệm đầy đủ', gamification: true, ai: true });
    const aiOnly = await root('POST', '/api/platform/experiments/groups', { name: 'Chỉ AI', gamification: false, ai: true });
    expect([control.body.gamification, control.body.ai]).toEqual([false, false]);
    expect((await root('POST', '/api/platform/experiments/groups', { name: 'Đối chứng' })).status).toBe(409);
    expect((await root('POST', '/api/platform/experiments/groups', { name: 'x' })).status).toBe(400);
    expect((await as(f.A)('POST', '/api/platform/experiments/groups', { name: 'Trường tạo nhóm' })).status).toBe(200);
    expect((await root('PUT', `/api/platform/experiments/groups/${treat.body.id}`, { description: 'Có đủ trò chơi hóa và AI' })).body.description).toBe('Có đủ trò chơi hóa và AI');
    const probes = async (who: { token: string }) => ({
      shop: (await as(who)('GET', '/api/game/shop')).status, quests: (await as(who)('GET', '/api/game/quests')).status, war: (await as(who)('GET', '/api/war/status')).status,
      ai: (await as(who)('GET', '/api/ai/status')).status, reco: (await as(who)('GET', '/api/analytics/me/strengths')).status, me: (await as(who)('GET', '/api/game/me')).status, learn: (await as(who)('GET', '/api/play/path')).status,
    });
    expect(await probes(f.S1)).toEqual({ shop: 200, quests: 200, war: 200, ai: 200, reco: 200, me: 200, learn: 200 });
    // gán lớp 7A1 vào nhóm đối chứng, 7A2 vào nhóm đầy đủ
    expect((await root('PUT', `/api/platform/experiments/classes/${f.class7a.id}`, { group_id: control.body.id })).body).toEqual({ class_id: f.class7a.id, group_id: control.body.id });
    expect((await root('PUT', `/api/platform/experiments/classes/${f.class7b.id}`, { group_id: treat.body.id })).body.group_id).toBe(treat.body.id);
    expect((await root('PUT', `/api/platform/experiments/classes/${f.class7a.id}`, { group_id: 999999 })).status).toBe(404);
    expect((await root('PUT', '/api/platform/experiments/classes/999999', { group_id: control.body.id })).status).toBe(404);
    expect((await as(f.T1)('PUT', `/api/platform/experiments/classes/${f.class7a.id}`, { group_id: null })).status).toBe(403);
    expect(await probes(f.S1)).toEqual({ shop: 403, quests: 403, war: 403, ai: 403, reco: 403, me: 200, learn: 200 }); // vẫn học và làm bài bình thường
    expect((await as(f.S1)('GET', '/api/ai/status')).body.detail).toContain('thử nghiệm');
    expect(await probes(S5)).toEqual({ shop: 200, quests: 200, war: 200, ai: 200, reco: 200, me: 200, learn: 200 });
    expect(await probes(f.T1)).toMatchObject({ ai: 200 }); // giáo viên không bị ảnh hưởng
    expect(await probes(f.S3)).toMatchObject({ shop: 200, ai: 200 }); // học sinh không thuộc lớp nào
    expect((await as(f.S1)('GET', '/api/platform/config')).body.features).toEqual({ gamification: false, ai: false });
    expect((await as(S5)('GET', '/api/platform/config')).body.features).toEqual({ gamification: true, ai: true });
    expect((await as(f.T1)('GET', '/api/platform/config')).body.features).toEqual({ gamification: true, ai: true });
    // nhóm "chỉ AI": tắt trò chơi hóa nhưng vẫn có AI
    await root('PUT', `/api/platform/experiments/classes/${f.class7a.id}`, { group_id: aiOnly.body.id });
    expect(await probes(f.S1)).toMatchObject({ shop: 403, war: 403, ai: 200, reco: 200 });
    // danh sách nhóm và lớp
    const groups = (await root('GET', '/api/platform/experiments/groups')).body;
    expect(groups.find((g: any) => g.name === 'Chỉ AI')).toMatchObject({ classes: 1, students: 3 });
    expect(groups.find((g: any) => g.name === 'Thử nghiệm đầy đủ')).toMatchObject({ classes: 1, students: 3 });
    expect((await root('GET', '/api/platform/experiments/classes')).body.find((c: any) => c.id === f.class7a.id)).toMatchObject({ group_name: 'Chỉ AI', students: 3, school_name: 'THCS Học Tập A' });
    // bỏ gán và xóa nhóm đưa lớp về bình thường
    await root('PUT', `/api/platform/experiments/classes/${f.class7a.id}`, { group_id: control.body.id });
    expect((await root('PUT', `/api/platform/experiments/classes/${f.class7a.id}`, { group_id: null })).body.group_id).toBeNull();
    expect(await probes(f.S1)).toMatchObject({ shop: 200, ai: 200 });
    await root('PUT', `/api/platform/experiments/classes/${f.class7a.id}`, { group_id: aiOnly.body.id });
    expect((await root('DELETE', `/api/platform/experiments/groups/${aiOnly.body.id}`)).body.deleted).toBe(true);
    expect(await probes(f.S1)).toMatchObject({ shop: 200 });
    expect((await root('DELETE', `/api/platform/experiments/groups/${aiOnly.body.id}`)).status).toBe(404);
    // để lại hai nhóm cho các bài sau (7A1 → đối chứng, 7A2 → thử nghiệm)
    await root('PUT', `/api/platform/experiments/classes/${f.class7a.id}`, { group_id: control.body.id });
  });

  // ------------------------------------------------------------------ HK.AD.077, HK.AD.079
  test('dữ liệu nghiên cứu ẩn danh (CSV) và báo cáo so sánh nhóm có kiểm định thống kê', async () => {
    const groups = (await root('GET', '/api/platform/experiments/groups')).body;
    const treat = groups.find((g: any) => g.name === 'Thử nghiệm đầy đủ');
    // dữ liệu học: nhóm thử nghiệm học nhiều và điểm cao hơn; nhóm đối chứng học ít hơn
    const give = async (uid: number, attempts: number[], eventCount: number, minutes: number) => {
      for (const pct of attempts) {
        await sql(s.url, "INSERT INTO hk_attempts (user_id, mode, status, plan, finished_at, percent, correct_count, wrong_count, duration_ms) VALUES ($1, 'practice', 'done', '[]', now(), $2, $3, $4, 60000)", [uid, pct, Math.round(pct / 10), 10 - Math.round(pct / 10)]);
      }
      for (let i = 0; i < eventCount; i += 1) await sql(s.url, "INSERT INTO hk_events (user_id, school_id, event, duration_ms, created_at) VALUES ($1, $2, 'attempt_finish', $3, now() - ($4 || ' days')::interval)", [uid, f.A.schoolId, (minutes * 60_000) / eventCount, String(i % 5)]);
    };
    await give(f.S1.id, [50, 60], 6, 20);
    await give(f.S2.id, [40], 4, 10);
    await give(S4.id, [], 0, 0); // chưa tham gia
    await give(S5.id, [80, 90], 12, 60);
    await give(S6.id, [70, 85, 95], 15, 75);
    await give(S7.id, [75], 9, 45);
    await sql(s.url, "UPDATE app_users SET email = 'rieng.tu@example.edu.vn' WHERE id = $1", [f.S1.id]);
    // --- CSV
    const exp = await download(f.root, '/api/platform/research/export');
    expect(exp.status).toBe(200);
    expect(exp.type).toContain('text/csv');
    expect(exp.disposition).toMatch(/du-lieu-nghien-cuu-\d{4}-\d{2}-\d{2}\.csv/);
    const lines = exp.text.replace(/^﻿/, '').trim().split(/\r?\n/);
    const dict = (await root('GET', '/api/platform/research/dictionary')).body;
    expect(lines[0].split(',')).toEqual(dict.map((d: any) => d.column));
    expect(lines).toHaveLength(1 + 6); // S1, S2, S4 (đối chứng) và S5, S6, S7 (thử nghiệm); S3 chưa vào lớp nên không tham gia thí nghiệm
    for (const secret of ['Phạm Minh Một', 'Hoàng Thị Hai', 'Vũ Thị Năm', 'HS8001', 'HS8005', 'rieng.tu@example.edu.vn', 'THCS Học Tập']) expect(exp.text).not.toContain(secret);
    const rows = lines.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [dict[i].column, v])));
    expect(rows.every((r) => /^[0-9a-f]{16}$/.test(r.participant_id) && /^[0-9a-f]{6}$/.test(r.school_code))).toBe(true);
    expect(new Set(rows.map((r) => r.participant_id)).size).toBe(6);
    expect(rows.filter((r) => r.group === 'Đối chứng')).toHaveLength(3);
    expect(rows.filter((r) => r.group === 'Đối chứng').every((r) => r.gamification === '0' && r.ai === '0')).toBe(true);
    expect(rows.filter((r) => r.group === 'Thử nghiệm đầy đủ').every((r) => r.gamification === '1' && r.ai === '1')).toBe(true);
    expect(rows.reduce((n, r) => n + Number(r.events), 0)).toBeGreaterThanOrEqual(46);
    const again = await download(f.root, '/api/platform/research/export');
    expect(again.text.split(/\r?\n/)[1].split(',')[0]).toBe(lines[1].split(',')[0]); // mã ổn định giữa các lần xuất
    const onlyTreat = (await download(f.root, `/api/platform/research/export?group_id=${treat.id}`)).text.trim().split(/\r?\n/);
    expect(onlyTreat).toHaveLength(1 + 3);
    const future = (await download(f.root, '/api/platform/research/export?from=2999-01-01')).text.trim().split(/\r?\n/).slice(1).map((l) => l.split(','));
    expect(future.every((r) => r[6] === '0' && r[8] === '0')).toBe(true); // không có hoạt động trong khoảng này
    expect((await download(f.root, '/api/platform/research/export?from=hôm-qua')).status).toBe(400);
    expect((await download(f.A.token, '/api/platform/research/export')).status).toBe(200);
    expect((await as(f.T1)('GET', '/api/platform/research/dictionary')).status).toBe(403);
    // --- so sánh nhóm
    const cmp = (await root('GET', '/api/platform/research/compare')).body;
    expect(cmp.control).toMatchObject({ name: 'Đối chứng' });
    const c = cmp.groups.find((g: any) => g.name === 'Đối chứng'), t = cmp.groups.find((g: any) => g.name === 'Thử nghiệm đầy đủ');
    expect([c.students, t.students]).toEqual([3, 3]);
    expect(c.is_control).toBe(true);
    expect(c.vs_control).toBeNull();
    expect(c.metrics.avg_percent).toMatchObject({ n: 2, mean: 47.5 }); // S1 = 55, S2 = 40; S4 chưa làm bài nên không tính
    expect(t.metrics.avg_percent.n).toBe(3);
    expect(t.metrics.study_minutes.mean).toBeGreaterThan(c.metrics.study_minutes.mean);
    expect(t.metrics.participation).toMatchObject({ n: 3, mean: 1 });
    expect(c.metrics.participation.mean).toBeCloseTo(2 / 3, 5); // S4 không có hoạt động nào
    expect(t.vs_control.study_minutes.diff).toBeGreaterThan(0);
    expect(typeof t.vs_control.study_minutes.p).toBe('number');
    expect(t.vs_control.study_minutes.p).toBeLessThan(0.05);
    expect(t.vs_control.study_minutes.cohen_d).toBeGreaterThan(1);
    expect(t.vs_control.avg_percent.diff).toBeGreaterThan(20);
    expect(cmp.notes.join(' ')).toContain('dưới 10 học sinh'); // nhóm nhỏ được cảnh báo
    expect(cmp.metrics.map((m: any) => m.key)).toEqual(['avg_percent', 'study_minutes', 'active_days', 'progress_percent', 'participation']);
    // chọn nhóm đối chứng khác; lọc theo khoảng ngày
    const swapped = (await root('GET', `/api/platform/research/compare?control=${treat.id}`)).body;
    expect(swapped.control.name).toBe('Thử nghiệm đầy đủ');
    expect(swapped.groups.find((g: any) => g.name === 'Đối chứng').vs_control.study_minutes.diff).toBeLessThan(0);
    expect((await root('GET', '/api/platform/research/compare?control=999999')).status).toBe(404);
    const none = (await root('GET', '/api/platform/research/compare?from=2999-01-01')).body;
    expect(none.groups.find((g: any) => g.name === 'Đối chứng').metrics.participation.mean).toBe(0);
    expect((await as(f.A)('GET', '/api/platform/research/compare')).status).toBe(200);
  });
});
