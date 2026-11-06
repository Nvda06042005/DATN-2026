/**
 * Trang chủ công khai theo phong cách Papumba (các khối nằm ở components/home.tsx): khung trang luôn dùng bảng màu sáng (không có nút đổi sáng/tối),
 * thanh điều hướng cố định co hẹp khi cuộn có đánh dấu mục đang xem, nút lên đầu trang, cuộn mượt khi lăn chuột và hiệu ứng theo cuộn (components/motion.tsx).
 * expo-router bắt buộc tên index cho đường dẫn "/".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Platform, ScrollView, View, useWindowDimensions,
  type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance,
} from 'react-native';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { BackToTop, Header, HomeSections, NAV } from '@/components/home';
import { FxProvider } from '@/components/motion';
import { PaperBg } from '@/components/ui';
import { PALETTES } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-motion';
import { useSmoothScroll } from '@/hooks/use-smooth-scroll';
import { ThemeContext } from '@/hooks/use-theme';

const WEB = Platform.OS === 'web';

/** Trang chủ không có nút đổi sáng/tối (bỏ ngày 29/10/2026): luôn dùng bảng màu sáng trong ThemeContext riêng, nên các màn khác của app không bị ảnh hưởng */
const HOME_THEME = { c: PALETTES.light, dark: false };

export default function Home() {
  return (
    <ThemeContext.Provider value={HOME_THEME}>
      <HomePage />
    </ThemeContext.Provider>
  );
}

function HomePage() {
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
  const [videoImmersive, setVideoImmersive] = useState(false);

  const landings = useRef<Record<string, number>>({});
  /** landing: độ lệch cần cuộn thêm khi bấm menu, dùng cho cảnh ghim để đáp xuống lúc nội dung đã hiện đủ */
  const onSection = useCallback((id: string, y: number, landing = 0) => {
    sections.current[id] = y;
    landings.current[id] = landing;
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
    const landing = landings.current[id];
    if (landing && sections.current[id] !== undefined) {
      scrollRef.current?.scrollTo({ y: sections.current[id] + landing, animated: !reduce });
      return;
    }
    if (WEB && typeof document !== 'undefined') document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  /** Địa chỉ dạng /#cau-hoi (từ chân trang của trang điều khoản, câu hỏi thường gặp): chờ các khối đo xong vị trí rồi cuộn tới khối đó */
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    if (!WEB || typeof window === 'undefined') return undefined;
    const id = window.location.hash.slice(1);
    if (!NAV.some((n) => n.id === id)) return undefined;
    let wait: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const poll = setInterval(() => {
      tries += 1;
      if (sections.current[id] === undefined && tries < 40) return;
      clearInterval(poll);
      wait = setTimeout(() => goRef.current(id), 500);
    }, 150);
    return () => {
      clearInterval(poll);
      if (wait) clearTimeout(wait);
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <PaperBg />
      <FxProvider scrollY={scrollY}>
        <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ flexGrow: 1 }}>
          <HomeSections wide={wide} go={go} onSection={onSection} onVideoImmersiveChange={setVideoImmersive} />
        </ScrollView>
      </FxProvider>
      {!videoImmersive && <Header width={width} scrollY={scrollY} stuck={stuck} active={active} go={go} revealOnScroll />}
      {!videoImmersive && <BackToTop scrollY={scrollY} visible={showTop} onPress={() => go('home')} />}
    </View>
  );
}
