/** Dữ liệu xác thực tối thiểu cho trang đăng nhập quản trị tổng. */
export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role: 'root_admin' | 'school_admin' | 'teacher' | 'student';
  must_change_password: boolean;
  email?: string | null;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}
