/**
 * Sprint 4, phần soạn nội dung (HK.GV.030–044, HK.QT.041, HK.AD.045): ngân hàng câu hỏi nhiều dạng, bộ đề, nhập/xuất Excel,
 * gắn dữ liệu lịch sử, chia sẻ và duyệt giữa giáo viên – trường – hệ thống. HTTP thật trên PostgreSQL tạm.
 */
import { call, download, hasPostgres, makeXlsx, Started, startApp, upload } from './harness';
import { bootstrap, Fixture } from './fixture';
import type { DatabaseService } from '../src/database/database.service';

let s: Started, f: Fixture, db: DatabaseService;
const api = (method: string, path: string, body?: unknown, token = f.T1.token) => call(s.base, method, path, body, token);
const opts = (...texts: string[]) => texts.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));

const SINGLE = { qtype: 'single', prompt: 'Ai là Quốc công Tiết chế thống lĩnh quân đội nhà Trần?', difficulty: 1, explanation: 'Trần Hưng Đạo.', data: { options: opts('Trần Quang Khải', 'Trần Hưng Đạo', 'Trần Nhật Duật'), correct: 'b' } };
const MULTI = { qtype: 'multiple', prompt: 'Những địa danh nào gắn với kháng chiến chống Nguyên – Mông?', difficulty: 2, data: { options: opts('Bạch Đằng', 'Chương Dương', 'Điện Biên Phủ', 'Hàm Tử'), correct: ['a', 'b', 'd'] } };
const TRUEFALSE = { qtype: 'truefalse', prompt: 'Hội nghị Diên Hồng họp để bàn việc đánh hay hòa.', data: { correct: true } };
const FILL = { qtype: 'fill', prompt: 'Năm ____, quân dân nhà Trần thắng trên sông ____.', data: { blanks: [{ accept: ['1288'] }, { accept: ['Bạch Đằng', 'Bạch Đằng Giang'] }] } };
const ORDER = { qtype: 'order', prompt: 'Sắp xếp các sự kiện theo thứ tự thời gian.', data: { items: opts('Hội nghị Diên Hồng', 'Chiến thắng Hàm Tử', 'Chiến thắng Bạch Đằng') } };
const MAP = { qtype: 'map', prompt: 'Kéo các địa danh lên bản đồ.', data: { targets: [{ label: 'Bạch Đằng', lat: 20.95, lng: 106.8, radius_km: 40 }, { label: 'Thăng Long', lat: 21.03, lng: 105.85, radius_km: 25 }] } };

(hasPostgres() ? describe : describe.skip)('Sprint 4 – soạn câu hỏi, bộ đề và chia sẻ', () => {
  let figureId: number, campaignId: number;
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    s = await startApp('sprint4_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    const root = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, root);
    campaignId = (await call(s.base, 'GET', '/api/admin/history/campaigns', undefined, root)).body.items[0].id;
    figureId = (await call(s.base, 'GET', '/api/admin/history/figures', undefined, root)).body.items[0].id;
  });
  afterAll(async () => { await s?.close(); });

  // ------------------------------------------------------------------ HK.GV.032
  test('HK.GV.032 tạo đủ 6 dạng câu hỏi; từ chối nội dung sai cấu trúc; chỉ giáo viên và quản trị tổng soạn', async () => {
    for (const [key, body] of Object.entries({ single: SINGLE, multiple: MULTI, truefalse: TRUEFALSE, fill: FILL, order: ORDER, map: MAP })) {
      const res = await api('POST', '/api/content/questions', { ...body, campaign_id: campaignId });
      expect([key, res.status]).toEqual([key, 201]);
      expect(res.body).toMatchObject({ scope: 'teacher', owner_id: f.T1.id, version_no: 1, can_edit: true, campaign_id: campaignId });
      ids[key] = res.body.id;
    }
    expect(ids.map).toBeGreaterThan(0);
    const bad: Array<[string, unknown]> = [
      ['thiếu đề', { ...SINGLE, prompt: ' a ' }],
      ['dạng lạ', { ...SINGLE, qtype: 'essay' }],
      ['đáp án không có trong lựa chọn', { ...SINGLE, data: { options: opts('A', 'B'), correct: 'z' } }],
      ['độ khó 5', { ...SINGLE, difficulty: 5 }],
      ['hình không https', { ...SINGLE, image_url: 'http://x.vn/a.png' }],
      ['chỗ trống lệch số đáp án', { ...FILL, data: { blanks: [{ accept: ['1288'] }] } }],
      ['bản đồ ngoài Việt Nam', { ...MAP, data: { targets: [{ label: 'Paris', lat: 48, lng: 2 }] } }],
      ['cuộc kháng chiến không có', { ...SINGLE, campaign_id: 9999 }],
    ];
    for (const [name, body] of bad) expect([name, [400, 422]]).toEqual([name, expect.arrayContaining([(await api('POST', '/api/content/questions', body)).status])]);
    expect((await api('POST', '/api/content/questions', SINGLE, f.A.token)).status).toBe(403); // quản trị trường không soạn
    expect((await api('POST', '/api/content/questions', SINGLE, f.S1.token)).status).toBe(403); // học sinh
    expect((await call(s.base, 'POST', '/api/content/questions', SINGLE)).status).toBe(401);
    const sys = await api('POST', '/api/content/questions', SINGLE, f.root);
    expect(sys.body).toMatchObject({ scope: 'system', school_id: null });
    ids.system = sys.body.id;
  });

  // ------------------------------------------------------------------ HK.GV.030–031
  test('HK.GV.030/031 danh sách theo kho, tìm kiếm không dấu, lọc theo dạng/độ khó/chủ đề; kho riêng không lộ cho người khác', async () => {
    const mine = await api('GET', '/api/content/questions?store=mine');
    expect(mine.body.total).toBe(6);
    expect(mine.body.items.every((q: any) => q.scope === 'teacher' && q.owner_id === f.T1.id && q.can_edit === true)).toBe(true);
    expect((await api('GET', '/api/content/questions?store=system')).body.total).toBe(1);
    expect((await api('GET', '/api/content/questions')).body.total).toBe(7); // của tôi + hệ thống
    expect((await api('GET', '/api/content/questions?q=tiet%20che')).body.items.map((q: any) => q.id)).toEqual(expect.arrayContaining([ids.single]));
    expect((await api('GET', '/api/content/questions?store=mine&qtype=fill')).body.items.map((q: any) => q.id)).toEqual([ids.fill]);
    expect((await api('GET', '/api/content/questions?store=mine&difficulty=1')).body.total).toBeGreaterThanOrEqual(1);
    expect((await api('GET', `/api/content/questions?store=mine&campaign_id=${campaignId}`)).body.total).toBe(6);
    expect((await api('GET', '/api/content/questions?qtype=lạ')).status).toBe(422);
    const page = await api('GET', '/api/content/questions?store=mine&limit=2&page=2');
    expect(page.body).toMatchObject({ total: 6, page: 2, limit: 2 });
    expect(page.body.items).toHaveLength(2);
    expect(page.body.items[0].campaign_title).toBeTruthy(); // nhóm theo chủ đề
    // Giáo viên khác trong cùng trường chỉ thấy kho hệ thống
    expect((await api('GET', '/api/content/questions', undefined, f.T2.token)).body.total).toBe(1);
    expect((await api('GET', `/api/content/questions/${ids.single}`, undefined, f.T2.token)).status).toBe(404);
    expect((await api('GET', `/api/content/questions/${ids.single}`, undefined, f.A.token)).status).toBe(404); // quản trị trường không xem kho riêng của giáo viên
    expect((await api('PUT', `/api/content/questions/${ids.single}`, { prompt: 'Phá hoại' }, f.TB.token)).status).toBe(404);
  });

  // ------------------------------------------------------------------ HK.GV.033
  test('HK.GV.033 sửa câu hỏi lưu lịch sử phiên bản; không thay đổi thì không tạo phiên bản; câu dùng chung chỉ đọc', async () => {
    const edited = await api('PUT', `/api/content/questions/${ids.single}`, { explanation: 'Trần Hưng Đạo (Trần Quốc Tuấn).', difficulty: 2 });
    expect(edited.body).toMatchObject({ version_no: 2, difficulty: 2, explanation: 'Trần Hưng Đạo (Trần Quốc Tuấn).' });
    const same = await api('PUT', `/api/content/questions/${ids.single}`, { difficulty: 2 });
    expect(same.body.version_no).toBe(2);
    const changedAnswer = await api('PUT', `/api/content/questions/${ids.single}`, { data: { options: opts('Trần Quang Khải', 'Trần Hưng Đạo', 'Trần Nhật Duật', 'Trần Khánh Dư'), correct: 'b' } });
    expect(changedAnswer.body.version_no).toBe(3);
    const versions = await api('GET', `/api/content/questions/${ids.single}/versions`);
    expect(versions.body.map((v: any) => v.version_no)).toEqual([3, 2, 1]);
    expect(versions.body[2].snapshot).toMatchObject({ difficulty: 1, prompt: SINGLE.prompt });
    expect(versions.body[0]).toMatchObject({ changed_by_name: 'Nguyễn Văn Sử' });
    expect((await api('PUT', `/api/content/questions/${ids.single}`, { data: { options: opts('A'), correct: 'a' } })).status).toBe(400);
    expect((await api('PUT', `/api/content/questions/${ids.system}`, { prompt: 'Sửa câu hệ thống' })).status).toBe(403); // giáo viên không sửa kho hệ thống
    expect((await api('PUT', `/api/content/questions/${ids.system}`, { explanation: 'Quản trị tổng sửa được.' }, f.root)).body.version_no).toBe(2);
  });

  // ------------------------------------------------------------------ HK.GV.037
  test('HK.GV.037 gắn câu hỏi với dữ liệu lịch sử và lọc theo liên kết', async () => {
    const linked = await api('PUT', `/api/content/questions/${ids.single}`, { links: [{ ref_type: 'figure', ref_id: figureId }, { ref_type: 'campaign', ref_id: campaignId }, { ref_type: 'figure', ref_id: figureId }] });
    expect(linked.body.links.map((l: any) => l.ref_type).sort()).toEqual(['campaign', 'figure']);
    expect(linked.body.links.every((l: any) => l.label)).toBe(true);
    expect(linked.body.version_no).toBe(4);
    const byRef = await api('GET', `/api/content/questions?ref_type=figure&ref_id=${figureId}`);
    expect(byRef.body.items.map((q: any) => q.id)).toEqual([ids.single]);
    expect((await api('PUT', `/api/content/questions/${ids.single}`, { links: [{ ref_type: 'figure', ref_id: 999999 }] })).status).toBe(404);
    expect((await api('PUT', `/api/content/questions/${ids.single}`, { links: [{ ref_type: 'term', ref_id: 1 }] })).status).toBe(422); // câu hỏi không gắn thuật ngữ
    const options = await api('GET', '/api/content/history-options?type=figure');
    expect(options.body).toEqual([]); // giáo viên chỉ chọn mục đã công bố
    expect((await api('GET', '/api/content/history-options?type=figure', undefined, f.root)).body.length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------ HK.GV.040–044
  let quizId: number;
  test('HK.GV.041 tạo bộ đề: chọn câu hỏi, thứ tự, thời gian, điểm; kiểm tra đầu vào', async () => {
    const created = await api('POST', '/api/content/quizzes', {
      title: '  Đề   ôn tập Lần I ', description: 'Mười lăm phút', campaign_id: campaignId, seconds_per_question: 30, pass_percent: 70, shuffle_questions: true, shuffle_options: true,
      items: [{ question_id: ids.single, points: 100 }, { question_id: ids.truefalse, points: 50, seconds: 10 }, { question_id: ids.fill }, { question_id: ids.system }],
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ title: 'Đề ôn tập Lần I', scope: 'teacher', seconds_per_question: 30, pass_percent: 70, shuffle_questions: true, locked: false, can_edit: true });
    expect(created.body.items.map((i: any) => [i.question_id, i.points, i.seconds, i.position])).toEqual([[ids.single, 100, null, 1], [ids.truefalse, 50, 10, 2], [ids.fill, 100, null, 3], [ids.system, 100, null, 4]]);
    quizId = created.body.id;
    for (const [name, body] of [
      ['không câu hỏi', { title: 'Rỗng', items: [] }],
      ['câu lặp', { title: 'Lặp', items: [{ question_id: ids.single }, { question_id: ids.single }] }],
      ['câu của người khác', { title: 'Người khác', items: [{ question_id: 999999 }] }],
      ['điểm sai', { title: 'Điểm', items: [{ question_id: ids.single, points: 5 }] }],
      ['thời gian sai', { title: 'Giờ', seconds_per_question: 2, items: [{ question_id: ids.single }] }],
      ['đạt 0%', { title: 'Đạt', pass_percent: 0, items: [{ question_id: ids.single }] }],
      ['tên ngắn', { title: 'A', items: [{ question_id: ids.single }] }],
    ] as Array<[string, unknown]>) expect([name, [400, 422]]).toEqual([name, expect.arrayContaining([(await api('POST', '/api/content/quizzes', body)).status])]);
    // Giáo viên khác không dùng được câu hỏi riêng của người khác
    expect((await api('POST', '/api/content/quizzes', { title: 'Mượn câu', items: [{ question_id: ids.single }] }, f.T2.token)).status).toBe(400);
  });

  test('HK.GV.040/042/043 danh sách, sửa, nhân bản, xóa bộ đề; bộ đề đang giao hoặc đã có người làm thì khóa', async () => {
    const list = await api('GET', '/api/content/quizzes?store=mine');
    expect(list.body.items[0]).toMatchObject({ id: quizId, question_count: 4, total_seconds: 30 + 10 + 30 + 30, assigned: 0, attempts: 0, locked: false });
    expect((await api('GET', '/api/content/quizzes?q=on%20tap')).body.total).toBe(1);

    const edited = await api('PUT', `/api/content/quizzes/${quizId}`, { title: 'Đề ôn tập Lần I (sửa)', items: [{ question_id: ids.single }, { question_id: ids.truefalse }, { question_id: ids.fill }] });
    expect(edited.body.items).toHaveLength(3);
    expect(edited.body.title).toBe('Đề ôn tập Lần I (sửa)');

    const copy = await api('POST', `/api/content/quizzes/${quizId}/duplicate`);
    expect(copy.body).toMatchObject({ title: 'Đề ôn tập Lần I (sửa) (bản sao)', scope: 'teacher', owner_id: f.T1.id });
    expect(copy.body.items).toHaveLength(3);
    expect((await api('DELETE', `/api/content/quizzes/${copy.body.id}`)).status).toBe(204);
    expect((await api('GET', `/api/content/quizzes/${copy.body.id}`)).status).toBe(404);

    // Câu hỏi đang nằm trong bộ đề thì không xóa được; gỡ khỏi bộ đề mới xóa được
    const del = await api('DELETE', `/api/content/questions/${ids.fill}`);
    expect(del.status).toBe(409);
    expect(del.body.detail).toContain('Đề ôn tập Lần I');
    await api('PUT', `/api/content/quizzes/${quizId}`, { items: [{ question_id: ids.single }, { question_id: ids.truefalse }] });
    expect((await api('DELETE', `/api/content/questions/${ids.fill}`)).status).toBe(204);
    expect((await api('DELETE', `/api/content/questions/${ids.system}`)).status).toBe(403);

    // Khóa khi nằm trong hành trình đã phát hành / đã có học sinh làm
    await db.query("INSERT INTO hk_journeys (scope, school_id, owner_id, title, campaign_id, status) VALUES ('teacher', $1, $2, 'Hành trình khóa', $3, 'published')", [f.A.schoolId, f.T1.id, campaignId]);
    const journey = (await db.query<{ id: number }>("SELECT id FROM hk_journeys WHERE title = 'Hành trình khóa'"))[0].id;
    await db.query("INSERT INTO hk_nodes (journey_id, position, kind, title, quiz_id) VALUES ($1, 1, 'quiz', 'Nút đề', $2)", [journey, quizId]);
    const locked = await api('PUT', `/api/content/quizzes/${quizId}`, { title: 'Không được sửa' });
    expect(locked.status).toBe(409);
    expect(locked.body.detail).toContain('Hành trình khóa');
    expect((await api('GET', `/api/content/quizzes/${quizId}`)).body).toMatchObject({ locked: true });
    expect((await api('DELETE', `/api/content/quizzes/${quizId}`)).status).toBe(409);
    expect((await api('POST', `/api/content/quizzes/${quizId}/duplicate`)).status).toBe(200); // nhân bản để chỉnh sửa
    await db.query('DELETE FROM hk_journeys WHERE id = $1', [journey]);
  });

  // ------------------------------------------------------------------ HK.GV.044
  test('HK.GV.044 làm thử bộ đề như học sinh: chấm ở máy chủ, không lộ đáp án trước khi trả lời, không ghi tiến độ', async () => {
    const start = await api('POST', `/api/play/quizzes/${quizId}/preview`);
    expect(start.status).toBe(200);
    expect(start.body).toMatchObject({ mode: 'preview', status: 'active', total: 2, position: 0 });
    expect(JSON.stringify(start.body.current)).not.toMatch(/"correct"|Trần Hưng Đạo \(Trần Quốc Tuấn\)/);
    const q1 = start.body.current.question;
    const right = q1.id === ids.single ? { choice: 'b' } : { value: true };
    const a1 = await api('POST', `/api/play/attempts/${start.body.id}/answer`, { question_id: q1.id, answer: right });
    expect(a1.body.result).toMatchObject({ correct: true, timed_out: false });
    expect(a1.body.result.bonus_points).toBeGreaterThan(0);
    expect(a1.body.finished).toBe(false);
    const next = await api('POST', `/api/play/attempts/${start.body.id}/next`);
    const q2 = next.body.current.question;
    const wrong = q2.id === ids.single ? { choice: 'a' } : { value: false };
    const a2 = await api('POST', `/api/play/attempts/${start.body.id}/answer`, { question_id: q2.id, answer: wrong });
    expect(a2.body).toMatchObject({ finished: true, result: { correct: false }, summary: { total: 2, correct: 1, wrong: 1, percent: 50, passed: false } });
    expect((await db.query('SELECT 1 FROM hk_wrong_questions WHERE user_id = $1', [f.T1.id])).length).toBe(0);
    expect((await db.query('SELECT 1 FROM hk_events WHERE user_id = $1', [f.T1.id])).length).toBe(0);
    expect((await api('GET', `/api/play/attempts/${start.body.id}/review`)).body.items).toHaveLength(2);
    expect((await api('GET', `/api/play/attempts/${start.body.id}`, undefined, f.T2.token)).status).toBe(404); // lượt làm bài của người khác
    expect((await api('POST', `/api/play/quizzes/${quizId}/preview`, undefined, f.S1.token)).status).toBe(403);
    expect((await api('POST', `/api/play/quizzes/${quizId}/preview`, undefined, f.T2.token)).status).toBe(404); // không thấy bộ đề riêng của người khác
    // Làm thử lại xóa lượt thử cũ, không để lại rác
    await api('POST', `/api/play/quizzes/${quizId}/preview`);
    expect((await db.query("SELECT 1 FROM hk_attempts WHERE user_id = $1 AND mode = 'preview'", [f.T1.id])).length).toBe(1);
  });

  // ------------------------------------------------------------------ HK.GV.035–036
  test('HK.GV.035/036 nhập câu hỏi từ Excel (xem trước báo lỗi từng dòng, rồi lưu) và xuất danh sách đã lọc', async () => {
    const tpl = await download(s.base, '/api/content/questions/template', f.T1.token);
    expect(tpl.status).toBe(200);
    expect(tpl.type).toContain('spreadsheetml');
    const header = ['Dạng câu hỏi *', 'Đề bài *', 'Lựa chọn 1', 'Lựa chọn 2', 'Lựa chọn 3', 'Lựa chọn 4', 'Đáp án *', 'Giải thích', 'Độ khó (1-3)', 'Cuộc kháng chiến'];
    const file = await makeXlsx(header, [
      ['Một đáp án', 'Vua nào ba lần lãnh đạo kháng chiến?', 'Trần Thái Tông', 'Trần Nhân Tông', 'Lý Thái Tổ', '', '2', 'Nhân Tông là vua thời Lần II và III.', '2', ''],
      ['Nhiều đáp án', 'Chọn các trận thắng lợi năm 1285', 'Hàm Tử', 'Chương Dương', 'Bạch Đằng', '', '1,2', '', '3', ''],
      ['Đúng/sai', 'Hịch tướng sĩ do Trần Hưng Đạo viết.', '', '', '', '', 'Đúng', '', '1', ''],
      ['Điền khuyết', 'Trận ____ diễn ra năm ____.', '', '', '', '', 'Bạch Đằng|Bạch Đằng Giang; 1288', '', '2', ''],
      ['Sắp xếp', 'Sắp xếp theo thời gian', 'Lần I', 'Lần II', 'Lần III', '', '', '', '2', ''],
      ['Một đáp án', 'Đáp án vượt quá', 'A', 'B', '', '', '5', '', '2', ''],
      ['Điền khuyết', 'Thiếu chỗ trống trong đề', '', '', '', '', 'x', '', '2', ''],
      ['Kéo thả bản đồ', 'Không nhập được từ Excel', '', '', '', '', '', '', '2', ''],
      ['Đúng/sai', 'Đáp án không rõ', '', '', '', '', 'Có thể', '', '2', ''],
      ['Một đáp án', 'Cuộc kháng chiến lạ', 'A', 'B', '', '', '1', '', '2', 'Kháng chiến thứ tư'],
    ]);
    const preview = await upload(s.base, '/api/content/questions/import', 'cau-hoi.xlsx', file, f.T1.token);
    expect(preview.body).toMatchObject({ committed: false, total: 10, valid: 5, errors: 5, created: 0 });
    expect(preview.body.rows.filter((r: any) => r.status === 'error').map((r: any) => r.row)).toEqual([7, 8, 9, 10, 11]);
    expect(preview.body.rows[5].errors[0]).toContain('không khớp');
    const before = (await api('GET', '/api/content/questions?store=mine')).body.total;
    const committed = await upload(s.base, '/api/content/questions/import?commit=true', 'cau-hoi.xlsx', file, f.T1.token);
    expect(committed.body).toMatchObject({ committed: true, created: 5, errors: 5 });
    expect((await api('GET', '/api/content/questions?store=mine')).body.total).toBe(before + 5);
    const imported = await api('GET', `/api/content/questions/${committed.body.rows[0].id}`);
    expect(imported.body).toMatchObject({ qtype: 'single', difficulty: 2, scope: 'teacher', data: { correct: 'b' } });
    const fill = await api('GET', `/api/content/questions/${committed.body.rows[3].id}`);
    expect(fill.body.data.blanks).toEqual([{ accept: ['Bạch Đằng', 'Bạch Đằng Giang'] }, { accept: ['1288'] }]);

    expect((await upload(s.base, '/api/content/questions/import', 'khong-phai.xlsx', Buffer.from('không phải excel'), f.T1.token)).status).toBe(400);
    expect((await upload(s.base, '/api/content/questions/import', 'cau-hoi.xlsx', file, f.S1.token)).status).toBe(403);
    expect((await upload(s.base, '/api/content/questions/import', 'cau-hoi.xlsx', file, f.A.token)).status).toBe(403);

    const out = await download(s.base, '/api/content/questions/export?store=mine&qtype=single', f.T1.token);
    expect(out.status).toBe(200);
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(out.buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const rows: string[][] = [];
    wb.worksheets[0].eachRow((row) => rows.push((row.values as unknown[]).slice(1).map((v) => String(v ?? ''))));
    expect(rows[0][0]).toBe('Dạng câu hỏi *');
    expect(rows.slice(1).every((r) => r[0] === 'Một đáp án')).toBe(true);
    expect(rows.length - 1).toBe((await api('GET', '/api/content/questions?store=mine&qtype=single')).body.total);
  });

  // ------------------------------------------------------------------ HK.GV.039, HK.QT.041, HK.AD.045
  test('HK.GV.039/HK.QT.041 giáo viên gửi câu hỏi vào kho trường; quản trị trường duyệt hoặc từ chối; bản duyệt tách khỏi bản gốc', async () => {
    const sent = await api('POST', '/api/content/shares', { entity: 'question', entity_id: ids.single, target: 'school' });
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({ status: 'pending', target: 'school', entity: 'question', can_review: false });
    const shareId = sent.body.id;
    expect((await api('POST', '/api/content/shares', { entity: 'question', entity_id: ids.single, target: 'school' })).status).toBe(409); // đang chờ duyệt
    expect((await api('POST', '/api/content/shares', { entity: 'question', entity_id: ids.single, target: 'system' })).status).toBe(403); // giáo viên không gửi thẳng lên hệ thống
    expect((await api('POST', '/api/content/shares', { entity: 'question', entity_id: ids.single, target: 'school' }, f.T2.token)).status).toBe(404); // không phải của mình
    expect((await api('POST', '/api/content/shares', { entity: 'question', entity_id: ids.system, target: 'school' })).status).toBe(404); // câu hệ thống không phải kho riêng

    const pending = await api('GET', '/api/content/shares?status=pending', undefined, f.A.token);
    expect(pending.body).toHaveLength(1);
    expect(pending.body[0]).toMatchObject({ id: shareId, requester: 'Nguyễn Văn Sử', can_review: true, entity_label: 'câu hỏi' });
    expect((await api('GET', '/api/content/shares', undefined, f.B.token)).body).toEqual([]); // trường khác không thấy
    const view = await api('GET', `/api/content/shares/${shareId}`, undefined, f.A.token);
    expect(view.body.content).toMatchObject({ id: ids.single, qtype: 'single' }); // người duyệt xem được nội dung kho riêng để quyết định
    expect((await api('GET', `/api/content/shares/${shareId}`, undefined, f.B.token)).status).toBe(404);
    expect((await api('POST', `/api/content/shares/${shareId}/review`, { approve: true }, f.T1.token)).status).toBe(403); // giáo viên không tự duyệt
    expect((await api('POST', `/api/content/shares/${shareId}/review`, { approve: true }, f.B.token)).status).toBe(404);
    expect((await api('POST', `/api/content/shares/${shareId}/review`, { approve: false }, f.A.token)).status).toBe(400); // từ chối phải có lý do

    const rejected = await api('POST', `/api/content/shares/${shareId}/review`, { approve: false, note: 'Cần thêm giải thích' }, f.A.token);
    expect(rejected.body).toMatchObject({ status: 'rejected', review_note: 'Cần thêm giải thích' });
    expect((await api('POST', `/api/content/shares/${shareId}/review`, { approve: true }, f.A.token)).status).toBe(409); // đã xử lý
    expect((await api('GET', '/api/content/questions?store=school', undefined, f.T2.token)).body.total).toBe(0);

    // Gửi lại sau khi bị từ chối, rồi được duyệt
    const again = await api('POST', '/api/content/shares', { entity: 'question', entity_id: ids.single, target: 'school' });
    expect(again.body).toMatchObject({ id: shareId, status: 'pending', review_note: null });
    const approved = await api('POST', `/api/content/shares/${shareId}/review`, { approve: true }, f.A.token);
    expect(approved.body).toMatchObject({ status: 'approved' });
    expect(approved.body.result_id).toBeGreaterThan(0);
    const school = await api('GET', '/api/content/questions?store=school', undefined, f.T2.token);
    expect(school.body.total).toBe(1);
    expect(school.body.items[0]).toMatchObject({ id: approved.body.result_id, scope: 'school', can_edit: false, owner_name: 'Nguyễn Văn Sử' });
    expect(school.body.items[0].id).not.toBe(ids.single);
    expect((await api('GET', '/api/content/questions?store=school', undefined, f.TB.token)).body.total).toBe(0); // trường khác không thấy kho trường này
    expect((await api('PUT', `/api/content/questions/${approved.body.result_id}`, { prompt: 'Sửa kho trường' }, f.T2.token)).status).toBe(403);
    // Bản gốc vẫn của giáo viên và sửa độc lập; bản trong kho trường không đổi
    await api('PUT', `/api/content/questions/${ids.single}`, { explanation: 'Sửa sau khi chia sẻ' });
    expect((await api('GET', `/api/content/questions/${approved.body.result_id}`, undefined, f.T2.token)).body.explanation).toBe('Trần Hưng Đạo (Trần Quốc Tuấn).');
    // Giáo viên khác sao câu của trường về kho riêng để chỉnh
    const mineCopy = await api('POST', `/api/content/questions/${approved.body.result_id}/copy`, undefined, f.T2.token);
    expect(mineCopy.body).toMatchObject({ scope: 'teacher', owner_id: f.T2.id, can_edit: true });
    ids.school = approved.body.result_id;
  });

  test('HK.QT.041/HK.AD.045 bộ đề được duyệt kèm bản sao các câu hỏi riêng; quản trị trường đề xuất lên hệ thống, quản trị tổng duyệt', async () => {
    const q1 = (await api('POST', '/api/content/questions', { ...TRUEFALSE, prompt: 'Câu riêng thứ nhất của đề chia sẻ.' })).body.id;
    const q2 = (await api('POST', '/api/content/questions', { ...SINGLE, prompt: 'Câu riêng thứ hai của đề chia sẻ.' })).body.id;
    const quiz = (await api('POST', '/api/content/quizzes', { title: 'Đề chia sẻ', items: [{ question_id: q1 }, { question_id: q2 }, { question_id: ids.system }] })).body.id;
    expect((await api('POST', '/api/content/shares', { entity: 'quiz', entity_id: 999999, target: 'school' })).status).toBe(404);
    const sent = await api('POST', '/api/content/shares', { entity: 'quiz', entity_id: quiz, target: 'school' });
    const approved = await api('POST', `/api/content/shares/${sent.body.id}/review`, { approve: true, note: 'Đề hay' }, f.A.token);
    const copyId = approved.body.result_id;
    const copy = await api('GET', `/api/content/quizzes/${copyId}`, undefined, f.T2.token);
    expect(copy.body).toMatchObject({ scope: 'school', title: 'Đề chia sẻ', can_edit: false });
    expect(copy.body.items).toHaveLength(3);
    const scopes = copy.body.items.map((i: any) => i.scope);
    expect(scopes.filter((x: string) => x === 'school')).toHaveLength(2); // hai câu riêng được sao vào kho trường
    expect(scopes.filter((x: string) => x === 'system')).toHaveLength(1); // câu hệ thống dùng lại, không sao
    expect(copy.body.items.every((i: any) => ![q1, q2].includes(i.question_id))).toBe(true);
    expect((await api('POST', `/api/play/quizzes/${copyId}/preview`, undefined, f.T2.token)).status).toBe(200); // giáo viên khác làm thử được

    // Quản trị trường đề xuất câu hỏi của kho trường lên hệ thống
    expect((await api('POST', '/api/content/shares', { entity: 'question', entity_id: ids.school, target: 'system' }, f.A.token)).status).toBe(201);
    expect((await api('POST', '/api/content/shares', { entity: 'question', entity_id: ids.school, target: 'system' }, f.B.token)).status).toBe(404);
    expect((await api('POST', '/api/content/shares', { entity: 'question', entity_id: ids.school, target: 'school' }, f.A.token)).status).toBe(403);
    const inbox = await api('GET', '/api/content/shares?status=pending', undefined, f.root);
    expect(inbox.body).toHaveLength(1);
    expect(inbox.body[0]).toMatchObject({ target: 'system', school_name: 'THCS Học Tập A', can_review: true });
    expect((await api('POST', `/api/content/shares/${inbox.body[0].id}/review`, { approve: true }, f.A.token)).status).toBe(404); // quản trị trường không duyệt đề xuất lên hệ thống
    const done = await api('POST', `/api/content/shares/${inbox.body[0].id}/review`, { approve: true }, f.root);
    expect(done.body.status).toBe('approved');
    const systemList = await api('GET', '/api/content/questions?store=system', undefined, f.TB.token);
    expect(systemList.body.items.map((q: any) => q.id)).toContain(done.body.result_id); // trường khác dùng được nội dung hệ thống
    expect(systemList.body.items.find((q: any) => q.id === done.body.result_id)).toMatchObject({ scope: 'system', can_edit: false });
    // Rút lại yêu cầu
    const q3 = (await api('POST', '/api/content/questions', TRUEFALSE)).body.id;
    const pend = await api('POST', '/api/content/shares', { entity: 'question', entity_id: q3, target: 'school' });
    expect((await api('DELETE', `/api/content/shares/${pend.body.id}`, undefined, f.T2.token)).status).toBe(404);
    expect((await api('DELETE', `/api/content/shares/${pend.body.id}`)).status).toBe(204);
    expect((await api('GET', '/api/content/shares?status=pending', undefined, f.A.token)).body).toEqual([]);
  });

  test('HK.AD.045 quản trị tổng quản lý kho hệ thống: tạo, sửa, xóa; học sinh không dùng được các API soạn nội dung', async () => {
    const created = await api('POST', '/api/content/questions', TRUEFALSE, f.root);
    expect(created.body).toMatchObject({ scope: 'system', can_edit: true });
    expect((await api('GET', '/api/content/questions?store=mine', undefined, f.root)).body.items.every((q: any) => q.scope === 'system')).toBe(true);
    expect((await api('DELETE', `/api/content/questions/${created.body.id}`, undefined, f.root)).status).toBe(204);
    for (const path of ['/api/content/questions', '/api/content/quizzes', '/api/content/journeys', '/api/content/shares']) {
      expect([path, (await api('GET', path, undefined, f.S1.token)).status]).toEqual([path, 403]);
    }
  });
});
