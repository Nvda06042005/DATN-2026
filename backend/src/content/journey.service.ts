/**
 * Hành trình học – bản đồ nhiệm vụ (HK.GV.018–021, HK.QT.042, HK.AD.043): thư viện hành trình mẫu của hệ thống / trường / giáo viên,
 * tạo trống hoặc từ mẫu, thêm – sửa – xóa nút (bài học, bộ câu hỏi, trận đánh, tư liệu, trận Quyết chiến), tư liệu mở khóa theo nút, giao cho lớp.
 * Nút mở theo thứ tự hoặc theo đường nối (nhánh rẽ), kèm điều kiện mở khóa và phần thưởng riêng của nút; vị trí nút trên bản đồ, xem trước như học sinh,
 * giao cho lớp theo lịch, nhân bản sang lớp khác hoặc năm học mới (Sprint 7, HK.GV.022–027).
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { likeEscape } from '../admin/school.service';
import { DatabaseService, Q, searchText, UserRow } from '../database/database.service';
import { gatePoolSize } from '../student/gates';
import { computeStates } from '../student/progress';
import { notFound, Scope } from './access';
import { QuizService } from './quiz.service';

export const NODE_KINDS = ['lesson', 'quiz', 'battle', 'source', 'final', 'practice', 'listen', 'chest', 'gate_test'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];
export const NODE_KIND_LABEL: Record<NodeKind, string> = {
  lesson: 'Bài học', quiz: 'Câu hỏi', battle: 'Trận đánh', source: 'Tư liệu', final: 'Quyết chiến',
  practice: 'Luyện tập', listen: 'Nghe kể chuyện', chest: 'Rương', gate_test: 'Kiểm tra cửa',
};
export const NODE_ICONS = ['book', 'quiz', 'sword', 'scroll', 'flag', 'star', 'castle', 'ship', 'horse', 'map', 'crown', 'headphones', 'dumbbell', 'chest', 'trophy'] as const;
const DEFAULT_ICON: Record<NodeKind, string> = {
  lesson: 'book', quiz: 'quiz', battle: 'sword', source: 'scroll', final: 'crown', practice: 'dumbbell', listen: 'headphones', chest: 'chest', gate_test: 'trophy',
};
export const FINAL_PASS = 70;
/** Điểm đạt và điểm thưởng mặc định của các loại nút mới: luyện tập chỉ cần làm đúng ít nhất một câu; kiểm tra cuối cửa cần 70% */
const DEFAULT_PASS: Partial<Record<NodeKind, number>> = { final: FINAL_PASS, gate_test: FINAL_PASS, practice: 1 };
const DEFAULT_REWARD: Partial<Record<NodeKind, number>> = { final: 200, gate_test: 80, practice: 20, chest: 20, listen: 30 };
/** Loại nút có thể kèm bộ câu hỏi: nút câu hỏi / Quyết chiến bắt buộc, các loại còn lại tùy chọn */
const QUIZ_KINDS: NodeKind[] = ['quiz', 'final', 'battle', 'listen', 'gate_test'];

export interface JourneyInput { title: string; description?: string | null; campaign_id: number; background_url?: string | null; template_id?: number | null; class_ids?: number[] }
export interface NodeInput {
  kind?: NodeKind; title?: string; icon?: string | null; objective?: string | null; lesson_id?: number | null; quiz_id?: number | null; source_id?: number | null;
  battle_id?: number | null; pass_percent?: number | null; reward_points?: number; unlock_source_ids?: number[]; position?: number;
  opens_at?: string | null; min_percent?: number | null; min_stars?: number | null; reward_gold?: number; reward_card_id?: number | null; reward_badge_id?: number | null;
  gate_id?: number | null; audio_url?: string | null; transcript?: string | null; reward_binh_thu?: number | null;
}
export interface GateInput { title?: string; summary?: string | null; guide_note?: string | null }
export interface JourneyFilter { q?: string; store?: string; campaign_id?: number }

interface JourneyRow {
  id: number; scope: Scope; school_id: number | null; owner_id: number | null; title: string; description: string | null; campaign_id: number; background_url: string | null;
  is_default: boolean; status: 'draft' | 'published'; copied_from: number | null; created_at: string; updated_at: string;
}
interface NodeRow {
  id: number; journey_id: number; position: number; kind: NodeKind; title: string; icon: string | null; objective: string | null;
  lesson_id: number | null; quiz_id: number | null; source_id: number | null; battle_id: number | null; pass_percent: number | null; reward_points: number;
  pos_x: number | null; pos_y: number | null; opens_at: string | null; min_percent: number | null; min_stars: number | null; reward_gold: number; reward_card_id: number | null; reward_badge_id: number | null;
  gate_id: number | null; audio_url: string | null; transcript: string | null; reward_binh_thu: number | null;
}

const COLUMNS ='id, scope, school_id, owner_id, title, description, campaign_id, background_url, is_default, status, copied_from, created_at, updated_at';
const NODE_COLUMNS = 'id, journey_id, position, kind, title, icon, objective, lesson_id, quiz_id, source_id, battle_id, pass_percent, reward_points, pos_x::float8 AS pos_x, pos_y::float8 AS pos_y, opens_at, min_percent, min_stars, reward_gold, reward_card_id, reward_badge_id, gate_id, audio_url, transcript, reward_binh_thu';

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
        `SELECT c.id, c.name, c.grade, c.school_year, cj.assigned_at, cj.starts_at, cj.ends_at, (SELECT count(*)::int FROM app_class_members m WHERE m.class_id = c.id) AS students
         FROM hk_class_journeys cj JOIN app_classes c ON c.id = cj.class_id WHERE cj.journey_id = $1 ORDER BY c.name`, [id]);
      const edges = await q<{ from_node: number; to_node: number }>('SELECT from_node, to_node FROM hk_node_edges WHERE journey_id = $1', [id]);
      const shares = await q<{ target: string; status: string; review_note: string | null }>("SELECT target, status, review_note FROM hk_shares WHERE entity = 'journey' AND entity_id = $1", [id]);
      const gates = await q('SELECT id, position, title, summary, guide_note FROM hk_gates WHERE journey_id = $1 ORDER BY position, id', [id]);
      return { ...row, campaign_title: campaign, owner_name: owner, can_edit: edits(user, row), nodes, gates, edges, classes, shares, problems: await this.problems(q, id, row) };
    });
  }

  private async nodeViews(q: Q, id: number) {
    const rows = await q(
      `SELECT n.id, n.position, n.kind, n.title, n.icon, n.objective, n.lesson_id, n.quiz_id, n.source_id, n.battle_id, n.pass_percent, n.reward_points,
              n.pos_x::float8 AS pos_x, n.pos_y::float8 AS pos_y, n.opens_at, n.min_percent, n.min_stars, n.reward_gold, n.reward_card_id, n.reward_badge_id,
              n.gate_id, n.audio_url, n.transcript, n.reward_binh_thu,
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
      // Luyện tập và kiểm tra cuối cửa không có bộ đề riêng tự lấy câu hỏi từ các nút trong cửa nên cửa phải có câu hỏi
      if ((n.kind === 'practice' || n.kind === 'gate_test') && !n.quiz_id) {
        if (!n.gate_id) out.push(`Nút "${n.title}": cần thuộc một Cửa hoặc chọn bộ câu hỏi riêng`);
        else if (!(await gatePoolSize(q, n.gate_id))) out.push(`Nút "${n.title}": Cửa chưa có bài học hoặc bộ câu hỏi nào để lấy câu hỏi`);
      }
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
    const ids = new Map<number, number>();
    // Sao cả các Cửa, nút giữ nguyên Cửa của mình
    const gateIds = new Map<number, number>();
    for (const g of await q<{ id: number; position: number; title: string; summary: string | null; guide_note: string | null }>('SELECT id, position, title, summary, guide_note FROM hk_gates WHERE journey_id = $1 ORDER BY position', [from])) {
      gateIds.set(g.id, (await q<{ id: number }>('INSERT INTO hk_gates (journey_id, position, title, summary, guide_note) VALUES ($1, $2, $3, $4, $5) RETURNING id', [to, g.position, g.title, g.summary, g.guide_note]))[0].id);
    }
    for (const n of nodes) {
      const id = (await q<{ id: number }>(
        `INSERT INTO hk_nodes (journey_id, position, kind, title, icon, objective, lesson_id, quiz_id, source_id, battle_id, pass_percent, reward_points, pos_x, pos_y, opens_at, min_percent, min_stars, reward_gold, reward_card_id, reward_badge_id, gate_id, audio_url, transcript, reward_binh_thu)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24) RETURNING id`,
        [to, n.position, n.kind, n.title, n.icon, n.objective, n.lesson_id, n.quiz_id, n.source_id, n.battle_id, n.pass_percent, n.reward_points, n.pos_x, n.pos_y, null, n.min_percent, n.min_stars, n.reward_gold, n.reward_card_id, n.reward_badge_id, n.gate_id ? gateIds.get(n.gate_id) ?? null : null, n.audio_url, n.transcript, n.reward_binh_thu]))[0].id;
      ids.set(n.id, id);
      await q('INSERT INTO hk_node_unlocks (node_id, source_id) SELECT $2, source_id FROM hk_node_unlocks WHERE node_id = $1', [n.id, id]);
    }
    for (const e of await q<{ from_node: number; to_node: number }>('SELECT from_node, to_node FROM hk_node_edges WHERE journey_id = $1', [from])) {
      await q('INSERT INTO hk_node_edges (journey_id, from_node, to_node) VALUES ($1, $2, $3)', [to, ids.get(e.from_node), ids.get(e.to_node)]);
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
    if (!NODE_KINDS.includes(kind)) throw new BadRequestException('Loại nút phải là bài học, câu hỏi, trận đánh, tư liệu, Quyết chiến, luyện tập, nghe kể chuyện, rương hoặc kiểm tra cuối cửa');
    const pick = <K extends keyof NodeRow>(key: K): NodeRow[K] | null => ((input[key as keyof NodeInput] === undefined ? (existing?.[key] ?? null) : input[key as keyof NodeInput]) as NodeRow[K] | null);
    const want = (key: 'lesson_id' | 'quiz_id' | 'source_id' | 'battle_id', allowed: boolean, required: boolean): number | null => {
      const v = allowed ? pick(key) : null;
      if (required && !v) throw new BadRequestException('Hãy chọn nội dung cho nút');
      return v;
    };
    const lesson = want('lesson_id', kind === 'lesson', kind === 'lesson');
    const quiz = want('quiz_id', QUIZ_KINDS.includes(kind), kind === 'quiz' || kind === 'final');
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
    if (!pass && DEFAULT_PASS[kind]) pass = DEFAULT_PASS[kind]!;
    if (pass !== null && (!Number.isInteger(pass) || pass < 1 || pass > 100)) throw new BadRequestException('Điểm đạt từ 1% đến 100%');
    const reward = input.reward_points ?? existing?.reward_points ?? DEFAULT_REWARD[kind] ?? 50;
    if (!Number.isInteger(reward) || reward < 0 || reward > 1000) throw new BadRequestException('Điểm thưởng từ 0 đến 1000');
    // Điều kiện mở khóa (HK.GV.023) và phần thưởng riêng của nút (HK.GV.024)
    const opensRaw = input.opens_at === undefined ? (existing?.opens_at ?? null) : input.opens_at;
    const opens = opensRaw ? new Date(opensRaw) : null;
    if (opens && Number.isNaN(opens.getTime())) throw new BadRequestException('Giờ mở nút không hợp lệ');
    const range = (v: number | null | undefined, cur: number | null | undefined, min: number, max: number, label: string): number | null => {
      const x = v === undefined ? (cur ?? null) : v;
      if (x === null || x === undefined || (x as unknown) === '') return null;
      if (!Number.isInteger(Number(x)) || Number(x) < min || Number(x) > max) throw new BadRequestException(`${label}: số nguyên từ ${min} đến ${max}`);
      return Number(x);
    };
    const minPercent = range(input.min_percent, existing?.min_percent, 1, 100, 'Điểm tối thiểu (%)');
    const minStars = range(input.min_stars, existing?.min_stars, 1, 3, 'Số sao tối thiểu');
    const rewardGold = range(input.reward_gold, existing?.reward_gold, 0, 1000, 'Vàng thưởng') ?? 0;
    const cardId = range(input.reward_card_id, existing?.reward_card_id, 1, 2_000_000_000, 'Thẻ thưởng');
    const badgeId = range(input.reward_badge_id, existing?.reward_badge_id, 1, 2_000_000_000, 'Huy hiệu thưởng');
    if (cardId && !(await q('SELECT 1 FROM hk_cards WHERE id = $1 AND is_active', [cardId])).length) throw new BadRequestException('Thẻ nhân vật thưởng không tồn tại hoặc đã tắt');
    if (badgeId && !(await q("SELECT 1 FROM hk_badges WHERE id = $1 AND is_active AND (scope = 'system' OR school_id = $2)", [badgeId, journey.school_id])).length) throw new BadRequestException('Huy hiệu thưởng không tồn tại hoặc không thuộc trường của hành trình');
    // Lộ trình dạng đường đi (ver0.2): Cửa chứa nút, âm thanh / lời kể của nút nghe kể chuyện, Binh thư thưởng riêng (không đặt = mức mặc định theo loại nút)
    const gateRaw = input.gate_id === undefined ? (existing?.gate_id ?? null) : input.gate_id;
    const gateId = gateRaw === null || (gateRaw as unknown) === '' ? null : Number(gateRaw);
    if (gateId !== null && (!Number.isInteger(gateId) || !(await q('SELECT 1 FROM hk_gates WHERE id = $1 AND journey_id = $2', [gateId, journey.id])).length)) throw new BadRequestException('Cửa không thuộc hành trình này');
    const text = (v: string | null | undefined, cur: string | null | undefined, label: string, max: number): string | null => {
      const x = v === undefined ? (cur ?? null) : String(v ?? '').trim() || null;
      if (x && x.length > max) throw new BadRequestException(`${label} tối đa ${max} ký tự`);
      return x;
    };
    const audio = kind === 'listen' ? text(input.audio_url, existing?.audio_url, 'Đường dẫn âm thanh', 500) : null;
    if (audio && !/^https:\/\//.test(audio)) throw new BadRequestException('Đường dẫn âm thanh phải bắt đầu bằng https://');
    const transcript = kind === 'listen' ? text(input.transcript, existing?.transcript, 'Lời kể', 4000) : null;
    if (kind === 'listen' && !audio && !transcript) throw new BadRequestException('Nút nghe kể chuyện cần có lời kể (làm phụ đề và đọc thành tiếng) hoặc đường dẫn âm thanh');
    const binhThu = range(input.reward_binh_thu, existing?.reward_binh_thu, 0, 1000, 'Binh thư thưởng');
    return { kind, title, icon, objective, lesson_id: lesson, quiz_id: quiz, source_id: source, battle_id: battle, pass_percent: pass, reward_points: reward, opens_at: opens, min_percent: minPercent, min_stars: minStars, reward_gold: rewardGold, reward_card_id: cardId, reward_badge_id: badgeId, gate_id: gateId, audio_url: audio, transcript, reward_binh_thu: binhThu };
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
      // Nút mới của một Cửa nối vào cuối Cửa đó (trừ khi chỉ định vị trí)
      let wanted = input.position;
      if (wanted === undefined && f.gate_id) {
        const last = (await q<{ p: number | null }>('SELECT max(position) AS p FROM hk_nodes WHERE journey_id = $1 AND gate_id = $2', [journeyId, f.gate_id]))[0].p;
        if (last) wanted = last + 1;
      }
      let position = f.kind === 'final' ? nodes.length + 1 : Math.min(wanted ?? nodes.length + 1, final ? final.position : nodes.length + 1);
      position = Math.max(1, position);
      await q('UPDATE hk_nodes SET position = position + 1 WHERE journey_id = $1 AND position >= $2', [journeyId, position]);
      const id = (await q<{ id: number }>(
        `INSERT INTO hk_nodes (journey_id, position, kind, title, icon, objective, lesson_id, quiz_id, source_id, battle_id, pass_percent, reward_points, opens_at, min_percent, min_stars, reward_gold, reward_card_id, reward_badge_id, gate_id, audio_url, transcript, reward_binh_thu)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) RETURNING id`,
        [journeyId, position, f.kind, f.title, f.icon, f.objective, f.lesson_id, f.quiz_id, f.source_id, f.battle_id, f.pass_percent, f.reward_points, f.opens_at, f.min_percent, f.min_stars, f.reward_gold, f.reward_card_id, f.reward_badge_id, f.gate_id, f.audio_url, f.transcript, f.reward_binh_thu]))[0].id;
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
        `UPDATE hk_nodes SET title = $2, icon = $3, objective = $4, lesson_id = $5, quiz_id = $6, source_id = $7, battle_id = $8, pass_percent = $9, reward_points = $10,
           opens_at = $11, min_percent = $12, min_stars = $13, reward_gold = $14, reward_card_id = $15, reward_badge_id = $16, gate_id = $17, audio_url = $18, transcript = $19, reward_binh_thu = $20, updated_at = now() WHERE id = $1`,
        [nodeId, f.title, f.icon, f.objective, f.lesson_id, f.quiz_id, f.source_id, f.battle_id, f.pass_percent, f.reward_points, f.opens_at, f.min_percent, f.min_stars, f.reward_gold, f.reward_card_id, f.reward_badge_id, f.gate_id, f.audio_url, f.transcript, f.reward_binh_thu]);
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

  // ------------------------------------------------------------------ Cửa của lộ trình (HK.AD.080)
  private gateFields(input: GateInput, existing?: { title: string; summary: string | null; guide_note: string | null }) {
    const title = String(input.title ?? existing?.title ?? '').trim().replace(/\s+/g, ' ');
    if (title.length < 2 || title.length > 120) throw new BadRequestException('Tên Cửa cần từ 2 đến 120 ký tự');
    const opt = (v: string | null | undefined, cur: string | null | undefined, label: string, max: number): string | null => {
      const x = v === undefined ? (cur ?? null) : String(v ?? '').trim() || null;
      if (x && x.length > max) throw new BadRequestException(`${label} tối đa ${max} ký tự`);
      return x;
    };
    return { title, summary: opt(input.summary, existing?.summary, 'Mô tả Cửa', 400), guide_note: opt(input.guide_note, existing?.guide_note, 'Ghi chú Cẩm nang', 2000) };
  }

  async addGate(user: UserRow, journeyId: number, input: GateInput) {
    await this.db.tx(async (q) => {
      const journey = await this.load(q, user, journeyId, true);
      this.mustEdit(user, journey);
      if (Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_gates WHERE journey_id = $1', [journeyId]))[0].n) >= 20) throw new ConflictException('Mỗi hành trình tối đa 20 Cửa');
      const f = this.gateFields(input);
      await q(
        'INSERT INTO hk_gates (journey_id, position, title, summary, guide_note) VALUES ($1, (SELECT COALESCE(max(position), 0) + 1 FROM hk_gates WHERE journey_id = $1), $2, $3, $4)',
        [journeyId, f.title, f.summary, f.guide_note]);
      await q('UPDATE hk_journeys SET updated_at = now() WHERE id = $1', [journeyId]);
    });
    return this.get(user, journeyId);
  }

  private async loadGate(q: Q, user: UserRow, gateId: number) {
    const gate = (await q<{ id: number; journey_id: number; title: string; summary: string | null; guide_note: string | null }>('SELECT id, journey_id, title, summary, guide_note FROM hk_gates WHERE id = $1 FOR UPDATE', [gateId]))[0];
    if (!gate) throw notFound('Cửa');
    this.mustEdit(user, await this.load(q, user, gate.journey_id, true));
    return gate;
  }

  async updateGate(user: UserRow, gateId: number, input: GateInput) {
    const journeyId = await this.db.tx(async (q) => {
      const gate = await this.loadGate(q, user, gateId);
      const f = this.gateFields(input, gate);
      await q('UPDATE hk_gates SET title = $2, summary = $3, guide_note = $4, updated_at = now() WHERE id = $1', [gateId, f.title, f.summary, f.guide_note]);
      await q('UPDATE hk_journeys SET updated_at = now() WHERE id = $1', [gate.journey_id]);
      return gate.journey_id;
    });
    return this.get(user, journeyId);
  }

  /** Xóa Cửa chỉ gỡ nhóm: các nút của Cửa vẫn còn trong hành trình, không thuộc Cửa nào */
  async removeGate(user: UserRow, gateId: number) {
    const journeyId = await this.db.tx(async (q) => {
      const gate = await this.loadGate(q, user, gateId);
      await q('DELETE FROM hk_gates WHERE id = $1', [gateId]);
      await q('UPDATE hk_journeys SET updated_at = now() WHERE id = $1', [gate.journey_id]);
      return gate.journey_id;
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
  async assign(user: UserRow, journeyId: number, classIds: number[], schedule: { starts_at?: string | null; ends_at?: string | null } = {}) {
    if (user.role !== 'teacher') throw new ForbiddenException('Chỉ giáo viên giao hành trình cho lớp');
    if (!classIds.length || classIds.length > 20) throw new BadRequestException('Hãy chọn từ 1 đến 20 lớp');
    const { starts, ends } = this.window(schedule);
    await this.db.tx(async (q) => {
      const row = await this.load(q, user, journeyId, true);
      this.mustEdit(user, row);
      const mine = await q<{ id: number }>(
        `SELECT c.id FROM app_classes c JOIN app_class_teachers t ON t.class_id = c.id LEFT JOIN app_school_years y ON y.id = c.year_id
         WHERE t.teacher_id = $1 AND c.id = ANY($2) AND c.is_active AND c.status = 'APPROVED' AND COALESCE(y.status, 'active') <> 'ended'`, [user.id, classIds]);
      if (mine.length !== new Set(classIds).size) throw new ForbiddenException('Chỉ giao được cho lớp bạn phụ trách và còn đang hoạt động');
      const problems = await this.problems(q, journeyId, row);
      if (problems.length) throw new UnprocessableEntityException(`Chưa giao được: ${problems.join('; ')}`);
      for (const c of mine) {
        await q('INSERT INTO hk_class_journeys (class_id, journey_id, assigned_by, starts_at, ends_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (class_id, journey_id) DO UPDATE SET starts_at = $4, ends_at = $5, assigned_by = $3', [c.id, journeyId, user.id, starts, ends]);
      }
      await q("UPDATE hk_journeys SET status = 'published', updated_at = now() WHERE id = $1", [journeyId]);
    });
    return this.get(user, journeyId);
  }

  /** Lịch giao hành trình (HK.GV.026): bắt đầu/kết thúc tùy chọn; chưa đặt thì chạy ngay và không hết hạn */
  private window(s: { starts_at?: string | null; ends_at?: string | null }): { starts: Date | null; ends: Date | null } {
    const starts = s.starts_at ? new Date(s.starts_at) : null, ends = s.ends_at ? new Date(s.ends_at) : null;
    if ((starts && Number.isNaN(starts.getTime())) || (ends && Number.isNaN(ends.getTime()))) throw new BadRequestException('Ngày bắt đầu hoặc kết thúc không hợp lệ');
    if (starts && ends && ends.getTime() <= starts.getTime()) throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    if (ends && ends.getTime() <= Date.now()) throw new BadRequestException('Ngày kết thúc phải ở sau thời điểm hiện tại');
    return { starts, ends };
  }

  async setSchedule(user: UserRow, journeyId: number, classId: number, schedule: { starts_at?: string | null; ends_at?: string | null }) {
    const { starts, ends } = this.window(schedule);
    await this.db.tx(async (q) => {
      const row = await this.load(q, user, journeyId, true);
      this.mustEdit(user, row);
      const done = await q('UPDATE hk_class_journeys SET starts_at = $3, ends_at = $4 WHERE journey_id = $1 AND class_id = $2 RETURNING class_id', [journeyId, classId, starts, ends]);
      if (!done.length) throw notFound('lớp được giao hành trình này');
    });
    return this.get(user, journeyId);
  }

  /** Nhân bản sang lớp khác hoặc năm học mới (HK.GV.027): sao cả nút, đường nối, điều kiện và phần thưởng; có thể giao ngay cho các lớp chọn */
  async copyTo(user: UserRow, id: number, opts: { title?: string; class_ids?: number[]; starts_at?: string | null; ends_at?: string | null }) {
    const copy = await this.duplicate(user, id);
    const copyId = (copy as { id: number }).id;
    const title = String(opts.title ?? '').trim();
    if (title) await this.update(user, copyId, { title });
    if (opts.class_ids?.length) await this.assign(user, copyId, opts.class_ids, { starts_at: opts.starts_at, ends_at: opts.ends_at });
    return this.get(user, copyId);
  }

  // ------------------------------------------------------------------ trình thiết kế bản đồ (HK.GV.022, 025)
  /** Lưu vị trí các nút (phần trăm trên bản đồ) và đường nối (nhánh rẽ); không có đường nối nào thì bản đồ chạy theo thứ tự nút */
  async setLayout(user: UserRow, journeyId: number, body: { nodes?: Array<{ id: number; x: number | null; y: number | null }>; edges?: Array<{ from: number; to: number }> }) {
    await this.db.tx(async (q) => {
      const journey = await this.load(q, user, journeyId, true);
      this.mustEdit(user, journey);
      const nodes = await q<{ id: number; kind: NodeKind; title: string }>('SELECT id, kind, title FROM hk_nodes WHERE journey_id = $1', [journeyId]);
      const ids = new Set(nodes.map((n) => n.id));
      for (const n of body.nodes ?? []) {
        if (!ids.has(n.id)) throw new BadRequestException('Có nút không thuộc hành trình này');
        const ok = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100);
        if (!ok(n.x) || !ok(n.y)) throw new BadRequestException('Vị trí nút nằm trong khoảng 0 đến 100 (phần trăm bản đồ)');
        await q('UPDATE hk_nodes SET pos_x = $2, pos_y = $3 WHERE id = $1', [n.id, n.x === null ? null : Math.round(n.x * 100) / 100, n.y === null ? null : Math.round(n.y * 100) / 100]);
      }
      if (body.edges !== undefined) {
        const edges = [...new Map((body.edges ?? []).map((e) => [`${e.from}>${e.to}`, e])).values()];
        for (const e of edges) {
          if (!ids.has(e.from) || !ids.has(e.to)) throw new BadRequestException('Đường nối phải nối hai nút của hành trình');
          if (e.from === e.to) throw new BadRequestException('Một nút không nối với chính nó');
        }
        if (edges.length > 120) throw new BadRequestException('Quá nhiều đường nối');
        // Đồ thị không có vòng: mỗi nút phải xếp được sau mọi nút nối vào nó
        const indeg = new Map(nodes.map((n) => [n.id, 0]));
        for (const e of edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
        const queue = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
        let seen = 0;
        while (queue.length) {
          const cur = queue.pop()!;
          seen += 1;
          for (const e of edges.filter((x) => x.from === cur)) { indeg.set(e.to, indeg.get(e.to)! - 1); if (indeg.get(e.to) === 0) queue.push(e.to); }
        }
        if (edges.length && seen !== nodes.length) throw new UnprocessableEntityException('Các đường nối tạo thành vòng lặp; hãy bỏ bớt một đường để mỗi nút có thể mở được');
        const final = nodes.find((n) => n.kind === 'final');
        if (edges.length && final) {
          if (edges.some((e) => e.from === final.id)) throw new UnprocessableEntityException('Trận Quyết chiến là nút cuối nên không nối đi tiếp được');
          if (!edges.some((e) => e.to === final.id)) throw new UnprocessableEntityException('Trận Quyết chiến cần được nối từ ít nhất một nút phía trước');
        }
        const current = await q<{ from_node: number; to_node: number }>('SELECT from_node, to_node FROM hk_node_edges WHERE journey_id = $1', [journeyId]);
        const same = current.length === edges.length && current.every((c) => edges.some((e) => e.from === c.from_node && e.to === c.to_node));
        if (!same) {
          const learners = Number((await q<{ n: string }>('SELECT count(DISTINCT p.user_id) AS n FROM hk_node_progress p JOIN hk_nodes n ON n.id = p.node_id WHERE n.journey_id = $1', [journeyId]))[0].n);
          if (learners) throw new ConflictException(`Đã có ${learners} học sinh học hành trình này nên không đổi đường nối được; hãy nhân bản hành trình để chỉnh`);
          await q('DELETE FROM hk_node_edges WHERE journey_id = $1', [journeyId]);
          for (const e of edges) await q('INSERT INTO hk_node_edges (journey_id, from_node, to_node) VALUES ($1, $2, $3)', [journeyId, e.from, e.to]);
        }
      }
      await q('UPDATE hk_journeys SET updated_at = now() WHERE id = $1', [journeyId]);
    });
    return this.get(user, journeyId);
  }

  /** Xem trước bản đồ như học sinh (HK.GV.025): trạng thái các nút tính từ danh sách nút giáo viên đánh dấu "đã xong"; không ghi gì vào dữ liệu học sinh */
  async preview(user: UserRow, journeyId: number, completed: number[] = [], hours = 0) {
    return this.db.tx(async (q) => {
      const row = await this.load(q, user, journeyId);
      const nodes = await q<Record<string, any>>(`SELECT ${NODE_COLUMNS} FROM hk_nodes WHERE journey_id = $1 ORDER BY position`, [journeyId]);
      const edges = await q<{ from_node: number; to_node: number }>('SELECT from_node, to_node FROM hk_node_edges WHERE journey_id = $1', [journeyId]);
      const done = new Set(completed);
      const at = new Date(Date.now() + Math.max(0, Math.min(24 * 365, Number(hours) || 0)) * 3600_000);
      const states = computeStates(nodes.map((n) => ({ ...(n as Record<string, unknown>), stars: done.has(n.id) ? 3 : 0, best_percent: done.has(n.id) ? 100 : 0, attempts: done.has(n.id) ? 1 : 0, completed_at: done.has(n.id) ? new Date().toISOString() : null }) as never), edges, at);
      return {
        journey: { id: row.id, title: row.title, description: row.description, background_url: row.background_url }, edges,
        nodes: states.map((n) => ({ id: n.id, position: n.position, kind: n.kind, kind_label: NODE_KIND_LABEL[n.kind], title: n.title, icon: n.icon, objective: n.objective, state: n.state, lock_reason: n.lock_reason, preds: n.preds, pos_x: n.pos_x, pos_y: n.pos_y, stars: n.stars, reward_points: n.reward_points, reward_gold: n.reward_gold })),
        totals: { nodes: states.length, done: states.filter((n) => n.state === 'done').length },
      };
    });
  }

  /** Thẻ nhân vật và huy hiệu có thể đặt làm phần thưởng của nút (HK.GV.024): huy hiệu của hệ thống hoặc của trường người soạn */
  async rewardOptions(user: UserRow) {
    const cards = await this.db.query<{ id: number; name: string; rarity: string }>('SELECT id, name, rarity FROM hk_cards WHERE is_active ORDER BY rarity, name');
    const badges = await this.db.query<{ id: number; name: string; scope: string }>(
      "SELECT id, name, scope FROM hk_badges WHERE is_active AND (scope = 'system' OR school_id = $1) ORDER BY scope, sort_order, name", [user.school_id]);
    return { cards, badges };
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
