/**
 * Kết nối thời gian thực tới phòng thế giới khối của lớp (Socket.IO, đường dẫn /api/live/ws, namespace /world; 21/11/2026).
 * Nhận bạn cùng lớp vào / ra / đi lại / gửi tín hiệu nhanh, khối vừa đặt và ô vừa thu hoạch; gửi vị trí của em (tối đa vài lần mỗi giây) và tín hiệu nhanh có sẵn.
 * Mất kết nối thì tự kết nối lại; trong lúc đó em vẫn chơi một mình được vì mọi lệnh chấm điểm đi qua API HTTP của phiên chơi.
 * Vị trí bạn bè đi thẳng vào cảnh 3D qua GameBridge (không cập nhật React theo từng bước chân); React chỉ giữ danh sách bạn đang chơi.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/api/client';
import type { GameBridge } from '@/game/bridge';
import type { PlacedBlock } from '@/lib/world-map';

type Ack<T> = { ok: true; data: T } | { ok: false; error: string; status: number };
type Player = { id: number; name: string; look: Record<string, unknown>; x: number; z: number; ry: number };
export type BlockChange = { placed: PlacedBlock & { by?: number }; removed: { x: number; z: number } | null };
/** Tín hiệu nhanh có sẵn (máy chủ chỉ nhận đúng các mã này; không có ô chat tự do giữa học sinh) */
export const WORLD_SAY: ReadonlyArray<{ code: string; text: string }> = [
  { code: 'come', text: 'Lại đây!' }, { code: 'need_wood', text: 'Cần thêm gỗ!' }, { code: 'need_bamboo', text: 'Cần thêm tre!' }, { code: 'need_rice', text: 'Cần thêm lúa!' },
  { code: 'wait_tide', text: 'Chờ con nước!' }, { code: 'go', text: 'Đi thôi!' }, { code: 'done', text: 'Xong phần mình rồi!' }, { code: 'thanks', text: 'Cảm ơn bạn!' },
];

export function useWorldRoom(token: string, room: { class_id: number | null; campaign_no: number } | null, bridge: GameBridge,
  on: { block: (c: BlockChange, me: number | null) => void; node: (n: { x: number; z: number; until: number }) => void }) {
  const [connected, setConnected] = useState(false);
  const [mates, setMates] = useState<Array<{ id: number; name: string }>>([]);
  const [said, setSaid] = useState<{ name: string; text: string; at: number } | null>(null);
  const sock = useRef<Socket | null>(null);
  const me = useRef<number | null>(null);
  const handlers = useRef(on);
  handlers.current = on;
  const classId = room?.class_id ?? null, campaignNo = room?.campaign_no ?? 0;

  useEffect(() => {
    if (!classId) return undefined;
    const names = new Map<number, string>();
    const sync = () => setMates([...names].map(([id, name]) => ({ id, name })));
    const s = io(`${API_BASE_URL}/world`, { path: '/api/live/ws', auth: { token }, transports: ['websocket', 'polling'], reconnectionDelay: 1000, reconnectionDelayMax: 6000 });
    sock.current = s;
    s.on('connect', () => {
      s.emit('world:join', { class_id: classId, campaign_no: campaignNo }, (ack: Ack<{ me: number; players: Player[]; nodes: Array<{ x: number; z: number; until: number }> }>) => {
        if (!ack?.ok) { setConnected(false); return; }
        setConnected(true);
        me.current = ack.data.me;
        names.clear();
        for (const p of ack.data.players) names.set(p.id, p.name);
        sync();
        bridge.emit('world:peers', { type: 'snapshot', players: ack.data.players });
        for (const n of ack.data.nodes) handlers.current.node(n);
      });
    });
    s.on('disconnect', () => setConnected(false));
    s.on('world:joined', (p: Player) => { names.set(p.id, p.name); sync(); bridge.emit('world:peers', { type: 'join', ...p }); });
    s.on('world:left', (p: { id: number }) => { names.delete(p.id); sync(); bridge.emit('world:peers', { type: 'leave', id: p.id }); });
    s.on('world:moved', (p: { id: number; x: number; z: number; ry: number }) => bridge.emit('world:peers', { type: 'move', ...p }));
    s.on('world:said', (p: { id: number; code: string }) => {
      const mine = p.id === me.current;
      bridge.emit('world:peers', { type: 'say', id: mine ? -1 : p.id, code: p.code });
      setSaid({ name: mine ? 'Em' : names.get(p.id) ?? 'Bạn cùng lớp', text: WORLD_SAY.find((x) => x.code === p.code)?.text ?? '', at: Date.now() });
    });
    s.on('world:block', (c: BlockChange) => handlers.current.block(c, me.current));
    s.on('world:node', (n: { x: number; z: number; until: number }) => handlers.current.node(n));
    return () => {
      s.emit('world:leave');
      s.close();
      sock.current = null;
      setConnected(false);
      setMates([]);
      bridge.emit('world:peers', { type: 'snapshot', players: [] });
    };
  }, [token, classId, campaignNo, bridge]);

  const move = useCallback((p: { x: number; z: number; ry: number }) => { sock.current?.volatile.emit('world:move', p); }, []);
  const say = useCallback((code: string) => { sock.current?.emit('world:say', { code }); }, []);
  return { connected, mates, said, move, say };
}
