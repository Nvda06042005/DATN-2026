/**
 * Mép mây nối hai khối: ba dáng lượn, hai hướng, trôi nhẹ khi nằm trong màn hình. Hai kiểu theo React Bits:
 * - Sound Lab (`sound`): bản xuất Breeze chính thức, phát nhẹ khi mây thực sự vào màn hình.
 * - Shape Magic (`material="gold"`): morph SVG theo bộ xuất Shape Magic, vàng be nhạt và ánh bóng di chuyển.
 * Chế độ `pair`: một chỗ nối có cả hai lớp chồng nhau, lớp Sound Lab treo xuống từ khối trên (màu khối trên, có tiếng gió) và lớp Shape Magic mọc lên
 * từ khối dưới (màu khối dưới); giữa hai lớp là dải vàng be bóng, nên mép trên là các múi treo xuống còn mép dưới là các múi tròn mọc lên.
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
  vectorEffect?: 'non-scaling-stroke';
}>) {
  return Platform.OS === 'web' ? <path {...props}>{children}</path> : <Path {...props} />;
}

export function SectionCloud({ color, material, sound = false, pair, rim = false, wide, variant = 0, direction = 'down' }: {
  /** Màu tô của dải mây (thường là màu khối liền kề); bỏ qua khi có `material` */
  color?: string;
  material?: 'gold';
  sound?: boolean;
  /** Hai lớp chồng nhau ở một chỗ nối (cả hai khối phải có nền một màu); bỏ qua `color`, `material`, `direction` */
  pair?: { upper: string; lower: string };
  /** Chỉ cho mây màu (`color`): viền vàng be dày dưới mép mây, dùng khi mây treo lên ảnh phim không có màu phẳng để chồng hai lớp */
  rim?: boolean;
  wide: boolean;
  variant?: 0 | 1 | 2;
  direction?: 'up' | 'down';
}) {
  const { c } = useTheme();
  const reduce = useReduceMotion();
  const id = `section-cloud-${useId().replace(/:/g, '')}`;
  const [ref, visible] = useOnScreen();
  const motion = useLoop(Platform.OS === 'web' && wide && visible, 12000 + variant * 4000);
  const base = wide ? [72, 80, 64][variant] : [52, 58, 48][variant];
  const rimPad = rim ? 8 : 0; // chừa chỗ ở chân mây để viền không bị cắt
  const height = pair ? Math.round(base * 1.2) : base + rimPad;
  const tileWidth = [220, 260, 190][variant];
  const scale = `scale(${tileWidth / 220} ${height / 96})`;
  const solid = rim ? `translate(0 ${rimPad}) ${scale}` : scale;
  const crest = CRESTS[variant];
  const goldMotion = (material === 'gold' || !!pair) && Platform.OS === 'web' && wide && visible && !reduce;
  const morphTiming = cloudMorphTiming(1.2, 3.2 + variant * 0.3);
  const morph = (closed = false, v: 0 | 1 | 2 = variant, end = ' V100 H0 Z') => {
    if (!goldMotion) return null;
    const tail = closed ? end : '';
    const from = `${CRESTS[v]}${tail}`;
    const to = `${MORPH_TARGETS[v]}${tail}`;
    return <animate attributeName="d" repeatCount="indefinite" calcMode="spline" {...morphTiming} values={[from, from, to, to, from].join(';')} />;
  };
  /** Chế độ pair: múi treo xuống (A) dùng dáng của `variant`, múi mọc lên (B) dùng dáng kế tiếp; hai đường cong được nén theo chiều dọc để luôn chừa dải vàng giữa chúng */
  const vA = variant;
  const vB = ((variant + 1) % 3) as 0 | 1 | 2;
  const sx = tileWidth / 220;
  const kk = 0.0045 * height;
  const toA = `translate(0 ${(0.4325 * height).toFixed(2)}) scale(${sx.toFixed(4)} ${(-kk).toFixed(4)})`;
  const toB = `translate(0 ${(0.5675 * height).toFixed(2)}) scale(${sx.toFixed(4)} ${kk.toFixed(4)})`;

  const paired = !!pair; // `pair` là đối tượng mới ở mỗi lần vẽ lại của khối cha, không được đưa thẳng vào mảng phụ thuộc
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
    return playCloudBreeze({ direction: paired ? 'down' : direction, variant });
  }, [inViewport, sound, reduce, direction, variant, paired]);

  return (
    <View
      ref={ref}
      pointerEvents="none"
      accessible={false}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      id={`cloud-${pair ? 'pair' : material === 'gold' ? 'shape-magic' : 'sound-lab'}-${direction}-${variant}`}
      testID={pair ? `section-cloud-pair-${variant}` : `section-cloud-${direction}-${variant}`}
      style={{ width: '100%', height, zIndex: 3, overflow: 'hidden', ...(pair ? { marginTop: -height / 2, marginBottom: -height / 2 } : direction === 'down' ? { marginBottom: -height } : { marginTop: -height }) }}
    >
      <Animated.View testID="section-cloud-motion" style={{ position: 'absolute', top: 0, left: -40, right: -40, height, transform: [{ translateX: motion.interpolate({ inputRange: [0, 1], outputRange: [-14 - variant * 3, 14 + variant * 3] }) }, { scaleY: !pair && direction === 'down' ? -1 : 1 }] }}>
        <Svg width="100%" height={height}>
          <Defs>
            <LinearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={c.cloudGoldTip} />
              <Stop offset="1" stopColor={c.cloudGoldBase} />
            </LinearGradient>
            {pair ? (
              <>
                <LinearGradient id={`${id}-p`} x1="0" y1="0" x2="0" y2={height} gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={c.cloudGoldTip} />
                  <Stop offset="1" stopColor={c.cloudGoldBase} />
                </LinearGradient>
                <LinearGradient id={`${id}-ua`} x1="0" y1="96" x2="0" y2="29" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={pair.upper} stopOpacity="0" />
                  <Stop offset="1" stopColor={pair.upper} stopOpacity="1" />
                </LinearGradient>
                <LinearGradient id={`${id}-lo`} x1="0" y1="96" x2="0" y2="29" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={pair.lower} stopOpacity="0" />
                  <Stop offset="1" stopColor={pair.lower} stopOpacity="1" />
                </LinearGradient>
              </>
            ) : null}
            <LinearGradient id={`${id}-shine`} x1="0" y1="0" x2="220" y2="0" gradientUnits="userSpaceOnUse">
              <Stop offset="0.1" stopColor={c.trang} stopOpacity="0" />
              <Stop offset="0.48" stopColor={c.trang} stopOpacity="0.38" />
              <Stop offset="0.7" stopColor={c.trang} stopOpacity="0" />
              {goldMotion ? <animateTransform attributeName="gradientTransform" type="translate" values="-180 0;180 0;-180 0" dur={`${12 + variant * 2}s`} repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" /> : <Stop offset="1" stopColor={c.trang} stopOpacity="0" />}
            </LinearGradient>
            <Pattern id={id} width={tileWidth} height={height} patternUnits="userSpaceOnUse">
              {pair ? (
                <>
                  <Rect width={tileWidth} height={height} fill={`url(#${id}-p)`} />
                  <Rect width={tileWidth} height={height} fill={`url(#${id}-shine)`} />
                  <G transform={toA}>
                    <MaterialPath d={`${CRESTS[vA]} V400 H0 Z`} fill={`url(#${id}-ua)`}>{morph(true, vA, ' V400 H0 Z')}</MaterialPath>
                    <MaterialPath d={CRESTS[vA]} transform="translate(0 4)" fill="none" stroke={c.cloudGoldShadow} strokeOpacity={0.12} strokeWidth={4} strokeLinecap="round" vectorEffect="non-scaling-stroke">{morph(false, vA)}</MaterialPath>
                    <MaterialPath d={CRESTS[vA]} transform="translate(0 -6)" fill="none" stroke={c.trang} strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke">{morph(false, vA)}</MaterialPath>
                    <MaterialPath d={CRESTS[vA]} fill="none" stroke={c.cloudGoldEdge} strokeWidth={2} vectorEffect="non-scaling-stroke">{morph(false, vA)}</MaterialPath>
                  </G>
                  <G transform={toB}>
                    <MaterialPath d={`${CRESTS[vB]} V100 H0 Z`} fill={`url(#${id}-lo)`}>{morph(true, vB, ' V100 H0 Z')}</MaterialPath>
                    <MaterialPath d={CRESTS[vB]} transform="translate(0 4)" fill="none" stroke={c.cloudGoldShadow} strokeOpacity={0.12} strokeWidth={4} strokeLinecap="round" vectorEffect="non-scaling-stroke">{morph(false, vB)}</MaterialPath>
                    <MaterialPath d={CRESTS[vB]} transform="translate(0 -6)" fill="none" stroke={c.trang} strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke">{morph(false, vB)}</MaterialPath>
                    <MaterialPath d={CRESTS[vB]} fill="none" stroke={c.cloudGoldEdge} strokeWidth={2} vectorEffect="non-scaling-stroke">{morph(false, vB)}</MaterialPath>
                  </G>
                </>
              ) : material === 'gold' ? (
                <G transform={scale}>
                  <MaterialPath d={crest} transform="translate(0 -3)" fill="none" stroke={c.cloudGoldShadow} strokeOpacity={0.14} strokeWidth={6} strokeLinecap="round">{morph()}</MaterialPath>
                  <MaterialPath d={`${crest} V100 H0 Z`} fill={`url(#${id}-g)`}>{morph(true)}</MaterialPath>
                  <MaterialPath d={`${crest} V100 H0 Z`} fill={`url(#${id}-shine)`}>{morph(true)}</MaterialPath>
                  <MaterialPath d={crest} transform="translate(0 6)" fill="none" stroke={c.trang} strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round">{morph()}</MaterialPath>
                  <MaterialPath d={crest} fill="none" stroke={c.cloudGoldEdge} strokeWidth={1.8}>{morph()}</MaterialPath>
                </G>
              ) : (
                <>
                  {rim ? (
                    <>
                      <Path d={crest} transform={solid} fill="none" stroke={c.cloudGoldShadow} strokeOpacity={0.16} strokeWidth={15} vectorEffect="non-scaling-stroke" />
                      <Path d={crest} transform={solid} fill="none" stroke={c.cloudGoldTip} strokeWidth={10} vectorEffect="non-scaling-stroke" />
                    </>
                  ) : null}
                  <Path d={`${crest} V100 H0 Z`} transform={solid} fill={color} />
                  <Path d={crest} transform={solid} fill="none" stroke={rim ? c.cloudGoldEdge : c.logoGold} strokeWidth={rim ? 1.8 : 1} opacity={rim ? 1 : 0.45} vectorEffect={rim ? 'non-scaling-stroke' : undefined} />
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

/** Chỗ nối hai lớp giữa hai khối nền một màu: `upper` là nền khối trên, `lower` là nền khối dưới */
export function CloudPair({ upper, lower, wide, variant = 1, sound = true }: { upper: string; lower: string; wide: boolean; variant?: 0 | 1 | 2; sound?: boolean }) {
  return <SectionCloud pair={{ upper, lower }} sound={sound} wide={wide} variant={variant} />;
}
