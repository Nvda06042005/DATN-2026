const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), test = require('node:test'), ts = require('typescript');
function load(name, clock) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib', name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(module,exports){${code}\n})`, { Date: { now: () => clock.time } })(module, module.exports);
  return module.exports;
}
const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const user = { id: 1, role: 'school_admin', school_code: '00000001' };

test('Menu navigation reuses verified user briefly; stale/focused sessions verify again; tokens stay isolated', async () => {
  const clock = { time: 0 }, cache = load('verified-session', clock); let requests = 0;
  const read = async () => { requests++; return user; };
  cache.rememberVerifiedUser('one', user);
  assert.equal(await cache.verifyUser('one', read), user); assert.equal(requests, 0);
  assert.equal(cache.peekVerifiedUser('another-token'), null);
  clock.time = 30_001;
  assert.equal(cache.peekVerifiedUser('one'), user); // chỉ hiện lại UI đã xác thực, vẫn kiểm tra nền
  assert.equal(await cache.verifyUser('one', read), user); assert.equal(requests, 1);
  await cache.verifyUser('one', read, true); assert.equal(requests, 2);
  clock.time += 300_001; assert.equal(cache.peekVerifiedUser('one'), null);
});

test('Concurrent /me calls share one request; logout/401 discards a late response; errors can retry', async () => {
  const cache = load('verified-session', { time: 0 }), late = defer(); let requests = 0;
  const a = cache.verifyUser('one', () => { requests++; return late.promise; });
  const b = cache.verifyUser('one', () => { requests++; return late.promise; });
  assert.equal(requests, 1); cache.forgetVerifiedUser('one'); late.resolve(user); await Promise.all([a, b]);
  assert.equal(cache.peekVerifiedUser('one'), null);
  await assert.rejects(cache.verifyUser('one', async () => { throw new Error('offline'); }), /offline/);
  await cache.verifyUser('one', async () => user); assert.equal(cache.peekVerifiedUser('one'), user);
  const fresh = defer(), pending = cache.verifyUser('one', () => fresh.promise, true);
  const updated = { ...user, full_name: 'Tên mới' }; cache.rememberVerifiedUser('one', updated);
  fresh.resolve(user); await pending; assert.equal(cache.peekVerifiedUser('one'), updated);
});

test('Public school identity reuses only its own slug, expires, and cannot reappear from an old request after editing', async () => {
  const clock = { time: 0 }, cache = load('school-identity-cache', clock), school = { slug: 'donga_00000001_new', school_code: '00000001', name: 'Tên mới' };
  let requests = 0; const late = defer();
  const a = cache.loadSchoolIdentity('donga_00000001_old', () => { requests++; return late.promise; });
  const b = cache.loadSchoolIdentity('donga_00000001_old', () => { requests++; return late.promise; });
  assert.equal(requests, 1); late.resolve(school); await Promise.all([a, b]);
  assert.equal(cache.peekSchoolIdentity(school.slug), school); assert.equal(cache.peekSchoolIdentity('donga_00000002'), null);
  clock.time = 60_001; assert.equal(cache.peekSchoolIdentity(school.slug), null);
  const edit = defer(), pending = cache.loadSchoolIdentity(school.slug, () => edit.promise); cache.clearSchoolIdentities(); edit.resolve(school); await pending;
  assert.equal(cache.peekSchoolIdentity(school.slug), null);
});
