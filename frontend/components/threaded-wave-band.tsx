import { View } from 'react-native';
import { WaveBand } from '@/components/art';
import { ThreadsBackground } from '@/components/threads-background';
import { useTheme } from '@/hooks/use-theme';

/** Threads decorates only the two 24px wave bands, never the campaign content or footer body. */
export function ThreadedWaveBand({ testID }: { testID: string }) {
  const { c } = useTheme();
  return (
    <View testID={`${testID}-container`} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: '100%', height: 24, overflow: 'hidden' }}>
      <WaveBand testID={testID} bg={c.son} line={c.vang} height={24} opacity={0.2} />
      <ThreadsBackground compact />
    </View>
  );
}
