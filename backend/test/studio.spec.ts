/**
 * Ver0.2 Sprint 8, trình soạn Quiz kiểu Kahoot (HK.GV.085–094): bản nháp tự lưu, kiểm tra từng câu khi lưu chính thức, câu hỏi và bộ đề dùng chung dữ liệu với ngân hàng câu hỏi,
 * loại điểm / thời gian / giao diện, mở lại bộ đề để sửa, ảnh tải lên và kho ảnh. HTTP thật trên PostgreSQL tạm.
 */
import { call, hasPostgres, Started, startApp } from './harness';
import { bootstrap, Fixture } from './fixture';
import type { DatabaseService } from '../src/database/database.service';

let s: Started, f: Fixture, db: DatabaseService;
const t1 = (method: string, path: string, body?: unknown) => call(s.base, method, path, body, f.T1.token);
const as = (who: { token: string }) => (method: string, path: string, body?: unknown) => call(s.base, method, path, body, who.token);

/** Ảnh PNG 1×1 hợp lệ */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const question = (over: Record<string, unknown> = {}) => ({
  qtype: 'single', prompt: 'Ai chỉ huy quân dân nhà Trần trong ba lần kháng chiến?', options: ['Trần Hưng Đạo', 'Lê Lợi', 'Quang Trung', ''], correct: [0], tf: true, seconds: 20, score_mode: 'standard', ...over,
});
const payload = (questions: unknown[], over: Record<string, unknown> = {}) => ({ title: 'Ba lần kháng chiến', description: 'Ôn tập nhanh', theme: { bg: 'bach-dang', music: 'song-nuoc' }, questions, ...over });

(hasPostgres() ? describe : describe.skip)('Ver0.2 Sprint 8 – trình soạn Quiz', () => {
  let draft: number;

  beforeAll(async () => {
    s = await startApp('studio_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken);
  });
  afterAll(async () => { await s?.close(); });

  const save = (id: number, p: unknown) => t1('PUT', `/api/content/studio/${id}`, p);
  const commit = (id: number) => t1('POST', `/api/content/studio/${id}/commit`);

  test('HK.GV.085 tạo Quiz từ nút "+ Tạo": chỉ giáo viên / quản trị tổng; bản nháp trống có sẵn một câu; chỉ chủ bản nháp thấy', async () => {
    expect((await as(f.S1)('POST', '/api/content/studio', {})).status).toBe(403);
    expect((await as(f.A)('POST', '/api/content/studio', {})).status).toBe(403);
    const made = await t1('POST', '/api/content/studio', {});
    expect(made.status).toBe(200);
    draft = made.body.id;
    expect(made.body.payload.questions).toHaveLength(1);
    expect(made.body.payload.questions[0]).toMatchObject({ qtype: 'single', seconds: 20, score_mode: 'standard', options: ['', '', '', ''] });
    expect(made.body.payload.theme).toEqual({ bg: 'default', music: 'none' });
    expect((await as(f.T2)('GET', `/api/content/studio/${draft}`)).status).toBe(404);
    expect((await t1('GET', '/api/content/studio')).body.map((d: any) => d.id)).toContain(draft);
    expect((await t1('GET', '/api/content/studio/99999')).status).toBe(404);
  });

  test('tự lưu bản nháp: chỉ giữ các khóa đã biết, cắt độ dài, chưa kiểm tra nội dung', async () => {
    const res = await save(draft, { ...payload([question({ prompt: 'x'.repeat(1500), evil: '<script>', options: ['A', 'B', 'C', 'D', 'E'] })]), title: 'T'.repeat(300), extra: 1 });
    expect(res.status).toBe(200);
    const got = (await t1('GET', `/api/content/studio/${draft}`)).body.payload;
    expect(got.title).toHaveLength(160);
    expect(got.extra).toBeUndefined();
    expect(got.questions[0].evil).toBeUndefined();
    expect(got.questions[0].prompt).toHaveLength(1000);
    expect(got.questions[0].options).toEqual(['A', 'B', 'C', 'D']);
    expect(got.theme).toEqual({ bg: 'bach-dang', music: 'song-nuoc' });
    expect((await as(f.T2)('PUT', `/api/content/studio/${draft}`, payload([question()]))).status).toBe(404);
  });

  test('HK.GV.086–091 lưu chính thức kiểm tra từng câu và ghi rõ số câu', async () => {
    const bad = async (p: unknown, pattern: RegExp) => {
      await save(draft, p);
      const res = await commit(draft);
      expect(res.status).toBe(400);
      expect(res.body.detail).toMatch(pattern);
    };
    await bad(payload([question()], { title: '' }), /tên Quiz/);
    await bad(payload([]), /ít nhất 1 câu/);
    await bad(payload([question({ prompt: 'ab' })]), /Câu 1: hãy nhập nội dung/);
    await bad(payload([question(), question({ correct: [] })]), /Câu 2: hãy đánh dấu đúng một đáp án/);
    await bad(payload([question({ correct: [0, 1] })]), /Câu 1: hãy đánh dấu đúng một đáp án/);
    await bad(payload([question({ options: ['Trần Hưng Đạo', '', 'Quang Trung', ''] })]), /hai đáp án đầu/);
    await bad(payload([question({ qtype: 'multiple', options: ['A', 'B', '', ''], correct: [0, 1] })]), /ít nhất 3 đáp án/);
    await bad(payload([question({ qtype: 'multiple', options: ['A', 'B', 'C', ''], correct: [0] })]), /từ 2 đáp án đúng/);
    await bad(payload([question({ seconds: 15 })]), /thời gian trả lời chọn trong 5 \/ 10 \/ 20/);
    await bad(payload(Array.from({ length: 51 }, () => question())), /tối đa 50/);
    await bad(payload([question({ options: ['Trần Hưng Đạo', 'Trần Hưng Đạo', '', ''] })]), /trùng nội dung/);
    expect((await db.query('SELECT 1 FROM hk_quizzes')).length).toBe(0); // lỗi thì không ghi gì vào ngân hàng
    expect((await db.query('SELECT 1 FROM hk_questions')).length).toBe(0);
  });

  let quizId: number, questionIds: number[];
  test('HK.GV.085/088–091/094 lưu chính thức: câu hỏi vào ngân hàng, bộ đề với thời gian / loại điểm / giao diện; dùng chung dữ liệu với bộ đề', async () => {
    await save(draft, payload([
      question({ image_url: 'https://upload.wikimedia.org/anh-minh-hoa.jpg', explanation: 'Ông là Quốc công tiết chế.' }),
      question({ qtype: 'multiple', prompt: 'Những địa danh nào gắn với kháng chiến chống Nguyên – Mông?', options: ['Bạch Đằng', 'Lam Sơn', 'Chương Dương', 'Ngọc Hồi'], correct: [0, 2], seconds: 30, score_mode: 'double' }),
      question({ qtype: 'truefalse', prompt: 'Trận Bạch Đằng năm 1288 diễn ra trên sông Bạch Đằng.', tf: true, seconds: 10, score_mode: 'none' }),
    ], { cover_url: 'https://upload.wikimedia.org/bia.jpg', shuffle_options: true }));
    const res = await commit(draft);
    expect(res.status).toBe(200);
    const quiz = res.body.quiz;
    quizId = quiz.id;
    expect(quiz).toMatchObject({ title: 'Ba lần kháng chiến', description: 'Ôn tập nhanh', shuffle_options: true, cover_url: 'https://upload.wikimedia.org/bia.jpg', theme: { bg: 'bach-dang', music: 'song-nuoc' }, scope: 'teacher' });
    expect(quiz.items.map((i: any) => [i.qtype, i.seconds, i.score_mode])).toEqual([['single', 20, 'standard'], ['multiple', 30, 'double'], ['truefalse', 10, 'none']]);
    questionIds = quiz.items.map((i: any) => i.question_id);
    // câu hỏi nằm trong ngân hàng với mã đáp án a–d theo vị trí ▲ ◆ ● ■
    const q1 = (await t1('GET', `/api/content/questions/${questionIds[0]}`)).body;
    expect(q1).toMatchObject({ qtype: 'single', image_url: 'https://upload.wikimedia.org/anh-minh-hoa.jpg', explanation: 'Ông là Quốc công tiết chế.', data: { correct: 'a', options: [{ id: 'a', text: 'Trần Hưng Đạo' }, { id: 'b', text: 'Lê Lợi' }, { id: 'c', text: 'Quang Trung' }] } });
    expect((await t1('GET', `/api/content/questions/${questionIds[1]}`)).body.data).toMatchObject({ correct: ['a', 'c'] });
    expect((await t1('GET', `/api/content/questions/${questionIds[2]}`)).body.data).toEqual({ correct: true });
    // bộ đề dùng được ngay ở nơi khác (HK.GV.032 / 041): có trong danh sách bộ đề và xem được như bộ đề thường
    expect((await t1('GET', '/api/content/quizzes?store=mine')).body.items.map((x: any) => x.id)).toContain(quizId);
    expect((await t1('GET', `/api/content/quizzes/${quizId}`)).body.items).toHaveLength(3);
    // lưu lại khi không đổi gì: giữ nguyên bộ đề, câu hỏi và phiên bản
    const again = await commit(draft);
    expect(again.body.quiz.id).toBe(quizId);
    expect(again.body.quiz.items.map((i: any) => i.question_id)).toEqual(questionIds);
    expect((await t1('GET', `/api/content/questions/${questionIds[0]}`)).body.version_no).toBe(1);
    expect((await db.query('SELECT 1 FROM hk_quizzes')).length).toBe(1);
  });

  test('sửa Quiz đã lưu: câu riêng chưa dùng ở đâu khác được sửa tại chỗ; câu đã nằm trong bộ đề khác được tạo bản mới', async () => {
    const reopened = await t1('POST', '/api/content/studio', { from_quiz_id: quizId });
    expect(reopened.status).toBe(200);
    expect(reopened.body.id).toBe(draft); // mở lại đúng bản nháp của bộ đề này
    const p = reopened.body.payload;
    expect(p.questions.map((x: any) => [x.qtype, x.seconds, x.score_mode])).toEqual([['single', 20, 'standard'], ['multiple', 30, 'double'], ['truefalse', 10, 'none']]);
    expect(p.questions[1]).toMatchObject({ options: ['Bạch Đằng', 'Lam Sơn', 'Chương Dương', 'Ngọc Hồi'], correct: [0, 2] });
    p.questions[0].prompt = 'Ai là Quốc công tiết chế của nhà Trần?';
    await save(draft, p);
    const first = await commit(draft);
    expect(first.body.quiz.items[0].question_id).toBe(questionIds[0]);
    expect((await t1('GET', `/api/content/questions/${questionIds[0]}`)).body).toMatchObject({ version_no: 2, prompt: 'Ai là Quốc công tiết chế của nhà Trần?' });
    // câu thứ hai được dùng thêm ở một bộ đề khác → sửa sẽ không đổi bộ đề kia
    const other = await t1('POST', '/api/content/quizzes', { title: 'Bộ đề khác', items: [{ question_id: questionIds[1] }] });
    expect(other.status).toBe(201);
    p.questions[1].prompt = 'Những địa danh nào gắn với chiến thắng quân Nguyên – Mông?';
    await save(draft, p);
    const second = await commit(draft);
    expect(second.body.quiz.items[1].question_id).not.toBe(questionIds[1]);
    expect((await t1('GET', `/api/content/quizzes/${other.body.id}`)).body.items[0].question_id).toBe(questionIds[1]);
    expect((await t1('GET', `/api/content/questions/${questionIds[1]}`)).body.prompt).toMatch(/gắn với kháng chiến/);
  });

  test('mở bộ đề để sửa: chỉ bộ đề của chính mình, không khóa, và chỉ gồm các dạng câu mà trình soạn hỗ trợ', async () => {
    expect((await as(f.T2)('POST', '/api/content/studio', { from_quiz_id: quizId })).status).toBe(404);
    expect((await t1('POST', '/api/content/studio', { from_quiz_id: 'abc' })).status).toBe(400);
    // bộ đề có câu điền khuyết → hướng dẫn dùng mục Bộ đề
    const fill = await t1('POST', '/api/content/questions', { qtype: 'fill', prompt: 'Trần Hưng Đạo viết ____ để khích lệ tướng sĩ.', data: { blanks: [{ accept: ['Hịch tướng sĩ'] }] } });
    expect(fill.status).toBe(201);
    const mixed = await t1('POST', '/api/content/quizzes', { title: 'Có câu điền khuyết', items: [{ question_id: fill.body.id }] });
    const refused = await t1('POST', '/api/content/studio', { from_quiz_id: mixed.body.id });
    expect(refused.status).toBe(409);
    expect(refused.body.detail).toMatch(/Câu 1 thuộc dạng "fill"/);
    // bộ đề đã có học sinh làm thì khóa chỉnh sửa
    await db.query("INSERT INTO hk_attempts (user_id, quiz_id, mode, plan) VALUES ($1, $2, 'node', '[]')", [f.S1.id, quizId]);
    await save(draft, payload([question()]));
    const locked = await commit(draft);
    expect(locked.status).toBe(409);
    expect(locked.body.detail).toMatch(/nhân bản/);
    await db.query('DELETE FROM hk_attempts WHERE quiz_id = $1', [quizId]);
  });

  test('HK.GV.093 giao diện Quiz chỉ nhận nền và nhạc có trong danh sách', async () => {
    expect((await t1('POST', '/api/content/quizzes', { title: 'Giao diện lạ', theme: { bg: 'khong-co' }, items: [{ question_id: questionIds[2] }] })).status).toBe(400);
    expect((await t1('POST', '/api/content/quizzes', { title: 'Nhạc lạ', theme: { music: 'rock' }, items: [{ question_id: questionIds[2] }] })).status).toBe(400);
    expect((await t1('POST', '/api/content/quizzes', { title: 'Ảnh bìa lạ', cover_url: 'javascript:alert(1)', items: [{ question_id: questionIds[2] }] })).status).toBe(400);
    expect((await t1('POST', '/api/content/quizzes', { title: 'Loại điểm lạ', items: [{ question_id: questionIds[2], score_mode: 'triple' }] })).status).toBe(422);
  });

  // ------------------------------------------------------------------ HK.GV.085/092 ảnh tải lên
  test('HK.GV.092 tải ảnh lên: xác định loại bằng nội dung thật, giới hạn kích thước, phục vụ công khai theo mã ngẫu nhiên', async () => {
    expect((await as(f.S1)('POST', '/api/content/media', { data: PNG })).status).toBe(403);
    const up = await t1('POST', '/api/content/media', { name: 'tranh.png', data: `data:image/png;base64,${PNG}` });
    expect(up.status).toBe(200);
    expect(up.body.url).toMatch(/^\/api\/content\/media\/[0-9a-f]{32}$/);
    expect(up.body).toMatchObject({ mime: 'image/png', name: 'tranh.png' });
    const file = await fetch(`${s.base}${up.body.url}`);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('image/png');
    expect(file.headers.get('cache-control')).toMatch(/immutable/);
    expect(Buffer.from(await file.arrayBuffer()).equals(Buffer.from(PNG, 'base64'))).toBe(true);
    expect((await fetch(`${s.base}/api/content/media/${'0'.repeat(32)}`)).status).toBe(404);
    expect((await fetch(`${s.base}/api/content/media/khong-hop-le`)).status).toBe(404);
    // không phải ảnh (đổi đuôi / loại khai báo cũng không qua), rỗng, quá lớn
    expect((await t1('POST', '/api/content/media', { data: Buffer.from('<svg onload=alert(1)>').toString('base64') })).status).toBe(400);
    expect((await t1('POST', '/api/content/media', { data: '' })).status).toBe(400);
    expect((await t1('POST', '/api/content/media', { data: '%%%' })).status).toBe(400);
    const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(1_650_000)]).toString('base64');
    const huge = await t1('POST', '/api/content/media', { data: big });
    expect(huge.status).toBe(400);
    expect(huge.body.detail).toMatch(/1,5 MB/);
    // dùng ảnh đã tải làm ảnh câu hỏi và ảnh bìa; liên kết lạ bị từ chối
    const withImage = await t1('POST', '/api/content/questions', { qtype: 'truefalse', prompt: 'Bức tranh này vẽ trận Bạch Đằng.', image_url: up.body.url, video_url: 'https://www.youtube.com/watch?v=abcdefghijk', data: { correct: true } });
    expect(withImage.status).toBe(201);
    expect(withImage.body).toMatchObject({ image_url: up.body.url, video_url: 'https://www.youtube.com/watch?v=abcdefghijk' });
    expect((await t1('POST', '/api/content/questions', { qtype: 'truefalse', prompt: 'Ảnh lạ', image_url: '/api/content/media/abc', data: { correct: true } })).status).toBe(400);
    expect((await t1('POST', '/api/content/questions', { qtype: 'truefalse', prompt: 'Video lạ', video_url: 'http://example.com/v.mp4', data: { correct: true } })).status).toBe(400);
    expect((await t1('POST', '/api/content/quizzes', { title: 'Có ảnh bìa tải lên', cover_url: up.body.url, items: [{ question_id: withImage.body.id }] })).status).toBe(201);
  });

  test('HK.GV.092 kho ảnh: ảnh tôi đã tải lên và ảnh sử liệu đã công bố; tìm theo tên', async () => {
    const lib = await t1('GET', '/api/content/media-library');
    expect(lib.status).toBe(200);
    expect(lib.body.uploads).toHaveLength(1);
    expect(lib.body.uploads[0].url).toMatch(/^\/api\/content\/media\//);
    expect((await as(f.T2)('GET', '/api/content/media-library')).body.uploads).toHaveLength(0); // ảnh của người khác không hiện
    await db.query("INSERT INTO hist_sources (slug, title, kind, attachment_url, status) VALUES ('tranh-bach-dang', 'Tranh trận Bạch Đằng', 'hinh_anh', 'https://upload.wikimedia.org/bach-dang.jpg', 'published'), ('tranh-nhap', 'Tranh còn nháp', 'hinh_anh', 'https://upload.wikimedia.org/nhap.jpg', 'draft')");
    const found = await t1('GET', `/api/content/media-library?q=${encodeURIComponent('bạch đằng')}`);
    expect(found.body.library.map((x: any) => x.title)).toEqual(['Tranh trận Bạch Đằng']);
    expect(found.body.library[0]).toMatchObject({ kind: 'source', url: 'https://upload.wikimedia.org/bach-dang.jpg' });
    expect((await t1('GET', '/api/content/media-library?q=nhap')).body.library).toHaveLength(0); // bản nháp không hiện
  });

  test('xóa bản nháp: chỉ chủ bản nháp; bộ đề đã lưu vẫn còn', async () => {
    expect((await as(f.T2)('DELETE', `/api/content/studio/${draft}`)).status).toBe(404);
    expect((await t1('DELETE', `/api/content/studio/${draft}`)).body).toEqual({ deleted: true });
    expect((await t1('GET', `/api/content/studio/${draft}`)).status).toBe(404);
    expect((await t1('GET', `/api/content/quizzes/${quizId}`)).status).toBe(200);
  });
});
