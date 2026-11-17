/** Kiểu dữ liệu của Hành trình Đông A (/api/saga): bản đồ, chặng, phiên chơi, ôn tập, bộ sưu tập và kho tư liệu. Đáp án không bao giờ nằm trong các kiểu gửi cho học sinh. */
import type { Hud } from '@/types/gamification';

export type StageState = 'locked' | 'ready' | 'learning' | 'done' | 'review';
export type StepState = 'locked' | 'ready' | 'done' | 'none';
export type XY = [number, number];

export interface SagaCampaign {
  campaign_no: number; title: string; short_title: string; years: string; enemy: string; places: string; summary: string;
  stages: number; done: number; stars: number; max_stars: number; percent: number; completed: boolean; is_new: boolean; available: boolean;
}
export interface SagaHome {
  learner: { name: string; full_name: string; avatar_url: string | null; class_name: string | null };
  hud: Pick<Hud, 'level' | 'gold' | 'xp' | 'streak' | 'daily' | 'unseen_celebrations'>;
  campaigns: SagaCampaign[];
  next: { stage_id: number; title: string; campaign_no: number; state: StageState } | null;
  daily: { title: string; progress: number; target: number; done: boolean; reward_xp: number; reward_gold: number; done_count: number; total: number } | null;
  review_due: number; totals: { stages: number; done: number };
  /** khung ảnh đại diện và danh hiệu đang trang bị */
  look?: SagaLook;
}

export interface StageBrief {
  id: number; code: string; campaign_no: number; position: number; order: number; title: string; place: string; date_label: string; kind: 'battle' | 'council' | 'strategy' | 'prepare'; icon: string; summary: string;
  map_x: number; map_y: number; anchor_x: number | null; anchor_y: number | null; has_battle: boolean; battle_mode: 'tactics' | 'bachdang' | null;
  state: StageState; lock_reason: string | null; stars: number; knowledge_percent: number; battle_stars: number; review_due: number;
  steps: { lesson: StepState; practice: StepState; explore: StepState; battle: StepState; next: 'lesson' | 'practice' | 'explore' | 'replay' | null };
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
export interface LookSlot extends LookItem { need: string; unlocked: boolean }
export interface SagaLook { frame: LookItem | null; title: LookItem | null; /** ảnh đại diện có sẵn (Rồng Con, danh tướng); null = ảnh / chữ cái của em */ avatar?: string | null }
export interface Wardrobe { frames: LookSlot[]; titles: LookSlot[]; avatars: string[]; opened: number; total: number; equipped: SagaLook }
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
  explore: { title: string; done: boolean; hints: number; mistakes: number };
  battle: { title: string; mode: 'tactics' | 'bachdang'; best: number; stars: number; tries: number; won: boolean } | null;
  rewards: { xp: number; gold: number; card: CardBrief | null; has_badge: boolean };
  completed_at: string | null; unlocks_next: { id: number; title: string } | null;
}

export interface SourceRef { key: string; title: string; publisher: string; url: string | null; note: string | null }
export interface LessonCard { id: string; kind: 'who' | 'where' | 'when' | 'why' | 'how'; kind_label: string; title: string; body: string; facts: Array<{ label: string; value: string }>; objective: string; objective_text: string | null; source: SourceRef | null; art: string | null }
export interface LessonView { stage: StageRef; objectives: Array<{ id: string; text: string }>; cards: LessonCard[]; sources: SourceRef[]; done: boolean }
export interface StageRef { id: number; title: string; place: string; date_label: string; campaign_no: number }

// ---------------------------------------------------------------------- luyện tập và ôn tập
export type ItemKind = 'quiz' | 'pairs' | 'sequence' | 'locate' | 'tactic';
interface ItemBase { id: number; kind: ItemKind; kind_label: string; prompt: string; objective: string; done: boolean; score: number | null; stage_title: string | null }
export interface Choice { id: string; text: string }
export type PracticeItem =
  | (ItemBase & { kind: 'quiz'; options: Choice[] })
  | (ItemBase & { kind: 'tactic'; situation: string; options: Choice[] })
  | (ItemBase & { kind: 'sequence'; items: Choice[] })
  | (ItemBase & { kind: 'pairs'; left_label: string; right_label: string; cards: Array<{ token: string; side: 'left' | 'right'; text: string; matched: boolean }>; pairs_total: number; misses: number })
  | (ItemBase & { kind: 'locate'; campaign_no: number; spots: Array<{ id: string; letter: string; x: number; y: number }> });
export interface AnswerOutcome {
  item_id: number; done: boolean; correct: boolean; score: number; detail: Record<string, any>;
  explanation?: string; source?: SourceRef | null; objective_text?: string | null; stage_title?: string | null; timeout?: boolean; streak?: number; xp?: number;
}
export interface PracticeFinished { percent: number; passed: boolean; stars: number; right: number; total: number; pass_percent: number; best: number; first_pass: boolean; xp: number }
export interface ReviewFinished { right: number; total: number; percent: number; best_streak: number }

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
export interface BattleFinished { won: boolean; stars: number; score: number; first_win: boolean; xp: number; best: number; text: string; mistakes?: Array<{ code: string; text: string }>; good?: string[]; stranded?: number; escaped?: number; rounds?: number; lost?: number }

// ---------------------------------------------------------------------- phiên chơi
interface SessionHead { session_id: number; seq: number; status: 'active' | 'done' | 'abandoned'; result: Record<string, any> | null; stage: StageRef | null; resumed?: boolean }
export type PracticeSession = SessionHead & { kind: 'practice' | 'review'; pass_percent: number | null; index: number; total: number; items: PracticeItem[]; timer?: { limit_s: number; left_ms: number } | null; streak?: number };
export type ExploreSession = SessionHead & { kind: 'explore' } & ExploreView;
export type BattleSession = SessionHead & { kind: 'battle'; knowledge: number; events?: Array<TacticsEvent | BdEvent> } & (TacticsView | BdView);

export interface Completion {
  first: boolean; stars: number; knowledge_percent: number; battle: { stars: number; score: number } | null;
  rewards: { xp: number; gold: number; card: (CardBrief & { role_text?: string }) | null; badge: { code?: string; name: string; icon: string; color: string } | null; docs: Array<{ id: number; title: string; kind: string }> };
  next: { id: number; title: string; campaign_no: number } | null; campaign_done: boolean;
}
export interface ActResult<V, O, F> { seq: number; outcome: O; finished: F | null; completion: Completion | null; view: V; replayed: boolean }

export interface StageSummary {
  stage: StageRef;
  result: { stars: number; knowledge_percent: number; practice_tries: number; explore_hints: number; explore_mistakes: number; battle: { stars: number; score: number; tries: number } | null };
  debrief: { title: string; paragraphs: string[]; sources: SourceRef[]; fiction: string };
  weak_objectives: WeakObjective[]; next: { id: number; title: string; campaign_no: number } | null;
}

// ---------------------------------------------------------------------- ôn tập, bộ sưu tập, kho tư liệu
export interface WeakObjective { stage_id: number; stage_title: string; objective: string; text: string; answers: number; percent: number }
export interface ReviewInfo {
  due: Array<{ item_id: number; wrong_count: number; last_wrong_at: string; prompt: string; kind: ItemKind; kind_label: string; stage_id: number; stage_title: string }>;
  weak_objectives: WeakObjective[]; pool: number; can_start: boolean; active_session_id: number | null; size: number; stats: { answers: number; right: number; percent: number };
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
