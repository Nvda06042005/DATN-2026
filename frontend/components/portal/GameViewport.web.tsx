/**
 * Khung chứa game Phaser trên web. Mỗi GameViewport chỉ tạo đúng MỘT game: Phaser được nạp động khi khung xuất hiện, hủy sạch (canvas, vòng lặp, bộ nghe)
 * khi rời màn hoặc đổi loại màn chơi. Giao diện React nói chuyện với game qua GameBridge theo sự kiện, không cập nhật React theo từng khung hình.
 * Khung giữ đúng tỉ lệ của cảnh; `maxHeight` giới hạn chiều cao bằng cách thu hẹp bề ngang nên không có dải trống hai bên. Bản điện thoại (GameViewport.tsx) không nạp Phaser.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Spinner, Txt } from '@/components/ui';
import { useReduceMotion } from '@/hooks/use-motion';
import type { GameBridge, GameKind } from '@/game/bridge';

export interface GameViewportProps { kind: GameKind; bridge: GameBridge; aspect: number; label: string; maxHeight?: number }

export const GameViewport: React.FC<GameViewportProps> = ({ kind, bridge, aspect, label, maxHeight }) => {
  const host = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const reduce = useReduceMotion();
  // giảm chuyển động (cài đặt của hệ điều hành / trình duyệt): cảnh game bỏ rung và chớp màn hình
  useEffect(() => { bridge.set('game:calm', reduce); }, [bridge, reduce]);

  useEffect(() => {
    let cancelled = false;
    let game: { destroy: () => void } | null = null;
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
    };
  }, [kind, bridge]);

  return (
    <View accessibilityLabel={label} testID="game-viewport" style={{ width: '100%', maxWidth: maxHeight ? Math.round(maxHeight * aspect) : undefined, aspectRatio: aspect, alignSelf: 'center', borderRadius: 18, overflow: 'hidden', backgroundColor: '#16253f' }}>
      <div ref={host} style={{ position: 'absolute', inset: 0, touchAction: 'none', userSelect: 'none' }} />
      {state === 'loading' && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}><Spinner label="Đang mở màn chơi…" color="#ffffff" /></View>}
      {state === 'failed' && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Txt f="bold" size={16} color="#ffffff" center>Chưa tải được màn chơi. Hãy kiểm tra mạng rồi tải lại trang.</Txt>
        </View>
      )}
    </View>
  );
};
