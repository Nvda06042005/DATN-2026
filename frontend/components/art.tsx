/**
 * Hình vẽ của Đông A (react-native-svg, sắc nét ở mọi kích thước): Rồng Con, ô đáp án Kahoot, huy hiệu tướng/quân địch,
 * công trình Điền Trang, nền chiến trận, lược đồ Đại Việt thời Trần (minh họa, không theo tỉ lệ), ảnh pixel của Hành Trình Đông A.
 * Không vẽ chân dung nhân vật lịch sử có thật.
 */
import React from 'react';
import { Animated, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Marker, Path, Pattern, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Crown } from 'lucide-react-native';
import { ELEMENTS, ENEMY_TYPES, MAP_PLACES } from '@/constants/game';
import { ANSWER_STYLES, FONT, type AnswerShape } from '@/constants/theme';
import { useBob } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import type { PixelPaths } from '@/lib/pixel-art';
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

/** Logo "Đông A": ấn triện son đỏ có Rồng Con, chữ Baloo 2 */
export const BrandLogo: React.FC<{ compact?: boolean; subtitle?: string; light?: boolean }> = ({ compact = false, subtitle, light = false }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessible accessibilityRole="header" accessibilityLabel={subtitle ? `Đông A – ${subtitle}` : 'Đông A'}>
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#b91c1c', borderWidth: 2, borderColor: '#fde68a', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: '#7f1d1d' }}>
        <Mascot size={38} mood="happy" accessory="helmet" title="Đông A" />
      </View>
      {!compact && (
        <View>
          <Text style={{ fontFamily: FONT.displayHeavy, fontSize: 24, lineHeight: 28, color: light ? '#ffffff' : c.sonChu }}>Đông A</Text>
          {subtitle && (
            <Text style={{ fontFamily: FONT.bold, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: light ? 'rgba(255,255,255,0.85)' : c.muc2 }}>{subtitle}</Text>
          )}
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
