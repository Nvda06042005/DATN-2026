/**
 * Nâng cấp Ngân hàng câu hỏi, Bộ đề, Bài học (yêu cầu 14/11/2026, migration 063), học từ các nền tảng trong và ngoài nước:
 * - mức độ nhận thức Biết / Hiểu / Vận dụng (Công văn 7991) cho câu hỏi, lọc theo mức độ, cột "Mức độ" trong Excel;
 * - tạo bộ đề theo ma trận chủ đề × mức độ, lấy ngẫu nhiên đủ số câu (như MobiEdu, McMix);
 * - thống kê câu hỏi (tỉ lệ đúng, phương án hay bị chọn) và thống kê bộ đề (điểm trung bình, tỉ lệ đạt, phân bố điểm, câu sai nhiều) như Moodle, Wayground;
 * - mục tiêu bài học và số học sinh đã học bài.
 */
import { call, download, hasPostgres, makeXlsx, sql, Started, startApp, upload, adminLogin } from './harness';
import { bootstrap, Fixture } from './fixture';

(hasPostgres() ? describe : describe.skip)('ma trận đề, mức độ nhận thức, thống kê câu hỏi và bộ đề, mục tiêu bài học', () => {
  let s: Started, f: Fixture, c1: number, c2: number;
  const as = (token: string) => (method: string, path: string, body?: unknown) => call(s.base, method, path, body, token);
  const options = [{ id: 'a', text: 'Trần Quang Khải' }, { id: 'b', text: 'Trần Hưng Đạo' }, { id: 'c', text: 'Trần Nhật Duật' }];
  const single = async (token: string, prompt: string, extra: Record<string, unknown> = {}) => {
    const res = await as(token)('POST', '/api/content/questions', { qtype: 'single', prompt, difficulty: 2, data: { options, correct: 'b' }, ...extra });
    if (res.status !== 201) throw new Error('tạo câu hỏi lỗi ' + JSON.stringify(res.body));
    return res.body as { id: number; cognitive_level: number; level_label: string };
  };

  beforeAll(async () => {
    s = await startApp('assessment_matrix_test');
    f = await bootstrap(s, await adminLogin(s.base));
    [c1, c2] = (await sql<{ id: number }>(s.url, 'SELECT id FROM hist_campaigns ORDER BY id LIMIT 2')).map((r) => r.id);
  });
  afterAll(async () => { await s?.close(); });

  test('mức độ nhận thức: chưa chọn thì theo độ khó; chọn riêng được; sai thì báo lỗi; lọc theo mức độ; câu chèn thẳng vào CSDL cũng có mức độ', async () => {
    const A = as(f.A.token);
    const easy = await single(f.A.token, 'Ai chỉ huy kháng chiến lần II?', { difficulty: 1 });
    expect(easy).toMatchObject({ cognitive_level: 1, level_label: 'Biết' });
    const apply = await single(f.A.token, 'Vì sao nhà Trần chọn kế vườn không nhà trống?', { difficulty: 1, cognitive_level: 3 });
    expect(apply).toMatchObject({ cognitive_level: 3, level_label: 'Vận dụng' });
    expect((await A('POST', '/api/content/questions', { qtype: 'single', prompt: 'Câu sai mức độ', cognitive_level: 4, data: { options, correct: 'b' } })).status).toBe(400);
    const edited = await A('PUT', `/api/content/questions/${easy.id}`, { cognitive_level: 2 });
    expect(edited.body).toMatchObject({ cognitive_level: 2, level_label: 'Hiểu', version_no: 2 });
    const level3 = (await A('GET', '/api/content/questions?store=school&level=3')).body.items as Array<{ id: number; level_label: string }>;
    expect(level3.map((x) => x.id)).toEqual([apply.id]);
    expect(level3[0].level_label).toBe('Vận dụng');
    const raw = await sql<{ cognitive_level: number }>(s.url, `INSERT INTO hk_questions (scope, qtype, prompt, difficulty, data) VALUES ('system', 'truefalse', 'Câu chèn thẳng vào CSDL', 3, '{"correct": true}') RETURNING cognitive_level`);
    expect(raw[0].cognitive_level).toBe(3);
    await sql(s.url, "DELETE FROM hk_questions WHERE prompt IN ('Câu chèn thẳng vào CSDL', 'Ai chỉ huy kháng chiến lần II?', 'Vì sao nhà Trần chọn kế vườn không nhà trống?')");
  });

  test('Excel: file mẫu có cột Mức độ; nhập "Vận dụng" / "Thông hiểu" / số; chữ lạ thì báo lỗi dòng; xuất ra có cột Mức độ', async () => {
    const template = await download(s.base, '/api/content/questions/template', f.A.token);
    const book = new (await import('exceljs')).Workbook();
    await book.xlsx.load(template.buffer as never);
    const headers: string[] = [];
    book.worksheets[0].eachRow((row) => { const v = (row.values as unknown[]).map(String); if (v.includes('Đề bài *')) headers.push(...v); });
    expect(headers).toContain('Mức độ (Biết/Hiểu/Vận dụng)');
    const file = await makeXlsx(['Dạng câu hỏi *', 'Đề bài *', 'Lựa chọn 1', 'Lựa chọn 2', 'Đáp án *', 'Mức độ'], [
      ['Một đáp án', 'Câu Excel vận dụng', 'A', 'B', '2', 'Vận dụng'],
      ['Một đáp án', 'Câu Excel thông hiểu', 'A', 'B', '1', 'Thông hiểu'],
      ['Đúng/sai', 'Câu Excel số một', '', '', 'Đúng', '1'],
      ['Đúng/sai', 'Câu Excel mức lạ', '', '', 'Sai', 'Rất khó'],
    ]);
    const res = await upload(s.base, '/api/content/questions/import?commit=true', 'cau-hoi.xlsx', file, f.A.token);
    expect(res.body).toMatchObject({ created: 3, errors: 1 });
    expect(res.body.rows[3].errors.join(' ')).toContain('Mức độ ghi Biết, Hiểu hoặc Vận dụng');
    const rows = await sql<{ prompt: string; cognitive_level: number }>(s.url, "SELECT prompt, cognitive_level FROM hk_questions WHERE prompt LIKE 'Câu Excel%' ORDER BY prompt");
    expect(rows.map((r) => [r.prompt, r.cognitive_level])).toEqual([['Câu Excel số một', 1], ['Câu Excel thông hiểu', 2], ['Câu Excel vận dụng', 3]]);
    const out = await download(s.base, '/api/content/questions/export?store=school', f.A.token);
    const exported = new (await import('exceljs')).Workbook();
    await exported.xlsx.load(out.buffer as never);
    const cells: string[] = [];
    exported.worksheets[0].eachRow((row) => cells.push(...(row.values as unknown[]).map(String)));
    expect(cells).toEqual(expect.arrayContaining(['Mức độ (Biết/Hiểu/Vận dụng)', 'Vận dụng', 'Hiểu', 'Biết']));
    await sql(s.url, "DELETE FROM hk_questions WHERE prompt LIKE 'Câu Excel%'");
  });

  test('ma trận đề: số câu có sẵn theo chủ đề × mức độ; tạo bộ đề lấy ngẫu nhiên đủ số câu, xếp Biết → Hiểu → Vận dụng; thiếu câu thì báo rõ ô nào', async () => {
    for (const [level, n] of [[1, 3], [2, 2], [3, 1]] as const) for (let i = 0; i < n; i += 1) await single(f.A.token, `Ma trận chủ đề 1 mức ${level} câu ${i + 1}`, { campaign_id: c1, cognitive_level: level });
    await single(f.A.token, 'Ma trận chủ đề 2 mức 1', { campaign_id: c2, cognitive_level: 1 });
    await single(f.B.token, 'Câu của trường B không được dùng', { campaign_id: c1, cognitive_level: 1 });
    const stock = (await as(f.A.token)('GET', '/api/content/quizzes/matrix?store=school')).body;
    expect(stock.levels.map((l: { label: string }) => l.label)).toEqual(['Biết', 'Hiểu', 'Vận dụng']);
    expect(stock.topics.find((t: { campaign_id: number }) => t.campaign_id === c1)).toMatchObject({ levels: { 1: 3, 2: 2, 3: 1 }, total: 6 });
    expect(stock.topics.find((t: { campaign_id: number }) => t.campaign_id === c2)).toMatchObject({ levels: { 1: 1, 2: 0, 3: 0 }, total: 1 });

    const made = await as(f.A.token)('POST', '/api/content/quizzes/matrix', {
      title: 'Kiểm tra giữa kì theo ma trận', store: 'school', pass_percent: 50,
      cells: [{ campaign_id: c1, level: 3, count: 1 }, { campaign_id: c1, level: 1, count: 2 }, { campaign_id: c1, level: 2, count: 2 }, { campaign_id: c2, level: 1, count: 0 }],
    });
    expect(made.status).toBe(201);
    expect(made.body.items.map((i: { cognitive_level: number }) => i.cognitive_level)).toEqual([1, 1, 2, 2, 3]);
    expect(made.body).toMatchObject({ campaign_id: c1, pass_percent: 50, description: 'Tạo theo ma trận: Biết 2, Hiểu 2, Vận dụng 1 (5 câu).' });
    expect(made.body.items.every((i: { campaign_id: number; prompt: string }) => i.campaign_id === c1 && !i.prompt.includes('trường B'))).toBe(true);

    const short = await as(f.A.token)('POST', '/api/content/quizzes/matrix', { title: 'Thiếu câu', store: 'school', cells: [{ campaign_id: c1, level: 3, count: 2 }] });
    expect(short.status).toBe(422);
    expect(short.body.detail).toMatch(/Vận dụng: cần 2 câu, kho chỉ có 1/);
    expect((await as(f.A.token)('POST', '/api/content/quizzes/matrix', { title: 'Rỗng', cells: [{ campaign_id: c1, level: 1, count: 0 }] })).status).toBe(400);
    expect((await as(f.A.token)('POST', '/api/content/quizzes/matrix', { title: 'Trùng ô', cells: [{ campaign_id: c1, level: 1, count: 1 }, { campaign_id: c1, level: 1, count: 1 }] })).status).toBe(400);
    // giáo viên trong trường dùng được câu của kho trường
    const teacher = await as(f.T1.token)('POST', '/api/content/quizzes/matrix', { title: 'Đề của giáo viên', cells: [{ campaign_id: c2, level: 1, count: 1 }] });
    expect(teacher.status).toBe(201);
    expect(teacher.body).toMatchObject({ scope: 'teacher', items: [{ prompt: 'Ma trận chủ đề 2 mức 1' }] });
  });

  test('thống kê: tỉ lệ đúng và phương án hay bị chọn của câu hỏi; bộ đề có số lượt, điểm trung bình, tỉ lệ đạt, phân bố điểm, tỉ lệ đúng từng câu; không tính làm thử; trường khác không xem được', async () => {
    const quiz = (await as(f.A.token)('GET', '/api/content/quizzes?store=school')).body.items.find((x: { title: string }) => x.title === 'Kiểm tra giữa kì theo ma trận');
    const detail = (await as(f.A.token)('GET', `/api/content/quizzes/${quiz.id}`)).body;
    const [q1, q2] = detail.items.map((i: { question_id: number }) => i.question_id);
    const attempt = async (userId: number, mode: string, percent: number, passed: boolean, answers: Array<[number, string, boolean]>) => {
      const id = (await sql<{ id: number }>(s.url, `INSERT INTO hk_attempts (user_id, quiz_id, mode, status, plan, percent, passed, duration_ms, finished_at) VALUES ($1, $2, $3, 'done', '[]', $4, $5, 60000, now()) RETURNING id`, [userId, quiz.id, mode, percent, passed]))[0].id;
      let pos = 1;
      for (const [qid, choice, ok] of answers) await sql(s.url, 'INSERT INTO hk_attempt_answers (attempt_id, question_id, position, answer, correct, time_ms) VALUES ($1, $2, $3, $4, $5, 8000)', [id, qid, pos++, JSON.stringify({ choice }), ok]);
    };
    await attempt(f.S1.id, 'node', 90, true, [[q1, 'b', true], [q2, 'a', false]]);
    await attempt(f.S2.id, 'node', 40, false, [[q1, 'c', false], [q2, 'a', false]]);
    await attempt(f.T1.id, 'preview', 100, true, [[q1, 'b', true], [q2, 'b', true]]); // giáo viên làm thử: không tính

    const stats = await as(f.A.token)('GET', `/api/content/quizzes/${quiz.id}/stats`);
    expect(stats.status).toBe(200);
    expect(stats.body).toMatchObject({ attempts: 2, students: 2, avg_percent: 65, pass_rate: 50, avg_seconds: 60 });
    expect(stats.body.distribution.map((d: { count: number }) => d.count)).toEqual([1, 0, 0, 1]);
    expect(stats.body.questions.slice(0, 2)).toMatchObject([{ question_id: q1, answered: 2, correct_rate: 50, avg_seconds: 8 }, { question_id: q2, answered: 2, correct_rate: 0 }]);
    expect((await as(f.B.token)('GET', `/api/content/quizzes/${quiz.id}/stats`)).status).toBe(404);

    const question = (await as(f.A.token)('GET', `/api/content/questions/${q1}`)).body;
    expect(question.stats).toMatchObject({ answered: 2, correct: 1, correct_rate: 50, avg_seconds: 8 });
    expect(question.stats.choices).toEqual([
      { key: 'a', label: 'Trần Quang Khải', count: 0, correct: false },
      { key: 'b', label: 'Trần Hưng Đạo', count: 1, correct: true },
      { key: 'c', label: 'Trần Nhật Duật', count: 1, correct: false },
    ]);
    const row = (await as(f.A.token)('GET', '/api/content/questions?store=school&limit=100')).body.items.find((x: { id: number }) => x.id === q2);
    expect(row).toMatchObject({ answered: 2, correct_rate: 0 });
  });

  test('bài học: mục tiêu (mỗi dòng một mục, bỏ gạch đầu dòng), quá dài thì báo lỗi; danh sách có số học sinh đã mở và đã học xong', async () => {
    const R = as(f.root);
    const made = await R('POST', '/api/content/lessons', { title: 'Hội nghị Diên Hồng', objectives: '- Nêu được thời gian, thành phần dự hội nghị\n\n• Giải thích được ý nghĩa của hội nghị', blocks: [{ type: 'text', text: 'Năm 1284, vua Trần mời các bô lão về điện Diên Hồng.' }] });
    expect(made.status).toBe(201);
    expect(made.body.objectives).toBe('Nêu được thời gian, thành phần dự hội nghị\nGiải thích được ý nghĩa của hội nghị');
    expect((await R('PUT', `/api/content/lessons/${made.body.id}`, { objectives: 'x'.repeat(1001) })).status).toBe(400);
    await sql(s.url, 'INSERT INTO hk_lesson_progress (user_id, lesson_id, read_percent, completed_at) VALUES ($1, $3, 100, now()), ($2, $3, 40, NULL)', [f.S1.id, f.S2.id, made.body.id]);
    const listed = (await R('GET', '/api/content/lessons')).body.find((l: { id: number }) => l.id === made.body.id);
    expect(listed).toMatchObject({ readers: 2, completed: 1 });
  });
});
