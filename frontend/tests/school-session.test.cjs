const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), test = require('node:test'), ts = require('typescript');
function load(name, dependencies, extra = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, extra)(key => dependencies[key], module, module.exports);
  return module.exports;
}
test('phiên riêng theo vai trò và trường: lưu/đổi/xóa một phiên không chạm phiên của trường khác hoặc quản lý tổng', async () => {
  const map = new Map(), store = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
  const storage = load('lib/storage', { 'react-native': { Platform: { OS: 'web' } }, 'expo-secure-store': {} }, { window: { localStorage: store, sessionStorage: store } });
  await storage.saveToken('school_admin', 'one', '00000001');
  await storage.saveToken('school_admin', 'two', '00000002');
  await storage.saveToken('teacher', 'teacher', '00000001');
  await storage.saveToken('root_admin', 'root');
  await storage.saveToken('school_admin', 'changed', '00000001');
  assert.equal(await storage.readToken('school_admin', '00000001'), 'changed');
  await storage.saveToken('school_admin', null, '00000001');
  assert.equal(await storage.readToken('school_admin', '00000001'), null);
  assert.equal(await storage.readToken('school_admin', '00000002'), 'two');
  assert.equal(await storage.readToken('teacher', '00000001'), 'teacher');
  assert.equal(await storage.readToken('root_admin'), 'root');
});
test('đường dẫn sau đăng nhập lấy tên/khu vực mới từ máy chủ, giữ vai trò và lưu phiên đúng trường', async () => {
  const saved = [], calls = [];
  const school = { school_code: '00000001', slug: 'donga_00000001_tenmoi_phuongmoi' };
  class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
  const links = load('lib/school-link', {});
  const portals = load('lib/school-portal', {});
  const session = load('lib/school-session', {
    '@/api/authApi': { getSchoolLink: async slug => { calls.push(slug); return school; } }, '@/api/client': { ApiError },
    '@/lib/school-link': links, '@/lib/school-portal': portals, '@/lib/storage': { saveToken: async (...args) => saved.push(args) },
  });
  for (const role of ['school_admin', 'teacher', 'student']) {
    assert.equal(await session.schoolSessionPath('fixture', { role, school_code: '00000001' }), `/${school.slug}?role=${role}`);
    assert.deepEqual(saved.at(-1), [role, 'fixture', '00000001']);
  }
  assert.equal(await session.schoolSessionPath('root', { role: 'root_admin' }), '/admin');
  assert.equal(await session.schoolSessionPath('student', { role: 'student', school_code: null }), '/hoc-sinh');
  assert.equal(calls.length, 3);
  school.school_code = '00000002';
  await assert.rejects(session.schoolSessionPath('fixture', { role: 'school_admin', school_code: '00000001' }), e => e.status === 502);
});
