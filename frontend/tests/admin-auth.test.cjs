const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function loadAuth({ baseUrl = 'https://api.example.test/', respond = () => ({}) } = {}) {
  const modules = new Map();
  const requests = [];
  const fetchMock = async (url, options) => {
    requests.push({ url, ...options });
    const reply = await respond(url, options);
    return { ok: (reply.status ?? 200) < 400, status: reply.status ?? 200, json: async () => reply.body ?? reply };
  };
  const load = name => {
    if (modules.has(name)) return modules.get(name).exports;
    const file = path.join(__dirname, '..', name.replace('@/', '') + '.ts');
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    modules.set(name, module);
    const run = new vm.Script(`(function(require,module,exports,process,fetch,AbortController,setTimeout,clearTimeout){${compiled}\n})`, { filename: file }).runInThisContext();
    run(load, module, module.exports, { env: { EXPO_PUBLIC_API_URL: baseUrl } }, fetchMock, AbortController, setTimeout, clearTimeout);
    return module.exports;
  };
  return { auth: load('@/api/authApi'), client: load('@/api/client'), requests };
}

const rootUser = { id: 1, username: 'test-root', full_name: 'Test Root', role: 'root_admin', must_change_password: false };
const rootSession = { token: 'test-token', user: rootUser };

test('Không gửi thông tin đăng nhập khi chưa cấu hình địa chỉ API', async () => {
  const { auth, requests } = loadAuth({ baseUrl: '' });
  await assert.rejects(auth.loginToPortal('test-root', 'test-password', 'root_admin'), error => error.status === 0);
  assert.equal(requests.length, 0);
});

test('Đăng nhập gửi đúng cổng quản trị tổng và giữ mật khẩu trong body', async () => {
  const { auth, requests } = loadAuth({ respond: () => rootSession });
  assert.deepEqual(await auth.loginToPortal('test-root', 'test-password', 'root_admin'), rootSession);
  assert.equal(requests[0].url, 'https://api.example.test/api/auth/login');
  assert.equal(requests[0].method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].body), { username: 'test-root', password: 'test-password', portal: 'root_admin' });
});

test('Từ chối phiên của vai trò khác và phản hồi thiếu token', async () => {
  const wrongRole = loadAuth({ respond: () => ({ token: 'test-token', user: { ...rootUser, role: 'teacher' } }) });
  await assert.rejects(wrongRole.auth.loginToPortal('test-user', 'test-password', 'root_admin'), error => error.status === 403);
  const missingToken = loadAuth({ respond: () => ({ user: rootUser }) });
  await assert.rejects(missingToken.auth.loginToPortal('test-root', 'test-password', 'root_admin'), error => error.status === 502);
});

test('Khôi phục phiên kiểm tra vai trò trên máy chủ và gửi token trong header', async () => {
  const { auth, requests } = loadAuth({ respond: () => rootUser });
  assert.deepEqual(await auth.getMe('test-token'), rootUser);
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].headers.Authorization, 'Bearer test-token');
  assert.equal(requests[0].url.includes('test-token'), false);
});

test('Quên mật khẩu và đặt lại bằng OTP dùng đúng API', async () => {
  const { auth, requests } = loadAuth({ respond: () => ({ ok: true }) });
  await auth.requestPasswordReset('test-root');
  await auth.resetPassword('test-root', '123456', 'new-test-password1');
  assert.equal(requests[0].url, 'https://api.example.test/api/auth/forgot-password');
  assert.deepEqual(JSON.parse(requests[0].body), { identifier: 'test-root' });
  assert.deepEqual(JSON.parse(requests[1].body), { identifier: 'test-root', otp: '123456', new_password: 'new-test-password1' });
  assert.equal(requests[1].headers.Authorization, undefined);
});

test('Đổi mật khẩu nhận phiên mới và đăng xuất thu hồi đúng phiên', async () => {
  const { auth, requests } = loadAuth({ respond: () => rootSession });
  await auth.changePassword('test-token', 'old-test-password', 'new-test-password1');
  await auth.logout('test-token');
  assert.deepEqual(JSON.parse(requests[0].body), { current_password: 'old-test-password', new_password: 'new-test-password1' });
  assert.equal(requests[0].headers.Authorization, 'Bearer test-token');
  assert.equal(requests[1].url, 'https://api.example.test/api/auth/logout');
  assert.equal(requests[1].method, 'POST');
  assert.deepEqual(JSON.parse(requests[1].body), {});
});

test('Hiển thị lỗi xác thực và lỗi mất kết nối', async () => {
  const invalid = loadAuth({ respond: () => ({ status: 401, body: { detail: 'Thông tin đăng nhập chưa đúng.' } }) });
  await assert.rejects(invalid.auth.loginToPortal('test-root', 'invalid', 'root_admin'), error => error.status === 401 && error.message === 'Thông tin đăng nhập chưa đúng.');
  const offline = loadAuth({ respond: () => { throw new Error('offline'); } });
  await assert.rejects(offline.auth.getMe('test-token'), error => error.status === 0);
});
