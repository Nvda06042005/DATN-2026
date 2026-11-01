/**
 * Thi đấu trực tiếp kiểu Kahoot (Sprint 8, HK.HS.079–085, HK.GV.051–058, HK.SYS.016): giáo viên tạo phòng từ bộ đề, học sinh của lớp vào bằng mã PIN 6 số,
 * máy chủ giữ toàn bộ trạng thái trận trong PostgreSQL (phòng chờ → câu hỏi → kết quả câu → … → bục vinh quang) nên khởi động lại máy chủ hay mất kết nối không làm mất trận.
 *  - Điểm mỗi câu tính ngay khi nhận đáp án: đúng được từ 50% đến 100% điểm câu tùy tốc độ, sai 0 điểm; đáp án chỉ lộ ở màn hình kết quả của câu.
 *  - Câu hỏi đóng khi hết giờ hoặc khi mọi người đang trực tuyến đã trả lời; giáo viên có thể kết thúc câu sớm, tạm dừng, bỏ qua câu (không tính điểm) hoặc kết thúc trận.
 *  - Cuối trận, điểm quy đổi thành điểm tài khoản (một lần cho mỗi trận) và thưởng cho top 3.
 *  - Chế độ đội: điểm đội là điểm trung bình của các thành viên đã tham gia (công bằng khi đội đông ít khác nhau).
 * Mọi thay đổi trạng thái đi qua một hàm khóa hàng của phòng; gateway chỉ phát lại trạng thái (`changes`) cho người đang kết nối.
 */
import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomInt } from 'crypto';
import { Subject } from 'rxjs';
import { notFound } from '../content/access';
import { QuizService } from '../content/quiz.service';
import { grade, publicView, QuestionCore, seededShuffle } from '../content/questions';
import { ClassroomService } from '../classroom/classroom.service';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { GameService } from '../game/game.service';

export const LIVE_AVATARS = ['star', 'swords', 'shield', 'crown', 'flag', 'flame', 'book', 'scroll', 'gem', 'heart', 'target', 'trophy'] as const;
export type LiveAction = 'start' | 'next' | 'pause' | 'resume' | 'skip' | 'end';
const ACTIONS: LiveAction[] = ['start', 'next', 'pause', 'resume', 'skip', 'end'];
const GRACE_MS = 1500;
const MIN_SECONDS = 5, MAX_SECONDS = 120;
const MAX_OPEN_ROOMS = 5;
const STALE_HOURS = 6;
const XP_DIVISOR = 10, XP_CAP = 150, PODIUM_BONUS = [20, 10, 5];
const NICK = /^[\p{L}\p{N} _.-]{2,20}$/u;

export interface PlanItem { question_id: number; points: number; seconds: number; seed: number; shuffle: boolean; snap: Omit<QuestionCore, 'id'> }
export interface RoomRow {
  id: number; class_id: number; host_id: number | null; quiz_id: number | null; title: string; mode: 'solo' | 'team'; pin: string; state: 'lobby' | 'question' | 'results' | 'ended';
  q_index: number; total: number; plan: PlanItem[]; question_started_at: Date | null; deadline: Date | null; paused_remaining_ms: number | null; skipped: number[]; ended_early: boolean;
  awarded_at: Date | null; created_at: Date; started_at: Date | null; ended_at: Date | null;
}
interface PlayerRow {
  id: number; user_id: number; nickname: string; avatar: string; team_id: number | null; team_name: string | null; score: number; correct_count: number; answered_count: number; online: boolean; xp_awarded: number;
}
interface AnswerRow { player_id: number; q_index: number; answer: unknown; correct: boolean; points: number; elapsed_ms: number }
export type LiveView = Record<string, any>;

const ROOM_COLUMNS = 'id, class_id, host_id, quiz_id, title, mode, pin, state, q_index, total, plan, question_started_at, deadline, paused_remaining_ms, skipped, ended_early, awarded_at, created_at, started_at, ended_at';
/** Điểm một câu: đúng được từ 50% đến 100% điểm tối đa của câu, càng trả lời sớm càng cao; sai hoặc quá giờ 0 điểm */
export const liveScore = (max: number, limitMs: number, elapsedMs: number): number => Math.round(max * (1 - 0.5 * Math.min(1, Math.max(0, elapsedMs / limitMs))));
/** Điểm cộng vào tài khoản học sinh từ điểm trận và hạng cuối trận */
export const accountXp = (score: number, rank: number): number => (score > 0 ? Math.min(XP_CAP, Math.round(score / XP_DIVISOR)) + (PODIUM_BONUS[rank - 1] ?? 0) : 0);

@Injectable()
export class LiveService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Live');
  /** Gateway lắng nghe để phát lại trạng thái; `answered` chỉ phát số người đã trả lời */
  readonly changes = new Subject<{ roomId: number; kind: 'state' | 'answered' }>();
  private readonly timers = new Map<number, NodeJS.Timeout>();
  private readonly attempts = new Map<number, number[]>();

  constructor(private readonly db: DatabaseService, private readonly quizzes: QuizService, private readonly classes: ClassroomService, private readonly game: GameService) {}

  onModuleInit(): void {
    if (!this.db.ready || process.env.LIVE_BOOT === 'off') return;
    // Máy chủ khởi động lại: mọi người chơi phải kết nối lại mới tính là trực tuyến; trận đang diễn ra được nối lại đồng hồ
    void this.db.query('UPDATE hk_live_players SET online = false WHERE online')
      .then(() => this.db.query<{ id: number }>("SELECT id FROM hk_live_rooms WHERE state = 'question'"))
      .then((rows) => Promise.all(rows.map((r) => this.settle(r.id))))
      .catch((e) => this.logger.warn(`Khôi phục phòng thi lỗi: ${(e as Error).message}`));
  }

  onModuleDestroy(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  // ------------------------------------------------------------------ tiện ích
  private read: Q = (sql, params) => this.db.query(sql, params);

  private async lock(q: Q, id: number, mode: 'update' | 'share' | 'none' = 'update'): Promise<RoomRow> {
    const room = (await q<RoomRow>(`SELECT ${ROOM_COLUMNS} FROM hk_live_rooms WHERE id = $1${mode === 'update' ? ' FOR UPDATE' : mode === 'share' ? ' FOR SHARE' : ''}`, [id]))[0];
    if (!room) throw notFound('phòng thi');
    return room;
  }

  private throttle(userId: number): void {
    const now = Date.now();
    const recent = (this.attempts.get(userId) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= 20) throw new HttpException('Em nhập mã quá nhanh, hãy đợi một phút rồi thử lại', HttpStatus.TOO_MANY_REQUESTS);
    recent.push(now);
    this.attempts.set(userId, recent);
  }

  private snap(row: { qtype: QuestionCore['qtype']; prompt: string; image_url: string | null; explanation: string | null; difficulty: number; data: Record<string, unknown> }): PlanItem['snap'] {
    return { qtype: row.qtype, prompt: row.prompt, image_url: row.image_url, explanation: row.explanation, difficulty: row.difficulty, data: row.data };
  }

  private core(item: PlanItem): QuestionCore { return { id: item.question_id, ...item.snap }; }
  private paused(room: RoomRow): boolean { return room.paused_remaining_ms !== null; }
  private remaining(room: RoomRow): number {
    if (room.state !== 'question') return 0;
    return this.paused(room) ? room.paused_remaining_ms! : Math.max(0, (room.deadline?.getTime() ?? 0) - Date.now());
  }

  // ------------------------------------------------------------------ tạo phòng (HK.GV.051)
  async create(user: UserRow, body: { class_id?: number; quiz_id?: number; mode?: string; title?: string }) {
    const mode = body.mode === 'team' ? 'team' : 'solo';
    if (body.mode !== undefined && !['solo', 'team'].includes(String(body.mode))) throw new BadRequestException('Chế độ thi là cá nhân hoặc theo đội');
    const classId = Number(body.class_id), quizId = Number(body.quiz_id);
    if (!Number.isInteger(classId) || !Number.isInteger(quizId)) throw new BadRequestException('Hãy chọn lớp và bộ đề');
    const id = await this.db.tx(async (q) => {
      const cls = await this.classes.mine(q, user, classId, true);
      const quiz = await this.quizzes.load(q, user, quizId);
      const { items } = await this.quizzes.forPlay(q, quizId);
      if (!items.length) throw new ConflictException('Bộ đề chưa có câu hỏi nào');
      if (items.length > 60) throw new ConflictException('Phòng thi tối đa 60 câu hỏi');
      if (mode === 'team') {
        const teams = Number((await q<{ n: string }>('SELECT count(DISTINCT team_id) AS n FROM hk_team_members WHERE class_id = $1', [classId]))[0].n);
        if (teams < 2) throw new ConflictException('Thi theo đội cần lớp đã chia ít nhất 2 đội (vào mục Lớp học → Đội)');
      }
      // Dọn phòng bỏ quên và giới hạn số phòng mở của mỗi giáo viên
      await q(`UPDATE hk_live_rooms SET state = 'ended', ended_at = now(), ended_early = true WHERE state <> 'ended' AND created_at < now() - interval '${STALE_HOURS} hours'`);
      const open = Number((await q<{ n: string }>("SELECT count(*) AS n FROM hk_live_rooms WHERE host_id = $1 AND state <> 'ended'", [user.id]))[0].n);
      if (open >= MAX_OPEN_ROOMS) throw new ConflictException(`Bạn đang có ${open} phòng chưa kết thúc; hãy kết thúc bớt phòng cũ`);
      const seed = randomInt(1, 2_000_000_000);
      const ordered = quiz.shuffle_questions ? seededShuffle(items, seed) : items;
      const plan: PlanItem[] = ordered.map((i, idx) => ({
        question_id: i.question_id, points: i.points, seconds: Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, i.seconds ?? quiz.seconds_per_question)), seed: seed + idx * 101 + 1, shuffle: quiz.shuffle_options, snap: this.snap(i),
      }));
      const title = String(body.title ?? '').trim() || `${quiz.title} – ${cls.name}`;
      if (title.length < 2 || title.length > 120) throw new BadRequestException('Tên phòng từ 2 đến 120 ký tự');
      for (let attempt = 0; attempt < 30; attempt++) {
        const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
        if ((await q('SELECT 1 FROM hk_live_rooms WHERE pin = $1 AND state <> \'ended\'', [pin])).length) continue;
        return (await q<{ id: number }>(
          'INSERT INTO hk_live_rooms (class_id, host_id, quiz_id, title, mode, pin, total, plan) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id', [classId, user.id, quizId, title, mode, pin, plan.length, JSON.stringify(plan)]))[0].id;
      }
      throw new ConflictException('Chưa tạo được mã PIN, hãy thử lại');
    });
    return this.hostState(user, id);
  }

  // ------------------------------------------------------------------ vào phòng (HK.HS.079–080)
  /** Xem trước phòng theo mã PIN trước khi chọn biệt danh; giới hạn số lần thử để không dò mã */
  async lookup(user: UserRow, pin: string) {
    this.throttle(user.id);
    if (!/^[0-9]{6}$/.test(pin)) throw new BadRequestException('Mã PIN gồm 6 chữ số');
    const room = (await this.read<RoomRow & { class_name: string; host_name: string | null }>(
      `SELECT r.id, r.class_id, r.title, r.mode, r.pin, r.state, r.total, c.name AS class_name, u.full_name AS host_name FROM hk_live_rooms r JOIN app_classes c ON c.id = r.class_id LEFT JOIN app_users u ON u.id = r.host_id
       WHERE r.pin = $1 AND r.state <> 'ended'`, [pin]))[0];
    if (!room || !(await this.isMember(this.read, room.class_id, user.id))) throw notFound('phòng thi với mã này (hoặc em không thuộc lớp của phòng)');
    const mine = (await this.read<PlayerRow>('SELECT id, nickname, avatar FROM hk_live_players WHERE room_id = $1 AND user_id = $2', [room.id, user.id]))[0] ?? null;
    return { room_id: room.id, title: room.title, class_name: room.class_name, mode: room.mode, state: room.state, total: room.total, host_name: room.host_name, mine, avatars: LIVE_AVATARS, suggested: await this.suggestNickname(this.read, room.id, user) };
  }

  private async isMember(q: Q, classId: number, userId: number): Promise<boolean> {
    return (await q('SELECT 1 FROM app_class_members m JOIN app_classes c ON c.id = m.class_id WHERE m.class_id = $1 AND m.user_id = $2 AND c.is_active', [classId, userId])).length > 0;
  }

  private async suggestNickname(q: Q, roomId: number, user: UserRow): Promise<string> {
    const base = String(user.nickname || user.full_name.split(/\s+/).slice(-2).join(' ')).replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 17) || 'Chiến sĩ';
    for (let n = 0; n < 50; n++) {
      const name = n ? `${base} ${n + 1}` : base;
      if (name.length >= 2 && !(await q('SELECT 1 FROM hk_live_players WHERE room_id = $1 AND lower(nickname) = lower($2)', [roomId, name])).length) return name;
    }
    return `${base}${randomInt(100, 999)}`.slice(0, 20);
  }

  async join(user: UserRow, body: { pin?: string; nickname?: string; avatar?: string }) {
    this.throttle(user.id);
    const pin = String(body.pin ?? '').trim();
    if (!/^[0-9]{6}$/.test(pin)) throw new BadRequestException('Mã PIN gồm 6 chữ số');
    const joined = await this.db.tx(async (q) => {
      const found = (await q<{ id: number }>("SELECT id FROM hk_live_rooms WHERE pin = $1 AND state <> 'ended'", [pin]))[0];
      if (!found) throw notFound('phòng thi với mã này');
      const room = await this.lock(q, found.id, 'share');
      if (room.state === 'ended') throw new ConflictException('Phòng thi đã kết thúc');
      if (!(await this.isMember(q, room.class_id, user.id))) throw notFound('phòng thi với mã này (hoặc em không thuộc lớp của phòng)');
      const existing = (await q<PlayerRow>('SELECT id, nickname, avatar FROM hk_live_players WHERE room_id = $1 AND user_id = $2', [room.id, user.id]))[0];
      const avatar = body.avatar === undefined ? undefined : String(body.avatar);
      if (avatar !== undefined && !(LIVE_AVATARS as readonly string[]).includes(avatar)) throw new BadRequestException('Hình đại diện không hợp lệ');
      if (existing) {
        // Vào lại phòng (mất mạng, tải lại trang): giữ nguyên người chơi; chỉ đổi biệt danh/hình ở phòng chờ
        if (room.state === 'lobby' && (body.nickname !== undefined || avatar !== undefined)) await this.writeProfile(q, room.id, existing.id, body.nickname ?? existing.nickname, avatar ?? existing.avatar);
        return { roomId: room.id, playerId: existing.id };
      }
      const nickname = body.nickname === undefined || String(body.nickname).trim() === '' ? await this.suggestNickname(q, room.id, user) : String(body.nickname).trim().replace(/\s+/g, ' ');
      if (!NICK.test(nickname)) throw new BadRequestException('Biệt danh từ 2 đến 20 ký tự (chữ, số, khoảng trắng, _ . -)');
      const team = room.mode === 'team' ? (await q<{ team_id: number }>('SELECT team_id FROM hk_team_members WHERE class_id = $1 AND user_id = $2', [room.class_id, user.id]))[0]?.team_id ?? null : null;
      try {
        const id = (await q<{ id: number }>(
          'INSERT INTO hk_live_players (room_id, user_id, nickname, avatar, team_id) VALUES ($1, $2, $3, $4, $5) RETURNING id', [room.id, user.id, nickname, avatar ?? LIVE_AVATARS[user.id % LIVE_AVATARS.length], team]))[0].id;
        return { roomId: room.id, playerId: id };
      } catch (e) {
        if ((e as { code?: string }).code === '23505') throw new ConflictException('Biệt danh này đã có người dùng trong phòng, hãy chọn tên khác');
        throw e;
      }
    });
    this.changes.next({ roomId: joined.roomId, kind: 'state' });
    return { room_id: joined.roomId, player_id: joined.playerId, state: await this.playerState(user, joined.roomId) };
  }

  private async writeProfile(q: Q, roomId: number, playerId: number, nickname: string, avatar: string): Promise<void> {
    const name = String(nickname).trim().replace(/\s+/g, ' ');
    if (!NICK.test(name)) throw new BadRequestException('Biệt danh từ 2 đến 20 ký tự (chữ, số, khoảng trắng, _ . -)');
    if (!(LIVE_AVATARS as readonly string[]).includes(avatar)) throw new BadRequestException('Hình đại diện không hợp lệ');
    try {
      await q('UPDATE hk_live_players SET nickname = $3, avatar = $4 WHERE room_id = $1 AND id = $2', [roomId, playerId, name, avatar]);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ConflictException('Biệt danh này đã có người dùng trong phòng, hãy chọn tên khác');
      throw e;
    }
  }

  /** Đổi biệt danh/hình đại diện trong phòng chờ (HK.HS.080) */
  async setProfile(user: UserRow, roomId: number, body: { nickname?: string; avatar?: string }) {
    await this.db.tx(async (q) => {
      const room = await this.lock(q, roomId, 'share');
      if (room.state !== 'lobby') throw new ConflictException('Trận đã bắt đầu nên không đổi biệt danh được nữa');
      const p = (await q<PlayerRow>('SELECT id, nickname, avatar FROM hk_live_players WHERE room_id = $1 AND user_id = $2', [roomId, user.id]))[0];
      if (!p) throw new ForbiddenException('Em chưa vào phòng này');
      await this.writeProfile(q, roomId, p.id, body.nickname ?? p.nickname, body.avatar ?? p.avatar);
    });
    this.changes.next({ roomId, kind: 'state' });
    return this.playerState(user, roomId);
  }

  /** Trạng thái kết nối: người trực tuyến được chờ khi chốt câu sớm */
  async setOnline(roomId: number, userId: number, online: boolean): Promise<void> {
    await this.db.query('UPDATE hk_live_players SET online = $3 WHERE room_id = $1 AND user_id = $2', [roomId, userId, online]);
    this.changes.next({ roomId, kind: 'state' });
    if (!online) await this.settle(roomId).catch(() => undefined);
  }

  // ------------------------------------------------------------------ điều khiển trận (HK.GV.053)
  async command(user: UserRow, roomId: number, action: string) {
    if (!ACTIONS.includes(action as LiveAction)) throw new BadRequestException(`Lệnh phải là một trong: ${ACTIONS.join(', ')}`);
    await this.db.tx(async (q) => {
      const room = await this.lock(q, roomId);
      if (room.host_id !== user.id) throw notFound('phòng thi');
      await this.apply(q, room, action as LiveAction);
    });
    await this.afterChange(roomId);
    return this.hostState(user, roomId);
  }

  private async startQuestion(q: Q, room: RoomRow, index: number): Promise<void> {
    const seconds = room.plan[index].seconds;
    const now = new Date();
    await q("UPDATE hk_live_rooms SET state = 'question', q_index = $2, question_started_at = $3, deadline = $4, paused_remaining_ms = NULL, started_at = COALESCE(started_at, $3) WHERE id = $1",
      [room.id, index, now, new Date(now.getTime() + seconds * 1000)]);
  }

  private async apply(q: Q, room: RoomRow, action: LiveAction): Promise<void> {
    if (room.state === 'ended') throw new ConflictException('Trận đã kết thúc');
    switch (action) {
      case 'start': {
        if (room.state !== 'lobby') throw new ConflictException('Trận đã bắt đầu');
        const players = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_live_players WHERE room_id = $1', [room.id]))[0].n);
        if (!players) throw new ConflictException('Chưa có học sinh nào vào phòng');
        return this.startQuestion(q, room, 0);
      }
      case 'next':
        if (room.state === 'lobby') throw new ConflictException('Hãy bắt đầu trận trước');
        if (room.state === 'question') return this.toResults(q, room);
        if (room.q_index + 1 < room.total) return this.startQuestion(q, room, room.q_index + 1);
        return this.finish(q, room, false);
      case 'pause':
        if (room.state !== 'question') throw new ConflictException('Chỉ tạm dừng được khi đang có câu hỏi');
        if (this.paused(room)) throw new ConflictException('Trận đang tạm dừng');
        await q('UPDATE hk_live_rooms SET paused_remaining_ms = $2 WHERE id = $1', [room.id, this.remaining(room)]);
        return;
      case 'resume': {
        if (!this.paused(room)) throw new ConflictException('Trận không ở trạng thái tạm dừng');
        const left = room.paused_remaining_ms!;
        const now = Date.now();
        await q('UPDATE hk_live_rooms SET paused_remaining_ms = NULL, deadline = $2, question_started_at = $3 WHERE id = $1',
          [room.id, new Date(now + left), new Date(now - (room.plan[room.q_index].seconds * 1000 - left))]);
        return;
      }
      case 'skip': {
        if (room.state !== 'question') throw new ConflictException('Chỉ bỏ qua được câu đang diễn ra');
        // Câu bị bỏ qua không tính điểm cho ai: trừ lại điểm đã nhận của câu này
        const given = await q<{ player_id: number; correct: boolean; points: number }>('SELECT player_id, correct, points FROM hk_live_answers WHERE room_id = $1 AND q_index = $2', [room.id, room.q_index]);
        for (const a of given) {
          await q('UPDATE hk_live_players SET score = score - $3, correct_count = correct_count - $4, answered_count = answered_count - 1 WHERE room_id = $1 AND id = $2', [room.id, a.player_id, a.points, a.correct ? 1 : 0]);
        }
        await q('DELETE FROM hk_live_answers WHERE room_id = $1 AND q_index = $2', [room.id, room.q_index]);
        await q("UPDATE hk_live_rooms SET skipped = array_append(skipped, $2::smallint), state = 'results', paused_remaining_ms = NULL WHERE id = $1", [room.id, room.q_index]);
        return;
      }
      case 'end':
        return this.finish(q, room, !(room.state === 'results' && room.q_index === room.total - 1));
    }
  }

  private async toResults(q: Q, room: RoomRow): Promise<void> {
    await q("UPDATE hk_live_rooms SET state = 'results', paused_remaining_ms = NULL WHERE id = $1", [room.id]);
  }

  private rank<T extends { score: number }>(list: T[]): Array<T & { rank: number }> {
    const sorted = [...list].sort((a, b) => b.score - a.score);
    return sorted.map((p) => ({ ...p, rank: 1 + sorted.filter((x) => x.score > p.score).length }));
  }

  /** Kết thúc trận: chốt hạng, đổi điểm trận thành điểm tài khoản (một lần, khóa theo phòng) */
  private async finish(q: Q, room: RoomRow, early: boolean): Promise<void> {
    await q("UPDATE hk_live_rooms SET state = 'ended', ended_at = now(), ended_early = $2, paused_remaining_ms = NULL WHERE id = $1", [room.id, early]);
    if (room.awarded_at) return;
    const players = await q<{ id: number; user_id: number; score: number }>('SELECT id, user_id, score FROM hk_live_players WHERE room_id = $1', [room.id]);
    const ranked = this.rank(players);
    for (const p of ranked) {
      const xp = accountXp(p.score, p.rank);
      if (!xp) continue;
      const user = (await q<UserRow>('SELECT * FROM app_users WHERE id = $1', [p.user_id]))[0];
      if (user && (await this.game.awardXp(q, user, xp, 'live', `live:${room.id}`))) await q('UPDATE hk_live_players SET xp_awarded = $2 WHERE id = $1', [p.id, xp]);
    }
    await q('UPDATE hk_live_rooms SET awarded_at = now() WHERE id = $1', [room.id]);
  }

  // ------------------------------------------------------------------ đồng hồ và chốt câu (HK.SYS.016)
  /** Sau mỗi thay đổi: đặt lại đồng hồ chốt câu rồi báo cho gateway phát trạng thái mới */
  private async afterChange(roomId: number): Promise<void> {
    const room = (await this.read<RoomRow>(`SELECT ${ROOM_COLUMNS} FROM hk_live_rooms WHERE id = $1`, [roomId]))[0];
    this.armTimer(room);
    this.changes.next({ roomId, kind: 'state' });
  }

  armTimer(room: RoomRow | undefined): void {
    if (!room) return;
    const old = this.timers.get(room.id);
    if (old) clearTimeout(old);
    this.timers.delete(room.id);
    if (room.state !== 'question' || this.paused(room) || !room.deadline) return;
    const timer = setTimeout(() => { this.timers.delete(room.id); void this.settle(room.id).catch((e) => this.logger.warn(`Chốt câu lỗi: ${(e as Error).message}`)); }, Math.max(0, room.deadline.getTime() - Date.now()) + 40);
    timer.unref?.();
    this.timers.set(room.id, timer);
  }

  /** Đóng câu hỏi khi hết giờ hoặc khi mọi người đang trực tuyến đã trả lời; gọi lại nhiều lần vẫn an toàn */
  async settle(roomId: number): Promise<boolean> {
    const changed = await this.db.tx(async (q) => {
      const room = await this.lock(q, roomId);
      if (room.state !== 'question' || this.paused(room)) return false;
      const late = (room.deadline?.getTime() ?? 0) <= Date.now();
      let everyone = false;
      if (!late) {
        // Chốt sớm khi có người trực tuyến và mọi người trực tuyến đã trả lời (học sinh chỉ dùng HTTP dự phòng không được chờ); không ai trực tuyến thì đợi hết giờ
        const stat = (await q<{ online: string; waiting: string; answered: string }>(
          `SELECT (SELECT count(*) FROM hk_live_players WHERE room_id = $1 AND online) AS online,
                  (SELECT count(*) FROM hk_live_players p WHERE p.room_id = $1 AND p.online AND NOT EXISTS (SELECT 1 FROM hk_live_answers a WHERE a.room_id = p.room_id AND a.player_id = p.id AND a.q_index = $2)) AS waiting,
                  (SELECT count(*) FROM hk_live_answers WHERE room_id = $1 AND q_index = $2) AS answered`, [roomId, room.q_index]))[0];
        everyone = Number(stat.online) > 0 && Number(stat.waiting) === 0 && Number(stat.answered) > 0;
      }
      if (!late && !everyone) return false;
      await this.toResults(q, room);
      return true;
    });
    if (changed) await this.afterChange(roomId);
    return changed;
  }

  // ------------------------------------------------------------------ trả lời (HK.HS.081)
  async answer(user: UserRow, roomId: number, body: { answer?: unknown; q_index?: number }) {
    const index = await this.db.tx(async (q) => {
      const room = await this.lock(q, roomId, 'share');
      if (room.state !== 'question') throw new ConflictException('Hiện không có câu hỏi nào đang mở');
      if (this.paused(room)) throw new ConflictException('Giáo viên đang tạm dừng trận');
      if (body.q_index !== undefined && Number(body.q_index) !== room.q_index) throw new ConflictException('Câu hỏi đã chuyển sang câu khác');
      const player = (await q<PlayerRow>('SELECT id FROM hk_live_players WHERE room_id = $1 AND user_id = $2 FOR UPDATE', [roomId, user.id]))[0];
      if (!player) throw new ForbiddenException('Em chưa vào phòng này');
      const item = room.plan[room.q_index];
      const limit = item.seconds * 1000;
      const elapsed = Date.now() - (room.question_started_at?.getTime() ?? Date.now());
      if (elapsed > limit + GRACE_MS) throw new ConflictException('Đã hết giờ cho câu này');
      const result = grade(item.snap, body.answer);
      const points = result.correct ? liveScore(item.points, limit, elapsed) : 0;
      const ins = await q('INSERT INTO hk_live_answers (room_id, player_id, q_index, answer, correct, points, elapsed_ms) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING RETURNING 1',
        [roomId, player.id, room.q_index, JSON.stringify(body.answer ?? null), result.correct, points, Math.min(elapsed, limit)]);
      if (!ins.length) throw new ConflictException('Em đã trả lời câu này rồi');
      await q('UPDATE hk_live_players SET score = score + $3, correct_count = correct_count + $4, answered_count = answered_count + 1 WHERE room_id = $1 AND id = $2', [roomId, player.id, points, result.correct ? 1 : 0]);
      return room.q_index;
    });
    this.changes.next({ roomId, kind: 'answered' });
    await this.settle(roomId);
    return { received: true, q_index: index };
  }

  // ------------------------------------------------------------------ trạng thái cho từng người xem (HK.HS.081–083, HK.GV.052, 054, 055)
  private async playersOf(q: Q, roomId: number): Promise<PlayerRow[]> {
    return q<PlayerRow>(
      `SELECT p.id, p.user_id, p.nickname, p.avatar, p.team_id, t.name AS team_name, p.score, p.correct_count, p.answered_count, p.online, p.xp_awarded
       FROM hk_live_players p LEFT JOIN hk_teams t ON t.id = p.team_id WHERE p.room_id = $1 ORDER BY p.joined_at, p.id`, [roomId]);
  }

  private teamBoard(players: PlayerRow[]): Array<{ team_id: number; name: string; members: number; score: number; total: number; rank: number }> {
    const groups = new Map<number, PlayerRow[]>();
    for (const p of players) if (p.team_id !== null) groups.set(p.team_id, [...(groups.get(p.team_id) ?? []), p]);
    const rows = [...groups.entries()].map(([team_id, list]) => ({ team_id, name: list[0].team_name ?? `Đội ${team_id}`, members: list.length, total: list.reduce((n, p) => n + p.score, 0), score: Math.round(list.reduce((n, p) => n + p.score, 0) / list.length) }));
    return this.rank(rows);
  }

  private distribution(item: PlanItem, answers: AnswerRow[]): Array<{ id: string; text: string; correct: boolean; count: number }> | null {
    const d = item.snap.data as Record<string, any>;
    const given = (a: AnswerRow) => (a.answer && typeof a.answer === 'object' ? (a.answer as Record<string, any>) : {});
    if (item.snap.qtype === 'single' || item.snap.qtype === 'multiple') {
      const order = ((publicView(this.core(item), item.seed, item.shuffle) as { options?: Array<{ id: string }> }).options ?? []).map((o) => o.id);
      const texts = new Map((d.options as Array<{ id: string; text: string }>).map((o) => [o.id, o.text]));
      const right = (id: string) => (item.snap.qtype === 'single' ? d.correct === id : (d.correct as string[]).includes(id));
      return order.map((id) => ({
        id, text: texts.get(id) ?? id, correct: right(id),
        count: answers.filter((a) => (item.snap.qtype === 'single' ? given(a).choice === id : Array.isArray(given(a).choices) && given(a).choices.includes(id))).length,
      }));
    }
    if (item.snap.qtype === 'truefalse') {
      return [true, false].map((v) => ({ id: String(v), text: v ? 'Đúng' : 'Sai', correct: d.correct === v, count: answers.filter((a) => given(a).value === v).length }));
    }
    return null;
  }

  /** Một lần dựng chung cho cả phòng, rồi ghép phần riêng của từng người xem */
  private async build(room: RoomRow, viewers: Array<{ userId: number }>): Promise<Map<number, LiveView>> {
    const players = await this.playersOf(this.read, room.id);
    const ranked = this.rank(players);
    const rankOf = new Map(ranked.map((p) => [p.id, p.rank]));
    const cls = (await this.read<{ name: string }>('SELECT name FROM app_classes WHERE id = $1', [room.class_id]))[0];
    const host = room.host_id ? (await this.read<{ full_name: string }>('SELECT full_name FROM app_users WHERE id = $1', [room.host_id]))[0] : null;
    const answers = room.q_index >= 0 ? await this.read<AnswerRow>('SELECT player_id, q_index, answer, correct, points, elapsed_ms FROM hk_live_answers WHERE room_id = $1 AND q_index = $2', [room.id, room.q_index]) : [];
    const item = room.q_index >= 0 ? room.plan[room.q_index] : null;
    const teams = room.mode === 'team' ? this.teamBoard(players) : null;
    const top = (n: number) => ranked.slice(0, n).map((p) => ({ rank: p.rank, nickname: p.nickname, avatar: p.avatar, team_name: p.team_name, score: p.score, correct_count: p.correct_count }));
    const skipped = room.skipped.includes(room.q_index);
    const base: LiveView = {
      server_now: Date.now(),
      room: { id: room.id, title: room.title, mode: room.mode, class_id: room.class_id, class_name: cls?.name ?? '', host_name: host?.full_name ?? null, state: room.state, q_index: room.q_index, total: room.total, paused: this.paused(room), pin: room.pin, created_at: room.created_at, ended_early: room.ended_early },
      players: players.map((p) => ({ id: p.id, nickname: p.nickname, avatar: p.avatar, team_id: p.team_id, team_name: p.team_name, online: p.online })),
      player_count: players.length,
      answered: { count: answers.length, online: players.filter((p) => p.online).length },
      question: null, results: null, final: null,
    };
    if (room.state === 'question' && item) {
      base.question = {
        index: room.q_index, total: room.total, qtype: item.snap.qtype, seconds: item.seconds, points_max: item.points, paused: this.paused(room), remaining_ms: this.remaining(room),
        deadline: room.deadline?.getTime() ?? null, view: publicView(this.core(item), item.seed, item.shuffle),
      };
    }
    if (room.state === 'results' && item) {
      const right = answers.filter((a) => a.correct).length;
      base.results = {
        index: room.q_index, qtype: item.snap.qtype, prompt: item.snap.prompt, explanation: item.snap.explanation, answer_key: item.snap.data, skipped,
        stats: { correct: right, wrong: answers.length - right, none: Math.max(0, players.length - answers.length) }, options: skipped ? null : this.distribution(item, answers),
        top: top(5), teams: teams ? teams.slice(0, 5) : null, last: room.q_index === room.total - 1,
      };
    }
    if (room.state === 'ended') base.final = { podium: top(3), ranking: ranked.map((p) => ({ rank: p.rank, nickname: p.nickname, avatar: p.avatar, team_name: p.team_name, score: p.score, correct_count: p.correct_count, answered_count: p.answered_count, xp_awarded: p.xp_awarded })), teams, ended_early: room.ended_early, played: room.q_index + 1 };
    const out = new Map<number, LiveView>();
    for (const v of viewers) {
      const mine = players.find((p) => p.user_id === v.userId);
      const view: LiveView = { ...base, role: room.host_id === v.userId ? 'host' : 'player', me: null };
      if (mine) {
        const given = answers.find((a) => a.player_id === mine.id);
        view.me = {
          player_id: mine.id, nickname: mine.nickname, avatar: mine.avatar, team_id: mine.team_id, team_name: mine.team_name, score: mine.score, rank: rankOf.get(mine.id) ?? null, correct_count: mine.correct_count, answered_count: mine.answered_count,
          answered: Boolean(given), xp_awarded: mine.xp_awarded,
          last: room.state === 'results' || room.state === 'ended' ? (given && !skipped ? { correct: given.correct, points: given.points, elapsed_ms: given.elapsed_ms } : { correct: false, points: 0, elapsed_ms: null }) : null,
        };
      }
      out.set(v.userId, view);
    }
    return out;
  }

  /** Trạng thái cho nhiều người xem cùng lúc (gateway phát cho cả phòng) */
  async views(roomId: number, userIds: number[]): Promise<Map<number, LiveView>> {
    let room = (await this.read<RoomRow>(`SELECT ${ROOM_COLUMNS} FROM hk_live_rooms WHERE id = $1`, [roomId]))[0];
    if (!room) return new Map();
    if (room.state === 'question' && !this.paused(room) && (room.deadline?.getTime() ?? 0) <= Date.now()) {
      await this.settle(roomId);
      room = (await this.read<RoomRow>(`SELECT ${ROOM_COLUMNS} FROM hk_live_rooms WHERE id = $1`, [roomId]))[0];
    } else if (room.state === 'question' && !this.timers.has(roomId)) this.armTimer(room);
    return this.build(room, userIds.map((userId) => ({ userId })));
  }

  async hostState(user: UserRow, roomId: number): Promise<LiveView> {
    const room = (await this.read<RoomRow>(`SELECT ${ROOM_COLUMNS} FROM hk_live_rooms WHERE id = $1`, [roomId]))[0];
    if (!room || room.host_id !== user.id) throw notFound('phòng thi');
    const view = (await this.views(roomId, [user.id])).get(user.id);
    if (!view) throw notFound('phòng thi');
    return view;
  }

  async playerState(user: UserRow, roomId: number): Promise<LiveView> {
    const joined = await this.read('SELECT 1 FROM hk_live_players WHERE room_id = $1 AND user_id = $2', [roomId, user.id]);
    if (!joined.length) throw notFound('phòng thi');
    const view = (await this.views(roomId, [user.id])).get(user.id);
    if (!view) throw notFound('phòng thi');
    // Học sinh không thấy mã PIN chia sẻ (đã biết) nhưng thấy ở phòng chờ; không có dữ liệu nhạy cảm khác
    return view;
  }

  /** Số người đã trả lời câu hiện tại (cập nhật nhẹ cho cả phòng mỗi khi có đáp án mới) */
  async answeredCount(roomId: number): Promise<{ count: number; online: number; q_index: number }> {
    const room = (await this.read<{ q_index: number }>('SELECT q_index FROM hk_live_rooms WHERE id = $1', [roomId]))[0];
    if (!room) return { count: 0, online: 0, q_index: -1 };
    const row = (await this.read<{ count: string; online: string }>(
      `SELECT (SELECT count(*) FROM hk_live_answers WHERE room_id = $1 AND q_index = $2) AS count, (SELECT count(*) FROM hk_live_players WHERE room_id = $1 AND online) AS online`, [roomId, room.q_index]))[0];
    return { count: Number(row.count), online: Number(row.online), q_index: room.q_index };
  }

  /** Quyền tham gia kênh thời gian thực của phòng: giáo viên chủ phòng hoặc học sinh đã vào phòng */
  async role(user: UserRow, roomId: number): Promise<'host' | 'player' | null> {
    const room = (await this.read<{ host_id: number | null }>('SELECT host_id FROM hk_live_rooms WHERE id = $1', [roomId]))[0];
    if (!room) return null;
    if (room.host_id === user.id) return 'host';
    return (await this.read('SELECT 1 FROM hk_live_players WHERE room_id = $1 AND user_id = $2', [roomId, user.id])).length ? 'player' : null;
  }

  // ------------------------------------------------------------------ danh sách và lịch sử (HK.GV.056, HK.HS.084)
  async list(user: UserRow, classId?: number) {
    return this.read(
      `SELECT r.id, r.title, r.mode, r.state, r.total, r.q_index, r.created_at, r.started_at, r.ended_at, r.ended_early, CASE WHEN r.state = 'ended' THEN NULL ELSE r.pin END AS pin, c.id AS class_id, c.name AS class_name,
              (SELECT count(*)::int FROM hk_live_players p WHERE p.room_id = r.id) AS players,
              COALESCE((SELECT round(avg(p.score))::int FROM hk_live_players p WHERE p.room_id = r.id), 0) AS avg_score
       FROM hk_live_rooms r JOIN app_classes c ON c.id = r.class_id WHERE r.host_id = $1 AND ($2::int IS NULL OR r.class_id = $2) ORDER BY r.created_at DESC LIMIT 60`, [user.id, classId ?? null]);
  }

  /** Phòng đang mở trong các lớp của học sinh (không kèm mã PIN: học sinh phải nhập mã giáo viên chiếu) */
  async open(user: UserRow) {
    return this.read(
      `SELECT r.id, r.title, r.mode, r.state, r.total, c.name AS class_name, u.full_name AS host_name, (SELECT count(*)::int FROM hk_live_players p WHERE p.room_id = r.id) AS players,
              EXISTS (SELECT 1 FROM hk_live_players p WHERE p.room_id = r.id AND p.user_id = $1) AS joined
       FROM hk_live_rooms r JOIN app_classes c ON c.id = r.class_id JOIN app_class_members m ON m.class_id = r.class_id AND m.user_id = $1 LEFT JOIN app_users u ON u.id = r.host_id
       WHERE r.state <> 'ended' ORDER BY r.created_at DESC LIMIT 20`, [user.id]);
  }

  async myMatches(user: UserRow) {
    return this.read(
      `SELECT r.id, r.title, r.mode, r.total, r.ended_at, r.q_index, r.ended_early, c.name AS class_name, p.score, p.correct_count, p.answered_count, p.xp_awarded,
              1 + (SELECT count(*)::int FROM hk_live_players o WHERE o.room_id = r.id AND o.score > p.score) AS rank, (SELECT count(*)::int FROM hk_live_players o WHERE o.room_id = r.id) AS players
       FROM hk_live_players p JOIN hk_live_rooms r ON r.id = p.room_id JOIN app_classes c ON c.id = r.class_id WHERE p.user_id = $1 AND r.state = 'ended' ORDER BY r.ended_at DESC NULLS LAST LIMIT 40`, [user.id]);
  }

  /** Xem lại từng câu của một trận đã kết thúc (HK.HS.084) */
  async review(user: UserRow, roomId: number) {
    const room = (await this.read<RoomRow>(`SELECT ${ROOM_COLUMNS} FROM hk_live_rooms WHERE id = $1`, [roomId]))[0];
    const me = room ? (await this.read<PlayerRow>('SELECT id, nickname, score, correct_count, answered_count, xp_awarded FROM hk_live_players WHERE room_id = $1 AND user_id = $2', [roomId, user.id]))[0] : null;
    if (!room || !me) throw notFound('trận đấu');
    if (room.state !== 'ended') throw new ConflictException('Trận chưa kết thúc nên chưa xem lại được');
    const mine = await this.read<AnswerRow>('SELECT player_id, q_index, answer, correct, points, elapsed_ms FROM hk_live_answers WHERE room_id = $1 AND player_id = $2', [roomId, me.id]);
    const all = await this.read<{ q_index: number; correct: number; total: number }>('SELECT q_index, count(*) FILTER (WHERE correct)::int AS correct, count(*)::int AS total FROM hk_live_answers WHERE room_id = $1 GROUP BY q_index', [roomId]);
    const items = room.plan.slice(0, room.q_index + 1).map((item, index) => {
      const a = mine.find((x) => x.q_index === index);
      const stat = all.find((x) => x.q_index === index);
      const skipped = room.skipped.includes(index);
      return {
        index, qtype: item.snap.qtype, prompt: item.snap.prompt, explanation: item.snap.explanation, answer_key: item.snap.data, skipped, answered: Boolean(a), my_answer: a?.answer ?? null,
        correct: a?.correct ?? false, points: a?.points ?? 0, elapsed_ms: a?.elapsed_ms ?? null, class_correct_rate: stat && stat.total ? Math.round((stat.correct / stat.total) * 100) : null,
      };
    });
    const players = await this.playersOf(this.read, roomId);
    return { room: { id: room.id, title: room.title, mode: room.mode, ended_at: room.ended_at, ended_early: room.ended_early }, summary: { score: me.score, correct_count: me.correct_count, answered_count: me.answered_count, xp_awarded: me.xp_awarded, rank: this.rank(players).find((p) => p.id === me.id)?.rank ?? null, players: players.length }, items };
  }

  // ------------------------------------------------------------------ báo cáo trận đấu (HK.GV.056)
  async report(user: UserRow, roomId: number) {
    const room = (await this.read<RoomRow>(`SELECT ${ROOM_COLUMNS} FROM hk_live_rooms WHERE id = $1`, [roomId]))[0];
    if (!room || room.host_id !== user.id) throw notFound('phòng thi');
    const cls = (await this.read<{ name: string }>('SELECT name FROM app_classes WHERE id = $1', [room.class_id]))[0];
    const players = await this.read<PlayerRow & { full_name: string; user_code: string | null }>(
      `SELECT p.id, p.user_id, p.nickname, p.avatar, p.team_id, t.name AS team_name, p.score, p.correct_count, p.answered_count, p.online, p.xp_awarded, u.full_name, u.user_code
       FROM hk_live_players p JOIN app_users u ON u.id = p.user_id LEFT JOIN hk_teams t ON t.id = p.team_id WHERE p.room_id = $1`, [roomId]);
    const answers = await this.read<AnswerRow>('SELECT player_id, q_index, answer, correct, points, elapsed_ms FROM hk_live_answers WHERE room_id = $1', [roomId]);
    const reached = room.state === 'lobby' ? -1 : room.q_index;
    const questions = room.plan.slice(0, reached + 1).map((item, index) => {
      const given = answers.filter((a) => a.q_index === index);
      const right = given.filter((a) => a.correct).length;
      const skipped = room.skipped.includes(index);
      return {
        index, number: index + 1, qtype: item.snap.qtype, prompt: item.snap.prompt, skipped, answered: given.length, correct: right, wrong: given.length - right, none: skipped ? 0 : Math.max(0, players.length - given.length),
        correct_rate: given.length && !skipped ? Math.round((right / given.length) * 100) : null, avg_seconds: given.length ? Math.round(given.reduce((n, a) => n + a.elapsed_ms, 0) / given.length / 100) / 10 : null,
      };
    });
    const scored = questions.filter((x) => !x.skipped && x.correct_rate !== null);
    const hardest = scored.length ? [...scored].sort((a, b) => (a.correct_rate as number) - (b.correct_rate as number) || b.number - a.number)[0] : null;
    const rows = this.rank(players).map((p) => {
      const mine = answers.filter((a) => a.player_id === p.id);
      return {
        rank: p.rank, nickname: p.nickname, full_name: p.full_name, user_code: p.user_code, team_name: p.team_name, score: p.score, correct_count: p.correct_count, answered_count: p.answered_count,
        accuracy: questions.length ? Math.round((p.correct_count / Math.max(1, questions.filter((x) => !x.skipped).length)) * 100) : 0,
        avg_seconds: mine.length ? Math.round(mine.reduce((n, a) => n + a.elapsed_ms, 0) / mine.length / 100) / 10 : null, xp_awarded: p.xp_awarded,
      };
    });
    const answeredAny = questions.reduce((n, x) => n + x.answered, 0);
    const slots = questions.filter((x) => !x.skipped).length * players.length;
    return {
      room: { id: room.id, title: room.title, mode: room.mode, state: room.state, class_name: cls?.name ?? '', created_at: room.created_at, started_at: room.started_at, ended_at: room.ended_at, ended_early: room.ended_early, total: room.total, played: questions.length },
      summary: { players: players.length, avg_score: players.length ? Math.round(players.reduce((n, p) => n + p.score, 0) / players.length) : 0, participation_rate: slots ? Math.round((answeredAny / slots) * 100) : 0, skipped: room.skipped.length },
      hardest, questions, players: rows, teams: room.mode === 'team' ? this.teamBoard(players) : null,
    };
  }
}
