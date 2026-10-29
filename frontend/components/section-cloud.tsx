/**
 * Mép mây nối hai khối: ba dáng lượn, hai hướng, trôi nhẹ khi nằm trong màn hình. Hai kiểu theo React Bits:
 * - Sound Lab (`sound`): bản xuất Breeze chính thức, phát nhẹ khi mây thực sự vào màn hình.
 * - Shape Magic (`material="gold"`): morph SVG theo bộ xuất Shape Magic, vàng be nhạt và ánh bóng di chuyển.
 */
import { useEffect, useId, useRef, useState, type PropsWithChildren } from 'react';
import { Animated, Platform, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';
import { useLoop, useOnScreen } from '@/components/motion';
import { useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { playCloudBreeze } from '@/lib/sfx';
import { cloudMorphTiming } from '@/lib/cloud-morph';

const CRESTS = [
  'M0 80 C0 20 42 18 52 65 C54 -15 102 -15 112 64 C124 9 174 12 180 67 C190 32 220 30 220 80',
  'M0 82 C0 40 25 27 38 66 C32 -12 83 -18 98 62 C110 7 150 10 154 70 C170 15 214 12 220 82',
  'M0 84 C0 3 51 -4 62 65 C75 35 97 33 108 66 C114 -15 165 -15 179 64 C194 29 220 30 220 84',
] as const;

/** Cùng số điểm/đoạn với CRESTS, giữ hai đầu khớp nhau khi các ô mây đổi dáng. */
const MORPH_TARGETS = [
  'M0 80 C0 32 39 27 52 68 C58 -4 104 -6 112 58 C124 20 173 19 180 70 C188 23 220 26 220 80',
  'M0 82 C0 28 26 20 38 70 C35 -3 86 -7 98 58 C112 18 151 23 154 65 C170 4 214 6 220 82',
  'M0 84 C0 13 49 8 62 62 C75 23 99 26 108 69 C118 -3 165 -6 179 60 C194 41 220 36 220 84',
] as const;

/** DOM paths host SVG animation on web; the native path remains a static fallback. */
function MaterialPath({ children, ...props }: PropsWithChildren<{
  d: string;
  transform?: string;
  fill?: string;
  stroke?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  strokeLinecap?: 'round';
}>) {
  return Platform.OS === 'web' ? <path {...props}>{children}</path> : <Path {...props} />;
}

export function SectionCloud({ color, material, sound = false, wide, variant = 0, direction = 'down' }: {
  /** Màu tô của dải mây (thường là màu khối liền kề); bỏ qua khi có `material` */
  color?: string;
  material?: 'gold';
  sound?: boolean;
  wide: boolean;
  variant?: 0 | 1 | 2;
  direction?: 'up' | 'down';
}) {
  const { c } = useTheme();
  const reduce = useReduceMotion();
  const id = `section-cloud-${useId().replace(/:/g, '')}`;
  const [ref, visible] = useOnScreen();
  const motion = useLoop(Platform.OS === 'web' && wide && visible, 12000 + variant * 4000);
  const height = wide ? [72, 80, 64][variant] : [52, 58, 48][variant];
  const tileWidth = [220, 260, 190][variant];
  const scale = `scale(${tileWidth / 220} ${height / 96})`;
  const crest = CRESTS[variant];
  const goldMotion = material === 'gold' && Platform.OS === 'web' && wide && visible && !reduce;
  const morphTiming = cloudMorphTiming(1.2, 3.2 + variant * 0.3);
  const morph = (closed = false) => {
    if (!goldMotion) return null;
    const end = closed ? ' V100 H0 Z' : '';
    const from = `${crest}${end}`;
    const to = `${MORPH_TARGETS[variant]}${end}`;
    return <animate attributeName="d" repeatCount="indefinite" calcMode="spline" {...morphTiming} values={[from, from, to, to, from].join(';')} />;
  };

  // Âm thanh chỉ theo giao điểm thật, không dùng vùng đệm 25% dành cho hiệu ứng hình ảnh.
  const [inViewport, setInViewport] = useState(false);
  const wasOutside = useRef(false);
  useEffect(() => {
    if (!sound || Platform.OS !== 'web' || !ref.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      const inside = entry.isIntersecting && entry.intersectionRatio >= 0.25;
      if (!inside) wasOutside.current = true;
      setInViewport(inside);
    }, { threshold: [0, 0.25] });
    observer.observe(ref.current as unknown as HTMLElement);
    return () => observer.disconnect();
  }, [sound, ref]);
  useEffect(() => {
    if (!sound || !inViewport || !wasOutside.current || reduce) return;
    return playCloudBreeze({ direction, variant });
  }, [inViewport, sound, reduce, direction, variant]);

  return (
    <View
      ref={ref}
      pointerEvents="none"
      accessible={false}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      id={`cloud-${material === 'gold' ? 'shape-magic' : 'sound-lab'}-${direction}-${variant}`}
      testID={`section-cloud-${direction}-${variant}`}
      style={{ width: '100%', height, zIndex: 3, overflow: 'hidden', ...(direction === 'down' ? { marginBottom: -height } : { marginTop: -height }) }}
    >
      <Animated.View testID="section-cloud-motion" style={{ position: 'absolute', top: 0, left: -40, right: -40, height, transform: [{ translateX: motion.interpolate({ inputRange: [0, 1], outputRange: [-14 - variant * 3, 14 + variant * 3] }) }, { scaleY: direction === 'down' ? -1 : 1 }] }}>
        <Svg width="100%" height={height}>
          <Defs>
            <LinearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={c.cloudGoldTip} />
              <Stop offset="1" stopColor={c.cloudGoldBase} />
            </LinearGradient>
            <LinearGradient id={`${id}-shine`} x1="0" y1="0" x2="220" y2="0" gradientUnits="userSpaceOnUse">
              <Stop offset="0.1" stopColor={c.trang} stopOpacity="0" />
              <Stop offset="0.48" stopColor={c.trang} stopOpacity="0.38" />
              <Stop offset="0.7" stopColor={c.trang} stopOpacity="0" />
              {goldMotion ? <animateTransform attributeName="gradientTransform" type="translate" values="-180 0;180 0;-180 0" dur={`${12 + variant * 2}s`} repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" /> : <Stop offset="1" stopColor={c.trang} stopOpacity="0" />}
            </LinearGradient>
            <Pattern id={id} width={tileWidth} height={height} patternUnits="userSpaceOnUse">
              {material === 'gold' ? (
                <G transform={scale}>
                  <MaterialPath d={crest} transform="translate(0 -3)" fill="none" stroke={c.cloudGoldShadow} strokeOpacity={0.14} strokeWidth={6} strokeLinecap="round">{morph()}</MaterialPath>
                  <MaterialPath d={`${crest} V100 H0 Z`} fill={`url(#${id}-g)`}>{morph(true)}</MaterialPath>
                  <MaterialPath d={`${crest} V100 H0 Z`} fill={`url(#${id}-shine)`}>{morph(true)}</MaterialPath>
                  <MaterialPath d={crest} transform="translate(0 6)" fill="none" stroke={c.trang} strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round">{morph()}</MaterialPath>
                  <MaterialPath d={crest} fill="none" stroke={c.cloudGoldEdge} strokeWidth={1.8}>{morph()}</MaterialPath>
                </G>
              ) : (
                <>
                  <Path d={`${crest} V100 H0 Z`} transform={scale} fill={color} />
                  <Path d={crest} transform={scale} fill="none" stroke={c.logoGold} strokeWidth="1" opacity="0.45" />
                </>
              )}
            </Pattern>
          </Defs>
          <Rect width="100%" height={height} fill={`url(#${id})`} />
        </Svg>
      </Animated.View>
    </View>
  );
}
