import { View } from 'react-native';
import { FlowingWaves } from '@/components/flowing-waves';
import { useTheme } from '@/hooks/use-theme';

/** Legacy component name retained; the two ribbons now use crossing waves and drifting particles. */
export function ThreadedWaveBand({ testID }: { testID: string }) {
  const { c } = useTheme();
  return (
    <View testID={`${testID}-container`} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: '100%', height: 24, overflow: 'hidden' }}>
      <View testID={testID} style={{ width: '100%', height: 24, backgroundColor: c.son, opacity: 0.2 }} />
      <FlowingWaves />
    </View>
  );
}
