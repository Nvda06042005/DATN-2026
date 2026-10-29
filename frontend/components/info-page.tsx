/**
 * Khung chung của hai trang thông tin công khai: "Điều khoản sử dụng" (/dieu-khoan-su-dung) và "Câu hỏi thường gặp" (/cau-hoi-thuong-gap).
 * Dùng lại đúng thanh điều hướng, chân trang, nút lên đầu trang, chế độ sáng/tối (cùng khóa lưu với trang chủ) và cuộn mượt của trang chủ; thanh điều hướng
 * luôn ở dạng viên thuốc kính (như khi đã cuộn xuống) vì nền các trang này là giấy kem, và menu chỉ có ba mục: Trang chủ, Điều khoản sử dụng, Câu hỏi thường gặp.
 * Phần nội dung của từng trang đặt trong `Band` của trang chủ. Cũng chứa AnswerBody và QaRow: cách hiển thị câu hỏi – trả lời giống khối "Câu hỏi thường gặp" ở trang chủ.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, View, useColorScheme, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { BackToTop, FooterSection, Header, INK_LINE, INK_SOFT } from '@/components/home';
import { Txt, PaperBg } from '@/components/ui';
import type { FaqParagraph } from '@/constants/faq';
import { PALETTES } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-motion';
import { useSmoothScroll } from '@/hooks/use-smooth-scroll';
import { ThemeContext, useTheme } from '@/hooks/use-theme';
import { readHomeTheme, saveHomeTheme, type HomeTheme } from '@/lib/storage';

const WEB = Platform.OS === 'web';

export type InfoTab = 'terms' | 'faq';

/** Mục menu của thanh điều hướng ở hai trang này (id cũng là đường dẫn, trừ "home") */
const INFO_NAV = [
  { id: 'home', short: 'Trang chủ' },
  { id: 'dieu-khoan-su-dung', short: 'Điều khoản sử dụng' },
  { id: 'cau-hoi-thuong-gap', short: 'Câu hỏi thường gặp' },
] as const;

const ACTIVE_ID: Record<InfoTab, string> = { terms: 'dieu-khoan-su-dung', faq: 'cau-hoi-thuong-gap' };

/** Các đoạn trả lời: chuỗi là đoạn văn, mảng chuỗi là danh sách gạch đầu dòng đỏ */
export const AnswerBody: React.FC<{ paragraphs: FaqParagraph[] }> = ({ paragraphs }) => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      {paragraphs.map((p, i) =>
        typeof p === 'string' ? (
          <Txt key={i} size={15.5} color={INK_SOFT} style={{ lineHeight: 25 }}>
            {p}
          </Txt>
        ) : (
          <View key={i} style={{ gap: 8 }}>
            {p.map((li) => (
              <View key={li} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.logoRed, marginTop: 9 }} />
                <Txt size={15.5} color={INK_SOFT} style={{ flex: 1, lineHeight: 25 }}>
                  {li}
                </Txt>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  );
};

/** Một câu hỏi – trả lời như ở khối "Câu hỏi thường gặp" của trang chủ: đường kẻ mảnh, câu hỏi đậm (đỏ khi đang mở), dấu cộng/đóng bên phải */
export const QaRow: React.FC<{ q: string; paragraphs: FaqParagraph[]; open: boolean; onToggle: () => void; testID?: string }> = ({ q, paragraphs, open, onToggle, testID }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: INK_LINE }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={onToggle}
        testID={testID}
        style={({ pressed }) => ({ minHeight: 64, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 16, opacity: pressed ? 0.8 : 1 })}
      >
        <Txt f="heavy" size={width >= 760 ? 18 : 16.5} color={open ? c.logoRed : c.logoInk} style={{ flex: 1, lineHeight: 25 }}>
          {q}
        </Txt>
        {open ? <X size={20} color={c.logoRed} strokeWidth={2.2} /> : <Plus size={20} color={INK_SOFT} strokeWidth={2.2} />}
      </Pressable>
      {open ? (
        <View style={{ paddingBottom: 22, paddingRight: 36 }}>
          <AnswerBody paragraphs={paragraphs} />
        </View>
      ) : null}
    </View>
  );
};

export const InfoShell: React.FC<{
  active: InfoTab;
  scrollRef: React.RefObject<ScrollViewInstance | null>;
  children: React.ReactNode;
}> = ({ active, scrollRef, children }) => {
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
      <Page active={active} scrollRef={scrollRef} onToggleTheme={toggleTheme}>
        {children}
      </Page>
    </ThemeContext.Provider>
  );
};

const Page: React.FC<{ active: InfoTab; scrollRef: React.RefObject<ScrollViewInstance | null>; onToggleTheme: () => void; children: React.ReactNode }> = ({ active, scrollRef, onToggleTheme, children }) => {
  const router = useRouter();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const scrollY = useRef(new Animated.Value(0)).current;
  /** Thanh điều hướng luôn ở dạng đã co (kính sáng/tối), không theo vị trí cuộn */
  const headerY = useRef(new Animated.Value(120)).current;
  const [showTop, setShowTop] = useState(false);

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: false,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => setShowTop(e.nativeEvent.contentOffset.y > 560),
      }),
    [scrollY],
  );
  const getScrollNode = useCallback(() => (scrollRef.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null)?.getScrollableNode?.() ?? null, [scrollRef]);
  useSmoothScroll(getScrollNode, WEB && !reduce);

  const top = () => scrollRef.current?.scrollTo({ y: 0, animated: !reduce });
  /** "home" về trang chủ; hai trang thông tin mở theo đường dẫn; các id còn lại là khối của trang chủ (/#cau-hoi…) */
  const go = (id: string) => {
    if (id === 'home') router.push('/');
    else if (INFO_NAV.some((n) => n.id === id)) router.push(`/${id}`);
    else router.push(`/#${id}`);
  };

  return (
    <View style={{ flex: 1 }}>
      <PaperBg />
      <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ flexGrow: 1 }}>
        {children}
        <FooterSection wide={wide} go={go} onTop={top} />
      </ScrollView>
      <Header width={width} scrollY={headerY} stuck active={ACTIVE_ID[active]} go={go} onToggleTheme={onToggleTheme} items={INFO_NAV} />
      <BackToTop scrollY={scrollY} visible={showTop} onPress={top} />
    </View>
  );
};
