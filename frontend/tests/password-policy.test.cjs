const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

function load(file) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new vm.Script(`(function(module,exports){${source}\n})`, { filename: file }).runInThisContext()(module, module.exports);
  return module.exports;
}
const front = load(path.join(__dirname, '../lib/password-policy.ts'));
const back = load(path.join(__dirname, '../../backend/src/auth/password-policy.ts'));

test('Client and API enforce the same new-password requirements and Bcrypt byte limit', () => {
  const valid = ['Abcdefghij1!', 'Mật khẩu @123', 'LịchSửĐôngA2026!', 'Long phrase with space 1!', 'Ab1!' + 'x'.repeat(68), 'Áá' + 'á'.repeat(33) + '1!'];
  const invalid = ['', 'Aa1!aaaaaaa', 'abcdefghijk1!', 'ABCDEFGHIJK1!', 'Abcdefghijkl!', 'Abcdefghijk12', 'Abcdefghijk1 ', 'Abcdefghij1!\u0000', 'Ab1!' + 'x'.repeat(69), 'Áá' + 'á'.repeat(34) + '1!'];
  assert.equal(front.PASSWORD_MESSAGE, back.PASSWORD_MESSAGE);
  for (const password of [...valid, ...invalid]) {
    const acceptedByApi = back.PASSWORD_POLICY.test(password) && Buffer.byteLength(password, 'utf8') <= 72;
    assert.equal(front.newPasswordError(password) === null, acceptedByApi);
    assert.equal(acceptedByApi, valid.includes(password));
  }
  assert.match(front.newPasswordError(invalid.at(-1)), /72 byte UTF-8/);
});
