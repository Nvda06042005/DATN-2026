import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
let commit = process.env.VERCEL_GIT_COMMIT_SHA;
if (!commit) {
  try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore','pipe','ignore'] }).trim(); } catch {}
}
writeFileSync(join(process.cwd(), 'dist', 'build-info.json'), JSON.stringify({ commit: /^[a-f0-9]{40}$/.test(commit || '') ? commit : null, builtAt: new Date().toISOString() }) + '\n');
