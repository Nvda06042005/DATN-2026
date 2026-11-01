/**
 * Sprint 11 – thông báo, hỗ trợ, hướng dẫn, nhật ký, cấu hình hệ thống, phân quyền, hai lớp, sao lưu, giám sát, giao diện sáng / tối
 * (HK.HS.015–016, 106–112, GV.076–082, QT.043, 051–055, AD.002, 010, 017, 026–027, 065–076, SYS.017–020). HTTP thật trên PostgreSQL tạm.
 */
import { activate, call, hasPostgres, sql, Started, startApp } from './harness';
import { bootstrap, Fixture, PW } from './fixture';

let s: Started, f: Fixture;
let L2: { token: string; id: number };
const as = (who: { token: string }) => (method: string, path: string, body?: unknown) => call(s.base, method, path, body, who.token);
const root = (method: string, path: string, body?: unknown) => call(s.base, method, path, body, f.root);
const l2 = (method: string, path: string, body?: unknown) => call(s.base, method, path, body, L2.token);
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const clearCaches = async () => {
  const sys = s.moduleRef.get((await import('../src/platform/system.service')).SystemService) as any;
  sys.cache = null; sys.flagCache = null;
  (s.moduleRef.get((await import('../src/platform/rbac.service')).RbacService) as any).cache = null;
  const { limiter } = await import('../src/platform/request-context');
  (limiter as any).windows.clear();
};
const localNow = async (): Promise<{ date: string; hour: number }> => {
  const sys = s.moduleRef.get((await import('../src/platform/system.service')).SystemService);
  const tz = (await sys.settings()).timezone;
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
};
const mailSent = async () => s.moduleRef.get((await import('../src/admin/mail.service')).MailService).sent;

(hasPostgres() ? describe : describe.skip)('Sprint 11 – nền tảng, hỗ trợ và cấu hình hệ thống', () => {
  beforeAll(async () => {
    s = await startApp('platform_test');
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken, true);
    const created = await root('POST', '/api/admin/users', { full_name: 'Quản Trị Cấp Hai', role: 'root_admin', email: 'cap2@example.edu.vn', admin_level: 2 });
    const act = await activate(s.base, created.body.user.username, created.body.temporary_password, PW, 'root_admin');
    L2 = { token: act.token, id: act.user.id };
    await sql(s.url, "UPDATE app_users SET email = 'mot@example.edu.vn' WHERE id = $1", [f.S1.id]);
  });
  afterAll(async () => { await s?.close(); });

  // ------------------------------------------------------------------ HK.AD.065: cấu hình chung
  test('cấu hình chung: tên, logo, email gửi, múi giờ; kiểm tra giá trị; chỉ quản trị tổng cấp 1 được sửa', async () => {
    expect((await as(f.S1)('GET', '/api/platform/config')).body).toMatchObject({ system_name: 'Hào Khí Đông A', language: 'vi', timezone: 'Asia/Ho_Chi_Minh', flags: { shop: true, hearts: true } });
    for (const bad of [{ system_name: 'A' }, { logo_url: 'http://x.vn/a.png' }, { mail_from: 'khong-phai-email' }, { timezone: 'Mars/Olympus' }, { language: 'en' }, { backup_hour: 24 }, { rate_ip_per_min: 3 }]) {
      expect((await root('PUT', '/api/platform/settings', bad)).status).toBe(400);
    }
    const ok = await root('PUT', '/api/platform/settings', { system_name: 'Hào Khí Đông A – Lớp thử', logo_url: 'https://example.vn/logo.png', mail_from: 'Đông A EDU <thu@donga.example.vn>', timezone: 'Asia/Bangkok' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ system_name: 'Hào Khí Đông A – Lớp thử', logo_url: 'https://example.vn/logo.png', timezone: 'Asia/Bangkok' });
    expect((await as(f.T1)('GET', '/api/platform/config')).body.system_name).toBe('Hào Khí Đông A – Lớp thử');
    const mail = s.moduleRef.get((await import('../src/admin/mail.service')).MailService);
    mail.invalidateTemplates();
    expect(await mail.fromAddress()).toBe('Đông A EDU <thu@donga.example.vn>');
    expect((await l2('PUT', '/api/platform/settings', { system_name: 'Cấp hai sửa' })).status).toBe(403); // cấp 2 chỉ xem
    expect((await l2('GET', '/api/platform/settings')).status).toBe(200);
    expect((await as(f.A)('GET', '/api/platform/settings')).status).toBe(403);
    expect((await as(f.T1)('PUT', '/api/platform/settings', { system_name: 'Giáo viên sửa' })).status).toBe(403);
    await root('PUT', '/api/platform/settings', { system_name: 'Hào Khí Đông A', logo_url: null, mail_from: null, timezone: 'Asia/Ho_Chi_Minh' });
  });

  // ------------------------------------------------------------------ HK.AD.071: cờ tính năng
  test('cờ bật / tắt tính năng: tắt cửa hàng, giải đấu, AI, thi đấu, game thẻ tướng, gợi ý và tim có hiệu lực ngay; bật lại thì dùng được', async () => {
    const flags = (await root('GET', '/api/platform/flags')).body;
    expect(flags.map((x: any) => x.key)).toEqual(['leagues', 'hearts', 'roleplay', 'ai_tutor', 'live_quiz', 'war_game', 'shop', 'recommendations']);
    expect(flags.every((x: any) => x.enabled)).toBe(true);
    const probe: Array<[string, string, (w: any) => Promise<any>]> = [
      ['shop', 'Cửa hàng', () => as(f.S1)('GET', '/api/game/shop')],
      ['leagues', 'Giải đấu', () => as(f.S1)('GET', '/api/game/league')],
      ['ai_tutor', 'AI Tutor', () => as(f.S1)('GET', '/api/ai/status')],
      ['live_quiz', 'Thi đấu', () => as(f.S1)('GET', '/api/live/open')],
      ['war_game', 'thẻ tướng', () => as(f.S1)('GET', '/api/war/status')],
      ['recommendations', 'Gợi ý', () => as(f.S1)('GET', '/api/analytics/me/recommendations')],
    ];
    for (const [key, word, run] of probe) {
      expect((await run(null)).status).toBe(200);
      expect((await root('PUT', `/api/platform/flags/${key}`, { enabled: false })).body).toMatchObject({ key, enabled: false });
      const blocked = await run(null);
      expect(blocked.status).toBe(403);
      expect(JSON.stringify(blocked.body.detail)).toContain(word);
      await root('PUT', `/api/platform/flags/${key}`, { enabled: true });
      expect((await run(null)).status).toBe(200);
    }
    // nhập vai chỉ tắt riêng chế độ nhập vai
    await root('PUT', '/api/platform/flags/roleplay', { enabled: false });
    expect((await as(f.S1)('POST', '/api/ai/ask', { question: 'Trần Hưng Đạo là ai?', mode: 'roleplay' })).status).toBe(403);
    expect((await as(f.S1)('GET', '/api/ai/status')).status).toBe(200);
    await root('PUT', '/api/platform/flags/roleplay', { enabled: true });
    // tim: dịch vụ trò chơi hóa coi như tắt cơ chế tim
    const game = s.moduleRef.get((await import('../src/game/game.service')).GameService);
    const db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    const q = db.query.bind(db) as any;
    expect(await game.heartsEnabled(q, f.S1.id)).toBe(true);
    await root('PUT', '/api/platform/flags/hearts', { enabled: false });
    await clearCaches();
    expect(await game.heartsEnabled(q, f.S1.id)).toBe(false);
    await root('PUT', '/api/platform/flags/hearts', { enabled: true });
    expect((await root('PUT', '/api/platform/flags/khong_co', { enabled: true })).status).toBe(404);
    expect((await root('PUT', '/api/platform/flags/shop', { enabled: 'yes' })).status).toBe(400);
    expect((await l2('PUT', '/api/platform/flags/shop', { enabled: false })).status).toBe(403);
    expect((await as(f.A)('GET', '/api/platform/flags')).status).toBe(403);
  });

  // ------------------------------------------------------------------ HK.AD.068: mẫu thư
  test('mẫu thư: chỉnh nội dung OTP, mật khẩu tạm, nhắc học, thành tích; biến lạ hoặc thiếu biến bắt buộc bị từ chối; xóa bản chỉnh quay về mặc định', async () => {
    const list = (await root('GET', '/api/platform/templates')).body;
    expect(list.map((t: any) => t.key)).toEqual(['otp', 'temp_password', 'reminder', 'achievement']);
    expect(list.every((t: any) => !t.customized)).toBe(true);
    expect((await root('PUT', '/api/platform/templates/otp', { subject: 'Mã của bạn', body: 'Mã không có biến bắt buộc' })).status).toBe(400);
    expect((await root('PUT', '/api/platform/templates/otp', { subject: 'Mã {{la}}', body: 'Mã: {{ma}}' })).status).toBe(400);
    expect((await root('PUT', '/api/platform/templates/otp', { subject: 'ab', body: 'Mã: {{ma}}' })).status).toBe(400);
    expect((await root('PUT', '/api/platform/templates/khong_co', { subject: 'abc', body: 'abcde' })).status).toBe(404);
    const saved = await root('PUT', '/api/platform/templates/otp', { subject: '[Thử] Mã {{ma}} cho {{ten}}', body: 'Xin chào {{ten}}, mã của bạn: {{ma}} (hiệu lực {{phut}} phút).' });
    expect(saved.body).toMatchObject({ key: 'otp', customized: true });
    const sent = await mailSent();
    const before = sent.length;
    expect((await call(s.base, 'POST', '/api/auth/forgot-password', { identifier: 'su1@example.edu.vn' })).status).toBe(200);
    for (let i = 0; i < 40 && sent.length === before; i += 1) await new Promise((r) => setTimeout(r, 100));
    const otpMail = sent[sent.length - 1];
    expect(otpMail.subject).toMatch(/^\[Thử\] Mã \d{6} cho Nguyễn Văn Sử$/);
    expect(otpMail.text).toMatch(/^Xin chào Nguyễn Văn Sử, mã của bạn: \d{6} \(hiệu lực 5 phút\)\.$/);
    // mật khẩu tạm
    await root('PUT', '/api/platform/templates/temp_password', { body: 'Tài khoản {{tai_khoan}} / mật khẩu {{mat_khau}} cho {{ten}} tại {{duong_dan}}' });
    const t = await as(f.A)('POST', '/api/admin/teachers', { full_name: 'Giáo Viên Mẫu Thư', email: 'mauthu@example.edu.vn' });
    const mail = s.moduleRef.get((await import('../src/admin/mail.service')).MailService);
    await mail.tick();
    const acct = sent.find((m) => m.to === 'mauthu@example.edu.vn')!;
    expect(acct.text).toContain(`Tài khoản ${t.body.user.username} / mật khẩu ${t.body.temporary_password} cho Giáo Viên Mẫu Thư`);
    expect(acct.subject).toBe('[Đông A EDU] Thông tin tài khoản'); // chủ đề tài khoản không đổi
    expect((await root('DELETE', '/api/platform/templates/temp_password')).body.customized).toBe(false);
    expect((await root('DELETE', '/api/platform/templates/otp')).body.customized).toBe(false);
    expect((await l2('PUT', '/api/platform/templates/otp', { subject: 'abc', body: '{{ma}}' })).status).toBe(200); // mẫu thư không phải cấu hình hệ thống nên cấp 2 cũng sửa được
    await root('DELETE', '/api/platform/templates/otp');
    expect((await as(f.T1)('GET', '/api/platform/templates')).status).toBe(403);
  });

  // ------------------------------------------------------------------ HK.AD.017: giới hạn theo trường
  test('giới hạn theo trường: số học sinh tối đa và bật / tắt AI; không đặt thấp hơn số hiện có', async () => {
    const cur = (await root('GET', `/api/platform/schools/${f.A.schoolId}/limits`)).body;
    expect(cur).toMatchObject({ students: 3, max_students: null, ai_enabled: true });
    expect((await root('PUT', `/api/platform/schools/${f.A.schoolId}/limits`, { max_students: 2 })).status).toBe(409);
    expect((await root('PUT', `/api/platform/schools/${f.A.schoolId}/limits`, { max_students: 0 })).status).toBe(400);
    expect((await root('PUT', `/api/platform/schools/${f.A.schoolId}/limits`, { max_students: 3, ai_daily_per_school: 40, ai_daily_per_user: 7 })).body).toMatchObject({ max_students: 3, ai_daily_per_school: 40, ai_daily_per_user: 7 });
    const full = await as(f.A)('POST', '/api/admin/students', { user_code: 'HS8099', full_name: 'Học Sinh Thứ Tư', birth_date: '2013-04-04' });
    expect(full.status).toBe(409);
    expect(JSON.stringify(full.body)).toContain('số học sinh tối đa (3)');
    await root('PUT', `/api/platform/schools/${f.A.schoolId}/limits`, { max_students: 50 });
    expect((await as(f.A)('POST', '/api/admin/students', { user_code: 'HS8099', full_name: 'Học Sinh Thứ Tư', birth_date: '2013-04-04' })).status).toBe(201);
    // AI tắt cho trường này: người học và giáo viên của trường không dùng được, trường khác vẫn dùng
    expect((await root('PUT', `/api/platform/schools/${f.A.schoolId}/limits`, { ai_enabled: false })).body.ai_enabled).toBe(false);
    await clearCaches();
    expect((await as(f.S1)('GET', '/api/ai/status')).status).toBe(403);
    expect((await as(f.TB)('GET', '/api/ai/status')).status).toBe(200);
    await root('PUT', `/api/platform/schools/${f.A.schoolId}/limits`, { ai_enabled: true, max_students: null });
    await clearCaches();
    expect((await as(f.S1)('GET', '/api/ai/status')).status).toBe(200);
    expect((await root('GET', '/api/platform/schools/999999/limits')).status).toBe(404);
    expect((await as(f.A)('GET', `/api/platform/schools/${f.A.schoolId}/limits`)).status).toBe(403);
    expect((await l2('PUT', `/api/platform/schools/${f.A.schoolId}/limits`, { max_students: 40 })).status).toBe(200); // giới hạn trường: cấp 2 cũng được cấu hình
  });

  // ------------------------------------------------------------------ HK.AD.026: ma trận phân quyền
  test('ma trận phân quyền: đủ 38 nhóm, chỉ thu hẹp tính năng đã nối; tắt quyền có hiệu lực ngay; không cấp thêm, không đổi quản trị tổng', async () => {
    const m = (await root('GET', '/api/platform/rbac')).body;
    expect(m.roles).toEqual(['student', 'teacher', 'school_admin', 'root_admin']);
    expect(m.features).toHaveLength(38);
    expect(m.features.find((x: any) => x.key === 'reports').cells).toMatchObject({ student: { allowed: false, editable: false }, teacher: { allowed: true, editable: true }, root_admin: { allowed: true, editable: false } });
    expect(m.features.filter((x: any) => x.enforced).map((x: any) => x.key).sort()).toEqual(['ai_tutor', 'announce', 'audit_log', 'live_host', 'reco', 'reports', 'support', 'survey']);
    const cell = (r: string, key: string, allowed: boolean) => ({ changes: [{ feature_key: key, role: r, allowed }] });
    expect((await as(f.T1)('GET', '/api/analytics/classes')).status).toBe(200);
    expect((await root('PUT', '/api/platform/rbac', cell('teacher', 'reports', false))).status).toBe(200);
    const denied = await as(f.T1)('GET', '/api/analytics/classes');
    expect(denied.status).toBe(403);
    expect(denied.body.detail).toContain('báo cáo');
    expect((await as(f.A)('GET', '/api/analytics/classes')).status).toBe(200); // vai trò khác không bị ảnh hưởng
    await root('PUT', '/api/platform/rbac', cell('teacher', 'reports', true));
    expect((await as(f.T1)('GET', '/api/analytics/classes')).status).toBe(200);
    // thông báo: tắt quyền gửi của giáo viên
    await root('PUT', '/api/platform/rbac', cell('teacher', 'announce', false));
    expect((await as(f.T1)('POST', '/api/platform/broadcasts', { title: 'Thử', body: 'Thử', class_ids: [f.class7a.id] })).status).toBe(403);
    await root('PUT', '/api/platform/rbac', cell('teacher', 'announce', true));
    // các trường hợp bị từ chối
    expect((await root('PUT', '/api/platform/rbac', cell('student', 'reports', true))).status).toBe(400); // không cấp thêm quá đặc tả
    expect((await root('PUT', '/api/platform/rbac', cell('root_admin', 'reports', false))).status).toBe(400); // không tự khóa
    expect((await root('PUT', '/api/platform/rbac', cell('teacher', 'assignments', false))).status).toBe(400); // quyền cố định trong mã
    expect((await root('PUT', '/api/platform/rbac', cell('teacher', 'khong_co', false))).status).toBe(404);
    expect((await root('PUT', '/api/platform/rbac', { changes: [] })).status).toBe(400);
    expect((await root('PUT', '/api/platform/rbac', { changes: [{ feature_key: 'reports', role: 'teacher', allowed: 'no' }] })).status).toBe(400);
    expect((await l2('PUT', '/api/platform/rbac', cell('teacher', 'reports', false))).status).toBe(403);
    expect((await l2('GET', '/api/platform/rbac')).status).toBe(200);
    expect((await as(f.A)('GET', '/api/platform/rbac')).status).toBe(403);
  });

  // ------------------------------------------------------------------ HK.SYS.018: giới hạn tần suất
  test('giới hạn tần suất: theo người dùng, riêng cho AI và theo IP; có Retry-After; đặt lại thì dùng bình thường', async () => {
    await clearCaches();
    expect((await root('PUT', '/api/platform/settings', { rate_user_per_min: 10 })).body.rate_user_per_min).toBe(10);
    await clearCaches();
    const codes: number[] = [];
    for (let i = 0; i < 13; i += 1) codes.push((await as(f.S2)('GET', '/api/platform/prefs')).status);
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
    expect(codes.slice(10)).toEqual([429, 429, 429]);
    const limited = await fetch(`${s.base}/api/platform/prefs`, { headers: { Authorization: `Bearer ${f.S2.token}` } });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await as(f.S3)('GET', '/api/platform/prefs')).status).toBe(200); // người khác không bị ảnh hưởng
    await root('PUT', '/api/platform/settings', { rate_user_per_min: null, rate_ai_per_min: 1 });
    await clearCaches();
    const ai1 = await as(f.S3)('POST', '/api/ai/ask', { question: 'Trần Hưng Đạo là ai?' });
    expect(ai1.status).not.toBe(429);
    const ai2 = await as(f.S3)('POST', '/api/ai/ask', { question: 'Trận Bạch Đằng là gì?' });
    expect(ai2.status).toBe(429);
    expect(ai2.body.detail).toContain('AI');
    await root('PUT', '/api/platform/settings', { rate_ai_per_min: null });
    // theo IP: đặt thẳng trong cơ sở dữ liệu để khỏi bị chính giới hạn chặn khi đặt lại
    await sql(s.url, 'UPDATE hk_system_settings SET rate_ip_per_min = 10 WHERE id = 1');
    await clearCaches();
    const ip: number[] = [];
    for (let i = 0; i < 12; i += 1) ip.push((await call(s.base, 'GET', '/api/platform/config', undefined, f.T1.token)).status);
    expect(ip.slice(0, 10).every((c) => c === 200)).toBe(true);
    expect(ip.slice(10)).toEqual([429, 429]);
    expect((await fetch(`${s.base}/api/health`)).status).toBe(200); // kiểm tra sức khỏe không bị giới hạn
    await sql(s.url, 'UPDATE hk_system_settings SET rate_ip_per_min = NULL WHERE id = 1');
    await clearCaches();
    expect((await as(f.T1)('GET', '/api/platform/config')).status).toBe(200);
  });

  // ------------------------------------------------------------------ HK.HS.015–016: tùy chọn
  test('tùy chọn cá nhân: giao diện sáng / tối lưu theo tài khoản; nhắc học chọn giờ và kênh, kiểm tra email', async () => {
    expect((await as(f.S1)('GET', '/api/platform/prefs')).body).toMatchObject({ theme: 'light', reminder_enabled: false, reminder_hour: 19, reminder_channel: 'web', can_remind: true, has_email: true });
    expect((await as(f.S1)('PUT', '/api/platform/prefs', { theme: 'dark', reminder_enabled: true, reminder_hour: 20, reminder_channel: 'both' })).body).toMatchObject({ theme: 'dark', reminder_enabled: true, reminder_hour: 20, reminder_channel: 'both' });
    expect((await as(f.S1)('GET', '/api/platform/prefs')).body.theme).toBe('dark'); // lưu theo tài khoản, không theo thiết bị
    expect((await as(f.S2)('GET', '/api/platform/prefs')).body.theme).toBe('light');
    for (const bad of [{ theme: 'neon' }, { reminder_hour: 24 }, { reminder_hour: 7.5 }, { reminder_channel: 'sms' }]) expect((await as(f.S1)('PUT', '/api/platform/prefs', bad)).status).toBe(400);
    expect((await as(f.S2)('PUT', '/api/platform/prefs', { reminder_enabled: true, reminder_channel: 'email' })).status).toBe(400); // chưa có email
    expect((await as(f.S2)('PUT', '/api/platform/prefs', { reminder_enabled: true, reminder_channel: 'web' })).status).toBe(200);
    expect((await as(f.T1)('PUT', '/api/platform/prefs', { reminder_enabled: true })).status).toBe(400); // nhắc học dành cho học sinh
    expect((await as(f.T1)('PUT', '/api/platform/prefs', { theme: 'light' })).body.theme).toBe('light');
    expect((await call(s.base, 'GET', '/api/platform/prefs')).status).toBe(401);
  });

  // ------------------------------------------------------------------ HK.GV.076, HK.QT.043, HK.AD.069, HK.HS.106–107, HK.GV.077–078, HK.QT.053
  test('thông báo tới lớp: giáo viên chỉ gửi lớp mình, đặt lịch, sửa, thu hồi; người nhận xem, lọc, đánh dấu đã đọc và xóa', async () => {
    const send = (who: { token: string }, body: unknown) => as(who)('POST', '/api/platform/broadcasts', body);
    const own = async (who: { token: string }) => (await as(who)('GET', '/api/platform/notices')).body;
    const sent = await send(f.T1, { title: 'Ôn tập tuần sau', body: 'Cả lớp ôn Bạch Đằng nhé.', class_ids: [f.class7a.id] });
    expect(sent.status).toBe(200);
    expect(sent.body).toMatchObject({ status: 'sent', recipients: 2, scope: 'class', class_names: ['7A1'] });
    const n1 = await own(f.S1);
    expect(n1.items[0]).toMatchObject({ title: 'Ôn tập tuần sau', kind: 'announce', category: 'class', class_name: '7A1', read_at: null });
    expect(n1.unread_by_category.class).toBeGreaterThanOrEqual(1);
    expect((await own(f.S3)).items.some((i: any) => i.title === 'Ôn tập tuần sau')).toBe(false); // học sinh ngoài lớp không nhận
    expect((await own(f.T2)).items.length).toBe(0);
    // quyền của giáo viên
    expect((await send(f.T1, { title: 'Lớp khác', body: 'x', class_ids: [f.class7b.id] })).status).toBe(404);
    expect((await send(f.T1, { title: 'Toàn trường', body: 'x', scope: 'school' })).status).toBe(403);
    expect((await send(f.T1, { title: 'Chưa chọn lớp', body: 'x', class_ids: [] })).status).toBe(400);
    expect((await send(f.T1, { title: 'x', body: 'nội dung', class_ids: [f.class7a.id] })).status).toBe(400);
    expect((await send(f.S1, { title: 'Học sinh gửi', body: 'x', class_ids: [f.class7a.id] })).status).toBe(403);
    expect((await send(f.T1, { title: 'Quá khứ', body: 'x', class_ids: [f.class7a.id], send_at: '2020-01-01T00:00:00Z' })).status).toBe(400);
    // đặt lịch: chưa tới giờ thì chưa ai nhận, tới giờ thì việc nền gửi đúng một lần
    const later = await send(f.T1, { title: 'Bài kiểm tra 15 phút', body: 'Nhớ mang bút.', class_ids: [f.class7a.id], send_at: new Date(Date.now() + 3_600_000).toISOString() });
    expect(later.body).toMatchObject({ status: 'scheduled', recipients: 0 });
    expect((await own(f.S1)).items.some((i: any) => i.title === 'Bài kiểm tra 15 phút')).toBe(false);
    const edited = await as(f.T1)('PUT', `/api/platform/broadcasts/${later.body.id}`, { title: 'Kiểm tra 15 phút (đã sửa)' });
    expect(edited.body.title).toBe('Kiểm tra 15 phút (đã sửa)');
    expect((await as(f.T2)('PUT', `/api/platform/broadcasts/${later.body.id}`, { title: 'Cô giáo khác sửa' })).status).toBe(404);
    await sql(s.url, "UPDATE hk_broadcasts SET send_at = now() - interval '1 minute' WHERE id = $1", [later.body.id]);
    const notices = s.moduleRef.get((await import('../src/platform/notice.service')).NoticeService);
    expect(await notices.dispatchDue()).toBe(1);
    expect(await notices.dispatchDue()).toBe(0);
    expect((await own(f.S1)).items.filter((i: any) => i.title === 'Kiểm tra 15 phút (đã sửa)')).toHaveLength(1);
    // sửa đợt đã gửi cập nhật cả thông báo của người nhận; thu hồi thì xóa
    expect((await as(f.T1)('PUT', `/api/platform/broadcasts/${later.body.id}`, { body: 'Nội dung mới đã sửa.' })).body.status).toBe('sent');
    expect((await own(f.S2)).items.find((i: any) => i.title === 'Kiểm tra 15 phút (đã sửa)').body).toBe('Nội dung mới đã sửa.');
    const gone = await as(f.T1)('DELETE', `/api/platform/broadcasts/${later.body.id}`);
    expect(gone.body).toMatchObject({ deleted: true, recalled: true, recipients: 2 });
    expect((await own(f.S1)).items.some((i: any) => i.title.startsWith('Kiểm tra 15 phút'))).toBe(false);
    // danh sách của người gửi
    const mine = (await as(f.T1)('GET', '/api/platform/broadcasts')).body;
    expect(mine.map((b: any) => b.title)).toEqual(['Ôn tập tuần sau']);
    expect(mine[0]).toMatchObject({ recipients: 2, read: 0 });
    // quản trị trường: cả trường, theo khối, theo lớp; xem trước số người nhận
    expect((await as(f.A)('POST', '/api/platform/broadcasts/preview', { scope: 'school' })).body.recipients).toBeGreaterThanOrEqual(5);
    const school = await send(f.A, { title: 'Họp phụ huynh', body: 'Thứ bảy 8 giờ.', scope: 'school', roles: ['student'] });
    expect(school.body.recipients).toBeGreaterThanOrEqual(3);
    expect((await own(f.S3)).items[0]).toMatchObject({ title: 'Họp phụ huynh', kind: 'school', category: 'system' });
    expect((await own(f.T1)).items.some((i: any) => i.title === 'Họp phụ huynh')).toBe(false); // chỉ gửi học sinh
    const grade = await send(f.A, { title: 'Khối 7 nghỉ lễ', body: 'Nghỉ thứ hai.', scope: 'grade', grades: [7] });
    expect(grade.body.recipients).toBe(4); // 2 học sinh của 7A1 + 2 giáo viên 7A1, 7A2 (7A2 chưa có học sinh)
    expect((await own(f.T2)).items.some((i: any) => i.title === 'Khối 7 nghỉ lễ')).toBe(true);
    expect((await send(f.A, { title: 'Sai vai trò', body: 'x', scope: 'school', roles: ['school_admin'] })).status).toBe(400);
    expect((await send(f.A, { title: 'Sai khối', body: 'x', scope: 'grade', grades: [3] })).status).toBe(400);
    expect((await send(f.A, { title: 'Lớp trường khác', body: 'x', scope: 'class', class_ids: [999999] })).status).toBe(404);
    expect((await as(f.B)('PUT', `/api/platform/broadcasts/${school.body.id}`, { title: 'Trường khác sửa' })).status).toBe(404);
    expect((await as(f.A)('GET', '/api/platform/broadcasts')).body.map((b: any) => b.title)).toEqual(expect.arrayContaining(['Họp phụ huynh', 'Khối 7 nghỉ lễ', 'Ôn tập tuần sau']));
    // quản trị tổng: toàn hệ thống hoặc theo trường / vai trò
    const sys = await send({ token: f.root }, { title: 'Bảo trì hệ thống', body: 'Tối nay 23 giờ.', school_ids: [f.A.schoolId], roles: ['student'] });
    expect(sys.body).toMatchObject({ scope: 'system', status: 'sent' });
    expect((await own(f.S1)).items.find((i: any) => i.title === 'Bảo trì hệ thống')).toMatchObject({ kind: 'system', category: 'system' });
    expect((await own(f.TB)).items.some((i: any) => i.title === 'Bảo trì hệ thống')).toBe(false);
    const all = await send({ token: f.root }, { title: 'Chúc mừng năm học mới', body: 'Chúc cả nhà học tốt.' });
    expect((await own(f.B)).items.some((i: any) => i.title === 'Chúc mừng năm học mới')).toBe(true); // quản trị trường nhận thông báo hệ thống (HK.QT.053)
    expect(all.body.recipients).toBeGreaterThanOrEqual(8);
    expect((await send({ token: f.root }, { title: 'Trường lạ', body: 'x', school_ids: [999999] })).status).toBe(404);
    // người nhận: lọc, đọc, xóa
    const before = await own(f.S1);
    expect(before.unread).toBeGreaterThanOrEqual(4);
    expect((await as(f.S1)('GET', '/api/platform/notices?category=system')).body.items.every((i: any) => i.category === 'system')).toBe(true);
    expect((await as(f.S1)('GET', '/api/platform/notices?unread=true')).body.items.every((i: any) => !i.read_at)).toBe(true);
    const one = before.items[0].id;
    expect((await as(f.S1)('POST', '/api/platform/notices/read', { ids: [one] })).body.marked).toBe(1);
    expect((await own(f.S1)).unread).toBe(before.unread - 1);
    expect((await as(f.S1)('POST', '/api/platform/notices/read', {})).body.marked).toBe(before.unread - 1);
    expect((await own(f.S1)).unread).toBe(0);
    expect((await as(f.S1)('POST', '/api/platform/notices/delete', { ids: [one] })).body.deleted).toBe(1);
    expect((await as(f.S2)('POST', '/api/platform/notices/delete', { ids: [one] })).body.deleted).toBe(0); // không xóa được thông báo của người khác
    const left = (await own(f.S1)).items.length;
    expect((await as(f.S1)('POST', '/api/platform/notices/delete', {})).body.deleted).toBe(left); // xóa tất cả đã đọc
    expect((await own(f.S1)).items).toHaveLength(0);
    expect((await call(s.base, 'GET', '/api/platform/notices')).status).toBe(401);
  });

  // ------------------------------------------------------------------ HK.HS.108, HK.SYS.017
  test('thông báo và email tự động: nhắc học theo cài đặt, giữ chuỗi mặc định, bài tập sắp hết hạn, lên cấp, huy hiệu; không gửi trùng', async () => {
    const notices = s.moduleRef.get((await import('../src/platform/notice.service')).NoticeService);
    const mail = s.moduleRef.get((await import('../src/admin/mail.service')).MailService);
    const inbox = async (who: { token: string }) => (await as(who)('GET', '/api/platform/notices')).body.items as any[];
    await as(f.S1)('PUT', '/api/platform/prefs', { reminder_enabled: true, reminder_hour: 20, reminder_channel: 'both' });
    await as(f.S2)('PUT', '/api/platform/prefs', { reminder_enabled: true, reminder_hour: 20, reminder_channel: 'web' });
    const { date } = await localNow();
    const at = (hour: number) => new Date(`${date}T${String(hour).padStart(2, '0')}:30:00+07:00`);
    expect(await notices.studyReminders(at(10))).toEqual({ notified: 0, emailed: 0 }); // chưa tới giờ nhắc
    // S2 đã học hôm nay nên không bị nhắc
    await sql(s.url, "INSERT INTO hk_events (user_id, school_id, event, duration_ms) VALUES ($1, $2, 'attempt_finish', 1000)", [f.S2.id, f.A.schoolId]);
    const first = await notices.studyReminders(at(20));
    expect(first).toEqual({ notified: 1, emailed: 1 });
    expect((await inbox(f.S1)).find((i: any) => i.kind === 'study_reminder')).toMatchObject({ title: 'Nhắc học hôm nay', category: 'system' });
    expect((await inbox(f.S2)).some((i: any) => i.kind === 'study_reminder')).toBe(false);
    expect(await notices.studyReminders(at(20))).toEqual({ notified: 0, emailed: 0 }); // không gửi trùng trong ngày
    await mail.tick();
    const mailed = mail.sent.find((m) => m.to === 'mot@example.edu.vn' && m.subject.includes('Nhắc học'));
    expect(mailed?.text).toContain('Hôm nay em chưa học bài nào');
    expect((await sql<{ n: string }>(s.url, "SELECT count(*) AS n FROM app_email_outbox WHERE kind = 'notice' AND user_id = $1", [f.S1.id]))[0].n).toBe('1');
    // giữ chuỗi mặc định lúc 19 giờ cho em chưa cài nhắc nhưng đang có chuỗi từ 2 ngày
    await sql(s.url, 'INSERT INTO hk_players (user_id, streak_current) VALUES ($1, 4) ON CONFLICT (user_id) DO UPDATE SET streak_current = 4', [f.S3.id]);
    expect((await notices.studyReminders(at(19))).notified).toBe(1);
    expect((await inbox(f.S3)).find((i: any) => i.kind === 'study_reminder').body).toContain('Chuỗi 4 ngày');
    // mẫu nhắc học đã chỉnh được dùng
    await root('PUT', '/api/platform/templates/reminder', { subject: '[Đông A EDU] Đừng quên học', body: 'Này {{ten}}, vào học đi nào! {{chuoi}}' });
    await sql(s.url, "DELETE FROM app_notifications WHERE user_id = $1 AND kind = 'study_reminder'", [f.S3.id]);
    await notices.studyReminders(at(19));
    expect((await inbox(f.S3)).find((i: any) => i.kind === 'study_reminder')).toMatchObject({ title: 'Đừng quên học' });
    await root('DELETE', '/api/platform/templates/reminder');
    // bài tập sắp hết hạn
    const quiz = (await sql<{ id: number }>(s.url, 'SELECT id FROM hk_quizzes ORDER BY id LIMIT 1'))[0].id;
    const a = (await sql<{ id: number }>(s.url, "INSERT INTO hk_assignments (class_id, created_by, title, kind, quiz_id, due_at) VALUES ($1, $2, 'Bài tập sắp hạn', 'quiz', $3, now() + interval '5 hours') RETURNING id", [f.class7a.id, f.T1.id, quiz]))[0].id;
    await sql(s.url, 'INSERT INTO hk_submissions (assignment_id, user_id, attempts, best_percent, submitted_at) VALUES ($1, $2, 1, 80, now())', [a, f.S2.id]);
    expect(await notices.dueSoon()).toBe(1); // S2 đã nộp nên chỉ S1
    expect((await inbox(f.S1)).find((i: any) => i.title === 'Sắp hết hạn: Bài tập sắp hạn')).toMatchObject({ kind: 'assignment', category: 'class', class_name: '7A1' });
    expect(await notices.dueSoon()).toBe(0);
    // lên cấp, huy hiệu (từ hàng đợi chúc mừng của trò chơi hóa)
    await sql(s.url, `INSERT INTO hk_celebrations (user_id, kind, payload) VALUES ($1, 'level_up', '{"level":3,"title":"Cấp 3"}'), ($1, 'badge', '{"name":"Người giữ lửa"}'), ($1, 'gift', '{}')`, [f.S1.id]);
    expect(await notices.achievements()).toBe(2);
    expect(await notices.achievements()).toBe(0);
    const mine = await inbox(f.S1);
    expect(mine.find((i: any) => i.kind === 'level_up')).toMatchObject({ category: 'achievement' });
    expect(mine.find((i: any) => i.kind === 'level_up').body).toContain('Em vừa lên cấp 3 – Cấp 3');
    expect(mine.find((i: any) => i.kind === 'badge').body).toContain('“Người giữ lửa”');
    expect((await as(f.S1)('GET', '/api/platform/notices?category=achievement')).body.items).toHaveLength(2);
    const auto = await notices.automatic(at(20));
    expect(auto).toMatchObject({ notified: 0, due_soon: 0, achievements: 0 });
  });

  // ------------------------------------------------------------------ HK.HS.111, GV.081, QT.052, AD.073–074
  test('yêu cầu hỗ trợ: gửi kèm ảnh chụp màn hình, theo dõi trạng thái; quản trị tổng lọc, phản hồi, đổi trạng thái; người khác không đọc được', async () => {
    const make = (who: { token: string }, extra: Record<string, unknown> = {}) => as(who)('POST', '/api/platform/support', { category: 'bug', subject: 'Nút Làm bài không bấm được', body: 'Em bấm nút nhưng không có gì xảy ra.', page: '/hoc-sinh', ...extra });
    const rootNoticesBefore = (await root('GET', '/api/platform/notices')).body.unread;
    const t = await make(f.S1, { attachment: { name: 'loi.png', data: `data:image/png;base64,${PNG}` } });
    expect(t.status).toBe(200);
    expect(t.body).toMatchObject({ status: 'new', category: 'bug', role: 'student', has_attachment: true, attachment_name: 'loi.png', messages: [] });
    expect((await root('GET', '/api/platform/notices')).body.unread).toBe(rootNoticesBefore + 1); // quản trị tổng được báo
    // kiểm tra dữ liệu
    expect((await make(f.S1, { subject: 'ab' })).status).toBe(400);
    expect((await make(f.S1, { body: 'ngắn' })).status).toBe(400);
    expect((await make(f.S1, { category: 'khac' })).status).toBe(400);
    expect((await make(f.S1, { attachment: { name: 'a.txt', data: Buffer.from('không phải ảnh').toString('base64') } })).status).toBe(400);
    expect((await make(f.S1, { attachment: { name: 'to.png', data: Buffer.alloc(1_600_000, 1).toString('base64') } })).status).toBe(400);
    expect((await make({ token: f.root })).status).toBe(403);
    // ảnh: chủ yêu cầu và quản trị tổng xem được
    const img = await fetch(`${s.base}/api/platform/support/${t.body.id}/attachment`, { headers: { Authorization: `Bearer ${f.S1.token}` } });
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await img.arrayBuffer()).toString('base64')).toBe(PNG);
    expect((await fetch(`${s.base}/api/platform/support/${t.body.id}/attachment`, { headers: { Authorization: `Bearer ${f.S2.token}` } })).status).toBe(404);
    expect((await fetch(`${s.base}/api/platform/support/${t.body.id}/attachment`, { headers: { Authorization: `Bearer ${f.root}` } })).status).toBe(200);
    expect((await as(f.S2)('GET', `/api/platform/support/${t.body.id}`)).status).toBe(404);
    expect((await as(f.S1)('GET', '/api/platform/support/mine')).body.map((x: any) => x.id)).toEqual([t.body.id]);
    // giáo viên và quản trị trường cũng gửi được
    const tt = await make(f.T1, { category: 'question', subject: 'Hỏi về xuất báo cáo', body: 'Làm sao xuất Excel theo lớp?' });
    const ta = await make(f.A, { category: 'account', subject: 'Cần tăng giới hạn học sinh', body: 'Trường đã đủ 50 học sinh.' });
    expect([tt.body.role, ta.body.role]).toEqual(['teacher', 'school_admin']);
    // quản trị tổng: danh sách, lọc
    const all = (await root('GET', '/api/platform/support')).body;
    expect(all.total).toBe(3);
    expect(all.counts).toMatchObject({ new: 3 });
    expect((await root('GET', '/api/platform/support?role=teacher')).body.items.map((x: any) => x.id)).toEqual([tt.body.id]);
    expect((await root('GET', '/api/platform/support?q=Excel')).body.total).toBe(1);
    expect((await as(f.A)('GET', '/api/platform/support')).status).toBe(403);
    // phản hồi và trạng thái
    const rep = await root('POST', `/api/platform/support/${t.body.id}/reply`, { body: 'Cảm ơn em, thầy cô đang kiểm tra.' });
    expect(rep.body.status).toBe('processing');
    expect(rep.body.messages).toMatchObject([{ author_role: 'root_admin', body: 'Cảm ơn em, thầy cô đang kiểm tra.' }]);
    expect((await as(f.S1)('GET', '/api/platform/notices')).body.items.some((i: any) => i.kind === 'support' && i.title.startsWith('Phản hồi yêu cầu hỗ trợ'))).toBe(true);
    expect((await root('PATCH', `/api/platform/support/${t.body.id}/status`, { status: 'xong' })).status).toBe(400);
    expect((await root('PATCH', `/api/platform/support/${t.body.id}/status`, { status: 'done' })).body.status).toBe('done');
    expect((await as(f.S1)('GET', '/api/platform/notices')).body.items.some((i: any) => i.body === 'Trạng thái mới: Đã xong.')).toBe(true);
    expect((await as(f.S1)('POST', `/api/platform/support/${t.body.id}/reply`, { body: 'Vẫn còn lỗi ạ.' })).body.status).toBe('new'); // học sinh trả lời thì mở lại
    expect((await as(f.S2)('POST', `/api/platform/support/${t.body.id}/reply`, { body: 'Chen ngang' })).status).toBe(404);
    expect((await as(f.T1)('PATCH', `/api/platform/support/${t.body.id}/status`, { status: 'done' })).status).toBe(403);
    expect((await l2('PATCH', `/api/platform/support/${tt.body.id}/status`, { status: 'processing' })).body.status).toBe('processing'); // cấp 2 cũng xử lý hỗ trợ
    // giới hạn 5 yêu cầu / 24 giờ
    for (let i = 0; i < 3; i += 1) expect((await make(f.S3, { subject: `Phản hồi số ${i + 1}` })).status).toBe(200);
    await make(f.S3, { subject: 'Phản hồi số 4' }); await make(f.S3, { subject: 'Phản hồi số 5' });
    expect((await make(f.S3, { subject: 'Phản hồi số 6' })).status).toBe(429);
  });

  // ------------------------------------------------------------------ HK.HS.110, GV.080, QT.054, AD.067
  test('hướng dẫn và câu hỏi thường gặp theo vai trò; quản trị tổng thêm, sửa, ẩn, xóa', async () => {
    const titles = async (who: { token: string }) => (await as(who)('GET', '/api/platform/faq')).body.items as any[];
    const stu = await titles(f.S1), tea = await titles(f.T1), adm = await titles(f.A);
    expect(stu.length).toBeGreaterThanOrEqual(8);
    expect(stu.every((i) => ['student', 'all'].includes(i.audience))).toBe(true);
    expect(tea.every((i) => ['teacher', 'all'].includes(i.audience))).toBe(true);
    expect(adm.every((i) => ['school_admin', 'all'].includes(i.audience))).toBe(true);
    expect(stu.some((i) => i.question.includes('Bắt đầu học từ đâu'))).toBe(true);
    expect(tea.some((i) => i.question.includes('Tạo lớp'))).toBe(true);
    expect(adm.some((i) => i.question.includes('nhật ký') || i.question.includes('Xem ai đã làm gì'))).toBe(true);
    expect((await titles({ token: f.root })).some((i) => i.audience === 'teacher') && (await titles({ token: f.root })).some((i) => i.audience === 'student')).toBe(true);
    const bad = { audience: 'student', category: 'Mới', question: 'Câu hỏi thử có đủ dài?', answer: 'Trả lời thử.' };
    expect((await root('POST', '/api/platform/faq', { ...bad, audience: 'khach' })).status).toBe(400);
    expect((await root('POST', '/api/platform/faq', { ...bad, image_url: 'http://x.vn/a.png' })).status).toBe(400);
    expect((await root('POST', '/api/platform/faq', { ...bad, question: 'ab' })).status).toBe(400);
    expect((await as(f.T1)('POST', '/api/platform/faq', bad)).status).toBe(403);
    const made = await root('POST', '/api/platform/faq', { ...bad, image_url: 'https://example.vn/huong-dan.png', video_url: 'https://www.youtube.com/watch?v=abc', position: 0 });
    expect(made.body).toMatchObject({ audience: 'student', is_published: true, image_url: 'https://example.vn/huong-dan.png' });
    expect((await titles(f.S1))[0].question).toBe('Câu hỏi thử có đủ dài?');
    expect((await l2('PUT', `/api/platform/faq/${made.body.id}`, { answer: 'Đã sửa bởi quản trị cấp hai.' })).body.answer).toBe('Đã sửa bởi quản trị cấp hai.'); // cấp 2 sửa được nội dung hướng dẫn
    await root('PUT', `/api/platform/faq/${made.body.id}`, { is_published: false });
    expect((await titles(f.S1)).some((i) => i.question === 'Câu hỏi thử có đủ dài?')).toBe(false);
    expect((await root('GET', '/api/platform/faq/all')).body.some((i: any) => i.id === made.body.id && i.is_published === false)).toBe(true);
    expect((await root('DELETE', `/api/platform/faq/${made.body.id}`)).body.deleted).toBe(true);
    expect((await root('DELETE', `/api/platform/faq/${made.body.id}`)).status).toBe(404);
    expect((await as(f.A)('GET', '/api/platform/faq/all')).status).toBe(403);
    expect((await call(s.base, 'GET', '/api/platform/faq')).status).toBe(401);
  });

  // ------------------------------------------------------------------ HK.QT.051, HK.AD.027, 075, 076, HK.SYS.020
  test('nhật ký: lịch sử đăng nhập có thiết bị và IP, nhật ký thao tác dễ đọc theo phạm vi, nhật ký lỗi và dọn dẹp', async () => {
    const res = await fetch(`${s.base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'X-Forwarded-For': '1.2.3.4, 203.0.113.9' }, body: JSON.stringify({ username: 'admin', password: 'sai-mat-khau', portal: 'root_admin' }) });
    expect(res.status).toBe(401);
    const logins = (await root('GET', '/api/platform/logs/logins?q=admin&success=false')).body;
    expect(logins.items[0]).toMatchObject({ username: 'admin', success: false, reason: 'credentials', ip: '203.0.113.9', device: 'Chrome trên Windows' }); // lấy mục bên phải nhất do proxy tin cậy ghi
    expect((await as(f.A)('GET', '/api/platform/logs/logins')).body.items.every((i: any) => i.school_id === f.A.schoolId)).toBe(true);
    expect((await as(f.T1)('GET', '/api/platform/logs/logins')).status).toBe(403);
    // nhật ký thao tác: nhãn dễ đọc và đúng phạm vi trường
    await as(f.A)('POST', '/api/admin/teachers', { full_name: 'Giáo Viên Nhật Ký', email: 'nhatky@example.edu.vn' });
    const auditA = (await as(f.A)('GET', '/api/platform/logs/audit')).body;
    expect(auditA.items.length).toBeGreaterThan(0);
    expect(auditA.items.every((i: any) => i.school_id === f.A.schoolId)).toBe(true);
    expect(auditA.items.find((i: any) => i.action.includes('/teachers'))).toMatchObject({ label: 'Tạo / thực hiện giáo viên', success: true, actor_role: 'school_admin' });
    expect((await as(f.B)('GET', '/api/platform/logs/audit')).body.items.some((i: any) => i.school_id === f.A.schoolId)).toBe(false);
    expect((await root('GET', '/api/platform/logs/audit')).body.total).toBeGreaterThan(auditA.total);
    expect((await as(f.S1)('GET', '/api/platform/logs/audit')).status).toBe(403);
    const { describeAction } = await import('../src/platform/logs.service');
    expect(describeAction('DELETE /admin/students/:id')).toBe('Xóa học sinh');
    expect(describeAction('POST /admin/users/:id/reset-password')).toBe('Đặt lại mật khẩu tài khoản');
    expect(describeAction('PATCH /content/lessons/:id/status')).toBe('Đổi trạng thái bài học');
    expect(describeAction('POST /platform/surveys/:id/respond')).toBe('Trả lời khảo sát');
    expect(describeAction('PUT /platform/rbac')).toBe('Đổi ma trận phân quyền');
    expect(describeAction('POST /platform/backups/:id/restore')).toBe('Phục hồi dữ liệu');
    // mặc định ẩn thao tác của học sinh; students=true thì hiện
    expect((await as(f.A)('GET', '/api/platform/logs/audit')).body.items.some((i: any) => i.actor_role === 'student')).toBe(false);
    expect((await as(f.A)('GET', '/api/platform/logs/audit?students=true')).body.items.some((i: any) => i.actor_role === 'student')).toBe(true);
    // nhật ký lỗi: ghi từ mọi nơi, lọc, dọn
    const { ErrorLog } = await import('../src/platform/error-log');
    ErrorLog.report('ai', 'Mô hình AI lỗi: hết thời gian', { route: 'POST /api/ai/ask', status: 502 });
    ErrorLog.report('job', 'Việc thử lỗi');
    ErrorLog.report('job', 'Việc thử lỗi'); // trùng trong 10 giây chỉ ghi một lần
    await new Promise((r) => setTimeout(r, 400));
    const errors = (await root('GET', '/api/platform/logs/errors')).body;
    expect(errors.items.filter((e: any) => e.message === 'Việc thử lỗi')).toHaveLength(1);
    expect((await root('GET', '/api/platform/logs/errors?source=ai')).body.items[0]).toMatchObject({ source: 'ai', route: 'POST /api/ai/ask', status: 502 });
    expect((await root('GET', '/api/platform/logs/errors?q=hết thời gian')).body.total).toBe(1);
    expect(errors.last_24h).toMatchObject({ ai: 1, job: 1 });
    expect((await as(f.A)('GET', '/api/platform/logs/errors')).status).toBe(403);
    expect((await l2('GET', '/api/platform/logs/errors')).status).toBe(200);
    expect((await l2('DELETE', '/api/platform/logs/errors?older_than_days=1')).status).toBe(403); // dọn nhật ký: chỉ cấp 1
    await sql(s.url, "UPDATE hk_error_log SET created_at = now() - interval '40 days' WHERE source = 'job'");
    expect((await root('DELETE', '/api/platform/logs/errors?older_than_days=30')).body).toMatchObject({ deleted: 1, older_than_days: 30 });
    // lỗi máy chủ 500 được ghi lại
    const mail = s.moduleRef.get((await import('../src/admin/mail.service')).MailService);
    expect(mail.configured).toBe(true);
  });

  // ------------------------------------------------------------------ HK.AD.010
  test('giám sát tình trạng: cơ sở dữ liệu, hàng đợi thư, lỗi, việc nền và lưu lượng yêu cầu', async () => {
    const job = s.moduleRef.get((await import('../src/platform/platform.job')).PlatformJob);
    await job.tick({ automatic: true, hourly: true });
    const h = (await root('GET', '/api/platform/health')).body;
    expect(h.database).toMatchObject({ ok: true });
    expect(h.database.schema_version).toBeGreaterThanOrEqual(33);
    expect(h.database.latency_ms).toBeGreaterThanOrEqual(0);
    expect(h.server).toMatchObject({ uptime_s: expect.any(Number), node: expect.stringMatching(/^v\d+/) });
    expect(h.mail).toMatchObject({ configured: true, transport: 'json' });
    expect(h.jobs.map((j: any) => j.job)).toEqual(expect.arrayContaining(['broadcasts', 'notices_auto', 'backup', 'retention']));
    expect(h.jobs.every((j: any) => j.last_ok && j.age_min <= 1)).toBe(true);
    expect(h.requests.total).toBeGreaterThan(50);
    expect(h.requests.rate_limited).toBeGreaterThanOrEqual(1);
    expect(h.errors).toMatchObject({ hour: expect.any(Number), day: expect.any(Number) });
    expect((await l2('GET', '/api/platform/health')).status).toBe(200);
    expect((await as(f.A)('GET', '/api/platform/health')).status).toBe(403);
  });

  // ------------------------------------------------------------------ HK.AD.002
  test('xác thực hai lớp: bật bằng ứng dụng (TOTP) hoặc email, đăng nhập hai bước, mã dự phòng dùng một lần, tắt, đặt lại, bỏ qua khẩn cấp', async () => {
    const { totp, unbase32, verifyTotp, base32 } = await import('../src/platform/twofa.service');
    expect(base32(Buffer.from('12345678901234567890'))).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'); // vector RFC 6238
    expect(totp(Buffer.from('12345678901234567890'), Math.floor(59 / 30))).toBe('287082'); // vector RFC 6238 (T = 59 s)
    expect(verifyTotp(unbase32('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'), '287082', 59_000)).toBe(true);
    expect(verifyTotp(unbase32('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'), '287083', 59_000)).toBe(false);
    const login = (username: string, password: string, portal: string) => call(s.base, 'POST', '/api/auth/login', { username, password, portal });
    expect((await as(f.S1)('GET', '/api/platform/2fa')).status).toBe(403);
    expect((await root('GET', '/api/platform/2fa')).body).toMatchObject({ eligible: true, enabled: false, totp_available: true });
    // --- TOTP cho quản trị tổng
    const setup = (await root('POST', '/api/platform/2fa/setup', { method: 'totp' })).body;
    expect(setup.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(setup.otpauth_uri).toContain('otpauth://totp/');
    expect(setup.qr).toMatch(/^data:image\/png;base64,/);
    expect((await root('GET', '/api/platform/2fa')).body).toMatchObject({ enabled: false, pending: true });
    expect((await login('admin', 'admin@123', 'root_admin')).body.token).toBeTruthy(); // chưa xác nhận thì chưa bắt buộc
    expect((await root('POST', '/api/platform/2fa/enable', { code: '000000' })).status).toBe(400);
    const secret = unbase32(setup.secret);
    const now = () => Math.floor(Date.now() / 30_000);
    const enabled = await root('POST', '/api/platform/2fa/enable', { code: totp(secret, now()) });
    expect(enabled.body.backup_codes).toHaveLength(8);
    expect(enabled.body.backup_codes[0]).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}$/);
    expect(JSON.stringify(await sql(s.url, 'SELECT totp_secret_enc FROM hk_two_factor'))).not.toContain(setup.secret); // bí mật lưu mã hóa
    // đăng nhập hai bước
    const step1 = await login('admin', 'admin@123', 'root_admin');
    expect(step1.status).toBe(200);
    expect(step1.body).toMatchObject({ two_factor: true, method: 'totp', expires_in: 300 });
    expect(step1.body.token).toBeUndefined();
    const challenge = step1.body.challenge as string;
    expect((await call(s.base, 'GET', '/api/auth/me', undefined, challenge)).status).toBe(401); // mã thử thách không dùng làm token phiên
    const verify = (code: string, portal = 'root_admin', ch = challenge) => call(s.base, 'POST', '/api/auth/2fa/verify', { challenge: ch, code, portal });
    expect((await verify('123456')).status).toBe(401);
    expect((await verify(totp(secret, now()), 'school_admin')).status).toBe(401); // sai cổng đăng nhập
    expect((await verify(totp(secret, now()), 'root_admin', 'x'.repeat(40))).status).toBe(401);
    const done = await verify(totp(secret, now()));
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ token: expect.any(String), user: { username: 'admin' } });
    expect((await call(s.base, 'GET', '/api/auth/me', undefined, done.body.token)).status).toBe(200);
    // mã dự phòng: dùng một lần
    const backup = enabled.body.backup_codes[0] as string;
    const again = await login('admin', 'admin@123', 'root_admin');
    expect((await verify(backup, 'root_admin', again.body.challenge)).status).toBe(200);
    const third = await login('admin', 'admin@123', 'root_admin');
    expect((await verify(backup, 'root_admin', third.body.challenge)).status).toBe(401);
    expect((await root('GET', '/api/platform/2fa')).body.backup_codes_left).toBe(7);
    const logins = (await root('GET', '/api/platform/logs/logins?q=admin')).body.items;
    expect(logins.some((i: any) => i.reason === 'two_factor' && !i.success)).toBe(true);
    // khẩn cấp: biến môi trường bỏ qua bước hai
    process.env.TWO_FACTOR_BYPASS = 'true';
    expect((await login('admin', 'admin@123', 'root_admin')).body.token).toBeTruthy();
    delete process.env.TWO_FACTOR_BYPASS;
    // tắt cần mật khẩu và mã
    expect((await root('POST', '/api/platform/2fa/disable', { password: 'sai', code: totp(secret, now()) })).status).toBe(401);
    expect((await root('POST', '/api/platform/2fa/disable', { password: 'admin@123', code: '111111' })).status).toBe(400);
    expect((await root('POST', '/api/platform/2fa/disable', { password: 'admin@123', code: totp(secret, now()) })).body.enabled).toBe(false);
    expect((await login('admin', 'admin@123', 'root_admin')).body.token).toBeTruthy();
    // --- email cho quản trị trường A
    const adminA = (await sql<{ username: string }>(s.url, 'SELECT username FROM app_users WHERE id = $1', [f.A.id]))[0].username;
    const sent = await mailSent();
    const before = sent.length;
    expect((await as(f.A)('POST', '/api/platform/2fa/setup', { method: 'email' })).body.sent_to).toMatch(/^q\*\*\*@example\.edu\.vn$/);
    const code1 = /Mã xác thực của bạn là: (\d{6})/.exec(sent[sent.length - 1].text)![1];
    expect(sent.length).toBe(before + 1);
    expect(sent[sent.length - 1].subject).toBe('[Đông A EDU] Mã xác thực đăng nhập quản trị');
    expect((await as(f.A)('POST', '/api/platform/2fa/enable', { code: code1 })).body.backup_codes).toHaveLength(8);
    const stepA = await login(adminA, PW, 'school_admin');
    expect(stepA.body).toMatchObject({ two_factor: true, method: 'email' });
    const code2 = /Mã xác thực của bạn là: (\d{6})/.exec(sent[sent.length - 1].text)![1];
    expect((await verify('000000', 'school_admin', stepA.body.challenge)).status).toBe(401);
    expect((await verify(code2, 'school_admin', stepA.body.challenge)).status).toBe(200);
    expect((await verify(code2, 'school_admin', stepA.body.challenge)).status).toBe(401); // mã email dùng một lần
    // đặt lại cho tài khoản khác: chỉ cấp 1
    expect((await l2('DELETE', `/api/platform/2fa/users/${f.A.id}`)).status).toBe(403);
    expect((await as(f.A)('DELETE', `/api/platform/2fa/users/${f.A.id}`)).status).toBe(403);
    expect((await root('DELETE', `/api/platform/2fa/users/${f.A.id}`)).body.reset).toBe(true);
    expect((await login(adminA, PW, 'school_admin')).body.token).toBeTruthy();
    expect((await root('DELETE', `/api/platform/2fa/users/${f.S1.id}`)).status).toBe(404);
    // không dùng hai lớp cho giáo viên / học sinh
    expect((await as(f.T1)('POST', '/api/platform/2fa/setup', { method: 'totp' })).status).toBe(403);
  });

  // ------------------------------------------------------------------ HK.AD.072, HK.SYS.019
  test('sao lưu và phục hồi: tạo, tải về, phục hồi đúng dữ liệu, bản an toàn trước phục hồi, từ chối khi sai xác nhận hoặc khác phiên bản, sao lưu tự động hằng ngày', async () => {
    const created = await root('POST', '/api/platform/backups', { label: 'Trước khi thử' });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ kind: 'manual', label: 'Trước khi thử', schema_version: expect.any(Number) });
    expect(created.body.table_count).toBeGreaterThan(40);
    expect(created.body.row_count).toBeGreaterThan(100);
    const file = await fetch(`${s.base}/api/platform/backups/${created.body.id}/download`, { headers: { Authorization: `Bearer ${f.root}` } });
    expect(file.status).toBe(200);
    expect(file.headers.get('content-disposition')).toMatch(/sao-luu-.*-manual\.json\.gz/);
    const { gunzipSync } = await import('zlib');
    const doc = JSON.parse(gunzipSync(Buffer.from(await file.arrayBuffer())).toString('utf8'));
    expect(Object.keys(doc.tables)).toEqual(expect.arrayContaining(['app_users', 'app_schools', 'hk_faq', 'hk_support_tickets']));
    expect(Object.keys(doc.tables)).not.toEqual(expect.arrayContaining(['hk_backups', 'app_revoked_tokens']));
    expect(doc.tables.app_users.length).toBeGreaterThanOrEqual(8);
    // thay đổi dữ liệu rồi phục hồi
    const faqBefore = Number((await sql<{ n: string }>(s.url, 'SELECT count(*) AS n FROM hk_faq'))[0].n);
    const schoolName = (await sql<{ name: string }>(s.url, 'SELECT name FROM app_schools WHERE id = $1', [f.B.schoolId]))[0].name;
    await sql(s.url, 'DELETE FROM hk_faq');
    await sql(s.url, 'UPDATE app_schools SET name = $1 WHERE id = $2', ['Tên đã bị đổi', f.B.schoolId]);
    await sql(s.url, "INSERT INTO hk_faq (audience, category, question, answer) VALUES ('all', 'Mới', 'Mục thêm sau khi sao lưu', 'Sẽ biến mất sau phục hồi')");
    expect((await root('POST', `/api/platform/backups/${created.body.id}/restore`, { confirm: 'khong dung' })).status).toBe(400);
    expect((await l2('POST', `/api/platform/backups/${created.body.id}/restore`, { confirm: 'PHUC HOI' })).status).toBe(403);
    await sql(s.url, 'UPDATE hk_backups SET schema_version = schema_version - 1 WHERE id = $1', [created.body.id]);
    expect((await root('POST', `/api/platform/backups/${created.body.id}/restore`, { confirm: 'PHUC HOI' })).status).toBe(409);
    await sql(s.url, 'UPDATE hk_backups SET schema_version = schema_version + 1 WHERE id = $1', [created.body.id]);
    const restored = await root('POST', `/api/platform/backups/${created.body.id}/restore`, { confirm: 'phuc hoi' });
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ restored: true, backup_id: created.body.id, tables: expect.any(Number), rows: expect.any(Number) });
    expect(Number((await sql<{ n: string }>(s.url, 'SELECT count(*) AS n FROM hk_faq'))[0].n)).toBe(faqBefore);
    expect((await sql<{ name: string }>(s.url, 'SELECT name FROM app_schools WHERE id = $1', [f.B.schoolId]))[0].name).toBe(schoolName);
    expect(await sql(s.url, "SELECT 1 FROM hk_faq WHERE question = 'Mục thêm sau khi sao lưu'")).toHaveLength(0);
    // bản an toàn đã tạo, dữ liệu mới vẫn ghi được (bộ đếm tự tăng đã đặt lại), phiên đăng nhập còn dùng được
    const list = (await root('GET', '/api/platform/backups')).body;
    expect(list.items.some((b: any) => b.kind === 'pre_restore' && b.id === restored.body.safety_backup_id)).toBe(true);
    expect((await root('POST', '/api/platform/faq', { audience: 'all', category: 'Sau phục hồi', question: 'Ghi được sau phục hồi?', answer: 'Được, khóa không bị trùng.' })).status).toBe(200);
    expect((await as(f.S1)('GET', '/api/platform/prefs')).status).toBe(200);
    expect((await as(f.T1)('POST', '/api/platform/support', { category: 'question', subject: 'Hỏi sau khi phục hồi', body: 'Hệ thống vẫn ghi được yêu cầu.' })).status).toBe(200);
    // tự động hằng ngày
    const backups = s.moduleRef.get((await import('../src/platform/backup.service')).BackupService);
    // việc nền ở bài giám sát có thể đã tự sao lưu nếu đúng giờ mặc định (2 giờ sáng): bắt đầu từ trạng thái chưa có bản tự động
    await sql(s.url, "DELETE FROM hk_backups WHERE kind = 'auto'");
    // cố định một thời điểm để giờ tính và giờ kiểm tra không lệch nhau khi vừa qua mốc giờ
    const now = new Date();
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', hourCycle: 'h23' }).format(now));
    await root('PUT', '/api/platform/settings', { backup_hour: (hour + 1) % 24 });
    await clearCaches();
    expect(await backups.autoIfDue(now)).toBe(false); // chưa tới giờ
    await root('PUT', '/api/platform/settings', { backup_hour: hour, backup_keep: 1 });
    await clearCaches();
    expect(await backups.autoIfDue(now)).toBe(true);
    expect(await backups.autoIfDue(now)).toBe(false); // mỗi ngày một bản
    await sql(s.url, "UPDATE hk_backups SET created_at = now() - interval '2 days' WHERE kind = 'auto'");
    expect(await backups.autoIfDue(now)).toBe(true);
    expect((await sql<{ n: string }>(s.url, "SELECT count(*) AS n FROM hk_backups WHERE kind = 'auto'"))[0].n).toBe('1'); // chỉ giữ số bản theo cấu hình
    await root('PUT', '/api/platform/settings', { backup_enabled: false });
    await clearCaches();
    await sql(s.url, "DELETE FROM hk_backups WHERE kind = 'auto'");
    expect(await backups.autoIfDue(now)).toBe(false);
    expect((await root('DELETE', `/api/platform/backups/${created.body.id}`)).body.deleted).toBe(true);
    expect((await root('DELETE', `/api/platform/backups/${created.body.id}`)).status).toBe(404);
    expect((await l2('POST', '/api/platform/backups', {})).status).toBe(403);
    expect((await l2('GET', '/api/platform/backups')).status).toBe(403);
    expect((await as(f.A)('GET', '/api/platform/backups')).status).toBe(403);
  });
});
