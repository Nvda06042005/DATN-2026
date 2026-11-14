/** API gợi ý học tập, thống kê và báo cáo (/api/analytics, Sprint 10). */
import { apiBlob, apiRequest } from '@/api/client';
import type {
  AiUsage, ClassDashboard, ClassInfo, ClassTopics, ContentStats, ExamPlans, FeedbackDraft, FeedbackLog, Results, SchoolOverview, Strengths, StudentAiProfile, StudentProfile, SupportList, SystemOverview, Usage,
} from '@/types/analytics';
import type { AttemptState } from '@/types/learning';

const base = '/api/analytics';
export interface Period { from?: string; to?: string }
const qs = (q: Record<string, string | number | undefined>): string => {
  const p = Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return p.length ? `?${p.join('&')}` : '';
};

// ---------------------------------------------------------------------- học sinh
export const strengths = (token: string) => apiRequest<Strengths>(`${base}/me/strengths`, { token });
export const meProfile = (token: string) => apiRequest<StudentAiProfile>(`${base}/me/profile`, { token });
export const personalPractice = (token: string, topic?: { type: string; id: number }) => apiRequest<AttemptState>(`${base}/me/practice`, { token, body: topic ? { topic_type: topic.type, topic_id: topic.id } : {} });
export const examPlan = (token: string) => apiRequest<ExamPlans>(`${base}/me/exam-plan`, { token });

// ---------------------------------------------------------------------- giáo viên và quản trị trường
export const classes = (token: string) => apiRequest<ClassInfo[]>(`${base}/classes`, { token });
export const dashboard = (token: string, id: number, p: Period & { days?: number } = {}) => apiRequest<ClassDashboard>(`${base}/classes/${id}/dashboard${qs({ ...p })}`, { token });
export const classTopics = (token: string, id: number, p: Period = {}) => apiRequest<ClassTopics>(`${base}/classes/${id}/topics${qs({ ...p })}`, { token });
export const support = (token: string, id: number) => apiRequest<SupportList>(`${base}/classes/${id}/support`, { token });
export const results = (token: string, by: 'class' | 'grade' | 'teacher', p: Period = {}) => apiRequest<Results>(`${base}/results${qs({ by, ...p })}`, { token });
export const studentProfile = (token: string, id: number) => apiRequest<StudentProfile>(`${base}/students/${id}`, { token });
export const feedbackDraft = (token: string, id: number) => apiRequest<FeedbackDraft>(`${base}/students/${id}/feedback-draft`, { token });
export const feedbackHistory = (token: string, id: number) => apiRequest<FeedbackLog[]>(`${base}/students/${id}/feedback`, { token });
export const sendFeedback = (token: string, id: number, body: { subject: string; body: string; to: Array<'student'> }) => apiRequest<{ queued: number; recipients: string[] }>(`${base}/students/${id}/feedback`, { token, body });
export const exportClass = (token: string, id: number, format: 'xlsx' | 'pdf', p: Period = {}) => apiBlob(`${base}/classes/${id}/export${qs({ format, ...p })}`, token);
export const exportResults = (token: string, by: 'class' | 'grade' | 'teacher', format: 'xlsx' | 'pdf', p: Period = {}) => apiBlob(`${base}/export${qs({ by, format, ...p })}`, token);

// ---------------------------------------------------------------------- quản trị trường và quản trị tổng
export const schoolOverview = (token: string) => apiRequest<SchoolOverview>(`${base}/school/overview`, { token });
export const usage = (token: string, granularity: 'day' | 'week' | 'month', days?: number) => apiRequest<Usage>(`${base}/usage${qs({ granularity, days })}`, { token });
export const aiUsage = (token: string, days = 30) => apiRequest<AiUsage>(`${base}/ai${qs({ days })}`, { token });
/** Báo cáo sử dụng và trợ lý AI (Excel / PDF theo bố cục chính thức), 7 / 30 / 90 ngày gần nhất */
export const exportUsage = (token: string, days: number, format: 'xlsx' | 'pdf') => apiBlob(`${base}/usage/export${qs({ days, format })}`, token);
export const systemOverview = (token: string) => apiRequest<SystemOverview>(`${base}/system/overview`, { token });
export const systemContent = (token: string) => apiRequest<ContentStats>(`${base}/system/content`, { token });
