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
import { GameService, RENAME_BUFF, RENAME_PRICE } from '../game/game.service';
import { addDays, dayKey, weekKey } from '../game/clock';
import { logEvent } from '../student/events';
import { applyBachDang, bachDangResult, BdScenario, BdState, createBachDang, publicBachDang } from './bachdang';
import { applyCouncil, councilResult, CouncilScenario, createCouncil, CState, publicCouncil } from './council';
import { debriefView, knowledgeStars, LORE_SHELF, LORE_TAG, lessonView, StageContent } from './content';
import { applyExplore, ExploreState, newExplore, publicExplore } from './explore';
import { gradeItem, hintFor, ItemKind, ItemRow, KIND_LABEL, newSlot, publicItem, SlotState, tally } from './practice';
import { applyTactics, createTactics, publicTactics, TacticsScenario, tacticsResult, TState } from './tactics';
import { applyWorld, isWorldState, ITEM_NAME, newWorld, normalizeWorldMap, normalizeWorldQuest, publicWorld, settleWorld, tideAt, VILLAGE_BONUS, WORLD_TITLES, WorldAction, WorldCtx, WorldEffect, WorldEvent, WorldMap, WorldQuest, WorldState } from './world';
import { WorldHub } from './world.hub';

export type SessionKind = 'practice' | 'explore' | 'battle' | 'review';
export type StageState = 'locked' | 'ready' | 'learning' | 'done' | 'review';

interface StageBrief {
  id: number; code: string; campaign_no: number | null; grade: number | null; position: number; title: string; place: string; date_label: string; kind: string; icon: string; summary: string;
  map_x: number; map_y: number; anchor_x: number | null; anchor_y: number | null; unlock_after: string | null; pass_percent: number; reward_xp: number; reward_gold: number;
  card_code: string | null; badge_code: string | null; version: number; status: string; review_note: string | null; has_battle: boolean; battle_mode: string | null;
  cards_total: number; has_world: boolean;
}
interface StageRow extends StageBrief { content: StageContent }
interface ProgressRow {
  user_id: number; stage_id: number; lesson_done_at: string | null; practice_best: number; practice_tries: number; practice_passed_at: string | null;
  explore_done_at: string | null; explore_hints: number; explore_mistakes: number; battle_best: number; battle_stars: number; battle_tries: number; battle_won_at: string | null;
  stars: number; completed_at: string | null; lore: string[];
}
interface SessionRow { id: number; user_id: number; stage_id: number | null; kind: SessionKind; status: 'active' | 'done' | 'abandoned'; seq: number; state: Record<string, any>; result: Record<string, any> | null; started_at: string }
interface PracticeState { v: 1; slots: SlotState[]; xp?: number; gold?: number }
/** `served_at`: lúc câu được mở cho học sinh (đồng hồ chạy từ đây); `opened_at`: lúc trả lời xong câu trước, dùng khi trình duyệt không báo đã mở câu */
interface ReviewState { v: 1; slots: Array<SlotState & { served_at: number | null; opened_at?: number | null; limit_s: number }>; streak: number; best_streak: number; xp?: number; gold?: number }
interface BattleSessionState { v: 1; mode: 'tactics' | 'bachdang' | 'council'; engine: TState | BdState | CState; knowledge: number }
/** Một khối lớp (25/11/2026, bản vẽ "Binh thư Sát Thát"): mỗi khối 6–9 một chiến dịch riêng, độ khó tăng dần; nội dung ở bảng hk_saga_grades (migration 083) */
interface GradeRow { grade: number; tag: string; role: string; level: string; title: string; forms: string; note: string | null; reward: string }

const STAGE_COLS = `s.id, s.code, s.campaign_no, s.grade, s.position, s.title, s.place, s.date_label, s.kind, s.icon, s.summary, s.map_x::float8 AS map_x, s.map_y::float8 AS map_y,
  s.anchor_x::float8 AS anchor_x, s.anchor_y::float8 AS anchor_y, s.unlock_after, s.pass_percent, s.reward_xp, s.reward_gold, s.card_code, s.badge_code, s.version, s.status, s.review_note,
  (jsonb_typeof(s.content->'battle') = 'object') AS has_battle, s.content->'battle'->>'mode' AS battle_mode,
  COALESCE(jsonb_array_length(s.content->'cards'), 0)::int AS cards_total, (jsonb_typeof(s.content->'world') = 'object') AS has_world`;
const SESSION_COLS = 'id::int AS id, user_id, stage_id, kind, status, seq, state, result, started_at';
/**
 * Điểm kinh nghiệm (KN) và vàng theo bảng "Cách kiếm" của màn Hồ sơ (25/11/2026): đúng một câu lần đầu +10 KN +2 vàng (luyện binh riêng: mỗi câu mỗi ngày),
 * mỗi sao trận đánh lần đầu đạt +30 KN +10 vàng, xong chặng lần đầu theo cột reward_xp / reward_gold của chặng, đủ thẻ Thám sử +10 KN, khám phá thêm 3D +20 KN.
 * KN chỉ để lên cấp; vàng chỉ tiêu ở Chợ phiên. Mọi khoản đi qua sổ cái với khóa duy nhất nên chơi lại không được thưởng lần hai.
 */
const XP = { lesson: 10, explore: 20, answer: 10, star: 30, review: 10 };
const GOLD = { answer: 2, star: 10 };
export const EARN_RULES = [
  { key: 'answer', text: 'Trả lời đúng 1 câu (lần đầu)', xp: '+10', gold: '+2' },
  { key: 'star', text: 'Mỗi sao trong trận (lần đầu đạt)', xp: '+30', gold: '+10' },
  { key: 'stage', text: 'Xong 1 chặng lần đầu', xp: '+100 trở lên', gold: '+30 trở lên' },
  { key: 'quest', text: 'Nhiệm vụ hằng ngày', xp: 'theo nhiệm vụ', gold: '+10–30' },
  { key: 'lore', text: 'Nhặt đủ thẻ Thám sử của chặng', xp: '+10', gold: '' },
] as const;
/** Bậc Khoa bảng ứng với từng khối: xong Khối 6 → Thái học sinh, Khối 7 → Thám hoa, Khối 8 → Bảng nhãn, Khối 9 và đủ sao cả bốn khối → Trạng nguyên */
export const RANK_NAMES = ['Học trò', 'Thái học sinh', 'Thám hoa', 'Bảng nhãn', 'Trạng nguyên'] as const;
/** Mốc chuỗi ngày (thưởng một lần): 3 ngày +30 vàng, 7 ngày mở khung "Lửa Đông A", 14 ngày +200 vàng, 30 ngày mở cờ hiệu "Ấn Đông A" (trao ở game.service.ts) */
export const STREAK_MILESTONES = [{ days: 3, label: '+30 vàng' }, { days: 7, label: 'Khung Lửa Đông A' }, { days: 14, label: '+200 vàng' }, { days: 30, label: 'Cờ hiệu Ấn Đông A' }] as const;
/** Chủ đề của các câu hay sai theo dạng câu, để Tiểu Tướng gợi ý bài Luyện binh riêng */
const KIND_TOPIC: Record<ItemKind, string> = { sequence: 'trình tự, mốc thời gian', locate: 'địa danh trên bản đồ', pairs: 'nhân vật và sự kiện', tactic: 'cách chọn kế sách', quiz: 'kiến thức cơ bản' };
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
/**
 * Chợ phiên Thăng Long (25/11/2026, bản vẽ "Binh thư Sát Thát"): chỉ bán đồ trang trí và vật phẩm hỗ trợ có giới hạn mỗi tuần, không bán điểm hay đáp án.
 * Món đẹp nhất chỉ mở bằng thành tích. Điều kiện của một món:
 *   free – có sẵn; gold – mua bằng vàng (sổ vàng lý do 'shop', khóa `hq:shop:<loại>:<mã>` nên mỗi món chỉ mua một lần); chest – mở hòm báu;
 *   streak – chuỗi ngày dài nhất; rank – bậc Khoa bảng; card – thẻ nhân vật; stars – số sao trận đánh của một chặng.
 */
type Need = { kind: 'free' } | { kind: 'gold'; price: number } | { kind: 'chest'; chest: string; text: string } | { kind: 'streak'; days: number }
  | { kind: 'rank'; level: number } | { kind: 'card'; card: string; text: string } | { kind: 'stars'; stage: string; stars: number; text: string };
interface LookDef { code: string; name: string; rarity: Rarity; need: Need }
const FRAMES: LookDef[] = [
  { code: 'go-moc', name: 'Gỗ mộc', rarity: 'common', need: { kind: 'free' } },
  { code: 'dong-co', name: 'Đồng cổ', rarity: 'common', need: { kind: 'gold', price: 300 } },
  { code: 'dong-bo-dau', name: 'Khung Đông Bộ Đầu', rarity: 'rare', need: { kind: 'chest', chest: 'p1', text: 'Mở hòm báu cuối chiến dịch 1258 (Khối 6)' } },
  { code: 'lua-dong-a', name: 'Lửa Đông A', rarity: 'rare', need: { kind: 'streak', days: 7 } },
  { code: 'chuong-duong', name: 'Khung Chương Dương', rarity: 'epic', need: { kind: 'chest', chest: 'p2', text: 'Mở hòm báu cuối chiến dịch 1285 (Khối 7)' } },
  { code: 'rong-thoi-tran', name: 'Rồng thời Trần', rarity: 'epic', need: { kind: 'gold', price: 900 } },
  { code: 'bach-dang', name: 'Sóng Bạch Đằng', rarity: 'legendary', need: { kind: 'chest', chest: 'p3', text: 'Xong Khối 8 (mở hòm báu cuối chiến dịch 1287–1288)' } },
  { code: 'hoa-sen-vang', name: 'Hoa sen vàng', rarity: 'legendary', need: { kind: 'rank', level: 4 } },
];
/** Cờ hiệu gắn cạnh tên em (hồ sơ, bảng vàng); "Phá cường địch" là sáu chữ trên lá cờ của Trần Quốc Toản (thẻ nhân vật của chặng Bình Than) */
const FLAGS: LookDef[] = [
  { code: 'sat-that', name: 'Cờ Sát Thát', rarity: 'common', need: { kind: 'free' } },
  { code: 'thuyen-chien', name: 'Thuyền chiến', rarity: 'rare', need: { kind: 'gold', price: 350 } },
  { code: 'pha-cuong-dich', name: 'Phá cường địch', rarity: 'epic', need: { kind: 'card', card: 'tran-quoc-toan', text: 'Có thẻ Trần Quốc Toản' } },
  { code: 'rong-cuon', name: 'Rồng cuộn', rarity: 'epic', need: { kind: 'gold', price: 600 } },
  { code: 'coc-bach-dang', name: 'Cọc Bạch Đằng', rarity: 'legendary', need: { kind: 'stars', stage: 'bach-dang', stars: 3, text: '3 sao trận Bạch Đằng' } },
  { code: 'an-dong-a', name: 'Ấn Đông A', rarity: 'legendary', need: { kind: 'streak', days: 30 } },
];
/** Giao diện đổi màu cả trang học sinh; mỗi giao diện lấy cảm hứng từ một địa danh thời Trần */
const THEMES: LookDef[] = [
  { code: 'thang-long', name: 'Thăng Long', rarity: 'common', need: { kind: 'free' } },
  { code: 'bach-dang', name: 'Sông Bạch Đằng', rarity: 'rare', need: { kind: 'gold', price: 600 } },
  { code: 'dem-dong-bo-dau', name: 'Đêm Đông Bộ Đầu', rarity: 'rare', need: { kind: 'gold', price: 600 } },
  { code: 'hoang-thanh', name: 'Hoàng thành', rarity: 'legendary', need: { kind: 'rank', level: 4 } },
];
/** Vật phẩm hỗ trợ: giới hạn mua mỗi tuần để không ảnh hưởng công bằng trên Bảng vàng. "Đổi tướng hiệu" là một lượt đổi biệt danh (giữ tối đa 1 lượt chưa dùng) */
const ITEMS: Array<{ code: 'lenh-bai' | 'goi-y' | 'doi-ten'; name: string; price: number; weekly: number; note: string }> = [
  { code: 'lenh-bai', name: 'Lệnh bài giữ chuỗi', price: 150, weekly: 2, note: 'Nghỉ một ngày không mất chuỗi học' },
  { code: 'goi-y', name: 'Gợi ý chiến thuật', price: 50, weekly: 3, note: 'Ở Hội đồng quân sự, gạch bỏ một phương án sai' },
  { code: 'doi-ten', name: 'Đổi tướng hiệu', price: RENAME_PRICE, weekly: 1, note: 'Đổi biệt danh thêm một lần (lần đặt đầu tiên miễn phí trong Hồ sơ)' },
];
const HINT_BUFF = 'goi_y';
/** Vật phẩm lưu số lượt trong hk_players.buffs (Lệnh bài giữ chuỗi lưu ở cột freezes) */
const ITEM_BUFF: Record<'goi-y' | 'doi-ten', string> = { 'goi-y': HINT_BUFF, 'doi-ten': RENAME_BUFF };
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
const REVIEW_SIZE = 6;
const REVIEW_GRACE_MS = 3000;
/** Thời gian tối đa đọc lời giải thích của câu trước khi trình duyệt không báo "đã mở câu": quá mức này đồng hồ của câu vẫn tính */
const REVIEW_READ_MS = 90_000;
const REVIEW_KINDS: ItemKind[] = ['quiz', 'tactic', 'sequence', 'locate'];
/**
 * Ôn giãn cách của Luyện binh riêng (26/11/2026, bản vẽ màn 10 "Ôn lại sau 3 ngày"; migration 084): câu sai vào hàng ôn và tới hạn ngay (ô 0);
 * trả lời đúng câu tới hạn lần thứ nhất thì hẹn ôn lại sau REVIEW_GAP_DAYS ngày (ô 1); đúng thêm lần nữa khi tới hạn thì xong (cleared_at).
 */
const REVIEW_GAP_DAYS = 3;
/** Điều kiện "tới hạn ôn" của một dòng hk_saga_review (bí danh `r`, tham số thời điểm hiện tại) */
const REVIEW_DUE = (r: string, now: string): string => `(${r}.due_at IS NULL OR ${r}.due_at <= ${now})`;
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

  /** Số câu đã sai tới hạn ôn của từng chặng (câu hẹn ôn lại sau chưa tới ngày thì chưa tính – migration 084) */
  private async dueByStage(q: Q, userId: number): Promise<Map<number, number>> {
    const rows = await q<{ stage_id: number; n: number }>(
      `SELECT i.stage_id, count(*)::int AS n FROM hk_saga_review r JOIN hk_saga_items i ON i.id = r.item_id
       WHERE r.user_id = $1 AND r.cleared_at IS NULL AND ${REVIEW_DUE('r', '$2')} AND i.is_active GROUP BY i.stage_id`, [userId, this.game.clock.now()]);
    return new Map(rows.map((r) => [r.stage_id, r.n]));
  }

  /**
   * Khối của học sinh (25/11/2026): khối của lớp đang học (lớp mới nhất còn hoạt động); lớp chưa ghi khối thì lấy chữ số đầu của tên lớp (8A3 → 8).
   * Không xác định được thì null: khi đó không khóa khối nào để học sinh không bị kẹt.
   */
  private async gradeOf(q: Q, user: UserRow): Promise<number | null> {
    const row = (await q<{ grade: number | null; name: string }>(
      `SELECT c.grade, c.name FROM app_class_members m JOIN app_classes c ON c.id = m.class_id WHERE m.user_id = $1 AND c.is_active ORDER BY c.school_year DESC, c.id DESC LIMIT 1`, [user.id]))[0];
    if (!row) return null;
    if (row.grade && row.grade >= 6 && row.grade <= 9) return Number(row.grade);
    const m = /^\s*([6-9])/.exec(row.name ?? '');
    return m ? Number(m[1]) : null;
  }

  private async gradesMeta(q: Q): Promise<GradeRow[]> {
    return q<GradeRow>('SELECT grade, tag, role, level, title, forms, note, reward FROM hk_saga_grades ORDER BY grade');
  }

  /**
   * Chặng bị khóa khi thuộc khối cao hơn khối của em ("mở khi em lên lớp 9") hoặc khi chặng điều kiện (đã công bố) chưa hoàn thành;
   * điều kiện trỏ tới chặng chưa công bố thì không khóa để học sinh không bị kẹt. Chặng đã xong luôn chơi lại được.
   */
  private lockOf(stage: StageBrief, all: StageBrief[], progress: Map<number, ProgressRow>, myGrade: number | null): string | null {
    if (stage.grade && myGrade && stage.grade > myGrade) return `Mở khi em lên lớp ${stage.grade}`;
    if (!stage.unlock_after) return null;
    const need = all.find((s) => s.code === stage.unlock_after);
    if (!need || progress.get(need.id)?.completed_at) return null;
    return `Hoàn thành chặng “${need.title}” để mở`;
  }

  private stateOf(_stage: StageBrief, p: ProgressRow | undefined, lock: string | null, due: number): StageState {
    // "cần ôn": còn câu đã sai chưa ôn lại, hoặc phần nhập vai phải xem gợi ý / làm sai từ ba lần trở lên
    if (p?.completed_at) return due > 0 || p.explore_hints + p.explore_mistakes >= 3 ? 'review' : 'done';
    if (lock) return 'locked';
    return p && ((p.lore ?? []).length || p.lesson_done_at || p.practice_tries > 0) ? 'learning' : 'ready';
  }

  /**
   * Vòng 5 bước của một chặng (25/11/2026): Quân lệnh (nhận nhiệm vụ) → Thám sử (nhặt thẻ Binh thư = học ngắn) → Hội đồng quân sự (= luyện tập, đạt ngưỡng)
   * → Xuất trận (nếu chặng có trận) → Sử quan tổng kết (khi chặng hoàn thành). Thế giới khối 3D là phần khám phá thêm, không bắt buộc.
   */
  private steps(stage: StageBrief, p: ProgressRow | undefined, locked: boolean) {
    const lesson = p?.lesson_done_at ? 'done' : locked ? 'locked' : 'ready';
    const practice = p?.practice_passed_at ? 'done' : lesson === 'done' ? 'ready' : 'locked';
    const battle = !stage.has_battle ? 'none' : p?.battle_won_at ? 'done' : practice === 'done' ? 'ready' : 'locked';
    const summary = p?.completed_at ? 'done' : 'locked';
    const world = !stage.has_world ? 'none' : p?.explore_done_at ? 'done' : practice === 'done' ? 'ready' : 'locked';
    const next = locked ? null : lesson !== 'done' ? 'lesson' : practice !== 'done' ? 'practice' : battle === 'ready' ? 'battle' : p?.completed_at ? 'summary' : 'battle';
    return { order: locked ? 'locked' : 'done', lesson, practice, battle, summary, world, explore: world, next };
  }

  private brief(stage: StageBrief, all: StageBrief[], progress: Map<number, ProgressRow>, due: Map<number, number>, myGrade: number | null) {
    const p = progress.get(stage.id);
    const lock = this.lockOf(stage, all, progress, myGrade);
    const inGrade = all.filter((s) => s.grade === stage.grade);
    const inCampaign = all.filter((s) => s.campaign_no !== null && s.campaign_no === stage.campaign_no);
    return {
      id: stage.id, code: stage.code, campaign_no: stage.campaign_no, grade: stage.grade, position: stage.position, order: inGrade.findIndex((s) => s.id === stage.id) + 1,
      map_order: stage.campaign_no ? inCampaign.findIndex((s) => s.id === stage.id) + 1 : null, title: stage.title, place: stage.place,
      date_label: stage.date_label, kind: stage.kind, icon: stage.icon, summary: stage.summary, map_x: stage.map_x, map_y: stage.map_y, anchor_x: stage.anchor_x, anchor_y: stage.anchor_y,
      has_battle: stage.has_battle, battle_mode: stage.battle_mode, has_world: stage.has_world, state: this.stateOf(stage, p, lock, due.get(stage.id) ?? 0), lock_reason: p?.completed_at ? null : lock,
      stars: p?.stars ?? 0, knowledge_percent: p?.practice_best ?? 0, battle_stars: p?.battle_stars ?? 0, review_due: due.get(stage.id) ?? 0,
      lore: { have: (p?.lore ?? []).length, total: stage.cards_total }, steps: this.steps(stage, p, Boolean(lock) && !p?.completed_at),
    };
  }

  /** Tóm tắt bốn khối: số chặng xong, sao, trạng thái (đã xong / khối của em / mở để học trước hoặc ôn / khóa) và bậc Khoa bảng */
  private gradeSummary(meta: GradeRow[], briefs: Array<ReturnType<SagaService['brief']>>, myGrade: number | null, counts: Map<number, number>) {
    return meta.map((g) => {
      const list = briefs.filter((b) => b.grade === g.grade);
      const done = list.filter((b) => b.state === 'done' || b.state === 'review').length;
      const completed = list.length > 0 && done === list.length;
      const locked = Boolean(myGrade && g.grade > myGrade) && done === 0;
      const state = completed ? 'done' : locked ? 'locked' : myGrade === g.grade ? 'current' : 'open';
      return {
        ...g, stages: list.length, done, stars: list.reduce((n, b) => n + b.stars, 0), max_stars: list.length * 3, completed, state, mine: myGrade === g.grade,
        lock_reason: locked ? `Mở khi em lên lớp ${g.grade}` : null, questions: counts.get(g.grade) ?? 0, battles: list.filter((b) => b.has_battle).length,
      };
    });
  }

  /** Số câu Hội đồng (luyện tập) của mỗi khối: mỗi câu gắn với đúng một chặng nên không trùng giữa các khối */
  private async itemCounts(q: Q): Promise<Map<number, number>> {
    const rows = await q<{ grade: number; n: number }>(
      `SELECT s.grade, count(*)::int AS n FROM hk_saga_items i JOIN hk_saga_stages s ON s.id = i.stage_id AND s.status = 'published'
       WHERE i.is_active AND i.usage IN ('practice', 'both') AND s.grade IS NOT NULL GROUP BY s.grade`);
    return new Map(rows.map((r) => [Number(r.grade), r.n]));
  }

  /** Bậc Khoa bảng từ tiến độ bốn khối (xong liên tiếp từ Khối 6), kèm tiến độ tới bậc sau */
  private rankOf(grades: Array<{ grade: number; stages: number; done: number; stars: number; max_stars: number; completed: boolean }>) {
    let level = 0;
    for (const g of [6, 7, 8]) { const x = grades.find((y) => y.grade === g); if (x?.completed) level += 1; else break; }
    const k9 = grades.find((y) => y.grade === 9);
    const stars = grades.reduce((n, y) => n + y.stars, 0), max = grades.reduce((n, y) => n + y.max_stars, 0);
    if (level === 3 && k9?.completed && max > 0 && stars >= max) level = 4;
    const nextGrade = level < 3 ? grades.find((y) => y.grade === 6 + level) : null;
    const next = level >= 4 ? null : nextGrade ? { done: nextGrade.done, total: nextGrade.stages, unit: 'chặng', grade: nextGrade.grade }
      : k9 && !k9.completed ? { done: k9.done, total: k9.stages, unit: 'chặng', grade: 9 } : { done: stars, total: max, unit: 'sao', grade: null };
    return { level, name: RANK_NAMES[level], next_name: level < 4 ? RANK_NAMES[level + 1] : null, next, names: RANK_NAMES };
  }

  // ------------------------------------------------------------------ trang chủ và bản đồ
  /**
   * Doanh trại (trang chủ của học sinh, 25/11/2026): chỉ số (chuỗi ngày, vàng, kinh nghiệm, cấp), chặng đang học với vòng 5 bước, bốn khối và bậc Khoa bảng,
   * gợi ý riêng của Tiểu Tướng (từ các câu em hay sai), nhiệm vụ hằng ngày, chuỗi ngày trong tuần và các mốc thưởng.
   */
  async home(user: UserRow) {
    const hud = await this.game.me(user);
    const quests = await this.game.quests(user);
    const q = this.read;
    const all = await this.stages(q);
    const progress = await this.progressMap(q, user.id);
    const due = await this.dueByStage(q, user.id);
    const myGrade = await this.gradeOf(q, user);
    const maps = await q<Record<string, any>>('SELECT campaign_no, title, short_title, years, enemy, places, summary FROM hk_saga_maps ORDER BY campaign_no');
    const briefs = all.map((s) => this.brief(s, all, progress, due, myGrade));
    const campaigns = maps.map((m) => {
      const list = briefs.filter((b) => b.campaign_no === m.campaign_no);
      const done = list.filter((b) => b.state === 'done' || b.state === 'review').length;
      const started = list.some((b) => b.state !== 'ready' && b.state !== 'locked');
      return { ...m, stages: list.length, done, stars: list.reduce((n, b) => n + b.stars, 0), max_stars: list.length * 3, percent: list.length ? Math.round((done / list.length) * 100) : 0,
        completed: list.length > 0 && done === list.length, is_new: list.length > 0 && !started, available: list.length > 0 };
    });
    const grades = this.gradeSummary(await this.gradesMeta(q), briefs, myGrade, await this.itemCounts(q));
    // chặng đang học: ưu tiên chặng dở dang của khối em, rồi chặng sẵn sàng của khối em, sau đó tới các khối khác
    const mine = (b: (typeof briefs)[number]) => myGrade === null || b.grade === myGrade;
    const next = briefs.find((b) => b.state === 'learning' && mine(b)) ?? briefs.find((b) => b.state === 'ready' && mine(b))
      ?? briefs.find((b) => b.state === 'learning') ?? briefs.find((b) => b.state === 'ready') ?? null;
    const dailyList = quests.daily as Array<Record<string, any>>;
    const daily = dailyList.find((d) => !d.completed_at) ?? dailyList[0] ?? null;
    const look = await this.db.tx((t) => this.wardrobe(t, user));
    return {
      learner: { name: user.nickname || user.full_name, full_name: user.full_name, avatar_url: user.avatar_url, class_name: user.class_name, grade: myGrade },
      hud: { level: hud.level, gold: hud.gold, xp: hud.xp, streak: hud.streak, daily: hud.daily, unseen_celebrations: hud.unseen_celebrations },
      campaigns, grades, grade: myGrade, rank: this.rankOf(grades),
      next: next ? { stage_id: next.id, title: next.title, campaign_no: next.campaign_no, grade: next.grade, order: next.order, place: next.place, date_label: next.date_label,
        state: next.state, has_battle: next.has_battle, battle_mode: next.battle_mode, steps: next.steps, lore: next.lore,
        of: briefs.filter((b) => b.grade === next.grade).length } : null,
      daily: daily ? { title: daily.title, progress: daily.progress, target: daily.target, done: Boolean(daily.completed_at), reward_xp: daily.reward_xp, reward_gold: daily.reward_gold, done_count: dailyList.filter((d) => d.completed_at).length, total: dailyList.length } : null,
      quests: dailyList.map((d) => ({ id: d.id, title: d.title, metric: d.metric, progress: d.progress, target: d.target, done: Boolean(d.completed_at), reward_xp: d.reward_xp, reward_gold: d.reward_gold })),
      quests_reset: quests.resets.daily,
      review_due: [...due.values()].reduce((n, x) => n + x, 0), totals: { stages: briefs.length, done: briefs.filter((b) => b.state === 'done' || b.state === 'review').length },
      suggest: await this.suggestion(q, user), streak: await this.streakView(q, user, hud.streak),
      look: look.equipped, hints: look.hints,
    };
  }

  /** Gợi ý riêng của Tiểu Tướng: các câu em đã sai chưa ôn, gom theo dạng câu để nói em hay nhầm ở đâu; chưa sai câu nào thì dựa vào mục tiêu còn yếu */
  private async suggestion(q: Q, user: UserRow) {
    const rows = await q<{ kind: ItemKind; n: number; titles: string[] }>(
      `SELECT i.kind, count(*)::int AS n, array_agg(DISTINCT s.title) AS titles FROM hk_saga_review r JOIN hk_saga_items i ON i.id = r.item_id AND i.is_active
       JOIN hk_saga_stages s ON s.id = i.stage_id AND s.status = 'published' WHERE r.user_id = $1 AND r.cleared_at IS NULL AND ${REVIEW_DUE('r', '$2')}
       GROUP BY i.kind ORDER BY count(*) DESC, i.kind`, [user.id, this.game.clock.now()]);
    const total = rows.reduce((n, r) => n + r.n, 0);
    if (total > 0) {
      const top = rows[0];
      const size = Math.min(REVIEW_SIZE, total);
      return { kind: 'review', topic: KIND_TOPIC[top.kind], stages: top.titles.slice(0, 3), wrong: total, size, xp: size * XP.review,
        text: `Em còn ${total} câu chưa vững, nhiều nhất là về ${KIND_TOPIC[top.kind]} (${top.titles.slice(0, 2).join(', ')}). Làm ${size} câu Luyện binh riêng để nhớ chắc nhé.` };
    }
    const weak = (await this.weakObjectives(q, user.id)).filter((w) => w.answers >= 2 && w.percent < 80).sort((a, b) => a.percent - b.percent)[0];
    if (weak) return { kind: 'weak', topic: weak.text, stages: [weak.stage_title], wrong: 0, size: REVIEW_SIZE, xp: REVIEW_SIZE * XP.review,
      text: `Mục tiêu “${weak.text}” (chặng ${weak.stage_title}) em mới đúng ${weak.percent}%. Luyện thêm vài câu nhé.` };
    return null;
  }

  /** Chuỗi ngày trong 7 ngày gần nhất: ngày đạt mục tiêu, ngày dùng Lệnh bài giữ chuỗi (nằm trong chuỗi mà không đạt), hôm nay; kèm các mốc thưởng */
  private async streakView(q: Q, user: UserRow, s: { current: number; longest: number; freezes: number; freeze_max: number; last_day: string | null; at_risk: boolean }) {
    const today = dayKey(this.game.clock.now());
    const from = addDays(today, -6);
    const rows = await q<{ day: string; reached: boolean }>("SELECT to_char(day, 'YYYY-MM-DD') AS day, reached FROM hk_daily WHERE user_id = $1 AND day >= $2", [user.id, from]);
    const reached = new Set(rows.filter((r) => r.reached).map((r) => r.day));
    const runFrom = s.current > 0 && s.last_day ? addDays(s.last_day, -(s.current - 1)) : null;
    const week = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(from, i);
      const state = reached.has(day) ? 'done' : day === today ? 'today' : runFrom && s.last_day && day >= runFrom && day <= s.last_day ? 'freeze' : 'miss';
      return { day, weekday: new Date(`${day}T12:00:00Z`).getUTCDay(), state };
    });
    const best = Math.max(s.longest, s.current);
    return { ...s, week, milestones: STREAK_MILESTONES.map((m) => ({ ...m, reached: best >= m.days })) };
  }

  /** Bản đồ gốc của một cuộc kháng chiến (giữ cho nút "Xem bản đồ gốc" ở Chiến dịch Khối 6–8) */
  async campaign(user: UserRow, campaignNo: number) {
    const q = this.read;
    const map = (await q<Record<string, any>>('SELECT campaign_no, title, short_title, years, enemy, places, summary, image_key, image_url, image_w, image_h, credit, credit_url FROM hk_saga_maps WHERE campaign_no = $1', [campaignNo]))[0];
    if (!map) throw notFound('cuộc kháng chiến');
    const all = await this.stages(q);
    const progress = await this.progressMap(q, user.id);
    const due = await this.dueByStage(q, user.id);
    const myGrade = await this.gradeOf(q, user);
    // bản đồ gốc của một cuộc kháng chiến: số thứ tự là thứ tự trong cuộc kháng chiến đó (không phải trong khối)
    const stages = all.filter((s) => s.campaign_no === campaignNo).map((s) => { const b = this.brief(s, all, progress, due, myGrade); return { ...b, order: b.map_order ?? b.order }; });
    const done = stages.filter((s) => s.state === 'done' || s.state === 'review').length;
    return { map, stages, current_stage_id: (stages.find((s) => s.state === 'learning') ?? stages.find((s) => s.state === 'ready'))?.id ?? null,
      totals: { stages: stages.length, done, stars: stages.reduce((n, s) => n + s.stars, 0), max_stars: stages.length * 3 },
      chests: await this.chestsOf(q, user, campaignNo, stages) };
  }

  /**
   * Chiến dịch của một khối (25/11/2026): bốn khối 6–9, mỗi khối một chiến dịch không trùng nội dung. Trả các chặng theo thứ tự, hòm báu của các cuộc
   * kháng chiến nằm trong khối, bản đồ gốc (khi khối gắn với một cuộc kháng chiến) và phần thưởng khi hoàn thành.
   */
  async grade(user: UserRow, grade: number) {
    const q = this.read;
    const meta = (await this.gradesMeta(q)).find((g) => g.grade === grade);
    if (!meta) throw notFound('khối');
    const all = await this.stages(q);
    const progress = await this.progressMap(q, user.id);
    const due = await this.dueByStage(q, user.id);
    const myGrade = await this.gradeOf(q, user);
    const briefs = all.map((s) => this.brief(s, all, progress, due, myGrade));
    const summary = this.gradeSummary([meta], briefs, myGrade, await this.itemCounts(q))[0];
    const stages = briefs.filter((b) => b.grade === grade);
    const nos = [...new Set(stages.map((s) => s.campaign_no).filter((n): n is number => n !== null))];
    const chests = [];
    for (const no of nos) chests.push(...(await this.chestsOf(q, user, no, briefs.filter((b) => b.campaign_no === no).map((b) => ({ ...b, order: b.map_order ?? b.order })))).map((c) => {
      // hòm "sau chặng thứ n của cuộc kháng chiến" đặt sau đúng chặng đó trong danh sách của khối
      const after = briefs.filter((b) => b.campaign_no === no)[c.after - 1];
      return { ...c, after: stages.findIndex((s) => s.id === after?.id) + 1, campaign_no: no };
    }));
    const maps = nos.length ? await q<Record<string, any>>('SELECT campaign_no, title, short_title, years, image_key, image_url, image_w, image_h, credit, credit_url FROM hk_saga_maps WHERE campaign_no = ANY($1) ORDER BY campaign_no', [nos]) : [];
    return {
      grade: summary, stages, chests, maps, my_grade: myGrade,
      current_stage_id: (stages.find((s) => s.state === 'learning') ?? stages.find((s) => s.state === 'ready'))?.id ?? null,
    };
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
        // chặng không thuộc cuộc kháng chiến nào (Bạch Đằng 938, các chặng tổng kết Khối 9) không có hòm báu
        const part = st && st.campaign_no !== null ? all.filter((x) => x.campaign_no === st.campaign_no) : [];
        if (!st || !part.length || part[part.length - 1]?.id === id) throw notFound('hòm báu');
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

  // ------------------------------------------------------------------ khung, cờ hiệu, giao diện, danh hiệu và Chợ phiên (17/11/2026, mở rộng 25/11/2026)
  /** Điều kiện mở của một món dưới dạng chữ cho học sinh đọc */
  private needText(n: Need): string {
    switch (n.kind) {
      case 'free': return 'Có sẵn';
      case 'gold': return `${n.price} vàng`;
      case 'streak': return `Chuỗi ${n.days} ngày`;
      case 'rank': return `Đỗ ${RANK_NAMES[n.level]}`;
      default: return n.text;
    }
  }

  /**
   * Kho trang phục: khung ảnh đại diện, cờ hiệu, giao diện, danh hiệu và vật phẩm kèm trạng thái mở khóa (món mua bằng vàng: có dòng sổ vàng lý do 'shop';
   * món thành tích: tính lại từ tiến độ, hòm báu, chuỗi ngày, thẻ nhân vật) và món đang trang bị (hk_players.appearance, khóa saga_*).
   */
  private async wardrobe(q: Q, user: UserRow) {
    const p = await this.game.fresh(q, user);
    const ledger = await q<{ reason: string; ref_key: string }>("SELECT reason, ref_key FROM hk_gold_ledger WHERE user_id = $1 AND reason IN ('chest', 'shop')", [user.id]);
    const opened = new Set(ledger.filter((r) => r.reason === 'chest').map((r) => r.ref_key.replace(/^hq:chest:/, '')));
    const bought = new Set(ledger.filter((r) => r.reason === 'shop' && r.ref_key.startsWith('hq:shop:')).map((r) => r.ref_key.slice('hq:shop:'.length)));
    const look = ((p.appearance ?? {}) as unknown) as Record<string, unknown>;
    const all = await this.stages(q);
    const progress = await this.progressMap(q, user.id);
    const myGrade = await this.gradeOf(q, user);
    const briefs = all.map((s) => this.brief(s, all, progress, new Map(), myGrade));
    const rank = this.rankOf(this.gradeSummary(await this.gradesMeta(q), briefs, myGrade, new Map()));
    const cards = new Set((await q<{ card_code: string }>('SELECT card_code FROM hk_saga_user_cards WHERE user_id = $1', [user.id])).map((r) => r.card_code));
    const streakBest = Math.max(p.streak_longest ?? 0, p.streak_current ?? 0);
    const met = (kind: string, d: LookDef): boolean => {
      const n = d.need;
      switch (n.kind) {
        case 'free': return true;
        case 'gold': return bought.has(`${kind}:${d.code}`);
        case 'chest': return opened.has(n.chest);
        case 'streak': return streakBest >= n.days;
        case 'rank': return rank.level >= n.level;
        case 'card': return cards.has(n.card);
        case 'stars': { const st = all.find((x) => x.code === n.stage); return Boolean(st && (progress.get(st.id)?.battle_stars ?? 0) >= n.stars); }
      }
    };
    const view = (kind: string, list: LookDef[]) => list.map((d) => ({
      code: d.code, name: d.name, rarity: d.rarity, need: this.needText(d.need), price: d.need.kind === 'gold' ? d.need.price : null, unlocked: met(kind, d),
      buyable: d.need.kind === 'gold' && !met(kind, d),
    }));
    const frames = view('frame', FRAMES), flags = view('flag', FLAGS), themes = view('theme', THEMES);
    const awards = await this.awardsOf(q, user);
    const titles = [...TITLES.map((t) => ({ code: t.code, name: t.name, rarity: t.rarity, need: `Mở ${t.min} hòm báu trên bản đồ`, price: null, unlocked: opened.size >= t.min, buyable: false })),
      ...WORLD_TITLES.map((t) => ({ code: t.code, name: t.name, rarity: t.rarity as Rarity, need: t.need, price: null, unlocked: awards.has(`title:${t.code}`), buyable: false }))];
    const pick = (list: Array<{ code: string; name: string; rarity: Rarity; unlocked: boolean }>, code: unknown) => {
      const x = list.find((i) => i.code === code && i.unlocked);
      return x ? { code: x.code, name: x.name, rarity: x.rarity } : null;
    };
    const avatar = typeof look.saga_avatar === 'string' && AVATARS.includes(look.saga_avatar) ? look.saga_avatar : null;
    const week = weekKey(this.game.clock.now());
    const freezeMax = (await this.game.cfg()).streak.freeze_max;
    const nickname = (await q<{ nickname: string | null }>('SELECT nickname FROM app_users WHERE id = $1', [user.id]))[0]?.nickname ?? null;
    const items = ITEMS.map((it) => {
      const have = it.code === 'lenh-bai' ? p.freezes : Number(p.buffs?.[ITEM_BUFF[it.code]] ?? 0);
      // lý do chưa mua được (ngoài giới hạn tuần và số vàng): máy chủ quyết định, giao diện chỉ hiện
      const block = it.code === 'lenh-bai' ? (have >= freezeMax ? `Em đang giữ tối đa ${freezeMax} Lệnh bài giữ chuỗi` : null)
        : it.code === 'doi-ten' ? (!nickname ? 'Em chưa có biệt danh: lần đặt đầu tiên miễn phí trong Hồ sơ' : have >= 1 ? 'Em còn 1 lượt “Đổi tướng hiệu” chưa dùng' : null) : null;
      return { code: it.code, name: it.name, price: it.price, weekly: it.weekly, note: it.note,
        bought_week: ledger.filter((r) => r.reason === 'shop' && r.ref_key.startsWith(`hq:shop:item:${it.code}:${week}:`)).length, have, block };
    });
    const chests = all.filter((s) => s.campaign_no !== null).length;
    return {
      frames, flags, themes, titles, items, avatars: AVATARS, opened: opened.size, total: chests, gold: p.gold, freezes: p.freezes, nickname,
      freeze_max: freezeMax, hints: Number(p.buffs?.[HINT_BUFF] ?? 0), renames: Number(p.buffs?.[RENAME_BUFF] ?? 0), rank: { level: rank.level, name: rank.name },
      equipped: { frame: pick(frames, look.saga_frame), title: pick(titles, look.saga_title), avatar, flag: pick(flags, look.saga_flag), theme: pick(themes, look.saga_theme)?.code ?? 'thang-long' },
    };
  }

  async cosmetics(user: UserRow) {
    return this.db.tx((q) => this.wardrobe(q, user));
  }

  /** Trang bị khung / danh hiệu / cờ hiệu / giao diện (null = bỏ; chỉ nhận món đã mở khóa) và ảnh đại diện có sẵn (null = dùng ảnh / chữ cái của em) */
  async equip(user: UserRow, body: { frame?: string | null; title?: string | null; avatar?: string | null; flag?: string | null; theme?: string | null }) {
    return this.db.tx(async (q) => {
      const w = await this.wardrobe(q, user);
      const patch: Record<string, string | null> = {};
      const slots: Array<['frame' | 'title' | 'flag' | 'theme', Array<{ code: string; name: string; unlocked: boolean }>, string, string]> = [
        ['frame', w.frames, 'saga_frame', 'khung'], ['title', w.titles, 'saga_title', 'danh hiệu'], ['flag', w.flags, 'saga_flag', 'cờ hiệu'], ['theme', w.themes, 'saga_theme', 'giao diện']];
      for (const [field, list, key, label] of slots) {
        const code = body[field];
        if (code === undefined) continue;
        if (code !== null) {
          const item = list.find((x) => x.code === code);
          if (!item) throw notFound(label);
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

  /**
   * Mua ở Chợ phiên Thăng Long: khung / cờ hiệu / giao diện mua bằng vàng (mỗi món một lần, khóa sổ vàng `hq:shop:<loại>:<mã>`) hoặc vật phẩm hỗ trợ
   * có giới hạn mỗi tuần (`hq:shop:item:<mã>:<tuần>:<lần>`). Món chỉ mở bằng thành tích không mua được. Mua xong món trang trí thì trang bị luôn.
   */
  async buy(user: UserRow, kind: string, code: string) {
    return this.db.tx(async (q) => {
      const w = await this.wardrobe(q, user); // khóa dòng người chơi (fresh) để hai lần bấm không trừ vàng hai lần
      if (kind === 'item') {
        const it = ITEMS.find((x) => x.code === code) ?? (() => { throw notFound('vật phẩm'); })();
        const cur = w.items.find((x) => x.code === code)!;
        if (cur.block) throw new ConflictException(cur.block);
        if (cur.bought_week >= it.weekly) throw new ConflictException(`Mỗi tuần chỉ mua được ${it.weekly} “${it.name}”`);
        if (w.gold < it.price) throw new ConflictException(`Chưa đủ vàng: cần ${it.price}, em có ${w.gold}`);
        const ok = await this.game.addGold(q, user, -it.price, 'shop', `hq:shop:item:${code}:${weekKey(this.game.clock.now())}:${cur.bought_week + 1}`);
        if (!ok) throw new ConflictException('Giao dịch này đã được ghi nhận');
        if (code === 'lenh-bai') await q('UPDATE hk_players SET freezes = freezes + 1, updated_at = now() WHERE user_id = $1', [user.id]);
        else await q("UPDATE hk_players SET buffs = jsonb_set(COALESCE(buffs, '{}'::jsonb), ARRAY[$2::text], to_jsonb(COALESCE((buffs->>$2::text)::int, 0) + 1)), updated_at = now() WHERE user_id = $1", [user.id, ITEM_BUFF[it.code as 'goi-y' | 'doi-ten']]);
        await logEvent(null, user, 'shop_buy', 'saga_item', null, null, { code, price: it.price }, null, q);
        return { bought: { kind, code, name: it.name, price: it.price }, ...(await this.wardrobe(q, user)) };
      }
      const list = kind === 'frame' ? w.frames : kind === 'flag' ? w.flags : kind === 'theme' ? w.themes : null;
      if (!list) throw notFound('loại hàng');
      const item = list.find((x) => x.code === code) ?? (() => { throw notFound('món hàng'); })();
      if (item.unlocked) throw new ConflictException(`Em đã có “${item.name}”`);
      if (item.price === null) throw new ConflictException(`“${item.name}” chỉ mở bằng thành tích: ${item.need}`);
      if (w.gold < item.price) throw new ConflictException(`Chưa đủ vàng: cần ${item.price}, em có ${w.gold}`);
      if (!(await this.game.addGold(q, user, -item.price, 'shop', `hq:shop:${kind}:${code}`))) throw new ConflictException(`Em đã có “${item.name}”`);
      await q('UPDATE hk_players SET appearance = appearance || $2::jsonb, updated_at = now() WHERE user_id = $1', [user.id, JSON.stringify({ [`saga_${kind}`]: code })]);
      await logEvent(null, user, 'shop_buy', 'saga_look', null, null, { kind, code, price: item.price }, null, q);
      return { bought: { kind, code, name: item.name, price: item.price }, ...(await this.wardrobe(q, user)) };
    });
  }

  /** Chặng mà học sinh đang được phép học; ném 404 khi không có, 409 khi còn khóa (sửa request không mở được chặng khóa) */
  private async openStage(q: Q, user: UserRow, stageId: number): Promise<{ stage: StageRow; progress: ProgressRow | undefined; all: StageBrief[] }> {
    const stage = await this.stage(q, stageId);
    const all = await this.stages(q);
    const map = await this.progressMap(q, user.id);
    const p = map.get(stage.id);
    const lock = p?.completed_at ? null : this.lockOf(stage, all, map, await this.gradeOf(q, user));
    if (lock) throw new ConflictException(lock);
    return { stage, progress: p, all };
  }

  /**
   * Quân lệnh – chi tiết chặng (25/11/2026): lời giao nhiệm vụ (lời dẫn của trò chơi), mục tiêu học, vòng 5 bước, thẻ Binh thư đã nhặt, trận đánh,
   * phần thưởng (kèm bậc Khoa bảng sẽ lên nếu đây là chặng cuối chưa xong của khối). Không lộ nội dung bài, đáp án.
   */
  async stageDetail(user: UserRow, stageId: number) {
    const q = this.read;
    const stage = await this.stage(q, stageId);
    const all = await this.stages(q);
    const progress = await this.progressMap(q, user.id);
    const due = await this.dueByStage(q, user.id);
    const myGrade = await this.gradeOf(q, user);
    const brief = this.brief(stage, all, progress, due, myGrade);
    const p = progress.get(stage.id);
    const items = await q<{ kind: ItemKind; n: number }>("SELECT kind, count(*)::int AS n FROM hk_saga_items WHERE stage_id = $1 AND is_active AND usage IN ('practice', 'both') GROUP BY kind ORDER BY kind", [stage.id]);
    const card = stage.card_code ? (await q<Record<string, any>>('SELECT code, name, title, rarity, portrait FROM hk_saga_cards WHERE code = $1', [stage.card_code]))[0] ?? null : null;
    const next = all.find((s) => s.unlock_after === stage.code) ?? null;
    const meta = (await this.gradesMeta(q)).find((g) => g.grade === stage.grade) ?? null;
    // chặng cuối chưa xong của khối: xong chặng này là xong khối (lên bậc Khoa bảng nếu các khối trước đã xong)
    const gradeLeft = all.filter((s) => s.grade === stage.grade && !progress.get(s.id)?.completed_at);
    const lastOfGrade = gradeLeft.length === 1 && gradeLeft[0].id === stage.id;
    const rankUp = !lastOfGrade || !stage.grade ? null : stage.grade <= 8 ? RANK_NAMES[stage.grade - 5] : `${RANK_NAMES[4]} (khi đủ sao cả bốn khối)`;
    const order = stage.content.order ?? (stage.content.explore ? { by: 'Lời dẫn', text: stage.content.explore.intro } : null);
    return {
      ...brief, objectives: stage.content.objectives, cards_count: stage.content.cards.length, pass_percent: stage.pass_percent, order_text: order,
      grade_info: meta ? { grade: meta.grade, tag: meta.tag, role: meta.role, level: meta.level } : null, of: all.filter((s) => s.grade === stage.grade).length,
      practice: { items: items.reduce((n, i) => n + i.n, 0), kinds: items.map((i) => ({ kind: i.kind, label: KIND_LABEL[i.kind], count: i.n })), best: p?.practice_best ?? 0, tries: p?.practice_tries ?? 0, passed: Boolean(p?.practice_passed_at) },
      explore: stage.has_world || stage.content.explore ? { title: stage.content.explore?.title ?? 'Khám phá thêm cùng lớp', done: Boolean(p?.explore_done_at), hints: p?.explore_hints ?? 0, mistakes: p?.explore_mistakes ?? 0, world: stage.has_world } : null,
      battle: stage.content.battle ? { title: stage.content.battle.title, mode: stage.content.battle.mode, best: p?.battle_best ?? 0, stars: p?.battle_stars ?? 0, tries: p?.battle_tries ?? 0, won: Boolean(p?.battle_won_at) } : null,
      rewards: { xp: stage.reward_xp, gold: stage.reward_gold, card: card ? { ...card, hidden: !p?.completed_at } : null, has_badge: Boolean(stage.badge_code), rank_up: p?.completed_at ? null : rankUp },
      completed_at: p?.completed_at ?? null, unlocks_next: next ? { id: next.id, title: next.title } : null,
    };
  }

  // ------------------------------------------------------------------ Thám sử: nhặt thẻ Binh thư (học ngắn)
  async lesson(user: UserRow, stageId: number) {
    const { stage, progress } = await this.openStage(this.read, user, stageId);
    await logEvent(this.db, user, 'view_lesson', 'saga_stage', stage.id);
    return {
      stage: { id: stage.id, title: stage.title, place: stage.place, date_label: stage.date_label, campaign_no: stage.campaign_no, grade: stage.grade, kind: stage.kind, icon: stage.icon },
      ...lessonView(stage.content), lore: progress?.lore ?? [], done: Boolean(progress?.lesson_done_at), world: stage.has_world,
    };
  }

  /** Xong bước Thám sử: ghi mốc, thưởng một lần, tính nhiệm vụ "học xong bài" */
  private async finishLesson(q: Q, user: UserRow, stage: StageRow, p: ProgressRow): Promise<number> {
    if (p.lesson_done_at) return 0;
    await q('UPDATE hk_saga_progress SET lesson_done_at = now(), updated_at = now() WHERE user_id = $1 AND stage_id = $2', [user.id, stage.id]);
    await this.game.onLessonCompleted(q, user);
    await logEvent(null, user, 'lesson_complete', 'saga_stage', stage.id, null, null, null, q);
    return (await this.game.awardXp(q, user, XP.lesson, 'lesson', `hq:lesson:${stage.id}`)) ? XP.lesson : 0;
  }

  /** Nhặt một thẻ Binh thư ở bước Thám sử (bấm vào địa danh trên bản đồ, đọc xong thì nhận); nhặt đủ thẻ của chặng là xong bước */
  async collectLore(user: UserRow, stageId: number, cardId: string) {
    return this.db.tx(async (q) => {
      const { stage } = await this.openStage(q, user, stageId);
      if (!stage.content.cards.some((c) => c.id === cardId)) throw notFound('thẻ Binh thư');
      const p = await this.lockProgress(q, user, stage.id);
      const had = p.lore ?? [];
      const fresh = !had.includes(cardId);
      const lore = fresh ? [...had, cardId] : had;
      if (fresh) {
        await q('UPDATE hk_saga_progress SET lore = $3, updated_at = now() WHERE user_id = $1 AND stage_id = $2', [user.id, stage.id, lore]);
        await this.game.bumpQuests(q, user, 'lore_collected', 1);
      }
      const complete = stage.content.cards.every((c) => lore.includes(c.id));
      const xp = complete ? await this.finishLesson(q, user, stage, p) : 0;
      return { card: cardId, fresh, lore, total: stage.content.cards.length, done: complete, first_done: xp > 0, xp };
    });
  }

  /** Nhận hết thẻ còn lại (đường cũ "học xong bài" và người chơi máy): giữ để không vỡ các luồng đã có */
  async completeLesson(user: UserRow, stageId: number) {
    return this.db.tx(async (q) => {
      const { stage } = await this.openStage(q, user, stageId);
      const p = await this.lockProgress(q, user, stage.id);
      const missing = stage.content.cards.map((c) => c.id).filter((id) => !(p.lore ?? []).includes(id));
      if (missing.length) {
        await q('UPDATE hk_saga_progress SET lore = $3, updated_at = now() WHERE user_id = $1 AND stage_id = $2', [user.id, stage.id, [...(p.lore ?? []), ...missing]]);
        await this.game.bumpQuests(q, user, 'lore_collected', missing.length);
      }
      const xp = await this.finishLesson(q, user, stage, p);
      return { done: true, first: !p.lesson_done_at, xp };
    });
  }

  /**
   * Bộ sưu tập Binh thư (25/11/2026): mọi thẻ kiến thức của các chặng đã công bố, xếp vào ba ngăn Nhân vật / Kế sách / Địa danh; thẻ chưa nhặt chỉ lộ
   * tên, loại và chặng có thẻ. Thẻ nhân vật lớn (hk_saga_cards) lấy ở /api/saga/cards.
   */
  async lore(user: UserRow) {
    const q = this.read;
    const rows = await q<{ id: number; title: string; grade: number | null; cards: Array<Record<string, any>> | null; sources: Array<Record<string, any>> | null }>(
      "SELECT s.id, s.title, s.grade, s.content->'cards' AS cards, s.content->'sources' AS sources FROM hk_saga_stages s WHERE s.status = 'published' ORDER BY s.position");
    const progress = await this.progressMap(q, user.id);
    const out = rows.flatMap((s) => (s.cards ?? []).map((c) => {
      const owned = (progress.get(s.id)?.lore ?? []).includes(String(c.id));
      const kind = c.kind as keyof typeof LORE_TAG;
      const base = { key: `${s.id}:${c.id}`, stage_id: s.id, stage_title: s.title, grade: s.grade, card: String(c.id), kind, tag: LORE_TAG[kind], shelf: LORE_SHELF[kind], title: String(c.title), owned };
      if (!owned) return base;
      return { ...base, body: String(c.body), facts: c.facts ?? [], source: (s.sources ?? []).find((x) => x.key === c.source) ?? null };
    }));
    const shelf = (k: string) => ({ owned: out.filter((x) => x.shelf === k && x.owned).length, total: out.filter((x) => x.shelf === k).length });
    return { cards: out, shelves: { 'nhan-vat': shelf('nhan-vat'), 'ke-sach': shelf('ke-sach'), 'dia-danh': shelf('dia-danh') }, owned: out.filter((x) => x.owned).length, total: out.length };
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
        if (!p.lesson_done_at) throw new ConflictException('Hãy nhặt đủ thẻ Binh thư ở bước Thám sử trước khi vào Hội đồng quân sự');
        const rows = await q<ItemRow>("SELECT id, kind, prompt, data, explanation, objective, source FROM hk_saga_items WHERE stage_id = $1 AND is_active AND usage IN ('practice', 'both') ORDER BY position", [stage.id]);
        if (!rows.length) throw new ConflictException('Chặng này chưa có câu luyện tập');
        const seed = Math.floor(Math.random() * 2 ** 30);
        state = { v: 1, slots: rows.map((r, i) => newSlot(r, seed + i * 977)) } satisfies PracticeState;
      } else if (kind === 'explore') {
        // khám phá thêm cùng lớp (thế giới khối 3D, không bắt buộc từ 25/11/2026): mở sau khi qua Hội đồng quân sự
        if (!stage.content.world && !stage.content.explore) throw new ConflictException('Chặng này chưa có phần khám phá thêm');
        if (!p.practice_passed_at) throw new ConflictException(`Hãy đạt ít nhất ${stage.pass_percent}% ở Hội đồng quân sự trước khi khám phá thêm`);
        // chặng có nhiệm vụ thế giới khối: vào phòng chung của lớp em (mỗi lớp một phòng cho mỗi cuộc kháng chiến)
        const world = await this.worldOf(q, stage);
        state = world && stage.campaign_no ? newWorld(await this.worldRoom(q, (await this.worldClass(q, user, opts.classId)).id, stage.campaign_no)) : newExplore();
      } else {
        if (!stage.content.battle) throw new ConflictException('Chặng này không có trận đánh');
        // 25/11/2026: Xuất trận mở ngay sau Hội đồng quân sự (không còn phải nhập vai tới điểm chạm trán)
        if (!p.practice_passed_at) throw new ConflictException(`Hãy đạt ít nhất ${stage.pass_percent}% ở Hội đồng quân sự trước khi xuất trận`);
        const scn = stage.content.battle;
        const made = scn.mode === 'bachdang' ? createBachDang(scn) : scn.mode === 'council' ? createCouncil(scn) : createTactics(scn, p.practice_best);
        state = { v: 1, mode: scn.mode, engine: made.state, knowledge: p.practice_best } satisfies BattleSessionState;
        events = made.events;
        await q('UPDATE hk_saga_progress SET battle_tries = battle_tries + 1, updated_at = now() WHERE user_id = $1 AND stage_id = $2', [user.id, stage.id]);
      }
      const row = (await q<SessionRow>(`INSERT INTO hk_saga_sessions (user_id, stage_id, kind, state) VALUES ($1, $2, $3, $4) RETURNING ${SESSION_COLS}`, [user.id, stage.id, kind, JSON.stringify(state)]))[0];
      return { ...(await this.view(q, user, row, stage)), resumed: false, events };
    });
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
      if (!stage!.content.explore) throw new ConflictException('Chặng này chưa có phần khám phá thêm');
      return { ...head, ...publicExplore(stage!.content.explore, row.state as ExploreState), battle };
    }
    const b = row.state as BattleSessionState;
    const scn = stage!.content.battle;
    const pub = b.mode === 'bachdang' ? publicBachDang(scn as BdScenario, b.engine as BdState) : b.mode === 'council' ? publicCouncil(scn as CouncilScenario, b.engine as CState) : publicTactics(scn as TacticsScenario, b.engine as TState);
    return { ...head, knowledge: b.knowledge, ...pub };
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
  /**
   * Ghi một câu đã chấm. Trả lời đúng: +10 KN +2 vàng – ở Hội đồng mỗi câu chỉ một lần (khóa `hq:ans:<câu>`), ở Luyện binh riêng mỗi câu mỗi ngày
   * (khóa `hq:rv:<câu>:<ngày>`); trả lời sai thì câu vào danh sách ôn. Trả về số KN / vàng thật sự cộng để màn chơi hiện "+10 KN".
   */
  private async recordAnswer(q: Q, user: UserRow, item: ItemRow & { stage_id: number }, sessionId: number, mode: 'practice' | 'review', correct: boolean): Promise<{ xp: number; gold: number }> {
    await q('INSERT INTO hk_saga_answers (user_id, item_id, stage_id, session_id, mode, correct) VALUES ($1, $2, $3, $4, $5, $6)', [user.id, item.id, item.stage_id, sessionId, mode, correct]);
    const now = this.game.clock.now();
    if (!correct) {
      // câu sai: tới hạn ngay (due_at rỗng), về ô 0
      await q(`INSERT INTO hk_saga_review (user_id, item_id, box, due_at) VALUES ($1, $2, 0, NULL)
               ON CONFLICT (user_id, item_id) DO UPDATE SET wrong_count = hk_saga_review.wrong_count + 1, last_wrong_at = now(), cleared_at = NULL, box = 0, due_at = NULL`, [user.id, item.id]);
      return { xp: 0, gold: 0 };
    }
    await this.game.onCorrectAnswer(q, user);
    // Luyện binh riêng: câu tới hạn đúng lần đầu → hẹn ôn lại sau 3 ngày; đúng thêm lần nữa khi tới hạn → đã nhớ chắc (ra khỏi hàng ôn)
    if (mode === 'review') {
      await q(`UPDATE hk_saga_review SET box = LEAST(box + 1, 2), cleared_at = CASE WHEN box >= 1 THEN now() END,
                 due_at = CASE WHEN box >= 1 THEN due_at ELSE $3::timestamptz + make_interval(days => $4) END
               WHERE user_id = $1 AND item_id = $2 AND cleared_at IS NULL AND ${REVIEW_DUE('hk_saga_review', '$3')}`, [user.id, item.id, now, REVIEW_GAP_DAYS]);
    }
    const ref = mode === 'review' ? `hq:rv:${item.id}:${dayKey(this.game.clock.now())}` : `hq:ans:${item.id}`;
    const xp = (await this.game.awardXp(q, user, mode === 'review' ? XP.review : XP.answer, 'practice', ref)) ? (mode === 'review' ? XP.review : XP.answer) : 0;
    const gold = (await this.game.addGold(q, user, GOLD.answer, 'answer', ref)) ? GOLD.answer : 0;
    return { xp, gold };
  }

  /** "Gợi ý chiến thuật" ở Hội đồng quân sự: dùng một vật phẩm (mua ở Chợ phiên) để gạch bỏ một phương án sai của câu đang làm */
  private async useHint(q: Q, user: UserRow, slots: SlotState[], itemId: number): Promise<Record<string, any>> {
    const slot = slots.find((s) => s.item_id === itemId) ?? (() => { throw new BadRequestException('Câu này không thuộc lượt đang làm'); })();
    const item = (await this.items(q, [slot.item_id])).get(slot.item_id)!;
    const removed = hintFor(item, slot);
    if (!removed) throw new ConflictException('Câu này không dùng được gợi ý (đã trả lời, đã dùng gợi ý hoặc quá ít phương án)');
    const p = await this.game.fresh(q, user);
    const have = Number(p.buffs?.[HINT_BUFF] ?? 0);
    if (have < 1) throw new ConflictException('Em chưa có “Gợi ý chiến thuật”. Có thể mua ở Chợ phiên Thăng Long.');
    await q(`UPDATE hk_players SET buffs = jsonb_set(COALESCE(buffs, '{}'::jsonb), '{${HINT_BUFF}}', to_jsonb($2::int)), updated_at = now() WHERE user_id = $1`, [user.id, have - 1]);
    slot.hint = removed;
    return { item_id: item.id, hint: true, removed, hints_left: have - 1 };
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
    const st = row.state as PracticeState;
    if (action.type === 'hint') return { outcome: await this.useHint(q, user, st.slots, Number(action.item_id)), finished: null };
    if (action.type !== 'answer') throw new BadRequestException('Hội đồng quân sự chỉ nhận câu trả lời hoặc gợi ý');
    const slot = st.slots.find((s) => s.item_id === Number(action.item_id)) ?? (() => { throw new BadRequestException('Câu này không thuộc lượt luyện tập'); })();
    const item = (await this.items(q, [slot.item_id])).get(slot.item_id)!;
    const graded = gradeItem(item, slot, action.answer);
    let outcome: Record<string, any> = { item_id: item.id, ...graded };
    if (graded.done) {
      const got = await this.recordAnswer(q, user, item, row.id, 'practice', graded.score >= 1);
      // KN / vàng của lượt này (chỉ các câu đúng lần đầu được cộng) cộng dồn trong trạng thái phiên
      st.xp = (st.xp ?? 0) + got.xp;
      st.gold = (st.gold ?? 0) + got.gold;
      outcome = { ...outcome, ...(await this.explain(q, item)), xp: got.xp, gold: got.gold };
    }
    if (!st.slots.every((s) => s.done)) return { outcome, finished: null };
    const t = tally(st.slots, stage.pass_percent);
    const firstPass = t.passed && !p.practice_passed_at;
    await q(`UPDATE hk_saga_progress SET practice_best = GREATEST(practice_best, $3), practice_tries = practice_tries + 1,
               practice_passed_at = COALESCE(practice_passed_at, CASE WHEN $4 THEN now() END), updated_at = now() WHERE user_id = $1 AND stage_id = $2`, [user.id, stage.id, t.percent, t.passed]);
    await logEvent(null, user, 'attempt_finish', 'saga_stage', stage.id, null, { percent: t.percent, passed: t.passed }, null, q);
    return { outcome, finished: { ...t, pass_percent: stage.pass_percent, best: Math.max(p.practice_best, t.percent), first_pass: firstPass, xp: st.xp ?? 0, gold: st.gold ?? 0 } };
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
    if (!stage.content.explore) throw new ConflictException('Chặng này chưa có phần khám phá thêm');
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
    if (!stage.content.world || stage.campaign_no === null) return null;
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
      standing: (x, z) => this.hub.players(st.room).some((pl) => pl.id !== user.id && Math.floor(pl.x) === x && Math.floor(pl.z) === z),
      // danh hiệu "Người giữ làng": dân làng em từng giúp góp sức ở các nhiệm vụ sau
      bonusYield: awards.has('title:nguoi-giu-lang') ? VILLAGE_BONUS : 0,
    };
    const { events, effects } = applyWorld(world.quest, world.map, st, action as WorldAction, ctx);
    await this.worldHelpers(q, user, st, world, occupied, totals, now, awards.has('title:nguoi-giu-lang'), ctx, events, effects, pending, action);
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
    villagers: boolean, ctx: WorldCtx, events: WorldEvent[], effects: WorldEffect[], pending: WorldPending[], action: Record<string, unknown>): Promise<void> {
    const step = st.done ? undefined : world.quest.steps[st.step];
    if (!step || step.type !== 'place') return;
    const placedNow = effects.filter((e) => e.kind === 'place' && e.zone === step.zone).length;
    const total = (totals.get(step.zone) ?? 0) + placedNow;
    if ((st.placed[step.zone] ?? 0) < step.count || total >= step.team) return;
    if (!st.own_done_at) st.own_done_at = now;
    const mates = this.hub.players(st.room).filter((x) => x.id !== user.id).length;
    if (mates > 0 && now - st.own_done_at < 60_000) return;
    const zone = world.map.zones.find((z) => z.id === step.zone)!;
    // dân binh không đặt lên ô đã có vật, ô vừa đặt, chỗ các bạn đang đứng và chỗ em đang đứng (kể cả khi em mất kết nối chung)
    // và không đặt sát người (ô kề 8 hướng) – không thì có thể vây kín một bạn đang đứng trong góc vùng
    const me: Array<[number, number]> = Array.isArray(action.from) ? [[Math.floor(Number(action.from[0])), Math.floor(Number(action.from[1]))]] : [];
    const people: Array<[number, number]> = [...this.hub.players(st.room).map((pl): [number, number] => [Math.floor(pl.x), Math.floor(pl.z)]), ...me];
    const taken = new Set([...occupied, ...effects.filter((e): e is Extract<WorldEffect, { kind: 'place' }> => e.kind === 'place').map((e) => `${e.x},${e.z}`)]);
    for (const [px, pz] of people) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) taken.add(`${px + dx},${pz + dz}`);
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
    const events = b.mode === 'bachdang' ? applyBachDang(scn as BdScenario, b.engine as BdState, action as any)
      : b.mode === 'council' ? applyCouncil(scn as CouncilScenario, b.engine as CState, action as any) : applyTactics(scn as TacticsScenario, b.engine as TState, action as any);
    if ((b.engine as { status: string }).status === 'active') return { outcome: { events }, finished: null };
    const r = b.mode === 'bachdang' ? bachDangResult(scn as BdScenario, b.engine as BdState)
      : b.mode === 'council' ? councilResult(scn as CouncilScenario, b.engine as CState) : tacticsResult(scn as TacticsScenario, b.engine as TState);
    const firstWin = r.won && !p.battle_won_at;
    // mỗi sao lần đầu đạt: +30 KN +10 vàng (khóa `hq:star:<chặng>:<sao>` nên đánh lại không được thưởng lần hai, chỉ sao mới được thưởng)
    let xp = 0, gold = 0;
    if (r.won) {
      await q(`UPDATE hk_saga_progress SET battle_won_at = COALESCE(battle_won_at, now()), battle_best = GREATEST(battle_best, $3), battle_stars = GREATEST(battle_stars, $4), updated_at = now()
               WHERE user_id = $1 AND stage_id = $2`, [user.id, stage.id, r.score, r.stars]);
      await this.game.bumpQuests(q, user, 'battles_completed', 1);
      for (let n = 1; n <= r.stars; n++) {
        if (await this.game.awardXp(q, user, XP.star, 'battle', `hq:star:${stage.id}:${n}`)) xp += XP.star;
        if (await this.game.addGold(q, user, GOLD.star, 'star', `hq:star:${stage.id}:${n}`)) gold += GOLD.star;
      }
    }
    await logEvent(null, user, 'battle_finish', 'saga_stage', stage.id, null, { won: r.won, stars: r.stars, score: r.score }, null, q);
    return { outcome: { events }, finished: { ...r, first_win: firstWin, xp, gold, best: Math.max(p.battle_best, r.won ? r.score : 0), text: r.won ? scn.win_text : scn.lose_text } };
  }

  // ------------------------------------------------------------------ hoàn thành chặng và phần thưởng
  /**
   * Chặng hoàn thành khi đã nhặt đủ thẻ Thám sử, đạt ngưỡng ở Hội đồng quân sự và (nếu có) thắng trận; khám phá thêm 3D không bắt buộc (25/11/2026).
   * Phần thưởng chỉ trao ở lần hoàn thành đầu tiên; điểm và vàng còn được sổ cái chặn trùng theo khóa `hq:stage:<id>`.
   */
  private async maybeComplete(q: Q, user: UserRow, stage: StageRow): Promise<Record<string, any> | null> {
    const p = (await q<ProgressRow>('SELECT * FROM hk_saga_progress WHERE user_id = $1 AND stage_id = $2 FOR UPDATE', [user.id, stage.id]))[0];
    if (!p?.lesson_done_at || !p.practice_passed_at || (stage.content.battle && !p.battle_won_at)) return null;
    const stars = knowledgeStars(p.practice_best, stage.pass_percent);
    const first = !p.completed_at;
    const all = await this.stages(q);
    const before = await this.progressMap(q, user.id);
    const myGrade = await this.gradeOf(q, user);
    const meta = await this.gradesMeta(q);
    const rankBefore = this.rankOf(this.gradeSummary(meta, all.map((s) => this.brief(s, all, before, new Map(), myGrade)), myGrade, new Map()));
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
    const next = all.find((s) => s.unlock_after === stage.code) ?? null;
    const progress = await this.progressMap(q, user.id);
    const inCampaign = stage.campaign_no === null ? [] : all.filter((s) => s.campaign_no === stage.campaign_no);
    const inGrade = all.filter((s) => s.grade === stage.grade);
    const rankAfter = this.rankOf(this.gradeSummary(meta, all.map((s) => this.brief(s, all, progress, new Map(), myGrade)), myGrade, new Map()));
    const nextInGrade = inGrade.find((s) => !progress.get(s.id)?.completed_at && !this.lockOf(s, all, progress, myGrade)) ?? null;
    return {
      first, stars: Math.max(stars, p.stars), knowledge_percent: p.practice_best, battle: stage.content.battle ? { stars: p.battle_stars, score: p.battle_best } : null, rewards,
      next: next && !progress.get(next.id)?.completed_at ? { id: next.id, title: next.title, campaign_no: next.campaign_no, grade: next.grade }
        : nextInGrade ? { id: nextInGrade.id, title: nextInGrade.title, campaign_no: nextInGrade.campaign_no, grade: nextInGrade.grade } : null,
      campaign_done: inCampaign.length > 0 && inCampaign.every((s) => progress.get(s.id)?.completed_at),
      grade_done: inGrade.length > 0 && inGrade.every((s) => progress.get(s.id)?.completed_at), grade: stage.grade,
      rank_up: rankAfter.level > rankBefore.level ? { from: rankBefore.name, to: rankAfter.name, level: rankAfter.level } : null,
    };
  }

  /**
   * Sử quan tổng kết của chặng đã hoàn thành (25/11/2026): sao, bảng "Quyết định / Của em / Lịch sử" của trận gần nhất, lời nhận xét của Tiểu Tướng
   * (lấy từ lỗi trận đánh hoặc mục tiêu còn yếu, kèm nguồn), diễn biến lịch sử đã kiểm chứng, phần thưởng và bậc Khoa bảng.
   */
  async summary(user: UserRow, stageId: number) {
    const q = this.read;
    const stage = await this.stage(q, stageId);
    const progress = await this.progressMap(q, user.id);
    const p = progress.get(stage.id);
    if (!p?.completed_at) throw new ConflictException('Em chưa hoàn thành chặng này');
    const all = await this.stages(q);
    const next = all.find((s) => s.unlock_after === stage.code) ?? null;
    const weak = await this.weakObjectives(q, user.id, stage.id);
    // trận gần nhất đã kết thúc của chặng (thắng ưu tiên): bảng so sánh, điều làm tốt và điều chưa đúng
    const last = stage.content.battle ? (await q<{ result: Record<string, any> | null }>(
      "SELECT result FROM hk_saga_sessions WHERE user_id = $1 AND stage_id = $2 AND kind = 'battle' AND status = 'done' AND result IS NOT NULL ORDER BY (result->>'won')::boolean DESC NULLS LAST, finished_at DESC LIMIT 1", [user.id, stage.id]))[0]?.result ?? null : null;
    const mistakes: Array<{ text: string }> = Array.isArray(last?.mistakes) ? last!.mistakes : [];
    const good: string[] = Array.isArray(last?.good) ? last!.good : [];
    const sourceTitle = debriefView(stage.content).sources as Array<{ title: string; publisher: string }>;
    const weakOne = weak.filter((w) => w.percent < 80).sort((a, b) => a.percent - b.percent)[0];
    const comment = mistakes[0]?.text
      ? `${mistakes[0].text}${good[0] ? ` Em đã làm tốt: ${good[0].charAt(0).toLowerCase()}${good[0].slice(1)}` : ''}`
      : weakOne ? `Em đã thắng, nhưng mục tiêu “${weakOne.text}” mới đúng ${weakOne.percent}%. Hãy ôn lại ở Luyện binh riêng.`
        : good[0] ?? 'Em đã hoàn thành chặng này rất tốt. Hãy đọc lại diễn biến lịch sử bên dưới để nhớ lâu hơn.';
    const myGrade = await this.gradeOf(q, user);
    const rank = this.rankOf(this.gradeSummary(await this.gradesMeta(q), all.map((s) => this.brief(s, all, progress, new Map(), myGrade)), myGrade, new Map()));
    return {
      stage: { id: stage.id, title: stage.title, place: stage.place, date_label: stage.date_label, campaign_no: stage.campaign_no, grade: stage.grade },
      result: { stars: p.stars, knowledge_percent: p.practice_best, practice_tries: p.practice_tries, explore_hints: p.explore_hints, explore_mistakes: p.explore_mistakes,
        battle: stage.content.battle ? { stars: p.battle_stars, score: p.battle_best, tries: p.battle_tries, mode: stage.content.battle.mode, title: stage.content.battle.title } : null },
      compare: Array.isArray(last?.compare) ? last!.compare : [], comment, comment_source: sourceTitle[0] ? `${sourceTitle[0].title} (${sourceTitle[0].publisher})` : null,
      battle_text: last?.text ?? null, debrief: debriefView(stage.content), weak_objectives: weak.filter((w) => w.percent < 80),
      rewards: { xp: stage.reward_xp, gold: stage.reward_gold, card: stage.card_code ? (await q('SELECT code, name, title, rarity, portrait FROM hk_saga_cards WHERE code = $1', [stage.card_code]))[0] ?? null : null },
      rank: { level: rank.level, name: rank.name },
      next: next ? { id: next.id, title: next.title, campaign_no: next.campaign_no, grade: next.grade } : null,
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
       WHERE r.user_id = $1 AND r.cleared_at IS NULL AND ${REVIEW_DUE('r', '$2')} ORDER BY r.last_wrong_at DESC LIMIT 30`, [user.id, this.game.clock.now()]);
    // câu đã trả lời đúng một lần, hẹn ôn lại sau (chưa tới hạn)
    const later = await q<{ n: number; next_at: Date | null }>(
      `SELECT count(*)::int AS n, min(r.due_at) AS next_at FROM hk_saga_review r JOIN hk_saga_items i ON i.id = r.item_id AND i.is_active
       WHERE r.user_id = $1 AND r.cleared_at IS NULL AND NOT ${REVIEW_DUE('r', '$2')}`, [user.id, this.game.clock.now()]);
    const weak = (await this.weakObjectives(q, user.id)).filter((w) => w.percent < 80).sort((a, b) => a.percent - b.percent).slice(0, 8);
    const pool = Number((await q<{ n: string }>(
      `SELECT count(*) AS n FROM hk_saga_items i JOIN hk_saga_stages s ON s.id = i.stage_id AND s.status = 'published' JOIN hk_saga_progress p ON p.stage_id = s.id AND p.user_id = $1 AND p.practice_tries > 0
       WHERE i.is_active AND i.usage IN ('review', 'both') AND i.kind = ANY($2)`, [user.id, REVIEW_KINDS]))[0].n);
    const active = (await q<{ id: number }>("SELECT id::int AS id FROM hk_saga_sessions WHERE user_id = $1 AND kind = 'review' AND status = 'active'", [user.id]))[0];
    const stats = (await q<{ answers: number; right: number }>('SELECT count(*)::int AS answers, count(*) FILTER (WHERE correct)::int AS right FROM hk_saga_answers WHERE user_id = $1', [user.id]))[0];
    return { due: due.map((d) => ({ ...d, kind_label: KIND_LABEL[d.kind as ItemKind] })), later: { count: later[0]?.n ?? 0, next_at: later[0]?.next_at ?? null, gap_days: REVIEW_GAP_DAYS },
      weak_objectives: weak, pool, can_start: pool > 0, active_session_id: active?.id ?? null, suggest: await this.suggestion(q, user),
      size: Math.min(REVIEW_SIZE, pool), stats: { answers: stats.answers, right: stats.right, percent: stats.answers ? Math.round((stats.right / stats.answers) * 100) : 0 } };
  }

  /** Lượt ôn: ưu tiên câu đã sai, rồi câu thuộc mục tiêu còn yếu, sau đó câu bất kỳ của các chặng đã luyện; mỗi câu có đồng hồ do máy chủ giữ */
  async startReview(user: UserRow, restart = false) {
    return this.db.tx(async (q) => {
      const active = (await q<SessionRow>(`SELECT ${SESSION_COLS} FROM hk_saga_sessions WHERE user_id = $1 AND kind = 'review' AND status = 'active' FOR UPDATE`, [user.id]))[0];
      if (active && !restart) return { ...(await this.view(q, user, active, null)), resumed: true, events: [] };
      if (active) await q("UPDATE hk_saga_sessions SET status = 'abandoned', finished_at = now(), updated_at = now() WHERE id = $1", [active.id]);
      const rows = await q<ItemRow & { stage_id: number; due: boolean }>(
        `SELECT i.id, i.stage_id, i.kind, i.prompt, i.data, i.explanation, i.objective, i.source, (r.item_id IS NOT NULL AND ${REVIEW_DUE('r', '$4')}) AS due
         FROM hk_saga_items i JOIN hk_saga_stages s ON s.id = i.stage_id AND s.status = 'published'
         JOIN hk_saga_progress p ON p.stage_id = s.id AND p.user_id = $1 AND p.practice_tries > 0
         LEFT JOIN hk_saga_review r ON r.item_id = i.id AND r.user_id = $1 AND r.cleared_at IS NULL
         WHERE i.is_active AND i.usage IN ('review', 'both') AND i.kind = ANY($2)
         ORDER BY (r.item_id IS NOT NULL AND ${REVIEW_DUE('r', '$4')}) DESC, (r.item_id IS NOT NULL) ASC, r.last_wrong_at DESC NULLS LAST, random() LIMIT $3`, [user.id, REVIEW_KINDS, REVIEW_SIZE, this.game.clock.now()]);
      if (!rows.length) throw new ConflictException('Hãy luyện tập ít nhất một chặng trước khi ôn');
      const seed = Math.floor(Math.random() * 2 ** 30);
      const now = this.game.clock.now().getTime();
      const state: ReviewState = { v: 1, streak: 0, best_streak: 0, slots: rows.map((r, i) => ({ ...newSlot(r, seed + i * 977), served_at: i === 0 ? now : null, limit_s: r.kind === 'sequence' ? 60 : r.kind === 'tactic' ? 30 : 20 })) };
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
    // xếp dòng thời gian: mỗi lần đặt một thẻ là một bước, chưa đủ thẻ thì câu chưa xong (đồng hồ vẫn chạy)
    if (!graded.done) return { outcome: { item_id: item.id, ...graded, timeout: false }, finished: null };
    const correct = graded.score >= 1;
    // Luyện binh riêng: đúng một câu +10 KN +2 vàng, mỗi câu một lần mỗi ngày (recordAnswer)
    const { xp, gold } = await this.recordAnswer(q, user, item, row.id, 'review', correct);
    st.streak = correct ? st.streak + 1 : 0;
    st.best_streak = Math.max(st.best_streak, st.streak);
    const nextSlot = st.slots[index + 1];
    if (nextSlot) { nextSlot.served_at = null; nextSlot.opened_at = now; }
    // lịch ôn của câu sau lượt này: hẹn ôn lại sau mấy ngày, hay đã nhớ chắc (ra khỏi hàng ôn)
    const sched = (await q<{ cleared: boolean; due_at: Date | null }>('SELECT cleared_at IS NOT NULL AS cleared, due_at FROM hk_saga_review WHERE user_id = $1 AND item_id = $2', [user.id, item.id]))[0];
    const review = !sched ? null : sched.cleared ? { next: 'done' } : correct && sched.due_at && sched.due_at.getTime() > now ? { next: 'later', days: REVIEW_GAP_DAYS, due_at: sched.due_at } : { next: 'again' };
    const outcome = { item_id: item.id, ...graded, timeout: late, streak: st.streak, xp, gold, review, ...(await this.explain(q, item)) };
    st.xp = (st.xp ?? 0) + xp;
    st.gold = (st.gold ?? 0) + gold;
    if (nextSlot) return { outcome, finished: null };
    const right = st.slots.filter((s) => s.score >= 1).length;
    await logEvent(null, user, 'attempt_finish', 'saga_review', null, null, { right, total: st.slots.length }, null, q);
    return { outcome, finished: { right, total: st.slots.length, percent: Math.round((right / st.slots.length) * 100), best_streak: st.best_streak, xp: st.xp, gold: st.gold } };
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
