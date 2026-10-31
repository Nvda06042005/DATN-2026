/**
 * Kho dữ liệu lịch sử có cấu trúc (HK.AD.028–042, Mục tiêu 1 của đề cương): cuộc kháng chiến, nhân vật, sự kiện, địa điểm, trận đánh, tư liệu gốc, thuật ngữ.
 * Mọi loại dùng chung một mô tả (SPECS) để kiểm tra dữ liệu, tạo/sửa/xóa, liên kết, vòng đời Nháp → Đã kiểm chứng → Công bố,
 * lưu phiên bản, nhập/xuất. Quy tắc: sửa nội dung thì bản ghi quay về Nháp (cần kiểm chứng lại); chỉ Công bố mới được học sinh và AI dùng;
 * công bố phải sau khi cha (cuộc kháng chiến, địa điểm, sự kiện) đã công bố; không xóa bản ghi còn liên kết.
 */
import { BadRequestException, ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService, Q, searchText, UserRow } from '../database/database.service';
import { cellText, checkUpload, UploadedXlsx } from '../admin/excel';
import { likeEscape } from '../admin/school.service';

export type Entity = 'campaign' | 'figure' | 'event' | 'place' | 'battle' | 'source' | 'term';
export type Status = 'draft' | 'verified' | 'published';
export const ENTITIES: Entity[] = ['campaign', 'place', 'figure', 'source', 'term', 'event', 'battle'];
const STATUSES: Status[] = ['draft', 'verified', 'published'];
const STATUS_LABEL: Record<Status, string> = { draft: 'Nháp', verified: 'Đã kiểm chứng', published: 'Công bố' };

interface Field {
  name: string; label: string; type: 'text' | 'int' | 'num' | 'enum' | 'url' | 'ref' | 'key';
  required?: boolean; max?: number; min?: number; values?: string[]; ref?: Entity;
}
interface Spec { table: string; label: string; plural: string; main: string; search: string[]; order: string; fields: Field[]; links: Entity[] }

const text = (name: string, label: string, max: number, required = false, min = 2): Field => ({ name, label, type: 'text', max, required, min });
const int = (name: string, label: string, min: number, max: number, required = false): Field => ({ name, label, type: 'int', min, max, required });
const url = (name: string, label: string): Field => ({ name, label, type: 'url' });
const ref = (name: string, label: string, target: Entity): Field => ({ name, label, type: 'ref', ref: target });
const SORT = int('sort_order', 'Thứ tự', -100000, 100000);

export const SPECS: Record<Entity, Spec> = {
  campaign: {
    table: 'hist_campaigns', label: 'Cuộc kháng chiến', plural: 'Các cuộc kháng chiến', main: 'title', search: ['title', 'year_label'], order: 't.sort_order, t.start_year NULLS LAST, t.id', links: ['figure', 'source'],
    fields: [text('title', 'Tên', 160, true), text('year_label', 'Năm', 40, true, 1), int('start_year', 'Năm bắt đầu', 1000, 1500), int('end_year', 'Năm kết thúc', 1000, 1500), text('summary', 'Tóm tắt', 4000), url('image_url', 'Hình ảnh'), SORT],
  },
  place: {
    table: 'hist_places', label: 'Địa điểm', plural: 'Các địa điểm', main: 'name', search: ['name', 'old_name', 'province'], order: 't.name, t.id', links: ['source'],
    fields: [text('name', 'Tên hiện nay', 160, true), text('old_name', 'Tên gọi xưa', 160), text('province', 'Tỉnh / thành', 80), { name: 'lat', label: 'Vĩ độ', type: 'num', min: -90, max: 90 }, { name: 'lng', label: 'Kinh độ', type: 'num', min: -180, max: 180 }, text('description', 'Mô tả', 4000), url('image_url', 'Hình ảnh')],
  },
  figure: {
    table: 'hist_figures', label: 'Nhân vật', plural: 'Các nhân vật', main: 'name', search: ['name', 'honorific', 'role_text'], order: "CASE t.figure_group WHEN 'king' THEN 0 WHEN 'general' THEN 1 WHEN 'official' THEN 2 ELSE 3 END, t.birth_year NULLS LAST, t.name", links: ['campaign', 'event', 'battle', 'source'],
    fields: [text('name', 'Tên', 120, true), text('honorific', 'Tước hiệu', 200), { name: 'figure_group', label: 'Nhóm', type: 'enum', values: ['king', 'general', 'official', 'other'], required: true }, int('birth_year', 'Năm sinh', 0, 2100), int('death_year', 'Năm mất', 0, 2100), text('role_text', 'Vai trò', 400), text('biography', 'Tiểu sử', 6000), text('famous_quote', 'Câu nói nổi tiếng', 600), url('image_url', 'Hình ảnh'), text('source_note', 'Nguồn', 600)],
  },
  event: {
    table: 'hist_events', label: 'Sự kiện', plural: 'Các sự kiện', main: 'name', search: ['name', 'date_text'], order: 't.campaign_id NULLS LAST, t.sort_order, t.year_from, t.id', links: ['figure', 'source'],
    fields: [text('name', 'Tên', 200, true), int('year_from', 'Năm', 1000, 1500, true), int('year_to', 'Đến năm', 1000, 1500), text('date_text', 'Thời gian', 60), text('description', 'Mô tả', 6000), text('significance', 'Ý nghĩa', 3000), ref('campaign_id', 'Cuộc kháng chiến', 'campaign'), ref('place_id', 'Địa điểm', 'place'), SORT],
  },
  battle: {
    table: 'hist_battles', label: 'Trận đánh', plural: 'Các trận đánh', main: 'name', search: ['name', 'date_text'], order: 't.campaign_id NULLS LAST, t.sort_order, t.year, t.id', links: ['figure', 'source'],
    fields: [text('name', 'Tên', 160, true), int('year', 'Năm', 1000, 1500, true), text('date_text', 'Thời gian', 60), text('context', 'Bối cảnh', 4000), text('forces', 'Lực lượng', 3000), text('course', 'Diễn biến', 6000), text('result', 'Kết quả', 3000), ref('campaign_id', 'Cuộc kháng chiến', 'campaign'), ref('place_id', 'Địa điểm', 'place'), ref('event_id', 'Sự kiện', 'event'), { name: 'minigame_key', label: 'Mã mini-game', type: 'key' }, SORT],
  },
  source: {
    table: 'hist_sources', label: 'Tư liệu gốc', plural: 'Các tư liệu gốc', main: 'title', search: ['title', 'citation'], order: 't.title, t.id', links: ['campaign', 'event', 'battle', 'figure', 'place'],
    fields: [text('title', 'Tên', 200, true), { name: 'kind', label: 'Loại', type: 'enum', values: ['su_lieu', 'tho_van', 'hich', 'hinh_anh', 'ban_do_co'], required: true }, text('original_text', 'Nguyên văn', 12000), text('transliteration', 'Phiên âm', 12000), text('translation', 'Dịch nghĩa', 12000), text('annotation', 'Chú giải', 6000), text('citation', 'Nguồn trích dẫn', 600), url('attachment_url', 'Tệp đính kèm (liên kết https)')],
  },
  term: {
    table: 'hist_terms', label: 'Thuật ngữ', plural: 'Từ điển thuật ngữ', main: 'term', search: ['term'], order: 't.term, t.id', links: [],
    fields: [text('term', 'Thuật ngữ', 120, true), text('definition', 'Giải nghĩa', 3000, true)],
  },
};

/** Liên kết nhiều-nhiều được phép (chuẩn hóa a_type < b_type như ràng buộc CHECK của bảng hist_links) */
const linkKey = (a: Entity, b: Entity): { a: Entity; b: Entity; swap: boolean } => (a < b ? { a, b, swap: false } : { a: b, b: a, swap: true });
const VOLATILE = ['id', 'version_no', 'search_text', 'verified_by', 'verified_at', 'published_by', 'published_at', 'created_by', 'created_at', 'updated_by', 'updated_at'];

export const slugify = (value: string): string =>
  searchText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'muc';

export interface HistoryFilter { q?: string; status?: Status; campaign_id?: number; place_id?: number; figure_group?: string; kind?: string; page?: number; limit?: number }
type Links = Partial<Record<Entity, number[]>>;
type Row = Record<string, unknown> & { id: number; slug: string; status: Status; version_no: number };

@Injectable()
export class HistoryService {
  constructor(private readonly db: DatabaseService) {}

  specs() {
    return ENTITIES.map((e) => ({ entity: e, ...SPECS[e], statuses: STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })) }));
  }

  private spec(entity: string): Spec {
    const spec = SPECS[entity as Entity];
    if (!spec) throw new NotFoundException('Loại dữ liệu lịch sử không tồn tại');
    return spec;
  }

  // ------------------------------------------------------------------ kiểm tra dữ liệu
  /** Chuẩn hóa và kiểm tra các trường theo mô tả; `partial` = chỉ kiểm tra trường có trong body (sửa) */
  private async clean(q: Q, entity: Entity, body: Record<string, unknown>, partial: boolean): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const f of SPECS[entity].fields) {
      if (!(f.name in body)) {
        if (!partial && f.required) throw new UnprocessableEntityException(`Thiếu ${f.label.toLowerCase()}`);
        continue;
      }
      let v = body[f.name];
      if (typeof v === 'string') v = v.replace(/\r\n/g, '\n').trim();
      if (v === '' || v === undefined) v = null;
      if (v === null) {
        if (f.required) throw new UnprocessableEntityException(`${f.label} không được để trống`);
        out[f.name] = null;
        continue;
      }
      switch (f.type) {
        case 'text':
          if (typeof v !== 'string') throw new UnprocessableEntityException(`${f.label} phải là văn bản`);
          if (v.length > (f.max ?? 0)) throw new UnprocessableEntityException(`${f.label} tối đa ${f.max} ký tự`);
          if (f.required && v.length < (f.min ?? 2)) throw new UnprocessableEntityException(`${f.label} tối thiểu ${f.min ?? 2} ký tự`);
          break;
        case 'int': case 'ref': {
          const n = typeof v === 'number' ? v : Number(v);
          if (!Number.isInteger(n)) throw new UnprocessableEntityException(`${f.label} phải là số nguyên`);
          if (f.type === 'int' && (n < (f.min as number) || n > (f.max as number))) throw new UnprocessableEntityException(`${f.label} từ ${f.min} đến ${f.max}`);
          if (f.type === 'ref' && !(await q(`SELECT 1 FROM ${SPECS[f.ref as Entity].table} WHERE id = $1`, [n])).length) throw new UnprocessableEntityException(`${f.label} không tồn tại`);
          v = n;
          break;
        }
        case 'num': {
          const n = typeof v === 'number' ? v : Number(v);
          if (!Number.isFinite(n) || n < (f.min as number) || n > (f.max as number)) throw new UnprocessableEntityException(`${f.label} từ ${f.min} đến ${f.max}`);
          v = Math.round(n * 1e6) / 1e6;
          break;
        }
        case 'enum':
          if (!f.values?.includes(String(v))) throw new UnprocessableEntityException(`${f.label} phải là một trong: ${f.values?.join(', ')}`);
          break;
        case 'url':
          if (typeof v !== 'string' || !/^https:\/\/[^\s]+$/.test(v) || v.length > 500) throw new UnprocessableEntityException(`${f.label} phải là liên kết https`);
          break;
        case 'key':
          if (typeof v !== 'string' || !/^[a-z0-9_]{2,60}$/.test(v)) throw new UnprocessableEntityException(`${f.label} gồm chữ thường, số, gạch dưới (2–60 ký tự)`);
          break;
      }
      out[f.name] = v;
    }
    return out;
  }

  /** Quy tắc giữa các trường: năm bắt đầu/kết thúc, tọa độ đi cùng nhau, năm sinh – mất */
  private crossCheck(entity: Entity, v: Record<string, unknown>): void {
    const num = (k: string) => (v[k] === null || v[k] === undefined ? null : Number(v[k]));
    if (entity === 'campaign' && num('start_year') !== null && num('end_year') !== null && (num('end_year') as number) < (num('start_year') as number)) throw new UnprocessableEntityException('Năm kết thúc phải sau năm bắt đầu');
    if (entity === 'event' && num('year_to') !== null && (num('year_to') as number) < (num('year_from') as number)) throw new UnprocessableEntityException('Năm kết thúc phải từ năm bắt đầu trở đi');
    if (entity === 'figure' && num('birth_year') !== null && num('death_year') !== null && (num('death_year') as number) < (num('birth_year') as number)) throw new UnprocessableEntityException('Năm mất phải sau năm sinh');
    if (entity === 'place' && (num('lat') === null) !== (num('lng') === null)) throw new UnprocessableEntityException('Hãy nhập cả vĩ độ và kinh độ (hoặc để trống cả hai)');
  }

  private searchOf(entity: Entity, row: Record<string, unknown>): string {
    return searchText(...SPECS[entity].search.map((k) => (row[k] as string | null) ?? null));
  }

  // ------------------------------------------------------------------ liên kết
  private async linksOf(q: Q, entity: Entity, id: number): Promise<Links> {
    const rows = await q<{ type: Entity; id: number }>(
      `SELECT b_type AS type, b_id AS id FROM hist_links WHERE a_type = $1 AND a_id = $2 UNION ALL SELECT a_type, a_id FROM hist_links WHERE b_type = $1 AND b_id = $2 ORDER BY 1, 2`, [entity, id]);
    const out: Links = {};
    for (const r of rows) (out[r.type] ??= []).push(Number(r.id));
    return out;
  }

  private async setLinks(q: Q, entity: Entity, id: number, links: Links | undefined): Promise<void> {
    if (!links) return;
    for (const [type, ids] of Object.entries(links) as Array<[Entity, number[]]>) {
      if (!SPECS[entity].links.includes(type)) throw new UnprocessableEntityException(`${SPECS[entity].label} không liên kết trực tiếp với ${SPECS[type]?.label?.toLowerCase() ?? type}`);
      const wanted = [...new Set((ids ?? []).map(Number))];
      if (wanted.some((n) => !Number.isInteger(n))) throw new UnprocessableEntityException('Mã liên kết phải là số nguyên');
      if (wanted.length) {
        const found = await q<{ id: number }>(`SELECT id FROM ${SPECS[type].table} WHERE id = ANY($1)`, [wanted]);
        if (found.length !== wanted.length) throw new UnprocessableEntityException(`Có ${SPECS[type].label.toLowerCase()} liên kết không tồn tại`);
      }
      const k = linkKey(entity, type);
      if (!k.swap) {
        await q('DELETE FROM hist_links WHERE a_type = $1 AND a_id = $2 AND b_type = $3', [k.a, id, k.b]);
        for (const w of wanted) await q('INSERT INTO hist_links (a_type, a_id, b_type, b_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [k.a, id, k.b, w]);
      } else {
        await q('DELETE FROM hist_links WHERE a_type = $1 AND b_type = $2 AND b_id = $3', [k.a, k.b, id]);
        for (const w of wanted) await q('INSERT INTO hist_links (a_type, a_id, b_type, b_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [k.a, w, k.b, id]);
      }
    }
  }

  // ------------------------------------------------------------------ phiên bản
  /** Lưu phiên bản từ chính dòng trong CSDL (cùng định dạng với dữ liệu khởi tạo) */
  private async snapshot(q: Q, entity: Entity, id: number, action: 'create' | 'update' | 'status' | 'restore' | 'import' | 'reorder', actor: UserRow | null, note: string | null): Promise<number> {
    const spec = SPECS[entity];
    const next = (await q<{ version_no: number }>(`UPDATE ${spec.table} SET version_no = (SELECT COALESCE(max(version_no), 0) + 1 FROM hist_versions WHERE entity = $2 AND entity_id = $1) WHERE id = $1 RETURNING version_no`, [id, entity]))[0].version_no;
    const links = await this.linksOf(q, entity, id);
    await q(
      `INSERT INTO hist_versions (entity, entity_id, version_no, action, snapshot, links, note, changed_by)
       SELECT $2, t.id, $3, $4, to_jsonb(t) - $5::text[], $6::jsonb, $7, $8 FROM ${spec.table} t WHERE t.id = $1`,
      [id, entity, next, action, VOLATILE, JSON.stringify(links), note, actor?.id ?? null]);
    return next;
  }

  async versions(entity: string, id: number) {
    this.spec(entity);
    return this.db.query(
      `SELECT v.id, v.version_no, v.action, v.note, v.created_at, u.full_name AS changed_by, v.snapshot->>'status' AS status FROM hist_versions v LEFT JOIN app_users u ON u.id = v.changed_by
       WHERE v.entity = $1 AND v.entity_id = $2 ORDER BY v.version_no DESC`, [entity, id]);
  }

  async version(entity: string, id: number, no: number) {
    this.spec(entity);
    const row = (await this.db.query('SELECT version_no, action, note, created_at, snapshot, links FROM hist_versions WHERE entity = $1 AND entity_id = $2 AND version_no = $3', [entity, id, no]))[0];
    if (!row) throw new NotFoundException('Không tìm thấy phiên bản');
    return row;
  }

  /** So sánh hai phiên bản: danh sách trường thay đổi (cũ → mới), kể cả liên kết */
  async diff(entity: string, id: number, from: number, to: number) {
    const spec = this.spec(entity);
    const a = (await this.version(entity, id, from)) as { snapshot: Record<string, unknown>; links: Links };
    const b = (await this.version(entity, id, to)) as { snapshot: Record<string, unknown>; links: Links };
    const norm = (v: unknown) => (v === undefined || v === null ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));
    const changes: Array<{ field: string; label: string; from: unknown; to: unknown }> = [];
    for (const f of [...spec.fields, { name: 'status', label: 'Trạng thái' }] as Array<{ name: string; label: string }>) {
      if (norm(a.snapshot[f.name]) !== norm(b.snapshot[f.name])) changes.push({ field: f.name, label: f.label, from: a.snapshot[f.name] ?? null, to: b.snapshot[f.name] ?? null });
    }
    for (const type of spec.links) {
      const x = JSON.stringify(a.links?.[type] ?? []), y = JSON.stringify(b.links?.[type] ?? []);
      if (x !== y) changes.push({ field: `links.${type}`, label: `Liên kết: ${SPECS[type].plural.toLowerCase()}`, from: a.links?.[type] ?? [], to: b.links?.[type] ?? [] });
    }
    return { from, to, changes };
  }

  // ------------------------------------------------------------------ đọc
  private async decorate(q: Q, entity: Entity, row: Row, withLinks: boolean) {
    const spec = SPECS[entity];
    const labels: Record<string, string | null> = {};
    for (const f of spec.fields.filter((x) => x.type === 'ref')) {
      const id = row[f.name];
      labels[f.name] = id ? ((await q<{ label: string }>(`SELECT ${SPECS[f.ref as Entity].main} AS label FROM ${SPECS[f.ref as Entity].table} WHERE id = $1`, [id]))[0]?.label ?? null) : null;
    }
    const base: Record<string, unknown> = { ...row, ref_labels: labels, status_label: STATUS_LABEL[row.status] };
    delete base.search_text;
    if (!withLinks) return base;
    const links = await this.linksOf(q, entity, row.id);
    const detail: Record<string, Array<{ id: number; slug: string; label: string; status: Status }>> = {};
    for (const [type, ids] of Object.entries(links) as Array<[Entity, number[]]>) {
      detail[type] = await q(`SELECT id, slug, ${SPECS[type].main} AS label, status FROM ${SPECS[type].table} WHERE id = ANY($1) ORDER BY ${SPECS[type].main}`, [ids]);
    }
    return { ...base, links, link_items: detail };
  }

  async list(entity: string, f: HistoryFilter) {
    const spec = this.spec(entity);
    const where: string[] = [], params: unknown[] = [];
    const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
    if (f.status) add('t.status = ?', f.status);
    if (f.campaign_id) {
      if (entity === 'event' || entity === 'battle') add('t.campaign_id = ?', f.campaign_id);
      else if (entity === 'figure' || entity === 'source') add("EXISTS (SELECT 1 FROM hist_links l WHERE l.a_type = 'campaign' AND l.a_id = ? AND l.b_type = '" + entity + "' AND l.b_id = t.id)", f.campaign_id);
    }
    if (f.place_id && (entity === 'event' || entity === 'battle')) add('t.place_id = ?', f.place_id);
    if (f.figure_group && entity === 'figure') add('t.figure_group = ?', f.figure_group);
    if (f.kind && entity === 'source') add('t.kind = ?', f.kind);
    const text = searchText(f.q);
    if (text) add("t.search_text LIKE ? ESCAPE '\\'", `%${likeEscape(text)}%`);
    const condition = where.length ? where.join(' AND ') : 'TRUE';
    const page = Math.max(1, f.page ?? 1), limit = Math.min(200, Math.max(1, f.limit ?? 100));
    const total = Number((await this.db.query<{ n: string }>(`SELECT count(*) AS n FROM ${spec.table} t WHERE ${condition}`, params))[0].n);
    const rows = await this.db.query<Row>(`SELECT t.* FROM ${spec.table} t WHERE ${condition} ORDER BY ${spec.order} LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params);
    const counts = (await this.db.query<{ status: Status; n: number }>(`SELECT status, count(*)::int AS n FROM ${spec.table} GROUP BY status`));
    const items = await this.db.tx(async (q) => {
      const out: Array<Record<string, unknown>> = [];
      for (const r of rows) out.push(await this.decorate(q, entity as Entity, r, false)); // tuần tự: một kết nối không chạy hai truy vấn cùng lúc
      return out;
    });
    return { entity, total, page, limit, items, status_counts: Object.fromEntries(STATUSES.map((s) => [s, counts.find((c) => c.status === s)?.n ?? 0])) };
  }

  async get(entity: string, id: number) {
    const spec = this.spec(entity);
    return this.db.tx(async (q) => {
      const row = (await q<Row>(`SELECT * FROM ${spec.table} WHERE id = $1`, [id]))[0];
      if (!row) throw new NotFoundException(`Không tìm thấy ${spec.label.toLowerCase()}`);
      return this.decorate(q, entity as Entity, row, true);
    });
  }

  /** Số liệu tổng quan kho: số bản ghi từng loại theo trạng thái (cho trang quản trị) */
  async overview() {
    const out: Record<string, { total: number; draft: number; verified: number; published: number }> = {};
    for (const e of ENTITIES) {
      const rows = await this.db.query<{ status: Status; n: number }>(`SELECT status, count(*)::int AS n FROM ${SPECS[e].table} GROUP BY status`);
      const count = (s: Status) => rows.find((r) => r.status === s)?.n ?? 0;
      out[e] = { total: rows.reduce((a, r) => a + r.n, 0), draft: count('draft'), verified: count('verified'), published: count('published') };
    }
    return out;
  }

  // ------------------------------------------------------------------ ghi
  private async uniqueSlug(q: Q, table: string, base: string, exceptId: number | null = null): Promise<string> {
    let slug = base;
    for (let n = 2; (await q(`SELECT 1 FROM ${table} WHERE slug = $1 AND ($2::integer IS NULL OR id <> $2)`, [slug, exceptId])).length; n += 1) slug = `${base.slice(0, 66)}-${n}`;
    return slug;
  }

  private dbError(exc: unknown): never {
    const code = (exc as { code?: string })?.code;
    if (code === '23514') throw new UnprocessableEntityException('Dữ liệu không hợp lệ (vi phạm ràng buộc, ví dụ độ dài hoặc khoảng giá trị)');
    if (code === '23505') throw new ConflictException('Dữ liệu bị trùng (mã định danh đã có)');
    if (code === '23503') throw new ConflictException('Bản ghi đang được liên kết nên không thực hiện được');
    throw exc;
  }

  async create(actor: UserRow, entity: string, body: Record<string, unknown> & { slug?: string; links?: Links }) {
    const spec = this.spec(entity);
    const e = entity as Entity;
    try {
      return await this.db.tx(async (q) => {
        const values = await this.clean(q, e, body, false);
        this.crossCheck(e, values);
        const slugSource = typeof body.slug === 'string' && body.slug.trim() ? body.slug : String(values[spec.main]);
        const slug = await this.uniqueSlug(q, spec.table, slugify(slugSource));
        if (typeof body.slug === 'string' && body.slug.trim() && slugify(body.slug) !== slug) throw new ConflictException(`Mã định danh ${slug} đã có`);
        const names = Object.keys(values);
        const row = (await q<Row>(
          `INSERT INTO ${spec.table} (slug, ${names.join(', ')}, search_text, created_by, updated_by) VALUES ($1, ${names.map((_, i) => `$${i + 2}`).join(', ')}, $${names.length + 2}, $${names.length + 3}, $${names.length + 3}) RETURNING *`,
          [slug, ...names.map((n) => values[n]), this.searchOf(e, values), actor.id]))[0];
        await this.setLinks(q, e, row.id, body.links);
        await this.snapshot(q, e, row.id, 'create', actor, null);
        return this.decorate(q, e, (await q<Row>(`SELECT * FROM ${spec.table} WHERE id = $1`, [row.id]))[0], true);
      });
    } catch (exc) { return this.dbError(exc); }
  }

  async update(actor: UserRow, entity: string, id: number, body: Record<string, unknown> & { links?: Links; note?: string }) {
    const spec = this.spec(entity);
    const e = entity as Entity;
    try {
      return await this.db.tx(async (q) => {
        const old = (await q<Row>(`SELECT * FROM ${spec.table} WHERE id = $1 FOR UPDATE`, [id]))[0];
        if (!old) throw new NotFoundException(`Không tìm thấy ${spec.label.toLowerCase()}`);
        const values = await this.clean(q, e, body, true);
        this.crossCheck(e, { ...old, ...values });
        const oldLinks = JSON.stringify(await this.linksOf(q, e, id));
        const same = (a: unknown, b: unknown) => (a === null || a === undefined || a === '' ? b === null || b === undefined || b === '' : b !== null && b !== undefined && (typeof b === 'number' ? Number(a) === b : String(a) === String(b)));
        const changed = Object.entries(values).filter(([k, v]) => !same(old[k], v)).map(([k]) => k);
        await this.setLinks(q, e, id, body.links);
        const linksChanged = JSON.stringify(await this.linksOf(q, e, id)) !== oldLinks;
        if (!changed.length && !linksChanged) return { ...(await this.decorate(q, e, old, true)), status_reset: false, unchanged: true };
        const merged = { ...old, ...values };
        const names = Object.keys(values);
        // Nội dung đã đổi thì cần kiểm chứng lại: bản ghi đã kiểm chứng/công bố quay về Nháp (và bị ẩn khỏi học sinh/AI)
        const reset = old.status !== 'draft';
        if (reset) await this.assertNoPublishedChildren(q, e, id);
        const sets = [...names.map((n, i) => `${n} = $${i + 2}`), `search_text = $${names.length + 2}`, `updated_by = $${names.length + 3}`, 'updated_at = now()'];
        if (reset) sets.push("status = 'draft'", 'verified_by = NULL', 'verified_at = NULL', 'published_by = NULL', 'published_at = NULL');
        await q(`UPDATE ${spec.table} SET ${sets.join(', ')} WHERE id = $1`, [id, ...names.map((n) => values[n]), this.searchOf(e, merged), actor.id]);
        await this.snapshot(q, e, id, 'update', actor, typeof body.note === 'string' ? body.note.slice(0, 300) : null);
        return { ...(await this.decorate(q, e, (await q<Row>(`SELECT * FROM ${spec.table} WHERE id = $1`, [id]))[0], true)), status_reset: reset, unchanged: false };
      });
    } catch (exc) { return this.dbError(exc); }
  }

  /** Bản ghi còn liên kết hoặc còn được bản ghi khác tham chiếu thì không xóa (HK.AD.033) */
  private async blockers(q: Q, entity: Entity, id: number): Promise<string[]> {
    const out: string[] = [];
    const links = await this.linksOf(q, entity, id);
    for (const [type, ids] of Object.entries(links) as Array<[Entity, number[]]>) out.push(`${ids.length} ${SPECS[type].label.toLowerCase()} liên kết`);
    for (const other of ENTITIES) {
      for (const f of SPECS[other].fields.filter((x) => x.type === 'ref' && x.ref === entity)) {
        const n = (await q<{ n: number }>(`SELECT count(*)::int AS n FROM ${SPECS[other].table} WHERE ${f.name} = $1`, [id]))[0].n;
        if (n) out.push(`${n} ${SPECS[other].label.toLowerCase()} thuộc về nó`);
      }
    }
    return out;
  }

  async remove(entity: string, id: number): Promise<void> {
    const spec = this.spec(entity);
    const e = entity as Entity;
    await this.db.tx(async (q) => {
      const row = (await q<Row>(`SELECT * FROM ${spec.table} WHERE id = $1 FOR UPDATE`, [id]))[0];
      if (!row) throw new NotFoundException(`Không tìm thấy ${spec.label.toLowerCase()}`);
      const blockers = await this.blockers(q, e, id);
      if (blockers.length) throw new ConflictException(`Không xóa được vì còn ${blockers.join(', ')}. Hãy gỡ liên kết trước.`);
      if (row.status === 'published') throw new ConflictException('Bản ghi đang được công bố; hãy chuyển về Nháp trước khi xóa.');
      await q(`DELETE FROM ${spec.table} WHERE id = $1`, [id]);
    });
  }

  // ------------------------------------------------------------------ kiểm chứng và công bố (HK.AD.040)
  private async assertPublishable(q: Q, entity: Entity, row: Row): Promise<void> {
    const missing: string[] = [];
    for (const f of SPECS[entity].fields.filter((x) => x.type === 'ref')) {
      const parent = row[f.name];
      if (!parent) continue;
      const p = (await q<{ status: Status; label: string }>(`SELECT status, ${SPECS[f.ref as Entity].main} AS label FROM ${SPECS[f.ref as Entity].table} WHERE id = $1`, [parent]))[0];
      if (p && p.status !== 'published') missing.push(`${SPECS[f.ref as Entity].label.toLowerCase()} "${p.label}"`);
    }
    if (missing.length) throw new ConflictException(`Hãy công bố ${missing.join(', ')} trước.`);
  }

  private async assertNoPublishedChildren(q: Q, entity: Entity, id: number): Promise<void> {
    const kids: string[] = [];
    for (const other of ENTITIES) {
      for (const f of SPECS[other].fields.filter((x) => x.type === 'ref' && x.ref === entity)) {
        const n = (await q<{ n: number }>(`SELECT count(*)::int AS n FROM ${SPECS[other].table} WHERE ${f.name} = $1 AND status = 'published'`, [id]))[0].n;
        if (n) kids.push(`${n} ${SPECS[other].label.toLowerCase()}`);
      }
    }
    if (kids.length) throw new ConflictException(`Còn ${kids.join(', ')} đang công bố thuộc về bản ghi này. Hãy chuyển chúng về Nháp trước.`);
  }

  async setStatus(actor: UserRow, entity: string, id: number, status: Status, note?: string | null) {
    const spec = this.spec(entity);
    const e = entity as Entity;
    if (!STATUSES.includes(status)) throw new UnprocessableEntityException('Trạng thái phải là draft, verified hoặc published');
    return this.db.tx(async (q) => {
      const row = (await q<Row>(`SELECT * FROM ${spec.table} WHERE id = $1 FOR UPDATE`, [id]))[0];
      if (!row) throw new NotFoundException(`Không tìm thấy ${spec.label.toLowerCase()}`);
      if (row.status === status) return this.decorate(q, e, row, true);
      if (STATUSES.indexOf(status) - STATUSES.indexOf(row.status) > 1) throw new ConflictException('Phải kiểm chứng nội dung trước khi công bố');
      if (status === 'published') await this.assertPublishable(q, e, row);
      if (row.status === 'published') await this.assertNoPublishedChildren(q, e, id);
      const lowered = STATUSES.indexOf(status) < STATUSES.indexOf(row.status);
      await q(
        `UPDATE ${spec.table} SET status = $2, updated_by = $3, updated_at = now(),
           verified_by = CASE WHEN $2 = 'draft' THEN NULL WHEN $2 = 'verified' AND NOT $4 THEN $3::integer ELSE verified_by END,
           verified_at = CASE WHEN $2 = 'draft' THEN NULL WHEN $2 = 'verified' AND NOT $4 THEN now() ELSE verified_at END,
           published_by = CASE WHEN $2 = 'published' THEN $3::integer ELSE NULL END, published_at = CASE WHEN $2 = 'published' THEN now() ELSE NULL END
         WHERE id = $1`, [id, status, actor.id, lowered]);
      await this.snapshot(q, e, id, 'status', actor, note?.slice(0, 300) ?? `${STATUS_LABEL[row.status]} → ${STATUS_LABEL[status]}`);
      return this.decorate(q, e, (await q<Row>(`SELECT * FROM ${spec.table} WHERE id = $1`, [id]))[0], true);
    });
  }

  /** Khôi phục một phiên bản cũ thành bản hiện tại; nội dung quay về Nháp để kiểm chứng lại */
  async restore(actor: UserRow, entity: string, id: number, versionNo: number) {
    const spec = this.spec(entity);
    const e = entity as Entity;
    const v = (await this.version(entity, id, versionNo)) as { snapshot: Record<string, unknown>; links: Links };
    try {
      return await this.db.tx(async (q) => {
        const row = (await q<Row>(`SELECT * FROM ${spec.table} WHERE id = $1 FOR UPDATE`, [id]))[0];
        if (!row) throw new NotFoundException(`Không tìm thấy ${spec.label.toLowerCase()}`);
        if (row.status !== 'draft') await this.assertNoPublishedChildren(q, e, id);
        const values: Record<string, unknown> = {};
        for (const f of spec.fields) {
          let val = v.snapshot[f.name] ?? null;
          if (f.type === 'ref' && val !== null && !(await q(`SELECT 1 FROM ${SPECS[f.ref as Entity].table} WHERE id = $1`, [val])).length) val = null;
          values[f.name] = val;
        }
        const names = Object.keys(values);
        await q(
          `UPDATE ${spec.table} SET ${names.map((n, i) => `${n} = $${i + 2}`).join(', ')}, search_text = $${names.length + 2}, updated_by = $${names.length + 3}, updated_at = now(),
             status = 'draft', verified_by = NULL, verified_at = NULL, published_by = NULL, published_at = NULL WHERE id = $1`,
          [id, ...names.map((n) => values[n]), this.searchOf(e, values), actor.id]);
        const links: Links = {};
        for (const type of spec.links) {
          const ids = (v.links?.[type] ?? []).map(Number);
          links[type] = ids.length ? (await q<{ id: number }>(`SELECT id FROM ${SPECS[type].table} WHERE id = ANY($1)`, [ids])).map((r) => Number(r.id)) : [];
        }
        await this.setLinks(q, e, id, links);
        await this.snapshot(q, e, id, 'restore', actor, `Khôi phục phiên bản ${versionNo}`);
        return this.decorate(q, e, (await q<Row>(`SELECT * FROM ${spec.table} WHERE id = $1`, [id]))[0], true);
      });
    } catch (exc) { return this.dbError(exc); }
  }

  // ------------------------------------------------------------------ dòng thời gian (HK.AD.037)
  async timeline(campaignId?: number) {
    const campaigns = await this.db.query<{ id: number; title: string; year_label: string; status: Status }>(
      `SELECT id, title, year_label, status FROM hist_campaigns WHERE ($1::integer IS NULL OR id = $1) ORDER BY sort_order, start_year NULLS LAST, id`, [campaignId ?? null]);
    if (campaignId && !campaigns.length) throw new NotFoundException('Không tìm thấy cuộc kháng chiến');
    const events = await this.db.query<{ id: number; slug: string; campaign_id: number | null; name: string; year_from: number; date_text: string | null; sort_order: number; status: Status; place_name: string | null; battles: number }>(
      `SELECT e.id, e.slug, e.campaign_id, e.name, e.year_from, e.date_text, e.sort_order, e.status, p.name AS place_name,
              (SELECT count(*)::int FROM hist_battles b WHERE b.event_id = e.id) AS battles
       FROM hist_events e LEFT JOIN hist_places p ON p.id = e.place_id
       WHERE ($1::integer IS NULL OR e.campaign_id = $1) ORDER BY e.sort_order, e.year_from, e.id`, [campaignId ?? null]);
    return {
      campaigns: campaigns.map((c) => ({ ...c, events: events.filter((e) => e.campaign_id === c.id) })),
      unassigned: campaignId ? [] : events.filter((e) => e.campaign_id === null),
    };
  }

  /** Kéo thả sắp xếp mốc thời gian: danh sách id sự kiện của một cuộc kháng chiến theo thứ tự mới */
  async reorderTimeline(actor: UserRow, campaignId: number, eventIds: number[]) {
    const unique = [...new Set(eventIds)];
    if (unique.length !== eventIds.length) throw new UnprocessableEntityException('Danh sách có sự kiện trùng');
    await this.db.tx(async (q) => {
      if (!(await q('SELECT 1 FROM hist_campaigns WHERE id = $1', [campaignId])).length) throw new NotFoundException('Không tìm thấy cuộc kháng chiến');
      const current = await q<{ id: number; sort_order: number }>('SELECT id, sort_order FROM hist_events WHERE campaign_id = $1 FOR UPDATE', [campaignId]);
      if (current.length !== unique.length || current.some((e) => !unique.includes(e.id))) throw new UnprocessableEntityException('Danh sách phải gồm đúng các sự kiện của cuộc kháng chiến này');
      for (const [index, id] of unique.entries()) {
        if (current.find((e) => e.id === id)?.sort_order === index + 1) continue;
        await q('UPDATE hist_events SET sort_order = $2, updated_by = $3, updated_at = now() WHERE id = $1', [id, index + 1, actor.id]);
        await this.snapshot(q, 'event', id, 'reorder', actor, `Thứ tự trên dòng thời gian: ${index + 1}`);
      }
    });
    return this.timeline(campaignId);
  }

  // ------------------------------------------------------------------ nhập / xuất (HK.AD.041)
  private async exportDoc(): Promise<Record<string, Array<Record<string, unknown>>>> {
    return this.db.tx(async (q) => {
      const slugOf = async (entity: Entity, id: unknown) => (id ? ((await q<{ slug: string }>(`SELECT slug FROM ${SPECS[entity].table} WHERE id = $1`, [id]))[0]?.slug ?? null) : null);
      const doc: Record<string, Array<Record<string, unknown>>> = {};
      for (const e of ENTITIES) {
        const rows = await q<Row>(`SELECT t.* FROM ${SPECS[e].table} t ORDER BY ${SPECS[e].order}`);
        doc[e] = [];
        for (const r of rows) {
          const item: Record<string, unknown> = { slug: r.slug, status: r.status };
          for (const f of SPECS[e].fields) item[f.type === 'ref' ? (f.ref as string) : f.name] = f.type === 'ref' ? await slugOf(f.ref as Entity, r[f.name]) : (r[f.name] ?? null);
          const links = await this.linksOf(q, e, r.id);
          for (const type of SPECS[e].links) {
            const ids = links[type] ?? [];
            item[`links_${type}`] = ids.length ? (await q<{ slug: string }>(`SELECT slug FROM ${SPECS[type].table} WHERE id = ANY($1) ORDER BY slug`, [ids])).map((x) => x.slug) : [];
          }
          doc[e].push(item);
        }
      }
      return doc;
    });
  }

  async exportJson() {
    return { format: 'hao-khi-dong-a-history', version: 1, exported_at: new Date().toISOString(), data: await this.exportDoc() };
  }

  async exportXlsx(): Promise<Buffer> {
    const doc = await this.exportDoc();
    const Excel = await import('exceljs');
    const workbook = new Excel.Workbook();
    workbook.creator = 'Hào Khí Đông A';
    for (const e of ENTITIES) {
      const sheet = workbook.addWorksheet(SPECS[e].label.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
      const keys = ['slug', 'status', ...SPECS[e].fields.map((f) => (f.type === 'ref' ? (f.ref as string) : f.name)), ...SPECS[e].links.map((t) => `links_${t}`)];
      sheet.addRow(keys);
      sheet.getRow(1).font = { bold: true };
      for (const item of doc[e]) sheet.addRow(keys.map((k) => { const v = item[k]; return Array.isArray(v) ? v.join(', ') : (v ?? ''); }));
      sheet.columns.forEach((c) => { c.width = 24; });
    }
    const guide = workbook.addWorksheet('Hướng dẫn');
    guide.getColumn(1).width = 110;
    for (const line of [
      'Mỗi sheet là một loại dữ liệu; dòng 1 là tên cột (không đổi). Cột slug là mã định danh để cập nhật bản ghi đã có; bản ghi mới cần slug chưa dùng.',
      'Cột tham chiếu (campaign, place, event) ghi slug của bản ghi cha. Cột links_* ghi nhiều slug cách nhau bằng dấu phẩy.',
      'Mọi bản ghi nhập vào đều ở trạng thái Nháp và phải kiểm chứng, công bố lại; cột status chỉ để tham khảo khi xuất.',
      'Thứ tự nhập: cuộc kháng chiến, địa điểm, nhân vật, tư liệu, thuật ngữ, sự kiện, trận đánh.',
    ]) guide.addRow([line]);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /** Đọc file nhập (.json hoặc .xlsx) về cùng một cấu trúc */
  private async parseImport(file: UploadedXlsx | undefined): Promise<Record<string, Array<Record<string, unknown>>>> {
    if (!file) throw new BadRequestException('Hãy chọn file .json hoặc .xlsx');
    if (/\.json$/i.test(file.originalname)) {
      if (file.size > 2 * 1024 * 1024) throw new BadRequestException('File quá lớn (tối đa 2 MB)');
      try {
        const parsed = JSON.parse(file.buffer.toString('utf8')) as { format?: string; data?: Record<string, Array<Record<string, unknown>>> };
        if (parsed.format !== 'hao-khi-dong-a-history' || !parsed.data || typeof parsed.data !== 'object') throw new Error();
        return parsed.data;
      } catch {
        throw new BadRequestException('File JSON không đúng mẫu (hãy dùng file xuất từ hệ thống)');
      }
    }
    const upload = checkUpload(file);
    const Excel = await import('exceljs');
    const workbook = new Excel.Workbook();
    await workbook.xlsx.load(upload.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]).catch(() => { throw new BadRequestException('Không đọc được file Excel'); });
    const doc: Record<string, Array<Record<string, unknown>>> = {};
    for (const e of ENTITIES) {
      const sheet = workbook.getWorksheet(SPECS[e].label.slice(0, 31));
      if (!sheet) continue;
      if (sheet.rowCount - 1 > 1000) throw new BadRequestException(`Sheet ${SPECS[e].label} có quá 1000 dòng; hãy chia nhỏ`);
      const headers = new Map<number, string>();
      sheet.getRow(1).eachCell((cell, col) => { headers.set(col, cellText(cell.value)); });
      if (![...headers.values()].includes('slug')) throw new BadRequestException(`Sheet ${SPECS[e].label} thiếu cột slug`);
      doc[e] = [];
      for (let r = 2; r <= sheet.rowCount; r += 1) {
        const item: Record<string, unknown> = {};
        let any = false;
        for (const [col, key] of headers) {
          const value = cellText(sheet.getRow(r).getCell(col).value);
          item[key] = value;
          if (value) any = true;
        }
        if (!any) continue;
        for (const type of SPECS[e].links) item[`links_${type}`] = String(item[`links_${type}`] ?? '').split(',').map((x) => x.trim()).filter(Boolean);
        doc[e].push(item);
      }
    }
    return doc;
  }

  /**
   * Nhập hàng loạt: `commit=false` chỉ kiểm tra và báo từng bản ghi sẽ tạo/cập nhật hoặc lỗi; `commit=true` lưu các bản ghi hợp lệ theo thứ tự phụ thuộc.
   * Bản ghi nhập vào luôn ở trạng thái Nháp. Tham chiếu và liên kết dùng slug.
   */
  async importDoc(actor: UserRow, file: UploadedXlsx | undefined, commit: boolean) {
    const doc = await this.parseImport(file);
    const report: Array<{ entity: Entity; slug: string; action: 'create' | 'update' | 'error'; message?: string }> = [];
    await this.db.tx(async (q) => {
      const pendingLinks: Array<{ entity: Entity; slug: string; item: Record<string, unknown> }> = [];
      for (const e of ENTITIES) {
        const spec = SPECS[e];
        for (const item of doc[e] ?? []) {
          const slug = slugify(String(item.slug ?? ''));
          try {
            if (!item.slug) throw new UnprocessableEntityException('Thiếu slug');
            const body: Record<string, unknown> = {};
            for (const f of spec.fields) {
              if (f.type === 'ref') {
                const parent = item[f.ref as string];
                body[f.name] = parent ? ((await q<{ id: number }>(`SELECT id FROM ${SPECS[f.ref as Entity].table} WHERE slug = $1`, [slugify(String(parent))]))[0]?.id ?? (() => { throw new UnprocessableEntityException(`Không có ${SPECS[f.ref as Entity].label.toLowerCase()} với slug ${parent}`); })()) : null;
              } else if (f.name in item) body[f.name] = item[f.name];
            }
            const values = await this.clean(q, e, body, false);
            this.crossCheck(e, values);
            const existing = (await q<Row>(`SELECT * FROM ${spec.table} WHERE slug = $1 FOR UPDATE`, [slug]))[0];
            if (existing && existing.status === 'published') await this.assertNoPublishedChildren(q, e, existing.id);
            if (commit) {
              const names = Object.keys(values);
              let id: number;
              if (existing) {
                await q(`UPDATE ${spec.table} SET ${names.map((n, i) => `${n} = $${i + 2}`).join(', ')}, search_text = $${names.length + 2}, updated_by = $${names.length + 3}, updated_at = now(),
                  status = 'draft', verified_by = NULL, verified_at = NULL, published_by = NULL, published_at = NULL WHERE id = $1`, [existing.id, ...names.map((n) => values[n]), this.searchOf(e, values), actor.id]);
                id = existing.id;
              } else {
                id = (await q<{ id: number }>(`INSERT INTO ${spec.table} (slug, ${names.join(', ')}, search_text, created_by, updated_by) VALUES ($1, ${names.map((_, i) => `$${i + 2}`).join(', ')}, $${names.length + 2}, $${names.length + 3}, $${names.length + 3}) RETURNING id`,
                  [slug, ...names.map((n) => values[n]), this.searchOf(e, values), actor.id]))[0].id;
              }
              await this.snapshot(q, e, id, 'import', actor, 'Nhập từ file');
              pendingLinks.push({ entity: e, slug, item });
            }
            report.push({ entity: e, slug, action: existing ? 'update' : 'create' });
          } catch (exc) {
            if (commit && (exc as { code?: string }).code) throw exc;
            report.push({ entity: e, slug, action: 'error', message: exc instanceof Error ? exc.message : 'Lỗi không xác định' });
          }
        }
      }
      // Liên kết sau cùng, khi mọi bản ghi đã có id
      for (const { entity, slug, item } of pendingLinks) {
        const id = (await q<{ id: number }>(`SELECT id FROM ${SPECS[entity].table} WHERE slug = $1`, [slug]))[0].id;
        const links: Links = {};
        for (const type of SPECS[entity].links) {
          if (!(`links_${type}` in item)) continue;
          const slugs = (item[`links_${type}`] as string[]).map((s) => slugify(String(s)));
          const found = slugs.length ? await q<{ id: number; slug: string }>(`SELECT id, slug FROM ${SPECS[type].table} WHERE slug = ANY($1)`, [slugs]) : [];
          const lost = slugs.filter((s) => !found.some((f) => f.slug === s));
          if (lost.length) report.push({ entity, slug, action: 'error', message: `Liên kết ${SPECS[type].label.toLowerCase()} không tồn tại: ${lost.join(', ')}` });
          links[type] = found.map((f) => Number(f.id));
        }
        await this.setLinks(q, entity, id, links);
      }
    }).catch((exc) => this.dbError(exc));
    const errors = report.filter((r) => r.action === 'error').length;
    return { committed: commit, total: report.length, created: report.filter((r) => r.action === 'create').length, updated: report.filter((r) => r.action === 'update').length, errors, report };
  }

  /** File Excel mẫu rỗng (chỉ tiêu đề) để nhập hàng loạt */
  async templateXlsx(): Promise<Buffer> {
    const Excel = await import('exceljs');
    const workbook = new Excel.Workbook();
    for (const e of ENTITIES) {
      const sheet = workbook.addWorksheet(SPECS[e].label.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
      sheet.addRow(['slug', 'status', ...SPECS[e].fields.map((f) => (f.type === 'ref' ? (f.ref as string) : f.name)), ...SPECS[e].links.map((t) => `links_${t}`)]);
      sheet.getRow(1).font = { bold: true };
      sheet.columns.forEach((c) => { c.width = 24; });
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}

