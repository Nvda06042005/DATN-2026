/** API Hành trình Đông A (/api/saga) của trang học sinh: bản đồ ba cuộc kháng chiến, chặng học – luyện tập – nhập vai – trận đánh, ôn tập, bộ sưu tập, kho tư liệu.
 * Tệp nằm ở lib/ chứ không ở api/: Vercel coi mỗi tệp trong frontend/api/ là một Serverless Function và gói Hobby chỉ cho 12 hàm mỗi lần triển khai;
 * thư mục đó đã đủ 12 tệp nên thêm tệp thứ 13 làm bước triển khai thất bại (16/11/2026) dù bản dựng vẫn xong. */
import { apiRequest } from '@/api/client';
import type {
  ActResult, Archive, BattleSession, CampaignView, CardAlbum, ChestOpen, ExploreSession, LessonView, PracticeSession, ReviewInfo, SagaHome, StageDetail, StageSummary, Wardrobe, WorldBookPage, WorldLook, WorldSession,
} from '@/types/saga';

// ---------------------------------------------------------------------- học sinh
export const home = (token: string) => apiRequest<SagaHome>('/api/saga/home', { token });
export const campaign = (token: string, no: number) => apiRequest<CampaignView>(`/api/saga/campaigns/${no}`, { token });
/** Mở hòm báu trên bản đồ; máy chủ kiểm tra điều kiện và chỉ thưởng một lần */
export const openChest = (token: string, key: string) => apiRequest<ChestOpen>(`/api/saga/chests/${encodeURIComponent(key)}/open`, { token, body: {} });
/** Kho khung ảnh đại diện / danh hiệu và trang bị (null = bỏ) */
export const wardrobe = (token: string) => apiRequest<Wardrobe>('/api/saga/cosmetics', { token });
export const equipLook = (token: string, body: { frame?: string | null; title?: string | null; avatar?: string | null }) => apiRequest<Wardrobe>('/api/saga/cosmetics/equip', { token, body });
export const stage = (token: string, id: number) => apiRequest<StageDetail>(`/api/saga/stages/${id}`, { token });
export const lesson = (token: string, id: number) => apiRequest<LessonView>(`/api/saga/stages/${id}/lesson`, { token });
export const completeLesson = (token: string, id: number) => apiRequest<{ done: boolean; first: boolean; xp: number }>(`/api/saga/stages/${id}/lesson/complete`, { token, body: {} });
export const startPractice = (token: string, id: number, restart = false) => apiRequest<PracticeSession>(`/api/saga/stages/${id}/practice`, { token, body: { restart } });
/** Bắt đầu / tiếp tục bước nhập vai; chặng có nhiệm vụ thế giới khối thì vào phòng chung của lớp `classId` (máy chủ kiểm tra em thuộc lớp) */
export const startExplore = (token: string, id: number, restart = false, classId?: number | null) =>
  apiRequest<ExploreSession | WorldSession>(`/api/saga/stages/${id}/explore`, { token, body: { restart, ...(classId ? { class_id: classId } : {}) } });
/** Tự tạo nhân vật trong thế giới khối */
export const worldLook = (token: string) => apiRequest<{ look: WorldLook & { chosen: boolean }; options: { gender: string[]; robe: string[]; hat: string[]; skin: string[] } }>('/api/saga/world/look', { token });
export const setWorldLook = (token: string, look: WorldLook) => apiRequest<{ look: WorldLook & { chosen: boolean } }>('/api/saga/world/look', { token, body: look });
/** Sổ sử Đông A: sắp xếp sự kiện sau mỗi cuộc kháng chiến (máy chủ chấm, thưởng một lần) */
export const worldBook = (token: string) => apiRequest<{ pages: WorldBookPage[] }>('/api/saga/world/book', { token });
export const submitBook = (token: string, no: number, order: string[]) =>
  apiRequest<{ correct: boolean; positions: number; total: number; first: boolean; xp: number; pages: WorldBookPage[] }>(`/api/saga/world/book/${no}`, { token, body: { order } });
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
