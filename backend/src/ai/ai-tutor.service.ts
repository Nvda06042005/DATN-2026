/**
 * AI Tutor "Tiểu Tướng" (Sprint 9, HK.HS.086–093, HK.GV.073, HK.SYS.009–010): hỏi đáp dựa trên tư liệu đã công bố (RAG), trích dẫn nguồn, gợi ý câu hỏi tiếp theo,
 * giải thích câu làm sai, tóm tắt bài / trận đánh, nhập vai nhân vật, lịch sử trò chuyện và báo cáo câu trả lời sai.
 * Quy trình mỗi câu hỏi: kiểm tra độ dài và hạn mức → lọc nội dung → truy xuất → kiểm soát phạm vi (đoạn tốt nhất phải đủ "độ phủ") → mô hình sinh câu trả lời kèm [n]
 * (hoặc trích nguyên văn tư liệu khi chưa nối mô hình) → lọc lại đầu ra → lưu hội thoại. Máy chủ không bao giờ tin số liệu do mô hình tự nêu: trích dẫn chỉ gồm các đoạn đã truy xuất.
 */
import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DatabaseService, UserRow } from '../database/database.service';
import { notFound } from '../content/access';
import { citedNumbers, sentences, unsafeReason, words } from './ai-text';
import { kindLabel, lessonText } from './ai-index.service';
import { AiRetrievalService, Passage } from './ai-retrieval.service';
import { AiSettings, AiSettingsService } from './ai-settings.service';
import { LlmClient, LlmConfig, LlmMessage } from './llm.client';

export interface Citation { n: number; kind: string; kind_label: string; id: number; title: string; snippet: string; openable: boolean }
export type RefusalReason = 'out_of_scope' | 'unsafe' | 'quota' | 'not_configured';
export interface Answer {
  text: string; citations: Citation[]; followups: string[]; refused: boolean; reason: RefusalReason | null; mode: 'llm' | 'extractive' | null;
  model: string | null; tokensIn: number; tokensOut: number; topScore: number | null; passages: Passage[];
}

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

@Injectable()
export class AiTutorService {
  private readonly logger = new Logger('AiTutor');

  constructor(
    private readonly db: DatabaseService, private readonly settings: AiSettingsService, private readonly retrieval: AiRetrievalService, private readonly llm: LlmClient,
  ) {}

  // ---------------------------------------------------------------------- hạn mức (HK.AD.064)
  async quota(user: UserRow) {
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
    const q = await this.quota(user);
    if (q.unlimited) return;
    if (q.used >= q.limit) throw new HttpException(`Hôm nay em đã dùng hết ${q.limit} lượt hỏi Tiểu Tướng. Ngày mai em quay lại nhé!`, HttpStatus.TOO_MANY_REQUESTS);
    if (q.school_used >= q.school_limit) throw new HttpException('Hôm nay trường của em đã dùng hết lượt hỏi Tiểu Tướng. Em thử lại vào ngày mai nhé!', HttpStatus.TOO_MANY_REQUESTS);
  }

  async status(user: UserRow) {
    const [pub, quota, chunks] = await Promise.all([this.settings.publicView(), this.quota(user), this.retrieval.size()]);
    return { mode: pub.mode, ready: chunks > 0, chunks, quota, roleplay: pub.mode === 'llm', modes: MODES_BY_ROLE[user.role] ?? [] };
  }

  // ---------------------------------------------------------------------- lõi: truy xuất → trả lời
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
  }): Promise<Answer> {
    const s = await this.settings.get();
    const cfg = await this.settings.llm();
    const bad = unsafeReason(o.question, s.banned_terms);
    if (bad === 'unsafe') return this.refusal('unsafe', UNSAFE_MESSAGE);
    if (bad === 'injection') return this.refusal('out_of_scope', s.refusal_message, await this.exampleQuestions());
    if (o.needLlm && !cfg) return this.refusal('not_configured', 'Tính năng này cần bật mô hình AI. Em nhờ thầy cô hoặc quản trị viên cấu hình giúp nhé; trong lúc chờ em vẫn hỏi đáp bình thường được.');

    let queryVector: number[] | null = null;
    if (cfg?.embedModel && !o.fixed) { try { queryVector = (await this.llm.embed(cfg, [o.question]))[0]; } catch (e) { this.logger.warn(`Không nhúng được câu hỏi: ${(e as Error).message}`); } }
    const passages = o.fixed ?? await this.retrieval.search(o.searchText ?? o.question, s.top_k, { only: o.only, focus: o.focus, queryVector });
    const best = passages[0];
    const topScore = best ? Math.max(best.coverage, best.cos) : 0;
    const inScope = o.skipGate || Boolean(best && (best.coverage >= s.min_score || best.cos >= 0.5));
    if (!inScope) return { ...this.refusal('out_of_scope', s.refusal_message, await this.exampleQuestions()), topScore };

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

  // ---------------------------------------------------------------------- hội thoại
  private async conversation(user: UserRow, id: number | null | undefined, mode: string, title: string, figureId: number | null = null): Promise<{ id: number; mode: string; figure_id: number | null }> {
    if (id) {
      const c = (await this.db.query<{ id: number; mode: string; figure_id: number | null }>('SELECT id::int AS id, mode, figure_id FROM hk_ai_conversations WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, user.id]))[0];
      if (!c) throw notFound('cuộc trò chuyện');
      return c;
    }
    return (await this.db.query<{ id: number; mode: string; figure_id: number | null }>(
      'INSERT INTO hk_ai_conversations (user_id, title, mode, figure_id) VALUES ($1, $2, $3, $4) RETURNING id::int AS id, mode, figure_id', [user.id, short(title, 100), mode, figureId]))[0];
  }

  private async historyOf(conversationId: number): Promise<LlmMessage[]> {
    const rows = await this.db.query<{ role: 'user' | 'assistant'; content: string; refused: boolean }>(
      'SELECT role, content, refused FROM hk_ai_messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 6', [conversationId]);
    return rows.reverse().filter((r) => !r.refused).map((r) => ({ role: r.role, content: short(r.content, 800) }));
  }

  /** Lưu cặp tin nhắn người hỏi – trợ lý và trả về dạng hiển thị */
  async save(conversationId: number, question: string, a: Answer, startedAt: number) {
    const u = (await this.db.query<{ id: number; created_at: string }>("INSERT INTO hk_ai_messages (conversation_id, role, content) VALUES ($1, 'user', $2) RETURNING id::int AS id, created_at", [conversationId, question]))[0];
    const m = (await this.db.query<{ id: number; created_at: string }>(
      `INSERT INTO hk_ai_messages (conversation_id, role, content, citations, followups, refused, refusal_reason, answer_mode, model, tokens_in, tokens_out, latency_ms, top_score)
       VALUES ($1, 'assistant', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id::int AS id, created_at`,
      [conversationId, a.text.slice(0, 8000), JSON.stringify(a.citations), JSON.stringify(a.followups), a.refused, a.reason, a.mode, a.model, a.tokensIn, a.tokensOut, Date.now() - startedAt, a.topScore === null ? null : Number(a.topScore.toFixed(3))]))[0];
    await this.db.query('UPDATE hk_ai_conversations SET updated_at = now() WHERE id = $1', [conversationId]);
    return {
      user_message: { id: u.id, role: 'user', content: question, created_at: u.created_at },
      message: { id: m.id, role: 'assistant', content: a.text, citations: a.citations, followups: a.followups, refused: a.refused, refusal_reason: a.reason, answer_mode: a.mode, reported: false, created_at: m.created_at },
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
    let figure: { id: number; name: string; honorific: string | null } | undefined;
    let figureId = conv0 ? conv0.figure_id : body.figure_id ?? null;
    if (mode === 'roleplay') {
      if (!figureId) throw new BadRequestException('Hãy chọn nhân vật để nhập vai');
      figure = (await this.db.query<{ id: number; name: string; honorific: string | null }>("SELECT id, name, honorific FROM hist_figures WHERE id = $1 AND status = 'published'", [figureId]))[0];
      if (!figure) throw notFound('nhân vật');
    }
    const conv = conv0 ?? await this.conversation(user, null, mode, mode === 'roleplay' ? `Trò chuyện với ${figure!.name}` : question, figure?.id ?? null);
    const history = conv0 ? await this.historyOf(conv.id) : [];
    // câu hỏi nối tiếp ngắn ("Còn ông ấy thì sao?") mượn từ khóa của câu hỏi trước để truy xuất
    const prev = history.filter((h) => h.role === 'user').slice(-1)[0]?.content ?? '';
    const searchText = words(question).length < 3 && prev ? `${prev} ${question}` : question;
    let answer: Answer;
    if (mode === 'roleplay' && figure) {
      const links = await this.db.query<{ kind: string; id: number }>(
        `SELECT b_type AS kind, b_id AS id FROM hist_links WHERE a_type = 'figure' AND a_id = $1 UNION SELECT a_type, a_id FROM hist_links WHERE b_type = 'figure' AND b_id = $1`, [figure.id]);
      answer = await this.respond({ question, history, searchText, needLlm: true, persona: figure, focus: [{ kind: 'figure', id: figure.id, w: 0.2 }, ...links.map((l) => ({ ...l, w: 0.02 }))], skipGate: true, only: ['figure', 'event', 'battle', 'source', 'campaign', 'place', 'term', 'doc'] });
    } else {
      answer = await this.respond({ question, history, searchText });
    }
    return { conversation: { id: conv.id, mode: conv.mode, figure_id: conv.figure_id }, ...(await this.save(conv.id, question, answer, startedAt)) };
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
      `SELECT m.id::int AS id, m.role, m.content, m.citations, m.followups, m.refused, m.refusal_reason, m.answer_mode, m.created_at, EXISTS (SELECT 1 FROM hk_ai_reports r WHERE r.message_id = m.id AND r.user_id = $2) AS reported
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
    return this.db.query(
      `SELECT f.id, f.name, f.honorific, f.role_text FROM hist_figures f WHERE f.status = 'published' AND EXISTS (SELECT 1 FROM hk_ai_chunks c WHERE c.source_kind = 'figure' AND c.source_id = f.id) ORDER BY f.name`);
  }
}
