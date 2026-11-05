/**
 * Bài tập (Sprint 7, HK.GV.045–050, HK.HS.100–102): giáo viên giao bộ đề, mini-game hoặc bài học cho cả lớp, một số đội hoặc một số học sinh với hạn nộp, số lần làm và điểm thưởng;
 * theo dõi tình trạng nộp, gia hạn/đổi phạm vi/thu hồi, chấm điểm và nhận xét, nhắc học sinh chưa nộp. Học sinh xem danh sách, làm bài đúng hạn (quá hạn không bắt đầu được)
 * và xem điểm, nhận xét, xếp loại. Điểm tự động lấy từ kết quả làm bài; điểm của giáo viên là điểm cuối cùng nếu có.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { BattleService } from '../battle/battle.service';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { notFound } from '../content/access';
import { QuizService } from '../content/quiz.service';
import { GameService } from '../game/game.service';
import { PlayService } from '../student/play.service';
import { ClassroomService } from './classroom.service';
import { notify } from './notify';
import { recordSubmission } from './submission';

export const gradeLabel = (score: number | null): string | null => (score === null ? null : score >= 80 ? 'Giỏi' : score >= 65 ? 'Khá' : score >= 50 ? 'Trung bình' : 'Yếu');
const KIND_LABEL = { quiz: 'Bộ đề', minigame: 'Mini-game', lesson: 'Bài học' } as const;
type Kind = keyof typeof KIND_LABEL;

interface AssignmentRow {
  id: number; class_id: number; title: string; description: string | null; kind: Kind; quiz_id: number | null; minigame_id: number | null; lesson_id: number | null;
  audience: 'class' | 'team' | 'students'; team_ids: number[]; student_ids: number[]; due_at: Date; max_attempts: number; bonus_points: number; status: 'active' | 'revoked'; created_at: Date;
}
export interface AssignmentInput {
  title?: string; description?: string | null; kind?: Kind; quiz_id?: number; minigame_id?: number; lesson_id?: number; audience?: string; team_ids?: number[]; student_ids?: number[];
  due_at?: string; max_attempts?: number; bonus_points?: number;
}

const COLUMNS = 'id, class_id, title, description, kind, quiz_id, minigame_id, lesson_id, audience, team_ids, student_ids, due_at, max_attempts, bonus_points, status, created_at';
const dateText = (d: Date | string) => new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

@Injectable()
export class AssignmentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly rooms: ClassroomService,
    private readonly quizzes: QuizService,
    private readonly play: PlayService,
    private readonly battle: BattleService,
    private readonly game: GameService,
  ) {}

  private readonly read: Q = (sql, params) => this.db.query(sql, params);
  private now(): Date { return this.game.clock.now(); }

  // ------------------------------------------------------------------ nội dung và phạm vi
  private async contentTitle(q: Q, a: Pick<AssignmentRow, 'kind' | 'quiz_id' | 'minigame_id' | 'lesson_id'>): Promise<string> {
    const sql = a.kind === 'quiz' ? ['SELECT title FROM hk_quizzes WHERE id = $1', a.quiz_id] : a.kind === 'minigame' ? ['SELECT title FROM hk_minigames WHERE id = $1', a.minigame_id] : ['SELECT title FROM hk_lessons WHERE id = $1', a.lesson_id];
    return (await q<{ title: string }>(sql[0] as string, [sql[1]]))[0]?.title ?? '';
  }

  /** Điều kiện SQL "học sinh `alias.id` thuộc phạm vi giao"; tham số của bài tập được truyền ở vị trí `$n` và `$m` */
  private audienceSql(a: Pick<AssignmentRow, 'audience'>, alias: string, teamParam: string, studentParam: string): string {
    // PostgreSQL không suy được kiểu của tham số không xuất hiện trong câu lệnh, nên cả hai tham số luôn được nhắc tới (điều kiện thừa luôn đúng)
    const both = `COALESCE(cardinality(${teamParam}::int[]), 0) >= 0 AND COALESCE(cardinality(${studentParam}::int[]), 0) >= 0`;
    if (a.audience === 'team') return `(EXISTS (SELECT 1 FROM hk_team_members tm WHERE tm.user_id = ${alias}.id AND tm.team_id = ANY(${teamParam}::int[])) AND ${both})`;
    if (a.audience === 'students') return `(${alias}.id = ANY(${studentParam}::int[]) AND ${both})`;
    return `(${both})`;
  }

  private async scope(q: Q, classId: number, body: AssignmentInput, cur?: AssignmentRow): Promise<Pick<AssignmentRow, 'audience' | 'team_ids' | 'student_ids'>> {
    const audience = (body.audience ?? cur?.audience ?? 'class') as AssignmentRow['audience'];
    if (!['class', 'team', 'students'].includes(audience)) throw new BadRequestException('Phạm vi giao là cả lớp, đội hoặc học sinh');
    let teamIds = [...new Set(body.team_ids ?? (audience === 'team' ? cur?.team_ids : undefined) ?? [])];
    let studentIds = [...new Set(body.student_ids ?? (audience === 'students' ? cur?.student_ids : undefined) ?? [])];
    if (audience === 'team') {
      if (!teamIds.length || teamIds.length > 12) throw new BadRequestException('Hãy chọn từ 1 đến 12 đội');
      const ok = await q<{ id: number }>('SELECT id FROM hk_teams WHERE class_id = $1 AND id = ANY($2)', [classId, teamIds]);
      if (ok.length !== teamIds.length) throw new BadRequestException('Có đội không thuộc lớp này');
      studentIds = [];
    } else if (audience === 'students') {
      if (!studentIds.length || studentIds.length > 100) throw new BadRequestException('Hãy chọn từ 1 đến 100 học sinh');
      const ok = await q<{ user_id: number }>("SELECT m.user_id FROM app_class_members m JOIN app_users u ON u.id = m.user_id AND u.role = 'student' WHERE m.class_id = $1 AND m.user_id = ANY($2)", [classId, studentIds]);
      if (ok.length !== studentIds.length) throw new BadRequestException('Có học sinh không thuộc lớp này');
      teamIds = [];
    } else { teamIds = []; studentIds = []; }
    return { audience, team_ids: teamIds, student_ids: studentIds };
  }

  private async audienceIds(q: Q, a: AssignmentRow): Promise<number[]> {
    return (await q<{ id: number }>(
      `SELECT u.id FROM app_class_members m JOIN app_users u ON u.id = m.user_id AND u.role = 'student' AND u.deleted_at IS NULL WHERE m.class_id = $1 AND ${this.audienceSql(a, 'u', '$2', '$3')} ORDER BY u.id`,
      [a.class_id, a.team_ids, a.student_ids])).map((r) => r.id);
  }

  private async load(q: Q, user: UserRow, id: number, lock = false): Promise<AssignmentRow> {
    const a = (await q<AssignmentRow>(`SELECT ${COLUMNS} FROM hk_assignments WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]))[0];
    if (!a) throw notFound('bài tập');
    await this.rooms.mine(q, user, a.class_id);
    return a;
  }

  private validDue(value: unknown, now: Date): Date {
    const d = new Date(String(value ?? ''));
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Hạn nộp không hợp lệ');
    if (d.getTime() <= now.getTime()) throw new BadRequestException('Hạn nộp phải ở sau thời điểm hiện tại');
    if (d.getTime() > now.getTime() + 366 * 86_400_000) throw new BadRequestException('Hạn nộp không quá một năm kể từ hôm nay');
    return d;
  }

  // ------------------------------------------------------------------ giáo viên (HK.GV.045–050)
  async list(user: UserRow, classId: number) {
    await this.rooms.mine(this.read, user, classId);
    const rows = await this.db.query<Record<string, any>>(
      `SELECT ${COLUMNS.split(', ').map((c) => `a.${c}`).join(', ')}, COALESCE(q.title, g.title, l.title) AS content_title,
              (SELECT count(*)::int FROM app_class_members m JOIN app_users u ON u.id = m.user_id AND u.role = 'student' AND u.deleted_at IS NULL
               WHERE m.class_id = a.class_id AND (a.audience = 'class' OR (a.audience = 'team' AND EXISTS (SELECT 1 FROM hk_team_members tm WHERE tm.user_id = u.id AND tm.team_id = ANY(a.team_ids))) OR (a.audience = 'students' AND u.id = ANY(a.student_ids)))) AS audience_size,
              (SELECT count(*)::int FROM hk_submissions s WHERE s.assignment_id = a.id AND s.submitted_at IS NOT NULL) AS submitted,
              (SELECT count(*)::int FROM hk_submissions s WHERE s.assignment_id = a.id AND s.teacher_score IS NOT NULL) AS graded
       FROM hk_assignments a LEFT JOIN hk_quizzes q ON q.id = a.quiz_id LEFT JOIN hk_minigames g ON g.id = a.minigame_id LEFT JOIN hk_lessons l ON l.id = a.lesson_id
       WHERE a.class_id = $1 ORDER BY a.status = 'active' DESC, a.due_at DESC`, [classId]);
    const now = this.now().getTime();
    return rows.map((r) => ({ ...r, kind_label: KIND_LABEL[r.kind as Kind], overdue: r.status === 'active' && new Date(r.due_at).getTime() < now, rate: r.audience_size ? Math.round((r.submitted / r.audience_size) * 100) : 0 }));
  }

  async create(user: UserRow, classId: number, body: AssignmentInput) {
    const cls = await this.rooms.mine(this.read, user, classId, true);
    const title = String(body.title ?? '').trim();
    if (title.length < 2 || title.length > 160) throw new BadRequestException('Tên bài tập từ 2 đến 160 ký tự');
    const kind = body.kind as Kind;
    if (!(kind in KIND_LABEL)) throw new BadRequestException('Loại bài tập là bộ đề, mini-game hoặc bài học');
    const attempts = body.max_attempts === undefined ? 3 : Number(body.max_attempts);
    const bonus = body.bonus_points === undefined ? 0 : Number(body.bonus_points);
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) throw new BadRequestException('Số lần làm từ 1 đến 10');
    if (!Number.isInteger(bonus) || bonus < 0 || bonus > 500) throw new BadRequestException('Điểm thưởng từ 0 đến 500');
    return this.db.tx(async (q) => {
      const due = this.validDue(body.due_at, this.now());
      const scope = await this.scope(q, classId, body);
      let ref: [number | null, number | null, number | null] = [null, null, null];
      if (kind === 'quiz') {
        await this.quizzes.load(q, user, Number(body.quiz_id));
        if (!Number((await q<{ n: string }>("SELECT count(*) AS n FROM hk_quiz_questions k JOIN hk_questions t ON t.id = k.question_id WHERE k.quiz_id = $1 AND t.qtype <> 'poll'", [body.quiz_id]))[0].n)) throw new BadRequestException('Bộ đề chưa có câu hỏi chấm điểm được (câu bình chọn chỉ dùng khi thi đấu trực tiếp)');
        ref = [Number(body.quiz_id), null, null];
      } else if (kind === 'minigame') {
        if (!(await q("SELECT 1 FROM hk_minigames WHERE id = $1 AND status = 'published'", [body.minigame_id])).length) throw new BadRequestException('Mini-game không tồn tại hoặc chưa phát hành');
        ref = [null, Number(body.minigame_id), null];
      } else {
        if (!(await q("SELECT 1 FROM hk_lessons WHERE id = $1 AND status = 'published'", [body.lesson_id])).length) throw new BadRequestException('Bài học không tồn tại hoặc chưa công bố');
        ref = [null, null, Number(body.lesson_id)];
      }
      const id = (await q<{ id: number }>(
        `INSERT INTO hk_assignments (class_id, created_by, title, description, kind, quiz_id, minigame_id, lesson_id, audience, team_ids, student_ids, due_at, max_attempts, bonus_points)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
        [classId, user.id, title, String(body.description ?? '').trim().slice(0, 1000) || null, kind, ...ref, scope.audience, scope.team_ids, scope.student_ids, due, attempts, bonus]))[0].id;
      const a = (await q<AssignmentRow>(`SELECT ${COLUMNS} FROM hk_assignments WHERE id = $1`, [id]))[0];
      await notify(q, await this.audienceIds(q, a), { kind: 'assignment', title: `Bài tập mới: ${title}`, body: `${KIND_LABEL[kind]} · hạn nộp ${dateText(due)} · làm tối đa ${attempts} lần${bonus ? ` · thưởng ${bonus} điểm nếu nộp đúng hạn` : ''}`, class_id: classId, ref: { assignment_id: id }, by: user.id, school_id: cls.school_id });
      return this.detailIn(q, a);
    });
  }

  private async detailIn(q: Q, a: AssignmentRow) {
    const rows = await q<Record<string, any>>(
      `SELECT u.id, u.full_name, u.nickname, u.user_code, s.attempts, s.best_percent, s.submitted_at, s.on_time, s.teacher_score, s.feedback, s.graded_at, s.reminded_at
       FROM app_class_members m JOIN app_users u ON u.id = m.user_id AND u.role = 'student' AND u.deleted_at IS NULL
       LEFT JOIN hk_submissions s ON s.assignment_id = $4 AND s.user_id = u.id
       WHERE m.class_id = $1 AND ${this.audienceSql(a, 'u', '$2', '$3')} ORDER BY u.full_name, u.id`, [a.class_id, a.team_ids, a.student_ids, a.id]);
    const students: Array<Record<string, any>> = rows.map((r) => ({ ...r, state: r.teacher_score !== null && r.teacher_score !== undefined ? 'graded' : r.submitted_at ? (r.on_time ? 'submitted' : 'late') : 'todo', grade: gradeLabel(r.teacher_score ?? null) }));
    const classTeams = await q<{ id: number; name: string }>('SELECT id, name FROM hk_teams WHERE id = ANY($1) ORDER BY name', [a.team_ids]);
    return {
      ...a, kind_label: KIND_LABEL[a.kind], content_title: await this.contentTitle(q, a), overdue: a.status === 'active' && new Date(a.due_at).getTime() < this.now().getTime(), teams: classTeams, students,
      summary: { total: students.length, submitted: students.filter((s) => s.submitted_at).length, graded: students.filter((s) => s.state === 'graded').length, late: students.filter((s) => s.state === 'late').length },
    };
  }

  async detail(user: UserRow, id: number) {
    return this.db.tx(async (q) => this.detailIn(q, await this.load(q, user, id)));
  }

  /** Gia hạn, đổi phạm vi, số lần làm, điểm thưởng (HK.GV.047); nội dung bài tập không đổi sau khi giao */
  async update(user: UserRow, id: number, body: AssignmentInput) {
    return this.db.tx(async (q) => {
      const a = await this.load(q, user, id, true);
      if (a.status !== 'active') throw new ConflictException('Bài tập đã thu hồi');
      if ((body.kind && body.kind !== a.kind) || (body.quiz_id && body.quiz_id !== a.quiz_id) || (body.minigame_id && body.minigame_id !== a.minigame_id) || (body.lesson_id && body.lesson_id !== a.lesson_id)) {
        throw new ConflictException('Không đổi nội dung bài tập đã giao; hãy thu hồi (nếu chưa ai nộp) rồi giao lại');
      }
      const due = body.due_at === undefined ? new Date(a.due_at) : this.validDue(body.due_at, this.now());
      const title = body.title === undefined ? a.title : String(body.title).trim();
      if (title.length < 2 || title.length > 160) throw new BadRequestException('Tên bài tập từ 2 đến 160 ký tự');
      const used = Number((await q<{ n: string | null }>('SELECT max(attempts) AS n FROM hk_submissions WHERE assignment_id = $1', [id]))[0].n ?? 0);
      const attempts = body.max_attempts === undefined ? a.max_attempts : Number(body.max_attempts);
      if (!Number.isInteger(attempts) || attempts < Math.max(1, used) || attempts > 10) throw new BadRequestException(`Số lần làm từ ${Math.max(1, used)} đến 10 (đã có học sinh làm ${used} lần)`);
      const bonus = body.bonus_points === undefined ? a.bonus_points : Number(body.bonus_points);
      if (!Number.isInteger(bonus) || bonus < 0 || bonus > 500) throw new BadRequestException('Điểm thưởng từ 0 đến 500');
      const scope = body.audience || body.team_ids || body.student_ids ? await this.scope(q, a.class_id, body, a) : { audience: a.audience, team_ids: a.team_ids, student_ids: a.student_ids };
      const next = { ...a, ...scope };
      const before = new Set(await this.audienceIds(q, a)), after = new Set(await this.audienceIds(q, next));
      const submitters = new Set((await q<{ user_id: number }>('SELECT user_id FROM hk_submissions WHERE assignment_id = $1 AND attempts > 0', [id])).map((r) => r.user_id));
      if ([...submitters].some((u) => before.has(u) && !after.has(u))) throw new ConflictException('Không bỏ khỏi phạm vi giao những học sinh đã nộp bài');
      await q('UPDATE hk_assignments SET title = $2, description = $3, audience = $4, team_ids = $5, student_ids = $6, due_at = $7, max_attempts = $8, bonus_points = $9, updated_at = now() WHERE id = $1',
        [id, title, body.description === undefined ? a.description : String(body.description ?? '').trim().slice(0, 1000) || null, scope.audience, scope.team_ids, scope.student_ids, due, attempts, bonus]);
      const fresh = (await q<AssignmentRow>(`SELECT ${COLUMNS} FROM hk_assignments WHERE id = $1`, [id]))[0];
      const added = [...after].filter((u) => !before.has(u));
      const cls = await this.rooms.mine(q, user, a.class_id);
      if (added.length) await notify(q, added, { kind: 'assignment', title: `Bài tập mới: ${title}`, body: `Hạn nộp ${dateText(due)}`, class_id: a.class_id, ref: { assignment_id: id }, by: user.id, school_id: cls.school_id });
      if (due.getTime() !== new Date(a.due_at).getTime()) await notify(q, [...after].filter((u) => before.has(u)), { kind: 'assignment', title: `Đổi hạn nộp: ${title}`, body: `Hạn nộp mới ${dateText(due)}`, class_id: a.class_id, ref: { assignment_id: id }, by: user.id, school_id: cls.school_id });
      return this.detailIn(q, fresh);
    });
  }

  /** Thu hồi bài tập: chỉ khi chưa học sinh nào nộp */
  async revoke(user: UserRow, id: number) {
    return this.db.tx(async (q) => {
      const a = await this.load(q, user, id, true);
      if (a.status !== 'active') throw new ConflictException('Bài tập đã thu hồi');
      const submitted = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_submissions WHERE assignment_id = $1 AND attempts > 0', [id]))[0].n);
      if (submitted) throw new ConflictException(`Đã có ${submitted} học sinh nộp bài nên không thu hồi được; hãy gia hạn hoặc chấm điểm`);
      const live = Number((await q<{ n: string }>(`SELECT (SELECT count(*) FROM hk_attempts WHERE assignment_id = $1 AND status = 'active') + (SELECT count(*) FROM hk_game_runs WHERE assignment_id = $1 AND status = 'active') AS n`, [id]))[0].n);
      if (live) throw new ConflictException('Có học sinh đang làm bài này nên chưa thu hồi được');
      await q("UPDATE hk_assignments SET status = 'revoked', updated_at = now() WHERE id = $1", [id]);
      const cls = await this.rooms.mine(q, user, a.class_id);
      await notify(q, await this.audienceIds(q, a), { kind: 'assignment', title: `Bài tập đã được thu hồi: ${a.title}`, body: 'Em không cần làm bài này nữa.', class_id: a.class_id, by: user.id, school_id: cls.school_id });
      return this.detailIn(q, { ...a, status: 'revoked' });
    });
  }

  /** Chấm điểm và nhận xét (HK.GV.049): chỉ với học sinh đã nộp; điểm của giáo viên là điểm cuối cùng */
  async grade(user: UserRow, id: number, body: { user_id: number; score: number; feedback?: string | null }) {
    return this.db.tx(async (q) => {
      const a = await this.load(q, user, id, true);
      const score = Number(body.score);
      if (!Number.isInteger(score) || score < 0 || score > 100) throw new BadRequestException('Điểm từ 0 đến 100');
      const sub = (await q<{ submitted_at: Date | null }>('SELECT submitted_at FROM hk_submissions WHERE assignment_id = $1 AND user_id = $2 FOR UPDATE', [id, body.user_id]))[0];
      if (!sub?.submitted_at) throw new ConflictException('Học sinh này chưa nộp bài nên chưa chấm được');
      const feedback = String(body.feedback ?? '').trim().slice(0, 1000) || null;
      await q('UPDATE hk_submissions SET teacher_score = $3, feedback = $4, graded_by = $5, graded_at = now() WHERE assignment_id = $1 AND user_id = $2', [id, body.user_id, score, feedback, user.id]);
      const cls = await this.rooms.mine(q, user, a.class_id);
      await notify(q, [body.user_id], { kind: 'assignment', title: `Giáo viên đã chấm bài: ${a.title}`, body: `${score}/100 (${gradeLabel(score)})${feedback ? ` · ${feedback}` : ''}`, class_id: a.class_id, ref: { assignment_id: id }, by: user.id, school_id: cls.school_id });
      return { user_id: body.user_id, teacher_score: score, grade: gradeLabel(score), feedback };
    });
  }

  /** Nhắc học sinh chưa nộp (HK.GV.050); mỗi học sinh nhắc tối đa một lần mỗi 6 giờ cho một bài tập */
  async remind(user: UserRow, id: number) {
    return this.db.tx(async (q) => {
      const a = await this.load(q, user, id, true);
      if (a.status !== 'active') throw new ConflictException('Bài tập đã thu hồi');
      const cls = await this.rooms.mine(q, user, a.class_id);
      const todo = await q<{ id: number }>(
        `SELECT u.id FROM app_class_members m JOIN app_users u ON u.id = m.user_id AND u.role = 'student' AND u.deleted_at IS NULL
         LEFT JOIN hk_submissions s ON s.assignment_id = $4 AND s.user_id = u.id
         WHERE m.class_id = $1 AND ${this.audienceSql(a, 'u', '$2', '$3')} AND s.submitted_at IS NULL AND (s.reminded_at IS NULL OR s.reminded_at < $5)`,
        [a.class_id, a.team_ids, a.student_ids, id, new Date(this.now().getTime() - 6 * 3600_000)]);
      const ids = todo.map((t) => t.id);
      if (!ids.length) return { sent: 0 };
      for (const uid of ids) await q('INSERT INTO hk_submissions (assignment_id, user_id, reminded_at) VALUES ($1, $2, $3) ON CONFLICT (assignment_id, user_id) DO UPDATE SET reminded_at = $3', [id, uid, this.now()]);
      const late = new Date(a.due_at).getTime() < this.now().getTime();
      await notify(q, ids, { kind: 'reminder', title: `Nhắc nhở: ${a.title}`, body: late ? `Bài tập đã quá hạn từ ${dateText(a.due_at)}. Hãy báo giáo viên nếu em cần gia hạn.` : `Em chưa nộp bài này. Hạn nộp ${dateText(a.due_at)}.`, class_id: a.class_id, ref: { assignment_id: id }, by: user.id, school_id: cls.school_id });
      return { sent: ids.length };
    });
  }

  // ------------------------------------------------------------------ học sinh (HK.HS.100–102)
  private stateOf(a: Record<string, any>, now: number): 'graded' | 'submitted' | 'late' | 'overdue' | 'doing' | 'todo' {
    if (a.teacher_score !== null && a.teacher_score !== undefined) return 'graded';
    if (a.submitted_at) return a.on_time ? 'submitted' : 'late';
    if (new Date(a.due_at).getTime() < now) return 'overdue';
    return a.attempts > 0 ? 'doing' : 'todo';
  }

  async mine(user: UserRow) {
    const rows = await this.db.query<Record<string, any>>(
      `SELECT ${COLUMNS.split(', ').map((c) => `a.${c}`).join(', ')}, c.name AS class_name, COALESCE(q.title, g.title, l.title) AS content_title,
              COALESCE(s.attempts, 0) AS attempts, s.best_percent, s.submitted_at, s.on_time, s.teacher_score, s.feedback
       FROM hk_assignments a JOIN app_class_members m ON m.class_id = a.class_id AND m.user_id = $1 JOIN app_classes c ON c.id = a.class_id
       LEFT JOIN hk_submissions s ON s.assignment_id = a.id AND s.user_id = $1 LEFT JOIN hk_quizzes q ON q.id = a.quiz_id LEFT JOIN hk_minigames g ON g.id = a.minigame_id LEFT JOIN hk_lessons l ON l.id = a.lesson_id
       WHERE a.status = 'active' AND (a.audience = 'class' OR (a.audience = 'students' AND $1 = ANY(a.student_ids)) OR (a.audience = 'team' AND EXISTS (SELECT 1 FROM hk_team_members tm WHERE tm.user_id = $1 AND tm.team_id = ANY(a.team_ids))))
       ORDER BY a.due_at DESC LIMIT 100`, [user.id]);
    const now = this.now().getTime();
    const items: Array<Record<string, any>> = rows.map((r) => ({ ...r, kind_label: KIND_LABEL[r.kind as Kind], state: this.stateOf(r, now), grade: gradeLabel(r.teacher_score ?? null), attempts_left: Math.max(0, r.max_attempts - r.attempts) }));
    const order: Record<string, number> = { todo: 0, doing: 1, overdue: 2, late: 3, submitted: 4, graded: 5 };
    return items.sort((a, b) => order[a.state] - order[b.state] || new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  }

  async mineDetail(user: UserRow, id: number) {
    const item = (await this.mine(user)).find((a) => a.id === id);
    if (!item) throw notFound('bài tập');
    return item;
  }

  /** Bắt đầu hoặc tiếp tục làm bài tập: chỉ khi còn hạn và còn lượt; trả về dữ liệu theo loại bài tập */
  async start(user: UserRow, id: number) {
    const a = (await this.mine(user)).find((x) => x.id === id);
    if (!a) throw notFound('bài tập');
    if (new Date(a.due_at).getTime() < this.now().getTime()) throw new ConflictException('Bài tập đã quá hạn nộp; hãy báo giáo viên nếu em cần gia hạn');
    if (a.kind === 'quiz') return { kind: 'quiz', attempt: await this.play.startAssignmentQuiz(user, a as unknown as AssignmentRow) };
    if (a.attempts >= a.max_attempts && a.kind === 'minigame' && !(await this.hasActiveRun(user.id, id))) throw new ConflictException(`Em đã dùng hết ${a.max_attempts} lượt làm bài này`);
    if (a.kind === 'minigame') return { kind: 'minigame', run: await this.battle.startMinigame(user, a.minigame_id, { assignmentId: id }) };
    if (a.attempts >= a.max_attempts && !a.submitted_at) throw new ConflictException(`Em đã dùng hết ${a.max_attempts} lượt làm bài này`);
    return { kind: 'lesson', lesson: await this.play.assignmentLesson(user, a.lesson_id) };
  }

  private async hasActiveRun(userId: number, assignmentId: number): Promise<boolean> {
    return (await this.db.query("SELECT 1 FROM hk_game_runs WHERE user_id = $1 AND assignment_id = $2 AND status = 'active'", [userId, assignmentId])).length > 0;
  }

  async lessonProgress(user: UserRow, id: number, readPercent: number) {
    const a = await this.mineLesson(user, id);
    return this.play.assignmentLessonProgress(user, a.lesson_id, readPercent);
  }

  private async mineLesson(user: UserRow, id: number): Promise<{ lesson_id: number }> {
    const a = (await this.mine(user)).find((x) => x.id === id);
    if (!a) throw notFound('bài tập');
    if (a.kind !== 'lesson') throw new ForbiddenException('Đây không phải bài tập đọc bài học');
    if (new Date(a.due_at).getTime() < this.now().getTime()) throw new ConflictException('Bài tập đã quá hạn nộp');
    return { lesson_id: a.lesson_id };
  }

  /** Nộp bài học: đọc hết và trả lời đúng mọi câu kiểm tra nhanh; chỉ ghi một lần */
  async lessonComplete(user: UserRow, id: number, answers: Array<{ question_id: number; answer: unknown }>) {
    const a = await this.mineLesson(user, id);
    return this.db.tx(async (q) => {
      const res = await this.play.gradeLessonChecks(q, user, a.lesson_id, answers);
      if (!res.completed) return { completed: false, results: res.results, submission: null };
      const had = (await q<{ submitted_at: Date | null }>('SELECT submitted_at FROM hk_submissions WHERE assignment_id = $1 AND user_id = $2', [id, user.id]))[0]?.submitted_at;
      const submission = had ? null : await recordSubmission(q, this.game, user, id, 100);
      return { completed: true, results: res.results, submission };
    });
  }
}
