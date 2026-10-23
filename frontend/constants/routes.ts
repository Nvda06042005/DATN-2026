import type { Portal } from '@/types/authType';

/** Đường dẫn riêng của từng trang */
export const PORTAL_PATH: Record<Portal, string> = { student: 'hoc-sinh', teacher: 'giao-vien', admin: 'admin' };

export const PORTAL_TITLE: Record<Portal, string> = { student: 'Trang học sinh', teacher: 'Trang giáo viên', admin: 'Trang quản trị' };
