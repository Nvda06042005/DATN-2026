/**
 * Mô phỏng trận đánh và mini-game (HK.HS.028, 051–061; HK.AD.046–047): danh sách trận đánh mô phỏng có trạng thái mở khóa và điểm cao nhất, màn giới thiệu,
 * chơi theo lượt (quyết định, bố trí lực lượng trên bản đồ) với phản hồi lịch sử sau từng bước, kết quả – sao – điểm, chơi lại (chỉ điểm cao nhất được tính),
 * lưu lượt chơi dở, hoạt ảnh diễn biến, và ba mini-game (ghép thẻ, sắp xếp dòng thời gian, ô chữ). Máy chủ giữ đáp án, chấm điểm và đồng hồ;
 * hoàn thành mô phỏng ở nút trận đánh đi qua cùng cơ chế hoàn thành nút của bản đồ hành trình (mở nút kế tiếp, tư liệu, thẻ nhân vật).
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { recordSubmission } from '../classroom/submission';
import { checkLinks, notFound } from '../content/access';
import { seededShuffle } from '../content/questions';
import { GameService } from '../game/game.service';
import { Entity, SPECS } from '../history/history.service';
import { logEvent } from '../student/events';
import { PlayService } from '../student/play.service';
import { activeJourneys, nodesWithState, ProgressNode } from '../student/progress';
import {
  CrosswordParams, crosswordLetters, evaluateStep, Link, MatchParams, MiniKind, MINI_LABEL, miniTally, normalizeMinigame, normalizeScenario, publicStep, Scenario, scenarioMax, stepMax,
  StepOutcome, tally, TimelineParams,
} from './engine';

const GRACE_MS = 3000;
type RunKind = 'battle' | 'match' | 'timeline' | 'crossword';
interface RunRow {
  id: number; user_id: number; kind: RunKind; scenario_id: number | null; minigame_id: number | null; node_id: number | null; assignment_id: number | null; mode: 'play' | 'preview'; status: 'active' | 'done';
  snapshot: Record<string, any>; state: Record<string, any>; started_at: Date; deadline: Date | null; finished_at: Date | null; score: number; max_score: number; bonus: number;
  percent: number; stars: number; passed: boolean | null; timed_out: boolean; duration_ms: number | null; result: Record<string, any> | null;
}
const RUN_COLUMNS = 'id::int AS id, user_id, kind, scenario_id, minigame_id, node_id, assignment_id, mode, status, snapshot, state, started_at, deadline, finished_at, score, max_score, bonus, percent, stars, passed, timed_out, duration_ms, result';
const isStudent = (u: UserRow) => u.role === 'student';

export interface ScenarioInput { battle_id?: number; title?: string; summary?: string | null; difficulty?: number; content?: unknown }
export interface MinigameInput { kind?: MiniKind; title?: string; description?: string | null; campaign_id?: number | null; lesson_id?: number | null; params?: unknown; seconds?: number; points?: number }

@Injectable()
export class BattleService {
  constructor(private readonly db: DatabaseService, private readonly play: PlayService, private readonly game: GameService) {}

  private readonly read: Q = (sql, params) => this.db.query(sql, params);

  // ------------------------------------------------------------------ danh sách và giới thiệu (HK.HS.051, 052)
  /** Nút trận đánh của học sinh trong các hành trình đang học: battle_id -> nút */
  private async battleNodes(q: Q, user: UserRow): Promise<Map<number, ProgressNode>> {
    const out = new Map<number, ProgressNode>();
    if (!isStudent(user)) return out;
    for (const j of await activeJourneys(q, user.id)) {
      for (const n of await nodesWithState(q, user.id, j.journey_id)) if (n.battle_id && !out.has(n.battle_id)) out.set(n.battle_id, n);
    }
    return out;
  }

  async list(user: UserRow) {
    const q = this.read;
    const nodes = await this.battleNodes(q, user);
    const scenarios = await q<Record<string, any>>(
      `SELECT s.id, s.title, s.summary, s.difficulty, s.battle_id, b.name AS battle_name, b.year, b.date_text, b.campaign_id, c.title AS campaign_title, jsonb_array_length(s.content->'steps')::int AS steps,
              (s.content->'animation') IS NOT NULL AND jsonb_typeof(s.content->'animation') = 'object' AS has_animation
       FROM hk_scenarios s JOIN hist_battles b ON b.id = s.battle_id AND b.status = 'published' LEFT JOIN hist_campaigns c ON c.id = b.campaign_id
       WHERE s.status = 'published' ORDER BY b.year, b.sort_order, s.id`);
    const runs = await q<Record<string, any>>(
      `SELECT scenario_id, max(score + bonus) FILTER (WHERE status = 'done') AS best_points, max(percent) FILTER (WHERE status = 'done') AS best_percent, max(stars) FILTER (WHERE status = 'done') AS best_stars,
              count(*) FILTER (WHERE status = 'done' AND passed)::int AS wins, count(*) FILTER (WHERE status = 'done')::int AS plays, max(id) FILTER (WHERE status = 'active')::int AS active_run
       FROM hk_game_runs WHERE user_id = $1 AND mode = 'play' AND scenario_id IS NOT NULL GROUP BY scenario_id`, [user.id]);
    const battles = scenarios.map((s) => {
      const node = nodes.get(s.battle_id);
      const r = runs.find((x) => x.scenario_id === s.id);
      return {
        ...s, locked: node?.state === 'locked', node_id: node?.id ?? null, node_state: node?.state ?? null,
        best: { points: Number(r?.best_points ?? 0), percent: Number(r?.best_percent ?? 0), stars: Number(r?.best_stars ?? 0), wins: r?.wins ?? 0, plays: r?.plays ?? 0 }, active_run: r?.active_run ?? null,
      };
    });
    return { battles, minigames: await this.minigameList(q, user) };
  }

  private async minigameList(q: Q, user: UserRow) {
    const rows = await q<Record<string, any>>(
      `SELECT m.id, m.kind, m.title, m.description, m.seconds, m.points, m.campaign_id, c.title AS campaign_title
       FROM hk_minigames m LEFT JOIN hist_campaigns c ON c.id = m.campaign_id WHERE m.status = 'published' ORDER BY m.kind, m.id`);
    const runs = await q<Record<string, any>>(
      `SELECT minigame_id, max(score) FILTER (WHERE status = 'done') AS best_score, max(percent) FILTER (WHERE status = 'done') AS best_percent, max(stars) FILTER (WHERE status = 'done') AS best_stars,
              count(*) FILTER (WHERE status = 'done')::int AS plays, max(id) FILTER (WHERE status = 'active')::int AS active_run
       FROM hk_game_runs WHERE user_id = $1 AND mode = 'play' AND minigame_id IS NOT NULL GROUP BY minigame_id`, [user.id]);
    return rows.map((m) => {
      const r = runs.find((x) => x.minigame_id === m.id);
      return { ...m, kind_label: MINI_LABEL[m.kind as MiniKind], best: { score: Number(r?.best_score ?? 0), percent: Number(r?.best_percent ?? 0), stars: Number(r?.best_stars ?? 0), plays: r?.plays ?? 0 }, active_run: r?.active_run ?? null };
    });
  }

  private async scenarioFor(q: Q, user: UserRow, id: number, lock = false) {
    const row = (await q<Record<string, any>>(
      `SELECT s.id, s.title, s.summary, s.difficulty, s.battle_id, s.status, s.content, b.name AS battle_name, b.year, b.date_text, b.context, b.forces, b.course, b.result, b.status AS battle_status, b.campaign_id,
              c.title AS campaign_title
       FROM hk_scenarios s JOIN hist_battles b ON b.id = s.battle_id LEFT JOIN hist_campaigns c ON c.id = b.campaign_id WHERE s.id = $1${lock ? ' FOR UPDATE OF s' : ''}`, [id]))[0];
    if (!row || (row.status !== 'published' && user.role !== 'root_admin')) throw notFound('trận đánh mô phỏng');
    return row;
  }

  /** Màn giới thiệu (HK.HS.052): tình hình, lực lượng, nhiệm vụ của người chỉ huy trước khi vào trận; kèm trạng thái mở khóa và lượt đang chơi dở */
  async intro(user: UserRow, id: number) {
    const q = this.read;
    const row = await this.scenarioFor(q, user, id);
    const sc = row.content as Scenario;
    const node = (await this.battleNodes(q, user)).get(row.battle_id);
    const runs = await q<Record<string, any>>(
      `SELECT max(score + bonus) FILTER (WHERE status = 'done') AS best_points, max(percent) FILTER (WHERE status = 'done') AS best_percent, max(stars) FILTER (WHERE status = 'done') AS best_stars,
              count(*) FILTER (WHERE status = 'done')::int AS plays, max(id) FILTER (WHERE status = 'active')::int AS active_run
       FROM hk_game_runs WHERE user_id = $1 AND mode = 'play' AND scenario_id = $2`, [user.id, id]);
    const hasHistory = (await q('SELECT 1 FROM hk_game_runs WHERE user_id = $1 AND scenario_id = $2 AND status = \'done\' LIMIT 1', [user.id, id])).length > 0;
    return {
      id: row.id, title: row.title, summary: row.summary, difficulty: row.difficulty, status: row.status,
      battle: { id: row.battle_id, name: row.battle_name, year: row.year, date_text: row.date_text, context: row.context, forces: row.forces, campaign_id: row.campaign_id, campaign_title: row.campaign_title },
      intro: sc.intro, map: sc.map, steps: sc.steps.length, max_score: scenarioMax(sc), pass_percent: sc.pass_percent, bonus_points: sc.bonus_points,
      has_animation: Boolean(sc.animation), locked: node?.state === 'locked', node_id: node?.id ?? null,
      best: { points: Number(runs[0]?.best_points ?? 0), percent: Number(runs[0]?.best_percent ?? 0), stars: Number(runs[0]?.best_stars ?? 0), plays: runs[0]?.plays ?? 0 }, active_run: runs[0]?.active_run ?? null,
      replay: hasHistory,
    };
  }

  /** Hoạt ảnh diễn biến trên bản đồ (HK.HS.028): vị trí hai bên theo từng khung thời gian */
  async animation(user: UserRow, id: number) {
    const row = await this.scenarioFor(this.read, user, id);
    const sc = row.content as Scenario;
    if (!sc.animation) throw notFound('hoạt ảnh của trận đánh này');
    if (isStudent(user)) await logEvent(this.db, user, 'view_battle_animation', 'scenario', id);
    return { scenario_id: id, title: sc.animation.title ?? row.battle_name, battle: row.battle_name, map: sc.map, frames: sc.animation.frames, note: 'Vị trí và hướng di chuyển mang tính minh họa, không phải bản đồ chính xác.' };
  }

  // ------------------------------------------------------------------ bắt đầu và tiếp tục (HK.HS.053, 057, 061)
  private async loadRun(q: Q, user: UserRow, id: number, lock = false): Promise<RunRow> {
    const run = (await q<RunRow>(`SELECT ${RUN_COLUMNS} FROM hk_game_runs WHERE id = $1 AND user_id = $2${lock ? ' FOR UPDATE' : ''}`, [id, user.id]))[0];
    if (!run) throw notFound('lượt chơi');
    return run;
  }

  async startScenario(user: UserRow, id: number, opts: { restart?: boolean; preview?: boolean }) {
    return this.db.tx(async (q) => {
      const row = await this.scenarioFor(q, user, id, true);
      const sc = row.content as Scenario;
      const preview = Boolean(opts.preview);
      if (!isStudent(user) && !preview) throw new ForbiddenException('Giáo viên và quản trị chỉ chơi thử (chế độ xem trước)');
      if (preview && isStudent(user)) throw new ForbiddenException('Học sinh không dùng chế độ xem trước');
      let nodeId: number | null = null;
      if (!preview) {
        if (row.battle_status !== 'published') throw notFound('trận đánh mô phỏng');
        const node = (await this.battleNodes(q, user)).get(row.battle_id);
        if (node?.state === 'locked') throw new ConflictException(`Hãy hoàn thành nút trước đó để mở trận "${row.battle_name}"`);
        nodeId = node?.id ?? null;
        const active = (await q<RunRow>(`SELECT ${RUN_COLUMNS} FROM hk_game_runs WHERE user_id = $1 AND scenario_id = $2 AND status = 'active' AND mode = 'play' FOR UPDATE`, [user.id, id]))[0];
        if (active && !opts.restart) return this.viewRun(q, active);
        if (active) await q('DELETE FROM hk_game_runs WHERE id = $1', [active.id]);
      }
      const snapshot = { title: row.title, battle: { id: row.battle_id, name: row.battle_name, year: row.year, date_text: row.date_text }, scenario: sc };
      const created = (await q<{ id: number }>(
        `INSERT INTO hk_game_runs (user_id, kind, scenario_id, node_id, mode, snapshot, state, max_score) VALUES ($1, 'battle', $2, $3, $4, $5, $6, $7) RETURNING id::int AS id`,
        [user.id, id, nodeId, preview ? 'preview' : 'play', JSON.stringify(snapshot), JSON.stringify({ seed: randomInt(1, 2_000_000_000), index: 0, outcomes: [] }), scenarioMax(sc)]))[0];
      if (!preview) await logEvent(null, user, 'battle_start', 'scenario', id, nodeId, null, null, q);
      return this.viewRun(q, await this.loadRun(q, user, created.id));
    });
  }

  async run(user: UserRow, id: number) {
    return this.db.tx(async (q) => {
      let run = await this.loadRun(q, user, id, true);
      run = await this.expire(q, user, run);
      return this.viewRun(q, run);
    });
  }

  private async publishedLinks(q: Q, links: Link[]) {
    const out: Array<Link & { label: string }> = [];
    for (const l of links ?? []) {
      const spec = SPECS[l.ref_type as Entity];
      if (!spec) continue;
      const found = (await q<{ label: string }>(`SELECT ${spec.main} AS label FROM ${spec.table} WHERE id = $1 AND status = 'published'`, [l.ref_id]))[0];
      if (found) out.push({ ...l, label: found.label });
    }
    return out;
  }

  private async outcomeView(q: Q, o: StepOutcome) {
    return { ...o, links: await this.publishedLinks(q, o.links) };
  }

  private async viewRun(q: Q, run: RunRow) {
    const base = {
      id: run.id, kind: run.kind, mode: run.mode, status: run.status, title: run.snapshot.title as string, node_id: run.node_id, scenario_id: run.scenario_id, minigame_id: run.minigame_id,
      started_at: run.started_at, remaining_ms: run.deadline && run.status === 'active' ? Math.max(0, new Date(run.deadline).getTime() - Date.now()) : null, result: run.result,
    };
    if (run.kind === 'battle') {
      const sc = run.snapshot.scenario as Scenario;
      const outcomes = run.state.outcomes as StepOutcome[];
      const index = run.state.index as number;
      const history = [];
      for (const o of outcomes) history.push(await this.outcomeView(q, o));
      return {
        ...base, battle: run.snapshot.battle, intro: sc.intro, map: sc.map, total: sc.steps.length, index, score: outcomes.reduce((n, o) => n + o.score, 0), max_score: run.max_score,
        pass_percent: sc.pass_percent, bonus_points: sc.bonus_points, history,
        step: run.status === 'active' ? publicStep(sc.steps[index], index, sc.steps.length, run.state.seed as number) : null,
      };
    }
    return { ...base, game: this.miniPublic(run), points: run.snapshot.points as number, seconds: run.snapshot.seconds as number };
  }

  // ------------------------------------------------------------------ chơi từng bước (HK.HS.053–055)
  async answer(user: UserRow, id: number, body: Record<string, any>) {
    return this.db.tx(async (q) => {
      let run = await this.loadRun(q, user, id, true);
      run = await this.expire(q, user, run);
      if (run.status !== 'active') throw new ConflictException(run.timed_out ? 'Đã hết giờ' : 'Lượt chơi này đã kết thúc');
      if (run.kind === 'battle') return this.answerBattle(q, user, run, body);
      if (run.kind === 'match') return this.answerMatch(q, user, run, body);
      return this.answerSubmit(q, user, run, body);
    });
  }

  private async answerBattle(q: Q, user: UserRow, run: RunRow, body: Record<string, any>) {
    const sc = run.snapshot.scenario as Scenario;
    const index = run.state.index as number;
    const step = sc.steps[index];
    if (body.step_id !== step.id) throw new ConflictException('Bước hiện tại đã đổi, hãy tải lại lượt chơi');
    const outcome = evaluateStep(step, body);
    const outcomes = [...(run.state.outcomes as StepOutcome[]), outcome];
    const state = { ...run.state, index: index + 1, outcomes };
    const score = outcomes.reduce((n, o) => n + o.score, 0);
    await q('UPDATE hk_game_runs SET state = $2, score = $3 WHERE id = $1', [run.id, JSON.stringify(state), score]);
    const finished = index + 1 >= sc.steps.length;
    if (finished) await this.finishBattle(q, user, { ...run, state, score }, sc, outcomes);
    const fresh = await this.loadRun(q, user, run.id);
    return { feedback: await this.outcomeView(q, outcome), finished, run: await this.viewRun(q, fresh) };
  }

  /** Kết thúc lượt mô phỏng (HK.HS.056): thắng/thua, điểm (+thưởng toàn thắng), sao; ở nút trận đánh thì hoàn thành nút như làm bài */
  private async finishBattle(q: Q, user: UserRow, run: RunRow, sc: Scenario, outcomes: StepOutcome[]): Promise<void> {
    const t = tally(sc, outcomes);
    const duration = Math.max(0, Date.now() - new Date(run.started_at).getTime());
    const result: Record<string, any> = { ...t, duration_ms: duration, outcome: t.passed ? (t.full ? 'full_win' : 'win') : 'lose', node_result: null, xp_awarded: 0, card_drop: false };
    if (run.mode === 'play') {
      const dropsBefore = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_card_drops WHERE user_id = $1 AND flipped_at IS NULL', [user.id]))[0].n);
      const total = t.score + t.bonus;
      if (run.node_id) {
        const { node } = await this.play.accessNode(q, user, run.node_id);
        const res = await this.play.finishNode(q, user, node, { percent: t.percent, stars: t.stars, points: total, passed: t.passed, ref: `sim${run.id}` });
        result.node_result = res;
        result.xp_awarded = res.points_awarded;
      } else if (t.passed) {
        const prev = Number((await q<{ n: string | null }>(`SELECT max(score + bonus) AS n FROM hk_game_runs WHERE user_id = $1 AND scenario_id = $2 AND mode = 'play' AND status = 'done' AND id <> $3`, [user.id, run.scenario_id, run.id]))[0].n ?? 0);
        const delta = Math.max(0, total - prev);
        if (delta > 0) await this.game.awardXp(q, user, delta, 'battle', `battle:${run.scenario_id}:${run.id}`);
        result.xp_awarded = delta;
        await this.game.bumpQuests(q, user, 'battles_completed', 1);
        await this.game.evaluateBadges(q, user);
      }
      const dropsAfter = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_card_drops WHERE user_id = $1 AND flipped_at IS NULL', [user.id]))[0].n);
      result.card_drop = dropsAfter > dropsBefore;
      await logEvent(null, user, 'battle_finish', 'scenario', run.scenario_id, run.node_id, { percent: t.percent, stars: t.stars, passed: t.passed }, duration, q);
    }
    await q(
      `UPDATE hk_game_runs SET status = 'done', finished_at = now(), score = $2, bonus = $3, percent = $4, stars = $5, passed = $6, duration_ms = $7, result = $8 WHERE id = $1`,
      [run.id, t.score, t.bonus, t.percent, t.stars, t.passed, duration, JSON.stringify(result)]);
  }

  // ------------------------------------------------------------------ mini-game (HK.HS.058–060)
  async startMinigame(user: UserRow, id: number, opts: { restart?: boolean; preview?: boolean; assignmentId?: number }) {
    return this.db.tx(async (q) => {
      const row = (await q<Record<string, any>>('SELECT * FROM hk_minigames WHERE id = $1 FOR UPDATE', [id]))[0];
      if (!row || (row.status !== 'published' && user.role !== 'root_admin')) throw notFound('mini-game');
      const preview = Boolean(opts.preview);
      if (!isStudent(user) && !preview) throw new ForbiddenException('Giáo viên và quản trị chỉ chơi thử (chế độ xem trước)');
      if (preview && isStudent(user)) throw new ForbiddenException('Học sinh không dùng chế độ xem trước');
      if (!preview) {
        const active = (await q<RunRow>(`SELECT ${RUN_COLUMNS} FROM hk_game_runs WHERE user_id = $1 AND minigame_id = $2 AND status = 'active' AND mode = 'play' FOR UPDATE`, [user.id, id]))[0];
        if (active && !opts.restart) return this.viewRun(q, await this.expire(q, user, active));
        if (active) await q('DELETE FROM hk_game_runs WHERE id = $1', [active.id]);
        if (opts.assignmentId) {
          const a = (await q<{ max_attempts: number; minigame_id: number | null }>("SELECT max_attempts, minigame_id FROM hk_assignments WHERE id = $1 AND status = 'active'", [opts.assignmentId]))[0];
          if (!a || a.minigame_id !== id) throw notFound('bài tập');
          const used = (await q<{ attempts: number }>('SELECT attempts FROM hk_submissions WHERE assignment_id = $1 AND user_id = $2', [opts.assignmentId, user.id]))[0]?.attempts ?? 0;
          if (used >= a.max_attempts) throw new ConflictException(`Em đã dùng hết ${a.max_attempts} lượt làm bài này`);
        }
      }
      const kind = row.kind as MiniKind;
      const seed = randomInt(1, 2_000_000_000);
      const params = row.params as MatchParams | TimelineParams | CrosswordParams;
      const state: Record<string, any> = { seed };
      if (kind === 'match') {
        const pairs = (params as MatchParams).pairs;
        state.rights = seededShuffle(pairs.map((p, i) => ({ rid: `r${i + 1}`, pair: p.id })), seed + 7);
        state.matched = []; state.wrong = 0;
      }
      const snapshot = { title: row.title, description: row.description, kind, params, points: row.points, seconds: row.seconds };
      const total = kind === 'match' ? (params as MatchParams).pairs.length : kind === 'timeline' ? (params as TimelineParams).items.length : (params as CrosswordParams).words.length;
      const created = (await q<{ id: number }>(
        `INSERT INTO hk_game_runs (user_id, kind, minigame_id, mode, snapshot, state, deadline, max_score, assignment_id) VALUES ($1, $2, $3, $4, $5, $6, now() + ($7 || ' seconds')::interval, $8, $9) RETURNING id::int AS id`,
        [user.id, kind, id, preview ? 'preview' : 'play', JSON.stringify({ ...snapshot, total }), JSON.stringify(state), String(row.seconds), row.points, opts.assignmentId ?? null]))[0];
      if (!preview) await logEvent(null, user, 'minigame_start', 'minigame', id, null, { kind }, null, q);
      return this.viewRun(q, await this.loadRun(q, user, created.id));
    });
  }

  /** Dạng hiển thị của mini-game: không có đáp án */
  private miniPublic(run: RunRow): Record<string, unknown> {
    const kind = run.kind as MiniKind;
    const p = run.snapshot.params as MatchParams | TimelineParams | CrosswordParams;
    if (kind === 'match') {
      const m = p as MatchParams;
      const seed = run.state.seed as number;
      const rights = run.state.rights as Array<{ rid: string; pair: string }>;
      return {
        left_label: m.left_label, right_label: m.right_label,
        lefts: seededShuffle(m.pairs.map((x) => ({ id: x.id, text: x.left })), seed), rights: rights.map((r) => ({ id: r.rid, text: m.pairs.find((x) => x.id === r.pair)!.right })),
        matched: run.state.matched as Array<{ left: string; right: string }>, wrong: run.state.wrong as number, total: m.pairs.length,
      };
    }
    if (kind === 'timeline') {
      const t = p as TimelineParams;
      const sorted = [...t.items].sort((a, b) => a.key - b.key);
      let order = seededShuffle(t.items.map((x) => ({ id: x.id, text: x.text })), run.state.seed as number);
      if (order.every((x, i) => x.id === sorted[i].id)) order = [...order.slice(1), order[0]];
      return { items: order, total: t.items.length };
    }
    const c = p as CrosswordParams;
    return { rows: c.layout.rows, cols: c.layout.cols, words: c.layout.words.map((w) => ({ id: w.id, number: w.number, dir: w.dir, row: w.row, col: w.col, length: w.length, clue: c.words.find((x) => x.id === w.id)!.clue })), total: c.words.length };
  }

  /** Quá giờ (cộng 3 giây ân hạn) thì lượt tự kết thúc với phần đã làm được */
  private async expire(q: Q, user: UserRow, run: RunRow): Promise<RunRow> {
    if (run.status !== 'active' || !run.deadline || Date.now() <= new Date(run.deadline).getTime() + GRACE_MS) return run;
    await this.finishMini(q, user, run, { timedOut: true });
    return this.loadRun(q, user, run.id);
  }

  private async answerMatch(q: Q, user: UserRow, run: RunRow, body: Record<string, any>) {
    const rights = run.state.rights as Array<{ rid: string; pair: string }>;
    const matched = run.state.matched as Array<{ left: string; right: string }>;
    const right = rights.find((r) => r.rid === body.right);
    const pairs = (run.snapshot.params as MatchParams).pairs;
    if (!right || !pairs.some((p) => p.id === body.left)) throw new BadRequestException('Hãy chọn một thẻ ở mỗi bên');
    if (matched.some((m) => m.left === body.left || m.right === body.right)) throw new ConflictException('Thẻ này đã được ghép');
    const correct = right.pair === body.left;
    const state = { ...run.state, matched: correct ? [...matched, { left: body.left, right: body.right }] : matched, wrong: (run.state.wrong as number) + (correct ? 0 : 1) };
    await q('UPDATE hk_game_runs SET state = $2 WHERE id = $1', [run.id, JSON.stringify(state)]);
    const finished = correct && state.matched.length >= pairs.length;
    if (finished) await this.finishMini(q, user, { ...run, state }, {});
    const fresh = await this.loadRun(q, user, run.id);
    return { correct, finished, run: await this.viewRun(q, fresh) };
  }

  /** Ghép thẻ: học sinh bấm "Kết thúc" để nộp phần đã ghép được */
  async finish(user: UserRow, id: number) {
    return this.db.tx(async (q) => {
      const run = await this.loadRun(q, user, id, true);
      if (run.kind !== 'match') throw new BadRequestException('Chỉ ghép thẻ mới kết thúc sớm được');
      if (run.status === 'active') await this.finishMini(q, user, run, {});
      return this.viewRun(q, await this.loadRun(q, user, id));
    });
  }

  private async answerSubmit(q: Q, user: UserRow, run: RunRow, body: Record<string, any>) {
    if (run.kind === 'timeline') {
      const items = (run.snapshot.params as TimelineParams).items;
      const sorted = [...items].sort((a, b) => a.key - b.key).map((x) => x.id);
      const order: unknown = body.order;
      if (!Array.isArray(order) || order.length !== items.length || new Set(order).size !== items.length || !order.every((x) => sorted.includes(String(x)))) throw new BadRequestException('Hãy sắp xếp đủ các sự kiện');
      const correctCount = (order as string[]).filter((x, i) => x === sorted[i]).length;
      const review = sorted.map((sid, i) => ({ ...items.find((x) => x.id === sid)!, position: i + 1, ok: order[i] === sid }));
      await this.finishMini(q, user, run, { units: correctCount, detail: { review, order } });
    } else {
      const words = (run.snapshot.params as CrosswordParams).words;
      const given = body.words as Record<string, string> | undefined;
      if (!given || typeof given !== 'object') throw new BadRequestException('Hãy điền các từ vào ô chữ');
      const review = words.map((w) => ({ id: w.id, answer: w.answer, given: String(given[w.id] ?? ''), ok: crosswordLetters(String(given[w.id] ?? '')) === crosswordLetters(w.answer) }));
      await this.finishMini(q, user, run, { units: review.filter((r) => r.ok).length, detail: { review } });
    }
    return { finished: true, run: await this.viewRun(q, await this.loadRun(q, user, run.id)) };
  }

  private async finishMini(q: Q, user: UserRow, run: RunRow, o: { timedOut?: boolean; units?: number; detail?: unknown }): Promise<void> {
    const points = run.snapshot.points as number;
    const total = run.snapshot.total as number;
    let units = o.units ?? 0, penalty = 0;
    if (run.kind === 'match') {
      units = (run.state.matched as unknown[]).length;
      penalty = Math.round(((run.state.wrong as number) * (points / total)) / 4);
    }
    const t = miniTally(points, units, total, penalty);
    const duration = Math.max(0, Date.now() - new Date(run.started_at).getTime());
    const result: Record<string, any> = { ...t, units, total, wrong: run.kind === 'match' ? run.state.wrong : undefined, timed_out: Boolean(o.timedOut), duration_ms: duration, detail: o.detail ?? null, xp_awarded: 0 };
    if (run.mode === 'play') {
      const prev = Number((await q<{ n: string | null }>(`SELECT max(score) AS n FROM hk_game_runs WHERE user_id = $1 AND minigame_id = $2 AND mode = 'play' AND status = 'done' AND id <> $3`, [user.id, run.minigame_id, run.id]))[0].n ?? 0);
      const delta = Math.max(0, t.score - prev);
      if (delta > 0) await this.game.awardXp(q, user, delta, 'minigame', `mg:${run.minigame_id}:${run.id}`);
      result.xp_awarded = delta;
      // Lượt chơi của bài tập: ghi bài nộp (điểm thưởng bài tập nếu nộp đúng hạn)
      if (run.assignment_id) result.assignment = await recordSubmission(q, this.game, user, run.assignment_id, t.percent);
      await logEvent(null, user, 'minigame_finish', 'minigame', run.minigame_id, null, { kind: run.kind, percent: t.percent }, duration, q);
    }
    await q(
      `UPDATE hk_game_runs SET status = 'done', finished_at = now(), score = $2, percent = $3, stars = $4, passed = $5, timed_out = $6, duration_ms = $7, result = $8 WHERE id = $1`,
      [run.id, t.score, t.percent, t.stars, t.passed, Boolean(o.timedOut), duration, JSON.stringify(result)]);
  }

  // ------------------------------------------------------------------ quản trị kịch bản (HK.AD.046)
  private async scenarioLinks(q: Q, content: Scenario): Promise<void> {
    for (const s of content.steps) await checkLinks(q, s.links as never);
  }

  async adminScenarios() {
    return this.db.query(
      `SELECT s.id, s.title, s.difficulty, s.status, s.battle_id, b.name AS battle_name, b.status AS battle_status, c.title AS campaign_title, s.updated_at,
              jsonb_array_length(s.content->'steps')::int AS steps, (SELECT count(*)::int FROM hk_game_runs r WHERE r.scenario_id = s.id AND r.mode = 'play') AS plays
       FROM hk_scenarios s JOIN hist_battles b ON b.id = s.battle_id LEFT JOIN hist_campaigns c ON c.id = b.campaign_id ORDER BY b.year, b.sort_order, s.id`);
  }

  async adminScenario(id: number) {
    const row = (await this.db.query<Record<string, any>>(
      `SELECT s.id, s.title, s.summary, s.difficulty, s.status, s.battle_id, s.content, s.updated_at, b.name AS battle_name, b.status AS battle_status,
              (SELECT count(*)::int FROM hk_game_runs r WHERE r.scenario_id = s.id AND r.mode = 'play') AS plays
       FROM hk_scenarios s JOIN hist_battles b ON b.id = s.battle_id WHERE s.id = $1`, [id]))[0];
    if (!row) throw notFound('kịch bản');
    return row;
  }

  /** Các trận đánh trong kho lịch sử để chọn khi soạn kịch bản, kèm đã có kịch bản hay chưa */
  async battleOptions() {
    return this.db.query(
      `SELECT b.id, b.name, b.year, b.status, c.title AS campaign_title, s.id AS scenario_id FROM hist_battles b LEFT JOIN hist_campaigns c ON c.id = b.campaign_id LEFT JOIN hk_scenarios s ON s.battle_id = b.id
       ORDER BY b.year, b.sort_order, b.id`);
  }

  validateScenario(content: unknown) {
    const sc = normalizeScenario(content);
    return { ok: true, steps: sc.steps.length, max_score: scenarioMax(sc), step_scores: sc.steps.map((s) => ({ id: s.id, max: stepMax(s) })), has_animation: Boolean(sc.animation) };
  }

  async createScenario(user: UserRow, body: ScenarioInput) {
    if (!body.battle_id) throw new BadRequestException('Hãy chọn trận đánh trong kho lịch sử');
    const content = normalizeScenario(body.content);
    return this.db.tx(async (q) => {
      if (!(await q('SELECT 1 FROM hist_battles WHERE id = $1', [body.battle_id])).length) throw notFound('trận đánh');
      if ((await q('SELECT 1 FROM hk_scenarios WHERE battle_id = $1', [body.battle_id])).length) throw new ConflictException('Trận đánh này đã có kịch bản; hãy sửa kịch bản hiện có');
      await this.scenarioLinks(q, content);
      const title = String(body.title ?? '').trim();
      if (title.length < 2 || title.length > 160) throw new BadRequestException('Tên kịch bản từ 2 đến 160 ký tự');
      const created = (await q<{ id: number }>(
        `INSERT INTO hk_scenarios (battle_id, title, summary, difficulty, content, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
        [body.battle_id, title, body.summary?.trim() || null, [1, 2, 3].includes(Number(body.difficulty)) ? Number(body.difficulty) : 2, JSON.stringify(content), user.id]))[0];
      return this.adminScenarioIn(q, created.id);
    });
  }

  private async adminScenarioIn(q: Q, id: number) {
    return (await q<Record<string, any>>(
      `SELECT s.id, s.title, s.summary, s.difficulty, s.status, s.battle_id, s.content, s.updated_at, b.name AS battle_name, b.status AS battle_status,
              (SELECT count(*)::int FROM hk_game_runs r WHERE r.scenario_id = s.id AND r.mode = 'play') AS plays FROM hk_scenarios s JOIN hist_battles b ON b.id = s.battle_id WHERE s.id = $1`, [id]))[0];
  }

  async updateScenario(user: UserRow, id: number, body: ScenarioInput) {
    return this.db.tx(async (q) => {
      const cur = (await q<Record<string, any>>('SELECT * FROM hk_scenarios WHERE id = $1 FOR UPDATE', [id]))[0];
      if (!cur) throw notFound('kịch bản');
      let content = cur.content;
      if (body.content !== undefined) { content = normalizeScenario(body.content); await this.scenarioLinks(q, content); }
      const title = body.title === undefined ? cur.title : String(body.title).trim();
      if (title.length < 2 || title.length > 160) throw new BadRequestException('Tên kịch bản từ 2 đến 160 ký tự');
      await q(
        'UPDATE hk_scenarios SET title = $2, summary = $3, difficulty = $4, content = $5, updated_by = $6, updated_at = now() WHERE id = $1',
        [id, title, body.summary === undefined ? cur.summary : body.summary?.trim() || null, body.difficulty === undefined ? cur.difficulty : [1, 2, 3].includes(Number(body.difficulty)) ? Number(body.difficulty) : cur.difficulty, JSON.stringify(content), user.id]);
      return this.adminScenarioIn(q, id);
    });
  }

  async setScenarioStatus(id: number, status: string) {
    if (status !== 'draft' && status !== 'published') throw new BadRequestException('Trạng thái là draft hoặc published');
    return this.db.tx(async (q) => {
      const row = (await q<Record<string, any>>('SELECT s.id, b.status AS battle_status FROM hk_scenarios s JOIN hist_battles b ON b.id = s.battle_id WHERE s.id = $1 FOR UPDATE OF s', [id]))[0];
      if (!row) throw notFound('kịch bản');
      if (status === 'published' && row.battle_status !== 'published') throw new ConflictException('Hãy công bố hồ sơ trận đánh trong kho lịch sử trước khi phát hành kịch bản');
      await q("UPDATE hk_scenarios SET status = $2, published_at = CASE WHEN $2 = 'published' THEN now() END, updated_at = now() WHERE id = $1", [id, status]);
      return this.adminScenarioIn(q, id);
    });
  }

  async deleteScenario(id: number) {
    await this.db.tx(async (q) => {
      if (!(await q('SELECT 1 FROM hk_scenarios WHERE id = $1 FOR UPDATE', [id])).length) throw notFound('kịch bản');
      const plays = Number((await q<{ n: string }>("SELECT count(*) AS n FROM hk_game_runs WHERE scenario_id = $1 AND mode = 'play'", [id]))[0].n);
      if (plays) throw new ConflictException(`Đã có ${plays} lượt chơi; hãy chuyển kịch bản về Nháp thay vì xóa`);
      await q('DELETE FROM hk_scenarios WHERE id = $1', [id]);
    });
  }

  // ------------------------------------------------------------------ quản trị mini-game (HK.AD.047)
  async adminMinigames() {
    return this.db.query(
      `SELECT m.id, m.kind, m.title, m.description, m.status, m.seconds, m.points, m.campaign_id, c.title AS campaign_title, m.updated_at,
              (SELECT count(*)::int FROM hk_game_runs r WHERE r.minigame_id = m.id AND r.mode = 'play') AS plays
       FROM hk_minigames m LEFT JOIN hist_campaigns c ON c.id = m.campaign_id ORDER BY m.kind, m.id`);
  }

  async adminMinigame(id: number) {
    const row = (await this.db.query<Record<string, any>>('SELECT * FROM hk_minigames WHERE id = $1', [id]))[0];
    if (!row) throw notFound('mini-game');
    return row;
  }

  private async minigameBody(q: Q, body: MinigameInput, cur?: Record<string, any>) {
    const kind = (cur?.kind ?? body.kind) as MiniKind;
    if (!['match', 'timeline', 'crossword'].includes(kind)) throw new BadRequestException('Dạng mini-game là match, timeline hoặc crossword');
    if (cur && body.kind && body.kind !== cur.kind) throw new BadRequestException('Không đổi dạng của mini-game đã tạo');
    const title = String(body.title ?? cur?.title ?? '').trim();
    if (title.length < 2 || title.length > 160) throw new BadRequestException('Tên mini-game từ 2 đến 160 ký tự');
    const seconds = body.seconds === undefined ? cur?.seconds ?? 120 : Number(body.seconds);
    const points = body.points === undefined ? cur?.points ?? 100 : Number(body.points);
    if (!Number.isInteger(seconds) || seconds < 10 || seconds > 1800) throw new BadRequestException('Thời gian từ 10 đến 1800 giây');
    if (!Number.isInteger(points) || points < 0 || points > 1000) throw new BadRequestException('Điểm từ 0 đến 1000');
    const params = body.params === undefined ? cur?.params : normalizeMinigame(kind, body.params);
    if (!params) throw new BadRequestException('Thiếu tham số mini-game (params)');
    const campaign = body.campaign_id === undefined ? cur?.campaign_id ?? null : body.campaign_id;
    const lesson = body.lesson_id === undefined ? cur?.lesson_id ?? null : body.lesson_id;
    if (campaign && !(await q('SELECT 1 FROM hist_campaigns WHERE id = $1', [campaign])).length) throw notFound('cuộc kháng chiến');
    if (lesson && !(await q('SELECT 1 FROM hk_lessons WHERE id = $1', [lesson])).length) throw notFound('bài học');
    return { kind, title, description: body.description === undefined ? cur?.description ?? null : body.description?.trim() || null, campaign, lesson, params, seconds, points };
  }

  async createMinigame(user: UserRow, body: MinigameInput) {
    return this.db.tx(async (q) => {
      const m = await this.minigameBody(q, body);
      const id = (await q<{ id: number }>(
        `INSERT INTO hk_minigames (kind, title, description, campaign_id, lesson_id, params, seconds, points, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) RETURNING id`,
        [m.kind, m.title, m.description, m.campaign, m.lesson, JSON.stringify(m.params), m.seconds, m.points, user.id]))[0].id;
      return (await q('SELECT * FROM hk_minigames WHERE id = $1', [id]))[0];
    });
  }

  async updateMinigame(user: UserRow, id: number, body: MinigameInput) {
    return this.db.tx(async (q) => {
      const cur = (await q<Record<string, any>>('SELECT * FROM hk_minigames WHERE id = $1 FOR UPDATE', [id]))[0];
      if (!cur) throw notFound('mini-game');
      const m = await this.minigameBody(q, body, cur);
      await q('UPDATE hk_minigames SET title = $2, description = $3, campaign_id = $4, lesson_id = $5, params = $6, seconds = $7, points = $8, updated_by = $9, updated_at = now() WHERE id = $1',
        [id, m.title, m.description, m.campaign, m.lesson, JSON.stringify(m.params), m.seconds, m.points, user.id]);
      return (await q('SELECT * FROM hk_minigames WHERE id = $1', [id]))[0];
    });
  }

  async setMinigameStatus(id: number, status: string) {
    if (status !== 'draft' && status !== 'published') throw new BadRequestException('Trạng thái là draft hoặc published');
    const rows = await this.db.query("UPDATE hk_minigames SET status = $2, published_at = CASE WHEN $2 = 'published' THEN now() END, updated_at = now() WHERE id = $1 RETURNING *", [id, status]);
    if (!rows.length) throw notFound('mini-game');
    return rows[0];
  }

  async deleteMinigame(id: number) {
    await this.db.tx(async (q) => {
      if (!(await q('SELECT 1 FROM hk_minigames WHERE id = $1 FOR UPDATE', [id])).length) throw notFound('mini-game');
      const plays = Number((await q<{ n: string }>("SELECT count(*) AS n FROM hk_game_runs WHERE minigame_id = $1 AND mode = 'play'", [id]))[0].n);
      if (plays) throw new ConflictException(`Đã có ${plays} lượt chơi; hãy chuyển mini-game về Nháp thay vì xóa`);
      await q('DELETE FROM hk_minigames WHERE id = $1', [id]);
    });
  }

  /** Kiểm tra tham số mini-game mà không lưu (nút "Kiểm tra" trong trình soạn); với ô chữ trả về bố cục */
  validateMinigame(kind: MiniKind, params: unknown) {
    const p = normalizeMinigame(kind, params);
    return { ok: true, layout: (p as CrosswordParams).layout ?? null };
  }
}
