/**
 * Gemma 4 E4B (Ollama) trên GPU của máy giáo viên – 27/11/2026, thay cho gọi API mô hình ngôn ngữ. Khi máy giáo viên chưa chạy, AI Tutor dùng phương án cũ
 * (mô hình NLP Python, API đã cấu hình ở llm.client.ts, hoặc trích tư liệu) nên website không bao giờ "chết" theo máy giáo viên.
 * Hai đường nối, ưu tiên theo thứ tự:
 *  1. Trực tiếp: backend chạy cùng máy với Ollama (GEMMA_URL, vd. http://127.0.0.1:11434) → POST {GEMMA_URL}/api/chat.
 *  2. Người nhận việc: máy có GPU chạy `npm run gemma:worker` (backend/scripts/gemma-worker.mjs), tự hỏi máy chủ xin việc qua HTTPS
 *     (POST /api/ai/gemma/poll, máy chủ giữ kết nối tối đa 25 giây), trả lời bằng Ollama của máy đó rồi gửi kết quả (POST /api/ai/gemma/result).
 *     Máy chủ (Render) không cần mở cổng vào máy giáo viên, Ollama vẫn chỉ nghe ở 127.0.0.1; hai đầu dùng chung khóa GEMMA_WORKER_KEY.
 * "Máy chưa chạy" = không gọi trực tiếp được và không có người nhận việc nào hỏi việc trong 40 giây gần nhất → available() trả false.
 * Suy luận (thinking): gửi "think": true; Ollama trả phần suy luận riêng (message.thinking), thời gian suy nghĩ đo tới chữ đầu tiên của câu trả lời.
 */
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { config } from '../config';
import { LlmError, LlmMessage } from './llm.client';

export interface GemmaRequest { system: string; messages: LlmMessage[]; temperature: number; maxTokens: number; think?: boolean }
export interface GemmaResult { text: string; thinking: string; thinkingMs: number; tokensIn: number; tokensOut: number; model: string; via: 'local' | 'worker'; ms: number }
/** Một việc cho người nhận việc: phần thân POST /api/chat của Ollama, trừ tên mô hình (máy nhận việc dùng mô hình đã cài trên máy đó) */
export interface GemmaJob {
  id: string; think: boolean;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  options: { temperature: number; num_predict: number; num_ctx: number };
}
/** Kết quả người nhận việc gửi về (POST /api/ai/gemma/result) */
export interface GemmaWorkerResult {
  id?: unknown; ok?: unknown; content?: unknown; thinking?: unknown; thinking_ms?: unknown; tokens_in?: unknown; tokens_out?: unknown; model?: unknown; error?: unknown;
}
export interface GemmaWorkerInfo { model?: unknown; ollama?: unknown; gpu?: unknown }

/** Token thêm cho phần suy luận, ngoài giới hạn của câu trả lời */
const THINK_BUDGET = 1536;
/** Cửa sổ ngữ cảnh: đủ cho quy tắc + 5 đoạn tư liệu + vài lượt trò chuyện, nhỏ để vừa bộ nhớ GPU 6 GB */
const NUM_CTX = 8192;
const POLL_HOLD_MS = 25_000;
const WORKER_ONLINE_MS = 40_000;
/** Câu hỏi chờ người nhận việc quá lâu (máy đang bận câu khác hoặc vừa tắt) thì trả lời bằng phương án cũ */
const PICKUP_MS = 15_000;
const MAX_THINKING = 20_000;

export function ollamaJob(req: GemmaRequest, think: boolean): Omit<GemmaJob, 'id'> {
  return {
    think,
    messages: [{ role: 'system', content: req.system }, ...req.messages],
    options: { temperature: req.temperature, num_predict: req.maxTokens + (think ? THINK_BUDGET : 0), num_ctx: NUM_CTX },
  };
}

/** Phòng khi mẫu hội thoại không tách được phần suy luận: chuyển đoạn <|channel>thought … <channel|> (Gemma 4) hoặc <think> … </think> sang phần suy luận */
export function splitThought(content: string, thinking = ''): { text: string; thinking: string } {
  let text = content;
  let thought = thinking;
  for (const re of [/<\|channel>thought\s*([\s\S]*?)<channel\|>/g, /<think>([\s\S]*?)<\/think>/g]) {
    text = text.replace(re, (_all, inner: string) => { thought = `${thought}${thought ? '\n' : ''}${inner.trim()}`; return ''; });
  }
  // bỏ các token điều khiển còn sót của mẫu hội thoại Gemma (<|turn>, <turn|>, <|think|>…); chỉ khớp dạng có dấu "|" nên không đụng chữ thường
  return { text: text.replace(/<\|[a-z_]+\|?>|<[a-z_]+\|>/gi, '').trim(), thinking: tidyThinking(thought) };
}

/** Đoạn kết Gemma 4 hay tự thêm sau các bước suy nghĩ: bảng tự kiểm bằng tiếng Anh ("Constraint Checklist & Confidence Score", "Strategizing complete…") */
const THOUGHT_TAIL = /\n[\s*#]*(?:Constraint Checklist|Confidence Score|Mental Sandbox|Strategizing complete|I will now (?:write|generate|draft))/i;

/** Học sinh chỉ cần thấy các bước suy nghĩ tiếng Việt (B1–B4): cắt đoạn tự kiểm tiếng Anh ở cuối, giới hạn độ dài */
export function tidyThinking(thought: string): string {
  const s = thought.trim();
  const m = THOUGHT_TAIL.exec(s);
  const head = m ? s.slice(0, m.index).trim() : '';
  // tên thẻ dữ liệu của bộ quy tắc (<tu_lieu>, <dap_an_chuan>…) đổi thành chữ thường cho dễ đọc
  return (head || s)
    .replace(/\[(tu_lieu|dap_an_chuan|ho_so_hoc_tap|cau_hoi)\]/g, (_all, tag: keyof typeof TAG_WORDS) => `(${TAG_WORDS[tag]})`)
    .replace(/<\/?(tu_lieu|dap_an_chuan|ho_so_hoc_tap|cau_hoi)>/g, (_all, tag: keyof typeof TAG_WORDS) => TAG_WORDS[tag])
    .slice(0, MAX_THINKING);
}

const TAG_WORDS = { tu_lieu: 'tư liệu', dap_an_chuan: 'đáp án chuẩn', ho_so_hoc_tap: 'hồ sơ học tập', cau_hoi: 'câu hỏi' } as const;

/** Đọc phản hồi NDJSON của Ollama (stream: true): gom phần suy luận và câu trả lời, đo thời gian tới chữ đầu tiên của câu trả lời */
export async function readOllamaStream(body: ReadableStream<Uint8Array>, startedAt: number): Promise<{ text: string; thinking: string; thinkingMs: number; tokensIn: number; tokensOut: number; doneReason: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '', thinking = '', content = '', firstContentAt = 0, tokensIn = 0, tokensOut = 0, doneReason = '';
  const take = (line: string): void => {
    if (!line.trim()) return;
    let j: any;
    try { j = JSON.parse(line); } catch { return; }
    if (j.error) throw new LlmError(`Gemma báo lỗi: ${String(j.error).slice(0, 200)}`);
    const m = j.message ?? {};
    if (typeof m.thinking === 'string' && m.thinking) thinking += m.thinking;
    if (typeof m.content === 'string' && m.content) { if (!firstContentAt) firstContentAt = Date.now(); content += m.content; }
    if (j.done) { tokensIn = Number(j.prompt_eval_count ?? 0); tokensOut = Number(j.eval_count ?? 0); doneReason = String(j.done_reason ?? ''); }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) { take(buf.slice(0, i)); buf = buf.slice(i + 1); }
  }
  take(buf + decoder.decode());
  const parts = splitThought(content, thinking);
  return { text: parts.text, thinking: parts.thinking, thinkingMs: parts.thinking ? (firstContentAt || Date.now()) - startedAt : 0, tokensIn, tokensOut, doneReason };
}

interface Pending { job: GemmaJob; started: number; resolve: (r: GemmaResult) => void; reject: (e: Error) => void; timers: NodeJS.Timeout[] }
type Waiter = (job: GemmaJob | null) => void;

@Injectable()
export class GemmaClient {
  private readonly logger = new Logger('Gemma');
  private health: { at: number; ok: boolean } | null = null;
  private worker: { at: number; model: string | null; ollama: string | null; gpu: string | null } = { at: 0, model: null, ollama: null, gpu: null };
  private queue: Pending[] = [];
  private readonly running = new Map<string, Pending>();
  private waiters: Waiter[] = [];
  private readonly healthMs = Number.isFinite(config.gemmaHealthMs) && config.gemmaHealthMs >= 0 ? config.gemmaHealthMs : 15_000;

  /** Có bật Gemma không (đặt GEMMA_URL hoặc GEMMA_WORKER_KEY) */
  get enabled(): boolean { return Boolean(config.gemmaUrl || this.workerKeyValid); }
  private get workerKeyValid(): boolean { return config.gemmaWorkerKey.length >= 16; }

  // ------------------------------------------------------------------ trạng thái
  private async directUp(): Promise<boolean> {
    if (!config.gemmaUrl) return false;
    if (this.health && Date.now() - this.health.at < this.healthMs) return this.health.ok;
    let ok = false;
    try { ok = (await fetch(`${config.gemmaUrl}/api/version`, { signal: AbortSignal.timeout(1500) })).ok; } catch { ok = false; }
    this.health = { at: Date.now(), ok };
    return ok;
  }

  private workerOnline(): boolean {
    if (!this.workerKeyValid) return false;
    return this.waiters.length > 0 || this.running.size > 0 || Date.now() - this.worker.at < WORKER_ONLINE_MS;
  }

  /** Máy giáo viên đang chạy Gemma (gọi trực tiếp được hoặc có người nhận việc) */
  async available(): Promise<boolean> {
    if (!this.enabled) return false;
    return (await this.directUp()) || this.workerOnline();
  }

  /** Trạng thái công khai cho /api/health và /api/ai/status (không lộ tên máy, cấu hình máy giáo viên) */
  publicStatus(): { enabled: boolean; online: boolean; via: 'local' | 'worker' | null; model: string | null; last_seen: string | null } {
    const direct = Boolean(config.gemmaUrl && this.health?.ok);
    const worker = this.workerOnline();
    return {
      enabled: this.enabled, online: direct || worker, via: direct ? 'local' : worker ? 'worker' : null,
      model: direct ? config.gemmaModel : worker ? this.worker.model ?? config.gemmaModel : null,
      last_seen: this.worker.at ? new Date(this.worker.at).toISOString() : null,
    };
  }

  // ------------------------------------------------------------------ trả lời
  async chat(req: GemmaRequest): Promise<GemmaResult> {
    const think = req.think ?? config.gemmaThink;
    if (await this.directUp()) return this.direct(req, think);
    if (this.workerOnline()) return this.viaWorker(req, think);
    throw new LlmError('Gemma chưa chạy trên máy giáo viên.');
  }

  private async direct(req: GemmaRequest, think: boolean): Promise<GemmaResult> {
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(`${config.gemmaUrl}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(config.gemmaTimeoutMs),
        body: JSON.stringify({ model: config.gemmaModel, stream: true, keep_alive: '30m', ...ollamaJob(req, think) }),
      });
    } catch (e) {
      this.health = { at: Date.now(), ok: false };
      throw new LlmError((e as Error).name === 'TimeoutError' ? 'Gemma trả lời quá chậm.' : 'Không kết nối được tới Ollama trên máy này.');
    }
    if (!res.ok || !res.body) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      throw new LlmError(`Ollama trả lỗi ${res.status}${detail ? `: ${detail}` : ''}`, res.status);
    }
    let out: Awaited<ReturnType<typeof readOllamaStream>>;
    try { out = await readOllamaStream(res.body, started); } catch (e) {
      if (e instanceof LlmError) throw e;
      throw new LlmError((e as Error).name === 'TimeoutError' || (e as Error).name === 'AbortError' ? 'Gemma trả lời quá chậm.' : 'Mất kết nối với Ollama khi đang trả lời.');
    }
    if (!out.text) throw new LlmError(out.doneReason === 'length' ? 'Gemma dùng hết giới hạn token khi đang suy nghĩ.' : 'Gemma không trả nội dung.');
    return { text: out.text, thinking: out.thinking, thinkingMs: out.thinkingMs, tokensIn: out.tokensIn, tokensOut: out.tokensOut, model: config.gemmaModel, via: 'local', ms: Date.now() - started };
  }

  private viaWorker(req: GemmaRequest, think: boolean): Promise<GemmaResult> {
    return new Promise<GemmaResult>((resolve, reject) => {
      const p: Pending = { job: { id: randomUUID(), ...ollamaJob(req, think) }, started: Date.now(), resolve, reject, timers: [] };
      const fail = (message: string): void => { if (this.drop(p.job.id)) reject(new LlmError(message)); };
      p.timers.push(setTimeout(() => { if (!this.running.has(p.job.id)) fail('Máy có GPU đang bận hoặc vừa tắt, chưa nhận câu hỏi.'); }, PICKUP_MS));
      p.timers.push(setTimeout(() => fail('Gemma trên máy giáo viên trả lời quá chậm.'), config.gemmaTimeoutMs));
      this.queue.push(p);
      this.dispatch();
    });
  }

  /** Giao việc đang chờ cho người nhận việc đang hỏi việc */
  private dispatch(): void {
    while (this.queue.length && this.waiters.length) {
      const p = this.queue.shift()!;
      this.running.set(p.job.id, p);
      this.waiters.shift()!(p.job);
    }
  }

  /** Bỏ một việc khỏi hàng chờ / đang chạy; trả true nếu việc còn tồn tại (chưa ai giải quyết) */
  private drop(id: string): boolean {
    const p = this.running.get(id) ?? this.queue.find((x) => x.job.id === id);
    if (!p) return false;
    this.running.delete(id);
    this.queue = this.queue.filter((x) => x.job.id !== id);
    p.timers.forEach(clearTimeout);
    return true;
  }

  // ------------------------------------------------------------------ người nhận việc (máy có GPU)
  /** So khóa người nhận việc: 'off' khi máy chủ chưa đặt GEMMA_WORKER_KEY (hoặc khóa quá ngắn) */
  checkKey(given: unknown): 'off' | 'bad' | 'ok' {
    if (!this.workerKeyValid) return 'off';
    const a = createHash('sha256').update(String(given ?? '')).digest();
    const b = createHash('sha256').update(config.gemmaWorkerKey).digest();
    return timingSafeEqual(a, b) ? 'ok' : 'bad';
  }

  /**
   * Người nhận việc hỏi việc: trả ngay việc đang chờ, không có thì giữ kết nối tối đa 25 giây. `cancel()` gọi khi kết nối bị đóng trước khi gửi xong:
   * nếu việc đã giao cho kết nối đó thì đưa việc về đầu hàng chờ để lần hỏi sau nhận lại.
   */
  poll(info: GemmaWorkerInfo): { job: Promise<GemmaJob | null>; cancel: () => void } {
    const str = (v: unknown, n: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
    this.worker = { at: Date.now(), model: str(info.model, 60) ?? this.worker.model, ollama: str(info.ollama, 20) ?? this.worker.ollama, gpu: str(info.gpu, 80) ?? this.worker.gpu };
    let given: GemmaJob | null = null;
    let settled = false;
    let waiter: Waiter | null = null;
    const job = new Promise<GemmaJob | null>((resolve) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        this.worker.at = Date.now();
        settled = true;
        resolve(null);
      }, POLL_HOLD_MS);
      waiter = (j) => { clearTimeout(timer); given = j; settled = true; resolve(j); };
      this.waiters.push(waiter);
      this.dispatch();
    });
    const cancel = (): void => {
      if (!settled) { this.waiters = this.waiters.filter((w) => w !== waiter); return; }
      const j = given as GemmaJob | null;
      if (!j) return;
      const p = this.running.get(j.id);
      if (!p) return;
      this.running.delete(j.id);
      this.queue.unshift(p);
      this.dispatch();
    };
    return { job, cancel };
  }

  /** Kết quả người nhận việc gửi về; trả false khi việc không còn (đã quá hạn và trả lời bằng phương án cũ) */
  result(r: GemmaWorkerResult): boolean {
    this.worker.at = Date.now();
    const id = typeof r.id === 'string' ? r.id : '';
    const p = this.running.get(id);
    if (!p || !this.drop(id)) return false;
    if (r.ok !== true) {
      p.reject(new LlmError(`Gemma trên máy giáo viên báo lỗi: ${String(r.error ?? 'không rõ').slice(0, 200)}`));
      return true;
    }
    const parts = splitThought(String(r.content ?? ''), typeof r.thinking === 'string' ? r.thinking : '');
    if (!parts.text) { p.reject(new LlmError('Gemma trên máy giáo viên không trả nội dung.')); return true; }
    const n = (v: unknown): number => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : 0);
    p.resolve({
      text: parts.text.slice(0, 8000), thinking: parts.thinking, thinkingMs: parts.thinking ? n(r.thinking_ms) : 0, tokensIn: n(r.tokens_in), tokensOut: n(r.tokens_out),
      model: (typeof r.model === 'string' && r.model.trim() ? r.model.trim() : this.worker.model ?? config.gemmaModel).slice(0, 60), via: 'worker', ms: Date.now() - p.started,
    });
    return true;
  }

  /** Kiểm tra nhanh cho trang quản trị: một lượt trả lời ngắn, không suy luận */
  async ping(): Promise<{ online: boolean; via: 'local' | 'worker' | null; model: string | null; ms: number | null; sample: string | null; error: string | null }> {
    if (!(await this.available())) return { online: false, via: null, model: null, ms: null, sample: null, error: this.enabled ? 'Máy giáo viên chưa chạy Gemma' : 'Chưa bật Gemma (GEMMA_URL / GEMMA_WORKER_KEY)' };
    try {
      const r = await this.chat({ system: 'Trả lời đúng một từ.', messages: [{ role: 'user', content: 'Nói "ok".' }], temperature: 0, maxTokens: 20, think: false });
      return { online: true, via: r.via, model: r.model, ms: r.ms, sample: r.text.slice(0, 40), error: null };
    } catch (e) {
      this.logger.warn(`Kiểm tra Gemma lỗi: ${(e as Error).message}`);
      return { online: false, via: null, model: null, ms: null, sample: null, error: (e as Error).message };
    }
  }
}
