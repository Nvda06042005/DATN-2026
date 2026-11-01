/** Kiểu dữ liệu mô phỏng trận đánh và mini-game (Sprint 6). Khớp với /api/battle. */

export type MiniKind = 'match' | 'timeline' | 'crossword';
export const MINI_TEXT: Record<MiniKind, string> = { match: 'Ghép thẻ', timeline: 'Sắp xếp dòng thời gian', crossword: 'Ô chữ lịch sử' };
export const DIFFICULTY_LABEL = ['', 'Dễ', 'Vừa', 'Khó'];

export interface BestBattle { points: number; percent: number; stars: number; wins: number; plays: number }
export interface BattleListItem {
  id: number; title: string; summary: string | null; difficulty: number; battle_id: number; battle_name: string; year: number | null; date_text: string | null;
  campaign_id: number | null; campaign_title: string | null; steps: number; has_animation: boolean; locked: boolean; node_id: number | null; node_state: string | null;
  best: BestBattle; active_run: number | null;
}
export interface MiniListItem {
  id: number; kind: MiniKind; kind_label: string; title: string; description: string | null; seconds: number; points: number; campaign_id: number | null; campaign_title: string | null;
  best: { score: number; percent: number; stars: number; plays: number }; active_run: number | null;
}
export interface BattleList { battles: BattleListItem[]; minigames: MiniListItem[] }

export interface ScenarioIntro {
  id: number; title: string; summary: string | null; difficulty: number; status: string;
  battle: { id: number; name: string; year: number | null; date_text: string | null; context: string | null; forces: string | null; campaign_id: number | null; campaign_title: string | null };
  intro: { situation: string; forces: string | null; objective: string }; map: { center: [number, number]; zoom: number }; steps: number; max_score: number; pass_percent: number; bonus_points: number;
  has_animation: boolean; locked: boolean; node_id: number | null; best: { points: number; percent: number; stars: number; plays: number }; active_run: number | null; replay: boolean;
}

export interface Zone { id: string; label: string; lat: number; lng: number; radius_km: number }
export interface DecisionView { id: string; type: 'decision'; title: string; situation: string; index: number; total: number; options: Array<{ id: string; text: string }> }
export interface PlacementView { id: string; type: 'placement'; title: string; situation: string; index: number; total: number; pieces: Array<{ id: string; label: string }>; zones: Zone[] }
export type StepView = DecisionView | PlacementView;

export interface StepOutcome {
  step_id: string; title: string; correct: boolean; score: number; max: number; answer: unknown; feedback: string; consequence: string | null; best: string | null;
  links: Array<{ ref_type: string; ref_id: number; label: string }>; pieces?: Array<{ id: string; label: string; ok: boolean }>;
}
export interface BattleResult {
  score: number; max: number; bonus: number; percent: number; stars: number; passed: boolean; full: boolean; duration_ms: number; outcome: 'full_win' | 'win' | 'lose'; xp_awarded: number; card_drop: boolean;
  node_result: { first_completion: boolean; passed: boolean; stars: number; percent: number; points_awarded: number; unlocked_sources: Array<{ id: number; title: string }>; next_node: { id: number; title: string } | null; journey_completed: boolean } | null;
}
export interface BattleRun {
  id: number; kind: 'battle'; mode: 'play' | 'preview'; status: 'active' | 'done'; title: string; node_id: number | null; scenario_id: number; remaining_ms: number | null;
  battle: { id: number; name: string; year: number | null; date_text: string | null }; intro: ScenarioIntro['intro']; map: { center: [number, number]; zoom: number }; total: number; index: number;
  score: number; max_score: number; pass_percent: number; bonus_points: number; history: StepOutcome[]; step: StepView | null; result: BattleResult | null;
}
export interface BattleAnswer { feedback: StepOutcome; finished: boolean; run: BattleRun }

export interface Frame { label: string; text: string | null; units: Array<{ id: string; side: 'tran' | 'dich'; label: string; lat: number; lng: number }> }
export interface BattleAnimation { scenario_id: number; title: string; battle: string; map: { center: [number, number]; zoom: number }; frames: Frame[]; note: string }

export interface MiniResult { score: number; max: number; percent: number; stars: number; passed: boolean; units: number; total: number; wrong?: number; timed_out: boolean; duration_ms: number; xp_awarded: number; detail: any }
export interface MatchGame { left_label: string; right_label: string; lefts: Array<{ id: string; text: string }>; rights: Array<{ id: string; text: string }>; matched: Array<{ left: string; right: string }>; wrong: number; total: number }
export interface TimelineGame { items: Array<{ id: string; text: string }>; total: number }
export interface CrosswordGame { rows: number; cols: number; total: number; words: Array<{ id: string; number: number; dir: 'across' | 'down'; row: number; col: number; length: number; clue: string }> }
export interface MiniRun {
  id: number; kind: MiniKind; mode: 'play' | 'preview'; status: 'active' | 'done'; title: string; minigame_id: number; remaining_ms: number | null; points: number; seconds: number;
  game: MatchGame | TimelineGame | CrosswordGame; result: MiniResult | null;
}
export type AnyRun = BattleRun | MiniRun;

// ------------------------------------------------------------------ quản trị
export interface AdminScenario {
  id: number; title: string; summary?: string | null; difficulty: number; status: 'draft' | 'published'; battle_id: number; battle_name: string; battle_status: string; campaign_title?: string | null; updated_at: string;
  steps?: number; plays: number; content?: any;
}
export interface BattleOption { id: number; name: string; year: number | null; status: string; campaign_title: string | null; scenario_id: number | null }
export interface AdminMinigame {
  id: number; kind: MiniKind; title: string; description: string | null; status: 'draft' | 'published'; seconds: number; points: number; campaign_id: number | null; campaign_title?: string | null;
  lesson_id?: number | null; params?: any; updated_at: string; plays?: number;
}
