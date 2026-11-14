#!/usr/bin/env node
/**
 * Cài Python và thư viện cho mô hình AI Đông A (ai/requirements.txt) vào backend/.ai-python, để backend gọi được ai/bridge_cli.py.
 *
 * - Trên Render (dịch vụ Node không có sẵn Python): tự chạy sau "npm run build" (script postbuild). Tải bản CPython độc lập đã ghim phiên bản
 *   và kiểm tra SHA-256, rồi "pip install -r ai/requirements.txt". Không cần đổi cấu hình dịch vụ trên trang Render.
 * - Trên máy cá nhân: "npm run ai:setup" tạo môi trường ảo từ Python có sẵn trên máy rồi cài cùng danh sách thư viện.
 * - Ở nơi khác (GitHub Actions, máy chưa gọi ai:setup): bỏ qua. AI_PYTHON_SETUP=1 để ép chạy, =0 để tắt.
 *
 * Cài lỗi KHÔNG làm hỏng bản build: backend vẫn chạy, trợ lý AI dùng chế độ dự phòng và /api/health ghi rõ lý do (ai_engine).
 * requirements.txt không đổi thì lần build sau dùng lại bản đã cài.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), '..');
const REQ = join(BACKEND, '..', 'ai', 'requirements.txt');
const DIR = join(BACKEND, '.ai-python');
const MARK = join(DIR, 'ready.json');
// CPython độc lập của dự án python-build-standalone (Astral), bản 26/10/2026; đổi phiên bản thì đổi cả mã SHA-256 (tệp SHA256SUMS của bản phát hành)
const CPYTHON = {
  tag: '20261026', version: '3.12.16', sha256: '6a79e922e50006b601f29e688407659da1c2b86ebcd4e9c7254cf234be8b89de',
};
const CPYTHON_URL = `https://github.com/astral-sh/python-build-standalone/releases/download/${CPYTHON.tag}/cpython-${CPYTHON.version}%2B${CPYTHON.tag}-x86_64-unknown-linux-gnu-install_only.tar.gz`;

const log = (m) => console.log(`[AI Python] ${m}`);
// Render đặt RENDER_SERVICE_NAME cả lúc build; mã nguồn luôn nằm dưới /opt/render/ nên dùng thêm dấu hiệu này cho chắc
const onRender = Boolean(process.env.RENDER_SERVICE_NAME || process.env.RENDER === 'true' || BACKEND.startsWith('/opt/render/'));
const local = process.argv.includes('--local');
const forced = process.env.AI_PYTHON_SETUP === '1';

function run(cmd, args, opts = {}) {
  // PYTHONUTF8: pip đọc requirements.txt (có chú thích tiếng Việt) theo UTF-8 cả trên Windows
  const r = spawnSync(cmd, args, { stdio: opts.quiet ? 'pipe' : 'inherit', encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', PIP_DISABLE_PIP_VERSION_CHECK: '1' } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} lỗi (mã ${r.status ?? r.error?.message})${opts.quiet ? `: ${(r.stderr || r.stdout || '').slice(-400)}` : ''}`);
  return (r.stdout || '').trim();
}

/** Python độc lập cho Linux x64 (máy chủ Render) */
async function standalone() {
  const archive = join(DIR, 'cpython.tar.gz');
  log(`Tải CPython ${CPYTHON.version} (${CPYTHON.tag})…`);
  const res = await fetch(CPYTHON_URL);
  if (!res.ok) throw new Error(`tải CPython lỗi HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const sum = createHash('sha256').update(buf).digest('hex');
  if (sum !== CPYTHON.sha256) throw new Error(`mã SHA-256 của CPython không khớp (${sum})`);
  writeFileSync(archive, buf);
  run('tar', ['-xzf', archive, '-C', DIR]);
  rmSync(archive, { force: true });
  const python = join(DIR, 'python', 'bin', 'python3');
  if (!existsSync(python)) throw new Error('giải nén CPython xong nhưng không thấy python3');
  return python;
}

/** Môi trường ảo từ Python có sẵn trên máy cá nhân (Windows, macOS, Linux) */
function venvFromSystem() {
  const candidates = process.platform === 'win32' ? [['py', ['-3']], ['python', []], ['python3', []]] : [['python3', []], ['python', []]];
  for (const [cmd, pre] of candidates) {
    try {
      const v = run(cmd, [...pre, '-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { quiet: true });
      const [major, minor] = v.split('.').map(Number);
      if (major !== 3 || minor < 10) { log(`${cmd} là Python ${v}, cần 3.10 trở lên`); continue; }
      log(`Tạo môi trường ảo bằng ${cmd} (Python ${v})…`);
      run(cmd, [...pre, '-m', 'venv', join(DIR, 'venv')]);
      return process.platform === 'win32' ? join(DIR, 'venv', 'Scripts', 'python.exe') : join(DIR, 'venv', 'bin', 'python');
    } catch { /* thử lệnh kế tiếp */ }
  }
  throw new Error('không tìm thấy Python 3.10+ trên máy; hãy cài Python từ python.org rồi chạy lại "npm run ai:setup"');
}

async function main() {
  if (process.env.AI_PYTHON_SETUP === '0') return log('Bỏ qua vì AI_PYTHON_SETUP=0.');
  if (!onRender && !local && !forced) return log('Bỏ qua (không chạy trên Render). Máy cá nhân: "npm run ai:setup".');
  if (!existsSync(REQ)) return log('Không có ai/requirements.txt, bỏ qua.');
  const useStandalone = !local && process.platform === 'linux' && process.arch === 'x64';
  const hash = createHash('sha256').update(readFileSync(REQ)).update(useStandalone ? CPYTHON.tag : 'venv').digest('hex');
  if (existsSync(MARK)) {
    try {
      const mark = JSON.parse(readFileSync(MARK, 'utf8'));
      if (mark.hash === hash && existsSync(join(BACKEND, mark.python))) return log(`Đã cài sẵn (${mark.python}, scikit-learn ${mark.sklearn}).`);
    } catch { /* cài lại */ }
  }
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  const python = useStandalone ? await standalone() : venvFromSystem();
  try { run(python, ['-m', 'pip', '--version'], { quiet: true }); } catch { run(python, ['-m', 'ensurepip', '--upgrade']); }
  log('Cài thư viện theo ai/requirements.txt…');
  run(python, ['-m', 'pip', 'install', '--no-cache-dir', '--only-binary=:all:', '-r', REQ]);
  const sklearn = run(python, ['-c', 'import sklearn, joblib, numpy, scipy, pydantic; print(sklearn.__version__)'], { quiet: true });
  writeFileSync(MARK, JSON.stringify({ hash, python: relative(BACKEND, python).split('\\').join('/'), sklearn, installed_at: new Date().toISOString() }, null, 2));
  log(`Xong: ${relative(BACKEND, python)} (scikit-learn ${sklearn}).`);
}

main().catch((e) => {
  // không làm hỏng bản build: AI dùng chế độ dự phòng, /api/health ghi lý do
  console.warn(`[AI Python] Không cài được Python cho mô hình AI: ${e.message}. Trợ lý AI sẽ dùng chế độ dự phòng.`);
  try { rmSync(MARK, { force: true }); } catch { /* bỏ qua */ }
});
