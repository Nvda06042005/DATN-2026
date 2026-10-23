import type { AuthRole } from '@/types/authType';

export const ROLE_LABEL: Record<AuthRole, string> = { admin: 'Quản trị viên', teacher: 'Giáo viên', student: 'Học sinh' };

export const ROLE_CHIP: Record<AuthRole, string> = {
  admin: 'bg-duo-gold-light text-duo-gold-dark',
  teacher: 'bg-duo-purple-light text-kh-purple',
  student: 'bg-duo-green-light text-duo-green-dark',
};
