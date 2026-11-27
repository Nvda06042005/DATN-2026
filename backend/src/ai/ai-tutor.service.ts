/**
 * AI Tutor "Tiểu Tướng" (Sprint 9, HK.HS.086–093, HK.GV.073, HK.SYS.009–010): hỏi đáp dựa trên tư liệu đã công bố (RAG), trích dẫn nguồn, gợi ý câu hỏi tiếp theo,
 * giải thích câu làm sai, tóm tắt bài / trận đánh, nhập vai nhân vật, lịch sử trò chuyện và báo cáo câu trả lời sai.
 * Quy trình mỗi câu hỏi: kiểm tra độ dài và hạn mức → lọc nội dung → truy xuất → kiểm soát phạm vi (đoạn tốt nhất phải đủ "độ phủ") → mô hình sinh câu trả lời kèm [n]
 * (hoặc trích nguyên văn tư liệu khi chưa nối mô hình) → lọc lại đầu ra → lưu hội thoại. Máy chủ không bao giờ tin số liệu do mô hình tự nêu: trích dẫn chỉ gồm các đoạn đã truy xuất.
 */
import { ErrorLog } from '../platform/error-log';
import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { createInterface } from 'readline';
import { join } from 'path';
import { existsSync } from 'fs';
import { DatabaseService, UserRow } from '../database/database.service';
import { notFound } from '../content/access';
import { citedNumbers, sentences, unsafeReason, words } from './ai-text';
import { kindLabel, lessonText } from './ai-index.service';
import { AiRetrievalService, Passage } from './ai-retrieval.service';
import { AiSettings, AiSettingsService } from './ai-settings.service';
import { LlmClient, LlmConfig, LlmMessage } from './llm.client';
import { AnalyticsService } from '../analytics/analytics.service';
import { GameService } from '../game/game.service';
import { buildNodeBktRecommendations, buildProfilePromptContext, enrichBktResponse } from './bkt-profile';
import { engineHealth, bridgeReadyMs, bridgeRequestMs, markEngine, memoryRoom, pythonCommand, shapePythonAnswer, warmOnBoot } from './python-runtime';
import { config } from '../config';
import { GemmaClient } from './gemma.client';
import { gemmaProfile, gemmaSystemPrompt, gemmaUserMessage, splitAnswer } from './gemma-rules';

export interface Citation { n: number; kind: string; kind_label: string; id: number; title: string; snippet: string; openable: boolean }
export type RefusalReason = 'out_of_scope' | 'unsafe' | 'quota' | 'not_configured';
export interface Answer {
  text: string; citations: Citation[]; followups: string[]; refused: boolean; reason: RefusalReason | null; mode: 'llm' | 'extractive' | null;
  model: string | null; tokensIn: number; tokensOut: number; topScore: number | null; passages: Passage[];
  /** Phần suy luận của Gemma 4 (thinking) và thời gian suy nghĩ; hiện thu gọn dưới câu trả lời */
  thinking?: string | null; thinkingMs?: number | null;
}
/** Mô hình ngôn ngữ của một lượt: Gemma 4 trên GPU máy giáo viên (ưu tiên) hoặc API cũ đã cấu hình */
export type LanguageModel = { kind: 'gemma' } | { kind: 'api'; cfg: LlmConfig };
export interface ModelReply { text: string; tokensIn: number; tokensOut: number; model: string; thinking: string | null; thinkingMs: number | null }
/** Số lượt trò chuyện gần nhất gửi kèm cho Gemma (chỉ câu trả lời cuối, không kèm phần suy luận – hướng dẫn của Gemma 4) */
const GEMMA_HISTORY = 6;

/** Loại tư liệu mà màn chi tiết của học sinh mở được */
const OPENABLE = new Set(['figure', 'event', 'place', 'battle', 'source', 'term']);
export const MODES_BY_ROLE: Record<string, string[]> = {
  student: ['tutor', 'roleplay', 'explain', 'summary'],
  teacher: ['teacher', 'questions', 'plan', 'summary'],
  school_admin: ['teacher', 'questions', 'plan', 'summary'],
  root_admin: ['teacher', 'questions', 'plan', 'summary'],
};
const UNSAFE_MESSAGE = 'Tiểu Tướng không trả lời nội dung này. Em hãy hỏi về lịch sử thời Trần nhé!';
const VN_DAY_START = "(date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')";

const FOLLOWUP: Record<string, (t: string) => string> = {
  figure: (t) => `${t} là ai và có vai trò gì trong cuộc kháng chiến?`,
  battle: (t) => `${/^trận/i.test(t) ? t : `Trận ${t}`} diễn ra như thế nào?`,
  event: (t) => `${t} có ý nghĩa gì?`,
  place: (t) => `${t} có vai trò gì trong cuộc kháng chiến?`,
  term: (t) => `${t} nghĩa là gì?`,
  source: (t) => `Tư liệu “${t}” nói về điều gì?`,
  campaign: (t) => `${t} diễn ra như thế nào?`,
  lesson: (t) => `Bài “${t}” có những ý chính nào?`,
  doc: (t) => `Tài liệu “${t}” nói gì?`,
};
const short = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Danh tướng nhập vai mặc định (slug trong kho lịch sử, migration 016): dùng khi mô hình NLP Đông A (Python) đang chạy */
/** Thời gian tối đa một yêu cầu chờ mô hình Python đang khởi động */
const ENGINE_WAIT_MS = 25_000;
/** Mô hình Python đang chạy hoặc đang khởi động (câu hỏi gửi lúc khởi động sẽ chờ mô hình sẵn sàng) */
const pythonOn = (): boolean => { const st = engineHealth().status; return st === 'ready' || st === 'starting'; };
const ROLEPLAY_SLUGS = ['tran-hung-dao', 'tran-quoc-toan', 'tran-thu-do', 'tran-binh-trong', 'tran-nhan-tong', 'tran-khanh-du', 'pham-ngu-lao', 'yet-kieu'];

@Injectable()
export class AiTutorService implements OnModuleDestroy {
  private readonly logger = new Logger('AiTutor');
  private pyProc: ChildProcessWithoutNullStreams | null = null;
  private pyReadyPromise: Promise<boolean> | null = null;
  private pyIsReady = false;
  private nextReqId = 1;
  private readonly pendingReqs = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();

  constructor(
    private readonly db: DatabaseService, private readonly settings: AiSettingsService, private readonly retrieval: AiRetrievalService, private readonly llm: LlmClient,
    private readonly gemma: GemmaClient,
    @Optional() private readonly analytics?: AnalyticsService,
    @Optional() private readonly game?: GameService,
  ) {}

  /** Nhiệm vụ hằng ngày "Hỏi Tiểu Tướng 1 câu về sử Trần" (25/11/2026): đếm mỗi câu hỏi của học sinh được trả lời; lỗi đếm không làm hỏng câu trả lời */
  private async countAsk(user: UserRow): Promise<void> {
    if (user.role !== 'student' || !this.game || !this.db.ready) return;
    await this.db.tx((q) => this.game!.bumpQuests(q, user, 'ai_questions', 1)).catch(() => undefined);
  }

  /** Render: nạp sẵn mô hình Python sau khi backend khởi động (python-runtime.ts) để câu hỏi đầu tiên không phải chờ */
  /**
   * Nạp lại mô hình Python khi lịch keep-alive gọi /api/health?warm=ai (17/11/2026): chỉ trên máy chủ bật nạp sẵn (Render), khi mô hình chưa chạy;
   * lần thử trước thất bại chưa quá 3 phút thì chờ (tránh khởi động liên tục khi thiếu bộ nhớ). Trả true nếu vừa bắt đầu nạp.
   */
  warm(): boolean {
    const h = engineHealth();
    if (!warmOnBoot() || h.status === 'ready' || h.status === 'starting') return false;
    if (h.status === 'unavailable' && h.since && Date.now() - Date.parse(h.since) < 180_000) return false;
    void this.ensurePythonBridge();
    return true;
  }

  onModuleInit() {
    if (!warmOnBoot()) return;
    // nạp sẵn mô hình sau khi khởi động; lúc vừa khởi động máy chủ còn bận nên bộ nhớ trống có thể thiếu chút ít (18/11/2026: 277/280 MB) –
    // khi đó thử lại sau 1, 2 rồi 4 phút thay vì để AI ở chế độ dự phòng tới lần gọi sau
    const attempt = (delay: number, left: number) => setTimeout(() => {
      void this.ensurePythonBridge().then((ok) => {
        if (!ok && left > 0 && engineHealth().status === 'unavailable') attempt(delay === 15_000 ? 60_000 : delay * 2, left - 1);
      });
    }, delay).unref();
    attempt(15_000, 3);
  }

  onModuleDestroy() {
    this.pyIsReady = false;
    if (this.pyProc) {
      try { this.pyProc.kill(); } catch {}
      this.pyProc = null;
    }
  }

  private resolveBridgeScript(): string | null {
    const candidates = [
      join(process.cwd(), '..', 'ai', 'bridge_cli.py'),
      join(process.cwd(), 'ai', 'bridge_cli.py'),
      join(__dirname, '..', '..', '..', '..', 'ai', 'bridge_cli.py'),
      join(__dirname, '..', '..', '..', 'ai', 'bridge_cli.py'),
    ];
    for (const c of candidates) {
      if (existsSync(c)) return c;
    }
    return null;
  }

  private ensurePythonBridge(): Promise<boolean> {
    if (process.env.JEST_WORKER_ID) return Promise.resolve(false);
    if (this.pyIsReady && this.pyProc && !this.pyProc.killed) return Promise.resolve(true);
    if (this.pyProc && !this.pyProc.killed && this.pyReadyPromise) return this.pyReadyPromise;
    const scriptPath = this.resolveBridgeScript();
    if (!scriptPath) { markEngine('unavailable', { reason: 'không thấy ai/bridge_cli.py' }); return Promise.resolve(false); }
    // không đủ bộ nhớ thì không chạy Python (tránh sập cả backend); AI dùng chế độ dự phòng
    const room = memoryRoom();
    if (!room.ok) { markEngine('unavailable', { reason: `thiếu bộ nhớ: còn ${room.free_mb}/${room.limit_mb} MB, mô hình cần ${room.need_mb} MB` }); return Promise.resolve(false); }
    const python = pythonCommand();
    const startedAt = Date.now();
    let stderrTail = '';

    this.pyReadyPromise = new Promise<boolean>((resolveReady) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (!settled) {
          settled = true;
          resolveReady(ok);
        }
      };
      try {
        const proc = spawn(python, ['-u', scriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        });
        this.pyProc = proc;
        markEngine('starting', { python, reason: null, pid: proc.pid ?? null });
        proc.stderr.on('data', (d: Buffer) => { stderrTail = (stderrTail + d.toString('utf8')).slice(-600); });
        const rl = createInterface({ input: proc.stdout });
        rl.on('line', (line) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          try {
            const msg = JSON.parse(trimmed);
            if (msg.ready) {
              this.pyIsReady = true;
              markEngine('ready', { readyMs: Date.now() - startedAt });
              this.logger.log(`Đã kết nối Model NLP Đông A Python (${msg.units} chủ điểm, ${msg.train_samples} mẫu huấn luyện)`);
              done(true);
              return;
            }
            if (typeof msg.id === 'number' && this.pendingReqs.has(msg.id)) {
              const p = this.pendingReqs.get(msg.id)!;
              this.pendingReqs.delete(msg.id);
              clearTimeout(p.timer);
              if (msg.ok) p.resolve(msg.result);
              else p.reject(new Error(msg.error || 'Python bridge error'));
            }
          } catch {}
        });
        proc.on('error', (e) => {
          markEngine('unavailable', { reason: `không chạy được ${python}: ${e.message}`, pid: null });
          this.pyProc = null;
          this.pyReadyPromise = null;
          this.pyIsReady = false;
          done(false);
        });
        proc.on('exit', (code) => {
          markEngine('unavailable', { reason: `mô hình Python dừng (mã ${code}): ${stderrTail.trim() || 'không có thông báo lỗi'}`, pid: null });
          this.pyProc = null;
          this.pyReadyPromise = null;
          this.pyIsReady = false;
          for (const [, p] of this.pendingReqs) {
            clearTimeout(p.timer);
            p.reject(new Error('Python bridge exited'));
          }
          this.pendingReqs.clear();
          done(false);
        });
        setTimeout(() => {
          if (!this.pyIsReady) {
            this.pyReadyPromise = null;
            done(false);
          }
        }, bridgeReadyMs());
      } catch {
        this.pyReadyPromise = null;
        this.pyIsReady = false;
        done(false);
      }
    });
    return this.pyReadyPromise;
  }

  /**
   * Đợi mô hình Python sẵn sàng tối đa `ms` (17/11/2026): máy chủ vừa thức dậy / vừa cập nhật thì mô hình cần khoảng 20–60 giây để nạp;
   * trước đây mỗi câu hỏi chờ tới 240 giây nên trình duyệt hết giờ chờ (75 giây) và báo "Không kết nối được máy chủ".
   */
  private async engineReady(ms: number): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const ok = await Promise.race([this.ensurePythonBridge(), new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), ms); })]);
    if (timer) clearTimeout(timer);
    return ok;
  }

  private async callPythonBridge(action: string, payload: Record<string, any>, timeoutMs = bridgeRequestMs()): Promise<any | null> {
    const ready = await this.engineReady(ENGINE_WAIT_MS);
    if (!ready || !this.pyProc) return null;
    const id = this.nextReqId++;
    const asciiSafeJson = JSON.stringify({ id, action, payload }).replace(
      /[\u007f-\uffff]/g,
      (c) => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4),
    );
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingReqs.delete(id);
        resolve(null);
      }, timeoutMs);
      this.pendingReqs.set(id, {
        resolve,
        reject: () => resolve(null),
        timer,
      });
      try {
        this.pyProc!.stdin.write(asciiSafeJson + '\n', 'utf8');
      } catch {
        clearTimeout(timer);
        this.pendingReqs.delete(id);
        resolve(null);
      }
    });
  }

  // ---------------------------------------------------------------------- hạn mức (HK.AD.064)
  async quota(user: UserRow) {
    if (!this.db.ready) {
      return { limit: 50, used: 0, school_limit: 1000, school_used: 0, remaining: 50, unlimited: true };
    }
    const s = await this.settings.get();
    const over = user.school_id ? (await this.db.query<{ daily_per_user: number | null; daily_per_school: number | null }>('SELECT daily_per_user, daily_per_school FROM hk_ai_school_limits WHERE school_id = $1', [user.school_id]))[0] : undefined;
    const factor = user.role === 'student' ? 1 : 3;
    const perUser = (over?.daily_per_user ?? s.daily_per_user) * factor;
    const perSchool = over?.daily_per_school ?? s.daily_per_school;
    const used = Number((await this.db.query<{ n: string }>(
      `SELECT count(*) AS n FROM hk_ai_messages m JOIN hk_ai_conversations c ON c.id = m.conversation_id WHERE c.user_id = $1 AND m.role = 'user' AND m.created_at >= ${VN_DAY_START}`, [user.id]))[0].n);
    const schoolUsed = user.school_id ? Number((await this.db.query<{ n: string }>(
      `SELECT count(*) AS n FROM hk_ai_messages m JOIN hk_ai_conversations c ON c.id = m.conversation_id JOIN app_users u ON u.id = c.user_id WHERE u.school_id = $1 AND m.role = 'user' AND m.created_at >= ${VN_DAY_START}`, [user.school_id]))[0].n) : 0;
    const unlimited = user.role === 'root_admin';
    return { limit: perUser, used, school_limit: perSchool, school_used: schoolUsed, remaining: unlimited ? null : Math.max(0, Math.min(perUser - used, perSchool - schoolUsed)), unlimited };
  }

  async assertQuota(user: UserRow): Promise<void> {
    if (!this.db.ready) return;
    const q = await this.quota(user);
    if (q.unlimited) return;
    if (q.used >= q.limit) throw new HttpException(`Hôm nay em đã dùng hết ${q.limit} lượt hỏi Tiểu Tướng. Ngày mai em quay lại nhé!`, HttpStatus.TOO_MANY_REQUESTS);
    if (q.school_used >= q.school_limit) throw new HttpException('Hôm nay trường của em đã dùng hết lượt hỏi Tiểu Tướng. Em thử lại vào ngày mai nhé!', HttpStatus.TOO_MANY_REQUESTS);
  }

  async status(user: UserRow) {
    if (!this.db.ready) {
      const chunks = await this.retrieval.size().catch(() => 56);
      return { mode: 'grounded', ready: true, chunks: chunks || 56, quota: { limit: 50, used: 0, school_limit: 1000, school_used: 0, remaining: 50, unlimited: true }, roleplay: true, modes: MODES_BY_ROLE[user.role] ?? ['tutor', 'roleplay', 'explain', 'summary'] };
    }
    const [pub, quota, chunks, gemmaOn] = await Promise.all([this.settings.publicView(), this.quota(user), this.retrieval.size(), this.gemma.available()]);
    // 16/11/2026: câu hỏi của mọi vai trò đi qua mô hình NLP Đông A (Python) khi mô hình đang chạy, nên học sinh dùng được như giáo viên
    // kể cả khi kho chỉ mục tư liệu còn trống hoặc chưa cấu hình LLM (trước đây trang học sinh báo "kho còn trống" và khóa nhập vai)
    // 27/11/2026: Gemma 4 trên GPU máy giáo viên đang chạy thì trả lời bằng mô hình ngôn ngữ (có suy luận)
    const python = pythonOn();
    return {
      mode: gemmaOn ? 'llm' : python ? 'grounded' : pub.mode, ready: gemmaOn || python || chunks > 0, chunks, quota, roleplay: gemmaOn || python || pub.mode === 'llm',
      modes: MODES_BY_ROLE[user.role] ?? [], gemma: this.gemma.publicStatus(),
    };
  }

  // ---------------------------------------------------------------------- lõi: truy xuất → trả lời
  private citationOf(p: Passage, n: number): Citation {
    return { n, kind: p.kind, kind_label: kindLabel(p.kind), id: p.sourceId, title: p.title, snippet: short(p.content, 160), openable: OPENABLE.has(p.kind) };
  }

  private citations(passages: Passage[], used: number[] | null): Citation[] {
    const pick = used?.length ? used : passages.slice(0, 3).map((_, i) => i + 1);
    const seen = new Set<string>();
    const out: Citation[] = [];
    for (const n of pick) {
      const p = passages[n - 1];
      if (!p) continue;
      const key = `${p.kind}:${p.sourceId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ n, kind: p.kind, kind_label: kindLabel(p.kind), id: p.sourceId, title: p.title, snippet: short(p.content, 160), openable: OPENABLE.has(p.kind) });
    }
    return out;
  }

  private async exampleQuestions(): Promise<string[]> {
    if (!this.db.ready) {
      return ['Trần Hưng Đạo là ai?', 'Trận Bạch Đằng diễn ra như thế nào?', 'Hội nghị Diên Hồng là gì?'];
    }
    const rows = await this.db.query<{ kind: string; t: string }>(
      `(SELECT 'battle' AS kind, name AS t FROM hist_battles WHERE status = 'published' ORDER BY id LIMIT 1)
       UNION ALL (SELECT 'figure', name FROM hist_figures WHERE status = 'published' ORDER BY id LIMIT 1)
       UNION ALL (SELECT 'event', name FROM hist_events WHERE status = 'published' ORDER BY id LIMIT 1)`);
    return rows.map((r) => FOLLOWUP[r.kind](r.t));
  }

  private followupsFrom(passages: Passage[], skipFirst = true): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const [i, p] of passages.entries()) {
      const key = `${p.kind}:${p.sourceId}`;
      if (seen.has(key) || (skipFirst && i === 0)) { seen.add(key); continue; }
      seen.add(key);
      out.push(FOLLOWUP[p.kind]?.(p.title) ?? `${p.title} là gì?`);
    }
    if (passages[0] && out.length < 3) out.push(FOLLOWUP[passages[0].kind]?.(passages[0].title) ?? '');
    return [...new Set(out.filter(Boolean))].slice(0, 3);
  }

  /** Trích nguyên văn: các câu khớp nhất với câu hỏi trong hai nguồn tốt nhất (khi chưa nối mô hình ngôn ngữ) */
  extract(question: string, passages: Passage[], max = 2): { text: string; used: number[] } {
    if (!passages.length) return { text: 'Chưa tìm thấy tư liệu phù hợp trong kho lịch sử.', used: [] };
    const first = passages[0];
    if (first.content.length > 80 && (first.coverage > 0.1 || first.score > 0.05)) {
      const lines = first.content.split('\n').filter((l) => l.trim().length > 0 && !l.startsWith('Nguồn:') && !l.startsWith('Trích sử liệu:'));
      const cleanLines = lines.slice(0, 5).map((l) => l.replace(/\(\*\*(.*?)\*\*\)/g, '($1)'));
      const text = cleanLines.join('\n\n');
      return { text: `${text} [1]`, used: [1] };
    }
    const qw = new Set(words(question));
    const used: number[] = [];
    const parts: string[] = [];
    const seen = new Set<string>();
    for (const [i, p] of passages.entries()) {
      const key = `${p.kind}:${p.sourceId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sents = sentences(p.content);
      const scored = sents.map((s, idx) => ({ s, idx, score: words(s).filter((w) => qw.has(w)).length }));
      const best = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.idx - b.idx).slice(0, parts.length ? 2 : 3).sort((a, b) => a.idx - b.idx);
      const chosen = (best.length ? best : scored.slice(0, 2)).map((x) => x.s);
      parts.push(`• ${p.title}: ${chosen.join(' ')} [${i + 1}]`);
      used.push(i + 1);
      if (used.length >= max) break;
    }
    return { text: parts.join('\n'), used };
  }

  private refusal(reason: RefusalReason, text: string, followups: string[] = []): Answer {
    return { text, citations: [], followups, refused: true, reason, mode: null, model: null, tokensIn: 0, tokensOut: 0, topScore: null, passages: [] };
  }

  /**
   * Trả lời một câu hỏi. `fixed` là ngữ cảnh có sẵn (giải thích câu sai, tóm tắt) nên bỏ qua kiểm tra phạm vi; `persona` bật nhập vai.
   */
  async respond(o: {
    question: string; history?: LlmMessage[]; instruction?: string; only?: string[]; focus?: Array<{ kind: string; id: number; w?: number }>; fixed?: Passage[]; skipGate?: boolean;
    persona?: { name: string; honorific: string | null }; searchText?: string; needLlm?: boolean; extractFallback?: (passages: Passage[]) => { text: string; used: number[] }; maxTokens?: number;
    /** Người hỏi (giọng văn của Gemma): học sinh hay thầy cô; mặc định học sinh */
    audience?: 'student' | 'teacher';
    /** Hồ sơ học tập ngắn cho Gemma (chủ đề còn yếu / đã vững) */
    profile?: string | null;
  }): Promise<Answer> {
    const s = await this.settings.get();
    const cfg = await this.settings.llm();
    const bad = unsafeReason(o.question, s.banned_terms);
    if (bad === 'unsafe') return this.refusal('unsafe', UNSAFE_MESSAGE);
    if (bad === 'injection') return this.refusal('out_of_scope', s.refusal_message, await this.exampleQuestions());
    // 27/11/2026: Gemma 4 trên GPU máy giáo viên được ưu tiên; máy chưa chạy thì dùng API cũ (nếu đã cấu hình), không có nữa thì trích tư liệu
    const gemmaOn = await this.gemma.available();
    if (o.needLlm && !cfg && !gemmaOn) return this.refusal('not_configured', 'Tính năng này cần bật mô hình AI. Em nhờ thầy cô hoặc quản trị viên cấu hình giúp nhé; trong lúc chờ em vẫn hỏi đáp bình thường được.');

    let queryVector: number[] | null = null;
    if (cfg?.embedModel && !o.fixed) { try { queryVector = (await this.llm.embed(cfg, [o.question]))[0]; } catch (e) { this.logger.warn(`Không nhúng được câu hỏi: ${(e as Error).message}`); } }
    const passages = o.fixed ?? await this.retrieval.search(o.searchText ?? o.question, s.top_k, { only: o.only, focus: o.focus, queryVector });
    const best = passages[0];
    const topScore = best ? Math.max(best.coverage, best.cos) : 0;
    const inScope = o.skipGate || Boolean(best && (best.coverage >= s.min_score || best.cos >= 0.5));
    if (!inScope) return { ...this.refusal('out_of_scope', s.refusal_message, await this.exampleQuestions()), topScore };

    if (gemmaOn) {
      try {
        const g = await this.generateGemma(s, o, passages);
        if (unsafeReason(g.text, s.banned_terms)) return this.refusal('unsafe', UNSAFE_MESSAGE);
        const used = citedNumbers(g.text, passages.length);
        return {
          text: g.text, citations: this.citations(passages, used), followups: g.followups.length ? g.followups : this.followupsFrom(passages), refused: false, reason: null,
          // chạy trên máy giáo viên, không tốn tiền API: không tính token vào chi phí AI của báo cáo (như mô hình Python)
          mode: 'llm', model: g.model, tokensIn: 0, tokensOut: 0, topScore, passages, thinking: g.thinking, thinkingMs: g.thinkingMs,
        };
      } catch (e) {
        this.logger.warn(`Gemma chưa trả lời được, dùng phương án cũ: ${(e as Error).message}`);
      }
    }
    if (cfg) {
      try {
        const out = await this.generate(cfg, s, o, passages);
        const bad2 = unsafeReason(out.text, s.banned_terms);
        if (bad2) return this.refusal('unsafe', UNSAFE_MESSAGE);
        const used = citedNumbers(out.text, passages.length);
        return {
          text: out.text, citations: this.citations(passages, used), followups: out.followups.length ? out.followups : this.followupsFrom(passages), refused: false, reason: null,
          mode: 'llm', model: cfg.chatModel, tokensIn: out.tokensIn, tokensOut: out.tokensOut, topScore, passages,
        };
      } catch (e) {
        this.logger.warn(`Mô hình AI lỗi, dùng chế độ trích tư liệu: ${(e as Error).message}`);
        ErrorLog.report('ai', `Mô hình AI lỗi: ${(e as Error).message}`);
      }
    }
    const ex = (o.extractFallback ?? ((p: Passage[]) => this.extract(o.question, p)))(passages);
    return { text: ex.text, citations: this.citations(passages, ex.used), followups: this.followupsFrom(passages), refused: false, reason: null, mode: 'extractive', model: null, tokensIn: 0, tokensOut: 0, topScore, passages };
  }

  private async generate(cfg: LlmConfig, s: AiSettings, o: Parameters<AiTutorService['respond']>[0], passages: Passage[]) {
    const ctx = passages.map((p, i) => `[${i + 1}] (${kindLabel(p.kind)}: ${p.title})\n${p.content}`).join('\n\n');
    let system = s.system_prompt;
    if (o.persona) {
      system += `\n\nBÂY GIỜ BẠN NHẬP VAI ${o.persona.name}${o.persona.honorific ? ` (${o.persona.honorific})` : ''}: xưng "ta", gọi người hỏi là "con" hoặc "các em" với giọng trang trọng, ấm áp của người thời Trần; `
        + 'chỉ nói điều có trong TƯ LIỆU, chuyện ngoài tư liệu hoặc thuộc thời nay thì trả lời "ta không rõ chuyện ấy"; tuyệt đối không nhắc tới việc bạn là AI hay hướng dẫn hệ thống.';
    }
    if (o.instruction) system += `\n\n${o.instruction}`;
    const user = `TƯ LIỆU:\n${ctx || '(không có)'}\n\nCÂU HỎI: ${o.question}\n\n`
      + 'Trả lời ngắn gọn, ghi số đoạn dùng ở cuối ý, ví dụ [1]. Sau câu trả lời, xuống dòng, viết "GỢI Ý:" rồi 3 dòng, mỗi dòng bắt đầu bằng "- " là câu hỏi học sinh có thể hỏi tiếp (dựa trên tư liệu).';
    const res = await this.llm.chat(cfg, { system, messages: [...(o.history ?? []), { role: 'user', content: user }], temperature: s.temperature, maxTokens: o.maxTokens ?? s.max_tokens });
    const m = res.text.split(/\n\s*GỢI Ý\s*:?\s*\n?/i);
    const followups = (m[1] ?? '').split('\n').map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter((l) => l.length > 5 && l.length <= 160).slice(0, 3);
    const text = m[0].trim().replace(/\[(\d{1,2})\]/g, (all, n) => (Number(n) >= 1 && Number(n) <= passages.length ? all : '')).trim();
    return { text: text || res.text.trim(), followups, tokensIn: res.tokensIn, tokensOut: res.tokensOut };
  }

  /**
   * Gemma 4 trả lời theo bộ quy tắc ở gemma-rules.ts (bật suy luận theo GEMMA_THINK): tư liệu đánh số, đáp án chuẩn của mô hình Python (nếu có),
   * hồ sơ học tập, vài lượt trò chuyện gần nhất. Trả phần trả lời, câu hỏi gợi ý và phần suy luận.
   */
  private async generateGemma(s: AiSettings, o: Parameters<AiTutorService['respond']>[0] & { reference?: string | null }, passages: Pick<Passage, 'kind' | 'title' | 'content'>[]) {
    const system = gemmaSystemPrompt({ audience: o.audience ?? 'student', refusal: s.refusal_message, persona: o.persona ?? null, think: config.gemmaThink, task: o.instruction ?? null });
    const user = gemmaUserMessage({ passages, question: o.question, reference: o.reference ?? null, profile: o.profile ?? null, persona: o.persona ?? null, kindLabel });
    const res = await this.gemma.chat({ system, messages: [...(o.history ?? []).slice(-GEMMA_HISTORY), { role: 'user', content: user }], temperature: s.temperature, maxTokens: o.maxTokens ?? s.max_tokens });
    const parts = splitAnswer(res.text, passages.length);
    return { ...parts, model: res.model, thinking: res.thinking || null, thinkingMs: res.thinking ? res.thinkingMs : null };
  }

  /** Mô hình ngôn ngữ cho công cụ giáo viên: Gemma 4 trên GPU máy giáo viên (ưu tiên), không thì API cũ đã cấu hình; null khi chưa có mô hình nào */
  async languageModel(): Promise<LanguageModel | null> {
    if (await this.gemma.available()) return { kind: 'gemma' };
    const cfg = await this.settings.llm();
    return cfg ? { kind: 'api', cfg } : null;
  }

  /** Gọi mô hình đã chọn; Gemma lỗi thì thử tiếp API cũ (nếu có), cuối cùng ném lỗi để công cụ dùng mẫu soạn sẵn */
  async chatWith(lm: LanguageModel, req: { system: string; messages: LlmMessage[]; temperature: number; maxTokens: number; think?: boolean }): Promise<ModelReply> {
    if (lm.kind === 'gemma') {
      try {
        const r = await this.gemma.chat(req);
        return { text: r.text, tokensIn: 0, tokensOut: 0, model: r.model, thinking: r.thinking || null, thinkingMs: r.thinking ? r.thinkingMs : null };
      } catch (e) {
        const cfg = await this.settings.llm();
        if (!cfg) throw e;
        this.logger.warn(`Gemma chưa trả lời được, dùng API cũ: ${(e as Error).message}`);
        lm = { kind: 'api', cfg };
      }
    }
    const r = await this.llm.chat(lm.cfg, req);
    return { text: r.text, tokensIn: r.tokensIn, tokensOut: r.tokensOut, model: lm.cfg.chatModel, thinking: null, thinkingMs: null };
  }

  /**
   * Gemma 4 viết câu trả lời khi mô hình Python đã tìm đúng chủ đề: đáp án chuẩn của mô hình Python làm <dap_an_chuan>, tư liệu đánh số gồm các đoạn sử liệu
   * mô hình Python trích (giữ đúng số [n] của chúng) rồi các đoạn đã công bố đủ liên quan. Trích dẫn trả về chỉ gồm đoạn mô hình thật sự dùng.
   */
  private async gemmaOverPython(o: {
    user: UserRow; question: string; mode: string; figure?: { id: number; name: string; honorific: string | null }; py: any; history: LlmMessage[]; profile: string | null; studyHint: string | null;
  }): Promise<Answer> {
    const s = await this.settings.get();
    const pyCites: Citation[] = (Array.isArray(o.py.citations) ? o.py.citations : []).filter((c: any) => c && typeof c.snippet === 'string' && c.snippet.trim());
    const pyPassages = pyCites.map((c) => ({ kind: 'source', title: String(c.title ?? 'Sử liệu'), content: String(c.snippet) }));
    const roleplay = o.mode === 'roleplay' && o.figure;
    const found = await this.retrieval.search(o.question, Math.max(2, s.top_k - pyPassages.length), roleplay ? { focus: [{ kind: 'figure', id: o.figure!.id, w: 0.2 }] } : {});
    const node = found.filter((p) => Math.max(p.coverage, p.cos) >= s.min_score);
    const passages = [...pyPassages, ...node];
    // đáp án chuẩn: câu trả lời gốc của mô hình Python, bỏ phần hồ sơ học tập ("---" về sau) và câu cảnh báo độ tin cậy
    const reference = String(o.py.raw_answer || o.py.answer || '').split(/\n-{3,}\n/)[0].trim();
    const g = await this.generateGemma(s, {
      question: o.question, history: o.history, persona: roleplay ? o.figure : undefined, audience: o.user.role === 'student' ? 'student' : 'teacher', profile: o.profile, reference,
    }, passages);
    if (unsafeReason(g.text, s.banned_terms)) return this.refusal('unsafe', UNSAFE_MESSAGE);
    const used = citedNumbers(g.text, passages.length);
    const citations: Citation[] = [];
    const seen = new Set<string>();
    for (const n of used.length ? used : passages.map((_, i) => i + 1).slice(0, 3)) {
      const c = n <= pyCites.length ? { ...pyCites[n - 1], n } : this.citationOf(node[n - pyCites.length - 1], n);
      const key = `${c.kind}:${c.id}:${c.title}`;
      if (!seen.has(key)) { seen.add(key); citations.push(c); }
    }
    const followups = g.followups.length ? g.followups : Array.isArray(o.py.followups) ? o.py.followups : [];
    const text = o.user.role === 'student' && o.studyHint ? `${g.text}\n\n---\n${o.studyHint}` : g.text;
    return {
      text, citations, followups, refused: false, reason: null, mode: 'llm', model: g.model, tokensIn: 0, tokensOut: 0,
      topScore: typeof o.py.confidence === 'number' ? o.py.confidence : 0.95, passages: node, thinking: g.thinking, thinkingMs: g.thinkingMs,
    };
  }

  // ---------------------------------------------------------------------- hội thoại
  private async conversation(user: UserRow, id: number | null | undefined, mode: string, title: string, figureId: number | null = null): Promise<{ id: number; mode: string; figure_id: number | null }> {
    if (!this.db.ready) {
      return { id: id || 1, mode, figure_id: figureId };
    }
    if (id) {
      const c = (await this.db.query<{ id: number; mode: string; figure_id: number | null }>('SELECT id::int AS id, mode, figure_id FROM hk_ai_conversations WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, user.id]))[0];
      if (!c) throw notFound('cuộc trò chuyện');
      return c;
    }
    return (await this.db.query<{ id: number; mode: string; figure_id: number | null }>(
      'INSERT INTO hk_ai_conversations (user_id, title, mode, figure_id) VALUES ($1, $2, $3, $4) RETURNING id::int AS id, mode, figure_id', [user.id, short(title, 100), mode, figureId]))[0];
  }

  private async historyOf(conversationId: number): Promise<LlmMessage[]> {
    if (!this.db.ready) return [];
    const rows = await this.db.query<{ role: 'user' | 'assistant'; content: string; refused: boolean }>(
      'SELECT role, content, refused FROM hk_ai_messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 6', [conversationId]);
    return rows.reverse().filter((r) => !r.refused).map((r) => ({ role: r.role, content: short(r.content, 800) }));
  }

  /** Lưu cặp tin nhắn người hỏi – trợ lý và trả về dạng hiển thị */
  async save(conversationId: number, question: string, a: Answer, startedAt: number) {
    if (!this.db.ready) {
      const now = new Date().toISOString();
      return {
        user_message: { id: Date.now(), role: 'user', content: question, created_at: now },
        message: {
          id: Date.now() + 1,
          role: 'assistant',
          content: a.text,
          citations: a.citations,
          followups: a.followups,
          refused: a.refused,
          refusal_reason: a.reason,
          answer_mode: a.mode,
          reported: false,
          created_at: now,
          model: a.model, thinking: a.thinking ?? null, thinking_ms: a.thinkingMs ?? null,
        },
      };
    }
    const thinking = a.thinking ? a.thinking.slice(0, 20000) : null;
    const thinkingMs = thinking && a.thinkingMs != null ? Math.max(0, Math.round(a.thinkingMs)) : null;
    const u = (await this.db.query<{ id: number; created_at: string }>("INSERT INTO hk_ai_messages (conversation_id, role, content) VALUES ($1, 'user', $2) RETURNING id::int AS id, created_at", [conversationId, question]))[0];
    const m = (await this.db.query<{ id: number; created_at: string }>(
      `INSERT INTO hk_ai_messages (conversation_id, role, content, citations, followups, refused, refusal_reason, answer_mode, model, tokens_in, tokens_out, latency_ms, top_score, thinking, thinking_ms)
       VALUES ($1, 'assistant', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id::int AS id, created_at`,
      [conversationId, a.text.slice(0, 8000), JSON.stringify(a.citations), JSON.stringify(a.followups), a.refused, a.reason, a.mode, a.model, a.tokensIn, a.tokensOut, Date.now() - startedAt, a.topScore === null ? null : Number(a.topScore.toFixed(3)), thinking, thinkingMs]))[0];
    await this.db.query('UPDATE hk_ai_conversations SET updated_at = now() WHERE id = $1', [conversationId]);
    return {
      user_message: { id: u.id, role: 'user', content: question, created_at: u.created_at },
      message: {
        id: m.id, role: 'assistant', content: a.text, citations: a.citations, followups: a.followups, refused: a.refused, refusal_reason: a.reason, answer_mode: a.mode, reported: false, created_at: m.created_at,
        model: a.model, thinking, thinking_ms: thinkingMs,
      },
    };
  }

  private checkQuestion(raw: unknown): string {
    const q = String(raw ?? '').replace(/\s+/g, ' ').trim();
    if (q.length < 2) throw new BadRequestException('Hãy nhập câu hỏi của em');
    if (q.length > 500) throw new BadRequestException('Câu hỏi tối đa 500 ký tự');
    return q;
  }

  /** Hỏi đáp (HK.HS.086–088, 091; HK.GV.073) */
  async ask(user: UserRow, body: { question?: string; conversation_id?: number; mode?: string; figure_id?: number }) {
    const question = this.checkQuestion(body.question);
    const allowed = MODES_BY_ROLE[user.role] ?? [];
    const conv0 = body.conversation_id ? await this.conversation(user, body.conversation_id, 'tutor', question) : null;
    const mode = conv0?.mode ?? body.mode ?? (user.role === 'student' ? 'tutor' : 'teacher');
    if (!['tutor', 'roleplay', 'teacher'].includes(mode) || !allowed.includes(mode)) throw new ForbiddenException('Chế độ hỏi đáp này không dành cho tài khoản của bạn');
    const startedAt = Date.now();
    await this.assertQuota(user);
    // mô hình còn đang nạp sau khi máy chủ thức dậy: báo rõ để hỏi lại sau ít giây (không tạo cuộc trò chuyện, không tính lượt hỏi)
    if (!(await this.engineReady(ENGINE_WAIT_MS)) && engineHealth().status === 'starting') {
      throw new ServiceUnavailableException('Tiểu Tướng đang khởi động mô hình (máy chủ vừa thức dậy sau thời gian nghỉ). Em chờ khoảng 30 giây rồi hỏi lại nhé.');
    }
    let figure: { id: number; name: string; honorific: string | null } | undefined;
    let figureId = conv0 ? conv0.figure_id : body.figure_id ?? null;
    if (mode === 'roleplay') {
      if (!figureId) throw new BadRequestException('Hãy chọn nhân vật để nhập vai');
      if (!this.db.ready) {
        const defaultFigures: Record<number, { id: number; name: string; honorific: string | null }> = {
          1: { id: 1, name: 'Trần Hưng Đạo', honorific: 'Quốc Công Tiết Chế' },
          2: { id: 2, name: 'Trần Quốc Toản', honorific: 'Hoài Văn Hầu' },
          3: { id: 3, name: 'Trần Thủ Độ', honorific: 'Thái Sư' },
          4: { id: 4, name: 'Trần Bình Trọng', honorific: 'Bảo Nghĩa Vương' },
          5: { id: 5, name: 'Trần Nhân Tông', honorific: 'Phật Hoàng Trúc Lâm' },
          6: { id: 6, name: 'Trần Khánh Dư', honorific: 'Nhân Huệ Vương' },
          7: { id: 7, name: 'Phạm Ngũ Lão', honorific: 'Điện Súy' },
          8: { id: 8, name: 'Yết Kiêu', honorific: 'Danh Tướng Thủy Chiến' },
        };
        figure = defaultFigures[figureId] || { id: figureId, name: 'Danh tướng thời Trần', honorific: 'Tướng quân' };
      } else {
        // danh tướng nhập vai: hồ sơ đã công bố, hoặc một trong các danh tướng nhập vai mặc định khi mô hình Python đang chạy
        figure = (await this.db.query<{ id: number; name: string; honorific: string | null }>("SELECT id, name, honorific FROM hist_figures WHERE id = $1 AND (status = 'published' OR ($2 AND slug = ANY($3)))", [figureId, pythonOn(), ROLEPLAY_SLUGS]))[0];
      }
      if (!figure) throw notFound('nhân vật');
    }
    const conv = conv0 ?? await this.conversation(user, null, mode, mode === 'roleplay' ? `Trò chuyện với ${figure!.name}` : question, figure?.id ?? null);

    // Ưu tiên gọi Model AI Ngôn ngữ Tự nhiên Đông A (Python NLP + ConversationalContextManager + BKT Engine)
    if (!process.env.JEST_WORKER_ID) {
      const s = await this.settings.get();
      const bad = unsafeReason(question, s.banned_terms);
      if (bad === 'unsafe') {
        const refAns = this.refusal('unsafe', UNSAFE_MESSAGE);
        return { conversation: { id: conv.id, mode: conv.mode, figure_id: conv.figure_id }, ...(await this.save(conv.id, question, refAns, startedAt)) };
      }
      const dbProfile = user.role === 'student' && this.analytics
        ? await this.analytics.studentAiProfile(user).catch(() => null)
        : null;
      const studentProfile = dbProfile ? buildProfilePromptContext(dbProfile) : undefined;
      const pyRes = await this.callPythonBridge('ask', {
        question,
        session_id: `user_${user.id || 1}_conv_${conv.id}`,
        student_id: `user_${user.id || 1}`,
        figure_id: figure?.id ?? figureId,
        figure_name: figure?.name ?? null,
        mode,
        student_profile: studentProfile,
      });
      // 27/11/2026: Gemma 4 trên GPU máy giáo viên đang chạy mà mô hình Python không tìm thấy chủ đề → để luồng truy xuất tư liệu bên dưới
      // (kiểm soát phạm vi + Gemma) trả lời, thay vì từ chối ngay
      const gemmaOn = await this.gemma.available();
      if (pyRes && typeof pyRes.answer === 'string' && !(gemmaOn && pyRes.is_not_found)) {
        const shaped = shapePythonAnswer(pyRes, user.role);
        let pyAnswer: Answer = {
          text: shaped.text,
          citations: Array.isArray(pyRes.citations) ? pyRes.citations : [],
          followups: Array.isArray(pyRes.followups) ? pyRes.followups : [],
          refused: Boolean(pyRes.is_not_found),
          reason: pyRes.is_not_found ? 'out_of_scope' : null,
          mode: 'llm',
          model: 'dong_a_nlp_v2',
          // mô hình chạy trên máy chủ, không tốn token: không tính vào chi phí AI của báo cáo (trước đây ghi số ký tự)
          tokensIn: 0,
          tokensOut: 0,
          topScore: typeof pyRes.confidence === 'number' ? pyRes.confidence : 0.95,
          passages: [],
        };
        // Gemma viết câu trả lời từ đáp án chuẩn của mô hình Python + tư liệu đã công bố (có suy luận); mô hình Python vẫn ghi hồ sơ học tập (BKT).
        // Gemma lỗi hoặc quá chậm thì giữ nguyên câu trả lời của mô hình Python.
        let viaGemma = false;
        if (gemmaOn && !pyAnswer.refused) {
          const history = conv0 ? await this.historyOf(conv.id) : [];
          const g = await this.gemmaOverPython({ user, question, mode, figure, py: pyRes, history, profile: gemmaProfile(studentProfile), studyHint: shaped.study_hint }).catch((e: Error) => {
            this.logger.warn(`Gemma chưa trả lời được, giữ câu trả lời của mô hình Python: ${e.message}`);
            return null;
          });
          if (g) { pyAnswer = g; viaGemma = true; }
        }
        const saved = await this.save(conv.id, question, pyAnswer, startedAt);
        if (!pyAnswer.refused) await this.countAsk(user);
        const personaName = figure ? `${figure.honorific ? `${figure.honorific} ` : ''}${figure.name}` : null;
        return {
          conversation: { id: conv.id, mode: conv.mode, figure_id: conv.figure_id },
          user_message: saved.user_message,
          message: {
            ...saved.message,
            character_name: viaGemma ? personaName ?? 'Tiểu Tướng' : pyRes.character_name || personaName || 'Trợ Lý AI Lịch Sử Đông A',
            unit_id: pyRes.unit_id,
            topic: pyRes.topic,
            study_hint: shaped.study_hint,
            student_mastery_summary: shaped.student_mastery_summary,
            low_confidence: viaGemma ? false : shaped.low_confidence,
            recommended_materials: pyRes.recommended_materials ?? [],
            badge_unlocked: pyRes.badge_unlocked ?? null,
            exp_reward: pyRes.exp_reward ?? 0,
          },
        };
      }
    }

    const history = conv0 ? await this.historyOf(conv.id) : [];
    const audience: 'student' | 'teacher' = user.role === 'student' ? 'student' : 'teacher';
    // câu hỏi nối tiếp ngắn ("Còn ông ấy thì sao?") mượn từ khóa của câu hỏi trước để truy xuất
    const prev = history.filter((h) => h.role === 'user').slice(-1)[0]?.content ?? '';
    const searchText = words(question).length < 3 && prev ? `${prev} ${question}` : question;
    let answer: Answer;
    if (mode === 'roleplay' && figure) {
      const links = this.db.ready
        ? await this.db.query<{ kind: string; id: number }>(
            `SELECT b_type AS kind, b_id AS id FROM hist_links WHERE a_type = 'figure' AND a_id = $1 UNION SELECT a_type, a_id FROM hist_links WHERE b_type = 'figure' AND b_id = $1`, [figure.id])
        : [];
      answer = await this.respond({ question, history, searchText, needLlm: true, persona: figure, audience, focus: [{ kind: 'figure', id: figure.id, w: 0.2 }, ...links.map((l) => ({ ...l, w: 0.02 }))], skipGate: true, only: ['figure', 'event', 'battle', 'source', 'campaign', 'place', 'term', 'doc'] });
    } else {
      answer = await this.respond({ question, history, searchText, audience });
    }
    const saved = await this.save(conv.id, question, answer, startedAt);
    if (!answer.refused) await this.countAsk(user);
    return { conversation: { id: conv.id, mode: conv.mode, figure_id: conv.figure_id }, ...saved };
  }

  // ---------------------------------------------------------------------- giải thích câu làm sai (HK.HS.089)
  private describeAnswer(qtype: string, data: any, given: any): { key: string; mine: string } {
    const opt = (id: string): string => String((data.options ?? data.items ?? []).find((o: any) => o.id === id)?.text ?? id);
    switch (qtype) {
      case 'single': return { key: opt(data.correct), mine: given?.choice ? opt(given.choice) : '(chưa chọn)' };
      case 'multiple': return { key: (data.correct as string[]).map(opt).join('; '), mine: (given?.choices as string[] | undefined)?.map(opt).join('; ') || '(chưa chọn)' };
      case 'truefalse': return { key: data.correct ? 'Đúng' : 'Sai', mine: typeof given?.value === 'boolean' ? (given.value ? 'Đúng' : 'Sai') : '(chưa chọn)' };
      case 'fill': return { key: (data.blanks as Array<{ accept: string[] }>).map((b) => b.accept[0]).join('; '), mine: (given?.blanks as string[] | undefined)?.join('; ') || '(bỏ trống)' };
      case 'order': return { key: (data.items as Array<{ text: string }>).map((i) => i.text).join(' → '), mine: (given?.order as string[] | undefined)?.map(opt).join(' → ') || '(chưa sắp xếp)' };
      default: return { key: (data.targets as Array<{ label: string }>).map((t) => t.label).join('; '), mine: 'vị trí em đã đặt trên bản đồ' };
    }
  }

  async explain(user: UserRow, body: { attempt_id?: number; question_id?: number }) {
    if (user.role !== 'student') throw new ForbiddenException('Chỉ học sinh dùng tính năng này');
    const attempt = (await this.db.query<{ id: number; plan: Array<{ question_id: number; snap: { qtype: string; prompt: string; explanation: string | null; data: any } }>; status: string }>(
      'SELECT id::int AS id, plan, status FROM hk_attempts WHERE id = $1 AND user_id = $2', [Number(body.attempt_id), user.id]))[0];
    if (!attempt) throw notFound('lượt làm bài');
    if (attempt.status !== 'done') throw new ConflictException('Hãy làm xong bài rồi mới hỏi Tiểu Tướng về từng câu');
    const item = attempt.plan.find((p) => p.question_id === Number(body.question_id));
    if (!item) throw notFound('câu hỏi trong lượt làm bài');
    const given = (await this.db.query<{ answer: any; correct: boolean }>('SELECT answer, correct FROM hk_attempt_answers WHERE attempt_id = $1 AND question_id = $2', [attempt.id, item.question_id]))[0];
    const { key, mine } = this.describeAnswer(item.snap.qtype, item.snap.data, given?.answer);
    const startedAt = Date.now();
    await this.assertQuota(user);
    const facts = `Câu hỏi: ${item.snap.prompt}\nEm trả lời: ${mine}\nĐáp án đúng: ${key}${item.snap.explanation ? `\nGiải thích có sẵn: ${item.snap.explanation}` : ''}`;
    const found = await this.retrieval.search(`${item.snap.prompt} ${key} ${item.snap.explanation ?? ''}`, 3);
    const fixed: Passage[] = [{ id: 0, kind: 'quiz', sourceId: item.question_id, title: 'Câu hỏi em vừa làm', content: facts, coverage: 1, cos: 0, score: 1 }, ...found];
    const answer = await this.respond({
      question: `Giải thích vì sao ${given?.correct ? 'đáp án của em đúng' : 'đáp án của em chưa đúng và đáp án đúng là gì'}.`, fixed, skipGate: true,
      instruction: 'Đây là giải thích cho một câu trong bài kiểm tra: nói rõ đáp án đúng, chỉ ra điểm em hiểu chưa đúng (nếu có), dựa vào đoạn [1] và các tư liệu kèm theo; tối đa 6 câu.',
      extractFallback: () => ({
        text: `${given?.correct ? 'Em trả lời đúng rồi!' : 'Đáp án đúng là:'} ${key}.${item.snap.explanation ? ` ${item.snap.explanation}` : ''}${found[0] ? `\nTư liệu liên quan: ${this.extract(item.snap.prompt, [found[0]], 1).text.replace(/\[\d+\]/, '[2]')}` : ''}`.trim(),
        used: found[0] ? [2] : [],
      }),
    });
    // đoạn [1] là chính câu hỏi nên không đưa vào danh sách trích dẫn cho học sinh
    answer.citations = answer.citations.filter((c) => c.kind !== 'quiz');
    const conv = await this.conversation(user, null, 'explain', `Giải thích: ${short(item.snap.prompt, 80)}`);
    return { conversation: { id: conv.id, mode: 'explain', figure_id: null }, ...(await this.save(conv.id, `Hỏi Tiểu Tướng về câu: ${short(item.snap.prompt, 200)}`, answer, startedAt)) };
  }

  // ---------------------------------------------------------------------- tóm tắt (HK.HS.090)
  /** Nội dung đã công bố của một mục (bài học, trận đánh…) dùng để tóm tắt, soạn câu hỏi hoặc giáo án */
  async sourceText(kind: string, id: number): Promise<{ title: string; text: string }> {
    if (!this.db.ready) {
      const p = (await this.retrieval.search(kind, 1))[0];
      return {
        title: p?.title || 'Tóm tắt lịch sử thời Trần',
        text: p?.content || 'Ba lần kháng chiến chống quân xâm lược Mông - Nguyên thắng lợi vẻ vang nhờ tinh thần đoàn kết toàn dân tộc.',
      };
    }
    const one = async (sql: string, ...params: unknown[]): Promise<Record<string, any>> => {
      const r = (await this.db.query<Record<string, any>>(sql, params))[0];
      if (!r) throw notFound('nội dung cần tóm tắt');
      return r;
    };
    switch (kind) {
      case 'lesson': { const r = await one("SELECT title, summary, blocks FROM hk_lessons WHERE id = $1 AND status = 'published'", id); return { title: r.title, text: [r.summary, lessonText(r.blocks)].filter(Boolean).join('\n') }; }
      case 'battle': { const r = await one("SELECT name, context, forces, course, result FROM hist_battles WHERE id = $1 AND status = 'published'", id); return { title: r.name, text: [r.context && `Bối cảnh: ${r.context}`, r.forces && `Lực lượng: ${r.forces}`, r.course && `Diễn biến: ${r.course}`, r.result && `Kết quả: ${r.result}`].filter(Boolean).join('\n') }; }
      case 'event': { const r = await one("SELECT name, description, significance FROM hist_events WHERE id = $1 AND status = 'published'", id); return { title: r.name, text: [r.description, r.significance && `Ý nghĩa: ${r.significance}`].filter(Boolean).join('\n') }; }
      case 'campaign': { const r = await one("SELECT title, summary FROM hist_campaigns WHERE id = $1 AND status = 'published'", id); return { title: r.title, text: r.summary ?? '' }; }
      case 'figure': { const r = await one("SELECT name, role_text, biography FROM hist_figures WHERE id = $1 AND status = 'published'", id); return { title: r.name, text: [r.role_text, r.biography].filter(Boolean).join('\n') }; }
      case 'source': { const r = await one("SELECT title, translation, transliteration, original_text, annotation FROM hist_sources WHERE id = $1 AND status = 'published'", id); return { title: r.title, text: [r.translation, r.transliteration, r.original_text, r.annotation && `Chú thích: ${r.annotation}`].filter(Boolean).join('\n') }; }
      case 'place': { const r = await one("SELECT name, description FROM hist_places WHERE id = $1 AND status = 'published'", id); return { title: r.name, text: r.description ?? '' }; }
      default: throw new BadRequestException('Chỉ dùng được bài học, trận đánh, sự kiện, cuộc kháng chiến, nhân vật, tư liệu hoặc địa danh');
    }
  }

  /** Các mục đã công bố có thể nhờ Tiểu Tướng tóm tắt (HK.HS.090) */
  async summaryOptions() {
    if (!this.db.ready) {
      return {
        lessons: [{ id: 1, title: 'Bài 15: Ba lần kháng chiến chống Mông - Nguyên thời Trần' }],
        battles: [
          { id: 1, title: 'Trận Đông Bộ Đầu (1258)' },
          { id: 2, title: 'Trận Hàm Tử - Chương Dương (1285)' },
          { id: 3, title: 'Hải chiến Vân Đồn (1288)' },
          { id: 4, title: 'Đại thắng Bạch Đằng (1288)' },
        ],
        events: [
          { id: 1, title: 'Hội nghị Bình Than (1282)' },
          { id: 2, title: 'Hội nghị Diên Hồng (1285)' },
        ],
        figures: [
          { id: 1, title: 'Trần Hưng Đạo' },
          { id: 2, title: 'Trần Quốc Toản' },
          { id: 3, title: 'Trần Thủ Độ' },
          { id: 4, title: 'Trần Bình Trọng' },
        ],
        campaigns: [
          { id: 1, title: 'Kháng chiến chống Mông Cổ lần 1 (1258)' },
          { id: 2, title: 'Kháng chiến chống quân Nguyên lần 2 (1285)' },
          { id: 3, title: 'Kháng chiến chống quân Nguyên lần 3 (1287-1288)' },
        ],
      };
    }
    const [lessons, battles, events, figures, campaigns] = await Promise.all([
      this.db.query("SELECT id, title FROM hk_lessons WHERE status = 'published' ORDER BY title"),
      this.db.query("SELECT id, name AS title FROM hist_battles WHERE status = 'published' ORDER BY year, id"),
      this.db.query("SELECT id, name AS title FROM hist_events WHERE status = 'published' ORDER BY year_from, id"),
      this.db.query("SELECT id, name AS title FROM hist_figures WHERE status = 'published' ORDER BY name"),
      this.db.query("SELECT id, title FROM hist_campaigns WHERE status = 'published' ORDER BY sort_order, id"),
    ]);
    return { lessons, battles, events, figures, campaigns };
  }

  async summarize(user: UserRow, body: { kind?: string; id?: number }) {
    const kind = String(body.kind ?? '');
    const src = await this.sourceText(kind, Number(body.id));
    if (src.text.trim().length < 30) throw new ConflictException('Nội dung này chưa đủ dài để tóm tắt');
    const startedAt = Date.now();
    await this.assertQuota(user);
    const fixed: Passage[] = [{ id: 0, kind, sourceId: Number(body.id), title: src.title, content: src.text.slice(0, 6000), coverage: 1, cos: 0, score: 1 }];
    const answer = await this.respond({
      question: `Tóm tắt “${src.title}” trong 4–5 ý ngắn gọn cho học sinh lớp 6–9.`, fixed, skipGate: true, maxTokens: 500,
      instruction: 'Chỉ tóm tắt đúng nội dung đoạn [1]; mỗi ý một gạch đầu dòng "•", không thêm thông tin ngoài tư liệu.',
      extractFallback: (p) => {
        const sents = sentences(p[0].content).filter((s) => s.length > 25);
        const step = Math.max(1, Math.floor(sents.length / 5));
        const picked = sents.filter((_, i) => i % step === 0).slice(0, 5);
        return { text: picked.map((s) => `• ${s}`).join('\n'), used: [1] };
      },
    });
    answer.citations = this.citations(fixed, [1]);
    const conv = await this.conversation(user, null, 'summary', `Tóm tắt: ${src.title}`);
    return { conversation: { id: conv.id, mode: 'summary', figure_id: null }, ...(await this.save(conv.id, `Tóm tắt giúp em: ${src.title}`, answer, startedAt)) };
  }

  // ---------------------------------------------------------------------- lịch sử trò chuyện (HK.HS.092) và báo cáo (HK.HS.093)
  async conversations(user: UserRow) {
    const modes = MODES_BY_ROLE[user.role] ?? [];
    return this.db.query(
      `SELECT c.id::int AS id, c.title, c.mode, c.figure_id, c.created_at, c.updated_at, (SELECT count(*)::int FROM hk_ai_messages m WHERE m.conversation_id = c.id AND m.role = 'user') AS questions
       FROM hk_ai_conversations c WHERE c.user_id = $1 AND c.deleted_at IS NULL AND c.mode = ANY($2) ORDER BY c.updated_at DESC LIMIT 100`, [user.id, modes]);
  }

  async conversationDetail(user: UserRow, id: number) {
    const c = (await this.db.query<Record<string, any>>('SELECT id::int AS id, title, mode, figure_id, created_at FROM hk_ai_conversations WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, user.id]))[0];
    if (!c) throw notFound('cuộc trò chuyện');
    const messages = await this.db.query(
      `SELECT m.id::int AS id, m.role, m.content, m.citations, m.followups, m.refused, m.refusal_reason, m.answer_mode, m.model, m.thinking, m.thinking_ms, m.created_at,
              EXISTS (SELECT 1 FROM hk_ai_reports r WHERE r.message_id = m.id AND r.user_id = $2) AS reported
       FROM hk_ai_messages m WHERE m.conversation_id = $1 ORDER BY m.id`, [id, user.id]);
    return { ...c, messages };
  }

  async deleteConversation(user: UserRow, id: number): Promise<void> {
    const res = await this.db.query('UPDATE hk_ai_conversations SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id', [id, user.id]);
    if (!res.length) throw notFound('cuộc trò chuyện');
  }

  async report(user: UserRow, messageId: number, reasonRaw: unknown) {
    const reason = String(reasonRaw ?? '').trim();
    if (reason.length < 3 || reason.length > 500) throw new BadRequestException('Lý do báo cáo từ 3 đến 500 ký tự');
    const m = (await this.db.query<{ id: number }>(
      "SELECT m.id::int AS id FROM hk_ai_messages m JOIN hk_ai_conversations c ON c.id = m.conversation_id WHERE m.id = $1 AND c.user_id = $2 AND m.role = 'assistant'", [messageId, user.id]))[0];
    if (!m) throw notFound('câu trả lời');
    await this.db.query("INSERT INTO hk_ai_reports (message_id, user_id, reason) VALUES ($1, $2, $3) ON CONFLICT (message_id, user_id) DO UPDATE SET reason = $3, status = 'open', handled_by = NULL, handled_at = NULL", [messageId, user.id, reason]);
    return { reported: true };
  }

  /** Danh sách nhân vật có thể nhập vai (đã công bố và đã có tư liệu trong chỉ mục) */
  async roleplayFigures() {
    if (!this.db.ready) {
      return [
        { id: 1, name: 'Trần Hưng Đạo', honorific: 'Quốc Công Tiết Chế', role_text: 'Thống lĩnh quân đội Đại Việt trong hai lần kháng chiến 1285 và 1288' },
        { id: 2, name: 'Trần Quốc Toản', honorific: 'Hoài Văn Hầu', role_text: 'Thiếu niên anh hùng chiêu mộ hơn 1000 quân, giương cờ Phá cường địch báo hoàng ân' },
        { id: 3, name: 'Trần Thủ Độ', honorific: 'Thái Sư', role_text: 'Trụ cột triều Trần đầu thời kỳ kháng chiến chống Mông Cổ 1258' },
        { id: 4, name: 'Trần Bình Trọng', honorific: 'Bảo Nghĩa Vương', role_text: 'Tiết tháo anh hùng thà làm quỷ nước Nam chứ không thèm làm vương đất Bắc' },
        { id: 5, name: 'Trần Nhân Tông', honorific: 'Phật Hoàng Trúc Lâm', role_text: 'Vị vua anh minh lãnh đạo quân dân đánh tan hai cuộc xâm lược 1285 và 1288' },
        { id: 6, name: 'Trần Khánh Dư', honorific: 'Nhân Huệ Vương', role_text: 'Danh tướng thủy quân chỉ huy chiến thắng Vân Đồn tiêu diệt đoàn thuyền lương' },
        { id: 7, name: 'Phạm Ngũ Lão', honorific: 'Điện Súy', role_text: 'Danh tướng xuất thân bình dân, tác giả bài thơ Thuật hoài (Tỏ lòng)' },
        { id: 8, name: 'Yết Kiêu', honorific: 'Danh Tướng Thủy Chiến', role_text: 'Gia tướng trung thành của Trần Hưng Đạo, tài bơi lặn đục thuyền giặc' },
      ];
    }
    // mô hình Python đang chạy: 8 danh tướng nhập vai (như trang giáo viên trước đây) cùng các hồ sơ đã công bố, không đòi kho chỉ mục
    if (pythonOn()) {
      return this.db.query(
        `SELECT f.id, f.name, f.honorific, f.role_text FROM hist_figures f
         WHERE f.slug = ANY($1) OR (f.status = 'published' AND EXISTS (SELECT 1 FROM hk_ai_chunks c WHERE c.source_kind = 'figure' AND c.source_id = f.id))
         ORDER BY COALESCE(array_position($1::text[], f.slug), 99), f.name`, [ROLEPLAY_SLUGS]);
    }
    return this.db.query(
      `SELECT f.id, f.name, f.honorific, f.role_text FROM hist_figures f WHERE f.status = 'published' AND EXISTS (SELECT 1 FROM hk_ai_chunks c WHERE c.source_kind = 'figure' AND c.source_id = f.id) ORDER BY f.name`);
  }

  /** Lộ trình ôn tập cá nhân hóa BKT (Bayesian Knowledge Tracing) cho Học sinh */
  async bktRecommendations(user: UserRow, topK = 6) {
    const studentId = `user_${user.id || 1}`;
    const dbProfile = this.analytics
      ? await this.analytics.studentAiProfile(user).catch(() => null)
      : null;

    const pyRes = await this.callPythonBridge('bkt_recommendations', {
      student_id: studentId,
      top_k: topK,
      student_profile: dbProfile ? buildProfilePromptContext(dbProfile) : undefined,
    });
    if (pyRes) {
      return dbProfile ? enrichBktResponse(pyRes, dbProfile, 'python_bkt+db') : pyRes;
    }
    if (dbProfile) {
      return buildNodeBktRecommendations(studentId, dbProfile, topK);
    }
    return {
      student_id: studentId,
      bkt_parameters: { p_l0: 0.3, p_t: 0.15, p_g: 0.25, p_s: 0.1, mastery_threshold: 0.6 },
      total_recommendations: 0,
      recommendations: [],
      profile: null,
    };
  }

  /** Làm mới phiên hội thoại đa lượt (Multi-turn Session Memory) */
  async resetSession(user: UserRow, body: { conversation_id?: number; session_id?: string }) {
    const sessionId = body?.session_id || `user_${user.id || 1}_conv_${body?.conversation_id || 1}`;
    const pyRes = await this.callPythonBridge('reset_session', { session_id: sessionId });
    return pyRes ?? { reset: true, session_id: sessionId };
  }

  /** Dạy thêm tri thức mới cho Model AI Đông A ngay lúc chạy (Hot-Reload Knowledge Base) */
  async teachKnowledge(_user: UserRow, body: Record<string, any>) {
    if (!body?.topic || !body?.answer) {
      throw new BadRequestException('Hãy nhập chủ đề và câu trả lời chuẩn để dạy AI');
    }
    const pyRes = await this.callPythonBridge('teach', body);
    if (!pyRes) throw new BadRequestException('Không kết nối được bộ máy Python AI Đông A');
    return pyRes;
  }
}
