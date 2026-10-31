/**
 * Bảng xếp hạng, giải đấu tuần và hoạt động cấp trường (HK.HS.074–077, HK.QT.044–046, HK.SYS.005–006): bảng lớp / trường / hệ thống (có bộ nhớ đệm),
 * giải đấu tuần theo hạng Đồng – Bạc – Vàng – Kim cương (thăng/giáng hạng khi chốt tuần), cấu hình bảng xếp hạng của trường, cơ chế tim theo lớp,
 * sự kiện/giải đấu cấp trường có thưởng, trao huy hiệu của trường.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { notFound } from '../content/access';
import { addDays, dayStart, GameClock, monthKey, weekKey } from './clock';
import { GameService } from './game.service';
import { LEAGUE_TIERS, SettingsService } from './settings';

export interface SchoolGameSettings { leaderboard_enabled: boolean; leaderboard_scope: 'grade' | 'school'; leaderboard_period: 'week' | 'month' }
interface BoardRow { id: number; nickname: string | null; full_name: string; xp: number }
export interface ContestInput { title: string; description?: string | null; starts_at: string; ends_at: string; class_ids: number[]; rewards?: Record<string, number>; badge_id?: number | null }

const ANON = 'Học sinh ẩn danh';

@Injectable()
export class BoardService {
  private cache = new Map<string, { at: number; rows: BoardRow[] }>();

  constructor(
    private readonly db: DatabaseService,
    private readonly game: GameService,
    private readonly settings: SettingsService,
    private readonly clock: GameClock,
  ) {}

  // ------------------------------------------------------------------ cấu hình của trường và của lớp (HK.QT.044, HK.HS.047)
  async schoolSettings(schoolId: number): Promise<SchoolGameSettings> {
    const row = (await this.db.query<SchoolGameSettings>('SELECT leaderboard_enabled, leaderboard_scope, leaderboard_period FROM hk_school_settings WHERE school_id = $1', [schoolId]))[0];
    return row ?? { leaderboard_enabled: true, leaderboard_scope: 'school', leaderboard_period: 'week' };
  }

  private schoolOf(actor: UserRow, schoolId?: number | null): number {
    if (actor.role === 'school_admin') {
      if (!actor.school_id) throw new ForbiddenException('Tài khoản chưa được gán trường');
      if (schoolId && schoolId !== actor.school_id) throw new ForbiddenException('Chỉ thao tác được trên trường của bạn');
      return actor.school_id;
    }
    if (!schoolId) throw new BadRequestException('Hãy chỉ rõ school_id');
    return schoolId;
  }

  async updateSchoolSettings(actor: UserRow, body: Partial<SchoolGameSettings>, schoolId?: number | null) {
    const id = this.schoolOf(actor, schoolId);
    const cur = await this.schoolSettings(id);
    const next = { ...cur, ...Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)) } as SchoolGameSettings;
    if (!['grade', 'school'].includes(next.leaderboard_scope) || !['week', 'month'].includes(next.leaderboard_period) || typeof next.leaderboard_enabled !== 'boolean') {
      throw new BadRequestException('Cấu hình bảng xếp hạng: phạm vi là khối hoặc toàn trường, chu kỳ là tuần hoặc tháng');
    }
    await this.db.query(
      `INSERT INTO hk_school_settings (school_id, leaderboard_enabled, leaderboard_scope, leaderboard_period, updated_by) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (school_id) DO UPDATE SET leaderboard_enabled = $2, leaderboard_scope = $3, leaderboard_period = $4, updated_by = $5, updated_at = now()`,
      [id, next.leaderboard_enabled, next.leaderboard_scope, next.leaderboard_period, actor.id]);
    this.cache.clear();
    return next;
  }

  /** Lớp do giáo viên phụ trách (hoặc mọi lớp của trường với quản trị viên trường) kèm cấu hình tim */
  async classSettings(actor: UserRow) {
    if (actor.role === 'teacher') {
      return this.db.query(
        `SELECT c.id, c.name, c.grade, c.school_year, COALESCE(cs.hearts_enabled, true) AS hearts_enabled, (SELECT count(*)::int FROM app_class_members m WHERE m.class_id = c.id) AS students
         FROM app_classes c JOIN app_class_teachers t ON t.class_id = c.id LEFT JOIN hk_class_settings cs ON cs.class_id = c.id
         WHERE t.teacher_id = $1 AND c.is_active ORDER BY c.school_year DESC, c.name`, [actor.id]);
    }
    return this.db.query(
      `SELECT c.id, c.name, c.grade, c.school_year, COALESCE(cs.hearts_enabled, true) AS hearts_enabled, (SELECT count(*)::int FROM app_class_members m WHERE m.class_id = c.id) AS students
       FROM app_classes c LEFT JOIN hk_class_settings cs ON cs.class_id = c.id WHERE c.school_id = $1 AND c.is_active ORDER BY c.school_year DESC, c.name`, [this.schoolOf(actor)]);
  }

  async setClassHearts(actor: UserRow, classId: number, enabled: boolean) {
    const ok = actor.role === 'teacher'
      ? (await this.db.query('SELECT 1 FROM app_class_teachers WHERE class_id = $1 AND teacher_id = $2', [classId, actor.id])).length > 0
      : (await this.db.query('SELECT 1 FROM app_classes WHERE id = $1 AND school_id = $2', [classId, actor.school_id])).length > 0;
    if (!ok) throw notFound('lớp');
    await this.db.query(
      `INSERT INTO hk_class_settings (class_id, hearts_enabled, updated_by) VALUES ($1, $2, $3) ON CONFLICT (class_id) DO UPDATE SET hearts_enabled = $2, updated_by = $3, updated_at = now()`, [classId, enabled, actor.id]);
    return { class_id: classId, hearts_enabled: enabled };
  }

  // ------------------------------------------------------------------ bảng xếp hạng (HK.HS.074–076, HK.SYS.005)
  private range(period: string): [Date, Date] | null {
    const now = this.clock.now();
    if (period === 'week') { const k = weekKey(now); return [dayStart(k), dayStart(addDays(k, 7))]; }
    if (period === 'month') {
      const k = monthKey(now);
      const [y, m] = k.split('-').map(Number);
      return [dayStart(`${k}-01`), dayStart(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`)];
    }
    return null;
  }

  private async rows(key: string, sql: string, params: unknown[]): Promise<BoardRow[]> {
    const ttl = (await this.settings.get()).leaderboard_cache_seconds * 1000;
    const hit = this.cache.get(key);
    if (hit && ttl > 0 && Date.now() - hit.at < ttl) return hit.rows;
    const rows = await this.db.query<BoardRow>(sql, params);
    this.cache.set(key, { at: Date.now(), rows });
    if (this.cache.size > 500) this.cache.clear();
    return rows;
  }

  async leaderboard(user: UserRow, scope: 'class' | 'school' | 'system', period: string | undefined, classId?: number) {
    const sizeLimit = 500;
    const sums = (range: [Date, Date] | null) => `LEFT JOIN hk_points p ON p.user_id = u.id${range ? ' AND p.created_at >= $2 AND p.created_at < $3' : ''}`;
    let label = '';
    let rows: BoardRow[];
    let used = period && ['week', 'month', 'all'].includes(period) ? period : 'week';
    let anonymous = false;
    if (scope === 'class') {
      const mine = await this.db.query<{ class_id: number; name: string }>('SELECT m.class_id, c.name FROM app_class_members m JOIN app_classes c ON c.id = m.class_id WHERE m.user_id = $1 ORDER BY c.school_year DESC, c.name', [user.id]);
      const cls = classId ? mine.find((c) => c.class_id === classId) : mine[0];
      if (!cls) throw new ForbiddenException(classId ? 'Em không thuộc lớp này' : 'Em chưa tham gia lớp nào nên chưa có bảng xếp hạng lớp');
      const range = this.range(used);
      label = `Lớp ${cls.name}`;
      rows = await this.rows(`class|${cls.class_id}|${used}`,
        `SELECT u.id, u.nickname, u.full_name, COALESCE(sum(p.points), 0)::int AS xp FROM app_class_members m JOIN app_users u ON u.id = m.user_id AND u.role = 'student' AND u.is_active::int = 1
         ${sums(range)} WHERE m.class_id = $1 GROUP BY u.id ORDER BY xp DESC, u.id LIMIT ${sizeLimit}`, range ? [cls.class_id, range[0], range[1]] : [cls.class_id]);
    } else {
      anonymous = true;
      const cfg = user.school_id ? await this.schoolSettings(user.school_id) : { leaderboard_enabled: true, leaderboard_scope: 'school' as const, leaderboard_period: 'week' as const };
      if (!cfg.leaderboard_enabled) throw new ForbiddenException('Nhà trường đang tắt bảng xếp hạng');
      if (scope === 'school' && !user.school_id) throw new ForbiddenException('Tài khoản tự học không thuộc trường nên không có bảng xếp hạng trường');
      used = cfg.leaderboard_period;
      const range = this.range(used);
      const grade = scope === 'school' && cfg.leaderboard_scope === 'grade' && user.grade ? user.grade : null;
      label = scope === 'system' ? 'Toàn hệ thống' : grade ? `Khối ${grade} của trường` : 'Toàn trường';
      const params: unknown[] = range ? [scope === 'school' ? user.school_id : 0, range[0], range[1]] : [scope === 'school' ? user.school_id : 0];
      const gradeSql = grade ? ` AND u.grade = $${params.push(grade)}` : '';
      rows = await this.rows(`${scope}|${scope === 'school' ? user.school_id : 0}|${used}|${grade ?? 0}`,
        `SELECT u.id, u.nickname, u.full_name, COALESCE(sum(p.points), 0)::int AS xp FROM app_users u ${sums(range)}
         WHERE u.role = 'student' AND u.is_active::int = 1 AND ($1 = 0 OR u.school_id = $1)${gradeSql} GROUP BY u.id HAVING COALESCE(sum(p.points), 0) > 0 ORDER BY xp DESC, u.id LIMIT ${sizeLimit}`, params);
    }
    const ranked = rows.map((r, i) => ({ ...r, rank: 1 + rows.filter((x) => x.xp > r.xp).length, pos: i }));
    const view = (r: (typeof ranked)[number]) => ({ rank: r.rank, name: r.id === user.id ? 'Em' : anonymous ? (r.nickname || ANON) : (r.nickname || r.full_name), xp: r.xp, me: r.id === user.id });
    const me = ranked.find((r) => r.id === user.id);
    const top = ranked.slice(0, 20).map(view);
    return { scope, period: used, label, entries: me && !top.some((e) => e.me) ? [...top, view(me)] : top, me: me ? { rank: me.rank, xp: me.xp } : null, size: rows.length };
  }

  // ------------------------------------------------------------------ giải đấu tuần (HK.HS.077, HK.SYS.006)
  async league(user: UserRow) {
    return this.db.tx(async (q) => {
      await this.settleLeagues(q);
      const p = await this.game.fresh(q, user);
      const now = this.clock.now();
      const week = weekKey(now);
      await this.game.leagueAdd(q, user, 0, now);
      const mine = (await q<{ tier: number; group_no: number }>('SELECT tier, group_no FROM hk_league_members WHERE week_key = $1 AND user_id = $2', [week, user.id]))[0];
      const s = await this.settings.get();
      const members = await q<{ user_id: number; nickname: string | null; xp: number }>(
        `SELECT m.user_id, u.nickname, m.xp FROM hk_league_members m JOIN app_users u ON u.id = m.user_id WHERE m.week_key = $1 AND m.tier = $2 AND m.group_no = $3 ORDER BY m.xp DESC, m.user_id`, [week, mine.tier, mine.group_no]);
      const size = members.length;
      const promote = Math.min(s.league.promote, Math.floor(size / 2));
      const demote = size > promote + s.league.demote ? s.league.demote : 0;
      return {
        week, ends_at: dayStart(addDays(week, 7)), tier: mine.tier, tier_name: LEAGUE_TIERS[mine.tier], tiers: [...LEAGUE_TIERS], size, promote, demote, saved_tier: p.league_tier,
        entries: members.map((m, i) => ({ rank: i + 1, name: m.user_id === user.id ? 'Em' : m.nickname || ANON, xp: m.xp, me: m.user_id === user.id, zone: m.xp > 0 && i < promote ? 'promote' : demote && i >= size - demote ? 'demote' : 'stay' })),
      };
    });
  }

  /** Chốt các tuần đã qua một lần: top nhóm thăng hạng, cuối nhóm giáng hạng (nhóm quá nhỏ thì không giáng) */
  async settleLeagues(q: Q): Promise<number> {
    const current = weekKey(this.clock.now());
    const weeks = await q<{ week_key: string }>('SELECT DISTINCT week_key FROM hk_league_members WHERE week_key < $1 AND week_key NOT IN (SELECT week_key FROM hk_league_weeks) ORDER BY week_key', [current]);
    const s = await this.settings.get();
    for (const { week_key } of weeks) {
      const claimed = await q('INSERT INTO hk_league_weeks (week_key, closed_at) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING week_key', [week_key, this.clock.now()]);
      if (!claimed.length) continue;
      const rows = await q<{ user_id: number; tier: number; group_no: number; xp: number }>('SELECT user_id, tier, group_no, xp FROM hk_league_members WHERE week_key = $1 ORDER BY tier, group_no, xp DESC, user_id', [week_key]);
      const groups = new Map<string, typeof rows>();
      for (const r of rows) groups.set(`${r.tier}|${r.group_no}`, [...(groups.get(`${r.tier}|${r.group_no}`) ?? []), r]);
      for (const members of groups.values()) {
        const size = members.length;
        const promote = Math.min(s.league.promote, Math.floor(size / 2));
        const demote = size > promote + s.league.demote ? s.league.demote : 0;
        for (const [i, m] of members.entries()) {
          const up = m.xp > 0 && i < promote && m.tier < LEAGUE_TIERS.length - 1;
          const down = !up && demote > 0 && i >= size - demote && m.tier > 0;
          const tier = up ? m.tier + 1 : down ? m.tier - 1 : m.tier;
          await q('UPDATE hk_players SET league_tier = $2 WHERE user_id = $1', [m.user_id, tier]);
          await q('INSERT INTO hk_celebrations (user_id, kind, payload, created_at) VALUES ($1, $2, $3, $4)', [m.user_id, 'league', JSON.stringify({ week: week_key, rank: i + 1, from: LEAGUE_TIERS[m.tier], to: LEAGUE_TIERS[tier], result: up ? 'promote' : down ? 'demote' : 'stay' }), this.clock.now()]);
        }
      }
    }
    return weeks.length;
  }

  // ------------------------------------------------------------------ sự kiện / giải đấu cấp trường (HK.QT.045)
  private async checkContest(actor: UserRow, input: Partial<ContestInput>, partial: boolean) {
    const school = this.schoolOf(actor);
    const title = String(input.title ?? '').trim().replace(/\s+/g, ' ');
    if (!partial || input.title !== undefined) if (title.length < 2 || title.length > 120) throw new BadRequestException('Tên sự kiện cần từ 2 đến 120 ký tự');
    const starts = input.starts_at ? new Date(input.starts_at) : null;
    const ends = input.ends_at ? new Date(input.ends_at) : null;
    if ((!partial && (!starts || !ends)) || (starts && Number.isNaN(starts.getTime())) || (ends && Number.isNaN(ends.getTime()))) throw new BadRequestException('Thời gian bắt đầu và kết thúc không hợp lệ');
    if (starts && ends && ends <= starts) throw new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu');
    const classIds = [...new Set(input.class_ids ?? [])];
    if (!partial && !classIds.length) throw new BadRequestException('Hãy chọn ít nhất một lớp tham gia');
    if (classIds.length) {
      const ok = await this.db.query('SELECT id FROM app_classes WHERE school_id = $1 AND id = ANY($2)', [school, classIds]);
      if (ok.length !== classIds.length) throw new BadRequestException('Có lớp không thuộc trường của bạn');
    }
    const rewards: Record<string, number> = {};
    for (const key of ['first', 'second', 'third', 'participation']) {
      const v = Number(input.rewards?.[key] ?? 0);
      if (!Number.isInteger(v) || v < 0 || v > 10000) throw new BadRequestException('Phần thưởng vàng từ 0 đến 10000');
      rewards[key] = v;
    }
    if (input.badge_id) {
      const badge = await this.db.query('SELECT id FROM hk_badges WHERE id = $1 AND is_active AND (scope = \'system\' OR school_id = $2)', [input.badge_id, school]);
      if (!badge.length) throw new BadRequestException('Huy hiệu thưởng không tồn tại hoặc không thuộc trường của bạn');
    }
    return { school, title, description: input.description === undefined ? undefined : String(input.description ?? '').trim() || null, starts, ends, classIds, rewards, badgeId: input.badge_id ?? null };
  }

  async createContest(actor: UserRow, input: ContestInput) {
    const c = await this.checkContest(actor, input, false);
    const id = await this.db.tx(async (q) => {
      const row = (await q<{ id: number }>(
        'INSERT INTO hk_contests (school_id, title, description, starts_at, ends_at, rewards, badge_id, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        [c.school, c.title, c.description ?? null, c.starts, c.ends, JSON.stringify(c.rewards), c.badgeId, actor.id]))[0];
      for (const classId of c.classIds) await q('INSERT INTO hk_contest_classes (contest_id, class_id) VALUES ($1, $2)', [row.id, classId]);
      return row.id;
    });
    return this.contest(actor, id);
  }

  async updateContest(actor: UserRow, id: number, input: Partial<ContestInput>) {
    const cur = await this.loadContest(actor, id);
    if (cur.settled_at) throw new ConflictException('Sự kiện đã kết thúc và đã trao thưởng nên không sửa được');
    if (new Date(cur.starts_at) <= this.clock.now()) throw new ConflictException('Sự kiện đã bắt đầu nên không sửa được; hãy xóa và tạo lại nếu cần');
    const merged = { title: cur.title, description: cur.description, starts_at: cur.starts_at, ends_at: cur.ends_at, rewards: cur.rewards, badge_id: cur.badge_id, ...input } as ContestInput;
    const c = await this.checkContest(actor, { ...merged, class_ids: input.class_ids ?? [] }, true);
    await this.db.tx(async (q) => {
      await q('UPDATE hk_contests SET title = $2, description = $3, starts_at = $4, ends_at = $5, rewards = $6, badge_id = $7 WHERE id = $1',
        [id, c.title || cur.title, c.description === undefined ? cur.description : c.description, c.starts ?? cur.starts_at, c.ends ?? cur.ends_at, JSON.stringify(c.rewards), c.badgeId]);
      if (input.class_ids) {
        await q('DELETE FROM hk_contest_classes WHERE contest_id = $1', [id]);
        for (const classId of c.classIds) await q('INSERT INTO hk_contest_classes (contest_id, class_id) VALUES ($1, $2)', [id, classId]);
      }
    });
    return this.contest(actor, id);
  }

  async deleteContest(actor: UserRow, id: number): Promise<void> {
    const cur = await this.loadContest(actor, id);
    if (cur.settled_at) throw new ConflictException('Sự kiện đã trao thưởng nên được giữ lại để xem kết quả');
    await this.db.query('DELETE FROM hk_contests WHERE id = $1', [id]);
  }

  private async loadContest(actor: UserRow, id: number) {
    const c = (await this.db.query<Record<string, any>>('SELECT * FROM hk_contests WHERE id = $1', [id]))[0];
    if (!c || c.school_id !== this.schoolOf(actor)) throw notFound('sự kiện');
    return c;
  }

  private statusOf(c: { starts_at: Date; ends_at: Date } | Record<string, any>): 'upcoming' | 'active' | 'ended' {
    const now = this.clock.now();
    return now < new Date(c.starts_at) ? 'upcoming' : now >= new Date(c.ends_at) ? 'ended' : 'active';
  }

  async contest(actor: UserRow, id: number) {
    const c = await this.loadContest(actor, id);
    const classes = await this.db.query('SELECT cc.class_id AS id, k.name FROM hk_contest_classes cc JOIN app_classes k ON k.id = cc.class_id WHERE cc.contest_id = $1 ORDER BY k.name', [id]);
    return { ...c, status: this.statusOf(c), classes };
  }

  async contests(actor: UserRow) {
    await this.settleContests();
    const rows = await this.db.query<Record<string, any>>(
      `SELECT c.*, COALESCE((SELECT json_agg(json_build_object('id', k.id, 'name', k.name) ORDER BY k.name) FROM hk_contest_classes cc JOIN app_classes k ON k.id = cc.class_id WHERE cc.contest_id = c.id), '[]'::json) AS classes
       FROM hk_contests c WHERE c.school_id = $1 ORDER BY c.starts_at DESC`, [this.schoolOf(actor)]);
    return rows.map((c) => ({ ...c, status: this.statusOf(c as never) }));
  }

  /** Bảng của một sự kiện: học sinh các lớp tham gia, điểm trong thời gian diễn ra */
  private async contestRows(id: number): Promise<BoardRow[]> {
    const c = (await this.db.query<{ starts_at: Date; ends_at: Date }>('SELECT starts_at, ends_at FROM hk_contests WHERE id = $1', [id]))[0];
    if (!c) throw notFound('sự kiện');
    return this.db.query<BoardRow>(
      `SELECT u.id, u.nickname, u.full_name, COALESCE(sum(p.points), 0)::int AS xp FROM app_users u
       JOIN (SELECT DISTINCT m.user_id FROM app_class_members m JOIN hk_contest_classes cc ON cc.class_id = m.class_id WHERE cc.contest_id = $1) mem ON mem.user_id = u.id
       LEFT JOIN hk_points p ON p.user_id = u.id AND p.created_at >= $2 AND p.created_at < $3 AND p.reason IN ('node', 'lesson', 'practice')
       WHERE u.role = 'student' AND u.is_active::int = 1 GROUP BY u.id ORDER BY xp DESC, u.id`, [id, c.starts_at, c.ends_at]);
  }

  async studentContests(user: UserRow) {
    await this.settleContests();
    const rows = await this.db.query<Record<string, any>>(
      `SELECT DISTINCT c.id, c.title, c.description, c.starts_at, c.ends_at, c.rewards, c.settled_at FROM hk_contests c
       JOIN hk_contest_classes cc ON cc.contest_id = c.id JOIN app_class_members m ON m.class_id = cc.class_id AND m.user_id = $1 ORDER BY c.starts_at DESC`, [user.id]);
    const out = [];
    for (const c of rows) {
      const board = await this.contestRows(c.id);
      const mine = board.find((r) => r.id === user.id);
      out.push({ ...c, status: this.statusOf(c as never), my_xp: mine?.xp ?? 0, my_rank: mine && mine.xp > 0 ? 1 + board.filter((r) => r.xp > mine.xp).length : null, participants: board.filter((r) => r.xp > 0).length });
    }
    return out;
  }

  async contestBoard(user: UserRow, id: number) {
    const allowed = user.role === 'school_admin'
      ? (await this.db.query('SELECT 1 FROM hk_contests WHERE id = $1 AND school_id = $2', [id, user.school_id])).length > 0
      : (await this.db.query('SELECT 1 FROM hk_contest_classes cc JOIN app_class_members m ON m.class_id = cc.class_id AND m.user_id = $2 WHERE cc.contest_id = $1', [id, user.id])).length > 0;
    if (!allowed) throw notFound('sự kiện');
    const rows = (await this.contestRows(id)).filter((r) => r.xp > 0);
    return { entries: rows.slice(0, 30).map((r) => ({ rank: 1 + rows.filter((x) => x.xp > r.xp).length, name: r.id === user.id ? 'Em' : r.nickname || r.full_name, xp: r.xp, me: r.id === user.id })) };
  }

  /** Trao thưởng các sự kiện đã kết thúc (một lần): vàng theo hạng, vàng tham gia, huy hiệu cho hạng nhất */
  async settleContests(): Promise<number> {
    const due = await this.db.query<{ id: number }>('SELECT id FROM hk_contests WHERE ends_at <= $1 AND settled_at IS NULL ORDER BY id', [this.clock.now()]);
    let done = 0;
    for (const { id } of due) {
      const ok = await this.db.tx(async (q) => {
        const c = (await q<Record<string, any>>('SELECT * FROM hk_contests WHERE id = $1 AND settled_at IS NULL FOR UPDATE', [id]))[0];
        if (!c) return false;
        const board = (await this.contestRows(id)).filter((r) => r.xp > 0);
        const rewards = c.rewards as Record<string, number>;
        for (const [i, r] of board.entries()) {
          const user = (await q<UserRow>('SELECT * FROM app_users WHERE id = $1', [r.id]))[0];
          const rank = i + 1;
          const gold = (rank === 1 ? rewards.first : rank === 2 ? rewards.second : rank === 3 ? rewards.third : 0) + (rewards.participation ?? 0);
          if (gold > 0) await this.game.addGold(q, user, gold, 'contest', `contest:${id}`);
          if (rank === 1 && c.badge_id) {
            const badge = (await q<{ id: number; name: string; icon: string; color: string }>('SELECT id, name, icon, color FROM hk_badges WHERE id = $1', [c.badge_id]))[0];
            if (badge) await this.game.awardBadge(q, user, badge, null);
          }
          await this.game.celebrate(q, user, 'contest', { title: c.title, rank, gold, xp: r.xp });
        }
        await q('UPDATE hk_contests SET settled_at = $2 WHERE id = $1', [id, this.clock.now()]);
        return true;
      });
      if (ok) done += 1;
    }
    return done;
  }

  // ------------------------------------------------------------------ trao huy hiệu của trường (HK.QT.046)
  async awardBadge(actor: UserRow, badgeId: number, userIds: number[]) {
    if (!userIds.length || userIds.length > 100) throw new BadRequestException('Hãy chọn từ 1 đến 100 học sinh');
    return this.db.tx(async (q) => {
      const badge = (await q<{ id: number; name: string; icon: string; color: string; scope: string; school_id: number | null; rule: unknown }>('SELECT id, name, icon, color, scope, school_id, rule FROM hk_badges WHERE id = $1 AND is_active', [badgeId]))[0];
      if (!badge || badge.scope !== 'school' || badge.school_id !== actor.school_id) throw notFound('huy hiệu của trường');
      const students = await q<UserRow>(
        actor.role === 'teacher'
          ? `SELECT DISTINCT u.* FROM app_users u JOIN app_class_members m ON m.user_id = u.id JOIN app_class_teachers t ON t.class_id = m.class_id AND t.teacher_id = $2 WHERE u.id = ANY($1) AND u.role = 'student' AND u.school_id = $3`
          : `SELECT u.* FROM app_users u WHERE u.id = ANY($1) AND u.role = 'student' AND u.school_id = $3 AND $2::int IS NOT NULL`, [userIds, actor.id, actor.school_id]);
      if (students.length !== new Set(userIds).size) throw new ForbiddenException(actor.role === 'teacher' ? 'Chỉ trao được cho học sinh trong lớp bạn phụ trách' : 'Có học sinh không thuộc trường của bạn');
      let awarded = 0;
      for (const s of students) {
        await this.game.ensurePlayer(q, s);
        if (await this.game.awardBadge(q, s, badge, actor.id)) awarded += 1;
      }
      return { badge: badge.name, awarded, already: students.length - awarded };
    });
  }
}
