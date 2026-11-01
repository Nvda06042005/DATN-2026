// Local opt-in release worker. No production credentials or database URLs are read.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (data) => createHash('sha256').update(data).digest('hex');
const readJson = (path, fallback = {}) => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) : fallback;
const removeFile = (p) => { if (existsSync(p)) unlinkSync(p); };
const split0 = (s) => s.split('\0').filter(Boolean);

export function git(root, args, options = {}) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 300000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' }, ...options });
  if (r.error || r.status !== 0) throw new Error(`git ${args[0]}: ${r.error?.message || r.stderr?.trim() || 'failed'}`);
  return r.stdout.trimEnd();
}

export function eligible(path) {
  if (/(^|\/)(\.env(?:\..*)?|node_modules|dist|data|\.expo|\.auto-sync|\.git)(\/|$)/i.test(path) && !path.endsWith('/.env.example')) return false;
  if (/\.(?:local\.gs|pem|key|p12|pfx|db|sqlite3?|dump|bak|log)$/i.test(path)) return false;
  return /^(?:backend\/|frontend\/|database\/migrations\/|scripts\/|docs\/|\.github\/workflows\/)/.test(path)
    || /^(?:render\.yaml|README\.md|AGENTS\.md|\.gitignore|\.nvmrc)$/.test(path);
}

function protectFiles(root, paths) {
  for (const p of paths) {
    if (!existsSync(join(root, p))) continue;
    const content = readFileSync(join(root, p));
    if (content.length > 90 * 1024 * 1024) throw new Error(`File exceeds GitHub size allowance: ${p}`);
    if (content.includes(0)) continue;
    // Explicit secrets, not public OAuth IDs or example placeholders. Never log the matching value.
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}|postgres(?:ql)?:\/\/[^\s/]+:[^\s@]+@(?!localhost|127\.0\.0\.1)/.test(content.toString('utf8'))) {
      throw new Error(`Potential credential in ${p}; remove it before automatic publishing`);
    }
  }
}

export function capture(root, stateDir) {
  const branch = git(root, ['branch', '--show-current']);
  if (!branch) throw new Error('Detached HEAD: select the authorized source branch');
  if (git(root, ['diff', '--cached', '--name-only'])) throw new Error('Git index has staged changes; waiting for your commit');
  if (git(root, ['ls-files', '--unmerged'])) throw new Error('Resolve the current Git conflict first');
  const head = git(root, ['rev-parse', 'HEAD']);
  const paths = [...new Set([...split0(git(root, ['diff', '--name-only', '--no-renames', '-z', 'HEAD'])), ...split0(git(root, ['ls-files', '--others', '--exclude-standard', '-z']))])].filter(eligible).sort();
  protectFiles(root, paths);
  mkdirSync(stateDir, { recursive: true });
  const index = join(stateDir, `index-${process.pid}`);
  removeFile(index);
  const env = { ...process.env, GIT_INDEX_FILE: index };
  git(root, ['read-tree', head], { env });
  if (paths.length) git(root, ['add', '--pathspec-from-file=-', '--pathspec-file-nul'], { env, input: paths.join('\0') + '\0' });
  const tree = git(root, ['write-tree'], { env });
  const changes = split0(git(root, ['diff', '--name-status', '--no-renames', '-z', head, tree, '--', 'database/migrations/*.sql']));
  for (let i = 0; i < changes.length; i += 2) {
    if (changes[i] !== 'A') throw new Error(`Do not edit/delete committed migration: ${changes[i + 1]}`);
  }
  return { branch, head, tree, paths, index, key: hash(`${branch}\0${head}\0${tree}`) };
}

export function assertAppendOnlyMigrations(root, base, tip) {
  const changes = split0(git(root, ['diff', '--name-status', '--no-renames', '-z', base, tip, '--', 'database/migrations/*.sql']));
  for (let i = 0; i < changes.length; i += 2) {
    if (changes[i] !== 'A') throw new Error(`Published migration is immutable: ${changes[i + 1]}`);
    const sql = git(root, ['show', `${tip}:${changes[i + 1]}`]).replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, '');
    if (/\b(?:TRUNCATE|DELETE\s+FROM|DROP\s+(?:TABLE|SCHEMA|DATABASE|TYPE)|DROP\s+COLUMN)\b/i.test(sql)) {
      throw new Error(`Destructive SQL needs a manually reviewed release: ${changes[i + 1]}`);
    }
  }
}

// Write only the tested index, under Git's normal index lock; later editor changes remain unstaged.
export function advanceSource(root, snapshot, commit) {
  const gitDir = git(root, ['rev-parse', '--absolute-git-dir']);
  const lock = join(gitDir, 'index.lock');
  const fd = openSync(lock, 'wx');
  try {
    if (git(root, ['branch', '--show-current']) !== snapshot.branch || git(root, ['rev-parse', 'HEAD']) !== snapshot.head
      || git(root, ['diff', '--cached', '--name-only'])) throw new Error('Source branch or index changed; retrying without touching your work');
    copyFileSync(snapshot.index, lock);
    git(root, ['update-ref', `refs/heads/${snapshot.branch}`, commit, snapshot.head]);
    closeSync(fd);
    renameSync(lock, join(gitDir, 'index'));
  } catch (e) {
    try { closeSync(fd); } catch {}
    removeFile(lock);
    throw e;
  }
}

function testEnvironment() {
  const env = { ...process.env, CI: '1', NODE_ENV: 'test' };
  for (const key of Object.keys(env)) if (/^(DATABASE_URL|TEST_PG_URL|SMTP_|MAIL_|ADMIN_|AUTH_SECRET|GOOGLE_CLIENT_SECRET)/.test(key)) delete env[key];
  return env;
}

export function postgresBin() {
  const exe = process.platform === 'win32' ? 'initdb.exe' : 'initdb';
  const dirs = [process.env.POSTGRES_BIN, ...(process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':')].filter(Boolean);
  const installed = join(process.env.ProgramFiles || 'C:/Program Files', 'PostgreSQL');
  if (existsSync(installed)) for (const v of readdirSync(installed)) dirs.push(join(installed, v, 'bin'));
  return dirs.find((p) => existsSync(join(p, exe)));
}

async function command(cwd, executable, args, log, env = testEnvironment()) {
  await new Promise((done, fail) => {
    const fd = openSync(log, 'a');
    const child = spawn(executable, args, { cwd, env, windowsHide: true, stdio: ['ignore', fd, fd] });
    child.once('error', (e) => { closeSync(fd); fail(e); });
    child.once('exit', (code) => { closeSync(fd); code === 0 ? done() : fail(new Error(`Check failed (${code}); see ${log}`)); });
  });
}

export async function checkRelease(release, log, status) {
  const pg = postgresBin();
  if (!pg) throw new Error('PostgreSQL test tools missing; refusing to skip database tests');
  const npmCli = process.env.npm_execpath?.endsWith('npm-cli.js') ? process.env.npm_execpath : join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  if (!existsSync(npmCli)) throw new Error('npm-cli.js missing next to Node.js');
  const npm = (cwd, args) => command(cwd, process.execPath, [npmCli, 'exec', '--yes', '--package=npm@10.9.4', '--', 'npm', ...args], log, { ...testEnvironment(), POSTGRES_BIN: pg });
  status('checking', 'Automation regression tests');
  await command(release, process.execPath, ['--test', 'scripts/auto-sync.test.mjs'], log);
  status('checking', 'Backend clean install, build, migration validation and all backend tests');
  const backend = join(release, 'backend');
  await npm(backend, ['ci', '--no-audit', '--no-fund']);
  await npm(backend, ['run', 'build']);
  await npm(backend, ['run', 'migrate', '--', 'check']);
  await npm(backend, ['test', '--', '--testTimeout=180000']);
  status('checking', 'Frontend clean install, typecheck, tests and web build');
  const frontend = join(release, 'frontend');
  await npm(frontend, ['ci', '--no-audit', '--no-fund']);
  for (const script of ['typecheck', 'test', 'build']) await npm(frontend, ['run', script]);
}

export async function publish(root, stateDir, snapshot, { check = checkRelease, status = () => {} } = {}) {
  git(root, ['fetch', 'origin', 'main']);
  const remote = git(root, ['rev-parse', 'origin/main']);
  const release = join(stateDir, 'release');
  // This worktree belongs only to this worker; never reset or clean the user's checkout.
  if (!existsSync(join(release, '.git'))) git(root, ['worktree', 'add', '--detach', release, remote]);
  git(release, ['checkout', '--detach', remote]);
  let commit = snapshot.head;
  if (snapshot.tree !== git(root, ['rev-parse', `${snapshot.head}^{tree}`])) {
    commit = git(root, ['commit-tree', snapshot.tree, '-p', snapshot.head, '-F', '-'], { input: `Auto-sync: checked local code (${snapshot.branch})\n` });
  }
  try {
    git(release, ['merge', ...(snapshot.branch === 'main' ? ['--ff-only'] : ['--no-ff']), commit, '-m', `Auto-sync: release ${snapshot.branch} after checks`]);
  } catch (e) {
    try { git(release, ['merge', '--abort']); } catch {}
    throw new Error(`Automatic merge stopped; resolve source/main conflict first. ${e.message}`);
  }
  const tip = git(release, ['rev-parse', 'HEAD']);
  assertAppendOnlyMigrations(root, remote, tip);
  await check(release, join(stateDir, 'checks.log'), status);
  if (existsSync(join(stateDir, 'stop'))) throw new Error('Stop requested; no release pushed');
  const fresh = capture(root, join(stateDir, 'recheck'));
  if (fresh.key !== snapshot.key) throw new Error('Code changed during checks; waiting to test the new version');
  git(root, ['fetch', 'origin', 'main']);
  if (git(root, ['rev-parse', 'origin/main']) !== remote) throw new Error('Remote main changed during checks; retry required');
  if (commit !== snapshot.head) advanceSource(root, snapshot, commit);
  status('pushing', 'Checks passed; pushing source branch and main atomically');
  const refs = snapshot.branch === 'main' ? [`${tip}:refs/heads/main`] : [`${commit}:refs/heads/${snapshot.branch}`, `${tip}:refs/heads/main`];
  git(root, ['push', '--atomic', 'origin', ...refs]);
  // Advance an unused local main only by fast-forward; Git refuses if another worktree has it open.
  if (snapshot.branch !== 'main'
    && spawnSync('git', ['merge-base', '--is-ancestor', 'main', tip], { cwd: root, windowsHide: true }).status === 0) {
    spawnSync('git', ['branch', '-f', 'main', tip], { cwd: root, windowsHide: true, stdio: 'ignore' });
  }
  const versions = readdirSync(join(release, 'database/migrations')).filter((p) => /^\d+_.+\.sql$/.test(p)).map((p) => Number(p.split('_')[0]));
  return { commit: tip, schema: Math.max(...versions), sourceCommit: commit };
}

export async function deploymentReady(expected) {
  const json = async (url) => {
    const r = await fetch(`${url}${url.includes('?') ? '&' : '?'}sync=${expected.commit}&t=${Date.now()}`, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };
  const [api, db, web] = await Promise.all([
    json('https://dong-a-api.onrender.com/api/health'),
    json('https://dong-a-api.onrender.com/api/database/health'),
    json('https://datn-2026-indol.vercel.app/build-info.json'),
  ]);
  return api.status === 'healthy' && api.commit === expected.commit && db.schema_version >= expected.schema && web.commit === expected.commit;
}

async function watch(root, once = false) {
  const dir = join(root, '.auto-sync');
  mkdirSync(dir, { recursive: true });
  const config = readJson(join(dir, 'config.json'));
  if (!config.sourceBranch || config.allowMergeToMain !== true) throw new Error('Run auto-sync.ps1 Start -SourceBranch <branch> -AllowMergeToMain first');
  const origin = git(root, ['remote', 'get-url', 'origin']);
  if (!/^(?:https:\/\/github\.com\/Nvda06042005\/DATN-2026(?:\.git)?|git@github\.com:Nvda06042005\/DATN-2026(?:\.git)?)$/i.test(origin)) throw new Error('Unexpected GitHub destination; not publishing');
  const lock = join(dir, 'worker.json');
  if (existsSync(lock)) {
    const old = readJson(lock);
    let alive = false;
    try { process.kill(old.pid, 0); alive = true; } catch {}
    if (alive) throw new Error('An auto-sync worker is already running');
    removeFile(lock);
  }
  const fd = openSync(lock, 'wx');
  writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  closeSync(fd);
  removeFile(join(dir, 'stop'));
  let activeBranch = config.sourceBranch;
  let current = { phase: 'starting' };
  const status = (phase, detail, extra = {}) => {
    current = { ...current, ...extra, phase, detail, pid: process.pid, branch: activeBranch, heartbeat: new Date().toISOString() };
    writeFileSync(join(dir, 'status.json'), JSON.stringify(current, null, 2));
    appendFileSync(join(dir, 'worker.log'), `${current.heartbeat} ${phase}: ${detail}\n`);
  };
  const heartbeat = setInterval(() => { writeFileSync(join(dir, 'status.json'), JSON.stringify({ ...current, heartbeat: new Date().toISOString() }, null, 2)); }, 10000);
  let observed = '', since = Date.now(), attempted = '', nextAttempt = 0;
  let last = readJson(join(dir, 'last-release.json'), null);
  status('watching', 'Waiting for stable local code');
  try {
    do {
      if (existsSync(join(dir, 'stop'))) break;
      try {
        const snapshot = capture(root, dir);
        activeBranch = snapshot.branch;
        if (!config.followCurrentBranch && snapshot.branch !== config.sourceBranch) throw new Error(`Current branch is ${snapshot.branch}; authorized branch is ${config.sourceBranch}`);
        if (last?.pending && !snapshot.paths.length && snapshot.head === last.sourceCommit) {
          status('verifying', 'Waiting for Render, Supabase and Vercel to run the pushed commit', { release: last });
          if (await deploymentReady(last)) {
            last.pending = false;
            writeFileSync(join(dir, 'last-release.json'), JSON.stringify(last, null, 2));
            status('synced', 'GitHub, Render, Supabase and Vercel verified', { release: last });
          } else if (Date.now() - last.pushedAt > 20 * 60 * 1000) {
            throw new Error('Deployment not verified after 20 minutes; inspect Render/Vercel logs. Will keep checking; no duplicate push.');
          }
        } else if (snapshot.paths.length || spawnSync('git', ['merge-base', '--is-ancestor', snapshot.head, 'origin/main'], { cwd: root, windowsHide: true }).status !== 0) {
          if (snapshot.key !== observed) { observed = snapshot.key; since = Date.now(); status('waiting', 'Local changes detected; waiting for 120 seconds of no edits'); }
          if ((once || Date.now() - since >= (config.quietSeconds || 120) * 1000) && (attempted !== snapshot.key || Date.now() >= nextAttempt)) {
            attempted = snapshot.key;
            nextAttempt = Date.now() + 10 * 60 * 1000;
            const published = await publish(root, dir, snapshot, { status });
            last = { ...published, pending: true, pushedAt: Date.now() };
            writeFileSync(join(dir, 'last-release.json'), JSON.stringify(last, null, 2));
            status('verifying', 'Pushed successfully; waiting for cloud deployments', { release: last });
          }
        } else if (!last?.pending && !['synced', 'watching'].includes(current.phase)) status('watching', 'No unpublished local changes');
      } catch (e) { status('blocked', e.message); }
      if (!once) await wait(15000);
    } while (!once);
  } finally {
    clearInterval(heartbeat);
    status('stopped', 'Worker stopped');
    removeFile(lock);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  watch(projectRoot, process.argv.includes('--once')).catch((e) => { console.error(e.message); process.exitCode = 1; });
}
