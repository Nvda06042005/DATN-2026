/** Kiểu dữ liệu nền tảng (Sprint 11–12): thông báo, hỗ trợ, hướng dẫn, cấu hình, phân quyền, nhật ký, sao lưu, khảo sát, nghiên cứu. Khớp với /api/platform. */
export type Role = 'student' | 'teacher' | 'school_admin' | 'root_admin';
export type NoticeCategory = 'system' | 'class' | 'achievement';
export const CATEGORY_TEXT: Record<NoticeCategory, string> = { system: 'Hệ thống', class: 'Lớp học', achievement: 'Thành tích' };

export interface PlatformConfig { system_name: string; logo_url: string | null; language: string; timezone: string; flags: Record<string, boolean>; features: { gamification: boolean; ai: boolean } }
export interface Prefs { theme: 'light' | 'dark' | 'system'; reminder_enabled: boolean; reminder_hour: number; reminder_channel: 'web' | 'email' | 'both'; has_email: boolean; can_remind: boolean }

// ---------------------------------------------------------------------- thông báo
export interface NoticeItem { id: number; kind: string; category: NoticeCategory; title: string; body: string; read_at: string | null; created_at: string; class_id: number | null; class_name: string | null; ref: Record<string, unknown> | null }
export interface NoticeList { unread: number; unread_by_category: Record<NoticeCategory | 'total', number>; items: NoticeItem[] }
export interface Broadcast {
  id: number; sender_id: number | null; sender_role: 'teacher' | 'school_admin' | 'root_admin'; sender_name?: string | null; school_id: number | null; scope: 'class' | 'grade' | 'school' | 'system'; class_ids: number[]; grades: number[]; school_ids: number[]; roles: string[];
  title: string; body: string; send_at: string; sent_at: string | null; status: 'scheduled' | 'sent' | 'cancelled'; recipients: number; read?: number; class_names?: string[];
}
export interface BroadcastInput { title: string; body: string; scope?: string; class_ids?: number[]; grades?: number[]; school_ids?: number[]; roles?: string[]; send_at?: string | null }

// ---------------------------------------------------------------------- hỗ trợ và hướng dẫn
export type TicketStatus = 'new' | 'processing' | 'done';
export const TICKET_STATUS_TEXT: Record<TicketStatus, string> = { new: 'Mới', processing: 'Đang xử lý', done: 'Đã xong' };
export const TICKET_CATEGORY_TEXT: Record<string, string> = { bug: 'Báo lỗi', feedback: 'Góp ý', question: 'Câu hỏi', account: 'Tài khoản' };
export interface Ticket { id: number; user_id: number; role: string; category: string; subject: string; body: string; status: TicketStatus; page: string | null; has_attachment: boolean; attachment_name: string | null; created_at: string; updated_at: string; replies?: number; user_name?: string; school_name?: string | null }
export interface TicketDetail extends Ticket { messages: Array<{ id: number; author_role: string; author_name: string | null; body: string; created_at: string }> }
export interface TicketPage { total: number; page: number; limit: number; items: Ticket[]; counts: Partial<Record<TicketStatus, number>> }
export interface FaqItem { id: number; audience: 'student' | 'teacher' | 'school_admin' | 'all'; category: string; question: string; answer: string; image_url: string | null; video_url: string | null; position?: number; is_published?: boolean }

// ---------------------------------------------------------------------- cấu hình hệ thống
export interface SystemSettings {
  system_name: string; logo_url: string | null; mail_from: string | null; language: string; timezone: string; rate_ip_per_min: number | null; rate_user_per_min: number | null; rate_ai_per_min: number | null;
  backup_enabled: boolean; backup_hour: number; backup_keep: number; updated_at: string;
}
export interface FeatureFlag { key: string; label: string; description: string; enabled: boolean }
export interface MessageTemplate { key: string; label: string; description: string; vars: Array<{ name: string; hint: string }>; subject_editable: boolean; default_subject: string; default_body: string; subject: string; body: string; customized: boolean }
export interface SchoolLimits { school_id: number; school_name: string; students: number; max_students: number | null; ai_enabled: boolean; ai_daily_per_school: number | null; ai_daily_per_school_default: number | null; ai_daily_per_user: number | null; ai_daily_per_user_default: number | null }
export interface RbacMatrix { roles: Role[]; features: Array<{ key: string; position: number; label: string; note: string | null; enforced: boolean; cells: Record<Role, { allowed: boolean; baseline: boolean; editable: boolean }> }> }
export interface Health {
  checked_at: string; server: { started_at: string; uptime_s: number; node: string; memory_mb: number; commit: string | null }; database: { ok: boolean; latency_ms: number; schema_version: number | null };
  mail: { configured: boolean; transport: string; queued: number; sending: number; failed_day: number; oldest_min: number | null }; requests: { total: number; client_errors: number; server_errors: number; rate_limited: number; window_min: number };
  errors: { by_source: Record<string, { hour: number; day: number }>; hour: number; day: number }; jobs: Array<{ job: string; last_run_at: string; last_ok: boolean; last_error: string | null; runs: number; age_min: number }>; active_users_15m: number;
}
export interface BackupItem { id: number; kind: 'manual' | 'auto' | 'pre_restore'; label: string | null; size_bytes: number; table_count: number; row_count: number; schema_version: number; created_at: string; created_by_name?: string | null }

// ---------------------------------------------------------------------- nhật ký
export interface AuditItem { id: number; actor_name: string; actor_role: string; action: string; label: string; target_type: string; target_id: string | null; success: boolean; created_at: string; school_name?: string | null }
export interface LoginItem { id: number; username: string; portal: string; success: boolean; reason: string; ip: string | null; device: string; created_at: string; school_name?: string | null }
export interface ErrorItem { id: number; source: string; message: string; route: string | null; status: number | null; created_at: string; user_name: string | null }
export interface Paged<T> { total: number; page: number; limit: number; items: T[] }

// ---------------------------------------------------------------------- hai lớp
export interface TwoFactorStatus { eligible: boolean; enabled: boolean; method: 'email' | 'totp' | null; pending?: boolean; backup_codes_left: number; has_email: boolean; totp_available: boolean }
export interface TwoFactorChallenge { two_factor: true; method: 'email' | 'totp'; challenge: string; expires_in: number }

// ---------------------------------------------------------------------- khảo sát
export type QType = 'likert5' | 'nps' | 'single' | 'multi' | 'text';
export interface Question { id: string; type: QType; text: string; options?: string[]; required: boolean }
export const QTYPE_TEXT: Record<QType, string> = { likert5: 'Thang 1–5', nps: 'Giới thiệu 0–10', single: 'Chọn một', multi: 'Chọn nhiều', text: 'Ý kiến' };
export interface SurveyTemplate { can_edit?:boolean; id: number; title: string; description: string | null; audience: 'student' | 'teacher' | 'both'; questions: Question[]; is_active: boolean }
export interface Survey {
  id: number; title: string; description: string | null; audience: 'student' | 'teacher' | 'both'; questions: Question[]; class_ids: number[]; status: 'draft' | 'open' | 'closed'; phase: 'draft' | 'scheduled' | 'open' | 'closed';
  opens_at: string | null; closes_at: string | null; targets: number; responses: number; response_rate: number | null; created_at: string;
}
export interface MySurvey { id: number; title: string; description: string | null; questions: number; closes_at: string | null; answered: boolean; phase: string }
export interface SurveyForm { id: number; title: string; description: string | null; questions: Question[]; closes_at: string | null; phase: string; answered: boolean }
export interface SurveyResult {
  survey: { id: number; title: string; audience: string; phase: string }; targets: { total: number; students: number; teachers: number }; responses: { total: number; students: number; teachers: number }; response_rate: number | null; min_text_responses: number;
  questions: Array<{ id: string; type: QType; text: string; n: number; min?: number; max?: number; counts?: number[]; mean?: number | null; agree_percent?: number | null; promoters?: number; passives?: number; detractors?: number; nps?: number | null;
    options?: Array<{ option: string; count: number; percent: number }>; hidden?: boolean; answers?: string[] }>;
}

// ---------------------------------------------------------------------- nghiên cứu
export interface ExperimentGroup { can_edit?:boolean; id: number; name: string; description: string | null; gamification: boolean; ai: boolean; classes: number; students: number }
export interface ExperimentClass { id: number; name: string; grade: number | null; school_name: string; group_id: number | null; group_name: string | null; students: number }
export interface Summary { n: number; mean: number | null; sd: number | null }
export interface Welch { diff: number; t: number | null; df: number | null; p: number | null; cohen_d: number | null }
export interface Comparison {
  period: { from: string | null; to: string | null }; control: { id: number; name: string } | null; metrics: Array<{ key: string; label: string; unit: string }>;
  groups: Array<{ id: number; name: string; gamification: boolean; ai: boolean; is_control: boolean; students: number; metrics: Record<string, Summary>; vs_control: Record<string, Welch | null> | null }>; notes: string[];
}
