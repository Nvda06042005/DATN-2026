/**
 * API HTTP: đăng nhập & tài khoản, game học sinh (server chấm, cộng Ấn Tín/XP, lưu trạng thái), lớp của giáo viên, AI.
 * Backend NestJS thật + PostgreSQL tạm; dịch vụ AI Python được thay bằng FakeAi.
 */
import { adminLogin, call, hasPostgres, makeUser, Started, startApp } from './harness';
import type { MailService } from '../src/admin/mail.service';
import type { BankQuestion, ContentService } from '../src/student/content.service';
import type { DatabaseService } from '../src/database/database.service';
import type * as Progress from '../src/student/progress';

let s: Started;
let content: ContentService;
let db: DatabaseService;
let mail: MailService;
let prog: typeof Progress;
let ADMIN: string;
let T: string;
let S0: string;
let S1: string;
let u0: { id: number; username: string };
let u1: { id: number; username: string };

const api = <B = any>(method: string, path: string, body?: unknown, token?: string) => call<B>(s.base, method, path, body, token);
const first = (type: string, unit?: string): BankQuestion => [...content.questions.values()].find((q) => q.type === type && (!unit || q.unit_id === unit))!;

function right(q: BankQuestion): Record<string, unknown> {
  if (q.type === 'mcq' || q.type === 'map' || q.type === 'tf') return { choice: q.answer };
  if (q.type === 'order') return { order: q.items!.map((_, i) => i) };
  return { pairs: Object.fromEntries(q.left!.map((_, i) => [String(i), i])) };
}

function wrong(q: BankQuestion): Record<string, unknown> {
  if (q.type === 'mcq') return { choice: ((q.answer as number) + 1) % q.options!.length };
  if (q.type === 'map') return { choice: q.options!.find((o) => o !== q.answer) };
  if (q.type === 'tf') return { choice: !q.answer };
  if (q.type === 'order') return { order: q.items!.map((_, i) => i).reverse() };
  const n = q.left!.length;
  return { pairs: Object.fromEntries(q.left!.map((_, i) => [String(i), (i + 1) % n])) };
}

async function answer(token: string, q: BankQuestion, payload: Record<string, unknown>) {
  const res = await api('POST', '/api/student/answer', { question_id: q.id, ...payload }, token);
  expect(res.status).toBe(200);
  return res.body;
}

(hasPostgres() ? describe : describe.skip)('API', () => {
  beforeAll(async () => {
    s = await startApp('api_test');
    const { ContentService: Content } = await import('../src/student/content.service');
    const { DatabaseService: Database } = await import('../src/database/database.service');
    content = s.moduleRef.get(Content);
    db = s.moduleRef.get(Database);
    mail = s.moduleRef.get((await import('../src/admin/mail.service')).MailService);
    prog = await import('../src/student/progress');
    ADMIN = await adminLogin(s.base);
    const teacher = await api('POST', '/api/admin/users', { full_name: 'Trần Thị Hoa', role: 'teacher', class_name: '7A1' }, ADMIN);
    const students = { body: [] as Array<{ user: { username: string }; password: string }> };
    for (const name of ['Nguyễn Văn Long', 'Đỗ Bảo Ngọc']) students.body.push((await api('POST', '/api/admin/users', { full_name: name, role: 'student', class_name: '7A1' }, ADMIN)).body);
    const login = async (username: string, password: string, portal: string, newPassword: string) => {
      const r = await api('POST', '/api/auth/login', { username, password, portal });
      return (await api('POST', '/api/auth/change-password', { current_password: password, new_password: newPassword }, r.body.token)).body;
    };
    T = (await login(teacher.body.user.username, teacher.body.password, 'teacher', 'giaovien1')).token;
    ({ token: S0, user: u0 } = await login(students.body[0].user.username, students.body[0].password, 'student', 'hocsinh1'));
    ({ token: S1, user: u1 } = await login(students.body[1].user.username, students.body[1].password, 'student', 'hocsinh2'));
  });

  afterAll(async () => {
    await s?.close();
  });

  // ------------------------------------------------------------------ hệ thống & đăng nhập
  test('trang gốc, health và kiểm tra CSDL', async () => {
    expect((await api('GET', '/')).body.status).toBe('online');
    expect((await api('GET', '/api/health')).body).toEqual({ status: 'healthy', ai_engine: 'operational', dataset_grounded: true });
    expect((await api('GET', '/api/database/health')).body).toMatchObject({ status: 'connected', database: 'postgresql' });
  });

  test('đăng nhập đúng trang, sai mật khẩu, khóa tạm khi dò mật khẩu', async () => {
    expect(u0.username).toBe('long.nv');
    const wrongPortal = await api('POST', '/api/auth/login', { username: 'long.nv', password: 'hocsinh1', portal: 'teacher' });
    expect(wrongPortal.status).toBe(403);
    expect(wrongPortal.body.detail).toContain('/hoc-sinh');
    expect((await api('POST', '/api/auth/login', { username: 'LONG.NV ', password: 'hocsinh1' })).status).toBe(200);
    expect((await api('POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'app' })).status).toBe(403);
    for (let i = 0; i < 5; i += 1) {
      const bad = await api('POST', '/api/auth/login', { username: 'khach.thu', password: 'sai' });
      expect([bad.status, bad.body.detail]).toEqual([401, 'Sai tên đăng nhập hoặc mật khẩu']);
    }
    const locked = await api('POST', '/api/auth/login', { username: 'khach.thu', password: 'sai' });
    expect(locked.status).toBe(429);
    expect(locked.body.detail).toMatch(/^Sai quá nhiều lần\. Thử lại sau \d+ phút\.$/);
    // Dữ liệu sai định dạng: 422, detail là danh sách lỗi như FastAPI
    const invalid = await api('POST', '/api/auth/login', { username: '', password: 'x' });
    expect(invalid.status).toBe(422);
    expect(Array.isArray(invalid.body.detail) && invalid.body.detail[0].msg).toBeTruthy();
  });

  test('đổi mật khẩu làm token cũ mất hiệu lực; tài khoản bị khóa không dùng được', async () => {
    const [token, user] = await makeUser(s.base, ADMIN, 'Lê Thử Mật', 'student', '7Z', 'matkhau1');
    expect((await api('GET', '/api/auth/me', undefined, token)).body.must_change_password).toBe(false);
    const same = await api('POST', '/api/auth/change-password', { current_password: 'matkhau1', new_password: 'matkhau1' }, token);
    expect([same.status, same.body.detail]).toEqual([400, 'Mật khẩu mới phải khác mật khẩu cũ']);
    const changed = await api('POST', '/api/auth/change-password', { current_password: 'matkhau1', new_password: 'matkhau2' }, token);
    expect(changed.status).toBe(200);
    expect((await api('GET', '/api/auth/me', undefined, token)).status).toBe(401);
    expect((await api('GET', '/api/auth/me', undefined, changed.body.token)).body.id).toBe(user.id);
    expect((await api('PATCH', `/api/admin/users/${user.id}`, { is_active: false }, ADMIN)).body.is_active).toBe(false);
    expect((await api('GET', '/api/auth/me', undefined, changed.body.token)).status).toBe(401);
    const blocked = await api('POST', '/api/auth/login', { username: user.username, password: 'matkhau2' });
    expect([blocked.status, blocked.body.detail]).toEqual([403, 'Tài khoản đã bị khóa. Liên hệ quản trị viên.']);
    expect((await api('GET', '/api/auth/me', undefined, 'khong-phai-token')).status).toBe(401);
  });

  test('quên mật khẩu bằng OTP cho mọi vai trò: mã dùng một lần, hiệu lực 5 phút, tối đa 5 lần thử, không lộ tài khoản', async () => {
    const { hashPassword } = await import('../src/auth/passwords');
    // ADMIN_EMAIL được điền cho quản trị tổng ngay khi tạo
    expect((await api('GET', '/api/auth/me', undefined, ADMIN)).body.email).toBe('quantri@example.invalid');
    const hash = await hashPassword('cu-matkhau1');
    const base = { class_name: null, password_hash: hash, must_change_password: false };
    const root = await db.createUser({ ...base, role: 'root_admin' as const, username: 'root.quen', full_name: 'Quản Trị Quên', email: 'quen.mk@example.invalid' });
    const pupil = await db.createUser({ ...base, role: 'student' as const, username: 'hs.quen', full_name: 'Học Sinh Quên', email: 'hs.quen@example.invalid' });
    await db.createUser({ ...base, role: 'student' as const, username: 'hs.khongmail', full_name: 'Học Sinh Không Thư' });
    const inbox = (addr: string) => mail.sent.filter((m) => m.to === addr);
    const ask = (identifier: string) => api('POST', '/api/auth/forgot-password', { identifier });
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const until = async (ok: () => boolean) => {
      for (let i = 0; i < 50 && !ok(); i += 1) await wait(100);
      expect(ok()).toBe(true);
    };
    const otpOf = (text: string) => /Mã xác thực của bạn là: (\d{6})/.exec(text)![1];
    const wrongOf = (otp: string) => (otp === '000000' ? '000001' : '000000');
    const reset = (identifier: string, otp: string, newPassword: string) => api('POST', '/api/auth/reset-password', { identifier, otp, new_password: newPassword });
    const invalid = [400, 'Mã xác thực không đúng hoặc đã hết hạn. Hãy yêu cầu mã mới.'];

    // Tên lạ và tài khoản chưa khai báo email: cùng một câu trả lời, không gửi thư
    for (const who of ['khong.co.that', 'hs.khongmail']) expect((await ask(who)).body).toEqual({ ok: true });
    expect((await api('POST', '/api/auth/forgot-password', {})).status).toBe(422);
    await wait(300);
    expect(inbox('quen.mk@example.invalid')).toHaveLength(0);

    // Học sinh hỏi bằng email (hoa/thường, khoảng trắng không quan trọng): thư có mã 6 chữ số, CSDL chỉ lưu băm
    expect((await ask(' HS.Quen@example.invalid ')).status).toBe(200);
    await until(() => inbox('hs.quen@example.invalid').length === 1);
    const otp = otpOf(inbox('hs.quen@example.invalid')[0].text);
    expect(inbox('hs.quen@example.invalid')[0].text).toContain('5 phút');
    const stored = await db.query<{ token_hash: string; attempts: number }>('SELECT token_hash, attempts FROM app_password_resets WHERE user_id = $1', [pupil.id]);
    expect(stored).toHaveLength(1);
    expect(stored[0].token_hash).not.toContain(otp);
    expect(stored[0].attempts).toBe(0);

    // Mã sai, sai định dạng, mật khẩu mới yếu (không làm hỏng mã đúng)
    expect(await reset('hs.quen', wrongOf(otp), 'moi-matkhau1').then((r) => [r.status, r.body.detail])).toEqual(invalid);
    expect((await reset('hs.quen', '12345', 'moi-matkhau1')).status).toBe(422);
    expect((await reset('hs.quen', otp, '123')).status).toBe(422);
    expect((await reset('hs.quen', otp, 'toanchucai')).status).toBe(422); // phải có cả chữ và số
    expect((await reset('hs.quen', otp, '12345678')).status).toBe(422);
    expect(await reset('nguoi.khac', otp, 'moi-matkhau1').then((r) => [r.status, r.body.detail])).toEqual(invalid);
    const oldSession = (await api('POST', '/api/auth/login', { username: 'hs.quen', password: 'cu-matkhau1', portal: 'student' })).body.token;

    expect((await reset('hs.quen', otp, 'moi-matkhau1')).body).toEqual({ ok: true });
    expect(await reset('hs.quen', otp, 'khac-matkhau2').then((r) => [r.status, r.body.detail])).toEqual(invalid); // dùng một lần
    expect((await api('POST', '/api/auth/login', { username: 'hs.quen', password: 'cu-matkhau1', portal: 'student' })).status).toBe(401);
    expect((await api('POST', '/api/auth/login', { username: 'hs.quen', password: 'moi-matkhau1', portal: 'student' })).status).toBe(200);
    expect((await api('GET', '/api/auth/me', undefined, oldSession)).status).toBe(401);

    // Mã quá hạn không dùng được (hiệu lực 5 phút)
    await ask('root.quen');
    await until(() => inbox('quen.mk@example.invalid').length === 1);
    await db.query("UPDATE app_password_resets SET expires_at = now() - interval '1 minute' WHERE user_id = $1", [root.id]);
    expect(await reset('root.quen', otpOf(inbox('quen.mk@example.invalid')[0].text), 'qua-han-mk1').then((r) => [r.status, r.body.detail])).toEqual(invalid);

    // Dò mã: sai quá 5 lần thì mã bị vô hiệu, kể cả khi sau đó nhập đúng
    await db.query("UPDATE app_password_resets SET used_at = now() WHERE user_id = $1", [root.id]);
    await ask('root.quen');
    await until(() => inbox('quen.mk@example.invalid').length === 2);
    const real = otpOf(inbox('quen.mk@example.invalid')[1].text);
    for (let n = 0; n < 5; n += 1) expect((await reset('root.quen', wrongOf(real), 'do-ma-sai1')).status).toBe(400);
    expect(await reset('root.quen', real, 'do-ma-dung1').then((r) => [r.status, r.body.detail])).toEqual(invalid);
    expect((await api('POST', '/api/auth/login', { username: 'root.quen', password: 'cu-matkhau1', portal: 'root_admin' })).status).toBe(200);

    // Mỗi tên chỉ được 3 yêu cầu trong 15 phút (yêu cầu thứ 4 vẫn trả lời bình thường nhưng không gửi thư); yêu cầu mới làm mã cũ hết hiệu lực
    await db.createUser({ ...base, role: 'teacher' as const, username: 'gv.gioihan', full_name: 'Giáo Viên Giới Hạn', email: 'gioi.han@example.invalid' });
    const other = () => inbox('gioi.han@example.invalid');
    for (let n = 1; n <= 4; n += 1) {
      expect((await ask('gv.gioihan')).body).toEqual({ ok: true });
      if (n < 4) await until(() => other().length === n);
    }
    await wait(400);
    expect(other()).toHaveLength(3);
    const [first, second, third] = other().map((m) => otpOf(m.text));
    expect(await reset('gv.gioihan', first, 'mk-thu-nhat1').then((r) => r.status)).toBe(400);
    expect(await reset('gv.gioihan', second, 'mk-thu-hai1').then((r) => r.status)).toBe(400);
    expect((await reset('gv.gioihan', third, 'mk-thu-ba1')).status).toBe(200);
  });

  test('quản trị tổng cấp, sửa, đặt lại mật khẩu, xóa vào thùng rác và khôi phục tài khoản', async () => {
    const created = await api('POST', '/api/admin/users', { full_name: 'Phạm Minh Đức', role: 'student', class_name: '7A2', username: ' Duc.PM ', password: 'tamthoi1' }, ADMIN);
    expect(created.status).toBe(201);
    expect([created.body.user.username, created.body.password, created.body.user.must_change_password]).toEqual(['duc.pm', 'tamthoi1', true]);
    expect(created.body.user).not.toHaveProperty('password_hash');
    const dup = await api('POST', '/api/admin/users', { full_name: 'Khác', role: 'student', username: 'duc.pm' }, ADMIN);
    expect([dup.status, dup.body.detail]).toEqual([409, "Tên đăng nhập 'duc.pm' đã tồn tại"]);
    expect((await api('POST', '/api/admin/users', { full_name: 'X', role: 'root_admin' }, ADMIN)).status).toBe(422);
    expect((await api('POST', '/api/admin/users/bulk', { role: 'teacher', full_names: ['Đặng Thu Hà'] }, ADMIN)).status).toBe(404);
    const teacher = await api('POST', '/api/admin/users', { full_name: '  Đặng   Thu  Hà ', role: 'teacher' }, ADMIN);
    expect([teacher.body.user.username, teacher.body.user.full_name]).toEqual(['gv.ha.dt', 'Đặng Thu Hà']);
    expect(teacher.body.password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);

    const id = created.body.user.id;
    expect((await api('PATCH', `/api/admin/users/${id}`, { full_name: 'Phạm Minh Đức Anh', class_name: '7A3' }, ADMIN)).body).toMatchObject({ full_name: 'Phạm Minh Đức Anh', class_name: '7A3' });
    const reset = await api('POST', `/api/admin/users/${id}/reset-password`, undefined, ADMIN);
    expect(reset.status).toBe(200);
    expect((await api('POST', '/api/auth/login', { username: 'duc.pm', password: reset.body.password, portal: 'student' })).status).toBe(200);

    const overview = (await api('GET', '/api/admin/overview', undefined, ADMIN)).body;
    expect(overview).toMatchObject({ scope: 'system', features: { rls_school_scope: true, smtp: true, pgvector: false } });
    expect(overview.unassigned).toBeGreaterThanOrEqual(4);
    const users = (await api('GET', '/api/admin/users?role=student&q=duc anh', undefined, ADMIN)).body;
    expect(users.items.map((u: { username: string }) => u.username)).toEqual(['duc.pm']);
    expect(users.items.every((u: { role: string; xp: number | null }) => u.role === 'student' && typeof u.xp === 'number')).toBe(true);

    const root = (await api('GET', '/api/auth/me', undefined, ADMIN)).body;
    expect((await api('PATCH', `/api/admin/users/${root.id}`, { is_active: false }, ADMIN)).body.detail).toBe('Không tự thay đổi quyền, khóa hoặc xóa tài khoản đang đăng nhập');
    expect((await api('DELETE', `/api/admin/users/${root.id}`, undefined, ADMIN)).status).toBe(400);
    expect((await api('DELETE', `/api/admin/users/${id}`, undefined, ADMIN)).status).toBe(204);
    expect((await api('DELETE', `/api/admin/users/${id}`, undefined, ADMIN)).body.detail).toBe('Tài khoản đã ở thùng rác');
    const trashed = await api('POST', '/api/auth/login', { username: 'duc.pm', password: reset.body.password, portal: 'student' });
    expect([trashed.status, trashed.body.detail]).toEqual([403, 'Tài khoản đang ở thùng rác. Liên hệ quản trị trường để khôi phục.']);
    const trash = (await api('GET', '/api/admin/trash', undefined, ADMIN)).body;
    expect(trash.find((u: { id: number }) => u.id === id).days_left).toBe(45);
    expect((await api('POST', `/api/admin/trash/${id}/restore`, undefined, ADMIN)).body).toMatchObject({ id, is_active: true, deleted_at: null });
    expect((await api('POST', '/api/auth/login', { username: 'duc.pm', password: reset.body.password, portal: 'student' })).status).toBe(200);
    expect((await api('DELETE', `/api/admin/users/${id}`, undefined, ADMIN)).status).toBe(204);
    expect((await api('DELETE', `/api/admin/trash/${id}`, undefined, ADMIN)).status).toBe(204);
    expect((await api('POST', `/api/admin/trash/${id}/restore`, undefined, ADMIN)).status).toBe(404);
    expect((await api('GET', '/api/admin/overview', undefined, T)).status).toBe(403);
  });

  // ------------------------------------------------------------------ tiến độ & câu hỏi
  test('01 tiến độ của học sinh mới', async () => {
    const p = (await api('GET', '/api/student/progress', undefined, S0)).body;
    expect([p.xp, p.gems, p.week_xp, p.day_gems]).toEqual([0, 100, 0, 0]);
    expect(p.freeze_available).toBe(true);
    expect(p.daily_gem_cap).toBe(prog.DAILY_GEM_CAP);
    expect([p.class_name, p.class_size]).toEqual(['7A1', 2]);
    expect(p).not.toHaveProperty('pig_state');
  });

  test('02 câu hỏi gửi xuống không kèm đáp án', async () => {
    const r = await api('GET', '/api/student/questions?units=KC1_OVERVIEW,KC3_BACH_DANG_HOW&count=8', undefined, S0);
    expect(r.status).toBe(200);
    expect(r.body.questions).toHaveLength(8);
    for (const q of r.body.questions) {
      expect(['KC1_OVERVIEW', 'KC3_BACH_DANG_HOW']).toContain(q.unit_id);
      expect(q).not.toHaveProperty('answer');
      expect(q).not.toHaveProperty('explanation');
      expect(q.topic).toBeTruthy();
    }
    const served = content.serve(first('order'));
    expect(served.items!.map((i) => i.key)).not.toEqual(served.items!.map((_, i) => i));
    const ids = content.byUnit.get('KC1_OVERVIEW')!;
    const again = await api('GET', `/api/student/questions?units=KC1_OVERVIEW&count=1&exclude=${ids.slice(0, -1).join(',')}`, undefined, S0);
    expect(again.body.questions[0].id).toBe(ids[ids.length - 1]);
  });

  test('03 server chấm mọi dạng câu hỏi', async () => {
    for (const type of ['mcq', 'tf', 'order', 'match', 'map']) {
      const q = first(type);
      expect((await answer(S1, q, right(q))).correct).toBe(true);
      const bad = await answer(S1, q, wrong(q));
      expect(bad.correct).toBe(false);
      expect(bad.explanation).toBeTruthy();
      expect(bad.reveal).toBeTruthy();
    }
    expect((await answer(S1, first('mcq'), { choice: true })).correct).toBe(false); // true không được coi là đáp án số 1
    expect((await api('POST', '/api/student/answer', { question_id: 'khong-ton-tai', choice: 0 }, S1)).status).toBe(404);
  });

  test('04 thưởng chỉ đến từ việc server chấm', async () => {
    const q = first('mcq', 'KC1_DONG_BO_DAU');
    const before = (await api('GET', '/api/student/progress', undefined, S0)).body;
    const ok = await answer(S0, q, right(q));
    expect([ok.xp_gained, ok.gems_gained]).toEqual([prog.XP_CORRECT, prog.GEMS_CORRECT]);
    expect(ok.new_p_l).toBeGreaterThan(ok.old_p_l);
    expect(ok.progress.gems).toBe(before.gems + prog.GEMS_CORRECT);
    expect(ok.progress.week_xp).toBe(before.week_xp + prog.XP_CORRECT);
    expect(ok.progress.streak).toBe(1);
    const bad = await answer(S0, q, wrong(q));
    expect([bad.xp_gained, bad.gems_gained]).toEqual([prog.XP_WRONG, 0]);
    // Đã làm và còn yếu -> câu đúng tiếp theo thuộc cụm đó được thưởng nhiều hơn
    const weak = await answer(S0, q, right(q));
    expect(weak.gems_gained).toBe(prog.GEMS_CORRECT_WEAK);
    expect((await api('POST', '/api/student/gems', { delta: 500 }, S0)).status).toBe(422);
    const spent = await api('POST', '/api/student/gems', { delta: -20, reason: 'chieu_mo' }, S0);
    expect(spent.body.gems).toBe(weak.progress.gems - 20);
    const broke = await api('POST', '/api/student/gems', { delta: -99999 }, S0);
    expect([broke.status, broke.body.detail]).toEqual([400, 'Không đủ Ấn Tín']);
  });

  test('05 trần Ấn Tín mỗi ngày', async () => {
    const p = prog.rollDay(await db.getProgress(u1.id));
    p.day_gems = prog.DAILY_GEM_CAP - 4;
    await db.saveProgress(u1.id, p);
    const q = first('tf', 'KC1_VUON_KHONG_NHA_TRONG');
    expect((await answer(S1, q, right(q))).gems_gained).toBe(4);
    const res = await answer(S1, q, right(q));
    expect(res.gems_gained).toBe(0);
    expect(res.xp_gained).toBe(prog.XP_CORRECT); // hết trần Ấn Tín vẫn được XP
    expect(res.progress.day_gems).toBe(prog.DAILY_GEM_CAP);
  });

  test('06 ôn cụm yếu và câu hỏi AI dự phòng', async () => {
    const q = first('mcq', 'KC2_TRAN_BINH_TRONG');
    expect((await answer(S0, q, wrong(q))).new_p_l).toBeLessThan(prog.WEAK_THRESHOLD);
    const r = (await api('GET', '/api/student/questions?mode=weak&count=3', undefined, S0)).body;
    expect(r.mode).toBe('weak');
    expect(r.units).toContain('KC2_TRAN_BINH_TRONG');
    expect(r.questions.every((x: { unit_id: string }) => r.units.includes(x.unit_id))).toBe(true);

    // AI không trả lời: dùng câu của đúng cụm tri thức trong ngân hàng
    const fallback = await api('POST', '/api/student/questions/ai', { unit_id: 'KC3_VAN_DON', count: 2 }, S0);
    expect(fallback.status).toBe(200);
    expect(fallback.body.note).toContain('Quân Sư AI đang bận');
    expect(fallback.body.questions.every((x: { id: string; unit_id: string }) => x.unit_id === 'KC3_VAN_DON' && content.byUnit.get('KC3_VAN_DON')!.includes(x.id))).toBe(true);

    // AI soạn câu: server giữ đáp án và chấm như câu trong ngân hàng
    s.ai.questions = [{ question: 'Trận Vân Đồn diễn ra năm nào?', options: ['1288', '1285', '1258'], correct_index: 0, explanation: 'Năm 1288.', source: 'Quân Sư AI – SGK' }];
    const ai = (await api('POST', '/api/student/questions/ai', { unit_id: 'KC3_VAN_DON', count: 1 }, S0)).body;
    s.ai.questions = [];
    expect(ai.note).toBeNull();
    const served = ai.questions[0];
    expect(served.id).toMatch(/^ai-/);
    expect(served).not.toHaveProperty('answer');
    const key = served.options.find((o: { text: string }) => o.text === '1288').key;
    const graded = await api('POST', '/api/student/answer', { question_id: served.id, choice: key }, S0);
    expect([graded.status, graded.body.correct, graded.body.source]).toEqual([200, true, 'Quân Sư AI – SGK']);
  });

  test('07 hoàn thành lượt học phải khớp số câu server đã chấm', async () => {
    const tooMany = await api('POST', '/api/student/quiz-complete', { correct: 49, total: 50 }, S0);
    expect(tooMany.status).toBe(400);
    expect((await api('POST', '/api/student/quiz-complete', { correct: 3, total: 2 }, S0)).status).toBe(400);
    const res = (await api('POST', '/api/student/quiz-complete', { correct: 2, total: 2 }, S0)).body;
    expect(res.perfect).toBe(true);
    expect(res.progress.lessons_completed).toBe(1);
    expect((await api('POST', '/api/student/ai-question', undefined, S0)).body.ai_questions).toBe(1);
  });

  // ------------------------------------------------------------------ trạng thái game & Sử Ký
  test('08 lưu trạng thái game, giới hạn 16 KB, chấm câu không đè trạng thái game', async () => {
    expect((await api('GET', '/api/student/game', undefined, S0)).body.state).toBeNull();
    const state = { v: 1, campaign: { m1p1: 3, m1p2: 2, m2p1: 1 }, heroes: { tran_thai_tong: { stage: 1 } } };
    expect((await api('PUT', '/api/student/game', { state }, S0)).status).toBe(200);
    expect((await api('GET', '/api/student/game', undefined, S0)).body.state).toEqual(state);
    expect((await api('PUT', '/api/student/game', { state: { blob: 'x'.repeat(17_000) } }, S0)).status).toBe(413);
    expect((await api('PUT', '/api/student/game', { state: [1, 2] }, S0)).status).toBe(422);
    const spy = jest.spyOn(db, 'saveProgress');
    try {
      const q = first('mcq');
      await answer(S0, q, right(q));
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls.every(([, data]) => !('game_state' in data))).toBe(true);
    } finally {
      spy.mockRestore();
    }
    expect((await api('GET', '/api/student/game', undefined, S0)).body.state).toEqual(state);
  });

  test('09 Sử Ký gồm kho tri thức và chủ đề của game, không lặp thẻ', async () => {
    const entries = (await api('GET', '/api/student/codex', undefined, S0)).body as Array<Record<string, string>>;
    const units = entries.map((e) => e.unit_id);
    expect(units).toEqual(expect.arrayContaining(['KC3_BACH_DANG_HOW', 'GAME_NGU_BINH_U_NONG']));
    expect(units).not.toContain('INTENT_GREETING');
    expect(new Set(units).size).toBe(units.length);
    expect(entries.every((e) => e.fact_chunk)).toBe(true);
    expect(entries.find((e) => e.unit_id === 'GAME_BINH_THU_YEU_LUOC')!.source).toBe('Hịch tướng sĩ – Trần Quốc Tuấn');
  });

  test('10 bảng xếp hạng lớp theo tuần và gợi ý ôn tập', async () => {
    const board = (await api('GET', '/api/student/leaderboard', undefined, S0)).body;
    expect(board).toHaveLength(2);
    expect(board[0].week_xp).toBeGreaterThanOrEqual(board[1].week_xp);
    expect(board.filter((e: { is_me: boolean }) => e.is_me)).toHaveLength(1);
    const recs = (await api('GET', '/api/student/recommendations?top_k=2', undefined, S0)).body;
    expect(recs.total_recommendations).toBe(2);
    expect(recs.recommendations[0].unit_id).toBe('KC2_TRAN_BINH_TRONG');
  });

  // ------------------------------------------------------------------ giáo viên
  test('11 giáo viên xem sao chiến dịch, câu sai nhiều, mức nắm vững', async () => {
    const data = (await api('GET', '/api/teacher/class', undefined, T)).body;
    const long = data.students.find((x: { id: number }) => x.id === u0.id);
    expect(long.campaign_stars).toEqual([5, 1, 0]);
    expect([long.stars, long.heroes]).toEqual([6, 1]);
    expect(data.top_wrong.map((w: { question_id: string }) => w.question_id)).toContain(first('mcq', 'KC1_DONG_BO_DAU').id);
    expect(data.unit_mastery.some((m: { unit_id: string }) => m.unit_id === 'KC1_DONG_BO_DAU')).toBe(true);
    expect(data.summary.total_stars).toBe(6);
    expect(data.summary.total).toBe(2);
    expect(Array.isArray(data.needs_support)).toBe(true);
    expect((await api('GET', '/api/teacher/live-sessions', undefined, T)).body).toEqual([]);
  });

  test('12 kiểm tra vai trò', async () => {
    const forbidden = await api('GET', '/api/teacher/class', undefined, S0);
    expect([forbidden.status, forbidden.body.detail]).toEqual([403, 'Chức năng này chỉ dành cho giáo viên']);
    expect((await api('GET', '/api/student/questions', undefined, T)).status).toBe(403);
    expect((await api('GET', '/api/student/game')).status).toBe(401);
    expect((await api('GET', '/api/admin/users', undefined, S0)).status).toBe(403);
  });

  test('13 nhiều yêu cầu đầu tiên song song chỉ tạo một dòng tiến độ', async () => {
    const u = await db.createUser({ username: 'song.song', full_name: 'Song Song', role: 'student', class_name: '7A1', password_hash: 'khong-dung', must_change_password: true });
    const rows = await Promise.all(Array.from({ length: 6 }, () => db.getProgress(u.id)));
    expect(new Set(rows.map((r) => r.user_id))).toEqual(new Set([u.id]));
    expect(rows.every((r) => r.gems === rows[0].gems)).toBe(true);
  });

  // ------------------------------------------------------------------ AI
  test('tính năng AI cần đăng nhập; soạn đề, soạn truyện chỉ dành cho giáo viên', async () => {
    expect((await api('POST', '/api/chat/dong-a', { query: 'Trần Hưng Đạo là ai?' })).status).toBe(401);
    const chat = await api('POST', '/api/chat/dong-a', { query: 'Trần Hưng Đạo là ai?', session_id: 'abc' }, S0);
    expect(chat.status).toBe(200);
    expect(chat.body).toEqual({ path: '/chat', echo: { query: 'Trần Hưng Đạo là ai?', character_id: null, session_id: `user_${u0.id}_abc` } });
    expect((await api('POST', '/api/chat/dong-a', { query: '' }, S0)).status).toBe(422);
    expect((await api('POST', '/api/quiz/generate', {}, S0)).status).toBe(403);
    const quiz = await api('POST', '/api/quiz/generate', { num_questions: 3 }, T);
    expect(quiz.body.echo).toMatchObject({ num_questions: 3, cognitive_level: 'Tất cả mức độ' });
    expect((await api('POST', '/api/story/generate', { stage_title: 'Vân Đồn' }, T)).body.echo.stage_title).toBe('Vân Đồn');
  });
});

describe('quy tắc tiến độ', () => {
  beforeAll(async () => {
    prog = await import('../src/student/progress');
  });

  test('mỗi tuần một ngày nghỉ phép giữ chuỗi', () => {
    const p = { streak: 4, last_active_date: prog.daysAgo(2), freeze_week: null } as unknown as Parameters<typeof prog.touchStreak>[0];
    expect(prog.effectiveStreak(p)).toBe(4);
    prog.touchStreak(p);
    expect([p.streak, p.freeze_week]).toEqual([5, prog.weekKey()]);
    p.last_active_date = prog.daysAgo(2);
    expect(prog.effectiveStreak(p)).toBe(0); // đã dùng ngày nghỉ phép trong tuần
    prog.touchStreak(p);
    expect(p.streak).toBe(1);
  });

  test('thưởng không vượt trần Ấn Tín', () => {
    const p = { xp: 0, gems: 0, day_gems: prog.DAILY_GEM_CAP - 5 } as unknown as Parameters<typeof prog.awardAnswer>[0];
    expect(prog.awardAnswer(p, true, true)).toEqual([prog.XP_CORRECT, 5]);
    expect(prog.awardAnswer(p, false, false)).toEqual([prog.XP_WRONG, 0]);
    expect([p.day_gems, p.week_xp]).toEqual([prog.DAILY_GEM_CAP, prog.XP_CORRECT + prog.XP_WRONG]);
  });

  test('mọi cụm tri thức học tập đều có câu hỏi trong ngân hàng', async () => {
    process.env.DATABASE_URL = '';
    const { ContentService: Content } = await import('../src/student/content.service');
    const bank = content ?? new Content();
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const qMatrix = JSON.parse(readFileSync(resolve(__dirname, '..', '..', 'ai', 'data', 'q_matrix.json'), 'utf8')) as Record<string, { category: string }>;
    const learning = Object.entries(qMatrix).filter(([, m]) => !['CONVERSATIONAL_INTENT', 'CROSS_ERA_SAFEGUARD', 'OUT_OF_DOMAIN'].includes(m.category));
    expect(learning.map(([u]) => u).filter((u) => !bank.byUnit.has(u))).toEqual([]);
    expect(bank.questions.size).toBeGreaterThanOrEqual(120);
    for (const unit of bank.byUnit.keys()) expect(unit in qMatrix || unit in bank.units).toBe(true);
  });
});
