import { apiRequest, apiText, apiUpload, type PickedFile } from '@/api/client';
import type {
  AccountCredential, AdminOverview, AuthUser, ClassRequest, ClassStatus, ImportBatch, ImportResult, ImportRow, IncompleteLog, NewAccountInput, NewSchoolInput,
  OutboxItem, SchoolStat, TrashUser, UserFilters, UsersPage,
} from '@/types/api';

/** Thống kê: quản trị tổng xem toàn hệ thống (lọc được một trường), quản trị trường chỉ thấy trường mình */
export const getOverview = (token: string, schoolId?: number) => apiRequest<AdminOverview>(`/api/admin/overview${schoolId ? `?school_id=${schoolId}` : ''}`, { token });

export const createSchool = (token: string, body: NewSchoolInput) => apiRequest<SchoolStat>('/api/admin/schools', { token, body });

/** Danh sách tài khoản: bộ lọc kết hợp + tìm kiếm tức thời (phân trang) */
export const getUsers = (token: string, f: UserFilters) => {
  const params = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => [k, String(v)]));
  return apiRequest<UsersPage>(`/api/admin/users?${params.toString()}`, { token });
};

/** Cấp một tài khoản (quản trị tổng cấp được quản trị trường); mật khẩu tạm chỉ trả về một lần */
export const createUser = (token: string, body: NewAccountInput) => apiRequest<AccountCredential>('/api/admin/users', { token, body });

export const setUserActive = (token: string, userId: number, isActive: boolean) =>
  apiRequest<AuthUser>(`/api/admin/users/${userId}`, { method: 'PATCH', token, body: { is_active: isActive } });

export const resetUserPassword = (token: string, userId: number) =>
  apiRequest<AccountCredential>(`/api/admin/users/${userId}/reset-password`, { method: 'POST', token });

/** Xóa = chuyển vào thùng rác 45 ngày */
export const trashUser = (token: string, userId: number) => apiRequest<void>(`/api/admin/users/${userId}`, { method: 'DELETE', token });

export const getTrash = (token: string) => apiRequest<TrashUser[]>('/api/admin/trash', { token });

export const restoreUser = (token: string, userId: number) => apiRequest<AuthUser>(`/api/admin/trash/${userId}/restore`, { method: 'POST', token });

export const purgeUser = (token: string, userId: number) => apiRequest<void>(`/api/admin/trash/${userId}`, { method: 'DELETE', token });

/** Nhập file Excel mẫu: kiểm chữ ký, cấp tài khoản dòng đủ thông tin, ghi dòng thiếu, gửi thư (lần nhập lại chỉ gửi dòng vừa bổ sung) */
export const importExcel = (token: string, file: PickedFile) => apiUpload<ImportResult>('/api/admin/import', file, token);

export const getImports = (token: string) => apiRequest<ImportBatch[]>('/api/admin/imports', { token });

export const getImport = (token: string, id: number) => apiRequest<{ id: number; file_name: string; report: ImportRow[]; created_at: string }>(`/api/admin/imports/${id}`, { token });

export const getIncomplete = (token: string) => apiRequest<IncompleteLog[]>('/api/admin/incomplete', { token });

export const getOutbox = (token: string) => apiRequest<{ smtp: boolean; worker: boolean; test_recipient: string | null; items: OutboxItem[] }>('/api/admin/outbox', { token });

/** Quản trị tổng gửi một thư kiểm tra đến địa chỉ người gửi đã cấu hình trên máy chủ. */
export const sendTestMail = (token: string) => apiRequest<{ accepted: boolean; recipient: string }>('/api/admin/outbox/test', { method: 'POST', token });

export const retryOutbox = (token: string) => apiRequest<{ requeued: number }>('/api/admin/outbox/retry', { method: 'POST', token });

/** CSV tài khoản chưa gửi được thư (để phát tay khi chưa cấu hình SMTP) */
export const pendingCredentialsCsv = (token: string, batchId?: number) => apiText(`/api/admin/outbox/credentials.csv${batchId ? `?batch_id=${batchId}` : ''}`, token);

export const getClasses = (token: string, status?: ClassStatus) => apiRequest<ClassRequest[]>(`/api/admin/classes${status ? `?status=${status}` : ''}`, { token });

export const reviewClass = (token: string, id: number, approve: boolean, note: string | null) =>
  apiRequest<{ id: number; status: ClassStatus }>(`/api/admin/classes/${id}/${approve ? 'approve' : 'reject'}`, { token, body: { note } });

export const getUserDetail = (token: string, id: number) => apiRequest<import('@/types/api').UserDetail>(`/api/admin/users/${id}`, { token });
export const assignRole = (token: string, id: number, role: import('@/types/api').AuthRole, schoolId?: number) => apiRequest<AuthUser>(`/api/admin/users/${id}/role`, { token, method: 'PATCH', body: { role, school_id: schoolId } });
export const getSecurityHistory = (token: string, kind: 'login' | 'audit', f: import('@/types/api').SecurityFilters) => {
  const params = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
  return apiRequest<import('@/types/api').SecurityPage>(`/api/admin/${kind === 'login' ? 'login-history' : 'audit-history'}?${params}`, { token });
};
