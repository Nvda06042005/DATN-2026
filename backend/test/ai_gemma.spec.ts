/**
 * Gemma 4 E4B trên GPU máy giáo viên (27/11/2026): AI Tutor ưu tiên Gemma (Ollama, bật suy luận), máy chưa chạy thì dùng phương án cũ.
 * Máy chủ Ollama giả trả NDJSON như Ollama thật (message.thinking rồi message.content, dòng cuối done: true); người nhận việc giả hỏi việc / gửi kết quả
 * như backend/scripts/gemma-worker.mjs. HTTP thật trên PostgreSQL tạm.
 */
import { createServer, IncomingMessage, Server } from 'http';
import type { AddressInfo } from 'net';
import { call, hasPostgres, Started, startApp } from './harness';
import { bootstrap, Fixture, publishSeed } from './fixture';
import type { DatabaseService } from '../src/database/database.service';

let s: Started, f: Fixture, db: DatabaseService;
const as = (who: { token: string }) => (method: string, path: string, body?: unknown) => call(s.base, method, path, body, who.token);
const WORKER_KEY = 'khoa-nguoi-nhan-viec-gemma-thu-nghiem';
const THOUGHT = 'B1. Em hỏi về Bạch Đằng. B2. Đoạn [1] trả lời được. B3. Mọi ý đều có trong đoạn [1]. B4. Viết ngắn cho học sinh.';

/** Ollama giả: /api/version và /api/chat (stream NDJSON); `down` = máy giáo viên tắt Ollama */
function fakeOllama() {
  const calls: Array<{ path: string; body: any }> = [];
  const state = { down: false };
  const server: Server = createServer((req: IncomingMessage, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      if (state.down) { res.writeHead(503); res.end('tắt'); return; }
      if (req.url === '/api/version') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ version: '0.40.18' })); return; }
      const body = raw ? JSON.parse(raw) : {};
      calls.push({ path: req.url ?? '', body });
      const system: string = body.messages?.[0]?.content ?? '';
      let content: string;
      if (/soạn câu hỏi kiểm tra/.test(system)) {
        content = JSON.stringify([{ qtype: 'single', prompt: 'Ai chỉ huy quân Trần ở Bạch Đằng năm 1288?', options: ['Trần Hưng Đạo', 'Lê Lợi', 'Ngô Quyền', 'Quang Trung'], correct: 0, explanation: 'Theo tư liệu.', difficulty: 1 }]);
      } else content = 'Quân Trần cắm cọc để **bẫy thủy quân Nguyên** [1]. Số lạ [9]. Ý soạn sẵn [dap_an_chuan].\n\nGỢI Ý:\n- Ai chỉ huy trận Bạch Đằng?\n- Thủy triều giúp gì?\n- Kết quả ra sao?';
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      const line = (o: unknown) => res.write(`${JSON.stringify(o)}\n`);
      if (body.think) for (const part of THOUGHT.match(/.{1,40}/g) ?? []) line({ message: { role: 'assistant', content: '', thinking: part }, done: false });
      for (const part of content.match(/[\s\S]{1,30}/g) ?? []) line({ message: { role: 'assistant', content: part }, done: false });
      line({ message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop', prompt_eval_count: 850, eval_count: 120 });
      res.end();
    });
  });
  return new Promise<{ url: string; calls: typeof calls; state: typeof state; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, calls, state, close: () => new Promise((r) => server.close(() => r())) }));
  });
}

(hasPostgres() ? describe : describe.skip)('Gemma 4 trên GPU máy giáo viên – ưu tiên Gemma, máy chưa chạy thì dùng phương án cũ', () => {
  let ollama: Awaited<ReturnType<typeof fakeOllama>>;
  const saved: Record<string, string | undefined> = {};
  const GEMMA_ENV = ['GEMMA_URL', 'GEMMA_WORKER_KEY', 'GEMMA_HEALTH_MS', 'GEMMA_TIMEOUT_MS', 'GEMMA_MODEL', 'GEMMA_THINK'];

  beforeAll(async () => {
    ollama = await fakeOllama();
    for (const k of GEMMA_ENV) saved[k] = process.env[k];
    Object.assign(process.env, { GEMMA_URL: ollama.url, GEMMA_WORKER_KEY: WORKER_KEY, GEMMA_HEALTH_MS: '0', GEMMA_TIMEOUT_MS: '8000', GEMMA_MODEL: 'gemma4:e4b', GEMMA_THINK: 'on' });
    s = await startApp('ai_gemma_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken, true);
    await publishSeed(s.base, f.root);
    expect((await call(s.base, 'POST', '/api/ai/admin/reindex', {}, f.root)).status).toBe(200);
  });
  afterAll(async () => {
    await s?.close();
    await ollama?.close();
    for (const k of GEMMA_ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });

  test('Ollama trên cùng máy: Tiểu Tướng trả lời bằng Gemma 4 theo bộ quy tắc, bật suy luận; phần suy luận được lưu và trả kèm', async () => {
    ollama.state.down = false;
    const st = (await as(f.S1)('GET', '/api/ai/status')).body;
    expect(st).toMatchObject({ mode: 'llm', ready: true, roleplay: true, gemma: { enabled: true, online: true, via: 'local', model: 'gemma4:e4b' } });
    expect((await call(s.base, 'GET', '/api/health')).body.gemma).toMatchObject({ enabled: true, online: true, via: 'local' });
    const before = ollama.calls.length;
    const res = await as(f.S1)('POST', '/api/ai/ask', { question: 'Vì sao quân Trần cắm cọc trên sông Bạch Đằng?' });
    expect(res.status).toBe(200);
    const m = res.body.message;
    expect(m).toMatchObject({ role: 'assistant', refused: false, answer_mode: 'llm', model: 'gemma4:e4b', thinking: THOUGHT });
    expect(m.thinking_ms).toBeGreaterThanOrEqual(0);
    expect(m.content).toMatch(/bẫy thủy quân Nguyên/);
    expect(m.content).not.toMatch(/\[9\]/); // số trích dẫn không có thật bị bỏ
    expect(m.content).toContain('Số lạ.'); // bỏ cả khoảng trắng đứng trước số trích dẫn
    expect(m.content).toContain('Ý soạn sẵn.'); // "trích dẫn" bằng tên thẻ cũng bị bỏ
    expect(m.content).not.toMatch(/dap_an_chuan/);
    expect(m.followups).toEqual(['Ai chỉ huy trận Bạch Đằng?', 'Thủy triều giúp gì?', 'Kết quả ra sao?']);
    expect(m.citations[0]).toMatchObject({ n: 1 });
    // yêu cầu gửi Ollama: bật suy luận, bộ quy tắc, tư liệu và câu hỏi trong thẻ, token cho phần suy luận
    const req = ollama.calls.slice(before).find((c) => c.path === '/api/chat')!.body;
    expect(req).toMatchObject({ model: 'gemma4:e4b', stream: true, think: true, options: { num_predict: expect.any(Number), num_ctx: 8192 } });
    expect(req.options.num_predict).toBeGreaterThan(1536);
    const system: string = req.messages[0].content;
    for (const part of ['# VAI TRÒ', '# QUY TẮC BẮT BUỘC', 'CHỈ DÙNG TƯ LIỆU', 'GIỮ VAI', '# CÁCH SUY NGHĨ', '# VÍ DỤ', 'GỢI Ý:', 'học sinh THCS']) expect(system).toContain(part);
    const user: string = req.messages[req.messages.length - 1].content;
    expect(user).toMatch(/<tu_lieu>\n\[1\] \(/);
    expect(user).toContain('<cau_hoi>Vì sao quân Trần cắm cọc trên sông Bạch Đằng?</cau_hoi>');
    // lưu phần suy luận; không tính token vào chi phí AI (chạy trên máy giáo viên)
    const row = (await db.query<{ thinking: string; thinking_ms: number; tokens_in: number; tokens_out: number; model: string }>('SELECT thinking, thinking_ms, tokens_in, tokens_out, model FROM hk_ai_messages WHERE id = $1', [m.id]))[0];
    expect(row).toMatchObject({ thinking: THOUGHT, tokens_in: 0, tokens_out: 0, model: 'gemma4:e4b' });
    expect(row.thinking_ms).toBeGreaterThanOrEqual(0);
    const detail = (await as(f.S1)('GET', `/api/ai/conversations/${res.body.conversation.id}`)).body;
    expect(detail.messages[1]).toMatchObject({ thinking: THOUGHT, model: 'gemma4:e4b' });
    // hỏi tiếp trong cùng cuộc trò chuyện: lịch sử chỉ gồm câu trả lời cuối, không kèm phần suy luận
    const again = await as(f.S1)('POST', '/api/ai/ask', { question: 'Còn thủy triều thì sao?', conversation_id: res.body.conversation.id });
    expect(again.status).toBe(200);
    const req2 = ollama.calls[ollama.calls.length - 1].body;
    expect(req2.messages.length).toBeGreaterThanOrEqual(4);
    expect(req2.messages.some((x: any) => x.role === 'assistant' && String(x.content).includes(THOUGHT))).toBe(false);
  });

  test('giáo viên: giọng thầy cô; công cụ soạn câu hỏi chạy bằng Gemma không suy luận (câu trả lời dài)', async () => {
    ollama.state.down = false;
    const before = ollama.calls.length;
    const res = await as(f.T1)('POST', '/api/ai/ask', { question: 'Trận Bạch Đằng năm 1288 diễn ra thế nào?' });
    expect(res.status).toBe(200);
    expect(ollama.calls.slice(before)[0].body.messages[0].content).toContain('thầy cô dạy Lịch sử THCS');
    const text = 'Năm 1288 quân Trần đánh tan thủy quân Nguyên trên sông Bạch Đằng. Trước đó năm 1287 quân Nguyên kéo sang lần thứ ba. Trận Vân Đồn cuối năm 1287 làm giặc thiếu lương.';
    const d = await as(f.T1)('POST', '/api/ai/teacher/question-drafts', { kind: 'text', text, count: 1 });
    expect(d.status).toBe(200);
    expect(d.body).toMatchObject({ mode: 'llm' });
    expect(d.body.drafts[0]).toMatchObject({ prompt: 'Ai chỉ huy quân Trần ở Bạch Đằng năm 1288?' });
    expect(ollama.calls[ollama.calls.length - 1].body.think).toBe(false);
  });

  test('máy giáo viên tắt Ollama và không có người nhận việc: dùng phương án cũ (trích tư liệu), không có phần suy luận', async () => {
    ollama.state.down = true;
    const res = await as(f.S2)('POST', '/api/ai/ask', { question: 'Trận Bạch Đằng diễn ra như thế nào?' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatchObject({ refused: false, answer_mode: 'extractive', thinking: null });
    expect((await as(f.S2)('GET', '/api/ai/status')).body.gemma).toMatchObject({ online: false });
  });

  test('người nhận việc (máy có GPU, website trên máy chủ khác): khóa sai bị từ chối; hỏi việc, nhận câu hỏi, gửi kết quả', async () => {
    ollama.state.down = true; // gọi trực tiếp không được, chỉ còn đường người nhận việc
    const poll = (key: string, body: Record<string, unknown> = {}) => fetch(`${s.base}/api/ai/gemma/poll`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gemma-key': key }, body: JSON.stringify(body) });
    const result = (key: string, body: Record<string, unknown>) => fetch(`${s.base}/api/ai/gemma/result`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gemma-key': key }, body: JSON.stringify(body) });
    expect((await poll('khoa-sai-hoan-toan-khong-dung')).status).toBe(401);
    expect((await fetch(`${s.base}/api/ai/gemma/result`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(401);
    // người nhận việc giả: hỏi việc liên tục, có việc thì trả lời kèm phần suy luận
    let running = true;
    const seen: any[] = [];
    const worker = (async () => {
      while (running) {
        const r = await poll(WORKER_KEY, { model: 'gemma4:e4b', ollama: '0.40.18', gpu: 'GPU thử nghiệm' });
        if (r.status !== 200) continue;
        const { job } = await r.json() as { job: any };
        seen.push(job);
        const accepted = await (await result(WORKER_KEY, {
          id: job.id, ok: true, model: 'gemma4:e4b', thinking: 'Suy nghĩ của máy có GPU, đối chiếu <dap_an_chuan> [dap_an_chuan].\n\nConstraint Checklist & Confidence Score:\n1. Yes.\nStrategizing complete.', thinking_ms: 4200, tokens_in: 900, tokens_out: 80,
          content: 'Trận Bạch Đằng năm 1288 quân Trần thắng lớn [1].\n\nGỢI Ý:\n- Ai chỉ huy?\n- Vì sao thắng?\n- Ý nghĩa là gì?',
        })).json() as { accepted: boolean };
        expect(accepted.accepted).toBe(true);
      }
    })();
    // chờ người nhận việc kịp hỏi việc lần đầu
    for (let i = 0; i < 50 && !(await as(f.S2)('GET', '/api/ai/status')).body.gemma?.online; i += 1) await new Promise((r) => setTimeout(r, 100));
    const st = (await as(f.S2)('GET', '/api/ai/status')).body;
    expect(st.gemma).toMatchObject({ online: true, via: 'worker', model: 'gemma4:e4b' });
    const res = await as(f.S2)('POST', '/api/ai/ask', { question: 'Trận Bạch Đằng năm 1288 có kết quả gì?' });
    running = false;
    expect(res.status).toBe(200);
    // bảng tự kiểm tiếng Anh Gemma hay viết cuối phần suy nghĩ bị cắt, học sinh chỉ thấy phần tiếng Việt
    expect(res.body.message).toMatchObject({ answer_mode: 'llm', model: 'gemma4:e4b', thinking: 'Suy nghĩ của máy có GPU, đối chiếu đáp án chuẩn (đáp án chuẩn).', thinking_ms: 4200, followups: ['Ai chỉ huy?', 'Vì sao thắng?', 'Ý nghĩa là gì?'] });
    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(seen[0]).toMatchObject({ think: true, options: { num_ctx: 8192 } });
    expect(seen[0].messages[0].role).toBe('system');
    expect(seen[0]).not.toHaveProperty('model'); // máy nhận việc dùng mô hình đã cài của nó
    // kết quả của việc không còn (đã quá hạn) thì không được nhận
    expect(await (await result(WORKER_KEY, { id: 'khong-co', ok: true, content: 'x' })).json()).toEqual({ accepted: false });
    await Promise.race([worker, new Promise((r) => setTimeout(r, 27_000))]);
  }, 60_000);
});
