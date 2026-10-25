/** Dữ liệu trao đổi với backend NestJS (/api/...) */

// ---------------------------------------------------------------------- tài khoản
/** root_admin: quản trị tổng (/root-system-admin); school_admin: quản trị một trường (/school-manager-admin) */
export type AuthRole = 'root_admin' | 'school_admin' | 'teacher' | 'student';

/** Trang đăng nhập riêng của từng vai trò (mỗi trang giữ phiên riêng) */
export type Portal = AuthRole;

export type Grade = 6 | 7 | 8 | 9;

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role: AuthRole;
  class_name: string | null;
  must_change_password: boolean;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  school_id: number | null;
  user_code: string | null;
  school_code: string | null;
  region: string | null;
  city: string | null;
  birth_date: string | null;
  school_year: string | null;
  email: string | null;
  grade: number | null;
  deleted_at: string | null;
  purge_at: string | null;
}

/** Phiên đăng nhập server trả về khi đăng nhập hoặc đổi mật khẩu */
export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface AppNotification {
  id: number;
  kind: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------- quản trị (hai cấp)
export interface SchoolStat {
  id: number;
  school_code: string;
  name: string;
  region: string | null;
  city: string | null;
  admins: number;
  teachers: number;
  students: number;
  grades: Record<Grade, number>;
}

export interface AdminOverview {
  scope: 'system' | 'school';
  schools: number;
  teachers: number;
  students: number;
  grades: Record<Grade, number>;
  unassigned: number;
  per_school: SchoolStat[];
  pending_classes: number;
  incomplete: number;
  trash: number;
  pending_first_login: number;
  outbox: Record<'queued' | 'sending' | 'sent' | 'failed' | 'cancelled', number>;
  features: { pgvector: boolean; rls_school_scope: boolean; smtp: boolean };
}

/** Tài khoản kèm tên trường và tiến độ học tập (học sinh) */
export interface AdminUser extends AuthUser {
  school_name: string | null;
  xp: number | null;
  streak: number | null;
  lessons_completed: number | null;
  accuracy: number | null;
}

export interface UserFilters {
  q?: string;
  school_id?: number;
  region?: string;
  city?: string;
  school_year?: string;
  grade?: number;
  role?: AuthRole;
  page?: number;
  limit?: number;
}

export interface UsersPage {
  total: number;
  page: number;
  limit: number;
  items: AdminUser[];
  facets: { regions: string[]; cities: string[]; school_years: string[] };
}

export interface AccountCredential {
  user: AuthUser;
  password: string;
}

export type ManagedRole = 'school_admin' | 'teacher' | 'student';

export interface NewAccountInput {
  full_name: string;
  role: ManagedRole;
  school_id?: number | null;
  class_name?: string | null;
  grade?: number | null;
  school_year?: string | null;
  email?: string | null;
  username?: string | null;
  password?: string | null;
}

export interface NewSchoolInput {
  school_code: string;
  name: string;
  region?: string | null;
  city?: string | null;
}

export interface TrashUser extends AuthUser {
  days_left: number;
}

export type ImportStatus = 'created' | 'delta' | 'existing' | 'incomplete' | 'error';

export interface ImportRow {
  row: number;
  full_name: string;
  role: 'teacher' | 'student' | null;
  school_code: string;
  status: ImportStatus;
  username?: string;
  missing?: string[];
  message?: string;
}

/** Kết quả một lần nhập file Excel mẫu (mật khẩu không có ở đây: gửi qua email / tải CSV) */
export interface ImportResult {
  batches: Array<{ id: number; school_id: number; school_code: string; school_name: string }>;
  totals: Record<'total' | ImportStatus, number>;
  rows: ImportRow[];
  emails_queued: number;
  smtp: boolean;
}

export interface ImportBatch {
  id: number;
  school_id: number;
  school_code: string;
  school_name: string;
  file_name: string;
  total_rows: number;
  created_count: number;
  delta_count: number;
  existing_count: number;
  incomplete_count: number;
  error_count: number;
  created_at: string;
  uploaded_by: string | null;
}

export interface IncompleteLog {
  id: number;
  school_id: number;
  school_code: string;
  row_number: number;
  user_code: string | null;
  email: string | null;
  full_name: string | null;
  missing_fields: string[];
  batch_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface OutboxItem {
  id: number;
  kind: 'bulk' | 'delta' | 'class';
  to_email: string;
  subject: string;
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  full_name: string | null;
  username: string | null;
}

export type ClassStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ClassRequest {
  id: number;
  class_code: string;
  school_year: string;
  name: string;
  status: ClassStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  members: number;
  school_id?: number;
  school_code?: string;
  school_name?: string;
  teacher_name?: string;
  teacher_username?: string;
}

export interface StudentClass {
  id: number;
  class_code: string;
  name: string;
  school_year: string;
  teacher_name: string;
  joined_at: string;
}

// ---------------------------------------------------------------------- học tập
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

export interface ServedOption {
  key: number | string | boolean;
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

/** Câu trả lời của Quân Sư AI (RAG trên kho tri thức + LLM) */
export interface ChatbotReply {
  answer: string;
  grounding_sources?: Array<{ curriculum_match?: string; doc_name?: string }>;
}

// ---------------------------------------------------------------------- giáo viên
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

export interface TeacherClass {
  class_name: string | null;
  students: RosterStudent[];
  summary: {
    total: number;
    active_7d: number;
    practiced: number;
    avg_accuracy: number | null;
    best_streak: number;
    total_stars: number;
    avg_mastery: number | null;
  };
  top_wrong: Array<{ question_id: string; prompt: string; unit_id: string; topic: string; attempts: number; wrong: number; students: number }>;
  unit_mastery: Array<{ unit_id: string; topic: string; avg_p_l: number; students: number }>;
  needs_support: Array<{ id: number; full_name: string; reasons: string[] }>;
}

/** Một trận thi đấu cả lớp đã lưu */
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

/** Câu trắc nghiệm AI soạn cho giáo viên */
export interface GeneratedQuizQuestion {
  id?: string;
  question: string;
  options: string[];
  correct_index: number;
  cognitive_level?: string;
  curriculum_reference?: string;
  explanation?: string;
}

export interface GeneratedQuiz {
  topic?: string;
  total_generated?: number;
  questions?: GeneratedQuizQuestion[];
  generation_notes?: string;
}

/** Màn truyện lịch sử AI soạn */
export interface GeneratedStory {
  stage_title?: string;
  story_narrative?: string;
  historical_fact?: string;
  challenge_question?: string;
  suggested_xp?: number;
  suggested_gp?: number;
}

// ---------------------------------------------------------------------- thi đấu cả lớp (WebSocket)
export type LivePhase = 'lobby' | 'question' | 'reveal' | 'scoreboard' | 'podium';

export type LiveKey = number | boolean | string;

/** replaced: phòng đang mở ở thiết bị khác; expired: phiên đăng nhập hết hạn */
export type LiveStatus = 'connecting' | 'open' | 'reconnecting' | 'replaced' | 'expired';

export interface LiveQuestion {
  id: string;
  type: 'mcq' | 'tf';
  prompt: string;
  topic: string;
  options: Array<{ key: LiveKey; text: string }>;
}

interface LiveBase {
  pin: string;
  title: string;
  phase: LivePhase;
  index: number;
  total: number;
  duration_ms: number;
  remaining_ms: number;
  question: LiveQuestion | null;
}

export interface LiveHostPlayer {
  id: number;
  name: string;
  score: number;
  streak: number;
  correct: number;
  connected: boolean;
  answered: boolean;
  last_gain: number;
  last_correct: boolean | null;
}

export interface LiveHostRoom extends LiveBase {
  scope: string;
  class_name: string;
  locked: boolean;
  answered: number;
  players: LiveHostPlayer[];
  reveal: { key: LiveKey; counts: number[]; explanation: string; source?: string | null } | null;
  saved: boolean;
  session_id: number | null;
}

export interface LivePlayerState extends LiveBase {
  players: number;
  host_online: boolean;
  me: {
    name: string;
    score: number;
    rank: number;
    streak: number;
    correct: number;
    answered_total: number;
    answered: boolean;
    choice: LiveKey | null;
    last_gain: number;
    last_correct: boolean | null;
  };
  reveal: { key: LiveKey; explanation: string } | null;
  top: Array<{ name: string; score: number }>;
}

export type LiveServerMsg =
  | { type: 'room'; room: LiveHostRoom | null; closed?: string }
  | { type: 'state'; state: LivePlayerState | null }
  | { type: 'error'; code: string; message: string }
  | { type: 'kicked' }
  | { type: 'replaced' }
  | { type: 'closed'; reason: string }
  | { type: 'saved'; session_id: number | null }
  | { type: 'pong' };
