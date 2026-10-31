/**
 * Hình vẽ của Đông A (react-native-svg, sắc nét ở mọi kích thước): Rồng Con, ô đáp án Kahoot, huy hiệu tướng/quân địch,
 * công trình Điền Trang, nền chiến trận, lược đồ Đại Việt thời Trần (minh họa, không theo tỉ lệ), ảnh pixel của Hành Trình Đông A,
 * huy hiệu bang hội Khối 6 – 9.
 * Huy hiệu và linh vật không vẽ chân dung người thật; tranh minh họa danh tướng ở trang chủ nằm riêng trong hero-portrait.tsx.
 */
import { BrandWordmark } from '@/components/brand-wordmark';
import { useDrift,useLoop,useOnScreen } from '@/components/motion';
import { ELEMENTS,ENEMY_TYPES } from '@/constants/game';
import { FONT,type AnswerShape } from '@/constants/theme';
import { useBob,useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import type { BattleBg,EnemyDef,HeroDef } from '@/types/game';
import { LinearGradient as Gradient } from 'expo-linear-gradient';
import { Crown } from 'lucide-react-native';
import React from 'react';
import { Animated,Easing,Image,Platform,Pressable,StyleSheet,Text,View,type ImageSourcePropType,type StyleProp,type ViewStyle } from 'react-native';
import Svg,{ Circle,Defs,Ellipse,G,LinearGradient,Path,Pattern,RadialGradient,Rect,Stop,Text as SvgText } from 'react-native-svg';

export type MascotMood = 'happy' | 'excited' | 'sad' | 'sleepy' | 'thinking' | 'love';
export type MascotAccessory = 'none' | 'helmet' | 'conical' | 'crown' | 'scholar';

interface MascotProps {
  size?: number;
  mood?: MascotMood;
  accessory?: MascotAccessory;
  style?: StyleProp<ViewStyle>;
  /** Nhún nhảy nhẹ liên tục */
  bob?: boolean;
  title?: string;
}

const M_INK = '#134e48';

const M_BODY = '#2bb3a0';

const M_HEAD = '#34c4b0';

const M_SNOUT = '#9be7d9';

const M_GOLD = '#d97706';

const M_RED = '#dc2626';

/**
 * Rồng Con — linh vật của Đông A, lấy cảm hứng từ hình rồng thời Trần.
 * Vẽ thuần SVG để sắc nét ở mọi kích thước; không mô phỏng nhân vật lịch sử có thật.
 */
export const Mascot: React.FC<MascotProps> = ({ size = 120, mood = 'happy', accessory = 'none', style, bob = false, title = 'Rồng Con' }) => {
  const bobStyle = useBob(bob);
  const eyes = () => {
    switch (mood) {
      case 'excited':
        return (
          <G stroke={M_INK} strokeWidth="6" strokeLinecap="round" fill="none">
            <Path d="M66 82 q12 -15 24 0" />
            <Path d="M110 82 q12 -15 24 0" />
          </G>
        );
      case 'sleepy':
        return (
          <G stroke={M_INK} strokeWidth="5" strokeLinecap="round" fill="none">
            <Path d="M66 82 q12 8 24 0" />
            <Path d="M110 82 q12 8 24 0" />
          </G>
        );
      case 'love':
        return (
          <G fill={M_RED}>
            <Path d="M78 92 l-12 -12 a7 7 0 0 1 12 -8 a7 7 0 0 1 12 8 z" />
            <Path d="M122 92 l-12 -12 a7 7 0 0 1 12 -8 a7 7 0 0 1 12 8 z" />
          </G>
        );
      default: {
        const dx = mood === 'thinking' ? 4 : 0;
        const dy = mood === 'thinking' ? -4 : mood === 'sad' ? 3 : 0;
        return (
          <G>
            <Ellipse cx="78" cy="80" rx="14" ry="16" fill="#fff" stroke={M_INK} strokeWidth="3" />
            <Ellipse cx="122" cy="80" rx="14" ry="16" fill="#fff" stroke={M_INK} strokeWidth="3" />
            <Circle cx={78 + dx} cy={82 + dy} r="8" fill="#1c1917" />
            <Circle cx={122 + dx} cy={82 + dy} r="8" fill="#1c1917" />
            <Circle cx={81 + dx} cy={78 + dy} r="3" fill="#fff" />
            <Circle cx={125 + dx} cy={78 + dy} r="3" fill="#fff" />
            {mood === 'sad' && (
              <G stroke={M_INK} strokeWidth="4" strokeLinecap="round">
                <Path d="M64 62 l18 6" />
                <Path d="M136 62 l-18 6" />
              </G>
            )}
            {mood === 'thinking' && <Path d="M110 60 q12 -6 24 2" stroke={M_INK} strokeWidth="4" strokeLinecap="round" fill="none" />}
          </G>
        );
      }
    }
  };

  const mouth = () => {
    if (mood === 'excited' || mood === 'love')
      return (
        <G>
          <Path d="M86 116 q14 18 28 0 z" fill="#7f1d1d" stroke={M_INK} strokeWidth="3" strokeLinejoin="round" />
          <Path d="M93 121 q7 6 14 0" fill="#fb7185" />
        </G>
      );
    if (mood === 'sad') return <Path d="M88 124 q12 -10 24 0" stroke={M_INK} strokeWidth="4" strokeLinecap="round" fill="none" />;
    if (mood === 'sleepy') return <Ellipse cx="100" cy="120" rx="5" ry="4" fill={M_INK} />;
    if (mood === 'thinking') return <Path d="M90 120 h18" stroke={M_INK} strokeWidth="4" strokeLinecap="round" />;
    return <Path d="M86 116 q14 12 28 0" stroke={M_INK} strokeWidth="4" strokeLinecap="round" fill="none" />;
  };

  const showCrest = accessory !== 'helmet' && accessory !== 'conical';

  return (
    <Animated.View style={[{ width: size, height: size }, bobStyle, style]} accessible accessibilityRole="image" accessibilityLabel={title}>
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Ellipse cx="100" cy="188" rx="54" ry="8" fill="rgba(0,0,0,0.12)" />
      {/* Đuôi cuộn với ngọn lửa */}
      <Path d="M138 160 C176 160 186 128 168 112" fill="none" stroke={M_INK} strokeWidth="16" strokeLinecap="round" />
      <Path d="M138 160 C176 160 186 128 168 112" fill="none" stroke={M_BODY} strokeWidth="10" strokeLinecap="round" />
      <Path d="M168 112 c-10 -6 -6 -20 4 -24 c-2 8 6 10 8 4 c6 10 0 22 -12 20 z" fill={M_RED} stroke={M_INK} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Thân */}
      <Ellipse cx="100" cy="150" rx="46" ry="36" fill={M_BODY} stroke={M_INK} strokeWidth="4" />
      <Ellipse cx="100" cy="157" rx="27" ry="24" fill="#fce7b8" />
      <G stroke="#e3c27f" strokeWidth="2.5" fill="none" strokeLinecap="round">
        <Path d="M82 146 q18 8 36 0" />
        <Path d="M80 158 q20 8 40 0" />
        <Path d="M84 170 q16 6 32 0" />
      </G>
      <Ellipse cx="74" cy="182" rx="14" ry="8" fill="#23998a" stroke={M_INK} strokeWidth="3" />
      <Ellipse cx="126" cy="182" rx="14" ry="8" fill="#23998a" stroke={M_INK} strokeWidth="3" />
      <Path d="M58 138 q-10 10 -4 20" stroke={M_INK} strokeWidth="9" strokeLinecap="round" fill="none" />
      <Path d="M58 138 q-10 10 -4 20" stroke={M_BODY} strokeWidth="4" strokeLinecap="round" fill="none" />
      <Path d="M142 138 q10 10 4 20" stroke={M_INK} strokeWidth="9" strokeLinecap="round" fill="none" />
      <Path d="M142 138 q10 10 4 20" stroke={M_BODY} strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* Sừng */}
      {accessory !== 'conical' && (
        <G stroke="#92400e" strokeWidth="3" strokeLinejoin="round" fill={M_GOLD}>
          <Path d="M70 46 l-10 -24 l8 2 l2 -10 l8 16 z" />
          <Path d="M130 46 l10 -24 l-8 2 l-2 -10 l-8 16 z" />
        </G>
      )}
      {/* Bờm lửa */}
      {showCrest && (
        <G stroke={M_INK} strokeWidth="2.5" strokeLinejoin="round">
          <Path d="M84 40 c-4 -14 6 -24 14 -28 c-2 10 8 12 6 2 c10 8 10 22 2 28 z" fill={M_RED} />
          <Path d="M92 38 c0 -8 4 -12 8 -14 c0 6 4 6 4 0 c4 6 2 12 -2 16 z" fill="#f59e0b" stroke="none" />
        </G>
      )}
      {/* Đầu */}
      <Ellipse cx="100" cy="84" rx="58" ry="50" fill={M_HEAD} stroke={M_INK} strokeWidth="4" />
      <Ellipse cx="100" cy="66" rx="34" ry="14" fill="rgba(255,255,255,0.18)" />
      {/* Mõm & râu */}
      <Ellipse cx="100" cy="106" rx="30" ry="18" fill={M_SNOUT} stroke={M_INK} strokeWidth="3" />
      <Ellipse cx="91" cy="102" rx="3.5" ry="2.5" fill={M_INK} />
      <Ellipse cx="109" cy="102" rx="3.5" ry="2.5" fill={M_INK} />
      <G stroke={M_GOLD} strokeWidth="3.5" strokeLinecap="round" fill="none">
        <Path d="M72 106 c-14 -2 -22 -10 -30 -4" />
        <Path d="M128 106 c14 -2 22 -10 30 -4" />
      </G>
      <Ellipse cx="58" cy="100" rx="9" ry="5" fill="#fb7185" opacity="0.45" />
      <Ellipse cx="142" cy="100" rx="9" ry="5" fill="#fb7185" opacity="0.45" />
      {eyes()}
      {mouth()}
      {mood === 'sad' && <Path d="M66 98 q-3 8 0 12 q3 -4 0 -12" fill="#7dd3fc" />}
      {mood === 'sleepy' && (
        <SvgText x="150" y="44" fontSize="22" fontFamily={FONT.heavy} fill={M_INK}>
          z
        </SvgText>
      )}
      {/* Phụ kiện */}
      {accessory === 'helmet' && (
        <G stroke="#78350f" strokeWidth="3" strokeLinejoin="round">
          <Path d="M48 62 C52 22 148 22 152 62 Z" fill="#b45309" />
          <Path d="M44 62 h112 a6 6 0 0 1 0 10 h-112 a6 6 0 0 1 0 -10 z" fill="#d97706" />
          <Path d="M100 26 v-10" stroke="#78350f" strokeWidth="4" />
          <Path d="M92 10 c4 -8 12 -8 16 0 c-4 6 -12 6 -16 0 z" fill={M_RED} />
          <Path d="M70 52 q30 -22 60 0" fill="none" stroke="#fde68a" strokeWidth="3" opacity="0.7" />
        </G>
      )}
      {accessory === 'conical' && (
        <G strokeLinejoin="round">
          <Path d="M34 60 L100 4 L166 60 Q100 74 34 60 Z" fill="#ead39a" stroke="#a07b3a" strokeWidth="3" />
          <G stroke="#c9a85f" strokeWidth="2" fill="none">
            <Path d="M58 54 L100 16" />
            <Path d="M80 58 L100 12" />
            <Path d="M120 58 L100 12" />
            <Path d="M142 54 L100 16" />
          </G>
        </G>
      )}
      {accessory === 'crown' && (
        <G stroke="#92400e" strokeWidth="3" strokeLinejoin="round">
          <Path d="M66 46 L72 18 L88 34 L100 10 L112 34 L128 18 L134 46 Z" fill="#fbbf24" />
          <Circle cx="100" cy="36" r="5" fill={M_RED} />
        </G>
      )}
      {accessory === 'scholar' && (
        <G stroke="#0f172a" strokeWidth="2.5" strokeLinejoin="round">
          <Path d="M66 50 C70 24 130 24 134 50 Z" fill="#1f2937" />
          <Ellipse cx="54" cy="44" rx="16" ry="6" fill="#1f2937" />
          <Ellipse cx="146" cy="44" rx="16" ry="6" fill="#1f2937" />
          <Path d="M70 46 h60" stroke="#d97706" strokeWidth="3" />
        </G>
      )}
    </Svg>
    </Animated.View>
  );
};

export const KahootShape: React.FC<{ shape: AnswerShape; size?: number; color?: string }> = ({ shape, size = 28, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {shape === 'triangle' && <Path d="M16 4 L29 27 H3 Z" fill={color} />}
    {shape === 'diamond' && <Path d="M16 2 L30 16 L16 30 L2 16 Z" fill={color} />}
    {shape === 'circle' && <Circle cx="16" cy="16" r="13" fill={color} />}
    {shape === 'square' && <Rect x="4" y="4" width="24" height="24" rx="2" fill={color} />}
  </Svg>
);

/** Huy hiệu tướng: vòng màu theo hệ + vật biểu trưng; không vẽ chân dung người thật */
export const HeroMedallion: React.FC<{ hero: HeroDef; stage?: number; size?: number; dim?: boolean }> = ({ hero, stage = 1, size = 64, dim = false }) => {
  const { c } = useTheme();
  const el = ELEMENTS[hero.element];
  const Icon = hero.symbol;
  const golden = hero.tier === 'huyen_thoai' || hero.tier === 'tiet_che';
  const inset = Math.max(4, size * 0.09);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: c[el.fill],
        opacity: dim ? 0.55 : 1, borderWidth: golden ? 3 : 0, borderColor: '#fbbf24', borderBottomWidth: golden ? 5 : 3, borderBottomColor: golden ? '#92400e' : 'rgba(0,0,0,0.25)',
      }}
    >
      <View style={{ position: 'absolute', top: inset, left: inset, right: inset, bottom: inset, borderRadius: size, backgroundColor: c.the, borderBottomWidth: 3, borderBottomColor: 'rgba(0,0,0,0.06)' }} />
      {/* Bọc trong View: trên web, phần tử định vị tuyệt đối phía trên sẽ che SVG nếu SVG không được định vị */}
      <View>
        <Icon size={Math.round(size * 0.46)} color={dim ? c.muc3 : c[el.text]} strokeWidth={2.2} />
      </View>
      {stage > 1 && (
        <View style={{ position: 'absolute', bottom: -4, flexDirection: 'row', gap: 3 }}>
          {Array.from({ length: stage - 1 }, (_, i) => (
            <View key={i} style={{ width: 9, height: 9, transform: [{ rotate: '45deg' }], backgroundColor: c.dong, borderWidth: 1, borderColor: c.dongDam }} />
          ))}
        </View>
      )}
    </View>
  );
};

/** Huy hiệu quân địch */
export const EnemyBadge: React.FC<{ enemy: EnemyDef; size?: number }> = ({ enemy, size = 64 }) => {
  const { c } = useTheme();
  const Icon = ENEMY_TYPES[enemy.type].Icon;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size, height: size, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.dich,
        borderWidth: enemy.boss ? 3 : 0, borderColor: '#b91c1c', borderBottomWidth: enemy.boss ? 5 : 3, borderBottomColor: enemy.boss ? '#7f1d1d' : 'rgba(0,0,0,0.3)',
      }}
    >
      <Icon size={Math.round(size * 0.5)} color="#ffffff" strokeWidth={2} />
      {enemy.boss && (
        <View style={{ position: 'absolute', top: -12 }}>
          <Crown size={20} color={c.dong} fill={c.dong} />
        </View>
      )}
    </View>
  );
};

/** Số giả ngẫu nhiên cố định để sao và cọc không đổi giữa các lần vẽ */
const lcg = (seed: number) => () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

const lerp = (v: Animated.Value, a: number, b: number) => v.interpolate({ inputRange: [0, 1], outputRange: [a, b] });

// ---------------------------------------------------------------------- ảnh bìa điện ảnh (ghép từ các khung hình minh họa)
/** Một cảnh của ảnh bìa: tên hiển thị, ảnh bản ngang (màn rộng) và bản dọc (điện thoại), chuyển động máy quay từ [phóng, dịch ngang, dịch dọc] sang [...] (dịch tính theo tỉ lệ khung) */
interface FilmScene {
  name: string;
  land: ImageSourcePropType;
  tall: ImageSourcePropType;
  from: [number, number, number];
  to: [number, number, number];
}

/**
 * Tám khung hình điện ảnh tái hiện bối cảnh kháng chiến chống quân Nguyên – Mông thời Trần theo mạch liên hoàn:
 * chuẩn bị → hành quân → xung phong → giáp chiến → khói lửa → thủy chiến → bãi cọc ngầm → chiến thắng.
 */
const FILM_SCENES: FilmScene[] = [
  { name: 'Chuẩn bị', land: require('../assets/anh-bia-1-ngang.jpg'), tall: require('../assets/anh-bia-1-doc.jpg'), from: [1.05, 0, 0.01], to: [1.13, 0, -0.01] },
  { name: 'Hành quân', land: require('../assets/anh-bia-2-ngang.jpg'), tall: require('../assets/anh-bia-2-doc.jpg'), from: [1.12, 0.014, 0], to: [1.05, -0.014, 0] },
  { name: 'Xung phong', land: require('../assets/anh-bia-3-ngang.jpg'), tall: require('../assets/anh-bia-3-doc.jpg'), from: [1.05, -0.012, 0], to: [1.12, 0.012, 0] },
  { name: 'Giáp chiến', land: require('../assets/anh-bia-4-ngang.jpg'), tall: require('../assets/anh-bia-4-doc.jpg'), from: [1.06, 0.012, 0], to: [1.13, -0.012, 0] },
  { name: 'Khói lửa', land: require('../assets/anh-bia-5-ngang.jpg'), tall: require('../assets/anh-bia-5-doc.jpg'), from: [1.12, 0, 0.01], to: [1.05, 0, -0.01] },
  { name: 'Thủy chiến', land: require('../assets/anh-bia-6-ngang.jpg'), tall: require('../assets/anh-bia-6-doc.jpg'), from: [1.05, -0.014, 0], to: [1.12, 0.014, 0] },
  { name: 'Bãi cọc ngầm', land: require('../assets/anh-bia-7-ngang.jpg'), tall: require('../assets/anh-bia-7-doc.jpg'), from: [1.11, 0.012, 0], to: [1.05, -0.01, 0] },
  { name: 'Chiến thắng', land: require('../assets/anh-bia-8-ngang.jpg'), tall: require('../assets/anh-bia-8-doc.jpg'), from: [1.05, 0, 0.012], to: [1.12, 0, -0.012] },
];
const GRAIN = require('../assets/anh-bia-hat.png');
const PATTERN_BG = require('../assets/hoa-tiet-nen.png');

/** Họa tiết trống đồng – võ sĩ thời Trần lặp liền mạch làm nền chìm nhẹ cho các khối ngoài ảnh bìa */
export const PatternOverlay: React.FC<{ opacity?: number }> = ({ opacity }) => {
  const { dark } = useTheme();
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <Image
        source={PATTERN_BG}
        accessible={false}
        resizeMode="repeat"
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', opacity: opacity ?? (dark ? 0.065 : 0.08) }]}
      />
    </View>
  );
};

const SCENE_MS = 6000;
const FADE_MS = 1400;
const GLOW = (Platform.OS === 'web' ? { boxShadow: '0 0 6px 1px rgba(255, 160, 60, 0.65)' } : null) as unknown as ViewStyle;

/** Một lớp ảnh: mờ hiện/ẩn khi chuyển cảnh, máy quay chậm tiến hoặc lùi xuyên suốt cả lúc mờ chồng để dòng video liền mạch không khựng */
const FilmSlide: React.FC<{ scene: FilmScene; tall: boolean; active: boolean; size: { w: number; h: number } }> = ({ scene, tall, active, size }) => {
  const reduce = useReduceMotion();
  const op = React.useRef(new Animated.Value(active ? 1 : 0)).current;
  const kb = React.useRef(new Animated.Value(0)).current;
  const kbRun = React.useRef<Animated.CompositeAnimation | null>(null);
  React.useEffect(() => {
    Animated.timing(op, { toValue: active ? 1 : 0, duration: reduce ? 1 : FADE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start();
    if (!active) return;
    kbRun.current?.stop();
    kb.setValue(0);
    if (reduce) return;
    const run = Animated.timing(kb, { toValue: 1, duration: SCENE_MS + FADE_MS, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' });
    kbRun.current = run;
    run.start();
  }, [active, reduce, op, kb]);
  React.useEffect(() => () => kbRun.current?.stop(), []);
  const [s0, x0, y0] = scene.from;
  const [s1, x1, y1] = scene.to;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: op }]}>
      <Animated.Image
        source={tall ? scene.tall : scene.land}
        accessible={false}
        resizeMode="cover"
        style={[
          StyleSheet.absoluteFill,
          {
            width: '100%',
            height: '100%',
            transform: [
              { translateX: kb.interpolate({ inputRange: [0, 1], outputRange: [x0 * size.w, x1 * size.w] }) },
              { translateY: kb.interpolate({ inputRange: [0, 1], outputRange: [y0 * size.h, y1 * size.h] }) },
              { scale: kb.interpolate({ inputRange: [0, 1], outputRange: [s0, s1] }) },
            ],
          },
        ]}
      />
    </Animated.View>
  );
};

/** Hạt phim rất nhẹ giúp gắn kết các cảnh mà không làm đục hay nhiễu hình */
const FilmGrain: React.FC<{ live: boolean; size: { w: number; h: number } }> = ({ live, size }) => {
  const reduce = useReduceMotion();
  const x = React.useRef(new Animated.Value(0)).current;
  const y = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!live || reduce) return undefined;
    const id = setInterval(() => {
      x.setValue(-Math.floor(Math.random() * 256));
      y.setValue(-Math.floor(Math.random() * 256));
    }, 140);
    return () => clearInterval(id);
  }, [live, reduce, x, y]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', opacity: 0.035 }]}>
      <Animated.Image source={GRAIN} accessible={false} resizeMode="repeat" style={{ position: 'absolute', left: 0, top: 0, width: size.w + 256, height: size.h + 256, transform: [{ translateX: x }, { translateY: y }] }} />
    </View>
  );
};

const EMBERS = (() => {
  const rnd = lcg(77);
  return Array.from({ length: 6 }, () => ({ x: rnd(), size: 2 + rnd() * 2.2, period: 6400 + rnd() * 5200, delay: rnd() * 6000, rise: 0.3 + rnd() * 0.45, sway: 8 + rnd() * 16 }));
})();

/** Tàn lửa bay nhẹ từ đáy khung, lắc lư theo gió rồi tắt dần */
const Ember: React.FC<{ e: (typeof EMBERS)[number]; live: boolean; size: { w: number; h: number } }> = ({ e, live, size }) => {
  const v = useDrift(live, e.period, e.delay);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: e.x * size.w, bottom: 0, width: e.size, height: e.size, borderRadius: e.size, backgroundColor: '#ffb347' },
        GLOW,
        {
          opacity: v.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 0.42, 0.2, 0] }),
          transform: [
            { translateY: lerp(v, 0, -e.rise * size.h) },
            { translateX: v.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, e.sway, -e.sway * 0.6, e.sway * 0.8, 0] }) },
            { scale: lerp(v, 1, 0.4) },
          ],
        },
      ]}
    />
  );
};

/** Lớp sương khói mỏng trôi ngang rất chậm */
const SmokeBlob: React.FC<{ live: boolean; size: { w: number; h: number }; top: number; width: number; period: number; delay: number; dir: 1 | -1 }> = ({ live, size, top, width, period, delay, dir }) => {
  const v = useLoop(live, period, delay);
  const gid = React.useId().replace(/:/g, '');
  const w = width * size.w;
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', top: top * size.h, left: dir > 0 ? -w * 0.25 : size.w - w * 0.75, width: w, height: w * 0.6, opacity: lerp(v, 0.02, 0.07), transform: [{ translateX: lerp(v, -50 * dir, 50 * dir) }, { scale: lerp(v, 0.94, 1.08) }] }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={`sm-${gid}`} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#2b2a30" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#2b2a30" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50" cy="30" rx="50" ry="30" fill={`url(#sm-${gid})`} />
      </Svg>
    </Animated.View>
  );
};

/** Vạch tiến độ của một cảnh: đầy dần trong suốt thời gian cảnh đang chiếu */
const FilmSeg: React.FC<{ state: 'done' | 'active' | 'todo'; live: boolean; wide: boolean; label: string; onPress: () => void }> = ({ state, live, wide, label, onPress }) => {
  const reduce = useReduceMotion();
  const fill = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (state !== 'active') {
      fill.setValue(state === 'done' ? 1 : 0);
      return undefined;
    }
    if (reduce) {
      fill.setValue(1);
      return undefined;
    }
    if (!live) return undefined;
    fill.setValue(0);
    const run = Animated.timing(fill, { toValue: 1, duration: SCENE_MS, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' });
    run.start();
    return () => run.stop();
  }, [state, live, reduce, fill]);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: state === 'active' }} style={{ minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' }}>
      <View style={{ width: wide ? 30 : 18, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.32)', overflow: 'hidden' }}>
        <Animated.View style={{ width: '100%', height: 4, backgroundColor: '#ffffff', transform: [{ scaleX: fill }], transformOrigin: 'left center' }} />
      </View>
    </Pressable>
  );
};

/**
 * Ảnh bìa điện ảnh: tám khung hình lịch sử thời Trần chiếu nối tiếp thành một đoạn phim liền mạch, luôn phủ kín 100% khung ở mọi độ phân giải.
 * Chỉ chạy khi nằm trong màn hình; giảm chuyển động thì đứng ở cảnh đầu và chuyển cảnh bằng tay.
 */
export const FilmBackdrop: React.FC<{ wide?: boolean; only?: number[]; indicator?: boolean; indicatorBottom?: number; dim?: number; scrim?: boolean }> = ({ wide = true, only, indicator = false, indicatorBottom = 96, dim = 0, scrim = false }) => {
  const reduce = useReduceMotion();
  const vid = React.useId().replace(/:/g, '');
  const [ref, live] = useOnScreen();
  const order = React.useMemo(() => only ?? FILM_SCENES.map((_, i) => i), [only]);
  const [pos, setPos] = React.useState(0);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const flick = useLoop(live, 900);
  const flick2 = useLoop(live, 1400, 350);
  const goTo = (n: number) => {
    setPos(n);
  };
  React.useEffect(() => {
    if (!live || reduce || order.length < 2) return undefined;
    const t = setTimeout(() => {
      setPos((pos + 1) % order.length);
    }, SCENE_MS);
    return () => clearTimeout(t);
  }, [live, reduce, pos, order.length]);
  const tall = size.w > 0 ? size.w < size.h * 1.15 : !wide;
  const cur = FILM_SCENES[order[pos]];
  return (
    <View ref={ref} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#0b0a10', overflow: 'hidden' }]}>
        {order.map((id, i) => (
          <FilmSlide key={id} scene={FILM_SCENES[id]} tall={tall} active={i === pos} size={size} />
        ))}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(90, 22, 12, 0.04)' }]} />
        {size.w > 0 && (
          <>
            <SmokeBlob live={live} size={size} top={0.28} width={0.9} period={16000} delay={0} dir={1} />
            <SmokeBlob live={live} size={size} top={0.52} width={0.8} period={22000} delay={2500} dir={-1} />
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 140, 60, 1)', opacity: Animated.add(lerp(flick, 0, 0.015), lerp(flick2, 0, 0.015)) }]} />
            {EMBERS.map((e, i) => (
              <Ember key={i} e={e} live={live} size={size} />
            ))}
          </>
        )}
        <Gradient colors={['rgba(8,8,16,0.44)', 'rgba(8,8,16,0.04)', 'rgba(16,6,6,0.72)']} locations={[0, 0.42, 1]} style={StyleSheet.absoluteFill} />
        {dim > 0 && <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0b0a10', opacity: dim }]} />}
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={`vg-${vid}`} cx="0.5" cy="0.5" r="0.78">
              <Stop offset="0.65" stopColor="#000000" stopOpacity="0" />
              <Stop offset="1" stopColor="#000000" stopOpacity="0.34" />
            </RadialGradient>
            <RadialGradient id={`sc-${vid}`} cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#06060c" stopOpacity="0.46" />
              <Stop offset="0.65" stopColor="#06060c" stopOpacity="0.22" />
              <Stop offset="1" stopColor="#06060c" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#vg-${vid})`} />
          {scrim && <Ellipse cx="50%" cy="34%" rx="46%" ry="36%" fill={`url(#sc-${vid})`} />}
        </Svg>
        {size.w > 0 && <FilmGrain live={live} size={size} />}
      </View>
      {indicator && order.length > 1 && (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: indicatorBottom, paddingHorizontal: 24, alignItems: wide ? 'flex-end' : 'center' }}>
          <Text style={{ fontFamily: FONT.bold, fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', color: '#ffffff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 }}>
            {`Cảnh ${pos + 1}/${order.length} · ${cur.name}`}
          </Text>
          <View accessibilityRole="tablist" accessibilityLabel="Chọn cảnh" style={{ flexDirection: 'row', alignItems: 'center' }}>
            {order.map((id, i) => (
              <FilmSeg key={id} state={i < pos ? 'done' : i === pos ? 'active' : 'todo'} live={live} wide={wide} label={`Xem cảnh ${i + 1}: ${FILM_SCENES[id].name}`} onPress={() => goTo(i)} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

/** Dải mây cuộn làm mép chuyển giữa hai vùng nền (flip: mây treo từ mép trên xuống); color là màu vùng nền bên cạnh */
export const CloudBank: React.FC<{ color: string; flip?: boolean; height?: number }> = ({ color, flip = false, height = 72 }) => {
  const gid = React.useId().replace(/:/g, '');
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, height, ...(flip ? { top: -1 } : { bottom: -1 }), transform: flip ? [{ scaleY: -1 }] : undefined }}
    >
      <Svg width="100%" height={height}>
        <Defs>
          <Pattern id={`k-${gid}`} width="220" height={height} patternUnits="userSpaceOnUse">
            <Circle cx="40" cy="46" r="26" fill={color} />
            <Circle cx="96" cy="34" r="34" fill={color} />
            <Circle cx="158" cy="44" r="28" fill={color} />
            <Circle cx="198" cy="50" r="20" fill={color} />
            <Rect x="0" y="48" width="220" height={height - 48} fill={color} />
          </Pattern>
        </Defs>
        <Rect width="100%" height={height} fill={`url(#k-${gid})`} />
      </Svg>
    </View>
  );
};

/** Biểu tượng logo: hình vuông bo góc cắt từ assets/logo.jpg (chiến binh cầm cờ đỏ trước mặt trời) */
const LOGO_MARK = require('../assets/logo-mark.png');

/** Logo chính chủ: biểu tượng chiến binh và nét chữ gốc, dùng chung ở mọi trang. */
export const BrandLogo: React.FC<{ compact?: boolean; subtitle?: string; light?: boolean; paper?: boolean }> = ({ compact = false, subtitle, light = false, paper = false }) => {
  const { c, dark } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessible accessibilityRole="header" accessibilityLabel={subtitle ? `Đông A edu – ${subtitle}` : 'Đông A edu'}>
      <Image source={LOGO_MARK} accessibilityIgnoresInvertColors style={{ width: 44, height: 44, borderRadius: 12 }} />
      {!compact && (
        <View>
          <BrandWordmark height={28} color={light ? c.trang : paper ? c.logoInk : dark ? c.trang : c.logoInk} />
          {subtitle && (
            <Text style={{ fontFamily: FONT.bold, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: light ? 'rgba(255,255,255,0.85)' : c.muc2 }}>{subtitle}</Text>
          )}
        </View>
      )}
    </View>
  );
};

/** Cờ đỏ sao vàng (tỉ lệ 2:3, màu chuẩn của quốc kỳ) dùng làm biểu tượng ngôn ngữ Tiếng Việt */
const STAR = (() => {
  const cx = 15;
  const cy = 10.4;
  const R = 6.2;
  const r = R * 0.382;
  return Array.from({ length: 10 }, (_, i) => {
    const a = (-90 + i * 36) * (Math.PI / 180);
    const d = i % 2 === 0 ? R : r;
    return `${(cx + d * Math.cos(a)).toFixed(2)} ${(cy + d * Math.sin(a)).toFixed(2)}`;
  }).join(' L');
})();

export const VietnamFlag: React.FC<{ width?: number }> = ({ width = 36 }) => {
  const height = Math.round((width * 2) / 3);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Tiếng Việt" style={{ width, height, borderRadius: 4, overflow: 'hidden' }}>
      <Svg width={width} height={height} viewBox="0 0 30 20">
        <Rect width="30" height="20" fill="#da251d" />
        <Path d={`M${STAR} Z`} fill="#ffff00" />
      </Svg>
    </View>
  );
};

/** Nền chiến trận: đồng bằng, sông, biển (có thủy triều và cọc ngầm) */
export const BattleBackdrop: React.FC<{ bg: BattleBg; tide?: 'len' | 'dung' | 'rut' | null; dark: boolean; stakes?: boolean }> = ({ bg, tide = null, dark, stakes = false }) => {
  const gid = React.useId().replace(/:/g, '');
  const skyTop = bg === 'sea' ? '#cfe9f2' : '#fde7c8';
  const skyBot = bg === 'sea' ? '#eef7f2' : '#f8e9cf';
  const waterY = tide === 'len' ? 128 : tide === 'dung' ? 138 : tide === 'rut' ? 152 : 136;
  return (
    <Svg viewBox="0 0 400 220" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={`sky-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={skyTop} />
          <Stop offset="100%" stopColor={skyBot} />
        </LinearGradient>
        <LinearGradient id={`sea-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#6cb9d8" />
          <Stop offset="100%" stopColor="#2f86b0" />
        </LinearGradient>
      </Defs>
      <Rect width="400" height="220" fill={`url(#sky-${gid})`} />
      <Circle cx="330" cy="46" r="18" fill="#fbbf24" opacity="0.55" />
      <Path d="M0 120 C60 92 110 104 160 96 C220 86 270 100 320 90 C360 84 380 92 400 96 V220 H0 Z" fill="#c9b285" opacity="0.6" />
      <Path d="M0 130 C80 112 140 124 200 116 C260 108 330 120 400 112 V220 H0 Z" fill="#b89a66" opacity="0.55" />
      {bg === 'plain' && (
        <G>
          <Path d="M0 150 C100 138 200 150 300 142 C350 138 380 142 400 144 V220 H0 Z" fill="#c8ad73" />
          <Path d="M0 176 C120 166 240 178 400 168 V220 H0 Z" fill="#b39358" />
          {[30, 90, 160, 250, 330, 370].map((x) => (
            <Path key={x} d={`M${x} 196 l4 -8 l4 8`} fill="none" stroke="#8a7140" strokeWidth="2" strokeLinecap="round" />
          ))}
        </G>
      )}
      {bg !== 'plain' && (
        <G>
          <Path d={`M0 ${waterY} C80 ${waterY - 6} 160 ${waterY + 4} 240 ${waterY - 2} C300 ${waterY - 6} 360 ${waterY + 2} 400 ${waterY} V220 H0 Z`} fill={`url(#sea-${gid})`} />
          <G stroke="#d4f0f8" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.8">
            <Path d={`M30 ${waterY + 26} q12 -6 24 0 t24 0`} />
            <Path d={`M190 ${waterY + 40} q12 -6 24 0 t24 0`} />
            <Path d={`M300 ${waterY + 22} q12 -6 24 0 t24 0`} />
          </G>
          {bg === 'river' && <Path d="M0 214 C120 200 260 212 400 200 V220 H0 Z" fill="#9f8452" />}
          {stakes && (
            <G>
              {[40, 78, 116, 154, 192, 230, 268, 306, 344].map((x, i) => (
                <G key={x} transform={`translate(${x} ${168 + (i % 2) * 8})`}>
                  <Rect x="-3" y="0" width="6" height="40" fill="#8b5a2b" stroke="#3b2a1a" strokeWidth="1.2" />
                  <Path d="M-3 0 L0 -9 L3 0 Z" fill="#94a3b8" stroke="#3b2a1a" strokeWidth="1.2" />
                </G>
              ))}
              {tide !== 'rut' && <Path d={`M0 ${Math.min(waterY + 30, 200)} H400 V220 H0 Z`} fill={`url(#sea-${gid})`} opacity="0.92" />}
            </G>
          )}
        </G>
      )}
      {dark && <Rect width="400" height="220" fill="#0b1220" opacity="0.5" />}
    </Svg>
  );
};
