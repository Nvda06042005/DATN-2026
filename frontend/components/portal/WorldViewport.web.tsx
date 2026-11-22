/**
 * Khung chứa thế giới khối 3D trên web (21/11/2026). Mỗi khung chỉ tạo đúng MỘT cảnh: three.js nạp động khi khung xuất hiện (import('@/game/world3d')),
 * hủy sạch khi rời màn. Giao diện React nói chuyện với cảnh qua GameBridge theo sự kiện (không cập nhật React theo từng khung hình).
 * Trình duyệt không có WebGL thì hiện thông báo và nút mở lại; bản điện thoại gốc (WorldViewport.tsx) không nạp three.js.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { RotateCcw } from 'lucide-react-native';
import { Spinner, Txt } from '@/components/ui';
import { useReduceMotion } from '@/hooks/use-motion';
import type { GameBridge } from '@/game/bridge';

/** `webUrl`: đúng màn này trên website (ứng dụng điện thoại gốc mở bằng trình duyệt của máy) */
export interface WorldViewportProps { bridge: GameBridge; label: string; height: number; webUrl?: string; children?: React.ReactNode }

export const WorldViewport: React.FC<WorldViewportProps> = ({ bridge, label, height, children }) => {
  const host = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [retry, setRetry] = useState(0);
  const reduce = useReduceMotion();
  useEffect(() => { bridge.set('game:calm', reduce); }, [bridge, reduce]);
  useEffect(() => {
    let cancelled = false;
    let world: { destroy: () => void } | null = null;
    setState('loading');
    import('@/game/world3d').then(({ createWorld }) => {
      if (cancelled || !host.current) return;
      try { world = createWorld(host.current, bridge); setState('ready'); } catch { setState('failed'); }
    }).catch(() => { if (!cancelled) setState('failed'); });
    return () => { cancelled = true; world?.destroy(); world = null; };
  }, [bridge, retry]);
  return (
    <View accessibilityLabel={label} testID="world-viewport" style={{ width: '100%', height, borderRadius: 18, overflow: 'hidden', backgroundColor: '#bcd9e6' }}>
      <div ref={host} style={{ position: 'absolute', inset: 0, touchAction: 'none', userSelect: 'none' }} />
      {state === 'ready' ? children : null}
      {state === 'loading' ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2b4a40' }}><Spinner label="Đang dựng thế giới khối…" color="#ffffff" /></View> : null}
      {state === 'failed' ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12, backgroundColor: '#2b4a40' }}>
          <Txt f="bold" size={16} color="#ffffff" center>Trình duyệt chưa mở được cảnh 3D (cần WebGL).</Txt>
          <Txt size={14} color="#d7e6dc" center>Thử mở lại, cập nhật trình duyệt hoặc dùng máy khác. Các bước học và luyện tập vẫn dùng được.</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel="Mở lại thế giới khối" onPress={() => setRetry((n) => n + 1)} style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <RotateCcw size={18} color="#2b4a40" /><Txt f="bold" size={14} color="#2b4a40">Mở lại</Txt>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};
