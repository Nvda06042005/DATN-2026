import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/hooks/use-theme';
import { RIBBON_DOTS, RIBBON_HEIGHT, RIBBON_LINES, RIBBON_WIDTH, ribbonDot, ribbonPath } from '@/lib/flowing-waves';

/** The same ribbon composition without a continuous animation loop on native devices. */
export function FlowingWaves() {
  const { c } = useTheme();
  return <View pointerEvents="none" accessibilityElementsHidden style={[StyleSheet.absoluteFill, { opacity: 0.2 }]}><Svg width="100%" height="100%" viewBox={`0 0 ${RIBBON_WIDTH} ${RIBBON_HEIGHT}`} preserveAspectRatio="none">
    {Array.from({ length: RIBBON_LINES }, (_, i) => <Path key={i} d={ribbonPath(0, i)} fill="none" stroke={i === RIBBON_LINES - 1 ? c.logoRed : i % 2 ? c.logoGold : c.logoInk} strokeWidth={i === RIBBON_LINES - 1 ? 1.15 : 0.75} opacity={i === RIBBON_LINES - 1 ? 1 : 0.3 + i * 0.07} />)}
    {Array.from({ length: RIBBON_DOTS }, (_, i) => { const dot = ribbonDot(i, 0); return <Circle key={i} cx={dot.x} cy={dot.y} r={dot.radius} fill={i % 3 ? c.logoRed : c.logoGold} opacity={dot.opacity} />; })}
  </Svg></View>;
}
