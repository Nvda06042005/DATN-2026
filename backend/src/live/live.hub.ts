/**
 * Thi đấu cả lớp theo thời gian thực (kiểu Kahoot).
 * - Giáo viên mở phòng; server sinh mã PIN 6 chữ số và chọn câu trắc nghiệm / đúng-sai trong ngân hàng của game.
 * - Học sinh cùng lớp vào phòng bằng PIN. Server giữ đáp án, chấm từng câu, tính điểm theo tốc độ và chuỗi câu đúng;
 *   đáp án chỉ gửi xuống khi hết giờ hoặc cả lớp đã trả lời.
 * - Mỗi câu trả lời được ghi vào tiến độ thật (BKT, XP, Ấn Tín); trận kết thúc được lưu lịch sử (app_live_sessions).
 * Trạng thái phòng nằm trong bộ nhớ nên backend chạy MỘT tiến trình; mất kết nối thì client tự nối lại và vào lại phòng.
 */
import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';
import { WebSocket } from 'ws';
import { DatabaseService, LiveResultInput, nowIso, UserRow } from '../database/database.service';
import { BankQuestion, ContentService } from '../student/content.service';
import { StudentService } from '../student/student.service';

const QUESTION_COUNTS = [5, 10, 15];
const DEFAULT_TITLE = 'Thi đấu Lịch sử 7';
const MAX_PLAYERS = 80;
const MAX_ROOMS = 300;
const MAX_FAILED_JOINS = 8; // nhập sai PIN quá số lần này trong 1 phút thì tạm khóa
const FAILED_JOIN_WINDOW_MS = 60_000;
const ANSWER_GRACE_MS = 1000; // bù độ trễ mạng khi bấm sát giờ
const HOST_GRACE_MS = 15 * 60_000; // giáo viên rời phòng quá lâu thì đóng phòng
const ROOM_MAX_MS = 4 * 3_600_000;
const LIVE_TYPES = new Set(['mcq', 'tf']);
const TF_OPTIONS = [
  { key: true, text: 'Đúng' },
  { key: false, text: 'Sai' },
];
/** Phạm vi câu hỏi giáo viên chọn (theo nhóm cụm tri thức của bài học) */
const SCOPE_CATEGORIES: Record<string, string[]> = {
  '1258': ['KHANG_CHIEN_LAN_1_1258'],
  '1285': ['BINH_THAN_TRAN_QUOC_TOAN', 'DIEN_HONG_HICH_TUONG_SI', 'KHANG_CHIEN_LAN_2_1285'],
  '1288': ['HAI_CHIEN_VAN_DON_1288', 'DAI_THANG_BACH_DANG_1288'],
};
const SCOPE_EXTRA_UNITS: Record<string, string[]> = { '1288': ['GAME_TRAN_KHANH_DU'] };

export const ERRORS: Record<string, string> = {
  auth: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
  role: 'Phòng thi đấu chỉ dành cho giáo viên và học sinh',
  no_class: 'Tài khoản chưa được gán lớp – nhờ quản trị viên cập nhật',
  busy: 'Máy chủ đang có quá nhiều phòng thi đấu, thử lại sau ít phút',
  no_questions: 'Chưa có câu hỏi phù hợp cho phạm vi này',
  no_room: 'Chưa có phòng thi đấu nào đang mở',
  not_found: 'Không tìm thấy phòng của lớp em với mã PIN này',
  banned: 'Em đã được mời ra khỏi phòng này',
  locked: 'Phòng đã khóa, không nhận thêm người chơi',
  full: 'Phòng đã đủ người chơi',
  no_players: 'Chờ ít nhất một học sinh vào phòng',
  bad_phase: 'Thao tác không hợp lệ ở bước này',
  bad_choice: 'Lựa chọn không hợp lệ',
  time_up: 'Đã hết giờ trả lời câu này',
  too_many: 'Nhập sai mã PIN quá nhiều lần – chờ 1 phút rồi thử lại',
  bad_request: 'Yêu cầu không hợp lệ',
};

/** Đúng ngay lập tức được 1000 điểm, sát giờ còn 500; thêm 100 cho mỗi câu đúng liên tiếp trước đó (tối đa 500) */
export function pointsFor(correct: boolean, elapsedMs: number, streak: number, durationMs: number): number {
  if (!correct) return 0;
  const ratio = Math.min(Math.max(elapsedMs, 0), durationMs) / durationMs;
  return Math.round(1000 * (1 - ratio / 2)) + Math.min(streak, 5) * 100;
}

type Key = number | boolean | string;
type Msg = Record<string, unknown>;
type Phase = 'lobby' | 'question' | 'reveal' | 'scoreboard' | 'podium';
interface ServedLive {
  id: string;
  type: string;
  prompt: string;
  topic: string;
  options: Array<{ key: Key; text: string }>;
}

/** Một kết nối WebSocket đã đăng nhập */
export class Conn {
  closed = false;

  constructor(
    readonly ws: WebSocket,
    readonly user: UserRow,
  ) {
    ws.on('close', () => (this.closed = true));
  }

  get alive(): boolean {
    return !this.closed && this.ws.readyState === WebSocket.OPEN;
  }

  send(msg: Msg): void {
    if (!this.alive) return;
    if (this.ws.bufferedAmount > 1_000_000) return this.close(1013); // máy quá chậm: ngắt để client nối lại nhận trạng thái mới nhất
    this.ws.send(JSON.stringify(msg));
  }

  close(code = 1000): void {
    if (this.closed) return;
    this.closed = true;
    this.ws.close(code);
  }
}

interface Player {
  id: number;
  name: string;
  user: UserRow;
  conn: Conn | null;
  score: number;
  streak: number;
  correct: number;
  answered: number;
  lastGain: number;
  lastCorrect: boolean | null;
  current: { key: Key; correct: boolean; gain: number } | null;
}

interface Room {
  pin: string;
  hostId: number;
  schoolId: number | null;
  className: string;
  title: string;
  scope: string;
  questions: BankQuestion[];
  served: ServedLive[];
  host: Conn | null;
  phase: Phase;
  index: number;
  locked: boolean;
  players: Map<number, Player>;
  banned: Set<number>;
  stats: Array<{ id: string; answered: number; correct: number; counts: number[] }>;
  qStarted: number;
  deadline: number;
  timer: NodeJS.Timeout | null;
  created: number;
  hostLeft: number | null;
  startedAt: string | null;
  saved: boolean;
  sessionId: number | null;
}

const online = (p: Player): boolean => p.conn !== null && p.conn.alive;
const sameKey = (a: unknown, b: unknown): boolean => typeof a === typeof b && a === b;

@Injectable()
export class LiveHub {
  private readonly logger = new Logger('Live');
  private readonly rooms = new Map<string, Room>();
  private readonly byHost = new Map<number, string>();
  private readonly byPlayer = new Map<number, string>();
  private readonly failedJoins = new Map<number, { fails: number; since: number }>();
  private readonly tails = new Map<number, Promise<unknown>>();
  questionMs = 20_000;

  constructor(
    private readonly content: ContentService,
    private readonly student: StudentService,
    private readonly db: DatabaseService,
  ) {}

  private scopeUnits(scope: string): string[] | null {
    if (!SCOPE_CATEGORIES[scope]) return null;
    return this.content
      .unitsWithQuestions()
      .filter((u) => SCOPE_CATEGORIES[scope].includes(String(this.content.units[u]?.category)) || (SCOPE_EXTRA_UNITS[scope] ?? []).includes(u));
  }

  // ------------------------------------------------------------------ kết nối
  /** Gắn kết nối vừa đăng nhập; nếu đang ở trong một phòng thì vào lại đúng phòng đó */
  attach(conn: Conn): void {
    this.purge();
    const uid = conn.user.id;
    if (conn.user.role === 'teacher') {
      const room = this.roomOfHost(uid);
      if (!room) return conn.send({ type: 'room', room: null });
      if (room.host && room.host !== conn) {
        room.host.send({ type: 'replaced' });
        room.host.close(4000);
      }
      room.host = conn;
      room.hostLeft = null;
      return this.broadcast(room);
    }
    const room = this.roomOfPlayer(uid);
    if (!room) return conn.send({ type: 'state', state: null });
    const player = room.players.get(uid)!;
    if (player.conn && player.conn !== conn) {
      player.conn.send({ type: 'replaced' });
      player.conn.close(4000);
    }
    player.conn = conn;
    this.sendPlayer(room, player);
    this.sendHost(room);
  }

  detach(conn: Conn): void {
    const uid = conn.user.id;
    if (conn.user.role === 'teacher') {
      const room = this.roomOfHost(uid);
      if (room && room.host === conn) {
        room.host = null;
        room.hostLeft = Date.now();
        for (const p of room.players.values()) this.sendPlayer(room, p);
      }
      return;
    }
    const room = this.roomOfPlayer(uid);
    if (room && room.players.get(uid)!.conn === conn) {
      room.players.get(uid)!.conn = null;
      this.sendHost(room);
      this.revealIfAllAnswered(room);
    }
  }

  handle(conn: Conn, msg: Msg): void {
    const kind = msg.type;
    if (kind === 'ping') return conn.send({ type: 'pong' });
    const role = conn.user.role;
    if (role === 'teacher' && typeof kind === 'string' && ['create', 'lock', 'kick', 'start', 'reveal', 'next', 'close'].includes(kind)) return this.hostAction(kind, conn, msg);
    if (role === 'student' && kind === 'join') return this.playerJoin(conn, msg);
    if (role === 'student' && kind === 'answer') return this.playerAnswer(conn, msg);
    if (role === 'student' && kind === 'leave') return this.playerLeave(conn);
    this.error(conn, 'bad_request');
  }

  // ------------------------------------------------------------------ giáo viên
  private hostAction(kind: string, conn: Conn, msg: Msg): void {
    if (kind === 'create') return this.hostCreate(conn, msg);
    const room = this.roomOfHost(conn.user.id);
    if (!room || room.host !== conn) return this.error(conn, 'no_room');
    if (kind === 'lock') {
      room.locked = Boolean(msg.locked);
      return this.sendHost(room);
    }
    if (kind === 'kick') {
      const player = Number.isInteger(msg.player_id) ? room.players.get(msg.player_id as number) : undefined;
      if (!player) return this.error(conn, 'bad_request');
      room.players.delete(player.id);
      room.banned.add(player.id);
      if (this.byPlayer.get(player.id) === room.pin) this.byPlayer.delete(player.id);
      player.conn?.send({ type: 'kicked' });
      this.broadcast(room);
      return this.revealIfAllAnswered(room);
    }
    if (kind === 'start') {
      if (room.phase !== 'lobby') return this.error(conn, 'bad_phase');
      if (!room.players.size) return this.error(conn, 'no_players');
      room.startedAt = nowIso();
      return this.openQuestion(room, 0);
    }
    if (kind === 'reveal') {
      if (room.phase !== 'question') return this.error(conn, 'bad_phase');
      return this.reveal(room);
    }
    if (kind === 'next') {
      if (room.phase === 'reveal') {
        room.phase = 'scoreboard';
        return this.broadcast(room);
      }
      if (room.phase === 'scoreboard') {
        if (room.index + 1 < room.questions.length) return this.openQuestion(room, room.index + 1);
        room.phase = 'podium';
        this.save(room);
        return this.broadcast(room);
      }
      return this.error(conn, 'bad_phase');
    }
    this.close(room, 'host_closed');
  }

  private hostCreate(conn: Conn, msg: Msg): void {
    const user = conn.user;
    if (!user.class_name) return this.error(conn, 'no_class');
    const old = this.roomOfHost(user.id);
    if (old) this.close(old, 'replaced');
    this.purge();
    if (this.rooms.size >= MAX_ROOMS) return this.error(conn, 'busy');
    const scope = typeof msg.scope === 'string' && SCOPE_CATEGORIES[msg.scope] ? msg.scope : 'all';
    const count = QUESTION_COUNTS.includes(msg.count as number) ? (msg.count as number) : 10;
    const title = String(msg.title ?? '').split(/\s+/).filter(Boolean).join(' ').slice(0, 120) || DEFAULT_TITLE;
    const picked = this.content.pick(this.scopeUnits(scope), count, new Set(), LIVE_TYPES).filter((q) => LIVE_TYPES.has(q.type));
    if (!picked.length) return this.error(conn, 'no_questions');
    const room: Room = {
      pin: this.newPin(), hostId: user.id, schoolId: user.school_id, className: user.class_name, title, scope, questions: picked, served: picked.map((q) => this.serve(q)), host: conn,
      phase: 'lobby', index: -1, locked: false, players: new Map(), banned: new Set(), stats: [], qStarted: 0, deadline: 0, timer: null, created: Date.now(),
      hostLeft: null, startedAt: null, saved: false, sessionId: null,
    };
    this.rooms.set(room.pin, room);
    this.byHost.set(user.id, room.pin);
    this.sendHost(room);
  }

  // ------------------------------------------------------------------ học sinh
  private playerJoin(conn: Conn, msg: Msg): void {
    const user = conn.user;
    const pin = String(msg.pin ?? '').replace(/\D/g, '').slice(0, 6);
    const current = this.roomOfPlayer(user.id);
    if (current && current.pin === pin) return this.attach(conn);
    const now = Date.now();
    let { fails, since } = this.failedJoins.get(user.id) ?? { fails: 0, since: now };
    if (now - since > FAILED_JOIN_WINDOW_MS) [fails, since] = [0, now];
    if (fails >= MAX_FAILED_JOINS) return this.error(conn, 'too_many');
    const room = this.rooms.get(pin);
    if (!room || room.phase === 'podium' || !user.class_name || room.className !== user.class_name || room.schoolId !== user.school_id) {
      // Sai PIN hoặc phòng của lớp khác: cùng một thông báo để không dò được phòng của lớp khác
      this.failedJoins.set(user.id, { fails: fails + 1, since });
      return this.error(conn, 'not_found');
    }
    this.failedJoins.delete(user.id);
    if (room.banned.has(user.id)) return this.error(conn, 'banned');
    if (room.locked) return this.error(conn, 'locked');
    if (room.players.size >= MAX_PLAYERS) return this.error(conn, 'full');
    if (current) this.removePlayer(current, user.id);
    room.players.set(user.id, { id: user.id, name: user.full_name, user, conn, score: 0, streak: 0, correct: 0, answered: 0, lastGain: 0, lastCorrect: null, current: null });
    this.byPlayer.set(user.id, room.pin);
    this.broadcast(room);
  }

  private playerAnswer(conn: Conn, msg: Msg): void {
    const room = this.roomOfPlayer(conn.user.id);
    const player = room?.players.get(conn.user.id);
    if (!room || !player || player.conn !== conn) return this.error(conn, 'no_room');
    const served = room.served[room.index];
    if (room.phase !== 'question' || !served || msg.question_id !== served.id || player.current) return this.error(conn, 'bad_phase');
    const option = served.options.findIndex((o) => sameKey(o.key, msg.choice));
    if (option < 0) return this.error(conn, 'bad_choice');
    const elapsed = Date.now() - room.qStarted;
    if (elapsed > this.questionMs + ANSWER_GRACE_MS) return this.error(conn, 'time_up');
    const q = room.questions[room.index];
    const [correct] = this.content.grade(q, msg.choice);
    player.current = { key: msg.choice as Key, correct, gain: pointsFor(correct, elapsed, player.streak, this.questionMs) };
    const stat = room.stats[room.index];
    stat.answered += 1;
    stat.correct += correct ? 1 : 0;
    stat.counts[option] += 1;
    this.userJob(player.id, () => this.student.recordAnswer(player.user, q, correct));
    this.sendPlayer(room, player);
    this.sendHost(room);
    this.revealIfAllAnswered(room);
  }

  private playerLeave(conn: Conn): void {
    const room = this.roomOfPlayer(conn.user.id);
    if (room) this.removePlayer(room, conn.user.id);
    conn.send({ type: 'state', state: null });
  }

  // ------------------------------------------------------------------ diễn tiến trận
  private openQuestion(room: Room, index: number): void {
    this.cancelTimer(room);
    room.index = index;
    room.phase = 'question';
    for (const p of room.players.values()) p.current = null;
    if (room.stats.length <= index) room.stats.push({ id: room.questions[index].id, answered: 0, correct: 0, counts: room.served[index].options.map(() => 0) });
    room.qStarted = Date.now();
    room.deadline = room.qStarted + this.questionMs;
    room.timer = setTimeout(() => {
      room.timer = null;
      if (this.rooms.get(room.pin) === room && room.phase === 'question' && room.index === index) this.reveal(room);
    }, this.questionMs + 250);
    this.broadcast(room);
  }

  private cancelTimer(room: Room): void {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
  }

  private revealIfAllAnswered(room: Room): void {
    const present = [...room.players.values()].filter(online);
    if (room.phase === 'question' && present.length && present.every((p) => p.current)) this.reveal(room);
  }

  private applyReveal(room: Room): void {
    this.cancelTimer(room);
    room.phase = 'reveal';
    for (const p of room.players.values()) {
      const cur = p.current;
      if (cur) {
        p.answered += 1;
        p.correct += cur.correct ? 1 : 0;
        p.streak = cur.correct ? p.streak + 1 : 0;
        p.score += cur.gain;
        p.lastGain = cur.gain;
        p.lastCorrect = cur.correct;
      } else {
        p.streak = 0;
        p.lastGain = 0;
        p.lastCorrect = null;
      }
    }
  }

  private reveal(room: Room): void {
    this.applyReveal(room);
    this.broadcast(room);
  }

  /** Lưu trận (một lần) và ghi nhận lượt học cho học sinh đã trả lời ít nhất một câu */
  private save(room: Room): void {
    if (room.saved || !room.stats.length || !room.players.size) return;
    room.saved = true;
    const ranked = this.ranked(room);
    const asked = room.stats.length;
    const results: LiveResultInput[] = ranked.map((p, i) => ({ user_id: p.id, rank: i + 1, score: p.score, correct: p.correct, answered: p.answered }));
    this.db
      .saveLiveSession(
        {
          teacher_id: room.hostId, class_name: room.className, title: room.title, scope: room.scope, question_count: asked,
          question_stats: JSON.stringify(room.stats.map((s) => ({ id: s.id, answered: s.answered, correct: s.correct }))),
          started_at: room.startedAt ?? nowIso(), finished_at: nowIso(),
        },
        results,
      )
      .then((sessionId) => {
        room.sessionId = sessionId;
        if (room.host?.alive) {
          if (this.rooms.get(room.pin) === room) this.sendHost(room);
          else room.host.send({ type: 'saved', session_id: sessionId });
        }
      })
      .catch((exc) => this.logger.error(`Không lưu được trận thi đấu (${(exc as Error).name})`));
    for (const p of ranked) if (p.answered) this.userJob(p.id, () => this.student.recordSession(p.user, p.correct, asked));
  }

  private close(room: Room, reason: string): void {
    if (this.rooms.get(room.pin) !== room) return;
    if (room.phase === 'question') this.applyReveal(room);
    this.cancelTimer(room);
    this.save(room);
    this.rooms.delete(room.pin);
    if (this.byHost.get(room.hostId) === room.pin) this.byHost.delete(room.hostId);
    for (const p of room.players.values()) {
      if (this.byPlayer.get(p.id) === room.pin) this.byPlayer.delete(p.id);
      p.conn?.send({ type: 'closed', reason });
    }
    room.host?.send({ type: 'room', room: null, closed: reason });
  }

  private removePlayer(room: Room, uid: number): void {
    room.players.delete(uid);
    if (this.byPlayer.get(uid) === room.pin) this.byPlayer.delete(uid);
    this.broadcast(room);
    this.revealIfAllAnswered(room);
  }

  private purge(): void {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      const hostGone = !room.host || !room.host.alive;
      if ((hostGone && room.hostLeft !== null && now - room.hostLeft > HOST_GRACE_MS) || now - room.created > ROOM_MAX_MS) this.close(room, 'expired');
    }
  }

  // ------------------------------------------------------------------ dữ liệu gửi xuống
  private serve(q: BankQuestion): ServedLive {
    const s = this.content.serve(q);
    return { id: s.id, type: s.type, prompt: s.prompt, topic: s.topic, options: s.options ?? TF_OPTIONS.map((o) => ({ ...o })) };
  }

  private revealInfo(room: Room, full: boolean): Msg {
    const q = room.questions[room.index];
    return full ? { key: q.answer, explanation: q.explanation, counts: [...room.stats[room.index].counts], source: q.source ?? null } : { key: q.answer, explanation: q.explanation };
  }

  private ranked(room: Room): Player[] {
    return [...room.players.values()].sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id - b.id));
  }

  private baseView(room: Room): Msg {
    const asking = (room.phase === 'question' || room.phase === 'reveal') && room.index >= 0;
    return {
      pin: room.pin, title: room.title, phase: room.phase, index: room.index, total: room.questions.length, duration_ms: this.questionMs,
      remaining_ms: room.phase === 'question' ? Math.max(0, room.deadline - Date.now()) : 0, question: asking ? room.served[room.index] : null,
    };
  }

  private hostView(room: Room): Msg {
    return {
      ...this.baseView(room),
      scope: room.scope, class_name: room.className, locked: room.locked,
      answered: room.phase === 'question' ? [...room.players.values()].filter((p) => p.current).length : (room.stats[room.index]?.answered ?? 0),
      players: this.ranked(room).map((p) => ({
        id: p.id, name: p.name, score: p.score, streak: p.streak, correct: p.correct, connected: online(p), answered: p.current !== null, last_gain: p.lastGain, last_correct: p.lastCorrect,
      })),
      reveal: room.phase === 'reveal' ? this.revealInfo(room, true) : null,
      saved: room.saved,
      session_id: room.sessionId,
    };
  }

  private playerView(room: Room, player: Player): Msg {
    const ranked = this.ranked(room);
    return {
      ...this.baseView(room),
      players: room.players.size,
      host_online: Boolean(room.host?.alive),
      me: {
        name: player.name, score: player.score, rank: ranked.findIndex((p) => p.id === player.id) + 1, streak: player.streak, correct: player.correct,
        answered_total: player.answered, answered: player.current !== null, choice: player.current?.key ?? null, last_gain: player.lastGain, last_correct: player.lastCorrect,
      },
      reveal: room.phase === 'reveal' ? this.revealInfo(room, false) : null,
      top: room.phase === 'scoreboard' || room.phase === 'podium' ? ranked.slice(0, 3).map((p) => ({ name: p.name, score: p.score })) : [],
    };
  }

  private sendHost(room: Room): void {
    room.host?.send({ type: 'room', room: this.hostView(room) });
  }

  private sendPlayer(room: Room, player: Player): void {
    player.conn?.send({ type: 'state', state: this.playerView(room, player) });
  }

  private broadcast(room: Room): void {
    this.sendHost(room);
    for (const p of room.players.values()) this.sendPlayer(room, p);
  }

  private error(conn: Conn, code: string): void {
    conn.send({ type: 'error', code, message: ERRORS[code] ?? ERRORS.bad_request });
  }

  // ------------------------------------------------------------------ tiện ích
  private roomOfHost(uid: number): Room | undefined {
    const pin = this.byHost.get(uid);
    return pin ? this.rooms.get(pin) : undefined;
  }

  private roomOfPlayer(uid: number): Room | undefined {
    const pin = this.byPlayer.get(uid);
    const room = pin ? this.rooms.get(pin) : undefined;
    return room && room.players.has(uid) ? room : undefined;
  }

  private newPin(): string {
    for (;;) {
      const pin = String(100000 + randomInt(900000));
      if (!this.rooms.has(pin)) return pin;
    }
  }

  /** Việc ghi tiến độ của cùng một học sinh chạy lần lượt để không ghi đè lên nhau */
  private userJob(uid: number, run: () => Promise<unknown>): void {
    const next = (this.tails.get(uid) ?? Promise.resolve())
      .then(run)
      .catch((exc) => this.logger.error(`Không ghi được tiến độ học sinh (${(exc as Error).name})`));
    this.tails.set(uid, next);
    next.finally(() => {
      if (this.tails.get(uid) === next) this.tails.delete(uid);
    });
  }

  /** Chờ các việc ghi tiến độ đang chạy (dùng khi kiểm thử) */
  async settle(): Promise<void> {
    await Promise.all([...this.tails.values()]);
  }
}
