/** API AI Tutor "Tiểu Tướng" (/api/ai, Sprint 9): hỏi đáp, giải thích, tóm tắt, nhập vai, lịch sử; công cụ giáo viên; quản trị. */
import { apiBlob, apiRequest, apiUpload, type PickedFile } from '@/api/client';
import type {
  AiConversation, AiDoc, AiMessage, AiReply, AiReport, AiSettingsView, AiStatus, DraftResult, EvalSummary, IndexStatus, LimitsView, LogPage, PlanResult, Playground, SummaryOptions, SyncResult, TestResult, TopicsResult,
} from '@/types/ai';

const base = '/api/ai';
const qs = (q: Record<string, string | number | undefined>): string => {
  const p = Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return p.length ? `?${p.join('&')}` : '';
};

// ---------------------------------------------------------------------- học sinh và giáo viên
export const aiStatus = (token: string) => apiRequest<AiStatus>(`${base}/status`, { token });
export const aiAsk = (token: string, body: { question: string; conversation_id?: number; mode?: string; figure_id?: number }) => apiRequest<AiReply>(`${base}/ask`, { token, body });
export const aiExplain = (token: string, attemptId: number, questionId: number) => apiRequest<AiReply>(`${base}/explain`, { token, body: { attempt_id: attemptId, question_id: questionId } });
export const aiSummarize = (token: string, kind: string, id: number) => apiRequest<AiReply>(`${base}/summarize`, { token, body: { kind, id } });
export const aiSummaryOptions = (token: string) => apiRequest<SummaryOptions>(`${base}/summary/options`, { token });
export const aiFigures = (token: string) => apiRequest<Array<{ id: number; name: string; honorific: string | null; role_text: string | null }>>(`${base}/roleplay/figures`, { token });
export const aiConversations = (token: string) => apiRequest<AiConversation[]>(`${base}/conversations`, { token });
export const aiConversation = (token: string, id: number) => apiRequest<AiConversation & { messages: AiMessage[] }>(`${base}/conversations/${id}`, { token });
export const aiDeleteConversation = (token: string, id: number) => apiRequest<void>(`${base}/conversations/${id}`, { token, method: 'DELETE' });
export const aiReport = (token: string, messageId: number, reason: string) => apiRequest<{ reported: boolean }>(`${base}/messages/${messageId}/report`, { token, body: { reason } });

// ---------------------------------------------------------------------- giáo viên
export const aiQuestionDrafts = (token: string, body: { kind: string; id?: number; text?: string; count?: number }) => apiRequest<DraftResult>(`${base}/teacher/question-drafts`, { token, body });
export const aiLessonPlan = (token: string, body: { journey_id?: number; battle_id?: number; minutes?: number; note?: string }) => apiRequest<PlanResult>(`${base}/teacher/lesson-plan`, { token, body });
export const aiTopics = (token: string, days = 30) => apiRequest<TopicsResult>(`${base}/teacher/topics${qs({ days })}`, { token });

// ---------------------------------------------------------------------- quản trị tổng
export const aiSettings = (token: string) => apiRequest<AiSettingsView>(`${base}/admin/settings`, { token });
export const aiSaveSettings = (token: string, body: Record<string, unknown>) => apiRequest<AiSettingsView>(`${base}/admin/settings`, { token, method: 'PUT', body });
export const aiTest = (token: string) => apiRequest<TestResult>(`${base}/admin/test`, { token, body: {} });
export const aiSources = (token: string) => apiRequest<IndexStatus>(`${base}/admin/sources`, { token });
export const aiReindex = (token: string, force = false) => apiRequest<SyncResult>(`${base}/admin/reindex`, { token, body: { force } });
export const aiUploadDoc = (token: string, file: PickedFile) => apiUpload<{ id: number; title: string; chunks: number }>(`${base}/admin/docs`, file, token);
export const aiAddText = (token: string, title: string, text: string) => apiRequest<{ id: number; title: string; chunks: number }>(`${base}/admin/docs`, { token, body: { title, text } });
export const aiDocStatus = (token: string, id: number, status: AiDoc['status']) => apiRequest<{ id: number; status: string }>(`${base}/admin/docs/${id}`, { token, method: 'PATCH', body: { status } });
export const aiDeleteDoc = (token: string, id: number) => apiRequest<void>(`${base}/admin/docs/${id}`, { token, method: 'DELETE' });
export const aiPlayground = (token: string, question: string) => apiRequest<Playground>(`${base}/admin/playground`, { token, body: { question } });
export const aiLogs = (token: string, q: { school_id?: number; from?: string; to?: string; reported?: boolean; refused?: boolean; page?: number }) =>
  apiRequest<LogPage>(`${base}/admin/logs${qs({ school_id: q.school_id, from: q.from, to: q.to, reported: q.reported ? 'true' : undefined, refused: q.refused ? 'true' : undefined, page: q.page })}`, { token });
export const aiReports = (token: string, status?: string) => apiRequest<AiReport[]>(`${base}/admin/reports${qs({ status })}`, { token });
export const aiUpdateReport = (token: string, id: number, status: string, resolution: string) => apiRequest<{ id: number; status: string }>(`${base}/admin/reports/${id}`, { token, method: 'PATCH', body: { status, resolution } });
export const aiLabel = (token: string, messageId: number, label: 'correct' | 'incorrect' | null, note?: string) => apiRequest<{ id: number }>(`${base}/admin/messages/${messageId}/label`, { token, method: 'PUT', body: { label, note } });
export const aiEval = (token: string) => apiRequest<EvalSummary>(`${base}/admin/eval`, { token });
export const aiEvalExport = (token: string) => apiBlob(`${base}/admin/eval/export`, token);
export const aiLimits = (token: string) => apiRequest<LimitsView>(`${base}/admin/limits`, { token });
export const aiSetLimit = (token: string, schoolId: number, body: { daily_per_user: number | null; daily_per_school: number | null }) => apiRequest<Record<string, unknown>>(`${base}/admin/limits/${schoolId}`, { token, method: 'PUT', body });
