/**
 * Hành trình học – bản đồ nhiệm vụ (HK.GV.018–021, HK.QT.042, HK.AD.043): thư viện hành trình mẫu của hệ thống / trường / giáo viên,
 * tạo trống hoặc từ mẫu, thêm – sửa – xóa nút (bài học, bộ câu hỏi, trận đánh, tư liệu, trận Quyết chiến), tư liệu mở khóa theo nút, giao cho lớp.
 * Nút mở theo thứ tự (hoàn thành nút trước mới mở nút sau); nhánh rẽ, điều kiện tùy chỉnh và xếp lịch thuộc Sprint 7.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { likeEscape } from '../admin/school.service';
import { DatabaseService, Q, searchText, UserRow } from '../database/database.service';
import { notFound, Scope } from './access';
import { QuizService } from './quiz.service';

export const NODE_KINDS = ['lesson', 'quiz', 'battle', 'source', 'final'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];
export const NODE_KIND_LABEL: Record<NodeKind, string> = { lesson: 'Bài học', quiz: 'Câu hỏi', battle: 'Trận đánh', source: 'Tư liệu', final: 'Quyết chiến' };
export const NODE_ICONS = ['book', 'quiz', 'sword', 'scroll', 'flag', 'star', 'castle', 'ship', 'horse', 'map', 'crown'] as const;
const DEFAULT_ICON: Record<NodeKind, string> = { lesson: 'book', quiz: 'quiz', battle: 'sword', source: 'scroll', final: 'crown' };
export const FINAL_PASS = 70;

export interface JourneyInput { title: string; description?: string | null; campaign_id: number; background_url?: string | null; template_id?: number | null; class_ids?: number[] }
export interface NodeInput {
  kind?: NodeKind; title?: string; icon?: string | null; objective?: string | null; lesson_id?: number | null; quiz_id?: number | null; source_id?: number | null;
  battle_id?: number | null; pass_percent?: number | null; reward_points?: number; unlock_source_ids?: number[]; position?: number;
}
export interface JourneyFilter { q?: string; store?: string; campaign_id?: number }

interface JourneyRow {
  id: number; scope: Scope; school_id: number | null; owner_id: number | null; title: string; description: string | null; campaign_id: number; background_url: string | null;
  is_default: boolean; status: 'draft' | 'published'; copied_from: number | null; created_at: string; updated_at: string;
}
interface NodeRow {
  id: number; journey_id: number; position: number; kind: NodeKind; title: string; icon: string | null; objective: string | null;
  lesson_id: number | null; quiz_id: number | null; source_id: number | null; battle_id: number | null; pass_percent: number | null; reward_points: number;
}

const COLUMNS = 'id, scope, school_id, owner_id, title, description, campaign_id, background_url, is_default, status, copied_from, created_at, updated_at';
const NODE_COLUMNS = 'id, journey_id, position, kind, title, icon, objective, lesson_id, quiz_id, source_id, battle_id, pass_percent, reward_points';

const sees = (user: UserRow, j: JourneyRow): boolean => {
  if (user.role === 'root_admin') return j.scope !== 'teacher';
  if (user.role === 'school_admin') return (j.scope === 'school' && j.school_id === user.school_id) || (j.scope === 'system' && j.status === 'published');
  if (j.scope === 'teacher') return j.owner_id === user.id;
  return j.status === 'published' && (j.scope === 'system' || j.school_id === user.school_id);
};
const edits = (user: UserRow, j: JourneyRow): boolean => {
  if (user.role === 'root_admin') return j.scope === 'system';
  if (user.role === 'school_admin') return j.scope === 'school' && j.school_id === user.school_id;
  return user.role === 'teacher' && j.scope === 'teacher' && j.owner_id === user.id;
};
/** Kho của hành trình mới: giáo viên → riêng; quản trị trường → kho trường; quản trị tổng → kho hệ thống */
const target = (user: UserRow): { scope: Scope; school_id: number | null; owner_id: number } => {
  if (user.role === 'root_admin') return { scope: 'system', school_id: null, owner_id: user.id };
  if (!user.school_id) throw new ForbiddenException('Tài khoản chưa được gán trường');
  return { scope: user.role === 'school_admin' ? 'school' : 'teacher', school_id: user.school_id, owner_id: user.id };
};

@Injectable()
export class JourneyService {
  constructor(private readonly db: DatabaseService, private readonly quizzes: QuizService) {}

  // ------------------------------------------------------------------ đọc
  async library(user: UserRow, f: JourneyFilter) {
    const params: unknown[] = [];
    const parts: string[] = [];
    if (user.role === 'root_admin') parts.push("t.scope IN ('system', 'school')");
    else if (user.role === 'school_admin') { params.push(user.school_id); parts.push(`((t.scope = 'school' AND t.school_id = $${params.length}) OR (t.scope = 'system' AND t.status = 'published'))`); }
    else { params.push(user.id, user.school_id); parts.push(`((t.scope = 'teacher' AND t.owner_id = $${params.length - 1}) OR (t.status = 'published' AND (t.scope = 'system' OR (t.scope = 'school' AND t.school_id = $${params.length}))))`); }
    if (f.store === 'mine') {
      if (user.role === 'root_admin') parts.push("t.scope = 'system'");
      else if (user.role === 'school_admin') parts.push("t.scope = 'school'");
      else parts.push("t.scope = 'teacher'");
    } else if (f.store === 'school' || f.store === 'system') parts.push(`t.scope = '${f.store}'`);
    const term = searchText(f.q ?? '');
    if (term) { params.push(`%${likeEscape(term)}%`); parts.push(`t.search_text LIKE $${params.length}`); }
    if (f.campaign_id) { params.push(f.campaign_id); parts.push(`t.campaign_id = $${params.length}`); }
    const rows = await this.db.query<JourneyRow & { campaign_title: string; owner_name: string | null; node_count: number; classes: number; learners: number }>(
      `SELECT t.id, t.scope, t.school_id, t.owner_id, t.title, t.description, t.campaign_id, c.title AS campaign_title, t.is_default, t.status, t.updated_at, u.full_name AS owner_name,
              (SELECT count(*)::int FROM hk_nodes n WHERE n.journey_id = t.id) AS node_count,
              (SELECT count(*)::int FROM hk_class_journeys cj WHERE cj.journey_id = t.id) AS classes,
              (SELECT count(DISTINCT p.user_id)::int FROM hk_node_progress p JOIN hk_nodes n ON n.id = p.node_id WHERE n.journey_id = t.id) AS learners
       FROM hk_journeys t JOIN hist_campaigns c ON c.id = t.campaign_id LEFT JOIN app_users u ON u.id = t.owner_id
       WHERE ${parts.join(' AND ')} ORDER BY c.sort_order, c.id, t.scope = 'system' DESC, t.updated_at DESC, t.id LIMIT 300`, params);
    return rows.map((r) => ({ ...r, can_edit: edits(user, r) }));
  }

  async load(q: Q, user: UserRow, id: number, lock = false): Promise<JourneyRow> {
    const row = (await q<JourneyRow>(`SELECT ${COLUMNS} FROM hk_journeys WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]))[0];
    if (!row || !sees(user, row)) throw notFound('hành trình');
    return row;
  }

  async get(user: UserRow, id: number) {
    return this.db.tx(async (q) => {
      const row = await this.load(q, user, id);
      const nodes = await this.nodeViews(q, id);
      const owner = row.owner_id ? (await q<{ full_name: string }>('SELECT full_name FROM app_users WHERE id = $1', [row.owner_id]))[0]?.full_name ?? null : null;
      const campaign = (await q<{ title: string }>('SELECT title FROM hist_campaigns WHERE id = $1', [row.campaign_id]))[0]?.title ?? '';
      const classes = await q(
        `SELECT c.id, c.name, c.grade, c.school_year, cj.assigned_at, (SELECT count(*)::int FROM app_class_members m WHERE m.class_id = c.id) AS students
         FROM hk_class_journeys cj JOIN app_classes c ON c.id = cj.class_id WHERE cj.journey_id = $1 ORDER BY c.name`, [id]);
      const shares = await q<{ target: string; status: string; review_note: string | null }>("SELECT target, status, review_note FROM hk_shares WHERE entity = 'journey' AND entity_id = $1", [id]);
      return { ...row, campaign_title: campaign, owner_name: owner, can_edit: edits(user, row), nodes, classes, shares, problems: await this.problems(q, id, row) };
    });
  }

  private async nodeViews(q: Q, id: number) {
    const rows = await q(
      `SELECT n.id, n.position, n.kind, n.title, n.icon, n.objective, n.lesson_id, n.quiz_id, n.source_id, n.battle_id, n.pass_percent, n.reward_points,
              l.title AS lesson_title, l.status AS lesson_status, l.read_minutes, z.title AS quiz_title,
              (SELECT count(*)::int FROM hk_quiz_questions qq WHERE qq.quiz_id = z.id) AS quiz_questions,
              s.title AS source_title, s.status AS source_status, b.name AS battle_name, b.status AS battle_status,
              (SELECT count(*)::int FROM hk_node_progress p WHERE p.node_id = n.id AND p.completed_at IS NOT NULL) AS completed,
              COALESCE((SELECT json_agg(json_build_object('id', hs.id, 'title', hs.title) ORDER BY hs.title) FROM hk_node_unlocks u JOIN hist_sources hs ON hs.id = u.source_id WHERE u.node_id = n.id), '[]'::json) AS unlocks
       FROM hk_nodes n LEFT JOIN hk_lessons l ON l.id = n.lesson_id LEFT JOIN hk_quizzes z ON z.id = n.quiz_id LEFT JOIN hist_sources s ON s.id = n.source_id LEFT JOIN hist_battles b ON b.id = n.battle_id
       WHERE n.journey_id = $1 ORDER BY n.position`, [id]);
    return (rows as Array<Record<string, unknown> & { kind: NodeKind }>).map((r) => ({ ...r, kind_label: NODE_KIND_LABEL[r.kind] }));
  }

  /** Điều còn thiếu để phát hành: nội dung phải đã công bố, bộ câu hỏi không rỗng, hành trình mặc định có trận Quyết chiến ở cuối */
  async problems(q: Q, id: number, row?: JourneyRow): Promise<string[]> {
    const j = row ?? (await q<JourneyRow>(`SELECT ${COLUMNS} FROM hk_journeys WHERE id = $1`, [id]))[0];
    const out: string[] = [];
    const nodes = await this.nodeViews(q, id);
    if (!nodes.length) out.push('Hành trình chưa có nút nào');
    for (const n of nodes as Array<Record<string, any>>) {
      if (n.kind === 'lesson' && n.lesson_status !== 'published') out.push(`Nút "${n.title}": bài học chưa công bố`);
      if (n.kind === 'source' && n.source_status !== 'published') out.push(`Nút "${n.title}": tư liệu chưa công bố`);
      if (n.kind === 'battle' && n.battle_status !== 'published') out.push(`Nút "${n.title}": trận đánh chưa công bố trong kho lịch sử`);
      if (n.quiz_id && !n.quiz_questions) out.push(`Nút "${n.title}": bộ câu hỏi chưa có câu nào`);
      for (const u of (n.unlocks ?? []) as Array<{ id: number; title: string }>) {
        if (!(await q("SELECT 1 FROM hist_sources WHERE id = $1 AND status = 'published'", [u.id])).length) out.push(`Nút "${n.title}": tư liệu mở khóa "${u.title}" chưa công bố`);
      }
    }
    if (j && !(await q("SELECT 1 FROM hist_campaigns WHERE id = $1 AND status = 'published'", [j.campaign_id])).length) out.push('Cuộc kháng chiến của hành trình chưa công bố trong kho lịch sử');
    if (j?.is_default && nodes.length && nodes[nodes.length - 1].kind !== 'final') out.push('Hành trình mặc định phải kết thúc bằng trận Quyết chiến');
    return out;
  }

  // ------------------------------------------------------------------ hành trình
  private async fields(q: Q, input: Partial<JourneyInput>, existing?: JourneyRow) {
    const title = String(input.title ?? existing?.title ?? '').trim().replace(/\s+/g, ' ');
    if (title.length < 2 || title.length > 160) throw new BadRequestException('Tên hành trình cần từ 2 đến 160 ký tự');
    const description = input.description === undefined ? (existing?.description ?? null) : String(input.description ?? '').trim() || null;
    if (description && description.length > 1000) throw new BadRequestException('Mô tả tối đa 1000 ký tự');
    const campaign = Number(input.campaign_id ?? existing?.campaign_id);
    if (!Number.isInteger(campaign) || !(await q('SELECT 1 FROM hist_campaigns WHERE id = $1', [campaign])).length) throw new BadRequestException('Hãy chọn cuộc kháng chiến');
    const background = input.background_url === undefined ? (existing?.background_url ?? null) : input.background_url ? String(input.background_url).trim() : null;
    if (background && (!/^https:\/\/[^\s]+$/.test(background) || background.length > 500)) throw new BadRequestException('Ảnh nền phải là liên kết https');
    return { title, description, campaign_id: campaign, background_url: background, search_text: searchText(title, description) };
  }

  async create(user: UserRow, input: JourneyInput) {
    const own = target(user);
    const id = await this.db.tx(async (q) => {
      const f = await this.fields(q, input);
      let template: JourneyRow | undefined;
      if (input.template_id) {
        template = await this.load(q, user, input.template_id);
        if (template.campaign_id !== f.campaign_id) throw new BadRequestException('Hành trình mẫu thuộc cuộc kháng chiến khác');
      }
      const newId = (await q<{ id: number }>(
        `INSERT INTO hk_journeys (scope, school_id, owner_id, title, description, campaign_id, background_url, copied_from, search_text) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [own.scope, own.school_id, own.owner_id, f.title, f.description, f.campaign_id, f.background_url ?? template?.background_url ?? null, template?.id ?? null, f.search_text]))[0].id;
      if (template) await this.copyNodes(q, template.id, newId);
      return newId;
    });
    if (input.class_ids?.length) await this.assign(user, id, input.class_ids);
    return this.get(user, id);
  }

  async update(user: UserRow, id: number, input: Partial<JourneyInput>) {
    await this.db.tx(async (q) => {
      const row = await this.load(q, user, id, true);
      this.mustEdit(user, row);
      const f = await this.fields(q, input, row);
      if (f.campaign_id !== row.campaign_id) {
        if (Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_nodes WHERE journey_id = $1', [id]))[0].n)) throw new ConflictException('Không đổi cuộc kháng chiến khi hành trình đã có nút');
        if (row.is_default) throw new ConflictException('Không đổi cuộc kháng chiến của hành trình mặc định');
      }
      await q('UPDATE hk_journeys SET title = $2, description = $3, campaign_id = $4, background_url = $5, search_text = $6, updated_at = now() WHERE id = $1',
        [id, f.title, f.description, f.campaign_id, f.background_url, f.search_text]);
    });
    return this.get(user, id);
  }

  private mustEdit(user: UserRow, row: JourneyRow): void {
    if (!edits(user, row)) throw new ForbiddenException('Chỉ sửa được hành trình do bạn soạn (hoặc của trường/hệ thống nếu bạn là quản trị); hãy nhân bản hành trình mẫu để chỉnh sửa');
  }

  async remove(user: UserRow, id: number): Promise<void> {
    await this.db.tx(async (q) => {
      const row = await this.load(q, user, id, true);
      this.mustEdit(user, row);
      if (row.is_default) throw new ConflictException('Đây là hành trình mặc định của cuộc kháng chiến; hãy chọn hành trình khác làm mặc định trước');
      const learners = Number((await q<{ n: string }>('SELECT count(DISTINCT p.user_id) AS n FROM hk_node_progress p JOIN hk_nodes n ON n.id = p.node_id WHERE n.journey_id = $1', [id]))[0].n);
      if (learners) throw new ConflictException(`Đã có ${learners} học sinh học hành trình này nên được giữ lại`);
      const classes = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_class_journeys WHERE journey_id = $1', [id]))[0].n);
      if (classes) throw new ConflictException('Hành trình đang được giao cho lớp; hãy hủy giao trước khi xóa');
      await q("DELETE FROM hk_shares WHERE entity = 'journey' AND entity_id = $1", [id]);
      await q('DELETE FROM hk_journeys WHERE id = $1', [id]);
    });
  }

  private async copyNodes(q: Q, from: number, to: number): Promise<void> {
    const nodes = await q<NodeRow>(`SELECT ${NODE_COLUMNS} FROM hk_nodes WHERE journey_id = $1 ORDER BY position`, [from]);
    for (const n of nodes) {
      const id = (await q<{ id: number }>(
        `INSERT INTO hk_nodes (journey_id, position, kind, title, icon, objective, lesson_id, quiz_id, source_id, battle_id, pass_percent, reward_points)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [to, n.position, n.kind, n.title, n.icon, n.objective, n.lesson_id, n.quiz_id, n.source_id, n.battle_id, n.pass_percent, n.reward_points]))[0].id;
      await q('INSERT INTO hk_node_unlocks (node_id, source_id) SELECT $2, source_id FROM hk_node_unlocks WHERE node_id = $1', [n.id, id]);
    }
  }

  async duplicate(user: UserRow, id: number) {
    const own = target(user);
    const copy = await this.db.tx(async (q) => {
      const row = await this.load(q, user, id);
      const newId = (await q<{ id: number }>(
        `INSERT INTO hk_journeys (scope, school_id, owner_id, title, description, campaign_id, background_url, copied_from, search_text)
         SELECT $2, $3, $4, left(title || ' (bản sao)', 160), description, campaign_id, background_url, id, search_text FROM hk_journeys WHERE id = $1 RETURNING id`,
        [row.id, own.scope, own.school_id, own.owner_id]))[0].id;
      await this.copyNodes(q, id, newId);
      return newId;
    });
    return this.get(user, copy);
  }

  /** Sao sâu sang kho khác khi duyệt chia sẻ; bộ đề riêng của giáo viên được sao theo để hành trình dùng độc lập */
  async cloneInto(q: Q, id: number, to: { scope: Scope; school_id: number | null; owner_id: number | null }, by: number | null): Promise<number> {
    const src = (await q<JourneyRow>(`SELECT ${COLUMNS} FROM hk_journeys WHERE id = $1`, [id]))[0];
    if (!src) throw notFound('hành trình');
    const newId = (await q<{ id: number }>(
      `INSERT INTO hk_journeys (scope, school_id, owner_id, title, description, campaign_id, background_url, status, copied_from, search_text)
       SELECT $2, $3, $4, title, description, campaign_id, background_url, 'published', id, search_text FROM hk_journeys WHERE id = $1 RETURNING id`,
      [id, to.scope, to.school_id, to.owner_id]))[0].id;
    await this.copyNodes(q, id, newId);
    const copied = new Map<number, number>();
    const quizCopies = new Map<number, number>();
    for (const n of await q<{ id: number; quiz_id: number | null; scope: Scope; school_id: number | null }>(
      'SELECT n.id, n.quiz_id, z.scope, z.school_id FROM hk_nodes n JOIN hk_quizzes z ON z.id = n.quiz_id WHERE n.journey_id = $1', [newId])) {
      const reusable = n.scope === 'system' || (n.scope === to.scope && n.school_id === to.school_id);
      if (reusable || !n.quiz_id) continue;
      if (!quizCopies.has(n.quiz_id)) quizCopies.set(n.quiz_id, await this.quizzes.cloneInto(q, n.quiz_id, to, by, copied));
      await q('UPDATE hk_nodes SET quiz_id = $2 WHERE id = $1', [n.id, quizCopies.get(n.quiz_id)]);
    }
    return newId;
  }

  async setStatus(user: UserRow, id: number, status: 'draft' | 'published') {
    await this.db.tx(async (q) => {
      const row = await this.load(q, user, id, true);
      this.mustEdit(user, row);
      if (status === 'published') {
        const problems = await this.problems(q, id, row);
        if (problems.length) throw new UnprocessableEntityException(`Chưa phát hành được: ${problems.join('; ')}`);
      } else {
        if (row.is_default) throw new ConflictException('Hành trình mặc định không gỡ phát hành được; hãy chọn hành trình khác làm mặc định trước');
        const classes = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_class_journeys WHERE journey_id = $1', [id]))[0].n);
        if (classes) throw new ConflictException('Hành trình đang được giao cho lớp; hãy hủy giao trước');
      }
      await q('UPDATE hk_journeys SET status = $2, updated_at = now() WHERE id = $1', [id, status]);
    });
    return this.get(user, id);
  }

  /** Quản trị tổng chọn hành trình hệ thống đã phát hành làm mặc định cho cuộc kháng chiến (mỗi cuộc có tối đa một) */
  async setDefault(user: UserRow, id: number, makeDefault: boolean) {
    await this.db.tx(async (q) => {
      const row = await this.load(q, user, id, true);
      if (user.role !== 'root_admin' || row.scope !== 'system') throw new ForbiddenException('Chỉ quản trị tổng đặt hành trình mặc định từ kho hệ thống');
      if (makeDefault) {
        if (row.status !== 'published') throw new ConflictException('Hãy phát hành hành trình trước khi đặt làm mặc định');
        const problems = await this.problems(q, id, { ...row, is_default: true });
        if (problems.length) throw new UnprocessableEntityException(`Chưa đặt mặc định được: ${problems.join('; ')}`);
        await q('UPDATE hk_journeys SET is_default = false WHERE campaign_id = $1 AND is_default AND id <> $2', [row.campaign_id, id]);
      }
      await q('UPDATE hk_journeys SET is_default = $2, updated_at = now() WHERE id = $1', [id, makeDefault]);
    });
    return this.get(user, id);
  }

  // ------------------------------------------------------------------ nút
  /** Kiểm tra nội dung của nút theo loại và theo kho của hành trình; trả về các cột đầy đủ */
  private async resolveNode(q: Q, user: UserRow, journey: JourneyRow, input: NodeInput, existing?: NodeRow) {
    const kind = (existing?.kind ?? input.kind) as NodeKind;
    if (!NODE_KINDS.includes(kind)) throw new BadRequestException('Loại nút phải là bài học, câu hỏi, trận đánh, tư liệu hoặc Quyết chiến');
    const pick = <K extends keyof NodeRow>(key: K): NodeRow[K] | null => ((input[key as keyof NodeInput] === undefined ? (existing?.[key] ?? null) : input[key as keyof NodeInput]) as NodeRow[K] | null);
    const want = (key: 'lesson_id' | 'quiz_id' | 'source_id' | 'battle_id', allowed: boolean, required: boolean): number | null => {
      const v = allowed ? pick(key) : null;
      if (required && !v) throw new BadRequestException('Hãy chọn nội dung cho nút');
      return v;
    };
    const lesson = want('lesson_id', kind === 'lesson', kind === 'lesson');
    const quiz = want('quiz_id', ['quiz', 'final', 'battle'].includes(kind), kind === 'quiz' || kind === 'final');
    const source = want('source_id', kind === 'source', kind === 'source');
    const battle = want('battle_id', kind === 'battle', kind === 'battle');
    let defaultTitle = NODE_KIND_LABEL[kind];
    if (lesson) {
      const l = (await q<{ title: string; status: string }>('SELECT title, status FROM hk_lessons WHERE id = $1', [lesson]))[0];
      if (!l || (journey.scope !== 'system' && l.status !== 'published')) throw new BadRequestException('Bài học không tồn tại hoặc chưa công bố');
      defaultTitle = l.title;
    }
    if (source) {
      const s = (await q<{ title: string }>('SELECT title FROM hist_sources WHERE id = $1', [source]))[0];
      if (!s) throw new BadRequestException('Tư liệu không tồn tại');
      defaultTitle = s.title;
    }
    if (battle) {
      const b = (await q<{ name: string }>('SELECT name FROM hist_battles WHERE id = $1', [battle]))[0];
      if (!b) throw new BadRequestException('Trận đánh không tồn tại');
      defaultTitle = b.name;
    }
    if (quiz) {
      const z = (await q<{ title: string; scope: Scope; school_id: number | null; owner_id: number | null }>('SELECT title, scope, school_id, owner_id FROM hk_quizzes WHERE id = $1', [quiz]))[0];
      const okScope = !z ? false : journey.scope === 'system' ? z.scope === 'system'
        : journey.scope === 'school' ? z.scope === 'system' || (z.scope === 'school' && z.school_id === journey.school_id)
          : z.scope === 'system' || (z.scope === 'school' && z.school_id === journey.school_id) || (z.scope === 'teacher' && z.owner_id === user.id);
      if (!z || !okScope) throw new BadRequestException('Bộ câu hỏi không tồn tại hoặc chưa thuộc kho phù hợp với hành trình này');
      if (kind === 'quiz') defaultTitle = z.title;
    }
    const title = String(input.title ?? existing?.title ?? defaultTitle).trim().replace(/\s+/g, ' ');
    if (title.length < 2 || title.length > 120) throw new BadRequestException('Tên nút cần từ 2 đến 120 ký tự');
    const icon = input.icon === undefined ? (existing?.icon ?? DEFAULT_ICON[kind]) : input.icon || DEFAULT_ICON[kind];
    if (!(NODE_ICONS as readonly string[]).includes(icon)) throw new BadRequestException(`Biểu tượng phải thuộc: ${NODE_ICONS.join(', ')}`);
    const objective = input.objective === undefined ? (existing?.objective ?? null) : String(input.objective ?? '').trim() || null;
    if (objective && objective.length > 400) throw new BadRequestException('Mục tiêu tối đa 400 ký tự');
    let pass = input.pass_percent === undefined ? (existing?.pass_percent ?? null) : input.pass_percent;
    if (kind === 'final' && !pass) pass = FINAL_PASS;
    if (pass !== null && (!Number.isInteger(pass) || pass < 1 || pass > 100)) throw new BadRequestException('Điểm đạt từ 1% đến 100%');
    const reward = input.reward_points ?? existing?.reward_points ?? (kind === 'final' ? 200 : 50);
    if (!Number.isInteger(reward) || reward < 0 || reward > 1000) throw new BadRequestException('Điểm thưởng từ 0 đến 1000');
    return { kind, title, icon, objective, lesson_id: lesson, quiz_id: quiz, source_id: source, battle_id: battle, pass_percent: pass, reward_points: reward };
  }

  private async writeUnlocks(q: Q, nodeId: number, ids: number[] | undefined): Promise<void> {
    if (ids === undefined) return;
    if (ids.length > 10 || new Set(ids).size !== ids.length) throw new BadRequestException('Mỗi nút mở khóa tối đa 10 tư liệu, không trùng nhau');
    for (const sid of ids) if (!(await q('SELECT 1 FROM hist_sources WHERE id = $1', [sid])).length) throw new BadRequestException(`Tư liệu #${sid} không tồn tại`);
    await q('DELETE FROM hk_node_unlocks WHERE node_id = $1', [nodeId]);
    for (const sid of ids) await q('INSERT INTO hk_node_unlocks (node_id, source_id) VALUES ($1, $2)', [nodeId, sid]);
  }

  async addNode(user: UserRow, journeyId: number, input: NodeInput) {
    await this.db.tx(async (q) => {
      const journey = await this.load(q, user, journeyId, true);
      this.mustEdit(user, journey);
      const f = await this.resolveNode(q, user, journey, input);
      const nodes = await q<{ id: number; kind: NodeKind; position: number }>('SELECT id, kind, position FROM hk_nodes WHERE journey_id = $1 ORDER BY position', [journeyId]);
      if (nodes.length >= 40) throw new ConflictException('Mỗi hành trình tối đa 40 nút');
      const final = nodes.find((n) => n.kind === 'final');
      if (f.kind === 'final' && final) throw new ConflictException('Hành trình đã có trận Quyết chiến');
      // Trận Quyết chiến luôn ở cuối: nút thường chèn trước nó
      let position = f.kind === 'final' ? nodes.length + 1 : Math.min(input.position ?? nodes.length + 1, final ? final.position : nodes.length + 1);
      position = Math.max(1, position);
      await q('UPDATE hk_nodes SET position = position + 1 WHERE journey_id = $1 AND position >= $2', [journeyId, position]);
      const id = (await q<{ id: number }>(
        `INSERT INTO hk_nodes (journey_id, position, kind, title, icon, objective, lesson_id, quiz_id, source_id, battle_id, pass_percent, reward_points)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [journeyId, position, f.kind, f.title, f.icon, f.objective, f.lesson_id, f.quiz_id, f.source_id, f.battle_id, f.pass_percent, f.reward_points]))[0].id;
      await this.writeUnlocks(q, id, input.unlock_source_ids);
      await q('UPDATE hk_journeys SET updated_at = now() WHERE id = $1', [journeyId]);
    });
    return this.get(user, journeyId);
  }

  private async loadNode(q: Q, user: UserRow, nodeId: number): Promise<{ node: NodeRow; journey: JourneyRow }> {
    const node = (await q<NodeRow>(`SELECT ${NODE_COLUMNS} FROM hk_nodes WHERE id = $1 FOR UPDATE`, [nodeId]))[0];
    if (!node) throw notFound('nút');
    const journey = await this.load(q, user, node.journey_id, true);
    this.mustEdit(user, journey);
    return { node, journey };
  }

  private async completedBy(q: Q, nodeId: number): Promise<number> {
    return Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_node_progress WHERE node_id = $1 AND completed_at IS NOT NULL', [nodeId]))[0].n);
  }

  async updateNode(user: UserRow, nodeId: number, input: NodeInput) {
    const journeyId = await this.db.tx(async (q) => {
      const { node, journey } = await this.loadNode(q, user, nodeId);
      const f = await this.resolveNode(q, user, journey, input, node);
      const contentChanged = f.lesson_id !== node.lesson_id || f.quiz_id !== node.quiz_id || f.source_id !== node.source_id || f.battle_id !== node.battle_id || f.pass_percent !== node.pass_percent;
      if (contentChanged && (await this.completedBy(q, nodeId))) throw new ConflictException('Đã có học sinh hoàn thành nút này nên không đổi nội dung hoặc điểm đạt; chỉ sửa được tên, biểu tượng, mục tiêu và điểm thưởng');
      await q(
        `UPDATE hk_nodes SET title = $2, icon = $3, objective = $4, lesson_id = $5, quiz_id = $6, source_id = $7, battle_id = $8, pass_percent = $9, reward_points = $10, updated_at = now() WHERE id = $1`,
        [nodeId, f.title, f.icon, f.objective, f.lesson_id, f.quiz_id, f.source_id, f.battle_id, f.pass_percent, f.reward_points]);
      await this.writeUnlocks(q, nodeId, input.unlock_source_ids);
      await q('UPDATE hk_journeys SET updated_at = now() WHERE id = $1', [node.journey_id]);
      return node.journey_id;
    });
    return this.get(user, journeyId);
  }

  async removeNode(user: UserRow, nodeId: number) {
    const journeyId = await this.db.tx(async (q) => {
      const { node } = await this.loadNode(q, user, nodeId);
      if (await this.completedBy(q, nodeId)) throw new ConflictException('Đã có học sinh hoàn thành nút này nên không xóa được');
      await q('DELETE FROM hk_nodes WHERE id = $1', [nodeId]);
      await q('UPDATE hk_nodes SET position = position - 1 WHERE journey_id = $1 AND position > $2', [node.journey_id, node.position]);
      await q('UPDATE hk_journeys SET updated_at = now() WHERE id = $1', [node.journey_id]);
      return node.journey_id;
    });
    return this.get(user, journeyId);
  }

  async reorder(user: UserRow, journeyId: number, nodeIds: number[]) {
    await this.db.tx(async (q) => {
      const journey = await this.load(q, user, journeyId, true);
      this.mustEdit(user, journey);
      const nodes = await q<{ id: number; kind: NodeKind }>('SELECT id, kind FROM hk_nodes WHERE journey_id = $1', [journeyId]);
      if (nodeIds.length !== nodes.length || new Set(nodeIds).size !== nodes.length || !nodes.every((n) => nodeIds.includes(n.id))) throw new BadRequestException('Danh sách nút phải gồm đúng các nút của hành trình');
      const final = nodes.find((n) => n.kind === 'final');
      if (final && nodeIds[nodeIds.length - 1] !== final.id) throw new BadRequestException('Trận Quyết chiến phải ở cuối hành trình');
      let position = 1;
      for (const id of nodeIds) await q('UPDATE hk_nodes SET position = $2 WHERE id = $1', [id, position++]);
      await q('UPDATE hk_journeys SET updated_at = now() WHERE id = $1', [journeyId]);
    });
    return this.get(user, journeyId);
  }

  // ------------------------------------------------------------------ giao cho lớp (HK.GV.019)
  /** Lớp giáo viên đang phụ trách (còn hoạt động, năm học chưa kết thúc) kèm số hành trình đã giao */
  async myClasses(user: UserRow) {
    return this.db.query(
      `SELECT c.id, c.name, c.grade, c.school_year, (SELECT count(*)::int FROM app_class_members m WHERE m.class_id = c.id) AS students,
              COALESCE((SELECT json_agg(json_build_object('id', j.id, 'title', j.title) ORDER BY j.title) FROM hk_class_journeys cj JOIN hk_journeys j ON j.id = cj.journey_id WHERE cj.class_id = c.id), '[]'::json) AS journeys
       FROM app_classes c JOIN app_class_teachers t ON t.class_id = c.id LEFT JOIN app_school_years y ON y.id = c.year_id
       WHERE t.teacher_id = $1 AND c.is_active AND c.status = 'APPROVED' AND COALESCE(y.status, 'active') <> 'ended' ORDER BY c.school_year DESC, c.name`, [user.id]);
  }

  /** Giao hành trình của giáo viên cho các lớp mình phụ trách; việc giao tự phát hành hành trình (phải đạt đủ điều kiện) */
  async assign(user: UserRow, journeyId: number, classIds: number[]) {
    if (user.role !== 'teacher') throw new ForbiddenException('Chỉ giáo viên giao hành trình cho lớp');
    if (!classIds.length || classIds.length > 20) throw new BadRequestException('Hãy chọn từ 1 đến 20 lớp');
    await this.db.tx(async (q) => {
      const row = await this.load(q, user, journeyId, true);
      this.mustEdit(user, row);
      const mine = await q<{ id: number }>(
        `SELECT c.id FROM app_classes c JOIN app_class_teachers t ON t.class_id = c.id LEFT JOIN app_school_years y ON y.id = c.year_id
         WHERE t.teacher_id = $1 AND c.id = ANY($2) AND c.is_active AND c.status = 'APPROVED' AND COALESCE(y.status, 'active') <> 'ended'`, [user.id, classIds]);
      if (mine.length !== new Set(classIds).size) throw new ForbiddenException('Chỉ giao được cho lớp bạn phụ trách và còn đang hoạt động');
      const problems = await this.problems(q, journeyId, row);
      if (problems.length) throw new UnprocessableEntityException(`Chưa giao được: ${problems.join('; ')}`);
      for (const c of mine) await q('INSERT INTO hk_class_journeys (class_id, journey_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [c.id, journeyId, user.id]);
      await q("UPDATE hk_journeys SET status = 'published', updated_at = now() WHERE id = $1", [journeyId]);
    });
    return this.get(user, journeyId);
  }

  async unassign(user: UserRow, journeyId: number, classId: number) {
    await this.db.tx(async (q) => {
      const row = await this.load(q, user, journeyId, true);
      this.mustEdit(user, row);
      await q('DELETE FROM hk_class_journeys WHERE journey_id = $1 AND class_id = $2', [journeyId, classId]);
    });
    return this.get(user, journeyId);
  }
}
