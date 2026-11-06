/**
 * Thống kê và báo cáo (Sprint 10): bảng điều khiển lớp, tiến độ từng học sinh, báo cáo theo chủ đề, học sinh cần hỗ trợ, so sánh lớp (HK.GV.066–070); tổng quan, mức độ sử dụng,
 * kết quả theo khối / lớp / giáo viên, sử dụng AI, hồ sơ học sinh của trường (HK.QT.006–009, 033, 047); thống kê toàn hệ thống, hoạt động, AI và nội dung (HK.AD.006–009).
 * Chỉ đọc dữ liệu đã có (lượt làm bài, tiến độ nút, sự kiện học tập, thi đấu, hội thoại AI). Phạm vi: giáo viên chỉ thấy lớp mình dạy, quản trị viên trường chỉ thấy trường mình,
 * quản trị tổng thấy tất cả. Mọi số liệu theo ngày dùng giờ Việt Nam.
 */
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { notFound } from '../content/access';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { activeJourneys, nodesWithState } from '../student/progress';
import { RecoService, RecoSettings } from './reco.service';
import { byType, topicStats, TopicRow } from './topics';

const WINDOW = '(cj.starts_at IS NULL OR cj.starts_at <= now()) AND (cj.ends_at IS NULL OR cj.ends_at > now())';
const VN = "'Asia/Ho_Chi_Minh'";
const ACTIVITY = ['node_complete', 'lesson_complete', 'attempt_finish', 'battle_finish', 'minigame_finish'];
export const EVENT_LABEL: Record<string, string> = {
  node_complete: 'Hoàn thành một nút', lesson_complete: 'Đọc xong bài học', lesson_check: 'Làm câu kiểm tra nhanh', attempt_start: 'Bắt đầu làm bài', attempt_finish: 'Làm xong bài',
  answer: 'Trả lời câu hỏi', battle_start: 'Vào trận mô phỏng', battle_finish: 'Kết thúc trận mô phỏng', minigame_start: 'Bắt đầu mini-game', minigame_finish: 'Xong mini-game',
  view_library: 'Xem thư viện', view_timeline: 'Xem dòng thời gian', view_map: 'Xem bản đồ', view_source: 'Đọc tư liệu', view_lesson: 'Mở bài học', view_listen: 'Nghe kể chuyện', view_guide: 'Xem cẩm nang', search: 'Tìm kiếm',
  view_battle_animation: 'Xem hoạt ảnh trận đánh',
};
const num = (v: unknown): number => Number(v ?? 0);
const pct = (a: number, b: number): number | null => (b ? Math.round((a / b) * 100) : null);
const avg = (list: number[]): number | null => (list.length ? Math.round(list.reduce((n, x) => n + x, 0) / list.length) : null);
/** Ngày theo giờ Việt Nam dạng YYYY-MM-DD → mốc thời gian đầu/cuối ngày */
const startOf = (d?: string): string | undefined => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00+07:00` : undefined);
const endOf = (d?: string): string | undefined => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T23:59:59.999+07:00` : undefined);

export interface Period { from?: string; to?: string }
export interface ClassInfo { id: number; name: string; grade: number | null; school_id: number; school_name: string; year_label: string | null; is_active: boolean; teachers: string | null; teacher_ids: number[]; students: number }
export interface StudentStat {
  id: number; full_name: string; user_code: string | null; email: string | null; progress: number | null; nodes_done: number; nodes_total: number; xp: number; level: number; streak: number;
  avg_percent: number | null; attempts: number; answered: number; correct: number; accuracy: number | null; study_minutes: number; last_active_at: string | null; active_days: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly db: DatabaseService, private readonly reco: RecoService) {}

  // ---------------------------------------------------------------------- phạm vi
  async classes(user: UserRow): Promise<ClassInfo[]> {
    const params: unknown[] = [];
    let where = 'TRUE';
    if (user.role === 'teacher') { params.push(user.id); where = 'c.id IN (SELECT class_id FROM app_class_teachers WHERE teacher_id = $1)'; }
    else if (user.role === 'school_admin') { params.push(user.school_id); where = 'c.school_id = $1'; }
    else if (user.role !== 'root_admin') throw new ForbiddenException('Không có quyền xem báo cáo lớp');
    return this.db.query<ClassInfo>(
      `SELECT c.id, c.name, c.grade, c.school_id, s.name AS school_name, y.label AS year_label, c.is_active,
              (SELECT string_agg(u.full_name, ', ' ORDER BY u.full_name) FROM app_class_teachers t JOIN app_users u ON u.id = t.teacher_id WHERE t.class_id = c.id) AS teachers,
              COALESCE((SELECT array_agg(t.teacher_id) FROM app_class_teachers t WHERE t.class_id = c.id), '{}') AS teacher_ids,
              (SELECT count(*)::int FROM app_class_members m JOIN app_users u ON u.id = m.user_id AND u.role = 'student' AND u.deleted_at IS NULL WHERE m.class_id = c.id) AS students
       FROM app_classes c JOIN app_schools s ON s.id = c.school_id LEFT JOIN app_school_years y ON y.id = c.year_id WHERE ${where} ORDER BY s.name, c.grade NULLS LAST, c.name`, params);
  }

  async assertClass(user: UserRow, classId: number): Promise<ClassInfo> {
    const c = (await this.classes(user)).find((x) => x.id === classId);
    if (!c) throw notFound('lớp');
    return c;
  }

  private async studentsOf(q: Q, classId: number) {
    return q<{ id: number; full_name: string; user_code: string | null; email: string | null; parent_email: string | null }>(
      `SELECT u.id, u.full_name, u.user_code, u.email, u.parent_email FROM app_class_members m JOIN app_users u ON u.id = m.user_id AND u.role = 'student' AND u.deleted_at IS NULL AND u.is_active = 1
       WHERE m.class_id = $1 ORDER BY u.full_name, u.id`, [classId]);
  }

  // ---------------------------------------------------------------------- số liệu từng học sinh (một lượt truy vấn cho nhiều học sinh)
  /** Tiến độ hành trình: mỗi cuộc kháng chiến học một hành trình (giao cho lớp đang chạy, nếu không thì mặc định của hệ thống) */
  private async progressOf(q: Q, ids: number[]): Promise<Map<number, { done: number; total: number }>> {
    if (!ids.length) return new Map();
    const rows = await q<{ user_id: number; total: number; done: number }>(
      `WITH me AS (SELECT unnest($1::int[]) AS user_id),
            aj AS (
              SELECT DISTINCT ON (me.user_id, j.campaign_id) me.user_id, j.id AS journey_id
              FROM me CROSS JOIN hk_journeys j JOIN hist_campaigns c ON c.id = j.campaign_id AND c.status = 'published'
              LEFT JOIN (SELECT m.user_id, cj.journey_id, max(cj.assigned_at) AS assigned_at FROM hk_class_journeys cj JOIN app_class_members m ON m.class_id = cj.class_id
                         WHERE m.user_id = ANY($1) AND ${WINDOW} GROUP BY m.user_id, cj.journey_id) a ON a.user_id = me.user_id AND a.journey_id = j.id
              WHERE j.status = 'published' AND (a.journey_id IS NOT NULL OR (j.is_default AND (j.scope='system' OR j.school_id=(SELECT school_id FROM app_users WHERE id=me.user_id))))
              ORDER BY me.user_id, j.campaign_id, (a.journey_id IS NOT NULL) DESC, a.assigned_at DESC NULLS LAST, (j.scope='school') DESC, j.id)
       SELECT aj.user_id, count(n.id)::int AS total, count(np.completed_at)::int AS done
       FROM aj JOIN hk_nodes n ON n.journey_id = aj.journey_id LEFT JOIN hk_node_progress np ON np.node_id = n.id AND np.user_id = aj.user_id GROUP BY aj.user_id`, [ids]);
    return new Map(rows.map((r) => [r.user_id, { done: r.done, total: r.total }]));
  }

  async statsOf(q: Q, people: Array<{ id: number; full_name: string; user_code: string | null; email: string | null }>, period: Period = {}): Promise<StudentStat[]> {
    const ids = people.map((p) => p.id);
    if (!ids.length) return [];
    const from = startOf(period.from), to = endOf(period.to);
    const prog = await this.progressOf(q, ids);
    const players = new Map((await q<{ user_id: number; xp: number; level: number; streak_current: number }>('SELECT user_id, xp, level, streak_current FROM hk_players WHERE user_id = ANY($1)', [ids])).map((r) => [r.user_id, r]));
    const range = (col: string, params: unknown[]): string => `${from ? (params.push(from), ` AND ${col} >= $${params.length}`) : ''}${to ? (params.push(to), ` AND ${col} <= $${params.length}`) : ''}`;
    const p1: unknown[] = [ids];
    const att = new Map((await q<{ user_id: number; avg: number | null; attempts: number }>(
      `SELECT t.user_id, round(avg(t.percent))::int AS avg, count(*)::int AS attempts FROM hk_attempts t WHERE t.user_id = ANY($1) AND t.status = 'done' AND t.mode <> 'preview'${range('t.finished_at', p1)} GROUP BY t.user_id`, p1)).map((r) => [r.user_id, r]));
    const p2: unknown[] = [ids];
    const ans = new Map((await q<{ user_id: number; answered: number; correct: number }>(
      `SELECT t.user_id, count(*)::int AS answered, count(*) FILTER (WHERE a.correct)::int AS correct FROM hk_attempt_answers a JOIN hk_attempts t ON t.id = a.attempt_id
       WHERE t.user_id = ANY($1) AND t.mode <> 'preview'${range('a.answered_at', p2)} GROUP BY t.user_id`, p2)).map((r) => [r.user_id, r]));
    const p3: unknown[] = [ids];
    const act = new Map((await q<{ user_id: number; last_at: string | null; ms: string; days: number }>(
      `SELECT e.user_id, max(e.created_at) AS last_at, COALESCE(sum(e.duration_ms), 0)::bigint AS ms, count(DISTINCT (e.created_at AT TIME ZONE ${VN})::date)::int AS days
       FROM hk_events e WHERE e.user_id = ANY($1)${range('e.created_at', p3)} GROUP BY e.user_id`, p3)).map((r) => [r.user_id, r]));
    return people.map((p) => {
      const g = prog.get(p.id) ?? { done: 0, total: 0 }, pl = players.get(p.id), a = att.get(p.id), an = ans.get(p.id), ac = act.get(p.id);
      return {
        id: p.id, full_name: p.full_name, user_code: p.user_code, email: p.email, progress: pct(g.done, g.total), nodes_done: g.done, nodes_total: g.total, xp: pl?.xp ?? 0, level: pl?.level ?? 1, streak: pl?.streak_current ?? 0,
        avg_percent: a?.avg ?? null, attempts: a?.attempts ?? 0, answered: an?.answered ?? 0, correct: an?.correct ?? 0, accuracy: an ? pct(an.correct, an.answered) : null,
        study_minutes: Math.round(num(ac?.ms) / 60000), last_active_at: ac?.last_at ?? null, active_days: ac?.days ?? 0,
      };
    });
  }

  private daysAgo(iso: string | null): number | null { return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null; }

  // ---------------------------------------------------------------------- GV.066: bảng điều khiển lớp
  async dashboard(user: UserRow, classId: number, period: Period & { days?: number } = {}) {
    const info = await this.assertClass(user, classId);
    return this.db.tx(async (q) => {
      const people = await this.studentsOf(q, classId);
      const stats = await this.statsOf(q, people, period);
      const ids = people.map((p) => p.id);
      const days = Math.min(90, Math.max(7, Math.round(Number(period.days ?? 14)) || 14));
      const series = ids.length ? await q<{ day: string; events: number; students: number }>(
        `SELECT to_char(e.created_at AT TIME ZONE ${VN}, 'YYYY-MM-DD') AS day, count(*)::int AS events, count(DISTINCT e.user_id)::int AS students
         FROM hk_events e WHERE e.user_id = ANY($1) AND e.event = ANY($2) AND e.created_at >= now() - ($3::int * interval '1 day') GROUP BY 1 ORDER BY 1`, [ids, ACTIVITY, days]) : [];
      const byDay = new Map(series.map((r) => [r.day, r]));
      const filled = Array.from({ length: days }, (_, i) => {
        const day = new Date(Date.now() + 7 * 3_600_000 - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
        return { day, events: byDay.get(day)?.events ?? 0, students: byDay.get(day)?.students ?? 0 };
      });
      const withProgress = stats.filter((s) => s.progress !== null);
      const active7 = stats.filter((s) => (this.daysAgo(s.last_active_at) ?? 99) < 7).length;
      return {
        class: info, students: stats.length, avg_progress: avg(withProgress.map((s) => s.progress!)), completion_rate: pct(withProgress.filter((s) => s.progress === 100).length, stats.length),
        avg_points: avg(stats.map((s) => s.xp)), avg_percent: avg(stats.filter((s) => s.avg_percent !== null).map((s) => s.avg_percent!)), accuracy: pct(stats.reduce((n, s) => n + s.correct, 0), stats.reduce((n, s) => n + s.answered, 0)),
        active_week: active7, participation: pct(active7, stats.length), streak_holders: stats.filter((s) => s.streak >= 3).length, study_minutes: stats.reduce((n, s) => n + s.study_minutes, 0),
        distribution: [[0, 25], [25, 50], [50, 75], [75, 101]].map(([lo, hi]) => ({ label: hi === 101 ? '75–100%' : `${lo}–${hi}%`, count: withProgress.filter((s) => s.progress! >= lo && s.progress! < hi).length })),
        series: filled, roster: stats, period: { from: period.from ?? null, to: period.to ?? null },
      };
    });
  }

  // ---------------------------------------------------------------------- GV.067 và QT.033: hồ sơ học tập một học sinh
  private async assertStudentAccess(user: UserRow, studentId: number): Promise<{ id: number; full_name: string; user_code: string | null; email: string | null; parent_email: string | null; school_id: number | null; grade: number | null }> {
    const s = (await this.db.query<{ id: number; full_name: string; user_code: string | null; email: string | null; parent_email: string | null; school_id: number | null; grade: number | null }>(
      "SELECT id, full_name, user_code, email, parent_email, school_id, grade FROM app_users WHERE id = $1 AND role = 'student' AND deleted_at IS NULL", [studentId]))[0];
    if (!s) throw notFound('học sinh');
    if (user.role === 'root_admin' || (user.role === 'student' && user.id === studentId)) return s;
    if (user.role === 'school_admin' && s.school_id === user.school_id) return s;
    if (user.role === 'teacher' && (await this.db.query(
      'SELECT 1 FROM app_class_members m JOIN app_class_teachers t ON t.class_id = m.class_id WHERE m.user_id = $1 AND t.teacher_id = $2 LIMIT 1', [studentId, user.id])).length) return s;
    throw notFound('học sinh');
  }

  async studentProfile(user: UserRow, studentId: number) {
    const st = await this.assertStudentAccess(user, studentId);
    const reco = await this.reco.settings();
    return this.db.tx(async (q) => {
      const [stat] = await this.statsOf(q, [st]);
      const journeys = [];
      for (const j of await activeJourneys(q, st.id)) {
        const nodes = await nodesWithState(q, st.id, j.journey_id);
        journeys.push({ journey_id: j.journey_id, title: j.title, from_class: j.from_class, done: nodes.filter((n) => n.state === 'done').length, total: nodes.length,
          nodes: nodes.map((n) => ({ id: n.id, title: n.title, kind: n.kind, state: n.state, best_percent: n.best_percent, stars: n.stars, attempts: n.attempts, completed_at: n.completed_at })) });
      }
      const attempts = await q(
        `SELECT t.id::int AS id, t.mode, t.percent, t.stars, t.passed, t.correct_count, t.wrong_count, t.duration_ms, t.finished_at, COALESCE(n.title, z.title, 'Luyện tập') AS title
         FROM hk_attempts t LEFT JOIN hk_nodes n ON n.id = t.node_id LEFT JOIN hk_quizzes z ON z.id = t.quiz_id
         WHERE t.user_id = $1 AND t.status = 'done' AND t.mode <> 'preview' ORDER BY t.finished_at DESC LIMIT 20`, [st.id]);
      const battles = await q(
        `SELECT r.kind, COALESCE(s.title, g.title) AS title, r.percent, r.stars, r.passed, r.finished_at FROM hk_game_runs r LEFT JOIN hk_scenarios s ON s.id = r.scenario_id LEFT JOIN hk_minigames g ON g.id = r.minigame_id
         WHERE r.user_id = $1 AND r.status = 'done' AND r.mode = 'play' ORDER BY r.finished_at DESC LIMIT 10`, [st.id]);
      const war = await q(
        `SELECT s.title, p.best_stars, p.clears, p.attempts FROM hk_stage_progress p JOIN hk_stages s ON s.id = p.stage_id WHERE p.user_id = $1 AND p.attempts > 0 ORDER BY p.stage_id`, [st.id]);
      const timeline = (await q<{ event: string; ref_type: string | null; created_at: string }>('SELECT event, ref_type, created_at FROM hk_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30', [st.id]))
        .map((e) => ({ ...e, label: EVENT_LABEL[e.event] ?? e.event }));
      const topics = await topicStats(q, [st.id], { weakThreshold: reco.weak_threshold, minAnswers: reco.min_answers });
      const badges = await q('SELECT b.name, b.icon, ub.awarded_at FROM hk_user_badges ub JOIN hk_badges b ON b.id = ub.badge_id WHERE ub.user_id = $1 ORDER BY ub.awarded_at DESC LIMIT 20', [st.id]);
      const cards = num((await q<{ n: string }>('SELECT count(*) AS n FROM hk_user_cards WHERE user_id = $1', [st.id]))[0].n);
      const ai = num((await q<{ n: string }>("SELECT count(*) AS n FROM hk_ai_messages m JOIN hk_ai_conversations c ON c.id = m.conversation_id WHERE c.user_id = $1 AND m.role = 'user' AND m.created_at >= now() - interval '30 days'", [st.id]))[0].n);
      const classes = await q<{ id: number; name: string }>('SELECT c.id, c.name FROM app_class_members m JOIN app_classes c ON c.id = m.class_id WHERE m.user_id = $1 ORDER BY c.name', [st.id]);
      return {
        student: { id: st.id, full_name: st.full_name, user_code: st.user_code, email: st.email, has_parent_email: Boolean(st.parent_email), grade: st.grade, classes },
        stats: stat, journeys, attempts, battles, war, timeline, badges, cards, ai_questions_30d: ai,
        topics: { by_type: byType(topics), strong: topics.filter((t) => t.level === 'strong').slice(-5).reverse(), weak: topics.filter((t) => t.level === 'weak').slice(0, 8), all: topics },
      };
    });
  }

  /** HK.HS.095: điểm mạnh và điểm yếu của chính học sinh theo từng loại chủ đề, từng chủ đề và từng cuộc kháng chiến */
  async strengths(user: UserRow) {
    const s = await this.reco.settings();
    return this.db.tx(async (q) => {
      const topics = await topicStats(q, [user.id], { weakThreshold: s.weak_threshold, minAnswers: s.min_answers });
      const [stat] = await this.statsOf(q, [{ id: user.id, full_name: user.full_name, user_code: user.user_code, email: user.email }]);
      return {
        overall: { answered: stat.answered, correct: stat.correct, accuracy: stat.accuracy }, weak_threshold: s.weak_threshold, min_answers: s.min_answers, by_type: byType(topics),
        strong: topics.filter((t) => t.level === 'strong').slice(-6).reverse(), weak: topics.filter((t) => t.level === 'weak').slice(0, 8), topics,
      };
    });
  }

  // ---------------------------------------------------------------------- GV.068: báo cáo theo chủ đề của lớp
  async classTopics(user: UserRow, classId: number, period: Period = {}) {
    const info = await this.assertClass(user, classId);
    const s = await this.reco.settings();
    return this.db.tx(async (q) => {
      const ids = (await this.studentsOf(q, classId)).map((p) => p.id);
      const topics = await topicStats(q, ids, { weakThreshold: s.weak_threshold, minAnswers: s.min_answers * Math.max(1, Math.min(3, ids.length)), since: startOf(period.from) });
      return { class: info, weak_threshold: s.weak_threshold, by_type: byType(topics), weak: topics.filter((t) => t.level === 'weak').slice(0, 12), topics, students: ids.length };
    });
  }

  // ---------------------------------------------------------------------- GV.069: học sinh cần hỗ trợ (theo quy tắc, không gọi mô hình)
  async support(user: UserRow, classId: number) {
    const info = await this.assertClass(user, classId);
    const s = await this.reco.settings();
    return this.db.tx(async (q) => {
      const people = await this.studentsOf(q, classId);
      const stats = await this.statsOf(q, people);
      const meanProgress = avg(stats.filter((x) => x.progress !== null).map((x) => x.progress!)) ?? 0;
      const flagged = [];
      for (const st of stats) {
        const idle = this.daysAgo(st.last_active_at);
        const reasons: string[] = [];
        if (idle === null) reasons.push('Chưa hoạt động lần nào');
        else if (idle >= 7) reasons.push(`Đã ${idle} ngày không học`);
        if (st.accuracy !== null && st.answered >= 5 && st.accuracy < s.weak_threshold) reasons.push(`Tỉ lệ đúng thấp (${st.accuracy}% trên ${st.answered} câu)`);
        if (st.progress !== null && meanProgress - st.progress >= 25) reasons.push(`Tiến độ ${st.progress}% thấp hơn trung bình lớp (${meanProgress}%) từ 25 điểm`);
        if (!reasons.length) continue;
        const weak = (await topicStats(q, [st.id], { weakThreshold: s.weak_threshold, minAnswers: s.min_answers })).filter((t) => t.level === 'weak').slice(0, 3);
        flagged.push({
          id: st.id, full_name: st.full_name, user_code: st.user_code, severity: reasons.length, reasons, progress: st.progress, accuracy: st.accuracy, last_active_at: st.last_active_at, weak_topics: weak.map((t) => ({ type: t.type, id: t.id, name: t.name, percent: t.percent })),
          suggestion: weak.length ? `Nhắc em ôn lại ${weak.map((t) => `“${t.name}”`).join(', ')} và gợi ý em dùng mục Luyện tập.` : idle === null || idle >= 7 ? 'Hỏi thăm em và nhắc em mở hành trình học hôm nay.' : 'Theo dõi thêm và động viên em hoàn thành các nút còn lại.',
        });
      }
      return { class: info, students: stats.length, mean_progress: meanProgress, items: flagged.sort((a, b) => b.severity - a.severity || a.full_name.localeCompare(b.full_name, 'vi')), note: 'Danh sách do hệ thống đề xuất theo quy tắc (không hoạt động, tỉ lệ đúng thấp, tiến độ chậm); giáo viên quyết định cách hỗ trợ.' };
    });
  }

  // ---------------------------------------------------------------------- GV.070 và QT.008, QT.047: so sánh lớp, kết quả theo khối / lớp / giáo viên
  async results(user: UserRow, by: 'class' | 'grade' | 'teacher', period: Period = {}) {
    if (!['class', 'grade', 'teacher'].includes(by)) throw new BadRequestException('Nhóm theo class, grade hoặc teacher');
    const classes = (await this.classes(user)).filter((c) => c.is_active || period.from);
    return this.db.tx(async (q) => {
      const members = await q<{ class_id: number; id: number; full_name: string; user_code: string | null; email: string | null }>(
        `SELECT m.class_id, u.id, u.full_name, u.user_code, u.email FROM app_class_members m JOIN app_users u ON u.id = m.user_id AND u.role = 'student' AND u.deleted_at IS NULL
         WHERE m.class_id = ANY($1)`, [classes.map((c) => c.id)]);
      const unique = [...new Map(members.map((m) => [m.id, m])).values()];
      const stats = new Map((await this.statsOf(q, unique, period)).map((s) => [s.id, s]));
      const rows = classes.map((c) => {
        const list = members.filter((m) => m.class_id === c.id).map((m) => stats.get(m.id)!).filter(Boolean);
        const inPeriod = list.filter((s) => s.attempts > 0 || s.active_days > 0);
        return {
          class_id: c.id, class_name: c.name, grade: c.grade, teachers: c.teachers, teacher_ids: c.teacher_ids, school_name: c.school_name, students: list.length, active_students: inPeriod.length,
          participation: pct(inPeriod.length, list.length), avg_progress: avg(list.filter((s) => s.progress !== null).map((s) => s.progress!)), avg_percent: avg(list.filter((s) => s.avg_percent !== null).map((s) => s.avg_percent!)),
          accuracy: pct(list.reduce((n, s) => n + s.correct, 0), list.reduce((n, s) => n + s.answered, 0)), avg_points: avg(list.map((s) => s.xp)), _stats: list,
        };
      });
      type Group = { key: string; label: string; classes: number; students: number; active_students: number; participation: number | null; avg_progress: number | null; avg_percent: number | null; accuracy: number | null; avg_points: number | null; rank: number };
      const group = (key: string, label: string, parts: typeof rows): Omit<Group, 'rank'> => {
        const all = parts.flatMap((r) => r._stats);
        const uniq = [...new Map(all.map((s) => [s.id, s])).values()];
        const activeN = uniq.filter((s) => s.attempts > 0 || s.active_days > 0).length;
        return { key, label, classes: parts.length, students: uniq.length, active_students: activeN, participation: pct(activeN, uniq.length), avg_progress: avg(uniq.filter((s) => s.progress !== null).map((s) => s.progress!)),
          avg_percent: avg(uniq.filter((s) => s.avg_percent !== null).map((s) => s.avg_percent!)), accuracy: pct(uniq.reduce((n, s) => n + s.correct, 0), uniq.reduce((n, s) => n + s.answered, 0)), avg_points: avg(uniq.map((s) => s.xp)) };
      };
      let groups: Array<Omit<Group, 'rank'>>;
      if (by === 'class') groups = rows.map((r) => group(String(r.class_id), `${r.class_name}${user.role === 'root_admin' ? ` – ${r.school_name}` : ''}`, [r]));
      else if (by === 'grade') groups = [...new Set(rows.map((r) => r.grade))].sort((a, b) => (a ?? 99) - (b ?? 99)).map((g) => group(String(g), g ? `Khối ${g}` : 'Chưa phân khối', rows.filter((r) => r.grade === g)));
      else {
        const tids = [...new Set(rows.flatMap((r) => r.teacher_ids))];
        const people = tids.length ? await q<{ id: number; full_name: string }>('SELECT id, full_name FROM app_users WHERE id = ANY($1)', [tids]) : [];
        groups = people.map((t) => group(String(t.id), t.full_name, rows.filter((r) => r.teacher_ids.includes(t.id))));
      }
      const ranked = [...groups].sort((a, b) => (b.avg_percent ?? -1) - (a.avg_percent ?? -1) || (b.avg_progress ?? -1) - (a.avg_progress ?? -1)).map((g, i) => ({ ...g, rank: i + 1 }));
      return { by, period: { from: period.from ?? null, to: period.to ?? null }, groups: ranked, classes: rows.map(({ _stats, ...r }) => r) };
    });
  }

  // ---------------------------------------------------------------------- QT.006 / AD.006: tổng quan
  async schoolOverview(user: UserRow) {
    if (user.role !== 'school_admin' || !user.school_id) throw new ForbiddenException('Chỉ quản trị viên trường xem thống kê trường');
    const id = user.school_id;
    const one = async (sql: string): Promise<number> => num((await this.db.query<{ n: string }>(sql, [id]))[0].n);
    return {
      classes: await one('SELECT count(*) AS n FROM app_classes WHERE school_id = $1 AND is_active'),
      teachers: await one("SELECT count(*) AS n FROM app_users WHERE school_id = $1 AND role = 'teacher' AND deleted_at IS NULL AND is_active = 1"),
      students: await one("SELECT count(*) AS n FROM app_users WHERE school_id = $1 AND role = 'student' AND deleted_at IS NULL AND is_active = 1"),
      journeys_running: await one(`SELECT count(DISTINCT cj.journey_id) AS n FROM hk_class_journeys cj JOIN app_classes c ON c.id = cj.class_id AND c.school_id = $1 WHERE ${WINDOW}`),
      activities_today: await one(`SELECT count(*) AS n FROM hk_events WHERE school_id = $1 AND event = ANY(ARRAY['${ACTIVITY.join("','")}']) AND (created_at AT TIME ZONE ${VN})::date = (now() AT TIME ZONE ${VN})::date`),
      active_today: await one(`SELECT count(DISTINCT user_id) AS n FROM hk_events WHERE school_id = $1 AND (created_at AT TIME ZONE ${VN})::date = (now() AT TIME ZONE ${VN})::date`),
      active_week: await one("SELECT count(DISTINCT user_id) AS n FROM hk_events WHERE school_id = $1 AND created_at >= now() - interval '7 days'"),
    };
  }

  async systemOverview() {
    const one = async (sql: string): Promise<number> => num((await this.db.query<{ n: string }>(sql))[0].n);
    const roles = await this.db.query<{ role: string; n: number }>("SELECT role, count(*)::int AS n FROM app_users WHERE deleted_at IS NULL AND is_active = 1 GROUP BY role");
    const series = await this.db.query<{ day: string; users: number }>(
      `SELECT to_char(created_at AT TIME ZONE ${VN}, 'YYYY-MM-DD') AS day, count(DISTINCT user_id)::int AS users FROM hk_events WHERE created_at >= now() - interval '30 days' GROUP BY 1 ORDER BY 1`);
    return {
      schools: await one('SELECT count(*) AS n FROM app_schools WHERE is_active'), schools_total: await one('SELECT count(*) AS n FROM app_schools'),
      users_by_role: Object.fromEntries(roles.map((r) => [r.role, r.n])),
      dau: await one(`SELECT count(DISTINCT user_id) AS n FROM hk_events WHERE (created_at AT TIME ZONE ${VN})::date = (now() AT TIME ZONE ${VN})::date`),
      wau: await one("SELECT count(DISTINCT user_id) AS n FROM hk_events WHERE created_at >= now() - interval '7 days'"),
      mau: await one("SELECT count(DISTINCT user_id) AS n FROM hk_events WHERE created_at >= now() - interval '30 days'"),
      new_users_30d: await one("SELECT count(*) AS n FROM app_users WHERE created_at::timestamptz >= now() - interval '30 days' AND deleted_at IS NULL"), series,
    };
  }

  // ---------------------------------------------------------------------- QT.007 / AD.007: mức độ sử dụng theo thời gian
  async usage(user: UserRow, granularity: string, daysRaw?: number) {
    if (!['day', 'week', 'month'].includes(granularity)) throw new BadRequestException('Đơn vị thời gian là day, week hoặc month');
    if (user.role === 'school_admin' && !user.school_id) throw new ForbiddenException('Không xác định được trường');
    if (!['school_admin', 'root_admin'].includes(user.role)) throw new ForbiddenException('Chỉ quản trị xem được thống kê sử dụng');
    const days = Math.min(365, Math.max(7, Math.round(Number(daysRaw ?? (granularity === 'day' ? 30 : granularity === 'week' ? 90 : 365))) || 30));
    const school = user.role === 'school_admin' ? user.school_id : null;
    const trunc = granularity === 'day' ? 'day' : granularity;
    const bucket = (col: string): string => (granularity === 'month' ? `to_char(date_trunc('month', ${col} AT TIME ZONE ${VN}), 'YYYY-MM')` : `to_char(date_trunc('${trunc}', ${col} AT TIME ZONE ${VN}), 'YYYY-MM-DD')`);
    const p = (extra: unknown[] = []): unknown[] => [days, ...extra, ...(school ? [school] : [])];
    const ev = await this.db.query<{ b: string; lessons: number; quizzes: number; battles: number; users: number }>(
      `SELECT ${bucket('e.created_at')} AS b, count(*) FILTER (WHERE e.event = 'lesson_complete')::int AS lessons, count(*) FILTER (WHERE e.event = 'attempt_finish')::int AS quizzes,
              count(*) FILTER (WHERE e.event IN ('battle_finish', 'minigame_finish'))::int AS battles, count(DISTINCT e.user_id)::int AS users
       FROM hk_events e WHERE e.created_at >= now() - ($1::int * interval '1 day')${school ? ' AND e.school_id = $2' : ''} GROUP BY 1`, p());
    const war = await this.db.query<{ b: string; n: number }>(
      `SELECT ${bucket('w.last_action_at')} AS b, count(*)::int AS n FROM hk_war_battles w JOIN app_users u ON u.id = w.user_id
       WHERE w.status IN ('won', 'lost') AND w.mode = 'play' AND w.last_action_at >= now() - ($1::int * interval '1 day')${school ? ' AND u.school_id = $2' : ''} GROUP BY 1`, p());
    const rooms = await this.db.query<{ b: string; n: number }>(
      `SELECT ${bucket('r.created_at')} AS b, count(*)::int AS n FROM hk_live_rooms r JOIN app_classes c ON c.id = r.class_id
       WHERE r.created_at >= now() - ($1::int * interval '1 day')${school ? ' AND c.school_id = $2' : ''} GROUP BY 1`, p());
    const keys = new Set([...ev.map((r) => r.b), ...war.map((r) => r.b), ...rooms.map((r) => r.b)]);
    const items = [...keys].sort().map((b) => {
      const e = ev.find((r) => r.b === b), w = war.find((r) => r.b === b), r = rooms.find((x) => x.b === b);
      return { bucket: b, lessons: e?.lessons ?? 0, quizzes: e?.quizzes ?? 0, battles: (e?.battles ?? 0) + (w?.n ?? 0), rooms: r?.n ?? 0, users: e?.users ?? 0 };
    });
    return { granularity, days, items, totals: { lessons: items.reduce((n, i) => n + i.lessons, 0), quizzes: items.reduce((n, i) => n + i.quizzes, 0), battles: items.reduce((n, i) => n + i.battles, 0), rooms: items.reduce((n, i) => n + i.rooms, 0) } };
  }

  // ---------------------------------------------------------------------- QT.009 / AD.008: sử dụng AI
  async aiUsage(user: UserRow, daysRaw?: number) {
    if (!['school_admin', 'root_admin'].includes(user.role)) throw new ForbiddenException('Chỉ quản trị xem được thống kê AI');
    const days = Math.min(90, Math.max(1, Math.round(Number(daysRaw ?? 30)) || 30));
    const school = user.role === 'school_admin' ? user.school_id : null;
    const scope = school ? 'AND u.school_id = $2' : '';
    const params: unknown[] = school ? [days, school] : [days];
    const base = `FROM hk_ai_messages m JOIN hk_ai_conversations c ON c.id = m.conversation_id JOIN app_users u ON u.id = c.user_id WHERE m.created_at >= now() - ($1::int * interval '1 day') ${scope}`;
    const t = (await this.db.query<{ questions: number; refused: number; tokens_in: string; tokens_out: string; llm: number; users: number; reports: number }>(
      `SELECT count(*) FILTER (WHERE m.role = 'user')::int AS questions, count(*) FILTER (WHERE m.role = 'assistant' AND m.refused)::int AS refused, COALESCE(sum(m.tokens_in), 0) AS tokens_in, COALESCE(sum(m.tokens_out), 0) AS tokens_out,
              count(*) FILTER (WHERE m.answer_mode = 'llm')::int AS llm, count(DISTINCT c.user_id)::int AS users,
              (SELECT count(*)::int FROM hk_ai_reports r JOIN hk_ai_messages mm ON mm.id = r.message_id JOIN hk_ai_conversations cc ON cc.id = mm.conversation_id JOIN app_users uu ON uu.id = cc.user_id
                WHERE r.created_at >= now() - ($1::int * interval '1 day') ${scope.replace(/u\./g, 'uu.')}) AS reports ${base}`, params))[0];
    const answers = num((await this.db.query<{ n: string }>(`SELECT count(*) AS n ${base} AND m.role = 'assistant'`, params))[0].n);
    const series = await this.db.query<{ day: string; questions: number; tokens: number }>(
      `SELECT to_char(m.created_at AT TIME ZONE ${VN}, 'YYYY-MM-DD') AS day, count(*) FILTER (WHERE m.role = 'user')::int AS questions, COALESCE(sum(m.tokens_in + m.tokens_out), 0)::int AS tokens ${base} GROUP BY 1 ORDER BY 1`, params);
    const topics = await this.db.query<{ kind: string; id: number; title: string; asked: number }>(
      `SELECT cit->>'kind' AS kind, (cit->>'id')::int AS id, cit->>'title' AS title, count(DISTINCT m.id)::int AS asked ${base.replace('WHERE', ', jsonb_array_elements(m.citations) cit WHERE')} AND m.role = 'assistant' AND NOT m.refused GROUP BY 1, 2, 3 ORDER BY asked DESC, title LIMIT 10`, params);
    const price = (await this.db.query<{ price_in: number; price_out: number; daily_per_school: number }>('SELECT price_in::float8 AS price_in, price_out::float8 AS price_out, daily_per_school FROM hk_ai_settings WHERE id = 1 AND school_id IS NULL'))[0];
    const out: Record<string, unknown> = {
      days, questions: t.questions, answers, refused: t.refused, refusal_rate: pct(t.refused, answers), tokens_in: num(t.tokens_in), tokens_out: num(t.tokens_out), llm_answers: t.llm, users: t.users, reported: t.reports, series, topics,
      cost_usd: Math.round(((num(t.tokens_in) * price.price_in + num(t.tokens_out) * price.price_out) / 1_000_000) * 10000) / 10000, price,
    };
    if (school) {
      const over = (await this.db.query<{ daily_per_school: number | null }>('SELECT daily_per_school FROM hk_ai_school_limits WHERE school_id = $1', [school]))[0];
      const used = num((await this.db.query<{ n: string }>(`SELECT count(*) AS n FROM hk_ai_messages m JOIN hk_ai_conversations c ON c.id = m.conversation_id JOIN app_users u ON u.id = c.user_id
        WHERE u.school_id = $1 AND m.role = 'user' AND (m.created_at AT TIME ZONE ${VN})::date = (now() AT TIME ZONE ${VN})::date`, [school]))[0].n);
      const limit = over?.daily_per_school ?? price.daily_per_school;
      out.quota = { limit, used_today: used, remaining: Math.max(0, limit - used) };
    }
    return out;
  }

  // ---------------------------------------------------------------------- AD.009: thống kê nội dung
  async contentStats() {
    const status = async (label: string, table: string): Promise<{ key: string; label: string; total: number; draft: number; verified: number; published: number }> => {
      const r = await this.db.query<{ status: string; n: number }>(`SELECT status, count(*)::int AS n FROM ${table} GROUP BY status`);
      const c = (s: string) => r.find((x) => x.status === s)?.n ?? 0;
      return { key: table, label, total: r.reduce((n, x) => n + x.n, 0), draft: c('draft'), verified: c('verified'), published: c('published') };
    };
    const history = [['Cuộc kháng chiến', 'hist_campaigns'], ['Nhân vật', 'hist_figures'], ['Sự kiện', 'hist_events'], ['Địa danh', 'hist_places'], ['Trận đánh', 'hist_battles'], ['Tư liệu', 'hist_sources'], ['Thuật ngữ', 'hist_terms']] as const;
    const learning = [['Bài học', 'hk_lessons'], ['Hành trình', 'hk_journeys'], ['Kịch bản trận đánh', 'hk_scenarios'], ['Mini-game', 'hk_minigames'], ['Màn chơi thẻ tướng', 'hk_stages']] as const;
    const questions = await this.db.query<{ scope: string; n: number }>('SELECT scope, count(*)::int AS n FROM hk_questions GROUP BY scope');
    return {
      history: await Promise.all(history.map(([l, t]) => status(l, t))), learning: await Promise.all(learning.map(([l, t]) => status(l, t))),
      questions: { total: questions.reduce((n, r) => n + r.n, 0), by_scope: Object.fromEntries(questions.map((r) => [r.scope, r.n])) },
      quizzes: num((await this.db.query<{ n: string }>('SELECT count(*) AS n FROM hk_quizzes'))[0].n),
      ai_chunks: num((await this.db.query<{ n: string }>('SELECT count(*) AS n FROM hk_ai_chunks'))[0].n),
    };
  }

  // ---------------------------------------------------------------------- bảng cho báo cáo xuất file
  async exportRows(user: UserRow, classId: number, period: Period) {
    const info = await this.assertClass(user, classId);
    const s: RecoSettings = await this.reco.settings();
    const dash = await this.dashboard(user, classId, period);
    const topics = await this.classTopics(user, classId, period);
    const assignments = await this.db.query(
      `SELECT a.title, a.kind, a.due_at, (SELECT count(*)::int FROM hk_submissions s WHERE s.assignment_id = a.id AND s.submitted_at IS NOT NULL) AS submitted,
              (SELECT round(avg(s.best_percent))::int FROM hk_submissions s WHERE s.assignment_id = a.id AND s.submitted_at IS NOT NULL) AS avg_percent
       FROM hk_assignments a WHERE a.class_id = $1 AND a.status = 'active'${startOf(period.from) ? ' AND a.due_at >= $2' : ''}${endOf(period.to) ? ` AND a.due_at <= $${startOf(period.from) ? 3 : 2}` : ''} ORDER BY a.due_at`,
      [classId, ...(startOf(period.from) ? [startOf(period.from)] : []), ...(endOf(period.to) ? [endOf(period.to)] : [])]);
    return { info, dash, topics, assignments, weakThreshold: s.weak_threshold };
  }
}

export type { TopicRow };
