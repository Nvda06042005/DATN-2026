/** API thi đấu trực tiếp (/api/live, Sprint 8): giáo viên tạo phòng – điều khiển – xem báo cáo; học sinh vào bằng mã PIN, trả lời, xem lại. Kênh thời gian thực nằm ở hooks/use-live-room.ts. */
import { apiBlob, apiRequest } from '@/api/client';
import type { BossOption, LiveAction, LiveLookup, LiveMatch, LiveMode, LiveOpenRoom, LiveReport, LiveReview, LiveRoomRow, LiveView } from '@/types/live';

const base = '/api/live';

// ---------------------------------------------------------------------- giáo viên
export interface RoomOptions { auto_lock_seconds?: number | null; profile_names?: boolean; hide_on_device?: boolean; shuffle_device?: boolean; tab_alert?: boolean; boss?: string }
export const createRoom = (token: string, body: { class_id: number; quiz_id: number; mode: LiveMode; title?: string } & RoomOptions) => apiRequest<LiveView>(`${base}/rooms`, { token, body });
export const listRooms = (token: string, classId?: number) => apiRequest<LiveRoomRow[]>(`${base}/rooms${classId ? `?class_id=${classId}` : ''}`, { token });
export const hostRoom = (token: string, id: number) => apiRequest<LiveView>(`${base}/rooms/${id}`, { token });
export const roomCommand = (token: string, id: number, action: LiveAction) => apiRequest<LiveView>(`${base}/rooms/${id}/command`, { token, body: { action } });
export const bosses = (token: string) => apiRequest<BossOption[]>(`${base}/bosses`, { token });
export const roomSettings = (token: string, id: number, body: Partial<RoomOptions>) => apiRequest<LiveView>(`${base}/rooms/${id}/settings`, { token, method: 'PUT', body });
export const decideRequest = (token: string, id: number, requestId: number, approve: boolean) => apiRequest<LiveView>(`${base}/rooms/${id}/requests/${requestId}`, { token, body: { approve } });
export const kickPlayer = (token: string, id: number, playerId: number) => apiRequest<LiveView>(`${base}/rooms/${id}/kick`, { token, body: { player_id: playerId } });
export const roomReport = (token: string, id: number) => apiRequest<LiveReport>(`${base}/rooms/${id}/report`, { token });
export const exportRoom = (token: string, id: number, format: 'xlsx' | 'pdf') => apiBlob(`${base}/rooms/${id}/export?format=${format}`, token);

// ---------------------------------------------------------------------- học sinh
export const openRooms = (token: string) => apiRequest<LiveOpenRoom[]>(`${base}/open`, { token });
export const myMatches = (token: string) => apiRequest<LiveMatch[]>(`${base}/my`, { token });
export const myReview = (token: string, id: number) => apiRequest<LiveReview>(`${base}/my/${id}`, { token });
export const lookupPin = (token: string, pin: string) => apiRequest<LiveLookup>(`${base}/lookup/${pin}`, { token });
export const requestEntry = (token: string, pin: string) => apiRequest<{ room_id: number; status: 'pending' | 'approved' | 'rejected' }>(`${base}/request`, { token, body: { pin } });
export const blurHttp = (token: string, id: number, qIndex: number) => apiRequest<{ recorded: boolean }>(`${base}/rooms/${id}/blur`, { token, body: { q_index: qIndex } });
export const joinRoom = (token: string, body: { pin: string; nickname?: string; avatar?: string; device_id?: string }) => apiRequest<{ room_id: number; player_id: number; state: LiveView }>(`${base}/join`, { token, body });
export const setProfile = (token: string, id: number, body: { nickname?: string; avatar?: string }) => apiRequest<LiveView>(`${base}/rooms/${id}/profile`, { token, body });
export const answerHttp = (token: string, id: number, body: { q_index: number; answer: unknown }) => apiRequest<{ received: boolean; q_index: number }>(`${base}/rooms/${id}/answer`, { token, body });

/** Đồng bộ lại trạng thái (khi mất kết nối): dùng chung cho giáo viên chủ phòng và học sinh đã vào phòng */
export const roomState = (token: string, id: number) => apiRequest<LiveView>(`${base}/rooms/${id}/state`, { token });
