import React, { useId } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, G, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { PatternOverlay } from '@/components/art';
import { FlowingWaves } from '@/components/flowing-waves';
import { useTheme } from '@/hooks/use-theme';

/** Decorative drum engraving, drawn for the interface rather than a historical artefact. */
const DrumEngraving = React.memo(function DrumEngraving() {
  const { c } = useTheme();
  const sun = Array.from({ length: 32 }, (_, i) => {
    const a = i * Math.PI / 16 - Math.PI / 2;
    const r = i % 2 ? 38 : 80;
    return `${200 + Math.cos(a) * r},${200 + Math.sin(a) * r}`;
  }).join(' ');
  return <Svg width="100%" height="100%" viewBox="0 0 400 400" fill="none">
    <G stroke={c.logoGold}>
      {[91, 99, 132, 140, 172, 180, 192].map(r => <Circle key={r} cx={200} cy={200} r={r} strokeWidth={r === 192 ? 2 : 1} />)}
      <Polygon points={sun} fill={c.logoGold} fillOpacity={0.12} strokeWidth={1.5} />
      <Circle cx={200} cy={200} r={19} strokeWidth={1.5} />
      {Array.from({ length: 32 }, (_, i) => <G key={i} rotation={i * 11.25} origin="200, 200">
        <Path d="M192 77 L200 64 L208 77 Z M194 49 L200 40 L206 49" strokeWidth={1.2} />
        <Path d="M195 15 L200 22 L205 15" strokeWidth={1} />
      </G>)}
    </G>
  </Svg>;
});

/** Paper, bronze engravings and quiet flowing light behind the compact admin card. */
export function HeritageBackdrop() {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const id = useId().replace(/:/g, '');
  const drumSize = Math.min(760, Math.max(430, width * 0.45));
  return <View testID="admin-heritage-backdrop" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundColor: c.logoPaper }]}>
    <LinearGradient colors={['#ead7b5', c.logoPaper, '#e3c79b']} locations={[0, 0.47, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    <PatternOverlay opacity={0.035} />
    <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1440 900" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={`heritage-glow-${id}`} cx="50%" cy="42%" rx="65%" ry="70%">
          <Stop offset="0" stopColor={c.logoPaper} stopOpacity={0.9} />
          <Stop offset="1" stopColor={c.logoPaper} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`heritage-red-${id}`} cx="100%" cy="0" rx="70%" ry="75%">
          <Stop offset="0" stopColor={c.logoRed} stopOpacity={0.18} />
          <Stop offset="1" stopColor={c.logoRed} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="1440" height="900" fill={`url(#heritage-glow-${id})`} />
      <Rect width="1440" height="900" fill={`url(#heritage-red-${id})`} />
      <G fill="none" stroke={c.logoGold} strokeWidth={1.2} opacity={0.45}>
        <Path d="M24 134 V24 H134 M1306 24 H1416 V134 M24 766 V876 H134 M1306 876 H1416 V766" />
        <Path d="M34 96 V34 H96 M1344 34 H1406 V96 M34 804 V866 H96 M1344 866 H1406 V804" opacity={0.65} />
      </G>
    </Svg>
    <View style={{ position: 'absolute', width: drumSize, height: drumSize, left: -drumSize * 0.45, top: -drumSize * 0.43, opacity: 0.5 }}><DrumEngraving /></View>
    <View style={{ position: 'absolute', width: drumSize * 0.85, height: drumSize * 0.85, right: -drumSize * 0.37, bottom: -drumSize * 0.42, opacity: 0.5 }}><DrumEngraving /></View>
    <View testID="admin-heritage-waves" style={{ position: 'absolute', left: 0, right: 0, bottom: -35, height: Math.min(260, height * 0.3), opacity: 0.8 }}><FlowingWaves /></View>
  </View>;
}
