/** Dữ liệu trao đổi với backend NestJS (/api/...) */

// ---------------------------------------------------------------------- tài khoản
/** root_admin: quản trị tổng (/admin); school_admin: quản trị một trường (/school-manager-admin) */
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
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  nickname: string | null;
  gender: 'male' | 'female' | 'other' | null;
  subject: string | null;
  parent_email: string | null;
}

/** Hồ sơ cá nhân (HK.*.005/009/010): thông tin, trường, lớp, các trường vai trò được tự sửa */
export interface ProfileData {
  user: AuthUser;
  school: { id: number; school_code: string; name: string } | null;
  classes: Array<{ id: number; class_code: string; name: string; school_year: string; is_active: boolean }>;
  editable: Array<'full_name' | 'email' | 'phone' | 'avatar_url' | 'bio' | 'nickname'>;
}
export type ProfilePatch = Partial<Record<'full_name' | 'email' | 'phone' | 'avatar_url' | 'bio' | 'nickname', string | null>>;

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
  teaching_classes?: Array<{ id: number; class_code: string; school_year: string }>;
}

export interface UserFilters {
  q?: string;
  school_id?: number;
  region?: string;
  city?: string;
  school_year?: string;
  grade?: number;
  class_name?: string;
  class_id?: number;
  role?: AuthRole;
  active?: 'true' | 'false';
  page?: number;
  limit?: number;
}

export interface UsersPage {
  total: number;
  page: number;
  limit: number;
  items: AdminUser[];
  facets: { regions: string[]; cities: string[]; school_years: string[]; class_names?: string[] };
}

export interface AccountCredential {
  user: AuthUser;
  password: string;
}

export type ManagedRole = AuthRole;

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
  grade?: number | null;
  is_active?: boolean;
  join_open?: boolean;
  has_password?: boolean;
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
  teacher_name: string | null;
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

export interface UserDetail extends AuthUser { school_name: string | null; classes: Array<{ id: number; class_code: string; name: string; school_year: string; status: ClassStatus }> }
export interface SecurityFilters { q?: string; school_id?: number; user_id?: number; success?: 'true' | 'false'; page?: number; limit?: number }
export interface SecurityEvent { id: number; created_at: string; school_id: number | null; school_name: string | null; success: boolean; username?: string; user_id?: number | null; portal?: string; reason?: string; actor_name?: string; actor_role?: AuthRole; actor_id?: number | null; action?: string; target_type?: string; target_id?: string | null }
export interface SecurityPage { items: SecurityEvent[]; total: number; page: number; limit: number }

export interface DirectoryFilters { q?: string; school_id?: number; grade?: number; school_year?: string; region?: string; city?: string; education_level?: 'THCS'; active?: 'true' | 'false'; status?: ClassStatus; page?: number; limit?: number }
export interface SchoolProfile { id: number; school_code: string; name: string; region: string | null; city: string | null; address: string | null; contact_name: string | null; contact_email: string | null; contact_phone: string | null; is_active: boolean }
export interface SchoolSummary extends SchoolProfile { classes: number; teachers: number; students: number }
export interface SchoolDetail extends SchoolProfile { counts: { grades: number; classes: number; teachers: number; students: number; admins: number }; grade_counts: Array<{ grade: number; classes: number; students: number }>; admins: AuthUser[] }
export type SchoolUpdate = Partial<Pick<SchoolProfile,'name'|'region'|'city'|'address'|'contact_name'|'contact_email'|'contact_phone'|'is_active'>>;
export interface SchoolsPage { items: SchoolSummary[]; total: number; page: number; limit: number; facets: { regions: string[]; cities: string[] } }
export interface DirectoryClass { id: number; school_id: number; school_name: string; region: string | null; city: string | null; class_code: string; school_year: string; name: string; grade: number | null; status: ClassStatus; is_active: boolean; school_active: boolean; teacher_id: number | null; teacher_name: string | null; education_level: 'THCS'; students: number; join_open: boolean; expected_size: number | null; has_password: boolean; closed_at: string | null }
export interface ClassesPage { items: DirectoryClass[]; total: number; page: number; limit: number; grade_counts: Array<{ grade: number | null; n: number }>; facets: { school_years: string[]; regions: string[]; cities: string[]; education_levels: string[] } }

export interface ReportFilters { school_id?:number;region?:string;city?:string;active?:'true'|'false';school_year?:string }
export interface ReportStats {
  schools:number;active_schools:number;inactive_schools:number;grades:number;classes:number;active_classes:number;approved_classes:number;
  teachers:number;active_teachers:number;assigned_teachers:number;unassigned_teachers:number;students:number;active_students:number;joined_students:number;unjoined_students:number;
  learning_students:number;completed_students:number;completed_sessions:number;answers:number;correct:number;score_students:number;score_sum:number;
  competitions:number;participations:number;unique_participants:number;competition_answers:number;competition_correct:number;legacy_competitions:number;
  completion_rate:number|null;game_participation_rate:number|null;average_score:number|null;accuracy:number|null;competition_accuracy:number|null;
}
export interface SchoolReport extends Pick<SchoolProfile,'id'|'school_code'|'name'|'region'|'city'|'is_active'>,ReportStats {}
export interface DashboardReport {
  scope:'system'|'school';viewer_role:AuthRole;generated_at:string;filters:ReportFilters;summary:ReportStats;per_school:SchoolReport[];
  grades:Array<{school_id:number;school_name:string;grade:number;classes:number;students:number}>;
  class_breakdown:Array<{school_id:number;school_name:string;grade:number|null;school_year:string;classes:number;active_classes:number;approved_classes:number}>;
  education_levels:Array<{level:string;schools:number;classes:number;students:number}>;unassigned_people:number;excluded_legacy_competitions:number;
  facets:{regions:string[];cities:string[];school_years:string[]};definitions:string[];
}

// ---------------------------------------------------------------------- TM.SA-CONTENT: nội dung và cấu hình (quản trị tổng)
export type PublishState = 'draft' | 'published' | 'archived';
export type NodeKind = 'campaign' | 'chapter' | 'lesson' | 'stage' | 'battle';
export interface CurriculumNode {
  id: number; parent_id: number | null; kind: NodeKind; code: string; title: string; summary: string; period: string | null;
  sort_order: number; status: PublishState; version: number; updated_at: string; children: number;
}
export interface CurriculumData { nodes: CurriculumNode[]; kinds: Array<{ id: NodeKind; label: string }> }
export interface NodeInput { kind?: NodeKind; parent_id?: number | null; code?: string; title?: string; summary?: string; period?: string | null; sort_order?: number; status?: PublishState }

export type BankQuestionType = 'mcq' | 'tf' | 'order' | 'match' | 'map';
export type BankQuestionStatus = 'draft' | 'published' | 'hidden';
export interface BankQuestionRow {
  id: string; origin: 'file' | 'admin'; status: BankQuestionStatus; edited: boolean; live: boolean; unit_id: string; topic: string;
  type: BankQuestionType; level: string; prompt: string; source: string | null; version: number; updated_at: string | null;
}
export interface BankQuestionsPage {
  items: BankQuestionRow[]; total: number; page: number; limit: number;
  counts: { all: number; published: number; draft: number; hidden: number; edited: number; added: number };
  facets: { units: Array<{ unit_id: string; topic: string }>; places: Record<string, string> };
}
export interface BankQuestionBody {
  unit_id: string; type: BankQuestionType; prompt: string; explanation: string; level?: string; source?: string | null; hint?: string | null;
  options?: string[]; answer?: number | boolean | string; items?: string[]; left?: string[]; right?: string[]; keep_order?: boolean;
}
export interface BankQuestionDetail {
  id: string; origin: 'file' | 'admin'; status: BankQuestionStatus; version: number; review_note: string | null;
  question: BankQuestionBody & { id: string }; original: (BankQuestionBody & { id: string }) | null;
}

export type SourceStatus = 'pending' | 'approved' | 'rejected' | 'archived';
export type SourceKind = 'chinh_su' | 'giai_thoai' | 'tham_khao';
export interface AiSourceRow {
  id: number; title: string; citation: string; kind: SourceKind; unit_id: string | null; file_name: string | null; status: SourceStatus;
  review_note: string | null; version: number; content_length: number; reviewed_at: string | null; created_at: string; updated_at: string;
}
export interface AiSourcesPage { items: AiSourceRow[]; total: number; page: number; limit: number; counts: Record<SourceStatus, number>; units: Array<{ unit_id: string; topic: string }> }
export interface AiSourceDetail extends Omit<AiSourceRow, 'content_length'> { content: string }
export interface AiSourceInput { title: string; citation: string; kind: SourceKind; unit_id?: string | null; file_name?: string | null; content: string }
export interface AiSourceHit { id: number; title: string; citation: string; kind: SourceKind; unit_id: string | null; score: number; excerpt: string }

export type CardRarity = 'hiem' | 'su_thi' | 'huyen_thoai' | 'tiet_che';
export type CardKind = 'chinh_su' | 'giai_thoai' | 'sang_tao' | 'dan_gian';
export interface HeroCardRow {
  code: string; name: string; title: string | null; role: string | null; rarity: CardRarity; kind: CardKind; summary: string; source: string;
  unlock_condition: string; status: PublishState; sort_order: number; version: number; updated_at: string;
}
export interface HeroCardsData { items: HeroCardRow[]; counts: { all: number; chinh_su: number; giai_thoai: number; published: number } }
export type HeroCardInput = Partial<Pick<HeroCardRow, 'code' | 'name' | 'title' | 'role' | 'rarity' | 'kind' | 'summary' | 'source' | 'unlock_condition' | 'sort_order' | 'status'>>;

export type BadgeMetric = 'xp' | 'streak' | 'lessons_completed' | 'questions_correct' | 'perfect_runs';
export interface ExpRulesConfig {
  xp_correct: number; xp_wrong: number; gems_correct: number; gems_weak: number; daily_gem_cap: number; weak_threshold: number;
  levels: Array<{ level: number; name: string; min_xp: number }>;
  badges: Array<{ code: string; name: string; metric: BadgeMetric; threshold: number; reward_xp: number; reward_gems: number }>;
}
export interface ExpRulesData {
  active: { version: number; config: ExpRulesConfig; since: string | null };
  versions: Array<{ version: number; is_active: boolean; note: string | null; created_at: string; created_by_name: string | null }>;
  metrics: BadgeMetric[];
}

export interface ContentHistoryRow { id: number; entity: string; entity_id: string; version: number; action: string; snapshot: Record<string, unknown>; actor_name: string; created_at: string }

export type EventKind = 'login' | 'audit' | 'import' | 'mail';
export type EventLevel = 'info' | 'warn' | 'error';
export interface SystemEvent { kind: EventKind; level: EventLevel; title: string; actor: string | null; detail: string | null; school_id: number | null; school_name: string | null; created_at: string }
export interface SystemEventsPage { items: SystemEvent[]; page: number; limit: number; has_more: boolean; total: number; counts: Record<EventKind, number>; schools: Array<{ id: number; name: string }> }
export interface SystemEventFilters { from?: string; to?: string; school_id?: number; kind?: EventKind; level?: EventLevel; page?: number; limit?: number }
export interface SystemHealth {
  generated_at: string;
  api: { status: string; uptime_seconds: number; response_ms: number };
  database: { status: string; schema_version: number; migrations: number; school_scope_rls: boolean; pgvector: boolean };
  ai: { status: string; latency_ms: number | null };
  mail: { configured: boolean; worker: boolean; queued: number; failed: number; sent_24h: number };
  imports: { batches_24h: number; error_rows_24h: number; open_incomplete: number };
  logins: { failed_24h: number; locked_24h: number };
}

// ---------------------------------------------------------------------- TM.SCH-CLASS / TM.T-CLASS: vòng đời lớp
export interface SchoolGrade { school_year: string; grade: number; is_active: boolean; classes: number; active_classes: number }
export interface ClassEvent { id: number; kind: string; note: string | null; created_at: string; actor_name: string | null; teacher_name: string | null; previous_teacher_name: string | null; student_name: string | null; related_class_code: string | null }
export interface NewClassInput { school_id?: number; class_code: string; school_year: string; grade: number; name: string; expected_size?: number | null; teacher_id?: number | null }
export interface ClassView {
  id: number; school_id: number; teacher_id: number | null; teacher_name: string | null; class_code: string; school_year: string; name: string; grade: number | null;
  status: ClassStatus; is_active: boolean; join_open: boolean; has_password: boolean; expected_size: number | null; closed_at: string | null; students: number;
}
export interface AvailableClass { id: number; class_code: string; name: string; school_year: string; grade: number | null; teacher_name: string; joined: boolean }
