/**
 * Trò chơi hóa của học sinh (HK.HS.011–014, 024, 047, 062–070, 073; HK.SYS.001–004, 008): nhân vật, điểm (XP) và cấp độ, vàng, tim, chuỗi ngày và mục tiêu hằng ngày,
 * nhiệm vụ, huy hiệu, thẻ nhân vật, cửa hàng, quà hằng ngày, hàng đợi chúc mừng. Mọi thay đổi chạy trong giao dịch của thao tác học (nhận `q`), nên điểm, vàng,
 * huy hiệu cùng thành công hoặc cùng hoàn tác. Mỗi khoản thưởng có khóa duy nhất (học sinh, lý do, đối tượng) để làm lại không thưởng lần hai.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { notFound } from '../content/access';
import { addDays, dayKey, daysBetween, GameClock, weekKey } from './clock';
import { DAILY_GOALS, GameSettings, SettingsService, tierIndex } from './settings';

export interface PlayerRow {
  user_id: number; class_id: number | null; hearts: number; hearts_at: Date; gold: number; xp: number; level: number; daily_goal: number; streak_current: number; streak_longest: number;
  streak_last_day: string | null; freezes: number; appearance: Record<string, number | null>; last_gift_day: string | null; gift_streak: number; league_tier: number;
  ap: number; ap_day: string | null; buffs: Record<string, number>; binh_thu: number;
}
interface LevelRow { level: number; title: string; xp_required: number; reward_gold: number }
interface ItemRow { id: number; code: string; kind: string; name: string; description: string | null; icon: string; color: string; price: number; min_level: number; sort_order: number; is_active: boolean }
interface BadgeRow { id: number; code: string; scope: string; school_id: number | null; name: string; description: string | null; icon: string; color: string; rule: { type: string; value?: number; campaign_id?: number } | null; sort_order: number }
interface CardRow { id: number; code: string; name: string; rarity: 'common' | 'rare' | 'epic' | 'legendary'; drop_weight: number; figure_id: number | null; flavor_quote: string | null; image_url: string | null; min_level: number }

export const RARITY_TEXT = { common: 'Thường', rare: 'Hiếm', epic: 'Sử thi', legendary: 'Huyền thoại' } as const;
const STUDY_REASONS = ['node', 'lesson', 'practice'];
const SLOTS = [['outfit', 'outfit_id'], ['weapon', 'weapon_id'], ['banner', 'banner_id']] as const;

@Injectable()
export class GameService {
  constructor(
    private readonly db: DatabaseService,
    private readonly settings: SettingsService,
    readonly clock: GameClock,
  ) {}

  cfg(): Promise<GameSettings> { return this.settings.get(); }

  // ------------------------------------------------------------------ người chơi, tim, chuỗi ngày
  async ensurePlayer(q: Q, user: UserRow): Promise<PlayerRow> {
    const s = await this.settings.get();
    await q('INSERT INTO hk_players (user_id, hearts, daily_goal, hearts_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [user.id, s.hearts.max, s.daily_goal.default, this.clock.now()]);
    return (await q<PlayerRow>('SELECT * FROM hk_players WHERE user_id = $1 FOR UPDATE', [user.id]))[0];
  }

  /** Người chơi đã cập nhật chuỗi ngày (bù các ngày đã qua) và tim (hồi theo thời gian); khóa dòng để thao tác tiếp theo an toàn */
  async fresh(q: Q, user: UserRow): Promise<PlayerRow> {
    const p = await this.ensurePlayer(q, user);
    const s = await this.settings.get();
    const now = this.clock.now();
    const today = dayKey(now);
    const patch: Partial<PlayerRow> = {};

    // Chuỗi ngày: mỗi ngày bỏ lỡ dùng một vật phẩm đóng băng; không đủ thì chuỗi về 0 (không tiêu hao vật phẩm vô ích)
    if (p.streak_last_day && p.streak_current > 0) {
      const missed = daysBetween(p.streak_last_day, today) - 1;
      if (missed >= 1) {
        if (p.freezes >= missed) { patch.freezes = p.freezes - missed; patch.streak_last_day = addDays(today, -1); }
        else { patch.streak_current = 0; patch.streak_last_day = null; }
      }
    }

    // Tim: hồi một tim mỗi `regen_hours` giờ, không vượt tối đa (giáo viên có thể đặt HP tối đa thấp hơn cho lớp)
    const max = await this.heartsMax(q, user.id);
    const interval = s.hearts.regen_hours * 3600_000;
    let hearts = Math.min(p.hearts, max);
    let at = new Date(p.hearts_at).getTime();
    if (hearts < max) {
      const gained = Math.floor((now.getTime() - at) / interval);
      if (gained > 0) { hearts = Math.min(max, hearts + gained); at = hearts >= max ? now.getTime() : at + gained * interval; }
    } else at = now.getTime();
    if (hearts !== p.hearts) patch.hearts = hearts;
    if (at !== new Date(p.hearts_at).getTime()) patch.hearts_at = new Date(at);

    const keys = Object.keys(patch) as Array<keyof PlayerRow>;
    if (!keys.length) return p;
    await q(`UPDATE hk_players SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() WHERE user_id = $1`, [user.id, ...keys.map((k) => patch[k])]);
    return { ...p, ...patch };
  }

  /** Lớp của học sinh có tắt cơ chế tim không (giáo viên cấu hình, HK.HS.047): chỉ cần một lớp tắt là tắt */
  async heartsEnabled(q: Q, userId: number): Promise<boolean> {
    if (!(await this.settings.get()).hearts.enabled) return false;
    // cờ tính năng của quản trị tổng (HK.AD.071): tắt "hearts" thì không ai bị giới hạn bởi tim
    const flag = (await q<{ enabled: boolean }>("SELECT enabled FROM hk_feature_flags WHERE key = 'hearts'"))[0];
    if (flag && !flag.enabled) return false;
    const row = (await q<{ ok: boolean | null }>(
      `SELECT bool_and(COALESCE(cs.hearts_enabled, true)) AS ok FROM app_class_members m LEFT JOIN hk_class_settings cs ON cs.class_id = m.class_id WHERE m.user_id = $1`, [userId]))[0];
    return row?.ok ?? true;
  }

  /** HP tối đa của học sinh: mặc định chung, hoặc mức thấp nhất mà giáo viên đặt ở các lớp của em (HK.GV.060) */
  async heartsMax(q: Q, userId: number): Promise<number> {
    const base = (await this.settings.get()).hearts.max;
    const row = (await q<{ m: number | null }>(
      'SELECT min(cs.hearts_max) AS m FROM app_class_members m JOIN hk_class_settings cs ON cs.class_id = m.class_id WHERE m.user_id = $1 AND cs.hearts_max IS NOT NULL', [userId]))[0];
    return row?.m ? Math.min(base, Number(row.m)) : base;
  }

  async heartsInfo(q: Q, user: UserRow, p: PlayerRow) {
    const s = await this.settings.get();
    const enabled = await this.heartsEnabled(q, user.id);
    const max = await this.heartsMax(q, user.id);
    const interval = s.hearts.regen_hours * 3600_000;
    const next = enabled && p.hearts < max ? Math.max(0, interval - (this.clock.now().getTime() - new Date(p.hearts_at).getTime())) : null;
    return { current: enabled ? Math.min(p.hearts, max) : max, max, enabled, next_in_ms: next, regen_hours: s.hearts.regen_hours };
  }

  /** Không cho bắt đầu bài ở nút khi hết tim; luyện tập vẫn được để hồi tim */
  async assertCanPlay(q: Q, user: UserRow): Promise<void> {
    const p = await this.fresh(q, user);
    const info = await this.heartsInfo(q, user, p);
    if (info.enabled && p.hearts <= 0) {
      const mins = Math.max(1, Math.ceil((info.next_in_ms ?? 0) / 60_000));
      throw new ConflictException(`Em đã hết tim. Tim hồi sau khoảng ${mins} phút; em có thể luyện lại các câu đã sai hoặc dùng vật phẩm "Hồi đầy tim" để chơi tiếp.`);
    }
  }

  async loseHeart(q: Q, user: UserRow): Promise<void> {
    const p = await this.fresh(q, user);
    if (!(await this.heartsEnabled(q, user.id)) || p.hearts <= 0) return;
    // Kỹ năng "Hộ giáp" (HK.HS.072): bỏ qua một lần mất tim
    if (p.buffs?.ho_giap) { await this.useBuff(q, user, 'ho_giap'); return; }
    const max = await this.heartsMax(q, user.id);
    await q('UPDATE hk_players SET hearts = hearts - 1, hearts_at = CASE WHEN hearts >= $2::int THEN $3::timestamptz ELSE hearts_at END, updated_at = now() WHERE user_id = $1', [user.id, max, this.clock.now()]);
  }

  /** Dùng một hiệu ứng chờ (xung phong, hộ giáp); trả true nếu học sinh đang có hiệu ứng đó */
  async useBuff(q: Q, user: UserRow, buff: string): Promise<boolean> {
    const row = (await q<{ buffs: Record<string, number> }>('SELECT buffs FROM hk_players WHERE user_id = $1 FOR UPDATE', [user.id]))[0];
    if (!row?.buffs?.[buff]) return false;
    const next = { ...row.buffs, [buff]: row.buffs[buff] - 1 };
    if (next[buff] <= 0) delete next[buff];
    await q('UPDATE hk_players SET buffs = $2 WHERE user_id = $1', [user.id, JSON.stringify(next)]);
    return true;
  }

  async gainHearts(q: Q, user: UserRow, n: number): Promise<void> {
    if (n <= 0) return;
    const p = await this.fresh(q, user);
    const max = await this.heartsMax(q, user.id);
    const hearts = Math.min(max, p.hearts + n);
    await q('UPDATE hk_players SET hearts = $2::int, hearts_at = CASE WHEN $2::int >= $3::int THEN $4::timestamptz ELSE hearts_at END, updated_at = now() WHERE user_id = $1', [user.id, hearts, max, this.clock.now()]);
  }

  /** Giáo viên thưởng/phạt tim (HK.GV.059): trả về số tim thật sự thay đổi sau khi chặn trong khoảng 0 đến HP tối đa */
  async adjustHearts(q: Q, user: UserRow, delta: number): Promise<number> {
    if (!delta) return 0;
    const p = await this.fresh(q, user);
    const max = await this.heartsMax(q, user.id);
    const hearts = Math.max(0, Math.min(max, p.hearts + delta));
    await q('UPDATE hk_players SET hearts = $2::int, hearts_at = CASE WHEN $2::int >= $3::int THEN $4::timestamptz ELSE hearts_at END, updated_at = now() WHERE user_id = $1', [user.id, hearts, max, this.clock.now()]);
    return hearts - p.hearts;
  }

  /** Giáo viên thưởng/phạt điểm (HK.GV.059): cộng đi qua đường cộng điểm thường (mục tiêu ngày, giải đấu, cấp độ); trừ không xuống dưới 0 và không hạ cấp */
  async adjustXp(q: Q, user: UserRow, delta: number, refKey: string, reason = 'teacher'): Promise<number> {
    if (!delta) return 0;
    if (delta > 0) return (await this.awardXp(q, user, delta, reason, refKey)) ? delta : 0;
    const p = await this.ensurePlayer(q, user);
    const applied = -Math.min(-delta, p.xp);
    if (!applied) return 0;
    const ins = await q('INSERT INTO hk_points (user_id, points, reason, ref_key, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id', [user.id, applied, reason, refKey, this.clock.now()]);
    if (!ins.length) return 0;
    await q('UPDATE hk_players SET xp = xp + $2, updated_at = now() WHERE user_id = $1', [user.id, applied]);
    await q('UPDATE hk_league_members SET xp = GREATEST(0, xp + $3) WHERE week_key = $1 AND user_id = $2', [(await this.settings.leagueWeek(q, this.clock.now())).key, user.id, applied]);
    return applied;
  }

  /** Giáo viên thưởng/phạt vàng: trừ không xuống dưới 0 */
  async adjustGold(q: Q, user: UserRow, delta: number, refKey: string, reason = 'teacher'): Promise<number> {
    if (!delta) return 0;
    const p = await this.ensurePlayer(q, user);
    const applied = delta > 0 ? delta : -Math.min(-delta, p.gold);
    if (!applied) return 0;
    return (await this.addGold(q, user, applied, reason, refKey)) ? applied : 0;
  }

  /** Trao thẳng một thẻ nhân vật cụ thể (phần thưởng của nút trên bản đồ, HK.GV.024): thẻ chờ lật như thẻ rơi */
  async grantCard(q: Q, user: UserRow, cardId: number, nodeId: number | null): Promise<number | null> {
    if (!(await q('SELECT 1 FROM hk_cards WHERE id = $1', [cardId])).length) return null;
    const drop = (await q<{ id: number }>('INSERT INTO hk_card_drops (user_id, card_id, source, node_id, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id::int AS id', [user.id, cardId, 'node', nodeId, this.clock.now()]))[0];
    await this.celebrate(q, user, 'card', { drop_id: drop.id });
    return drop.id;
  }

  /**
   * Cộng mảnh thẻ (HK.HS.068, 127): thẻ chưa có thì đủ số mảnh sẽ tự ghép thành thẻ (trừ số mảnh cần); thẻ đã có thì mảnh dùng để thăng sao.
   * Trả về số mảnh còn lại và cho biết lần này có ghép được thẻ hay không.
   */
  async addFragments(q: Q, userId: number, cardId: number, qty: number): Promise<{ merged: boolean; fragments: number }> {
    if (qty <= 0) return { merged: false, fragments: 0 };
    const card = (await q<{ fragments_needed: number; kind: string }>('SELECT fragments_needed, kind FROM hk_cards WHERE id = $1', [cardId]))[0];
    if (!card) return { merged: false, fragments: 0 };
    let total = (await q<{ qty: number }>(
      'INSERT INTO hk_card_fragments (user_id, card_id, qty) VALUES ($1, $2, $3) ON CONFLICT (user_id, card_id) DO UPDATE SET qty = hk_card_fragments.qty + $3 RETURNING qty', [userId, cardId, qty]))[0].qty;
    const owned = (await q('SELECT 1 FROM hk_user_cards WHERE user_id = $1 AND card_id = $2', [userId, cardId])).length > 0;
    if (!owned && total >= card.fragments_needed) {
      total -= card.fragments_needed;
      await q('INSERT INTO hk_user_cards (user_id, card_id, first_at) VALUES ($1, $2, $3)', [userId, cardId, this.clock.now()]);
      await q('UPDATE hk_card_fragments SET qty = $3 WHERE user_id = $1 AND card_id = $2', [userId, cardId, total]);
      return { merged: true, fragments: total };
    }
    return { merged: false, fragments: total };
  }

  // ------------------------------------------------------------------ điểm hành động (HK.HS.072)
  /** Điểm hành động tối đa tăng theo cấp: 3 ở cấp 1, thêm 1 mỗi 2 cấp */
  apMax(level: number): number { return 3 + Math.floor((level - 1) / 2); }

  /** Hồi đầy điểm hành động khi sang ngày mới (giờ Việt Nam) */
  async refreshAp(q: Q, user: UserRow): Promise<PlayerRow> {
    const p = await this.fresh(q, user);
    const today = dayKey(this.clock.now());
    if (p.ap_day === today) return p;
    const ap = this.apMax(p.level);
    await q('UPDATE hk_players SET ap = $2, ap_day = $3, updated_at = now() WHERE user_id = $1', [user.id, ap, today]);
    return { ...p, ap, ap_day: today };
  }

  // ------------------------------------------------------------------ vàng, điểm, cấp độ
  async addGold(q: Q, user: UserRow, delta: number, reason: string, refKey: string): Promise<boolean> {
    if (delta === 0) return false;
    await this.ensurePlayer(q, user);
    const ins = await q('INSERT INTO hk_gold_ledger (user_id, delta, reason, ref_key, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id', [user.id, delta, reason, refKey, this.clock.now()]);
    if (!ins.length) return false;
    await q('UPDATE hk_players SET gold = gold + $2, updated_at = now() WHERE user_id = $1', [user.id, delta]);
    return true;
  }

  /** Binh thư (tài nguyên nâng cấp thẻ tướng): sổ cái riêng, mỗi khoản (lý do, đối tượng) chỉ ghi một lần. Trả true nếu thật sự cộng. */
  async addBinhThu(q: Q, user: UserRow, delta: number, reason: string, refKey: string): Promise<boolean> {
    if (delta === 0) return false;
    await this.ensurePlayer(q, user);
    const ins = await q('INSERT INTO hk_binh_thu_ledger (user_id, delta, reason, ref_key, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id', [user.id, delta, reason, refKey, this.clock.now()]);
    if (!ins.length) return false;
    await q('UPDATE hk_players SET binh_thu = binh_thu + $2, updated_at = now() WHERE user_id = $1', [user.id, delta]);
    return true;
  }

  /** Số Binh thư của một nút khi hoàn thành lần đầu: giá trị riêng của nút nếu có (kể cả 0), không thì mức mặc định theo loại nút */
  async binhThuFor(kind: string, override: number | null | undefined): Promise<number> {
    if (override !== null && override !== undefined) return override;
    const b = (await this.settings.get()).binh_thu;
    switch (kind) {
      case 'practice': return b.practice_first;
      case 'gate_test': return b.gate_test_first;
      case 'battle': return b.battle_first;
      case 'final': return b.final_first;
      case 'chest': return b.chest_default;
      default: return b.node_first;
    }
  }

  async celebrate(q: Q, user: UserRow, kind: string, payload: Record<string, unknown>): Promise<void> {
    await q('INSERT INTO hk_celebrations (user_id, kind, payload, created_at) VALUES ($1, $2, $3, $4)', [user.id, kind, JSON.stringify(payload), this.clock.now()]);
  }

  /** Cộng điểm (XP) một lần theo khóa; cập nhật điểm ngày, giải đấu tuần, cấp độ, nhiệm vụ, huy hiệu. Trả true nếu thật sự cộng. */
  async awardXp(q: Q, user: UserRow, points: number, reason: string, refKey: string): Promise<boolean> {
    if (points <= 0) return false;
    const now = this.clock.now();
    await this.ensurePlayer(q, user);
    const ins = await q('INSERT INTO hk_points (user_id, points, reason, ref_key, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id', [user.id, points, reason, refKey, now]);
    if (!ins.length) return false;
    await q('UPDATE hk_players SET xp = xp + $2, updated_at = now() WHERE user_id = $1', [user.id, points]);

    const p = await this.fresh(q, user);
    const today = dayKey(now);
    const daily = (await q<{ xp: number; goal: number; reached: boolean }>(
      `INSERT INTO hk_daily (user_id, day, xp, goal) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, day) DO UPDATE SET xp = hk_daily.xp + $3 RETURNING xp, goal, reached`, [user.id, today, points, p.daily_goal]))[0];
    if (!daily.reached && daily.xp >= daily.goal) {
      await q('UPDATE hk_daily SET reached = true WHERE user_id = $1 AND day = $2', [user.id, today]);
      await this.goalReached(q, user, today, daily.goal);
    }
    await this.leagueAdd(q, user, points, now);
    await this.checkLevel(q, user);
    if (STUDY_REASONS.includes(reason)) await this.bumpQuests(q, user, 'xp_earned', points);
    await this.evaluateBadges(q, user);
    return true;
  }

  private async goalReached(q: Q, user: UserRow, today: string, goal: number): Promise<void> {
    const p = await this.fresh(q, user);
    const s = await this.settings.get();
    if (p.streak_last_day !== today) {
      const streak = p.streak_last_day === addDays(today, -1) && p.streak_current > 0 ? p.streak_current + 1 : 1;
      await q('UPDATE hk_players SET streak_current = $2, streak_longest = GREATEST(streak_longest, $2), streak_last_day = $3, updated_at = now() WHERE user_id = $1', [user.id, streak, today]);
    }
    await this.addGold(q, user, s.daily_goal.bonus_gold, 'goal', `goal:${today}`);
    const streak = (await q<{ streak_current: number }>('SELECT streak_current FROM hk_players WHERE user_id = $1', [user.id]))[0].streak_current;
    await this.celebrate(q, user, 'goal', { goal, streak, gold: s.daily_goal.bonus_gold });
  }

  private async levels(q: Q): Promise<LevelRow[]> {
    return q<LevelRow>('SELECT level, title, xp_required, reward_gold FROM hk_levels WHERE school_id IS NOT DISTINCT FROM $1 ORDER BY level', [this.db.workspaceSchoolId]);
  }

  private async checkLevel(q: Q, user: UserRow): Promise<void> {
    const p = (await q<PlayerRow>('SELECT * FROM hk_players WHERE user_id = $1', [user.id]))[0];
    const levels = await this.levels(q);
    const reached = levels.filter((l) => l.xp_required <= p.xp).pop();
    if (!reached || reached.level <= p.level) return;
    for (const l of levels.filter((x) => x.level > p.level && x.level <= reached.level)) {
      await this.addGold(q, user, l.reward_gold, 'level', `level:${l.level}`);
      await this.celebrate(q, user, 'level_up', { level: l.level, title: l.title, reward_gold: l.reward_gold });
    }
    await q('UPDATE hk_players SET level = $2, updated_at = now() WHERE user_id = $1', [user.id, reached.level]);
  }

  /** Ghi điểm tuần vào nhóm giải đấu của học sinh (tạo chỗ trong nhóm cùng hạng còn trống nếu là lần đầu trong tuần) */
  async leagueAdd(q: Q, user: UserRow, points: number, now: Date): Promise<void> {
    const week = (await this.settings.leagueWeek(q, now)).key;
    const p = (await q<PlayerRow>('SELECT league_tier FROM hk_players WHERE user_id = $1', [user.id]))[0];
    const upd = await q('UPDATE hk_league_members SET xp = xp + $3 WHERE week_key = $1 AND user_id = $2 RETURNING user_id', [week, user.id, points]);
    if (upd.length) return;
    const s = await this.settings.get();
    const tier = tierIndex(s.league.tiers, p.league_tier); // quản trị giảm số hạng: người ở hạng cao hơn được xếp vào hạng cao nhất còn lại
    const open = (await q<{ group_no: number }>(
      `SELECT group_no FROM hk_league_members WHERE week_key = $1 AND tier = $2 GROUP BY group_no HAVING count(*) < $3 ORDER BY group_no LIMIT 1`, [week, tier, s.league.group_size]))[0];
    const group = open?.group_no ?? Number((await q<{ n: number | null }>('SELECT max(group_no) AS n FROM hk_league_members WHERE week_key = $1 AND tier = $2', [week, tier]))[0].n ?? 0) + 1;
    await q('INSERT INTO hk_league_members (week_key, user_id, tier, group_no, xp) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING', [week, user.id, tier, group, points]);
  }

  // ------------------------------------------------------------------ nhiệm vụ hằng ngày / tuần (HK.HS.024)
  async ensureQuests(q: Q, user: UserRow): Promise<void> {
    const now = this.clock.now();
    for (const [period, key, count] of [['daily', dayKey(now), 3], ['weekly', weekKey(now), 2]] as const) {
      const have = Number((await q<{ n: string }>(
        'SELECT count(*) AS n FROM hk_user_quests uq JOIN hk_quest_templates t ON t.id = uq.template_id WHERE uq.user_id = $1 AND uq.period_key = $2 AND t.period = $3', [user.id, key, period]))[0].n);
      if (have) continue;
      const templates = await q<{ id: number; title: string; metric: string; target: number; reward_xp: number; reward_gold: number }>(
        'SELECT id, title, metric, target, reward_xp, reward_gold FROM hk_quest_templates WHERE period = $1 AND is_active ORDER BY sort_order, id', [period]);
      if (!templates.length) continue;
      const seed = [...key].reduce((n, ch) => n + ch.charCodeAt(0), 0) + user.id;
      for (let i = 0; i < Math.min(count, templates.length); i++) {
        const t = templates[(seed + i) % templates.length];
        await q(
          `INSERT INTO hk_user_quests (user_id, template_id, period_key, title, metric, target, reward_xp, reward_gold) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
          [user.id, t.id, key, t.title, t.metric, t.target, t.reward_xp, t.reward_gold]);
      }
    }
  }

  async bumpQuests(q: Q, user: UserRow, metric: string, n: number): Promise<void> {
    if (n <= 0) return;
    await this.ensureQuests(q, user);
    const now = this.clock.now();
    const rows = await q<{ id: number; progress: number; target: number; title: string; reward_xp: number; reward_gold: number }>(
      `UPDATE hk_user_quests uq SET progress = LEAST(uq.target, uq.progress + $3) FROM hk_quest_templates t
       WHERE t.id = uq.template_id AND uq.user_id = $1 AND uq.metric = $2 AND uq.completed_at IS NULL
         AND ((t.period = 'daily' AND uq.period_key = $4) OR (t.period = 'weekly' AND uq.period_key = $5))
       RETURNING uq.id, uq.progress, uq.target, uq.title, uq.reward_xp, uq.reward_gold`, [user.id, metric, n, dayKey(now), weekKey(now)]);
    for (const r of rows.filter((x) => x.progress >= x.target)) {
      await q('UPDATE hk_user_quests SET completed_at = $2 WHERE id = $1', [r.id, now]);
      await this.awardXp(q, user, r.reward_xp, 'quest', `quest:${r.id}`);
      await this.addGold(q, user, r.reward_gold, 'quest', `quest:${r.id}`);
      await this.celebrate(q, user, 'quest', { title: r.title, reward_xp: r.reward_xp, reward_gold: r.reward_gold });
    }
  }

  async quests(user: UserRow) {
    return this.db.tx(async (q) => {
      await this.fresh(q, user);
      await this.ensureQuests(q, user);
      const now = this.clock.now();
      const rows = await q<Record<string, any>>(
        `SELECT uq.id, uq.title, uq.metric, uq.target, uq.progress, uq.reward_xp, uq.reward_gold, uq.completed_at, t.period, uq.period_key
         FROM hk_user_quests uq JOIN hk_quest_templates t ON t.id = uq.template_id
         WHERE uq.user_id = $1 AND ((t.period = 'daily' AND uq.period_key = $2) OR (t.period = 'weekly' AND uq.period_key = $3)) ORDER BY t.period, uq.id`, [user.id, dayKey(now), weekKey(now)]);
      return { daily: rows.filter((r) => r.period === 'daily'), weekly: rows.filter((r) => r.period === 'weekly'), resets: { daily: addDays(dayKey(now), 1), weekly: addDays(weekKey(now), 7) } };
    });
  }

  // ------------------------------------------------------------------ huy hiệu (HK.HS.066/067, HK.SYS.002)
  private async ruleMet(q: Q, user: UserRow, p: PlayerRow, rule: NonNullable<BadgeRow['rule']>): Promise<boolean> {
    const v = rule.value ?? 0;
    switch (rule.type) {
      case 'streak_days': return Math.max(p.streak_longest, p.streak_current) >= v;
      case 'level': return p.level >= v;
      case 'xp_total': return p.xp >= v;
      case 'correct_answers':
        return Number((await q<{ n: string }>("SELECT count(*) AS n FROM hk_attempt_answers aa JOIN hk_attempts a ON a.id = aa.attempt_id WHERE a.user_id = $1 AND a.mode <> 'preview' AND aa.correct", [user.id]))[0].n) >= v;
      case 'nodes_completed': return Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_node_progress WHERE user_id = $1 AND completed_at IS NOT NULL', [user.id]))[0].n) >= v;
      case 'cards_collected': return Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_user_cards WHERE user_id = $1', [user.id]))[0].n) >= v;
      case 'perfect_quizzes': return Number((await q<{ n: string }>("SELECT count(*) AS n FROM hk_attempts WHERE user_id = $1 AND mode = 'node' AND status = 'done' AND percent = 100", [user.id]))[0].n) >= v;
      case 'campaign_complete':
        return (await q(
          `SELECT 1 FROM hk_node_progress np JOIN hk_nodes n ON n.id = np.node_id JOIN hk_journeys j ON j.id = n.journey_id
           WHERE np.user_id = $1 AND np.completed_at IS NOT NULL AND n.kind = 'final' AND j.campaign_id = $2 LIMIT 1`, [user.id, rule.campaign_id ?? 0])).length > 0;
      default: return false;
    }
  }

  async awardBadge(q: Q, user: UserRow, badge: { id: number; name: string; icon: string; color: string }, by: number | null): Promise<boolean> {
    const ins = await q('INSERT INTO hk_user_badges (user_id, badge_id, awarded_at, awarded_by) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING badge_id', [user.id, badge.id, this.clock.now(), by]);
    if (!ins.length) return false;
    await this.celebrate(q, user, 'badge', { badge_id: badge.id, name: badge.name, icon: badge.icon, color: badge.color });
    return true;
  }

  async evaluateBadges(q: Q, user: UserRow): Promise<void> {
    const badges = await q<BadgeRow>(
      `SELECT id, code, scope, school_id, name, description, icon, color, rule, sort_order FROM hk_badges
       WHERE is_active AND rule IS NOT NULL AND (scope='system' OR school_id=$2) AND id NOT IN (SELECT badge_id FROM hk_user_badges WHERE user_id = $1)`, [user.id,user.school_id]);
    if (!badges.length) return;
    const p = (await q<PlayerRow>('SELECT * FROM hk_players WHERE user_id = $1', [user.id]))[0];
    for (const b of badges) if (await this.ruleMet(q, user, p, b.rule!)) await this.awardBadge(q, user, b, null);
  }

  async badgeCollection(user: UserRow) {
    return this.db.query<Record<string, any>>(
      `SELECT b.id, b.code, b.scope, b.name, b.description, b.icon, b.color, b.rule, ub.awarded_at, (ub.user_id IS NOT NULL) AS earned
       FROM hk_badges b LEFT JOIN hk_user_badges ub ON ub.badge_id = b.id AND ub.user_id = $1
       WHERE b.is_active AND (b.scope = 'system' OR b.school_id = $2 OR ub.user_id IS NOT NULL) ORDER BY (ub.user_id IS NULL), b.scope, b.sort_order, b.id`, [user.id, user.school_id]);
  }

  // ------------------------------------------------------------------ sự kiện học tập → phần thưởng (gọi từ PlayService trong cùng giao dịch)
  async onCorrectAnswer(q: Q, user: UserRow): Promise<void> {
    await this.bumpQuests(q, user, 'correct_answers', 1);
  }

  /** Hoàn thành nút lần đầu: vàng, nhiệm vụ, thẻ rơi (trận đánh và Quyết chiến), huy hiệu */
  async onNodeCompleted(q: Q, user: UserRow, node: { id: number; kind: string; journey_id: number }, first: boolean): Promise<void> {
    const s = await this.settings.get();
    await this.bumpQuests(q, user, 'nodes_completed', 1);
    if (node.kind === 'battle' || node.kind === 'final') await this.bumpQuests(q, user, 'battles_completed', 1);
    if (first) {
      const gold = node.kind === 'final' ? s.gold.final_first : node.kind === 'battle' ? s.gold.battle_first : s.gold.node_first;
      await this.addGold(q, user, gold, 'node', `node:${node.id}`);
      if (node.kind === 'battle' || node.kind === 'final') await this.dropCard(q, user, 'node', node.id);
    }
    await this.evaluateBadges(q, user);
  }

  async onLessonCompleted(q: Q, user: UserRow): Promise<void> {
    await this.bumpQuests(q, user, 'lessons_completed', 1);
  }

  async onPerfectQuiz(q: Q, user: UserRow, attemptId: number): Promise<void> {
    const s = await this.settings.get();
    await this.addGold(q, user, s.gold.perfect_quiz, 'node', `perfect:${attemptId}`);
    await this.bumpQuests(q, user, 'perfect_quizzes', 1);
    await this.evaluateBadges(q, user);
  }

  // ------------------------------------------------------------------ thẻ nhân vật (HK.HS.068/069, HK.SYS.008)
  /** Chọn thẻ theo độ hiếm rồi theo trọng số; máy chủ chọn ngay, học sinh chỉ lật để xem */
  private pickByRarity(cards: CardRow[], rates: Record<'common' | 'rare' | 'epic' | 'legendary', number>): CardRow | null {
    const rarities = (['common', 'rare', 'epic', 'legendary'] as const).filter((r) => rates[r] > 0 && cards.some((c) => c.rarity === r));
    if (!rarities.length) return null;
    let roll = this.clock.random() * rarities.reduce((n, r) => n + rates[r], 0);
    const rarity = rarities.find((r) => (roll -= rates[r]) < 0) ?? rarities[rarities.length - 1];
    const pool = cards.filter((c) => c.rarity === rarity);
    let pick = this.clock.random() * pool.reduce((n, c) => n + c.drop_weight, 0);
    return pool.find((c) => (pick -= c.drop_weight) < 0) ?? pool[pool.length - 1];
  }

  /** Rương của lộ trình học (HK.HS.120, HK.HS.068): trao mảnh của một thẻ tướng chọn theo độ hiếm (thường và hiếm 2 mảnh, sử thi và huyền thoại 1 mảnh); đủ mảnh thì tự ghép thành thẻ */
  async chestFragment(q: Q, user: UserRow): Promise<{ card: string; qty: number; merged: boolean } | null> {
    const s = await this.settings.get();
    const p = (await q<PlayerRow>('SELECT level FROM hk_players WHERE user_id = $1', [user.id]))[0];
    const card = this.pickByRarity(await q<CardRow>("SELECT * FROM hk_cards WHERE is_active AND kind = 'general' AND min_level <= $1", [p?.level ?? 1]), s.cards.rates);
    if (!card) return null;
    const qty = card.rarity === 'common' || card.rarity === 'rare' ? 2 : 1;
    const res = await this.addFragments(q, user.id, card.id, qty);
    return { card: card.name, qty, merged: res.merged };
  }

  async dropCard(q: Q, user: UserRow, source: 'node' | 'campaign' | 'level', nodeId: number | null): Promise<number | null> {
    const s = await this.settings.get();
    const p = (await q<PlayerRow>('SELECT level FROM hk_players WHERE user_id = $1', [user.id]))[0];
    const card = this.pickByRarity(await q<CardRow>('SELECT * FROM hk_cards WHERE is_active AND min_level <= $1', [p.level]), s.cards.rates);
    if (!card) return null;
    const drop = (await q<{ id: number }>('INSERT INTO hk_card_drops (user_id, card_id, source, node_id, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id::int AS id', [user.id, card.id, source, nodeId, this.clock.now()]))[0];
    await this.celebrate(q, user, 'card', { drop_id: drop.id });
    return drop.id;
  }

  async pendingDrops(user: UserRow) {
    return this.db.query('SELECT id::int AS id, source, created_at FROM hk_card_drops WHERE user_id = $1 AND flipped_at IS NULL ORDER BY id', [user.id]);
  }

  async flipDrop(user: UserRow, dropId: number) {
    return this.db.tx(async (q) => {
      await this.fresh(q, user);
      const drop = (await q<{ id: number; card_id: number; flipped_at: Date | null }>('SELECT id::int AS id, card_id, flipped_at FROM hk_card_drops WHERE id = $1 AND user_id = $2 FOR UPDATE', [dropId, user.id]))[0];
      if (!drop) throw notFound('thẻ rơi');
      if (drop.flipped_at) throw new ConflictException('Thẻ này đã được lật rồi');
      const owned = (await q('SELECT 1 FROM hk_user_cards WHERE user_id = $1 AND card_id = $2', [user.id, drop.card_id])).length > 0;
      if (owned) await q('UPDATE hk_user_cards SET copies = copies + 1 WHERE user_id = $1 AND card_id = $2', [user.id, drop.card_id]);
      else await q('INSERT INTO hk_user_cards (user_id, card_id, first_at) VALUES ($1, $2, $3)', [user.id, drop.card_id, this.clock.now()]);
      const s = await this.settings.get();
      if (owned) {
        await this.addGold(q, user, s.gold.duplicate_card, 'card', `drop:${drop.id}`);
        await this.addFragments(q, user.id, drop.card_id, 1); // thẻ trùng thành một mảnh để thăng sao (Sprint 6)
      }
      await q('UPDATE hk_card_drops SET flipped_at = $2, duplicate = $3 WHERE id = $1', [drop.id, this.clock.now(), owned]);
      await q("UPDATE hk_celebrations SET seen_at = $3 WHERE user_id = $1 AND kind = 'card' AND (payload->>'drop_id')::int = $2 AND seen_at IS NULL", [user.id, drop.id, this.clock.now()]);
      await this.evaluateBadges(q, user);
      return { duplicate: owned, gold: owned ? s.gold.duplicate_card : 0, card: await this.cardView(q, user.id, drop.card_id, true) };
    });
  }

  private async cardView(q: Q, userId: number, cardId: number, full: boolean): Promise<Record<string, any>> {
    const card = (await q<Record<string, any>>(
      `SELECT c.id, c.code, c.name, c.rarity, c.image_url, c.flavor_quote, c.figure_id, uc.copies, uc.first_at, (uc.user_id IS NOT NULL) AS owned
       FROM hk_cards c LEFT JOIN hk_user_cards uc ON uc.card_id = c.id AND uc.user_id = $1 WHERE c.id = $2`, [userId, cardId]))[0];
    if (!card) throw notFound('thẻ');
    if (!full || !card.figure_id) return { ...card, rarity_label: RARITY_TEXT[card.rarity as keyof typeof RARITY_TEXT], figure: null };
    const figure = (await q<Record<string, any>>(
      "SELECT id, name, honorific, birth_year, death_year, role_text, biography, famous_quote FROM hist_figures WHERE id = $1 AND status = 'published'", [card.figure_id]))[0] ?? null;
    return { ...card, rarity_label: RARITY_TEXT[card.rarity as keyof typeof RARITY_TEXT], figure };
  }

  async album(user: UserRow) {
    const rows = await this.db.query<Record<string, any>>(
      `SELECT c.id, c.rarity, c.image_url, uc.copies, uc.first_at, (uc.user_id IS NOT NULL) AS owned, CASE WHEN uc.user_id IS NOT NULL THEN c.name END AS name, c.min_level
       FROM hk_cards c LEFT JOIN hk_user_cards uc ON uc.card_id = c.id AND uc.user_id = $1 WHERE c.is_active OR uc.user_id IS NOT NULL
       ORDER BY CASE c.rarity WHEN 'legendary' THEN 0 WHEN 'epic' THEN 1 WHEN 'rare' THEN 2 ELSE 3 END, c.id`, [user.id]);
    return { total: rows.length, owned: rows.filter((r) => r.owned).length, cards: rows.map((r) => ({ ...r, rarity_label: RARITY_TEXT[r.rarity as keyof typeof RARITY_TEXT] })) };
  }

  async cardDetail(user: UserRow, id: number) {
    return this.db.tx(async (q) => {
      const card = await this.cardView(q, user.id, id, true);
      if (!card.owned) throw new ForbiddenException('Em chưa sưu tầm được thẻ này');
      return card;
    });
  }

  // ------------------------------------------------------------------ cửa hàng và ngoại hình (HK.HS.012, 070)
  private async ownsItem(q: Q, userId: number, item: ItemRow, level: number): Promise<boolean> {
    if (['outfit', 'weapon', 'banner'].includes(item.kind)) {
      if (item.price === 0) return level >= item.min_level;
      return (await q('SELECT 1 FROM hk_inventory WHERE user_id = $1 AND item_id = $2 AND qty > 0', [userId, item.id])).length > 0;
    }
    return false;
  }

  async shop(user: UserRow) {
    return this.db.tx(async (q) => {
      const p = await this.fresh(q, user);
      const items = await q<ItemRow>('SELECT * FROM hk_shop_items WHERE is_active ORDER BY kind, sort_order, id');
      const inv = new Map((await q<{ item_id: number; qty: number }>('SELECT item_id, qty FROM hk_inventory WHERE user_id = $1', [user.id])).map((r) => [r.item_id, r.qty]));
      const appearance = await this.appearance(q, p);
      const out = [];
      for (const it of items) {
        const cosmetic = ['outfit', 'weapon', 'banner'].includes(it.kind);
        const owned = cosmetic ? await this.ownsItem(q, user.id, it, p.level) : false;
        out.push({
          ...it, owned, qty: cosmetic ? undefined : it.kind === 'hint' ? (inv.get(it.id) ?? 0) : it.kind === 'streak_freeze' ? p.freezes : undefined,
          equipped: cosmetic && (appearance as Record<string, any>)[it.kind]?.id === it.id, locked: p.level < it.min_level,
          free_unlock: cosmetic && it.price === 0 && it.min_level > 1,
        });
      }
      return { gold: p.gold, level: p.level, freezes: p.freezes, items: out };
    });
  }

  async buy(user: UserRow, itemId: number) {
    return this.db.tx(async (q) => {
      const p = await this.fresh(q, user);
      const s = await this.settings.get();
      const it = (await q<ItemRow>('SELECT * FROM hk_shop_items WHERE id = $1 AND is_active', [itemId]))[0];
      if (!it) throw notFound('vật phẩm');
      if (p.level < it.min_level) throw new ConflictException(`Cần đạt cấp ${it.min_level} để mua vật phẩm này`);
      const cosmetic = ['outfit', 'weapon', 'banner'].includes(it.kind);
      if (cosmetic) {
        if (it.price === 0) throw new ConflictException('Vật phẩm này mở khóa miễn phí khi đủ cấp, không cần mua');
        if (await this.ownsItem(q, user.id, it, p.level)) throw new ConflictException('Em đã sở hữu vật phẩm này');
      } else if (it.kind === 'streak_freeze') {
        if (p.freezes >= s.streak.freeze_max) throw new ConflictException(`Em chỉ giữ tối đa ${s.streak.freeze_max} vật phẩm đóng băng chuỗi`);
      } else if (it.kind === 'heart') {
        if (!(await this.heartsEnabled(q, user.id))) throw new ConflictException('Lớp của em đang tắt cơ chế tim');
        if (p.hearts >= (await this.heartsMax(q, user.id))) throw new ConflictException('Tim của em đã đầy');
      } else if (it.kind === 'hint') {
        const have = (await q<{ qty: number }>('SELECT qty FROM hk_inventory WHERE user_id = $1 AND item_id = $2', [user.id, it.id]))[0]?.qty ?? 0;
        if (have >= s.hint_max) throw new ConflictException(`Em chỉ giữ tối đa ${s.hint_max} gợi ý`);
      }
      if (p.gold < it.price) throw new ConflictException(`Chưa đủ vàng: cần ${it.price}, em có ${p.gold}`);
      const n = Number((await q<{ n: string }>("SELECT count(*) AS n FROM hk_gold_ledger WHERE user_id = $1 AND reason = 'shop'", [user.id]))[0].n) + 1;
      await this.addGold(q, user, -it.price, 'shop', `buy:${n}`);
      if (cosmetic || it.kind === 'hint') await q('INSERT INTO hk_inventory (user_id, item_id, qty) VALUES ($1, $2, 1) ON CONFLICT (user_id, item_id) DO UPDATE SET qty = hk_inventory.qty + 1', [user.id, it.id]);
      else if (it.kind === 'streak_freeze') await q('UPDATE hk_players SET freezes = freezes + 1 WHERE user_id = $1', [user.id]);
      else if (it.kind === 'heart') await q('UPDATE hk_players SET hearts = $2, hearts_at = $3 WHERE user_id = $1', [user.id, await this.heartsMax(q, user.id), this.clock.now()]);
      return { item: it.name, gold: p.gold - it.price };
    });
  }

  private async appearance(q: Q, p: PlayerRow) {
    const out: Record<string, any> = {};
    for (const [kind, key] of SLOTS) {
      const chosen = p.appearance?.[key];
      let item = chosen ? (await q<ItemRow>('SELECT * FROM hk_shop_items WHERE id = $1', [chosen]))[0] : undefined;
      if (item && !(await this.ownsItem(q, p.user_id, item, p.level))) item = undefined;
      if (!item) item = (await q<ItemRow>('SELECT * FROM hk_shop_items WHERE kind = $1 AND price = 0 AND min_level = 1 AND is_active ORDER BY sort_order, id LIMIT 1', [kind]))[0];
      out[kind] = item ? { id: item.id, name: item.name, icon: item.icon, color: item.color } : null;
    }
    return out;
  }

  async setAppearance(user: UserRow, body: { outfit_id?: number | null; weapon_id?: number | null; banner_id?: number | null }) {
    return this.db.tx(async (q) => {
      const p = await this.fresh(q, user);
      const next = { ...(p.appearance ?? {}) } as Record<string, number | null>;
      for (const [kind, key] of SLOTS) {
        const id = body[key];
        if (id === undefined) continue;
        if (id === null) { next[key] = null; continue; }
        const item = (await q<ItemRow>('SELECT * FROM hk_shop_items WHERE id = $1 AND kind = $2 AND is_active', [id, kind]))[0];
        if (!item) throw new BadRequestException(`Vật phẩm #${id} không phải ${kind === 'outfit' ? 'trang phục' : kind === 'weapon' ? 'vũ khí' : 'cờ hiệu'}`);
        if (!(await this.ownsItem(q, user.id, item, p.level))) throw new ForbiddenException(`Em chưa sở hữu hoặc chưa đủ cấp cho "${item.name}"`);
        next[key] = id;
      }
      await q('UPDATE hk_players SET appearance = $2, updated_at = now() WHERE user_id = $1', [user.id, JSON.stringify(next)]);
      return this.appearance(q, { ...p, appearance: next });
    });
  }

  // ------------------------------------------------------------------ tổng quan nhân vật cho HUD (HK.HS.013)
  async me(user: UserRow) {
    if (user.username?.endsWith('.demo') || !this.db.ready) {
      return {
        user: { id: user.id, name: user.nickname || user.full_name },
        class: { id: 1, code: 'warrior', name: 'Chiến Binh', description: 'Tiên phong dũng cảm', icon: 'sword', color: '#dc2626' },
        has_character: true,
        appearance: { hair: 'short', skin: 'fair', outfit: 'armor', cape: 'red' },
        gold: 350,
        binh_thu: 15,
        xp: 1250,
        hints: 3,
        pending_drops: 0,
        unseen_celebrations: 0,
        level: {
          level: 5,
          title: 'Đô Thống',
          xp: 1250,
          floor: 1000,
          next_xp: 1500,
          next_title: 'Đại Tướng Quân',
          progress: 50,
        },
        hearts: { current: 5, max: 5, enabled: true, next_in_ms: null, regen_hours: 1 },
        streak: { current: 7, longest: 14, freezes: 2, freeze_max: 2, last_day: '2026-11-04', at_risk: false },
        daily: { day: '2026-11-04', xp: 45, goal: 50, reached: false, options: [50, 100, 200], selected: 50 },
        league: { tier: 'amethyst', name: 'Amethyst League' },
        gift: { available: true },
        ap: { current: 100, max: 100 },
        buffs: {},
      };
    }
    return this.db.tx(async (q) => {
      const p = await this.refreshAp(q, user);
      const s = await this.settings.get();
      const now = this.clock.now();
      const today = dayKey(now);
      const levels = await this.levels(q);
      const cur = levels.filter((l) => l.xp_required <= p.xp).pop() ?? levels[0];
      const next = levels.find((l) => l.level === (cur?.level ?? 0) + 1) ?? null;
      const day = (await q<{ xp: number; goal: number; reached: boolean }>('SELECT xp, goal, reached FROM hk_daily WHERE user_id = $1 AND day = $2', [user.id, today]))[0];
      const cls = p.class_id ? (await q<Record<string, any>>('SELECT id, code, name, description, icon, color, stats, skills FROM hk_character_classes WHERE id = $1', [p.class_id]))[0] ?? null : null;
      const hints = Number((await q<{ n: string }>("SELECT COALESCE(sum(i.qty), 0) AS n FROM hk_inventory i JOIN hk_shop_items s ON s.id = i.item_id WHERE i.user_id = $1 AND s.kind = 'hint'", [user.id]))[0].n);
      const drops = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_card_drops WHERE user_id = $1 AND flipped_at IS NULL', [user.id]))[0].n);
      const unseen = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_celebrations WHERE user_id = $1 AND seen_at IS NULL', [user.id]))[0].n);
      const active = Boolean(p.streak_last_day) && p.streak_current > 0;
      return {
        user: { id: user.id, name: user.nickname || user.full_name },
        class: cls, has_character: Boolean(p.class_id), appearance: await this.appearance(q, p), gold: p.gold, binh_thu: p.binh_thu, xp: p.xp, hints, pending_drops: drops, unseen_celebrations: unseen,
        level: { level: cur?.level ?? 1, title: cur?.title ?? '', xp: p.xp, floor: cur?.xp_required ?? 0, next_xp: next?.xp_required ?? null, next_title: next?.title ?? null,
          progress: next ? Math.round(((p.xp - (cur?.xp_required ?? 0)) / Math.max(1, next.xp_required - (cur?.xp_required ?? 0))) * 100) : 100 },
        hearts: await this.heartsInfo(q, user, p),
        streak: { current: active ? p.streak_current : 0, longest: p.streak_longest, freezes: p.freezes, freeze_max: s.streak.freeze_max, last_day: p.streak_last_day, at_risk: active && p.streak_last_day !== today },
        daily: { day: today, xp: day?.xp ?? 0, goal: day?.goal ?? p.daily_goal, reached: day?.reached ?? false, options: [...DAILY_GOALS], selected: p.daily_goal },
        league: { tier: tierIndex(s.league.tiers, p.league_tier), name: s.league.tiers[tierIndex(s.league.tiers, p.league_tier)] },
        gift: { available: p.last_gift_day !== today },
        ap: { current: p.ap, max: this.apMax(cur?.level ?? p.level) }, buffs: p.buffs ?? {},
      };
    });
  }

  async classes() {
    if (!this.db.ready) {
      return [
        { id: 1, code: 'chien_binh', name: 'Chiến Binh Đông A', description: 'Dũng mãnh thiện chiến trên trận địa', icon: 'sword', color: '#dc2626', stats: {}, skills: [] },
        { id: 2, code: 'muu_si', name: 'Mưu Sĩ Thăng Long', description: 'Thông tuệ mưu lược, am tường binh pháp', icon: 'book', color: '#2563eb', stats: {}, skills: [] },
      ];
    }
    return this.db.query('SELECT id, code, name, description, icon, color, stats, skills FROM hk_character_classes WHERE is_active ORDER BY sort_order, id');
  }

  async chooseClass(user: UserRow, classId: number) {
    await this.db.tx(async (q) => {
      await this.fresh(q, user);
      if (!(await q('SELECT 1 FROM hk_character_classes WHERE id = $1 AND is_active', [classId])).length) throw new BadRequestException('Lớp nhân vật không tồn tại');
      await q('UPDATE hk_players SET class_id = $2, updated_at = now() WHERE user_id = $1', [user.id, classId]);
    });
    return this.me(user);
  }

  async setGoal(user: UserRow, goal: number) {
    if (!(DAILY_GOALS as readonly number[]).includes(goal)) throw new BadRequestException('Mục tiêu hằng ngày chỉ có thể là 50, 100 hoặc 200 điểm');
    await this.db.tx(async (q) => {
      await this.fresh(q, user);
      await q('UPDATE hk_players SET daily_goal = $2, updated_at = now() WHERE user_id = $1', [user.id, goal]);
      await q('UPDATE hk_daily SET goal = $3 WHERE user_id = $1 AND day = $2 AND NOT reached', [user.id, dayKey(this.clock.now()), goal]);
    });
    return this.me(user);
  }

  // ------------------------------------------------------------------ quà hằng ngày (HK.HS.073)
  async gift(user: UserRow) {
    return this.db.tx(async (q) => {
      const p = await this.fresh(q, user);
      const s = await this.settings.get();
      const today = dayKey(this.clock.now());
      const claimed = p.last_gift_day === today;
      const streak = claimed || p.last_gift_day === addDays(today, -1) ? p.gift_streak : 0;
      const day = claimed ? ((streak - 1) % 7) + 1 : (streak % 7) + 1;
      return { claimed_today: claimed, streak, today_day: day, days: s.gift.gold.map((gold, i) => ({ day: i + 1, gold, freeze: i === 6 && s.gift.freeze_on_day7 })) };
    });
  }

  async claimGift(user: UserRow) {
    const claimed = await this.db.tx(async (q) => {
      const p = await this.fresh(q, user);
      const s = await this.settings.get();
      const today = dayKey(this.clock.now());
      if (p.last_gift_day === today) throw new ConflictException('Hôm nay em đã nhận quà rồi, mai quay lại nhé');
      const streak = p.last_gift_day === addDays(today, -1) ? p.gift_streak + 1 : 1;
      const idx = (streak - 1) % 7;
      const gold = s.gift.gold[idx];
      const freeze = idx === 6 && s.gift.freeze_on_day7 && p.freezes < s.streak.freeze_max;
      await q('UPDATE hk_players SET last_gift_day = $2, gift_streak = $3, freezes = freezes + $4 WHERE user_id = $1', [user.id, today, streak, freeze ? 1 : 0]);
      await this.addGold(q, user, gold, 'gift', `gift:${today}`);
      await this.celebrate(q, user, 'gift', { day: idx + 1, gold, freeze });
      return { day: idx + 1, streak, gold, freeze };
    });
    return { ...claimed, state: await this.gift(user) };
  }

  // ------------------------------------------------------------------ chúc mừng, lịch chuỗi
  async celebrations(user: UserRow) {
    return this.db.query<Record<string, any>>('SELECT id::int AS id, kind, payload, created_at FROM hk_celebrations WHERE user_id = $1 AND seen_at IS NULL ORDER BY id LIMIT 30', [user.id]);
  }

  async acknowledge(user: UserRow, ids: number[]): Promise<void> {
    if (!ids.length) return;
    await this.db.query('UPDATE hk_celebrations SET seen_at = $3 WHERE user_id = $1 AND id = ANY($2) AND seen_at IS NULL', [user.id, ids, this.clock.now()]);
  }

  async streakCalendar(user: UserRow) {
    return this.db.tx(async (q) => {
      const p = await this.fresh(q, user);
      const today = dayKey(this.clock.now());
      const from = addDays(today, -34);
      const rows = await q<{ day: string; xp: number; goal: number; reached: boolean }>('SELECT to_char(day, \'YYYY-MM-DD\') AS day, xp, goal, reached FROM hk_daily WHERE user_id = $1 AND day >= $2 ORDER BY day', [user.id, from]);
      const byDay = new Map(rows.map((r) => [r.day, r]));
      const days = Array.from({ length: 35 }, (_, i) => { const d = addDays(from, i); const r = byDay.get(d); return { day: d, xp: r?.xp ?? 0, goal: r?.goal ?? p.daily_goal, reached: r?.reached ?? false, today: d === today }; });
      return { current: p.streak_current, longest: p.streak_longest, freezes: p.freezes, days };
    });
  }

  /** Bù chuỗi ngày và tim cho mọi người chơi đã qua ngày mới (việc chạy 0 giờ, HK.SYS.003): chia lô nhỏ, mỗi người một giao dịch */
  async settleAll(limit = 500): Promise<number> {
    const today = dayKey(this.clock.now());
    const rows = await this.db.query<{ user_id: number }>(
      `SELECT p.user_id FROM hk_players p WHERE (p.streak_current > 0 AND p.streak_last_day < $1::date - 1) ORDER BY p.user_id LIMIT $2`, [today, limit]);
    for (const r of rows) {
      await this.db.tx(async (q) => {
        const u = (await q<UserRow>('SELECT * FROM app_users WHERE id = $1', [r.user_id]))[0];
        if (u) await this.fresh(q, u);
      });
    }
    return rows.length;
  }
}
