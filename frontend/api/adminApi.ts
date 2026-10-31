/** API quản trị: quản trị tổng và quản trị trường (/api/admin) và kho dữ liệu lịch sử (/api/admin/history) */
import { apiBlob, apiRequest, apiUpload, type PickedFile } from '@/api/client';
import type {
  Account, AccountDetail, AuthRole, ClassDetail, ClassEvent, ClassItem, CloneResult, CreatedAccount, CreatedSchool, Gender, GradeRow, HistoryDiff, HistoryEntity, HistoryImportResult,
  HistoryList, HistoryRecord, HistorySpec, HistoryStatus, HistoryVersion, ImportResult, MemberInput, Paged, SchoolDetail, SchoolItem, TimelineView, YearItem,
} from '@/types/api';

type Query = Record<string, string | number | boolean | null | undefined>;
const qs = (query: Query = {}) => {
  const parts = Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

// ---------------------------------------------------------------------- trường học (HK.AD.011–017)
export const listSchools = (token: string, query: Query) => apiRequest<Paged<SchoolItem> & { facets: { cities: string[]; regions: string[] } }>(`/api/admin/schools${qs(query)}`, { token });
export const getSchool = (token: string, id: number) => apiRequest<SchoolDetail>(`/api/admin/schools/${id}`, { token });
export const createSchool = (token: string, body: Record<string, unknown>) => apiRequest<CreatedSchool>('/api/admin/schools', { token, body });
export const updateSchool = (token: string, id: number, body: Record<string, unknown>) => apiRequest<SchoolItem>(`/api/admin/schools/${id}`, { token, method: 'PATCH', body });
export const deleteSchool = (token: string, id: number) => apiRequest<void>(`/api/admin/schools/${id}`, { token, method: 'DELETE' });

// ---------------------------------------------------------------------- thông tin trường, năm học, khối (HK.QT.010–013)
export const getMySchool = (token: string, schoolId?: number | null) => apiRequest<SchoolDetail>(`/api/admin/school${qs({ school_id: schoolId })}`, { token });
export const updateMySchool = (token: string, body: Record<string, unknown>, schoolId?: number | null) =>
  apiRequest<SchoolDetail>(`/api/admin/school${qs({ school_id: schoolId })}`, { token, method: 'PATCH', body });
export const listYears = (token: string, schoolId?: number | null) => apiRequest<YearItem[]>(`/api/admin/school-years${qs({ school_id: schoolId })}`, { token });
export const createYear = (token: string, body: { school_id?: number | null; label: string; starts_on: string; ends_on: string }) => apiRequest<YearItem>('/api/admin/school-years', { token, body });
export const updateYear = (token: string, id: number, body: Partial<{ label: string; starts_on: string; ends_on: string }>) => apiRequest<YearItem>(`/api/admin/school-years/${id}`, { token, method: 'PATCH', body });
export const activateYear = (token: string, id: number) => apiRequest<YearItem>(`/api/admin/school-years/${id}/activate`, { token, body: {} });
export const endYear = (token: string, id: number) => apiRequest<YearItem>(`/api/admin/school-years/${id}/end`, { token, body: {} });
export const listGrades = (token: string, yearId: number) => apiRequest<{ year: YearItem; grades: GradeRow[] }>(`/api/admin/school-grades${qs({ year_id: yearId })}`, { token });
export const setGrade = (token: string, body: { year_id: number; grade: number; is_active: boolean }) => apiRequest<unknown>('/api/admin/school-grades', { token, method: 'PUT', body });
export const removeGrade = (token: string, yearId: number, grade: number) => apiRequest<void>(`/api/admin/school-grades${qs({ year_id: yearId, grade })}`, { token, method: 'DELETE' });

// ---------------------------------------------------------------------- người dùng (HK.AD.018–025) và giáo viên, học sinh của trường
export interface AccountQuery extends Query { q?: string; role?: AuthRole; school_id?: number; active?: 'true' | 'false'; grade?: number; class_id?: number; subject?: string; page?: number; limit?: number }
export const listUsers = (token: string, query: AccountQuery) => apiRequest<Paged<Account>>(`/api/admin/users${qs(query)}`, { token });
export const listMembers = (token: string, kind: 'teachers' | 'students', query: AccountQuery) => apiRequest<Paged<Account>>(`/api/admin/${kind}${qs(query)}`, { token });
export const getUser = (token: string, id: number) => apiRequest<AccountDetail>(`/api/admin/users/${id}`, { token });
export const createAdminAccount = (token: string, body: { full_name: string; role: 'root_admin' | 'school_admin'; email: string; phone?: string | null; school_id?: number | null; admin_level?: 1 | 2 }) =>
  apiRequest<CreatedAccount>('/api/admin/users', { token, body });
export const createMember = (token: string, kind: 'teachers' | 'students', body: MemberInput & { school_id?: number | null }) => apiRequest<CreatedAccount>(`/api/admin/${kind}`, { token, body });
export const updateUser = (token: string, id: number, body: Partial<MemberInput> & { school_id?: number | null; birth_date?: string | null; gender?: Gender | null }) =>
  apiRequest<Account>(`/api/admin/users/${id}`, { token, method: 'PATCH', body });
export const changeRole = (token: string, id: number, body: { role: AuthRole; school_id?: number | null; admin_level?: 1 | 2 }) => apiRequest<Account>(`/api/admin/users/${id}/role`, { token, method: 'PATCH', body });
export const lockUser = (token: string, id: number, locked: boolean, reason?: string) => apiRequest<Account>(`/api/admin/users/${id}/lock`, { token, body: { locked, reason } });
export const resetUserPassword = (token: string, id: number) => apiRequest<CreatedAccount>(`/api/admin/users/${id}/reset-password`, { token, body: {} });
export const deleteUser = (token: string, id: number) => apiRequest<void>(`/api/admin/users/${id}`, { token, method: 'DELETE' });

// ---------------------------------------------------------------------- nhập / xuất Excel
export const importMembers = (token: string, kind: 'teachers' | 'students', file: PickedFile, opts: { commit: boolean; year_id?: number | null; school_id?: number | null }) =>
  apiUpload<ImportResult>(`/api/admin/${kind}/import${qs({ commit: opts.commit ? 'true' : undefined, year_id: opts.year_id, school_id: opts.school_id })}`, file, token);
export const importAssignments = (token: string, file: PickedFile, opts: { commit: boolean; year_id: number; school_id?: number | null }) =>
  apiUpload<ImportResult>(`/api/admin/classes/import${qs({ commit: opts.commit ? 'true' : undefined, year_id: opts.year_id, school_id: opts.school_id })}`, file, token);
export const downloadFile = (token: string, path: string) => apiBlob(path, token);

// ---------------------------------------------------------------------- lớp học (HK.QT.022, HK.QT.035–040)
export const listClasses = (token: string, query: Query) => apiRequest<Paged<ClassItem>>(`/api/admin/classes${qs(query)}`, { token });
export const getClass = (token: string, id: number) => apiRequest<ClassDetail>(`/api/admin/classes/${id}`, { token });
export const classEvents = (token: string, id: number) => apiRequest<ClassEvent[]>(`/api/admin/classes/${id}/events`, { token });
export const createClass = (token: string, body: { school_id?: number | null; year_id: number; grade: number; name: string; teacher_ids?: number[]; expected_size?: number | null; description?: string | null }) =>
  apiRequest<ClassItem>('/api/admin/classes', { token, body });
export const updateClass = (token: string, id: number, body: Partial<{ name: string; grade: number; expected_size: number | null; description: string | null; join_open: boolean; teacher_ids: number[] }>) =>
  apiRequest<ClassItem>(`/api/admin/classes/${id}`, { token, method: 'PATCH', body });
export const archiveClass = (token: string, id: number, archived: boolean) => apiRequest<ClassItem>(`/api/admin/classes/${id}/archive`, { token, body: { archived } });
export const regenerateJoinCode = (token: string, id: number) => apiRequest<ClassItem>(`/api/admin/classes/${id}/regenerate-code`, { token, body: {} });
export const deleteClass = (token: string, id: number) => apiRequest<void>(`/api/admin/classes/${id}`, { token, method: 'DELETE' });
export const addClassMembers = (token: string, id: number, studentIds: number[]) => apiRequest<{ added: number; skipped: number }>(`/api/admin/classes/${id}/members`, { token, body: { student_ids: studentIds } });
export const removeClassMember = (token: string, id: number, userId: number) => apiRequest<void>(`/api/admin/classes/${id}/members/${userId}`, { token, method: 'DELETE' });
export const transferStudent = (token: string, body: { student_id: number; from_class_id: number; to_class_id: number }) => apiRequest<{ moved: boolean }>('/api/admin/classes/transfer', { token, body });
export const cloneClasses = (token: string, body: { school_id?: number | null; from_year_id: number; to_year_id: number; class_ids?: number[]; promote?: boolean; copy_teachers?: boolean }) =>
  apiRequest<CloneResult>('/api/admin/classes/clone', { token, body });

// ---------------------------------------------------------------------- kho dữ liệu lịch sử (HK.AD.028–042)
const H = '/api/admin/history';
export const historySpecs = (token: string) => apiRequest<HistorySpec[]>(`${H}/specs`, { token });
export const historyOverview = (token: string) => apiRequest<Record<HistoryEntity, { total: number; draft: number; verified: number; published: number }>>(`${H}/overview`, { token });
export const historyList = (token: string, entity: HistoryEntity, query: Query) => apiRequest<HistoryList>(`${H}/${entity}${qs(query)}`, { token });
export const historyGet = (token: string, entity: HistoryEntity, id: number) => apiRequest<HistoryRecord>(`${H}/${entity}/${id}`, { token });
export const historyCreate = (token: string, entity: HistoryEntity, body: Record<string, unknown>) => apiRequest<HistoryRecord>(`${H}/${entity}`, { token, body });
export const historyUpdate = (token: string, entity: HistoryEntity, id: number, body: Record<string, unknown>) =>
  apiRequest<HistoryRecord & { status_reset: boolean; unchanged: boolean }>(`${H}/${entity}/${id}`, { token, method: 'PATCH', body });
export const historyDelete = (token: string, entity: HistoryEntity, id: number) => apiRequest<void>(`${H}/${entity}/${id}`, { token, method: 'DELETE' });
export const historyStatus = (token: string, entity: HistoryEntity, id: number, status: HistoryStatus, note?: string) => apiRequest<HistoryRecord>(`${H}/${entity}/${id}/status`, { token, body: { status, note } });
export const historyVersions = (token: string, entity: HistoryEntity, id: number) => apiRequest<HistoryVersion[]>(`${H}/${entity}/${id}/versions`, { token });
export const historyDiff = (token: string, entity: HistoryEntity, id: number, from: number, to: number) => apiRequest<HistoryDiff>(`${H}/${entity}/${id}/diff${qs({ from, to })}`, { token });
export const historyRestore = (token: string, entity: HistoryEntity, id: number, version: number) => apiRequest<HistoryRecord>(`${H}/${entity}/${id}/restore`, { token, body: { version } });
export const historyTimeline = (token: string, campaignId?: number) => apiRequest<TimelineView>(`${H}/timeline${qs({ campaign_id: campaignId })}`, { token });
export const historyReorder = (token: string, campaignId: number, eventIds: number[]) => apiRequest<TimelineView>(`${H}/timeline/${campaignId}/order`, { token, method: 'PUT', body: { event_ids: eventIds } });
export const historyImport = (token: string, file: PickedFile, commit: boolean) => apiUpload<HistoryImportResult>(`${H}/import${qs({ commit: commit ? 'true' : undefined })}`, file, token);
