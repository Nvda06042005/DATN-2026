#!/usr/bin/env node
/**
 * Người nhận việc Gemma 4 (27/11/2026): chạy trên máy có GPU (máy giáo viên), nhận câu hỏi của Tiểu Tướng từ máy chủ Đông A (website thật trên Render)
 * rồi trả lời bằng Ollama của chính máy này. Máy chủ không kết nối được vào máy này: chính máy này hỏi việc qua HTTPS (POST /api/ai/gemma/poll),
 * nên không cần mở cổng và Ollama vẫn chỉ nghe ở 127.0.0.1. Tắt chương trình này (hoặc tắt máy) thì website tự dùng phương án cũ.
 *
 * Cách chạy:  cd backend && npm run gemma:worker
 * Cấu hình (backend/.env – tệp không đưa lên Git – hoặc biến môi trường):
 *   GEMMA_WORKER_KEY  bắt buộc, trùng với biến cùng tên trên máy chủ (Render → Environment)
 *   GEMMA_SERVER      địa chỉ máy chủ, mặc định https://dong-a-api.onrender.com
 *   GEMMA_OLLAMA      địa chỉ Ollama của máy này, mặc định GEMMA_URL hoặc http://127.0.0.1:11434
 *   GEMMA_MODEL       mô hình đã tải bằng `ollama pull`, mặc định gemma4:e4b
 */
import 'dotenv/config';
import { execFile } from 'node:child_process';

const env = (k, d = '') => (process.env[k] ?? d).trim();
const SERVER = env('GEMMA_SERVER', 'https://dong-a-api.onrender.com').replace(/\/+$/, '');
const OLLAMA = env('GEMMA_OLLAMA', env('GEMMA_URL', 'http://127.0.0.1:11434')).replace(/\/+$/, '');
const MODEL = env('GEMMA_MODEL', 'gemma4:e4b');
const KEY = env('GEMMA_WORKER_KEY');
/** Giữ mô hình trong bộ nhớ GPU trong lúc chương trình chạy (làm mới mỗi 20 phút); thoát chương trình thì giải phóng */
const KEEP = '30m';
const JOB_TIMEOUT_MS = 110_000;
/** Trùng NUM_CTX ở backend/src/ai/gemma.client.ts (máy chủ gửi kèm trong mỗi việc) */
const NUM_CTX = 8192;

const now = () => new Date().toLocaleTimeString('vi-VN', { hour12: false });
const log = (...a) => console.log(`[${now()}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sec = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} giây`;

function gpuName() {
  return new Promise((resolve) => {
    execFile('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader'], { timeout: 4000, windowsHide: true }, (err, out) => resolve(err ? null : String(out).split('\n')[0].trim() || null));
  });
}

async function ollama(path, body, timeoutMs = 15_000) {
  const res = await fetch(`${OLLAMA}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Ollama ${path} trả ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Giống readOllamaStream ở backend/src/ai/gemma.client.ts: gom phần suy luận và câu trả lời, đo thời gian tới chữ đầu tiên của câu trả lời */
async function runJob(job) {
  const started = Date.now();
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(JOB_TIMEOUT_MS),
    body: JSON.stringify({ model: MODEL, stream: true, keep_alive: KEEP, think: Boolean(job.think), messages: job.messages, options: job.options }),
  });
  if (!res.ok || !res.body) throw new Error(`Ollama trả ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '', thinking = '', content = '', firstContentAt = 0, tokensIn = 0, tokensOut = 0;
  const take = (line) => {
    if (!line.trim()) return;
    let j;
    try { j = JSON.parse(line); } catch { return; }
    if (j.error) throw new Error(String(j.error));
    const m = j.message ?? {};
    if (m.thinking) thinking += m.thinking;
    if (m.content) { if (!firstContentAt) firstContentAt = Date.now(); content += m.content; }
    if (j.done) { tokensIn = Number(j.prompt_eval_count ?? 0); tokensOut = Number(j.eval_count ?? 0); }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) { take(buf.slice(0, i)); buf = buf.slice(i + 1); }
  }
  take(buf + decoder.decode());
  return { content: content.trim(), thinking: thinking.trim(), thinking_ms: thinking ? (firstContentAt || Date.now()) - started : 0, tokens_in: tokensIn, tokens_out: tokensOut, ms: Date.now() - started };
}

async function server(path, body, timeoutMs) {
  return fetch(`${SERVER}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gemma-key': KEY }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
}

async function sendResult(result) {
  for (let i = 0; i < 3; i += 1) {
    try {
      const r = await server('/api/ai/gemma/result', result, 20_000);
      if (r.ok) return (await r.json()).accepted;
      log(`Máy chủ không nhận kết quả (${r.status}); thử lại.`);
    } catch (e) { log(`Gửi kết quả lỗi: ${e.message}; thử lại.`); }
    await sleep(1500 * (i + 1));
  }
  return false;
}

async function main() {
  if (KEY.length < 16) {
    console.error('Thiếu GEMMA_WORKER_KEY (ít nhất 16 ký tự) trong backend/.env hoặc biến môi trường. Khóa phải trùng với biến cùng tên trên máy chủ.');
    process.exit(1);
  }
  log(`Người nhận việc Gemma: máy chủ ${SERVER} · Ollama ${OLLAMA} · mô hình ${MODEL}`);
  let version;
  try { version = (await ollama('/api/version')).version; } catch (e) {
    console.error(`Không gọi được Ollama ở ${OLLAMA} (${e.message}). Mở ứng dụng Ollama rồi chạy lại.`);
    process.exit(1);
  }
  try { await ollama('/api/show', { model: MODEL }); } catch {
    console.error(`Máy này chưa có mô hình ${MODEL}. Chạy: ollama pull ${MODEL}`);
    process.exit(1);
  }
  const gpu = await gpuName();
  log(`Ollama ${version}${gpu ? ` · GPU ${gpu}` : ' · không thấy GPU NVIDIA (Ollama sẽ chạy bằng CPU, chậm hơn)'}`);
  // nạp sẵn mô hình vào GPU và giữ trong lúc chương trình chạy; thêm một lượt hỏi rất ngắn vì lượt hỏi đầu tiên sau khi nạp chậm hơn hẳn
  // (đo trên RTX 4050: ~30 giây). Lượt này dùng đúng num_ctx của câu hỏi thật, khác num_ctx thì Ollama nạp lại mô hình.
  const warm = async () => {
    try {
      // phải kèm num_ctx: thiếu thì Ollama nạp với ngữ cảnh mặc định 4096 rồi nạp lại khi có câu hỏi thật (mỗi lần ~45 giây)
      await ollama('/api/generate', { model: MODEL, keep_alive: KEEP, options: { num_ctx: NUM_CTX } }, 300_000);
      const r = await fetch(`${OLLAMA}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(180_000),
        body: JSON.stringify({ model: MODEL, stream: true, keep_alive: KEEP, think: false, messages: [{ role: 'user', content: 'Xin chào' }], options: { num_predict: 1, num_ctx: NUM_CTX } }),
      });
      await r.text();
    } catch (e) { log(`Nạp mô hình lỗi: ${e.message}`); }
  };
  log('Đang nạp mô hình vào GPU…');
  const warmStarted = Date.now();
  await warm();
  log(`Đã nạp mô hình (${sec(Date.now() - warmStarted)}).`);
  const timer = setInterval(warm, 20 * 60_000);
  let stopping = false;
  const stop = async () => {
    if (stopping) process.exit(0);
    stopping = true;
    clearInterval(timer);
    log('Dừng: giải phóng mô hình khỏi GPU. Website tự dùng phương án cũ.');
    try { await ollama('/api/generate', { model: MODEL, keep_alive: 0 }, 10_000); } catch { /* bỏ qua */ }
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  log('Sẵn sàng nhận câu hỏi (Ctrl+C để dừng).');

  let wait = 1000;
  let warnedOff = false;
  while (!stopping) {
    let job = null;
    try {
      const r = await server('/api/ai/gemma/poll', { model: MODEL, ollama: version, gpu }, 40_000);
      if (r.status === 204) { wait = 1000; continue; }
      if (r.status === 401) { console.error('Máy chủ báo khóa GEMMA_WORKER_KEY không đúng. Sửa khóa rồi chạy lại.'); process.exit(1); }
      if (r.status === 404) {
        if (!warnedOff) log('Máy chủ chưa bật người nhận việc Gemma (chưa đặt GEMMA_WORKER_KEY trên máy chủ, hoặc máy chủ chưa cập nhật). Thử lại mỗi phút.');
        warnedOff = true;
        await sleep(60_000);
        continue;
      }
      if (!r.ok) throw new Error(`máy chủ trả ${r.status}`);
      warnedOff = false;
      job = (await r.json()).job;
      wait = 1000;
    } catch (e) {
      log(`Không hỏi được việc (${e.message}); thử lại sau ${Math.round(wait / 1000)} giây.`);
      await sleep(wait);
      wait = Math.min(30_000, wait * 2);
      continue;
    }
    if (!job) continue;
    try {
      const out = await runJob(job);
      const ok = Boolean(out.content);
      const accepted = await sendResult({ id: job.id, ok, model: MODEL, ...out, error: ok ? null : 'Gemma không trả nội dung' });
      log(`Câu hỏi ${job.id.slice(0, 8)}: ${sec(out.ms)}${out.thinking ? ` (suy nghĩ ${sec(out.thinking_ms)})` : ''}, ${out.tokens_out} token${accepted ? '' : ' – máy chủ đã hết chờ, dùng phương án cũ'}`);
    } catch (e) {
      log(`Câu hỏi ${job.id.slice(0, 8)} lỗi: ${e.message}`);
      await sendResult({ id: job.id, ok: false, error: e.message });
    }
  }
}

main().catch((e) => { console.error('Lỗi không mong đợi:', e); process.exit(1); });
