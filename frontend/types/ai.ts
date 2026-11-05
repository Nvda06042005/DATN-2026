/** Kiểu dữ liệu AI Tutor "Tiểu Tướng" & Hệ thống AI Sử học Đông A (NLP + BKT + RAG). Khớp với /api/ai. */
export type AiMode = 'tutor' | 'roleplay' | 'teacher' | 'explain' | 'summary' | 'questions' | 'plan';
export interface Citation { n: number; kind: string; kind_label: string; id: number; title: string; snippet: string; openable: boolean }
export interface StudentMasterySummary {
  unit_id: string;
  topic: string;
  old_p_l: number;
  new_p_l: number;
  mastery_status: string;
}
export interface AiMessage {
  id: number; role: 'user' | 'assistant'; content: string; citations?: Citation[]; followups?: string[]; refused?: boolean;
  refusal_reason?: 'out_of_scope' | 'unsafe' | 'quota' | 'not_configured' | null; answer_mode?: 'llm' | 'extractive' | null; reported?: boolean; created_at: string;
  character_name?: string;
  unit_id?: string;
  topic?: string;
  study_hint?: string | null;
  student_mastery_summary?: StudentMasterySummary | null;
  badge_unlocked?: string | null;
  exp_reward?: number;
}
export interface AiConversation { id: number; title: string; mode: AiMode; figure_id: number | null; created_at: string; updated_at: string; questions?: number }
export interface AiReply { conversation: { id: number; mode: AiMode; figure_id: number | null }; user_message: AiMessage; message: AiMessage }
export interface AiQuota { limit: number; used: number; school_limit: number; school_used: number; remaining: number | null; unlimited: boolean }
export interface AiStatus { mode: 'llm' | 'extractive' | 'grounded'; ready: boolean; chunks: number; quota: AiQuota; roleplay: boolean; modes: AiMode[] }
export interface SummaryOptions { lessons: Array<{ id: number; title: string }>; battles: Array<{ id: number; title: string }>; events: Array<{ id: number; title: string }>; figures: Array<{ id: number; title: string }>; campaigns: Array<{ id: number; title: string }> }

export interface BktRecommendationItem {
  unit_id: string;
  topic: string;
  current_p_l: number;
  cognitive_level: string;
  difficulty: number;
  attempts: number;
  recommendation_reason: string;
  suggested_action: string;
}

export interface BktRecommendationsResponse {
  student_id: string;
  bkt_parameters: {
    p_l0: number;
    p_t: number;
    p_g: number;
    p_s: number;
    mastery_threshold: number;
  };
  total_recommendations: number;
  recommendations: BktRecommendationItem[];
  profile?: Record<string, any> | null;
}

// ---------------------------------------------------------------------- giáo viên
export interface QuestionDraft { qtype: 'single' | 'truefalse' | 'fill'; prompt: string; explanation: string; difficulty: number; data: Record<string, unknown> }
export interface DraftResult { conversation_id: number; mode: 'llm' | 'template'; title: string; drafts: QuestionDraft[]; note: string }
export interface PlanResult { conversation_id: number; mode: 'llm' | 'template'; title: string; minutes: number; text: string; note: string }
export interface TopicsResult { days: number; questions: number; students: number; refused: number; topics: Array<{ kind: string; id: number; title: string; asked: number }>; keywords: Array<{ word: string; count: number }>; anonymous: boolean; note: string }

// ---------------------------------------------------------------------- quản trị
export interface AiSettingsView {
  provider: 'none' | 'anthropic' | 'openai'; provider_effective: 'none' | 'anthropic' | 'openai'; base_url: string | null; chat_model: string | null; embed_model: string | null;
  temperature: number; max_tokens: number; top_k: number; min_score: number; system_prompt: string; refusal_message: string; banned_terms: string[]; index_kinds: string[];
  daily_per_user: number; daily_per_school: number; price_in: number; price_out: number; last_index_at: string | null; last_index_ms: number | null; last_index_error: string | null;
  has_key: boolean; key_hint: string | null; key_source: 'env' | 'db' | 'none'; key_unreadable: boolean; env_overrides: string[]; mode: 'llm' | 'extractive'; embeddings: boolean;
  default_chat_model: { anthropic: string; openai: string };
}
export interface IndexKind { kind: string; label: string; enabled: boolean; published: number; sources: number; chunks: number; embedded: number }
export interface AiDoc { id: number; title: string; filename: string | null; file_kind: string; char_count: number; status: 'indexed' | 'error' | 'disabled'; error: string | null; created_at: string; chunks: number }
export interface IndexStatus { kinds: IndexKind[]; docs: AiDoc[]; totals: { chunks: number; embedded: number; sources: number }; last_index_at: string | null; last_index_ms: number | null; last_index_error: string | null; running: boolean }
export interface SyncResult { added: number; updated: number; removed: number; embedded: number; failed: number; chunks: number; ms: number; error: string | null }
export interface TestResult { configured: boolean; provider?: string; message?: string; chat: Record<string, any> | null; embed: Record<string, any> | null }
export interface Playground {
  question: string; ms: number; refused: boolean; reason: string | null; mode: string | null; model: string | null; answer: string; citations: Citation[]; followups: string[];
  tokens_in: number; tokens_out: number; top_score: number | null; min_score: number; top_k: number;
  passages: Array<{ n: number; kind: string; source_id: number; title: string; coverage: number; cosine: number; snippet: string }>;
}
export interface LogItem {
  id: number; created_at: string; mode: string; who: string; role: string; school: string | null; question: string | null; answer: string; refused: boolean; refusal_reason: string | null; answer_mode: string | null;
  model: string | null; tokens_in: number; tokens_out: number; latency_ms: number; top_score: number | null; citations: Citation[]; admin_label: 'correct' | 'incorrect' | null; admin_note: string | null; reports: number; deleted_by_user: boolean;
}
export interface LogPage { total: number; page: number; limit: number; items: LogItem[]; note: string }
export interface AiReport { id: number; status: 'open' | 'reviewing' | 'resolved' | 'dismissed'; reason: string; resolution: string | null; created_at: string; handled_at: string | null; message_id: number; answer: string; citations: Citation[]; admin_label: string | null; question: string | null; school: string | null; who: string }
export interface EvalSummary { labeled: number; correct: number; incorrect: number; total: number; accuracy: number | null }
export interface LimitsView { defaults: { daily_per_user: number; daily_per_school: number }; schools: Array<{ id: number; name: string; school_code: string; daily_per_user: number | null; daily_per_school: number | null; used_today: number }> }

export const REFUSAL_TEXT: Record<string, string> = { out_of_scope: 'Ngoài phạm vi', unsafe: 'Nội dung không phù hợp', quota: 'Hết lượt', not_configured: 'Chưa bật mô hình' };
export const MODE_TEXT: Record<string, string> = { tutor: 'Hỏi đáp', roleplay: 'Nhập vai', teacher: 'Hỏi đáp', explain: 'Giải thích câu sai', summary: 'Tóm tắt', questions: 'Soạn câu hỏi', plan: 'Kịch bản tiết học' };


// ---------------------------------------------------------------------- Khảo thí & Soạn đề chuẩn SGK 7
export interface TopicGroupMeta {
  id: string;
  title: string;
  short_title: string;
  badge: string;
  description: string;
  sgk_reference: string;
  unit_ids: string[];
}

export interface TopicGroupsResponse {
  total_groups: number;
  groups: TopicGroupMeta[];
}

export interface GeneratedQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  cognitive_level: string;
  explanation: string;
  curriculum_reference: string;
  topic_group_id: string;
  topic_group_name: string;
  unit_id?: string;
  topic?: string;
}

export interface QuizGenerateRequest {
  topic_group_id?: string;
  topic?: string;
  cognitive_level?: string;
  num_questions?: number;
  unit_ids?: string[];
}

export interface QuizGenerateResponse {
  topic: string;
  topic_group_id: string;
  topic_group_name: string;
  total_generated: number;
  questions: GeneratedQuizQuestion[];
  mode?: 'llm' | 'grounded';
  generation_notes?: string;
}
