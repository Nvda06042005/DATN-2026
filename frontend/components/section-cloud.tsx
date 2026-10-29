/** Mép mây nối hai khối: ba dáng lượn, hai hướng, trôi nhẹ khi nằm trong màn hình. */
import { useId } from 'react';
import { Animated, Platform, View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { useLoop, useOnScreen } from '@/components/motion';
import { useTheme } from '@/hooks/use-theme';

const CRESTS = [
  'M0 80 C0 20 42 18 52 65 C54 -15 102 -15 112 64 C124 9 174 12 180 67 C190 32 220 30 220 80',
  'M0 82 C0 40 25 27 38 66 C32 -12 83 -18 98 62 C110 7 150 10 154 70 C170 15 214 12 220 82',
  'M0 84 C0 3 51 -4 62 65 C75 35 97 33 108 66 C114 -15 165 -15 179 64 C194 29 220 30 220 84',
] as const;

/** color là màu tô của dải mây (thường là màu khối liền kề); trim (tùy chọn) là màu viền đậm của mép lượn để làm điểm nhấn khi hai khối liền nhau cùng màu */
export function SectionCloud({ color, trim, wide, variant = 0, direction = 'down' }: {
  color: string;
  trim?: string;
  wide: boolean;
  variant?: 0 | 1 | 2;
  direction?: 'up' | 'down';
}) {
  const { c } = useTheme();
  const id = `section-cloud-${useId().replace(/:/g, '')}`;
  const [ref, visible] = useOnScreen();
  const motion = useLoop(Platform.OS === 'web' && wide && visible, 12000 + variant * 4000);
  const height = wide ? [72, 80, 64][variant] : [52, 58, 48][variant];
  const tileWidth = [220, 260, 190][variant];
  return (
    <View
      ref={ref}
      pointerEvents="none"
      accessible={false}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={`section-cloud-${direction}-${variant}`}
      style={{ width: '100%', height, zIndex: 3, overflow: 'hidden', ...(direction === 'down' ? { marginBottom: -height } : { marginTop: -height }) }}
    >
      <Animated.View testID="section-cloud-motion" style={{ position: 'absolute', top: 0, left: -40, right: -40, height, transform: [{ translateX: motion.interpolate({ inputRange: [0, 1], outputRange: [-14 - variant * 3, 14 + variant * 3] }) }, { scaleY: direction === 'down' ? -1 : 1 }] }}>
        <Svg width="100%" height={height}>
          <Defs>
            <Pattern id={id} width={tileWidth} height={height} patternUnits="userSpaceOnUse">
              <Path d={`${CRESTS[variant]} V100 H0 Z`} transform={`scale(${tileWidth / 220} ${height / 96})`} fill={color} />
              <Path d={CRESTS[variant]} transform={`scale(${tileWidth / 220} ${height / 96})`} fill="none" stroke={trim ?? c.logoGold} strokeWidth={trim ? 3 : 1} opacity={trim ? 1 : 0.45} />
            </Pattern>
          </Defs>
          <Rect width="100%" height={height} fill={`url(#${id})`} />
        </Svg>
      </Animated.View>
    </View>
  );
}
