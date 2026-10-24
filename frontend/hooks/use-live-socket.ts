import { useCallback, useEffect, useRef, useState } from 'react';
import { LIVE_WS_URL } from '@/api/client';
import type { LiveServerMsg, LiveStatus } from '@/types/api';

/**
 * Kết nối WebSocket phòng thi đấu. Token gửi trong tin nhắn đầu tiên (không đặt trên URL để không lộ trong log);
 * mất mạng thì tự nối lại – server gắn lại đúng phòng đang chơi; ping 25 giây/lần để giữ kết nối.
 * Proxy (vd. Render) có thể làm mất mã đóng 4000/4401, nên lý do ngừng nối lại được đọc từ tin nhắn của server.
 */
export const useLiveSocket = (token: string, onMessage: (msg: LiveServerMsg, send: (msg: Record<string, unknown>) => boolean) => void) => {
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const [generation, setGeneration] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const handler = useRef(onMessage);
  useEffect(() => {
    handler.current = onMessage;
  });

  const send = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  useEffect(() => {
    let stopped = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;
    const schedule = () => {
      attempt += 1;
      setStatus('reconnecting');
      retry = setTimeout(connect, Math.min(10_000, 700 * 2 ** Math.min(attempt, 4)));
    };
    const connect = () => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(LIVE_WS_URL);
      } catch {
        schedule();
        return;
      }
      wsRef.current = ws;
      let stopReason: LiveStatus | null = null;
      ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));
      ws.onmessage = (ev) => {
        let msg: LiveServerMsg;
        try {
          msg = JSON.parse(String(ev.data)) as LiveServerMsg;
        } catch {
          return;
        }
        if (msg.type === 'pong') return;
        if (msg.type === 'room' || msg.type === 'state') {
          attempt = 0;
          setStatus('open');
        }
        if (msg.type === 'replaced') stopReason = 'replaced';
        if (msg.type === 'error' && (msg.code === 'auth' || msg.code === 'role')) stopReason = 'expired';
        handler.current(msg, send);
      };
      ws.onclose = (ev) => {
        clearInterval(ping);
        if (wsRef.current === ws) wsRef.current = null;
        if (stopped) return;
        const reason = ev.code === 4000 ? 'replaced' : ev.code === 4401 || ev.code === 4403 ? 'expired' : stopReason;
        if (reason) setStatus(reason);
        else schedule();
      };
      ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('{"type":"ping"}');
      }, 25_000);
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      clearInterval(ping);
      wsRef.current?.close(1000);
      wsRef.current = null;
    };
  }, [token, generation, send]);

  const reconnect = useCallback(() => {
    setStatus('connecting');
    setGeneration((g) => g + 1);
  }, []);
  return { status, send, reconnect };
};
