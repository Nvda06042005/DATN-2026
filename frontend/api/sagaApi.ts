/** API Hành trình Đông A (/api/saga): bản đồ ba cuộc kháng chiến, chặng học – luyện tập – nhập vai – trận đánh, ôn tập, bộ sưu tập, kho tư liệu; báo cáo lớp và chỉnh bản đồ cho quản trị. */
import { apiRequest } from '@/api/client';
import type {
  ActResult, AdminOverview, AdminStage, Archive, BattleSession, CampaignView, CardAlbum, ClassReport, ExploreSession, LessonView, PracticeSession, ReviewInfo, SagaHome, SagaMapInfo, StageDetail, StageSummary,
} from '@/types/saga';

// ---------------------------------------------------------------------- học sinh
export const home = (token: string) => apiRequest<SagaHome>('/api/saga/home', { token });
export const campaign = (token: string, no: number) => apiRequest<CampaignView>(`/api/saga/campaigns/${no}`, { token });
export const stage = (token: string, id: number) => apiRequest<StageDetail>(`/api/saga/stages/${id}`, { token });
export const lesson = (token: string, id: number) => apiRequest<LessonView>(`/api/saga/stages/${id}/lesson`, { token });
export const completeLesson = (token: string, id: number) => apiRequest<{ done: boolean; first: boolean; xp: number }>(`/api/saga/stages/${id}/lesson/complete`, { token, body: {} });
export const startPractice = (token: string, id: number, restart = false) => apiRequest<PracticeSession>(`/api/saga/stages/${id}/practice`, { token, body: { restart } });
export const startExplore = (token: string, id: number, restart = false) => apiRequest<ExploreSession>(`/api/saga/stages/${id}/explore`, { token, body: { restart } });
export const startBattle = (token: string, id: number, restart = false) => apiRequest<BattleSession>(`/api/saga/stages/${id}/battle`, { token, body: { restart } });
export const summary = (token: string, id: number) => apiRequest<StageSummary>(`/api/saga/stages/${id}/summary`, { token });
export const session = <V = PracticeSession | ExploreSession | BattleSession>(token: string, id: number) => apiRequest<V>(`/api/saga/sessions/${id}`, { token });

/** Mã riêng của mỗi lệnh: gửi lặp (bấm hai lần, mạng chập chờn) thì máy chủ trả lại kết quả cũ, không xử lý lần hai */
export const newActionId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Gửi một lệnh của phiên chơi. Khi mạng lỗi giữa chừng, gửi lại đúng mã lệnh cũ (tối đa 2 lần) để không bao giờ xử lý hai lần cùng một lệnh.
 * Lỗi do máy chủ từ chối (lệnh không hợp lệ, lệch thứ tự) được ném ra ngay cho màn chơi hiển thị.
 */
export async function act<V, O, F>(token: string, sessionId: number, seq: number, action: Record<string, unknown>): Promise<ActResult<V, O, F>> {
  const actionId = newActionId();
  let last: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await apiRequest<ActResult<V, O, F>>(`/api/saga/sessions/${sessionId}/actions`, { token, body: { action_id: actionId, seq, action }, timeoutMs: 30_000 });
    } catch (e) {
      last = e;
      if ((e as { status?: number }).status !== 0) throw e; // máy chủ đã trả lời: không thử lại
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw last;
}

export const review = (token: string) => apiRequest<ReviewInfo>('/api/saga/review', { token });
export const startReview = (token: string, restart = false) => apiRequest<PracticeSession>('/api/saga/review/start', { token, body: { restart } });
export const cards = (token: string) => apiRequest<CardAlbum>('/api/saga/cards', { token });
export const archive = (token: string) => apiRequest<Archive>('/api/saga/archive', { token });

// ---------------------------------------------------------------------- giáo viên, quản trị trường
export const classReport = (token: string, classId: number) => apiRequest<ClassReport>(`/api/saga/teacher/classes/${classId}`, { token });

// ---------------------------------------------------------------------- quản trị tổng
export const adminOverview = (token: string) => apiRequest<AdminOverview>('/api/saga/admin/overview', { token });
export const adminStage = (token: string, id: number) => apiRequest<AdminStage & { content: Record<string, any>; items: Array<Record<string, any>>; versions: Array<{ version: number; status: string; saved_at: string }> }>(`/api/saga/admin/stages/${id}`, { token });
export const adminMoveStage = (token: string, id: number, body: { map_x: number; map_y: number; anchor_x?: number | null; anchor_y?: number | null }) => apiRequest<AdminStage>(`/api/saga/admin/stages/${id}/position`, { token, method: 'PUT', body });
export const adminUpdateStage = (token: string, id: number, body: Record<string, unknown>) => apiRequest<AdminStage>(`/api/saga/admin/stages/${id}`, { token, method: 'PUT', body });
export const adminSetStatus = (token: string, id: number, status: 'draft' | 'reviewed' | 'published', note?: string) => apiRequest<AdminStage>(`/api/saga/admin/stages/${id}/status`, { token, method: 'PATCH', body: { status, note } });
export const adminUpdateItem = (token: string, id: number, body: Record<string, unknown>) => apiRequest<AdminStage>(`/api/saga/admin/items/${id}`, { token, method: 'PUT', body });
export const adminUpdateMap = (token: string, no: number, body: Partial<Pick<SagaMapInfo, 'image_key' | 'image_url' | 'image_w' | 'image_h' | 'credit' | 'credit_url'>>) => apiRequest<SagaMapInfo[]>(`/api/saga/admin/maps/${no}`, { token, method: 'PUT', body });
