/** API thi đấu trực tiếp (/api/live, Sprint 8): giáo viên tạo phòng – điều khiển – xem báo cáo; học sinh vào bằng mã PIN, trả lời, xem lại. Kênh thời gian thực nằm ở hooks/use-live-room.ts. */
import { apiBlob, apiRequest } from '@/api/client';
import type { LiveAction, LiveLookup, LiveMatch, LiveMode, LiveOpenRoom, LiveReport, LiveReview, LiveRoomRow, LiveView } from '@/types/live';

const base = '/api/live';

// ---------------------------------------------------------------------- giáo viên
export const createRoom = (token: string, body: { class_id: number; quiz_id: number; mode: LiveMode; title?: string }) => apiRequest<LiveView>(`${base}/rooms`, { token, body });
export const listRooms = (token: string, classId?: number) => apiRequest<LiveRoomRow[]>(`${base}/rooms${classId ? `?class_id=${classId}` : ''}`, { token });
export const hostRoom = (token: string, id: number) => apiRequest<LiveView>(`${base}/rooms/${id}`, { token });
export const roomCommand = (token: string, id: number, action: LiveAction) => apiRequest<LiveView>(`${base}/rooms/${id}/command`, { token, body: { action } });
export const roomReport = (token: string, id: number) => apiRequest<LiveReport>(`${base}/rooms/${id}/report`, { token });
export const exportRoom = (token: string, id: number, format: 'xlsx' | 'pdf') => apiBlob(`${base}/rooms/${id}/export?format=${format}`, token);

// ---------------------------------------------------------------------- học sinh
export const openRooms = (token: string) => apiRequest<LiveOpenRoom[]>(`${base}/open`, { token });
export const myMatches = (token: string) => apiRequest<LiveMatch[]>(`${base}/my`, { token });
export const myReview = (token: string, id: number) => apiRequest<LiveReview>(`${base}/my/${id}`, { token });
export const lookupPin = (token: string, pin: string) => apiRequest<LiveLookup>(`${base}/lookup/${pin}`, { token });
export const joinRoom = (token: string, body: { pin: string; nickname?: string; avatar?: string }) => apiRequest<{ room_id: number; player_id: number; state: LiveView }>(`${base}/join`, { token, body });
export const setProfile = (token: string, id: number, body: { nickname?: string; avatar?: string }) => apiRequest<LiveView>(`${base}/rooms/${id}/profile`, { token, body });
export const answerHttp = (token: string, id: number, body: { q_index: number; answer: unknown }) => apiRequest<{ received: boolean; q_index: number }>(`${base}/rooms/${id}/answer`, { token, body });

/** Đồng bộ lại trạng thái (khi mất kết nối): dùng chung cho giáo viên chủ phòng và học sinh đã vào phòng */
export const roomState = (token: string, id: number) => apiRequest<LiveView>(`${base}/rooms/${id}/state`, { token });
