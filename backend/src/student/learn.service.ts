/**
 * Đọc kho dữ liệu lịch sử cho học sinh và giáo viên (HK.HS.017–018, 025–027, 031–036, 038–042): chỉ nội dung đã Công bố.
 * Cuộc kháng chiến, nhân vật, sự kiện, trận đánh, địa điểm, thuật ngữ, dòng thời gian, bản đồ, tư liệu gốc (kèm trạng thái mở khóa), tìm kiếm.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { likeEscape } from '../admin/school.service';
import { DatabaseService, Q, searchText, UserRow } from '../database/database.service';
import { Entity, SPECS } from '../history/history.service';
import { notFound } from '../content/access';
import { lockedSources } from './progress';
import { logEvent } from './events';

/** Cột nội bộ của kho lịch sử không trả cho học sinh */
const INTERNAL = ['search_text', 'verified_by', 'verified_at', 'published_by', 'created_by', 'updated_by'];

export interface TimelineFilter { campaign_id?: number; figure_id?: number; place_id?: number; year_from?: number; year_to?: number }
export interface SourceFilter { q?: string; campaign_id?: number; kind?: string; figure_id?: number; unlocked?: string; favorites?: string }

@Injectable()
export class LearnService {
  constructor(private readonly db: DatabaseService) {}

  private isStudent(user: UserRow): boolean { return user.role === 'student'; }

  /** Bản đồ tư liệu còn khóa; giáo viên và quản trị luôn thấy tất cả */
  private async locks(q: Q, user: UserRow): Promise<Map<number, { node_id: number; node_title: string }>> {
    return this.isStudent(user) ? lockedSources(q, user.id) : new Map();
  }

  /** Các bản ghi đã công bố liên kết với một bản ghi khác (bảng hist_links lưu theo cặp đã sắp thứ tự) */
  private async related(q: Q, type: Entity, id: number, other: Entity, columns: string, order: string): Promise<Array<Record<string, any>>> {
    const spec = SPECS[other];
    return q(
      `SELECT ${columns} FROM ${spec.table} t WHERE t.status = 'published' AND t.id IN (
         SELECT CASE WHEN a_type = $1 THEN b_id ELSE a_id END FROM hist_links
         WHERE (a_type = $1 AND a_id = $2 AND b_type = $3) OR (b_type = $1 AND b_id = $2 AND a_type = $3)
       ) ORDER BY ${order}`, [type, id, other]);
  }

  private async relatedSources(q: Q, user: UserRow, type: Entity, id: number) {
    const locks = await this.locks(q, user);
    const rows = await this.related(q, type, id, 'source', 't.id, t.title, t.kind', 't.title');
    return rows.map((r) => ({ ...r, locked: locks.has(r.id) }));
  }

  // ------------------------------------------------------------------ cuộc kháng chiến
  async campaigns() {
    const rows = await this.db.query<Record<string, any>>(
      `SELECT c.id, c.title, c.year_label, c.start_year, c.end_year, c.summary, c.image_url,
              (SELECT count(*)::int FROM hist_events e WHERE e.campaign_id = c.id AND e.status = 'published') AS events,
              (SELECT count(*)::int FROM hist_battles b WHERE b.campaign_id = c.id AND b.status = 'published') AS battles
       FROM hist_campaigns c WHERE c.status = 'published' ORDER BY c.sort_order, c.start_year NULLS LAST, c.id`);
    for (const c of rows) {
      c.places = (await this.db.query<{ name: string }>(
        `SELECT DISTINCT p.name FROM hist_places p WHERE p.status = 'published' AND (
           EXISTS (SELECT 1 FROM hist_battles b WHERE b.place_id = p.id AND b.campaign_id = $1 AND b.status = 'published') OR
           EXISTS (SELECT 1 FROM hist_events e WHERE e.place_id = p.id AND e.campaign_id = $1 AND e.status = 'published')) ORDER BY p.name LIMIT 4`, [c.id])).map((p) => p.name);
    }
    return rows;
  }

  // ------------------------------------------------------------------ nhân vật
  async figures(f: { group?: string; campaign_id?: number; q?: string }) {
    const params: unknown[] = [];
    const where = ["t.status = 'published'"];
    if (f.group) { params.push(f.group); where.push(`t.figure_group = $${params.length}`); }
    if (f.campaign_id) { params.push(f.campaign_id); where.push(`EXISTS (SELECT 1 FROM hist_links l WHERE l.a_type = 'campaign' AND l.a_id = $${params.length} AND l.b_type = 'figure' AND l.b_id = t.id)`); }
    const term = searchText(f.q ?? '');
    if (term) { params.push(`%${likeEscape(term)}%`); where.push(`t.search_text LIKE $${params.length}`); }
    return this.db.query(
      `SELECT t.id, t.name, t.honorific, t.figure_group, t.birth_year, t.death_year, t.role_text, t.image_url FROM hist_figures t WHERE ${where.join(' AND ')} ORDER BY ${SPECS.figure.order} LIMIT 200`, params);
  }

  async figure(user: UserRow, id: number) {
    return this.detail(user, 'figure', id, async (q, row) => ({
      campaigns: await this.related(q, 'figure', id, 'campaign', 't.id, t.title, t.year_label', 't.sort_order, t.id'),
      events: await this.related(q, 'figure', id, 'event', 't.id, t.name, t.year_from, t.date_text', 't.year_from, t.sort_order'),
      battles: await this.related(q, 'figure', id, 'battle', 't.id, t.name, t.year, t.date_text', 't.year, t.sort_order'),
      sources: await this.relatedSources(q, user, 'figure', row.id),
    }));
  }

  // ------------------------------------------------------------------ chi tiết dùng chung
  private async detail(user: UserRow, entity: Entity, id: number, extra: (q: Q, row: Record<string, any>) => Promise<Record<string, unknown>>) {
    const spec = SPECS[entity];
    const result = await this.db.tx(async (q) => {
      const row = (await q<Record<string, any>>(`SELECT * FROM ${spec.table} WHERE id = $1 AND status = 'published'`, [id]))[0];
      if (!row) throw notFound(spec.label.toLowerCase());
      const plain = Object.fromEntries(Object.entries(row).filter(([key]) => !INTERNAL.includes(key)).map(([key, value]) => [key, (key === 'lat' || key === 'lng') && value !== null ? Number(value) : value]));
      return { ...plain, ...(await extra(q, row)) };
    });
    if (this.isStudent(user)) await logEvent(this.db, user, `view_${entity}`, entity, id);
    return result;
  }

  // ------------------------------------------------------------------ sự kiện, trận đánh, địa điểm
  async event(user: UserRow, id: number) {
    return this.detail(user, 'event', id, async (q, row) => ({
      campaign: row.campaign_id ? (await q('SELECT id, title, year_label FROM hist_campaigns WHERE id = $1 AND status = \'published\'', [row.campaign_id]))[0] ?? null : null,
      place: row.place_id ? (await q('SELECT id, name, old_name, lat::float8 AS lat, lng::float8 AS lng FROM hist_places WHERE id = $1 AND status = \'published\'', [row.place_id]))[0] ?? null : null,
      figures: await this.related(q, 'event', id, 'figure', 't.id, t.name, t.honorific, t.figure_group, t.image_url', 't.name'),
      battles: await q('SELECT id, name, year FROM hist_battles WHERE event_id = $1 AND status = \'published\' ORDER BY year, id', [id]),
      sources: await this.relatedSources(q, user, 'event', id),
    }));
  }

  async battle(user: UserRow, id: number) {
    return this.detail(user, 'battle', id, async (q, row) => ({
      campaign: row.campaign_id ? (await q('SELECT id, title, year_label FROM hist_campaigns WHERE id = $1 AND status = \'published\'', [row.campaign_id]))[0] ?? null : null,
      place: row.place_id ? (await q('SELECT id, name, old_name, lat::float8 AS lat, lng::float8 AS lng FROM hist_places WHERE id = $1 AND status = \'published\'', [row.place_id]))[0] ?? null : null,
      event: row.event_id ? (await q('SELECT id, name, year_from FROM hist_events WHERE id = $1 AND status = \'published\'', [row.event_id]))[0] ?? null : null,
      figures: await this.related(q, 'battle', id, 'figure', 't.id, t.name, t.honorific, t.figure_group, t.image_url', 't.name'),
      sources: await this.relatedSources(q, user, 'battle', id),
      // Chơi ngay từ hồ sơ trận đánh (HK.HS.033): màn thẻ tướng, mô phỏng quyết định và mini-game của cùng cuộc kháng chiến (mini-game của đúng cuộc kháng chiến hoặc cùng loại với `minigame_key` của trận xếp trước, rồi tới mini-game chung)
      play: {
        stage: (await q("SELECT id, title FROM hk_stages WHERE battle_id = $1 AND status = 'published' ORDER BY id LIMIT 1", [id]))[0] ?? null,
        scenario: (await q("SELECT id, title FROM hk_scenarios WHERE battle_id = $1 AND status = 'published' ORDER BY school_id NULLS LAST,id LIMIT 1", [id]))[0] ?? null,
        minigames: await q("SELECT id, title, kind FROM hk_minigames WHERE status = 'published' AND (campaign_id = $1 OR campaign_id IS NULL OR kind = $2::text) ORDER BY (campaign_id = $1) DESC NULLS LAST, (kind = $2::text) DESC, kind, id LIMIT 6", [row.campaign_id ?? null, row.minigame_key ?? null]),
      },
    }));
  }

  async place(user: UserRow, id: number) {
    return this.detail(user, 'place', id, async (q) => ({
      events: await q('SELECT id, name, year_from, date_text FROM hist_events WHERE place_id = $1 AND status = \'published\' ORDER BY year_from, sort_order', [id]),
      battles: await q('SELECT id, name, year, date_text FROM hist_battles WHERE place_id = $1 AND status = \'published\' ORDER BY year, sort_order', [id]),
      sources: await this.relatedSources(q, user, 'place', id),
    }));
  }

  async places(f: { campaign_id?: number; q?: string }) {
    const params: unknown[] = [];
    const where = ["t.status = 'published'"];
    const term = searchText(f.q ?? '');
    if (term) { params.push(`%${likeEscape(term)}%`); where.push(`t.search_text LIKE $${params.length}`); }
    if (f.campaign_id) {
      params.push(f.campaign_id);
      where.push(`(EXISTS (SELECT 1 FROM hist_events e WHERE e.place_id = t.id AND e.campaign_id = $${params.length} AND e.status = 'published') OR EXISTS (SELECT 1 FROM hist_battles b WHERE b.place_id = t.id AND b.campaign_id = $${params.length} AND b.status = 'published'))`);
    }
    return this.db.query(`SELECT t.id, t.name, t.old_name, t.province, t.lat::float8 AS lat, t.lng::float8 AS lng, t.image_url FROM hist_places t WHERE ${where.join(' AND ')} ORDER BY t.name LIMIT 300`, params);
  }

  // ------------------------------------------------------------------ thuật ngữ và tìm kiếm
  async terms(q?: string) {
    const term = searchText(q ?? '');
    return this.db.query(
      `SELECT id, term, definition FROM hist_terms WHERE status = 'published' ${term ? 'AND search_text LIKE $1' : ''} ORDER BY term LIMIT 300`, term ? [`%${likeEscape(term)}%`] : []);
  }

  async search(user: UserRow, raw: string) {
    const term = searchText(raw);
    if (term.length < 2) throw new BadRequestException('Từ khóa tìm kiếm cần ít nhất 2 ký tự');
    const like = `%${likeEscape(term)}%`;
    const rows = await this.db.query<{ type: string; id: number; title: string; snippet: string | null; year: number | null }>(
      `(SELECT 'figure' AS type, id, name AS title, left(COALESCE(role_text, biography, ''), 140) AS snippet, birth_year AS year FROM hist_figures WHERE status = 'published' AND search_text LIKE $1 ORDER BY name LIMIT 8)
       UNION ALL (SELECT 'event', id, name, left(COALESCE(description, ''), 140), year_from FROM hist_events WHERE status = 'published' AND search_text LIKE $1 ORDER BY year_from LIMIT 8)
       UNION ALL (SELECT 'battle', id, name, left(COALESCE(result, context, ''), 140), year FROM hist_battles WHERE status = 'published' AND search_text LIKE $1 ORDER BY year LIMIT 8)
       UNION ALL (SELECT 'place', id, name, left(COALESCE(description, old_name, ''), 140), NULL FROM hist_places WHERE status = 'published' AND search_text LIKE $1 ORDER BY name LIMIT 8)
       UNION ALL (SELECT 'source', id, title, left(COALESCE(citation, ''), 140), NULL FROM hist_sources WHERE status = 'published' AND search_text LIKE $1 ORDER BY title LIMIT 8)
       UNION ALL (SELECT 'term', id, term, left(definition, 140), NULL FROM hist_terms WHERE status = 'published' AND search_text LIKE $1 ORDER BY term LIMIT 8)`, [like]);
    const locks = await this.locks(this.db.query.bind(this.db) as Q, user);
    if (this.isStudent(user)) await logEvent(this.db, user, 'search', null, null, undefined, { q: raw.slice(0, 80), results: rows.length });
    // Nội dung tư liệu còn khóa vẫn tìm thấy theo tên nhưng không lộ trích đoạn
    return rows.map((r) => (r.type === 'source' && locks.has(r.id) ? { ...r, snippet: null, locked: true } : r));
  }

  // ------------------------------------------------------------------ dòng thời gian và bản đồ
  async timeline(f: TimelineFilter) {
    const params: unknown[] = [];
    const cond = (alias: string, type: 'event' | 'battle', yearCol: string): string => {
      const parts = [`${alias}.status = 'published'`];
      if (f.campaign_id) { params.push(f.campaign_id); parts.push(`${alias}.campaign_id = $${params.length}`); }
      if (f.place_id) { params.push(f.place_id); parts.push(`${alias}.place_id = $${params.length}`); }
      if (f.figure_id) { params.push(f.figure_id); parts.push(`EXISTS (SELECT 1 FROM hist_links l WHERE l.a_type = '${type}' AND l.a_id = ${alias}.id AND l.b_type = 'figure' AND l.b_id = $${params.length})`); }
      if (f.year_from) { params.push(f.year_from); parts.push(`${alias}.${yearCol} >= $${params.length}`); }
      if (f.year_to) { params.push(f.year_to); parts.push(`${alias}.${yearCol} <= $${params.length}`); }
      return parts.join(' AND ');
    };
    const events = cond('e', 'event', 'year_from');
    const battles = cond('b', 'battle', 'year');
    return this.db.query(
      `SELECT * FROM (
         SELECT 'event' AS type, e.id, e.name, e.year_from AS year, e.year_to, e.date_text, e.campaign_id, c.title AS campaign_title, p.id AS place_id, p.name AS place_name, e.sort_order
         FROM hist_events e LEFT JOIN hist_campaigns c ON c.id = e.campaign_id LEFT JOIN hist_places p ON p.id = e.place_id WHERE ${events}
         UNION ALL
         SELECT 'battle', b.id, b.name, b.year, NULL, b.date_text, b.campaign_id, c.title, p.id, p.name, b.sort_order
         FROM hist_battles b LEFT JOIN hist_campaigns c ON c.id = b.campaign_id LEFT JOIN hist_places p ON p.id = b.place_id WHERE ${battles}
       ) x ORDER BY x.year, x.sort_order, x.type, x.id LIMIT 300`, params);
  }

  /** Địa danh có tọa độ kèm các sự kiện / trận đánh xảy ra tại đó (HK.HS.027) */
  async map(f: { campaign_id?: number }) {
    const places = await this.places(f);
    const withCoords = (places as Array<Record<string, any>>).filter((p) => p.lat !== null && p.lng !== null);
    const ids = withCoords.map((p) => p.id);
    const events = ids.length ? await this.db.query<Record<string, any>>("SELECT id, name, year_from AS year, place_id FROM hist_events WHERE status = 'published' AND place_id = ANY($1) ORDER BY year_from, sort_order", [ids]) : [];
    const battles = ids.length ? await this.db.query<Record<string, any>>("SELECT id, name, year, place_id FROM hist_battles WHERE status = 'published' AND place_id = ANY($1) ORDER BY year, sort_order", [ids]) : [];
    return withCoords.map((p) => ({
      ...p, lat: Number(p.lat), lng: Number(p.lng),
      items: [...events.filter((e) => e.place_id === p.id).map((e) => ({ type: 'event', id: e.id, name: e.name, year: e.year })), ...battles.filter((b) => b.place_id === p.id).map((b) => ({ type: 'battle', id: b.id, name: b.name, year: b.year }))],
    })).filter((p) => !f.campaign_id || p.items.length > 0);
  }

  // ------------------------------------------------------------------ tư liệu gốc
  async sources(user: UserRow, f: SourceFilter) {
    const params: unknown[] = [user.id];
    const where = ["t.status = 'published'"];
    const term = searchText(f.q ?? '');
    if (term) { params.push(`%${likeEscape(term)}%`); where.push(`t.search_text LIKE $${params.length}`); }
    if (f.kind) { params.push(f.kind); where.push(`t.kind = $${params.length}`); }
    if (f.campaign_id) { params.push(f.campaign_id); where.push(`EXISTS (SELECT 1 FROM hist_links l WHERE l.a_type = 'campaign' AND l.a_id = $${params.length} AND l.b_type = 'source' AND l.b_id = t.id)`); }
    if (f.figure_id) { params.push(f.figure_id); where.push(`EXISTS (SELECT 1 FROM hist_links l WHERE l.a_type = 'figure' AND l.a_id = $${params.length} AND l.b_type = 'source' AND l.b_id = t.id)`); }
    if (f.favorites === 'true') where.push('fv.source_id IS NOT NULL');
    const rows = await this.db.query<Record<string, any>>(
      `SELECT t.id, t.title, t.kind, t.citation, (fv.source_id IS NOT NULL) AS favorite FROM hist_sources t LEFT JOIN hk_favorites fv ON fv.source_id = t.id AND fv.user_id = $1
       WHERE ${where.join(' AND ')} ORDER BY t.title, t.id LIMIT 300`, params);
    const locks = await this.locks(this.db.query.bind(this.db) as Q, user);
    const out = rows.map((r) => ({ ...r, locked: locks.has(r.id), unlock_node: locks.get(r.id)?.node_title ?? null }));
    return f.unlocked === 'true' ? out.filter((r) => !r.locked) : f.unlocked === 'false' ? out.filter((r) => r.locked) : out;
  }

  async source(user: UserRow, id: number) {
    const result = await this.db.tx(async (q) => {
      const row = (await q<Record<string, any>>("SELECT * FROM hist_sources WHERE id = $1 AND status = 'published'", [id]))[0];
      if (!row) throw notFound('tư liệu');
      const lock = (await this.locks(q, user)).get(id);
      if (lock) {
        return { id: row.id, title: row.title, kind: row.kind, locked: true, unlock_node: lock.node_title, hint: `Hoàn thành nút "${lock.node_title}" trên bản đồ để mở khóa tư liệu này` };
      }
      const favorite = Boolean((await q('SELECT 1 FROM hk_favorites WHERE user_id = $1 AND source_id = $2', [user.id, id])).length);
      const note = (await q<{ body: string }>("SELECT body FROM hk_notes WHERE user_id = $1 AND ref_type = 'source' AND ref_id = $2", [user.id, id]))[0]?.body ?? null;
      return {
        id: row.id, title: row.title, kind: row.kind, original_text: row.original_text, transliteration: row.transliteration, translation: row.translation, annotation: row.annotation,
        citation: row.citation, attachment_url: row.attachment_url, locked: false, favorite, note,
        campaigns: await this.related(q, 'source', id, 'campaign', 't.id, t.title, t.year_label', 't.sort_order'),
        figures: await this.related(q, 'source', id, 'figure', 't.id, t.name, t.honorific, t.image_url', 't.name'),
        events: await this.related(q, 'source', id, 'event', 't.id, t.name, t.year_from', 't.year_from'),
        battles: await this.related(q, 'source', id, 'battle', 't.id, t.name, t.year', 't.year'),
        places: await this.related(q, 'source', id, 'place', 't.id, t.name', 't.name'),
      };
    });
    if (this.isStudent(user) && !(result as { locked: boolean }).locked) await logEvent(this.db, user, 'view_source', 'source', id);
    return result;
  }
}
