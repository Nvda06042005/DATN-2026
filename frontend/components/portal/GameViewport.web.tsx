/**
 * Khung chứa game Phaser trên web. Mỗi GameViewport chỉ tạo đúng MỘT game: Phaser được nạp động khi khung xuất hiện, hủy sạch (canvas, vòng lặp, bộ nghe)
 * khi rời màn hoặc đổi loại màn chơi. Giao diện React nói chuyện với game qua GameBridge theo sự kiện, không cập nhật React theo từng khung hình.
 * Khung giữ đúng tỉ lệ của cảnh; `maxHeight` giới hạn chiều cao bằng cách thu hẹp bề ngang nên không có dải trống hai bên. Bản điện thoại (GameViewport.tsx) không nạp Phaser.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Minus, Plus, RotateCcw } from 'lucide-react-native';
import { Spinner, Txt } from '@/components/ui';
import { useReduceMotion } from '@/hooks/use-motion';
import type { GameBridge, GameKind } from '@/game/bridge';

export interface GameViewportProps { kind: Exclude<GameKind, 'explore'>; bridge: GameBridge; aspect: number; label: string; maxHeight?: number }

export const GameViewport: React.FC<GameViewportProps> = ({ kind, bridge, aspect, label, maxHeight }) => {
  const host = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [renderer, setRenderer] = useState('2d');
  const [retry, setRetry] = useState(0);
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  // giảm chuyển động (cài đặt của hệ điều hành / trình duyệt): cảnh game bỏ rung và chớp màn hình
  useEffect(() => { bridge.set('game:calm', reduce); }, [bridge, reduce]);

  useEffect(() => {
    let cancelled = false;
    let game: { destroy: () => void } | null = null;
    const offRenderer = bridge.on('game:renderer', (value: string) => setRenderer(value));
    const offLost = bridge.on('game:unavailable', () => setState('failed'));
    setState('loading');
    import('@/game').then(({ createGame }) => {
      // rời màn trước khi Phaser tải xong, hoặc hiệu ứng chạy lại (StrictMode): không tạo game thứ hai
      if (cancelled || !host.current) return;
      game = createGame(host.current, kind, bridge);
      setState('ready');
    }).catch(() => { if (!cancelled) setState('failed'); });
    return () => {
      cancelled = true;
      game?.destroy();
      game = null;
      offRenderer(); offLost();
    };
  }, [kind, bridge, retry]);

  return (
    <View accessibilityLabel={label} testID="game-viewport" style={{ width: '100%', maxWidth: maxHeight ? Math.round(maxHeight * aspect) : undefined, aspectRatio: aspect, alignSelf: 'center', borderRadius: 18, overflow: 'hidden', backgroundColor: '#16253f' }}>
      <div ref={host} style={{ position: 'absolute', inset: 0, touchAction: 'none', userSelect: 'none' }} />
      {state === 'ready' && renderer === '3d' && <>
        {width >= 640 && <View pointerEvents="none" style={{ position: 'absolute', top: 12, left: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#1b3029dd', gap: 2 }}>
          <Txt f="bold" size={12} color="#f4dfab">SA BÀN LỊCH SỬ</Txt>
          <Txt size={12} color="#e4e8df">Kéo để đổi góc nhìn · Phong cảnh minh họa</Txt>
        </View>}
        <View style={{ position: 'absolute', right: 12, top: 12, flexDirection: 'row', gap: 5 }}>
          {([{ key: 'out', label: 'Thu nhỏ sa bàn', Icon: Minus }, { key: 'in', label: 'Phóng to sa bàn', Icon: Plus }, { key: 'reset', label: 'Đặt lại góc nhìn', Icon: RotateCcw }] as const).map(({ key, label: text, Icon }) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={text} onPress={() => bridge.emit('game:camera', key)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#1b3029e8', borderWidth: 1, borderColor: '#c5b98a55' }}><Icon size={18} color="#f7e4b4" /></Pressable>)}
        </View>
      </>}
      {state === 'loading' && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}><Spinner label="Đang mở màn chơi…" color="#ffffff" /></View>}
      {state === 'failed' && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Txt f="bold" size={16} color="#ffffff" center>Chưa tải được cảnh chơi. Em có thể mở lại cảnh.</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel="Mở lại cảnh chơi" onPress={() => setRetry(n => n + 1)} style={{ minHeight: 44, padding: 12, marginTop: 12, borderRadius: 10, backgroundColor: '#efd39a' }}><Txt f="bold" color="#263b36">Mở lại cảnh</Txt></Pressable>
        </View>
      )}
    </View>
  );
};
