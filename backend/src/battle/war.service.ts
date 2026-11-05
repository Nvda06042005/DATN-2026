/**
 * Game mô phỏng trận đánh bằng thẻ tướng (HK.HS.051–053, 056, 131–138; HK.AD.084–086; HK.QT.056; HK.SYS.022):
 *  - danh sách màn chơi, bối cảnh và mục tiêu, chỉ huy đối phương, gợi ý thẻ tướng từng tham gia trận trong lịch sử ("Hào khí" +10% chỉ số);
 *  - mỗi lượt do MÁY CHỦ xử lý bằng động cơ có hạt giống (war-engine): trình duyệt chỉ gửi hành động; tuyệt kỹ cần trả lời một câu hỏi trong 15 giây (máy chủ đo thời gian);
 *  - phần thưởng lần thắng đầu (vàng, Binh thư, điểm, mảnh thẻ / thẻ) và thưởng cải thiện sao đều qua sổ cái có khóa duy nhất nên không nhận trùng;
 *  - bỏ qua (quét) chỉ cho màn đã đạt 3 sao; "Sự thật lịch sử" sau trận; quản trị màn chơi, chỉ huy, tài nguyên, cân bằng chỉ số; giờ chơi theo `WarGate`.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { notFound } from '../content/access';
import { GRACE_MS, grade, publicView as questionView, QuestionCore, QType } from '../content/questions';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { dayKey, GameClock } from '../game/clock';
import { GameService } from '../game/game.service';
import { lockedSources, activeJourneys, nodesWithState } from '../student/progress';
import { advance, Action, AllyInput, autoPlay, BattleState, cardStats, createBattle, decisionModifier, EnemyDef, MoveDef, publicView, ReplayFrame, replayFrame, resolveUltimate, starsOf, TacticDef, TerrainDef, WaveDef } from './war-engine';
import { WarGate } from './war-gate';
import { WarClassService } from './war-class.service';
import { cleanSandtable } from './sandtable';

const QUESTION_SECONDS = 15;
const DEFAULT_MOVES: MoveDef[] = [
  { slot: 'normal', name: 'Tấn công', target: 'enemy_one', power: 1, rage_cost: 0, cooldown: 0 },
  { slot: 'active', name: 'Xung phong', target: 'enemy_one', power: 1.7, rage_cost: 40, cooldown: 2 },
  { slot: 'ultimate', name: 'Tuyệt kỹ', target: 'enemy_all', power: 1.3, rage_cost: 100, cooldown: 0 },
];
const BRANCHES = ['bo', 'thuy', 'ky'];
const ACTION_LABEL: Record<string, string> = { normal: 'Đòn thường', active: 'Chiêu chủ động', ultimate: 'Tuyệt kỹ', guard: 'Phòng thủ', tactic: 'Thẻ chiến thuật', auto: 'Tự động đánh', auto_run: 'Tự động đánh' };
/** Kết quả quyết sách còn hiệu lực trong bao lâu (HK.HS.053) */
const DECISION_HOURS = 12;

interface StageRow {
  id: number; battle_id: number; title: string; summary: string | null; objective: string | null; background_url: string | null; difficulty: number; max_turns: number; star_turns: number;
  terrain: TerrainDef; waves: WaveDef[]; rewards: Record<string, any>; commander_id: number | null; quiz_id: number | null; differences: string[]; status: string; sandtable: Record<string, unknown> | null;
}
interface RunState { engine: BattleState; question: null | { qid: number; served_at: number; seconds: number; qtype: QType; data: Record<string, unknown>; explanation: string | null; prompt: string; image_url: string | null; difficulty: number }; row: { front: string[]; back: string[] }; opts?: { difficulty: number; skill_questions: boolean };
  /** Lợi thế từ bước quyết sách trước trận (HK.HS.053): lượt chơi kịch bản đã dùng và hệ số công / thủ */
  advantage?: { run_id: number; percent: number; mod: number };
  /** Nhật ký phát lại trận (HK.SYS.022) */
  replay?: ReplayFrame[];
  /** Số dòng nhật ký đã nằm trong các khung phát lại: khung mới chứa phần còn lại nên không dòng nào bị bỏ sót */
  replayMark?: number;
}
interface RunRow { id: number; user_id: number; stage_id: number; mode: 'play' | 'preview'; status: 'active' | 'won' | 'lost'; seed: number; formation: Record<string, any>; state: RunState; turns: number; stars: number; result: Record<string, any> | null; last_action_at: string }
interface CardWar { id: number; code: string; name: string; branch: 'bo' | 'thuy' | 'ky' | null; kind: string; base_stats: Record<string, number>; figure_id: number | null; level: number; stars: number; tactic: Record<string, any> | null }

const STAGE_COLUMNS = 'id, battle_id, title, summary, objective, background_url, difficulty, max_turns, star_turns, terrain, waves, rewards, commander_id, quiz_id, differences, status, sandtable';
/** Hệ số sức mạnh quân địch theo độ khó (HK.GV.083): độ khó giáo viên chọn so với độ khó gốc của màn */
const DIFFICULTY_POWER: Record<number, number> = { 1: 0.8, 2: 1, 3: 1.25 };

@Injectable()
export class WarService {
  constructor(private readonly db: DatabaseService, private readonly game: GameService, private readonly gate: WarGate, private readonly clock: GameClock, private readonly classes: WarClassService) {}

  private async battleStates(q: Q, user: UserRow): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    for (const j of await activeJourneys(q, user.id)) for (const n of await nodesWithState(q, user.id, j.journey_id)) if (n.battle_id) out.set(n.battle_id, n.state);
    return out;
  }

  // ---------------------------------------------------------------------- danh sách và giới thiệu màn chơi (HK.HS.051–052)
  async stages(user: UserRow) {
    return this.db.tx(async (q) => {
      const rows = await q<Record<string, any>>(
        `SELECT s.id, s.title, s.difficulty, s.max_turns, b.id AS battle_id, b.name AS battle_name, b.year, b.date_text, c.id AS campaign_id, c.title AS campaign_title, c.year_label,
                sp.best_stars, sp.clears, sp.attempts, (k.id IS NOT NULL AND ks.user_id IS NOT NULL) AS commander_known, CASE WHEN ks.user_id IS NOT NULL THEN k.name END AS commander_name
         FROM hk_stages s JOIN hist_battles b ON b.id = s.battle_id AND b.status = 'published' LEFT JOIN hist_campaigns c ON c.id = b.campaign_id
         LEFT JOIN hk_stage_progress sp ON sp.stage_id = s.id AND sp.user_id = $1 LEFT JOIN hk_commanders k ON k.id = s.commander_id AND k.status = 'published'
         LEFT JOIN hk_commanders_seen ks ON ks.commander_id = k.id AND ks.user_id = $1 WHERE s.status = 'published' ORDER BY c.sort_order NULLS LAST, b.year, s.id`, [user.id]);
      const states = await this.battleStates(q, user);
      const links = user.role === 'student' ? await this.classes.linksFor(q, user.id) : new Map();
      return {
        war: await this.gate.status(q, user),
        stages: rows.map((r) => {
          const link = links.get(r.id);
          const journeyLocked = states.get(r.battle_id) === 'locked', classLock = this.classes.lockReason(link);
          return { ...r, difficulty: link?.difficulty ?? r.difficulty, best_stars: r.best_stars ?? 0, clears: r.clears ?? 0, locked: journeyLocked || Boolean(classLock), locked_reason: journeyLocked ? 'Hãy học xong cửa dẫn tới trận này để ra trận.' : classLock };
        }),
      };
    });
  }

  private async stage(q: Q, id: number, published = true): Promise<StageRow> {
    const s = (await q<StageRow>(`SELECT ${STAGE_COLUMNS} FROM hk_stages WHERE id = $1`, [id]))[0];
    if (!s || (published && s.status !== 'published')) throw notFound('màn chơi');
    return s;
  }

  /** Bối cảnh, mục tiêu, chỉ huy đối phương và gợi ý thẻ tướng từng tham gia trận trong lịch sử (HK.HS.052) */
  async intro(user: UserRow, id: number) {
    return this.db.tx(async (q) => {
      const s = await this.stage(q, id);
      const battle = (await q<Record<string, any>>("SELECT id, name, year, date_text, context, forces FROM hist_battles WHERE id = $1 AND status = 'published'", [s.battle_id]))[0];
      if (!battle) throw notFound('màn chơi');
      const commander = s.commander_id ? (await q<Record<string, any>>("SELECT id, name, role_text, forces, tactics FROM hk_commanders WHERE id = $1 AND status = 'published'", [s.commander_id]))[0] ?? null : null;
      const seen = commander ? Boolean((await q('SELECT 1 FROM hk_commanders_seen WHERE user_id = $1 AND commander_id = $2', [user.id, commander.id])).length) : false;
      const figures = await q<{ id: number; name: string; honorific: string | null }>(
        "SELECT f.id, f.name, f.honorific FROM hist_figures f WHERE f.status = 'published' AND f.id IN (SELECT b_id FROM hist_links WHERE a_type = 'battle' AND a_id = $1 AND b_type = 'figure') ORDER BY f.name", [s.battle_id]);
      const suggested = await q<{ id: number; name: string; rarity: string; owned: boolean; figure_id: number }>(
        `SELECT c.id, c.name, c.rarity, (uc.user_id IS NOT NULL) AS owned, c.figure_id FROM hk_cards c LEFT JOIN hk_user_cards uc ON uc.card_id = c.id AND uc.user_id = $1
         WHERE c.is_active AND c.kind = 'general' AND c.figure_id = ANY($2) ORDER BY c.name`, [user.id, figures.map((f) => f.id)]);
      const progress = (await q<{ best_stars: number; clears: number }>('SELECT best_stars, clears FROM hk_stage_progress WHERE user_id = $1 AND stage_id = $2', [user.id, id]))[0] ?? { best_stars: 0, clears: 0 };
      const link = user.role === 'student' ? (await this.classes.linksFor(q, user.id, [id])).get(id) : undefined;
      const terrainNotes: string[] = [];
      if (s.terrain.tide) terrainNotes.push('Nước triều lên xuống theo từng vòng.');
      if (s.terrain.stakes) terrainNotes.push('Khi nước rút, bãi cọc ngầm làm thuyền địch va vỡ.');
      if (s.terrain.water_bonus) terrainNotes.push('Thủy binh chiến đấu mạnh hơn trên sông nước.');
      if (s.terrain.hunger) terrainNotes.push('Kế "vườn không nhà trống": quân địch thiếu lương, mất dần sinh lực mỗi vòng.');
      return {
        id: s.id, title: s.title, summary: s.summary, objective: s.objective, background_url: s.background_url, difficulty: link?.difficulty ?? s.difficulty, max_turns: s.max_turns, star_turns: s.star_turns, has_sandtable: Boolean(s.sandtable),
        class_link: link ? { gate_title: link.gate_title, gate_done: link.gate_done, skill_questions: link.skill_questions, lock_reason: this.classes.lockReason(link) } : null,
        battle: { id: battle.id, name: battle.name, year: battle.year, date_text: battle.date_text, context: battle.context, forces: battle.forces },
        enemies: s.waves.map((w) => ({ label: w.label ?? null, units: w.units.map((u) => ({ name: u.name, commander: Boolean(u.commander), branch: u.branch ?? null })) })),
        commander: commander ? (seen ? commander : { id: commander.id, name: commander.name, role_text: commander.role_text }) : null, terrain_notes: terrainNotes,
        historical_figures: figures, suggested_cards: suggested, progress, rewards: { gold: s.rewards.gold ?? 0, binh_thu: s.rewards.binh_thu ?? 0, xp: s.rewards.xp ?? 100 * s.difficulty, card: Boolean(s.rewards.card_code), fragments: (s.rewards.fragments ?? []).length },
        stars: ['Thắng trận', 'Không có tướng nào ngã xuống', `Thắng trong ${s.star_turns} vòng`], war: await this.gate.status(q, user),
        decision: user.role === 'student' ? await this.decisionOf(q, user.id, s.battle_id) : null,
        recent: user.role === 'student' ? await q("SELECT id::int AS id, status, stars, finished_at FROM hk_war_battles WHERE user_id = $1 AND stage_id = $2 AND mode = 'play' AND status <> 'active' AND state->'replay' IS NOT NULL ORDER BY id DESC LIMIT 3", [user.id, id]) : [],
      };
    });
  }

  // ---------------------------------------------------------------------- dựng trận (HK.SYS.022)
  private async loadCards(q: Q, userId: number, ids: number[], preview: boolean): Promise<CardWar[]> {
    const rows = await q<CardWar>(
      `SELECT c.id, c.code, c.name, c.branch, c.kind, c.base_stats, c.figure_id, c.tactic, ${preview ? '5' : 'COALESCE(uc.level, 1)'}::int AS level, ${preview ? '3' : 'COALESCE(uc.stars, 1)'}::int AS stars
       FROM hk_cards c LEFT JOIN hk_user_cards uc ON uc.card_id = c.id AND uc.user_id = $1 WHERE c.id = ANY($2) ${preview ? '' : 'AND uc.user_id IS NOT NULL'}`, [userId, ids]);
    return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is CardWar => Boolean(r));
  }

  private async buildAllies(q: Q, cards: CardWar[], battleId: number): Promise<AllyInput[]> {
    const haoKhi = new Set((await q<{ b_id: number }>("SELECT b_id FROM hist_links WHERE a_type = 'battle' AND a_id = $1 AND b_type = 'figure'", [battleId])).map((r) => r.b_id));
    const out: AllyInput[] = [];
    for (const c of cards) {
      const moves = await q<MoveDef>('SELECT slot, name, description, anecdote, target, power::float8 AS power, effect, rage_cost, cooldown, anim FROM hk_card_moves WHERE card_id = $1', [c.id]);
      const set = new Map<string, MoveDef>(DEFAULT_MOVES.map((m) => [m.slot, m]));
      for (const m of moves) set.set(m.slot, m);
      out.push({ id: `a${c.id}`, name: c.name, card_id: c.id, code: c.code, branch: c.branch, level: c.level, stars: c.stars, stats: cardStats(c.base_stats, c.level, c.stars), moves: [...set.values()], haoKhi: Boolean(c.figure_id && haoKhi.has(c.figure_id)) });
    }
    return out;
  }

  private tacticOf(card: CardWar | undefined): TacticDef | null {
    if (!card?.tactic) return null;
    return { name: card.name, effect: card.tactic.effect, value: card.tactic.value, turns: card.tactic.turns, text: card.tactic.text ?? undefined };
  }

  private async runOf(q: Q, user: UserRow, id: number, lock = true): Promise<RunRow> {
    const r = (await q<RunRow>(`SELECT id::int AS id, user_id, stage_id, mode, status, seed, formation, state, turns, stars, result, last_action_at FROM hk_war_battles WHERE id = $1 AND user_id = $2${lock ? ' FOR UPDATE' : ''}`, [id, user.id]))[0];
    if (!r) throw notFound('trận đánh');
    return r;
  }

  /** Vào trận (HK.HS.131): đội hình đã lưu hoặc chọn trực tiếp; trận đang dở thì chơi tiếp */
  async start(user: UserRow, stageId: number, body: { slot?: number; front?: number[]; back?: number[]; tactic_card_id?: number | null; restart?: boolean; use_decision?: boolean }) {
    return this.db.tx(async (q) => {
      await this.gate.assertOpen(q, user);
      const s = await this.stage(q, stageId);
      if ((await this.battleStates(q, user)).get(s.battle_id) === 'locked') throw new ConflictException('Hãy học xong cửa dẫn tới trận này để ra trận.');
      const link = (await this.classes.linksFor(q, user.id, [stageId])).get(stageId);
      const classLock = this.classes.lockReason(link);
      if (classLock) throw new ConflictException(classLock);
      const open = (await q<{ id: number }>("SELECT id::int AS id FROM hk_war_battles WHERE user_id = $1 AND stage_id = $2 AND status = 'active'", [user.id, stageId]))[0];
      if (open && !body.restart) return this.view(q, await this.runOf(q, user, open.id));
      if (open) await q('DELETE FROM hk_war_battles WHERE id = $1', [open.id]);
      let advantage: { run_id: number; percent: number } | undefined;
      if (body.use_decision) {
        const ready = await this.readyDecision(q, user.id, s.battle_id);
        if (!ready) throw new ConflictException('Em chưa có kết quả quyết sách nào còn hiệu lực cho trận này. Hãy làm quyết sách trước trận (hiệu lực 12 giờ, dùng một lần).');
        advantage = { run_id: ready.id, percent: ready.percent };
      }
      let front = body.front ?? [], back = body.back ?? [], tacticId = body.tactic_card_id ?? null;
      if (body.slot) {
        const f = (await q<{ front: number[]; back: number[]; tactic_card_id: number | null }>('SELECT front, back, tactic_card_id FROM hk_formations WHERE user_id = $1 AND slot = $2', [user.id, body.slot]))[0];
        if (!f) throw new BadRequestException('Đội hình này chưa có thẻ nào');
        front = f.front; back = f.back; tacticId = f.tactic_card_id;
      }
      const ids = [...front, ...back];
      if (!ids.length || ids.length > 5 || new Set(ids).size !== ids.length) throw new BadRequestException('Hãy chọn từ 1 đến 5 thẻ tướng khác nhau');
      const cards = await this.loadCards(q, user.id, ids, false);
      if (cards.length !== ids.length || cards.some((c) => c.kind !== 'general')) throw new BadRequestException('Đội hình có thẻ em chưa sở hữu hoặc không phải thẻ tướng');
      let tactic: TacticDef | null = null;
      if (tacticId) {
        const t = (await this.loadCards(q, user.id, [tacticId], false))[0];
        if (!t || t.kind !== 'tactic') throw new BadRequestException('Thẻ chiến thuật phải là thẻ em đã có');
        tactic = this.tacticOf(t);
      }
      return this.create(q, user, s, 'play', cards, { front, back }, tactic, link ? { difficulty: link.difficulty ?? s.difficulty, skill_questions: link.skill_questions } : undefined, advantage);
    });
  }

  /** Giáo viên / quản trị chơi thử (không ghi tiến độ, điểm hay thưởng): dùng năm thẻ tướng đầu tiên ở cấp 5, 3 sao */
  async preview(user: UserRow, stageId: number) {
    return this.db.tx(async (q) => {
      const s = await this.stage(q, stageId, false);
      await q("DELETE FROM hk_war_battles WHERE user_id = $1 AND stage_id = $2 AND status = 'active'", [user.id, stageId]);
      const ids = (await q<{ id: number }>("SELECT id FROM hk_cards WHERE kind = 'general' AND is_active ORDER BY id LIMIT 5")).map((r) => r.id);
      if (!ids.length) throw new ConflictException('Chưa có thẻ tướng nào để chơi thử');
      return this.create(q, user, s, 'preview', await this.loadCards(q, user.id, ids, true), { front: ids.slice(0, 2), back: ids.slice(2) }, null);
    });
  }

  /** Tăng / giảm máu và sức đánh của quân địch khi giáo viên đổi độ khó của trận cho lớp (HK.GV.083) */
  private scaleWaves(waves: WaveDef[], from: number, to: number): WaveDef[] {
    const factor = (DIFFICULTY_POWER[to] ?? 1) / (DIFFICULTY_POWER[from] ?? 1);
    if (factor === 1) return waves;
    return waves.map((w) => ({ ...w, units: w.units.map((u) => ({ ...u, hp: Math.max(50, Math.round(u.hp * factor)), atk: Math.max(1, Math.round(u.atk * factor)) })) }));
  }

  private async create(q: Q, user: UserRow, s: StageRow, mode: 'play' | 'preview', cards: CardWar[], formation: { front: number[]; back: number[] }, tactic: TacticDef | null, opts?: { difficulty: number; skill_questions: boolean }, advantage?: { run_id: number; percent: number }) {
    const seed = Math.floor(Math.random() * 2 ** 31);
    const waves = opts ? this.scaleWaves(s.waves, s.difficulty, opts.difficulty) : s.waves;
    const mod = advantage ? decisionModifier(advantage.percent) : 0;
    const allies = (await this.buildAllies(q, cards, s.battle_id)).map((a) => (mod ? { ...a, stats: { ...a.stats, atk: Math.round(a.stats.atk * (1 + mod)), def: Math.round(a.stats.def * (1 + mod)) } } : a));
    const engine = createBattle({ allies, waves, terrain: s.terrain, maxTurns: s.max_turns, starTurns: s.star_turns, tactic, seed });
    advance(engine, null);
    const state: RunState = { engine, question: null, row: { front: formation.front.map((id) => `a${id}`), back: formation.back.map((id) => `a${id}`) }, ...(opts ? { opts } : {}), ...(advantage ? { advantage: { ...advantage, mod } } : {}), replay: [replayFrame(engine, 0, 'Bắt đầu trận', 0)], replayMark: engine.logN ?? 0 };
    const id = (await q<{ id: number }>(
      'INSERT INTO hk_war_battles (user_id, stage_id, mode, seed, formation, state, turns) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id::int AS id',
      [user.id, s.id, mode, seed, JSON.stringify({ ...formation, tactic: tactic?.name ?? null }), JSON.stringify(state), engine.turn]))[0].id;
    if (mode === 'play') {
      await q('INSERT INTO hk_stage_progress (user_id, stage_id, attempts) VALUES ($1, $2, 1) ON CONFLICT (user_id, stage_id) DO UPDATE SET attempts = hk_stage_progress.attempts + 1', [user.id, s.id]);
      // Chạm trán chỉ huy đối phương thì hồ sơ trong sổ tay được mở
      if (s.commander_id) await q("INSERT INTO hk_commanders_seen (user_id, commander_id) SELECT $1, id FROM hk_commanders WHERE id = $2 AND status = 'published' ON CONFLICT DO NOTHING", [user.id, s.commander_id]);
    }
    return this.view(q, await this.runOf(q, user, id));
  }

  // ---------------------------------------------------------------------- xem và điều khiển trận
  private async view(q: Q, r: RunRow) {
    const s = await this.stage(q, r.stage_id, false);
    const e = r.state.engine;
    const qs = r.state.question;
    return {
      id: r.id, mode: r.mode, status: r.status, stage: { id: s.id, title: s.title, background_url: s.background_url, battle_id: s.battle_id }, formation: r.state.row,
      ...publicView(e), result: r.result, stars_now: starsOf(e), advantage: r.state.advantage ? { percent: r.state.advantage.percent, modifier_pct: Math.round(r.state.advantage.mod * 100) } : null,
      question: qs ? { view: questionView({ id: qs.qid, qtype: qs.qtype, prompt: qs.prompt, image_url: qs.image_url, explanation: null, difficulty: qs.difficulty, data: qs.data } as QuestionCore, r.id * 17 + qs.qid, true), seconds: qs.seconds, remaining_ms: Math.max(0, qs.seconds * 1000 - (Date.now() - qs.served_at)) } : null,
    };
  }

  async battle(user: UserRow, id: number) {
    return this.db.tx(async (q) => this.view(q, await this.runOf(q, user, id, false)));
  }

  /** Ghi một khung phát lại (HK.SYS.022); tối đa 250 khung mỗi trận */
  private record(r: RunRow, label: string, onlyIfNew = false): void {
    const e = r.state.engine, mark = r.state.replayMark ?? 0;
    if (onlyIfNew && (e.logN ?? 0) <= mark) return;
    const frames = (r.state.replay ??= []);
    if (frames.length < 250) frames.push(replayFrame(e, frames.length, label, mark));
    r.state.replayMark = e.logN ?? 0;
  }

  /** Phát lại trận đã kết thúc của chính mình (HK.SYS.022): trạng thái từng bước và nhật ký diễn biến, không lộ thêm điều gì ngoài những gì em đã thấy khi chơi */
  async replay(user: UserRow, id: number) {
    return this.db.tx(async (q) => {
      const r = await this.runOf(q, user, id, false);
      if (r.status === 'active') throw new ConflictException('Hãy đánh xong trận rồi mới xem lại');
      const s = await this.stage(q, r.stage_id, false);
      const frames = r.state.replay ?? [];
      return {
        id: r.id, mode: r.mode, status: r.status, stage: { id: s.id, title: s.title, battle_id: s.battle_id }, result: r.result, formation: r.state.row,
        advantage: r.state.advantage ? { percent: r.state.advantage.percent, modifier_pct: Math.round(r.state.advantage.mod * 100) } : null, frames,
        note: frames.length ? null : 'Trận này diễn ra trước khi hệ thống ghi nhật ký phát lại.',
      };
    });
  }

  /** Kết quả quyết sách (kịch bản ver0.1 của cùng trận) còn hiệu lực và chưa dùng cho trận nào (HK.HS.053) */
  private async readyDecision(q: Q, userId: number, battleId: number): Promise<{ id: number; percent: number } | null> {
    return (await q<{ id: number; percent: number }>(
      `SELECT r.id::int AS id, r.percent::int AS percent FROM hk_game_runs r JOIN hk_scenarios sc ON sc.id = r.scenario_id
       WHERE r.user_id = $1 AND r.kind = 'battle' AND r.mode = 'play' AND r.status = 'done' AND sc.battle_id = $2 AND sc.status = 'published' AND r.finished_at > now() - ($3 || ' hours')::interval
         AND NOT EXISTS (SELECT 1 FROM hk_war_battles w WHERE w.user_id = r.user_id AND (w.state->'advantage'->>'run_id')::bigint = r.id)
       ORDER BY r.finished_at DESC LIMIT 1`, [userId, battleId, String(DECISION_HOURS)]))[0] ?? null;
  }

  private async decisionOf(q: Q, userId: number, battleId: number) {
    const sc = (await q<{ id: number; title: string }>("SELECT id, title FROM hk_scenarios WHERE battle_id = $1 AND status = 'published' ORDER BY id LIMIT 1", [battleId]))[0];
    if (!sc) return null;
    const ready = await this.readyDecision(q, userId, battleId);
    return { scenario_id: sc.id, title: sc.title, hours: DECISION_HOURS, ready: ready ? { run_id: ready.id, percent: ready.percent, modifier_pct: Math.round(decisionModifier(ready.percent) * 100) } : null };
  }

  /** Chọn câu hỏi cho tuyệt kỹ từ bộ câu hỏi của màn; không có bộ câu hỏi thì tuyệt kỹ phát huy đủ */
  private async prepareQuestion(q: Q, s: StageRow, r: RunRow): Promise<void> {
    const e = r.state.engine;
    const rows = s.quiz_id && r.state.opts?.skill_questions !== false ? await q<QuestionCore & { explanation: string | null }>(
      "SELECT t.id, t.qtype, t.prompt, t.image_url, t.explanation, t.difficulty, t.data FROM hk_quiz_questions k JOIN hk_questions t ON t.id = k.question_id WHERE k.quiz_id = $1 AND t.qtype <> 'poll' ORDER BY k.position, t.id", [s.quiz_id]) : [];
    if (!rows.length) { resolveUltimate(e, { correct: true, inTime: true }); advance(e, null); return; }
    const pick = rows[(r.seed + e.turn * 7 + e.stats.ultimates * 3) % rows.length];
    r.state.question = { qid: pick.id, served_at: Date.now(), seconds: QUESTION_SECONDS, qtype: pick.qtype, data: pick.data, explanation: pick.explanation, prompt: pick.prompt, image_url: pick.image_url, difficulty: pick.difficulty };
  }

  private async save(q: Q, user: UserRow, s: StageRow, r: RunRow): Promise<void> {
    const e = r.state.engine;
    await this.gate.addPlay(q, user, Date.now() - new Date(r.last_action_at).getTime());
    const done = e.status !== 'active';
    await q('UPDATE hk_war_battles SET state = $2, turns = $3, status = $4, last_action_at = now() WHERE id = $1', [r.id, JSON.stringify(r.state), Math.min(e.turn, e.maxTurns), done ? e.status : 'active']);
    if (done) { r.status = e.status; await this.finish(q, user, s, r); }
  }

  /** Hành động của người chơi (HK.HS.131–133, 136): đòn, chiêu, phòng thủ, thẻ chiến thuật, tự động đánh */
  async act(user: UserRow, id: number, body: { type: string; slot?: string; target?: string; steps?: number }) {
    return this.db.tx(async (q) => {
      await this.gate.assertOpen(q, user);
      const r = await this.runOf(q, user, id);
      if (r.status !== 'active') throw new ConflictException('Trận đánh đã kết thúc');
      if (r.state.question) throw new ConflictException('Hãy trả lời câu hỏi tuyệt kỹ trước');
      const s = await this.stage(q, r.stage_id, false);
      const e = r.state.engine;
      const who = e.actor ? e.units[e.actor]?.name : null;
      if (body.type === 'auto_run') {
        // tự động đánh: máy chọn đòn; dừng khi tuyệt kỹ cần câu hỏi, hết trận hoặc đủ số bước
        for (let i = 0; i < Math.min(60, Math.max(1, Number(body.steps ?? 20))) && e.status === 'active' && !e.pending; i += 1) {
          const actor = e.actor ? e.units[e.actor]?.name : null;
          if (e.tactic && !e.tacticUsed) advance(e, { type: 'tactic' });
          if (!advance(e, { type: 'auto' }).ok) break;
          this.record(r, `${actor ? `${actor}: ` : ''}Tự động đánh`);
        }
      } else {
        const a: Action | null = body.type === 'move' ? { type: 'move', slot: body.slot as 'normal' | 'active' | 'ultimate', target: body.target } : ['guard', 'tactic', 'auto'].includes(body.type) ? ({ type: body.type } as Action) : null;
        if (!a) throw new BadRequestException('Hành động không hợp lệ');
        const res = advance(e, a);
        if (!res.ok) throw new ConflictException(res.reason);
      }
      if (e.pending) await this.prepareQuestion(q, s, r);
      const label = `${who && body.type !== 'auto_run' && body.type !== 'tactic' ? `${who}: ` : ''}${ACTION_LABEL[body.type === 'move' ? String(body.slot) : body.type] ?? 'Hành động'}`;
      if (body.type === 'auto_run') this.record(r, label, true); else this.record(r, label);
      await this.save(q, user, s, r);
      return this.view(q, r);
    });
  }

  /** Trả lời câu hỏi để kích hoạt tuyệt kỹ (HK.HS.133): máy chủ đo thời gian; đúng và kịp giờ thì ×1,6, ngược lại ×0,6 */
  async answer(user: UserRow, id: number, answer: unknown) {
    return this.db.tx(async (q) => {
      await this.gate.assertOpen(q, user);
      const r = await this.runOf(q, user, id);
      const qs = r.state.question;
      if (r.status !== 'active' || !qs || !r.state.engine.pending) throw new ConflictException('Không có câu hỏi nào đang chờ trả lời');
      const s = await this.stage(q, r.stage_id, false);
      const inTime = Date.now() - qs.served_at <= qs.seconds * 1000 + GRACE_MS;
      const g = grade({ qtype: qs.qtype, data: qs.data }, answer);
      r.state.question = null;
      resolveUltimate(r.state.engine, { correct: g.correct, inTime });
      advance(r.state.engine, null);
      if (r.state.engine.pending) await this.prepareQuestion(q, s, r);
      this.record(r, g.correct && inTime ? 'Tuyệt kỹ: trả lời đúng' : 'Tuyệt kỹ: trả lời chưa đạt');
      await this.save(q, user, s, r);
      return { result: { correct: g.correct, in_time: inTime, explanation: qs.explanation, detail: g.detail }, battle: await this.view(q, r) };
    });
  }

  // ---------------------------------------------------------------------- kết thúc, phần thưởng (HK.HS.056)
  private async finish(q: Q, user: UserRow, s: StageRow, r: RunRow): Promise<void> {
    const e = r.state.engine;
    const stars = starsOf(e);
    const top = Object.entries(e.stats.byUnit).sort((a, b) => b[1] - a[1])[0];
    const result: Record<string, any> = {
      won: e.status === 'won', stars, turns: Math.min(e.turn, e.maxTurns), ally_down: e.stats.allyDown, best_unit: top ? { name: e.units[top[0]].name, damage: top[1] } : null,
      ultimates: e.stats.ultimates, ultimates_strong: e.stats.ultimatesStrong, rewards: { gold: 0, binh_thu: 0, xp: 0, fragments: [], card: null, merged: [] }, first_clear: false, preview: r.mode === 'preview',
    };
    if (r.mode === 'play') {
      const prev = (await q<{ best_stars: number; first_clear_at: string | null }>('SELECT best_stars, first_clear_at FROM hk_stage_progress WHERE user_id = $1 AND stage_id = $2 FOR UPDATE', [user.id, s.id]))[0] ?? { best_stars: 0, first_clear_at: null };
      if (e.status === 'won') {
        const first = !prev.first_clear_at;
        result.first_clear = first;
        await q(
          `UPDATE hk_stage_progress SET clears = clears + 1, best_stars = GREATEST(best_stars, $3), best_turns = LEAST(COALESCE(best_turns, 99), $4), first_clear_at = COALESCE(first_clear_at, now()) WHERE user_id = $1 AND stage_id = $2`,
          [user.id, s.id, stars, result.turns]);
        const rw = s.rewards;
        if (first) {
          const gold = Math.max(0, Number(rw.gold ?? 0)), bt = Math.max(0, Number(rw.binh_thu ?? 0)), xp = Math.max(0, Number(rw.xp ?? 100 * s.difficulty));
          if (gold && (await this.game.addGold(q, user, gold, 'battle', `stage:${s.id}:first`))) result.rewards.gold = gold;
          if (bt && (await this.game.addBinhThu(q, user, bt, 'battle', `stage:${s.id}:first`))) result.rewards.binh_thu = bt;
          if (xp && (await this.game.awardXp(q, user, xp, 'battle', `stage:${s.id}:first`))) result.rewards.xp = xp;
          for (const f of (rw.fragments ?? []) as Array<{ card_code: string; qty: number }>) {
            const c = (await q<{ id: number; name: string }>('SELECT id, name FROM hk_cards WHERE code = $1', [f.card_code]))[0];
            if (c) { const res = await this.game.addFragments(q, user.id, c.id, Math.max(1, Number(f.qty ?? 1))); result.rewards.fragments.push({ card: c.name, qty: Number(f.qty ?? 1) }); if (res.merged) result.rewards.merged.push(c.name); }
          }
          if (rw.card_code) {
            const c = (await q<{ id: number; name: string }>('SELECT id, name FROM hk_cards WHERE code = $1', [rw.card_code]))[0];
            if (c && (await this.game.grantCard(q, user, c.id, null))) result.rewards.card = c.name;
          }
        }
        // thưởng cải thiện sao: mỗi sao mới đạt (cao hơn kỷ lục) được thêm Binh thư, một lần cho mỗi sao
        for (let n = prev.best_stars + 1; n <= stars; n += 1) {
          if (await this.game.addBinhThu(q, user, 2, 'battle', `stage:${s.id}:star${n}`)) result.rewards.binh_thu += 2;
        }
        if (stars === 3 && (await this.game.awardXp(q, user, 150, 'battle', `stage:${s.id}:perfect`))) result.rewards.xp += 150;
      }
    }
    await q('UPDATE hk_war_battles SET stars = $2, result = $3, finished_at = now() WHERE id = $1', [r.id, stars, JSON.stringify(result)]);
    r.result = result; r.stars = stars;
  }

  /** Bỏ qua màn đã đạt 3 sao (HK.HS.136): nhận Binh thư và vàng bằng một nửa phần thưởng lần đầu, một lần mỗi ngày mỗi màn */
  async skip(user: UserRow, stageId: number) {
    return this.db.tx(async (q) => {
      await this.gate.assertOpen(q, user);
      const s = await this.stage(q, stageId);
      const p = (await q<{ best_stars: number }>('SELECT best_stars FROM hk_stage_progress WHERE user_id = $1 AND stage_id = $2', [user.id, stageId]))[0];
      if (!p || p.best_stars < 3) throw new ConflictException('Chỉ bỏ qua được màn em đã đạt 3 sao');
      const day = dayKey(this.clock.now());
      const bt = Math.floor(Number(s.rewards.binh_thu ?? 0) / 2), gold = Math.floor(Number(s.rewards.gold ?? 0) / 2);
      const got = { binh_thu: 0, gold: 0 };
      if (bt && (await this.game.addBinhThu(q, user, bt, 'battle', `skip:${stageId}:${day}`))) got.binh_thu = bt;
      if (gold && (await this.game.addGold(q, user, gold, 'battle', `skip:${stageId}:${day}`))) got.gold = gold;
      await this.gate.addPlay(q, user, 10_000);
      return { skipped: true, rewards: got, repeated_today: got.binh_thu === 0 && got.gold === 0 && (bt > 0 || gold > 0) };
    });
  }

  /** "Sự thật lịch sử" (HK.HS.138): diễn biến và kết quả thật, chỉ huy hai bên, ý nghĩa, điểm khác giữa ván chơi và lịch sử, tư liệu gốc liên quan */
  async truth(user: UserRow, stageId: number) {
    return this.db.tx(async (q) => {
      const s = await this.stage(q, stageId);
      if (user.role === 'student' && !(await q('SELECT 1 FROM hk_stage_progress WHERE user_id = $1 AND stage_id = $2 AND attempts > 0', [user.id, stageId])).length) throw new ForbiddenException('Hãy chơi màn này trước khi xem sự thật lịch sử');
      const b = (await q<Record<string, any>>("SELECT id, name, year, date_text, context, forces, course, result FROM hist_battles WHERE id = $1 AND status = 'published'", [s.battle_id]))[0];
      if (!b) throw notFound('trận đánh');
      const commander = s.commander_id ? (await q<Record<string, any>>("SELECT id, name, role_text, forces, tactics, outcome FROM hk_commanders WHERE id = $1 AND status = 'published'", [s.commander_id]))[0] ?? null : null;
      const figures = await q("SELECT f.id, f.name, f.honorific, f.role_text FROM hist_figures f WHERE f.status = 'published' AND f.id IN (SELECT b_id FROM hist_links WHERE a_type = 'battle' AND a_id = $1 AND b_type = 'figure') ORDER BY f.name", [s.battle_id]);
      const locks = user.role === 'student' ? await lockedSources(q, user.id) : new Map<number, unknown>();
      const sources = (await q<{ id: number; title: string; kind: string }>(
        "SELECT t.id, t.title, t.kind FROM hist_sources t WHERE t.status = 'published' AND t.id IN (SELECT b_id FROM hist_links WHERE a_type = 'battle' AND a_id = $1 AND b_type = 'source') ORDER BY t.title", [s.battle_id])).map((x) => ({ ...x, locked: locks.has(x.id) }));
      return { stage: { id: s.id, title: s.title }, battle: b, commander, differences: s.differences, figures, sources };
    });
  }

  // ---------------------------------------------------------------------- Sa bàn 3D (HK.HS.137, HK.GV.084)
  /** Các trận có sa bàn: học sinh và giáo viên thấy màn đã phát hành; quản trị tổng thấy cả bản nháp để kiểm tra */
  async sandtables(user: UserRow) {
    return this.db.query(
      `SELECT s.id, s.title, b.name AS battle_name, b.year, c.title AS campaign_title, s.status, jsonb_array_length(s.sandtable->'steps')::int AS steps
       FROM hk_stages s JOIN hist_battles b ON b.id = s.battle_id LEFT JOIN hist_campaigns c ON c.id = b.campaign_id
       WHERE s.sandtable IS NOT NULL AND ($1 = 'root_admin' OR s.status = 'published') ORDER BY c.sort_order NULLS LAST, b.year, s.id`, [user.role]);
  }

  async sandtable(user: UserRow, id: number) {
    const s = await this.stage(this.db.query.bind(this.db) as Q, id, user.role !== 'root_admin');
    if (!s.sandtable) throw notFound('sa bàn của trận này');
    const b = (await this.db.query<{ name: string; year: number | null; date_text: string | null }>('SELECT name, year, date_text FROM hist_battles WHERE id = $1', [s.battle_id]))[0];
    return { stage: { id: s.id, title: s.title, summary: s.summary, objective: s.objective, status: s.status, battle_name: b?.name ?? s.title, year: b?.year ?? null, date_text: b?.date_text ?? null }, sandtable: s.sandtable };
  }

  // ---------------------------------------------------------------------- quản trị màn chơi (HK.AD.084)
  async adminStages() {
    return this.db.query(
      `SELECT s.id, s.title, s.status, s.difficulty, b.name AS battle_name, b.year, jsonb_array_length(s.waves)::int AS waves, (SELECT count(DISTINCT user_id)::int FROM hk_stage_progress p WHERE p.stage_id = s.id AND p.attempts > 0) AS players
       FROM hk_stages s JOIN hist_battles b ON b.id = s.battle_id ORDER BY b.year, s.id`);
  }

  async adminStage(id: number) {
    const s = await this.stage(this.db.query.bind(this.db) as Q, id, false);
    return { ...s, problems: await this.stageProblems(this.db.query.bind(this.db) as Q, s) };
  }

  async battleOptions() {
    return this.db.query("SELECT b.id, b.name, b.year, b.status, EXISTS (SELECT 1 FROM hk_stages s WHERE s.battle_id = b.id) AS has_stage FROM hist_battles b ORDER BY b.year, b.id");
  }

  private cleanUnit(u: Record<string, any>, where: string): EnemyDef {
    const name = String(u.name ?? '').trim();
    if (name.length < 2 || name.length > 60) throw new BadRequestException(`${where}: tên từ 2 đến 60 ký tự`);
    const num = (k: string, min: number, max: number): number => { const v = Number(u[k]); if (!Number.isFinite(v) || v < min || v > max) throw new BadRequestException(`${where} (${name}): ${k} từ ${min} đến ${max}`); return Math.round(v); };
    const branch = u.branch ? String(u.branch) : null;
    if (branch && !BRANCHES.includes(branch)) throw new BadRequestException(`${where} (${name}): binh chủng là bộ, thủy hoặc kỵ`);
    const moves = Array.isArray(u.moves) ? (u.moves as Array<Record<string, any>>).slice(0, 4).map((m) => {
      if (!['normal', 'active', 'ultimate'].includes(m.slot) || !String(m.name ?? '').trim()) throw new BadRequestException(`${where} (${name}): chiêu cần loại và tên`);
      return { slot: m.slot, name: String(m.name).trim().slice(0, 80), target: m.target ?? 'enemy_one', power: Math.max(0, Math.min(5, Number(m.power ?? 1))), effect: m.effect ?? null, rage_cost: Number(m.rage_cost ?? (m.slot === 'ultimate' ? 100 : 40)), cooldown: Number(m.cooldown ?? 0) } as MoveDef;
    }) : undefined;
    return { name, branch: (branch as EnemyDef['branch']) ?? null, level: u.level ? num('level', 1, 100) : 1, hp: num('hp', 50, 50000), atk: num('atk', 1, 1000), def: num('def', 0, 1000), spd: num('spd', 1, 100), commander: Boolean(u.commander), ...(moves?.length ? { moves } : {}) };
  }

  private async stageFields(q: Q, body: Record<string, any>, cur?: StageRow) {
    const title = String(body.title ?? cur?.title ?? '').trim();
    if (title.length < 2 || title.length > 160) throw new BadRequestException('Tên màn chơi từ 2 đến 160 ký tự');
    const text = (k: string, max: number, label: string): string | null => { const v = body[k] === undefined ? (cur as unknown as Record<string, string | null>)?.[k] ?? null : String(body[k] ?? '').trim() || null; if (v && v.length > max) throw new BadRequestException(`${label} tối đa ${max} ký tự`); return v; };
    const intIn = (k: string, def: number, min: number, max: number, label: string): number => { const v = Number(body[k] ?? (cur as unknown as Record<string, number>)?.[k] ?? def); if (!Number.isInteger(v) || v < min || v > max) throw new BadRequestException(`${label}: số nguyên từ ${min} đến ${max}`); return v; };
    const waves = (body.waves ?? cur?.waves) as Array<Record<string, any>>;
    if (!Array.isArray(waves) || !waves.length || waves.length > 5) throw new BadRequestException('Màn chơi có từ 1 đến 5 đợt quân');
    const cleanWaves: WaveDef[] = waves.map((w, i) => {
      if (!Array.isArray(w.units) || !w.units.length || w.units.length > 5) throw new BadRequestException(`Đợt ${i + 1}: có từ 1 đến 5 đơn vị`);
      return { label: String(w.label ?? '').trim().slice(0, 80) || undefined, units: w.units.map((u: Record<string, any>, j: number) => this.cleanUnit(u, `Đợt ${i + 1}, đơn vị ${j + 1}`)) };
    });
    const t = (body.terrain ?? cur?.terrain ?? {}) as Record<string, any>;
    const terrain: TerrainDef = {};
    if (t.tide) { const c = Number(t.tide.cycle); if (!Number.isInteger(c) || c < 2 || c > 8) throw new BadRequestException('Thủy triều: chu kỳ từ 2 đến 8 vòng'); terrain.tide = { cycle: c }; }
    if (t.stakes) { const p = Number(t.stakes.pct); if (!(p >= 0.01 && p <= 0.3)) throw new BadRequestException('Cọc ngầm: sát thương từ 1% đến 30% máu'); terrain.stakes = { pct: p }; }
    if (t.water_bonus) { terrain.water_bonus = {}; for (const [k, v] of Object.entries(t.water_bonus)) { if (!BRANCHES.includes(k) || !(Number(v) >= 0 && Number(v) <= 0.5)) throw new BadRequestException('Thưởng địa hình: binh chủng bộ/thủy/kỵ, từ 0 đến 50%'); (terrain.water_bonus as Record<string, number>)[k] = Number(v); } }
    if (t.hunger) { const p = Number(t.hunger.pct), f = Number(t.hunger.from_turn ?? 3); if (!(p >= 0.01 && p <= 0.2) || !Number.isInteger(f) || f < 1 || f > 15) throw new BadRequestException('Thiếu lương: 1%–20% máu mỗi vòng, bắt đầu từ vòng 1–15'); terrain.hunger = { pct: p, from_turn: f }; }
    const rw = (body.rewards ?? cur?.rewards ?? {}) as Record<string, any>;
    const rewards: Record<string, any> = {};
    for (const k of ['gold', 'binh_thu', 'xp']) if (rw[k] !== undefined && rw[k] !== null && rw[k] !== '') { const v = Number(rw[k]); if (!Number.isInteger(v) || v < 0 || v > 5000) throw new BadRequestException(`Thưởng ${k}: số nguyên từ 0 đến 5000`); rewards[k] = v; }
    const codes = [...((rw.fragments ?? []) as Array<{ card_code: string }>).map((f) => f.card_code), ...(rw.card_code ? [rw.card_code] : [])];
    for (const code of codes) if (!(await q('SELECT 1 FROM hk_cards WHERE code = $1', [String(code)])).length) throw new BadRequestException(`Không có thẻ mã "${code}" để thưởng`);
    if (Array.isArray(rw.fragments) && rw.fragments.length) rewards.fragments = rw.fragments.slice(0, 5).map((f: Record<string, any>) => ({ card_code: String(f.card_code), qty: Math.max(1, Math.min(20, Number(f.qty ?? 1))) }));
    if (rw.card_code) rewards.card_code = String(rw.card_code);
    const battleId = Number(body.battle_id ?? cur?.battle_id);
    if (!(await q('SELECT 1 FROM hist_battles WHERE id = $1', [battleId])).length) throw new BadRequestException('Trận đánh trong kho lịch sử không tồn tại');
    const commanderId = body.commander_id === undefined ? cur?.commander_id ?? null : body.commander_id === null || body.commander_id === '' ? null : Number(body.commander_id);
    if (commanderId !== null && !(await q('SELECT 1 FROM hk_commanders WHERE id = $1', [commanderId])).length) throw new BadRequestException('Chỉ huy đối phương không tồn tại');
    const quizId = body.quiz_id === undefined ? cur?.quiz_id ?? null : body.quiz_id === null || body.quiz_id === '' ? null : Number(body.quiz_id);
    if (quizId !== null && !(await q('SELECT 1 FROM hk_quizzes WHERE id = $1', [quizId])).length) throw new BadRequestException('Bộ câu hỏi tuyệt kỹ không tồn tại');
    const diffs = (body.differences ?? cur?.differences ?? []) as unknown[];
    if (!Array.isArray(diffs) || diffs.length > 8 || diffs.some((d) => typeof d !== 'string' || d.length > 400)) throw new BadRequestException('Điểm khác lịch sử: tối đa 8 ý, mỗi ý tối đa 400 ký tự');
    const bg = body.background_url === undefined ? cur?.background_url ?? null : String(body.background_url ?? '').trim() || null;
    if (bg && !/^https:\/\/[^\s]+$/.test(bg)) throw new BadRequestException('Ảnh nền phải là liên kết https');
    return {
      battleId, title, summary: text('summary', 800, 'Tóm tắt'), objective: text('objective', 400, 'Mục tiêu'), background_url: bg, difficulty: intIn('difficulty', 2, 1, 3, 'Độ khó'), max_turns: intIn('max_turns', 15, 3, 30, 'Số vòng tối đa'),
      star_turns: intIn('star_turns', 10, 1, 30, 'Số vòng cho sao thứ ba'), terrain, waves: cleanWaves, rewards, commanderId, quizId, differences: diffs,
      sandtable: body.sandtable === undefined ? cur?.sandtable ?? null : cleanSandtable(body.sandtable),
    };
  }

  async createStage(user: UserRow, body: Record<string, any>) {
    const f = await this.db.tx((q) => this.stageFields(q, body));
    try {
      const id = (await this.db.query<{ id: number }>(
        `INSERT INTO hk_stages (battle_id, title, summary, objective, background_url, difficulty, max_turns, star_turns, terrain, waves, rewards, commander_id, quiz_id, differences, created_by, updated_by, sandtable)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15, $16) RETURNING id`,
        [f.battleId, f.title, f.summary, f.objective, f.background_url, f.difficulty, f.max_turns, f.star_turns, JSON.stringify(f.terrain), JSON.stringify(f.waves), JSON.stringify(f.rewards), f.commanderId, f.quizId, JSON.stringify(f.differences), user.id, f.sandtable ? JSON.stringify(f.sandtable) : null]))[0].id;
      return this.adminStage(id);
    } catch (e) { if ((e as { code?: string }).code === '23505') throw new ConflictException('Trận đánh này đã có màn chơi'); throw e; }
  }

  async updateStage(user: UserRow, id: number, body: Record<string, any>) {
    const cur = await this.stage(this.db.query.bind(this.db) as Q, id, false);
    const f = await this.db.tx((q) => this.stageFields(q, body, cur));
    await this.db.query(
      `UPDATE hk_stages SET battle_id = $2, title = $3, summary = $4, objective = $5, background_url = $6, difficulty = $7, max_turns = $8, star_turns = $9, terrain = $10, waves = $11, rewards = $12,
         commander_id = $13, quiz_id = $14, differences = $15, updated_by = $16, sandtable = $17, updated_at = now() WHERE id = $1`,
      [id, f.battleId, f.title, f.summary, f.objective, f.background_url, f.difficulty, f.max_turns, f.star_turns, JSON.stringify(f.terrain), JSON.stringify(f.waves), JSON.stringify(f.rewards), f.commanderId, f.quizId, JSON.stringify(f.differences), user.id, f.sandtable ? JSON.stringify(f.sandtable) : null]);
    return this.adminStage(id);
  }

  private async stageProblems(q: Q, s: StageRow): Promise<string[]> {
    const out: string[] = [];
    const b = (await q<{ status: string }>('SELECT status FROM hist_battles WHERE id = $1', [s.battle_id]))[0];
    if (!b || b.status !== 'published') out.push('Hồ sơ trận đánh trong kho lịch sử chưa công bố');
    if (s.quiz_id && !(await q("SELECT 1 FROM hk_quiz_questions k JOIN hk_questions t ON t.id = k.question_id WHERE k.quiz_id = $1 AND t.qtype <> 'poll'", [s.quiz_id])).length) out.push('Bộ câu hỏi tuyệt kỹ chưa có câu nào');
    if (!s.waves.some((w) => w.units.some((u) => u.commander))) out.push('Nên có một chỉ huy địch để báo trước chiêu lớn');
    return out;
  }

  async setStageStatus(id: number, status: string) {
    if (!['draft', 'published'].includes(status)) throw new BadRequestException('Trạng thái là bản nháp hoặc đã phát hành');
    const s = await this.stage(this.db.query.bind(this.db) as Q, id, false);
    if (status === 'published') {
      const hard = (await this.stageProblems(this.db.query.bind(this.db) as Q, s)).filter((p) => !p.startsWith('Nên'));
      if (hard.length) throw new ConflictException(`Chưa phát hành được: ${hard.join('; ')}`);
    }
    await this.db.query("UPDATE hk_stages SET status = $2, published_at = CASE WHEN $2 = 'published' THEN now() END, updated_at = now() WHERE id = $1", [id, status]);
    return this.adminStage(id);
  }

  async deleteStage(id: number) {
    const played = Number((await this.db.query<{ n: string }>('SELECT count(*) AS n FROM hk_stage_progress WHERE stage_id = $1 AND attempts > 0', [id]))[0].n);
    if (played) throw new ConflictException(`Đã có ${played} học sinh chơi màn này; hãy gỡ phát hành thay vì xóa`);
    await this.db.query('DELETE FROM hk_stages WHERE id = $1', [id]);
  }

  /** Cân bằng chỉ số (HK.AD.086): máy tự đánh N trận với đội hình mẫu để xem tỉ lệ thắng trước khi công bố */
  async balance(stageId: number, body: { cards?: number[]; level?: number; stars?: number; runs?: number; answer_rate?: number }) {
    const runs = Math.max(1, Math.min(200, Number(body.runs ?? 50)));
    const level = Math.max(1, Math.min(100, Number(body.level ?? 1))), stars = Math.max(1, Math.min(5, Number(body.stars ?? 1)));
    const rate = Math.max(0, Math.min(1, Number(body.answer_rate ?? 0.7)));
    return this.db.tx(async (q) => {
      const s = await this.stage(q, stageId, false);
      const ids = (body.cards?.length ? body.cards : (await q<{ id: number }>("SELECT id FROM hk_cards WHERE kind = 'general' AND is_active ORDER BY CASE rarity WHEN 'common' THEN 0 WHEN 'rare' THEN 1 WHEN 'epic' THEN 2 ELSE 3 END, id LIMIT 5")).map((r) => r.id)).slice(0, 5);
      const cards = (await this.loadCards(q, 0, ids, true)).map((c) => ({ ...c, level, stars }));
      if (!cards.length) throw new BadRequestException('Chưa chọn được thẻ tướng nào');
      const allies = await this.buildAllies(q, cards, s.battle_id);
      let wins = 0, turns = 0, starSum = 0, down = 0;
      for (let i = 1; i <= runs; i += 1) {
        const e = autoPlay(createBattle({ allies, waves: s.waves, terrain: s.terrain, maxTurns: s.max_turns, starTurns: s.star_turns, seed: i * 7919 }), rate);
        if (e.status === 'won') wins += 1;
        turns += Math.min(e.turn, e.maxTurns); starSum += starsOf(e); down += e.stats.allyDown;
      }
      return { runs, win_rate: Math.round((wins / runs) * 100), avg_turns: Math.round((turns / runs) * 10) / 10, avg_stars: Math.round((starSum / runs) * 100) / 100, avg_ally_down: Math.round((down / runs) * 100) / 100, cards: cards.map((c) => c.name), level, stars };
    });
  }

  // ---------------------------------------------------------------------- chỉ huy đối phương (HK.HS.130), tài nguyên (HK.AD.085)
  async adminCommanders() { return this.db.query('SELECT id, code, name, role_text, forces, tactics, outcome, source_id, status FROM hk_commanders ORDER BY id'); }

  private commanderFields(body: Record<string, any>, cur?: Record<string, any>) {
    const t = (k: string, max: number, label: string, req = false): string | null => {
      const v = body[k] === undefined ? (cur?.[k] ?? null) : String(body[k] ?? '').trim() || null;
      if (req && !v) throw new BadRequestException(`${label}: bắt buộc`);
      if (v && v.length > max) throw new BadRequestException(`${label} tối đa ${max} ký tự`);
      return v;
    };
    return { name: t('name', 80, 'Tên chỉ huy', true), role_text: t('role_text', 400, 'Vai trò'), forces: t('forces', 400, 'Lực lượng'), tactics: t('tactics', 600, 'Chiến thuật'), outcome: t('outcome', 600, 'Kết cục trong lịch sử'), source_id: body.source_id === undefined ? cur?.source_id ?? null : body.source_id === null || body.source_id === '' ? null : Number(body.source_id) };
  }

  async createCommander(body: Record<string, any>) {
    const code = String(body.code ?? '').trim();
    if (!/^[a-z0-9_-]{2,60}$/.test(code)) throw new BadRequestException('Mã chỉ gồm chữ thường không dấu, số, gạch ngang hoặc gạch dưới');
    const f = this.commanderFields(body);
    try {
      return (await this.db.query('INSERT INTO hk_commanders (code, name, role_text, forces, tactics, outcome, source_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, code, name, status', [code, f.name, f.role_text, f.forces, f.tactics, f.outcome, f.source_id]))[0];
    } catch (e) { if ((e as { code?: string }).code === '23505') throw new ConflictException('Mã này đã tồn tại'); if ((e as { code?: string }).code === '23503') throw new BadRequestException('Tư liệu không tồn tại'); throw e; }
  }

  async updateCommander(id: number, body: Record<string, any>) {
    const cur = (await this.db.query<Record<string, any>>('SELECT * FROM hk_commanders WHERE id = $1', [id]))[0];
    if (!cur) throw notFound('chỉ huy');
    const f = this.commanderFields(body, cur);
    const status = body.status ?? cur.status;
    if (!['draft', 'published'].includes(status)) throw new BadRequestException('Trạng thái là bản nháp hoặc đã phát hành');
    await this.db.query('UPDATE hk_commanders SET name = $2, role_text = $3, forces = $4, tactics = $5, outcome = $6, source_id = $7, status = $8, updated_at = now() WHERE id = $1', [id, f.name, f.role_text, f.forces, f.tactics, f.outcome, f.source_id, status]);
    return (await this.db.query('SELECT id, code, name, role_text, forces, tactics, outcome, source_id, status FROM hk_commanders WHERE id = $1', [id]))[0];
  }

  async deleteCommander(id: number) { await this.db.query('DELETE FROM hk_commanders WHERE id = $1', [id]); }

  async assets() { return this.db.query('SELECT id, kind, name, url, source, license, note, created_at FROM hk_game_assets ORDER BY id DESC LIMIT 300'); }

  async addAsset(user: UserRow, body: Record<string, any>) {
    const kinds = ['sprite', 'animation', 'effect', 'music', 'sfx', 'background', 'model3d'];
    if (!kinds.includes(body.kind)) throw new BadRequestException(`Loại tài nguyên thuộc: ${kinds.join(', ')}`);
    const s = (k: string, min: number, max: number, label: string): string => { const v = String(body[k] ?? '').trim(); if (v.length < min || v.length > max) throw new BadRequestException(`${label}: từ ${min} đến ${max} ký tự`); return v; };
    const url = s('url', 8, 500, 'Liên kết');
    if (!/^https:\/\/[^\s]+$/.test(url)) throw new BadRequestException('Liên kết phải bắt đầu bằng https://');
    const note = String(body.note ?? '').trim();
    if (note.length > 400) throw new BadRequestException('Ghi chú tối đa 400 ký tự');
    return (await this.db.query('INSERT INTO hk_game_assets (kind, name, url, source, license, note, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, kind, name, url, source, license, note',
      [body.kind, s('name', 2, 120, 'Tên'), url, s('source', 2, 300, 'Nguồn (bắt buộc ghi)'), s('license', 2, 120, 'Giấy phép (bắt buộc ghi)'), note || null, user.id]))[0];
  }

  async deleteAsset(id: number) { await this.db.query('DELETE FROM hk_game_assets WHERE id = $1', [id]); }

  // ---------------------------------------------------------------------- bật/tắt cho trường, khung giờ, thời gian tối đa (HK.QT.056)
  async schoolWar(schoolId: number) {
    const r = (await this.db.query<Record<string, any>>('SELECT war_enabled, war_grades, war_from::text AS war_from, war_to::text AS war_to, war_minutes FROM hk_school_settings WHERE school_id = $1', [schoolId]))[0];
    return { war_enabled: r?.war_enabled ?? true, war_grades: r?.war_grades ?? [], war_from: r?.war_from?.slice(0, 5) ?? null, war_to: r?.war_to?.slice(0, 5) ?? null, war_minutes: r?.war_minutes ?? null };
  }

  async updateSchoolWar(user: UserRow, schoolId: number, body: Record<string, any>) {
    const cur = await this.schoolWar(schoolId);
    const enabled = body.war_enabled === undefined ? cur.war_enabled : body.war_enabled;
    if (typeof enabled !== 'boolean') throw new BadRequestException('Bật hoặc tắt game');
    const grades = body.war_grades === undefined ? cur.war_grades : body.war_grades;
    if (!Array.isArray(grades) || grades.length > 4 || grades.some((g: unknown) => !Number.isInteger(g) || (g as number) < 6 || (g as number) > 9)) throw new BadRequestException('Khối lớp chơi được: 6, 7, 8, 9 (để trống là mọi khối)');
    const time = (v: unknown, label: string): string | null => { if (v === null || v === '' || v === undefined) return null; if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v))) throw new BadRequestException(`${label}: dạng HH:MM (giờ Việt Nam)`); return String(v); };
    const from = body.war_from === undefined ? cur.war_from : time(body.war_from, 'Giờ bắt đầu'), to = body.war_to === undefined ? cur.war_to : time(body.war_to, 'Giờ kết thúc');
    if ((from === null) !== (to === null)) throw new BadRequestException('Đặt cả giờ bắt đầu và giờ kết thúc, hoặc để trống cả hai');
    const minutes = body.war_minutes === undefined ? cur.war_minutes : body.war_minutes === null || body.war_minutes === '' ? null : Number(body.war_minutes);
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 5 || minutes > 600)) throw new BadRequestException('Thời gian chơi tối đa mỗi ngày từ 5 đến 600 phút');
    await this.db.query(
      `INSERT INTO hk_school_settings (school_id, war_enabled, war_grades, war_from, war_to, war_minutes, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (school_id) DO UPDATE SET war_enabled = $2, war_grades = $3, war_from = $4, war_to = $5, war_minutes = $6, updated_by = $7, updated_at = now()`, [schoolId, enabled, grades, from, to, minutes, user.id]);
    return this.schoolWar(schoolId);
  }
}
