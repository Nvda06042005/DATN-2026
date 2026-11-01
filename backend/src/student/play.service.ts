/**
 * Học và làm bài của học sinh (HK.HS.017–023, 029–030, 037, 041–050, HK.SYS.007, HK.SYS.014):
 * trang chủ, bản đồ hành trình, chi tiết nút, đọc bài học, làm bài có đồng hồ chấm ở máy chủ, luyện câu đã sai, lịch sử làm bài,
 * nhiệm vụ, ghi chú, tư liệu yêu thích và sự kiện học tập. Giáo viên dùng cùng cơ chế làm bài để làm thử bộ đề (chế độ xem trước, không ghi tiến độ).
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { notFound } from '../content/access';
import { NODE_KIND_LABEL } from '../content/journey.service';
import { QuizService } from '../content/quiz.service';
import { bonusPoints, grade, GRACE_MS, publicView, QuestionCore, QType, seededShuffle, starsFor } from '../content/questions';
import { SPECS, Entity } from '../history/history.service';
import { logEvent } from './events';
import { LearnService } from './learn.service';
import { GameService } from '../game/game.service';
import { recordSubmission } from '../classroom/submission';
import { GATE_PLAN_SIZE, gateGuide as buildGateGuide, gatePool } from './gates';
import { activeJourneys, nodesWithState, ProgressNode } from './progress';

interface PlanItem { question_id: number; points: number; seconds: number; seed: number; shuffle: boolean; snap: Omit<QuestionCore, 'id'>; removed?: string[] }
interface AttemptRow {
  id: number; user_id: number; quiz_id: number | null; node_id: number | null; assignment_id: number | null; mode: 'node' | 'practice' | 'preview' | 'assignment'; status: 'active' | 'done'; plan: PlanItem[]; position: number;
  served_at: string | null; started_at: string; finished_at: string | null; pass_percent: number; base_points: number; bonus_points: number; max_points: number; percent: number;
  stars: number; correct_count: number; wrong_count: number; passed: boolean | null; duration_ms: number | null; result: Record<string, unknown> | null;
}

const ATTEMPT_COLUMNS =
  'id::int AS id, user_id, quiz_id, node_id, assignment_id, mode, status, plan, position, served_at, started_at, finished_at, pass_percent, base_points, bonus_points, max_points, percent, stars, correct_count, wrong_count, passed, duration_ms, result';
const PRACTICE_SIZE = 10;
const PRACTICE_SECONDS = 30;
const VIEW_EVENTS = ['view_lesson', 'view_figure', 'view_event', 'view_battle', 'view_place', 'view_map', 'view_timeline', 'view_library', 'view_source'];

@Injectable()
export class PlayService {
  constructor(private readonly db: DatabaseService, private readonly quizzes: QuizService, private readonly learn: LearnService, private readonly game: GameService) {}

  private readonly read: Q = (sql, params) => this.db.query(sql, params);

  // ------------------------------------------------------------------ trang chủ (HK.HS.017–018)
  async home(user: UserRow) {
    const q = this.read;
    const campaigns = await this.learn.campaigns();
    const active = await activeJourneys(q, user.id);
    const cards = [];
    let next: Record<string, unknown> | null = null;
    for (const c of campaigns as Array<Record<string, any>>) {
      const journey = active.find((a) => a.campaign_id === c.id);
      const nodes = journey ? await nodesWithState(q, user.id, journey.journey_id) : [];
      const done = nodes.filter((n) => n.state === 'done').length;
      const available = nodes.find((n) => n.state === 'available');
      if (!next && available) next = { type: 'node', node_id: available.id, title: available.title, kind: available.kind, kind_label: NODE_KIND_LABEL[available.kind], campaign_id: c.id, campaign_title: c.title };
      cards.push({
        ...c, journey: journey ? { id: journey.journey_id, title: journey.title, from_class: journey.from_class } : null,
        nodes: nodes.length, done, stars: nodes.reduce((n, x) => n + x.stars, 0), max_stars: nodes.length * 3, percent: nodes.length ? Math.round((done / nodes.length) * 100) : 0,
        completed: nodes.length > 0 && done === nodes.length,
      });
    }
    const points = Number((await q<{ n: string }>('SELECT COALESCE(sum(points), 0) AS n FROM hk_points WHERE user_id = $1', [user.id]))[0].n);
    const wrong = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_wrong_questions WHERE user_id = $1 AND cleared_at IS NULL', [user.id]))[0].n);
    const hud = await this.game.me(user);
    const suggestions = [...(next ? [next] : []), ...(wrong ? [{ type: 'practice', count: wrong }] : [])];
    return { learner: { full_name: user.full_name, nickname: user.nickname, avatar_url: user.avatar_url }, points, streak: hud.streak.current, hud, campaigns: cards, suggestions };
  }

  // ------------------------------------------------------------------ bản đồ hành trình (HK.HS.019–022)
  async campaignMap(user: UserRow, campaignId: number) {
    const q = this.read;
    const campaign = (await q<Record<string, any>>("SELECT id, title, year_label, summary, image_url FROM hist_campaigns WHERE id = $1 AND status = 'published'", [campaignId]))[0];
    if (!campaign) throw notFound('cuộc kháng chiến');
    const journey = (await activeJourneys(q, user.id)).find((a) => a.campaign_id === campaignId);
    if (!journey) return { campaign, journey: null, nodes: [], current_node_id: null, totals: { nodes: 0, done: 0, stars: 0, max_stars: 0, percent: 0 } };
    const info = (await q<Record<string, any>>('SELECT id, title, description, background_url, is_default FROM hk_journeys WHERE id = $1', [journey.journey_id]))[0];
    const nodes = await nodesWithState(q, user.id, journey.journey_id);
    const extra = await this.nodeContent(q, nodes);
    const done = nodes.filter((n) => n.state === 'done').length;
    return {
      campaign, journey: { ...info, from_class: journey.from_class },
      nodes: nodes.map((n) => ({ ...this.nodeBrief(n), content: extra.get(n.id) ?? null })),
      current_node_id: nodes.find((n) => n.state === 'available')?.id ?? null,
      totals: { nodes: nodes.length, done, stars: nodes.reduce((s, x) => s + x.stars, 0), max_stars: nodes.length * 3, percent: nodes.length ? Math.round((done / nodes.length) * 100) : 0 },
    };
  }

  private nodeBrief(n: ProgressNode) {
    return {
      id: n.id, position: n.position, kind: n.kind, kind_label: NODE_KIND_LABEL[n.kind], title: n.title, icon: n.icon, objective: n.objective, state: n.state, stars: n.stars,
      best_percent: n.best_percent, attempts: n.attempts, reward_points: n.reward_points, completed_at: n.completed_at,
      pos_x: n.pos_x, pos_y: n.pos_y, preds: n.preds, lock_reason: n.lock_reason, min_percent: n.min_percent, min_stars: n.min_stars, opens_at: n.opens_at, reward_gold: n.reward_gold,
      has_reward_card: Boolean(n.reward_card_id), has_reward_badge: Boolean(n.reward_badge_id), gate_id: n.gate_id,
    };
  }

  /** Nút có làm bộ câu hỏi (kể cả tự ghép từ câu hỏi của Cửa) thì hoàn thành bằng lượt làm bài */
  private needsQuiz(n: ProgressNode): boolean {
    return n.kind === 'quiz' || n.kind === 'final' || n.kind === 'practice' || n.kind === 'gate_test' || ((n.kind === 'battle' || n.kind === 'listen') && Boolean(n.quiz_id));
  }

  /** Lượt làm bài tự ghép từ câu hỏi của Cửa (Luyện tập, Kiểm tra cuối cửa không có bộ đề riêng): chọn ngẫu nhiên tối đa GATE_PLAN_SIZE câu đã gặp trong Cửa */
  private async planFromGate(q: Q, node: ProgressNode): Promise<{ plan: PlanItem[]; pass: number }> {
    if (!node.gate_id) throw new ConflictException('Nút này chưa thuộc Cửa nào nên chưa có câu hỏi để ôn');
    const pool = await gatePool(q, node.gate_id);
    if (!pool.length) throw new ConflictException('Cửa này chưa có câu hỏi nào để ôn');
    const seed = Math.floor(Math.random() * 2 ** 31);
    const plan = seededShuffle(pool, seed).slice(0, GATE_PLAN_SIZE).map((r, idx): PlanItem => ({ question_id: r.id, points: 100, seconds: PRACTICE_SECONDS, seed: seed + idx * 101 + 1, shuffle: true, snap: this.snap(r) }));
    return { plan, pass: node.kind === 'gate_test' ? 70 : 1 };
  }

  /** Thông tin ngắn về nội dung của từng nút (thời lượng bài học, số câu hỏi...) */
  private async nodeContent(q: Q, nodes: ProgressNode[]): Promise<Map<number, Record<string, unknown>>> {
    const out = new Map<number, Record<string, unknown>>();
    for (const n of nodes) {
      const c: Record<string, unknown> = {};
      if (n.lesson_id) c.lesson = (await q('SELECT id, title, read_minutes FROM hk_lessons WHERE id = $1', [n.lesson_id]))[0] ?? null;
      if (n.quiz_id) {
        c.quiz = (await q(
          `SELECT z.id, z.title, z.pass_percent, (SELECT count(*)::int FROM hk_quiz_questions qq WHERE qq.quiz_id = z.id) AS questions,
                  (SELECT COALESCE(sum(COALESCE(qq.seconds, z.seconds_per_question)), 0)::int FROM hk_quiz_questions qq WHERE qq.quiz_id = z.id) AS total_seconds FROM hk_quizzes z WHERE z.id = $1`, [n.quiz_id]))[0] ?? null;
      }
      if (n.battle_id) c.battle = (await q("SELECT id, name, year, date_text FROM hist_battles WHERE id = $1 AND status = 'published'", [n.battle_id]))[0] ?? null;
      if (n.source_id) c.source = (await q("SELECT id, title, kind FROM hist_sources WHERE id = $1 AND status = 'published'", [n.source_id]))[0] ?? null;
      out.set(n.id, c);
    }
    return out;
  }

  /** Nút trong hành trình đang học của học sinh; ném 404 nếu nút không thuộc hành trình nào học sinh được học */
  async accessNode(q: Q, user: UserRow, nodeId: number): Promise<{ node: ProgressNode; nodes: ProgressNode[] }> {
    const row = (await q<{ journey_id: number }>('SELECT journey_id FROM hk_nodes WHERE id = $1', [nodeId]))[0];
    if (!row) throw notFound('nút');
    if (!(await activeJourneys(q, user.id)).some((a) => a.journey_id === row.journey_id)) throw notFound('nút');
    const nodes = await nodesWithState(q, user.id, row.journey_id);
    return { node: nodes.find((n) => n.id === nodeId)!, nodes };
  }

  async nodeDetail(user: UserRow, nodeId: number) {
    const q = this.read;
    const { node } = await this.accessNode(q, user, nodeId);
    const locked = node.state === 'locked';
    const content = (await this.nodeContent(q, [node])).get(node.id) ?? {};
    const unlocks = await q<{ id: number; title: string; unlocked: boolean }>(
      `SELECT s.id, s.title, EXISTS (SELECT 1 FROM hk_unlocked_sources u WHERE u.user_id = $2 AND u.source_id = s.id) AS unlocked
       FROM hist_sources s WHERE s.status = 'published' AND (s.id IN (SELECT source_id FROM hk_node_unlocks WHERE node_id = $1) OR s.id = $3) ORDER BY s.title`, [nodeId, user.id, node.source_id]);
    const quiz = content.quiz as { pass_percent: number; questions: number } | undefined;
    const sim = node.battle_id ? await this.simulationOf(q, node.battle_id) : null;
    // Số câu hỏi để học sinh biết trước khi vào học (HK.HS.118): câu kiểm tra nhanh của bài, câu của bộ đề, hoặc số câu tự ghép từ Cửa
    let questionCount: number | null = null;
    if (node.kind === 'lesson' && node.lesson_id) questionCount = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_lesson_checks WHERE lesson_id = $1', [node.lesson_id]))[0].n);
    else if (quiz) questionCount = quiz.questions;
    else if ((node.kind === 'practice' || node.kind === 'gate_test') && node.gate_id) questionCount = Math.min(GATE_PLAN_SIZE, (await gatePool(q, node.gate_id)).length);
    const binhThu = await this.game.binhThuFor(node.kind, node.reward_binh_thu);
    // Màn chơi bằng thẻ tướng của trận đánh này (HK.HS.124): nút "Ra trận" chỉ hiện khi màn đã được phát hành
    const stage = node.battle_id && !locked ? (await q<{ id: number }>("SELECT id FROM hk_stages WHERE battle_id = $1 AND status = 'published'", [node.battle_id]))[0] : undefined;
    return {
      ...this.nodeBrief(node), content: locked ? null : content, unlocks, can_start: !locked, has_sim: Boolean(sim), scenario_id: sim?.id ?? null, stage_id: stage?.id ?? null,
      pass_percent: node.pass_percent ?? quiz?.pass_percent ?? null, hint: locked ? node.lock_reason : null,
      has_quiz: Boolean(node.quiz_id), needs_quiz: this.needsQuiz(node), question_count: questionCount, reward_binh_thu: binhThu,
      gate: node.gate_id ? (await q<{ id: number; title: string }>('SELECT id, title FROM hk_gates WHERE id = $1', [node.gate_id]))[0] ?? null : null,
    };
  }

  // ------------------------------------------------------------------ hoàn thành nút (HK.SYS.007)
  async finishNode(q: Q, user: UserRow, node: ProgressNode, r: { percent: number; stars: number; points: number; passed: boolean; ref: string }) {
    const prev = (await q<{ best_points: number; completed_at: string | null }>('SELECT best_points, completed_at FROM hk_node_progress WHERE user_id = $1 AND node_id = $2 FOR UPDATE', [user.id, node.id]))[0];
    const first = r.passed && !prev?.completed_at;
    await q(
      `INSERT INTO hk_node_progress (user_id, node_id, best_percent, stars, best_points, attempts, completed_at) VALUES ($1, $2, $3, $4, $5, 1, CASE WHEN $6 THEN now() END)
       ON CONFLICT (user_id, node_id) DO UPDATE SET attempts = hk_node_progress.attempts + 1, best_percent = GREATEST(hk_node_progress.best_percent, $3),
         stars = GREATEST(hk_node_progress.stars, $4), best_points = CASE WHEN $6 THEN GREATEST(hk_node_progress.best_points, $5) ELSE hk_node_progress.best_points END,
         completed_at = COALESCE(hk_node_progress.completed_at, CASE WHEN $6 THEN now() END), updated_at = now()`,
      [user.id, node.id, r.percent, r.passed ? r.stars : 0, r.passed ? r.points : 0, r.passed]);
    // Điểm: thưởng của nút khi hoàn thành lần đầu + phần điểm làm bài vượt kỷ lục cũ (chơi lại không "cày" được điểm)
    const delta = r.passed ? Math.max(0, r.points - (prev?.best_points ?? 0)) : 0;
    const awarded = (first ? node.reward_points : 0) + delta;
    if (awarded > 0) await this.game.awardXp(q, user, awarded, 'node', `node:${node.id}:${r.ref}`);
    let unlocked: Array<{ id: number; title: string }> = [];
    const rewards: { gold: number; card: boolean; badge: string | null; binh_thu: number; fragments?: Array<{ card: string; qty: number; merged: boolean }> } = { gold: 0, card: false, badge: null, binh_thu: 0 };
    // Chỉ nút rương có trường mảnh thẻ (Sprint 6 ver0.2): gom đủ mảnh thì thẻ tự ghép
    if (node.kind === 'chest') rewards.fragments = [];
    if (first) {
      if (node.kind === 'chest') { const frag = await this.game.chestFragment(q, user); if (frag) rewards.fragments!.push(frag); }
      // Phần thưởng riêng của nút do giáo viên đặt (HK.GV.024): vàng, thẻ nhân vật, huy hiệu; chỉ lần hoàn thành đầu tiên
      if (node.reward_gold && (await this.game.addGold(q, user, node.reward_gold, 'node', `nodegold:${node.id}`))) rewards.gold = node.reward_gold;
      // Binh thư (ver0.2): mức riêng của nút nếu có, không thì mức mặc định theo loại nút trong cấu hình trò chơi hóa
      const binhThu = await this.game.binhThuFor(node.kind, node.reward_binh_thu);
      if (binhThu > 0 && (await this.game.addBinhThu(q, user, binhThu, node.kind === 'chest' ? 'chest' : 'node', `node:${node.id}`))) rewards.binh_thu = binhThu;
      if (node.reward_card_id && (await this.game.grantCard(q, user, node.reward_card_id, node.id))) rewards.card = true;
      if (node.reward_badge_id) {
        const badge = (await q<{ id: number; name: string; icon: string; color: string }>('SELECT id, name, icon, color FROM hk_badges WHERE id = $1 AND is_active', [node.reward_badge_id]))[0];
        if (badge && (await this.game.awardBadge(q, user, badge, null))) rewards.badge = badge.name;
      }
      const wanted = new Set((await q<{ source_id: number }>('SELECT source_id FROM hk_node_unlocks WHERE node_id = $1', [node.id])).map((r) => r.source_id));
      if (node.source_id) wanted.add(node.source_id);
      const opened: number[] = [];
      for (const sid of wanted) {
        const done = await q('INSERT INTO hk_unlocked_sources (user_id, source_id, node_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING source_id', [user.id, sid, node.id]);
        if (done.length) opened.push(sid);
      }
      if (opened.length) unlocked = await q<{ id: number; title: string }>("SELECT id, title FROM hist_sources WHERE id = ANY($1) AND status = 'published' ORDER BY title", [opened]);
      await logEvent(null, user, 'node_complete', 'node', node.id, node.id, { stars: r.stars, percent: r.percent }, null, q);
    }
    if (r.passed) await this.game.onNodeCompleted(q, user, node, first);
    const nodes = await nodesWithState(q, user.id, node.journey_id);
    const nextNode = nodes.find((n) => n.state === 'available');
    return {
      first_completion: first, passed: r.passed, stars: r.passed ? r.stars : 0, percent: r.percent, points_awarded: awarded, unlocked_sources: unlocked, rewards,
      next_node: nextNode ? { id: nextNode.id, title: nextNode.title } : null, journey_completed: nodes.every((n) => n.state === 'done'), campaign_final: node.kind === 'final' && r.passed,
    };
  }

  /** Kịch bản mô phỏng đã phát hành của một trận đánh (Sprint 6): nút trận đánh có kịch bản thì hoàn thành bằng cách chơi mô phỏng */
  private async simulationOf(q: Q, battleId: number): Promise<{ id: number } | null> {
    return (await q<{ id: number }>("SELECT id FROM hk_scenarios WHERE battle_id = $1 AND status = 'published'", [battleId]))[0] ?? null;
  }

  /** Nút tư liệu / trận đánh không kèm bộ câu hỏi hoàn thành khi học sinh đã đọc */
  async completeNode(user: UserRow, nodeId: number) {
    return this.db.tx(async (q) => {
      const { node } = await this.accessNode(q, user, nodeId);
      if (node.state === 'locked') throw new ConflictException('Hãy hoàn thành nút trước đó');
      if (node.kind === 'lesson') throw new ConflictException('Bài học hoàn thành khi trả lời đúng câu kiểm tra nhanh');
      if (this.needsQuiz(node)) throw new ConflictException('Hãy làm bộ câu hỏi của nút này');
      if (node.kind === 'battle' && node.battle_id && (await this.simulationOf(q, node.battle_id))) throw new ConflictException('Hãy chơi mô phỏng trận đánh để hoàn thành nút này');
      return this.finishNode(q, user, node, { percent: 100, stars: 3, points: 0, passed: true, ref: 'read' });
    });
  }

  // ------------------------------------------------------------------ bài học (HK.HS.029–030, 037)
  async lesson(user: UserRow, nodeId: number) {
    const lesson = await this.db.tx(async (q) => {
      const { node } = await this.accessNode(q, user, nodeId);
      if (node.state === 'locked' || node.kind !== 'lesson' || !node.lesson_id) throw new ConflictException('Nút này chưa mở hoặc không phải bài học');
      const row = (await q<Record<string, any>>("SELECT id, title, summary, blocks, read_minutes FROM hk_lessons WHERE id = $1 AND status = 'published'", [node.lesson_id]))[0];
      if (!row) throw notFound('bài học');
      await q('INSERT INTO hk_lesson_progress (user_id, lesson_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, row.id]);
      const progress = (await q('SELECT read_percent, check_attempts, completed_at FROM hk_lesson_progress WHERE user_id = $1 AND lesson_id = $2', [user.id, row.id]))[0];
      const checks = await q<{ question_id: number; qtype: QType; prompt: string; image_url: string | null; difficulty: number; data: Record<string, unknown> }>(
        `SELECT k.question_id, t.qtype, t.prompt, t.image_url, t.difficulty, t.data FROM hk_lesson_checks k JOIN hk_questions t ON t.id = k.question_id WHERE k.lesson_id = $1 ORDER BY k.position`, [row.id]);
      const links: Array<Record<string, unknown>> = [];
      for (const l of await q<{ ref_type: Entity; ref_id: number }>('SELECT ref_type, ref_id FROM hk_lesson_links WHERE lesson_id = $1', [row.id])) {
        const spec = SPECS[l.ref_type];
        const found = (await q<{ label: string }>(`SELECT ${spec.main} AS label FROM ${spec.table} WHERE id = $1 AND status = 'published'`, [l.ref_id]))[0];
        if (found) links.push({ ref_type: l.ref_type, ref_id: l.ref_id, label: found.label });
      }
      const note = (await q<{ body: string }>("SELECT body FROM hk_notes WHERE user_id = $1 AND ref_type = 'lesson' AND ref_id = $2", [user.id, row.id]))[0]?.body ?? null;
      return {
        ...row, id: row.id as number, node: this.nodeBrief(node), progress, note, links,
        checks: checks.map((c) => publicView({ id: c.question_id, qtype: c.qtype, prompt: c.prompt, image_url: c.image_url, explanation: null, difficulty: c.difficulty, data: c.data }, c.question_id, false)),
      };
    });
    await logEvent(this.db, user, 'view_lesson', 'lesson', lesson.id, nodeId);
    return lesson;
  }

  async lessonProgress(user: UserRow, nodeId: number, readPercent: number) {
    return this.db.tx(async (q) => {
      const { node } = await this.accessNode(q, user, nodeId);
      if (node.state === 'locked' || node.kind !== 'lesson' || !node.lesson_id) throw new ConflictException('Nút này chưa mở hoặc không phải bài học');
      const pct = Math.max(0, Math.min(100, Math.round(readPercent)));
      const row = (await q<{ read_percent: number }>(
        `INSERT INTO hk_lesson_progress (user_id, lesson_id, read_percent) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, lesson_id) DO UPDATE SET read_percent = GREATEST(hk_lesson_progress.read_percent, $3), updated_at = now() RETURNING read_percent`, [user.id, node.lesson_id, pct]))[0];
      return { read_percent: row.read_percent };
    });
  }

  /** Hoàn thành bài học: đã đọc hết và trả lời đúng mọi câu kiểm tra nhanh (HK.HS.030) */
  async completeLesson(user: UserRow, nodeId: number, answers: Array<{ question_id: number; answer: unknown }>) {
    return this.db.tx(async (q) => {
      const { node } = await this.accessNode(q, user, nodeId);
      if (node.state === 'locked' || node.kind !== 'lesson' || !node.lesson_id) throw new ConflictException('Nút này chưa mở hoặc không phải bài học');
      const progress = (await q<{ read_percent: number; check_attempts: number; first_try_correct: boolean | null }>(
        'SELECT read_percent, check_attempts, first_try_correct FROM hk_lesson_progress WHERE user_id = $1 AND lesson_id = $2 FOR UPDATE', [user.id, node.lesson_id]))[0];
      if (!progress || progress.read_percent < 100) throw new ConflictException('Hãy đọc hết bài học trước khi làm câu kiểm tra nhanh');
      const checks = await q<{ question_id: number; qtype: QType; explanation: string | null; data: Record<string, unknown> }>(
        'SELECT k.question_id, t.qtype, t.explanation, t.data FROM hk_lesson_checks k JOIN hk_questions t ON t.id = k.question_id WHERE k.lesson_id = $1 ORDER BY k.position', [node.lesson_id]);
      const results = checks.map((c) => {
        const given = answers.find((a) => a.question_id === c.question_id);
        const g = given ? grade(c, given.answer) : { correct: false };
        return { question_id: c.question_id, correct: g.correct, explanation: c.explanation, detail: g.detail };
      });
      const allRight = results.every((r) => r.correct);
      await q('UPDATE hk_lesson_progress SET check_attempts = check_attempts + 1, first_try_correct = COALESCE(first_try_correct, $3), updated_at = now() WHERE user_id = $1 AND lesson_id = $2', [user.id, node.lesson_id, allRight]);
      if (!allRight) return { completed: false, results, node: null };
      await q('UPDATE hk_lesson_progress SET completed_at = COALESCE(completed_at, now()) WHERE user_id = $1 AND lesson_id = $2', [user.id, node.lesson_id]);
      const firstTry = progress.first_try_correct ?? allRight;
      await logEvent(null, user, 'lesson_complete', 'lesson', node.lesson_id, node.id, null, null, q);
      await this.game.onLessonCompleted(q, user);
      const finished = await this.finishNode(q, user, node, { percent: 100, stars: firstTry ? 3 : 2, points: 0, passed: true, ref: 'lesson' });
      return { completed: true, results, node: finished };
    });
  }

  private async nodeKind(q: Q, nodeId: number | null): Promise<string | null> {
    return nodeId ? (await q<{ kind: string }>('SELECT kind FROM hk_nodes WHERE id = $1', [nodeId]))[0]?.kind ?? null : null;
  }

  // ------------------------------------------------------------------ lộ trình dạng đường đi (HK.HS.117–118, 125)
  /**
   * Toàn bộ lộ trình của học sinh theo Phần (mỗi cuộc kháng chiến) và Cửa (nhóm nút liên tiếp cùng Cửa): trạng thái từng nút, vòng tiến độ, nút hiện tại.
   * Hành trình chưa chia Cửa hiện thành một nhóm duy nhất; nút không thuộc Cửa nào hiện thành nhóm riêng.
   */
  async path(user: UserRow) {
    const q = this.read;
    const campaigns = (await this.learn.campaigns()) as Array<Record<string, any>>;
    const active = await activeJourneys(q, user.id);
    const parts = [];
    let current: { part_no: number; gate_no: number; gate_title: string; node_id: number } | null = null;
    for (const [i, c] of campaigns.entries()) {
      const journey = active.find((a) => a.campaign_id === c.id);
      const head = { no: i + 1, campaign: { id: c.id, title: c.title, year_label: c.year_label } };
      if (!journey) { parts.push({ ...head, journey: null, gates: [], totals: { nodes: 0, done: 0 } }); continue; }
      const nodes = await nodesWithState(q, user.id, journey.journey_id);
      const lessonIds = nodes.filter((n) => n.lesson_id).map((n) => n.lesson_id as number);
      const lessons = lessonIds.length ? await q<{ id: number; blocks: number; checks: number; read_percent: number; completed: boolean }>(
        `SELECT l.id, jsonb_array_length(l.blocks) AS blocks, (SELECT count(*)::int FROM hk_lesson_checks k WHERE k.lesson_id = l.id) AS checks,
                COALESCE(p.read_percent, 0) AS read_percent, (p.completed_at IS NOT NULL) AS completed
         FROM hk_lessons l LEFT JOIN hk_lesson_progress p ON p.lesson_id = l.id AND p.user_id = $2 WHERE l.id = ANY($1)`, [lessonIds, user.id]) : [];
      const gateRows = await q<{ id: number; title: string; summary: string | null }>('SELECT id, title, summary FROM hk_gates WHERE journey_id = $1', [journey.journey_id]);
      const gates: Array<{ id: number | null; no: number; title: string; summary: string | null; nodes: Array<Record<string, unknown>>; done: number; state: string }> = [];
      for (const n of nodes) {
        const last = gates[gates.length - 1];
        if (!last || last.id !== n.gate_id) {
          const g = gateRows.find((x) => x.id === n.gate_id);
          gates.push({ id: n.gate_id, no: gates.length + 1, title: g?.title ?? (n.gate_id === null && !gateRows.length ? journey.title : 'Chặng khác'), summary: g?.summary ?? null, nodes: [], done: 0, state: 'locked' });
        }
        const gate = gates[gates.length - 1];
        const l = lessons.find((x) => x.id === n.lesson_id);
        // Vòng tiến độ: bài học tính theo số bước (thẻ kiến thức + câu hỏi) đã qua; nút khác là 0 hoặc 1
        const total = l ? Math.max(1, l.blocks + l.checks) : 1;
        const stepsDone = n.state === 'done' ? total : l ? Math.min(total - 1, Math.round((l.read_percent / 100) * l.blocks)) : 0;
        gate.nodes.push({
          id: n.id, position: n.position, kind: n.kind, kind_label: NODE_KIND_LABEL[n.kind], title: n.title, icon: n.icon, state: n.state, stars: n.stars, best_percent: n.best_percent,
          reward_points: n.reward_points, lock_reason: n.lock_reason, steps: { done: stepsDone, total },
        });
        if (n.state === 'done') gate.done += 1;
        if (!current && n.state === 'available') current = { part_no: i + 1, gate_no: gate.no, gate_title: gate.title, node_id: n.id };
      }
      for (const g of gates) g.state = g.done === g.nodes.length ? 'done' : g.nodes.some((x) => x.state === 'available') ? 'current' : 'locked';
      parts.push({ ...head, journey: { id: journey.journey_id, title: journey.title, from_class: journey.from_class }, gates, totals: { nodes: nodes.length, done: nodes.filter((n) => n.state === 'done').length } });
    }
    return { parts, current };
  }

  /** Dấu chấm đỏ của thanh menu (HK.HS.125): số việc mới ở các mục mà dữ liệu nằm ngoài bản đồ học */
  async menuDots(user: UserRow) {
    const q = this.read;
    const practice = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_wrong_questions WHERE user_id = $1 AND cleared_at IS NULL', [user.id]))[0].n);
    const live = Number((await q<{ n: string }>(
      "SELECT count(*) AS n FROM hk_live_rooms r JOIN app_class_members m ON m.class_id = r.class_id AND m.user_id = $1 WHERE r.state <> 'ended'", [user.id]))[0].n);
    return { practice, live };
  }

  /** Cẩm nang của Cửa (HK.HS.123): tóm tắt tự tạo từ kho lịch sử; chỉ xem được Cửa của hành trình mình đang học */
  async gateGuide(user: UserRow, gateId: number) {
    const q = this.read;
    const gate = (await q<{ journey_id: number }>('SELECT journey_id FROM hk_gates WHERE id = $1', [gateId]))[0];
    if (!gate || !(await activeJourneys(q, user.id)).some((a) => a.journey_id === gate.journey_id)) throw notFound('Cửa');
    const guide = await buildGateGuide(q, gateId);
    if (!guide) throw notFound('Cửa');
    await logEvent(this.db, user, 'view_guide', 'gate', gateId);
    return guide;
  }

  /** Nghe kể chuyện (HK.HS.121): lời kể tách theo dòng làm phụ đề; âm thanh thu sẵn nếu có, không thì máy đọc tiếng Việt trên thiết bị */
  async listen(user: UserRow, nodeId: number) {
    const out = await this.db.tx(async (q) => {
      const { node } = await this.accessNode(q, user, nodeId);
      if (node.state === 'locked' || node.kind !== 'listen') throw new ConflictException('Nút này chưa mở hoặc không phải nút nghe kể chuyện');
      const lines = (node.transcript ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      return { node: this.nodeBrief(node), title: node.title, audio_url: node.audio_url, lines, has_quiz: Boolean(node.quiz_id) };
    });
    await logEvent(this.db, user, 'view_listen', 'node', nodeId, nodeId);
    return out;
  }

  /**
   * Chấm từng câu kiểm tra nhanh khi học bài theo từng bước (HK.HS.119): trả đúng/sai kèm giải thích ngay. Sai thì mất một tim (không bao giờ chặn việc học khi hết tim)
   * và câu được ghi vào danh sách câu cần luyện lại. Việc hoàn thành bài vẫn do `completeLesson` quyết định.
   */
  async lessonCheck(user: UserRow, nodeId: number, questionId: number, answer: unknown) {
    return this.db.tx(async (q) => {
      const { node } = await this.accessNode(q, user, nodeId);
      if (node.state === 'locked' || node.kind !== 'lesson' || !node.lesson_id) throw new ConflictException('Nút này chưa mở hoặc không phải bài học');
      const c = (await q<{ question_id: number; qtype: QType; explanation: string | null; data: Record<string, unknown> }>(
        'SELECT k.question_id, t.qtype, t.explanation, t.data FROM hk_lesson_checks k JOIN hk_questions t ON t.id = k.question_id WHERE k.lesson_id = $1 AND k.question_id = $2', [node.lesson_id, questionId]))[0];
      if (!c) throw notFound('câu hỏi');
      const g = grade(c, answer);
      if (!g.correct) {
        await this.game.loseHeart(q, user);
        await q(
          `INSERT INTO hk_wrong_questions (user_id, question_id) VALUES ($1, $2)
           ON CONFLICT (user_id, question_id) DO UPDATE SET wrong_count = hk_wrong_questions.wrong_count + 1, last_wrong_at = now(), cleared_at = NULL`, [user.id, questionId]);
      }
      await logEvent(null, user, 'lesson_check', 'question', questionId, nodeId, { correct: g.correct }, null, q);
      return { correct: g.correct, explanation: c.explanation, detail: g.detail };
    });
  }

  // ------------------------------------------------------------------ làm bài (HK.HS.043–046)
  private snap(row: { qtype: QType; prompt: string; image_url: string | null; explanation: string | null; difficulty: number; data: Record<string, unknown> }): PlanItem['snap'] {
    return { qtype: row.qtype, prompt: row.prompt, image_url: row.image_url, explanation: row.explanation, difficulty: row.difficulty, data: row.data };
  }

  private async insertAttempt(q: Q, userId: number, mode: AttemptRow['mode'], quizId: number | null, nodeId: number | null, plan: PlanItem[], pass: number, assignmentId: number | null = null): Promise<number> {
    const max = plan.reduce((n, p) => n + p.points, 0);
    return (await q<{ id: number }>(
      `INSERT INTO hk_attempts (user_id, quiz_id, node_id, mode, plan, pass_percent, max_points, served_at, assignment_id) VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8) RETURNING id::int AS id`,
      [userId, quizId, nodeId, mode, JSON.stringify(plan), pass, max, assignmentId]))[0].id;
  }

  private async planFromQuiz(q: Q, quizId: number): Promise<{ plan: PlanItem[]; pass: number }> {
    const { quiz, items } = await this.quizzes.forPlay(q, quizId);
    if (!items.length) throw new ConflictException('Bộ câu hỏi chưa có câu nào');
    const seed = Math.floor(Math.random() * 2 ** 31);
    const ordered = quiz.shuffle_questions ? seededShuffle(items, seed) : items;
    const plan = ordered.map((i, idx): PlanItem => ({
      question_id: i.question_id, points: i.points, seconds: i.seconds ?? quiz.seconds_per_question, seed: seed + idx * 101 + 1, shuffle: quiz.shuffle_options, snap: this.snap(i),
    }));
    return { plan, pass: quiz.pass_percent };
  }

  async startNodeQuiz(user: UserRow, nodeId: number) {
    return this.db.tx(async (q) => {
      const { node } = await this.accessNode(q, user, nodeId);
      if (node.state === 'locked') throw new ConflictException('Hãy hoàn thành nút trước đó');
      // Luyện tập và Kiểm tra cuối cửa không có bộ đề riêng thì tự ghép câu hỏi từ Cửa
      const auto = (node.kind === 'practice' || node.kind === 'gate_test') && !node.quiz_id;
      if ((!node.quiz_id && !auto) || node.kind === 'lesson' || node.kind === 'source' || node.kind === 'chest') throw new ConflictException('Nút này không có bộ câu hỏi');
      const open = (await q<{ id: number }>("SELECT id::int AS id FROM hk_attempts WHERE user_id = $1 AND node_id = $2 AND status = 'active' AND mode = 'node'", [user.id, nodeId]))[0];
      if (open) return this.stateOf(q, user, open.id);
      // Luyện tập không bị chặn khi hết tim (và làm sai không mất tim) để em vẫn ôn bài được
      if (node.kind !== 'practice') await this.game.assertCanPlay(q, user);
      const { plan, pass } = auto ? await this.planFromGate(q, node) : await this.planFromQuiz(q, node.quiz_id!);
      const id = await this.insertAttempt(q, user.id, 'node', node.quiz_id, node.id, plan, node.pass_percent ?? pass);
      await logEvent(null, user, 'attempt_start', 'node', node.id, node.id, null, null, q);
      return this.stateOf(q, user, id);
    });
  }

  /** Làm bộ đề của bài tập (HK.HS.101): còn lượt mới bắt đầu được; lượt đang làm dở thì tiếp tục. Không mất tim, không cộng điểm nút; kết quả ghi vào bài nộp. */
  async startAssignmentQuiz(user: UserRow, a: { id: number; quiz_id: number | null }) {
    return this.db.tx(async (q) => {
      if (!a.quiz_id) throw new ConflictException('Bài tập này không có bộ đề');
      const open = (await q<{ id: number }>("SELECT id::int AS id FROM hk_attempts WHERE user_id = $1 AND assignment_id = $2 AND status = 'active'", [user.id, a.id]))[0];
      if (open) return this.stateOf(q, user, open.id);
      const max = (await q<{ max_attempts: number }>('SELECT max_attempts FROM hk_assignments WHERE id = $1', [a.id]))[0]?.max_attempts ?? 1;
      const used = (await q<{ attempts: number }>('SELECT attempts FROM hk_submissions WHERE assignment_id = $1 AND user_id = $2', [a.id, user.id]))[0]?.attempts ?? 0;
      if (used >= max) throw new ConflictException(`Em đã dùng hết ${max} lượt làm bài này`);
      const { plan, pass } = await this.planFromQuiz(q, a.quiz_id);
      return this.stateOf(q, user, await this.insertAttempt(q, user.id, 'assignment', a.quiz_id, null, plan, pass, a.id));
    });
  }

  /** Bài học của bài tập (HK.HS.101): nội dung và câu kiểm tra nhanh, không gắn với nút trên bản đồ */
  async assignmentLesson(user: UserRow, lessonId: number) {
    return this.db.tx(async (q) => {
      const row = (await q<Record<string, any>>("SELECT id, title, summary, blocks, read_minutes FROM hk_lessons WHERE id = $1 AND status = 'published'", [lessonId]))[0];
      if (!row) throw notFound('bài học');
      await q('INSERT INTO hk_lesson_progress (user_id, lesson_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, row.id]);
      const progress = (await q('SELECT read_percent, check_attempts, completed_at FROM hk_lesson_progress WHERE user_id = $1 AND lesson_id = $2', [user.id, row.id]))[0];
      const checks = await q<{ question_id: number; qtype: QType; prompt: string; image_url: string | null; difficulty: number; data: Record<string, unknown> }>(
        'SELECT k.question_id, t.qtype, t.prompt, t.image_url, t.difficulty, t.data FROM hk_lesson_checks k JOIN hk_questions t ON t.id = k.question_id WHERE k.lesson_id = $1 ORDER BY k.position', [row.id]);
      return {
        ...row, id: row.id as number, progress, node: null, note: null, links: [],
        checks: checks.map((c) => publicView({ id: c.question_id, qtype: c.qtype, prompt: c.prompt, image_url: c.image_url, explanation: null, difficulty: c.difficulty, data: c.data }, c.question_id, false)),
      };
    });
  }

  async assignmentLessonProgress(user: UserRow, lessonId: number, readPercent: number) {
    const pct = Math.max(0, Math.min(100, Math.round(readPercent)));
    const row = (await this.db.query<{ read_percent: number }>(
      `INSERT INTO hk_lesson_progress (user_id, lesson_id, read_percent) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET read_percent = GREATEST(hk_lesson_progress.read_percent, $3), updated_at = now() RETURNING read_percent`, [user.id, lessonId, pct]))[0];
    return { read_percent: row.read_percent };
  }

  /** Chấm câu kiểm tra nhanh của bài học (không gắn nút): hoàn thành khi đã đọc hết và đúng mọi câu */
  async gradeLessonChecks(q: Q, user: UserRow, lessonId: number, answers: Array<{ question_id: number; answer: unknown }>) {
    const progress = (await q<{ read_percent: number; first_try_correct: boolean | null }>('SELECT read_percent, first_try_correct FROM hk_lesson_progress WHERE user_id = $1 AND lesson_id = $2 FOR UPDATE', [user.id, lessonId]))[0];
    if (!progress || progress.read_percent < 100) throw new ConflictException('Hãy đọc hết bài học trước khi làm câu kiểm tra nhanh');
    const checks = await q<{ question_id: number; qtype: QType; explanation: string | null; data: Record<string, unknown> }>(
      'SELECT k.question_id, t.qtype, t.explanation, t.data FROM hk_lesson_checks k JOIN hk_questions t ON t.id = k.question_id WHERE k.lesson_id = $1 ORDER BY k.position', [lessonId]);
    const results = checks.map((c) => {
      const given = answers.find((a) => a.question_id === c.question_id);
      const g = given ? grade(c, given.answer) : { correct: false };
      return { question_id: c.question_id, correct: g.correct, explanation: c.explanation, detail: g.detail };
    });
    const completed = results.every((r) => r.correct);
    await q('UPDATE hk_lesson_progress SET check_attempts = check_attempts + 1, first_try_correct = COALESCE(first_try_correct, $3), completed_at = CASE WHEN $3 THEN COALESCE(completed_at, now()) ELSE completed_at END, updated_at = now() WHERE user_id = $1 AND lesson_id = $2', [user.id, lessonId, completed]);
    if (completed) await this.game.onLessonCompleted(q, user);
    return { completed, results };
  }

  /** Giáo viên / quản trị làm thử bộ đề như học sinh (HK.GV.044); không ghi tiến độ, điểm hay câu sai */
  async startPreview(user: UserRow, quizId: number) {
    if (user.role === 'student') throw new ForbiddenException('Chỉ giáo viên và quản trị làm thử bộ đề');
    return this.db.tx(async (q) => {
      await this.quizzes.load(q, user, quizId);
      await q("DELETE FROM hk_attempts WHERE user_id = $1 AND quiz_id = $2 AND mode = 'preview'", [user.id, quizId]);
      const { plan, pass } = await this.planFromQuiz(q, quizId);
      const id = await this.insertAttempt(q, user.id, 'preview', quizId, null, plan, pass);
      return this.stateOf(q, user, id);
    });
  }

  async practiceInfo(user: UserRow) {
    return this.db.query(
      `SELECT w.question_id, t.prompt, t.qtype, w.wrong_count, w.last_wrong_at FROM hk_wrong_questions w JOIN hk_questions t ON t.id = w.question_id
       WHERE w.user_id = $1 AND w.cleared_at IS NULL ORDER BY w.last_wrong_at DESC LIMIT 50`, [user.id]);
  }

  /** Luyện lại các câu đã sai (HK.HS.048): làm đúng thì câu được gỡ khỏi danh sách và cộng điểm luyện tập */
  async startPractice(user: UserRow) {
    return this.db.tx(async (q) => {
      const open = (await q<{ id: number }>("SELECT id::int AS id FROM hk_attempts WHERE user_id = $1 AND status = 'active' AND mode = 'practice'", [user.id]))[0];
      if (open) return this.stateOf(q, user, open.id);
      const rows = await q<{ id: number; qtype: QType; prompt: string; image_url: string | null; explanation: string | null; difficulty: number; data: Record<string, unknown> }>(
        `SELECT t.id, t.qtype, t.prompt, t.image_url, t.explanation, t.difficulty, t.data FROM hk_wrong_questions w JOIN hk_questions t ON t.id = w.question_id
         WHERE w.user_id = $1 AND w.cleared_at IS NULL ORDER BY w.last_wrong_at DESC LIMIT ${PRACTICE_SIZE}`, [user.id]);
      if (!rows.length) throw new ConflictException('Bạn chưa có câu nào cần luyện lại');
      const seed = Math.floor(Math.random() * 2 ** 31);
      const plan = rows.map((r, idx): PlanItem => ({ question_id: r.id, points: 100, seconds: PRACTICE_SECONDS, seed: seed + idx * 101 + 1, shuffle: true, snap: this.snap(r) }));
      return this.stateOf(q, user, await this.insertAttempt(q, user.id, 'practice', null, null, plan, 60));
    });
  }

  /** Lượt luyện tập với danh sách câu do bộ gợi ý chọn (HK.HS.096), giữ nguyên thứ tự từ dễ đến khó; đang có lượt luyện tập dở thì tiếp tục lượt đó */
  async startCustomPractice(user: UserRow, questionIds: number[]) {
    return this.db.tx(async (q) => {
      const open = (await q<{ id: number }>("SELECT id::int AS id FROM hk_attempts WHERE user_id = $1 AND status = 'active' AND mode = 'practice'", [user.id]))[0];
      if (open) return this.stateOf(q, user, open.id);
      const rows = await q<{ id: number; qtype: QType; prompt: string; image_url: string | null; explanation: string | null; difficulty: number; data: Record<string, unknown> }>(
        'SELECT t.id, t.qtype, t.prompt, t.image_url, t.explanation, t.difficulty, t.data FROM hk_questions t WHERE t.id = ANY($1)', [questionIds]);
      const byId = new Map(rows.map((r) => [r.id, r]));
      const ordered = questionIds.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r));
      if (!ordered.length) throw new ConflictException('Chưa có câu hỏi phù hợp để luyện tập');
      const seed = Math.floor(Math.random() * 2 ** 31);
      const plan = ordered.map((r, idx): PlanItem => ({ question_id: r.id, points: 100, seconds: PRACTICE_SECONDS, seed: seed + idx * 101 + 1, shuffle: true, snap: this.snap(r) }));
      return this.stateOf(q, user, await this.insertAttempt(q, user.id, 'practice', null, null, plan, 60));
    });
  }

  private async loadAttempt(q: Q, user: UserRow, id: number, lock: boolean): Promise<AttemptRow> {
    const a = (await q<AttemptRow>(`SELECT ${ATTEMPT_COLUMNS} FROM hk_attempts WHERE id = $1 AND user_id = $2${lock ? ' FOR UPDATE' : ''}`, [id, user.id]))[0];
    if (!a) throw notFound('lượt làm bài');
    return a;
  }

  /** Hết giờ mà chưa trả lời: câu hiện tại tính là sai (hết thời gian) rồi chờ học sinh sang câu kế */
  private async settleExpiry(q: Q, user: UserRow, a: AttemptRow): Promise<AttemptRow> {
    if (a.status !== 'active' || !a.served_at) return a;
    const item = a.plan[a.position];
    const elapsed = Date.now() - new Date(a.served_at).getTime();
    if (item && elapsed > item.seconds * 1000 + GRACE_MS) {
      await this.record(q, user, a, item, null, item.seconds * 1000, true);
      return this.loadAttempt(q, user, a.id, true);
    }
    return a;
  }

  /** Ghi đáp án một câu, cập nhật điểm và vị trí; câu cuối thì kết thúc lượt */
  private async record(q: Q, user: UserRow, a: AttemptRow, item: PlanItem, answer: unknown, elapsedMs: number, timedOut: boolean) {
    const g = timedOut ? { correct: false, detail: undefined as unknown } : grade(item.snap, answer);
    const used = Math.min(Math.max(0, elapsedMs), item.seconds * 1000);
    const base = g.correct ? item.points : 0;
    const settings = await this.game.cfg();
    let bonus = g.correct ? bonusPoints(item.points, item.seconds, used, settings.speed_bonus_ratio) : 0;
    // Kỹ năng "Xung phong" (HK.HS.072): thưởng tốc độ của câu đúng kế tiếp được nhân đôi
    if (g.correct && a.mode !== 'preview' && (await this.game.useBuff(q, user, 'xung_phong'))) bonus *= 2;
    await q(
      `INSERT INTO hk_attempt_answers (attempt_id, question_id, position, answer, correct, timed_out, base_points, bonus_points, time_ms) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [a.id, item.question_id, a.position, timedOut || answer === undefined ? null : JSON.stringify(answer), g.correct, timedOut, base, bonus, used]);
    if (a.mode !== 'preview') {
      if (!g.correct) {
        await q(
          `INSERT INTO hk_wrong_questions (user_id, question_id) VALUES ($1, $2)
           ON CONFLICT (user_id, question_id) DO UPDATE SET wrong_count = hk_wrong_questions.wrong_count + 1, last_wrong_at = now(), cleared_at = NULL`, [user.id, item.question_id]);
      } else if (a.mode === 'practice') {
        const cleared = await q<{ wrong_count: number }>('UPDATE hk_wrong_questions SET cleared_at = now() WHERE user_id = $1 AND question_id = $2 AND cleared_at IS NULL RETURNING wrong_count', [user.id, item.question_id]);
        if (cleared.length) {
          await this.game.awardXp(q, user, settings.practice_correct_xp, 'practice', `practice:${item.question_id}:${cleared[0].wrong_count}`);
          await this.game.gainHearts(q, user, settings.hearts.per_practice_correct);
        }
      }
      if (a.mode === 'node' && !g.correct && (await this.nodeKind(q, a.node_id)) !== 'practice') await this.game.loseHeart(q, user);
      if (g.correct) await this.game.onCorrectAnswer(q, user);
      await logEvent(null, user, 'answer', 'question', item.question_id, a.node_id, { correct: g.correct, timed_out: timedOut, ms: used }, used, q);
    }
    const nextPosition = a.position + 1;
    await q(
      `UPDATE hk_attempts SET position = $2, served_at = NULL, base_points = base_points + $3, bonus_points = bonus_points + $4,
         correct_count = correct_count + $5, wrong_count = wrong_count + $6 WHERE id = $1`,
      [a.id, nextPosition, base, bonus, g.correct ? 1 : 0, g.correct ? 0 : 1]);
    return { correct: g.correct, detail: g.detail, base, bonus, timedOut };
  }

  private async finalize(q: Q, user: UserRow, id: number): Promise<Record<string, unknown>> {
    const a = await this.loadAttempt(q, user, id, true);
    const maxBase = a.plan.reduce((n, p) => n + p.points, 0);
    const percent = maxBase ? Math.round((a.base_points / maxBase) * 100) : 0;
    const timing = (await q<{ used: string }>('SELECT COALESCE(sum(time_ms), 0) AS used FROM hk_attempt_answers WHERE attempt_id = $1', [id]))[0];
    const allowed = a.plan.reduce((n, p) => n + p.seconds * 1000, 0);
    const timeRatio = allowed ? Number(timing.used) / allowed : 1;
    const passed = percent >= a.pass_percent;
    const stars = a.mode === 'practice' ? 0 : starsFor(percent, a.pass_percent, timeRatio);
    await q(
      `UPDATE hk_attempts SET status = 'done', finished_at = now(), percent = $2, stars = $3, passed = $4, duration_ms = $5, max_points = $6 WHERE id = $1`,
      [id, percent, stars, passed, Number(timing.used), maxBase]);
    let node: Record<string, unknown> | null = null;
    // Nút luyện tập làm lại không giới hạn nên không thưởng vàng khi đạt 100% (tránh cày vàng)
    const kind = a.mode === 'node' ? await this.nodeKind(q, a.node_id) : null;
    if (a.mode === 'node' && a.node_id) {
      const row = (await q<{ journey_id: number }>('SELECT journey_id FROM hk_nodes WHERE id = $1', [a.node_id]))[0];
      if (row) {
        const target = (await nodesWithState(q, user.id, row.journey_id)).find((n) => n.id === a.node_id);
        if (target) node = await this.finishNode(q, user, target, { percent, stars, points: a.base_points + a.bonus_points, passed, ref: `a${id}` });
      }
    }
    if (node) await q('UPDATE hk_attempts SET result = $2 WHERE id = $1', [id, JSON.stringify(node)]);
    if (a.mode === 'assignment' && a.assignment_id) {
      const sub = await recordSubmission(q, this.game, user, a.assignment_id, percent);
      await q('UPDATE hk_attempts SET result = $2 WHERE id = $1', [id, JSON.stringify({ assignment_id: a.assignment_id, ...sub })]);
    }
    if (a.mode === 'node' && percent === 100 && kind !== 'practice') await this.game.onPerfectQuiz(q, user, id);
    if (a.mode !== 'preview') await logEvent(null, user, 'attempt_finish', 'attempt', id, a.node_id, { percent, passed }, Number(timing.used), q);
    return { percent, stars, passed, node };
  }

  /** Trạng thái hiện tại của lượt làm bài: câu đang làm (không có đáp án) hoặc kết quả khi đã xong */
  private async stateOf(q: Q, user: UserRow, id: number) {
    const a = await this.settleExpiry(q, user, await this.loadAttempt(q, user, id, true));
    const total = a.plan.length;
    const base = { id: a.id, mode: a.mode, status: a.status, total, position: a.position, base_points: a.base_points, bonus_points: a.bonus_points, quiz_id: a.quiz_id, node_id: a.node_id, pass_percent: a.pass_percent };
    if (a.status === 'done' || a.position >= total) {
      if (a.status !== 'done') await this.finalize(q, user, a.id);
      return { ...base, status: 'done', summary: await this.summary(q, user, a.id) };
    }
    if (!a.served_at) return { ...base, waiting_next: true };
    const item = a.plan[a.position];
    const remaining = Math.max(0, item.seconds * 1000 - (Date.now() - new Date(a.served_at).getTime()));
    return {
      ...base,
      current: { index: a.position, seconds: item.seconds, remaining_ms: remaining, points: item.points, question: this.visible(item) },
    };
  }

  /** Câu hỏi hiển thị cho học sinh: bỏ các đáp án đã bị gợi ý 50/50 loại */
  private visible(item: PlanItem): Record<string, unknown> {
    const view = publicView({ ...item.snap, id: item.question_id }, item.seed, item.shuffle) as { options?: Array<{ id: string }> };
    if (item.removed?.length && view.options) view.options = view.options.filter((o) => !item.removed!.includes(o.id));
    return view;
  }

  /** Gợi ý 50/50 (HK.HS.070): chỉ cho câu một đáp án đang làm; máy chủ chọn đáp án sai bị loại, chỉ còn một đáp án sai cạnh đáp án đúng */
  async hint(user: UserRow, id: number, opts: { free?: boolean } = {}) {
    return this.db.tx(async (q) => {
      const a = await this.loadAttempt(q, user, id, true);
      const item = a.plan[a.position];
      if (a.status !== 'active' || !item || !a.served_at) throw new ConflictException('Chưa có câu hỏi đang làm');
      if (a.mode === 'preview') throw new ConflictException('Làm thử không dùng gợi ý');
      const data = item.snap.data as { options?: Array<{ id: string }>; correct?: string };
      if (item.snap.qtype !== 'single' || !data.options || data.options.length < 3) throw new ConflictException('Gợi ý 50/50 chỉ dùng cho câu một đáp án có từ 3 lựa chọn');
      if (item.removed?.length) throw new ConflictException('Em đã dùng gợi ý cho câu này rồi');
      const held = opts.free ? { item_id: 0 } : (await q<{ item_id: number }>("SELECT i.item_id FROM hk_inventory i JOIN hk_shop_items s ON s.id = i.item_id WHERE i.user_id = $1 AND s.kind = 'hint' AND i.qty > 0 ORDER BY i.item_id LIMIT 1 FOR UPDATE", [user.id]))[0];
      if (!held) throw new ConflictException('Em không còn gợi ý 50/50; mua thêm ở cửa hàng nhé');
      const wrong = seededShuffle(data.options.filter((o) => o.id !== data.correct), item.seed);
      const removed = wrong.slice(0, wrong.length - 1).map((o) => o.id);
      if (!opts.free) await q('UPDATE hk_inventory SET qty = qty - 1 WHERE user_id = $1 AND item_id = $2', [user.id, held.item_id]);
      const plan = a.plan.map((p, i) => (i === a.position ? { ...p, removed } : p));
      await q('UPDATE hk_attempts SET plan = $2 WHERE id = $1', [id, JSON.stringify(plan)]);
      return { removed };
    });
  }

  /** Mục lịch sử đã công bố liên quan đến câu đang làm (kỹ năng "Trận đồ", HK.HS.072): thường chỉ hiện sau khi trả lời */
  async currentLinks(user: UserRow, id: number) {
    return this.db.tx(async (q) => {
      const a = await this.loadAttempt(q, user, id, false);
      const item = a.plan[a.position];
      if (a.status !== 'active' || !item || !a.served_at) throw new ConflictException('Chưa có câu hỏi đang làm');
      if (a.mode === 'preview') throw new ConflictException('Làm thử không dùng kỹ năng');
      return this.publishedLinks(q, item.question_id);
    });
  }

  async attempt(user: UserRow, id: number) {
    return this.db.tx((q) => this.stateOf(q, user, id));
  }

  /** Sang câu kế tiếp: đồng hồ của câu bắt đầu chạy từ lúc này, không tính thời gian học sinh xem giải thích */
  async next(user: UserRow, id: number) {
    return this.db.tx(async (q) => {
      const a = await this.loadAttempt(q, user, id, true);
      if (a.status === 'active' && a.position < a.plan.length && !a.served_at) await q('UPDATE hk_attempts SET served_at = now() WHERE id = $1', [id]);
      return this.stateOf(q, user, id);
    });
  }

  async answer(user: UserRow, id: number, questionId: number, answer: unknown) {
    return this.db.tx(async (q) => {
      const a = await this.loadAttempt(q, user, id, true);
      if (a.status === 'done') throw new ConflictException('Lượt làm bài đã kết thúc');
      const item = a.plan[a.position];
      // Chỉ nhận câu trả lời cho đúng câu đang được phát; trả lời muộn vẫn được ghi (tính là hết giờ) để học sinh thấy đáp án và giải thích
      if (!item || !a.served_at || item.question_id !== questionId) {
        throw new ConflictException('Câu hỏi này không còn là câu hiện tại; hãy tải lại lượt làm bài');
      }
      const elapsed = Date.now() - new Date(a.served_at).getTime();
      const late = elapsed > item.seconds * 1000 + GRACE_MS;
      const res = await this.record(q, user, a, item, answer, elapsed, late);
      const finishedNow = a.position + 1 >= a.plan.length;
      if (finishedNow) await this.finalize(q, user, id);
      return {
        result: {
          question_id: questionId, correct: res.correct, timed_out: res.timedOut, base_points: res.base, bonus_points: res.bonus, explanation: item.snap.explanation,
          answer_key: item.snap.data, detail: res.detail, links: await this.publishedLinks(q, questionId),
        },
        finished: finishedNow, ...(finishedNow ? { summary: await this.summary(q, user, id) } : {}),
        attempt: { id, position: a.position + 1, total: a.plan.length, base_points: a.base_points + res.base, bonus_points: a.bonus_points + res.bonus },
      };
    });
  }

  /** Mục lịch sử đã công bố gắn với câu hỏi, dẫn tới tư liệu trong lời giải thích (HK.HS.046) */
  private async publishedLinks(q: Q, questionId: number) {
    const out: Array<{ ref_type: string; ref_id: number; label: string }> = [];
    for (const l of await q<{ ref_type: Entity; ref_id: number }>('SELECT ref_type, ref_id FROM hk_question_links WHERE question_id = $1', [questionId])) {
      const spec = SPECS[l.ref_type];
      const found = (await q<{ label: string }>(`SELECT ${spec.main} AS label FROM ${spec.table} WHERE id = $1 AND status = 'published'`, [l.ref_id]))[0];
      if (found) out.push({ ref_type: l.ref_type, ref_id: l.ref_id, label: found.label });
    }
    return out;
  }

  private async summary(q: Q, user: UserRow, id: number) {
    const a = await this.loadAttempt(q, user, id, false);
    const node = a.node_id ? (await q<{ title: string; kind: string; reward_points: number }>('SELECT title, kind, reward_points FROM hk_nodes WHERE id = $1', [a.node_id]))[0] : null;
    const result = a.mode === 'node' && a.node_id
      ? (await q('SELECT stars, best_percent, completed_at FROM hk_node_progress WHERE user_id = $1 AND node_id = $2', [user.id, a.node_id]))[0] ?? null
      : null;
    return {
      percent: a.percent, stars: a.stars, passed: a.passed, pass_percent: a.pass_percent, correct: a.correct_count, wrong: a.wrong_count, total: a.plan.length,
      base_points: a.base_points, bonus_points: a.bonus_points, duration_ms: a.duration_ms, node, node_result: a.mode === 'assignment' ? null : a.result, assignment: a.mode === 'assignment' ? a.result : null, best: result,
    };
  }

  // ------------------------------------------------------------------ xem lại và lịch sử (HK.HS.046, 049)
  async review(user: UserRow, id: number) {
    return this.db.tx(async (q) => {
      const a = await this.loadAttempt(q, user, id, false);
      if (a.status !== 'done') throw new ConflictException('Hãy hoàn thành lượt làm bài trước khi xem lại');
      const answers = await q<{ question_id: number; answer: unknown; correct: boolean; timed_out: boolean; base_points: number; bonus_points: number; time_ms: number }>(
        'SELECT question_id, answer, correct, timed_out, base_points, bonus_points, time_ms FROM hk_attempt_answers WHERE attempt_id = $1 ORDER BY position', [id]);
      const items = [];
      for (const [index, p] of a.plan.entries()) {
        const given = answers.find((x) => x.question_id === p.question_id);
        items.push({
          index, question_id: p.question_id, qtype: p.snap.qtype, prompt: p.snap.prompt, image_url: p.snap.image_url, explanation: p.snap.explanation, answer_key: p.snap.data,
          answer: given?.answer ?? null, correct: given?.correct ?? false, timed_out: given?.timed_out ?? false, base_points: given?.base_points ?? 0, bonus_points: given?.bonus_points ?? 0,
          time_ms: given?.time_ms ?? 0, seconds: p.seconds, links: await this.publishedLinks(q, p.question_id),
        });
      }
      return { id, mode: a.mode, started_at: a.started_at, finished_at: a.finished_at, summary: await this.summary(q, user, id), items };
    });
  }

  async history(user: UserRow, page = 1, limit = 20) {
    const size = Math.min(50, Math.max(1, limit));
    const offset = (Math.max(1, page) - 1) * size;
    const total = Number((await this.read<{ n: string }>("SELECT count(*) AS n FROM hk_attempts WHERE user_id = $1 AND status = 'done' AND mode <> 'preview'", [user.id]))[0].n);
    const items = await this.read(
      `SELECT a.id::int AS id, a.mode, a.percent, a.stars, a.passed, a.correct_count, a.wrong_count, a.base_points + a.bonus_points AS points, a.duration_ms, a.finished_at,
              n.title AS node_title, n.kind AS node_kind, z.title AS quiz_title, c.title AS campaign_title
       FROM hk_attempts a LEFT JOIN hk_nodes n ON n.id = a.node_id LEFT JOIN hk_quizzes z ON z.id = a.quiz_id
       LEFT JOIN hk_journeys j ON j.id = n.journey_id LEFT JOIN hist_campaigns c ON c.id = j.campaign_id
       WHERE a.user_id = $1 AND a.status = 'done' AND a.mode <> 'preview' ORDER BY a.finished_at DESC LIMIT $2 OFFSET $3`, [user.id, size, offset]);
    return { total, page, limit: size, items };
  }

  // ------------------------------------------------------------------ nhiệm vụ (HK.HS.023)
  /** Mỗi nút của hành trình đang học là một nhiệm vụ: đang làm, đã hoàn thành, chưa mở; nhiệm vụ hằng ngày/tuần thuộc Sprint 5 */
  async quests(user: UserRow) {
    const q = this.read;
    const active = await activeJourneys(q, user.id);
    const out = { doing: [] as unknown[], done: [] as unknown[], locked: [] as unknown[] };
    for (const j of active) {
      const campaign = (await q<{ title: string }>('SELECT title FROM hist_campaigns WHERE id = $1', [j.campaign_id]))[0]?.title ?? '';
      const nodes = await nodesWithState(q, user.id, j.journey_id);
      const quizPass = new Map<number, number>();
      for (const n of nodes.filter((x) => x.quiz_id)) quizPass.set(n.id, (await q<{ pass_percent: number }>('SELECT pass_percent FROM hk_quizzes WHERE id = $1', [n.quiz_id]))[0]?.pass_percent ?? 60);
      for (const n of nodes) {
        const pass = n.pass_percent ?? quizPass.get(n.id);
        const condition = n.kind === 'lesson' ? 'Đọc hết bài học và trả lời đúng câu kiểm tra nhanh'
          : n.kind === 'source' ? 'Đọc tư liệu để mở khóa'
            : n.kind === 'chest' ? 'Đi tới rương và mở để nhận thưởng'
              : n.kind === 'practice' ? 'Ôn lại các câu đã học trong cửa'
                : n.kind === 'listen' ? 'Nghe hết câu chuyện' + (n.quiz_id ? ' và trả lời câu hỏi về nội dung vừa nghe' : '')
                  : n.kind === 'battle' && !n.quiz_id ? 'Tìm hiểu hồ sơ trận đánh'
                    : `Đạt từ ${pass ?? (n.kind === 'gate_test' ? 70 : 60)}% điểm ở bộ câu hỏi`;
        const quest = { node_id: n.id, campaign_id: j.campaign_id, campaign_title: campaign, journey_title: j.title, title: n.title, kind: n.kind, kind_label: NODE_KIND_LABEL[n.kind], condition, reward_points: n.reward_points, stars: n.stars, state: n.state, best_percent: n.best_percent };
        (n.state === 'done' ? out.done : n.state === 'available' ? out.doing : out.locked).push(quest);
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ ghi chú, yêu thích, sự kiện (HK.HS.037, 042, HK.SYS.014)
  async notes(user: UserRow) {
    return this.read(
      `SELECT n.ref_type, n.ref_id, n.body, n.updated_at, COALESCE(l.title, s.title) AS title FROM hk_notes n
       LEFT JOIN hk_lessons l ON n.ref_type = 'lesson' AND l.id = n.ref_id LEFT JOIN hist_sources s ON n.ref_type = 'source' AND s.id = n.ref_id
       WHERE n.user_id = $1 ORDER BY n.updated_at DESC LIMIT 200`, [user.id]);
  }

  async saveNote(user: UserRow, refType: 'lesson' | 'source', refId: number, body: string) {
    const text = body.trim();
    if (!text || text.length > 2000) throw new BadRequestException('Ghi chú cần từ 1 đến 2000 ký tự');
    await this.assertNoteTarget(user, refType, refId);
    await this.read(
      `INSERT INTO hk_notes (user_id, ref_type, ref_id, body) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, ref_type, ref_id) DO UPDATE SET body = $4, updated_at = now()`, [user.id, refType, refId, text]);
    return { ref_type: refType, ref_id: refId, body: text };
  }

  async removeNote(user: UserRow, refType: string, refId: number): Promise<void> {
    await this.read('DELETE FROM hk_notes WHERE user_id = $1 AND ref_type = $2 AND ref_id = $3', [user.id, refType, refId]);
  }

  /** Chỉ ghi chú được bài học đã công bố hoặc tư liệu đã mở khóa */
  private async assertNoteTarget(user: UserRow, refType: string, refId: number): Promise<void> {
    if (refType === 'lesson') {
      if (!(await this.read("SELECT 1 FROM hk_lessons WHERE id = $1 AND status = 'published'", [refId])).length) throw notFound('bài học');
      return;
    }
    await this.assertSourceOpen(user, refId);
  }

  private async assertSourceOpen(user: UserRow, sourceId: number): Promise<void> {
    if (!(await this.read("SELECT 1 FROM hist_sources WHERE id = $1 AND status = 'published'", [sourceId])).length) throw notFound('tư liệu');
    const source = await this.learn.source(user, sourceId);
    if ((source as { locked?: boolean }).locked) throw new ConflictException('Hãy mở khóa tư liệu này trước');
  }

  async favorites(user: UserRow) {
    return this.learn.sources(user, { favorites: 'true' });
  }

  async setFavorite(user: UserRow, sourceId: number, on: boolean) {
    if (on) {
      await this.assertSourceOpen(user, sourceId);
      await this.read('INSERT INTO hk_favorites (user_id, source_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, sourceId]);
    } else await this.read('DELETE FROM hk_favorites WHERE user_id = $1 AND source_id = $2', [user.id, sourceId]);
    return { source_id: sourceId, favorite: on };
  }

  /** Sự kiện xem do trình duyệt báo (xem bản đồ, dòng thời gian...); chỉ nhận danh mục sự kiện xem đã định sẵn */
  async viewEvent(user: UserRow, event: string, refType: string | null, refId: number | null, durationMs: number | null) {
    if (!VIEW_EVENTS.includes(event)) throw new BadRequestException('Loại sự kiện không hợp lệ');
    await logEvent(this.db, user, event, refType, refId, null, null, durationMs !== null ? Math.max(0, Math.min(3_600_000, Math.round(durationMs))) : null);
    return { ok: true };
  }
}
