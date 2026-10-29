/**
 * Khung chung của hai trang thông tin công khai: "Điều khoản sử dụng" (/dieu-khoan-su-dung) và "Câu hỏi thường gặp" (/cau-hoi-thuong-gap).
 * Dùng lại đúng thanh điều hướng (to ở đầu trang, co thành viên thuốc kính khi cuộn như trang chủ; logo chữ tối vì nền là giấy kem), chân trang, nút lên đầu trang,
 * bảng màu sáng cố định (như trang chủ, không có nút đổi sáng/tối) và cuộn mượt của trang chủ; menu chỉ có ba mục: Trang chủ, Điều khoản sử dụng, Câu hỏi thường gặp.
 * Phần nội dung của từng trang đặt trong `Band` của trang chủ. Cũng chứa AnswerBody và QaRow: cách hiển thị câu hỏi – trả lời giống khối "Câu hỏi thường gặp" ở trang chủ.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { BackToTop, FooterSection, Header, INK_LINE, INK_SOFT } from '@/components/home';
import { Txt, PaperBg } from '@/components/ui';
import type { FaqParagraph } from '@/constants/faq';
import { PALETTES } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-motion';
import { useSmoothScroll } from '@/hooks/use-smooth-scroll';
import { ThemeContext, useTheme } from '@/hooks/use-theme';

const WEB = Platform.OS === 'web';
const INFO_THEME = { c: PALETTES.light, dark: false };

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
}> = ({ active, scrollRef, children }) => (
  <ThemeContext.Provider value={INFO_THEME}>
    <Page active={active} scrollRef={scrollRef}>
      {children}
    </Page>
  </ThemeContext.Provider>
);

const Page: React.FC<{ active: InfoTab; scrollRef: React.RefObject<ScrollViewInstance | null>; children: React.ReactNode }> = ({ active, scrollRef, children }) => {
  const router = useRouter();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [stuck, setStuck] = useState(false);
  const [showTop, setShowTop] = useState(false);

  /** Như trang chủ: thanh điều hướng to ở đầu trang, co thành viên thuốc kính khi cuộn xuống (stuck) */
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: false,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const y = e.nativeEvent.contentOffset.y;
          setStuck(y > 40);
          setShowTop(y > 560);
        },
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
      <Header width={width} scrollY={scrollY} stuck={stuck} active={ACTIVE_ID[active]} go={go} items={INFO_NAV} paper />
      <BackToTop scrollY={scrollY} visible={showTop} onPress={top} />
    </View>
  );
};
