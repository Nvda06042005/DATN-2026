export type AuthRole = 'admin' | 'teacher' | 'student';

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
}

/** Tài khoản kèm tiến độ học tập (trang quản trị) */
export interface AdminUser extends AuthUser {
  xp?: number | null;
  streak?: number | null;
  lessons_completed?: number | null;
  accuracy?: number | null;
}

export interface AccountCredential {
  user: AuthUser;
  password: string;
}

export interface AdminStats {
  teachers: number;
  students: number;
  admins: number;
  active: number;
  pending_first_login: number;
  classes: string[];
  storage: 'postgres' | 'sqlite';
}

export type Portal = 'admin' | 'teacher' | 'student';

export type Route = Portal | 'home';

/** Phiên đăng nhập server trả về khi đăng nhập hoặc đổi mật khẩu */
export interface AuthSession {
  token: string;
  user: AuthUser;
}

/** Vai trò quản trị viên được cấp tài khoản */
export type ManagedRole = 'teacher' | 'student';

export interface NewAccountInput {
  full_name: string;
  role: ManagedRole;
  class_name: string | null;
  username: string | null;
  password: string | null;
}

export interface BulkAccountInput {
  role: ManagedRole;
  class_name: string | null;
  full_names: string[];
}
