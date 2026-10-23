import type { LiveSessionSummary } from '@/types/teacherType';
import { API_BASE_URL, apiRequest } from '@/utils/http';

/** WebSocket phòng thi đấu cả lớp (token gửi trong tin nhắn đầu tiên, không đặt trên URL) */
export const LIVE_WS_URL = `${API_BASE_URL.replace(/^http/i, 'ws')}/api/live/ws`;

/** Các trận thi đấu đã lưu của giáo viên (mới nhất trước) */
export const getLiveSessions = (token: string, limit = 5) =>
  apiRequest<LiveSessionSummary[]>(`/api/teacher/live-sessions?limit=${limit}`, { token });
