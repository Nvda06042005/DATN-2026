/**
 * Công cụ AI cho giáo viên (Sprint 9): soạn câu hỏi từ bài học / tư liệu (HK.GV.038, giáo viên chỉnh và duyệt trước khi lưu), gợi ý kịch bản tiết học (HK.GV.075) và
 * tổng hợp chủ đề học sinh hỏi nhiều (HK.GV.074, ẩn danh). Khi chưa nối mô hình ngôn ngữ, câu hỏi được soạn theo mẫu từ các câu có mốc thời gian trong tư liệu và
 * kịch bản tiết học dựng từ cấu trúc hành trình, để chức năng vẫn dùng được và kết quả kiểm chứng được. Bản nháp không tự lưu: giáo viên lưu qua API câu hỏi bình thường.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { visibleSql, notFound } from '../content/access';
import { normalizeData, QType } from '../content/questions';
import { DatabaseService, UserRow } from '../database/database.service';
import { sentences, words } from './ai-text';
import { AiSettingsService } from './ai-settings.service';
import { AiTutorService, Answer } from './ai-tutor.service';
import { LlmClient } from './llm.client';

export interface QuestionDraft { qtype: QType; prompt: string; explanation: string; difficulty: number; data: Record<string, unknown> }
const short = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const YEAR = /\b(1[0-4]\d{2})\b/;

/** Chuyển một mục JSON do mô hình trả về thành bản nháp hợp lệ; trả null nếu sai cấu trúc */
export function toDraft(raw: any): QuestionDraft | null {
  try {
    const prompt = String(raw?.prompt ?? '').trim();
    const explanation = String(raw?.explanation ?? '').trim().slice(0, 400);
    const difficulty = Math.min(3, Math.max(1, Math.round(Number(raw?.difficulty ?? 2)) || 2));
    if (!prompt || prompt.length > 400) return null;
    const qtype = String(raw?.qtype);
    let data: unknown;
    if (qtype === 'single') {
      const opts = (Array.isArray(raw.options) ? raw.options : []).map((o: unknown) => String(o).trim()).filter(Boolean);
      const idx = Number(raw.correct);
      if (!Number.isInteger(idx) || idx < 0 || idx >= opts.length) return null;
      data = { options: opts.map((text: string, i: number) => ({ id: String.fromCharCode(97 + i), text })), correct: String.fromCharCode(97 + idx) };
    } else if (qtype === 'truefalse') {
      if (typeof raw.correct !== 'boolean') return null;
      data = { correct: raw.correct };
    } else if (qtype === 'fill') {
      data = { blanks: (Array.isArray(raw.blanks) ? raw.blanks : []).map((b: unknown) => ({ accept: (Array.isArray(b) ? b : [b]).map((x) => String(x)) })) };
    } else return null;
    return { qtype: qtype as QType, prompt, explanation, difficulty, data: normalizeData(qtype as QType, data, prompt) as unknown as Record<string, unknown> };
  } catch { return null; }
}

/** Soạn theo mẫu từ các câu có mốc năm: xen kẽ điền khuyết và đúng / sai (câu sai đổi năm lệch vài năm) */
export function templateDrafts(text: string, count: number): QuestionDraft[] {
  const cands = sentences(text).filter((s) => s.length >= 40 && s.length <= 240 && YEAR.test(s));
  const out: QuestionDraft[] = [];
  for (const [i, s] of cands.entries()) {
    if (out.length >= count) break;
    const year = s.match(YEAR)![1];
    const explanation = `Theo tư liệu: ${s}`.slice(0, 400);
    if (out.length % 2 === 0) {
      const prompt = `Điền vào chỗ trống: ${s.replace(year, '____')}`;
      if (prompt.length > 400) continue;
      const d = toDraft({ qtype: 'fill', prompt, blanks: [[year]], explanation, difficulty: 2 });
      if (d) out.push(d);
    } else {
      const wrong = i % 4 === 1;
      const stated = wrong ? s.replace(year, String(Number(year) + (Number(year) % 2 ? 3 : 5))) : s;
      const d = toDraft({ qtype: 'truefalse', prompt: `Đúng hay sai: “${stated}”`, correct: !wrong, explanation: wrong ? `Sai: đúng phải là năm ${year}. ${explanation}` : explanation, difficulty: 1 });
      if (d) out.push(d);
    }
  }
  return out;
}

@Injectable()
export class AiToolsService {
  private readonly logger = new Logger('AiTools');

  constructor(private readonly db: DatabaseService, private readonly tutor: AiTutorService, private readonly settings: AiSettingsService, private readonly llm: LlmClient) {}

  // ---------------------------------------------------------------------- HK.GV.038
  async questionDrafts(user: UserRow, body: { kind?: string; id?: number; text?: string; count?: number }) {
    const count = Math.min(8, Math.max(1, Math.round(Number(body.count ?? 5)) || 5));
    const kind = String(body.kind ?? 'text');
    let title = 'Văn bản giáo viên nhập';
    let text = String(body.text ?? '');
    if (kind !== 'text') { const src = await this.tutor.sourceText(kind, Number(body.id)); title = src.title; text = src.text; }
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length < 80) throw new BadRequestException('Nội dung quá ngắn để soạn câu hỏi (cần ít nhất 80 ký tự)');
    if (text.length > 12000) text = text.slice(0, 12000);
    const startedAt = Date.now();
    await this.tutor.assertQuota(user);
    const cfg = await this.settings.llm();
    const s = await this.settings.get();
    let drafts: QuestionDraft[] = [];
    let mode: 'llm' | 'template' = 'template';
    let usage = { tokensIn: 0, tokensOut: 0 };
    if (cfg) {
      try {
        const res = await this.llm.chat(cfg, {
          system: 'Bạn là giáo viên Lịch sử THCS soạn câu hỏi kiểm tra từ tư liệu. Chỉ dùng thông tin có trong tư liệu, không bịa. Trả về DUY NHẤT một mảng JSON, không kèm chữ nào khác.',
          messages: [{ role: 'user', content: `TƯ LIỆU (${title}):\n${text}\n\nSoạn ${count} câu hỏi tiếng Việt, đa dạng dạng. Mỗi phần tử là một trong:\n`
            + '{"qtype":"single","prompt":"...","options":["A","B","C","D"],"correct":0,"explanation":"...","difficulty":1}\n'
            + '{"qtype":"truefalse","prompt":"...","correct":true,"explanation":"...","difficulty":1}\n'
            + '{"qtype":"fill","prompt":"... ____ ...","blanks":[["đáp án","cách viết khác"]],"explanation":"...","difficulty":2}\n'
            + 'difficulty từ 1 (dễ) đến 3 (khó); câu điền khuyết có đúng một "____" cho mỗi chỗ trống; đáp án sai phải hợp lý, không trùng nhau.' }],
          temperature: Math.min(0.7, s.temperature + 0.2), maxTokens: 2500,
        });
        const m = res.text.match(/\[[\s\S]*\]/);
        const arr = m ? JSON.parse(m[0]) : [];
        const seen = new Set<string>();
        for (const raw of Array.isArray(arr) ? arr : []) {
          const d = toDraft(raw);
          if (d && !seen.has(d.prompt)) { seen.add(d.prompt); drafts.push(d); }
        }
        drafts = drafts.slice(0, count);
        usage = { tokensIn: res.tokensIn, tokensOut: res.tokensOut };
        if (drafts.length) mode = 'llm';
      } catch (e) { this.logger.warn(`AI soạn câu hỏi lỗi, dùng mẫu: ${(e as Error).message}`); }
    }
    if (!drafts.length) drafts = templateDrafts(text, count);
    if (!drafts.length) throw new ConflictException('Chưa soạn được câu hỏi: nội dung không có câu nào chứa mốc thời gian để soạn theo mẫu. Hãy nhờ quản trị viên bật mô hình AI.');
    const convId = await this.logSaved(user, 'questions', `Soạn câu hỏi: ${title}`, `Soạn ${count} câu hỏi từ: ${title}`, `Đã soạn ${drafts.length} bản nháp câu hỏi (${mode === 'llm' ? 'mô hình AI' : 'theo mẫu'}).`, mode === 'llm' ? { mode: 'llm', model: cfg?.chatModel ?? null, ...usage } : {}, startedAt);
    return { conversation_id: convId, mode, title, drafts, note: mode === 'llm' ? 'Bản nháp do AI soạn: hãy đọc, chỉnh sửa và đối chiếu tư liệu trước khi lưu.' : 'Chưa nối mô hình AI nên câu hỏi được soạn theo mẫu từ các câu có mốc năm; hãy đọc và chỉnh sửa trước khi lưu.' };
  }

  private async logSaved(user: UserRow, mode: 'questions' | 'plan', title: string, request: string, text: string, a: Partial<Answer>, startedAt: number): Promise<number> {
    const conv = (await this.db.query<{ id: number }>('INSERT INTO hk_ai_conversations (user_id, title, mode) VALUES ($1, $2, $3) RETURNING id::int AS id', [user.id, short(title, 100), mode]))[0];
    await this.tutor.save(conv.id, request, {
      text, citations: [], followups: [], refused: false, reason: null, mode: a.mode ?? 'extractive', model: a.model ?? null, tokensIn: a.tokensIn ?? 0, tokensOut: a.tokensOut ?? 0, topScore: null, passages: [],
    }, startedAt);
    return conv.id;
  }

  // ---------------------------------------------------------------------- HK.GV.075
  async lessonPlan(user: UserRow, body: { journey_id?: number; battle_id?: number; minutes?: number; note?: string }) {
    const minutes = Math.min(90, Math.max(15, Math.round(Number(body.minutes ?? 45)) || 45));
    let title: string;
    let outline: string[] = [];
    let context = '';
    if (body.journey_id) {
      const params: unknown[] = [Number(body.journey_id)];
      const vis = visibleSql(user, 'j', params);
      const j = (await this.db.query<{ id: number; title: string; description: string | null; campaign: string }>(
        `SELECT j.id, j.title, j.description, c.title AS campaign FROM hk_journeys j JOIN hist_campaigns c ON c.id = j.campaign_id WHERE j.id = $1 AND ${vis}`, params))[0];
      if (!j) throw notFound('hành trình');
      const nodes = await this.db.query<{ kind: string; title: string; objective: string | null }>('SELECT kind, title, objective FROM hk_nodes WHERE journey_id = $1 ORDER BY position', [j.id]);
      title = `${j.title} (${j.campaign})`;
      outline = nodes.map((n) => `${n.title} [${n.kind}]${n.objective ? `: ${n.objective}` : ''}`);
      context = `Hành trình: ${title}\n${j.description ?? ''}\nCác nút: ${outline.join('; ')}`;
    } else if (body.battle_id) {
      const src = await this.tutor.sourceText('battle', Number(body.battle_id));
      title = src.title; outline = [`Tìm hiểu bối cảnh và lực lượng`, `Diễn biến trận ${src.title}`, 'Kết quả và ý nghĩa']; context = `Trận đánh: ${src.title}\n${src.text}`;
    } else throw new BadRequestException('Hãy chọn một hành trình hoặc một trận đánh');
    const note = String(body.note ?? '').trim().slice(0, 300);
    const startedAt = Date.now();
    await this.tutor.assertQuota(user);
    const cfg = await this.settings.llm();
    const s = await this.settings.get();
    let text = '';
    let mode: 'llm' | 'template' = 'template';
    let usage = { tokensIn: 0, tokensOut: 0 };
    if (cfg) {
      try {
        const res = await this.llm.chat(cfg, {
          system: 'Bạn là chuyên viên đào tạo giáo viên Lịch sử THCS. Soạn kịch bản tiết học thực tế, ngắn gọn, bằng tiếng Việt, chỉ dựa vào thông tin được cung cấp; không bịa sự kiện lịch sử.',
          messages: [{ role: 'user', content: `${context.slice(0, 7000)}\n\nSoạn kịch bản tiết học ${minutes} phút có dùng nền tảng Hào Khí Đông A (bài học từng bước, câu hỏi, mô phỏng trận đánh, thi đấu trực tiếp, bản đồ hành quân). `
            + `Gồm: Mục tiêu; Chuẩn bị; Tiến trình theo mốc thời gian (tổng đúng ${minutes} phút); Câu hỏi thảo luận; Đánh giá.${note ? ` Ghi chú của giáo viên: ${note}` : ''}` }],
          temperature: s.temperature, maxTokens: 1800,
        });
        text = res.text; usage = { tokensIn: res.tokensIn, tokensOut: res.tokensOut }; mode = 'llm';
      } catch (e) { this.logger.warn(`AI soạn giáo án lỗi, dùng mẫu: ${(e as Error).message}`); }
    }
    if (!text) text = this.planTemplate(title, minutes, outline, note);
    const convId = await this.logSaved(user, 'plan', `Kịch bản: ${title}`, `Gợi ý kịch bản tiết học ${minutes} phút: ${title}`, text, mode === 'llm' ? { mode: 'llm', model: cfg?.chatModel ?? null, ...usage } : {}, startedAt);
    return { conversation_id: convId, mode, title, minutes, text, note: mode === 'llm' ? 'Kịch bản do AI gợi ý: hãy điều chỉnh theo lớp của thầy cô.' : 'Chưa nối mô hình AI nên kịch bản được dựng theo mẫu từ cấu trúc hành trình; hãy điều chỉnh theo lớp của thầy cô.' };
  }

  private planTemplate(title: string, minutes: number, outline: string[], note: string): string {
    const warm = Math.max(3, Math.round(minutes * 0.1)), wrap = Math.max(5, Math.round(minutes * 0.15)), assess = Math.max(4, Math.round(minutes * 0.1));
    const main = Math.max(5, minutes - warm - wrap - assess);
    const steps = outline.slice(0, 6);
    const per = steps.length ? Math.max(3, Math.floor(main / steps.length)) : main;
    return [
      `KỊCH BẢN TIẾT HỌC (${minutes} phút): ${title}`,
      '',
      'Mục tiêu: học sinh nêu được diễn biến chính, nhân vật và ý nghĩa của nội dung; luyện tập đọc tư liệu và trả lời câu hỏi có trích dẫn.',
      'Chuẩn bị: máy chiếu; học sinh có tài khoản Hào Khí Đông A; hành trình đã giao cho lớp.',
      note ? `Ghi chú của giáo viên: ${note}` : '',
      '',
      `1. Khởi động (${warm} phút): chiếu một câu hỏi nhanh hoặc ảnh tư liệu liên quan để gợi mở; học sinh đoán và nêu thắc mắc.`,
      `2. Hoạt động chính (${main} phút):`,
      ...(steps.length ? steps.map((s, i) => `   ${String.fromCharCode(97 + i)}) (${per} phút) ${s}`) : ['   – Cho học sinh học các bài trong hành trình, giáo viên đi quanh hỗ trợ.']),
      `3. Củng cố (${wrap} phút): tổ chức thi đấu trực tiếp theo đội với bộ câu hỏi của hành trình; công bố đội thắng và nhắc lại ba ý chính.`,
      `4. Đánh giá (${assess} phút): học sinh trả lời 2–3 câu hỏi thảo luận; giáo viên xem kết quả ở bảng điều khiển lớp.`,
      '',
      'Câu hỏi thảo luận gợi ý: (1) Vì sao quân dân nhà Trần giành thắng lợi? (2) Tư liệu nào em thấy thuyết phục nhất, vì sao? (3) Nếu là người chỉ huy, em sẽ quyết định khác ở điểm nào?',
    ].filter((l) => l !== '').join('\n');
  }

  // ---------------------------------------------------------------------- HK.GV.074 (ẩn danh)
  async topics(user: UserRow, daysRaw?: number) {
    if (!['teacher', 'school_admin', 'root_admin'].includes(user.role)) throw new ForbiddenException('Chỉ giáo viên và quản trị xem được tổng hợp này');
    const days = Math.min(90, Math.max(1, Math.round(Number(daysRaw ?? 30)) || 30));
    const params: unknown[] = [days];
    let scope: string;
    if (user.role === 'teacher') { params.push(user.id); scope = 'u.id IN (SELECT m.user_id FROM app_class_members m JOIN app_class_teachers t ON t.class_id = m.class_id WHERE t.teacher_id = $2)'; }
    else if (user.role === 'school_admin') { params.push(user.school_id); scope = "u.school_id = $2 AND u.role = 'student'"; }
    else scope = "u.role = 'student'";
    const base = `FROM hk_ai_messages m JOIN hk_ai_conversations c ON c.id = m.conversation_id JOIN app_users u ON u.id = c.user_id
                  WHERE c.mode IN ('tutor', 'roleplay') AND m.created_at >= now() - ($1::int * interval '1 day') AND ${scope}`;
    const totals = (await this.db.query<{ questions: number; students: number; refused: number }>(
      `SELECT count(*) FILTER (WHERE m.role = 'user')::int AS questions, count(DISTINCT c.user_id)::int AS students, count(*) FILTER (WHERE m.role = 'assistant' AND m.refused)::int AS refused ${base}`, params))[0];
    const cited = await this.db.query<{ kind: string; id: number; title: string; asked: number }>(
      `SELECT cit->>'kind' AS kind, (cit->>'id')::int AS id, cit->>'title' AS title, count(DISTINCT m.id)::int AS asked
       ${base.replace('WHERE', ', jsonb_array_elements(m.citations) cit WHERE')} AND m.role = 'assistant' AND m.refused = false GROUP BY 1, 2, 3 ORDER BY asked DESC, title LIMIT 15`, params);
    // từ khóa chỉ hiện khi có từ 3 học sinh trở lên cùng hỏi (giữ ẩn danh)
    let keywords: Array<{ word: string; count: number }> = [];
    if (totals.students >= 3) {
      const qs = await this.db.query<{ content: string }>(`SELECT m.content ${base} AND m.role = 'user' ORDER BY m.id DESC LIMIT 2000`, params);
      const freq = new Map<string, number>();
      for (const r of qs) for (const w of new Set(words(r.content))) if (w.length >= 3) freq.set(w, (freq.get(w) ?? 0) + 1);
      keywords = [...freq.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([word, count]) => ({ word, count }));
    }
    return { days, ...totals, topics: cited, keywords, anonymous: true, note: 'Chỉ hiện số liệu tổng hợp, không có tên học sinh; từ khóa chỉ hiện khi có ít nhất 3 học sinh cùng hỏi.' };
  }
}
