/**
 * Hành trình Đông A – vòng chơi học lịch sử của trang học sinh (15/11/2026):
 *   chọn cuộc kháng chiến → chọn chặng trên bản đồ → học ngắn → minigame luyện tập → nhập vai khám phá → trận đánh (nếu có) → tổng kết, thưởng, mở chặng sau.
 *
 * Nguyên tắc:
 *  - Máy chủ giữ trạng thái chuẩn của mọi phiên chơi; trình duyệt chỉ gửi lệnh và vẽ lại. Đáp án, điểm, sao, điểm thưởng và việc mở khóa đều do máy chủ tính.
 *  - Mỗi lệnh có mã riêng (`action_id`) và số thứ tự (`seq`): gửi lặp hoặc kết nối lại nhận đúng kết quả cũ; lệnh cũ hơn trạng thái hiện tại bị từ chối (409).
 *  - Phần thưởng đi qua sổ cái sẵn có của trò chơi hóa (GameService) với khóa duy nhất nên làm lại không được thưởng lần hai.
 *  - Mức hiểu kiến thức (phần trăm luyện tập, sao kiến thức) tách khỏi điểm trận đánh.
 *  - Học sinh chỉ đọc nội dung đã công bố và chỉ chạm được phiên, tiến độ của chính mình. Từ 16/11/2026 không còn trang chỉnh nội dung của quản trị tổng
 *    hay báo cáo của giáo viên (người dùng yêu cầu xóa): nội dung chỉ đổi qua migration số mới.
 */
import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { GameService } from '../game/game.service';
import { dayKey } from '../game/clock';
import { logEvent } from '../student/events';
import { applyBachDang, bachDangResult, BdScenario, BdState, createBachDang, publicBachDang } from './bachdang';
import { debriefView, knowledgeStars, lessonView, StageContent } from './content';
import { applyExplore, ExploreState, newExplore, publicExplore } from './explore';
import { gradeItem, ItemKind, ItemRow, KIND_LABEL, newSlot, publicItem, SlotState, tally } from './practice';
import { applyTactics, createTactics, publicTactics, TacticsScenario, tacticsResult, TState } from './tactics';
import { applyWorld, isWorldState, ITEM_NAME, newWorld, normalizeWorldMap, normalizeWorldQuest, publicWorld, settleWorld, tideAt, VILLAGE_BONUS, WORLD_TITLES, WorldAction, WorldCtx, WorldEffect, WorldEvent, WorldMap, WorldQuest, WorldState } from './world';
import { WorldHub } from './world.hub';

export type SessionKind = 'practice' | 'explore' | 'battle' | 'review';
export type StageState = 'locked' | 'ready' | 'learning' | 'done' | 'review';

interface StageBrief {
  id: number; code: string; campaign_no: number; position: number; title: string; place: string; date_label: string; kind: string; icon: string; summary: string;
  map_x: number; map_y: number; anchor_x: number | null; anchor_y: number | null; unlock_after: string | null; pass_percent: number; reward_xp: number; reward_gold: number;
  card_code: string | null; badge_code: string | null; version: number; status: string; review_note: string | null; has_battle: boolean; battle_mode: string | null;
}
interface StageRow extends StageBrief { content: StageContent }
interface ProgressRow {
  user_id: number; stage_id: number; lesson_done_at: string | null; practice_best: number; practice_tries: number; practice_passed_at: string | null;
  explore_done_at: string | null; explore_hints: number; explore_mistakes: number; battle_best: number; battle_stars: number; battle_tries: number; battle_won_at: string | null;
  stars: number; completed_at: string | null;
}
interface SessionRow { id: number; user_id: number; stage_id: number | null; kind: SessionKind; status: 'active' | 'done' | 'abandoned'; seq: number; state: Record<string, any>; result: Record<string, any> | null; started_at: string }
interface PracticeState { v: 1; slots: SlotState[] }
/** `served_at`: lúc câu được mở cho học sinh (đồng hồ chạy từ đây); `opened_at`: lúc trả lời xong câu trước, dùng khi trình duyệt không báo đã mở câu */
interface ReviewState { v: 1; slots: Array<SlotState & { served_at: number | null; opened_at?: number | null; limit_s: number }>; streak: number; best_streak: number }
interface BattleSessionState { v: 1; mode: 'tactics' | 'bachdang'; engine: TState | BdState; knowledge: number }

const STAGE_COLS = `s.id, s.code, s.campaign_no, s.position, s.title, s.place, s.date_label, s.kind, s.icon, s.summary, s.map_x::float8 AS map_x, s.map_y::float8 AS map_y,
  s.anchor_x::float8 AS anchor_x, s.anchor_y::float8 AS anchor_y, s.unlock_after, s.pass_percent, s.reward_xp, s.reward_gold, s.card_code, s.badge_code, s.version, s.status, s.review_note,
  (jsonb_typeof(s.content->'battle') = 'object') AS has_battle, s.content->'battle'->>'mode' AS battle_mode`;
const SESSION_COLS = 'id::int AS id, user_id, stage_id, kind, status, seq, state, result, started_at';
const XP = { lesson: 10, practice: 30, explore: 20, battle: 50, review: 5 };
/** Thay đổi của thế giới khối chung: chỉ phát cho cả phòng sau khi giao dịch đã ghi xong */
type WorldPending = { room: number; kind: 'take'; x: number; z: number } | { room: number; kind: 'block'; placed: { x: number; z: number; block: string; zone: string; by: number }; removed: { x: number; z: number } | null };
/** Lựa chọn khi tự tạo nhân vật trong thế giới khối (lưu hk_players.appearance.saga_world_look) */
export const WORLD_LOOK = {
  gender: ['nam', 'nu'], robe: ['#8b6b4c', '#2f5f8f', '#1d7a68', '#6a4c9c', '#b8261b', '#3f4a5a'], hat: ['none', 'non', 'khan', 'helmet'], skin: ['#f9d8bb', '#eec39a', '#d9a676', '#b98258'],
} as const;
export type WorldLook = { gender: 'nam' | 'nu'; robe: string; hat: string; skin: string };
const DEFAULT_LOOK: WorldLook = { gender: 'nam', robe: '#2f5f8f', hat: 'non', skin: '#f9d8bb' };
/** Hòm báu trên bản đồ (17/11/2026, migration 072): giữa hai chặng liền nhau (mở khi xong chặng trước) và cuối mỗi phần (mở khi xong cả phần) */
/**
 * Hòm báu bí ẩn (17/11/2026): mỗi hòm có độ hiếm chỉ lộ ra khi mở (Thường / Hiếm / Sử thi / Huyền thoại) và phần thưởng theo độ hiếm. Kết quả tung
 * ngẫu nhiên nhưng cố định theo (học sinh, mã hòm) bằng SHA-256 – mở lại hay gọi lại API không đổi được; tỉ lệ được công bố cho học sinh xem.
 * Không bán hòm, không dùng tiền thật: hòm chỉ nhận được bằng cách học xong chặng / phần. Sử thi trở lên có thêm Khiên giữ chuỗi (đã đủ khiên thì
 * đổi ra vàng); hòm cuối phần luôn từ Hiếm trở lên và có thêm điểm kinh nghiệm.
 */
export type ChestRarity = 'common' | 'rare' | 'epic' | 'legendary';
const CHEST_ODDS: Record<'stage' | 'part', Array<[ChestRarity, number]>> = {
  stage: [['common', 55], ['rare', 30], ['epic', 12], ['legendary', 3]],
  part: [['rare', 45], ['epic', 40], ['legendary', 15]],
};
const CHEST_LOOT: Record<ChestRarity, { gold: [number, number]; xp: number; freeze: number }> = {
  common: { gold: [10, 20], xp: 0, freeze: 0 },
  rare: { gold: [20, 35], xp: 10, freeze: 0 },
  epic: { gold: [35, 60], xp: 25, freeze: 1 },
  legendary: { gold: [60, 100], xp: 50, freeze: 1 },
};
const PART_BONUS_XP = 20;
const FREEZE_AS_GOLD = 15;
/** Kết quả của một hòm cho một học sinh (thuần, kiểm thử được) */
export function rollChest(userId: number, key: string, kind: 'stage' | 'part'): { rarity: ChestRarity; gold: number; xp: number; freeze: number } {
  const h = createHash('sha256').update(`donga-chest:v1:${userId}:${key}`).digest();
  const r1 = h.readUInt32BE(0) / 0x100000000, r2 = h.readUInt32BE(4) / 0x100000000;
  const odds = CHEST_ODDS[kind];
  const total = odds.reduce((n, [, w]) => n + w, 0);
  let rarity = odds[odds.length - 1][0];
  let acc = 0;
  for (const [r, w] of odds) { acc += w / total; if (r1 < acc) { rarity = r; break; } }
  const loot = CHEST_LOOT[rarity];
  return { rarity, gold: loot.gold[0] + Math.floor(r2 * (loot.gold[1] - loot.gold[0] + 1)), xp: loot.xp + (kind === 'part' ? PART_BONUS_XP : 0), freeze: loot.freeze };
}
const chestOdds = (kind: 'stage' | 'part') => {
  const total = CHEST_ODDS[kind].reduce((n, [, w]) => n + w, 0);
  return CHEST_ODDS[kind].map(([rarity, w]) => ({ rarity, percent: Math.round((w / total) * 100) }));
};
const chestMaxGold = (kind: 'stage' | 'part') => Math.max(...CHEST_ODDS[kind].map(([r]) => CHEST_LOOT[r].gold[1]));
/**
 * Khung ảnh đại diện và danh hiệu nhận từ hòm báu (17/11/2026, kiểu quà sự kiện của game): danh mục cố định trong mã, mở khóa theo các hòm đã mở
 * (sổ vàng lý do 'chest'), trang bị lưu ở hk_players.appearance (khóa saga_frame, saga_title) – không thêm bảng. Khung: hòm cuối mỗi phần;
 * danh hiệu: theo số hòm đã mở (13 hòm = mọi hòm). "Sát Thát" là chữ quân sĩ nhà Trần thích lên cánh tay năm 1285 (Đại Việt sử ký toàn thư).
 */
type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
const FRAMES: Array<{ code: string; name: string; rarity: Rarity; chest: string; need: string }> = [
  { code: 'dong-bo-dau', name: 'Khung Đông Bộ Đầu', rarity: 'rare', chest: 'p1', need: 'Mở hòm báu cuối Phần 1 (1258)' },
  { code: 'chuong-duong', name: 'Khung Chương Dương', rarity: 'epic', chest: 'p2', need: 'Mở hòm báu cuối Phần 2 (1285)' },
  { code: 'bach-dang', name: 'Khung Bạch Đằng', rarity: 'legendary', chest: 'p3', need: 'Mở hòm báu cuối Phần 3 (1287–1288)' },
];
/** Ảnh đại diện có sẵn (17/11/2026): Rồng Con và chân dung danh tướng của dự án, chọn tự do; giao diện vẽ theo mã, máy chủ chỉ kiểm mã hợp lệ */
const AVATARS = ['rong-con-vui', 'rong-con-ra-tran', 'rong-con-hoc-gia', 'rong-con-non-la', 'rong-con-vua', 'rong-con-dang-yeu',
  'tran-hung-dao', 'tran-quoc-toan', 'tran-thu-do', 'tran-binh-trong', 'tran-nhan-tong', 'tran-khanh-du'];
const TITLES: Array<{ code: string; name: string; rarity: Rarity; min: number }> = [
  { code: 'tan-binh-sat-that', name: 'Tân binh Sát Thát', rarity: 'common', min: 1 },
  { code: 'hieu-uy-dong-a', name: 'Hiệu úy Đông A', rarity: 'rare', min: 3 },
  { code: 'tuong-quan-dong-a', name: 'Tướng quân Đông A', rarity: 'epic', min: 6 },
  { code: 'hao-kiet-dong-a', name: 'Hào kiệt Đông A', rarity: 'epic', min: 10 },
  { code: 'dai-tuong-hao-khi', name: 'Đại tướng Hào Khí Đông A', rarity: 'legendary', min: 13 },
];
const REVIEW_SIZE = 10;
const REVIEW_GRACE_MS = 3000;
/** Thời gian tối đa đọc lời giải thích của câu trước khi trình duyệt không báo "đã mở câu": quá mức này đồng hồ của câu vẫn tính */
const REVIEW_READ_MS = 90_000;
const REVIEW_KINDS: ItemKind[] = ['quiz', 'tactic', 'sequence', 'locate'];
const notFound = (what: string): NotFoundException => new NotFoundException(`Không tìm thấy ${what}`);
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

@Injectable()
export class SagaService {
  constructor(private readonly db: DatabaseService, private readonly game: GameService, private readonly hub: WorldHub) {}

  private readonly read: Q = (sql, params) => this.db.query(sql, params);

  // ------------------------------------------------------------------ đọc nội dung và tiến độ
  private stages(q: Q, all = false): Promise<StageBrief[]> {
    return q<StageBrief>(`SELECT ${STAGE_COLS} FROM hk_saga_stages s ${all ? '' : "WHERE s.status = 'published'"} ORDER BY s.position`);
  }

  private async stage(q: Q, id: number, all = false): Promise<StageRow> {
    const row = (await q<StageRow>(`SELECT ${STAGE_COLS}, s.content FROM hk_saga_stages s WHERE s.id = $1${all ? '' : " AND s.status = 'published'"}`, [id]))[0];
    if (!row) throw notFound('chặng');
    return row;
  }

  private async progressMap(q: Q, userId: number): Promise<Map<number, ProgressRow>> {
    const rows = await q<ProgressRow>('SELECT * FROM hk_saga_progress WHERE user_id = $1', [userId]);
    return new Map(rows.map((r) => [r.stage_id, r]));
  }

  /** Số câu đã sai còn chờ ôn của từng chặng */
  private async dueByStage(q: Q, userId: number): Promise<Map<number, number>> {
    const rows = await q<{ stage_id: number; n: number }>(
      'SELECT i.stage_id, count(*)::int AS n FROM hk_saga_review r JOIN hk_saga_items i ON i.id = r.item_id WHERE r.user_id = $1 AND r.cleared_at IS NULL AND i.is_active GROUP BY i.stage_id', [userId]);
    return new Map(rows.map((r) => [r.stage_id, r.n]));
  }

  /** Chặng bị khóa khi chặng điều kiện (đã công bố) chưa hoàn thành; điều kiện trỏ tới chặng chưa công bố thì không khóa để học sinh không bị kẹt */
  private lockOf(stage: StageBrief, all: StageBrief[], progress: Map<number, ProgressRow>): string | null {
    if (!stage.unlock_after) return null;
    const need = all.find((s) => s.code === stage.unlock_after);
    if (!need || progress.get(need.id)?.completed_at) return null;
    return `Hoàn thành chặng “${need.title}” để mở`;
  }

  private stateOf(_stage: StageBrief, p: ProgressRow | undefined, lock: string | null, due: number): StageState {
    // "cần ôn": còn câu đã sai chưa ôn lại, hoặc phần nhập vai phải xem gợi ý / làm sai từ ba lần trở lên
    if (p?.completed_at) return due > 0 || p.explore_hints + p.explore_mistakes >= 3 ? 'review' : 'done';
    if (lock) return 'locked';
    return p && (p.lesson_done_at || p.practice_tries > 0) ? 'learning' : 'ready';
  }

  private steps(stage: StageBrief, p: ProgressRow | undefined, locked: boolean) {
    const lesson = p?.lesson_done_at ? 'done' : locked ? 'locked' : 'ready';
    const practice = p?.practice_passed_at ? 'done' : lesson === 'done' ? 'ready' : 'locked';
    const explore = p?.explore_done_at ? 'done' : practice === 'done' ? 'ready' : 'locked';
    const battle = !stage.has_battle ? 'none' : p?.battle_won_at ? 'done' : practice === 'done' ? 'ready' : 'locked';
    const next = locked ? null : lesson !== 'done' ? 'lesson' : practice !== 'done' ? 'practice' : explore !== 'done' ? 'explore' : 'replay';
    return { lesson, practice, explore, battle, next };
  }

  private brief(stage: StageBrief, all: StageBrief[], progress: Map<number, ProgressRow>, due: Map<number, number>) {
    const p = progress.get(stage.id);
    const lock = this.lockOf(stage, all, progress);
    const inCampaign = all.filter((s) => s.campaign_no === stage.campaign_no);
    return {
      id: stage.id, code: stage.code, campaign_no: stage.campaign_no, position: stage.position, order: inCampaign.findIndex((s) => s.id === stage.id) + 1, title: stage.title, place: stage.place,
      date_label: stage.date_label, kind: stage.kind, icon: stage.icon, summary: stage.summary, map_x: stage.map_x, map_y: stage.map_y, anchor_x: stage.anchor_x, anchor_y: stage.anchor_y,
      has_battle: stage.has_battle, battle_mode: stage.battle_mode, state: this.stateOf(stage, p, lock, due.get(stage.id) ?? 0), lock_reason: p?.completed_at ? null : lock,
      stars: p?.stars ?? 0, knowledge_percent: p?.practice_best ?? 0, battle_stars: p?.battle_stars ?? 0, review_due: due.get(stage.id) ?? 0, steps: this.steps(stage, p, Boolean(lock) && !p?.completed_at),
    };
  }

  // ------------------------------------------------------------------ trang chủ và bản đồ
  async home(user: UserRow) {
    const hud = await this.game.me(user);
    const quests = await this.game.quests(user);
    const q = this.read;
    const all = await this.stages(q);
    const progress = await this.progressMap(q, user.id);
    const due = await this.dueByStage(q, user.id);
    const maps = await q<Record<string, any>>('SELECT campaign_no, title, short_title, years, enemy, places, summary FROM hk_saga_maps ORDER BY campaign_no');
    const briefs = all.map((s) => this.brief(s, all, progress, due));
    const campaigns = maps.map((m) => {
      const list = briefs.filter((b) => b.campaign_no === m.campaign_no);
      const done = list.filter((b) => b.state === 'done' || b.state === 'review').length;
      const started = list.some((b) => b.state !== 'ready' && b.state !== 'locked');
      return { ...m, stages: list.length, done, stars: list.reduce((n, b) => n + b.stars, 0), max_stars: list.length * 3, percent: list.length ? Math.round((done / list.length) * 100) : 0,
        completed: list.length > 0 && done === list.length, is_new: list.length > 0 && !started, available: list.length > 0 };
    });
    const next = briefs.find((b) => b.state === 'learning') ?? briefs.find((b) => b.state === 'ready') ?? null;
    const daily = (quests.daily as Array<Record<string, any>>).find((d) => !d.completed_at) ?? (quests.daily as Array<Record<string, any>>)[0] ?? null;
    const dailyDone = (quests.daily as Array<Record<string, any>>).filter((d) => d.completed_at).length;
    return {
      learner: { name: user.nickname || user.full_name, full_name: user.full_name, avatar_url: user.avatar_url, class_name: user.class_name },
      hud: { level: hud.level, gold: hud.gold, xp: hud.xp, streak: hud.streak, daily: hud.daily, unseen_celebrations: hud.unseen_celebrations },
      campaigns, next: next ? { stage_id: next.id, title: next.title, campaign_no: next.campaign_no, state: next.state } : null,
      daily: daily ? { title: daily.title, progress: daily.progress, target: daily.target, done: Boolean(daily.completed_at), reward_xp: daily.reward_xp, reward_gold: daily.reward_gold, done_count: dailyDone, total: (quests.daily as unknown[]).length } : null,
      review_due: [...due.values()].reduce((n, x) => n + x, 0), totals: { stages: briefs.length, done: briefs.filter((b) => b.state === 'done' || b.state === 'review').length },
      look: (await this.db.tx((t) => this.wardrobe(t, user))).equipped,
    };
  }

  async campaign(user: UserRow, campaignNo: number) {
    const q = this.read;
    const map = (await q<Record<string, any>>('SELECT campaign_no, title, short_title, years, enemy, places, summary, image_key, image_url, image_w, image_h, credit, credit_url FROM hk_saga_maps WHERE campaign_no = $1', [campaignNo]))[0];
    if (!map) throw notFound('cuộc kháng chiến');
    const all = await this.stages(q);
    const progress = await this.progressMap(q, user.id);
    const due = await this.dueByStage(q, user.id);
    const stages = all.filter((s) => s.campaign_no === campaignNo).map((s) => this.brief(s, all, progress, due));
    const done = stages.filter((s) => s.state === 'done' || s.state === 'review').length;
    return { map, stages, current_stage_id: (stages.find((s) => s.state === 'learning') ?? stages.find((s) => s.state === 'ready'))?.id ?? null,
      totals: { stages: stages.length, done, stars: stages.reduce((n, s) => n + s.stars, 0), max_stars: stages.length * 3 },
      chests: await this.chestsOf(q, user, campaignNo, stages) };
  }

  // ------------------------------------------------------------------ hòm báu trên bản đồ (17/11/2026)
  /** Các hòm của một phần: `s<id chặng>` sau mỗi chặng (trừ chặng cuối), `p<số phần>` ở cuối phần; trạng thái khóa / sẵn sàng / đã mở theo sổ cái */
  private async chestsOf(q: Q, user: UserRow, campaignNo: number, stages: Array<{ id: number; order: number; state: string }>) {
    const opened = new Set((await q<{ ref_key: string }>("SELECT ref_key FROM hk_gold_ledger WHERE user_id = $1 AND reason = 'chest'", [user.id])).map((r) => r.ref_key));
    const isDone = (st: { state: string }) => st.state === 'done' || st.state === 'review';
    const out: Array<{ key: string; kind: 'stage' | 'part'; after: number; ready: boolean }> =
      stages.slice(0, -1).map((st) => ({ key: `s${st.id}`, kind: 'stage', after: st.order, ready: isDone(st) }));
    if (stages.length) out.push({ key: `p${campaignNo}`, kind: 'part', after: stages.length, ready: stages.every(isDone) });
    return out.map(({ ready, ...c }) => ({ ...c, state: opened.has(`hq:chest:${c.key}`) ? 'opened' : ready ? 'ready' : 'locked', max_gold: chestMaxGold(c.kind), odds: chestOdds(c.kind) }));
  }

  /** Mở hòm báu: máy chủ kiểm tra điều kiện (xong chặng trước / xong cả phần) rồi trao vàng, điểm qua sổ cái – mỗi hòm chỉ một lần */
  async openChest(user: UserRow, key: string) {
    const m = /^(s)(\d{1,9})$|^(p)([1-3])$/.exec(key);
    if (!m) throw notFound('hòm báu');
    return this.db.tx(async (q) => {
      const all = await this.stages(q);
      const progress = await this.progressMap(q, user.id);
      const doneOf = (id: number) => Boolean(progress.get(id)?.completed_at);
      let kind: 'stage' | 'part';
      if (m[1]) {
        const id = Number(m[2]);
        const st = all.find((x) => x.id === id);
        const part = st ? all.filter((x) => x.campaign_no === st.campaign_no) : [];
        if (!st || part[part.length - 1]?.id === id) throw notFound('hòm báu');
        if (!doneOf(id)) throw new ConflictException(`Hoàn thành chặng “${st.title}” để mở hòm báu này`);
        kind = 'stage';
      } else {
        const part = all.filter((x) => x.campaign_no === Number(m[4]));
        if (!part.length) throw notFound('hòm báu');
        if (!part.every((x) => doneOf(x.id))) throw new ConflictException('Hoàn thành mọi chặng của phần này để mở hòm báu cuối phần');
        kind = 'part';
      }
      const roll = rollChest(user.id, key, kind);
      const ref = `hq:chest:${key}`;
      const before = await this.wardrobe(q, user);
      // Khiên giữ chuỗi: đã đủ số khiên tối đa thì đổi ra vàng
      const freezeMax = (await this.game.cfg()).streak.freeze_max;
      const freezesNow = Number((await q<{ freezes: number }>('SELECT freezes FROM hk_players WHERE user_id = $1', [user.id]))[0]?.freezes ?? 0);
      const freezeOk = roll.freeze > 0 && freezesNow < freezeMax;
      const goldTotal = roll.gold + (roll.freeze > 0 && !freezeOk ? FREEZE_AS_GOLD : 0);
      const first = await this.game.addGold(q, user, goldTotal, 'chest', ref);
      if (first && freezeOk) await q('UPDATE hk_players SET freezes = freezes + 1, updated_at = now() WHERE user_id = $1', [user.id]);
      let xp = 0;
      if (first && roll.xp && (await this.game.awardXp(q, user, roll.xp, 'chest', ref))) xp = roll.xp;
      if (first) await logEvent(null, user, 'chest_open', 'saga_chest', null, null, { key, rarity: roll.rarity }, null, q);
      // khung / danh hiệu vừa mở khóa nhờ hòm này; ô nào đang trống thì trang bị luôn
      const after = await this.wardrobe(q, user);
      const fresh = (list: Array<{ code: string; unlocked: boolean }>, old: Array<{ code: string; unlocked: boolean }>) => list.filter((x) => x.unlocked && !old.find((o) => o.code === x.code)?.unlocked);
      const gained = [
        ...fresh(after.frames, before.frames).map((x) => ({ ...(x as (typeof after.frames)[number]), kind: 'frame' as const })),
        ...fresh(after.titles, before.titles).map((x) => ({ ...(x as (typeof after.titles)[number]), kind: 'title' as const })),
      ];
      const auto: Record<string, string> = {};
      const newFrame = gained.filter((x) => x.kind === 'frame').pop(), newTitle = gained.filter((x) => x.kind === 'title').pop();
      if (newFrame && !after.equipped.frame) auto.saga_frame = newFrame.code;
      if (newTitle && !after.equipped.title) auto.saga_title = newTitle.code;
      if (Object.keys(auto).length) await q('UPDATE hk_players SET appearance = appearance || $2::jsonb, updated_at = now() WHERE user_id = $1', [user.id, JSON.stringify(auto)]);
      const unlocked = gained.map((x) => ({ kind: x.kind, code: x.code, name: x.name, rarity: x.rarity, equipped: auto[x.kind === 'frame' ? 'saga_frame' : 'saga_title'] === x.code }));
      // gợi ý món sắp mở khóa để học sinh muốn mở tiếp
      const nextTitle = TITLES.find((t) => after.opened < t.min) ?? null;
      return {
        key, kind, first, rarity: roll.rarity, gold: first ? goldTotal : 0, xp, freeze: first && freezeOk ? 1 : 0, freeze_as_gold: first && roll.freeze > 0 && !freezeOk ? FREEZE_AS_GOLD : 0,
        unlocked, opened: after.opened, total: after.total, odds: chestOdds(kind),
        next: nextTitle ? { name: nextTitle.name, rarity: nextTitle.rarity, left: nextTitle.min - after.opened } : null,
      };
    });
  }

  // ------------------------------------------------------------------ khung ảnh đại diện và danh hiệu (17/11/2026)
  /** Kho trang phục: danh mục khung / danh hiệu kèm trạng thái mở khóa theo các hòm đã mở và món đang trang bị */
  private async wardrobe(q: Q, user: UserRow) {
    await this.game.fresh(q, user);
    const opened = new Set((await q<{ ref_key: string }>("SELECT ref_key FROM hk_gold_ledger WHERE user_id = $1 AND reason = 'chest'", [user.id])).map((r) => r.ref_key.replace(/^hq:chest:/, '')));
    const look = ((await q<{ appearance: Record<string, unknown> }>('SELECT appearance FROM hk_players WHERE user_id = $1', [user.id]))[0]?.appearance ?? {}) as Record<string, unknown>;
    const frames = FRAMES.map((f) => ({ code: f.code, name: f.name, rarity: f.rarity, need: f.need, unlocked: opened.has(f.chest) }));
    const awards = await this.awardsOf(q, user);
    const titles = [...TITLES.map((t) => ({ code: t.code, name: t.name, rarity: t.rarity, need: `Mở ${t.min} hòm báu trên bản đồ`, unlocked: opened.size >= t.min })),
      ...WORLD_TITLES.map((t) => ({ code: t.code, name: t.name, rarity: t.rarity as Rarity, need: t.need, unlocked: awards.has(`title:${t.code}`) }))];
    const pick = (list: Array<{ code: string; name: string; rarity: Rarity; unlocked: boolean }>, code: unknown) => {
      const x = list.find((i) => i.code === code && i.unlocked);
      return x ? { code: x.code, name: x.name, rarity: x.rarity } : null;
    };
    const avatar = typeof look.saga_avatar === 'string' && AVATARS.includes(look.saga_avatar) ? look.saga_avatar : null;
    return { frames, titles, avatars: AVATARS, opened: opened.size, total: (await this.stages(q)).length, equipped: { frame: pick(frames, look.saga_frame), title: pick(titles, look.saga_title), avatar } };
  }

  async cosmetics(user: UserRow) {
    return this.db.tx((q) => this.wardrobe(q, user));
  }

  /** Trang bị khung / danh hiệu (null = bỏ; chỉ nhận món đã mở khóa) và ảnh đại diện có sẵn (null = dùng ảnh / chữ cái của em) */
  async equip(user: UserRow, body: { frame?: string | null; title?: string | null; avatar?: string | null }) {
    return this.db.tx(async (q) => {
      const w = await this.wardrobe(q, user);
      const patch: Record<string, string | null> = {};
      const slots: Array<['frame' | 'title', Array<{ code: string; name: string; unlocked: boolean }>, string]> = [['frame', w.frames, 'saga_frame'], ['title', w.titles, 'saga_title']];
      for (const [field, list, key] of slots) {
        const code = body[field];
        if (code === undefined) continue;
        if (code !== null) {
          const item = list.find((x) => x.code === code);
          if (!item) throw notFound(field === 'frame' ? 'khung' : 'danh hiệu');
          if (!item.unlocked) throw new ConflictException(`Em chưa mở khóa “${item.name}”`);
        }
        patch[key] = code;
      }
      if (body.avatar !== undefined) {
        if (body.avatar !== null && !AVATARS.includes(body.avatar)) throw notFound('ảnh đại diện');
        patch.saga_avatar = body.avatar;
      }
      if (Object.keys(patch).length) await q('UPDATE hk_players SET appearance = appearance || $2::jsonb, updated_at = now() WHERE user_id = $1', [user.id, JSON.stringify(patch)]);
      return this.wardrobe(q, user);
    });
  }

  /** Chặng mà học sinh đang được phép học; ném 404 khi không có, 409 khi còn khóa (sửa request không mở được chặng khóa) */
  private async openStage(q: Q, user: UserRow, stageId: number): Promise<{ stage: StageRow; progress: ProgressRow | undefined; all: StageBrief[] }> {
    const stage = await this.stage(q, stageId);
    const all = await this.stages(q);
    const map = await this.progressMap(q, user.id);
    const p = map.get(stage.id);
    const lock = p?.completed_at ? null : this.lockOf(stage, all, map);
    if (lock) throw new ConflictException(lock);
    return { stage, progress: p, all };
  }

  async stageDetail(user: UserRow, stageId: number) {
    const q = this.read;
    const stage = await this.stage(q, stageId);
    const all = await this.stages(q);
    const progress = await this.progressMap(q, user.id);
    const due = await this.dueByStage(q, user.id);
    const brief = this.brief(stage, all, progress, due);
    const p = progress.get(stage.id);
    const items = await q<{ kind: ItemKind; n: number }>("SELECT kind, count(*)::int AS n FROM hk_saga_items WHERE stage_id = $1 AND is_active AND usage IN ('practice', 'both') GROUP BY kind ORDER BY kind", [stage.id]);
    const card = stage.card_code ? (await q<Record<string, any>>('SELECT code, name, title, rarity, portrait FROM hk_saga_cards WHERE code = $1', [stage.card_code]))[0] ?? null : null;
    const next = all.find((s) => s.unlock_after === stage.code) ?? null;
    return {
      ...brief, objectives: stage.content.objectives, cards_count: stage.content.cards.length, pass_percent: stage.pass_percent,
      practice: { items: items.reduce((n, i) => n + i.n, 0), kinds: items.map((i) => ({ kind: i.kind, label: KIND_LABEL[i.kind], count: i.n })), best: p?.practice_best ?? 0, tries: p?.practice_tries ?? 0, passed: Boolean(p?.practice_passed_at) },
      explore: { title: stage.content.explore.title, done: Boolean(p?.explore_done_at), hints: p?.explore_hints ?? 0, mistakes: p?.explore_mistakes ?? 0 },
      battle: stage.content.battle ? { title: stage.content.battle.title, mode: stage.content.battle.mode, best: p?.battle_best ?? 0, stars: p?.battle_stars ?? 0, tries: p?.battle_tries ?? 0, won: Boolean(p?.battle_won_at) } : null,
      rewards: { xp: stage.reward_xp, gold: stage.reward_gold, card: card ? { ...card, hidden: !p?.completed_at } : null, has_badge: Boolean(stage.badge_code) },
      completed_at: p?.completed_at ?? null, unlocks_next: next ? { id: next.id, title: next.title } : null,
    };
  }

  // ------------------------------------------------------------------ học ngắn
  async lesson(user: UserRow, stageId: number) {
    const { stage, progress } = await this.openStage(this.read, user, stageId);
    await logEvent(this.db, user, 'view_lesson', 'saga_stage', stage.id);
    return { stage: { id: stage.id, title: stage.title, place: stage.place, date_label: stage.date_label, campaign_no: stage.campaign_no }, ...lessonView(stage.content), done: Boolean(progress?.lesson_done_at) };
  }

  async completeLesson(user: UserRow, stageId: number) {
    return this.db.tx(async (q) => {
      const { stage } = await this.openStage(q, user, stageId);
      const p = await this.lockProgress(q, user, stage.id);
      let xp = 0;
      if (!p.lesson_done_at) {
        await q('UPDATE hk_saga_progress SET lesson_done_at = now(), updated_at = now() WHERE user_id = $1 AND stage_id = $2', [user.id, stage.id]);
        if (await this.game.awardXp(q, user, XP.lesson, 'lesson', `hq:lesson:${stage.id}`)) xp = XP.lesson;
        await this.game.onLessonCompleted(q, user);
        await logEvent(null, user, 'lesson_complete', 'saga_stage', stage.id, null, null, null, q);
      }
      return { done: true, first: !p.lesson_done_at, xp };
    });
  }

  /** Dòng tiến độ của học sinh ở một chặng, đã khóa để các thao tác trong cùng giao dịch không giẫm lên nhau */
  private async lockProgress(q: Q, user: UserRow, stageId: number): Promise<ProgressRow> {
    await q('INSERT INTO hk_saga_progress (user_id, stage_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, stageId]);
    return (await q<ProgressRow>('SELECT * FROM hk_saga_progress WHERE user_id = $1 AND stage_id = $2 FOR UPDATE', [user.id, stageId]))[0];
  }

  // ------------------------------------------------------------------ phiên chơi
  private async items(q: Q, ids: number[]): Promise<Map<number, ItemRow & { stage_id: number }>> {
    const rows = await q<ItemRow & { stage_id: number }>('SELECT id, stage_id, kind, prompt, data, explanation, objective, source FROM hk_saga_items WHERE id = ANY($1)', [ids]);
    return new Map(rows.map((r) => [r.id, r]));
  }

  /**
   * Bắt đầu hoặc tiếp tục một phiên của chặng. Mỗi học sinh chỉ có một phiên đang mở cho mỗi chặng và mỗi loại: gọi lại (tải lại trang, thiết bị khác) nhận đúng phiên đó;
   * `restart` đóng phiên cũ (ghi là bỏ dở) rồi mở phiên mới.
   */
  async start(user: UserRow, stageId: number, kind: Exclude<SessionKind, 'review'>, restart = false, opts: { classId?: number } = {}) {
    return this.db.tx(async (q) => {
      const { stage } = await this.openStage(q, user, stageId);
      const p = await this.lockProgress(q, user, stage.id);
      const active = (await q<SessionRow>(`SELECT ${SESSION_COLS} FROM hk_saga_sessions WHERE user_id = $1 AND stage_id = $2 AND kind = $3 AND status = 'active' FOR UPDATE`, [user.id, stage.id, kind]))[0];
      // chặng đã chuyển sang thế giới khối (21/11/2026) mà phiên đang mở là cảnh 2D cũ: mở phiên mới thay vì tiếp tục cảnh cũ
      const legacy = kind === 'explore' && Boolean(active) && Boolean(stage.content.world) && !isWorldState(active!.state);
      if (active && !restart && !legacy) return { ...(await this.view(q, user, active, stage)), resumed: true, events: [] };
      if (active) await q("UPDATE hk_saga_sessions SET status = 'abandoned', finished_at = now(), updated_at = now() WHERE id = $1", [active.id]);

      let state: Record<string, any>;
      let events: unknown[] = [];
      if (kind === 'practice') {
        if (!p.lesson_done_at) throw new ConflictException('Hãy học xong các thẻ kiến thức trước khi luyện tập');
        const rows = await q<ItemRow>("SELECT id, kind, prompt, data, explanation, objective, source FROM hk_saga_items WHERE stage_id = $1 AND is_active AND usage IN ('practice', 'both') ORDER BY position", [stage.id]);
        if (!rows.length) throw new ConflictException('Chặng này chưa có câu luyện tập');
        const seed = Math.floor(Math.random() * 2 ** 30);
        state = { v: 1, slots: rows.map((r, i) => newSlot(r, seed + i * 977)) } satisfies PracticeState;
      } else if (kind === 'explore') {
        if (!p.practice_passed_at) throw new ConflictException(`Hãy đạt ít nhất ${stage.pass_percent}% phần luyện tập trước khi nhập vai`);
        // chặng có nhiệm vụ thế giới khối: vào phòng chung của lớp em (mỗi lớp một phòng cho mỗi cuộc kháng chiến)
        const world = await this.worldOf(q, stage);
        state = world ? newWorld(await this.worldRoom(q, (await this.worldClass(q, user, opts.classId)).id, stage.campaign_no)) : newExplore();
      } else {
        if (!stage.content.battle) throw new ConflictException('Chặng này không có trận đánh');
        if (!p.practice_passed_at) throw new ConflictException(`Hãy đạt ít nhất ${stage.pass_percent}% phần luyện tập trước khi ra trận`);
        // lần đầu phải đi tới điểm chạm trán trong cảnh khám phá; sau khi đã thắng thì được chơi lại trực tiếp
        if (!p.battle_won_at && !(await this.atBattleStep(q, user, stage))) throw new ConflictException('Hãy nhập vai và tìm tới nơi quân địch trước khi ra trận');
        const made = stage.content.battle.mode === 'bachdang' ? createBachDang(stage.content.battle) : createTactics(stage.content.battle, p.practice_best);
        state = { v: 1, mode: stage.content.battle.mode, engine: made.state, knowledge: p.practice_best } satisfies BattleSessionState;
        events = made.events;
        await q('UPDATE hk_saga_progress SET battle_tries = battle_tries + 1, updated_at = now() WHERE user_id = $1 AND stage_id = $2', [user.id, stage.id]);
      }
      const row = (await q<SessionRow>(`INSERT INTO hk_saga_sessions (user_id, stage_id, kind, state) VALUES ($1, $2, $3, $4) RETURNING ${SESSION_COLS}`, [user.id, stage.id, kind, JSON.stringify(state)]))[0];
      return { ...(await this.view(q, user, row, stage)), resumed: false, events };
    });
  }

  /** Học sinh đang đứng ở bước chạm trán của cảnh khám phá đang mở? */
  private async atBattleStep(q: Q, user: UserRow, stage: StageRow): Promise<boolean> {
    const s = (await q<{ state: ExploreState | WorldState }>("SELECT state FROM hk_saga_sessions WHERE user_id = $1 AND stage_id = $2 AND kind = 'explore' AND status = 'active'", [user.id, stage.id]))[0];
    if (!s) return false;
    if (isWorldState(s.state)) return (await this.worldOf(q, stage))?.quest.steps[s.state.step]?.type === 'battle';
    return stage.content.explore.steps[s.state.step]?.type === 'battle';
  }

  private async owned(q: Q, user: UserRow, sessionId: number, lock: boolean): Promise<SessionRow> {
    const row = (await q<SessionRow>(`SELECT ${SESSION_COLS} FROM hk_saga_sessions WHERE id = $1 AND user_id = $2${lock ? ' FOR UPDATE' : ''}`, [sessionId, user.id]))[0];
    if (!row) throw notFound('phiên chơi');
    return row;
  }

  async session(user: UserRow, sessionId: number) {
    const q = this.read;
    const row = await this.owned(q, user, sessionId, false);
    return this.view(q, user, row, row.stage_id ? await this.stage(q, row.stage_id) : null);
  }

  /** Trạng thái phiên gửi cho trình duyệt (không chứa đáp án) */
  private async view(q: Q, user: UserRow, row: SessionRow, stage: StageRow | null): Promise<Record<string, any>> {
    const head = { session_id: row.id, kind: row.kind, seq: row.seq, status: row.status, result: row.result, stage: stage ? { id: stage.id, title: stage.title, place: stage.place, date_label: stage.date_label, campaign_no: stage.campaign_no } : null };
    if (row.kind === 'practice' || row.kind === 'review') {
      const st = row.state as PracticeState | ReviewState;
      const items = await this.items(q, st.slots.map((s) => s.item_id));
      const index = st.slots.findIndex((s) => !s.done);
      const stageTitles = row.kind === 'review' ? new Map((await this.stages(q)).map((s) => [s.id, s.title])) : null;
      return {
        ...head, pass_percent: stage?.pass_percent ?? null, index: index < 0 ? st.slots.length : index, total: st.slots.length,
        items: st.slots.map((slot) => {
          const item = items.get(slot.item_id)!;
          return { ...publicItem(item, slot), score: slot.done ? slot.score : null, stage_title: stageTitles?.get(item.stage_id) ?? null };
        }),
        ...(row.kind === 'review' ? { timer: this.reviewTimer(st as ReviewState), streak: (st as ReviewState).streak } : {}),
      };
    }
    if (row.kind === 'explore') {
      const p = (await q<ProgressRow>('SELECT * FROM hk_saga_progress WHERE user_id = $1 AND stage_id = $2', [user.id, stage!.id]))[0];
      const battle = stage!.content.battle ? { title: stage!.content.battle.title, mode: stage!.content.battle.mode, won: this.battleWon(p, row) } : null;
      if (isWorldState(row.state)) return { ...head, ...(await this.worldView(q, user, stage!, row.state)), battle };
      return { ...head, ...publicExplore(stage!.content.explore, row.state as ExploreState), battle };
    }
    const b = row.state as BattleSessionState;
    return { ...head, knowledge: b.knowledge, ...(b.mode === 'bachdang' ? publicBachDang(stage!.content.battle as BdScenario, b.engine as BdState) : publicTactics(stage!.content.battle as TacticsScenario, b.engine as TState)) };
  }

  /** Trận của chặng đã thắng kể từ khi mở cảnh khám phá này (hoặc chặng đã hoàn thành từ trước và đang chơi lại) */
  private battleWon(p: ProgressRow | undefined, explore: SessionRow): boolean {
    if (!p?.battle_won_at) return false;
    return Boolean(p.completed_at) || new Date(p.battle_won_at).getTime() >= new Date(explore.started_at).getTime();
  }

  private reviewTimer(st: ReviewState): { limit_s: number; left_ms: number } | null {
    const slot = st.slots.find((s) => !s.done);
    if (!slot || !slot.served_at) return null;
    return { limit_s: slot.limit_s, left_ms: Math.max(0, slot.limit_s * 1000 - (this.game.clock.now().getTime() - slot.served_at)) };
  }

  /**
   * Một lệnh của người chơi trong phiên. Kiểm tra chủ sở hữu, mã lệnh (gửi lặp trả lại kết quả cũ), số thứ tự (lệnh lệch trạng thái bị từ chối),
   * rồi mới xử lý; trạng thái mới, nhật ký lệnh, tiến độ và phần thưởng được ghi trong cùng một giao dịch.
   */
  async act(user: UserRow, sessionId: number, body: { action_id: string; seq: number; action: Record<string, any> }) {
    if (!isObj(body.action) || typeof body.action.type !== 'string') throw new BadRequestException('Lệnh không hợp lệ');
    const pending: WorldPending[] = [];
    const res = await this.db.tx(async (q) => {
      const row = await this.owned(q, user, sessionId, true);
      const stage = row.stage_id ? await this.stage(q, row.stage_id) : null;
      // gửi lặp (bấm hai lần, mạng chập chờn, kết nối lại): trả kết quả đã lưu kèm trạng thái hiện tại, không xử lý và không thưởng lần hai
      const dup = (await q<{ outcome: Record<string, any> }>('SELECT outcome FROM hk_saga_actions WHERE session_id = $1 AND action_id = $2', [row.id, body.action_id]))[0];
      if (dup) return { ...dup.outcome, view: await this.view(q, user, row, stage), replayed: true };
      if (row.status !== 'active') throw new ConflictException('Phiên chơi này đã kết thúc');
      if (body.seq !== row.seq) throw new ConflictException('Trạng thái phiên đã thay đổi (có thể em đang chơi ở một thẻ khác). Tải lại để tiếp tục.');
      const p = stage ? await this.lockProgress(q, user, stage.id) : undefined;

      let outcome: Record<string, any>;
      let finished: Record<string, any> | null = null;
      if (row.kind === 'practice') ({ outcome, finished } = await this.actPractice(q, user, row, stage!, p!, body.action));
      else if (row.kind === 'review') ({ outcome, finished } = await this.actReview(q, user, row, body.action));
      else if (row.kind === 'explore') ({ outcome, finished } = await this.actExplore(q, user, row, stage!, p!, body.action, pending));
      else ({ outcome, finished } = await this.actBattle(q, user, row, stage!, p!, body.action));

      row.seq += 1;
      if (finished) { row.status = 'done'; row.result = finished; }
      await q(`UPDATE hk_saga_sessions SET state = $2, seq = $3, status = $4, result = $5, updated_at = now(), finished_at = CASE WHEN $4 = 'done' THEN now() ELSE finished_at END WHERE id = $1`,
        [row.id, JSON.stringify(row.state), row.seq, row.status, row.result ? JSON.stringify(row.result) : null]);
      const completion = stage && finished ? await this.maybeComplete(q, user, stage) : null;
      const saved = { seq: row.seq, outcome, finished, completion };
      await q('INSERT INTO hk_saga_actions (session_id, seq, user_id, action_id, action, outcome) VALUES ($1, $2, $3, $4, $5, $6)', [row.id, row.seq, user.id, body.action_id, JSON.stringify(body.action), JSON.stringify(saved)]);
      return { ...saved, view: await this.view(q, user, row, stage), replayed: false };
    });
    // thế giới chung: ô vừa thu hoạch chờ mọc lại, khối vừa đặt – phát cho cả phòng sau khi đã ghi xong
    for (const c of pending) {
      if (c.kind === 'take') this.hub.publish(c.room, 'world:node', { x: c.x, z: c.z, until: this.hub.take(c.room, c.x, c.z, this.worldNow()) });
      else this.hub.publish(c.room, 'world:block', { placed: c.placed, removed: c.removed });
    }
    return res;
  }

  // ------------------------------------------------------------------ luyện tập
  private async recordAnswer(q: Q, user: UserRow, item: ItemRow & { stage_id: number }, sessionId: number, mode: 'practice' | 'review', correct: boolean): Promise<void> {
    await q('INSERT INTO hk_saga_answers (user_id, item_id, stage_id, session_id, mode, correct) VALUES ($1, $2, $3, $4, $5, $6)', [user.id, item.id, item.stage_id, sessionId, mode, correct]);
    if (correct) {
      await this.game.onCorrectAnswer(q, user);
      if (mode === 'review') await q('UPDATE hk_saga_review SET cleared_at = now() WHERE user_id = $1 AND item_id = $2 AND cleared_at IS NULL', [user.id, item.id]);
    } else {
      await q(`INSERT INTO hk_saga_review (user_id, item_id) VALUES ($1, $2)
               ON CONFLICT (user_id, item_id) DO UPDATE SET wrong_count = hk_saga_review.wrong_count + 1, last_wrong_at = now(), cleared_at = NULL`, [user.id, item.id]);
    }
  }

  /** Giải thích và nguồn của một câu, chỉ gửi sau khi học sinh đã trả lời */
  private async explain(q: Q, item: ItemRow & { stage_id: number }): Promise<Record<string, unknown>> {
    const row = (await q<{ title: string; src: Record<string, any> | null; obj: Record<string, any> | null }>(
      `SELECT s.title, (SELECT x FROM jsonb_array_elements(s.content->'sources') x WHERE x->>'key' = $2 LIMIT 1) AS src,
              (SELECT x FROM jsonb_array_elements(s.content->'objectives') x WHERE x->>'id' = $3 LIMIT 1) AS obj
       FROM hk_saga_stages s WHERE s.id = $1`, [item.stage_id, item.source, item.objective]))[0];
    return { explanation: item.explanation, source: row?.src ?? null, objective_text: row?.obj?.text ?? null, stage_title: row?.title ?? null };
  }

  private async actPractice(q: Q, user: UserRow, row: SessionRow, stage: StageRow, p: ProgressRow, action: Record<string, any>) {
    if (action.type !== 'answer') throw new BadRequestException('Phần luyện tập chỉ nhận câu trả lời');
    const st = row.state as PracticeState;
    const slot = st.slots.find((s) => s.item_id === Number(action.item_id)) ?? (() => { throw new BadRequestException('Câu này không thuộc lượt luyện tập'); })();
    const item = (await this.items(q, [slot.item_id])).get(slot.item_id)!;
    const graded = gradeItem(item, slot, action.answer);
    let outcome: Record<string, any> = { item_id: item.id, ...graded };
    if (graded.done) {
      await this.recordAnswer(q, user, item, row.id, 'practice', graded.score >= 1);
      outcome = { ...outcome, ...(await this.explain(q, item)) };
    }
    if (!st.slots.every((s) => s.done)) return { outcome, finished: null };
    const t = tally(st.slots, stage.pass_percent);
    const firstPass = t.passed && !p.practice_passed_at;
    await q(`UPDATE hk_saga_progress SET practice_best = GREATEST(practice_best, $3), practice_tries = practice_tries + 1,
               practice_passed_at = COALESCE(practice_passed_at, CASE WHEN $4 THEN now() END), updated_at = now() WHERE user_id = $1 AND stage_id = $2`, [user.id, stage.id, t.percent, t.passed]);
    let xp = 0;
    if (firstPass && (await this.game.awardXp(q, user, XP.practice, 'practice', `hq:practice:${stage.id}`))) xp = XP.practice;
    await logEvent(null, user, 'attempt_finish', 'saga_stage', stage.id, null, { percent: t.percent, passed: t.passed }, null, q);
    return { outcome, finished: { ...t, pass_percent: stage.pass_percent, best: Math.max(p.practice_best, t.percent), first_pass: firstPass, xp } };
  }

  // ------------------------------------------------------------------ nhập vai khám phá
  private async actExplore(q: Q, user: UserRow, row: SessionRow, stage: StageRow, p: ProgressRow, action: Record<string, any>, pending: WorldPending[]) {
    if (isWorldState(row.state)) {
      const events = await this.actWorld(q, user, row, stage, p, action, pending);
      const ws = row.state as WorldState;
      return { outcome: { events }, finished: ws.done ? await this.exploreDone(q, user, stage, p, ws.hints, ws.mistakes) : null };
    }
    const st = row.state as ExploreState;
    if (!['interact', 'answer', 'hint'].includes(action.type)) throw new BadRequestException('Lệnh không hợp lệ trong cảnh khám phá');
    const events = applyExplore(stage.content.explore, st, action as any, this.battleWon(p, row));
    if (!st.done) return { outcome: { events }, finished: null };
    return { outcome: { events }, finished: await this.exploreDone(q, user, stage, p, st.hints, st.mistakes) };
  }

  /** Xong bước nhập vai (cảnh 2D hoặc thế giới khối): ghi tiến độ, thưởng điểm lần đầu */
  private async exploreDone(q: Q, user: UserRow, stage: StageRow, p: ProgressRow, hints: number, mistakes: number) {
    const first = !p.explore_done_at;
    await q(`UPDATE hk_saga_progress SET explore_done_at = COALESCE(explore_done_at, now()), explore_hints = CASE WHEN explore_done_at IS NULL THEN $3 ELSE LEAST(explore_hints, $3) END,
               explore_mistakes = CASE WHEN explore_done_at IS NULL THEN $4 ELSE LEAST(explore_mistakes, $4) END, updated_at = now() WHERE user_id = $1 AND stage_id = $2`, [user.id, stage.id, hints, mistakes]);
    let xp = 0;
    if (first && (await this.game.awardXp(q, user, XP.explore, 'node', `hq:explore:${stage.id}`))) xp = XP.explore;
    return { hints, mistakes, first, xp, suggest_review: hints + mistakes >= 3 };
  }

  // ------------------------------------------------------------------ thế giới khối (21/11/2026)
  /** Bản đồ khối của cuộc kháng chiến và nhiệm vụ của chặng; null khi chặng vẫn dùng cảnh nhập vai 2D */
  private async worldOf(q: Q, stage: StageRow): Promise<{ map: WorldMap; quest: WorldQuest } | null> {
    if (!stage.content.world) return null;
    const map = await this.worldMapOf(q, stage.campaign_no);
    return map ? { map, quest: normalizeWorldQuest(stage.content.world, map) } : null;
  }

  private async worldMapOf(q: Q, campaignNo: number): Promise<WorldMap | null> {
    const raw = (await q<{ world: unknown }>('SELECT world FROM hk_saga_maps WHERE campaign_no = $1', [campaignNo]))[0]?.world;
    return raw ? normalizeWorldMap(raw) : null;
  }

  /** Lớp em đang học để vào phòng chung: lớp được chọn (phải là lớp của em, đang hoạt động) hoặc lớp gần nhất */
  private async worldClass(q: Q, user: UserRow, classId?: number | null): Promise<{ id: number; name: string }> {
    const rows = await q<{ id: number; name: string }>(
      `SELECT c.id, c.name FROM app_class_members m JOIN app_classes c ON c.id = m.class_id
       WHERE m.user_id = $1 AND c.is_active AND ($2::int IS NULL OR c.id = $2) ORDER BY c.school_year DESC, c.id DESC LIMIT 1`, [user.id, classId ?? null]);
    if (rows[0]) return rows[0];
    throw classId ? new ForbiddenException('Em không thuộc lớp này hoặc lớp đã lưu trữ') : new ConflictException('Em cần vào một lớp để cùng các bạn khám phá thế giới khối');
  }

  private async worldRoom(q: Q, classId: number, campaignNo: number): Promise<number> {
    await q('INSERT INTO hk_world_rooms (class_id, campaign_no) VALUES ($1, $2) ON CONFLICT (class_id, campaign_no) DO NOTHING', [classId, campaignNo]);
    return (await q<{ id: number }>('SELECT id FROM hk_world_rooms WHERE class_id = $1 AND campaign_no = $2', [classId, campaignNo]))[0].id;
  }

  private async roomBlocks(q: Q, room: number): Promise<Array<{ x: number; z: number; block: string; zone: string; user_id: number | null }>> {
    return q('SELECT x, z, block, zone, user_id FROM hk_world_blocks WHERE room_id = $1 ORDER BY placed_at, x, z', [room]);
  }

  /** Phần thưởng đã nhận trong thế giới khối: `title:…`, `route:…`, `book:…` (bảng hk_world_awards, migration 081) */
  private async awardsOf(q: Q, user: UserRow): Promise<Set<string>> {
    return new Set((await q<{ code: string }>('SELECT code FROM hk_world_awards WHERE user_id = $1', [user.id])).map((r) => r.code));
  }

  /** Mã các chặng em đã xong bước nhập vai (để hiện dấu ấn của em trên bản đồ) */
  private async exploredCodes(q: Q, user: UserRow): Promise<Set<string>> {
    return new Set((await q<{ code: string }>('SELECT s.code FROM hk_saga_progress p JOIN hk_saga_stages s ON s.id = p.stage_id WHERE p.user_id = $1 AND p.explore_done_at IS NOT NULL', [user.id])).map((r) => r.code));
  }

  /** Giờ máy chủ (đồng hồ của trò chơi) dùng cho thủy triều và ô tài nguyên mọc lại */
  worldNow(): number { return this.game.clock.now().getTime(); }

  private async worldLookOf(q: Q, user: UserRow): Promise<WorldLook & { chosen: boolean }> {
    const raw = ((await q<{ appearance: Record<string, any> }>('SELECT appearance FROM hk_players WHERE user_id = $1', [user.id]))[0]?.appearance ?? {}).saga_world_look;
    const ok = isObj(raw) && (WORLD_LOOK.gender as readonly string[]).includes(raw.gender) && (WORLD_LOOK.robe as readonly string[]).includes(raw.robe)
      && (WORLD_LOOK.hat as readonly string[]).includes(raw.hat) && (WORLD_LOOK.skin as readonly string[]).includes(raw.skin);
    return ok ? { gender: raw.gender, robe: raw.robe, hat: raw.hat, skin: raw.skin, chosen: true } : { ...DEFAULT_LOOK, chosen: false };
  }

  async worldLook(user: UserRow) {
    return { look: await this.worldLookOf(this.read, user), options: WORLD_LOOK };
  }

  async setWorldLook(user: UserRow, body: WorldLook) {
    return this.db.tx(async (q) => {
      await this.game.fresh(q, user);
      const look: WorldLook = { gender: body.gender, robe: body.robe, hat: body.hat, skin: body.skin };
      await q('UPDATE hk_players SET appearance = appearance || $2::jsonb, updated_at = now() WHERE user_id = $1', [user.id, JSON.stringify({ saga_world_look: look })]);
      return { look: { ...look, chosen: true }, options: WORLD_LOOK };
    });
  }

  /** Vào phòng chung qua kênh thời gian thực: kiểm tra em thuộc lớp (đang hoạt động) và phần có bản đồ khối */
  async worldPresence(user: UserRow, classId: number, campaignNo: number): Promise<{ room: number; name: string; look: Record<string, unknown>; spawn: [number, number] }> {
    return this.db.tx(async (q) => {
      const cls = await this.worldClass(q, user, classId);
      const map = await this.worldMapOf(q, campaignNo);
      if (!map) throw new NotFoundException('Phần này chưa có thế giới khối');
      const { chosen: _chosen, ...look } = await this.worldLookOf(q, user);
      return { room: await this.worldRoom(q, cls.id, campaignNo), name: user.full_name, look, spawn: map.spawn };
    });
  }

  private async worldView(q: Q, user: UserRow, stage: StageRow, st: WorldState): Promise<Record<string, unknown>> {
    const world = await this.worldOf(q, stage);
    if (!world) throw new ConflictException('Bản đồ khối của chặng chưa sẵn sàng');
    const blocks = await this.roomBlocks(q, st.room);
    const totals = new Map<string, number>();
    for (const b of blocks) totals.set(b.zone, (totals.get(b.zone) ?? 0) + 1);
    const cls = (await q<{ id: number; name: string }>('SELECT c.id, c.name FROM hk_world_rooms r JOIN app_classes c ON c.id = r.class_id WHERE r.id = $1', [st.room]))[0];
    const now = this.worldNow();
    const awards = await this.awardsOf(q, user);
    const explored = await this.exploredCodes(q, user);
    return {
      ...publicWorld(world.quest, world.map, st, { zoneTotal: (z) => totals.get(z) ?? 0 }),
      awards: [...awards].filter((a) => !a.startsWith('book:')),
      routes_open: world.map.routes.filter((r) => awards.has(`route:${r.id}`)).map((r) => r.id),
      changes: world.map.changes.filter((c) => explored.has(c.stage)),
      village_help: awards.has('title:nguoi-giu-lang'),
      room: { id: st.room, class_id: cls?.id ?? null, class_name: cls?.name ?? null, campaign_no: stage.campaign_no, online: this.hub.online(st.room) },
      blocks: blocks.map((b) => ({ x: b.x, z: b.z, block: b.block, zone: b.zone, mine: b.user_id === user.id })),
      nodes: this.hub.nodes(st.room, now), tide: tideAt(now), server_now: now,
      look: await this.worldLookOf(q, user),
    };
  }

  /** Một lệnh trong thế giới khối: luật ở world.ts; dịch vụ cung cấp khối của phòng, thủy triều, ô đang mọc lại và ghi khối đặt vào phòng */
  private async actWorld(q: Q, user: UserRow, row: SessionRow, stage: StageRow, p: ProgressRow, action: Record<string, any>, pending: WorldPending[]): Promise<WorldEvent[]> {
    const st = row.state as WorldState;
    const world = await this.worldOf(q, stage);
    if (!world) throw new ConflictException('Bản đồ khối của chặng chưa sẵn sàng');
    if (!['interact', 'answer', 'hint', 'zone', 'gather', 'craft', 'place'].includes(action.type)) throw new BadRequestException('Lệnh không hợp lệ trong thế giới khối');
    // đặt vật: khóa phòng để hai bạn không đặt trùng ô hay vượt sức chứa của vùng cùng một lúc
    if (action.type === 'place') await q('SELECT pg_advisory_xact_lock(80080, $1)', [st.room]);
    const blocks = await this.roomBlocks(q, st.room);
    const occupied = new Set(blocks.map((b) => `${b.x},${b.z}`));
    const totals = new Map<string, number>();
    for (const b of blocks) totals.set(b.zone, (totals.get(b.zone) ?? 0) + 1);
    const now = this.worldNow();
    const awards = await this.awardsOf(q, user);
    const ctx: WorldCtx = {
      battleWon: this.battleWon(p, row), tide: tideAt(now).state, nodeReady: (x, z) => this.hub.nodeReady(st.room, x, z, now),
      occupied: (x, z) => occupied.has(`${x},${z}`), zoneTotal: (z) => totals.get(z) ?? 0,
      // danh hiệu "Người giữ làng": dân làng em từng giúp góp sức ở các nhiệm vụ sau
      bonusYield: awards.has('title:nguoi-giu-lang') ? VILLAGE_BONUS : 0,
    };
    const { events, effects } = applyWorld(world.quest, world.map, st, action as WorldAction, ctx);
    await this.worldHelpers(q, user, st, world, occupied, totals, now, awards.has('title:nguoi-giu-lang'), ctx, events, effects, pending);
    for (const e of effects) {
      if (e.kind === 'take') { pending.push({ room: st.room, kind: 'take', x: e.x, z: e.z }); continue; }
      if (e.kind === 'award') {
        const fresh = (await q<{ code: string }>('INSERT INTO hk_world_awards (user_id, code) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING code', [user.id, e.code])).length > 0;
        const ev = events.find((x) => x.t === 'award' && x.code === e.code);
        if (ev) ev.text = this.awardText(world.map, e.code, fresh);
        continue;
      }
      const zone = world.map.zones.find((z) => z.id === e.zone)!;
      let removed: { x: number; z: number } | null = null;
      if ((totals.get(e.zone) ?? 0) >= zone.cap) {
        // vùng đã đầy (cả lớp đặt rất nhiều): khối cũ nhất của vùng chuyển sang ô mới – cập nhật, không xóa dữ liệu
        removed = (await q<{ x: number; z: number }>(`UPDATE hk_world_blocks b SET x = $3, z = $4, block = $5, user_id = $6, placed_at = now()
          FROM (SELECT x, z FROM hk_world_blocks WHERE room_id = $1 AND zone = $2 ORDER BY placed_at, x, z LIMIT 1) old
          WHERE b.room_id = $1 AND b.x = old.x AND b.z = old.z RETURNING old.x, old.z`, [st.room, e.zone, e.x, e.z, e.block, user.id]))[0] ?? null;
      } else {
        await q('INSERT INTO hk_world_blocks (room_id, x, z, block, zone, user_id) VALUES ($1, $2, $3, $4, $5, $6)', [st.room, e.x, e.z, e.block, e.zone, user.id]);
      }
      pending.push({ room: st.room, kind: 'block', placed: { x: e.x, z: e.z, block: e.block, zone: e.zone, by: user.id }, removed });
    }
    return events;
  }

  private awardText(map: WorldMap, code: string, fresh: boolean): string {
    const [kind, id] = code.split(':');
    const name = kind === 'title' ? `danh hiệu “${WORLD_TITLES.find((t) => t.code === id)?.name ?? id}”` : `tuyến vận chuyển “${map.routes.find((r) => r.id === id)?.name ?? id}” – đứng ở bến để đi thuyền`;
    return fresh ? `Em nhận được ${name}!` : `Em đã có ${name}.`;
  }

  /**
   * Bước đặt vật mà cả lớp chưa đủ: em đã đặt đủ phần mình thì dân binh (hoặc dân làng, nếu em có danh hiệu "Người giữ làng") tới đặt nốt phần còn thiếu khi
   * trong phòng không có bạn nào khác, hoặc khi đã chờ các bạn 60 giây. Khối của họ ghi vào phòng như khối của cả lớp (không gắn với tài khoản nào).
   */
  private async worldHelpers(q: Q, user: UserRow, st: WorldState, world: { map: WorldMap; quest: WorldQuest }, occupied: Set<string>, totals: Map<string, number>, now: number,
    villagers: boolean, ctx: WorldCtx, events: WorldEvent[], effects: WorldEffect[], pending: WorldPending[]): Promise<void> {
    const step = st.done ? undefined : world.quest.steps[st.step];
    if (!step || step.type !== 'place') return;
    const placedNow = effects.filter((e) => e.kind === 'place' && e.zone === step.zone).length;
    const total = (totals.get(step.zone) ?? 0) + placedNow;
    if ((st.placed[step.zone] ?? 0) < step.count || total >= step.team) return;
    if (!st.own_done_at) st.own_done_at = now;
    const mates = this.hub.players(st.room).filter((x) => x.id !== user.id).length;
    if (mates > 0 && now - st.own_done_at < 60_000) return;
    const zone = world.map.zones.find((z) => z.id === step.zone)!;
    const taken = new Set([...occupied, ...effects.filter((e): e is Extract<WorldEffect, { kind: 'place' }> => e.kind === 'place').map((e) => `${e.x},${e.z}`)]);
    const free: Array<[number, number]> = [];
    for (let z = zone.rect[1]; z < zone.rect[1] + zone.rect[3]; z++) for (let x = zone.rect[0]; x < zone.rect[0] + zone.rect[2]; x++) {
      if (zone.on.includes(world.map.rows[z][x]) && !taken.has(`${x},${z}`)) free.push([x, z]);
    }
    const need = Math.min(step.team - total, free.length);
    if (need <= 0) return;
    for (const [x, z] of free.slice(0, need)) {
      await q('INSERT INTO hk_world_blocks (room_id, x, z, block, zone, user_id) VALUES ($1, $2, $3, $4, $5, NULL)', [st.room, x, z, step.item, step.zone]);
      pending.push({ room: st.room, kind: 'block', placed: { x, z, block: step.item, zone: step.zone, by: 0 }, removed: null });
    }
    totals.set(step.zone, (totals.get(step.zone) ?? 0) + need);
    events.push({ t: 'help', n: need, text: `${villagers ? 'Dân làng em từng giúp sơ tán' : 'Dân binh'} tới góp sức: thêm ${need} ${ITEM_NAME[step.item].toLowerCase()} ở ${zone.name}.` });
    settleWorld(world.quest, st, { ...ctx, zoneTotal: (zz) => (totals.get(zz) ?? 0) + effects.filter((e) => e.kind === 'place' && e.zone === zz).length }, events, effects);
  }

  // ------------------------------------------------------------------ Sổ sử Đông A (21/11/2026)
  /** Thứ tự xáo cố định theo học sinh và cuộc kháng chiến (tải lại không đổi, không lộ thứ tự đúng) */
  private shuffled<T extends { id: string }>(user: UserRow, no: number, list: T[]): T[] {
    const h = (id: string) => createHash('sha256').update(`book|${user.id}|${no}|${id}`).digest('hex');
    const out = [...list].sort((a, b) => (h(a.id) < h(b.id) ? -1 : 1));
    return out.every((e, i) => e.id === list[i].id) ? [...out.slice(1), out[0]] : out;
  }

  private async bookOf(q: Q, user: UserRow) {
    const awards = await this.awardsOf(q, user);
    const maps = await q<{ campaign_no: number; years: string; world: unknown }>('SELECT campaign_no, years, world FROM hk_saga_maps WHERE world IS NOT NULL ORDER BY campaign_no');
    const progress = await q<{ campaign_no: number; total: number; done: number }>(
      `SELECT s.campaign_no, count(*)::int AS total, count(p.completed_at)::int AS done FROM hk_saga_stages s
       LEFT JOIN hk_saga_progress p ON p.stage_id = s.id AND p.user_id = $1 WHERE s.status = 'published' GROUP BY s.campaign_no`, [user.id]);
    return maps.flatMap((m) => {
      const map = normalizeWorldMap(m.world);
      if (!map.book) return [];
      const pr = progress.find((x) => x.campaign_no === m.campaign_no);
      const unlocked = Boolean(pr && pr.total > 0 && pr.done >= pr.total);
      const done = awards.has(`book:${m.campaign_no}`);
      return [{ campaign_no: m.campaign_no, years: m.years, title: map.book.title, unlocked, done, stages: pr ? { done: pr.done, total: pr.total } : { done: 0, total: 0 },
        events: done ? map.book.events : unlocked ? this.shuffled(user, m.campaign_no, map.book.events) : [] }];
    });
  }

  async worldBook(user: UserRow) { return { pages: await this.bookOf(this.read, user) }; }

  /** Sắp xếp các sự kiện của một cuộc kháng chiến; đúng hết thì hoàn thiện trang Sổ sử (thưởng điểm một lần) */
  async submitBook(user: UserRow, no: number, order: string[]) {
    return this.db.tx(async (q) => {
      const page = (await this.bookOf(q, user)).find((x) => x.campaign_no === no);
      if (!page) throw notFound('trang Sổ sử');
      if (!page.unlocked) throw new ConflictException('Hoàn thành mọi chặng của phần này để mở trang Sổ sử');
      const raw = (await q<{ world: unknown }>('SELECT world FROM hk_saga_maps WHERE campaign_no = $1', [no]))[0].world;
      const right = normalizeWorldMap(raw).book!.events.map((e) => e.id);
      if (!Array.isArray(order) || order.length !== right.length || new Set(order).size !== right.length || order.some((id) => !right.includes(id))) throw new BadRequestException('Hãy xếp đủ tất cả sự kiện, mỗi sự kiện một lần');
      const positions = order.filter((id, i) => right[i] === id).length;
      const correct = positions === right.length;
      let first = false, xp = 0;
      if (correct) {
        first = (await q('INSERT INTO hk_world_awards (user_id, code) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING code', [user.id, `book:${no}`])).length > 0;
        if (first && (await this.game.awardXp(q, user, 30, 'node', `hq:book:${no}`))) xp = 30;
      }
      return { correct, positions, total: right.length, first, xp, pages: await this.bookOf(q, user) };
    });
  }



  // ------------------------------------------------------------------ trận đánh
  private async actBattle(q: Q, user: UserRow, row: SessionRow, stage: StageRow, p: ProgressRow, action: Record<string, any>) {
    const b = row.state as BattleSessionState;
    const scn = stage.content.battle!;
    const events = b.mode === 'bachdang' ? applyBachDang(scn as BdScenario, b.engine as BdState, action as any) : applyTactics(scn as TacticsScenario, b.engine as TState, action as any);
    if ((b.engine as { status: string }).status === 'active') return { outcome: { events }, finished: null };
    const r = b.mode === 'bachdang' ? bachDangResult(scn as BdScenario, b.engine as BdState) : tacticsResult(scn as TacticsScenario, b.engine as TState);
    const firstWin = r.won && !p.battle_won_at;
    if (r.won) {
      await q(`UPDATE hk_saga_progress SET battle_won_at = COALESCE(battle_won_at, now()), battle_best = GREATEST(battle_best, $3), battle_stars = GREATEST(battle_stars, $4), updated_at = now()
               WHERE user_id = $1 AND stage_id = $2`, [user.id, stage.id, r.score, r.stars]);
      await this.game.bumpQuests(q, user, 'battles_completed', 1);
    }
    let xp = 0;
    if (firstWin && (await this.game.awardXp(q, user, XP.battle, 'battle', `hq:battle:${stage.id}`))) xp = XP.battle;
    await logEvent(null, user, 'battle_finish', 'saga_stage', stage.id, null, { won: r.won, stars: r.stars, score: r.score }, null, q);
    return { outcome: { events }, finished: { ...r, first_win: firstWin, xp, best: Math.max(p.battle_best, r.won ? r.score : 0), text: r.won ? scn.win_text : scn.lose_text } };
  }

  // ------------------------------------------------------------------ hoàn thành chặng và phần thưởng
  /**
   * Chặng hoàn thành khi đã học, đạt ngưỡng luyện tập, xong nhiệm vụ khám phá và (nếu có) thắng trận. Phần thưởng chỉ trao ở lần hoàn thành đầu tiên;
   * điểm và vàng còn được sổ cái chặn trùng theo khóa `hq:stage:<id>`.
   */
  private async maybeComplete(q: Q, user: UserRow, stage: StageRow): Promise<Record<string, any> | null> {
    const p = (await q<ProgressRow>('SELECT * FROM hk_saga_progress WHERE user_id = $1 AND stage_id = $2 FOR UPDATE', [user.id, stage.id]))[0];
    if (!p?.lesson_done_at || !p.practice_passed_at || !p.explore_done_at || (stage.content.battle && !p.battle_won_at)) return null;
    const stars = knowledgeStars(p.practice_best, stage.pass_percent);
    const first = !p.completed_at;
    await q('UPDATE hk_saga_progress SET completed_at = COALESCE(completed_at, now()), stars = GREATEST(stars, $3), updated_at = now() WHERE user_id = $1 AND stage_id = $2', [user.id, stage.id, stars]);
    const rewards: Record<string, any> = { xp: 0, gold: 0, card: null, badge: null, docs: [] };
    if (first) {
      if (await this.game.awardXp(q, user, stage.reward_xp, 'node', `hq:stage:${stage.id}`)) rewards.xp = stage.reward_xp;
      if (await this.game.addGold(q, user, stage.reward_gold, 'node', `hq:stage:${stage.id}`)) rewards.gold = stage.reward_gold;
      if (stage.card_code) {
        const got = await q('INSERT INTO hk_saga_user_cards (user_id, card_code, stage_id) SELECT $1, c.code, $3 FROM hk_saga_cards c WHERE c.code = $2 ON CONFLICT DO NOTHING RETURNING card_code', [user.id, stage.card_code, stage.id]);
        if (got.length) rewards.card = (await q('SELECT code, name, title, rarity, portrait, role_text FROM hk_saga_cards WHERE code = $1', [stage.card_code]))[0] ?? null;
      }
      if (stage.badge_code) {
        const badge = (await q<{ id: number; name: string; icon: string; color: string }>("SELECT id, name, icon, color FROM hk_badges WHERE code = $1 AND is_active AND scope = 'system'", [stage.badge_code]))[0];
        if (badge && (await this.game.awardBadge(q, user, badge, null))) rewards.badge = { code: stage.badge_code, name: badge.name, icon: badge.icon, color: badge.color };
      }
      rewards.docs = await q("SELECT id, title, kind FROM hk_saga_docs WHERE unlock_stage = $1 AND status = 'published' ORDER BY sort_order, id", [stage.code]);
      await this.game.bumpQuests(q, user, 'nodes_completed', 1);
      await logEvent(null, user, 'node_complete', 'saga_stage', stage.id, null, { stars }, null, q);
    }
    const all = await this.stages(q);
    const next = all.find((s) => s.unlock_after === stage.code) ?? null;
    const progress = await this.progressMap(q, user.id);
    const inCampaign = all.filter((s) => s.campaign_no === stage.campaign_no);
    return {
      first, stars: Math.max(stars, p.stars), knowledge_percent: p.practice_best, battle: stage.content.battle ? { stars: p.battle_stars, score: p.battle_best } : null, rewards,
      next: next && !progress.get(next.id)?.completed_at ? { id: next.id, title: next.title, campaign_no: next.campaign_no } : null,
      campaign_done: inCampaign.every((s) => progress.get(s.id)?.completed_at),
    };
  }

  /** Màn tổng kết của chặng đã hoàn thành: kết quả, diễn biến lịch sử đã kiểm chứng và ghi chú phần sáng tạo */
  async summary(user: UserRow, stageId: number) {
    const q = this.read;
    const stage = await this.stage(q, stageId);
    const p = (await this.progressMap(q, user.id)).get(stage.id);
    if (!p?.completed_at) throw new ConflictException('Em chưa hoàn thành chặng này');
    const all = await this.stages(q);
    const next = all.find((s) => s.unlock_after === stage.code) ?? null;
    const weak = await this.weakObjectives(q, user.id, stage.id);
    return {
      stage: { id: stage.id, title: stage.title, place: stage.place, date_label: stage.date_label, campaign_no: stage.campaign_no },
      result: { stars: p.stars, knowledge_percent: p.practice_best, practice_tries: p.practice_tries, explore_hints: p.explore_hints, explore_mistakes: p.explore_mistakes,
        battle: stage.content.battle ? { stars: p.battle_stars, score: p.battle_best, tries: p.battle_tries } : null },
      debrief: debriefView(stage.content), weak_objectives: weak.filter((w) => w.percent < 80),
      next: next ? { id: next.id, title: next.title, campaign_no: next.campaign_no } : null,
    };
  }

  // ------------------------------------------------------------------ ôn tập
  /** Tỉ lệ đúng theo từng mục tiêu kiến thức (mọi câu trả lời đã chấm của học sinh) */
  private async weakObjectives(q: Q, userId: number, stageId?: number): Promise<Array<{ stage_id: number; stage_title: string; objective: string; text: string; answers: number; percent: number }>> {
    const rows = await q<{ stage_id: number; stage_title: string; objective: string; text: string | null; answers: number; right: number }>(
      `SELECT s.id AS stage_id, s.title AS stage_title, i.objective, (SELECT x->>'text' FROM jsonb_array_elements(s.content->'objectives') x WHERE x->>'id' = i.objective LIMIT 1) AS text,
              count(*)::int AS answers, count(*) FILTER (WHERE a.correct)::int AS right
       FROM hk_saga_answers a JOIN hk_saga_items i ON i.id = a.item_id JOIN hk_saga_stages s ON s.id = i.stage_id
       WHERE a.user_id = $1 AND ($2::int IS NULL OR s.id = $2) GROUP BY s.id, s.title, s.position, i.objective ORDER BY s.position, i.objective`, [userId, stageId ?? null]);
    return rows.map((r) => ({ stage_id: r.stage_id, stage_title: r.stage_title, objective: r.objective, text: r.text ?? r.objective, answers: r.answers, percent: Math.round((r.right / Math.max(1, r.answers)) * 100) }));
  }

  async review(user: UserRow) {
    const q = this.read;
    const due = await q<Record<string, any>>(
      `SELECT r.item_id, r.wrong_count, r.last_wrong_at, i.prompt, i.kind, s.id AS stage_id, s.title AS stage_title
       FROM hk_saga_review r JOIN hk_saga_items i ON i.id = r.item_id AND i.is_active JOIN hk_saga_stages s ON s.id = i.stage_id AND s.status = 'published'
       WHERE r.user_id = $1 AND r.cleared_at IS NULL ORDER BY r.last_wrong_at DESC LIMIT 30`, [user.id]);
    const weak = (await this.weakObjectives(q, user.id)).filter((w) => w.percent < 80).sort((a, b) => a.percent - b.percent).slice(0, 8);
    const pool = Number((await q<{ n: string }>(
      `SELECT count(*) AS n FROM hk_saga_items i JOIN hk_saga_stages s ON s.id = i.stage_id AND s.status = 'published' JOIN hk_saga_progress p ON p.stage_id = s.id AND p.user_id = $1 AND p.practice_tries > 0
       WHERE i.is_active AND i.usage IN ('review', 'both') AND i.kind = ANY($2)`, [user.id, REVIEW_KINDS]))[0].n);
    const active = (await q<{ id: number }>("SELECT id::int AS id FROM hk_saga_sessions WHERE user_id = $1 AND kind = 'review' AND status = 'active'", [user.id]))[0];
    const stats = (await q<{ answers: number; right: number }>('SELECT count(*)::int AS answers, count(*) FILTER (WHERE correct)::int AS right FROM hk_saga_answers WHERE user_id = $1', [user.id]))[0];
    return { due: due.map((d) => ({ ...d, kind_label: KIND_LABEL[d.kind as ItemKind] })), weak_objectives: weak, pool, can_start: pool > 0, active_session_id: active?.id ?? null,
      size: Math.min(REVIEW_SIZE, pool), stats: { answers: stats.answers, right: stats.right, percent: stats.answers ? Math.round((stats.right / stats.answers) * 100) : 0 } };
  }

  /** Lượt ôn: ưu tiên câu đã sai, rồi câu thuộc mục tiêu còn yếu, sau đó câu bất kỳ của các chặng đã luyện; mỗi câu có đồng hồ do máy chủ giữ */
  async startReview(user: UserRow, restart = false) {
    return this.db.tx(async (q) => {
      const active = (await q<SessionRow>(`SELECT ${SESSION_COLS} FROM hk_saga_sessions WHERE user_id = $1 AND kind = 'review' AND status = 'active' FOR UPDATE`, [user.id]))[0];
      if (active && !restart) return { ...(await this.view(q, user, active, null)), resumed: true, events: [] };
      if (active) await q("UPDATE hk_saga_sessions SET status = 'abandoned', finished_at = now(), updated_at = now() WHERE id = $1", [active.id]);
      const rows = await q<ItemRow & { stage_id: number; due: boolean }>(
        `SELECT i.id, i.stage_id, i.kind, i.prompt, i.data, i.explanation, i.objective, i.source, (r.item_id IS NOT NULL) AS due
         FROM hk_saga_items i JOIN hk_saga_stages s ON s.id = i.stage_id AND s.status = 'published'
         JOIN hk_saga_progress p ON p.stage_id = s.id AND p.user_id = $1 AND p.practice_tries > 0
         LEFT JOIN hk_saga_review r ON r.item_id = i.id AND r.user_id = $1 AND r.cleared_at IS NULL
         WHERE i.is_active AND i.usage IN ('review', 'both') AND i.kind = ANY($2) ORDER BY (r.item_id IS NOT NULL) DESC, r.last_wrong_at DESC NULLS LAST, random() LIMIT $3`, [user.id, REVIEW_KINDS, REVIEW_SIZE]);
      if (!rows.length) throw new ConflictException('Hãy luyện tập ít nhất một chặng trước khi ôn');
      const seed = Math.floor(Math.random() * 2 ** 30);
      const now = this.game.clock.now().getTime();
      const state: ReviewState = { v: 1, streak: 0, best_streak: 0, slots: rows.map((r, i) => ({ ...newSlot(r, seed + i * 977), served_at: i === 0 ? now : null, limit_s: r.kind === 'sequence' ? 45 : r.kind === 'tactic' ? 30 : 20 })) };
      const row = (await q<SessionRow>(`INSERT INTO hk_saga_sessions (user_id, stage_id, kind, state) VALUES ($1, NULL, 'review', $2) RETURNING ${SESSION_COLS}`, [user.id, JSON.stringify(state)]))[0];
      return { ...(await this.view(q, user, row, null)), resumed: false, events: [] };
    });
  }

  private async actReview(q: Q, user: UserRow, row: SessionRow, action: Record<string, any>) {
    const st = row.state as ReviewState;
    const index = st.slots.findIndex((s) => !s.done);
    const slot = st.slots[index];
    const now = this.game.clock.now().getTime();
    // "ready": học sinh đã đọc xong lời giải thích của câu trước và mở câu này, đồng hồ của câu bắt đầu chạy từ đây (đọc giải thích không bị trừ giờ)
    if (action.type === 'ready') {
      if (!slot) throw new BadRequestException('Lượt ôn đã hết câu');
      if (slot.served_at === null) slot.served_at = now;
      return { outcome: { ready: true, item_id: slot.item_id }, finished: null };
    }
    if (action.type !== 'answer') throw new BadRequestException('Lượt ôn chỉ nhận câu trả lời');
    if (!slot || slot.item_id !== Number(action.item_id)) throw new BadRequestException('Hãy trả lời câu đang hiển thị');
    const item = (await this.items(q, [slot.item_id])).get(slot.item_id)!;
    // trả lời mà chưa báo đã mở câu: tính giờ từ lúc trả lời xong câu trước, cộng tối đa 90 giây đọc giải thích (bỏ bước báo mở câu không né được đồng hồ)
    const servedAt = slot.served_at ?? slot.opened_at ?? now;
    const late = now - servedAt > slot.limit_s * 1000 + REVIEW_GRACE_MS + (slot.served_at === null ? REVIEW_READ_MS : 0);
    // hết giờ: tính là sai nhưng vẫn cho xem đáp án và giải thích
    const graded = gradeItem(item, slot, late ? {} : action.answer);
    const correct = graded.score >= 1;
    await this.recordAnswer(q, user, item, row.id, 'review', correct);
    st.streak = correct ? st.streak + 1 : 0;
    st.best_streak = Math.max(st.best_streak, st.streak);
    let xp = 0;
    if (correct && (await this.game.awardXp(q, user, XP.review, 'practice', `hq:rv:${item.id}:${dayKey(this.game.clock.now())}`))) xp = XP.review;
    const nextSlot = st.slots[index + 1];
    if (nextSlot) { nextSlot.served_at = null; nextSlot.opened_at = now; }
    const outcome = { item_id: item.id, ...graded, timeout: late, streak: st.streak, xp, ...(await this.explain(q, item)) };
    if (nextSlot) return { outcome, finished: null };
    const right = st.slots.filter((s) => s.score >= 1).length;
    await logEvent(null, user, 'attempt_finish', 'saga_review', null, null, { right, total: st.slots.length }, null, q);
    return { outcome, finished: { right, total: st.slots.length, percent: Math.round((right / st.slots.length) * 100), best_streak: st.best_streak } };
  }

  // ------------------------------------------------------------------ bộ sưu tập và kho tư liệu
  async cards(user: UserRow) {
    const rows = await this.db.query<Record<string, any>>(
      `SELECT c.code, c.name, c.title, c.rarity, c.years, c.intro, c.role_text, c.quote, c.quote_source, c.source, c.source_url, c.portrait, uc.unlocked_at, (uc.user_id IS NOT NULL) AS owned,
              s.id AS stage_id, s.title AS stage_title, s.campaign_no
       FROM hk_saga_cards c LEFT JOIN hk_saga_user_cards uc ON uc.card_code = c.code AND uc.user_id = $1
       LEFT JOIN hk_saga_stages s ON s.card_code = c.code AND s.status = 'published' ORDER BY c.sort_order, c.code`, [user.id]);
    // thẻ chưa mở chỉ lộ tên, danh hiệu và điều kiện mở; phần giới thiệu mở cùng thẻ
    const cards = rows.map((r) => (r.owned ? r : { code: r.code, name: r.name, title: r.title, rarity: r.rarity, portrait: r.portrait, owned: false, stage_id: r.stage_id, stage_title: r.stage_title, campaign_no: r.campaign_no }));
    const latest = rows.filter((r) => r.owned).sort((a, b) => new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime())[0] ?? null;
    return { total: cards.length, owned: rows.filter((r) => r.owned).length, cards, latest_code: latest?.code ?? null };
  }

  async archive(user: UserRow) {
    const q = this.read;
    const all = await this.stages(q);
    const progress = await this.progressMap(q, user.id);
    const doneCodes = new Set(all.filter((s) => progress.get(s.id)?.completed_at).map((s) => s.code));
    const docs = await q<Record<string, any>>("SELECT id, code, kind, campaign_no, title, subtitle, body, source, source_url, unlock_stage, sort_order FROM hk_saga_docs WHERE status = 'published' ORDER BY sort_order, id");
    const lockInfo = (code: string | null) => {
      if (!code || doneCodes.has(code)) return null;
      const need = all.find((s) => s.code === code);
      return need ? { stage_id: need.id, stage_title: need.title, campaign_no: need.campaign_no } : null;
    };
    const texts = docs.filter((d) => d.kind === 'text').map((d) => {
      const lock = lockInfo(d.unlock_stage);
      return lock ? { id: d.id, code: d.code, campaign_no: d.campaign_no, title: d.title, subtitle: d.subtitle, locked: true, lock } : { id: d.id, code: d.code, campaign_no: d.campaign_no, title: d.title, subtitle: d.subtitle, body: d.body, source: d.source, source_url: d.source_url, locked: false, lock: null };
    });
    const timeline = [
      ...all.map((s) => ({ key: `stage:${s.id}`, campaign_no: s.campaign_no, sort: s.position * 10, date_label: s.date_label, title: s.title, text: s.summary, stage_id: s.id, done: doneCodes.has(s.code), source: null as string | null, source_url: null as string | null })),
      ...docs.filter((d) => d.kind === 'timeline').map((d) => ({ key: `doc:${d.id}`, campaign_no: d.campaign_no, sort: d.sort_order, date_label: String(d.body?.date_label ?? ''), title: d.title, text: String(d.body?.text ?? ''), stage_id: null, done: true, source: d.source, source_url: d.source_url })),
    ].sort((a, b) => a.sort - b.sort);
    const maps = await q('SELECT campaign_no, title, short_title, years, image_key, image_url, image_w, image_h, credit, credit_url FROM hk_saga_maps ORDER BY campaign_no');
    return { texts, timeline, maps, figures: (await this.cards(user)).cards };
  }
}
