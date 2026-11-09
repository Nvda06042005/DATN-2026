/** API nền tảng (/api/platform, Sprint 11–12): thông báo, hỗ trợ, hướng dẫn, cấu hình hệ thống, nhật ký, sao lưu, hai lớp, khảo sát và nghiên cứu. */
import { apiBlob, apiRequest } from '@/api/client';
import type {
  BackupItem, Broadcast, BroadcastInput, Comparison, ErrorItem, ExperimentClass, ExperimentGroup, FaqItem, FeatureFlag, Health, AuditItem, LoginItem, MessageTemplate, MySurvey, NoticeList, Paged, PlatformConfig, Prefs,
  RbacMatrix, SchoolLimits, Survey, SurveyForm, SurveyResult, SurveyTemplate, SystemSettings, TicketDetail, TicketPage, Ticket, TwoFactorStatus,
} from '@/types/platform';

const base = '/api/platform';
const qs = (q: Record<string, string | number | boolean | undefined | null>): string => {
  const p = Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return p.length ? `?${p.join('&')}` : '';
};

// ---------------------------------------------------------------------- mọi vai trò
export const config = (token: string) => apiRequest<PlatformConfig>(`${base}/config`, { token });
export const prefs = (token: string) => apiRequest<Prefs>(`${base}/prefs`, { token });
export const savePrefs = (token: string, body: Partial<Prefs>) => apiRequest<Prefs>(`${base}/prefs`, { token, method: 'PUT', body });
export const notices = (token: string, q: { category?: string; unread?: boolean } = {}) => apiRequest<NoticeList>(`${base}/notices${qs({ category: q.category, unread: q.unread ? 'true' : undefined })}`, { token });
export const readNotices = (token: string, ids?: number[]) => apiRequest<{ marked: number }>(`${base}/notices/read`, { token, body: { ids } });
export const deleteNotices = (token: string, ids?: number[]) => apiRequest<{ deleted: number }>(`${base}/notices/delete`, { token, body: { ids } });
export const faq = (token: string) => apiRequest<{ audience: string; items: FaqItem[] }>(`${base}/faq`, { token });
export const createTicket = (token: string, body: { category: string; subject: string; body: string; page?: string; attachment?: { name: string; data: string } | null }) => apiRequest<TicketDetail>(`${base}/support`, { token, body });
export const myTickets = (token: string) => apiRequest<Ticket[]>(`${base}/support/mine`, { token });
export const ticket = (token: string, id: number) => apiRequest<TicketDetail>(`${base}/support/${id}`, { token });
export const replyTicket = (token: string, id: number, text: string) => apiRequest<TicketDetail>(`${base}/support/${id}/reply`, { token, body: { body: text } });
export const ticketImage = (token: string, id: number) => apiBlob(`${base}/support/${id}/attachment`, token);

// ---------------------------------------------------------------------- gửi thông báo (giáo viên, quản trị trường, quản trị tổng)
export const broadcasts = (token: string) => apiRequest<Broadcast[]>(`${base}/broadcasts`, { token });
export const createBroadcast = (token: string, body: BroadcastInput) => apiRequest<Broadcast>(`${base}/broadcasts`, { token, body });
export const previewBroadcast = (token: string, body: Partial<BroadcastInput>) => apiRequest<{ recipients: number }>(`${base}/broadcasts/preview`, { token, body });
export const updateBroadcast = (token: string, id: number, body: Partial<BroadcastInput>) => apiRequest<Broadcast>(`${base}/broadcasts/${id}`, { token, method: 'PUT', body });
export const deleteBroadcast = (token: string, id: number) => apiRequest<{ deleted: boolean; recalled: boolean; recipients: number }>(`${base}/broadcasts/${id}`, { token, method: 'DELETE' });

// ---------------------------------------------------------------------- quản trị tổng
export const settings = (token: string) => apiRequest<SystemSettings>(`${base}/settings`, { token });
export const saveSettings = (token: string, body: Record<string, unknown>) => apiRequest<SystemSettings>(`${base}/settings`, { token, method: 'PUT', body });
export const flags = (token: string) => apiRequest<FeatureFlag[]>(`${base}/flags`, { token });
export const setFlag = (token: string, key: string, enabled: boolean) => apiRequest<FeatureFlag>(`${base}/flags/${key}`, { token, method: 'PUT', body: { enabled } });
export const templates = (token: string) => apiRequest<MessageTemplate[]>(`${base}/templates`, { token });
export const saveTemplate = (token: string, key: string, body: { subject?: string; body: string }) => apiRequest<MessageTemplate>(`${base}/templates/${key}`, { token, method: 'PUT', body });
export const resetTemplate = (token: string, key: string) => apiRequest<MessageTemplate>(`${base}/templates/${key}`, { token, method: 'DELETE' });
export const schoolLimits = (token: string, id: number) => apiRequest<SchoolLimits>(`${base}/schools/${id}/limits`, { token });
export const saveSchoolLimits = (token: string, id: number, body: Record<string, unknown>) => apiRequest<SchoolLimits>(`${base}/schools/${id}/limits`, { token, method: 'PUT', body });
export const rbac = (token: string) => apiRequest<RbacMatrix>(`${base}/rbac`, { token });
export const saveRbac = (token: string, changes: Array<{ feature_key: string; role: string; allowed: boolean }>) => apiRequest<RbacMatrix>(`${base}/rbac`, { token, method: 'PUT', body: { changes } });
export const health = (token: string) => apiRequest<Health>(`${base}/health`, { token });
export const backups = (token: string) => apiRequest<{ items: BackupItem[]; total_bytes: number; note: string }>(`${base}/backups`, { token });
export const createBackup = (token: string, label?: string) => apiRequest<BackupItem>(`${base}/backups`, { token, body: { label } });
export const downloadBackup = (token: string, id: number) => apiBlob(`${base}/backups/${id}/download`, token);
export const deleteBackup = (token: string, id: number) => apiRequest<{ deleted: boolean }>(`${base}/backups/${id}`, { token, method: 'DELETE' });
export const restoreBackup = (token: string, id: number, confirm: string) => apiRequest<{ restored: boolean; tables: number; rows: number; safety_backup_id: number; note: string }>(`${base}/backups/${id}/restore`, { token, body: { confirm } });
export const faqAll = (token: string) => apiRequest<FaqItem[]>(`${base}/faq/all`, { token });
export const saveFaq = (token: string, id: number | null, body: Partial<FaqItem>) => (id ? apiRequest<FaqItem>(`${base}/faq/${id}`, { token, method: 'PUT', body }) : apiRequest<FaqItem>(`${base}/faq`, { token, body }));
export const deleteFaq = (token: string, id: number) => apiRequest<{ deleted: boolean }>(`${base}/faq/${id}`, { token, method: 'DELETE' });
export const allTickets = (token: string, q: { status?: string; role?: string; q?: string; page?: number; limit?: number }) => apiRequest<TicketPage>(`${base}/support${qs(q)}`, { token });
export const setTicketStatus = (token: string, id: number, status: string) => apiRequest<TicketDetail>(`${base}/support/${id}/status`, { token, method: 'PATCH', body: { status } });

// ---------------------------------------------------------------------- nhật ký
export const auditLog = (token: string, q: { q?: string; success?: string; students?: string; page?: number; limit?: number }) => apiRequest<Paged<AuditItem>>(`${base}/logs/audit${qs(q)}`, { token });
export const loginLog = (token: string, q: { q?: string; success?: string; page?: number; limit?: number }) => apiRequest<Paged<LoginItem>>(`${base}/logs/logins${qs(q)}`, { token });
export const errorLog = (token: string, q: { source?: string; q?: string; page?: number; limit?: number }) => apiRequest<Paged<ErrorItem> & { last_24h: Record<string, number> }>(`${base}/logs/errors${qs(q)}`, { token });
export const clearErrors = (token: string, days: number) => apiRequest<{ deleted: number }>(`${base}/logs/errors${qs({ older_than_days: days })}`, { token, method: 'DELETE' });

// ---------------------------------------------------------------------- hai lớp
export const twoFactor = (token: string) => apiRequest<TwoFactorStatus>(`${base}/2fa`, { token });
export const twoFactorSetup = (token: string, method: 'email' | 'totp') => apiRequest<{ method: string; secret?: string; otpauth_uri?: string; qr?: string; sent_to?: string }>(`${base}/2fa/setup`, { token, body: { method } });
export const twoFactorEnable = (token: string, code: string) => apiRequest<{ enabled: boolean; backup_codes: string[] }>(`${base}/2fa/enable`, { token, body: { code } });
export const twoFactorDisable = (token: string, password: string, code: string) => apiRequest<{ enabled: boolean }>(`${base}/2fa/disable`, { token, body: { password, code } });
export const twoFactorBackup = (token: string, code: string) => apiRequest<{ backup_codes: string[] }>(`${base}/2fa/backup-codes`, { token, body: { code } });

// ---------------------------------------------------------------------- khảo sát
export const mySurveys = (token: string) => apiRequest<MySurvey[]>(`${base}/surveys/mine`, { token });
export const surveyForm = (token: string, id: number) => apiRequest<SurveyForm>(`${base}/surveys/mine/${id}`, { token });
export const respondSurvey = (token: string, id: number, answers: Record<string, unknown>) => apiRequest<{ submitted: boolean }>(`${base}/surveys/${id}/respond`, { token, body: { answers } });
export const surveys = (token: string) => apiRequest<Survey[]>(`${base}/surveys`, { token });
export const createSurvey = (token: string, body: Record<string, unknown>) => apiRequest<Survey>(`${base}/surveys`, { token, body });
export const updateSurvey = (token: string, id: number, body: Record<string, unknown>) => apiRequest<Survey>(`${base}/surveys/${id}`, { token, method: 'PUT', body });
export const deleteSurvey = (token: string, id: number) => apiRequest<{ deleted: boolean }>(`${base}/surveys/${id}`, { token, method: 'DELETE' });
export const surveyResults = (token: string, id: number) => apiRequest<SurveyResult>(`${base}/surveys/${id}/results`, { token });
export const exportSurvey = (token: string, id: number, format: 'xlsx' | 'csv') => apiBlob(`${base}/surveys/${id}/export${qs({ format })}`, token);
export const surveyTemplates = (token: string) => apiRequest<SurveyTemplate[]>(`${base}/survey-templates`, { token });
export const saveSurveyTemplate = (token: string, id: number | null, body: Record<string, unknown>) => (id ? apiRequest<SurveyTemplate>(`${base}/survey-templates/${id}`, { token, method: 'PUT', body }) : apiRequest<SurveyTemplate>(`${base}/survey-templates`, { token, body }));
export const deleteSurveyTemplate = (token: string, id: number) => apiRequest<{ deleted: boolean }>(`${base}/survey-templates/${id}`, { token, method: 'DELETE' });

// ---------------------------------------------------------------------- nghiên cứu
export const experimentGroups = (token: string) => apiRequest<ExperimentGroup[]>(`${base}/experiments/groups`, { token });
export const saveExperimentGroup = (token: string, id: number | null, body: Record<string, unknown>) => (id ? apiRequest<ExperimentGroup>(`${base}/experiments/groups/${id}`, { token, method: 'PUT', body }) : apiRequest<ExperimentGroup>(`${base}/experiments/groups`, { token, body }));
export const deleteExperimentGroup = (token: string, id: number) => apiRequest<{ deleted: boolean }>(`${base}/experiments/groups/${id}`, { token, method: 'DELETE' });
export const experimentClasses = (token: string) => apiRequest<ExperimentClass[]>(`${base}/experiments/classes`, { token });
export const assignClass = (token: string, classId: number, groupId: number | null) => apiRequest<{ class_id: number; group_id: number | null }>(`${base}/experiments/classes/${classId}`, { token, method: 'PUT', body: { group_id: groupId } });
export const researchDictionary = (token: string) => apiRequest<Array<{ column: string; meaning: string }>>(`${base}/research/dictionary`, { token });
export const researchCompare = (token: string, q: { from?: string; to?: string; control?: number }) => apiRequest<Comparison>(`${base}/research/compare${qs(q)}`, { token });
export const researchExport = (token: string, q: { from?: string; to?: string; group_id?: number }) => apiBlob(`${base}/research/export${qs(q)}`, token);
