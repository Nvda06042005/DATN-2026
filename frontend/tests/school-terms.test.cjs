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
const { fmtDay, todayVn, labelForDate, phaseText } = mod.exports;

test('định dạng và năm học theo giờ Việt Nam', () => {
  assert.equal(fmtDay('2027-01-18'), '18/01/2027');
  assert.equal(fmtDay(null), '—');
  assert.equal(todayVn(Date.UTC(2026, 11, 31, 17)), '2027-01-01');
  for (const [date, label] of [['2027-03-01', '2026-2027'], ['2027-07-31', '2026-2027'], ['2027-08-01', '2027-2028']]) assert.equal(labelForDate(date), label);
});

test('trạng thái không biến tuần lịch thành tuần thực học; phân biệt khung quốc gia và lịch riêng', () => {
  const y = { starts_on: '2026-09-05', ends_on: '2027-05-30', term1_starts_on: '2026-09-05', term1_ends_on: '2027-01-17', term2_starts_on: '2027-01-18', term2_ends_on: '2027-05-30', calendar_mode: 'national' };
  assert.equal(phaseText(y, '2026-08-25'), 'Chưa đến học kỳ 1');
  assert.equal(phaseText(y, '2026-11-08'), 'Trong khung học kỳ 1');
  assert.equal(phaseText(y, '2027-01-18'), 'Trong khung học kỳ 2');
  assert.equal(phaseText(y, '2027-05-31'), 'Đã qua ngày kết thúc năm học');
  assert.equal(phaseText({ ...y, calendar_mode: 'manual' }, '2026-11-08'), 'Đang học kỳ 1');
  assert.equal(phaseText({ ...y, term1_starts_on: null }, '2026-11-08'), null);
  assert.equal(phaseText({ ...y, term2_ends_on: '2027-05-24' }, '2027-05-25'), 'Đã hết khung học kỳ 2');
  for (const date of ['2026-11-08', '2027-03-01']) assert.doesNotMatch(phaseText(y, date), /tuần|20/);
});

test('18/11/2026: năm học tự nhập (chữ) và chọn ngày năm học, hai học kỳ trên lịch; bỏ tự lấy khung Bộ / Sở; nút gạt trạng thái, cột Bắt đầu lúc, lọc mọi cột', () => {
  const years = read('components', 'admin', 'SchoolYears.tsx');
  assert.match(years, /\{ name: 'label', label: 'Năm học', required: true, placeholder: 'Ví dụ 2027-2028'/);
  assert.doesNotMatch(years, /type: 'select'|schoolYearOptions|calendar_mode: 'national'/);
  assert.match(years, /calendar_mode: 'manual' as const/);
  for (const k of ['starts_on', 'ends_on', 'term1_starts_on', 'term1_ends_on', 'term2_starts_on', 'term2_ends_on']) assert.match(years, new RegExp(`name: '${k}', label: '[^']+', type: 'date', calendar: true, required: true`), k);
  assert.doesNotMatch(years, /TermsAssist|TermsCheck|yearAdvice|suggestTerms|calendarWeeks|Điền theo gợi ý|Xóa học kỳ|Đặt học kỳ theo gợi ý/);
  assert.match(years, /<Switch value=\{y\.status === 'active'\} disabled=\{y\.status === 'ended'\}/);
  assert.match(years, /label: 'Bắt đầu lúc'[^\n]*y\.activated_at/);
  for (const f of ['f_label', 'f_term1', 'f_term2', 'f_status', 'f_classes', 'f_activated', 'f_ended']) assert.match(years, new RegExp(`filter: ${f},`), f);
  assert.match(years, /phaseText\(y, today\)/);
  assert.doesNotMatch(read('lib', 'school-terms.ts'), /suggestTerms|calendarWeeks|TERM_FRAMEWORK|yearAdvice/);
});