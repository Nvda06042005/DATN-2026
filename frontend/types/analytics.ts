/** Kiểu dữ liệu gợi ý học tập, thống kê và báo cáo (Sprint 10). Khớp với /api/analytics. */
export type TopicType = 'campaign' | 'figure' | 'event' | 'place' | 'battle' | 'source';
export type TopicLevel = 'strong' | 'ok' | 'weak' | 'new';
export interface TopicRow { type: TopicType; id: number; name: string; answered: number; correct: number; percent: number; last_at: string | null; level: TopicLevel }
export interface TypeRow { type: TopicType; label: string; answered: number; correct: number; percent: number | null; topics: number }

export const TOPIC_TYPE_LABEL: Record<TopicType, string> = { campaign: 'Cuộc kháng chiến', figure: 'Nhân vật', event: 'Sự kiện', place: 'Địa danh', battle: 'Trận đánh', source: 'Tư liệu' };
/** Ngưỡng hiển thị hiểu nhanh: dưới `weak_threshold` là yếu, từ 85% là mạnh */
export const LEVEL_TEXT: Record<TopicLevel, string> = { strong: 'Mạnh', ok: 'Khá', weak: 'Cần ôn', new: 'Chưa đủ dữ liệu' };

// ---------------------------------------------------------------------- học sinh
export interface Strengths {
  overall: { answered: number; correct: number; accuracy: number | null }; weak_threshold: number; min_answers: number; by_type: TypeRow[]; strong: TopicRow[]; weak: TopicRow[]; topics: TopicRow[];
}
export interface PlanTask { kind: 'practice' | 'wrong' | 'rest' | 'review' | 'exam'; title: string; minutes: number; topic_type?: TopicType; topic_id?: number; assignment_id?: number }
export interface ExamPlan {
  assignment_id: number; title: string; class_name: string; due_at: string; days_left: number;
  weak_topics: Array<{ type: TopicType; id: number; name: string; percent: number }>; days: Array<{ date: string; tasks: PlanTask[] }>;
}
export interface ExamPlans { exams: ExamPlan[]; note: string }
export interface StudentAiProfile {
  has_activity: boolean;
  student: { id: number; full_name: string; grade: number | null; school_id: number | null };
  stats: {
    xp: number; level: number; streak_current: number; daily_goal: number;
    progress: number | null; nodes_done: number; nodes_total: number;
    avg_percent: number | null; attempts: number; answered: number; correct: number; accuracy: number | null;
    study_minutes: number; active_days: number; last_active_at: string | null; days_idle: number | null;
  };
  current_journey: {
    title: string | null;
    next_node: { journey_id: number; journey_title: string; node_id: number; title: string; kind: string } | null;
    review_nodes: Array<{ id: number; title: string; kind: string; best_percent: number; stars: number }>;
  };
  topics: { strong: TopicRow[]; weak: TopicRow[]; all: TopicRow[] };
  recent_wrong_questions: Array<{ question_id: number; prompt: string; difficulty: number; wrong_count: number; last_wrong_at: string; campaign_title: string | null }>;
  upcoming_assignments: Array<{ assignment_id: number; title: string; class_name: string; due_at: string; days_left: number; weak_topics: Array<{ type: string; id: number; name: string; percent: number }> }>;
  ai_history: { questions_30d: number; recent_questions: string[] };
}

// ---------------------------------------------------------------------- lớp và học sinh
export interface ClassInfo { id: number; name: string; grade: number | null; school_id: number; school_name: string; year_label: string | null; is_active: boolean; teachers: string | null; teacher_ids: number[]; students: number }
export interface StudentStat {
  id: number; full_name: string; user_code: string | null; email: string | null; progress: number | null; nodes_done: number; nodes_total: number; xp: number; level: number; streak: number;
  avg_percent: number | null; attempts: number; answered: number; correct: number; accuracy: number | null; study_minutes: number; last_active_at: string | null; active_days: number;
}
export interface ClassDashboard {
  class: ClassInfo; students: number; avg_progress: number | null; completion_rate: number | null; avg_points: number | null; avg_percent: number | null; accuracy: number | null;
  active_week: number; participation: number | null; streak_holders: number; study_minutes: number;
  distribution: Array<{ label: string; count: number }>; series: Array<{ day: string; events: number; students: number }>; roster: StudentStat[]; period: { from: string | null; to: string | null };
}
export interface ClassTopics { class: ClassInfo; weak_threshold: number; by_type: TypeRow[]; weak: TopicRow[]; topics: TopicRow[]; students: number }
export interface SupportItem {
  id: number; full_name: string; user_code: string | null; severity: number; reasons: string[]; progress: number | null; accuracy: number | null; last_active_at: string | null;
  weak_topics: Array<{ type: TopicType; id: number; name: string; percent: number }>; suggestion: string;
}
export interface SupportList { class: ClassInfo; students: number; mean_progress: number; items: SupportItem[]; note: string }
export interface ResultGroup {
  key: string; label: string; classes: number; students: number; active_students: number; participation: number | null; avg_progress: number | null; avg_percent: number | null; accuracy: number | null; avg_points: number | null; rank: number;
}
export interface ResultClass {
  class_id: number; class_name: string; grade: number | null; teachers: string | null; school_name: string; students: number; active_students: number; participation: number | null; avg_progress: number | null; avg_percent: number | null; accuracy: number | null;
}
export interface Results { by: 'class' | 'grade' | 'teacher'; period: { from: string | null; to: string | null }; groups: ResultGroup[]; classes: ResultClass[] }

export interface StudentProfile {
  student: { id: number; full_name: string; user_code: string | null; email: string | null; grade: number | null; classes: Array<{ id: number; name: string }> };
  stats: StudentStat;
  journeys: Array<{ journey_id: number; title: string; from_class: boolean; done: number; total: number; nodes: Array<{ id: number; title: string; kind: string; state: string; best_percent: number; stars: number; attempts: number; completed_at: string | null }> }>;
  attempts: Array<{ id: number; mode: string; percent: number; stars: number; passed: boolean; correct_count: number; wrong_count: number; duration_ms: number; finished_at: string; title: string }>;
  battles: Array<{ kind: string; title: string; percent: number; stars: number; passed: boolean; finished_at: string }>;
  war: Array<{ title: string; best_stars: number; clears: number; attempts: number }>;
  timeline: Array<{ event: string; ref_type: string | null; created_at: string; label: string }>;
  badges: Array<{ name: string; icon: string | null; awarded_at: string }>;
  cards: number; ai_questions_30d: number;
  topics: { by_type: TypeRow[]; strong: TopicRow[]; weak: TopicRow[]; all: TopicRow[] };
}
export interface FeedbackDraft { subject: string; body: string; student: { id: number; full_name: string; has_email: boolean } }
export interface FeedbackLog { id: number; recipient: 'student' | 'parent'; subject: string; created_at: string; teacher: string | null }

// ---------------------------------------------------------------------- trường và hệ thống
export interface SchoolOverview { classes: number; teachers: number; students: number; journeys_running: number; activities_today: number; active_today: number; active_week: number }
export interface UsagePoint { bucket: string; lessons: number; quizzes: number; battles: number; rooms: number; users: number }
export interface Usage { granularity: 'day' | 'week' | 'month'; days: number; items: UsagePoint[]; totals: { lessons: number; quizzes: number; battles: number; rooms: number } }
export interface AiUsage {
  days: number; questions: number; answers: number; refused: number; refusal_rate: number | null; tokens_in: number; tokens_out: number; llm_answers: number; users: number; reported: number;
  series: Array<{ day: string; questions: number; tokens: number }>; topics: Array<{ kind: string; id: number; title: string; asked: number }>; cost_usd: number; price: { price_in: number; price_out: number; daily_per_school: number };
  quota?: { limit: number; used_today: number; remaining: number };
}
export interface SystemOverview {
  as_of: string; schools: number; schools_total: number; users_by_role: Record<string, number>; dau: number; wau: number; mau: number; new_users_30d: number; series: Array<{ day: string; users: number }>;
}
export interface ContentRow { key: string; label: string; total: number; draft: number; verified: number; published: number }
export interface ContentStats { history: ContentRow[]; learning: ContentRow[]; questions: { total: number; by_scope: Record<string, number> }; quizzes: number; ai_chunks: number }
