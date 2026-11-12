import type { AuthRole } from '@/types/api';

/** Ba vai trò dùng chung trang đăng nhập; quyền thực tế luôn do máy chủ xác thực. */
export const SCHOOL_ROLES = ['student', 'teacher', 'school_admin'] as const;
export type SchoolRole = (typeof SCHOOL_ROLES)[number];

export const PORTAL_PATH = {
  student: '/hoc-sinh',
  teacher: '/giao-vien',
  school_admin: '/portal?role=school_admin',
  root_admin: '/admin',
} as const satisfies Record<AuthRole, string>;

export function isSchoolRole(value: unknown): value is SchoolRole {
  return SCHOOL_ROLES.some(role => role === value);
}

/** URL chỉ gợi ý ô được chọn, không cấp vai trò hay quyền truy cập. */
export function schoolRoleFromParam(value: string | string[] | undefined): SchoolRole {
  const role = Array.isArray(value) ? value[0] : value;
  return isSchoolRole(role) ? role : 'student';
}
