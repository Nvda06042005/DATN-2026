/**
 * Gợi ý học tập cá nhân hóa (Sprint 10, HK.HS.094–098, HK.AD.063, HK.SYS.012–013): từ kết quả quiz theo chủ đề, tiến độ hành trình, bài tập sắp đến hạn và thời gian
 * học, máy chủ chấm điểm các ứng viên "nên học gì hôm nay" bằng công thức có trọng số do quản trị cấu hình, lấy vài gợi ý cao nhất (tối đa hai gợi ý cùng loại) và ghi lại để
 * học sinh đánh giá "hữu ích / không hữu ích"; loại bị đánh giá không hữu ích thì lần sau bị giảm điểm. Gợi ý tự tính lại khi cũ quá số giờ cấu hình, theo lịch nền và lúc học sinh mở màn.
 * Ngoài ra: bộ câu hỏi luyện tập theo chủ đề yếu (độ khó tăng dần) và lộ trình ôn tập theo ngày trước hạn các bài tập của lớp. Không gọi mô hình AI nên chạy được mọi lúc.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { AssignmentService } from '../classroom/assignment.service';
import { notFound } from '../content/access';
import { DatabaseService, Q, toUser, USER_COLUMNS, UserRow } from '../database/database.service';
import { PlayService } from '../student/play.service';
import { activeJourneys, nodesWithState } from '../student/progress';
import { TOPIC_LABEL, topicStats, TopicRow, TopicType } from './topics';

export interface RecoSettings {
  weight_weak: number; weight_time: number; weight_difficulty: number; weak_threshold: number; min_answers: number; refresh_hours: number; max_items: number; practice_size: number; penalty_not_helpful: number;
}
export type RecoKind = 'continue' | 'weak_topic' | 'review' | 'assignment' | 'streak';
interface Candidate { kind: RecoKind; title: string; reason: string; ref_type: string | null; ref_id: number | null; campaign_id: number | null; score: number }

const COLUMNS = 'weight_weak::float8 AS weight_weak, weight_time::float8 AS weight_time, weight_difficulty::float8 AS weight_difficulty, weak_threshold, min_answers, refresh_hours, max_items, practice_size, penalty_not_helpful::float8 AS penalty_not_helpful';
const KIND_LABEL: Record<RecoKind, string> = { continue: 'Học tiếp', weak_topic: 'Luyện chủ đề yếu', review: 'Ôn lại', assignment: 'Bài tập sắp đến hạn', streak: 'Giữ chuỗi ngày học' };
const DAY = 86_400_000;
const daysSince = (iso: string | Date | null, now: number): number => (iso ? Math.max(0, (now - new Date(iso).getTime()) / DAY) : 30);
const round = (n: number): number => Math.round(n * 1000) / 1000;

@Injectable()
export class RecoService {
  private readonly logger = new Logger('Reco');

  constructor(private readonly db: DatabaseService, private readonly play: PlayService, private readonly assignments: AssignmentService) {}

  // ---------------------------------------------------------------------- cấu hình (HK.AD.063)
  async settings(): Promise<RecoSettings> {
    return (await this.db.query<RecoSettings>(`SELECT ${COLUMNS} FROM hk_reco_settings WHERE id = 1`))[0];
  }

  async updateSettings(user: UserRow, body: Record<string, any>): Promise<RecoSettings> {
    const cur = await this.settings();
    const num = (k: keyof RecoSettings, min: number, max: number, label: string, int = false): number => {
      if (body[k] === undefined) return cur[k];
      const v = Number(body[k]);
      if (!Number.isFinite(v) || v < min || v > max || (int && !Number.isInteger(v))) throw new BadRequestException(`${label}: ${int ? 'số nguyên' : 'số'} từ ${min} đến ${max}`);
      return v;
    };
    const next = {
      weight_weak: num('weight_weak', 0, 10, 'Trọng số điểm yếu'), weight_time: num('weight_time', 0, 10, 'Trọng số thời gian'), weight_difficulty: num('weight_difficulty', 0, 10, 'Trọng số độ khó'),
      weak_threshold: num('weak_threshold', 10, 95, 'Ngưỡng điểm yếu (%)', true), min_answers: num('min_answers', 1, 50, 'Số câu tối thiểu', true), refresh_hours: num('refresh_hours', 1, 168, 'Tần suất cập nhật (giờ)', true),
      max_items: num('max_items', 1, 6, 'Số gợi ý mỗi lần', true), practice_size: num('practice_size', 3, 20, 'Số câu luyện tập', true), penalty_not_helpful: num('penalty_not_helpful', 0, 1, 'Hệ số giảm điểm'),
    };
    if (next.weight_weak + next.weight_time + next.weight_difficulty <= 0) throw new BadRequestException('Cần ít nhất một trọng số lớn hơn 0');
    await this.db.query(
      `UPDATE hk_reco_settings SET weight_weak = $1, weight_time = $2, weight_difficulty = $3, weak_threshold = $4, min_answers = $5, refresh_hours = $6, max_items = $7, practice_size = $8,
              penalty_not_helpful = $9, updated_by = $10, updated_at = now() WHERE id = 1`,
      [next.weight_weak, next.weight_time, next.weight_difficulty, next.weak_threshold, next.min_answers, next.refresh_hours, next.max_items, next.practice_size, next.penalty_not_helpful, user.id]);
    return this.settings();
  }

  // ---------------------------------------------------------------------- sinh gợi ý (HK.SYS.012)
  /** Các ứng viên có điểm; chưa lọc và chưa cắt số lượng */
  private async candidates(q: Q, user: UserRow, s: RecoSettings, now: number): Promise<Candidate[]> {
    const out: Candidate[] = [];
    const topics = await topicStats(q, [user.id], { weakThreshold: s.weak_threshold, minAnswers: s.min_answers });
    // 1) chủ đề yếu: câu hỏi dễ hơn còn nhiều thì càng nên luyện (độ khó phù hợp)
    for (const t of topics.filter((x) => x.level === 'weak').slice(0, 6)) {
      const easy = (await q<{ easy: number; total: number }>(
        `SELECT count(*) FILTER (WHERE t.difficulty <= 2)::int AS easy, count(*)::int AS total FROM hk_question_links l JOIN hk_questions t ON t.id = l.question_id WHERE l.ref_type = $1 AND l.ref_id = $2 AND t.qtype <> 'poll'`, [t.type, t.id]))[0];
      if (!easy.total) continue;
      const weak = (s.weak_threshold - t.percent) / s.weak_threshold;
      const time = Math.min(1, daysSince(t.last_at, now) / 14);
      const score = s.weight_weak * weak + s.weight_time * time + s.weight_difficulty * (easy.easy / easy.total);
      out.push({ kind: 'weak_topic', title: `Luyện chủ đề: ${t.name}`, reason: `Em mới đúng ${t.percent}% (${t.correct}/${t.answered} câu) ở ${TOPIC_LABEL[t.type].toLowerCase()} “${t.name}”, dưới mức ${s.weak_threshold}%. Luyện thêm vài câu từ dễ đến khó nhé.`, ref_type: t.type, ref_id: t.id, campaign_id: null, score });
    }
    // 2) học tiếp, ôn lại: theo tiến độ của các hành trình đang học
    const last = (await q<{ at: string | null }>("SELECT max(created_at) AS at FROM hk_events WHERE user_id = $1 AND event IN ('node_complete', 'lesson_complete', 'attempt_finish')", [user.id]))[0].at;
    const idle = daysSince(last, now);
    let continued = false;
    for (const j of await activeJourneys(q, user.id)) {
      const nodes = await nodesWithState(q, user.id, j.journey_id);
      const next = nodes.find((n) => n.state === 'available');
      if (next && !continued) {
        continued = true;
        const done = nodes.filter((n) => n.state === 'done').length;
        out.push({
          kind: 'continue', title: `Học tiếp: ${next.title}`, reason: done ? `Em đã xong ${done}/${nodes.length} nút của “${j.title}”${idle >= 1 ? `, đã ${Math.floor(idle)} ngày chưa học` : ''}. Nút này đang mở sẵn cho em.` : `Bắt đầu hành trình “${j.title}” từ nút đầu tiên.`,
          ref_type: 'node', ref_id: next.id, campaign_id: j.campaign_id, score: s.weight_weak * 0.4 + s.weight_time * Math.min(1, idle / 3) + s.weight_difficulty * 0.5,
        });
      }
      for (const n of nodes.filter((x) => x.state === 'done' && x.completed_at && ['lesson', 'quiz', 'gate_test', 'practice'].includes(x.kind) && (x.best_percent < 85 || x.stars < 3))) {
        const age = daysSince(n.completed_at, now);
        if (age < 3) continue;
        out.push({
          kind: 'review', title: `Ôn lại: ${n.title}`, reason: `Em đạt ${n.best_percent}% (${n.stars}/3 sao) ở nút này cách đây ${Math.floor(age)} ngày; ôn lại để nhớ lâu hơn.`, ref_type: 'node', ref_id: n.id, campaign_id: j.campaign_id,
          score: s.weight_weak * ((100 - n.best_percent) / 100) + s.weight_time * Math.min(1, age / 21) + s.weight_difficulty * 0.3,
        });
      }
    }
    // 3) bài tập của lớp sắp đến hạn chưa nộp
    if (user.role === 'student') {
      for (const a of (await this.assignments.mine(user)) as Array<Record<string, any>>) {
        if (!['todo', 'doing'].includes(a.state)) continue;
        const left = (new Date(a.due_at).getTime() - now) / DAY;
        if (left > 7 || left < 0) continue;
        out.push({
          kind: 'assignment', title: `Làm bài tập: ${a.title}`, reason: `Hạn nộp ${left < 1 ? 'trong hôm nay' : `còn ${Math.ceil(left)} ngày`} (lớp ${a.class_name}).`, ref_type: 'assignment', ref_id: a.id, campaign_id: null,
          score: 2 + s.weight_weak + s.weight_time * (1 - left / 7) + s.weight_difficulty * 0.5,
        });
      }
    }
    // 4) giữ chuỗi ngày học
    const streak = (await q<{ n: number; last: string | null }>('SELECT streak_current AS n, streak_last_day::text AS last FROM hk_players WHERE user_id = $1', [user.id]))[0];
    const today = new Date(now + 7 * 3_600_000).toISOString().slice(0, 10);
    if (streak && streak.n >= 2 && streak.last && streak.last !== today) {
      out.push({ kind: 'streak', title: `Giữ chuỗi ${streak.n} ngày học liên tiếp`, reason: 'Hôm nay em chưa đạt mục tiêu điểm; chỉ cần vài câu hỏi là giữ được chuỗi.', ref_type: null, ref_id: null, campaign_id: null, score: 1 + s.weight_time * 0.5 });
    }
    return out;
  }

  /** Chọn các gợi ý tốt nhất: giảm điểm loại bị đánh giá không hữu ích, mỗi loại tối đa hai gợi ý, bỏ trùng đích */
  private pick(list: Candidate[], s: RecoSettings, fb: Map<RecoKind, { good: number; bad: number }>): Candidate[] {
    const scored = list.map((c) => {
      const f = fb.get(c.kind);
      const factor = f && f.bad > f.good ? s.penalty_not_helpful : f && f.good > f.bad ? 1.1 : 1;
      return { ...c, score: round(c.score * factor) };
    }).sort((a, b) => b.score - a.score);
    const kinds = new Map<RecoKind, number>();
    const seen = new Set<string>();
    const out: Candidate[] = [];
    for (const c of scored) {
      const key = `${c.ref_type}:${c.ref_id}:${c.kind}`;
      if ((kinds.get(c.kind) ?? 0) >= 2 || seen.has(key)) continue;
      seen.add(key); kinds.set(c.kind, (kinds.get(c.kind) ?? 0) + 1);
      out.push(c);
      if (out.length >= s.max_items) break;
    }
    return out;
  }

  /** Tính và lưu gợi ý mới cho một học sinh */
  async generate(user: UserRow): Promise<void> {
    const s = await this.settings();
    await this.db.tx(async (q) => {
      const now = Date.now();
      const fb = new Map<RecoKind, { good: number; bad: number }>();
      for (const r of await q<{ kind: RecoKind; good: number; bad: number }>(
        "SELECT kind, count(*) FILTER (WHERE feedback = 'helpful')::int AS good, count(*) FILTER (WHERE feedback = 'not_helpful')::int AS bad FROM hk_recommendations WHERE user_id = $1 AND feedback_at >= now() - interval '30 days' GROUP BY kind", [user.id])) fb.set(r.kind, r);
      const chosen = this.pick(await this.candidates(q, user, s, now), s, fb);
      const generation = new Date(now).toISOString();
      for (const c of chosen) {
        await q('INSERT INTO hk_recommendations (user_id, kind, title, reason, ref_type, ref_id, campaign_id, score, generation) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [user.id, c.kind, c.title.slice(0, 200), c.reason.slice(0, 400), c.ref_type, c.ref_id, c.campaign_id, c.score, generation]);
      }
      // giữ lịch sử gọn: chỉ các đợt trong 30 ngày gần nhất
      await q("DELETE FROM hk_recommendations WHERE user_id = $1 AND created_at < now() - interval '30 days'", [user.id]);
    });
  }

  /** Gợi ý hiện tại của học sinh (HK.HS.094); tự tính lại khi chưa có hoặc đã cũ quá `refresh_hours` */
  async current(user: UserRow) {
    if (user.role !== 'student') throw new ForbiddenException('Gợi ý học tập dành cho học sinh');
    const s = await this.settings();
    const latest = (await this.db.query<{ generation: string }>('SELECT max(generation) AS generation FROM hk_recommendations WHERE user_id = $1', [user.id]))[0].generation;
    if (!latest || Date.now() - new Date(latest).getTime() > s.refresh_hours * 3_600_000) await this.generate(user);
    const generation = (await this.db.query<{ generation: string }>('SELECT max(generation) AS generation FROM hk_recommendations WHERE user_id = $1', [user.id]))[0].generation;
    const items = generation ? await this.db.query(
      `SELECT id::int AS id, kind, title, reason, ref_type, ref_id, campaign_id, score::float8 AS score, feedback FROM hk_recommendations WHERE user_id = $1 AND generation = $2 ORDER BY score DESC, id`, [user.id, generation]) : [];
    return { generated_at: generation, refresh_hours: s.refresh_hours, items: items.map((i: Record<string, any>) => ({ ...i, kind_label: KIND_LABEL[i.kind as RecoKind] })) };
  }

  /** Làm mới ngay theo yêu cầu của học sinh */
  async refresh(user: UserRow) {
    if (user.role !== 'student') throw new ForbiddenException('Gợi ý học tập dành cho học sinh');
    await this.generate(user);
    return this.current(user);
  }

  /** Đánh giá gợi ý (HK.HS.098) */
  async feedback(user: UserRow, id: number, value: unknown) {
    if (value !== 'helpful' && value !== 'not_helpful' && value !== null) throw new BadRequestException('Đánh giá là helpful (hữu ích) hoặc not_helpful (không hữu ích)');
    const res = await this.db.query('UPDATE hk_recommendations SET feedback = $3, feedback_at = CASE WHEN $3::text IS NULL THEN NULL ELSE now() END WHERE id = $1 AND user_id = $2 RETURNING id', [id, user.id, value]);
    if (!res.length) throw notFound('gợi ý');
    return { id, feedback: value };
  }

  /** Việc nền theo lịch (HK.SYS.012): tính lại gợi ý cho học sinh còn hoạt động mà gợi ý đã cũ */
  async refreshStale(limit = 100): Promise<number> {
    const s = await this.settings();
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT ${USER_COLUMNS.split(', ').map((c) => `u.${c}`).join(', ')} FROM app_users u
       WHERE u.role = 'student' AND u.is_active = 1 AND u.deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM hk_events e WHERE e.user_id = u.id AND e.created_at >= now() - interval '14 days')
         AND COALESCE((SELECT max(r.generation) FROM hk_recommendations r WHERE r.user_id = u.id), 'epoch') < now() - ($1 || ' hours')::interval
       ORDER BY u.id LIMIT ${Math.max(1, Math.min(500, limit))}`, [String(s.refresh_hours)]);
    let done = 0;
    for (const row of rows) {
      try {
        const user = toUser(row);
        await this.db.withWorkspace(user, () => this.generate(user));
        done += 1;
      } catch (e) { this.logger.warn(`Không tính được gợi ý cho học sinh ${row.id}: ${(e as Error).message}`); }
    }
    return done;
  }

  // ---------------------------------------------------------------------- luyện tập cá nhân hóa (HK.HS.096, HK.SYS.013)
  async practice(user: UserRow, body: { topic_type?: string; topic_id?: number }) {
    if (user.role !== 'student') throw new ForbiddenException('Luyện tập cá nhân hóa dành cho học sinh');
    const s = await this.settings();
    let topics: Array<{ type: string; id: number }>;
    if (body.topic_type) {
      if (!(body.topic_type in TOPIC_LABEL) || !Number.isInteger(Number(body.topic_id))) throw new BadRequestException('Chủ đề không hợp lệ');
      topics = [{ type: body.topic_type, id: Number(body.topic_id) }];
    } else {
      const rows = await this.db.tx((q) => topicStats(q, [user.id], { weakThreshold: s.weak_threshold, minAnswers: s.min_answers }));
      topics = rows.filter((r) => r.level === 'weak').slice(0, 5).map((r) => ({ type: r.type, id: r.id }));
    }
    const ids = await this.pickQuestions(user, topics, s.practice_size);
    if (ids.length < 3) throw new ConflictException(topics.length ? 'Chủ đề này chưa đủ câu hỏi để luyện tập' : 'Em chưa có chủ đề yếu nào để luyện: hãy làm thêm vài bài quiz nhé');
    return this.play.startCustomPractice(user, ids);
  }

  /** Câu hỏi của chủ đề, ưu tiên câu em từng làm sai, sắp xếp từ dễ đến khó; chỉ câu em được phép thấy (kho hệ thống và kho trường) */
  async pickQuestions(user: UserRow, topics: Array<{ type: string; id: number }>, size: number): Promise<number[]> {
    if (!topics.length) return [];
    const types = topics.map((t) => t.type), refs = topics.map((t) => t.id);
    const rows = await this.db.query<{ id: number; difficulty: number; wrong: number }>(
      `SELECT DISTINCT t.id, t.difficulty, COALESCE(w.wrong_count, 0)::int AS wrong, md5(t.id::text || now()::date::text) AS shuffle
       FROM hk_questions t JOIN hk_question_links l ON l.question_id = t.id
       JOIN unnest($1::text[], $2::int[]) AS want(type, id) ON want.type = l.ref_type AND want.id = l.ref_id
       LEFT JOIN hk_wrong_questions w ON w.question_id = t.id AND w.user_id = $3
       WHERE (t.scope = 'system' OR (t.scope = 'school' AND t.school_id = $4)) AND t.qtype <> 'poll'
       ORDER BY wrong DESC, shuffle LIMIT $5`, [types, refs, user.id, user.school_id, size]);
    return rows.sort((a, b) => a.difficulty - b.difficulty).map((r) => r.id);
  }

  // ---------------------------------------------------------------------- lộ trình ôn tập trước kiểm tra (HK.HS.097)
  async examPlan(user: UserRow) {
    if (user.role !== 'student') throw new ForbiddenException('Lộ trình ôn tập dành cho học sinh');
    const s = await this.settings();
    const weak = (await this.db.tx((q) => topicStats(q, [user.id], { weakThreshold: s.weak_threshold, minAnswers: s.min_answers }))).filter((t) => t.level === 'weak');
    const wrongCount = Number((await this.db.query<{ n: string }>('SELECT count(*) AS n FROM hk_wrong_questions WHERE user_id = $1 AND cleared_at IS NULL', [user.id]))[0].n);
    const now = Date.now();
    const vnDay = (ms: number): string => new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10);
    const exams: Array<Record<string, any>> = [];
    for (const a of (await this.assignments.mine(user)) as Array<Record<string, any>>) {
      if (!['todo', 'doing'].includes(a.state)) continue;
      const due = new Date(a.due_at).getTime();
      const daysLeft = Math.ceil((due - now) / DAY);
      if (daysLeft < 1 || daysLeft > 21) continue;
      // chủ đề của bài: các chủ đề gắn với câu hỏi trong bộ đề; ưu tiên chủ đề em đang yếu
      let own: TopicRow[] = weak;
      if (a.kind === 'quiz' && a.quiz_id) {
        const links = await this.db.query<{ ref_type: TopicType; ref_id: number }>('SELECT DISTINCT l.ref_type, l.ref_id FROM hk_quiz_questions k JOIN hk_question_links l ON l.question_id = k.question_id WHERE k.quiz_id = $1', [a.quiz_id]);
        const set = new Set(links.map((l) => `${l.ref_type}:${l.ref_id}`));
        own = weak.filter((t) => set.has(`${t.type}:${t.id}`));
        if (!own.length) own = weak;
      }
      const span = Math.min(daysLeft, 7);
      const days = [] as Array<{ date: string; tasks: Array<Record<string, any>> }>;
      for (let i = 0; i < span; i += 1) {
        const date = vnDay(due - (span - i) * DAY);
        const tasks: Array<Record<string, any>> = [];
        const topic = own[i % Math.max(1, own.length)];
        if (topic && i < span - 1) tasks.push({ kind: 'practice', title: `Luyện chủ đề: ${topic.name}`, topic_type: topic.type, topic_id: topic.id, minutes: 15 });
        if (i === span - 2 && wrongCount) tasks.push({ kind: 'wrong', title: `Làm lại ${Math.min(wrongCount, 10)} câu em từng sai`, minutes: 10 });
        if (i === span - 1) tasks.push({ kind: 'rest', title: 'Xem lại ghi chú và nghỉ ngơi sớm', minutes: 10 });
        if (!tasks.length) tasks.push({ kind: 'review', title: 'Ôn lại bài học trong hành trình đang học', minutes: 15 });
        days.push({ date, tasks });
      }
      days.push({ date: vnDay(due), tasks: [{ kind: 'exam', title: `Làm bài: ${a.title}`, assignment_id: a.id, minutes: 20 }] });
      exams.push({ assignment_id: a.id, title: a.title, class_name: a.class_name, due_at: a.due_at, days_left: daysLeft, weak_topics: own.slice(0, 5).map((t) => ({ type: t.type, id: t.id, name: t.name, percent: t.percent })), days });
    }
    return { exams: exams.sort((x, y) => x.days_left - y.days_left), note: 'Lộ trình lấy theo các bài tập giáo viên giao cho lớp; chỉ hiện bài còn từ 1 đến 21 ngày nữa là đến hạn.' };
  }
}
