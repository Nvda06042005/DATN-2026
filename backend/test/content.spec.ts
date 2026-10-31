import { adminLogin, call, hasPostgres, makeUser, sql, Started, startApp } from './harness';
import type { ContentService } from '../src/student/content.service';
import type { DatabaseService } from '../src/database/database.service';

let s: Started, db: DatabaseService, content: ContentService, root: string, schoolAdmin: string, teacher: string, student: string, studentId: number;
const api = (method: string, path: string, body?: unknown, token = root) => call(s.base, method, path, body, token);
const base = () => [...content.questions.values()].find((q) => q.type === 'mcq')!;
const mcq = (unit: string, over: Record<string, unknown> = {}) => ({ unit_id: unit, type: 'mcq', prompt: 'Câu hỏi kiểm thử về kháng chiến?', explanation: 'Giải thích kiểm thử.', options: ['A', 'B', 'C'], answer: 1, level: 'THONG_HIEU', ...over });
const rules = async () => (await api('GET', '/api/admin/content/rules')).body;

(hasPostgres() ? describe : describe.skip)('TM.SA-CONTENT quản lý nội dung và cấu hình', () => {
  beforeAll(async () => {
    s = await startApp('content_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    content = s.moduleRef.get((await import('../src/student/content.service')).ContentService);
    root = await adminLogin(s.base);
    await api('POST', '/api/admin/schools', { school_code: '2201', name: 'Trường nội dung A' });
    const schoolId = (await db.query<{ id: number }>("SELECT id FROM app_schools WHERE school_code = '2201'"))[0].id;
    const created = (await api('POST', '/api/admin/users', { role: 'school_admin', school_id: schoolId, full_name: 'Quản trị trường nội dung', password: 'ContentTest@123' })).body.user;
    schoolAdmin = (await api('POST', '/api/auth/login', { username: created.username, password: 'ContentTest@123', portal: 'school_admin' }, '')).body.token;
    [teacher] = await makeUser(s.base, root, 'Giáo viên nội dung', 'teacher', null, 'ContentTest@123');
    let user;
    [student, user] = await makeUser(s.base, root, 'Học sinh nội dung', 'student', null, 'ContentTest@123');
    studentId = user.id;
  });
  afterAll(async () => {
    await s?.close();
  });

  test('chỉ quản trị tổng dùng được; quản trị trường, giáo viên, học sinh và khách đều bị chặn', async () => {
    for (const path of ['/api/admin/content/curriculum', '/api/admin/content/questions', '/api/admin/content/sources', '/api/admin/content/cards', '/api/admin/content/rules', '/api/admin/system/health', '/api/admin/system/events']) {
      expect((await api('GET', path)).status).toBe(200);
      for (const token of [schoolAdmin, teacher, student]) expect((await api('GET', path, undefined, token)).status).toBe(403);
      expect((await api('GET', path, undefined, '')).status).toBe(401);
    }
    expect((await api('POST', '/api/admin/content/rules', { config: {} }, schoolAdmin)).status).toBe(403);
  });

  test('chương trình: dữ liệu gốc 3 cuộc kháng chiến + 9 ải, cấp bậc đúng thứ tự, phiên bản và lịch sử', async () => {
    const { nodes } = (await api('GET', '/api/admin/content/curriculum')).body;
    expect(nodes.filter((n: any) => n.kind === 'campaign').map((n: any) => n.code)).toEqual(['KC1', 'KC2', 'KC3']);
    expect(nodes.filter((n: any) => n.kind === 'stage')).toHaveLength(9);
    expect(nodes.every((n: any) => n.status === 'published' && n.version === 1)).toBe(true);
    const kc1 = nodes.find((n: any) => n.code === 'KC1').id;
    expect((await api('POST', '/api/admin/content/curriculum', { kind: 'chapter', code: 'KC1.C1', title: 'Chương thử' })).status).toBe(422); // thiếu cấp cha
    expect((await api('POST', '/api/admin/content/curriculum', { kind: 'campaign', code: 'KC4', title: 'Cuộc thử', parent_id: kc1 })).status).toBe(422);
    const chapter = (await api('POST', '/api/admin/content/curriculum', { kind: 'chapter', code: 'KC1.C1', title: 'Chương thử', parent_id: kc1 })).body;
    expect(chapter).toMatchObject({ status: 'draft', version: 1, kind: 'chapter' });
    expect((await api('POST', '/api/admin/content/curriculum', { kind: 'chapter', code: 'KC1.C1', title: 'Trùng mã', parent_id: kc1 })).status).toBe(409);
    const stageId = nodes.find((n: any) => n.kind === 'stage').id;
    expect((await api('POST', '/api/admin/content/curriculum', { kind: 'lesson', code: 'KC1.B0', title: 'Bài sai cấp', parent_id: stageId })).status).toBe(422); // bài không nằm dưới ải
    const lesson = (await api('POST', '/api/admin/content/curriculum', { kind: 'lesson', code: 'KC1.B1', title: 'Bài thử', parent_id: chapter.id })).body;
    expect((await api('PATCH', `/api/admin/content/curriculum/${lesson.id}`, { status: 'published' })).status).toBe(422); // cha còn nháp
    expect((await api('PATCH', `/api/admin/content/curriculum/${chapter.id}`, { status: 'published' })).body).toMatchObject({ status: 'published', version: 2 });
    expect((await api('PATCH', `/api/admin/content/curriculum/${lesson.id}`, { status: 'published' })).body.status).toBe('published');
    expect((await api('PATCH', `/api/admin/content/curriculum/${chapter.id}`, { status: 'draft' })).status).toBe(409); // còn mục con đang xuất bản
    expect((await api('PATCH', `/api/admin/content/curriculum/${chapter.id}`, { title: 'Chương thử' })).body.version).toBe(2); // không đổi gì thì không tăng phiên bản
    const edited = (await api('PATCH', `/api/admin/content/curriculum/${chapter.id}`, { title: 'Chương đã sửa', summary: 'Mô tả mới' })).body;
    expect(edited).toMatchObject({ title: 'Chương đã sửa', version: 3 });
    const history = (await api('GET', `/api/admin/content/history?entity=curriculum&id=${chapter.id}`)).body;
    expect(history.map((h: any) => [h.version, h.action])).toEqual([[3, 'update'], [2, 'publish'], [1, 'create']]);
    expect(history[0].actor_name).toBe('Quản trị tổng Đông A');
    expect((await api('GET', '/api/admin/content/history?entity=bogus&id=1')).status).toBe(422);
    expect((await api('PATCH', '/api/admin/content/curriculum/999999', { title: 'Không có' })).status).toBe(404);
  });

  test('ngân hàng câu hỏi: ẩn, sửa nháp rồi xuất bản, tạo mới và khôi phục câu gốc có hiệu lực ngay với học sinh', async () => {
    const total = content.questions.size;
    const list = (await api('GET', '/api/admin/content/questions?limit=5')).body;
    expect(list.counts).toMatchObject({ all: total, published: total, hidden: 0, draft: 0 });
    const original = base(), unit = original.unit_id, before = JSON.stringify(original);
    expect((await api('GET', `/api/admin/content/questions?q=${encodeURIComponent(original.id)}`)).body.items.map((i: any) => i.id)).toContain(original.id);

    // Ẩn: học sinh không còn nhận được câu này; khôi phục thì quay lại
    expect((await api('POST', `/api/admin/content/questions/${original.id}/status`, { status: 'hidden', note: 'Chờ rà soát' })).body).toMatchObject({ status: 'hidden', origin: 'file' });
    expect(content.questions.has(original.id)).toBe(false);
    expect(content.byUnit.get(unit)).not.toContain(original.id);
    expect((await api('POST', '/api/student/answer', { question_id: original.id, choice: 0 }, student)).status).toBe(404);
    expect((await api('GET', '/api/admin/content/questions?status=hidden')).body.total).toBe(1);
    expect((await api('DELETE', `/api/admin/content/questions/${original.id}`)).status).toBe(204);
    expect(JSON.stringify(content.questions.get(original.id))).toBe(before);

    // Sửa câu gốc: lần đầu là bản nháp (học sinh vẫn thấy bản gốc), xuất bản mới đổi
    const edit = mcq(unit, { prompt: 'Bản chỉnh sửa của câu gốc?', options: ['X', 'Y'], answer: 0 });
    const draft = (await api('PATCH', `/api/admin/content/questions/${original.id}`, edit)).body;
    expect(draft).toMatchObject({ status: 'draft', origin: 'file' });
    expect(draft.original.prompt).toBe(original.prompt);
    expect(content.questions.get(original.id)!.prompt).toBe(original.prompt);
    expect((await api('POST', `/api/admin/content/questions/${original.id}/status`, { status: 'published' })).body.status).toBe('published');
    expect(content.questions.get(original.id)!.prompt).toBe('Bản chỉnh sửa của câu gốc?');
    expect((await api('DELETE', `/api/admin/content/questions/${original.id}`)).status).toBe(204);
    expect(content.questions.get(original.id)!.prompt).toBe(original.prompt);

    // Câu mới: sai định dạng bị từ chối; nháp chưa tới học sinh; xuất bản thì chấm được và dùng luật EXP hiện hành
    expect((await api('POST', '/api/admin/content/questions', mcq(unit, { answer: 7 }))).status).toBe(422);
    expect((await api('POST', '/api/admin/content/questions', mcq(unit, { options: ['A', 'A'] }))).status).toBe(422);
    expect((await api('POST', '/api/admin/content/questions', mcq('KHONG_CO_CUM'))).status).toBe(422);
    expect((await api('POST', '/api/admin/content/questions', { ...mcq(unit), type: 'tf', answer: 'sai' })).status).toBe(422);
    const created = (await api('POST', '/api/admin/content/questions', mcq(unit))).body;
    expect(created).toMatchObject({ origin: 'admin', status: 'draft' });
    expect(content.questions.has(created.id)).toBe(false);
    expect((await api('POST', `/api/admin/content/questions/${created.id}/status`, { status: 'published' })).body.status).toBe('published');
    expect(content.byUnit.get(unit)).toContain(created.id);
    const graded = await api('POST', '/api/student/answer', { question_id: created.id, choice: 1 }, student);
    expect(graded.body).toMatchObject({ correct: true, xp_gained: 10 });
    expect((await api('DELETE', `/api/admin/content/questions/${created.id}`)).status).toBe(409); // đang xuất bản thì phải ẩn trước
    await api('POST', `/api/admin/content/questions/${created.id}/status`, { status: 'hidden' });
    expect((await api('DELETE', `/api/admin/content/questions/${created.id}`)).status).toBe(204);
    expect(content.questions.has(created.id)).toBe(false);
    const history = (await api('GET', `/api/admin/content/history?entity=question&id=${original.id}`)).body;
    expect(history.map((h: any) => h.action)).toEqual(['restore_original', 'publish', 'edit', 'restore_original', 'hide']);
    expect((await api('GET', '/api/admin/content/questions/khong-co-cau-nay')).status).toBe(404);
  });

  test('kho sử liệu AI: chỉ tư liệu đã duyệt mới được tìm thấy, kèm nguồn trích dẫn', async () => {
    const doc = { title: 'Trích đoạn kiểm thử Bạch Đằng', citation: 'Tài liệu kiểm thử, trang 12', kind: 'chinh_su', content: 'Năm 1288, quân Trần bố trí cọc ngầm trên sông Bạch Đằng và đánh tan thủy quân Nguyên.' };
    expect((await api('POST', '/api/admin/content/sources', { ...doc, content: 'quá ngắn' })).status).toBe(422);
    expect((await api('POST', '/api/admin/content/sources', { ...doc, citation: '' })).status).toBe(422);
    const src = (await api('POST', '/api/admin/content/sources', doc)).body;
    expect(src).toMatchObject({ status: 'pending', version: 1 });
    expect(src.content).toBeUndefined();
    const search = async (q = 'cọc ngầm Bạch Đằng') => (await api('GET', `/api/admin/content/sources/search?q=${encodeURIComponent(q)}`)).body;
    expect(await search()).toEqual([]); // chờ duyệt: chưa vào tìm kiếm
    expect((await api('POST', `/api/admin/content/sources/${src.id}/review`, { decision: 'reject' })).status).toBe(422); // từ chối phải có lý do
    expect((await api('POST', `/api/admin/content/sources/${src.id}/review`, { decision: 'reopen' })).status).toBe(409);
    expect((await api('POST', `/api/admin/content/sources/${src.id}/review`, { decision: 'approve' })).body).toMatchObject({ status: 'approved', version: 2 });
    const hits = await search('coc ngam bach dang');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ id: src.id, citation: 'Tài liệu kiểm thử, trang 12' });
    expect(hits[0].excerpt).toContain('cọc ngầm');
    expect((await api('PATCH', `/api/admin/content/sources/${src.id}`, { citation: 'Nguồn khác, trang 3' })).body.status).toBe('pending'); // đổi nguồn phải duyệt lại
    expect(await search()).toEqual([]);
    await api('POST', `/api/admin/content/sources/${src.id}/review`, { decision: 'approve' });
    await api('POST', `/api/admin/content/sources/${src.id}/review`, { decision: 'archive', note: 'Thay bản mới' });
    expect(await search()).toEqual([]);
    const detail = (await api('GET', `/api/admin/content/sources/${src.id}`)).body;
    expect(detail).toMatchObject({ status: 'archived', content: doc.content });
    expect((await api('GET', '/api/admin/content/sources?status=archived')).body).toMatchObject({ total: 1, counts: { archived: 1, approved: 0, pending: 0, rejected: 0 } });
    const history = (await api('GET', `/api/admin/content/history?entity=ai_source&id=${src.id}`)).body;
    expect(history.map((h: any) => h.action)).toEqual(['archive', 'approve', 'update', 'approve', 'upload']);
    expect(JSON.stringify(history)).not.toContain('cọc ngầm'); // lịch sử chỉ giữ chữ ký nội dung, không nhân bản văn bản
    expect(history[4].snapshot.content_sha256).toHaveLength(64);
  });

  test('thẻ danh tướng: dữ liệu gốc phân biệt chính sử và giai thoại; tạo, sửa, xuất bản, lưu trữ có lịch sử', async () => {
    const all = (await api('GET', '/api/admin/content/cards')).body;
    expect(all.items).toHaveLength(14);
    expect(all.counts).toMatchObject({ all: 14, chinh_su: 12, giai_thoai: 2, published: 14 });
    expect((await api('GET', '/api/admin/content/cards?kind=giai_thoai')).body.items.map((c: any) => c.code).sort()).toEqual(['pham_ngu_lao', 'yet_kieu']);
    expect((await api('GET', '/api/admin/content/cards?rarity=tiet_che')).body.items.map((c: any) => c.code)).toEqual(['tran_hung_dao']);
    const card = { code: 'the_thu_nghiem', name: 'Thẻ thử nghiệm', rarity: 'hiem', kind: 'giai_thoai', source: 'Truyền thuyết dân gian, cần đối chiếu', unlock_condition: 'Hoàn thành ải thử' };
    expect((await api('POST', '/api/admin/content/cards', { ...card, rarity: 'vang' })).status).toBe(422);
    expect((await api('POST', '/api/admin/content/cards', { ...card, source: '' })).status).toBe(422);
    expect((await api('POST', '/api/admin/content/cards', { ...card, code: 'Sai Ma' })).status).toBe(422);
    expect((await api('POST', '/api/admin/content/cards', card)).body).toMatchObject({ status: 'draft', version: 1, kind: 'giai_thoai' });
    expect((await api('POST', '/api/admin/content/cards', card)).status).toBe(409);
    expect((await api('PATCH', '/api/admin/content/cards/the_thu_nghiem', { rarity: 'su_thi', unlock_condition: 'Thắng ải 2', status: 'published' })).body).toMatchObject({ rarity: 'su_thi', status: 'published', version: 2 });
    expect((await api('PATCH', '/api/admin/content/cards/the_thu_nghiem', { rarity: 'su_thi' })).body.version).toBe(2);
    expect((await api('PATCH', '/api/admin/content/cards/the_thu_nghiem', { status: 'archived' })).body.status).toBe('archived');
    expect((await api('PATCH', '/api/admin/content/cards/khong_co', { name: 'Không có' })).status).toBe(404);
    expect((await api('GET', '/api/admin/content/history?entity=hero_card&id=the_thu_nghiem')).body.map((h: any) => h.action)).toEqual(['archive', 'publish', 'create']);
  });

  test('luật EXP: phiên bản gốc = luật đang chạy; đổi luật chỉ áp dụng cho câu trả lời sau đó và không sửa điểm đã ghi nhận', async () => {
    const first = await rules();
    expect(first.active).toMatchObject({ version: 1, config: { xp_correct: 10, xp_wrong: 2, gems_correct: 10, gems_weak: 15, daily_gem_cap: 300, weak_threshold: 0.6 } });
    expect(first.active.config.levels.slice(0, 4).map((l: any) => l.min_xp)).toEqual([0, 40, 160, 360]);
    await db.getProgress(studentId);
    await db.saveProgress(studentId, { xp: 500, gems: 77 });
    const config = { ...first.active.config, xp_correct: 25, xp_wrong: 4, badges: [{ code: 'chuoi_7', name: 'Chuỗi 7 ngày', metric: 'streak', threshold: 7, reward_xp: 50, reward_gems: 20 }] };
    const bad = async (patch: Record<string, unknown>, status = 422) => expect((await api('POST', '/api/admin/content/rules', { config: { ...config, ...patch } })).status).toBe(status);
    await bad({ xp_wrong: 30 }); // sai không được thưởng hơn đúng
    await bad({ xp_correct: -1 });
    await bad({ daily_gem_cap: 5 });
    await bad({ weak_threshold: 2 });
    await bad({ levels: [{ level: 1, name: 'Cấp 1', min_xp: 10 }, { level: 2, name: 'Cấp 2', min_xp: 50 }] }); // cấp 1 phải từ 0
    await bad({ levels: [{ level: 1, name: 'Cấp 1', min_xp: 0 }, { level: 2, name: 'Cấp 2', min_xp: 0 }] }); // phải tăng dần
    await bad({ badges: [{ ...config.badges[0] }, { ...config.badges[0] }] }); // trùng mã
    await bad({ badges: [{ ...config.badges[0], metric: 'gems' }] });
    expect((await api('POST', '/api/admin/content/rules', { config: first.active.config })).status).toBe(409); // không đổi gì
    expect((await api('POST', '/api/admin/content/rules', { config, note: 'Tăng thưởng tuần lễ' })).body).toMatchObject({ version: 2, config: { xp_correct: 25 } });
    const q = base(), key = q.answer as number;
    const win = await api('POST', '/api/student/answer', { question_id: q.id, choice: key }, student);
    expect(win.body).toMatchObject({ correct: true, xp_gained: 25 });
    expect(win.body.progress.xp).toBe(525); // 500 đã ghi nhận + 25, không bị tính lại theo luật mới
    const loss = await api('POST', '/api/student/answer', { question_id: q.id, choice: -1 }, student);
    expect(loss.body).toMatchObject({ correct: false, xp_gained: 4 });
    const second = await rules();
    expect(second.active.version).toBe(2);
    expect(second.versions.map((v: any) => [v.version, v.is_active, v.note])).toEqual([[2, true, 'Tăng thưởng tuần lễ'], [1, false, 'Giá trị đang dùng trước khi có trang cấu hình']]);
    expect((await api('GET', '/api/admin/content/rules/1')).body.config.xp_correct).toBe(10);
    expect((await api('GET', '/api/admin/content/rules/99')).status).toBe(404);
    // Quay lại luật cũ = một phiên bản mới (lịch sử không bị xóa)
    expect((await api('POST', '/api/admin/content/rules', { config: first.active.config, note: 'Khôi phục v1' })).body.version).toBe(3);
    expect((await api('POST', '/api/student/answer', { question_id: q.id, choice: key }, student)).body.xp_gained).toBe(10);
    expect(await sql(s.url, 'SELECT count(*)::int AS n FROM app_exp_rules WHERE is_active')).toEqual([{ n: 1 }]);
    expect((await api('GET', '/api/admin/content/history?entity=exp_rules&id=3')).body[0]).toMatchObject({ action: 'save', version: 3 });
  });

  test('luật và nội dung được nạp lại khi khởi động lại dịch vụ', async () => {
    const { CatalogService } = await import('../src/admin/catalog.service');
    const progress = await import('../src/student/progress');
    const id = (await api('POST', '/api/admin/content/questions', mcq(base().unit_id, { prompt: 'Câu để kiểm thử nạp lại?' }))).body.id;
    await api('POST', `/api/admin/content/questions/${id}/status`, { status: 'published' });
    await api('POST', '/api/admin/content/rules', { config: { ...(await rules()).active.config, xp_correct: 12 } });
    content.applyOverlay([]);
    progress.setActiveRules(progress.DEFAULT_RULES);
    expect(content.questions.has(id)).toBe(false);
    await s.moduleRef.get(CatalogService).onApplicationBootstrap();
    expect(content.questions.has(id)).toBe(true);
    expect(progress.activeRules().xp_correct).toBe(12);
  });

  test('nhật ký và sức khỏe: hợp nhất đăng nhập, thao tác, lỗi nhập Excel, lỗi gửi thư; lọc theo thời gian, trường, loại và mức', async () => {
    const schoolId = (await db.query<{ id: number }>("SELECT id FROM app_schools WHERE school_code = '2201'"))[0].id;
    await api('POST', '/api/auth/login', { username: 'admin', password: 'sai-mat-khau', portal: 'root_admin' }, '');
    await db.query("INSERT INTO app_import_batches (school_id, file_name, total_rows, error_count, incomplete_count) VALUES ($1, 'danh-sach-loi.xlsx', 20, 3, 2)", [schoolId]);
    await db.query("INSERT INTO app_email_outbox (school_id, kind, to_email, subject, status, attempts, last_error) VALUES ($1, 'bulk', 'nguoi.nhan@example.invalid', 'Thông tin đăng nhập', 'failed', 3, 'ERELAYSEND')", [schoolId]);
    const all = (await api('GET', '/api/admin/system/events?limit=100')).body;
    expect(all.counts.login).toBeGreaterThan(0);
    expect(all.counts).toMatchObject({ import: 1, mail: 1 });
    const failedLogin = all.items.find((e: any) => e.kind === 'login' && e.level === 'warn');
    expect(failedLogin.title).toContain('thất bại');
    expect(all.items.find((e: any) => e.kind === 'import')).toMatchObject({ level: 'error', school_name: 'Trường nội dung A', detail: '3 dòng lỗi, 2 dòng thiếu thông tin trên 20 dòng' });
    expect(all.items.find((e: any) => e.kind === 'mail')).toMatchObject({ level: 'error', detail: 'ERELAYSEND', school_name: 'Trường nội dung A' });
    const text = JSON.stringify(all);
    for (const secret of ['nguoi.nhan@example.invalid', 'sai-mat-khau', 'admin@123', 'ContentTest@123', 'Bearer']) expect(text).not.toContain(secret);
    expect((await api('GET', '/api/admin/system/events?kind=mail')).body).toMatchObject({ total: 1, items: [{ kind: 'mail' }] });
    expect((await api('GET', `/api/admin/system/events?school_id=${schoolId}`)).body.items.every((e: any) => e.school_id === schoolId)).toBe(true);
    expect((await api('GET', '/api/admin/system/events?level=warn&kind=login')).body.items.every((e: any) => e.level === 'warn')).toBe(true);
    const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    expect((await api('GET', `/api/admin/system/events?from=${today}&to=${today}`)).body.total).toBe(all.total);
    expect((await api('GET', '/api/admin/system/events?from=2020-01-01&to=2020-01-31')).body).toMatchObject({ total: 0, items: [] });
    expect((await api('GET', '/api/admin/system/events?from=31-01-2020')).status).toBe(422);
    expect((await api('GET', '/api/admin/system/events?kind=bogus')).status).toBe(422);
    const page = (await api('GET', '/api/admin/system/events?limit=2&page=1')).body;
    expect(page.items).toHaveLength(2);
    expect(page.has_more).toBe(true);

    const health = (await api('GET', '/api/admin/system/health')).body;
    expect(health).toMatchObject({ api: { status: 'ok' }, database: { status: 'ok', schema_version: 11 }, ai: { status: 'ok' }, mail: { failed: 1 }, imports: { batches_24h: 1, error_rows_24h: 3 } });
    expect(health.logins.failed_24h).toBeGreaterThan(0);
    expect(JSON.stringify(health)).not.toContain('postgresql://');
  });

  test('bảng nội dung bật RLS và vai trò theo trường không đọc hay ghi được', async () => {
    const tables = ['app_content_history', 'app_curriculum_nodes', 'app_question_bank', 'app_ai_sources', 'app_hero_cards', 'app_exp_rules'];
    expect(await sql(s.url, "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND rowsecurity AND tablename = ANY($1)", [tables])).toEqual([{ n: 6 }]);
    expect(await sql(s.url, "SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY($1)", [tables])).toEqual([{ n: 0 }]);
    for (const table of tables) {
      await expect(sql(s.url, `SET ROLE dong_a_school_scope; SELECT 1 FROM public.${table}`)).rejects.toThrow(/permission denied/);
      await expect(sql(s.url, `SET ROLE dong_a_school_scope; DELETE FROM public.${table}`)).rejects.toThrow(/permission denied/);
    }
  });
});
