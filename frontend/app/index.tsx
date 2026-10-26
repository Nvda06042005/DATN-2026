/**
 * Trang chủ công khai theo phong cách Papumba (các khối nằm ở components/home.tsx): khung trang gồm chế độ sáng/tối riêng cho trang chủ (nhớ lại ở lần sau),
 * thanh điều hướng cố định co hẹp khi cuộn có đánh dấu mục đang xem, nút lên đầu trang và cuộn mượt khi lăn chuột.
 * Không có liên kết tới hai cổng quản trị. expo-router bắt buộc tên index cho đường dẫn "/".
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated, Platform, ScrollView, View, useColorScheme, useWindowDimensions,
  type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance,
} from 'react-native';
import { useDocumentTitle } from '@/components/auth';
import { BackToTop, Header, HomeSections, NAV } from '@/components/home';
import { PaperBg } from '@/components/ui';
import { PALETTES } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-motion';
import { useSmoothScroll } from '@/hooks/use-smooth-scroll';
import { ThemeContext } from '@/hooks/use-theme';
import { readHomeTheme, saveHomeTheme, type HomeTheme } from '@/lib/storage';

const WEB = Platform.OS === 'web';

/** Trang chủ tự quản lý chế độ sáng/tối rồi bọc nội dung trong ThemeContext riêng, nên các màn khác của app không bị ảnh hưởng */
export default function Home() {
  const system = useColorScheme();
  const [mode, setMode] = useState<HomeTheme>(() => readHomeTheme() ?? (system === 'dark' ? 'dark' : 'light'));
  const theme = useMemo(() => ({ c: PALETTES[mode], dark: mode === 'dark' }), [mode]);
  const toggleTheme = useCallback(() => {
    const next: HomeTheme = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    saveHomeTheme(next);
  }, [mode]);
  return (
    <ThemeContext.Provider value={theme}>
      <HomePage onToggleTheme={toggleTheme} />
    </ThemeContext.Provider>
  );
}

function HomePage({ onToggleTheme }: { onToggleTheme: () => void }) {
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  useDocumentTitle('Đông A – Học Sử vui như chơi game');

  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const sections = useRef<Record<string, number>>({});
  const [active, setActive] = useState('home');
  const [stuck, setStuck] = useState(false);
  const [showTop, setShowTop] = useState(false);

  const onSection = useCallback((id: string, y: number) => {
    sections.current[id] = y;
  }, []);

  /** Theo dõi vị trí cuộn: điều khiển thanh điều hướng (co hẹp, mục đang xem) và nút lên đầu trang */
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: false,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const y = e.nativeEvent.contentOffset.y;
          setStuck(y > 40);
          setShowTop(y > 560);
          let current = 'home';
          for (const n of NAV) {
            const top = sections.current[n.id];
            if (top !== undefined && top - 180 <= y) current = n.id;
          }
          setActive(current);
        },
      }),
    [scrollY],
  );

  const getScrollNode = useCallback(() => (scrollRef.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null)?.getScrollableNode?.() ?? null, []);
  useSmoothScroll(getScrollNode, WEB && !reduce);

  const go = (id: string) => {
    if (id === 'home') {
      scrollRef.current?.scrollTo({ y: 0, animated: !reduce });
      return;
    }
    if (WEB && typeof document !== 'undefined') document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <View style={{ flex: 1 }}>
      <PaperBg />
      <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ flexGrow: 1 }}>
        <HomeSections wide={wide} go={go} onSection={onSection} />
      </ScrollView>
      <Header width={width} scrollY={scrollY} stuck={stuck} active={active} go={go} onToggleTheme={onToggleTheme} />
      <BackToTop scrollY={scrollY} visible={showTop} onPress={() => go('home')} />
    </View>
  );
}
