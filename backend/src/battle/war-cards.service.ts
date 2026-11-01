/**
 * Thẻ tướng lịch sử (HK.HS.068/069, 126–130; HK.AD.048, 083): bộ sưu tập dạng lưới (độ hiếm, sao, cấp, mảnh), chi tiết hai mặt (chỉ số, tiểu sử, câu nói, trận đã tham gia,
 * chiêu thức kèm giai thoại), nâng cấp bằng Binh thư và thăng sao bằng mảnh, đội hình ra trận, thẻ chiến thuật, sổ tay chỉ huy đối phương và quản trị chiêu thức.
 *  - Cấp thẻ không vượt cấp độ học tập của học sinh: phải học thì thẻ mới mạnh lên.
 *  - Mỗi cấp +10% và mỗi sao +20% chỉ số; lên cấp L+1 tốn 2×L Binh thư; thăng sao 1→5 tốn 2, 3, 4, 5 mảnh.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { notFound } from '../content/access';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { GameService, RARITY_TEXT } from '../game/game.service';
import { cardStats, MoveDef, power } from './war-engine';

export const STAR_COST = [2, 3, 4, 5];
export const levelCost = (level: number): number => 2 * level;
const RARITY_ORDER = "CASE c.rarity WHEN 'legendary' THEN 0 WHEN 'epic' THEN 1 WHEN 'rare' THEN 2 ELSE 3 END";
const BRANCH_TEXT = { bo: 'Bộ binh', thuy: 'Thủy binh', ky: 'Kỵ binh' } as const;
const SLOTS = ['normal', 'active', 'ultimate', 'passive'] as const;
const TARGETS = ['enemy_one', 'enemy_all', 'ally_one', 'ally_all', 'self'];
const EFFECTS = ['stun', 'shield', 'atk_up', 'def_up', 'atk_down', 'heal', 'drain', 'burn', 'hunger'];
const TACTICS = ['atk_up', 'def_up', 'hunger', 'stakes', 'heal_all', 'stun_enemy'];

export interface CardRow {
  id: number; code: string; name: string; rarity: keyof typeof RARITY_TEXT; kind: 'general' | 'tactic'; branch: 'bo' | 'thuy' | 'ky' | null; image_url: string | null; flavor_quote: string | null;
  figure_id: number | null; base_stats: Record<string, number>; fragments_needed: number; source_text: string | null; min_level: number; tactic: Record<string, any> | null; is_active: boolean;
}
interface OwnedRow extends CardRow { owned: boolean; level: number; stars: number; fragments: number }

@Injectable()
export class WarCardsService {
  constructor(private readonly db: DatabaseService, private readonly game: GameService) {}

  private async player(q: Q, userId: number): Promise<{ level: number; binh_thu: number }> {
    return (await q<{ level: number; binh_thu: number }>('SELECT level, binh_thu FROM hk_players WHERE user_id = $1', [userId]))[0] ?? { level: 1, binh_thu: 0 };
  }

  private async owned(q: Q, userId: number, id?: number): Promise<OwnedRow[]> {
    return q<OwnedRow>(
      `SELECT c.*, (uc.user_id IS NOT NULL) AS owned, COALESCE(uc.level, 1) AS level, COALESCE(uc.stars, 1) AS stars, COALESCE(f.qty, 0) AS fragments
       FROM hk_cards c LEFT JOIN hk_user_cards uc ON uc.card_id = c.id AND uc.user_id = $1 LEFT JOIN hk_card_fragments f ON f.card_id = c.id AND f.user_id = $1
       WHERE ${id ? 'c.id = $2' : '(c.is_active OR uc.user_id IS NOT NULL)'} ORDER BY ${RARITY_ORDER}, c.id`, id ? [userId, id] : [userId]);
  }

  private brief(c: OwnedRow, p: { level: number; binh_thu: number }) {
    const stats = cardStats(c.base_stats, c.level, c.stars);
    const known = c.owned || c.fragments > 0;
    const cap = p.level;
    return {
      id: c.id, code: c.code, name: known ? c.name : null, rarity: c.rarity, rarity_label: RARITY_TEXT[c.rarity], kind: c.kind, branch: c.branch, branch_label: c.branch ? BRANCH_TEXT[c.branch] : null,
      image_url: c.image_url, owned: c.owned, level: c.owned ? c.level : null, stars: c.owned ? c.stars : null, fragments: c.fragments, fragments_needed: c.fragments_needed,
      power: c.owned && c.kind === 'general' ? power(stats) : null, stats: c.owned && c.kind === 'general' ? stats : null, min_level: c.min_level, source_text: known ? c.source_text : null,
      level_cap: cap, can_level: c.owned && c.kind === 'general' && c.level < Math.min(100, cap) && p.binh_thu >= levelCost(c.level), level_cost: c.owned ? levelCost(c.level) : null,
      can_star: c.owned && c.kind === 'general' && c.stars < 5 && c.fragments >= STAR_COST[c.stars - 1], star_cost: c.owned && c.stars < 5 ? STAR_COST[c.stars - 1] : null,
      tactic: c.owned && c.tactic ? { name: c.name, text: c.tactic.text ?? null, effect: c.tactic.effect } : null,
    };
  }

  /** Bộ sưu tập (HK.HS.069): lưới thẻ, thẻ chưa có hiện bóng mờ (chỉ biết độ hiếm); lọc và sắp xếp ở giao diện */
  async collection(user: UserRow) {
    const [p, rows] = await this.db.tx(async (q) => [await this.player(q, user.id), await this.owned(q, user.id)] as const);
    const cards = rows.map((c) => this.brief(c, p));
    return {
      player: p, cards,
      summary: { total: rows.length, owned: rows.filter((c) => c.owned).length, generals: rows.filter((c) => c.owned && c.kind === 'general').length, tactics: rows.filter((c) => c.owned && c.kind === 'tactic').length },
    };
  }

  async detail(user: UserRow, id: number) {
    return this.db.tx(async (q) => {
      const c = (await this.owned(q, user.id, id))[0];
      if (!c) throw notFound('thẻ');
      if (!c.owned) throw new ForbiddenException('Em chưa có thẻ này; hãy gom đủ mảnh để ghép thẻ');
      const p = await this.player(q, user.id);
      const moves = await q<MoveDef & { id: number }>('SELECT id, slot, name, description, anecdote, target, power::float8 AS power, effect, rage_cost, cooldown, anim FROM hk_card_moves WHERE card_id = $1 ORDER BY array_position(ARRAY[\'normal\', \'active\', \'ultimate\', \'passive\'], slot)', [id]);
      const figure = c.figure_id
        ? (await q<Record<string, any>>("SELECT id, name, honorific, birth_year, death_year, role_text, biography, famous_quote, image_url FROM hist_figures WHERE id = $1 AND status = 'published'", [c.figure_id]))[0] ?? null : null;
      const battles = c.figure_id
        ? await q<{ id: number; name: string; year: number; stage_id: number | null }>(
          `SELECT b.id, b.name, b.year, (SELECT s.id FROM hk_stages s WHERE s.battle_id = b.id AND s.status = 'published') AS stage_id
           FROM hist_battles b WHERE b.status = 'published' AND b.id IN (SELECT a_id FROM hist_links WHERE a_type = 'battle' AND b_type = 'figure' AND b_id = $1) ORDER BY b.year, b.id`, [c.figure_id]) : [];
      const stats = cardStats(c.base_stats, c.level, c.stars);
      const next = c.level < 100 ? cardStats(c.base_stats, c.level + 1, c.stars) : null;
      return { ...this.brief(c, p), flavor_quote: c.flavor_quote, figure, battles, moves, next_level_stats: next, stats, hint: c.level >= p.level ? `Cấp thẻ không vượt cấp học tập của em (cấp ${p.level}); hãy học thêm để lên cấp.` : null };
    });
  }

  /** Nâng cấp (HK.HS.127): `level` tốn Binh thư, `star` tốn mảnh; không vượt cấp độ học tập của học sinh */
  async upgrade(user: UserRow, id: number, kind: 'level' | 'star') {
    await this.db.tx(async (q) => {
      await q('SELECT 1 FROM hk_players WHERE user_id = $1 FOR UPDATE', [user.id]);
      const c = (await this.owned(q, user.id, id))[0];
      if (!c?.owned) throw new ForbiddenException('Em chưa có thẻ này');
      if (c.kind !== 'general') throw new ConflictException('Thẻ chiến thuật không nâng cấp');
      const p = await this.player(q, user.id);
      if (kind === 'level') {
        if (c.level >= 100) throw new ConflictException('Thẻ đã đạt cấp tối đa');
        if (c.level >= p.level) throw new ConflictException(`Cấp thẻ không vượt cấp học tập của em (cấp ${p.level}); hãy học thêm để lên cấp`);
        const cost = levelCost(c.level);
        if (p.binh_thu < cost) throw new ConflictException(`Cần ${cost} Binh thư, em đang có ${p.binh_thu}. Hoàn thành bài học và trận đánh để nhận thêm`);
        await this.game.addBinhThu(q, user, -cost, 'upgrade', `lv:${id}:${c.level + 1}`);
        await q('UPDATE hk_user_cards SET level = level + 1 WHERE user_id = $1 AND card_id = $2', [user.id, id]);
      } else {
        if (c.stars >= 5) throw new ConflictException('Thẻ đã đạt 5 sao');
        const cost = STAR_COST[c.stars - 1];
        if (c.fragments < cost) throw new ConflictException(`Cần ${cost} mảnh thẻ, em đang có ${c.fragments}. Thẻ trùng, rương và trận đánh cho mảnh`);
        await q('UPDATE hk_card_fragments SET qty = qty - $3 WHERE user_id = $1 AND card_id = $2', [user.id, id, cost]);
        await q('UPDATE hk_user_cards SET stars = stars + 1 WHERE user_id = $1 AND card_id = $2', [user.id, id]);
      }
    });
    return this.detail(user, id);
  }

  // ------------------------------------------------------------------ đội hình (HK.HS.128)
  async formations(user: UserRow) {
    return this.db.tx(async (q) => {
      const rows = await q<{ slot: number; name: string; front: number[]; back: number[]; tactic_card_id: number | null }>('SELECT slot, name, front, back, tactic_card_id FROM hk_formations WHERE user_id = $1 ORDER BY slot', [user.id]);
      const owned = new Map((await this.owned(q, user.id)).filter((c) => c.owned).map((c) => [c.id, c]));
      const out = [1, 2, 3].map((slot) => {
        const r = rows.find((x) => x.slot === slot);
        const front = (r?.front ?? []).filter((id) => owned.has(id)), back = (r?.back ?? []).filter((id) => owned.has(id));
        const total = [...front, ...back].reduce((n, id) => { const c = owned.get(id)!; return n + power(cardStats(c.base_stats, c.level, c.stars)); }, 0);
        return { slot, name: r?.name ?? `Đội hình ${slot}`, front, back, tactic_card_id: r?.tactic_card_id && owned.has(r.tactic_card_id) ? r.tactic_card_id : null, power: total, size: front.length + back.length };
      });
      return { slots: out };
    });
  }

  async saveFormation(user: UserRow, slot: number, body: { name?: string; front?: number[]; back?: number[]; tactic_card_id?: number | null }) {
    if (!Number.isInteger(slot) || slot < 1 || slot > 3) throw new BadRequestException('Đội hình số 1, 2 hoặc 3');
    const front = body.front ?? [], back = body.back ?? [];
    const ids = [...front, ...back];
    if (ids.length > 5) throw new BadRequestException('Mỗi đội hình tối đa 5 thẻ');
    if (new Set(ids).size !== ids.length || ids.some((x) => !Number.isInteger(x))) throw new BadRequestException('Mỗi thẻ chỉ xuất hiện một lần trong đội hình');
    const name = String(body.name ?? `Đội hình ${slot}`).trim().replace(/\s+/g, ' ');
    if (name.length < 1 || name.length > 40) throw new BadRequestException('Tên đội hình từ 1 đến 40 ký tự');
    await this.db.tx(async (q) => {
      const owned = new Map((await this.owned(q, user.id)).filter((c) => c.owned).map((c) => [c.id, c]));
      for (const id of ids) if (owned.get(id)?.kind !== 'general') throw new BadRequestException('Chỉ đưa thẻ tướng em đã có vào đội hình');
      const tactic = body.tactic_card_id ?? null;
      if (tactic !== null && owned.get(tactic)?.kind !== 'tactic') throw new BadRequestException('Thẻ chiến thuật phải là thẻ em đã có');
      await q(
        `INSERT INTO hk_formations (user_id, slot, name, front, back, tactic_card_id) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, slot) DO UPDATE SET name = $3, front = $4, back = $5, tactic_card_id = $6, updated_at = now()`, [user.id, slot, name, front, back, tactic]);
    });
    return this.formations(user);
  }

  // ------------------------------------------------------------------ sổ tay chỉ huy đối phương (HK.HS.130)
  async commanders(user: UserRow) {
    const rows = await this.db.query<{ id: number; name: string; role_text: string | null; forces: string | null; tactics: string | null; outcome: string | null; source_id: number | null; seen: boolean }>(
      `SELECT k.id, k.name, k.role_text, k.forces, k.tactics, k.outcome, k.source_id, (s.user_id IS NOT NULL) AS seen
       FROM hk_commanders k LEFT JOIN hk_commanders_seen s ON s.commander_id = k.id AND s.user_id = $1 WHERE k.status = 'published' ORDER BY k.id`, [user.id]);
    // Hồ sơ chỉ mở sau khi chạm trán; chỉ để tra cứu, không dùng làm thẻ ra trận
    return rows.map((r) => (r.seen ? r : { id: r.id, name: null, role_text: null, forces: null, tactics: null, outcome: null, source_id: null, seen: false }));
  }

  // ------------------------------------------------------------------ quản trị: thẻ tướng nâng cao và chiêu thức (HK.AD.048, 083)
  async adminCard(id: number) {
    const c = (await this.db.query<CardRow>('SELECT * FROM hk_cards WHERE id = $1', [id]))[0];
    if (!c) throw notFound('thẻ');
    const moves = await this.db.query('SELECT slot, name, description, anecdote, target, power::float8 AS power, effect, rage_cost, cooldown, anim FROM hk_card_moves WHERE card_id = $1', [id]);
    return { id: c.id, code: c.code, name: c.name, rarity: c.rarity, kind: c.kind, branch: c.branch, base_stats: c.base_stats, fragments_needed: c.fragments_needed, source_text: c.source_text, tactic: c.tactic, moves };
  }

  async adminCards() {
    return this.db.query(
      `SELECT c.id, c.code, c.name, c.rarity, c.kind, c.branch, c.is_active, c.base_stats, (SELECT count(*)::int FROM hk_card_moves m WHERE m.card_id = c.id) AS moves
       FROM hk_cards c ORDER BY ${RARITY_ORDER}, c.id`);
  }

  async updateCardWar(id: number, body: Record<string, any>) {
    const cur = await this.adminCard(id);
    const kind = body.kind ?? cur.kind;
    if (!['general', 'tactic'].includes(kind)) throw new BadRequestException('Loại thẻ là thẻ tướng hoặc thẻ chiến thuật');
    const branch = kind === 'tactic' ? null : body.branch === undefined ? cur.branch : body.branch || null;
    if (branch !== null && !['bo', 'thuy', 'ky'].includes(branch)) throw new BadRequestException('Binh chủng: bộ, thủy hoặc kỵ');
    const stats = { ...cur.base_stats, ...(body.base_stats ?? {}) };
    for (const [k, [min, max]] of Object.entries({ atk: [1, 1000], def: [0, 1000], hp: [50, 20000], spd: [1, 100] })) {
      const v = Number(stats[k]);
      if (!Number.isInteger(v) || v < min || v > max) throw new BadRequestException(`Chỉ số ${k}: số nguyên từ ${min} đến ${max}`);
    }
    const frag = Number(body.fragments_needed ?? cur.fragments_needed);
    if (!Number.isInteger(frag) || frag < 1 || frag > 50) throw new BadRequestException('Số mảnh để ghép thẻ từ 1 đến 50');
    const source = body.source_text === undefined ? cur.source_text : String(body.source_text ?? '').trim() || null;
    if (source && source.length > 300) throw new BadRequestException('Nguồn nhận thẻ tối đa 300 ký tự');
    let tactic = body.tactic === undefined ? cur.tactic : body.tactic;
    if (kind === 'tactic') {
      if (!tactic || !TACTICS.includes(tactic.effect)) throw new BadRequestException(`Thẻ chiến thuật cần hiệu ứng thuộc: ${TACTICS.join(', ')}`);
      const value = Number(tactic.value ?? 0.2), turns = Number(tactic.turns ?? 3);
      if (!(value >= 0 && value <= 1) || !Number.isInteger(turns) || turns < 1 || turns > 10) throw new BadRequestException('Hiệu ứng thẻ chiến thuật: giá trị 0–1 và số lượt 1–10');
      tactic = { effect: tactic.effect, value, turns, text: String(tactic.text ?? '').trim().slice(0, 200) || null };
    } else tactic = null;
    await this.db.query('UPDATE hk_cards SET kind = $2, branch = $3, base_stats = $4, fragments_needed = $5, source_text = $6, tactic = $7 WHERE id = $1',
      [id, kind, branch, JSON.stringify({ atk: Number(stats.atk), def: Number(stats.def), hp: Number(stats.hp), spd: Number(stats.spd) }), frag, source, tactic ? JSON.stringify(tactic) : null]);
    return this.adminCard(id);
  }

  async upsertMove(cardId: number, slot: string, body: Record<string, any>) {
    if (!(SLOTS as readonly string[]).includes(slot)) throw new BadRequestException('Loại chiêu: đòn thường, chủ động, tuyệt kỹ hoặc nội tại');
    await this.adminCard(cardId);
    const name = String(body.name ?? '').trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 80) throw new BadRequestException('Tên chiêu từ 2 đến 80 ký tự');
    const text = (v: unknown, max: number, label: string): string | null => { const s = String(v ?? '').trim(); if (s.length > max) throw new BadRequestException(`${label} tối đa ${max} ký tự`); return s || null; };
    const target = String(body.target ?? 'enemy_one');
    if (!TARGETS.includes(target)) throw new BadRequestException('Mục tiêu của chiêu không hợp lệ');
    const pw = Number(body.power ?? 1);
    if (!(pw >= 0 && pw <= 5)) throw new BadRequestException('Hệ số sát thương / trị liệu từ 0 đến 5');
    const rage = Number(body.rage_cost ?? (slot === 'ultimate' ? 100 : slot === 'active' ? 40 : 0)), cd = Number(body.cooldown ?? 0);
    if (!Number.isInteger(rage) || rage < 0 || rage > 100 || !Number.isInteger(cd) || cd < 0 || cd > 10) throw new BadRequestException('Nộ cần 0–100 và hồi chiêu 0–10 lượt');
    let effect: Record<string, unknown> | null = null;
    if (body.effect) {
      if (!EFFECTS.includes(body.effect.type)) throw new BadRequestException(`Hiệu ứng thuộc: ${EFFECTS.join(', ')}`);
      const value = Number(body.effect.value ?? 0), turns = Number(body.effect.turns ?? 2);
      if (!(value >= 0 && value <= 5) || !Number.isInteger(turns) || turns < 1 || turns > 10) throw new BadRequestException('Hiệu ứng: giá trị 0–5, số lượt 1–10');
      effect = { type: body.effect.type, value, turns };
    }
    const anim = body.anim ? String(body.anim) : null;
    if (anim && !/^[a-z_]{2,20}$/.test(anim)) throw new BadRequestException('Mã hoạt ảnh gồm chữ thường và gạch dưới');
    await this.db.query(
      `INSERT INTO hk_card_moves (card_id, slot, name, description, anecdote, target, power, effect, rage_cost, cooldown, anim) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (card_id, slot) DO UPDATE SET name = $3, description = $4, anecdote = $5, target = $6, power = $7, effect = $8, rage_cost = $9, cooldown = $10, anim = $11`,
      [cardId, slot, name, text(body.description, 400, 'Mô tả'), text(body.anecdote, 600, 'Giai thoại'), target, pw, effect ? JSON.stringify(effect) : null, rage, cd, anim]);
    return this.adminCard(cardId);
  }

  async deleteMove(cardId: number, slot: string) {
    await this.db.query('DELETE FROM hk_card_moves WHERE card_id = $1 AND slot = $2', [cardId, slot]);
    return this.adminCard(cardId);
  }
}
