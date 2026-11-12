// Xác thực hai lớp bằng mã email: mã hết hạn thì hiện nút "Gửi lại mã" (trang quản trị tổng và trang đăng nhập theo trường của quản trị trường).
// Hook đếm hạn chạy thật bằng cách biên dịch TypeScript với React giả và đồng hồ giả; hàm API và phần nối vào giao diện kiểm tra các mắt xích.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

/** Dựng hook trong môi trường giả: useState/useEffect tối giản, đồng hồ, bộ đếm giây và sự kiện visibilitychange do bài kiểm tra điều khiển */
function loadHook() {
  const out = ts.transpileModule(read('hooks', 'use-expired.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const env = { clock: 1_000_000, timers: new Map(), nextTimer: 1, listeners: new Set(), state: [], idx: 0, effect: null, deps: null, cleanup: null, pending: null };
  const react = {
    useState: (init) => {
      const i = env.idx++;
      if (!(i in env.state)) env.state[i] = init;
      return [env.state[i], (v) => { env.state[i] = typeof v === 'function' ? v(env.state[i]) : v; }];
    },
    useEffect: (fn, deps) => { env.pending = { fn, deps }; },
  };
  const sandbox = {
    require: (name) => { assert.equal(name, 'react'); return react; },
    exports: {},
    Date: { now: () => env.clock },
    setInterval: (fn) => { const id = env.nextTimer++; env.timers.set(id, fn); return id; },
    clearInterval: (id) => { env.timers.delete(id); },
    document: {
      addEventListener: (type, fn) => { assert.equal(type, 'visibilitychange'); env.listeners.add(fn); },
      removeEventListener: (type, fn) => { env.listeners.delete(fn); },
    },
  };
  vm.runInNewContext(out, sandbox);
  const { useExpired } = sandbox.exports;
  /** Một lần vẽ lại: chạy hook, rồi nếu khóa phụ thuộc đổi thì dọn hiệu ứng cũ và chạy hiệu ứng mới (như React) */
  const render = (key, seconds = 300) => {
    env.idx = 0;
    const value = useExpired(key, seconds);
    const { fn, deps } = env.pending;
    if (!env.deps || deps.some((d, i) => d !== env.deps[i])) {
      if (env.cleanup) env.cleanup();
      env.deps = deps;
      env.cleanup = fn() ?? null;
    }
    return value;
  };
  const tick = (seconds) => { env.clock += seconds * 1000; for (const fn of [...env.timers.values()]) fn(); };
  return { env, render, tick, unmount: () => { if (env.cleanup) env.cleanup(); } };
}

test('hook: chưa hết hạn trước 300 giây, hết hạn từ giây thứ 300; không có mã thì không đếm', () => {
  const h = loadHook();
  assert.equal(h.render(null), false);
  assert.equal(h.env.timers.size, 0, 'không có mã thì không chạy bộ đếm');
  assert.equal(h.render('phieu-1'), false);
  assert.equal(h.env.timers.size, 1);
  h.tick(299);
  assert.equal(h.render('phieu-1'), false);
  h.tick(1);
  assert.equal(h.render('phieu-1'), true);
  h.tick(60);
  assert.equal(h.render('phieu-1'), true);
});

test('hook: nhận mã mới (khóa đổi) thì đếm lại từ đầu; bỏ mã thì ngừng đếm', () => {
  const h = loadHook();
  h.render('phieu-1');
  h.tick(301);
  assert.equal(h.render('phieu-1'), true);
  assert.equal(h.render('phieu-2'), false, 'phiếu mới: chưa hết hạn ngay trong lần vẽ đầu, không nháy trạng thái hết hạn của phiếu cũ');
  assert.equal(h.env.timers.size, 1, 'bộ đếm cũ đã dọn');
  h.tick(200);
  assert.equal(h.render('phieu-2'), false);
  h.tick(101);
  assert.equal(h.render('phieu-2'), true);
  assert.equal(h.render(null), false);
  assert.equal(h.env.timers.size, 0);
});

test('hook: tab nền bị trình duyệt làm chậm bộ đếm thì vẫn báo đúng ngay khi tab hiện lại (visibilitychange)', () => {
  const h = loadHook();
  h.render('phieu-1');
  assert.equal(h.env.listeners.size, 1);
  h.env.clock += 6 * 60_000; // 6 phút trôi qua mà bộ đếm giây không chạy
  assert.equal(h.render('phieu-1'), false, 'chưa có sự kiện nào nên chưa cập nhật');
  for (const fn of [...h.env.listeners]) fn(); // người dùng quay lại tab
  assert.equal(h.render('phieu-1'), true);
});

test('hook: tháo giao diện thì dọn bộ đếm và bộ nghe sự kiện', () => {
  const h = loadHook();
  h.render('phieu-1');
  assert.equal(h.env.timers.size, 1);
  assert.equal(h.env.listeners.size, 1);
  h.unmount();
  assert.equal(h.env.timers.size, 0);
  assert.equal(h.env.listeners.size, 0);
});

test('API: gửi lại mã đi vào /api/auth/2fa/resend với phiếu và cổng, không kèm token đăng nhập', async () => {
  const api = read('api', 'authApi.ts');
  assert.match(api, /export const resendTwoFactor = \(challenge: string, portal: Portal\) => apiRequest<TwoFactorChallenge>\('\/api\/auth\/2fa\/resend', \{ body: \{ challenge, portal \} \}\);/);
  assert.doesNotMatch(api.slice(api.indexOf('export const resendTwoFactor')).split('\n')[0], /token/);
});

test('trang quản trị tổng: nút Gửi lại mã chỉ hiện khi mã email hết hạn, đổi sang phiếu mới và xóa ô mã; có thông báo', () => {
  const src = read('components', 'admin', 'AdminLogin.tsx');
  assert.match(src, /import \{ useExpired \} from '@\/hooks\/use-expired';/);
  assert.match(src, /useState<TwoFactorChallenge \| null>\(null\)/);
  assert.match(src, /const codeExpired = useExpired\(challenge\?\.method === 'email' \? challenge\.challenge : null, challenge\?\.expires_in \?\? 300\);/);
  assert.match(src, /const next = await authApi\.resendTwoFactor\(challenge\.challenge, portal\);\s*setChallenge\(next\);\s*setCode\(''\);\s*setResent\(true\);/);
  assert.match(src, /\{challenge\.method === 'email' && codeExpired \? <OutlineButton title=\{resending \? 'Đang gửi…' : 'Gửi lại mã'\}[\s\S]*?testID="login-2fa-resend" \/> : null\}/);
  assert.match(src, /Mã gửi qua email đã hết hạn \(quá 5 phút\)\. Bấm Gửi lại mã để nhận mã mới\./);
  // mã từ ứng dụng xác thực không có gì để gửi lại: nút chỉ cho phương thức email
  assert.equal([...src.matchAll(/challenge\.method === 'email' && codeExpired/g)].length, 2); // biểu ngữ hết hạn và nút
  // phiếu mới từ đăng nhập (mật khẩu hoặc Google) làm mới trạng thái "đã gửi lại"
  assert.equal([...src.matchAll(/setChallenge\(res\);\s*setResent\(false\);/g)].length, 2);
  // Xác nhận và Quay lại vẫn còn (mã dự phòng không hết hạn)
  assert.match(src, /testID="login-2fa-submit"/);
  assert.match(src, /<TextLink title="Quay lại" onPress=\{\(\) => \{ setChallenge\(null\); setCode\(''\); setError\(null\); setResent\(false\); \}\} \/>/);
});

test('trang đăng nhập theo trường (quản trị trường): cùng nút Gửi lại mã khi mã email hết hạn', () => {
  const src = read('components', 'school-login.tsx');
  assert.match(src, /import \{ useExpired \} from '@\/hooks\/use-expired';/);
  assert.match(src, /const codeExpired = useExpired\(challenge\?\.method === 'email' \? challenge\.challenge : null, challenge\?\.expires_in \?\? 300\);/);
  assert.match(src, /setChallenge\(await authApi\.resendTwoFactor\(challenge\.challenge, role\)\);\s*setCode\(''\);\s*setResent\(true\);/);
  assert.match(src, /\{challenge\.method === 'email' && codeExpired \? <Btn title=\{resending \? 'Đang gửi…' : 'Gửi lại mã'\}[\s\S]*?testID="school-2fa-resend" \/> : null\}/);
  assert.match(src, /setChallenge\(result\);\s*setResent\(false\);/);
});
