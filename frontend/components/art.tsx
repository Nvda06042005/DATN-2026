/**
 * Hình vẽ của Đông A (react-native-svg, sắc nét ở mọi kích thước): Rồng Con, ô đáp án Kahoot, huy hiệu tướng/quân địch,
 * công trình Điền Trang, nền chiến trận, lược đồ Đại Việt thời Trần (minh họa, không theo tỉ lệ), ảnh pixel của Hành Trình Đông A,
 * huy hiệu bang hội Khối 6 – 9.
 * Không vẽ chân dung nhân vật lịch sử có thật.
 */
import React from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient as Gradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Marker, Path, Pattern, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Crown } from 'lucide-react-native';
import { ELEMENTS, ENEMY_TYPES, MAP_PLACES } from '@/constants/game';
import { ANSWER_STYLES, FONT, GRADE_STYLE, type AnswerShape } from '@/constants/theme';
import { useBob, useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { useDrift, useLoop, useOnScreen } from '@/components/motion';
import type { PixelPaths } from '@/lib/pixel-art';
import type { Grade } from '@/types/api';
import type { BattleBg, BuildingId, EnemyDef, HeroDef, PlaceId } from '@/types/game';

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

/** Bốn ô màu thu nhỏ – biểu tượng Quiz */
export const KahootMiniGrid: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <View style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
    {ANSWER_STYLES.map((s) => (
      <View key={s.shape} style={{ width: (size - 2) / 2, height: (size - 2) / 2, borderRadius: 3, backgroundColor: s.bg }} />
    ))}
  </View>
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

/** Giữ nét pixel sắc khi phóng to trên web (trình duyệt không làm nhòe mép ô) */
const CRISP = Platform.OS === 'web' ? ({ shapeRendering: 'crispEdges' } as object) : {};

/** Ảnh pixel dựng sẵn ở lib/pixel-art.ts (mỗi màu một Path); kích thước tùy ý, giữ tỉ lệ ô */
export const PixelArt = React.memo<{ art: PixelPaths; width: number; height: number; style?: StyleProp<ViewStyle> }>(({ art, width, height, style }) => (
  <Svg width={width} height={height} viewBox={`0 0 ${art.w} ${art.h}`} style={style} {...CRISP}>
    {art.list.map((p, i) => (
      <Path key={i} d={p.d} fill={p.fill} />
    ))}
  </Svg>
));
PixelArt.displayName = 'PixelArt';

// ---------------------------------------------------------------------- bình minh Bạch Đằng (hero trang chủ)
/** Núi đá vôi tròn đỉnh (cx: tâm, base: chân núi, w: rộng, h: cao) */
const karst = (cx: number, base: number, w: number, h: number) =>
  `M${cx - w / 2} ${base} C${cx - w / 2} ${base - h * 0.55} ${cx - w * 0.28} ${base - h} ${cx} ${base - h} C${cx + w * 0.28} ${base - h} ${cx + w / 2} ${base - h * 0.55} ${cx + w / 2} ${base} Z`;

const WATER_Y = 585;
const SUN = { x: 1000, y: 500 };
const FAR_PEAKS = [karst(70, WATER_Y, 150, 100), karst(230, WATER_Y, 170, 140), karst(420, WATER_Y, 200, 180), karst(650, WATER_Y, 170, 120), karst(1250, WATER_Y, 220, 200), karst(1400, WATER_Y, 160, 150)].join(' ');
const MID_PEAKS = [karst(300, WATER_Y, 150, 250), karst(540, WATER_Y, 130, 160), karst(740, WATER_Y, 140, 270), karst(1200, WATER_Y, 120, 210), karst(1340, WATER_Y, 170, 290)].join(' ');
const RAYS = [-760, -520, -300, -110, 90, 300, 520].map((dx) => `M${SUN.x} ${SUN.y} L${SUN.x + dx - 50} -60 L${SUN.x + dx + 50} -60 Z`).join(' ');

/** Số giả ngẫu nhiên cố định để sao và cọc không đổi giữa các lần vẽ */
const lcg = (seed: number) => () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

const STARS = (() => {
  const rnd = lcg(5);
  return Array.from({ length: 44 }, () => ({ x: rnd() * 1440, y: rnd() * 250, r: 0.7 + rnd() * 1.1, o: 0.25 + rnd() * 0.5 }));
})();

/** Bãi cọc nhọn cắm dưới sông Bạch Đằng: chỉ lộ phần đầu cọc trên mặt nước */
const STAKES = (() => {
  const rnd = lcg(21);
  return Array.from({ length: 30 }, () => ({ x: 800 + rnd() * 520, y: 690 + rnd() * 62, h: 36 + rnd() * 30, tilt: (rnd() - 0.5) * 12 })).sort((a, b) => a.y - b.y);
})();

/** Thuyền chiến nhà Trần: thân dài mũi cong, buồm đỏ viền vàng, cờ hiệu (gốc ở mép nước, dài khoảng 276, quay mũi sang phải) */
const WarBoat: React.FC = () => (
  <G>
    <Path d="M0 -8 C30 22 90 28 150 28 C210 28 250 14 276 -30 L262 -30 C240 -6 200 8 150 8 C100 8 50 4 18 -20 Z" fill="#150f1f" />
    <Path d="M14 -14 C44 8 96 14 150 14 C204 14 240 2 266 -22" fill="none" stroke="#f0b45a" strokeWidth="2" opacity="0.8" />
    <Path d="M76 -30 Q127 -62 178 -30 Z" fill="#150f1f" />
    <Rect x="84" y="-30" width="86" height="20" fill="#150f1f" />
    <Rect x="128" y="-196" width="5" height="170" fill="#150f1f" />
    <Path d="M133 -188 L133 -58 C168 -62 206 -72 238 -94 C220 -132 184 -168 133 -188 Z" fill="#b32a2e" stroke="#ffd479" strokeWidth="2" strokeLinejoin="round" />
    <Circle cx="178" cy="-112" r="16" fill="#ffd479" opacity="0.9" />
    <Circle cx="178" cy="-112" r="8" fill="#b32a2e" />
    <Path d="M131 -196 C152 -206 172 -190 200 -200 L200 -184 C172 -176 152 -192 131 -182 Z" fill="#ffd479" />
    <Path d="M10 34 q18 -8 36 0 t36 0 t36 0 t36 0" fill="none" stroke="#f6c46b" strokeWidth="2" opacity="0.4" />
  </G>
);

/** Thân thuyền giặc cháy: thân, cột, buồm cháy dở (đã nghiêng sẵn, gốc ở mép nước) */
const BurningHull: React.FC<{ tilt: number }> = ({ tilt }) => (
  <G transform={`rotate(${tilt})`}>
    <Path d="M0 -8 C30 22 90 28 150 28 C210 28 250 14 276 -30 L262 -30 C240 -6 200 8 150 8 C100 8 50 4 18 -20 Z" fill="#17121c" />
    <Rect x="128" y="-150" width="5" height="124" fill="#17121c" />
    <Path d="M133 -146 L133 -64 L196 -84 L178 -112 L152 -104 Z" fill="#4f4858" opacity="0.9" />
  </G>
);

const BurningGlow: React.FC<{ tilt: number }> = ({ tilt }) => (
  <G transform={`rotate(${tilt})`}>
    <Circle cx="140" cy="-30" r="90" fill="#ff8a3d" opacity="0.28" />
  </G>
);

const BurningFlames: React.FC<{ tilt: number }> = ({ tilt }) => (
  <G transform={`rotate(${tilt})`}>
    <Path d="M104 -10 C94 -44 118 -58 112 -90 C140 -66 150 -38 140 -10 Z" fill="#ff7a2f" />
    <Path d="M124 -10 C118 -34 132 -44 130 -66 C148 -50 150 -28 144 -10 Z" fill="#ffd24a" />
    <Path d="M168 -10 C162 -30 174 -38 172 -56 C188 -42 190 -26 184 -10 Z" fill="#ff7a2f" />
  </G>
);

/** Cột cờ phướn trên bờ (cờ vẽ riêng để bay): cột tối và quả cầu vàng trên đỉnh */
const BannerPole: React.FC<{ x: number; top: number }> = ({ x, top }) => (
  <G>
    <Rect x={x} y={top - 12} width="5" height={820 - top} fill="#0a0f22" />
    <Circle cx={x + 2.5} cy={top - 14} r="5" fill="#ffd479" />
  </G>
);

/** Lá cờ đỏ viền vàng, gốc ở chỗ buộc vào cột (0, 0) */
const BannerCloth: React.FC<{ w: number; label?: string }> = ({ w, label }) => (
  <G>
    <Path
      d={`M0 0 C${w * 0.35 - 5} -12 ${w * 0.65 - 5} 12 ${w - 5} -2 L${w - 19} 36 L${w - 5} 72 C${w * 0.65 - 5} 86 ${w * 0.35 - 5} 62 0 74 Z`}
      fill="#c1272d"
      stroke="#ffd479"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    {label && (
      <SvgText x={w * 0.52 - 5} y={43} textAnchor="middle" fontSize="15" fontFamily={FONT.displayHeavy} fill="#ffd479">
        {label}
      </SvgText>
    )}
  </G>
);

/** Kỵ binh Mông Cổ phi nước đại, bóng đen cầm giáo có cờ đuôi (gốc ở chân ngựa, quay sang phải) */
const Horseman: React.FC = () => (
  <G fill="#0d0a16">
    <Ellipse cx="0" cy="-48" rx="38" ry="15" />
    <Path d="M26 -54 C40 -74 52 -82 62 -80 L72 -70 C66 -64 56 -62 46 -46 Z" />
    <Path d="M56 -80 L60 -92 L66 -80 Z" />
    <Path d="M-36 -52 C-54 -48 -62 -30 -58 -14 C-50 -28 -44 -38 -34 -42 Z" />
    <Path d="M-26 -38 L-44 -4 L-36 -2 L-16 -36 Z" />
    <Path d="M-12 -36 L-18 0 L-8 0 L0 -34 Z" />
    <Path d="M16 -36 L34 -6 L42 -10 L26 -38 Z" />
    <Path d="M28 -40 L52 -18 L58 -24 L36 -46 Z" />
    <Path d="M-6 -62 L-2 -92 L10 -92 L12 -62 Z" />
    <Circle cx="4" cy="-100" r="8" />
    <Path d="M-6 -104 L4 -128 L14 -104 Z" />
    <Path d="M14 -80 L66 -152" stroke="#0d0a16" strokeWidth="3" fill="none" />
    <Path d="M66 -152 L90 -146 L68 -138 Z" />
  </G>
);

/** Cổng thành Thăng Long: tường, lầu hai tầng mái cong (cờ trên đỉnh vẽ riêng để bay); gốc ở giữa chân tường */
const Citadel: React.FC = () => (
  <G fill="#0a0f22">
    <Rect x="-130" y="-34" width="260" height="34" />
    {Array.from({ length: 13 }, (_, i) => (
      <Rect key={i} x={-130 + i * 20 + 2} y="-42" width="12" height="8" />
    ))}
    <Rect x="-44" y="-92" width="88" height="58" />
    <Path d="M-64 -92 Q0 -122 64 -92 L52 -82 L-52 -82 Z" />
    <Rect x="-26" y="-134" width="52" height="42" />
    <Path d="M-46 -134 Q0 -168 46 -134 L36 -124 L-36 -124 Z" />
    <Circle cx="0" cy="-168" r="4" />
    <Rect x="-1.5" y="-230" width="3" height="64" />
    <Rect x="-8" y="-72" width="16" height="26" fill="#f6c46b" opacity="0.85" />
  </G>
);

/** Vị trí cảnh trong khung: cảnh 1440 × 820 phủ kín khung theo kiểu "slice" canh đáy giữa */
interface Geo {
  k: number;
  ox: number;
  oy: number;
}

const lerp = (v: Animated.Value, a: number, b: number) => v.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
const lerpDeg = (v: Animated.Value, a: number, b: number) => v.interpolate({ inputRange: [0, 1], outputRange: [`${a}deg`, `${b}deg`] });

/** Lớp SVG phủ toàn cảnh (cùng phép cắt "slice" với nền), có thể gắn chuyển động */
const Full: React.FC<{ style?: any; children: React.ReactNode }> = ({ style, children }) => (
  <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
    <Svg width="100%" height="100%" viewBox="0 0 1440 820" preserveAspectRatio="xMidYMax slice">
      {children}
    </Svg>
  </Animated.View>
);

/** Khung đặt một vật thể tại (x, y) rộng w cao h tính theo tọa độ cảnh */
const Box: React.FC<{ g: Geo; x: number; y: number; w: number; h: number; style?: any; children?: React.ReactNode }> = ({ g, x, y, w, h, style, children }) => (
  <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: g.ox + x * g.k, top: g.oy + y * g.k, width: w * g.k, height: h * g.k }, style]}>
    {children}
  </Animated.View>
);

/** Một lớp SVG nằm gọn trong Box (viewBox theo tọa độ riêng của vật thể) */
const Sub: React.FC<{ vb: string; style?: any; children: React.ReactNode }> = ({ vb, style, children }) => (
  <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
    <Svg width="100%" height="100%" viewBox={vb}>
      {children}
    </Svg>
  </Animated.View>
);

const BOAT_VB = '-4 -210 284 250';
const BURN_VB = '-60 -200 390 310';
const HORSE_VB = '-64 -156 160 160';

const TWINKLE = (seed: number) => {
  const rnd = lcg(seed);
  return Array.from({ length: 14 }, () => ({ x: rnd() * 1440, y: 10 + rnd() * 300, r: 1.4 + rnd() * 1.6 }));
};
const TWINKLE_A = TWINKLE(9);
const TWINKLE_B = TWINKLE(13);

/**
 * Cảnh ba cuộc kháng chiến (vẽ riêng): trời chàm chuyển đỏ – vàng, mặt trời rực sau núi đá; bên trái là cổng thành Thăng Long và kỵ binh Mông Cổ (1258),
 * ở giữa đoàn thuyền chiến cờ đỏ (1285), bên phải bãi cọc, thuyền giặc cháy mắc cọc và cờ phướn trên bờ (1288). Lấp đầy khung cha, canh theo đáy;
 * shade làm tối phía trái để chữ trắng đọc rõ; fade hòa mép trên vào màu xanh mực của khối chữ nằm liền phía trên (màn hẹp).
 * Cảnh gồm nhiều lớp để từng vật thể chuyển động riêng khi đang nằm trong màn hình: thuyền nhấp nhô và lắc, thuyền giặc cháy kèm lửa chập chờn và khói,
 * cờ bay, kỵ binh phi, sao nhấp nháy, tia nắng và quầng mặt trời thở, ánh nước lung linh, chim bay ngang.
 */
export const EpicBackdrop: React.FC<{ shade?: boolean; fade?: boolean }> = ({ shade = false, fade = false }) => {
  const { c } = useTheme();
  const gid = React.useId().replace(/:/g, '');
  const [ref, live] = useOnScreen();
  const [box, setBox] = React.useState({ w: 0, h: 0 });
  const k = box.w > 0 && box.h > 0 ? Math.max(box.w / 1440, box.h / 820) : 0;
  const g: Geo = { k, ox: (box.w - 1440 * k) / 2, oy: box.h - 820 * k };
  const sunOrigin = `${g.ox + SUN.x * k}px ${g.oy + SUN.y * k}px`;

  const bob1 = useLoop(live, 3200);
  const rock1 = useLoop(live, 4300, 300);
  const bob2 = useLoop(live, 2700, 600);
  const rock2 = useLoop(live, 3700, 900);
  const burnBob = useLoop(live, 4100);
  const burnRock = useLoop(live, 3000, 200);
  const flick = useLoop(live, 420);
  const glowPulse = useLoop(live, 1900);
  const sunPulse = useLoop(live, 5200);
  const rays = useLoop(live, 14000);
  const shimmer = useLoop(live, 4600);
  const shimmerOp = useLoop(live, 2300);
  const twA = useLoop(live, 2600);
  const twB = useLoop(live, 3300, 700);
  const waveA = useLoop(live, 1300);
  const waveB = useLoop(live, 1700, 400);
  const gallop = useLoop(live, 440);
  const birds = useDrift(live, 30000);
  const flap = useLoop(live, 520);
  const smoke1 = useDrift(live, 3600);
  const smoke2 = useDrift(live, 3600, 1200);
  const smoke3 = useDrift(live, 3600, 2400);

  const smokeStyle = (v: Animated.Value, dx: number) => ({
    opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] }),
    transform: [{ translateY: lerp(v, 0, -120 * k * 0.6) }, { translateX: lerp(v, 0, dx * k) }, { scale: lerp(v, 0.6, 1.9) }],
    transformOrigin: '53% 52%',
  });
  const horse = (sgn: number) => ({ transform: [{ translateY: lerp(gallop, -2.6 * k * sgn, 2.6 * k * sgn) }] });
  const cloth = (v: Animated.Value, amp: number) => ({ transform: [{ skewY: lerpDeg(v, -amp, amp) }, { scaleX: lerp(v, 0.965, 1.035) }], transformOrigin: '2% 50%' });

  const BANNERS = [
    { x: 1180, top: 530, w: 100, label: 'ĐÔNG A', v: waveA, amp: 5 },
    { x: 1272, top: 474, w: 84, label: undefined, v: waveB, amp: 6 },
    { x: 1352, top: 538, w: 46, label: undefined, v: waveA, amp: 7 },
  ];
  const HORSES = [{ x: 392, y: 584, s: 0.42, sgn: 1 }, { x: 436, y: 588, s: 0.38, sgn: -1 }, { x: 622, y: 586, s: 0.4, sgn: 1 }];

  return (
    <View ref={ref} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 1440 820" preserveAspectRatio="xMidYMax slice" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`s-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.dem} />
            <Stop offset="0.24" stopColor="#1c2f6b" />
            <Stop offset="0.45" stopColor="#5a3a7c" />
            <Stop offset="0.65" stopColor="#c24f55" />
            <Stop offset="0.83" stopColor="#f08a4b" />
            <Stop offset="0.97" stopColor="#ffc46b" />
          </LinearGradient>
        </Defs>
        <Rect x="-600" y="-400" width="2640" height="400" fill={c.dem} />
        <Rect x="-600" y="0" width="2640" height={WATER_Y} fill={`url(#s-${gid})`} />
        {STARS.map((t, i) => (
          <Circle key={i} cx={t.x} cy={t.y} r={t.r} fill="#ffffff" opacity={t.o} />
        ))}
      </Svg>
      <Full style={{ opacity: lerp(twA, 0.12, 1) }}>
        {TWINKLE_A.map((t, i) => (
          <Circle key={i} cx={t.x} cy={t.y} r={t.r} fill="#fff6dc" />
        ))}
      </Full>
      <Full style={{ opacity: lerp(twB, 1, 0.12) }}>
        {TWINKLE_B.map((t, i) => (
          <Circle key={i} cx={t.x} cy={t.y} r={t.r} fill="#fff6dc" />
        ))}
      </Full>
      <Full style={{ opacity: lerp(sunPulse, 0.78, 1), transform: [{ scale: lerp(sunPulse, 0.96, 1.06) }], transformOrigin: sunOrigin }}>
        <Defs>
          <RadialGradient id={`g-${gid}`} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#fff1c1" stopOpacity="0.95" />
            <Stop offset="0.3" stopColor="#ffbe64" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={SUN.x} cy={SUN.y} r="420" fill={`url(#g-${gid})`} />
      </Full>
      <Full style={{ opacity: lerp(rays, 0.55, 1), transform: [{ rotate: lerpDeg(rays, -4, 4) }], transformOrigin: sunOrigin }}>
        <Path d={RAYS} fill="#ffe2a0" opacity="0.07" />
      </Full>
      {k > 0 && (
        <Box g={g} x={0} y={110} w={1440} h={240} style={{ opacity: birds.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 0.85, 0.85, 0] }), transform: [{ translateX: lerp(birds, 0, 1300 * k) }, { translateY: lerp(flap, -7 * k, 7 * k) }] }}>
          <Sub vb="0 0 1440 240">
            {[[60, 70, 1], [118, 104, 0.8], [96, 34, 0.9]].map(([bx, by, bs]) => (
              <Path key={`${bx}-${by}`} d={`M${bx} ${by} q${11 * bs} ${-12 * bs} ${22 * bs} 0 q${11 * bs} ${-12 * bs} ${22 * bs} 0`} fill="none" stroke="#ffe2a0" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
            ))}
          </Sub>
        </Box>
      )}
      <Svg width="100%" height="100%" viewBox="0 0 1440 820" preserveAspectRatio="xMidYMax slice" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`r-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#f0a35a" stopOpacity="0.95" />
            <Stop offset="0.22" stopColor="#7a4b7c" />
            <Stop offset="0.6" stopColor="#26305e" />
            <Stop offset="1" stopColor="#101733" />
          </LinearGradient>
          <LinearGradient id={`f-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.dem} stopOpacity="1" />
            <Stop offset="1" stopColor={c.dem} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {fade && <Rect x="-600" y="0" width="2640" height="300" fill={`url(#f-${gid})`} />}
        <Circle cx={SUN.x} cy={SUN.y} r="82" fill="#fff1c1" />
        <Path d={FAR_PEAKS} fill="#4a3f86" opacity="0.6" />
        <Ellipse cx="720" cy={WATER_Y - 4} rx="900" ry="16" fill="#ffffff" opacity="0.07" />
        <Path d={MID_PEAKS} fill="#262c63" opacity="0.92" />
        <Rect x="-600" y={WATER_Y} width="2640" height="400" fill={`url(#r-${gid})`} />
      </Svg>
      {k > 0 &&
        HORSES.map((h, i) => (
          <Box key={i} g={g} x={h.x - h.s * 64} y={h.y - h.s * 156} w={h.s * 160} h={h.s * 160} style={horse(h.sgn)}>
            <Sub vb={HORSE_VB}>
              <Horseman />
            </Sub>
          </Box>
        ))}
      <Full style={{ opacity: lerp(shimmerOp, 0.6, 1), transform: [{ translateX: lerp(shimmer, -16 * k, 16 * k) }] }}>
        {[70, 52, 38, 26, 16].map((rx, i) => (
          <Ellipse key={rx} cx={SUN.x} cy={WATER_Y + 18 + i * 34} rx={rx * 2.2} ry="5" fill="#ffd9a0" opacity={0.42 - i * 0.07} />
        ))}
      </Full>
      {k > 0 && (
        <>
          <Box g={g} x={540 - 0.95 * 4} y={704 - 0.95 * 210} w={0.95 * 284} h={0.95 * 250} style={{ transform: [{ translateY: lerp(bob1, -6 * k, 6 * k) }, { rotate: lerpDeg(rock1, -2.4, 2.4) }], transformOrigin: '50% 92%' }}>
            <Sub vb={BOAT_VB}>
              <WarBoat />
            </Sub>
          </Box>
          <Box g={g} x={880 - 0.55 * 4} y={662 - 0.55 * 210} w={0.55 * 284} h={0.55 * 250} style={{ transform: [{ translateY: lerp(bob2, -4 * k, 4 * k) }, { rotate: lerpDeg(rock2, -2.8, 2.8) }], transformOrigin: '50% 92%' }}>
            <Sub vb={BOAT_VB}>
              <WarBoat />
            </Sub>
          </Box>
          <Box g={g} x={1030 - 0.6 * 60} y={700 - 0.6 * 200} w={0.6 * 390} h={0.6 * 310} style={{ transform: [{ translateY: lerp(burnBob, -3 * k, 3 * k) }, { rotate: lerpDeg(burnRock, -1.6, 1.6) }], transformOrigin: '50% 78%' }}>
            <Sub vb={BURN_VB} style={{ opacity: lerp(glowPulse, 0.5, 1), transform: [{ scale: lerp(glowPulse, 0.92, 1.1) }], transformOrigin: '52% 64%' }}>
              <BurningGlow tilt={12} />
            </Sub>
            <Sub vb={BURN_VB}>
              <BurningHull tilt={12} />
            </Sub>
            <Sub vb={BURN_VB} style={{ opacity: lerp(flick, 0.72, 1), transform: [{ scaleY: lerp(flick, 0.86, 1.16) }, { scaleX: lerp(flick, 1.05, 0.95) }], transformOrigin: '53% 71%' }}>
              <BurningFlames tilt={12} />
            </Sub>
            {[[smoke1, 14], [smoke2, -12], [smoke3, 20]].map(([v, dx], i) => (
              <Sub key={i} vb={BURN_VB} style={smokeStyle(v as Animated.Value, dx as number)}>
                <Circle cx="146" cy="-60" r="15" fill="#2a2430" />
              </Sub>
            ))}
          </Box>
        </>
      )}
      <Svg width="100%" height="100%" viewBox="0 0 1440 820" preserveAspectRatio="xMidYMax slice" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`d-${gid}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={c.dem} stopOpacity="0.92" />
            <Stop offset="0.65" stopColor={c.dem} stopOpacity="0.5" />
            <Stop offset="1" stopColor={c.dem} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {STAKES.map((s, i) => (
          <G key={i} transform={`translate(${s.x} ${s.y}) rotate(${s.tilt})`}>
            <Path d={`M-3.5 ${s.h} L-3.5 7 L0 0 L3.5 7 L3.5 ${s.h} Z`} fill="#1b1220" />
            <Path d={`M0 0 L3.5 7 L3.5 ${s.h} L1 ${s.h} L1 8 Z`} fill="#6b4a36" opacity="0.7" />
            <Ellipse cx="0" cy={s.h} rx="10" ry="2.4" fill="none" stroke="#f6c46b" strokeOpacity="0.45" />
          </G>
        ))}
        <Path d="M-600 650 C-200 640 250 660 380 708 C440 732 470 784 486 830 H-600 Z" fill="#0c1228" />
        <G transform="translate(150 676) scale(0.95)">
          <Citadel />
        </G>
        <Path d="M2040 640 C1700 626 1250 640 1150 700 C1110 726 1090 780 1082 830 H2040 Z" fill="#0c1228" />
        {BANNERS.map((b) => (
          <BannerPole key={b.x} x={b.x} top={b.top} />
        ))}
        {shade && <Rect x="0" y="0" width="960" height="820" fill={`url(#d-${gid})`} />}
      </Svg>
      {k > 0 &&
        BANNERS.map((b) => (
          <Box key={b.x} g={g} x={b.x + 1} y={b.top - 20} w={b.w + 4} h={118} style={cloth(b.v, b.amp)}>
            <Sub vb={`-4 -20 ${b.w + 4} 118`}>
              <BannerCloth w={b.w} label={b.label} />
            </Sub>
          </Box>
        ))}
      {k > 0 && (
        <Box g={g} x={150 - 0.95 * 4} y={676 - 0.95 * 236} w={0.95 * 52} h={0.95 * 36} style={{ transform: [{ skewY: lerpDeg(waveB, -7, 7) }, { scaleX: lerp(waveB, 0.95, 1.06) }], transformOrigin: '5% 50%' }}>
          <Sub vb="-4 -236 52 36">
            <Path d="M1.5 -230 L42 -220 L1.5 -206 Z" fill="#c1272d" />
          </Sub>
        </Box>
      )}
    </View>
  );
};

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

/** Dải họa tiết sóng nước (seigaiha) làm viền trang trí: nền bg, nét line */
export const WaveBand: React.FC<{ bg: string; line: string; height?: number }> = ({ bg, line, height = 48 }) => {
  const gid = React.useId().replace(/:/g, '');
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ width: '100%', height, backgroundColor: bg, overflow: 'hidden' }}>
      <Svg width="100%" height={height}>
        <Defs>
          <Pattern id={`w-${gid}`} width="48" height="24" patternUnits="userSpaceOnUse">
            <G fill={bg} stroke={line} strokeWidth="1.4">
              {[[24, 12], [0, 24], [48, 24]].map(([cx, cy]) => (
                <G key={`${cx}-${cy}`}>
                  <Circle cx={cx} cy={cy} r="18" />
                  <Circle cx={cx} cy={cy} r="12" />
                  <Circle cx={cx} cy={cy} r="6" />
                </G>
              ))}
            </G>
          </Pattern>
        </Defs>
        <Rect width="100%" height={height} fill={`url(#w-${gid})`} />
      </Svg>
    </View>
  );
};

/** Ấn đỏ khắc chữ (như dấu triện): ô vuông viền kép nghiêng nhẹ, chữ xuống dòng bằng \n */
export const Seal: React.FC<{ text: string; size?: number; color?: string; fg?: string }> = ({ text, size = 72, color = '#c1272d', fg = '#fff7e6' }) => {
  const lines = text.split('\n');
  const fs = lines.length > 1 ? 24 : 36;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={text.replace('\n', ' ')} style={{ width: size, height: size, transform: [{ rotate: '-6deg' }] }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x="3" y="3" width="94" height="94" rx="10" fill={color} />
        <Rect x="10" y="10" width="80" height="80" rx="6" fill="none" stroke={fg} strokeWidth="3" />
        {lines.map((l, i) => (
          <SvgText key={l} x="50" y={50 + (i - (lines.length - 1) / 2) * 34 + fs * 0.35} textAnchor="middle" fontSize={fs} fontFamily={FONT.displayHeavy} fill={fg}>
            {l}
          </SvgText>
        ))}
      </Svg>
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

/** Logo "Đông A edu": biểu tượng chiến binh kèm tên chữ Manrope (light: chữ trắng cho nền tối) */
export const BrandLogo: React.FC<{ compact?: boolean; subtitle?: string; light?: boolean }> = ({ compact = false, subtitle, light = false }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessible accessibilityRole="header" accessibilityLabel={subtitle ? `Đông A edu – ${subtitle}` : 'Đông A edu'}>
      <Image source={LOGO_MARK} accessibilityIgnoresInvertColors style={{ width: 44, height: 44, borderRadius: 12 }} />
      {!compact && (
        <View>
          <Text style={{ fontFamily: FONT.heavy, fontSize: 21, lineHeight: 25, letterSpacing: -0.3, color: light ? '#ffffff' : c.muc }}>
            Đông A
            <Text style={{ fontFamily: FONT.semibold, fontSize: 14, letterSpacing: 0, color: light ? '#ffd479' : c.sonChu }}> edu</Text>
          </Text>
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

/** Huy hiệu bang hội của Khối 6 – 9 (cấp độ trong game): khiên màu có số khối, tên bang tùy chọn */
export const GradeBadge: React.FC<{ grade: number | null; size?: number; showName?: boolean; count?: number }> = ({ grade, size = 40, showName = false, count }) => {
  const { c } = useTheme();
  const g = grade ? GRADE_STYLE[grade as Grade] : undefined;
  if (!g) return null;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Khối ${grade} – ${g.name}${count === undefined ? '' : `: ${count}`}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <Svg width={size} height={size * 1.1} viewBox="0 0 100 110">
        <Path d="M50 6 L92 20 V54 C92 80 72 98 50 108 C28 98 8 80 8 54 V20 Z" fill={g.edge} />
        <Path d="M50 0 L92 14 V48 C92 74 72 92 50 102 C28 92 8 74 8 48 V14 Z" fill={g.bg} />
        <Path d="M50 10 L82 21 V48 C82 67 67 81 50 89 C33 81 18 67 18 48 V21 Z" fill="rgba(255,255,255,0.25)" />
        <SvgText x="50" y="68" textAnchor="middle" fontSize="50" fontFamily={FONT.displayHeavy} fill={g.fg}>
          {String(grade)}
        </SvgText>
      </Svg>
      {(showName || count !== undefined) && (
        <View style={{ flexShrink: 1 }}>
          {count !== undefined && <Text style={{ fontFamily: FONT.displayHeavy, fontSize: 22, lineHeight: 26, color: c.muc }}>{count}</Text>}
          <Text style={{ fontFamily: FONT.bold, fontSize: 12, color: c.muc2 }} numberOfLines={1}>
            Khối {grade}
            {showName ? ` · ${g.name}` : ''}
          </Text>
        </View>
      )}
    </View>
  );
};

const ART = {
  ink: '#3b2a1a',
  roof: '#a33b1f',
  roofShade: '#7c2d12',
  gold: '#d97706',
  goldLight: '#fbbf24',
  thatch: '#d9a54c',
  thatchShade: '#b7832f',
  wall: '#f6e7c8',
  wallShade: '#e6cfa0',
  pillar: '#b91c1c',
  wood: '#8b5a2b',
  woodDark: '#6b4220',
  water: '#7cc7dc',
  waterDeep: '#3e9cc4',
  stone: '#cfc2a8',
  rice: '#4caf50',
  riceGold: '#e0b03a',
};

/** Mái cong đầu đao: đáy từ (l,b) tới (r,b), nóc từ (l+d,t) tới (r-d,t) */
const curvedRoof = (l: number, r: number, b: number, t: number, d: number) =>
  `M${l - 6} ${b - 7} Q${l} ${b + 1} ${l + 10} ${b} L${r - 10} ${b} Q${r} ${b + 1} ${r + 6} ${b - 7} L${r - d} ${t} L${l + d} ${t} Z`;

const Shadow: React.FC<{ rx?: number }> = ({ rx = 50 }) => <Ellipse cx="60" cy="92" rx={rx} ry="6.5" fill="rgba(40,25,10,0.22)" />;

const Scaffold: React.FC = () => (
  <G>
    <Shadow rx={40} />
    <Path d="M22 86 L60 70 L98 86 L60 98 Z" fill="none" stroke={ART.wood} strokeWidth="2.5" strokeDasharray="5 4" />
    <G stroke={ART.woodDark} strokeWidth="4" strokeLinecap="round">
      <Path d="M36 84 V44" />
      <Path d="M84 84 V44" />
      <Path d="M32 50 H88" />
      <Path d="M36 80 L84 50" />
    </G>
    <Rect x="46" y="22" width="28" height="18" rx="4" fill={ART.wall} stroke={ART.ink} strokeWidth="2.5" />
    <Path d="M60 40 V52" stroke={ART.woodDark} strokeWidth="3" />
    <Path d="M53 28 l14 6 M53 34 l14 -6" stroke={ART.pillar} strokeWidth="2.5" strokeLinecap="round" />
  </G>
);

const RiceTufts: React.FC<{ gold: boolean }> = ({ gold }) => {
  const color = gold ? ART.riceGold : ART.rice;
  const dark = gold ? '#a77b14' : '#2e7d32';
  const tufts: Array<[number, number]> = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) tufts.push([24 + c * 12 + r * 5, 58 + r * 6 - c * 2.2]);
  return (
    <G strokeLinecap="round">
      {tufts.map(([x, y], i) => (
        <G key={i}>
          <Path d={`M${x} ${y} l-3 -7 M${x} ${y} l0 -8 M${x} ${y} l3 -7`} stroke={dark} strokeWidth="2.6" />
          <Path d={`M${x} ${y} l-3 -7 M${x} ${y} l0 -8 M${x} ${y} l3 -7`} stroke={color} strokeWidth="1.6" />
        </G>
      ))}
    </G>
  );
};

const SpriteRuong: React.FC<{ level: number; full: boolean }> = ({ level, full }) => (
  <G>
    <Shadow rx={54} />
    <Path d="M6 66 L58 46 L114 62 L62 86 Z" fill="#a8763e" stroke={ART.ink} strokeWidth="2.5" strokeLinejoin="round" />
    <Path d="M13 66 L58 49 L107 62 L62 81 Z" fill={ART.water} />
    <Path d="M18 66 L58 51 L100 62" fill="none" stroke="#bfe8f3" strokeWidth="1.6" opacity="0.8" />
    <Path d="M36 58 L84 73" stroke="#a8763e" strokeWidth="3" />
    <RiceTufts gold={full} />
    <G transform="translate(80 18)">
      <Rect x="2" y="16" width="26" height="16" fill={ART.wall} stroke={ART.ink} strokeWidth="2.2" />
      <Path d="M-4 18 L15 2 L34 18 Z" fill={ART.thatch} stroke={ART.ink} strokeWidth="2.2" strokeLinejoin="round" />
      <Path d="M4 15 L15 6 L26 15" fill="none" stroke={ART.thatchShade} strokeWidth="1.8" />
      <Rect x="11" y="22" width="8" height="10" fill={ART.woodDark} />
    </G>
    {level >= 3 && <Path d="M8 40 q6 -10 12 0" fill="none" stroke="#2e7d32" strokeWidth="3" strokeLinecap="round" />}
  </G>
);

const SpriteTrai: React.FC<{ level: number }> = ({ level }) => (
  <G>
    <Shadow />
    <Rect x="22" y="50" width="76" height="32" rx="2" fill={ART.wall} stroke={ART.ink} strokeWidth="2.5" />
    <Rect x="22" y="72" width="76" height="10" fill={ART.wallShade} />
    <Path d="M12 54 L34 28 L86 28 L108 54 Z" fill={ART.thatch} stroke={ART.ink} strokeWidth="2.5" strokeLinejoin="round" />
    <G stroke={ART.thatchShade} strokeWidth="2" fill="none">
      <Path d="M24 46 L40 33" />
      <Path d="M44 46 L52 33" />
      <Path d="M66 46 L68 33" />
      <Path d="M86 46 L82 33" />
    </G>
    <Rect x="52" y="62" width="16" height="20" rx="2" fill={ART.woodDark} />
    <G stroke={ART.woodDark} strokeWidth="2.6" strokeLinecap="round">
      <Path d="M10 84 V40" />
      <Path d="M16 84 V38" />
    </G>
    <Path d="M7 40 l3 -8 l3 8 Z M13 38 l3 -8 l3 8 Z" fill="#94a3b8" stroke={ART.ink} strokeWidth="1.4" />
    <Path d="M104 86 V18" stroke={ART.woodDark} strokeWidth="3" strokeLinecap="round" />
    <Path d="M105 19 q10 4 18 0 q-4 7 0 13 q-9 4 -18 0 Z" fill={ART.pillar} stroke={ART.ink} strokeWidth="1.8" strokeLinejoin="round" />
    {level >= 3 && <Circle cx="114" cy="26" r="2.5" fill={ART.goldLight} />}
  </G>
);

const SpriteKho: React.FC<{ level: number }> = ({ level }) => (
  <G>
    <Shadow rx={42} />
    <G stroke={ART.woodDark} strokeWidth="4" strokeLinecap="round">
      <Path d="M36 88 V64" />
      <Path d="M84 88 V64" />
      <Path d="M50 90 V64" />
      <Path d="M70 90 V64" />
    </G>
    <Rect x="28" y="60" width="64" height="6" rx="2" fill={ART.wood} stroke={ART.ink} strokeWidth="2" />
    <Rect x="34" y="38" width="52" height="24" fill={ART.wall} stroke={ART.ink} strokeWidth="2.5" />
    <Path d="M24 42 L60 10 L96 42 Z" fill={ART.thatch} stroke={ART.ink} strokeWidth="2.5" strokeLinejoin="round" />
    <Path d="M36 36 L60 16 L84 36" fill="none" stroke={ART.thatchShade} strokeWidth="2" />
    <Circle cx="60" cy="50" r="7.5" fill={ART.goldLight} stroke={ART.ink} strokeWidth="2" />
    <Path d="M60 47 v5" stroke={ART.ink} strokeWidth="2.4" strokeLinecap="round" />
    <Circle cx="60" cy="46.5" r="1.8" fill={ART.ink} />
    {level >= 3 && <Path d="M30 70 h60" stroke={ART.gold} strokeWidth="2" />}
  </G>
);

const SpriteXuong: React.FC<{ level: number }> = ({ level }) => {
  const tip = level >= 2 ? '#94a3b8' : '#e6cfa0';
  return (
    <G>
      <Shadow />
      {level >= 3 && (
        <G>
          <Path d="M4 82 Q60 70 116 82 L116 94 Q60 86 4 94 Z" fill={ART.water} />
          {[16, 34, 52, 70, 88, 104].map((x) => (
            <Path key={x} d={`M${x} 90 l3 -14 l3 14`} fill={ART.wood} stroke={ART.ink} strokeWidth="1.4" />
          ))}
        </G>
      )}
      <G stroke={ART.woodDark} strokeWidth="4" strokeLinecap="round">
        <Path d="M18 80 V36" />
        <Path d="M102 80 V36" />
      </G>
      <Path d={curvedRoof(14, 106, 38, 18, 18)} fill={ART.thatch} stroke={ART.ink} strokeWidth="2.5" strokeLinejoin="round" />
      {[0, 1, 2, 3, 4].map((i) => (
        <G key={i} transform={`translate(${34 + i * 11} ${44 + (i % 2) * 3}) rotate(${-14 + i * 6})`}>
          <Rect x="-3" y="0" width="6" height="34" rx="1.5" fill={ART.wood} stroke={ART.ink} strokeWidth="1.6" />
          <Path d="M-3 0 L0 -9 L3 0 Z" fill={tip} stroke={ART.ink} strokeWidth="1.6" strokeLinejoin="round" />
        </G>
      ))}
      <Path d="M22 80 h76" stroke={ART.woodDark} strokeWidth="5" strokeLinecap="round" />
    </G>
  );
};

const SpriteBen: React.FC<{ level: number }> = ({ level }) => (
  <G>
    <Path d="M0 62 Q60 50 120 62 L120 100 L0 100 Z" fill={ART.water} />
    <Path d="M10 70 q8 -4 16 0 t16 0 M64 76 q8 -4 16 0 t16 0" fill="none" stroke="#d4f0f8" strokeWidth="2" strokeLinecap="round" />
    <G stroke={ART.woodDark} strokeWidth="3.5" strokeLinecap="round">
      <Path d="M14 92 V58" />
      <Path d="M34 92 V58" />
    </G>
    <Path d="M6 58 H44 V64 H6 Z" fill={ART.wood} stroke={ART.ink} strokeWidth="2" />
    <G transform="translate(52 34)">
      <Path d="M0 40 Q30 52 62 40 L56 50 Q30 58 6 50 Z" fill={ART.wood} stroke={ART.ink} strokeWidth="2.4" strokeLinejoin="round" />
      <Path d="M30 40 V2" stroke={ART.woodDark} strokeWidth="3" />
      <Path d="M31 4 Q50 18 31 36 Z" fill={ART.wall} stroke={ART.ink} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M31 16 Q42 20 31 26" fill="none" stroke={ART.pillar} strokeWidth="3" />
      {level >= 2 && <Path d="M29 6 Q14 18 29 32 Z" fill={ART.wallShade} stroke={ART.ink} strokeWidth="2" />}
      <Path d="M8 44 l-8 8 M54 44 l8 8" stroke={ART.woodDark} strokeWidth="2.5" strokeLinecap="round" />
    </G>
  </G>
);

const SpriteDoanh: React.FC<{ level: number }> = ({ level }) => {
  const flags = ['#0369a1', '#15803d', '#a16207', '#c2410c', '#7e22ce'];
  return (
    <G>
      <Shadow rx={54} />
      {[
        [8, 58, 1],
        [40, 46, 1.2],
        [78, 58, 1],
      ].map(([x, y, s], i) => (
        <G key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <Path d="M0 28 L17 0 L34 28 Z" fill={i === 1 ? ART.wall : ART.wallShade} stroke={ART.ink} strokeWidth="2.2" strokeLinejoin="round" />
          <Path d="M17 0 L17 28" stroke={ART.ink} strokeWidth="1.6" />
          <Path d="M12 28 L17 16 L22 28 Z" fill={ART.woodDark} />
        </G>
      ))}
      {flags.slice(0, 3 + Math.min(2, level - 1)).map((c, i) => (
        <G key={c} transform={`translate(${18 + i * 21} 14)`}>
          <Path d="M0 36 V0" stroke={ART.woodDark} strokeWidth="2.4" strokeLinecap="round" />
          <Path d="M1 1 q8 3 14 0 q-3 5 0 10 q-7 3 -14 0 Z" fill={c} stroke={ART.ink} strokeWidth="1.4" strokeLinejoin="round" />
        </G>
      ))}
    </G>
  );
};

const SpriteHoiQuan: React.FC<{ level: number }> = ({ level }) => (
  <G>
    <Shadow rx={52} />
    <Path d="M14 86 H106 L100 78 H20 Z" fill={ART.stone} stroke={ART.ink} strokeWidth="2.2" strokeLinejoin="round" />
    <Rect x="24" y="52" width="72" height="26" fill={ART.wall} stroke={ART.ink} strokeWidth="2.4" />
    {[30, 50, 70, 88].map((x) => (
      <Rect key={x} x={x - 3} y="52" width="6" height="26" fill={ART.pillar} stroke={ART.ink} strokeWidth="1.4" />
    ))}
    <Rect x="52" y="60" width="16" height="18" fill={ART.woodDark} />
    <Path d={curvedRoof(16, 104, 54, 38, 14)} fill={ART.roof} stroke={ART.ink} strokeWidth="2.4" strokeLinejoin="round" />
    <Path d="M24 50 H96" stroke={ART.roofShade} strokeWidth="2" />
    <Rect x="34" y="30" width="52" height="10" fill={ART.wall} stroke={ART.ink} strokeWidth="2" />
    <Path d={curvedRoof(28, 92, 32, 14, 12)} fill={ART.roof} stroke={ART.ink} strokeWidth="2.4" strokeLinejoin="round" />
    <Path d="M40 14 H80" stroke={ART.gold} strokeWidth="3.5" strokeLinecap="round" />
    <Path d="M40 14 q-6 -6 -2 -10 M80 14 q6 -6 2 -10" fill="none" stroke={ART.gold} strokeWidth="3" strokeLinecap="round" />
    {level >= 2 && <Circle cx="60" cy="10" r="4" fill={ART.goldLight} stroke={ART.ink} strokeWidth="1.5" />}
  </G>
);

const SpriteQTG: React.FC<{ level: number }> = ({ level }) => (
  <G>
    <Shadow rx={52} />
    <Path d="M10 88 H110 L104 80 H16 Z" fill={ART.stone} stroke={ART.ink} strokeWidth="2.2" strokeLinejoin="round" />
    {[
      [14, 54, 32],
      [74, 54, 32],
    ].map(([x, y, w]) => (
      <G key={x}>
        <Rect x={x} y={y} width={w} height={26} fill={ART.wall} stroke={ART.ink} strokeWidth="2.2" />
        <Path d={curvedRoof(x - 2, x + w + 2, y + 2, y - 12, 8)} fill={ART.roof} stroke={ART.ink} strokeWidth="2.2" strokeLinejoin="round" />
      </G>
    ))}
    <Rect x="42" y="40" width="36" height="40" fill={ART.wall} stroke={ART.ink} strokeWidth="2.4" />
    <Path d="M50 80 V58 a10 10 0 0 1 20 0 V80 Z" fill={ART.woodDark} />
    <Path d={curvedRoof(36, 84, 42, 22, 10)} fill={ART.roof} stroke={ART.ink} strokeWidth="2.4" strokeLinejoin="round" />
    <Rect x="50" y="10" width="20" height="13" rx="2" fill={ART.pillar} stroke={ART.ink} strokeWidth="2" />
    <Path d="M54 16.5 h12" stroke={ART.goldLight} strokeWidth="2.5" strokeLinecap="round" />
    {level >= 2 && <Path d="M38 22 h44" stroke={ART.gold} strokeWidth="3" strokeLinecap="round" />}
  </G>
);

/** Hình công trình trên Điền Trang */
export const BuildingSprite: React.FC<{ id: BuildingId; level: number; full?: boolean; size?: number }> = ({ id, level, full = false, size = 120 }) => (
  <Svg viewBox="0 0 120 100" width={size} height={(size * 100) / 120} style={{ overflow: 'visible' }}>
    {level <= 0 ? (
      <Scaffold />
    ) : id === 'ruong' ? (
      <SpriteRuong level={level} full={full} />
    ) : id === 'trai' ? (
      <SpriteTrai level={level} />
    ) : id === 'kho' ? (
      <SpriteKho level={level} />
    ) : id === 'xuong' ? (
      <SpriteXuong level={level} />
    ) : id === 'ben' ? (
      <SpriteBen level={level} />
    ) : id === 'doanh' ? (
      <SpriteDoanh level={level} />
    ) : id === 'hoiquan' ? (
      <SpriteHoiQuan level={level} />
    ) : (
      <SpriteQTG level={level} />
    )}
  </Svg>
);

/** Nền bàn Điền Trang: đồng cỏ, đường đất, sông, lũy tre */
export const FarmBoardArt: React.FC<{ dark: boolean }> = ({ dark }) => {
  const gid = React.useId().replace(/:/g, '');
  const grassA = dark ? '#2c4a37' : '#a6cf86';
  const grassB = dark ? '#21382a' : '#88bb66';
  const path = dark ? '#5b4a32' : '#e3c690';
  const water = dark ? '#1d4e6b' : '#7cc7dc';
  const waterB = dark ? '#173e56' : '#5fb2d0';
  const tree = dark ? '#1f3b2a' : '#4f8f3a';
  const treeLight = dark ? '#2f5a3f' : '#6aac4c';
  const trees: Array<[number, number, number]> = [
    [30, 300, 22],
    [56, 286, 16],
    [570, 300, 20],
    [548, 288, 15],
    [300, 26, 18],
    [328, 20, 14],
    [270, 24, 13],
    [580, 210, 16],
    [20, 200, 15],
    [210, 400, 14],
    [392, 402, 16],
  ];
  return (
    <Svg viewBox="0 0 600 600" width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={`g-${gid}`} cx="50%" cy="40%" r="70%">
          <Stop offset="0%" stopColor={grassA} />
          <Stop offset="100%" stopColor={grassB} />
        </RadialGradient>
        <LinearGradient id={`w-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={water} />
          <Stop offset="100%" stopColor={waterB} />
        </LinearGradient>
        <Pattern id={`t-${gid}`} width="44" height="44" patternUnits="userSpaceOnUse">
          <Path d="M8 30 l3 -7 l3 7 M28 14 l3 -7 l3 7" fill="none" stroke={dark ? '#3c6149' : '#7cae5b'} strokeWidth="2" strokeLinecap="round" />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="600" height="600" rx="40" fill={`url(#g-${gid})`} />
      <Rect x="0" y="0" width="600" height="600" rx="40" fill={`url(#t-${gid})`} />
      <Path d="M0 470 C120 430 220 470 320 452 C420 434 500 400 600 420 L600 560 Q600 600 560 600 L40 600 Q0 600 0 560 Z" fill={`url(#w-${gid})`} />
      <Path d="M0 470 C120 430 220 470 320 452 C420 434 500 400 600 420" fill="none" stroke={dark ? '#4d6f5a' : '#d9c48e'} strokeWidth="10" opacity="0.8" />
      <G stroke={dark ? '#3a7194' : '#d8f1f8'} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8">
        <Path d="M60 520 q14 -8 28 0 t28 0" />
        <Path d="M260 540 q14 -8 28 0 t28 0" />
        <Path d="M430 500 q14 -8 28 0 t28 0" />
      </G>
      <G stroke={path} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.95">
        <Path d="M110 190 C170 240 220 250 300 245 C380 240 430 230 490 190" />
        <Path d="M300 245 L300 390" />
        <Path d="M120 300 C180 330 240 340 300 330 C360 320 420 330 480 300" />
        <Path d="M110 480 C130 420 180 400 240 392" />
        <Path d="M480 480 C470 430 420 400 360 392" />
      </G>
      {trees.map(([x, y, r], i) => (
        <G key={i}>
          <Circle cx={x} cy={y + r * 0.35} r={r} fill={tree} />
          <Circle cx={x - r * 0.25} cy={y} r={r * 0.75} fill={treeLight} />
        </G>
      ))}
    </Svg>
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

/** Lược đồ Đại Việt thời Trần (minh họa, không theo tỉ lệ) */
export const SchematicMap: React.FC<{
  pins?: PlaceId[];
  labels?: PlaceId[];
  selectable?: PlaceId[];
  selected?: PlaceId | null;
  correct?: PlaceId | null;
  wrong?: PlaceId | null;
  highlight?: PlaceId | null;
  routes?: Array<{ path: string; enemy?: boolean }>;
  onSelect?: (id: PlaceId) => void;
  dark?: boolean;
  title?: string;
}> = ({ pins = [], labels, selectable = [], selected = null, correct = null, wrong = null, highlight = null, routes = [], onSelect, dark = false, title = 'Lược đồ Đại Việt thời Trần' }) => {
  const gid = React.useId().replace(/:/g, '');
  const land = dark ? '#1e2a3d' : '#f1e5c7';
  const land2 = dark ? '#243349' : '#e9d9b2';
  const sea = dark ? '#0e2238' : '#cfe8f1';
  const river = dark ? '#3b82a6' : '#6cb9d8';
  const ink = dark ? '#e7dcc4' : '#3b2a1a';
  const shown = new Set<PlaceId>([...pins, ...selectable]);
  const labelSet = new Set<PlaceId>(labels ?? [...shown]);
  const coast =
    'M0 0 H440 V150 C428 160 412 176 400 186 C386 196 372 204 360 214 C350 226 342 240 330 252 C318 264 304 274 296 284 C286 298 280 312 274 322 C264 338 254 352 246 366 C236 384 228 400 222 418 C216 438 216 458 224 474 C232 490 240 506 248 520 H0 Z';
  return (
    <View style={{ width: '100%', aspectRatio: 440 / 520 }} accessible={!onSelect} accessibilityRole="image" accessibilityLabel={title}>
    <Svg viewBox="0 0 440 520" width="100%" height="100%">
      <Defs>
        <Marker id={`a-${gid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <Path d="M0 0 L10 5 L0 10 Z" fill="#b91c1c" />
        </Marker>
        <Marker id={`b-${gid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <Path d="M0 0 L10 5 L0 10 Z" fill="#0f766e" />
        </Marker>
        <Pattern id={`s-${gid}`} width="40" height="22" patternUnits="userSpaceOnUse">
          <Path d="M0 14 q10 -8 20 0 t20 0" fill="none" stroke={dark ? '#1c3a57' : '#b5dbe8'} strokeWidth="1.6" />
        </Pattern>
      </Defs>
      <Rect width="440" height="520" fill={sea} />
      <Rect width="440" height="520" fill={`url(#s-${gid})`} />
      <Path d={coast} fill={land} stroke={dark ? '#4b5d78' : '#c9b588'} strokeWidth="2" />
      <Path d="M0 0 H200 C170 60 120 110 60 140 C40 150 20 156 0 160 Z" fill={land2} opacity="0.8" />
      {[
        [404, 206, 9, 4],
        [418, 220, 7, 3.5],
        [396, 224, 6, 3],
      ].map(([x, y, rx, ry]) => (
        <Ellipse key={`${x}-${y}`} cx={x} cy={y} rx={rx} ry={ry} fill={land} stroke={dark ? '#4b5d78' : '#c9b588'} strokeWidth="1.5" />
      ))}
      <G fill="none" stroke={river} strokeLinecap="round">
        <Path d="M18 40 C70 90 120 140 160 180 C176 196 186 212 192 228 C206 262 228 292 266 330" strokeWidth="5" />
        <Path d="M190 200 C210 190 228 180 246 176" strokeWidth="3.5" />
        <Path d="M246 176 C262 184 274 192 286 200 C304 214 320 228 340 246" strokeWidth="4" />
        <Path d="M282 128 C270 145 258 160 248 174" strokeWidth="3" />
        <Path d="M112 384 C150 394 182 408 216 422" strokeWidth="3.5" />
      </G>
      <G fill={dark ? '#3a4a68' : '#c8b07c'} stroke={dark ? '#56698a' : '#a68d55'} strokeWidth="1.5" strokeLinejoin="round">
        {[
          [96, 92],
          [126, 70],
          [58, 128],
          [318, 150],
          [300, 88],
          [80, 300],
          [110, 250],
        ].map(([x, y]) => (
          <Path key={`${x}-${y}`} d={`M${x - 12} ${y + 8} L${x} ${y - 10} L${x + 12} ${y + 8} Z`} />
        ))}
      </G>
      {routes.map((r, i) => (
        <Path
          key={i}
          d={r.path}
          fill="none"
          stroke={r.enemy ? '#b91c1c' : '#0f766e'}
          strokeWidth="3"
          strokeDasharray="8 6"
          strokeLinecap="round"
          markerEnd={`url(#${r.enemy ? 'a' : 'b'}-${gid})`}
          opacity="0.9"
        />
      ))}
      {[...shown].map((id) => {
        const p = MAP_PLACES[id];
        const isSel = selected === id;
        const isOk = correct === id;
        const isBad = wrong === id;
        const isHi = highlight === id;
        const pickable = selectable.includes(id) && !!onSelect;
        const fill = isOk ? '#0f766e' : isBad ? '#b91c1c' : isSel ? '#d97706' : isHi ? '#b91c1c' : dark ? '#e7dcc4' : '#3b2a1a';
        const anchor = p.anchor ?? 'start';
        const tx = anchor === 'end' ? p.x - 11 : anchor === 'middle' ? p.x : p.x + 11;
        return (
          <G
            key={id}
            onPress={pickable ? () => onSelect?.(id) : undefined}
          >
            {pickable && <Circle cx={p.x} cy={p.y} r="22" fill="transparent" />}
            {(isSel || isHi || isOk || isBad) && <Circle cx={p.x} cy={p.y} r="13" fill={fill} opacity="0.22" />}
            <Circle cx={p.x} cy={p.y} r={pickable ? 8 : 6} fill={fill} stroke={dark ? '#0b1220' : '#fffdf7'} strokeWidth="2.5" />
            {labelSet.has(id) && (
              <G>
                <SvgText x={tx} y={p.y + 4 + (p.dy ?? 0)} textAnchor={anchor} fontSize="13" fontFamily={FONT.bold} fill="none" stroke={dark ? '#0b1220' : '#fffdf7'} strokeWidth="3.5" strokeLinejoin="round">
                  {p.name}
                </SvgText>
                <SvgText x={tx} y={p.y + 4 + (p.dy ?? 0)} textAnchor={anchor} fontSize="13" fontFamily={FONT.bold} fill={ink}>
                  {p.name}
                </SvgText>
              </G>
            )}
          </G>
        );
      })}
      <SvgText x="12" y="508" fontSize="11" fill={ink} opacity="0.75" fontFamily={FONT.body}>
        Lược đồ minh họa – không theo tỉ lệ
      </SvgText>
      <G transform="translate(410 470)" fill={ink} opacity="0.8">
        <Path d="M0 -18 L5 0 L0 -4 L-5 0 Z" />
        <SvgText y="14" textAnchor="middle" fontSize="11" fontFamily={FONT.bold}>
          B
        </SvgText>
      </G>
    </Svg>
    </View>
  );
};
