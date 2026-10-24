import { apiRequest } from '@/api/client';
import type { AccountCredential, AdminStats, AdminUser, AuthUser, ManagedRole, NewAccountInput } from '@/types/api';

export const getUsers = (token: string) => apiRequest<AdminUser[]>('/api/admin/users', { token });

export const getAdminStats = (token: string) => apiRequest<AdminStats>('/api/admin/stats', { token });

/** Cấp một tài khoản; trả về tên đăng nhập và mật khẩu tạm (chỉ hiện một lần) */
export const createUser = (token: string, body: NewAccountInput) => apiRequest<AccountCredential>('/api/admin/users', { token, body });

/** Cấp nhiều tài khoản cùng lúc theo danh sách họ tên */
export const bulkCreateUsers = (token: string, role: ManagedRole, className: string | null, fullNames: string[]) =>
  apiRequest<AccountCredential[]>('/api/admin/users/bulk', { token, body: { role, class_name: className, full_names: fullNames } });

export const setUserActive = (token: string, userId: number, isActive: boolean) =>
  apiRequest<AuthUser>(`/api/admin/users/${userId}`, { method: 'PATCH', token, body: { is_active: isActive } });

export const resetUserPassword = (token: string, userId: number) =>
  apiRequest<AccountCredential>(`/api/admin/users/${userId}/reset-password`, { method: 'POST', token });

export const deleteUser = (token: string, userId: number) => apiRequest<void>(`/api/admin/users/${userId}`, { method: 'DELETE', token });
