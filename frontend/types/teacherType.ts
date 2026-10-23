export interface RosterStudent {
  id: number;
  full_name: string;
  username: string;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  xp: number;
  week_xp: number;
  streak: number;
  lessons_completed: number;
  perfect_runs: number;
  questions_answered: number;
  accuracy: number | null;
  avg_mastery: number | null;
  ai_questions: number;
  /** Số sao của 3 màn chiến dịch (mỗi màn tối đa 9 sao) */
  campaign_stars: number[];
  stars: number;
  heroes: number;
}

export interface ClassSummary {
  total: number;
  active_7d: number;
  practiced: number;
  avg_accuracy: number | null;
  best_streak: number;
  total_stars: number;
  avg_mastery: number | null;
}

interface WrongQuestion {
  question_id: string;
  prompt: string;
  unit_id: string;
  topic: string;
  attempts: number;
  wrong: number;
  students: number;
}

interface UnitMastery {
  unit_id: string;
  topic: string;
  avg_p_l: number;
  students: number;
}

interface SupportNeed {
  id: number;
  full_name: string;
  reasons: string[];
}

export interface TeacherClass {
  class_name: string | null;
  students: RosterStudent[];
  summary: ClassSummary;
  top_wrong: WrongQuestion[];
  unit_mastery: UnitMastery[];
  needs_support: SupportNeed[];
}

export interface TodoTask {
  id: string;
  title: string;
  description: string;
  category: 'profile' | 'report' | 'ai' | 'lesson' | 'excel' | 'assignment';
  status: 'active' | 'completed' | 'skipped';
  actionLabel?: string;
  actionType?: 'profile' | 'report' | 'ai' | 'lesson' | 'excel' | 'library';
}

/** Tiến độ game & học tập của lớp: câu sai nhiều nhất, mức nắm vững theo chủ đề, học sinh cần hỗ trợ */
/** Một trận thi đấu cả lớp đã lưu (GET /api/teacher/live-sessions) */
export interface LiveSessionSummary {
  id: number;
  title: string;
  scope: string;
  class_name: string | null;
  question_count: number;
  player_count: number;
  started_at: string;
  finished_at: string;
  accuracy: number | null;
  results: Array<{ user_id: number; full_name: string; rank: number; score: number; correct: number; answered: number }>;
  questions: Array<{ question_id: string; prompt: string; topic: string; answered: number; correct: number }>;
}
