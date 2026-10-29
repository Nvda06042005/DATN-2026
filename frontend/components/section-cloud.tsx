/**
 * Mép mây nối hai khối: ba dáng lượn, hai hướng, trôi nhẹ khi nằm trong màn hình. Hai kiểu theo React Bits:
 * - Sound Lab (`sound`): đám mây màu của khối liền kề, phát tiếng gió mềm (lib/sfx.ts) khi người dùng lướt tới;
 * - Shape Magic (`material="gold"`): đám mây vàng be nhạt hơn vàng logo một chút, tô như chất liệu vàng bóng 3D (chuyển sắc, viền sáng, mép đậm, bóng đổ).
 */
import { useEffect, useId, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';
import { useLoop, useOnScreen } from '@/components/motion';
import { useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { playWhoosh } from '@/lib/sfx';

const CRESTS = [
  'M0 80 C0 20 42 18 52 65 C54 -15 102 -15 112 64 C124 9 174 12 180 67 C190 32 220 30 220 80',
  'M0 82 C0 40 25 27 38 66 C32 -12 83 -18 98 62 C110 7 150 10 154 70 C170 15 214 12 220 82',
  'M0 84 C0 3 51 -4 62 65 C75 35 97 33 108 66 C114 -15 165 -15 179 64 C194 29 220 30 220 84',
] as const;

/** Tiếng gió theo từng dáng mây: dáng to thì thấp và dài hơn */
const WHOOSH = [
  { pitch: 640, length: 0.75 },
  { pitch: 560, length: 0.85 },
  { pitch: 470, length: 0.95 },
] as const;

/** Vàng be nhạt hơn vàng logo (`logoGold` #dfb66f pha thêm khoảng 35% trắng): đầu mây đậm hơn một chút, gốc mây sáng hơn */
const GOLD = { tip: '#e4c488', base: '#f4e6c3', edge: '#c9a05a' };

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

  // Sound Lab: phát tiếng gió khi đám mây vừa đi vào màn hình (bỏ qua lần hiện đầu tiên lúc trang vừa mở)
  const wasHidden = useRef(false);
  useEffect(() => {
    if (!visible) {
      wasHidden.current = true;
      return;
    }
    if (sound && wasHidden.current && !reduce) {
      wasHidden.current = false;
      playWhoosh({ dir: direction === 'up' ? 'up' : 'down', ...WHOOSH[variant] });
    }
  }, [visible, sound, reduce, direction, variant]);

  return (
    <View
      ref={ref}
      pointerEvents="none"
      accessible={false}
      aria-hidden
      testID={`section-cloud-${direction}-${variant}`}
      style={{ width: '100%', height, zIndex: 3, overflow: 'hidden', ...(direction === 'down' ? { marginBottom: -height } : { marginTop: -height }) }}
    >
      <Animated.View testID="section-cloud-motion" style={{ position: 'absolute', top: 0, left: -40, right: -40, height, transform: [{ translateX: motion.interpolate({ inputRange: [0, 1], outputRange: [-14 - variant * 3, 14 + variant * 3] }) }, { scaleY: direction === 'down' ? -1 : 1 }] }}>
        <Svg width="100%" height={height}>
          <Defs>
            <LinearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={GOLD.tip} />
              <Stop offset="1" stopColor={GOLD.base} />
            </LinearGradient>
            <Pattern id={id} width={tileWidth} height={height} patternUnits="userSpaceOnUse">
              {material === 'gold' ? (
                <G transform={scale}>
                  <Path d={crest} transform="translate(0 -3)" fill="none" stroke="#5a3d10" strokeOpacity={0.14} strokeWidth={6} strokeLinecap="round" />
                  <Path d={`${crest} V100 H0 Z`} fill={`url(#${id}-g)`} />
                  <Path d={crest} transform="translate(0 6)" fill="none" stroke="#ffffff" strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round" />
                  <Path d={crest} fill="none" stroke={GOLD.edge} strokeWidth={1.8} />
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
