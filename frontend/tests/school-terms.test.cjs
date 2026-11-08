// Năm học và hai học kỳ của trường: gợi ý ngày theo khung kế hoạch thời gian năm học của Bộ GD&ĐT (Quyết định 2308/QĐ-BGDĐT ngày 6/8/2026: khai giảng 5/9,
// học kỳ I 18 tuần kết thúc trước 18/1, học kỳ II 17 tuần, kết thúc năm học trước 31/5), kiểm tra ngày, học kỳ đang diễn ra và lời khuyên. Phần tính toán chạy thật.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const compiled = ts.transpileModule(read('lib', 'school-terms.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new vm.Script(`(function(module,exports){${compiled}\n})`).runInThisContext()(mod, mod.exports);
const { suggestTerms, checkTerms, calendarWeeks, fmtDay, todayVn, labelForDate, nextLabel, isYearLabel, isIsoDate, phaseOf, phaseText, yearAdvice, hasTerms, weekdayOf, addDays, TERM_FRAMEWORK } = mod.exports;

test('gợi ý ngày: khai giảng 5/9, học kỳ 1 hết vào thứ bảy cuối cùng trước 18/1, học kỳ 2 bắt đầu thứ hai kế tiếp, năm học hết 31/5', () => {
  assert.deepEqual(suggestTerms('2026-2027'), { starts_on: '2026-09-05', ends_on: '2027-05-31', term1_starts_on: '2026-09-05', term1_ends_on: '2027-01-16', term2_starts_on: '2027-01-18', term2_ends_on: '2027-05-31' });
  // đúng với TP.HCM năm 2025-2026: học kỳ 2 bắt đầu 19/1/2026 (thứ hai)
  const hcm = suggestTerms('2025-2026');
  assert.equal(hcm.term1_ends_on, '2026-01-17');
  assert.equal(hcm.term2_starts_on, '2026-01-19');
  assert.equal(weekdayOf(hcm.term1_ends_on), 6, 'học kỳ 1 kết thúc vào thứ bảy');
  assert.equal(weekdayOf(hcm.term2_starts_on), 1, 'học kỳ 2 bắt đầu vào thứ hai');
  // nhiều năm liên tiếp: học kỳ 1 luôn kết thúc không muộn hơn 17/1 và là thứ bảy, học kỳ 2 là thứ hai kế tiếp
  for (let y = 2026; y <= 2040; y += 1) {
    const s = suggestTerms(`${y}-${y + 1}`);
    assert.ok(s.term1_ends_on <= `${y + 1}-01-17` && s.term1_ends_on >= `${y + 1}-01-11`, `${y}: ${s.term1_ends_on}`);
    assert.equal(weekdayOf(s.term1_ends_on), 6);
    assert.equal(weekdayOf(s.term2_starts_on), 1);
    assert.equal(s.term1_starts_on, `${y}-09-05`);
    assert.equal(s.term2_ends_on, `${y + 1}-05-31`);
    assert.equal(checkTerms(s).error, null);
  }
  // tên năm học sai: không gợi ý; ngày năm học đang có được giữ nguyên
  for (const bad of ['', '2026', '2026-2028', 'abcd-efgh', '2026/2027']) assert.equal(suggestTerms(bad), null, bad);
  assert.deepEqual(suggestTerms('2026-2027', { starts_on: '2026-09-07', ends_on: '2027-05-28' }), { starts_on: '2026-09-07', ends_on: '2027-05-28', term1_starts_on: '2026-09-07', term1_ends_on: '2027-01-16', term2_starts_on: '2027-01-18', term2_ends_on: '2027-05-28' });
});

test('số tuần theo lịch, ngày hợp lệ, định dạng và múi giờ Việt Nam', () => {
  assert.equal(calendarWeeks('2026-09-05', '2027-01-16'), 20);
  assert.equal(calendarWeeks('2027-01-18', '2027-05-31'), 20);
  assert.equal(calendarWeeks('2026-09-05', '2026-09-11'), 1);
  assert.equal(calendarWeeks('2026-09-05', '2026-09-12'), 2);
  assert.equal(fmtDay('2026-09-05'), '05/09/2026');
  assert.equal(fmtDay(null), '—');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('2028-02-29'), true);
  assert.equal(isIsoDate('26-09-05'), false);
  // 17h UTC ngày 31/12 đã là 0h ngày 1/1 giờ Việt Nam
  assert.equal(todayVn(Date.UTC(2026, 11, 31, 17, 0, 0)), '2027-01-01');
  assert.equal(todayVn(Date.UTC(2026, 10, 8, 3, 0, 0)), '2026-11-08');
});

test('tên năm học: nhận dạng, năm học của thời điểm hiện tại, năm học kế tiếp', () => {
  assert.equal(isYearLabel('2026-2027'), true);
  assert.equal(isYearLabel(' 2026-2027 '), true);
  assert.equal(isYearLabel('2026-2028'), false);
  assert.equal(labelForDate('2026-11-08'), '2026-2027');
  assert.equal(labelForDate('2027-03-01'), '2026-2027');
  assert.equal(labelForDate('2027-07-31'), '2026-2027');
  assert.equal(labelForDate('2027-08-01'), '2027-2028');
  assert.equal(nextLabel('2026-2027'), '2027-2028');
});

test('kiểm tra học kỳ cùng quy tắc với máy chủ, cảnh báo khi lệch khung của Bộ nhưng không chặn', () => {
  const ok = { starts_on: '2026-09-05', ends_on: '2027-05-31', term1_starts_on: '2026-09-05', term1_ends_on: '2027-01-16', term2_starts_on: '2027-01-18', term2_ends_on: '2027-05-31' };
  assert.deepEqual(checkTerms(ok), { error: null, warnings: [] });
  // để trống cả bốn ô là hợp lệ (chưa đặt học kỳ)
  assert.equal(checkTerms({ ...ok, term1_starts_on: '', term1_ends_on: '', term2_starts_on: '', term2_ends_on: '' }).error, null);
  const errors = [
    [{ term1_starts_on: '' }, /đủ ngày/],
    [{ term1_starts_on: '2026-09-01' }, /từ ngày bắt đầu năm học/],
    [{ term1_ends_on: '2026-09-01' }, /Học kỳ 1 phải kết thúc sau/],
    [{ term2_starts_on: '2027-01-16' }, /sau khi học kỳ 1 kết thúc/],
    [{ term2_ends_on: '2027-06-15' }, /kết thúc trước hoặc đúng ngày kết thúc năm học/],
    [{ term1_ends_on: '16/01/2027' }, /không đúng dạng/],
    [{ ends_on: '2026-09-01' }, /trước ngày kết thúc/],
  ];
  for (const [patch, re] of errors) assert.match(checkTerms({ ...ok, ...patch }).error, re, JSON.stringify(patch));
  // cảnh báo (không chặn): học kỳ 1 quá ngắn, học kỳ 1 hết sau 17/1, năm học hết sau 31/5
  const short = checkTerms({ ...ok, term1_ends_on: '2026-12-05', term2_starts_on: '2026-12-07' });
  assert.equal(short.error, null);
  assert.ok(short.warnings.some((w) => /Học kỳ 1 chỉ có \d+ tuần/.test(w)));
  const late = checkTerms({ ...ok, term1_ends_on: '2027-01-30', term2_starts_on: '2027-02-01' });
  assert.ok(late.warnings.some((w) => /trước ngày 18\/1/.test(w)));
  const lateEnd = checkTerms({ ...ok, ends_on: '2027-06-20', term2_ends_on: '2027-06-15' });
  assert.ok(lateEnd.warnings.some((w) => /trước ngày 31\/5/.test(w)));
});

test('năm học đang ở đâu so với hôm nay: chưa bắt đầu, học kỳ 1 hoặc 2 (tuần thứ mấy), hết, chưa đặt học kỳ', () => {
  const y = { starts_on: '2026-09-05', ends_on: '2027-05-31', term1_starts_on: '2026-09-05', term1_ends_on: '2027-01-16', term2_starts_on: '2027-01-18', term2_ends_on: '2027-05-31' };
  assert.deepEqual(phaseOf(y, '2026-08-25'), { kind: 'before', daysUntil: 11 });
  assert.deepEqual(phaseOf(y, '2026-09-05'), { kind: 'term', term: 1, week: 1, weeks: 20, daysLeft: 133 });
  assert.equal(phaseText(y, '2026-11-08'), 'Đang học kỳ 1 · tuần 10/20');
  assert.equal(phaseText(y, '2027-01-17'), 'Nghỉ giữa hai học kỳ · còn 1 ngày');
  assert.equal(phaseText(y, '2027-03-01'), 'Đang học kỳ 2 · tuần 7/20');
  assert.equal(phaseText(y, '2027-05-31').startsWith('Đang học kỳ 2'), true);
  assert.equal(phaseText(y, '2027-06-01'), 'Đã qua ngày kết thúc năm học');
  assert.equal(phaseText({ ...y, term1_starts_on: null }, '2026-11-08'), null);
  assert.equal(hasTerms(y), true);
  assert.equal(hasTerms({ ...y, term2_ends_on: null }), false);
});

test('lời khuyên: kết thúc năm học đã hết hạn, đặt học kỳ cho năm chưa có, tạo năm học của thời điểm hiện tại', () => {
  const none = { term1_starts_on: null, term1_ends_on: null, term2_starts_on: null, term2_ends_on: null };
  const full = { term1_starts_on: '2026-09-05', term1_ends_on: '2027-01-16', term2_starts_on: '2027-01-18', term2_ends_on: '2027-05-31' };
  const y = (id, label, status, extra = {}) => ({ id, label, status, starts_on: `${label.slice(0, 4)}-09-05`, ends_on: `${label.slice(5)}-05-31`, ...none, ...extra });
  // đúng như ảnh người dùng gửi: chỉ có năm học 2025-2026 đã kết thúc, hôm nay 8/11/2026 -> gợi ý tạo năm học 2026-2027
  assert.deepEqual(yearAdvice([y(1, '2025-2026', 'ended')], '2026-11-08'), [{ kind: 'create', label: '2026-2027' }]);
  // năm học hiện tại có đủ học kỳ: không cần khuyên gì
  assert.deepEqual(yearAdvice([y(2, '2026-2027', 'active', full)], '2026-11-08'), []);
  // năm học đang hoạt động chưa có học kỳ: khuyên đặt học kỳ
  assert.deepEqual(yearAdvice([y(2, '2026-2027', 'active')], '2026-11-08').map((a) => a.kind), ['terms']);
  // năm học đang hoạt động đã qua ngày kết thúc: khuyên kết thúc, và tạo năm học mới của thời điểm hiện tại
  assert.deepEqual(yearAdvice([y(3, '2025-2026', 'active', { ...full })], '2026-11-08').map((a) => a.kind), ['end', 'create']);
  // năm học đã kết thúc không bị khuyên đặt học kỳ (không sửa được nữa)
  assert.deepEqual(yearAdvice([y(4, '2026-2027', 'ended')], '2026-11-08'), []);
  assert.equal(TERM_FRAMEWORK.term1Weeks + TERM_FRAMEWORK.term2Weeks, 35);
});

test('giao diện: bảng năm học có cột Học kỳ 1, Học kỳ 2 và trạng thái theo thời gian; lời khuyên; biểu mẫu tự điền; trang trường gọi SchoolYears', () => {
  const years = read('components', 'admin', 'SchoolYears.tsx');
  assert.match(years, /\{ key: 'term1', label: 'Học kỳ 1'/);
  assert.match(years, /\{ key: 'term2', label: 'Học kỳ 2'/);
  assert.match(years, /phaseText\(y, today\)/);
  assert.match(years, /const advice = yearAdvice\(years, today\);/);
  for (const id of ['year-add', 'year-advice-${a.kind}', 'terms-suggest', 'terms-clear', 'terms-check']) assert.ok(years.includes(id), id);
  for (const field of ['term1_starts_on', 'term1_ends_on', 'term2_starts_on', 'term2_ends_on']) assert.ok(years.includes(`name: '${field}'`) || years.includes('TERM_KEYS'), field);
  // biểu mẫu chặn học kỳ sai trước khi gửi và gửi cả bốn ngày (null khi xóa học kỳ)
  assert.match(years, /const check = checkTerms\(body\);\s+if \(check\.error\) throw new Error\(check\.error\);/);
  assert.match(years, /\[key, str\(v, key\) \|\| null\]/);
  const school = read('components', 'admin', 'SchoolAdmin.tsx');
  assert.match(school, /<SchoolYears session=\{session\} years=\{years\} onSelect=\{setSelected\} onChanged=\{onChanged\} \/>/);
  assert.match(school, /\['Năm học hiện tại', school\.current_year \? \[school\.current_year\.label, phaseText\(school\.current_year, todayVn\(\)\)\]/);
  const api = read('api', 'adminApi.ts');
  assert.match(api, /type YearTerms = Partial<Record<'term1_starts_on' \| 'term1_ends_on' \| 'term2_starts_on' \| 'term2_ends_on', string \| null>>;/);
  // máy chủ và CSDL: ràng buộc học kỳ, migration 050
  const migration = path.join(root, '..', 'database', 'migrations', '050_school_year_terms.sql');
  if (fs.existsSync(migration)) {
    const sql = fs.readFileSync(migration, 'utf8');
    for (const col of ['term1_starts_on', 'term1_ends_on', 'term2_starts_on', 'term2_ends_on']) assert.ok(sql.includes(`ADD COLUMN IF NOT EXISTS ${col} DATE`), col);
    assert.match(sql, /app_school_years_terms_ok CHECK/);
    assert.doesNotMatch(sql, /\b(BEGIN|COMMIT|ROLLBACK)\b/);
  }
});
