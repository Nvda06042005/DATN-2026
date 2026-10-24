/** Kiểu dữ liệu của game "Hào Khí Đông A": trạng thái game (lưu trên server), tướng, chiến dịch, trận đánh */
import type { ComponentType } from 'react';
import type {
  AnswerPayload, AnswerResult, AuthUser, CodexEntry, LearnerProgress, QuestionRequest, QuestionsResponse, ServedQuestion,
} from '@/types/api';
export type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export type ElementId = 'thuy' | 'moc' | 'tho' | 'hoa' | 'thong';

export type Tier = 'hiem' | 'su_thi' | 'huyen_thoai' | 'tiet_che';

export type Lore = 'chinh_su' | 'giai_thoai' | 'sang_tao' | 'dan_gian';

export type EnemyType = 'ky' | 'bo' | 'thuyen' | 'luong';

type SkillKind =
  | 'strike'
  | 'multi'
  | 'aoe'
  | 'buff_atk'
  | 'self_atk'
  | 'buff_def'
  | 'heal'
  | 'taunt'
  | 'shield'
  | 'fear_immune'
  | 'evade'
  | 'ambush'
  | 'cut_supply'
  | 'stakes'
  | 'debuff'
  | 'ship_hunter';

export interface SkillDef {
  name: string;
  desc: string;
  kind: SkillKind;
  power: number;
}

interface StageDef {
  name: string;
  years: string;
  desc: string;
  unit: string;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  element: ElementId;
  tier: Tier;
  role: string;
  lore: Lore;
  story: string;
  symbol: IconType;
  join: 'start' | 'story' | 'recipe';
  base: { hp: number; atk: number; def: number; spd: number };
  basic: SkillDef;
  strat: SkillDef;
  ult: SkillDef;
  stages: [StageDef, StageDef, StageDef];
}

export type IntentId = 'strike' | 'charge' | 'volley' | 'forage' | 'roar' | 'supply' | 'brace';

export interface EnemyDef {
  id: string;
  name: string;
  type: EnemyType;
  boss?: boolean;
  base: { hp: number; atk: number; def: number; spd: number };
  intents: IntentId[];
  note: string;
  defeatText: string;
  fleeAt?: number;
  capture?: boolean;
}

export type PlaceId =
  | 'lang_son'
  | 'noi_bang'
  | 'binh_le_nguyen'
  | 'thang_long'
  | 'dong_bo_dau'
  | 'binh_than'
  | 'van_kiep'
  | 'yen_tu'
  | 'bach_dang'
  | 'van_don'
  | 'chuong_duong'
  | 'ham_tu'
  | 'tay_ket'
  | 'thien_truong'
  | 'truong_yen'
  | 'thanh_hoa'
  | 'champa';

type PhaseEffect = 'retreat' | 'vuon_khong' | 'counter' | 'rear_guard' | 'chuong_duong' | 'van_kiep' | 'van_don' | 'bach_dang' | 'capture';

export type BattleBg = 'plain' | 'river' | 'sea';

export interface PhaseDef {
  id: string;
  campaign: 1 | 2 | 3;
  name: string;
  date: string;
  place: PlaceId;
  story: string;
  objective: string;
  enemies: Array<{ id: string; hp?: number; defeatText?: string; fleeAt?: number }>;
  units: string[];
  recommended: string[];
  rules: { retreatAfter?: number; tide?: boolean; startStamina?: number; winWhenExhausted?: boolean };
  strat: { name: string; desc: string; unit: string; hero?: string; effect: PhaseEffect; starHint: string };
  bg: BattleBg;
  reward: { luong: number; quan: number };
  history: string;
}

export interface CardDef {
  id: string;
  name: string;
  kind: 'nhan_luc' | 'su_kien';
  desc: string;
  lore: Lore;
  unit?: string;
  how: string;
  Icon: IconType;
}

export interface RecipeDef {
  id: string;
  hero: string;
  inputs: [string, string];
  gems: number;
  luong: number;
  waitSec: number;
  questions: number;
  units: string[];
  lesson: string;
}

export interface RelicDef {
  id: string;
  name: string;
  effect: string;
  lore: Lore;
  story: string;
  how: string;
  Icon: IconType;
}

export type BuildingId = 'ruong' | 'trai' | 'kho' | 'xuong' | 'ben' | 'doanh' | 'hoiquan' | 'qtg';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  desc: string;
  unit: string;
  maxLevel: number;
  start: number;
  buildCost: number;
  pos: { x: number; y: number; w: number; h: number };
  levelText: (level: number) => string;
}

export interface DailyTaskDef {
  id: string;
  text: string;
  target: number;
  metric: 'harvest' | 'correct' | 'session' | 'battle' | 'codex' | 'ask';
  reward: { luong: number; quan: number };
  Icon: IconType;
}

export interface HeroState {
  stage: 1 | 2 | 3;
  battles: number;
}

export interface GameSettings {
  theme: 'system' | 'light' | 'dark';
  timer: boolean;
  sound: boolean;
  reduceMotion: boolean;
}

// ---------------------------------------------------------------------- Hành Trình Đông A (thế giới 2D)
export type WorldMapId = 'dong_a' | 'binh_than' | 'bach_dang';

export type WorldDir = 'up' | 'down' | 'left' | 'right';

export type CropId = 'dau' | 'khoai' | 'lua';

/** Nhân vật trong thế giới 2D đều là người hư cấu (dân làng, lính, thầy đồ...), kể lại chuyện của người thật */
export type CharacterId = 'player' | 'elder' | 'farmer' | 'soldier' | 'messenger' | 'scholar' | 'boatman' | 'scout' | 'carpenter' | 'weaver' | 'veteran';

/** Ngoại hình nhân vật pixel: màu tóc, da, áo, quần, mũ nón và vật cầm tay */
export interface CharacterLook {
  hair: string;
  skin: string;
  cloth: string;
  clothDark: string;
  accent: string;
  pants: string;
  hat: 'none' | 'band' | 'non_la' | 'khan' | 'fur' | 'white';
  hatColor?: string;
  item: 'none' | 'spear' | 'staff' | 'oar' | 'bow' | 'hammer' | 'scroll' | 'basket' | 'hoe';
}

/** Lượt hỏi đáp gắn với một nhân vật / vật: câu hỏi lấy từ các cụm tri thức, server chấm */
export interface WorldLesson {
  units: string[];
  count: number;
  pass: number;
}

export interface WorldReward {
  luong: number;
  quan: number;
  cards?: string[];
}

export type WorldObjectKind = 'npc' | 'scout' | 'boss' | 'sign' | 'scroll' | 'stake' | 'portal';

export interface WorldObjectDef {
  id: string;
  kind: WorldObjectKind;
  x: number;
  y: number;
  /** Số ô chiếm (mặc định 1×1; đội thuyền giặc 2×2) */
  w?: number;
  h?: number;
  name: string;
  role?: string;
  look?: CharacterId;
  sign?: 'post' | 'board' | 'orange' | 'flag';
  /** Lời thoại khi không có nhiệm vụ đang chờ ở đây */
  lines: string[];
  /** Việc phụ: làm một lần, có thưởng */
  lesson?: WorldLesson;
  reward?: WorldReward;
  /** Thám báo đi tuần qua lại giữa các ô */
  patrol?: Array<[number, number]>;
  /** Cổng sang vùng khác; `needs` là nhiệm vụ phải xong trước */
  to?: { map: WorldMapId; x: number; y: number; dir: WorldDir };
  needs?: string;
  /** Chỉ xuất hiện từ bước này của nhiệm vụ: [mã nhiệm vụ, bước] */
  showAt?: [string, number];
}

export type StructureKind = 'house' | 'dinh' | 'well' | 'tent' | 'pavilion' | 'boat' | 'tower' | 'logs' | 'dummy' | 'hay';

export interface WorldStructure {
  kind: StructureKind;
  x: number;
  y: number;
}

export interface WorldMapDef {
  id: WorldMapId;
  name: string;
  era: string;
  intro: string;
  /** Mỗi ký tự là một ô: xem TILE_INFO trong constants/world.ts */
  rows: string[];
  structures: WorldStructure[];
  objects: WorldObjectDef[];
  spawn: { x: number; y: number; dir: WorldDir };
}

export interface WorldQuestStep {
  /** Mã vật/nhân vật cần gặp; "plot" là bất kỳ luống đất nào (gieo hạt) */
  target: string;
  text: string;
  lines?: string[];
  lesson?: WorldLesson;
  reward?: WorldReward;
}

export interface WorldQuestDef {
  id: string;
  map: WorldMapId;
  title: string;
  steps: WorldQuestStep[];
  reward: WorldReward;
  doneText: string;
}

export interface CropDef {
  id: CropId;
  name: string;
  seed: number;
  minutes: number;
  yield: number;
  desc: string;
}

export interface WorldState {
  map: WorldMapId;
  x: number;
  y: number;
  dir: WorldDir;
  /** Số bước đã xong của từng nhiệm vụ chính */
  quests: Record<string, number>;
  /** Việc phụ đã xong (cuộn sử, thám báo, nhân vật) và vùng đất đã đến (`map:<id>`) */
  done: string[];
  /** Luống đất: cây đang trồng, lúc gieo, đã bón phân tri thức chưa */
  plots: Record<string, { crop: CropId; at: number; boost: boolean }>;
  intro: boolean;
}

export interface GameState {
  v: 1;
  createdAt: number;
  buildings: Record<BuildingId, { level: number; lastCollect: number; upgradeEnds: number | null }>;
  luong: number;
  quan: number;
  heroes: Record<string, HeroState>;
  cards: Record<string, number>;
  relics: string[];
  relic: string | null;
  recruit: { recipe: string; endsAt: number } | null;
  campaign: Record<string, number>;
  tower: number;
  codex: string[];
  daily: { day: string; progress: Record<string, number>; claimed: string[] };
  raid: { sessions: number; lastDay: string };
  stats: { sessions: number; battles: number; wins: number; harvests: number };
  seen: string[];
  tutorial: boolean;
  settings: GameSettings;
  world: WorldState;
}

export interface GameCtx {
  user: AuthUser;
  progress: LearnerProgress;
  state: GameState;
  codex: CodexEntry[];
  dark: boolean;
  update: (fn: (s: GameState) => GameState) => void;
  /** Chạy một hàm trong api/ bằng phiên của học sinh; hết phiên (401) thì đưa về màn đăng nhập */
  request: <T>(call: (token: string) => Promise<T>) => Promise<T>;
  toast: (msg: string) => void;
  fetchQuestions: (req: QuestionRequest) => Promise<QuestionsResponse>;
  submitAnswer: (q: ServedQuestion, payload: AnswerPayload) => Promise<AnswerResult | null>;
  finishSession: (kind: 'practice' | 'battle' | 'recruit' | 'tower' | 'raid', correct: number, total: number) => void;
  spendGems: (amount: number, reason: string) => Promise<boolean>;
  reward: (luong: number, quan: number) => void;
  bumpDaily: (metric: DailyTaskDef['metric'], n?: number) => void;
  askAdvisor: (question: string) => void;
  /** Mở màn thi đấu cả lớp (nhập mã PIN thầy cô đưa) */
  openLive: (pin?: string) => void;
  /** Mở thế giới 2D Hành Trình Đông A */
  openWorld: () => void;
  sound: (kind: 'ok' | 'bad' | 'win') => void;
}

export type GameTab = 'farm' | 'barracks' | 'campaign' | 'exam' | 'codex';

// ---------------------------------------------------------------------- trận đánh
export type TideState = 'len' | 'dung' | 'rut';

export interface FighterStatus {
  atkUp: number;
  atkUpTurns: number;
  defUp: number;
  defUpTurns: number;
  taunt: number;
  tauntDr: number;
  shield: number;
  evade: number;
  fear: boolean;
  stun: number;
  weaken: number;
  weakenTurns: number;
  defDown: number;
  ko: boolean;
  fled: boolean;
  captured: boolean;
  acted: boolean;
  exhausted: boolean;
}

export interface Fighter {
  uid: string;
  side: 'ally' | 'enemy';
  ref: string;
  name: string;
  element?: ElementId;
  etype?: EnemyType;
  boss: boolean;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  stamina: number;
  st: FighterStatus;
  intents: IntentId[];
  fleeAt?: number;
  capture?: boolean;
  defeatText: string;
}

export interface BattleFx {
  uid: string;
  kind: 'hit' | 'heal' | 'act' | 'miss' | 'buff';
  amount?: number;
  seq: number;
}

export interface BattleState {
  phase: PhaseDef;
  round: number;
  allies: Fighter[];
  enemies: Fighter[];
  turn: 'ally' | 'enemy' | 'over';
  active: number;
  haoKhi: number;
  fearImmune: number;
  drain: number;
  supplyDestroyed: boolean;
  stratUsed: boolean;
  stratGood: boolean;
  tide: TideState | null;
  relic: string | null;
  relicUsed: boolean;
  answered: number;
  correct: number;
  log: Array<{ id: number; text: string; tone: 'ally' | 'enemy' | 'info' | 'good' | 'bad' }>;
  fx: BattleFx[];
  result: null | 'win' | 'lose';
  endText: string;
  xuong: number;
  ben: number;
}
