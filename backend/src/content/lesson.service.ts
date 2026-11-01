/**
 * Bài học (HK.AD.044): quản trị tổng soạn bằng các khối nội dung (văn bản, hình, video, bản đồ), gắn với dữ liệu lịch sử và câu hỏi kiểm tra nhanh.
 * Giáo viên chỉ chọn bài học đã công bố khi thêm nút vào hành trình; học sinh đọc qua nút trên bản đồ.
 */
import { BadRequestException, ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { likeEscape } from '../admin/school.service';
import { AiIndexService } from '../ai/ai-index.service';
import { DatabaseService, Q, searchText, UserRow } from '../database/database.service';
import { checkLinks, LinkInput, linkLabels, notFound } from './access';

export type Block =
  | { type: 'text'; heading?: string; text: string }
  | { type: 'image'; url: string; caption?: string }
  | { type: 'video'; url: string; caption?: string }
  | { type: 'map'; lat: number; lng: number; zoom: number; label: string; caption?: string };

export interface LessonInput {
  title: string; summary?: string | null; campaign_id?: number | null; blocks: unknown[]; read_minutes?: number; links?: LinkInput[]; check_question_ids?: number[];
}
export interface LessonFilter { q?: string; campaign_id?: number; status?: string }

const LESSON_LINKS = ['campaign', 'figure', 'event', 'place', 'battle', 'source', 'term'] as const;
const MAX_BLOCKS = 30;
const MAX_CHECKS = 3;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const bad = (m: string): never => { throw new BadRequestException(m); };
const text = (v: unknown, max: number, label: string, required = true): string => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) return bad(`${label} không được để trống`);
  if (s.length > max) return bad(`${label} tối đa ${max} ký tự`);
  return s;
};
const https = (v: unknown, label: string): string => {
  const s = text(v, 500, label);
  if (!/^https:\/\/[^\s]+$/.test(s)) return bad(`${label} phải là liên kết https`);
  return s;
};

/** Kiểm tra và chuẩn hóa từng khối nội dung */
export function normalizeBlocks(raw: unknown[]): Block[] {
  if (!Array.isArray(raw) || raw.length > MAX_BLOCKS) return bad(`Bài học có tối đa ${MAX_BLOCKS} khối nội dung`);
  return raw.map((b, i): Block => {
    const label = `Khối ${i + 1}`;
    if (!isObj(b)) return bad(`${label} không hợp lệ`);
    if (b.type === 'text') {
      const heading = text(b.heading, 120, `${label}: tiêu đề`, false);
      return { type: 'text', ...(heading ? { heading } : {}), text: text(b.text, 4000, `${label}: nội dung`) };
    }
    if (b.type === 'image' || b.type === 'video') {
      const caption = text(b.caption, 200, `${label}: chú thích`, false);
      return { type: b.type, url: https(b.url, `${label}: liên kết`), ...(caption ? { caption } : {}) };
    }
    if (b.type === 'map') {
      const lat = Number(b.lat);
      const lng = Number(b.lng);
      const zoom = b.zoom === undefined ? 7 : Number(b.zoom);
      if (!Number.isFinite(lat) || lat < 8 || lat > 24 || !Number.isFinite(lng) || lng < 102 || lng > 110) return bad(`${label}: vị trí nằm ngoài khung bản đồ Việt Nam`);
      if (!Number.isInteger(zoom) || zoom < 4 || zoom > 12) return bad(`${label}: mức phóng to từ 4 đến 12`);
      const caption = text(b.caption, 200, `${label}: chú thích`, false);
      return { type: 'map', lat, lng, zoom, label: text(b.label, 80, `${label}: tên địa danh`), ...(caption ? { caption } : {}) };
    }
    return bad(`${label}: loại khối phải là text, image, video hoặc map`);
  });
}

/** Thời gian đọc ước tính: 150 từ mỗi phút, mỗi hình/bản đồ thêm nửa phút */
export function estimateMinutes(blocks: Block[]): number {
  const words = blocks.reduce((n, b) => n + (b.type === 'text' ? b.text.split(/\s+/).length : 0), 0);
  const media = blocks.filter((b) => b.type !== 'text').length;
  return Math.min(120, Math.max(1, Math.ceil(words / 150 + media * 0.5)));
}

@Injectable()
export class LessonService {
  constructor(private readonly db: DatabaseService, private readonly ai: AiIndexService) {
    // Nội dung đã công bố đổi thì hẹn lập chỉ mục lại cho AI Tutor (HK.SYS.011); gộp các thay đổi liên tiếp
    for (const name of ['update', 'setStatus', 'remove']) {
      const original = (this as any)[name].bind(this);
      (this as any)[name] = async (...args: unknown[]) => { const out = await original(...args); this.ai.touch(); return out; };
    }
  }

  /** Quản trị tổng thấy mọi bài; giáo viên và quản trị trường chỉ thấy bài đã công bố */
  async list(user: UserRow, f: LessonFilter) {
    const params: unknown[] = [];
    const parts: string[] = [];
    if (user.role !== 'root_admin') parts.push("t.status = 'published'");
    else if (f.status === 'draft' || f.status === 'published') { params.push(f.status); parts.push(`t.status = $${params.length}`); }
    const term = searchText(f.q ?? '');
    if (term) { params.push(`%${likeEscape(term)}%`); parts.push(`t.search_text LIKE $${params.length}`); }
    if (f.campaign_id) { params.push(f.campaign_id); parts.push(`t.campaign_id = $${params.length}`); }
    return this.db.query(
      `SELECT t.id, t.title, t.summary, t.campaign_id, c.title AS campaign_title, t.read_minutes, t.status, t.updated_at,
              (SELECT count(*)::int FROM hk_nodes n WHERE n.lesson_id = t.id) AS used_in,
              (SELECT count(*)::int FROM hk_lesson_checks k WHERE k.lesson_id = t.id) AS checks
       FROM hk_lessons t LEFT JOIN hist_campaigns c ON c.id = t.campaign_id
       ${parts.length ? `WHERE ${parts.join(' AND ')}` : ''} ORDER BY t.campaign_id NULLS LAST, t.title, t.id LIMIT 500`, params);
  }

  async get(user: UserRow, id: number) {
    return this.db.tx(async (q) => {
      const row = (await q<{ id: number; status: string }>('SELECT * FROM hk_lessons WHERE id = $1', [id]))[0];
      if (!row || (user.role !== 'root_admin' && row.status !== 'published')) throw notFound('bài học');
      const links = await q<LinkInput>('SELECT ref_type, ref_id FROM hk_lesson_links WHERE lesson_id = $1 ORDER BY ref_type, ref_id', [id]);
      const checks = await q(
        `SELECT k.question_id, k.position, t.qtype, t.prompt FROM hk_lesson_checks k JOIN hk_questions t ON t.id = k.question_id WHERE k.lesson_id = $1 ORDER BY k.position`, [id]);
      const used = await q<{ id: number; title: string }>(
        'SELECT j.id, j.title FROM hk_nodes n JOIN hk_journeys j ON j.id = n.journey_id WHERE n.lesson_id = $1 ORDER BY j.title', [id]);
      return { ...row, links: await linkLabels(q, links), checks, used_in: used };
    });
  }

  private async fields(q: Q, input: Partial<LessonInput>, existing?: Record<string, any>) {
    const title = text(input.title ?? existing?.title, 160, 'Tên bài học');
    if (title.length < 2) return bad('Tên bài học tối thiểu 2 ký tự');
    const summary = input.summary === undefined ? (existing?.summary ?? null) : text(input.summary, 600, 'Tóm tắt', false) || null;
    const campaign = input.campaign_id === undefined ? (existing?.campaign_id ?? null) : input.campaign_id;
    if (campaign && !(await q('SELECT 1 FROM hist_campaigns WHERE id = $1', [campaign])).length) return bad('Cuộc kháng chiến không tồn tại');
    const blocks = normalizeBlocks((input.blocks ?? existing?.blocks ?? []) as unknown[]);
    const minutes = input.read_minutes === undefined ? (blocks.length ? estimateMinutes(blocks) : (existing?.read_minutes ?? 3)) : Number(input.read_minutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) return bad('Thời gian đọc từ 1 đến 120 phút');
    const body = blocks.map((b) => (b.type === 'text' ? `${b.heading ?? ''} ${b.text}` : 'caption' in b ? (b.caption ?? '') : '')).join(' ');
    return { title, summary, campaign_id: campaign, blocks, read_minutes: minutes, search_text: searchText(title, summary, body) };
  }

  private async writeRelations(q: Q, id: number, links: LinkInput[] | undefined, checks: number[] | undefined): Promise<void> {
    if (links !== undefined) {
      const ok = await checkLinks(q, links, LESSON_LINKS);
      await q('DELETE FROM hk_lesson_links WHERE lesson_id = $1', [id]);
      for (const l of ok) await q('INSERT INTO hk_lesson_links (lesson_id, ref_type, ref_id) VALUES ($1, $2, $3)', [id, l.ref_type, l.ref_id]);
    }
    if (checks !== undefined) {
      if (checks.length > MAX_CHECKS || new Set(checks).size !== checks.length) return bad(`Mỗi bài học có tối đa ${MAX_CHECKS} câu kiểm tra nhanh, không trùng nhau`);
      for (const qid of checks) {
        const found = (await q<{ scope: string }>('SELECT scope FROM hk_questions WHERE id = $1', [qid]))[0];
        if (!found || found.scope !== 'system') return bad(`Câu kiểm tra nhanh #${qid} phải là câu hỏi của kho hệ thống`);
      }
      await q('DELETE FROM hk_lesson_checks WHERE lesson_id = $1', [id]);
      let position = 1;
      for (const qid of checks) await q('INSERT INTO hk_lesson_checks (lesson_id, question_id, position) VALUES ($1, $2, $3)', [id, qid, position++]);
    }
  }

  async create(user: UserRow, input: LessonInput) {
    const id = await this.db.tx(async (q) => {
      const f = await this.fields(q, input);
      const row = (await q<{ id: number }>(
        `INSERT INTO hk_lessons (title, summary, campaign_id, blocks, read_minutes, search_text, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING id`,
        [f.title, f.summary, f.campaign_id, JSON.stringify(f.blocks), f.read_minutes, f.search_text, user.id]))[0];
      await this.writeRelations(q, row.id, input.links ?? [], input.check_question_ids ?? []);
      return row.id;
    });
    return this.get(user, id);
  }

  async update(user: UserRow, id: number, input: Partial<LessonInput>) {
    await this.db.tx(async (q) => {
      const row = (await q<Record<string, any>>('SELECT * FROM hk_lessons WHERE id = $1 FOR UPDATE', [id]))[0];
      if (!row) throw notFound('bài học');
      const f = await this.fields(q, input, row);
      if (row.status === 'published' && !f.blocks.length) throw new UnprocessableEntityException('Bài học đã công bố không được để trống nội dung');
      await q(
        `UPDATE hk_lessons SET title = $2, summary = $3, campaign_id = $4, blocks = $5, read_minutes = $6, search_text = $7, updated_by = $8, updated_at = now() WHERE id = $1`,
        [id, f.title, f.summary, f.campaign_id, JSON.stringify(f.blocks), f.read_minutes, f.search_text, user.id]);
      await this.writeRelations(q, id, input.links, input.check_question_ids);
    });
    return this.get(user, id);
  }

  /** Công bố cần có nội dung; gỡ công bố bị chặn khi bài học đang nằm trong hành trình đã phát hành */
  async setStatus(user: UserRow, id: number, status: 'draft' | 'published') {
    await this.db.tx(async (q) => {
      const row = (await q<{ blocks: unknown[]; status: string }>('SELECT blocks, status FROM hk_lessons WHERE id = $1 FOR UPDATE', [id]))[0];
      if (!row) throw notFound('bài học');
      if (status === 'published') {
        if (!row.blocks.length) throw new UnprocessableEntityException('Hãy thêm nội dung trước khi công bố bài học');
      } else {
        const live = await q<{ title: string }>("SELECT j.title FROM hk_nodes n JOIN hk_journeys j ON j.id = n.journey_id WHERE n.lesson_id = $1 AND j.status = 'published' LIMIT 3", [id]);
        if (live.length) throw new ConflictException(`Bài học đang nằm trong hành trình đã phát hành: ${live.map((j) => j.title).join(', ')}`);
      }
      await q("UPDATE hk_lessons SET status = $2, published_at = CASE WHEN $2 = 'published' THEN now() ELSE published_at END, updated_by = $3, updated_at = now() WHERE id = $1", [id, status, user.id]);
    });
    return this.get(user, id);
  }

  async remove(id: number): Promise<void> {
    await this.db.tx(async (q) => {
      if (!(await q('SELECT 1 FROM hk_lessons WHERE id = $1 FOR UPDATE', [id])).length) throw notFound('bài học');
      const nodes = await q<{ title: string }>('SELECT j.title FROM hk_nodes n JOIN hk_journeys j ON j.id = n.journey_id WHERE n.lesson_id = $1 LIMIT 3', [id]);
      if (nodes.length) throw new ConflictException(`Bài học đang nằm trong hành trình: ${nodes.map((j) => j.title).join(', ')}. Hãy gỡ khỏi hành trình trước`);
      await q('DELETE FROM hk_lessons WHERE id = $1', [id]);
    });
  }
}
