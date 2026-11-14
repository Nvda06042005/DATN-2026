#!/usr/bin/env node
/**
 * Hỏi thử mô hình AI Python (ai/bridge_cli.py) đúng như backend gọi: chạy cầu nối bằng Python của backend/.ai-python (hoặc AI_PYTHON),
 * chờ nạp mô hình rồi hỏi vài câu; trả lời "không tìm thấy" hoặc lỗi thì thoát mã 1.
 * Dùng ở GitHub Actions (cài Python như Render rồi chạy tệp này) và trên máy cá nhân: "npm run ai:smoke" sau "npm run ai:setup".
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(BACKEND, '..', 'ai', 'bridge_cli.py');
const QUESTIONS = ['Trần Hưng Đạo là ai?', 'Hội nghị Diên Hồng diễn ra khi nào?', 'Trận Bạch Đằng năm 1288 diễn ra như thế nào?'];
const dir = join(BACKEND, '.ai-python');
const python = process.env.AI_PYTHON
  ?? [join(dir, 'python', 'bin', 'python3'), join(dir, 'venv', 'bin', 'python'), join(dir, 'venv', 'Scripts', 'python.exe')].find((p) => existsSync(p));
const fail = (m) => { console.error(`[AI smoke] ${m}`); process.exit(1); };
if (!python) fail('chưa có Python cho mô hình: chạy "npm run ai:setup" (máy cá nhân) hoặc kiểm tra bước cài ở build');

const started = Date.now();
const proc = spawn(python, ['-u', SCRIPT], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
let stderr = '';
proc.stderr.on('data', (d) => { stderr = (stderr + d).slice(-1500); });
proc.on('exit', (code) => fail(`mô hình dừng (mã ${code}): ${stderr.trim()}`));
const pending = new Map();
let ready;
const readyPromise = new Promise((resolve) => { ready = resolve; });
createInterface({ input: proc.stdout }).on('line', (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.ready) return ready(msg);
  if (typeof msg.id === 'number' && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const timer = setTimeout(() => fail(`quá 240 giây chưa nạp xong mô hình: ${stderr.trim()}`), 240_000);
const info = await readyPromise;
clearTimeout(timer);
console.log(`[AI smoke] Mô hình sẵn sàng sau ${((Date.now() - started) / 1000).toFixed(1)} giây (${info.units} chủ điểm, ${info.train_samples} mẫu).`);
let id = 0;
for (const question of QUESTIONS) {
  id += 1;
  const body = JSON.stringify({ id, action: 'ask', payload: { question, session_id: 'smoke', student_id: 'smoke', mode: 'tutor' } })
    .replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const res = await new Promise((resolve) => { pending.set(id, resolve); proc.stdin.write(`${body}\n`); setTimeout(() => resolve({ ok: false, error: 'quá 60 giây không trả lời' }), 60_000); });
  const answer = res.result?.answer ?? '';
  if (!res.ok || res.result?.is_not_found || answer.length < 20) fail(`"${question}" không có câu trả lời: ${res.error ?? answer}`);
  console.log(`[AI smoke] ${question} → ${answer.replace(/\s+/g, ' ').slice(0, 100)}…`);
}
proc.removeAllListeners('exit');
proc.kill();
console.log('[AI smoke] Mô hình AI trả lời đúng.');
