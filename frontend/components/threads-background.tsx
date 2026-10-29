import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/hooks/use-theme';
export function ThreadsBackground({ paused: _paused = false }: { paused?: boolean }) {
  const { c } = useTheme();
  return <View pointerEvents="none" accessibilityElementsHidden style={[StyleSheet.absoluteFill, { opacity: 0.2 }]}><Svg width="100%" height="100%" viewBox="0 0 1200 600" preserveAspectRatio="none">{Array.from({ length: 9 }, (_, i) => <Path key={i} d={`M-100 ${190 + i * 10} C250 ${-80 + i * 12} 650 ${640 + i * 6} 1300 ${260 + i * 12}`} fill="none" stroke={i % 2 ? c.logoGold : c.logoRed} strokeWidth={1.2} />)}</Svg></View>;
}
