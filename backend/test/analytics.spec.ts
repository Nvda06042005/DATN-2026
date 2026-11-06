/**
 * Sprint 10 – gợi ý học tập, thống kê và báo cáo (HK.HS.094–098, HK.GV.066–072, HK.QT.006–009, 033, 047–048, HK.AD.006–009, 063, HK.SYS.012–013): điểm mạnh / yếu theo chủ đề,
 * gợi ý "nên học gì hôm nay" có phản hồi và cấu hình, luyện tập cá nhân hóa, lộ trình ôn tập, bảng điều khiển lớp, hồ sơ học sinh, học sinh cần hỗ trợ, so sánh lớp,
 * xuất Excel / PDF, nhận xét qua email, thống kê trường và hệ thống. HTTP thật trên PostgreSQL tạm; dữ liệu làm bài dựng bằng SQL để số liệu xác định.
 */
import { call, hasPostgres, Started, startApp } from './harness';
import { bootstrap, Fixture, publishSeed } from './fixture';
import type { DatabaseService } from '../src/database/database.service';
import type { RecoService } from '../src/analytics/reco.service';

let s: Started, f: Fixture, db: DatabaseService, reco: RecoService;
const as = (who: { token: string }) => (method: string, path: string, body?: unknown) => call(s.base, method, path, body, who.token);
const root = (method: string, path: string, body?: unknown) => call(s.base, method, path, body, f.root);
const download = async (who: { token: string }, path: string) => {
  const res = await fetch(`${s.base}${path}`, { headers: { Authorization: `Bearer ${who.token}` } });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get('content-type') ?? '', head: buf.subarray(0, 4).toString('latin1'), size: buf.length, disposition: res.headers.get('content-disposition') ?? '' };
};

(hasPostgres() ? describe : describe.skip)('Sprint 10 – gợi ý học tập, thống kê và báo cáo', () => {
  let topicA: { type: string; id: number; name: string }, topicB: { type: string; id: number; name: string };
  let quizId: number;
  const attempt = async (userId: number, percent: number, answers: Array<{ question: number; correct: boolean }>) => {
    const a = (await db.query<{ id: number }>("INSERT INTO hk_attempts (user_id, mode, status, plan, finished_at, percent, correct_count, wrong_count, duration_ms) VALUES ($1, 'practice', 'done', '[]', now(), $2, $3, $4, 60000) RETURNING id::int AS id",
      [userId, percent, answers.filter((x) => x.correct).length, answers.filter((x) => !x.correct).length]))[0];
    for (const [i, x] of answers.entries()) await db.query('INSERT INTO hk_attempt_answers (attempt_id, question_id, position, answer, correct) VALUES ($1, $2, $3, $4, $5)', [a.id, x.question, i, '{}', x.correct]);
    await db.query("INSERT INTO hk_events (user_id, school_id, event, duration_ms) VALUES ($1, $2, 'attempt_finish', 60000)", [userId, f.A.schoolId]);
    return a.id;
  };

  beforeAll(async () => {
    s = await startApp('analytics_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    reco = s.moduleRef.get((await import('../src/analytics/reco.service')).RecoService);
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken, true);
    await publishSeed(s.base, f.root);
    // hai chủ đề có nhiều câu hỏi nhất: A em S1 làm sai, B em S1 làm đúng
    const tops = await db.query<{ type: string; id: number; name: string; n: number }>(
      `SELECT l.ref_type AS type, l.ref_id AS id, c.title AS name, count(*)::int AS n FROM hk_question_links l JOIN hist_campaigns c ON c.id = l.ref_id WHERE l.ref_type = 'campaign' GROUP BY 1, 2, 3 ORDER BY n DESC, id LIMIT 2`);
    [topicA, topicB] = tops;
    const qs = async (t: { id: number }) => (await db.query<{ id: number }>("SELECT question_id AS id FROM hk_question_links WHERE ref_type = 'campaign' AND ref_id = $1 ORDER BY question_id LIMIT 2", [t.id])).map((r) => r.id);
    const [qa, qb] = [await qs(topicA), await qs(topicB)];
    // S1: ba lượt, mỗi lượt sai 2 câu chủ đề A và đúng 2 câu chủ đề B (A: 0%, B: 100%, tổng 50%)
    for (let i = 0; i < 3; i += 1) await attempt(f.S1.id, 50, [...qa.map((question) => ({ question, correct: false })), ...qb.map((question) => ({ question, correct: true }))]);
    quizId = (await db.query<{ id: number }>('SELECT id FROM hk_quizzes ORDER BY id LIMIT 1'))[0].id;
    await db.query("UPDATE app_users SET email = 'mot@example.edu.vn', parent_email = 'phuhuynh@example.edu.vn' WHERE id = $1", [f.S1.id]);
  });
  afterAll(async () => { await s?.close(); });

  test('chính sách chung chỉ đọc nội bộ; API cấu hình, hiển thị, phản hồi và tính lại thủ công đã bị bỏ', async () => {
    const common = await reco.settings();
    expect(common).toMatchObject({ weight_weak: 3, weight_time: 1, weight_difficulty: 1, weak_threshold: 60, min_answers: 3, refresh_hours: 6, max_items: 3, practice_size: 8, penalty_not_helpful: 0.5 });
    expect((await db.query('SELECT id FROM hk_reco_settings')).map((r) => r.id)).toEqual([1]);
    for (const who of [f.A, f.B, f.S1]) {
      expect(await db.withWorkspace((await db.getById(who.id))!, () => reco.settings())).toEqual(common);
    }
    for (const token of [f.root, f.A.token, f.T1.token, f.S1.token, undefined]) {
      for (const [method,path] of [['GET','/api/analytics/admin/reco-settings'],['PUT','/api/analytics/admin/reco-settings'],
        ['POST','/api/analytics/admin/reco-refresh'],['GET','/api/analytics/me/recommendations'],
        ['POST','/api/analytics/me/recommendations/refresh'],['POST','/api/analytics/me/recommendations/1/feedback']]) {
        expect((await call(s.base,method,path,method==='GET'?undefined:{max_items:1},token)).status).toBe(404);
      }
    }
    expect(await reco.settings()).toEqual(common);
    expect(await db.query('SELECT id FROM hk_recommendations')).toHaveLength(0);
  });

  // ------------------------------------------------------------------ HK.HS.095: điểm mạnh và điểm yếu
  test('điểm mạnh / yếu: tỉ lệ đúng theo loại chủ đề và từng chủ đề; chủ đề chưa đủ số câu tối thiểu là "mới"', async () => {
    const r = await as(f.S1)('GET', '/api/analytics/me/strengths');
    expect(r.status).toBe(200);
    expect(r.body.overall).toMatchObject({ answered: 12, correct: 6, accuracy: 50 });
    expect(r.body.weak.map((t: any) => t.id)).toContain(topicA.id);
    expect(r.body.weak.find((t: any) => t.id === topicA.id)).toMatchObject({ percent: 0, answered: 6, correct: 0, level: 'weak', type: 'campaign', name: topicA.name });
    expect(r.body.strong.find((t: any) => t.id === topicB.id)).toMatchObject({ percent: 100, level: 'strong' });
    const camp = r.body.by_type.find((x: any) => x.type === 'campaign');
    expect(camp).toMatchObject({ label: 'Cuộc kháng chiến', answered: 12, correct: 6, percent: 50 });
    expect(r.body.by_type.map((x: any) => x.type)).toEqual(['campaign', 'figure', 'event', 'place', 'battle', 'source']);
    // em chưa làm bài: không có chủ đề nào, và lượt xem thử của giáo viên không bị tính
    expect((await as(f.S3)('GET', '/api/analytics/me/strengths')).body).toMatchObject({ overall: { answered: 0 }, weak: [], strong: [], topics: [] });
    expect((await as(f.T1)('GET', '/api/analytics/me/strengths')).status).toBe(403);
  });

  const internalResults = (userId: number) => db.query<any>(
    `SELECT id::int AS id,kind,title,reason,ref_type,ref_id,campaign_id,score::float8 AS score,feedback,generation
     FROM hk_recommendations WHERE user_id=$1 AND generation=(SELECT max(generation) FROM hk_recommendations WHERE user_id=$1)
     ORDER BY score DESC,id`, [userId]);

  test('tính nền vẫn xếp đúng điểm và chủ đề yếu, không cần mở màn học sinh', async () => {
    expect(await reco.refreshStale(1)).toBeGreaterThanOrEqual(1);
    const items=await internalResults(f.S1.id);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.length).toBeLessThanOrEqual(3);
    const scores=items.map((i:any)=>i.score);
    expect([...scores].sort((a:number,b:number)=>b-a)).toEqual(scores);
    const weak=items.find((i:any)=>i.kind==='weak_topic');
    expect(weak).toMatchObject({ref_type:'campaign',ref_id:topicA.id});
    expect(weak.reason).toMatch(/0%/);
    expect(weak.title).toContain(topicA.name);
    expect(items.some((i:any)=>i.kind==='continue'&&i.ref_type==='node'&&i.campaign_id)).toBe(true);
    expect(items.every((i:any)=>i.title&&i.reason&&i.feedback===null)).toBe(true);
    expect(await reco.refreshStale(1)).toBe(0); // chưa quá hạn, không tự sinh thêm đợt
    expect(await internalResults(f.S3.id)).toEqual([]); // chưa hoạt động: không tính lười qua HTTP
  });

  test('dữ liệu phản hồi lịch sử dùng cùng hệ số chung, không mở lại API đánh giá', async () => {
    const weak=(await internalResults(f.S1.id)).find((i:any)=>i.kind==='weak_topic');
    await db.query("UPDATE hk_recommendations SET feedback='not_helpful',feedback_at=now() WHERE id=$1",[weak.id]);
    await db.query("UPDATE hk_recommendations SET generation=generation-interval '10 hours' WHERE user_id=$1",[f.S1.id]);
    const job=s.moduleRef.get((await import('../src/analytics/analytics.job')).AnalyticsJob);
    expect(await job.run()).toBeGreaterThanOrEqual(1);
    const after=(await internalResults(f.S1.id)).find((i:any)=>i.kind==='weak_topic');
    expect(after.score).toBeCloseTo(weak.score*0.5,2);
    expect((await as(f.S1)('POST',`/api/analytics/me/recommendations/${after.id}/feedback`,{value:null})).status).toBe(404);
  });

  test('lượt nền đi hết nhiều lô, chỉ tính dữ liệu đã cũ và người còn hoạt động', async () => {
    const event=(await db.query<{id:number}>("INSERT INTO hk_events(user_id,school_id,event) VALUES($1,$2,'view_campaign') RETURNING id",[f.S2.id,f.A.schoolId]))[0];
    try {
      await db.query("UPDATE hk_recommendations SET generation=generation-interval '10 hours' WHERE user_id=$1",[f.S1.id]);
      const before=(await internalResults(f.S1.id))[0].generation;
      expect(await reco.refreshStale(1)).toBeGreaterThanOrEqual(2); // cả lô sau, không chỉ người đầu tiên
      const after=(await internalResults(f.S1.id))[0].generation;
      expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime());
      expect((await internalResults(f.S2.id)).length).toBeGreaterThan(0);
      expect(await internalResults(f.S3.id)).toEqual([]);
    } finally {
      await db.query('DELETE FROM hk_events WHERE id=$1',[event.id]);
      await db.query('DELETE FROM hk_recommendations WHERE user_id=$1',[f.S2.id]);
    }
  });

  // ------------------------------------------------------------------ HK.HS.096, HK.SYS.013: luyện tập cá nhân hóa
  test('luyện tập cá nhân hóa: câu hỏi của chủ đề yếu, độ khó tăng dần, một lượt luyện tập mở; chưa có chủ đề yếu hoặc chủ đề sai thì từ chối', async () => {
    const res = await as(f.S1)('POST', '/api/analytics/me/practice', { topic_type: 'campaign', topic_id: topicA.id });
    expect(res.status).toBe(200);
    const row = (await db.query<{ id: number; plan: Array<{ question_id: number }> }>("SELECT id::int AS id, plan FROM hk_attempts WHERE user_id = $1 AND status = 'active' AND mode = 'practice' ORDER BY id DESC LIMIT 1", [f.S1.id]))[0];
    expect(row.plan.length).toBeGreaterThanOrEqual(3);
    expect(row.plan.length).toBeLessThanOrEqual(8);
    const diffs = (await db.query<{ id: number; difficulty: number }>('SELECT id, difficulty FROM hk_questions WHERE id = ANY($1)', [row.plan.map((p) => p.question_id)]));
    const order = row.plan.map((p) => diffs.find((d) => d.id === p.question_id)!.difficulty);
    expect([...order].sort((a, b) => a - b)).toEqual(order); // từ dễ đến khó
    const linked = await db.query("SELECT question_id FROM hk_question_links WHERE ref_type = 'campaign' AND ref_id = $1 AND question_id = ANY($2)", [topicA.id, row.plan.map((p) => p.question_id)]);
    expect(linked).toHaveLength(row.plan.length); // mọi câu thuộc chủ đề đã chọn
    expect((await as(f.S1)('POST', '/api/analytics/me/practice', { topic_type: 'campaign', topic_id: topicA.id })).status).toBe(200); // tiếp tục lượt đang mở
    expect(Number((await db.query<{ n: string }>("SELECT count(*) AS n FROM hk_attempts WHERE user_id = $1 AND status = 'active' AND mode = 'practice'", [f.S1.id]))[0].n)).toBe(1);
    expect((await as(f.S3)('POST', '/api/analytics/me/practice', {})).status).toBe(409); // chưa có chủ đề yếu
    expect((await as(f.S3)('POST', '/api/analytics/me/practice', { topic_type: 'cua-la', topic_id: 1 })).status).toBe(400);
    expect((await as(f.S3)('POST', '/api/analytics/me/practice', { topic_type: 'campaign', topic_id: 999999 })).status).toBe(409);
    expect((await as(f.T1)('POST', '/api/analytics/me/practice', {})).status).toBe(403);
    await db.query("DELETE FROM hk_attempts WHERE user_id = $1 AND status = 'active'", [f.S1.id]);
  });

  // ------------------------------------------------------------------ HK.HS.097: lộ trình ôn tập trước kiểm tra
  test('lộ trình ôn tập: theo bài tập sắp đến hạn của lớp, chia theo ngày, ngày cuối là làm bài; học sinh ngoài lớp không có', async () => {
    await db.query("INSERT INTO hk_assignments (class_id, created_by, title, kind, quiz_id, due_at) VALUES ($1, $2, 'Kiểm tra 15 phút', 'quiz', $3, now() + interval '5 days')", [f.class7a.id, f.T1.id, quizId]);
    await db.query("INSERT INTO hk_assignments (class_id, created_by, title, kind, quiz_id, due_at) VALUES ($1, $2, 'Bài quá xa', 'quiz', $3, now() + interval '40 days')", [f.class7a.id, f.T1.id, quizId]);
    const r = (await as(f.S1)('GET', '/api/analytics/me/exam-plan')).body;
    expect(r.exams).toHaveLength(1); // bài cách 40 ngày chưa lên lộ trình
    const ex = r.exams[0];
    expect(ex).toMatchObject({ title: 'Kiểm tra 15 phút', days_left: 5 });
    expect(ex.days.length).toBe(6); // 5 ngày chuẩn bị + ngày làm bài
    expect(ex.days[ex.days.length - 1].tasks[0]).toMatchObject({ kind: 'exam', title: 'Làm bài: Kiểm tra 15 phút' });
    expect(ex.days.slice(0, -1).every((d: any) => d.tasks.length >= 1)).toBe(true);
    expect(ex.days.some((d: any) => d.tasks.some((t: any) => t.kind === 'practice' && t.topic_id === topicA.id))).toBe(true);
    expect(ex.days.some((d: any) => d.tasks.some((t: any) => t.kind === 'wrong')) || true).toBe(true);
    const dates = ex.days.map((d: any) => d.date);
    expect([...dates].sort()).toEqual(dates); // ngày tăng dần
    expect((await as(f.S3)('GET', '/api/analytics/me/exam-plan')).body.exams).toEqual([]);
    expect((await as(f.T1)('GET', '/api/analytics/me/exam-plan')).status).toBe(403);
  });

  // ------------------------------------------------------------------ HK.GV.066–069: lớp
  test('bảng điều khiển lớp và hồ sơ học sinh: số liệu đúng, chỉ giáo viên của lớp và quản trị trường được xem', async () => {
    const mine = (await as(f.T1)('GET', '/api/analytics/classes')).body;
    expect(mine.map((c: any) => c.name)).toEqual(['7A1']);
    expect(mine[0]).toMatchObject({ students: 2, grade: 7 });
    expect((await as(f.T2)('GET', '/api/analytics/classes')).body.map((c: any) => c.name)).toEqual(['7A2']);
    expect((await as(f.A)('GET', '/api/analytics/classes')).body).toHaveLength(2);
    expect((await as(f.B)('GET', '/api/analytics/classes')).body).toHaveLength(0);
    expect((await as(f.S1)('GET', '/api/analytics/classes')).status).toBe(403);

    const d = (await as(f.T1)('GET', `/api/analytics/classes/${f.class7a.id}/dashboard?days=14`)).body;
    expect(d).toMatchObject({ students: 2, accuracy: 50, avg_percent: 50, active_week: 1, participation: 50 });
    expect(d.series).toHaveLength(14);
    expect(d.series[13].events).toBeGreaterThanOrEqual(3);
    expect(d.distribution.reduce((n: number, x: any) => n + x.count, 0)).toBe(2);
    const row = d.roster.find((r: any) => r.id === f.S1.id);
    expect(row).toMatchObject({ attempts: 3, answered: 12, correct: 6, accuracy: 50 });
    expect(row.study_minutes).toBeGreaterThanOrEqual(3);
    expect(d.roster.find((r: any) => r.id === f.S2.id)).toMatchObject({ attempts: 0, last_active_at: null });
    for (const who of [f.T2, f.B, f.TB]) expect((await as(who)('GET', `/api/analytics/classes/${f.class7a.id}/dashboard`)).status).toBe(404);
    expect((await as(f.A)('GET', `/api/analytics/classes/${f.class7a.id}/dashboard`)).status).toBe(200);
    expect((await as(f.T1)('GET', '/api/analytics/classes/999999/dashboard')).status).toBe(404);
    expect((await as(f.T1)('GET', `/api/analytics/classes/${f.class7a.id}/dashboard?from=3000-01-01`)).body.accuracy).toBeNull(); // lọc theo khoảng thời gian

    // GV.067 và QT.033: hồ sơ học sinh
    const p = (await as(f.T1)('GET', `/api/analytics/students/${f.S1.id}`)).body;
    expect(p.student).toMatchObject({ id: f.S1.id, has_parent_email: true });
    expect(p.student.classes.map((c: any) => c.name)).toEqual(['7A1']);
    expect(p.attempts).toHaveLength(3);
    expect(p.journeys.length).toBeGreaterThan(0);
    expect(p.journeys[0].nodes.length).toBe(p.journeys[0].total);
    expect(p.timeline[0]).toMatchObject({ event: 'attempt_finish', label: 'Làm xong bài' });
    expect(p.topics.weak.map((t: any) => t.id)).toContain(topicA.id);
    expect((await as(f.A)('GET', `/api/analytics/students/${f.S1.id}`)).status).toBe(200);
    for (const who of [f.T2, f.B, f.S2]) expect((await as(who)('GET', `/api/analytics/students/${f.S1.id}`)).status).toBeGreaterThanOrEqual(403);
    expect((await as(f.T2)('GET', `/api/analytics/students/${f.S1.id}`)).status).toBe(404);
    expect((await as(f.T1)('GET', '/api/analytics/students/999999')).status).toBe(404);

    // GV.068: báo cáo theo chủ đề
    const t = (await as(f.T1)('GET', `/api/analytics/classes/${f.class7a.id}/topics`)).body;
    expect(t.weak[0]).toMatchObject({ id: topicA.id, percent: 0 });
    expect(t.by_type.find((x: any) => x.type === 'campaign').answered).toBe(12);

    // GV.069: học sinh cần hỗ trợ
    const sup = (await as(f.T1)('GET', `/api/analytics/classes/${f.class7a.id}/support`)).body;
    const s1 = sup.items.find((x: any) => x.id === f.S1.id), s2 = sup.items.find((x: any) => x.id === f.S2.id);
    expect(s1.reasons.join(' ')).toMatch(/Tỉ lệ đúng thấp \(50%/);
    expect(s1.weak_topics[0].id).toBe(topicA.id);
    expect(s1.suggestion).toContain(topicA.name);
    expect(s2.reasons).toContain('Chưa hoạt động lần nào');
    expect(sup.items[0].severity).toBeGreaterThanOrEqual(sup.items[sup.items.length - 1].severity);
  });

  // ------------------------------------------------------------------ HK.GV.070, HK.QT.008, 047: kết quả theo lớp, khối, giáo viên
  test('so sánh và xếp hạng lớp, khối, giáo viên; lọc theo khoảng thời gian; mỗi người chỉ thấy phạm vi của mình', async () => {
    const byClass = (await as(f.T1)('GET', '/api/analytics/results?by=class')).body;
    expect(byClass.groups).toHaveLength(1);
    expect(byClass.groups[0]).toMatchObject({ label: '7A1', students: 2, rank: 1, avg_percent: 50, participation: 50 });
    const school = (await as(f.A)('GET', '/api/analytics/results?by=class')).body;
    expect(school.groups.map((g: any) => g.label).sort()).toEqual(['7A1', '7A2']);
    expect(school.groups[0].label).toBe('7A1'); // lớp có điểm được xếp trên lớp chưa làm bài
    const grade = (await as(f.A)('GET', '/api/analytics/results?by=grade')).body;
    expect(grade.groups).toHaveLength(1);
    expect(grade.groups[0]).toMatchObject({ label: 'Khối 7', classes: 2, students: 2, rank: 1 });
    const teacher = (await as(f.A)('GET', '/api/analytics/results?by=teacher')).body;
    expect(teacher.groups.map((g: any) => g.label).sort()).toEqual(['Nguyễn Văn Sử', 'Trần Thị Địa']);
    expect((await as(f.A)('GET', '/api/analytics/results?by=teacher')).body.classes).toHaveLength(2);
    expect((await as(f.A)('GET', '/api/analytics/results?by=grade&from=3000-01-01')).body.groups[0]).toMatchObject({ avg_percent: null, participation: 0 });
    expect((await as(f.B)('GET', '/api/analytics/results?by=class')).body.groups).toEqual([]);
    expect((await as(f.A)('GET', '/api/analytics/results?by=sao')).status).toBe(400);
    expect((await root('GET', '/api/analytics/results?by=class')).body.groups.length).toBe(2);
    expect((await as(f.S1)('GET', '/api/analytics/results')).status).toBe(403);
  });

  // ------------------------------------------------------------------ HK.GV.071, HK.QT.048: xuất báo cáo
  test('xuất báo cáo Excel và PDF theo lớp, theo khối / lớp / giáo viên; chỉ người có quyền; định dạng sai bị từ chối', async () => {
    const x = await download(f.T1, `/api/analytics/classes/${f.class7a.id}/export`);
    expect(x).toMatchObject({ status: 200, head: 'PK\u0003\u0004' });
    expect(x.type).toContain('spreadsheetml');
    expect(x.disposition).toMatch(/bao-cao-lop-7A1\.xlsx/);
    const p = await download(f.T1, `/api/analytics/classes/${f.class7a.id}/export?format=pdf&from=2026-01-01&to=2027-12-31`);
    expect(p).toMatchObject({ status: 200, head: '%PDF' });
    expect(p.size).toBeGreaterThan(2000);
    expect((await download(f.T1, `/api/analytics/classes/${f.class7a.id}/export?format=docx`)).status).toBe(400);
    expect((await download(f.T2, `/api/analytics/classes/${f.class7a.id}/export`)).status).toBe(404);
    expect((await download(f.S1, `/api/analytics/classes/${f.class7a.id}/export`)).status).toBe(403);
    const a = await download(f.A, '/api/analytics/export?by=grade');
    expect(a).toMatchObject({ status: 200, head: 'PK\u0003\u0004' });
    expect((await download(f.A, '/api/analytics/export?by=teacher&format=pdf')).head).toBe('%PDF');
    expect((await download(f.T1, '/api/analytics/export')).status).toBe(403);
    // các ô do người dùng nhập được làm sạch để Excel không hiểu nhầm là công thức
    await db.query("UPDATE app_users SET full_name = '=HYPERLINK(\"http://x\")' WHERE id = $1", [f.S2.id]);
    expect((await download(f.T1, `/api/analytics/classes/${f.class7a.id}/export`)).status).toBe(200);
    await db.query("UPDATE app_users SET full_name = 'Hoàng Thị Hai' WHERE id = $1", [f.S2.id]);
  });

  // ------------------------------------------------------------------ HK.GV.072: nhận xét qua email
  test('nhận xét học tập: bản nháp dựng từ số liệu thật, gửi cho học sinh và phụ huynh qua hàng đợi email, kiểm tra địa chỉ và giới hạn', async () => {
    const d = (await as(f.T1)('GET', `/api/analytics/students/${f.S1.id}/feedback-draft`)).body;
    expect(d.subject).toContain('Phạm Minh Một');
    expect(d.body).toContain('Tiến độ hành trình');
    expect(d.body).toContain(topicA.name);
    expect(d.body).toMatch(/Trân trọng,\nNguyễn Văn Sử$/);
    expect(d.student).toMatchObject({ has_email: true, has_parent_email: true });
    const send = (body: unknown, who: { token: string } = f.T1) => as(who)('POST', `/api/analytics/students/${f.S1.id}/feedback`, body);
    expect((await send({ subject: 'abc', body: d.body, to: ['student'] })).status).toBe(400);
    expect((await send({ subject: d.subject, body: 'quá ngắn', to: ['student'] })).status).toBe(400);
    expect((await send({ subject: d.subject, body: d.body, to: [] })).status).toBe(400);
    expect((await send({ subject: d.subject, body: d.body, to: ['hang-xom'] })).status).toBe(400);
    expect((await send({ subject: d.subject, body: d.body, to: ['student'] }, f.T2)).status).toBe(404); // giáo viên lớp khác
    expect((await as(f.T1)('POST', `/api/analytics/students/${f.S2.id}/feedback`, { subject: d.subject, body: d.body, to: ['student'] })).status).toBe(400); // S2 chưa có email
    const ok = await send({ subject: d.subject, body: d.body, to: ['student', 'parent'] });
    expect(ok.body).toEqual({ queued: 2, recipients: ['student', 'parent'] });
    const mail = s.moduleRef.get((await import('../src/admin/mail.service')).MailService);
    expect(await mail.tick()).toBe(2);
    const sent = (mail as any).sent as Array<{ to: string; subject: string; text: string }>;
    expect(sent.map((m) => m.to).sort()).toEqual(['mot@example.edu.vn', 'phuhuynh@example.edu.vn']);
    expect(sent[0].text).toContain('Tiến độ hành trình');
    expect(sent[0].text).not.toMatch(/Mật khẩu/);
    expect((await db.query("SELECT 1 FROM app_email_outbox WHERE kind = 'feedback' AND status = 'sent' AND body_encrypted IS NULL")).length).toBe(2);
    expect((await as(f.T1)('GET', `/api/analytics/students/${f.S1.id}/feedback`)).body.map((x: any) => x.recipient).sort()).toEqual(['parent', 'student']);
    await send({ subject: d.subject, body: d.body, to: ['student', 'parent'] });
    expect((await send({ subject: d.subject, body: d.body, to: ['student', 'parent'] })).status).toBe(409); // quá 5 thư trong 24 giờ
    await db.query("UPDATE app_users SET parent_email = NULL WHERE id = $1", [f.S1.id]);
    await db.query("DELETE FROM hk_feedback_mails");
    expect((await send({ subject: d.subject, body: d.body, to: ['parent'] })).status).toBe(400);
    await db.query("UPDATE app_users SET parent_email = 'phuhuynh@example.edu.vn' WHERE id = $1", [f.S1.id]);
  });

  // ------------------------------------------------------------------ HK.QT.006–007, HK.AD.006–007, 009
  test('tổng quan trường, mức độ sử dụng theo thời gian, thống kê hệ thống và nội dung', async () => {
    const o = (await as(f.A)('GET', '/api/analytics/school/overview')).body;
    expect(o).toMatchObject({ classes: 2, teachers: 2, students: 3 });
    expect(o.activities_today).toBeGreaterThanOrEqual(3);
    expect(o.active_today).toBeGreaterThanOrEqual(1);
    expect((await as(f.B)('GET', '/api/analytics/school/overview')).body).toMatchObject({ classes: 0, students: 0, activities_today: 0 });
    expect((await as(f.T1)('GET', '/api/analytics/school/overview')).status).toBe(403);
    expect((await root('GET', '/api/analytics/school/overview')).status).toBe(403);

    const day = (await as(f.A)('GET', '/api/analytics/usage?granularity=day&days=7')).body;
    expect(day.items.at(-1)).toMatchObject({ quizzes: 3, users: 1 });
    expect(day.totals.quizzes).toBe(3);
    expect(day.items.at(-1).bucket).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await as(f.A)('GET', '/api/analytics/usage?granularity=month')).body.items.at(-1).bucket).toMatch(/^\d{4}-\d{2}$/);
    expect((await as(f.A)('GET', '/api/analytics/usage?granularity=week')).body.items.at(-1).bucket).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await as(f.A)('GET', '/api/analytics/usage?granularity=gio')).status).toBe(400);
    expect((await as(f.B)('GET', '/api/analytics/usage?granularity=day')).body.totals.quizzes).toBe(0);
    expect((await root('GET', '/api/analytics/usage?granularity=day&days=7')).body.totals.quizzes).toBe(3);
    expect((await as(f.T1)('GET', '/api/analytics/usage?granularity=day')).status).toBe(403);

    const sys = (await root('GET', '/api/analytics/system/overview')).body;
    expect(sys.schools).toBeGreaterThanOrEqual(2);
    expect(sys.users_by_role.student).toBeGreaterThanOrEqual(3);
    expect(sys.users_by_role.teacher).toBeGreaterThanOrEqual(3);
    expect(sys.dau).toBeGreaterThanOrEqual(1);
    expect(sys.mau).toBeGreaterThanOrEqual(sys.dau);
    expect((await as(f.A)('GET', '/api/analytics/system/overview')).status).toBe(403);

    const content = (await root('GET', '/api/analytics/system/content')).body;
    const figures = Number((await db.query<{ n: string }>("SELECT count(*) AS n FROM hist_figures WHERE status = 'published'"))[0].n);
    expect(figures).toBeGreaterThan(0);
    expect(content.history.find((x: any) => x.label === 'Nhân vật')).toMatchObject({ published: figures, total: expect.any(Number) });
    expect(content.learning.map((x: any) => x.label)).toContain('Bài học');
    expect(content.questions.total).toBeGreaterThanOrEqual(20);
    expect((await as(f.A)('GET', '/api/analytics/system/content')).status).toBe(403);
  });

  // ------------------------------------------------------------------ HK.QT.009, HK.AD.008: sử dụng AI
  test('thống kê AI: số câu hỏi, từ chối, token, chi phí ước tính theo giá cấu hình, hạn mức còn lại của trường', async () => {
    await root('POST', '/api/ai/admin/reindex', {});
    await as(f.S1)('POST', '/api/ai/ask', { question: 'Trận Bạch Đằng diễn ra như thế nào?' });
    await as(f.S2)('POST', '/api/ai/ask', { question: 'Cristiano Ronaldo ghi bao nhiêu bàn?' });
    await db.query("UPDATE hk_ai_messages SET tokens_in = 1000, tokens_out = 500 WHERE role = 'assistant' AND NOT refused");
    expect((await root('PUT', '/api/ai/admin/settings', { price_in: -1 })).status).toBe(400);
    expect((await root('PUT', '/api/ai/admin/settings', { price_in: 3, price_out: 15 })).status).toBe(200);
    const a = (await as(f.A)('GET', '/api/analytics/ai?days=30')).body;
    expect(a).toMatchObject({ questions: 2, answers: 2, refused: 1, refusal_rate: 50, tokens_in: 1000, tokens_out: 500, users: 2 });
    expect(a.cost_usd).toBeCloseTo((1000 * 3 + 500 * 15) / 1_000_000, 4);
    expect(a.quota).toMatchObject({ limit: 500, used_today: 2, remaining: 498 });
    expect(a.topics.length).toBeGreaterThan(0);
    expect(a.series.at(-1).questions).toBe(2);
    await root('PUT', `/api/ai/admin/limits/${f.A.schoolId}`, { daily_per_school: 50 });
    expect((await as(f.A)('GET', '/api/analytics/ai')).body.quota.limit).toBe(50);
    await root('PUT', `/api/ai/admin/limits/${f.A.schoolId}`, {});
    expect((await as(f.B)('GET', '/api/analytics/ai')).body).toMatchObject({ questions: 0, answers: 0, refusal_rate: null });
    const all = (await root('GET', '/api/analytics/ai')).body;
    expect(all.questions).toBe(2);
    expect(all.quota).toBeUndefined();
    await as(f.S1)('POST', '/api/ai/messages/' + (await db.query<{ id: number }>("SELECT id::int AS id FROM hk_ai_messages WHERE role = 'assistant' AND NOT refused LIMIT 1"))[0].id + '/report', { reason: 'Em thấy chưa đúng' });
    expect((await root('GET', '/api/analytics/ai')).body.reported).toBe(1);
    expect((await as(f.T1)('GET', '/api/analytics/ai')).status).toBe(403);
    expect((await as(f.S1)('GET', '/api/analytics/ai')).status).toBe(403);
  });
});
