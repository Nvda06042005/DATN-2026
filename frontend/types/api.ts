/** Dữ liệu trao đổi với backend NestJS (/api/...) – Sprint 1 và 2 của danh sách chức năng Hào Khí Đông A */

// ---------------------------------------------------------------------- tài khoản
/** root_admin: quản trị tổng (/admin); school_admin: quản trị một trường (/school-manager-admin) */
export type AuthRole = 'root_admin' | 'school_admin' | 'teacher' | 'student';

/** Trang đăng nhập riêng của từng vai trò (mỗi trang giữ phiên riêng) */
export type Portal = AuthRole;

export type Grade = 6 | 7 | 8 | 9;
export type Gender = 'male' | 'female' | 'other';

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
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  nickname: string | null;
  gender: Gender | null;
  subject: string | null;
  parent_email: string | null;
  lock_reason: string | null;
  locked_at: string | null;
  admin_level: 1 | 2;
  profile_confirmed_at: string | null;
  self_registered: boolean;
}

export type EditableField = 'full_name' | 'email' | 'phone' | 'avatar_url' | 'bio' | 'nickname';

/** Hồ sơ cá nhân (HK.*.009/010): thông tin, trường, năm học, lớp, các trường vai trò được tự sửa */
export interface ProfileData {
  user: AuthUser;
  school: { id: number; school_code: string; name: string; logo_url: string | null; city: string | null } | null;
  school_year: { id: number; label: string } | null;
  classes: Array<{ id: number; class_code: string; name: string; grade: number | null; school_year: string; is_active: boolean; join_code?: string; teachers?: string[] }>;
  editable: EditableField[];
  needs_profile_confirmation: boolean;
}
export type ProfilePatch = Partial<Record<EditableField, string | null>>;

/** Phiên đăng nhập server trả về khi đăng nhập hoặc đổi mật khẩu */
export interface AuthSession {
  token: string;
  user: AuthUser;
}

// ---------------------------------------------------------------------- trường, năm học, khối
export interface SchoolItem {
  id: number;
  school_code: string;
  name: string;
  region: string | null;
  city: string | null;
  address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  users: number;
  admins: number;
  teachers: number;
  students: number;
  classes: number;
}

export interface YearItem {
  id: number;
  school_id: number;
  label: string;
  starts_on: string;
  ends_on: string;
  status: 'planned' | 'active' | 'ended';
  ended_at: string | null;
  classes?: number;
}

export interface SchoolDetail extends Omit<SchoolItem, 'users' | 'admins' | 'teachers' | 'students' | 'classes'> {
  counts: { admins: number; teachers: number; students: number; classes: number };
  admins: Array<{ id: number; username: string; full_name: string; email: string | null; phone: string | null; is_active: boolean; last_login_at: string | null }>;
  current_year: YearItem | null;
}

export interface GradeRow {
  grade: Grade;
  is_active: boolean;
  classes: number;
  students: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------- người dùng
export interface ClassRef { id: number; name: string; school_year: string; grade: number | null }

export interface Account extends AuthUser {
  school_name: string | null;
  classes: ClassRef[];
}

export interface AccountDetail extends AuthUser {
  school_name: string | null;
  classes: Array<ClassRef & { is_active: boolean; relation: 'teacher' | 'student' }>;
  deletable: boolean;
  delete_blocker: string | null;
}

/** Tài khoản vừa tạo / đặt lại mật khẩu: mật khẩu tạm chỉ trả về một lần */
export interface CreatedAccount {
  user: AuthUser;
  temporary_password: string;
  mail: 'queued' | 'no_email' | 'not_configured';
}

export interface CreatedSchool {
  school: SchoolItem;
  admin: AuthUser;
  temporary_password: string;
  mail: 'queued' | 'no_email' | 'not_configured';
}

export interface MemberInput {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  subject?: string | null;
  user_code?: string | null;
  birth_date?: string | null;
  gender?: Gender | null;
  parent_email?: string | null;
  class_id?: number | null;
}

// ---------------------------------------------------------------------- lớp học
export interface ClassItem {
  id: number;
  school_id: number;
  year_id: number | null;
  school_year: string;
  class_code: string;
  name: string;
  grade: number | null;
  is_active: boolean;
  join_code: string | null;
  join_open: boolean;
  expected_size: number | null;
  status: string;
  year_status: 'planned' | 'active' | 'ended' | null;
  teachers: Array<{ id: number; full_name: string }>;
  students: number;
  description?: string | null;
  closed_at?: string | null;
}

export interface ClassDetail extends ClassItem {
  members: Array<{ id: number; full_name: string; user_code: string | null; username: string; birth_date: string | null; gender: Gender | null; is_active: boolean; nickname: string | null }>;
}

export interface ClassEvent { id: number; kind: string; note: string | null; created_at: string; actor_name: string | null; user_name: string | null; teacher_name: string | null }

export interface CloneResult {
  from_year: string;
  to_year: string;
  created: Array<{ id: number; name: string; grade: number; students: number; from_class: string }>;
  skipped: Array<{ class: string; reason: string }>;
}

// ---------------------------------------------------------------------- nhập Excel có xem trước
export interface ImportRow {
  row: number;
  full_name?: string;
  user_code: string | null;
  class_name?: string;
  email?: string | null;
  status: 'ok' | 'error' | 'created' | 'added' | 'exists';
  errors: string[];
  username?: string;
}

export interface ImportResult {
  committed: boolean;
  total: number;
  valid: number;
  errors: number;
  created?: number;
  added?: number;
  year_id?: number | null;
  rows: ImportRow[];
  credentials?: Array<{ row: number; username: string; password: string; full_name: string; email: string | null }>;
}

// ---------------------------------------------------------------------- kho dữ liệu lịch sử
export type HistoryEntity = 'campaign' | 'place' | 'figure' | 'source' | 'term' | 'event' | 'battle';
export type HistoryStatus = 'draft' | 'verified' | 'published';

export interface HistoryField {
  name: string;
  label: string;
  type: 'text' | 'int' | 'num' | 'enum' | 'url' | 'ref' | 'key';
  required?: boolean;
  max?: number;
  min?: number;
  values?: string[];
  ref?: HistoryEntity;
}

export interface HistorySpec {
  entity: HistoryEntity;
  label: string;
  plural: string;
  main: string;
  fields: HistoryField[];
  links: HistoryEntity[];
}

export interface HistoryRecord {
  id: number;
  slug: string;
  status: HistoryStatus;
  status_label: string;
  version_no: number;
  updated_at: string;
  verified_at: string | null;
  published_at: string | null;
  ref_labels: Record<string, string | null>;
  links?: Partial<Record<HistoryEntity, number[]>>;
  link_items?: Partial<Record<HistoryEntity, Array<{ id: number; slug: string; label: string; status: HistoryStatus }>>>;
  [field: string]: unknown;
}

export interface HistoryList {
  entity: HistoryEntity;
  total: number;
  items: HistoryRecord[];
  status_counts: Record<HistoryStatus, number>;
}

export interface HistoryVersion { id: number; version_no: number; action: string; note: string | null; created_at: string; changed_by: string | null; status: HistoryStatus }
export interface HistoryDiff { from: number; to: number; changes: Array<{ field: string; label: string; from: unknown; to: unknown }> }

export interface TimelineEvent { id: number; slug: string; campaign_id: number | null; name: string; year_from: number; date_text: string | null; sort_order: number; status: HistoryStatus; place_name: string | null; battles: number }
export interface TimelineView { campaigns: Array<{ id: number; title: string; year_label: string; status: HistoryStatus; events: TimelineEvent[] }>; unassigned: TimelineEvent[] }

export interface HistoryImportResult {
  committed: boolean;
  total: number;
  created: number;
  updated: number;
  errors: number;
  report: Array<{ entity: HistoryEntity; slug: string; action: 'create' | 'update' | 'error'; message?: string }>;
}
