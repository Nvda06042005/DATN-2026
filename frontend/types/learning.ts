/** Kiểu dữ liệu của học tập (Sprint 3–4): câu hỏi, bộ đề, bài học, hành trình, làm bài, kho lịch sử cho học sinh. Khớp với /api/content, /api/learn, /api/play. */

export type QType = 'single' | 'multiple' | 'truefalse' | 'fill' | 'order' | 'map';
export const QTYPE_TEXT: Record<QType, string> = {
  single: 'Một đáp án', multiple: 'Nhiều đáp án', truefalse: 'Đúng / sai', fill: 'Điền khuyết', order: 'Sắp xếp thứ tự', map: 'Kéo thả lên bản đồ',
};
export type Store = 'mine' | 'school' | 'system' | 'all';
export const STORE_TEXT: Record<Exclude<Store, 'all'>, string> = { mine: 'Của tôi', school: 'Kho của trường', system: 'Kho hệ thống' };
export type Scope = 'teacher' | 'school' | 'system';
export const SCOPE_TEXT: Record<Scope, string> = { teacher: 'Của giáo viên', school: 'Kho của trường', system: 'Kho hệ thống' };

export interface QOption { id: string; text: string }
export interface QMapTarget { id: string; label: string; lat: number; lng: number; radius_km: number }
export interface QData {
  options?: QOption[]; correct?: string | string[] | boolean; blanks?: Array<{ accept: string[] }>; items?: QOption[]; targets?: QMapTarget[];
}
export interface HistoryLink { ref_type: string; ref_id: number; label?: string }

export interface QuestionItem {
  id: number; scope: Scope; owner_id: number | null; owner_name: string | null; qtype: QType; qtype_label: string; prompt: string; difficulty: number; campaign_id: number | null;
  campaign_title: string | null; version_no: number; updated_at: string; used_in: number; can_edit: boolean;
}
export interface QuestionDetail {
  id: number; scope: Scope; owner_id: number | null; owner_name: string | null; qtype: QType; prompt: string; image_url: string | null; explanation: string | null; difficulty: number;
  campaign_id: number | null; data: QData; version_no: number; can_edit: boolean; links: HistoryLink[];
  used_in: Array<{ id: number; title: string }>; used_in_lessons: number; answered: number; shares: ShareState[];
}
export interface ShareState { target: 'school' | 'system'; status: 'pending' | 'approved' | 'rejected'; review_note: string | null }
export interface QuestionVersion { version_no: number; snapshot: Record<string, unknown>; created_at: string; changed_by_name: string | null }
export interface QuestionInput {
  qtype: QType; prompt: string; image_url?: string | null; explanation?: string | null; difficulty?: number; campaign_id?: number | null; data: QData; links?: HistoryLink[];
}
export interface Listing<T> { total: number; page: number; limit: number; items: T[] }
export interface ImportRow { row: number; prompt: string; status: 'ok' | 'error' | 'created'; errors: string[]; id?: number }
export interface QuestionImportResult { committed: boolean; total: number; valid: number; errors: number; created: number; rows: ImportRow[] }

export interface QuizItem {
  id: number; scope: Scope; owner_name: string | null; title: string; description: string | null; campaign_id: number | null; campaign_title: string | null;
  seconds_per_question: number; pass_percent: number; question_count: number; total_seconds: number; assigned: number; attempts: number; locked: boolean; can_edit: boolean; updated_at: string;
  cover_url?: string | null; theme?: { bg?: string; music?: string };
}
export interface QuizDetail {
  id: number; scope: Scope; owner_name: string | null; title: string; description: string | null; campaign_id: number | null; seconds_per_question: number; shuffle_questions: boolean;
  shuffle_options: boolean; pass_percent: number; can_edit: boolean; locked: boolean; lock_reason: string | null; shares: ShareState[]; cover_url: string | null; theme: { bg?: string; music?: string };
  items: Array<{ question_id: number; position: number; points: number; seconds: number | null; score_mode: 'standard' | 'double' | 'none' | null; qtype: QType; qtype_label: string; prompt: string; difficulty: number; scope: Scope }>;
}
export interface QuizInput {
  title: string; description?: string | null; campaign_id?: number | null; seconds_per_question?: number; shuffle_questions?: boolean; shuffle_options?: boolean; pass_percent?: number;
  cover_url?: string | null; theme?: { bg?: string; music?: string };
  items: Array<{ question_id: number; points?: number; seconds?: number | null; score_mode?: 'standard' | 'double' | 'none' | null }>;
}

export interface LessonBlock { type: 'text' | 'image' | 'video' | 'map'; heading?: string; text?: string; url?: string; caption?: string; lat?: number; lng?: number; zoom?: number; label?: string }
export interface LessonItem { id: number; title: string; summary: string | null; campaign_id: number | null; campaign_title: string | null; read_minutes: number; status: 'draft' | 'published'; used_in: number; checks: number }
export interface LessonDetail {
  id: number; title: string; summary: string | null; campaign_id: number | null; blocks: LessonBlock[]; read_minutes: number; status: 'draft' | 'published';
  links: HistoryLink[]; checks: Array<{ question_id: number; position: number; qtype: QType; prompt: string }>; used_in: Array<{ id: number; title: string }>;
}
export interface LessonInput { title: string; summary?: string | null; campaign_id?: number | null; blocks: LessonBlock[]; read_minutes?: number; links?: HistoryLink[]; check_question_ids?: number[] }

export type NodeKind = 'lesson' | 'quiz' | 'battle' | 'source' | 'final' | 'practice' | 'listen' | 'chest' | 'gate_test';
export const NODE_KIND_TEXT: Record<NodeKind, string> = {
  lesson: 'Bài học', quiz: 'Câu hỏi', battle: 'Trận đánh', source: 'Tư liệu', final: 'Quyết chiến', practice: 'Luyện tập', listen: 'Nghe kể chuyện', chest: 'Rương', gate_test: 'Kiểm tra cửa',
};
export type NodeIcon = 'book' | 'quiz' | 'sword' | 'scroll' | 'flag' | 'star' | 'castle' | 'ship' | 'horse' | 'map' | 'crown' | 'headphones' | 'dumbbell' | 'chest' | 'trophy';
export const NODE_ICONS: NodeIcon[] = ['book', 'quiz', 'sword', 'scroll', 'flag', 'star', 'castle', 'ship', 'horse', 'map', 'crown', 'headphones', 'dumbbell', 'chest', 'trophy'];

export interface JourneyItem {
  id: number; scope: Scope; owner_name: string | null; title: string; description: string | null; campaign_id: number; campaign_title: string; is_default: boolean;
  status: 'draft' | 'published'; node_count: number; classes: number; learners: number; can_edit: boolean; updated_at: string;
}
export interface JourneyNode {
  id: number; position: number; kind: NodeKind; kind_label: string; title: string; icon: NodeIcon | null; objective: string | null; lesson_id: number | null; quiz_id: number | null;
  source_id: number | null; battle_id: number | null; pass_percent: number | null; reward_points: number; lesson_title: string | null; lesson_status: string | null; read_minutes: number | null;
  quiz_title: string | null; quiz_questions: number | null; source_title: string | null; source_status: string | null; battle_name: string | null; battle_status: string | null;
  completed: number; unlocks: Array<{ id: number; title: string }>;
  pos_x: number | null; pos_y: number | null; opens_at: string | null; min_percent: number | null; min_stars: number | null; reward_gold: number; reward_card_id: number | null; reward_badge_id: number | null;
  /** Lộ trình dạng đường đi (ver0.2): Cửa chứa nút, âm thanh / lời kể của nút nghe kể chuyện, Binh thư thưởng riêng (null = mức mặc định theo loại nút) */
  gate_id: number | null; audio_url: string | null; transcript: string | null; reward_binh_thu: number | null;
}
export interface Gate { id: number; position: number; title: string; summary: string | null; guide_note: string | null }
export interface JourneyDetail {
  id: number; scope: Scope; owner_name: string | null; title: string; description: string | null; campaign_id: number; campaign_title: string; background_url: string | null; is_default: boolean;
  status: 'draft' | 'published'; copied_from: number | null; can_edit: boolean; nodes: JourneyNode[]; gates: Gate[]; problems: string[]; shares: ShareState[];
  classes: Array<{ id: number; name: string; grade: number | null; school_year: string; students: number; assigned_at: string; starts_at: string | null; ends_at: string | null }>;
  edges: Array<{ from_node: number; to_node: number }>;
}
export interface NodeInput {
  kind?: NodeKind; title?: string; icon?: string | null; objective?: string | null; lesson_id?: number | null; quiz_id?: number | null; source_id?: number | null; battle_id?: number | null;
  pass_percent?: number | null; reward_points?: number; unlock_source_ids?: number[];
  opens_at?: string | null; min_percent?: number | null; min_stars?: number | null; reward_gold?: number; reward_card_id?: number | null; reward_badge_id?: number | null;
  gate_id?: number | null; audio_url?: string | null; transcript?: string | null; reward_binh_thu?: number | null; position?: number;
}
export interface GateInput { title?: string; summary?: string | null; guide_note?: string | null }
/** Xem trước bản đồ như học sinh (HK.GV.025) */
export interface JourneyPreview {
  journey: { id: number; title: string; description: string | null; background_url: string | null }; edges: Array<{ from_node: number; to_node: number }>;
  nodes: Array<{ id: number; position: number; kind: NodeKind; kind_label: string; title: string; icon: NodeIcon | null; objective: string | null; state: NodeState; lock_reason: string | null; preds: number[]; pos_x: number | null; pos_y: number | null; stars: number; reward_points: number; reward_gold: number }>;
  totals: { nodes: number; done: number };
}
export interface TeacherClass { id: number; name: string; grade: number | null; school_year: string; students: number; journeys: Array<{ id: number; title: string }> }

export interface ShareItem {
  id: number; entity: 'question' | 'quiz' | 'journey'; entity_label: string; entity_id: number; target: 'school' | 'system'; status: 'pending' | 'approved' | 'rejected'; title: string;
  requester: string | null; requested_by: number | null; school_name: string | null; review_note: string | null; result_id: number | null; created_at: string; reviewed_at: string | null; can_review: boolean;
}
export interface ShareDetail extends ShareItem { content: Record<string, unknown> | null }
export interface HistoryOption { id: number; label: string; status: string }

// ---------------------------------------------------------------------- học sinh
export interface CampaignCard {
  id: number; title: string; year_label: string; summary: string | null; image_url: string | null; places: string[]; events: number; battles: number;
  journey: { id: number; title: string; from_class: boolean } | null; nodes: number; done: number; stars: number; max_stars: number; percent: number; completed: boolean;
}
export type Suggestion = { type: 'node'; node_id: number; title: string; kind: NodeKind; kind_label: string; campaign_id: number; campaign_title: string } | { type: 'practice'; count: number };
export interface StudentHome { learner: { full_name: string; nickname: string | null; avatar_url: string | null }; points: number; streak: number; campaigns: CampaignCard[]; suggestions: Suggestion[] }

export type NodeState = 'done' | 'available' | 'locked';
export interface MapNode {
  id: number; position: number; kind: NodeKind; kind_label: string; title: string; icon: NodeIcon | null; objective: string | null; state: NodeState; stars: number; best_percent: number;
  attempts: number; reward_points: number; completed_at: string | null;
  /** Bản đồ rẽ nhánh (Sprint 7): vị trí phần trăm, các nút nối vào, lý do khóa, điều kiện và thưởng riêng */
  pos_x: number | null; pos_y: number | null; preds: number[]; lock_reason: string | null; min_percent: number | null; min_stars: number | null; opens_at: string | null; reward_gold: number;
  has_reward_card: boolean; has_reward_badge: boolean;
  content: { lesson?: { id: number; title: string; read_minutes: number }; quiz?: { id: number; title: string; pass_percent: number; questions: number; total_seconds: number }; battle?: { id: number; name: string; year: number }; source?: { id: number; title: string; kind: string } } | null;
}
export interface CampaignMap {
  campaign: { id: number; title: string; year_label: string; summary: string | null; image_url: string | null };
  journey: { id: number; title: string; description: string | null; background_url: string | null; is_default: boolean; from_class: boolean } | null;
  nodes: MapNode[]; current_node_id: number | null; totals: { nodes: number; done: number; stars: number; max_stars: number; percent: number };
}
export interface NodeDetail extends Omit<MapNode, 'content'> {
  content: MapNode['content']; unlocks: Array<{ id: number; title: string; unlocked: boolean }>; can_start: boolean; pass_percent: number | null; hint: string | null; has_quiz: boolean; needs_quiz: boolean;
  /** Trận đánh có kịch bản mô phỏng đã phát hành (Sprint 6): hoàn thành nút bằng cách chơi mô phỏng */
  has_sim?: boolean; scenario_id?: number | null;
  /** Màn chơi bằng thẻ tướng của trận đánh (ver0.2, HK.HS.124) */
  stage_id?: number | null;
  /** Lộ trình dạng đường đi (ver0.2): số câu, Binh thư nhận được, Cửa chứa nút */
  question_count?: number | null; reward_binh_thu?: number; gate?: { id: number; title: string } | null;
}
export interface NodeResult {
  first_completion: boolean; passed: boolean; stars: number; percent: number; points_awarded: number; unlocked_sources: Array<{ id: number; title: string }>;
  next_node: { id: number; title: string } | null; journey_completed: boolean; campaign_final: boolean;
  rewards?: { gold: number; card: boolean; badge: string | null; binh_thu?: number; fragments?: Array<{ card: string; qty: number; merged: boolean }> };
}

// ---------------------------------------------------------------------- lộ trình dạng đường đi (ver0.2)
export interface PathNode {
  id: number; position: number; kind: NodeKind; kind_label: string; title: string; icon: NodeIcon | null; state: NodeState; stars: number; best_percent: number;
  reward_points: number; lock_reason: string | null; steps: { done: number; total: number };
}
export interface PathGate { id: number | null; no: number; title: string; summary: string | null; nodes: PathNode[]; done: number; state: 'done' | 'current' | 'locked' }
export interface PathPart {
  no: number; campaign: { id: number; title: string; year_label: string }; journey: { id: number; title: string; from_class: boolean } | null;
  gates: PathGate[]; totals: { nodes: number; done: number };
}
export interface LearningPath { parts: PathPart[]; current: { part_no: number; gate_no: number; gate_title: string; node_id: number } | null }
export interface GateGuide {
  gate: { id: number; title: string; summary: string | null; guide_note: string | null };
  milestones: Array<{ type: 'event' | 'battle'; id: number; name: string; year: number; date_text: string | null }>;
  figures: Array<{ id: number; name: string; honorific: string | null; role_text: string | null }>;
  places: Array<{ id: number; name: string; old_name: string | null }>;
  terms: Array<{ id: number; term: string; definition: string }>;
  quotes: Array<{ text: string; by: string }>;
}
export interface ListenView { node: { id: number; title: string }; title: string; audio_url: string | null; lines: string[]; has_quiz: boolean }
export interface LessonCheckResult { correct: boolean; explanation: string | null; detail?: unknown }
export interface MenuDots { practice: number; live: number }

export interface PlayQuestion {
  id: number; qtype: QType; prompt: string; image_url: string | null; video_url?: string | null; difficulty: number; options?: QOption[]; blanks?: number; items?: QOption[];
  targets?: Array<{ id: string; label: string }>; bounds?: { south: number; north: number; west: number; east: number };
}
export interface AttemptSummary {
  percent: number; stars: number; passed: boolean | null; pass_percent: number; correct: number; wrong: number; total: number; base_points: number; bonus_points: number; duration_ms: number | null;
  node: { title: string; kind: string; reward_points: number } | null; node_result: NodeResult | null;
  assignment?: { assignment_id: number; first: boolean; on_time: boolean; bonus: number } | null;
}
export interface AttemptState {
  id: number; mode: 'node' | 'practice' | 'preview' | 'assignment'; status: 'active' | 'done'; total: number; position: number; base_points: number; bonus_points: number; quiz_id: number | null; node_id: number | null;
  pass_percent: number; waiting_next?: boolean; current?: { index: number; seconds: number; remaining_ms: number; points: number; question: PlayQuestion }; summary?: AttemptSummary;
}
export interface AnswerResult {
  result: {
    question_id: number; correct: boolean; timed_out: boolean; base_points: number; bonus_points: number; explanation: string | null; answer_key: QData;
    detail?: unknown; links: Array<{ ref_type: string; ref_id: number; label: string }>;
  };
  finished: boolean; summary?: AttemptSummary; attempt: { id: number; position: number; total: number; base_points: number; bonus_points: number };
}
export interface ReviewItem {
  index: number; question_id: number; qtype: QType; prompt: string; image_url: string | null; explanation: string | null; answer_key: QData; answer: Record<string, unknown> | null;
  correct: boolean; timed_out: boolean; base_points: number; bonus_points: number; time_ms: number; seconds: number; links: Array<{ ref_type: string; ref_id: number; label: string }>;
}
export interface AttemptReview { id: number; mode: string; started_at: string; finished_at: string | null; summary: AttemptSummary; items: ReviewItem[] }
export interface AttemptHistoryItem {
  id: number; mode: string; percent: number; stars: number; passed: boolean | null; correct_count: number; wrong_count: number; points: number; duration_ms: number | null; finished_at: string;
  node_title: string | null; node_kind: string | null; quiz_title: string | null; campaign_title: string | null;
}
export interface Quest { node_id: number; campaign_id: number; campaign_title: string; journey_title: string; title: string; kind: NodeKind; kind_label: string; condition: string; reward_points: number; stars: number; state: NodeState; best_percent: number }
export interface Quests { doing: Quest[]; done: Quest[]; locked: Quest[] }
export interface LessonView {
  id: number; title: string; summary: string | null; blocks: LessonBlock[]; read_minutes: number; node: { id: number; title: string; reward_points: number } | null;
  progress: { read_percent: number; check_attempts: number; completed_at: string | null }; note: string | null; links: HistoryLink[]; checks: PlayQuestion[];
}
export interface LessonCompletion {
  completed: boolean; results: Array<{ question_id: number; correct: boolean; explanation: string | null }>; node: NodeResult | null;
  /** Bài học là bài tập của lớp (Sprint 7): kết quả nộp bài và điểm thưởng đúng hạn */
  submission?: { first: boolean; on_time: boolean; bonus: number } | null;
}

// kho lịch sử cho học sinh
export interface FigureItem { id: number; name: string; honorific: string | null; figure_group: 'king' | 'general' | 'official' | 'other'; birth_year: number | null; death_year: number | null; role_text: string | null; image_url: string | null }
export interface TimelineEntry { type: 'event' | 'battle'; id: number; name: string; year: number; year_to: number | null; date_text: string | null; campaign_id: number | null; campaign_title: string | null; place_id: number | null; place_name: string | null }
export interface MapPlace { id: number; name: string; old_name: string | null; province: string | null; lat: number; lng: number; image_url: string | null; items: Array<{ type: 'event' | 'battle'; id: number; name: string; year: number }> }
export interface SourceItem { id: number; title: string; kind: string; citation: string | null; favorite: boolean; locked: boolean; unlock_node: string | null }
export interface SearchHit { type: 'figure' | 'event' | 'battle' | 'place' | 'source' | 'term'; id: number; title: string; snippet: string | null; year: number | null; locked?: boolean }
export interface TermItem { id: number; term: string; definition: string }
export type Detail = Record<string, any>;
export interface NoteItem { ref_type: 'lesson' | 'source'; ref_id: number; body: string; updated_at: string; title: string | null }
