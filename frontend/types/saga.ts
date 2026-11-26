/** Kiểu dữ liệu của Hành trình Đông A (/api/saga): bản đồ, chặng, phiên chơi, ôn tập, bộ sưu tập và kho tư liệu. Đáp án không bao giờ nằm trong các kiểu gửi cho học sinh. */
import type { Hud } from '@/types/gamification';
import type { PlacedBlock, TerrainInfo, WorldChangeInfo, WorldMapInfo } from '@/lib/world-map';

export type StageState = 'locked' | 'ready' | 'learning' | 'done' | 'review';
export type StepState = 'locked' | 'ready' | 'done' | 'none';
export type XY = [number, number];

export interface SagaCampaign {
  campaign_no: number; title: string; short_title: string; years: string; enemy: string; places: string; summary: string;
  stages: number; done: number; stars: number; max_stars: number; percent: number; completed: boolean; is_new: boolean; available: boolean;
}
/** Một khối lớp 6–9 (25/11/2026): mỗi khối một chiến dịch, không trùng nội dung; `state`: đã xong / khối của em / mở để học trước hoặc ôn / khóa */
export interface GradeSummary {
  grade: number; tag: string; role: string; level: string; title: string; forms: string; note: string | null; reward: string;
  stages: number; done: number; stars: number; max_stars: number; completed: boolean; state: 'done' | 'current' | 'open' | 'locked'; mine: boolean; lock_reason: string | null;
  questions: number; battles: number;
}
/** Bậc Khoa bảng: Học trò → Thái học sinh (xong Khối 6) → Thám hoa (Khối 7) → Bảng nhãn (Khối 8) → Trạng nguyên (Khối 9 và đủ sao cả bốn khối) */
export interface RankInfo { level: number; name: string; next_name: string | null; next: { done: number; total: number; unit: 'chặng' | 'sao'; grade: number | null } | null; names: string[] }
export interface HomeQuest { id: number; title: string; metric: string; progress: number; target: number; done: boolean; reward_xp: number; reward_gold: number }
export interface Suggest { kind: 'review' | 'weak'; topic: string; stages: string[]; wrong: number; size: number; xp: number; text: string }
export interface StreakView {
  current: number; longest: number; freezes: number; freeze_max: number; last_day: string | null; at_risk: boolean;
  week: Array<{ day: string; weekday: number; state: 'done' | 'freeze' | 'today' | 'miss' }>;
  milestones: Array<{ days: number; label: string; reached: boolean }>;
}
export interface SagaHome {
  learner: { name: string; full_name: string; avatar_url: string | null; class_name: string | null; grade?: number | null };
  hud: Pick<Hud, 'level' | 'gold' | 'xp' | 'streak' | 'daily' | 'unseen_celebrations'>;
  campaigns: SagaCampaign[];
  grades: GradeSummary[]; grade: number | null; rank: RankInfo;
  next: { stage_id: number; title: string; campaign_no: number | null; grade: number | null; order: number; of: number; place: string; date_label: string; state: StageState;
    has_battle: boolean; battle_mode: BattleMode | null; steps: StageBrief['steps']; lore: { have: number; total: number } } | null;
  daily: { title: string; progress: number; target: number; done: boolean; reward_xp: number; reward_gold: number; done_count: number; total: number } | null;
  quests: HomeQuest[]; quests_reset: string;
  review_due: number; totals: { stages: number; done: number };
  suggest: Suggest | null; streak: StreakView;
  /** khung ảnh đại diện, danh hiệu, cờ hiệu, giao diện đang trang bị */
  look?: SagaLook; hints?: number;
}
export type BattleMode = 'tactics' | 'bachdang' | 'council';

export interface StageBrief {
  id: number; code: string; campaign_no: number | null; grade: number | null; position: number; order: number; map_order: number | null; title: string; place: string; date_label: string;
  kind: 'battle' | 'council' | 'strategy' | 'prepare'; icon: string; summary: string;
  map_x: number; map_y: number; anchor_x: number | null; anchor_y: number | null; has_battle: boolean; battle_mode: BattleMode | null; has_world: boolean;
  state: StageState; lock_reason: string | null; stars: number; knowledge_percent: number; battle_stars: number; review_due: number; lore: { have: number; total: number };
  /** vòng 5 bước: Quân lệnh (order) → Thám sử (lesson) → Hội đồng (practice) → Xuất trận (battle) → Sử quan (summary); world = khám phá thêm 3D */
  steps: { order: StepState; lesson: StepState; practice: StepState; battle: StepState; summary: StepState; world: StepState; explore: StepState; next: 'lesson' | 'practice' | 'battle' | 'summary' | null };
}
export interface SagaMapInfo {
  campaign_no: number; title: string; short_title: string; years: string; enemy?: string; places?: string; summary?: string;
  image_key: string; image_url: string | null; image_w: number; image_h: number; credit: string; credit_url: string | null;
}
/** Hòm báu trên bản đồ (17/11/2026): `after` = số thứ tự chặng đứng trước hòm; hòm cuối phần có `after` bằng số chặng của phần */
/** Hòm báu bí ẩn: độ hiếm chỉ lộ ra khi mở; `odds` là tỉ lệ công bố, `max_gold` là mức vàng cao nhất */
export type ChestRarity = 'common' | 'rare' | 'epic' | 'legendary';
export interface SagaChest { key: string; kind: 'stage' | 'part'; after: number; state: 'locked' | 'ready' | 'opened'; max_gold?: number; odds?: Array<{ rarity: ChestRarity; percent: number }> }
/** Khung ảnh đại diện / danh hiệu nhận từ hòm báu (17/11/2026) */
export type LookRarity = 'common' | 'rare' | 'epic' | 'legendary';
export interface LookItem { code: string; name: string; rarity: LookRarity }
export interface LookSlot extends LookItem { need: string; unlocked: boolean; price?: number | null; buyable?: boolean }
export type ThemeCode = 'thang-long' | 'bach-dang' | 'dem-dong-bo-dau' | 'hoang-thanh';
export interface SagaLook {
  frame: LookItem | null; title: LookItem | null; /** ảnh đại diện có sẵn (Rồng Con, danh tướng); null = ảnh / chữ cái của em */ avatar?: string | null;
  flag?: LookItem | null; theme?: ThemeCode | string;
}
export interface ShopItemView { code: 'lenh-bai' | 'goi-y'; name: string; price: number; weekly: number; note: string; bought_week: number; have: number }
/** Kho trang phục + Chợ phiên Thăng Long (25/11/2026) */
export interface Wardrobe {
  frames: LookSlot[]; titles: LookSlot[]; flags: LookSlot[]; themes: LookSlot[]; items: ShopItemView[]; avatars: string[]; opened: number; total: number;
  gold: number; freezes: number; freeze_max: number; hints: number; rank: { level: number; name: string }; equipped: SagaLook;
  bought?: { kind: string; code: string; name: string; price: number };
}
export interface GradeView {
  grade: GradeSummary; stages: StageBrief[]; chests: Array<SagaChest & { campaign_no: number }>; my_grade: number | null; current_stage_id: number | null;
  maps: Array<Pick<SagaMapInfo, 'campaign_no' | 'title' | 'short_title' | 'years' | 'image_key' | 'image_url' | 'image_w' | 'image_h' | 'credit' | 'credit_url'>>;
}
export interface ChestOpen {
  key: string; kind: 'stage' | 'part'; first: boolean; rarity?: ChestRarity; gold: number; xp: number; freeze?: number; freeze_as_gold?: number;
  unlocked?: Array<LookItem & { kind: 'frame' | 'title'; equipped: boolean }>; opened?: number; total?: number;
  odds?: Array<{ rarity: ChestRarity; percent: number }>; next?: { name: string; rarity: LookRarity; left: number } | null;
}
export interface CampaignView { map: SagaMapInfo; stages: StageBrief[]; current_stage_id: number | null; totals: { stages: number; done: number; stars: number; max_stars: number }; chests?: SagaChest[] }

export interface CardBrief { code: string; name: string; title: string; rarity: 'common' | 'rare' | 'epic' | 'legendary'; portrait: string; hidden?: boolean }
export interface StageDetail extends StageBrief {
  objectives: Array<{ id: string; text: string }>; cards_count: number; pass_percent: number;
  practice: { items: number; kinds: Array<{ kind: ItemKind; label: string; count: number }>; best: number; tries: number; passed: boolean };
  explore: { title: string; done: boolean; hints: number; mistakes: number; world: boolean } | null;
  battle: { title: string; mode: BattleMode; best: number; stars: number; tries: number; won: boolean } | null;
  rewards: { xp: number; gold: number; card: CardBrief | null; has_badge: boolean; rank_up: string | null };
  completed_at: string | null; unlocks_next: { id: number; title: string } | null;
  /** lời giao nhiệm vụ của màn Quân lệnh (lời dẫn của trò chơi, không phải trích dẫn lịch sử) */
  order_text: { by: string; text: string } | null; grade_info: { grade: number; tag: string; role: string; level: string } | null; of: number;
}

export interface SourceRef { key: string; title: string; publisher: string; url: string | null; note: string | null }
export type LoreShelf = 'nhan-vat' | 'ke-sach' | 'dia-danh';
export interface LessonCard {
  id: string; kind: 'who' | 'where' | 'when' | 'why' | 'how'; kind_label: string; tag: string; shelf: LoreShelf; title: string; body: string; facts: Array<{ label: string; value: string }>;
  objective: string; objective_text: string | null; source: SourceRef | null; art: string | null;
}
export interface LessonView { stage: StageRef & { grade?: number | null; kind?: string; icon?: string }; objectives: Array<{ id: string; text: string }>; cards: LessonCard[]; sources: SourceRef[]; done: boolean; lore: string[]; world?: boolean }
export interface StageRef { id: number; title: string; place: string; date_label: string; campaign_no: number | null; grade?: number | null }
export interface LoreCollect { card: string; fresh: boolean; lore: string[]; total: number; done: boolean; first_done: boolean; xp: number }
/** Bộ sưu tập Binh thư: thẻ chưa nhặt chỉ có tên, loại và chặng */
export interface LoreCard { key: string; stage_id: number; stage_title: string; grade: number | null; card: string; kind: LessonCard['kind']; tag: string; shelf: LoreShelf; title: string; owned: boolean; body?: string; facts?: Array<{ label: string; value: string }>; source?: SourceRef | null }
export interface LoreView { cards: LoreCard[]; shelves: Record<LoreShelf, { owned: number; total: number }>; owned: number; total: number }

// ---------------------------------------------------------------------- luyện tập và ôn tập
export type ItemKind = 'quiz' | 'pairs' | 'sequence' | 'locate' | 'tactic';
interface ItemBase { id: number; kind: ItemKind; kind_label: string; prompt: string; objective: string; done: boolean; score: number | null; stage_title: string | null; removed?: string[]; hintable?: boolean }
export interface Choice { id: string; text: string }
export type PracticeItem =
  | (ItemBase & { kind: 'quiz'; options: Choice[] })
  | (ItemBase & { kind: 'tactic'; situation: string; options: Choice[] })
  | (ItemBase & { kind: 'sequence'; items: Choice[] })
  | (ItemBase & { kind: 'pairs'; left_label: string; right_label: string; cards: Array<{ token: string; side: 'left' | 'right'; text: string; matched: boolean }>; pairs_total: number; misses: number })
  | (ItemBase & { kind: 'locate'; campaign_no: number; spots: Array<{ id: string; letter: string; x: number; y: number }> });
export interface AnswerOutcome {
  item_id: number; done: boolean; correct: boolean; score: number; detail: Record<string, any>;
  explanation?: string; source?: SourceRef | null; objective_text?: string | null; stage_title?: string | null; timeout?: boolean; streak?: number; xp?: number; gold?: number;
}
/** Kết quả dùng "Gợi ý chiến thuật": phương án sai đã bị gạch */
export interface HintOutcome { item_id: number; hint: true; removed: string; hints_left: number }
export interface PracticeFinished { percent: number; passed: boolean; stars: number; right: number; total: number; pass_percent: number; best: number; first_pass: boolean; xp: number; gold?: number }
export interface ReviewFinished { right: number; total: number; percent: number; best_streak: number; xp?: number; gold?: number }

// ---------------------------------------------------------------------- nhập vai khám phá
export interface SceneNpc { id: string; name: string; role: string; sprite: string; at: XY; fictional: boolean }
export interface SceneItem { id: string; name: string; sprite: string; at: XY }
export interface SceneZone { id: string; name: string; rect: [number, number, number, number]; kind: 'enemy' | 'goal' | 'info' }
export interface ExploreEvent { t: 'say' | 'got' | 'gave' | 'ask' | 'right' | 'wrong' | 'step' | 'battle' | 'clue' | 'done'; who?: string; lines?: string[]; item?: string; prompt?: string; options?: Choice[]; text?: string }
export interface ExploreView {
  scene: 'village' | 'camp' | 'riverside' | 'palace' | 'shipyard'; title: string; intro: string; grid: string[]; spawn: XY; npcs: SceneNpc[]; items: SceneItem[]; zones: SceneZone[];
  progress: { step: number; total: number; done: boolean; hints: number; mistakes: number; inventory: Array<{ id: string; name: string }> };
  current: { id: string; type: string; goal: string; marker: string | null; has_clue: boolean; asking: { prompt: string; options: Choice[] } | null } | null;
  battle: { title: string; mode: 'tactics' | 'bachdang'; won: boolean } | null;
}
export interface ExploreFinished { hints: number; mistakes: number; first: boolean; xp: number; suggest_review: boolean }

// ---------------------------------------------------------------------- thế giới khối (bước Nhập vai của các chặng có nhiệm vụ khối, 21/11/2026)
export interface WorldLook { gender: 'nam' | 'nu'; robe: string; hat: string; skin: string }
export type WorldStepType = 'talk' | 'ask' | 'zone' | 'gather' | 'craft' | 'place' | 'battle' | 'give' | 'pick' | 'drill';
export interface WorldNeed { item?: string; zone?: string; count?: number; have?: number; own?: number; team?: number; total?: number; tide?: 'low' | 'high'; zones?: string[]; next?: string; command?: string; index?: number }
export interface WorldEvent { t: 'say' | 'got' | 'made' | 'placed' | 'gave' | 'ask' | 'right' | 'wrong' | 'step' | 'battle' | 'clue' | 'done' | 'wait' | 'award' | 'help'; who?: string; lines?: string[]; prompt?: string; options?: Choice[]; text?: string; item?: string; n?: number; code?: string }
/** Trang Sổ sử Đông A của một cuộc kháng chiến */
export interface WorldBookPage { campaign_no: number; years: string; title: string; unlocked: boolean; done: boolean; stages: { done: number; total: number }; events: Array<{ id: string; text: string }> }
export interface WorldSession {
  session_id: number; kind: 'explore'; seq: number; status: 'active' | 'done' | 'abandoned'; stage: StageRef | null; world: true;
  title: string; intro: string; map: WorldMapInfo; terrain: TerrainInfo; items: Record<string, string>;
  recipes: Record<string, { item: string; makes: number; needs: Record<string, number> }>; yield: Record<string, number>; regrow_ms: number;
  progress: { step: number; total: number; done: boolean; hints: number; mistakes: number; inventory: Record<string, number>; placed: Record<string, number> };
  current: { id: string; type: WorldStepType; goal: string; marker: string | null; has_clue: boolean; need: WorldNeed | null; asking: { prompt: string; options: Choice[] } | null } | null;
  room: { id: number; class_id: number | null; class_name: string | null; campaign_no: number; online: number };
  blocks: PlacedBlock[]; nodes: Array<{ x: number; z: number; until: number }>; tide: { state: 'low' | 'high'; until: number; period: number }; server_now: number;
  look: WorldLook & { chosen: boolean };
  battle: { title: string; mode: 'tactics' | 'bachdang'; won: boolean } | null;
  /** phần thưởng đã nhận (`title:…`, `route:…`), tuyến vận chuyển đã mở, dấu ấn của em trên bản đồ, dân làng góp sức (có danh hiệu Người giữ làng) */
  awards: string[]; routes_open: string[]; changes: WorldChangeInfo[]; village_help: boolean;
}
export const isWorldSession = (v: unknown): v is WorldSession => Boolean(v && typeof v === 'object' && (v as { world?: unknown }).world === true);

// ---------------------------------------------------------------------- trận đánh theo lượt
export type Side = 'ally' | 'enemy';
export interface TacticsUnit {
  id: string; side: Side; name: string; cls: string; cls_label: string; row: 'front' | 'back'; hp: number; max_hp: number; atk: number; def: number; spd: number; ranged: boolean; sprite: string;
  alive: boolean; guard: boolean; cd: number; burn: number; fx: string[]; tags: string[]; skill: { name: string; text: string; cost: number; cooldown: number; kind: string } | null;
}
export interface TacticsEvent {
  t: 'round' | 'turn' | 'attack' | 'skill' | 'defend' | 'fx' | 'down' | 'supply' | 'stratagem' | 'skip' | 'end';
  unit?: string; target?: string; dmg?: number; hp?: number; adv?: boolean; guarded?: boolean; name?: string; text?: string; n?: number; side?: Side; value?: number; ok?: boolean; status?: string; reason?: string | null;
  hits?: Array<{ id: string; dmg: number; hp: number; status?: string; heal?: number }>;
}
export interface TacticsView {
  mode: 'tactics'; title: string; intro: string; objective_text: string; tips: string[]; round: number; max_rounds: number; status: 'active' | 'won' | 'lost'; reason: string | null;
  supply: Record<Side, number>; objective: { type: string; rounds?: number; need?: number; tag?: string; unit?: string }; protect: string | null; queue: string[]; units: TacticsUnit[];
  actor: { id: string; attack_targets: string[]; skill: { usable: boolean; why: string | null; targets: string[] } | null } | null;
  stratagem: { state: 'none' | 'ready' | 'used'; name: string; text: string; prompt: string; options: Choice[] } | null;
  result: { won: boolean; stars: number; score: number; rounds: number; lost: number; text: string } | null;
}

// ---------------------------------------------------------------------- màn Bạch Đằng
export type BdPhase = 'prepare' | 'lure' | 'counter' | 'done';
export interface BdUnit {
  id: string; side: Side; role: 'bait' | 'fleet' | 'ship'; name: string; x: number; y: number; hp: number; max_hp: number; atk: number; speed: number;
  state: 'wait' | 'free' | 'slow' | 'stuck' | 'sunk' | 'escaped' | 'blocked'; chasing: boolean; flagship: boolean; key: boolean; fire: number; burn: number; acted: boolean; sprite: string;
}
export interface BdEvent {
  t: 'tide' | 'reveal' | 'stake' | 'unstake' | 'phase' | 'spawn' | 'blocked' | 'provoke' | 'move' | 'attack' | 'stuck' | 'slow' | 'refloat' | 'fire' | 'burn' | 'arrows' | 'sunk' | 'escape' | 'warn' | 'end';
  unit?: string; target?: string; at?: XY; path?: XY[]; units?: string[]; dmg?: number; hp?: number; ok?: boolean; level?: number; label?: string; phase?: BdPhase; text?: string; status?: string; reason?: string | null;
}
export interface BdPreview { enemies: Array<{ id: string; x: number; y: number; state: string }>; hit: boolean }
export interface BdView {
  mode: 'bachdang'; title: string; intro: string; phase: BdPhase; turn: number; status: 'active' | 'won' | 'lost'; reason: string | null; rules: string[]; trail: XY[]; briefing: string | null;
  tide: { level: number; label: string; forecast: Array<{ level: number; label: string; phase: string }> };
  grid: { w: number; h: number; cells: string[]; revealed: boolean }; zone: [number, number]; stakes: XY[]; stakes_left: number; stakes_turn_left: number; units: BdUnit[];
  options:
    | { can_stake: boolean; stakeable: XY[]; removable: XY[]; turns_left: number }
    | { moves: Array<{ to: XY } & BdPreview>; wait: BdPreview; provoke: ({ units: string[] } & BdPreview) | null; turns_left: number }
    | { allies: Array<{ unit: string; moves: Array<{ to: XY; attack: string[]; fire: string[] }> }>; turns_left: number }
    | null;
  result: { won: boolean; stars: number; score: number; stranded: number; escaped: number; mistakes: Array<{ code: string; text: string }>; good: string[]; text: string } | null;
}
// ---------------------------------------------------------------------- trận hội đồng (Diên Hồng, Vườn không nhà trống, Vạn Kiếp, Khối 9)
export interface CouncilView {
  mode: 'council'; style: 'persuade' | 'command' | 'whatif'; title: string; intro: string; cast: Array<{ id: string; name: string; role: string; fictional: boolean }>; tips: string[];
  status: 'active' | 'won' | 'lost'; round: number; rounds: number; meters: Array<{ id: string; label: string; value: number; win: number }>;
  current: { id: string; who: string; ask: string; options: Array<{ id: string; tag: string; text: string }> } | null;
  history: Array<{ round: string; who: string; ask: string; option: string; tag: string; text: string; say: string | null; reply: string; score: number }>;
  result: { won: boolean; stars: number; score: number; rounds: number; historic: number; compare: CompareRow[]; text: string } | null;
}
export interface CouncilEvent { t: 'play' | 'end'; round?: string; option?: string; tag?: string; text?: string; say?: string | null; reply?: string; score?: number; effect?: Record<string, number>; meters?: Record<string, number>; won?: boolean }
/** Một dòng bảng "Quyết định / Của em / Lịch sử" của màn Sử quan */
export interface CompareRow { label: string; mine: string; history: string; ok: boolean }
export interface BattleFinished {
  won: boolean; stars: number; score: number; first_win: boolean; xp: number; gold?: number; best: number; text: string; mistakes?: Array<{ code: string; text: string }>; good?: string[];
  stranded?: number; escaped?: number; rounds?: number; lost?: number; compare?: CompareRow[]; historic?: number;
}

// ---------------------------------------------------------------------- phiên chơi
interface SessionHead { session_id: number; seq: number; status: 'active' | 'done' | 'abandoned'; result: Record<string, any> | null; stage: StageRef | null; resumed?: boolean }
export type PracticeSession = SessionHead & { kind: 'practice' | 'review'; pass_percent: number | null; index: number; total: number; items: PracticeItem[]; timer?: { limit_s: number; left_ms: number } | null; streak?: number };
export type ExploreSession = SessionHead & { kind: 'explore' } & ExploreView;
export type BattleSession = SessionHead & { kind: 'battle'; knowledge: number; events?: Array<TacticsEvent | BdEvent | CouncilEvent> } & (TacticsView | BdView | CouncilView);

export interface Completion {
  first: boolean; stars: number; knowledge_percent: number; battle: { stars: number; score: number } | null;
  rewards: { xp: number; gold: number; card: (CardBrief & { role_text?: string }) | null; badge: { code?: string; name: string; icon: string; color: string } | null; docs: Array<{ id: number; title: string; kind: string }> };
  next: { id: number; title: string; campaign_no: number | null; grade?: number | null } | null; campaign_done: boolean;
  grade_done?: boolean; grade?: number | null; rank_up?: { from: string; to: string; level: number } | null;
}
export interface ActResult<V, O, F> { seq: number; outcome: O; finished: F | null; completion: Completion | null; view: V; replayed: boolean }

export interface StageSummary {
  stage: StageRef;
  result: { stars: number; knowledge_percent: number; practice_tries: number; explore_hints: number; explore_mistakes: number; battle: { stars: number; score: number; tries: number; mode: BattleMode; title: string } | null };
  compare: CompareRow[]; comment: string; comment_source: string | null; battle_text: string | null;
  debrief: { title: string; paragraphs: string[]; sources: SourceRef[]; fiction: string };
  rewards: { xp: number; gold: number; card: CardBrief | null }; rank: { level: number; name: string };
  weak_objectives: WeakObjective[]; next: { id: number; title: string; campaign_no: number | null; grade?: number | null } | null;
}

// ---------------------------------------------------------------------- ôn tập, bộ sưu tập, kho tư liệu
export interface WeakObjective { stage_id: number; stage_title: string; objective: string; text: string; answers: number; percent: number }
export interface ReviewInfo {
  due: Array<{ item_id: number; wrong_count: number; last_wrong_at: string; prompt: string; kind: ItemKind; kind_label: string; stage_id: number; stage_title: string }>;
  weak_objectives: WeakObjective[]; pool: number; can_start: boolean; active_session_id: number | null; size: number; stats: { answers: number; right: number; percent: number };
  suggest: Suggest | null;
}
export interface SagaCard extends CardBrief {
  owned: boolean; years?: string | null; intro?: string; role_text?: string; quote?: string | null; quote_source?: string | null; source?: string; source_url?: string | null; unlocked_at?: string;
  stage_id: number | null; stage_title: string | null; campaign_no: number | null;
}
export interface CardAlbum { total: number; owned: number; cards: SagaCard[]; latest_code: string | null }
export interface ArchiveText {
  id: number; code: string; campaign_no: number | null; title: string; subtitle: string | null; locked: boolean; lock: { stage_id: number; stage_title: string; campaign_no: number } | null;
  body?: { lines: string[]; translation: string[] | null; translator: string | null; note: string | null }; source?: string; source_url?: string | null;
}
export interface TimelineMark { key: string; campaign_no: number | null; sort: number; date_label: string; title: string; text: string; stage_id: number | null; done: boolean; source: string | null; source_url: string | null }
export interface Archive { texts: ArchiveText[]; timeline: TimelineMark[]; maps: SagaMapInfo[]; figures: SagaCard[] }
