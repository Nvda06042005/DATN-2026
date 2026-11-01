/** Kiểu dữ liệu lớp học (Sprint 7): quản lý lớp, đội, thưởng/phạt, bài tập, kỹ năng, thông báo. Khớp với /api/classroom. */
import type { AttemptState } from '@/types/learning';
import type { MiniRun } from '@/types/battle';

/** Tên đội đã có chữ "Đội" thì giữ nguyên, chưa có thì thêm (giáo viên tự đặt tên đội) */
export const teamLabel = (name: string): string => (/^đội\s/i.test(name) ? name : `Đội ${name}`);

export interface ClassRule { id: string; label: string; xp: number; gold: number; hp: number }
export interface ClassSettings {
  hearts_enabled: boolean; hearts_max: number | null; leaderboard_enabled: boolean; skill_approval: boolean; team_goal_per_member: number; rules: ClassRule[]; rules_default: boolean;
}
export interface ClassRow {
  id: number; name: string; grade: number | null; school_year: string; description: string | null; cover_url: string | null; join_code: string; join_open: boolean; is_active: boolean;
  own: boolean; students: number; teams: number; pending_leaves: number; pending_skills: number; journeys: Array<{ id: number; title: string; percent: number }>; avg_progress: number | null;
}
export interface ClassJourney {
  journey_id: number; title: string; campaign_title: string; starts_at: string | null; ends_at: string | null; assigned_at: string; nodes: number; done: number; percent: number; state: 'upcoming' | 'running' | 'ended';
}
export interface ClassDetail extends Omit<ClassRow, 'journeys' | 'avg_progress' | 'teams'> {
  teachers: Array<{ id: number; full_name: string }>; journeys: ClassJourney[]; settings: ClassSettings;
}
export interface ClassStudent {
  id: number; full_name: string; nickname: string | null; user_code: string | null; username: string; level: number; xp: number; gold: number; hearts: number; hearts_max: number; streak: number;
  character_name: string | null; character_icon: string | null; character_color: string | null; team_id: number | null; team_name: string | null; last_active: string | null;
}
export interface PoolStudent { id: number; full_name: string; user_code: string | null; nickname: string | null; grade: number | null }
export interface TeamRow { id: number; name: string; icon: string; members: Array<{ id: number; full_name: string; nickname: string | null }> }
export interface LeaveRow { id: number; status: 'pending' | 'approved' | 'rejected'; reason: string | null; created_at: string; decided_at: string | null; user_id: number; full_name: string; user_code: string | null }
export interface AdjustInput { user_ids?: number[]; team_ids?: number[]; rule_id?: string; label?: string; xp?: number; gold?: number; hp?: number }
export interface AdjustResult { label: string; kind: 'reward' | 'penalty'; count: number; results: Array<{ user_id: number; name: string; applied: { xp: number; gold: number; hp: number } }> }
export interface AdjustRow { id: number; kind: 'reward' | 'penalty' | 'event' | 'goal'; label: string; xp: number; gold: number; hp: number; applied: { xp: number; gold: number; hp: number } | null; created_at: string; full_name: string; team_name: string | null }
export interface RandomEvent { id: string; label: string }
export interface RandomEventResult { event: RandomEvent & { xp: number; gold: number; hp: number }; scope: string; affected: number }
export interface GoalRow { id: number; title: string; target_xp: number; reward_gold: number; reward_xp: number; since: string; opened_at: string | null; created_at: string; progress: number; reached: boolean; opened: boolean }
export interface BoardView {
  period: 'week' | 'month' | 'all';
  students: Array<{ id: number; full_name: string; nickname: string | null; xp: number; rank: number }>;
  teams: Array<{ id: number; name: string; icon: string; members: number; xp: number; rank: number }>;
}
export interface ProgressView {
  journeys: Array<{ id: number; title: string }>; journey: { id: number; title: string; starts_at: string | null; ends_at: string | null } | null;
  nodes: Array<{ id: number; position: number; kind: string; title: string; pos_x: number | null; pos_y: number | null; done: number; at_node: number; percent: number }>;
  students: Array<{ id: number; name: string; full_name: string; done: number; total: number; percent: number; current_node: string | null; last_active: string | null; behind: boolean; reason: string | null }>;
  summary: { avg_percent: number; behind: number; students?: number };
}
export interface Notice { id: number; kind: string; title: string; body: string; read_at: string | null; created_at: string; class_id: number | null; class_name: string | null; ref: Record<string, unknown> | null }
export interface Notices { unread: number; items: Notice[] }
export interface AnnouncementRow { title: string; body: string; created_at: string; recipients: number; read: number }
export interface BadgeAwardResult { badge: string; awarded: number; already: number }

// ---------------------------------------------------------------------- bài tập
export type AssignKind = 'quiz' | 'minigame' | 'lesson';
export type AssignAudience = 'class' | 'team' | 'students';
export interface AssignmentRow {
  id: number; class_id: number; title: string; description: string | null; kind: AssignKind; kind_label: string; quiz_id: number | null; minigame_id: number | null; lesson_id: number | null;
  content_title: string; audience: AssignAudience; team_ids: number[]; student_ids: number[]; due_at: string; max_attempts: number; bonus_points: number; status: 'active' | 'revoked';
  created_at: string; overdue: boolean; audience_size: number; submitted: number; graded: number; rate: number;
}
export interface SubmissionRow {
  id: number; full_name: string; nickname: string | null; user_code: string | null; attempts: number | null; best_percent: number | null; submitted_at: string | null; on_time: boolean | null;
  teacher_score: number | null; feedback: string | null; graded_at: string | null; reminded_at: string | null; state: 'todo' | 'submitted' | 'late' | 'graded'; grade: string | null;
}
export interface AssignmentDetail extends Omit<AssignmentRow, 'audience_size' | 'submitted' | 'graded' | 'rate'> {
  teams: Array<{ id: number; name: string }>; students: SubmissionRow[]; summary: { total: number; submitted: number; graded: number; late: number };
}
export interface AssignmentInput {
  title: string; description?: string | null; kind: AssignKind; quiz_id?: number; minigame_id?: number; lesson_id?: number; audience: AssignAudience; team_ids?: number[]; student_ids?: number[];
  due_at: string; max_attempts: number; bonus_points: number;
}
export type MyAssignState = 'todo' | 'doing' | 'submitted' | 'late' | 'overdue' | 'graded';
export interface MyAssignment {
  id: number; class_id: number; class_name: string; title: string; description: string | null; kind: AssignKind; kind_label: string; content_title: string; due_at: string; max_attempts: number;
  bonus_points: number; attempts: number; attempts_left: number; best_percent: number | null; submitted_at: string | null; on_time: boolean | null; teacher_score: number | null;
  feedback: string | null; grade: string | null; state: MyAssignState; minigame_id: number | null; lesson_id: number | null; quiz_id: number | null;
}
export type AssignmentLesson = import('@/types/learning').LessonView;
export type StartedAssignment = { kind: 'quiz'; attempt: AttemptState } | { kind: 'minigame'; run: MiniRun } | { kind: 'lesson'; lesson: AssignmentLesson };
export interface LessonSubmit {
  completed: boolean; results: Array<{ question_id: number; correct: boolean; explanation: string | null }>; submission: { first: boolean; on_time: boolean; bonus: number } | null;
}

// ---------------------------------------------------------------------- kỹ năng nhân vật
export interface SkillItem { code: string; name: string; description: string; cost: number; needs_approval: boolean; in_quiz: boolean; targets_friend: boolean; usable: boolean }
export interface SkillView {
  ap: { current: number; max: number }; buffs: Record<string, number>; in_class: boolean; skills: SkillItem[];
  classmates: Array<{ id: number; name: string; hearts: number }>; recent: Array<{ id: number; skill: string; status: string; created_at: string; target_name: string | null }>;
}
export interface SkillUseResult { skill: string; status: 'done' | 'pending'; message: string; ap: { current: number; max: number }; removed?: string[]; links?: Array<{ ref_type: string; ref_id: number; label: string }> }
export interface SkillRequestRow { id: number; skill: string; status: 'pending' | 'done' | 'rejected'; cost: number; created_at: string; decided_at: string | null; user_name: string; target_name: string | null }

// ---------------------------------------------------------------------- học sinh: lớp học của tôi
export interface MyClassRow {
  id: number; name: string; grade: number | null; school_year: string; description: string | null; cover_url: string | null; is_active: boolean;
  teachers: Array<{ id: number; full_name: string }>; members: number; team_name: string | null; leave_pending: number; journeys: Array<{ id: number; title: string; campaign_title: string }>;
}
export interface TeamQuest { id: string; title: string; progress: number; target: number; done: boolean }
export interface MyTeam {
  id: number; name: string; icon: string; members: Array<{ id: number; name: string; level: number; xp: number; goal_today: boolean }>; xp_week: number; rank: number | null; teams: number; quests: TeamQuest[];
}
export interface MyClassDetail {
  id: number; name: string; grade: number | null; school_year: string; description: string | null; cover_url: string | null; teachers: Array<{ id: number; full_name: string }>;
  members: Array<{ id: number; name: string; level: number; character_name: string | null; character_icon: string | null; character_color: string | null; team_id: number | null; team_name: string | null; me: boolean }>;
  journeys: Array<{ journey_id: number; title: string; campaign_title: string; state: string; starts_at: string | null; ends_at: string | null; percent: number }>;
  team: MyTeam | null; leaderboard_enabled: boolean; skill_approval: boolean; goals: GoalRow[]; announcements: Array<{ id: number; title: string; body: string; created_at: string }>; leave_pending: boolean;
}
export interface TeamBoard {
  period: string; disabled: boolean; message?: string; me_team: number | null; teams: Array<{ id: number; name: string; icon: string; members: number; xp: number; rank: number; mine: boolean }>;
}
