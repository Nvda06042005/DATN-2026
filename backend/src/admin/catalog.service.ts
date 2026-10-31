/**
 * TM.SA-CONTENT.001–005 – quản trị tổng quản lý nội dung: chương trình lịch sử, ngân hàng câu hỏi dùng chung, kho sử liệu AI,
 * danh mục thẻ danh tướng, luật EXP/huy hiệu. Mỗi thay đổi tăng `version` và ghi ảnh chụp vào app_content_history.
 * Câu hỏi và luật EXP có hiệu lực ngay với game; chương trình, sử liệu AI và thẻ là dữ liệu quản trị (xem docs/ADMIN_CONTENT.md).
 */
import { ConflictException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, UnprocessableEntityException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { BankOverlay, BankQuestion, ContentService, QuestionType } from '../student/content.service';
import { BADGE_METRICS, DEFAULT_RULES, ExpRules, setActiveRules } from '../student/progress';

const bad = (message: string) => new UnprocessableEntityException(message);
/** JSON với khóa đã sắp xếp: jsonb của PostgreSQL trả khóa theo thứ tự khác nên so sánh phải không phụ thuộc thứ tự khóa */
const canonical = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x));
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
const clean = (s: string | null | undefined) => (s ?? '').split(/\s+/).filter(Boolean).join(' ');
/** Bỏ dấu, chữ thường, giữ nguyên độ dài (văn bản đã chuẩn hóa NFC) để cắt trích đoạn đúng chỗ */
const fold = (s: string) => s.replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
/** Mẫu LIKE từ chuỗi người dùng nhập (thoát % và _) */
const like = (s: string) => `%${s.trim().replace(/[\\%_]/g, '\\$&')}%`;
const pageOf = (page?: number, limit?: number, max = 100) => {
  const size = Math.min(Math.max(limit ?? 20, 1), max), at = Math.max(page ?? 1, 1);
  return { limit: size, page: at, offset: (at - 1) * size };
};

export const NODE_KINDS = ['campaign', 'chapter', 'lesson', 'stage', 'battle'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];
export const NODE_LABEL: Record<NodeKind, string> = { campaign: 'Cuộc kháng chiến', chapter: 'Chương', lesson: 'Bài', stage: 'Ải', battle: 'Trận đánh' };
export type PublishState = 'draft' | 'published' | 'archived';
export const RARITIES = ['hiem', 'su_thi', 'huyen_thoai', 'tiet_che'] as const;
export const LORE_KINDS = ['chinh_su', 'giai_thoai', 'sang_tao', 'dan_gian'] as const;
export const SOURCE_KINDS = ['chinh_su', 'giai_thoai', 'tham_khao'] as const;

interface NodeRow { id: number; parent_id: number | null; kind: NodeKind; code: string; title: string; summary: string; period: string | null; sort_order: number; status: PublishState; version: number; updated_at: string }
export interface NodeInput { kind?: NodeKind; parent_id?: number | null; code?: string; title?: string; summary?: string; period?: string | null; sort_order?: number; status?: PublishState }
export interface QuestionInput {
  unit_id: string; type: QuestionType; prompt: string; explanation: string; level?: string; source?: string | null; hint?: string | null;
  options?: string[]; answer?: number | boolean | string; items?: string[]; left?: string[]; right?: string[]; keep_order?: boolean;
}
export interface QuestionFilter { q?: string; unit_id?: string; type?: string; level?: string; status?: string; origin?: string; page?: number; limit?: number }
export interface SourceInput { title?: string; citation?: string; kind?: (typeof SOURCE_KINDS)[number]; unit_id?: string | null; content?: string; file_name?: string | null }
export interface CardInput { code?: string; name?: string; title?: string | null; role?: string | null; rarity?: (typeof RARITIES)[number]; kind?: (typeof LORE_KINDS)[number]; summary?: string; source?: string; unlock_condition?: string; sort_order?: number }

/** Luật gửi lên phải đủ và hợp lý: số nguyên không âm, mốc cấp tăng dần từ 0, mã huy hiệu duy nhất */
export function parseRules(input: unknown): ExpRules {
  const r = (input ?? {}) as Record<string, unknown>;
  const int = (name: string, max: number): number => {
    const v = r[name];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > max) throw bad(`${name} phải là số nguyên từ 0 đến ${max}`);
    return v;
  };
  const rules: ExpRules = {
    xp_correct: int('xp_correct', 1000), xp_wrong: int('xp_wrong', 1000), gems_correct: int('gems_correct', 1000), gems_weak: int('gems_weak', 1000), daily_gem_cap: int('daily_gem_cap', 100000),
    weak_threshold: Number(r.weak_threshold), levels: [], badges: [],
  };
  if (typeof r.weak_threshold !== 'number' || !(rules.weak_threshold >= 0 && rules.weak_threshold <= 1)) throw bad('weak_threshold phải từ 0 đến 1');
  if (rules.xp_wrong > rules.xp_correct) throw bad('XP trả lời sai không được lớn hơn XP trả lời đúng');
  if (rules.daily_gem_cap < Math.max(rules.gems_correct, rules.gems_weak)) throw bad('Trần Ấn Tín mỗi ngày phải đủ cho ít nhất một câu đúng');
  const levels = Array.isArray(r.levels) ? r.levels : [];
  if (levels.length < 2 || levels.length > 50) throw bad('Cần từ 2 đến 50 cấp bậc');
  levels.forEach((raw, i) => {
    const l = (raw ?? {}) as Record<string, unknown>, name = clean(String(l.name ?? ''));
    if (l.level !== i + 1) throw bad('Cấp bậc phải đánh số liên tục từ 1');
    if (name.length < 1 || name.length > 40) throw bad(`Tên cấp ${i + 1} dài 1–40 ký tự`);
    if (typeof l.min_xp !== 'number' || !Number.isInteger(l.min_xp) || l.min_xp < 0 || l.min_xp > 100_000_000) throw bad(`Mốc EXP của cấp ${i + 1} không hợp lệ`);
    if (i === 0 && l.min_xp !== 0) throw bad('Cấp 1 phải bắt đầu từ 0 EXP');
    if (i > 0 && l.min_xp <= rules.levels[i - 1].min_xp) throw bad('Mốc EXP phải tăng dần theo cấp');
    rules.levels.push({ level: i + 1, name, min_xp: l.min_xp });
  });
  const badges = Array.isArray(r.badges) ? r.badges : [];
  if (badges.length > 50) throw bad('Tối đa 50 huy hiệu');
  const codes = new Set<string>();
  for (const raw of badges) {
    const b = (raw ?? {}) as Record<string, unknown>, code = String(b.code ?? ''), name = clean(String(b.name ?? ''));
    if (!/^[a-z0-9_]{3,40}$/.test(code)) throw bad('Mã huy hiệu gồm chữ thường, số, gạch dưới (3–40 ký tự)');
    if (codes.has(code)) throw bad(`Trùng mã huy hiệu ${code}`);
    codes.add(code);
    if (name.length < 2 || name.length > 60) throw bad(`Tên huy hiệu ${code} dài 2–60 ký tự`);
    if (!BADGE_METRICS.includes(b.metric as never)) throw bad(`Chỉ số huy hiệu ${code} không hợp lệ`);
    const num = (key: string, min: number, max: number) => {
      const v = b[key];
      if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw bad(`${key} của huy hiệu ${code} phải là số nguyên từ ${min} đến ${max}`);
      return v;
    };
    rules.badges.push({ code, name, metric: b.metric as ExpRules['badges'][number]['metric'], threshold: num('threshold', 1, 100_000_000), reward_xp: num('reward_xp', 0, 1000), reward_gems: num('reward_gems', 0, 1000) });
  }
  return rules;
}

@Injectable()
export class CatalogService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Catalog');
  constructor(private readonly db: DatabaseService, private readonly content: ContentService) {}

  /** Nạp lớp chỉnh sửa câu hỏi và luật EXP đang hiệu lực khi khởi động; lỗi nạp không chặn dịch vụ (dùng nội dung gốc) */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.db.ready) return;
    try {
      await this.reload();
    } catch (exc) {
      this.logger.error(`Không nạp được nội dung quản trị (${(exc as Error).name}) – dùng nội dung gốc`);
    }
  }

  async reload(): Promise<void> {
    const rows = await this.db.query<BankOverlay>('SELECT id, origin, status, payload FROM app_question_bank ORDER BY created_at, id');
    this.content.applyOverlay(rows);
    const active = await this.db.query<{ config: unknown }>('SELECT config FROM app_exp_rules WHERE is_active');
    setActiveRules(active.length ? { ...DEFAULT_RULES, ...(active[0].config as Partial<ExpRules>) } : DEFAULT_RULES);
  }

  private async log(q: Q, entity: string, id: string | number, version: number, action: string, snapshot: unknown, actor: UserRow) {
    await q('INSERT INTO app_content_history (entity, entity_id, version, action, snapshot, actor_id, actor_name) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)', [entity, String(id), version, action, JSON.stringify(snapshot), actor.id, actor.full_name]);
  }

  async history(entity: string, id: string, limit = 50) {
    return this.db.query('SELECT id, entity, entity_id, version, action, snapshot, actor_name, created_at FROM app_content_history WHERE entity = $1 AND entity_id = $2 ORDER BY id DESC LIMIT $3', [entity, id, Math.min(limit, 100)]);
  }

  // ------------------------------------------------------------------ 001 chương trình lịch sử
  async curriculum() {
    const nodes = await this.db.query<NodeRow & { children: number }>(
      `SELECT n.id, n.parent_id, n.kind, n.code, n.title, n.summary, n.period, n.sort_order, n.status, n.version, n.updated_at,
         (SELECT count(*)::int FROM app_curriculum_nodes c WHERE c.parent_id = n.id) AS children
       FROM app_curriculum_nodes n ORDER BY n.sort_order, n.id`,
    );
    return { nodes, kinds: NODE_KINDS.map((id) => ({ id, label: NODE_LABEL[id] })) };
  }

  private async parentFor(q: Q, kind: NodeKind, parentId: number | null | undefined): Promise<NodeRow | null> {
    if (kind === 'campaign') {
      if (parentId) throw bad('Cuộc kháng chiến là cấp cao nhất, không có cấp cha');
      return null;
    }
    if (!parentId) throw bad(`${NODE_LABEL[kind]} phải nằm dưới một cấp cha`);
    const parent = (await q<NodeRow>('SELECT id, kind, status FROM app_curriculum_nodes WHERE id = $1 FOR UPDATE', [parentId]))[0];
    if (!parent) throw bad('Không tìm thấy cấp cha');
    if (NODE_KINDS.indexOf(parent.kind) >= NODE_KINDS.indexOf(kind)) throw bad(`${NODE_LABEL[kind]} không thể nằm dưới ${NODE_LABEL[parent.kind].toLowerCase()}; cấp cha phải cao hơn (${NODE_KINDS.map((k) => NODE_LABEL[k]).join(' › ')})`);
    return parent;
  }

  async createNode(actor: UserRow, input: NodeInput & { kind: NodeKind; code: string; title: string }) {
    return this.db.tx(async (q) => {
      await this.parentFor(q, input.kind, input.parent_id);
      if ((await q('SELECT 1 FROM app_curriculum_nodes WHERE code = $1', [input.code])).length) throw new ConflictException('Mã nội dung đã tồn tại');
      const row = (await q<NodeRow>(
        `INSERT INTO app_curriculum_nodes (parent_id, kind, code, title, summary, period, sort_order, status, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8)
         RETURNING id, parent_id, kind, code, title, summary, period, sort_order, status, version, updated_at`,
        [input.parent_id ?? null, input.kind, input.code, clean(input.title), (input.summary ?? '').trim(), clean(input.period) || null, input.sort_order ?? 0, actor.id],
      ))[0];
      await this.log(q, 'curriculum', row.id, 1, 'create', row, actor);
      return row;
    });
  }

  async updateNode(actor: UserRow, id: number, patch: NodeInput) {
    return this.db.tx(async (q) => {
      const cur = (await q<NodeRow>('SELECT id, parent_id, kind, code, title, summary, period, sort_order, status, version, updated_at FROM app_curriculum_nodes WHERE id = $1 FOR UPDATE', [id]))[0];
      if (!cur) throw new NotFoundException('Không tìm thấy nội dung');
      const next = { ...cur } as NodeRow;
      if (patch.title !== undefined) next.title = clean(patch.title);
      if (patch.summary !== undefined) next.summary = patch.summary.trim();
      if (patch.period !== undefined) next.period = clean(patch.period) || null;
      if (patch.sort_order !== undefined) next.sort_order = patch.sort_order;
      if (patch.parent_id !== undefined) next.parent_id = patch.parent_id;
      if (patch.status !== undefined) next.status = patch.status;
      if (same(next, cur)) return cur;
      const parent = await this.parentFor(q, cur.kind, next.parent_id);
      if (next.status === 'published' && parent && parent.status !== 'published') throw bad('Cần xuất bản cấp cha trước khi xuất bản nội dung này');
      if (cur.status === 'published' && next.status !== 'published' && (await q("SELECT 1 FROM app_curriculum_nodes WHERE parent_id = $1 AND status = 'published'", [id])).length) throw new ConflictException('Còn nội dung con đang xuất bản; hãy gỡ các mục con trước');
      const row = (await q<NodeRow>(
        `UPDATE app_curriculum_nodes SET parent_id = $2, title = $3, summary = $4, period = $5, sort_order = $6, status = $7, version = version + 1, updated_by = $8, updated_at = now() WHERE id = $1
         RETURNING id, parent_id, kind, code, title, summary, period, sort_order, status, version, updated_at`,
        [id, next.parent_id, next.title, next.summary, next.period, next.sort_order, next.status, actor.id],
      ))[0];
      const action = next.status !== cur.status ? (next.status === 'published' ? 'publish' : next.status === 'archived' ? 'archive' : 'unpublish') : 'update';
      await this.log(q, 'curriculum', id, row.version, action, row, actor);
      return row;
    });
  }

  // ------------------------------------------------------------------ 002 ngân hàng câu hỏi dùng chung
  private fromInput(id: string, b: QuestionInput): BankQuestion {
    const text = (s: string | null | undefined) => (s ?? '').trim();
    const q: BankQuestion = { id, unit_id: b.unit_id, type: b.type, prompt: text(b.prompt), explanation: text(b.explanation), level: b.level ?? 'THONG_HIEU', source: text(b.source) || null, hint: text(b.hint) || null };
    if (b.type === 'mcq' || b.type === 'map') q.options = (b.options ?? []).map(text);
    if (b.type === 'mcq') {
      q.answer = b.answer as number;
      if (b.keep_order) q.keep_order = true;
    }
    if (b.type === 'map') q.answer = b.answer as string;
    if (b.type === 'tf') q.answer = b.answer as boolean;
    if (b.type === 'order') q.items = (b.items ?? []).map(text);
    if (b.type === 'match') [q.left, q.right] = [(b.left ?? []).map(text), (b.right ?? []).map(text)];
    try {
      this.content.check(q);
    } catch (exc) {
      throw bad((exc as Error).message);
    }
    return q;
  }

  private async overlay(q: Q, id: string) {
    return (await q<{ id: string; origin: 'file' | 'admin'; status: 'draft' | 'published' | 'hidden'; payload: BankQuestion; version: number; review_note: string | null; updated_at: string }>('SELECT id, origin, status, payload, version, review_note, updated_at FROM app_question_bank WHERE id = $1 FOR UPDATE', [id]))[0];
  }

  async questions(f: QuestionFilter) {
    const rows = await this.db.query<{ id: string; origin: 'file' | 'admin'; status: 'draft' | 'published' | 'hidden'; payload: BankQuestion; version: number; updated_at: string }>('SELECT id, origin, status, payload, version, updated_at FROM app_question_bank');
    const over = new Map(rows.map((r) => [r.id, r]));
    const entry = (q: BankQuestion, o?: (typeof rows)[number]) => ({
      id: q.id, origin: o?.origin ?? ('file' as const), status: o?.status ?? ('published' as const), edited: Boolean(o),
      // Học sinh đang thấy một bản nào đó của câu này (câu gốc nháp chỉnh sửa vẫn dùng bản gốc)
      live: !o || o.status === 'published' || (o.origin === 'file' && o.status === 'draft'),
      unit_id: (o?.payload ?? q).unit_id, topic: this.content.topicOf((o?.payload ?? q).unit_id), type: (o?.payload ?? q).type, level: (o?.payload ?? q).level ?? 'THONG_HIEU',
      prompt: (o?.payload ?? q).prompt, source: (o?.payload ?? q).source ?? null, version: o?.version ?? 1, updated_at: o?.updated_at ?? null,
    });
    const all = [...this.content.baseQuestions().map((b) => entry(b, over.get(b.id))), ...rows.filter((r) => r.origin === 'admin').map((r) => entry(r.payload, r))];
    const needle = fold(f.q ?? '').trim();
    const items = all.filter((x) => (!f.unit_id || x.unit_id === f.unit_id) && (!f.type || x.type === f.type) && (!f.level || x.level === f.level) && (!f.status || x.status === f.status) && (!f.origin || x.origin === f.origin)
      && (!needle || fold(`${x.id} ${x.prompt} ${x.topic}`).includes(needle)));
    const { limit, page, offset } = pageOf(f.page, f.limit);
    const counts = { all: all.length, published: 0, draft: 0, hidden: 0, edited: 0, added: 0 };
    for (const x of all) {
      counts[x.status] += 1;
      if (x.edited && x.origin === 'file') counts.edited += 1;
      if (x.origin === 'admin') counts.added += 1;
    }
    const units = [...new Map(all.map((x) => [x.unit_id, x.topic])).entries()].map(([unit_id, topic]) => ({ unit_id, topic })).sort((a, b) => a.topic.localeCompare(b.topic, 'vi'));
    return { items: items.slice(offset, offset + limit), total: items.length, page, limit, counts, facets: { units, places: this.content.places } };
  }

  async question(id: string) {
    const o = (await this.db.query<{ origin: 'file' | 'admin'; status: string; payload: BankQuestion; version: number; review_note: string | null }>('SELECT origin, status, payload, version, review_note FROM app_question_bank WHERE id = $1', [id]))[0];
    const original = this.content.baseQuestions().find((b) => b.id === id) ?? null;
    if (!o && !original) throw new NotFoundException('Không tìm thấy câu hỏi');
    return { id, origin: o?.origin ?? 'file', status: o?.status ?? 'published', version: o?.version ?? 1, review_note: o?.review_note ?? null, question: o?.payload ?? original, original };
  }

  async createQuestion(actor: UserRow, input: QuestionInput) {
    const id = `adm-${randomUUID().replace(/-/g, '').slice(0, 10)}`, payload = this.fromInput(id, input);
    await this.db.tx(async (q) => {
      await q("INSERT INTO app_question_bank (id, origin, status, payload, created_by, updated_by) VALUES ($1, 'admin', 'draft', $2::jsonb, $3, $3)", [id, JSON.stringify(payload), actor.id]);
      await this.log(q, 'question', id, 1, 'create', { status: 'draft', payload }, actor);
    });
    return this.question(id);
  }

  /** Sửa nội dung: câu gốc lần đầu sửa thành bản nháp (học sinh vẫn thấy bản gốc); bản đã xuất bản sửa xong có hiệu lực ngay */
  async updateQuestion(actor: UserRow, id: string, input: QuestionInput) {
    await this.db.tx(async (q) => {
      const cur = await this.overlay(q, id), payload = this.fromInput(id, input);
      if (!cur) {
        if (!this.content.baseQuestions().some((b) => b.id === id)) throw new NotFoundException('Không tìm thấy câu hỏi');
        await q("INSERT INTO app_question_bank (id, origin, status, payload, created_by, updated_by) VALUES ($1, 'file', 'draft', $2::jsonb, $3, $3)", [id, JSON.stringify(payload), actor.id]);
        await this.log(q, 'question', id, 1, 'edit', { status: 'draft', payload }, actor);
      } else {
        if (same(cur.payload, payload)) return;
        await q('UPDATE app_question_bank SET payload = $2::jsonb, version = version + 1, updated_by = $3, updated_at = now() WHERE id = $1', [id, JSON.stringify(payload), actor.id]);
        await this.log(q, 'question', id, cur.version + 1, 'edit', { status: cur.status, payload }, actor);
      }
    });
    await this.reload();
    return this.question(id);
  }

  async setQuestionStatus(actor: UserRow, id: string, status: 'draft' | 'published' | 'hidden', note?: string | null) {
    await this.db.tx(async (q) => {
      const cur = await this.overlay(q, id);
      const original = this.content.baseQuestions().find((b) => b.id === id);
      if (!cur && !original) throw new NotFoundException('Không tìm thấy câu hỏi');
      if (!cur) {
        if (status !== 'hidden') throw bad('Câu gốc chưa chỉnh sửa đã đang được dùng; chỉ có thể ẩn hoặc sửa nội dung');
        await q("INSERT INTO app_question_bank (id, origin, status, payload, review_note, created_by, updated_by) VALUES ($1, 'file', 'hidden', $2::jsonb, $3, $4, $4)", [id, JSON.stringify(original), note ?? null, actor.id]);
        await this.log(q, 'question', id, 1, 'hide', { status, payload: original }, actor);
        return;
      }
      if (cur.status === status) return;
      if (status === 'published') {
        try {
          this.content.check(cur.payload);
        } catch (exc) {
          throw bad((exc as Error).message);
        }
      }
      await q('UPDATE app_question_bank SET status = $2, review_note = $3, version = version + 1, updated_by = $4, updated_at = now() WHERE id = $1', [id, status, note ?? null, actor.id]);
      await this.log(q, 'question', id, cur.version + 1, status === 'published' ? 'publish' : status === 'hidden' ? 'hide' : 'unpublish', { status, payload: cur.payload, note: note ?? null }, actor);
    });
    await this.reload();
    return this.question(id);
  }

  /** Câu gốc: bỏ bản chỉnh sửa để dùng lại bản gốc. Câu quản trị tạo: chỉ xóa được khi đang nháp hoặc ẩn. */
  async removeQuestionOverlay(actor: UserRow, id: string) {
    await this.db.tx(async (q) => {
      const cur = await this.overlay(q, id);
      if (!cur) throw new NotFoundException('Câu này chưa có bản chỉnh sửa nào');
      if (cur.origin === 'admin' && cur.status === 'published') throw new ConflictException('Hãy ẩn câu đang xuất bản trước khi xóa');
      await q('DELETE FROM app_question_bank WHERE id = $1', [id]);
      await this.log(q, 'question', id, cur.version + 1, cur.origin === 'file' ? 'restore_original' : 'delete', { status: cur.status, payload: cur.payload }, actor);
    });
    await this.reload();
  }

  // ------------------------------------------------------------------ 003 kho sử liệu AI
  async sources(f: { status?: string; q?: string; page?: number; limit?: number }) {
    const { limit, offset, page } = pageOf(f.page, f.limit);
    const params = [f.status ?? null, f.q ? like(f.q) : null];
    const where = '($1::text IS NULL OR status = $1) AND ($2::text IS NULL OR title ILIKE $2 OR citation ILIKE $2)';
    const [items, total, counts] = await Promise.all([
      this.db.query(`SELECT id, title, citation, kind, unit_id, file_name, status, review_note, version, length(content) AS content_length, reviewed_at, created_at, updated_at FROM app_ai_sources WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`, [...params, limit, offset]),
      this.db.query<{ n: number }>(`SELECT count(*)::int AS n FROM app_ai_sources WHERE ${where}`, params),
      this.db.query<{ status: string; n: number }>('SELECT status, count(*)::int AS n FROM app_ai_sources GROUP BY status'),
    ]);
    return { items, total: total[0].n, page, limit, counts: Object.fromEntries(['pending', 'approved', 'rejected', 'archived'].map((s) => [s, counts.find((c) => c.status === s)?.n ?? 0])), units: this.unitList() };
  }

  unitList() {
    return Object.entries(this.content.units).filter(([id]) => this.content.isLearningUnit(id)).map(([unit_id, u]) => ({ unit_id, topic: u.topic })).sort((a, b) => a.topic.localeCompare(b.topic, 'vi'));
  }

  async source(id: number) {
    const row = (await this.db.query('SELECT id, title, citation, kind, unit_id, file_name, content, status, review_note, version, reviewed_at, created_at, updated_at FROM app_ai_sources WHERE id = $1', [id]))[0];
    if (!row) throw new NotFoundException('Không tìm thấy tư liệu');
    return row;
  }

  private sourceSnapshot(row: Record<string, unknown>) {
    const { content, ...meta } = row;
    return { ...meta, content_length: String(content ?? '').length, content_sha256: createHash('sha256').update(String(content ?? '')).digest('hex') };
  }

  async createSource(actor: UserRow, input: SourceInput & { title: string; citation: string; content: string }) {
    const content = input.content.normalize('NFC').replace(/\r\n/g, '\n').trim();
    if (content.length < 20) throw bad('Nội dung tư liệu quá ngắn (tối thiểu 20 ký tự)');
    if (input.unit_id && !this.content.isLearningUnit(input.unit_id)) throw bad('Cụm tri thức không tồn tại');
    return this.db.tx(async (q) => {
      const row = (await q('INSERT INTO app_ai_sources (title, citation, kind, unit_id, file_name, content, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, title, citation, kind, unit_id, file_name, content, status, version, created_at', [clean(input.title), clean(input.citation), input.kind ?? 'chinh_su', input.unit_id ?? null, input.file_name ?? null, content, actor.id]))[0];
      await this.log(q, 'ai_source', row.id as number, 1, 'upload', this.sourceSnapshot(row), actor);
      return this.sourceSnapshot(row);
    });
  }

  /** Sửa thông tin mô tả; tư liệu đã duyệt mà đổi nguồn/chủ đề thì phải được duyệt lại */
  async updateSource(actor: UserRow, id: number, patch: SourceInput) {
    return this.db.tx(async (q) => {
      const cur = (await q<Record<string, unknown> & { status: string; version: number }>('SELECT * FROM app_ai_sources WHERE id = $1 FOR UPDATE', [id]))[0];
      if (!cur) throw new NotFoundException('Không tìm thấy tư liệu');
      if (patch.unit_id && !this.content.isLearningUnit(patch.unit_id)) throw bad('Cụm tri thức không tồn tại');
      const next = { title: patch.title !== undefined ? clean(patch.title) : cur.title, citation: patch.citation !== undefined ? clean(patch.citation) : cur.citation, kind: patch.kind ?? cur.kind, unit_id: patch.unit_id !== undefined ? patch.unit_id : cur.unit_id };
      if (same(next, { title: cur.title, citation: cur.citation, kind: cur.kind, unit_id: cur.unit_id })) return this.sourceSnapshot(cur);
      const status = cur.status === 'approved' ? 'pending' : cur.status;
      const row = (await q('UPDATE app_ai_sources SET title = $2, citation = $3, kind = $4, unit_id = $5, status = $6, version = version + 1, updated_at = now() WHERE id = $1 RETURNING *', [id, next.title, next.citation, next.kind, next.unit_id, status]))[0];
      await this.log(q, 'ai_source', id, row.version as number, 'update', this.sourceSnapshot(row), actor);
      return this.sourceSnapshot(row);
    });
  }

  async reviewSource(actor: UserRow, id: number, decision: 'approve' | 'reject' | 'archive' | 'reopen', note?: string | null) {
    const target = { approve: 'approved', reject: 'rejected', archive: 'archived', reopen: 'pending' }[decision];
    const allowed: Record<string, string[]> = { approved: ['pending'], rejected: ['pending'], archived: ['approved', 'rejected', 'pending'], pending: ['rejected', 'archived'] };
    if (decision === 'reject' && clean(note).length < 3) throw bad('Cần ghi lý do từ chối');
    return this.db.tx(async (q) => {
      const cur = (await q<Record<string, unknown> & { status: string; version: number }>('SELECT * FROM app_ai_sources WHERE id = $1 FOR UPDATE', [id]))[0];
      if (!cur) throw new NotFoundException('Không tìm thấy tư liệu');
      if (!allowed[target].includes(cur.status)) throw new ConflictException(`Tư liệu đang ở trạng thái "${cur.status}", không thể chuyển sang "${target}"`);
      const row = (await q('UPDATE app_ai_sources SET status = $2, review_note = $3, reviewed_by = $4, reviewed_at = now(), version = version + 1, updated_at = now() WHERE id = $1 RETURNING *', [id, target, clean(note) || null, actor.id]))[0];
      await this.log(q, 'ai_source', id, row.version as number, decision, { ...this.sourceSnapshot(row), note: clean(note) || null }, actor);
      return this.sourceSnapshot(row);
    });
  }

  /** Tìm trong tư liệu ĐÃ DUYỆT (chờ duyệt, từ chối, lưu trữ không bao giờ xuất hiện) và trả trích đoạn kèm nguồn */
  async searchSources(query: string, limit = 5) {
    const tokens = [...new Set(fold(query).split(/[^a-z0-9]+/).filter((t) => t.length >= 2))].slice(0, 12);
    if (!tokens.length) return [];
    const rows = await this.db.query<{ id: number; title: string; citation: string; kind: string; unit_id: string | null; content: string }>("SELECT id, title, citation, kind, unit_id, content FROM app_ai_sources WHERE status = 'approved'");
    const hits = rows.map((r) => {
      const body = fold(r.content), head = fold(r.title);
      let score = 0, first = -1;
      for (const t of tokens) {
        const title = head.split(t).length - 1, count = body.split(t).length - 1, at = body.indexOf(t);
        score += title * 3 + Math.min(count, 20);
        if (at >= 0 && (first < 0 || at < first)) first = at;
      }
      const start = Math.max(0, first - 120);
      return { id: r.id, title: r.title, citation: r.citation, kind: r.kind, unit_id: r.unit_id, score, excerpt: first < 0 ? r.content.slice(0, 280) : `${start ? '…' : ''}${r.content.slice(start, start + 320).trim()}…` };
    });
    return hits.filter((h) => h.score > 0).sort((a, b) => b.score - a.score || a.id - b.id).slice(0, Math.min(limit, 10));
  }

  // ------------------------------------------------------------------ 004 danh mục thẻ danh tướng
  async cards(f: { q?: string; status?: string; kind?: string; rarity?: string }) {
    const params = [f.status ?? null, f.kind ?? null, f.rarity ?? null, f.q ? like(f.q) : null];
    const items = await this.db.query(`SELECT code, name, title, role, rarity, kind, summary, source, unlock_condition, status, sort_order, version, updated_at FROM app_hero_cards
      WHERE ($1::text IS NULL OR status = $1) AND ($2::text IS NULL OR kind = $2) AND ($3::text IS NULL OR rarity = $3) AND ($4::text IS NULL OR (name || ' ' || coalesce(title, '')) ILIKE $4) ORDER BY sort_order, code`, params);
    const counts = await this.db.query<{ status: string; kind: string; n: number }>('SELECT status, kind, count(*)::int AS n FROM app_hero_cards GROUP BY status, kind');
    return { items, counts: { all: counts.reduce((n, c) => n + c.n, 0), chinh_su: counts.filter((c) => c.kind === 'chinh_su').reduce((n, c) => n + c.n, 0), giai_thoai: counts.filter((c) => c.kind === 'giai_thoai').reduce((n, c) => n + c.n, 0), published: counts.filter((c) => c.status === 'published').reduce((n, c) => n + c.n, 0) } };
  }

  async createCard(actor: UserRow, input: CardInput & { code: string; name: string; rarity: NonNullable<CardInput['rarity']>; kind: NonNullable<CardInput['kind']>; source: string; unlock_condition: string }) {
    return this.db.tx(async (q) => {
      if ((await q('SELECT 1 FROM app_hero_cards WHERE code = $1', [input.code])).length) throw new ConflictException('Mã thẻ đã tồn tại');
      const row = (await q("INSERT INTO app_hero_cards (code, name, title, role, rarity, kind, summary, source, unlock_condition, sort_order, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING code, name, title, role, rarity, kind, summary, source, unlock_condition, status, sort_order, version, updated_at",
        [input.code, clean(input.name), clean(input.title) || null, clean(input.role) || null, input.rarity, input.kind, (input.summary ?? '').trim(), clean(input.source), clean(input.unlock_condition), input.sort_order ?? (Number((await q<{ m: number }>('SELECT coalesce(max(sort_order), 0)::int AS m FROM app_hero_cards'))[0].m) + 1), actor.id]))[0];
      await this.log(q, 'hero_card', input.code, 1, 'create', row, actor);
      return row;
    });
  }

  async updateCard(actor: UserRow, code: string, patch: CardInput & { status?: PublishState }) {
    return this.db.tx(async (q) => {
      const cur = (await q<Record<string, unknown> & { version: number }>('SELECT code, name, title, role, rarity, kind, summary, source, unlock_condition, status, sort_order, version FROM app_hero_cards WHERE code = $1 FOR UPDATE', [code]))[0];
      if (!cur) throw new NotFoundException('Không tìm thấy thẻ');
      const text = (v: string | null | undefined, old: unknown) => (v === undefined ? old : clean(v) || null);
      const next = { ...cur, name: patch.name !== undefined ? clean(patch.name) : cur.name, title: text(patch.title, cur.title), role: text(patch.role, cur.role), rarity: patch.rarity ?? cur.rarity, kind: patch.kind ?? cur.kind,
        summary: patch.summary !== undefined ? patch.summary.trim() : cur.summary, source: patch.source !== undefined ? clean(patch.source) : cur.source, unlock_condition: patch.unlock_condition !== undefined ? clean(patch.unlock_condition) : cur.unlock_condition,
        status: patch.status ?? cur.status, sort_order: patch.sort_order ?? cur.sort_order };
      if (same(next, cur)) return cur;
      const row = (await q('UPDATE app_hero_cards SET name = $2, title = $3, role = $4, rarity = $5, kind = $6, summary = $7, source = $8, unlock_condition = $9, status = $10, sort_order = $11, version = version + 1, updated_by = $12, updated_at = now() WHERE code = $1 RETURNING code, name, title, role, rarity, kind, summary, source, unlock_condition, status, sort_order, version, updated_at',
        [code, next.name, next.title, next.role, next.rarity, next.kind, next.summary, next.source, next.unlock_condition, next.status, next.sort_order, actor.id]))[0];
      await this.log(q, 'hero_card', code, row.version as number, next.status !== cur.status ? (next.status === 'published' ? 'publish' : next.status === 'archived' ? 'archive' : 'unpublish') : 'update', row, actor);
      return row;
    });
  }

  // ------------------------------------------------------------------ 005 luật EXP, cấp bậc, huy hiệu
  async rules() {
    const versions = await this.db.query<{ version: number; config: ExpRules; is_active: boolean; note: string | null; created_at: string; created_by_name: string | null }>(
      'SELECT r.version, r.config, r.is_active, r.note, r.created_at, u.full_name AS created_by_name FROM app_exp_rules r LEFT JOIN app_users u ON u.id = r.created_by ORDER BY r.version DESC LIMIT 30');
    const active = versions.find((v) => v.is_active);
    return { active: active ? { version: active.version, config: active.config, since: active.created_at } : { version: 0, config: DEFAULT_RULES, since: null }, versions: versions.map(({ config, ...v }) => v), metrics: BADGE_METRICS };
  }

  async ruleVersion(version: number) {
    const row = (await this.db.query<{ version: number; config: ExpRules; is_active: boolean; note: string | null; created_at: string }>('SELECT version, config, is_active, note, created_at FROM app_exp_rules WHERE version = $1', [version]))[0];
    if (!row) throw new NotFoundException('Không tìm thấy phiên bản luật');
    return row;
  }

  /** Lưu thành phiên bản mới và áp dụng ngay cho các câu trả lời sau đó; điểm, cấp và huy hiệu đã ghi nhận không bị tính lại */
  async saveRules(actor: UserRow, input: unknown, note?: string | null) {
    const config = parseRules(input);
    const saved = await this.db.tx(async (q) => {
      await q('LOCK TABLE app_exp_rules IN SHARE ROW EXCLUSIVE MODE');
      const active = (await q<{ version: number; config: ExpRules }>('SELECT version, config FROM app_exp_rules WHERE is_active'))[0];
      if (active && same(active.config, config)) throw new ConflictException('Luật không có thay đổi so với phiên bản đang dùng');
      const version = Number((await q<{ v: number }>('SELECT coalesce(max(version), 0) + 1 AS v FROM app_exp_rules'))[0].v);
      await q('UPDATE app_exp_rules SET is_active = false WHERE is_active');
      await q('INSERT INTO app_exp_rules (version, config, is_active, note, created_by) VALUES ($1, $2::jsonb, true, $3, $4)', [version, JSON.stringify(config), clean(note) || null, actor.id]);
      await this.log(q, 'exp_rules', version, version, 'save', { ...config, note: clean(note) || null }, actor);
      return version;
    });
    setActiveRules(config);
    return { version: saved, config };
  }
}
