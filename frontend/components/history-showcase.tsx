/** Cảnh khám phá lịch sử: tiêu đề → khung phủ mây mờ → mây tan dần để lộ nội dung, điều khiển bằng cuộn/kéo. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, StyleSheet, View, useWindowDimensions, type ViewInstance, type ViewStyle } from 'react-native';
import { useScrollY } from '@/components/motion';
import { Txt } from '@/components/ui';
import { useDragScroll } from '@/hooks/use-drag-scroll';
import { useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';

/** Làm mờ viền (chỉ web, cảnh ghim cũng chỉ chạy trên web) */
const blur = (px: number) => ({ filter: `blur(${px}px)` }) as unknown as ViewStyle;
const BACKDROP_BLUR = { backdropFilter: 'blur(12px)' } as unknown as ViewStyle;
/** Đám mây là lớp riêng của trình duyệt: chỉ trượt và mờ dần, không vẽ lại phần làm mờ mỗi khung hình */
const LAYER = { willChange: 'transform, opacity' } as unknown as ViewStyle;

/** Các đám mây phủ màn hình: x, y là % khung màn, w là tỉ lệ so với bề rộng khung, dir là hướng trôi khi tan, depth là độ chênh tốc độ giữa các lớp, warm là mây ám vàng ở lớp sau */
const MIST: Array<{ x: number; y: number; w: number; dir: -1 | 1; depth: number; warm: boolean }> = [
  { x: 4, y: 26, w: 0.74, dir: -1, depth: 0.8, warm: true },
  { x: 30, y: 44, w: 0.7, dir: 1, depth: 0.75, warm: true },
  { x: -12, y: 4, w: 0.5, dir: -1, depth: 1.2, warm: false },
  { x: 54, y: 0, w: 0.46, dir: 1, depth: 0.95, warm: false },
  { x: -8, y: 44, w: 0.5, dir: -1, depth: 1.1, warm: false },
  { x: 52, y: 38, w: 0.52, dir: 1, depth: 1.25, warm: false },
  { x: 14, y: 64, w: 0.48, dir: -1, depth: 0.9, warm: false },
  { x: 46, y: 66, w: 0.44, dir: 1, depth: 1, warm: false },
];

/** Một đám mây: các hình tròn chồng nhau rồi làm mờ viền */
function Puff({ w, color }: { w: number; color: string }) {
  const h = w * 0.5;
  const ball = (left: number, top: number, d: number) => (
    <View style={{ position: 'absolute', left, top, width: d, height: d, borderRadius: d / 2, backgroundColor: color }} />
  );
  return (
    <View style={[{ width: w, height: h }, blur(Math.max(5, Math.round(w * 0.022)))]}>
      {ball(0, h * 0.3, h * 0.7)}
      {ball(w * 0.2, 0, h * 0.95)}
      {ball(w * 0.5, h * 0.15, h * 0.85)}
      {ball(w * 0.68, h * 0.4, h * 0.6)}
      <View style={{ position: 'absolute', left: w * 0.05, top: h * 0.5, width: w * 0.9, height: h * 0.5, borderRadius: h * 0.25, backgroundColor: color }} />
    </View>
  );
}

/**
 * Lớp sương mù phủ màn hình trong khung: lúc đầu màn hình chỉ là mây trắng trên nền giấy, rồi khi cuộn tới cuối, lớp mờ nhạt dần và
 * mây trôi ra hai bên (lớp trước nhanh hơn lớp sau) để lộ nội dung. Chỉ dùng transform và opacity nên không giật khi cuộn.
 */
function MistLayer({ progress, u }: { progress: Animated.Value; u: number }) {
  const { c } = useTheme();
  const clamp = { extrapolate: 'clamp' } as const;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.logoPaper }, BACKDROP_BLUR, { opacity: progress.interpolate({ inputRange: [0, 0.5, 0.78], outputRange: [1, 1, 0], ...clamp }) }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.logoGold, opacity: 0.3 }]} />
      </Animated.View>
      {MIST.map((m, i) => (
        <Animated.View
          key={i}
          style={[{
            position: 'absolute',
            left: `${m.x}%`,
            top: `${m.y}%`,
            opacity: progress.interpolate({ inputRange: [0, 0.52, 0.64, 0.84], outputRange: [1, 1, 0.92, 0], ...clamp }),
            transform: [{ translateX: progress.interpolate({ inputRange: [0, 0.5, 0.84], outputRange: [-m.dir * u * 0.1, 0, m.dir * u * 0.9 * m.depth], ...clamp }) }],
          }, LAYER]}
        >
          <View style={{ opacity: m.warm ? 0.4 : 0.96 }}>
            <Puff w={u * m.w} color={m.warm ? c.logoGold : c.trang} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

export function HistoryShowcase({ wide, onSection, tabs, description, children }: {
  wide: boolean;
  onSection: (id: string, y: number) => void;
  tabs: (interactive: boolean, compact: boolean) => ReactNode;
  description: ReactNode;
  children: ReactNode;
}) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const reduce = useReduceMotion();
  const scrollY = useScrollY();
  const section = useRef<ViewInstance>(null);
  const stage = useRef<ViewInstance>(null);
  const progress = useRef(new Animated.Value(1)).current;
  const enter = useRef(new Animated.Value(1)).current;
  const [interactive, setInteractive] = useState(true);
  const pin = Platform.OS === 'web' && wide && !reduce && height >= 680;
  const travel = height * 1.4;
  const compact = pin && height < 800;
  const tabletWidth = Math.min(780, width - 64, Math.max(260, Math.min(560, height - 420)) * 4 / 3);
  const clamp = { extrapolate: 'clamp' } as const;
  useDragScroll(stage, pin);

  useEffect(() => {
    if (!pin) { progress.setValue(1); enter.setValue(1); setInteractive(true); return undefined; }
    const el = section.current as unknown as HTMLElement | null;
    if (!el) return undefined;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, -r.top / travel));
      progress.setValue(p);
      enter.setValue(Math.max(0, Math.min(1, (height * 0.85 - r.top) / (height * 0.35))));
      setInteractive(p >= 0.78);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
    const id = scrollY?.addListener(schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    measure();
    return () => {
      if (id) scrollY?.removeListener(id);
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [pin, height, travel, scrollY, progress, enter]);

  const titleFx = pin ? {
    opacity: enter,
    transform: [
      { translateY: Animated.add(enter.interpolate({ inputRange: [0, 1], outputRange: [70, 0], ...clamp }), progress.interpolate({ inputRange: [0, 0.12, 0.42, 1], outputRange: [height * 0.22, height * 0.22, 0, 0], ...clamp })) },
      { scale: enter.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0.88, 1.035, 1], ...clamp }) },
    ],
  } : null;
  const frameFx = pin ? {
    opacity: progress.interpolate({ inputRange: [0, 0.18, 0.44, 1], outputRange: [0, 0, 1, 1], ...clamp }),
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 0.18, 0.46, 1], outputRange: [height * 0.6, height * 0.6, 0, 0], ...clamp }) }],
  } : null;
  const screenFx = pin ? {
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 0.5, 0.84, 1], outputRange: [36, 36, 0, 0], ...clamp }) }],
  } : null;
  const controlsFx = pin ? { opacity: progress.interpolate({ inputRange: [0, 0.62, 0.84, 1], outputRange: [0, 0, 1, 1], ...clamp }) } : null;

  return (
    <View ref={section} id="kham-pha" testID="showcase-section" onLayout={(e) => onSection('kham-pha', e.nativeEvent.layout.y)} style={{ width: '100%', height: pin ? height + travel + height * 0.2 : undefined, backgroundColor: c.logoPaper }}>
      <View ref={stage} testID="showcase-stage" style={[
        { width: '100%', height: pin ? height : undefined, overflow: 'hidden', alignItems: 'center' },
        pin ? { position: 'sticky', top: 0, cursor: 'grab' } as unknown as ViewStyle : null,
      ]}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
          <View style={{ position: 'absolute', width: 440, height: 440, borderRadius: 220, borderWidth: 1, borderColor: c.logoGold, opacity: 0.3, left: -260, top: 20 }} />
          <View style={{ position: 'absolute', width: 300, height: 300, borderRadius: 150, borderWidth: 1, borderColor: c.logoGold, opacity: 0.3, right: -190, bottom: 20 }} />
        </View>
        <View style={{ width: '100%', maxWidth: 1120, alignItems: 'center', paddingHorizontal: 16, paddingTop: pin ? 88 : 56, paddingBottom: pin ? 20 : 56, gap: pin ? 12 : 24 }}>
          <Animated.View testID="showcase-title" style={titleFx}>
            <Txt f="heavy" size={wide ? compact ? 40 : 52 : 32} color={c.logoInk} center accessibilityRole="header" style={{ lineHeight: wide ? compact ? 46 : 58 : 38, letterSpacing: -1, maxWidth: 920 }}>
              Nơi học sinh khám phá lịch sử
            </Txt>
          </Animated.View>
          <Animated.View pointerEvents={interactive ? 'auto' : 'none'} aria-hidden={!interactive} accessibilityElementsHidden={!interactive} style={controlsFx}>
            {tabs(interactive, compact)}
          </Animated.View>
          <Animated.View testID="showcase-frame" style={[{ alignItems: 'center', width: '100%', maxWidth: pin ? tabletWidth : 780 }, frameFx]}>
            <View testID="showcase-tablet" style={{ width: '100%', aspectRatio: wide ? 4 / 3 : 0.92, borderRadius: wide ? 44 : 32, backgroundColor: c.logoInk, padding: wide ? 14 : 10, boxShadow: `0 18px 60px ${c.bong}` }}>
              <View style={{ flex: 1, borderRadius: wide ? 32 : 24, overflow: 'hidden', backgroundColor: c.logoPaper }}>
                <Animated.View testID="showcase-content" aria-hidden={!interactive} style={[{ flex: 1 }, screenFx]}>{children}</Animated.View>
                {pin && <MistLayer progress={progress} u={tabletWidth} />}
              </View>
              <View style={{ position: 'absolute', top: wide ? 4 : 3, alignSelf: 'center', width: 6, height: 6, borderRadius: 3, backgroundColor: c.logoGold }} />
            </View>
          </Animated.View>
          <Animated.View testID="showcase-description" aria-hidden={!interactive} style={[{ alignItems: 'center', gap: 6, maxWidth: 760 }, controlsFx]}>{description}</Animated.View>
        </View>
      </View>
    </View>
  );
}
