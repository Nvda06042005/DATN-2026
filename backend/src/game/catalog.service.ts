/**
 * Danh mục trò chơi hóa do quản trị quản lý (HK.AD.048–053, HK.QT.046): cấp độ, lớp nhân vật và kỹ năng, huy hiệu, thẻ nhân vật, vật phẩm cửa hàng, mẫu nhiệm vụ.
 * Mọi loại dùng chung một mô tả (SPECS) để kiểm tra dữ liệu, tạo/sửa/xóa và để giao diện tự dựng biểu mẫu. Quản trị viên trường chỉ quản lý huy hiệu của trường mình.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { notFound } from '../content/access';
import { DatabaseService, Q, UserRow } from '../database/database.service';

export const GAME_ICONS = ['swords', 'scroll', 'heart', 'shield', 'shirt', 'flag', 'award', 'star', 'crown', 'gem', 'sparkles', 'flame', 'snowflake', 'lightbulb', 'coins', 'target', 'book', 'trophy'] as const;
export const BADGE_RULES = [
  ['campaign_complete', 'Hoàn thành một cuộc kháng chiến'], ['streak_days', 'Chuỗi ngày học liên tiếp'], ['correct_answers', 'Số câu trả lời đúng'], ['nodes_completed', 'Số nút đã hoàn thành'],
  ['level', 'Đạt cấp độ'], ['cards_collected', 'Số thẻ khác nhau đã sưu tầm'], ['perfect_quizzes', 'Số bài đạt 100%'], ['xp_total', 'Tổng điểm tích lũy'],
] as const;

type FieldType = 'text' | 'textarea' | 'int' | 'bool' | 'enum' | 'color' | 'ref' | 'url';
export interface CatalogField {
  name: string; label: string; type: FieldType; required?: boolean; options?: Array<{ value: string; label: string }>; min?: number; max?: number; maxLen?: number;
  ref?: 'figure' | 'campaign'; createOnly?: boolean; hint?: string;
}
interface Spec {
  entity: string; label: string; plural: string; table: string; pk: string; order: string; fields: CatalogField[]; summary: string[];
  toRow?: (body: Record<string, any>) => Record<string, unknown>;
  fromRow?: (row: Record<string, any>) => Record<string, unknown>;
  blockers?: (q: Q, id: number) => Promise<string | null>;
}

const text = (name: string, label: string, maxLen: number, required = false): CatalogField => ({ name, label, type: 'text', required, maxLen });
const int = (name: string, label: string, min: number, max: number, required = false): CatalogField => ({ name, label, type: 'int', required, min, max });
const code: CatalogField = { name: 'code', label: 'Mã (chữ thường, số, gạch ngang)', type: 'text', required: true, maxLen: 60, createOnly: true };
const color: CatalogField = { name: 'color', label: 'Màu (#rrggbb)', type: 'color' };
const icon: CatalogField = { name: 'icon', label: 'Biểu tượng', type: 'enum', options: GAME_ICONS.map((v) => ({ value: v, label: v })) };
const active: CatalogField = { name: 'is_active', label: 'Đang dùng', type: 'bool' };
const sort: CatalogField = int('sort_order', 'Thứ tự', -1000, 1000);
const enumOf = (name: string, label: string, options: Array<[string, string]>, required = true): CatalogField => ({ name, label, type: 'enum', required, options: options.map(([value, l]) => ({ value, label: l })) });

const parseSkills = (raw: unknown): Array<{ code: string; name: string; description: string; cost: number }> =>
  String(raw ?? '').split('\n').map((l) => l.trim()).filter(Boolean).map((line, i) => {
    const [c, n, d, cost] = line.split('|').map((x) => x.trim());
    if (!c || !n || !/^[a-z_]{2,30}$/.test(c) || !Number.isInteger(Number(cost)) || Number(cost) < 0 || Number(cost) > 99) {
      throw new BadRequestException(`Kỹ năng dòng ${i + 1}: viết theo dạng "mã_chữ_thường | Tên | Mô tả | chi phí (0–99)"`);
    }
    return { code: c, name: n, description: d ?? '', cost: Number(cost) };
  }).slice(0, 6);

export const SPECS: Record<string, Spec> = {
  levels: {
    entity: 'levels', label: 'Cấp độ', plural: 'Cấp độ', table: 'hk_levels', pk: 'level', order: 'level', summary: ['level', 'title', 'xp_required', 'reward_gold'],
    fields: [{ ...int('level', 'Cấp', 1, 100, true), createOnly: true }, text('title', 'Danh hiệu', 60, true), int('xp_required', 'Điểm cần đạt', 0, 1000000, true), int('reward_gold', 'Vàng thưởng khi lên cấp', 0, 10000)],
    blockers: async (_q, id) => (id === 1 ? 'Không xóa được cấp 1' : null),
  },
  classes: {
    entity: 'classes', label: 'Lớp nhân vật', plural: 'Lớp nhân vật và kỹ năng', table: 'hk_character_classes', pk: 'id', order: 'sort_order, id', summary: ['name', 'description'],
    fields: [code, text('name', 'Tên', 60, true), { name: 'description', label: 'Mô tả', type: 'textarea', maxLen: 600 }, icon, color,
      int('hp', 'Sinh lực', 0, 500), int('attack', 'Sức mạnh', 0, 500), int('wisdom', 'Trí tuệ', 0, 500), int('support', 'Hỗ trợ', 0, 500),
      { name: 'skills', label: 'Kỹ năng (mỗi dòng: mã | Tên | Mô tả | chi phí)', type: 'textarea', maxLen: 1200, hint: 'Kỹ năng được dùng ở giai đoạn lớp học (Sprint 7)' }, sort, active],
    toRow: (b) => ({ stats: { hp: Number(b.hp ?? 0), attack: Number(b.attack ?? 0), wisdom: Number(b.wisdom ?? 0), support: Number(b.support ?? 0) }, skills: parseSkills(b.skills) }),
    fromRow: (r) => ({ ...r, hp: r.stats?.hp ?? 0, attack: r.stats?.attack ?? 0, wisdom: r.stats?.wisdom ?? 0, support: r.stats?.support ?? 0, skills: (r.skills ?? []).map((s: any) => `${s.code} | ${s.name} | ${s.description ?? ''} | ${s.cost}`).join('\n') }),
    blockers: async (q, id) => { const n = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_players WHERE class_id = $1', [id]))[0].n); return n ? `Có ${n} học sinh đang dùng lớp nhân vật này; hãy tắt "Đang dùng" thay vì xóa` : null; },
  },
  badges: {
    entity: 'badges', label: 'Huy hiệu', plural: 'Huy hiệu', table: 'hk_badges', pk: 'id', order: 'scope, sort_order, id', summary: ['name', 'description'],
    fields: [code, text('name', 'Tên', 80, true), { name: 'description', label: 'Mô tả', type: 'textarea', maxLen: 300 }, icon, color,
      { ...enumOf('rule_type', 'Điều kiện tự trao', [['', 'Không có (giáo viên trao tay)'], ...(BADGE_RULES as unknown as Array<[string, string]>)], false), hint: 'Huy hiệu hệ thống tự trao khi đạt điều kiện' },
      int('rule_value', 'Giá trị điều kiện', 1, 1000000), { name: 'rule_campaign_id', label: 'Cuộc kháng chiến (cho điều kiện hoàn thành)', type: 'ref', ref: 'campaign' }, sort, active],
    toRow: (b) => {
      const type = String(b.rule_type ?? '');
      if (!type) return { rule: null };
      if (type === 'campaign_complete') {
        if (!Number(b.rule_campaign_id)) throw new BadRequestException('Hãy chọn cuộc kháng chiến cho điều kiện hoàn thành');
        return { rule: { type, campaign_id: Number(b.rule_campaign_id) } };
      }
      if (!Number.isInteger(Number(b.rule_value)) || Number(b.rule_value) < 1) throw new BadRequestException('Hãy nhập giá trị điều kiện (số nguyên từ 1)');
      return { rule: { type, value: Number(b.rule_value) } };
    },
    fromRow: (r) => ({ ...r, rule_type: r.rule?.type ?? '', rule_value: r.rule?.value ?? null, rule_campaign_id: r.rule?.campaign_id ?? null }),
    blockers: async (q, id) => { const n = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_user_badges WHERE badge_id = $1', [id]))[0].n); return n ? `Đã trao cho ${n} học sinh; hãy tắt "Đang dùng" thay vì xóa` : null; },
  },
  cards: {
    entity: 'cards', label: 'Thẻ nhân vật', plural: 'Thẻ nhân vật', table: 'hk_cards', pk: 'id', order: "CASE rarity WHEN 'legendary' THEN 0 WHEN 'rare' THEN 1 ELSE 2 END, id", summary: ['name', 'rarity'],
    fields: [code, text('name', 'Tên thẻ', 80, true), enumOf('rarity', 'Độ hiếm', [['common', 'Thường'], ['rare', 'Hiếm'], ['legendary', 'Huyền thoại']]), int('drop_weight', 'Trọng số rơi (trong cùng độ hiếm)', 1, 1000, true),
      { name: 'figure_id', label: 'Nhân vật trong kho lịch sử', type: 'ref', ref: 'figure' }, text('flavor_quote', 'Dòng chữ trên thẻ', 300), { name: 'image_url', label: 'Hình (liên kết https)', type: 'url', maxLen: 500 },
      int('min_level', 'Cấp tối thiểu để thẻ có thể rơi', 1, 100), active],
    blockers: async (q, id) => { const n = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_user_cards WHERE card_id = $1', [id]))[0].n); return n ? `Có ${n} học sinh đã sưu tầm thẻ này; hãy tắt "Đang dùng" thay vì xóa` : null; },
  },
  items: {
    entity: 'items', label: 'Vật phẩm', plural: 'Cửa hàng và vật phẩm', table: 'hk_shop_items', pk: 'id', order: 'kind, sort_order, id', summary: ['name', 'price'],
    fields: [code, enumOf('kind', 'Loại', [['outfit', 'Trang phục'], ['weapon', 'Vũ khí'], ['banner', 'Cờ hiệu'], ['streak_freeze', 'Đóng băng chuỗi'], ['heart', 'Hồi tim'], ['hint', 'Gợi ý 50/50']]),
      text('name', 'Tên', 80, true), { name: 'description', label: 'Mô tả', type: 'textarea', maxLen: 300 }, icon, color,
      { ...int('price', 'Giá (vàng); 0 = mở khóa miễn phí khi đủ cấp', 0, 100000, true) }, int('min_level', 'Cấp yêu cầu', 1, 100), sort, active],
    blockers: async (q, id) => { const n = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_inventory WHERE item_id = $1', [id]))[0].n); return n ? `Có ${n} học sinh đang giữ vật phẩm này; hãy tắt "Đang dùng" thay vì xóa` : null; },
  },
  quests: {
    entity: 'quests', label: 'Mẫu nhiệm vụ', plural: 'Nhiệm vụ hằng ngày / tuần mẫu', table: 'hk_quest_templates', pk: 'id', order: 'period, sort_order, id', summary: ['title', 'target'],
    fields: [code, enumOf('period', 'Chu kỳ', [['daily', 'Hằng ngày'], ['weekly', 'Hằng tuần']]), text('title', 'Nội dung nhiệm vụ', 120, true),
      enumOf('metric', 'Đo bằng', [['correct_answers', 'Số câu trả lời đúng'], ['nodes_completed', 'Số nút hoàn thành'], ['battles_completed', 'Số trận đánh hoàn thành'], ['lessons_completed', 'Số bài học hoàn thành'], ['xp_earned', 'Điểm học tập kiếm được'], ['perfect_quizzes', 'Số bài đạt 100%']]),
      int('target', 'Mục tiêu', 1, 1000, true), int('reward_xp', 'Thưởng điểm', 0, 10000), int('reward_gold', 'Thưởng vàng', 0, 10000), sort, active],
  },
};

const norm = (s: string) => s.normalize('NFD').replace(/\p{Mn}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

@Injectable()
export class CatalogService {
  constructor(private readonly db: DatabaseService) {}

  specs() {
    return Object.values(SPECS).map(({ entity, label, plural, pk, fields, summary }) => ({ entity, label, plural, pk, fields, summary }));
  }

  private spec(entity: string): Spec {
    const s = SPECS[entity];
    if (!s) throw notFound('danh mục');
    return s;
  }

  /** Quản trị viên trường chỉ làm việc với huy hiệu của trường mình */
  private guard(actor: UserRow, spec: Spec): void {
    if (actor.role === 'root_admin') return;
    if (actor.role === 'school_admin' && spec.entity === 'badges' && actor.school_id) return;
    throw new ForbiddenException('Bạn không có quyền quản lý danh mục này');
  }

  private scopeSql(actor: UserRow, spec: Spec, params: unknown[]): string {
    if (spec.entity !== 'badges' || actor.role !== 'school_admin') return 'true';
    params.push(actor.school_id);
    return `(scope = 'school' AND school_id = $${params.length})`;
  }

  async list(actor: UserRow, entity: string, q?: string) {
    const spec = this.spec(entity);
    this.guard(actor, spec);
    const params: unknown[] = [];
    const where = [this.scopeSql(actor, spec, params)];
    const term = norm(q ?? '').trim();
    if (term) { params.push(`%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`); where.push(`lower(${spec.fields.find((f) => f.name === 'name' || f.name === 'title')?.name ?? spec.pk}::text) LIKE $${params.length}`); }
    const rows = await this.db.query<Record<string, any>>(`SELECT * FROM ${spec.table} WHERE ${where.join(' AND ')} ORDER BY ${spec.order} LIMIT 500`, params);
    return rows.map((r) => (spec.fromRow ? spec.fromRow(r) : r));
  }

  async get(actor: UserRow, entity: string, id: number) {
    const spec = this.spec(entity);
    this.guard(actor, spec);
    const params: unknown[] = [id];
    const row = (await this.db.query<Record<string, any>>(`SELECT * FROM ${spec.table} WHERE ${spec.pk} = $1 AND ${this.scopeSql(actor, spec, params)}`, params))[0];
    if (!row) throw notFound(spec.label.toLowerCase());
    return spec.fromRow ? spec.fromRow(row) : row;
  }

  private clean(spec: Spec, body: Record<string, any>, partial: boolean): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of spec.fields) {
      if (body[f.name] === undefined) {
        if (!partial && f.required) throw new BadRequestException(`${f.label}: bắt buộc`);
        continue;
      }
      const v = body[f.name];
      const label = f.label;
      if (f.type === 'bool') { if (typeof v !== 'boolean') throw new BadRequestException(`${label}: phải là bật hoặc tắt`); out[f.name] = v; continue; }
      if (f.type === 'int') {
        if (v === null || v === '') { if (f.required) throw new BadRequestException(`${label}: bắt buộc`); out[f.name] = null; continue; }
        const n = Number(v);
        if (!Number.isInteger(n) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) throw new BadRequestException(`${label}: số nguyên từ ${f.min} đến ${f.max}`);
        out[f.name] = n; continue;
      }
      if (f.type === 'ref') { out[f.name] = v === null || v === '' ? null : Number(v); if (out[f.name] !== null && !Number.isInteger(out[f.name])) throw new BadRequestException(`${label}: không hợp lệ`); continue; }
      const s = typeof v === 'string' ? v.trim().replace(/[ \t]+/g, ' ') : '';
      if (!s) { if (f.required) throw new BadRequestException(`${label}: bắt buộc`); out[f.name] = f.type === 'enum' ? '' : null; continue; }
      if (f.maxLen && s.length > f.maxLen) throw new BadRequestException(`${label}: tối đa ${f.maxLen} ký tự`);
      if (f.name === 'code' && !/^[a-z0-9_-]{2,60}$/.test(s)) throw new BadRequestException('Mã chỉ gồm chữ thường không dấu, số, gạch ngang hoặc gạch dưới (2–60 ký tự)');
      if (f.type === 'color' && !/^#[0-9a-fA-F]{6}$/.test(s)) throw new BadRequestException(`${label}: dạng #rrggbb`);
      if (f.type === 'url' && !/^https:\/\/[^\s]+$/.test(s)) throw new BadRequestException(`${label}: phải là liên kết https`);
      if (f.type === 'enum' && f.options && !f.options.some((o) => o.value === s)) throw new BadRequestException(`${label}: giá trị không hợp lệ`);
      out[f.name] = s;
    }
    return out;
  }

  private async checkLevels(q: Q, level: number, xp: number): Promise<void> {
    const prev = (await q<{ xp_required: number }>('SELECT xp_required FROM hk_levels WHERE level < $1 ORDER BY level DESC LIMIT 1', [level]))[0];
    const next = (await q<{ xp_required: number }>('SELECT xp_required FROM hk_levels WHERE level > $1 ORDER BY level LIMIT 1', [level]))[0];
    if (level === 1 && xp !== 0) throw new BadRequestException('Cấp 1 phải bắt đầu từ 0 điểm');
    if ((prev && xp <= prev.xp_required) || (next && xp >= next.xp_required)) throw new BadRequestException('Điểm cần đạt phải tăng dần theo cấp (lớn hơn cấp trước và nhỏ hơn cấp sau)');
  }

  /** Tách cột thật của bảng khỏi trường ảo của biểu mẫu (ví dụ chỉ số, điều kiện huy hiệu) */
  private columns(spec: Spec, clean: Record<string, unknown>, extra: Record<string, unknown>): Record<string, unknown> {
    const virtual = new Set(['hp', 'attack', 'wisdom', 'support', 'skills', 'rule_type', 'rule_value', 'rule_campaign_id']);
    const real: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(clean)) if (!virtual.has(k) || (spec.entity !== 'classes' && spec.entity !== 'badges')) real[k] = v;
    for (const [k, v] of Object.entries(extra)) real[k] = ['stats', 'skills', 'rule'].includes(k) && v !== null ? JSON.stringify(v) : v;
    return real;
  }

  private mapDbError(e: unknown): never {
    const code = (e as { code?: string }).code;
    if (code === '23505') throw new ConflictException('Mã hoặc giá trị này đã tồn tại');
    if (code === '23503') throw new BadRequestException('Mục được chọn không tồn tại');
    if (code === '23514') throw new BadRequestException('Giá trị không hợp lệ');
    throw e;
  }

  async create(actor: UserRow, entity: string, body: Record<string, any>) {
    const spec = this.spec(entity);
    this.guard(actor, spec);
    const clean = this.clean(spec, body, false);
    const isBadges = spec.entity === 'badges';
    let extra = spec.toRow ? spec.toRow(body) : {};
    if (isBadges) {
      if (actor.role === 'school_admin') { extra = { ...extra, rule: null }; Object.assign(clean, { scope: 'school', school_id: actor.school_id }); } else Object.assign(clean, { scope: 'system' });
      if (actor.role === 'school_admin') clean.code = `s${actor.school_id}-${clean.code}`.slice(0, 60);
      Object.assign(clean, { created_by: actor.id });
    }
    const cols = this.columns(spec, clean, extra);
    const keys = Object.keys(cols);
    const id = await this.db.tx(async (q) => {
      if (spec.entity === 'levels') await this.checkLevels(q, Number(cols.level), Number(cols.xp_required));
      try {
        const row = (await q<Record<string, any>>(`INSERT INTO ${spec.table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING ${spec.pk}`, keys.map((k) => cols[k])))[0];
        return Number(row[spec.pk]);
      } catch (e) { return this.mapDbError(e); }
    });
    return this.get(actor, entity, id);
  }

  async update(actor: UserRow, entity: string, id: number, body: Record<string, any>) {
    const spec = this.spec(entity);
    this.guard(actor, spec);
    const current = await this.get(actor, entity, id);
    const clean = this.clean(spec, Object.fromEntries(Object.entries(body).filter(([k]) => !spec.fields.find((f) => f.name === k)?.createOnly)), true);
    // Trường ảo phải gửi đủ bộ mới dựng lại được (chỉ số, điều kiện); thiếu thì lấy giá trị hiện có
    const merged = { ...current, ...body };
    let extra = spec.toRow && ['classes', 'badges'].includes(spec.entity) ? spec.toRow(merged) : {};
    if (spec.entity === 'badges' && actor.role === 'school_admin') extra = { rule: null };
    const cols = this.columns(spec, clean, extra);
    const keys = Object.keys(cols);
    if (!keys.length) return current;
    await this.db.tx(async (q) => {
      if (spec.entity === 'levels') await this.checkLevels(q, id, Number(cols.xp_required ?? (current as any).xp_required));
      try {
        await q(`UPDATE ${spec.table} SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE ${spec.pk} = $1`, [id, ...keys.map((k) => cols[k])]);
      } catch (e) { this.mapDbError(e); }
    });
    return this.get(actor, entity, id);
  }

  async remove(actor: UserRow, entity: string, id: number): Promise<void> {
    const spec = this.spec(entity);
    this.guard(actor, spec);
    await this.get(actor, entity, id);
    await this.db.tx(async (q) => {
      const blocked = spec.blockers ? await spec.blockers(q, id) : null;
      if (blocked) throw new ConflictException(blocked);
      await q(`DELETE FROM ${spec.table} WHERE ${spec.pk} = $1`, [id]);
    });
  }
}
