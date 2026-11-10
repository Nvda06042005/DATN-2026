import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { capture, deploymentReady, eligible, git, publish, projectRoot } from './auto-sync.mjs';
import { calendarPackage } from './calendar-package.mjs';

function fixture(t) {
  const temp = mkdtempSync(join(tmpdir(), 'dong-a-auto-sync-test-'));
  t.after(() => {
    if (resolve(dirname(temp)) !== resolve(tmpdir()) || !basename(temp).startsWith('dong-a-auto-sync-test-')) throw new Error('Invalid test cleanup path');
    rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  });
  const origin = join(temp, 'origin.git');
  const root = join(temp, 'local');
  mkdirSync(root);
  git(temp, ['init', '--bare', origin]);
  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.name', 'Automation test']);
  git(root, ['config', 'user.email', 'test@example.invalid']);
  mkdirSync(join(root, 'backend/src'), { recursive: true });
  mkdirSync(join(root, 'database/migrations'), { recursive: true });
  writeFileSync(join(root, '.gitignore'), '.auto-sync/\n.env\n');
  writeFileSync(join(root, 'README.md'), '# Project\n\nBase notes\n');
  writeFileSync(join(root, 'backend/src/example.ts'), 'export const value = 1;\n');
  writeFileSync(join(root, 'database/migrations/001_initial.sql'), 'CREATE TABLE demo (id integer);\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'fixture']);
  git(root, ['remote', 'add', 'origin', origin]);
  git(root, ['push', '-u', 'origin', 'main']);
  git(root, ['switch', '-c', 'feat/test']);
  return { root, origin, state: join(root, '.auto-sync') };
}

test('watches source paths but excludes credentials, local databases and generated files', () => {
  for (const p of ['backend/src/new.ts','frontend/app/new.tsx','database/migrations/028_new.sql','frontend/.env.example']) assert.equal(eligible(p), true);
  for (const p of ['backend/.env','frontend/.env.local','backend/data/users.db','backend/mail-relay.local.gs','frontend/node_modules/x.js','frontend/dist/index.html','backend/private.key','.auto-sync/status.json']) assert.equal(eligible(p), false, p);
});

test('checked changes merge into main and source branch; successive releases preserve the workflow', async (t) => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'backend/src/example.ts'), 'export const value = 2;\n');
  const s = capture(f.root, f.state);
  const r = await publish(f.root, f.state, s, { check: async (release) => {
    assert.equal(readFileSync(join(release, 'backend/src/example.ts'), 'utf8').trim(), 'export const value = 2;');
  } });
  assert.equal(git(f.origin, ['rev-parse', 'main']), r.commit);
  assert.equal(git(f.origin, ['rev-parse', 'feat/test']), r.sourceCommit);
  assert.equal(git(f.root, ['status', '--porcelain']), '');
  assert.equal(r.schema, 1);
  // Another edit creates a new release, rather than re-pushing the previous snapshot.
  writeFileSync(join(f.root, 'backend/src/example.ts'), 'export const value = 3;\n');
  const second = await publish(f.root, f.state, capture(f.root, f.state), { check: async () => {} });
  assert.notEqual(second.commit, r.commit);
  assert.equal(git(f.origin, ['show', 'main:backend/src/example.ts']), 'export const value = 3;');
});

test('failed checks publish nothing and preserve the user branch and index', async (t) => {
  const f = fixture(t);
  const before = git(f.origin, ['rev-parse', 'main']);
  writeFileSync(join(f.root, 'backend/src/example.ts'), 'broken code\n');
  const s = capture(f.root, f.state);
  await assert.rejects(publish(f.root, f.state, s, { check: async () => { throw new Error('test failure'); } }), /test failure/);
  assert.equal(git(f.origin, ['rev-parse', 'main']), before);
  assert.equal(git(f.root, ['rev-parse', 'HEAD']), s.head);
  assert.equal(git(f.root, ['diff', '--cached', '--name-only']), '');
});

test('edits made while tests run are not pushed', async (t) => {
  const f = fixture(t);
  const before = git(f.origin, ['rev-parse', 'main']);
  writeFileSync(join(f.root, 'backend/src/example.ts'), 'export const value = 2;\n');
  await assert.rejects(publish(f.root, f.state, capture(f.root, f.state), { check: async () => {
    writeFileSync(join(f.root, 'backend/src/example.ts'), 'still writing\n');
  } }), /Code changed/);
  assert.equal(git(f.origin, ['rev-parse', 'main']), before);
  assert.equal(readFileSync(join(f.root, 'backend/src/example.ts'), 'utf8'), 'still writing\n');
});

test('staged user changes, edited SQL history and destructive new SQL stop the worker', async (t) => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'database/migrations/001_initial.sql'), 'changed\n');
  assert.throws(() => capture(f.root, f.state), /Do not edit/);
  git(f.root, ['restore', 'database/migrations/001_initial.sql']);
  writeFileSync(join(f.root, 'database/migrations/002_delete.sql'), 'DROP TABLE demo;\n');
  await assert.rejects(publish(f.root, f.state, capture(f.root, f.state), { check: async () => assert.fail('must not run') }), /Destructive SQL/);
  git(f.root, ['add', 'database/migrations/002_delete.sql']);
  assert.throws(() => capture(f.root, f.state), /staged changes/);
});

test('staging during checks is preserved and prevents publishing', async (t) => {
  const f = fixture(t);
  const before = git(f.origin, ['rev-parse', 'main']);
  writeFileSync(join(f.root, 'backend/src/example.ts'), 'export const value = 2;\n');
  await assert.rejects(publish(f.root, f.state, capture(f.root, f.state), { check: async () => {
    git(f.root, ['add', 'backend/src/example.ts']);
  } }), /staged changes/);
  assert.equal(git(f.origin, ['rev-parse', 'main']), before);
  assert.equal(git(f.root, ['diff', '--cached', '--name-only']), 'backend/src/example.ts');
});

test('a concurrent main update stops the release without overwriting it', async (t) => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'backend/src/example.ts'), 'export const value = 2;\n');
  const s = capture(f.root, f.state);
  let other;
  await assert.rejects(publish(f.root, f.state, s, { check: async (release) => {
    writeFileSync(join(release, 'README.md'), 'Someone else updated main\n');
    git(release, ['add', 'README.md']);
    git(release, ['commit', '-m', 'concurrent main']);
    other = git(release, ['rev-parse', 'HEAD']);
    git(release, ['push', 'origin', 'HEAD:refs/heads/main']);
  } }), /Remote main changed/);
  assert.equal(git(f.origin, ['rev-parse', 'main']), other);
  assert.equal(git(f.root, ['rev-parse', 'HEAD']), s.head);
});

test('build writes the public identity and packages the calendar assets copied by Expo', (t) => {
  const temp = mkdtempSync(join(tmpdir(), 'dong-a-auto-sync-test-'));
  t.after(() => {
    assert.equal(resolve(dirname(temp)), resolve(tmpdir()));
    assert.ok(basename(temp).startsWith('dong-a-auto-sync-test-'));
    rmSync(temp, { recursive: true, force: true });
  });
  mkdirSync(join(temp, 'dist'));
  const calendarRoot = join(temp, 'dist/office-calendar');
  cpSync(join(projectRoot, 'frontend/public/office-calendar'), calendarRoot, { recursive: true });
  const commit = 'a'.repeat(40);
  execFileSync(process.execPath, [join(projectRoot, 'scripts/write-build-info.mjs')], { cwd: temp, env: { ...process.env, VERCEL_GIT_COMMIT_SHA: commit }, windowsHide: true });
  const result = JSON.parse(readFileSync(join(temp, 'dist/build-info.json'), 'utf8'));
  assert.equal(result.commit, commit);
  assert.deepEqual(Object.keys(result).sort(), ['builtAt','commit']);
  assert.deepEqual(readFileSync(join(calendarRoot, 'dong-a-calendar.zip')), calendarPackage(calendarRoot));
});

test('HTTP 200 from an older deployment is not counted as synchronized', async (t) => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  const commit = 'a'.repeat(40);
  let webCommit = 'b'.repeat(40);
  globalThis.fetch = async (url) => ({ ok: true, json: async () => url.includes('database/health')
    ? { schema_version: 27 } : url.includes('build-info') ? { commit: webCommit } : { status: 'healthy', commit } });
  assert.equal(await deploymentReady({ commit, schema: 27 }), false);
  webCommit = commit;
  assert.equal(await deploymentReady({ commit, schema: 27 }), true);
  assert.equal(await deploymentReady({ commit, schema: 28 }), false);
});

test('working directly on main fast-forwards the checked commit', async (t) => {
  const f = fixture(t);
  git(f.root, ['switch', 'main']);
  writeFileSync(join(f.root, 'backend/src/example.ts'), 'export const value = 4;\n');
  const r = await publish(f.root, f.state, capture(f.root, f.state), { check: async () => {} });
  assert.equal(git(f.root, ['rev-parse', 'HEAD']), r.commit);
  assert.equal(git(f.origin, ['rev-parse', 'main']), r.commit);
  assert.equal(git(f.root, ['status', '--porcelain']), '');
});

test('an explicit database credential in a source file blocks capture without printing it', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'backend/src/accidental.ts'), 'postgres' + 'ql://fixture:fake' + '@db.example.invalid/db');
  assert.throws(() => capture(f.root, f.state), (e) => /Potential credential/.test(e.message) && !e.message.includes('fixture:fake'));
});

test('documentation additions survive a merge when one conflict side is empty', async (t) => {
  const f = fixture(t);
  const upstream = join(f.state, 'upstream');
  git(f.root, ['worktree', 'add', '--detach', upstream, 'origin/main']);
  writeFileSync(join(upstream, 'README.md'), '# Project\n\nShared release note\nBase notes\n');
  git(upstream, ['add', 'README.md']);
  git(upstream, ['commit', '-m', 'shared documentation']);
  git(upstream, ['push', 'origin', 'HEAD:refs/heads/main']);
  writeFileSync(join(f.root, 'README.md'), '# Project\n\nShared release note\nFeature release note\nBase notes\n');
  await publish(f.root, f.state, capture(f.root, f.state), { check: async (release) => {
    const text = readFileSync(join(release, 'README.md'), 'utf8');
    assert.ok(text.includes('Shared release note'));
    assert.ok(text.includes('Feature release note'));
    assert.ok(!text.includes('<<<<<<<'));
  } });
  assert.ok(git(f.origin, ['show', 'main:README.md']).includes('Feature release note'));
});

test('conflicting documentation replacements stop without choosing or deleting either version', async (t) => {
  const f = fixture(t);
  const upstream = join(f.state, 'upstream');
  git(f.root, ['worktree', 'add', '--detach', upstream, 'origin/main']);
  writeFileSync(join(upstream, 'README.md'), '# Project\n\nMain replacement\n');
  git(upstream, ['add', 'README.md']);
  git(upstream, ['commit', '-m', 'replace main documentation']);
  git(upstream, ['push', 'origin', 'HEAD:refs/heads/main']);
  writeFileSync(join(f.root, 'README.md'), '# Project\n\nFeature replacement\n');
  await assert.rejects(publish(f.root, f.state, capture(f.root, f.state), { check: async () => assert.fail('conflict must not be tested or published') }), /Automatic merge stopped/);
  assert.ok(git(f.origin, ['show', 'main:README.md']).includes('Main replacement'));
  assert.ok(readFileSync(join(f.root, 'README.md'), 'utf8').includes('Feature replacement'));
});
