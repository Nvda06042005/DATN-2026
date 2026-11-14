// Chạy trên bản web local với API giả lập, không gửi thư hay tạo tài khoản thật.
// PLAYWRIGHT_MODULE trỏ tới Playwright có sẵn trong môi trường kiểm tra; không cần thêm dependency sản phẩm.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.QA_URL || 'http://127.0.0.1:8765';
const out = process.env.QA_ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'dong-a-admin-suggestions-qa');
fs.mkdirSync(out, { recursive: true });
const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
const root = { id: 1, username: 'qa-root', full_name: 'Quản trị kiểm thử', role: 'root_admin', admin_level: 1, email: 'root@example.invalid', is_active: true, must_change_password: false, school_id: null };
const school = id => ({ id, school_code: String(id).padStart(8, '0'), name: `THCS Kiểm thử ${id}`, city: 'Thành phố thử nghiệm', region: 'Phường kiểm thử', is_active: true, logo_url: null, created_at: '2026-11-01', users: 1, admins: 1, teachers: 0, students: 0, classes: 0, link: { url: base + '/donga_test_' + id } });
const account = id => ({ ...root, id, username: `qa-person-${id}`, full_name: `Quản trị thử ${id}`, role: 'school_admin', school_id: id, school_code: String(id).padStart(8, '0'), school_name: school(id).name, email: `qa${id}@example.invalid`, phone: '0900000000', classes: [] });
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
 const results = [];
 try { for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  let schools = Array.from({ length: 45 }, (_, i) => school(i + 10));
  let people = Array.from({ length: 45 }, (_, i) => account(i + 10));
  const calls = [], posts = [], errors = []; let fail = true;
  await ctx.addInitScript(() => localStorage.setItem('donga_token_root_admin', 'synthetic-suggestions'));
  await ctx.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname;
    calls.push(p + url.search); let data = [], status = 200;
    const q = norm(url.searchParams.get('q'));
    const paginate = rows => { const page = Number(url.searchParams.get('page') || 1), limit = Number(url.searchParams.get('limit') || 30); return { items: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit, facets: { cities: [], regions: [] } }; };
    if (p === '/api/auth/me') data = root;
    else if (p === '/api/platform/config') data = { system_name: 'Đông A edu', flags: {}, features: {} };
    else if (p === '/api/admin/schools' && req.method() === 'POST') {
      const body = req.postDataJSON(); posts.push({ path: p, body });
      const s = { ...school(999), ...body }, a = { ...account(999), full_name: body.admin.full_name, email: body.admin.email, phone: body.admin.phone, school_name: s.name };
      schools.push(s); people.push(a); data = { school: s, admin: a, mail: 'queued', temporary_password: 'Fixture-only-123' }; status = 201;
    }
    else if (p === '/api/admin/schools') data = paginate(schools.filter(s => norm(`${s.name} ${s.school_code}`).includes(q)));
    else if (/^\/api\/admin\/schools\/\d+$/.test(p)) { const s = schools.find(s => s.id === Number(p.split('/').pop())); data = { ...s, counts: { admins: 1, teachers: 0, students: 0, classes: 0 }, admins: [], current_year: null }; }
    else if (p === '/api/admin/school-directory') data = { items: [{ code: 'fixture-school', name: 'THCS Tân Sơn', city: 'Thành phố thử nghiệm', region: 'Phường kiểm thử', exists: false }] };
    else if (p === '/api/admin/users' && req.method() === 'POST') {
      const body = req.postDataJSON(); posts.push({ path: p, body });
      const a = { ...account(1000), ...body, school_name: schools.find(s => s.id === body.school_id)?.name };
      people.push(a); data = { user: a, mail: 'queued', temporary_password: 'Fixture-only-123' }; status = 201;
    }
    else if (p === '/api/admin/users') {
      let rows = people.filter(a => norm(`${a.full_name} ${a.email}`).includes(q));
      if (url.searchParams.get('school_id')) rows = rows.filter(a => a.school_id === Number(url.searchParams.get('school_id')));
      data = paginate(rows);
      if (q === 'loi' && fail) { status = 503; data = { detail: 'Không tải được danh sách thử nghiệm' }; fail = false; }
      if (q === 'cham') await new Promise(r => setTimeout(r, 700));
    }
    else if (/^\/api\/admin\/users\/\d+$/.test(p)) data = { ...people.find(a => a.id === Number(p.split('/').pop())), deletable: true, delete_blocker: null };
    else if (p === '/api/analytics/system/overview') data = { schools: 45, schools_total: 45, users_by_role: {}, dau: 0, wau: 0, mau: 0, new_users_30d: 0, series: [] };
    else if (p === '/api/analytics/system/content') data = { history: [], learning: [], questions: { total: 0, by_scope: {} }, quizzes: 0, ai_chunks: 0 };
    else if (p === '/api/analytics/usage') data = { items: [], totals: { lessons: 0, quizzes: 0, battles: 0, rooms: 0 } };
    else if (p === '/api/analytics/ai') data = { series: [], topics: [], questions: 0, answers: 0, price: {} };
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) }).catch(() => {});
  });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
  // mục trong nhóm thu gọn (vd. Quản lý) chỉ hiện khi nhóm mở: mở mọi nhóm đang đóng trước khi bấm
  const nav = async id => { if (width < 1000) await page.getByTestId('admin-menu-toggle').click(); for (const g of await page.locator('[data-testid^="admin-nav-group-"][aria-expanded="false"]').all()) await g.click(); await page.getByTestId('admin-nav-' + id).click(); };
  const close = async () => page.getByRole('button', { name: 'Đóng', exact: true }).first().click();
  const field = name => page.locator('#field-' + name);
  const clickOption = async id => { await page.getByTestId(id).waitFor(); await page.getByTestId(id).click(); };
  try {
   await page.goto(base + '/admin', { waitUntil: 'domcontentloaded' });
   await nav('schools'); await page.getByTestId('school-add').click();
   await field('name').fill('Tân Sơn'); await clickOption('school-pick-fixture-school');
   await field('admin_name').fill('Nguyễn Tân Sơn'); await field('admin_email').fill('new-school@example.invalid'); await field('admin_phone').fill('0900000001');
   await page.getByTestId('form-submit').click(); await page.getByTestId('credential-username').waitFor(); await close();
   await nav('users'); await page.getByTestId('user-add').click();
   await page.getByTestId('admin-suggest-toggle-full_name').click();
   await field('full_name').click();
   await page.getByTestId('admin-suggest-full_name-10').waitFor();
   await page.getByTestId('admin-suggest-more-full_name').click(); await page.waitForTimeout(350); await page.getByTestId('admin-suggest-full_name-49').waitFor();
   await field('full_name').fill('Nguyen Tan Son'); await clickOption('admin-suggest-full_name-999');
   assert.equal(await field('full_name').inputValue(), 'Nguyễn Tân Sơn'); assert.equal(await field('email').inputValue(), 'new-school@example.invalid'); assert.equal(await field('phone').inputValue(), '0900000001');
   await page.getByText('Đã chọn: THCS Tân Sơn', { exact: true }).waitFor();
   await page.screenshot({ path: `${out}/${width}-selected-person.png` });
   await page.getByTestId('form-submit').click(); await page.getByText('qa-person-999', { exact: true }).first().waitFor();
   assert.equal(posts.filter(p => p.path === '/api/admin/users').length, 0, 'existing account must not be created again'); await close();
   await page.getByTestId('user-add').click(); await field('email').fill('new-school@'); await clickOption('admin-suggest-email-999');
   assert.equal(await field('full_name').inputValue(), 'Nguyễn Tân Sơn'); await page.getByTestId('admin-new-person').click();
   // Pick a school beyond the first page; name and email suggestions must be scoped to it.
   await page.getByTestId('existing-school-toggle').click(); await field('school-search').click(); await page.getByTestId('existing-school-10').waitFor(); await page.getByTestId('existing-school-more').click(); await page.waitForTimeout(350); await clickOption('existing-school-54');
   await page.getByTestId('admin-suggest-toggle-full_name').click(); await page.getByTestId('admin-suggest-full_name-54').waitFor();
   assert.equal(await page.getByTestId('admin-suggest-full_name-10').count(), 0);
   await field('full_name').fill('cham'); await page.waitForTimeout(320); await field('full_name').fill('Quản trị thử 54'); await page.getByTestId('admin-suggest-full_name-54').waitFor(); await page.waitForTimeout(750);
   await page.getByTestId('admin-suggest-full_name-54').waitFor();
   await field('full_name').fill('loi'); await page.getByText('Không tải được danh sách thử nghiệm', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Thử lại', exact: true }).click(); await page.getByText('Chưa có người phù hợp. Bạn có thể nhập thông tin để tạo tài khoản mới.', { exact: true }).waitFor();
   await field('full_name').fill('Quản trị viên mới'); await field('email').fill('created-admin@example.invalid'); await field('phone').fill('0900000002');
   await page.screenshot({ path: `${out}/${width}-new-person.png` });
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
   await page.getByTestId('form-submit').click(); await page.getByTestId('credential-username').waitFor(); assert.equal(posts.at(-1).body.school_id, 54); assert.equal(posts.at(-1).body.role, 'school_admin'); await close();
   await page.getByTestId('user-add').click(); await field('email').fill('created-admin@'); await clickOption('admin-suggest-email-1000');
   assert.equal(await field('full_name').inputValue(), 'Quản trị viên mới');
   assert.deepEqual(errors, []); results.push({ width, passed: true, posts: posts.length, apiSearches: calls.filter(p => p.includes('/users?')).length });
  } catch (e) { await page.screenshot({ path: `${out}/${width}-failure.png` }); throw e; }
  finally { await ctx.close(); }
 }
 fs.writeFileSync(out + '/results.json', JSON.stringify(results, null, 2)); console.log(JSON.stringify(results));
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
