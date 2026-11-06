/**
 * Sprint 7, bài tập (HK.GV.045–050, HK.HS.100–102): giáo viên giao bộ đề, mini-game hoặc bài học cho cả lớp / đội / học sinh với hạn nộp, số lần làm, điểm thưởng;
 * theo dõi nộp bài, gia hạn – đổi phạm vi – thu hồi, chấm điểm và nhận xét, nhắc học sinh chưa nộp; học sinh làm bài, xem điểm và nhận xét.
 * HTTP thật trên PostgreSQL tạm; nội dung học và mini-game khởi tạo (migration 019, 023) được dùng làm nội dung bài tập.
 */
import * as ExcelJS from 'exceljs';
import { call, download, hasPostgres, Started, startApp } from './harness';
import { bootstrap, Fixture, publishSeed } from './fixture';
import type { DatabaseService } from '../src/database/database.service';
import type { GameClock } from '../src/game/clock';

let s: Started, f: Fixture, db: DatabaseService, clock: GameClock;
const DAY = 86_400_000;
const as = (who: { token: string }) => (method: string, path: string, body?: unknown) => call(s.base, method, path, body, who.token);
const api = (method: string, path: string, body?: unknown, token = f.T1.token) => call(s.base, method, path, body, token);
const due = (days: number) => new Date(clock.now().getTime() + days * DAY).toISOString();
const keys = new Map<number, { qtype: string; data: any }>();
const hud = async (who: { token: string }) => (await as(who)('GET', '/api/game/me')).body;
const notes = async (who: { token: string }) => (await as(who)('GET', '/api/classroom/notifications')).body;
const mine = async (who: { token: string }) => (await as(who)('GET', '/api/classroom/my-assignments')).body as any[];

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

async function playQuiz(who: { token: string }, start: any, right: (index: number) => boolean = () => true) {
  let state = start;
  let last: any;
  for (let i = 0; i < state.total; i++) {
    if (state.waiting_next) state = (await as(who)('POST', `/api/play/attempts/${state.id}/next`)).body;
    const q = state.current.question;
    last = (await as(who)('POST', `/api/play/attempts/${state.id}/answer`, { question_id: q.id, answer: answerOf(q.id, right(i)) })).body;
    if (last.finished) break;
    state = { ...state, waiting_next: true };
  }
  return last;
}

(hasPostgres() ? describe : describe.skip)('Sprint 7 – bài tập', () => {
  let classId: number, quizId: number, lessonId: number, matchId: number, team: { id: number };
  let a1: any; // bài tập bộ đề cho cả lớp, dùng xuyên suốt các bài kiểm thử
  beforeAll(async () => {
    s = await startApp('assignments_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    clock = s.moduleRef.get((await import('../src/game/clock')).GameClock);
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken, true);
    await publishSeed(s.base, f.root);
    classId = f.class7a.id;
    for (const row of await db.query<{ id: number; qtype: string; data: any }>('SELECT id, qtype, data FROM hk_questions')) keys.set(row.id, row);
    quizId = (await db.query<{ id: number }>("SELECT z.id FROM hk_quizzes z WHERE z.scope = 'system' AND (SELECT count(*) FROM hk_quiz_questions k WHERE k.quiz_id = z.id) >= 3 ORDER BY z.id LIMIT 1"))[0].id;
    lessonId = (await db.query<{ id: number }>("SELECT id FROM hk_lessons WHERE status = 'published' ORDER BY id LIMIT 1"))[0].id;
    matchId = (await db.query<{ id: number }>("SELECT id FROM hk_minigames WHERE kind = 'match' ORDER BY id LIMIT 1"))[0].id;
    // lớp 7A1 có S1, S2, S3; đội 1 gồm S1 và S2, S3 không thuộc đội nào
    await api('POST', `/api/classroom/classes/${classId}/students`, { student_ids: [f.S3.id] });
    team = (await api('PUT', `/api/classroom/classes/${classId}/teams`, { teams: [{ name: 'Đội Một', member_ids: [f.S1.id, f.S2.id] }] })).body[0];
  });
  afterAll(async () => { clock?.reset(); await s?.close(); });

  // ------------------------------------------------------------------ HK.GV.046
  test('HK.GV.046 giao bộ đề: kiểm tra đầu vào, thông báo cho đúng nhóm học sinh, danh sách có tỷ lệ nộp', async () => {
    const base = { title: 'Ôn tập Kháng chiến lần 1', kind: 'quiz', quiz_id: quizId, due_at: due(5), max_attempts: 2, bonus_points: 40 };
    const bad: Array<[string, Record<string, unknown>]> = [
      ['thiếu tên', { ...base, title: ' ' }],
      ['loại lạ', { ...base, kind: 'essay' }],
      ['hạn đã qua', { ...base, due_at: due(-1) }],
      ['hạn quá một năm', { ...base, due_at: due(400) }],
      ['hạn sai định dạng', { ...base, due_at: 'mai' }],
      ['0 lần làm', { ...base, max_attempts: 0 }],
      ['11 lần làm', { ...base, max_attempts: 11 }],
      ['thưởng âm', { ...base, bonus_points: -1 }],
      ['thưởng quá lớn', { ...base, bonus_points: 501 }],
      ['đội không có', { ...base, audience: 'team', team_ids: [] }],
      ['đội của lớp khác', { ...base, audience: 'team', team_ids: [987654] }],
      ['học sinh ngoài lớp', { ...base, audience: 'students', student_ids: [f.TB.id] }],
      ['phạm vi lạ', { ...base, audience: 'school' }],
      ['bộ đề không tồn tại', { ...base, quiz_id: 987654 }],
    ];
    for (const [name, body] of bad) expect([name, (await api('POST', `/api/classroom/classes/${classId}/assignments`, body)).status >= 400]).toEqual([name, true]);
    expect((await api('POST', `/api/classroom/classes/${classId}/assignments`, base, f.T2.token)).status).toBe(404); // giáo viên không phụ trách lớp
    expect((await api('POST', `/api/classroom/classes/${classId}/assignments`, base, f.S1.token)).status).toBe(403);

    const res = await api('POST', `/api/classroom/classes/${classId}/assignments`, base);
    expect(res.status).toBe(201);
    a1 = res.body;
    expect(a1).toMatchObject({ title: 'Ôn tập Kháng chiến lần 1', kind: 'quiz', audience: 'class', max_attempts: 2, bonus_points: 40, status: 'active', overdue: false, summary: { total: 3, submitted: 0, graded: 0, late: 0 } });
    expect(a1.students.map((x: any) => x.state)).toEqual(['todo', 'todo', 'todo']);
    for (const who of [f.S1, f.S2, f.S3]) expect((await notes(who)).items[0]).toMatchObject({ kind: 'assignment', title: 'Bài tập mới: Ôn tập Kháng chiến lần 1', class_name: '7A1' });

    // giao riêng cho đội và cho một học sinh: chỉ nhóm đó nhận thông báo và thấy bài
    const forTeam = (await api('POST', `/api/classroom/classes/${classId}/assignments`, { ...base, title: 'Bài của Đội Một', audience: 'team', team_ids: [team.id], bonus_points: 0 })).body;
    expect(forTeam.summary.total).toBe(2);
    const forOne = (await api('POST', `/api/classroom/classes/${classId}/assignments`, { ...base, title: 'Bài riêng cho Ba', audience: 'students', student_ids: [f.S3.id], bonus_points: 0 })).body;
    expect(forOne.summary.total).toBe(1);
    expect((await mine(f.S1)).map((x) => x.title).sort()).toEqual(['Bài của Đội Một', 'Ôn tập Kháng chiến lần 1']);
    expect((await mine(f.S3)).map((x) => x.title).sort()).toEqual(['Bài riêng cho Ba', 'Ôn tập Kháng chiến lần 1']);
    expect((await notes(f.S3)).items.filter((n: any) => n.kind === 'assignment').map((n: any) => n.title)).toEqual(expect.arrayContaining(['Bài tập mới: Bài riêng cho Ba']));
    expect((await notes(f.S1)).items.some((n: any) => /Bài riêng cho Ba/.test(n.title))).toBe(false);

    const list = (await api('GET', `/api/classroom/classes/${classId}/assignments`)).body;
    expect(list).toHaveLength(3);
    expect(list.find((x: any) => x.id === a1.id)).toMatchObject({ kind_label: 'Bộ đề', audience_size: 3, submitted: 0, rate: 0, overdue: false });
    expect(list.find((x: any) => x.id === forTeam.id)).toMatchObject({ audience: 'team', audience_size: 2 });
    expect((await api('GET', `/api/classroom/classes/${classId}/assignments`, undefined, f.TB.token)).status).toBe(404);
    expect((await api('GET', `/api/classroom/assignments/${a1.id}`, undefined, f.TB.token)).status).toBe(404);
    // bài của đội chưa ai nộp nên thu hồi được; thu hồi xong học sinh không còn thấy
    expect((await api('POST', `/api/classroom/assignments/${forTeam.id}/revoke`)).body.status).toBe('revoked');
    expect((await api('POST', `/api/classroom/assignments/${forTeam.id}/revoke`)).status).toBe(409);
    expect((await mine(f.S1)).map((x) => x.title)).toEqual(['Ôn tập Kháng chiến lần 1']);
    expect((await api('PUT', `/api/classroom/assignments/${forTeam.id}`, { max_attempts: 3 })).status).toBe(409);
    expect((await notes(f.S2)).items.find((n: any) => /thu hồi/.test(n.title))).toMatchObject({ kind: 'assignment' });
  });

  // ------------------------------------------------------------------ HK.HS.100–102 bộ đề
  test('HK.HS.100/101 học sinh xem bài tập và làm bộ đề: nộp đúng hạn được thưởng điểm một lần; hết lượt thì không làm thêm', async () => {
    const before = await mine(f.S1);
    expect(before.find((x) => x.id === a1.id)).toMatchObject({ state: 'todo', attempts: 0, attempts_left: 2, kind_label: 'Bộ đề', class_name: '7A1', content_title: expect.any(String), grade: null });
    expect((await as(f.S1)('GET', `/api/classroom/my-assignments/${a1.id}`)).body.id).toBe(a1.id);
    expect((await as(f.S1)('GET', '/api/classroom/my-assignments/999999')).status).toBe(404);
    const xp0 = (await hud(f.S1)).xp;

    const start = (await as(f.S1)('POST', `/api/classroom/my-assignments/${a1.id}/start`)).body;
    expect(start.kind).toBe('quiz');
    expect(start.attempt).toMatchObject({ mode: 'assignment', status: 'active' });
    // mở lại khi đang làm dở trả về cùng lượt, không tốn thêm lượt
    expect((await as(f.S1)('POST', `/api/classroom/my-assignments/${a1.id}/start`)).body.attempt.id).toBe(start.attempt.id);
    const done = await playQuiz(f.S1, start.attempt, (i) => i !== 0); // sai câu đầu
    expect(done.finished).toBe(true);
    const row = (await mine(f.S1)).find((x) => x.id === a1.id)!;
    expect(row).toMatchObject({ state: 'submitted', attempts: 1, attempts_left: 1, on_time: true });
    expect(row.best_percent).toBeGreaterThan(0);
    expect(row.best_percent).toBeLessThan(100);
    const xp1 = (await hud(f.S1)).xp;
    expect(xp1 - xp0).toBeGreaterThanOrEqual(40); // điểm thưởng đúng hạn (cộng thêm điểm câu hỏi nếu có)
    expect((await notes(f.S1)).items.find((n: any) => n.title === 'Em nhận điểm thưởng bài tập')).toMatchObject({ body: expect.stringMatching(/\+40 điểm/) });
    const bonusRows = async () => Number((await db.query<any>("SELECT count(*) AS n FROM hk_points WHERE user_id = $1 AND reason = 'assignment'", [f.S1.id]))[0].n);
    expect(await bonusRows()).toBe(1);

    // làm lại lần hai: điểm cao nhất được giữ, không thưởng lần nữa; hết lượt
    const again = (await as(f.S1)('POST', `/api/classroom/my-assignments/${a1.id}/start`)).body;
    await playQuiz(f.S1, again.attempt, () => true);
    const best = (await mine(f.S1)).find((x) => x.id === a1.id)!;
    expect(best).toMatchObject({ attempts: 2, attempts_left: 0, best_percent: 100 });
    expect(await bonusRows()).toBe(1);
    expect((await as(f.S1)('POST', `/api/classroom/my-assignments/${a1.id}/start`)).status).toBe(409);
    expect((await as(f.S3)('POST', `/api/classroom/my-assignments/${a1.id}/start`, undefined)).status).toBe(200); // học sinh khác vẫn làm được
    expect((await call(s.base, 'POST', `/api/classroom/my-assignments/${a1.id}/start`)).status).toBe(401);
    expect((await api('POST', `/api/classroom/my-assignments/${a1.id}/start`)).status).toBe(403); // giáo viên không làm bài tập của học sinh
  });

  test('HK.HS.101 nộp muộn không được thưởng; quá hạn không bắt đầu được; hạn nộp xem được trong danh sách', async () => {
    // đưa hạn nộp về quá khứ sau khi S3 đã bắt đầu (lượt dở vẫn nộp được nhưng tính muộn)
    const open = (await mine(f.S3)).find((x) => x.id === a1.id)!;
    expect(open).toMatchObject({ state: 'todo', attempts: 0 }); // lượt dở chưa tính là lần nộp
    await db.query('UPDATE hk_assignments SET due_at = $2 WHERE id = $1', [a1.id, new Date(clock.now().getTime() - 3_600_000)]);
    const late = (await mine(f.S2)).find((x) => x.id === a1.id)!;
    expect(late.state).toBe('overdue');
    const res = await as(f.S2)('POST', `/api/classroom/my-assignments/${a1.id}/start`);
    expect(res.status).toBe(409);
    expect(res.body.detail ?? res.body.message).toMatch(/quá hạn/);
    // S3 đang làm dở: nộp xong tính là muộn, không có thưởng
    const attempt = (await db.query<{ id: number }>("SELECT id FROM hk_attempts WHERE user_id = $1 AND assignment_id = $2 AND status = 'active'", [f.S3.id, a1.id]))[0];
    const state = (await as(f.S3)('GET', `/api/play/attempts/${attempt.id}`)).body;
    await playQuiz(f.S3, state, () => true);
    const after = (await mine(f.S3)).find((x) => x.id === a1.id)!;
    expect(after).toMatchObject({ state: 'late', on_time: false });
    expect(Number((await db.query<any>("SELECT count(*) AS n FROM hk_points WHERE user_id = $1 AND reason = 'assignment'", [f.S3.id]))[0].n)).toBe(0);
    // danh sách giáo viên: quá hạn, tỷ lệ nộp, trạng thái từng học sinh
    const detail = (await api('GET', `/api/classroom/assignments/${a1.id}`)).body;
    expect(detail.overdue).toBe(true);
    expect(detail.summary).toMatchObject({ total: 3, submitted: 2, late: 1, graded: 0 });
    expect(Object.fromEntries(detail.students.map((x: any) => [x.id, x.state]))).toEqual({ [f.S1.id]: 'submitted', [f.S2.id]: 'todo', [f.S3.id]: 'late' });
    expect((await api('GET', `/api/classroom/classes/${classId}/assignments`)).body.find((x: any) => x.id === a1.id)).toMatchObject({ overdue: true, submitted: 2, rate: 67 });
  });

  // ------------------------------------------------------------------ HK.GV.047
  test('HK.GV.047 gia hạn và đổi phạm vi: hạn mới hợp lệ, số lần làm không thấp hơn số lần đã làm, không đổi nội dung, không bỏ người đã nộp', async () => {
    const newDue = due(3);
    const upd = await api('PUT', `/api/classroom/assignments/${a1.id}`, { due_at: newDue, description: 'Gia hạn thêm 3 ngày', max_attempts: 3 });
    expect(upd.status).toBe(200);
    expect(upd.body).toMatchObject({ overdue: false, max_attempts: 3, description: 'Gia hạn thêm 3 ngày' });
    expect(new Date(upd.body.due_at).toISOString()).toBe(newDue);
    expect((await notes(f.S2)).items.find((n: any) => n.title === 'Đổi hạn nộp: Ôn tập Kháng chiến lần 1')).toMatchObject({ kind: 'assignment' });
    expect((await mine(f.S2)).find((x) => x.id === a1.id)).toMatchObject({ state: 'todo', attempts_left: 3 });
    expect((await mine(f.S1)).find((x) => x.id === a1.id)).toMatchObject({ attempts_left: 1 }); // đã làm 2/3
    expect((await api('PUT', `/api/classroom/assignments/${a1.id}`, { due_at: due(-2) })).status).toBe(400);
    expect((await api('PUT', `/api/classroom/assignments/${a1.id}`, { max_attempts: 1 })).status).toBe(400); // đã có người làm 2 lần
    expect((await api('PUT', `/api/classroom/assignments/${a1.id}`, { kind: 'lesson', lesson_id: lessonId })).status).toBe(409);
    expect((await api('PUT', `/api/classroom/assignments/${a1.id}`, { quiz_id: quizId + 1 })).status).toBe(409);
    expect((await api('PUT', `/api/classroom/assignments/${a1.id}`, { audience: 'students', student_ids: [f.S2.id] })).status).toBe(409); // S1, S3 đã nộp
    expect((await api('PUT', `/api/classroom/assignments/${a1.id}`, { title: 'x' })).status).toBe(400);
    expect((await api('PUT', `/api/classroom/assignments/${a1.id}`, { title: 'Ôn tập lần 1 (đã gia hạn)' }, f.T2.token)).status).toBe(404);
    expect((await api('PUT', `/api/classroom/assignments/${a1.id}`, { title: 'Ôn tập lần 1 (đã gia hạn)' })).body.title).toBe('Ôn tập lần 1 (đã gia hạn)');
    // đã có người nộp thì không thu hồi
    expect((await api('POST', `/api/classroom/assignments/${a1.id}/revoke`)).status).toBe(409);
    // mở rộng phạm vi sang học sinh mới thì học sinh đó được thông báo
    const wide = (await api('POST', `/api/classroom/classes/${classId}/assignments`, { title: 'Bài mở rộng', kind: 'quiz', quiz_id: quizId, due_at: due(4), audience: 'students', student_ids: [f.S1.id] })).body;
    const grown = await api('PUT', `/api/classroom/assignments/${wide.id}`, { audience: 'students', student_ids: [f.S1.id, f.S2.id] });
    expect(grown.body.summary.total).toBe(2);
    expect((await notes(f.S2)).items.find((n: any) => n.title === 'Bài tập mới: Bài mở rộng')).toBeTruthy();
    await api('POST', `/api/classroom/assignments/${wide.id}/revoke`);
  });

  // ------------------------------------------------------------------ HK.GV.049, HK.HS.102
  test('HK.GV.049 + HK.HS.102 chấm điểm và nhận xét: chỉ chấm bài đã nộp; điểm giáo viên là điểm cuối; học sinh xem điểm, xếp loại, nhận xét', async () => {
    const grade = (body: unknown, who = f.T1) => api('POST', `/api/classroom/assignments/${a1.id}/grade`, body, who.token);
    expect((await grade({ user_id: f.S2.id, score: 80 })).status).toBe(409); // S2 chưa nộp
    expect((await grade({ user_id: f.S1.id, score: 101 })).status).toBe(400);
    expect((await grade({ user_id: f.S1.id, score: 7.5 })).status).toBe(400);
    expect((await grade({ user_id: f.S1.id, score: 90 }, f.T2)).status).toBe(404);
    const g = await grade({ user_id: f.S1.id, score: 85, feedback: '  Làm tốt, cần nhớ mốc thời gian  ' });
    expect(g.body).toEqual({ user_id: f.S1.id, teacher_score: 85, grade: 'Giỏi', feedback: 'Làm tốt, cần nhớ mốc thời gian' });
    expect((await grade({ user_id: f.S3.id, score: 49 })).body.grade).toBe('Yếu');
    const mineNow = (await mine(f.S1)).find((x) => x.id === a1.id)!;
    expect(mineNow).toMatchObject({ state: 'graded', teacher_score: 85, grade: 'Giỏi', feedback: 'Làm tốt, cần nhớ mốc thời gian' });
    expect((await notes(f.S1)).items.find((n: any) => /đã chấm bài/.test(n.title))).toMatchObject({ body: expect.stringMatching(/85\/100 \(Giỏi\)/) });
    // chấm lại thay điểm cũ
    expect((await grade({ user_id: f.S1.id, score: 70, feedback: null })).body).toMatchObject({ teacher_score: 70, grade: 'Khá', feedback: null });
    const detail = (await api('GET', `/api/classroom/assignments/${a1.id}`)).body;
    expect(detail.summary.graded).toBe(2);
    expect(detail.students.find((x: any) => x.id === f.S1.id)).toMatchObject({ state: 'graded', teacher_score: 70, grade: 'Khá' });
    expect((await api('GET', `/api/classroom/classes/${classId}/assignments`)).body.find((x: any) => x.id === a1.id).graded).toBe(2);
  });

  // ------------------------------------------------------------------ HK.GV.071 xuất báo cáo riêng cho từng bài tập
  test('HK.GV.071 xuất báo cáo riêng cho một bài tập: Excel và PDF, tình trạng nộp, điểm và nhận xét từng học sinh; chỉ giáo viên của lớp', async () => {
    const detail = (await api('GET', `/api/classroom/assignments/${a1.id}`)).body;
    const xlsx = await download(s.base, `/api/classroom/assignments/${a1.id}/export?format=xlsx`, f.T1.token);
    expect(xlsx.status).toBe(200);
    expect(xlsx.type).toMatch(/spreadsheetml/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx.buffer as never);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Tổng quan', 'Học sinh']);
    const overview = new Map<string, unknown>();
    wb.getWorksheet('Tổng quan')!.eachRow((row, n) => { if (n > 1) overview.set(String(row.getCell(1).value), row.getCell(2).value); });
    expect(overview.get('Bài tập')).toBe(detail.title);
    expect(overview.get('Số học sinh được giao')).toBe(detail.summary.total);
    expect(overview.get('Đã nộp')).toBe(detail.summary.submitted);
    expect(overview.get('Đã chấm')).toBe(detail.summary.graded);
    expect(overview.get('Chưa nộp')).toBe(detail.summary.total - detail.summary.submitted);
    const rows: Array<Record<string, unknown>> = [];
    wb.getWorksheet('Học sinh')!.eachRow((row, n) => { if (n > 1) rows.push({ name: row.getCell(1).value, state: row.getCell(3).value, score: row.getCell(7).value, grade: row.getCell(8).value }); });
    expect(rows).toHaveLength(detail.students.length);
    const label = { todo: 'Chưa nộp', submitted: 'Đã nộp', late: 'Nộp muộn', graded: 'Đã chấm' } as Record<string, string>;
    for (const st of detail.students) expect(rows.find((r) => r.name === st.full_name)).toMatchObject({ state: label[st.state] });
    const graded = detail.students.find((x: any) => x.state === 'graded');
    expect(rows.find((r) => r.name === graded.full_name)).toMatchObject({ score: graded.teacher_score, grade: graded.grade });
    const pdf = await download(s.base, `/api/classroom/assignments/${a1.id}/export?format=pdf`, f.T1.token);
    expect(pdf.status).toBe(200);
    expect(pdf.buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect((await download(s.base, `/api/classroom/assignments/${a1.id}/export?format=doc`, f.T1.token)).status).toBe(400);
    expect((await download(s.base, `/api/classroom/assignments/${a1.id}/export`, f.T1.token)).status).toBe(200); // mặc định là Excel
    expect((await download(s.base, `/api/classroom/assignments/${a1.id}/export?format=xlsx`, f.S1.token)).status).toBe(403); // học sinh không xuất được
    expect((await download(s.base, `/api/classroom/assignments/${a1.id}/export?format=xlsx`, f.T2.token)).status).toBe(404); // giáo viên không phụ trách lớp
    expect((await download(s.base, '/api/classroom/assignments/999999/export?format=xlsx', f.T1.token)).status).toBe(404);
  });

  // ------------------------------------------------------------------ HK.GV.050
  test('HK.GV.050 nhắc học sinh chưa nộp: chỉ người chưa nộp nhận nhắc; mỗi người tối đa một lần mỗi 6 giờ; bài đã thu hồi không nhắc', async () => {
    const r1 = await api('POST', `/api/classroom/assignments/${a1.id}/remind`);
    expect(r1.body).toEqual({ sent: 1 }); // chỉ S2
    expect((await notes(f.S2)).items.find((n: any) => n.kind === 'reminder')).toMatchObject({ title: 'Nhắc nhở: Ôn tập lần 1 (đã gia hạn)', body: expect.stringMatching(/chưa nộp/) });
    expect((await notes(f.S1)).items.some((n: any) => n.kind === 'reminder')).toBe(false);
    expect((await api('POST', `/api/classroom/assignments/${a1.id}/remind`)).body).toEqual({ sent: 0 }); // chưa đủ 6 giờ
    expect((await api('GET', `/api/classroom/assignments/${a1.id}`)).body.students.find((x: any) => x.id === f.S2.id).reminded_at).toBeTruthy();
    clock.advance(7 * 3_600_000);
    expect((await api('POST', `/api/classroom/assignments/${a1.id}/remind`)).body).toEqual({ sent: 1 });
    expect((await api('POST', `/api/classroom/assignments/${a1.id}/remind`, undefined, f.T2.token)).status).toBe(404);
    const other = (await api('POST', `/api/classroom/classes/${classId}/assignments`, { title: 'Bài sẽ thu hồi', kind: 'lesson', lesson_id: lessonId, due_at: due(6) })).body;
    await api('POST', `/api/classroom/assignments/${other.id}/revoke`);
    expect((await api('POST', `/api/classroom/assignments/${other.id}/remind`)).status).toBe(409);
  });

  // ------------------------------------------------------------------ mini-game và bài học
  test('HK.GV.045 + HK.HS.101 giao mini-game: lượt chơi gắn với bài tập, điểm và lượt làm được ghi nhận, hết lượt thì không chơi thêm', async () => {
    const created = (await api('POST', `/api/classroom/classes/${classId}/assignments`, { title: 'Ghép thẻ trận đánh', kind: 'minigame', minigame_id: matchId, due_at: due(7), max_attempts: 1, bonus_points: 25 })).body;
    expect(created).toMatchObject({ kind: 'minigame', kind_label: 'Mini-game', bonus_points: 25 });
    expect((await api('POST', `/api/classroom/classes/${classId}/assignments`, { title: 'Mini-game lạ', kind: 'minigame', minigame_id: 987654, due_at: due(7) })).status).toBe(400);
    const started = (await as(f.S2)('POST', `/api/classroom/my-assignments/${created.id}/start`)).body;
    expect(started.kind).toBe('minigame');
    const run = started.run;
    expect(run).toMatchObject({ kind: 'match', status: 'active' });
    const state = (await db.query<{ state: any }>('SELECT state FROM hk_game_runs WHERE id = $1', [run.id]))[0].state;
    const params = (await db.query<{ params: any }>('SELECT params FROM hk_minigames WHERE id = $1', [matchId]))[0].params;
    let last: any;
    for (const p of params.pairs) last = (await as(f.S2)('POST', `/api/battle/runs/${run.id}/answer`, { left: p.id, right: state.rights.find((r: any) => r.pair === p.id).rid })).body;
    expect(last.finished).toBe(true);
    expect(last.run.result.assignment).toMatchObject({ first: true, on_time: true, bonus: 25 });
    expect((await mine(f.S2)).find((x) => x.id === created.id)).toMatchObject({ state: 'submitted', attempts: 1, attempts_left: 0 });
    expect((await as(f.S2)('POST', `/api/classroom/my-assignments/${created.id}/start`)).status).toBe(409); // hết 1 lượt
    expect((await as(f.S1)('POST', `/api/classroom/my-assignments/${created.id}/start`)).body.run.id).not.toBe(run.id); // học sinh khác có lượt riêng
  });

  test('HK.GV.045 + HK.HS.101 giao bài học: phải đọc hết và trả lời đúng mọi câu kiểm tra nhanh mới nộp được; nộp một lần', async () => {
    const created = (await api('POST', `/api/classroom/classes/${classId}/assignments`, { title: 'Đọc bài về Hội nghị Diên Hồng', kind: 'lesson', lesson_id: lessonId, due_at: due(7), bonus_points: 10 })).body;
    expect(created.kind_label).toBe('Bài học');
    const started = (await as(f.S2)('POST', `/api/classroom/my-assignments/${created.id}/start`)).body;
    expect(started.kind).toBe('lesson');
    const lesson = started.lesson;
    expect(lesson.id).toBe(lessonId);
    expect(lesson.checks.every((c: any) => !('data' in c && JSON.stringify(c.data).includes('"correct"')))).toBe(true); // không lộ đáp án
    const answers = lesson.checks.map((c: any) => ({ question_id: c.id, answer: answerOf(c.id, true) }));
    // chưa đọc hết thì chưa nộp được
    expect((await as(f.S2)('POST', `/api/classroom/my-assignments/${created.id}/lesson/complete`, { answers })).status).toBe(409);
    expect((await as(f.S2)('POST', `/api/classroom/my-assignments/${created.id}/lesson/progress`, { read_percent: 100 })).body.read_percent).toBe(100);
    if (lesson.checks.length) {
      const wrong = lesson.checks.map((c: any) => ({ question_id: c.id, answer: answerOf(c.id, false) }));
      const fail = (await as(f.S2)('POST', `/api/classroom/my-assignments/${created.id}/lesson/complete`, { answers: wrong })).body;
      expect(fail.completed).toBe(false);
      expect((await mine(f.S2)).find((x) => x.id === created.id)).toMatchObject({ state: 'todo' }); // chưa nộp
    }
    const ok = (await as(f.S2)('POST', `/api/classroom/my-assignments/${created.id}/lesson/complete`, { answers })).body;
    expect(ok.completed).toBe(true);
    expect(ok.submission).toMatchObject({ first: true, on_time: true, bonus: 10 });
    expect((await mine(f.S2)).find((x) => x.id === created.id)).toMatchObject({ state: 'submitted', best_percent: 100 });
    const twice = (await as(f.S2)('POST', `/api/classroom/my-assignments/${created.id}/lesson/complete`, { answers })).body;
    expect(twice).toMatchObject({ completed: true, submission: null }); // không ghi và không thưởng lần hai
    // không phải bài học thì không đọc như bài học
    expect((await as(f.S1)('POST', `/api/classroom/my-assignments/${a1.id}/lesson/progress`, { read_percent: 50 })).status).toBe(403);
  });
});
