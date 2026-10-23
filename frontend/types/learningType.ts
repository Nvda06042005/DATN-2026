export interface LearnerProgress {
  xp: number;
  week_xp: number;
  gems: number;
  streak: number;
  freeze_available: boolean;
  lessons_completed: number;
  perfect_runs: number;
  questions_answered: number;
  questions_correct: number;
  accuracy: number | null;
  ai_questions: number;
  day_xp: number;
  day_lessons: number;
  day_correct: number;
  day_ai_questions: number;
  day_gems: number;
  daily_gem_cap: number;
  class_name: string | null;
  class_rank: number;
  class_size: number;
}

export interface LeaderboardEntry {
  id: number;
  full_name: string;
  xp: number;
  week_xp: number;
  streak: number;
  is_me: boolean;
}

export type GQType = 'mcq' | 'tf' | 'order' | 'match' | 'map';

interface ServedOption {
  key: number | string;
  text: string;
}

export interface ServedQuestion {
  id: string;
  unit_id: string;
  type: GQType;
  prompt: string;
  level: string;
  topic: string;
  source?: string | null;
  hint?: string | null;
  options?: ServedOption[] | null;
  items?: ServedOption[] | null;
  left?: ServedOption[] | null;
  right?: ServedOption[] | null;
}

export interface QuestionsResponse {
  questions: ServedQuestion[];
  mode: string;
  units: string[];
  note?: string | null;
}

export interface AnswerPayload {
  choice?: number | string | boolean | null;
  order?: number[];
  pairs?: Record<string, number>;
}

export interface AnswerResult {
  question_id: string;
  unit_id: string;
  topic: string;
  correct: boolean;
  reveal: { choice?: number | string | boolean; order?: number[]; pairs?: Record<string, number> };
  explanation: string;
  source: string | null;
  old_p_l: number;
  new_p_l: number;
  p_l_delta: number;
  mastery_status: string;
  attempts: number;
  xp_gained: number;
  gems_gained: number;
  progress: LearnerProgress;
}

export interface CodexEntry {
  unit_id: string;
  category: string;
  topic: string;
  entity: string;
  event: string;
  badge: string | null;
  label: string;
  fact_chunk: string;
  answer: string;
  source: string | null;
}

export interface QuestionRequest {
  units?: string[];
  count: number;
  mode?: 'mixed' | 'weak';
  types?: GQType[];
  levels?: string[];
  ai?: boolean;
}

export interface Recommendation {
  unit_id: string;
  topic: string;
  current_mastery: number;
  reason: string;
}
