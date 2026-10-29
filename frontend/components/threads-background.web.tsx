import { useWindowDimensions } from 'react-native';
import Threads from '@/components/react-bits/threads.web';
import { useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';

/** The official Threads renderer, in the logo palette. It manages offscreen/tab pausing itself. */
export function ThreadsBackground({ paused = false, compact = false }: { paused?: boolean; compact?: boolean }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();
  return (
    <div data-testid="threads-background" aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: 0.2, pointerEvents: 'none' }}>
      {width >= 900 && !reduce ? <Threads color={c.logoRed} accentColor={c.logoGold} lineCount={compact ? 14 : 36} amplitude={compact ? 0.45 : 1.3} thickness={compact ? 0.7 : 1} fade={compact ? 0 : undefined} speed={0.18} angle={compact ? 0 : 12} paused={paused} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} /> : (
        <svg width="100%" height="100%" viewBox="0 0 1200 600" preserveAspectRatio="none">
          {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M-100 ${190 + i * 10} C250 ${-80 + i * 12} 650 ${640 + i * 6} 1300 ${260 + i * 12}`} fill="none" stroke={i % 2 ? c.logoGold : c.logoRed} strokeWidth="1.2" />)}
        </svg>
      )}
    </div>
  );
}
