const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/dashboard-trend.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new vm.Script(`(function(module,exports){${compiled}\n})`).runInThisContext()(loaded, loaded.exports);
const { rollingAverage, alignActivity, calendarBuckets } = loaded.exports;

test('trung bình 7 ngày tính cả ngày 0; chưa đủ lịch sử thì không vẽ thành số 0 giả', () => {
  assert.deepEqual(rollingAverage([7, 0, 0, 0, 0, 0, 0, 7, 7]), [null, null, null, null, null, null, 1, 1, 2]);
  assert.deepEqual(rollingAverage([1, 2, 3, 4, 5, 6, 7, 8]), [null, null, null, null, null, null, 4, 5]);
  // Chọn 7 ngày cuối vẫn dùng lịch sử trước kỳ lọc, không tính lại chỉ trên 7 điểm đang hiện.
  const trend = rollingAverage(Array.from({ length: 30 }, (_, i) => i + 1));
  assert.deepEqual(trend.slice(-7), [21, 22, 23, 24, 25, 26, 27]);
});

test('lịch biểu đồ khớp cửa sổ API: tuần bắt đầu thứ hai, giữ tháng/năm và ngày nhuận', () => {
  assert.deepEqual(calendarBuckets('2026-01-04', 'week', 7), ['2025-12-22', '2025-12-29']);
  assert.deepEqual(calendarBuckets('2024-03-01', 'day', 2), ['2024-02-28', '2024-02-29', '2024-03-01']);
  assert.deepEqual(calendarBuckets('2026-01-01', 'month', 7), ['2025-12', '2026-01']);
  assert.deepEqual(calendarBuckets(undefined, 'day', 30), []);
});

test('căn hoạt động theo lịch máy chủ: giữ ngày trống, không lấy hoạt động ngoài kỳ và không phụ thuộc thứ tự API', () => {
  const dates = ['2026-10-31', '2026-11-01', '2026-11-02'];
  assert.deepEqual(alignActivity(dates, [
    { bucket: '2026-11-02', lessons: 2 }, { bucket: '2026-10-30', lessons: 99 }, { bucket: '2026-10-31', lessons: 4 },
  ]), [{ bucket: '2026-10-31', lessons: 4 }, null, { bucket: '2026-11-02', lessons: 2 }]);
});
