/** Thành phần dùng chung của phòng thi đấu cả lớp: nền men ngọc, đồng hồ câu hỏi, ô đáp án Kahoot, pháo giấy */
import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { Check } from 'lucide-react-native';
import { KahootShape } from '@/components/art';
import { Txt } from '@/components/ui';
import { ANSWER_STYLES, LIVE_BG } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-motion';
import { sameLiveKey } from '@/lib/format';
import type { LiveKey, LiveQuestion } from '@/types/api';

/** Phạm vi câu hỏi khi mở phòng (khớp SCOPE_CATEGORIES ở backend/src/live/live.hub.ts) */
export const LIVE_SCOPES: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'Cả bài' },
  { id: '1258', label: 'Lần 1 (1258)' },
  { id: '1285', label: 'Lần 2 (1285)' },
  { id: '1288', label: 'Lần 3 (1287–1288)' },
];

export const LIVE_COUNTS = [5, 10, 15] as const;

/** Nền men ngọc của phòng thi đấu với các hình đáp án mờ */
export const LiveBackdrop: React.FC = () => (
  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <LinearGradient colors={LIVE_BG} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    {ANSWER_STYLES.map((s, i) => (
      <View key={s.shape} style={{ position: 'absolute', left: `${6 + i * 24}%`, top: `${i % 2 ? 68 : 8}%`, opacity: 0.1 }}>
        <KahootShape shape={s.shape} size={130} color="#ffffff" />
      </View>
    ))}
  </View>
);

/** Đồng hồ câu hỏi; trình đọc màn hình chỉ được báo ở mốc 10 giây, 5 giây và khi hết giờ */
export const LiveTimer: React.FC<{ seconds: number; total: number; size?: number; light?: boolean }> = ({ seconds, total, size = 96, light = false }) => {
  const ratio = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  const r = 42;
  const circ = 2 * Math.PI * r;
  const urgent = seconds <= 5;
  useEffect(() => {
    if (seconds === 10 || seconds === 5) AccessibilityInfo.announceForAccessibility(`Còn ${seconds} giây`);
    if (seconds === 0 && total > 0) AccessibilityInfo.announceForAccessibility('Hết giờ');
  }, [seconds, total]);
  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="timer" accessibilityLabel={`Còn ${seconds} giây`}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx="50" cy="50" r={r} fill="none" stroke={light ? 'rgba(255,255,255,0.22)' : '#e7d9bc'} strokeWidth="9" />
        <Circle cx="50" cy="50" r={r} fill="none" stroke={urgent ? '#e21b3c' : light ? '#ffffff' : '#0f766e'} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${circ}`} strokeDashoffset={circ * (1 - ratio)} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Txt f="displayHeavy" size={size * 0.36} color={urgent ? '#ff6b81' : light ? '#ffffff' : undefined} style={{ fontVariant: ['tabular-nums'] }}>
          {seconds}
        </Txt>
      </View>
    </View>
  );
};

/** Bốn ô đáp án trên màn hình trình chiếu (chỉ hiển thị – học sinh bấm trên máy của mình) */
export const LiveOptionTiles: React.FC<{ q: LiveQuestion; correctKey?: LiveKey | null }> = ({ q, correctKey = null }) => {
  const { width } = useWindowDimensions();
  const two = width >= 640;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }} accessibilityLabel="Các đáp án">
      {q.options.map((o, i) => {
        const s = ANSWER_STYLES[i % ANSWER_STYLES.length];
        const isRight = correctKey !== null && sameLiveKey(o.key, correctKey);
        const dim = correctKey !== null && !isRight;
        return (
          <View
            key={String(o.key)}
            accessible
            accessibilityLabel={`${o.text}${isRight ? ' (đáp án đúng)' : ''}`}
            style={{
              flexBasis: two ? '48%' : '100%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14,
              backgroundColor: s.bg, borderBottomWidth: 5, borderBottomColor: s.shadow, opacity: dim ? 0.4 : 1,
            }}
          >
            <KahootShape shape={s.shape} size={30} color={s.fg} />
            <Txt f="display" size={19} color={s.fg} style={{ flex: 1 }}>
              {o.text}
            </Txt>
            {isRight && <Check size={30} color={s.fg} strokeWidth={4} />}
          </View>
        );
      })}
    </View>
  );
};

const CONFETTI_COLORS = ['#0f766e', '#0369a1', '#d97706', '#b91c1c', '#7e22ce', '#c2410c', '#ffb6cf'];
const seeded = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** Pháo giấy khi chiến thắng (tắt khi bật "Giảm chuyển động") */
export const Confetti: React.FC<{ count?: number }> = ({ count = 60 }) => {
  const reduce = useReduceMotion();
  const { height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i, left: seeded(i + 1) * 100, delay: seeded(i + 101) * 0.4, speed: 0.55 + seeded(i + 201) * 0.45,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], size: 6 + seeded(i + 301) * 8, round: seeded(i + 401) > 0.6,
      })),
    [count],
  );
  useEffect(() => {
    if (reduce) return;
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' });
    anim.start();
    return () => anim.stop();
  }, [reduce, progress]);
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', zIndex: 50 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((p) => (
        <Animated.View
          key={p.id}
          style={{
            position: 'absolute', top: -20, left: `${p.left}%`, width: p.size, height: p.round ? p.size : p.size * 0.45, borderRadius: p.round ? 99 : 2, backgroundColor: p.color,
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, p.delay, 1], outputRange: [0, 0, (height + 40) / p.speed], extrapolate: 'clamp' }) },
              { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${360 * (1 + p.speed * 2)}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
};
