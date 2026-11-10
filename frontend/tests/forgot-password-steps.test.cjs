// Quên mật khẩu: nhập mã xác thực xong mới hiện ô đặt mật khẩu mới và nhập lại (quản trị tổng, quản trị trường, giáo viên, học sinh).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const between = (text, from, to) => {
  const a = text.indexOf(from);
  assert.ok(a >= 0, from);
  const b = text.indexOf(to, a + from.length);
  assert.ok(b > a, to);
  return text.slice(a, b);
};

test('quản trị tổng: màn nhập mã chỉ có ô mã; ô mật khẩu mới và nhập lại ở màn riêng dùng phiếu của bước nhập mã', () => {
  const src = read('components', 'admin', 'AdminLogin.tsx');
  assert.match(src, /type Step = 'login' \| 'forgot' \| 'reset' \| 'password';/);
  const code = between(src, 'const CodeForm:', 'const NewPasswordForm:');
  assert.match(code, /authApi\.verifyResetCode\(identifier, otp\)/);
  assert.match(code, /testID="reset-verify"/);
  assert.match(code, /nativeID="admin-otp"/);
  assert.doesNotMatch(code, /admin-new-password|admin-confirm-password|resetPassword/);
  const pw = between(src, 'const NewPasswordForm:', '// ---------------------------------------------------------------------- trang');
  assert.match(pw, /authApi\.resetPasswordWithTicket\(ticket, next\)/);
  assert.match(pw, /nativeID="admin-new-password"/);
  assert.match(pw, /nativeID="admin-confirm-password"/);
  assert.match(pw, /testID="reset-submit"/);
  assert.doesNotMatch(pw, /admin-otp|verifyResetCode/);
  // màn đổi mật khẩu chỉ mở khi đã có phiếu
  assert.match(src, /onVerified=\{\(t\) => \{\s*setTicket\(t\);\s*setView\('password'\);/);
  assert.match(src, /\{view === 'password' && \(\s*<NewPasswordForm\s+ticket=\{ticket\}/);
});

test('giáo viên, học sinh, quản trị trường: hộp Quên mật khẩu có ba bước ask, code, password; ô mật khẩu chỉ ở bước cuối', () => {
  const src = read('components', 'auth.tsx');
  const sheet = between(src, 'const ForgotPasswordSheet:', '// ----------------------------------------------------------------------');
  assert.match(sheet, /useState<'ask' \| 'code' \| 'password'>\('ask'\)/);
  assert.match(sheet, /authApi\.verifyResetCode\(identifier\.trim\(\), otp\)/);
  assert.match(sheet, /setStep\('password'\)/);
  assert.match(sheet, /authApi\.resetPasswordWithTicket\(ticket, next\)/);
  assert.doesNotMatch(sheet, /authApi\.resetPassword\(/);
  assert.match(sheet, /testID="forgot-verify"/);
  // mỗi ô chỉ nằm đúng một nhánh: mã ở nhánh code, mật khẩu mới và nhập lại ở nhánh cuối
  const body = sheet.slice(sheet.indexOf("{step === 'ask' ? ("));
  const codeStart = body.indexOf(") : step === 'code' ? (");
  assert.ok(codeStart > 0);
  const passwordStart = body.indexOf(') : (', codeStart);
  assert.ok(passwordStart > codeStart);
  const codeBranch = body.slice(codeStart, passwordStart);
  assert.match(codeBranch, /forgot-otp/);
  assert.doesNotMatch(codeBranch, /forgot-new|forgot-confirm/);
  const passwordBranch = body.slice(passwordStart);
  assert.match(passwordBranch, /forgot-new/);
  assert.match(passwordBranch, /forgot-confirm/);
  assert.doesNotMatch(passwordBranch, /forgot-otp/);
});

test('không còn nơi nào trong giao diện gọi đặt mật khẩu một bước kèm mã; API có hàm cho hai bước mới', () => {
  const files = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.tsx?$/.test(e.name)) files.push(f);
    }
  };
  walk(path.join(root, 'components'));
  walk(path.join(root, 'app'));
  const users = files.filter((f) => /\.resetPassword\(/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(users.map((f) => path.relative(root, f)), []);
  const api = read('api', 'authApi.ts');
  assert.match(api, /'\/api\/auth\/verify-reset-code'/);
  assert.match(api, /reset_token: resetToken, new_password: newPassword/);
});
