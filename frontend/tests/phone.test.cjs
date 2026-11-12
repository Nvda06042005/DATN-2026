// Số điện thoại của quản trị tổng, quản trị viên trường, giáo viên và học sinh: đúng 10 chữ số, có cảnh báo dưới ô.
// Logic thuần (lib/phone.ts) chạy thật bằng cách biên dịch TypeScript; thành phần React Native kiểm tra các mắt xích nối nhau.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

function loadPhone() {
  const out = ts.transpileModule(read('lib', 'phone.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(out, { module: mod, exports: mod.exports });
  return mod.exports;
}

test('làm sạch số điện thoại: chỉ giữ chữ số, tối đa 10; số cũ đủ 10 chữ số được chuẩn hóa, số lạ giữ nguyên', () => {
  const { cleanPhone, normalizePhone, PHONE_LENGTH } = loadPhone();
  assert.equal(PHONE_LENGTH, 10);
  assert.equal(cleanPhone('0901 234 567'), '0901234567');
  assert.equal(cleanPhone('(090) 123-4567'), '0901234567');
  assert.equal(cleanPhone('09012345678999'), '0901234567'); // gõ hoặc dán thừa thì bỏ phần thừa
  assert.equal(cleanPhone('abc'), '');
  assert.equal(cleanPhone(null), '');
  assert.equal(cleanPhone(undefined), '');
  assert.match(cleanPhone('+84 901 234 567 89'), /^\d{10}$/);
  assert.equal(normalizePhone('0901 234 567'), '0901234567');
  assert.equal(normalizePhone('0901234567'), '0901234567');
  assert.equal(normalizePhone('0901 234 5678'), '0901 234 5678'); // 11 chữ số: không tự cắt, để người dùng thấy cảnh báo và sửa
  assert.equal(normalizePhone('12345'), '12345');
  assert.equal(normalizePhone(null), '');
});

test('cảnh báo dưới ô: thiếu chữ số, có ký tự lạ, gõ thừa; đủ 10 chữ số hoặc để trống thì không cảnh báo', () => {
  const { phoneWarning, phoneError } = loadPhone();
  assert.equal(phoneWarning(''), null);
  assert.equal(phoneWarning('0901234567'), null);
  assert.match(phoneWarning('09012'), /đúng 10 chữ số \(đang có 5\)/);
  assert.match(phoneWarning('0901 234'), /không dấu cách hay ký hiệu/);
  assert.match(phoneWarning('0901234567', true), /chỉ gồm 10 chữ số; phần thừa đã bị bỏ/);
  assert.equal(phoneError(''), null);
  assert.equal(phoneError(null), null);
  assert.equal(phoneError('0901234567'), null);
  for (const bad of ['090123456', '09012345678', '0901 234 567', '+84901234567', 'abcdefghij']) assert.match(phoneError(bad), /đúng 10 chữ số/);
});

test('mọi ô số điện thoại của bốn vai trò dùng ô có giới hạn 10 chữ số; điện thoại liên hệ của trường không bị giới hạn', () => {
  const ui = read('components', 'ui.tsx');
  assert.match(ui, /export const PhoneField: React\.FC</);
  assert.match(ui, /keyboardType="phone-pad"/);
  assert.match(ui, /onChange\(cleanPhone\(text\)\)/);
  assert.match(ui, /error=\{error \?\? phoneWarning\(value, overflow\)\}/);
  assert.doesNotMatch(ui.slice(ui.indexOf('export const PhoneField'), ui.indexOf('thông báo nhanh')), /maxLength=/); // maxLength cắt chuỗi dán trước khi bỏ dấu cách
  // biểu mẫu dùng chung: loại ô phone hiện PhoneField, làm sạch số cũ lúc mở, chặn lưu khi sai
  const kit = read('components', 'admin', 'kit.tsx');
  assert.match(kit, /type\?: 'text' \| 'email' \| 'tel' \| 'phone' \|/);
  assert.match(kit, /if \(def\.type === 'phone'\) return <PhoneField /);
  assert.match(kit, /f\.type === 'phone' \? normalizePhone\(/);
  assert.match(kit, /\(f\.type === 'phone' \? phoneError\(String\(values\[f\.name\] \?\? ''\)\) : null\)\)\.find\(Boolean\)/);
  // giáo viên và học sinh (thêm từng người), sửa tài khoản mọi vai trò, quản trị viên đầu tiên của trường
  const people = read('components', 'admin', 'SchoolPeople.tsx');
  assert.equal([...people.matchAll(/name: 'phone', label: 'SĐT', type: 'phone'/g)].length, 1); // một ô dùng chung cho giáo viên, học sinh (personFields)
  assert.doesNotMatch(people, /name: 'phone'[^}]*type: 'tel'/);
  assert.match(read('components', 'admin', 'AccountSheet.tsx'), /name: 'phone', label: 'Số điện thoại', type: 'phone'/);
  assert.match(read('components', 'admin', 'RootAdmin.tsx'), /name: 'admin_phone', label: 'Điện thoại', type: 'phone', required: true/);
  // hộp Tạo tài khoản quản trị: đúng 10 chữ số mới gửi
  const sheet = read('components', 'admin', 'CreateSchoolAdminSheet.tsx');
  assert.match(sheet, /<PhoneField label="Số điện thoại \*" nativeID="field-phone" value=\{phone\} onChange=\{setPhone\}/);
  assert.ok(sheet.includes('!/^\\d{10}$/.test(phone)'));
  // hồ sơ cá nhân (giáo viên, quản trị trường, quản trị tổng) dùng cùng ô và chặn lưu số sai
  const profile = read('components', 'profile.tsx');
  assert.match(profile, /k === 'phone'\s+\? <PhoneField /);
  assert.match(profile, /phoneError\(patch\.phone\)/);
  // điện thoại liên hệ của trường (không thuộc bốn vai trò) vẫn là ô nhập tự do
  assert.match(read('components', 'admin', 'SchoolAdmin.tsx'), /name: 'contact_phone', label: 'Điện thoại liên hệ', type: 'tel'/);
});
