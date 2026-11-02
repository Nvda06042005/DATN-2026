/**
 * Kết nối thời gian thực tới một phòng thi đấu (Socket.IO, /api/live/ws): nhận trạng thái riêng của mình mỗi khi có thay đổi, gửi lệnh/đáp án có phản hồi.
 * Mất WebSocket thì tự kết nối lại và xin trạng thái mới; trong lúc chưa kết nối được, lệnh và đáp án đi qua API HTTP tương đương và trạng thái được hỏi lại mỗi 4 giây.
 * `skew` là độ lệch giữa đồng hồ máy chủ và máy này để đếm ngược theo giờ máy chủ.
 * Mỗi trình duyệt có một mã thiết bị (lưu cục bộ) gửi kèm khi vào phòng để máy chủ chặn một tài khoản vào từ hai thiết bị (HK.GV.098);
 * `kicked` báo học sinh vừa bị giáo viên loại khỏi phòng; `blur` báo chuyển tab khi đang trả lời (HK.SYS.023).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL, ApiError, errorMessage } from '@/api/client';
import * as api from '@/api/liveApi';
import type { LiveAction, LiveQuestion, LiveView } from '@/types/live';

type Ack<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

/** Mã thiết bị: giữ nguyên khi tải lại trang hoặc mở thêm tab cùng trình duyệt, khác nhau giữa hai thiết bị */
export function liveDeviceId(): string {
  try {
    if (typeof localStorage === 'undefined') return 'native';
    let id = localStorage.getItem('hk_live_device');
    if (!id) { id = `${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`; localStorage.setItem('hk_live_device', id); }
    return id;
  } catch { return 'session'; }
}

export function useLiveRoom(token: string, roomId: number | null, onExpired?: () => void) {
  const [view, setView] = useState<LiveView | null>(null);
  const [connected, setConnected] = useState(false);
  const [answered, setAnswered] = useState<{ count: number; online: number } | null>(null);
  const [skew, setSkew] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);
  const socket = useRef<Socket | null>(null);
  const expired = useRef(onExpired);
  expired.current = onExpired;

  const adopt = useCallback((next: LiveView) => {
    setSkew(next.server_now - Date.now());
    setView(next);
    setAnswered(next.answered);
    setError(null);
  }, []);

  useEffect(() => {
    if (roomId === null) return undefined;
    setView(null);
    setError(null);
    setKicked(false);
    let alive = true;
    api.roomState(token, roomId).then((v) => { if (alive) adopt(v); }).catch((e) => {
      if (!alive) return;
      if (e instanceof ApiError && e.status === 401) expired.current?.();
      setError(errorMessage(e));
    });
    const s = io(API_BASE_URL, { path: '/api/live/ws', auth: { token }, transports: ['websocket', 'polling'], reconnectionDelay: 800, reconnectionDelayMax: 4000 });
    socket.current = s;
    s.on('connect', () => {
      setConnected(true);
      s.emit('room:subscribe', { room_id: roomId, device_id: liveDeviceId() }, (ack: Ack<LiveView>) => { if (alive && ack.ok) adopt(ack.data); else if (alive && !ack.ok) setError(ack.error); });
    });
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', (e) => { setConnected(false); if (/hết hạn|không hợp lệ/.test(e.message)) expired.current?.(); });
    s.on('live:state', (v: LiveView) => { if (alive && v.room.id === roomId) adopt(v); });
    s.on('live:kicked', (k: { room_id: number }) => { if (alive && k.room_id === roomId) { setKicked(true); s.close(); } });
    s.on('live:answered', (a: { room_id: number; count: number; online: number }) => { if (alive && a.room_id === roomId) setAnswered({ count: a.count, online: a.online }); });
    return () => {
      alive = false;
      s.emit('room:leave', { room_id: roomId });
      s.close();
      socket.current = null;
      setConnected(false);
    };
  }, [token, roomId, adopt]);

  // Chưa có WebSocket: hỏi lại trạng thái bằng HTTP để màn hình vẫn chạy
  useEffect(() => {
    if (roomId === null || connected) return undefined;
    const timer = setInterval(() => { api.roomState(token, roomId).then(adopt).catch(() => undefined); }, 4000);
    return () => clearInterval(timer);
  }, [token, roomId, connected, adopt]);

  /** Gửi lệnh có phản hồi qua WebSocket; chưa kết nối hoặc quá 8 giây không phản hồi thì dùng API HTTP */
  const request = useCallback(<T,>(event: string, payload: Record<string, unknown>, fallback: () => Promise<T>): Promise<T> => new Promise<T>((resolve, reject) => {
    const s = socket.current;
    if (!s || !s.connected) { fallback().then(resolve, reject); return; }
    s.timeout(8000).emit(event, { room_id: roomId, ...payload }, (err: Error | null, ack: Ack<T>) => {
      if (err) { fallback().then(resolve, reject); return; }
      if (ack.ok) resolve(ack.data);
      else reject(new ApiError(ack.status, ack.error));
    });
  }), [roomId]);

  const command = useCallback(async (action: LiveAction) => {
    const next = await request<LiveView>('host:command', { action }, () => api.roomCommand(token, roomId!, action));
    if (next?.room) adopt(next);
    return next;
  }, [request, token, roomId, adopt]);

  const answer = useCallback((qIndex: number, value: unknown) => request<{ received: boolean }>('player:answer', { q_index: qIndex, answer: value }, () => api.answerHttp(token, roomId!, { q_index: qIndex, answer: value })), [request, token, roomId]);

  /** Báo giáo viên học sinh vừa rời tab trong lúc đang trả lời (không chặn việc làm bài, lỗi mạng bỏ qua) */
  const blur = useCallback((qIndex: number) => request<{ recorded: boolean }>('player:blur', { q_index: qIndex }, () => api.blurHttp(token, roomId!, qIndex)).catch(() => undefined), [request, token, roomId]);

  const profile = useCallback(async (body: { nickname?: string; avatar?: string }) => {
    const next = await request<LiveView>('player:profile', body, () => api.setProfile(token, roomId!, body));
    if (next?.room) adopt(next);
    return next;
  }, [request, token, roomId, adopt]);

  return { view, connected, answered, skew, error, kicked, command, answer, profile, blur, refresh: () => (roomId === null ? Promise.resolve() : api.roomState(token, roomId).then(adopt)) };
}

/** Thời gian còn lại của câu hỏi (mili giây) theo giờ máy chủ; đứng yên khi giáo viên tạm dừng */
export function useRemaining(question: LiveQuestion | null, skew: number): number {
  const [now, setNow] = useState(Date.now());
  const running = Boolean(question && !question.paused && question.deadline);
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [running, question?.index]);
  if (!question) return 0;
  if (!running) return question.remaining_ms;
  return Math.max(0, (question.deadline as number) - (now + skew));
}
