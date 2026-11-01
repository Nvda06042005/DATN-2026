/** Kiểu dữ liệu game mô phỏng trận đánh bằng thẻ tướng (Sprint 6 theo ver0.2). Khớp với /api/war. */
import type { PlayQuestion } from '@/types/learning';

export type WarRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Branch = 'bo' | 'thuy' | 'ky';
export type Slot = 'normal' | 'active' | 'ultimate' | 'passive';
export const RARITY_LABEL: Record<WarRarity, string> = { common: 'Thường', rare: 'Hiếm', epic: 'Sử thi', legendary: 'Huyền thoại' };
export const RARITY_COLOR: Record<WarRarity, string> = { common: '#8a8f98', rare: '#2b7bd6', epic: '#8b5cf6', legendary: '#e69a00' };
export const BRANCH_LABEL: Record<Branch, string> = { bo: 'Bộ binh', thuy: 'Thủy binh', ky: 'Kỵ binh' };
export const SLOT_LABEL: Record<Slot, string> = { normal: 'Đòn thường', active: 'Chiêu chủ động', ultimate: 'Tuyệt kỹ', passive: 'Nội tại' };

export interface Stats { atk: number; def: number; hp: number; spd: number }
export interface WarCard {
  id: number; code: string; name: string | null; rarity: WarRarity; rarity_label: string; kind: 'general' | 'tactic'; branch: Branch | null; branch_label: string | null; image_url: string | null;
  owned: boolean; level: number | null; stars: number | null; fragments: number; fragments_needed: number; power: number | null; stats: Stats | null; min_level: number; source_text: string | null;
  level_cap: number; can_level: boolean; level_cost: number | null; can_star: boolean; star_cost: number | null; tactic: { name: string; text: string | null; effect: string } | null;
}
export interface Collection { player: { level: number; binh_thu: number }; cards: WarCard[]; summary: { total: number; owned: number; generals: number; tactics: number } }
export interface Move { slot: Slot; name: string; description: string | null; anecdote: string | null; target: string; power: number; effect: { type: string; value?: number; turns?: number } | null; rage_cost: number; cooldown: number; anim: string | null }
export interface CardDetail extends WarCard {
  flavor_quote: string | null; figure: { id: number; name: string; honorific: string | null; birth_year: number | null; death_year: number | null; role_text: string | null; biography: string | null; famous_quote: string | null } | null;
  battles: Array<{ id: number; name: string; year: number; stage_id: number | null }>; moves: Move[]; next_level_stats: Stats | null; hint: string | null;
}
export interface FormationSlot { slot: number; name: string; front: number[]; back: number[]; tactic_card_id: number | null; power: number; size: number }
export interface Commander { id: number; name: string | null; role_text: string | null; forces: string | null; tactics: string | null; outcome: string | null; source_id: number | null; seen: boolean }

// ---------------------------------------------------------------------- bản đồ hành quân
export type PointKind = 'start' | 'story' | 'card' | 'quiz' | 'source' | 'battle' | 'chest';
export const POINT_LABEL: Record<PointKind, string> = { start: 'Xuất phát', story: 'Cốt truyện', card: 'Thẻ tướng', quiz: 'Thử thách', source: 'Tư liệu', battle: 'Trận đánh', chest: 'Rương' };
export interface WarStatus { open: boolean; reason: string | null; used_minutes: number; limit_minutes: number | null }
export interface MarchPoint {
  id: number; code: string; name: string; description: string | null; x: number; y: number; kind: PointKind; state: 'current' | 'visited' | 'open' | 'locked'; done: boolean; locked_reason: string | null;
  has_dialog: boolean; stage_id: number | null; stars: number | null;
}
export interface MarchMap {
  map: { id: number; title: string; background_url: string | null; campaign: { id: number; title: string; year_label: string } }; points: MarchPoint[]; edges: Array<{ from: number; to: number }>;
  current_point_id: number | null; progress: { visited: number; total: number }; war: WarStatus;
}
export interface MarchListItem { id: number; campaign_id: number; title: string; campaign_title: string; year_label: string; points: number; visited: number }
export interface Dialog { id: number; title: string; lines: Array<{ speaker: string; text: string; choices: Array<{ text: string; reply: string }> | null; figure: { name: string; image_url: string | null } | null }>; sources: Array<{ id: number; title: string }> }
export interface Rewards { gold: number; binh_thu: number; fragments: Array<{ card: string; qty: number; merged: boolean }> }
export type MarchEvent =
  | { kind: 'story'; dialog: Dialog | null }
  | { kind: 'card'; done: boolean; card?: { id: number; name: string }; qty?: number; merged?: boolean; fragments?: number }
  | { kind: 'quiz'; done: boolean; question: PlayQuestion | null }
  | { kind: 'source'; source: { id: number; title: string } | null }
  | { kind: 'chest'; done: boolean; rewards?: Rewards }
  | { kind: 'battle'; stage_id: number | null; first: boolean };
export interface MoveResult { path: number[]; point: { id: number; name: string; kind: PointKind }; event: MarchEvent | null }
export interface DialogLogItem extends Dialog { point_name: string | null; seen_at: string }

// ---------------------------------------------------------------------- màn chơi và trận đánh
export interface StageItem {
  id: number; title: string; difficulty: number; max_turns: number; battle_id: number; battle_name: string; year: number; date_text: string | null; campaign_id: number | null; campaign_title: string | null; year_label: string | null;
  best_stars: number; clears: number; attempts: number; commander_name: string | null; locked: boolean; locked_reason: string | null;
}
export interface StageIntro {
  id: number; title: string; summary: string | null; objective: string | null; background_url: string | null; difficulty: number; max_turns: number; star_turns: number;
  battle: { id: number; name: string; year: number; date_text: string | null; context: string | null; forces: string | null };
  enemies: Array<{ label: string | null; units: Array<{ name: string; commander: boolean; branch: Branch | null }> }>;
  commander: { id: number; name: string; role_text: string | null; forces?: string | null; tactics?: string | null } | null; terrain_notes: string[];
  historical_figures: Array<{ id: number; name: string; honorific: string | null }>; suggested_cards: Array<{ id: number; name: string; rarity: WarRarity; owned: boolean }>;
  progress: { best_stars: number; clears: number }; rewards: { gold: number; binh_thu: number; xp: number; card: boolean; fragments: number }; stars: string[]; war: WarStatus;
}
export interface UnitView {
  id: string; side: 'ally' | 'enemy'; name: string; card_id: number | null; branch: Branch | null; level: number; hp: number; max_hp: number; rage: number; alive: boolean; commander: boolean; hao_khi: boolean;
  guard: boolean; effects: Array<{ type: string; turns: number }>; atk: number; def: number; spd: number;
  moves: Array<{ slot: Slot; name: string; description: string | null; target: string; rage_cost: number; cooldown_left: number }>;
}
export interface LogLine { t: number; kind: string; text: string; unit?: string; target?: string; value?: number }
export interface BattleResult {
  won: boolean; stars: number; turns: number; ally_down: number; best_unit: { name: string; damage: number } | null; ultimates: number; ultimates_strong: number; first_clear: boolean; preview: boolean;
  rewards: { gold: number; binh_thu: number; xp: number; fragments: Array<{ card: string; qty: number }>; card: string | null; merged: string[] };
}
export interface BattleView {
  id: number; mode: 'play' | 'preview'; status: 'active' | 'won' | 'lost'; stage: { id: number; title: string; background_url: string | null; battle_id: number }; formation: { front: string[]; back: string[] };
  turn: number; max_turns: number; star_turns: number; wave: number; waves: number; units: UnitView[]; order: string[]; actor: string | null; available: Array<'normal' | 'active' | 'ultimate'>;
  tide: 'high' | 'low' | null; terrain: { tide: boolean; stakes: boolean; hunger: boolean; water_bonus: Record<string, number> | null };
  telegraph: { unit: string; targets: string[] } | null; tactic: { name: string; text: string | null; used: boolean } | null; pending: { unit: string } | null; log: LogLine[];
  stats: { dealt: number; ally_down: number }; result: BattleResult | null; stars_now: number;
  question: { view: PlayQuestion; seconds: number; remaining_ms: number } | null;
}
export interface Truth {
  stage: { id: number; title: string }; battle: { id: number; name: string; year: number; date_text: string | null; context: string | null; forces: string | null; course: string | null; result: string | null };
  commander: { id: number; name: string; role_text: string | null; forces: string | null; tactics: string | null; outcome: string | null } | null; differences: string[];
  figures: Array<{ id: number; name: string; honorific: string | null; role_text: string | null }>; sources: Array<{ id: number; title: string; kind: string; locked: boolean }>;
}
