/** Browser preview shares the original 3D game landscape; it never changes learning progress. */
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Txt } from '@/components/ui';
import { useReduceMotion } from '@/hooks/use-motion';
import { GameBridge } from '@/game/bridge';
import type { IntroChapter } from '@/lib/roleplay-story';

export const RolePlayWorld: React.FC<{ mood?: IntroChapter['mood']; player?: [number, number]; small?: boolean }> = ({ mood = 'village', small = false }) => {
  const host = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const reduce = useReduceMotion();
  useEffect(() => {
    let cancelled = false; let game: { destroy: () => void } | null = null;
    const bridge = new GameBridge(); bridge.set('game:calm', reduce); setState('loading');
    import('@/game/historical-game').then(({ createHistoricalPreview }) => { if (cancelled || !host.current) return; game = createHistoricalPreview(host.current, mood, bridge); setState('ready'); }).catch(() => { if (!cancelled) setState('failed'); });
    return () => { cancelled = true; game?.destroy(); };
  }, [mood, reduce]);
  return <View style={{ width: '100%', height: small ? 180 : undefined, aspectRatio: small ? undefined : 900 / 480, minHeight: small ? undefined : 260, backgroundColor: '#657260' }} accessibilityLabel="Phong cảnh lịch sử tái hiện bằng sa bàn 3D">
    <div ref={host} style={{ position: 'absolute', inset: 0 }} aria-hidden="true" />
    {state !== 'ready' && <View style={{ position: 'absolute', inset: 0, padding: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: '#243c34' }}><Txt size={15} color="#f0dfbc" center>{state === 'loading' ? 'Đang mở phong cảnh…' : 'Thiết bị chưa mở được phong cảnh 3D. Em vẫn có thể đọc câu chuyện và vào chặng đã mở.'}</Txt></View>}
  </View>;
};
