// HK.GV.071 – xuất báo cáo riêng cho từng bài tập (Excel, PDF). Thành phần dùng React Native nên không nạp được trong Node:
// đọc thẳng mã nguồn và kiểm tra các mắt xích nối nhau (giao diện → hàm gọi API → đường dẫn máy chủ).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const work = read('components', 'admin', 'ClassWork.tsx');
const api = read('api', 'classroomApi.ts');
const controller = path.join(__dirname, '..', '..', 'backend', 'src', 'classroom', 'classroom.controller.ts');

test('chi tiết bài tập có nút Xuất Excel và Xuất PDF gọi đúng hàm API', () => {
  assert.match(work, /DownloadButton title="Xuất Excel" fetchBlob=\{\(\) => api\.exportAssignment\(session\.token, id, 'xlsx'\)\} filename=\{`bai-tap-\$\{id\}\.xlsx`\}/);
  assert.match(work, /DownloadButton title="Xuất PDF" fetchBlob=\{\(\) => api\.exportAssignment\(session\.token, id, 'pdf'\)\} filename=\{`bai-tap-\$\{id\}\.pdf`\}/);
  assert.match(api, /export const exportAssignment = \(token: string, id: number, format: 'xlsx' \| 'pdf'\) => apiBlob\(`\$\{base\}\/assignments\/\$\{id\}\/export\$\{qs\(\{ format \}\)\}`, token\)/);
});

test('đường dẫn ở máy chủ khớp với hàm gọi API và chỉ giáo viên / quản trị trường dùng được', () => {
  if (!fs.existsSync(controller)) return;
  const src = fs.readFileSync(controller, 'utf8');
  assert.match(src, /@Get\('assignments\/:aid\/export'\) @Roles\(\.\.\.STAFF\)/);
});
