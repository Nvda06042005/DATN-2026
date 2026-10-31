/**
 * Trang "Điều khoản sử dụng" (/dieu-khoan-su-dung): dùng khung của trang chủ (components/info-page.tsx: cùng thanh điều hướng và chân trang) và các khối của trang chủ
 * (nền giấy kem, vòng vàng, tiêu đề Manrope đậm kèm dòng nhấn Newsreader nghiêng đỏ). Bố cục học từ trang "Chính sách & Điều khoản" của EduPath AI: bên trái cột "Danh mục"
 * (các nhóm, mỗi nhóm nhiều mục, mục đang xem sáng đỏ); bên phải cột "Thông tin mô tả" (các câu của mục đang chọn, mở sẵn, bấm để đóng/mở), ngày cập nhật lần cuối và
 * liên kết sang "Câu hỏi thường gặp". Mỗi mục có địa chỉ riêng theo dấu # (ví dụ #bm-bao-ve); điện thoại xếp dọc và tự cuộn tới nội dung khi chọn mục.
 * Nội dung nằm ở constants/terms.ts. Không có hiệu ứng hiện dần hay trượt.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { Band, Cta, GoldRings, INK_LINE, INK_SOFT, PAPER_CARD } from '@/components/home';
import { InfoShell, PublicSiteNotice, QaRow } from '@/components/info-page';
import { SectionHeading } from '@/components/section-heading';
import { ImageCredits } from '@/components/image-credits';
import { Txt } from '@/components/ui';
import { TERMS_CATEGORIES, TERMS_GROUPS, TERMS_UPDATED } from '@/constants/terms';
import { useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';

const WEB = Platform.OS === 'web' && typeof window !== 'undefined';

const readHash = (): string | null => {
  if (!WEB) return null;
  const id = window.location.hash.slice(1);
  return TERMS_CATEGORIES.some((c) => c.id === id) ? id : null;
};

function TermsBody({ scroll }: { scroll: React.RefObject<ScrollViewInstance | null> }) {
  const { c } = useTheme();
  const router = useRouter();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const side = width >= 900; // hai cột cần đủ chỗ: hẹp hơn thì xếp dọc
  const [cat, setCat] = useState<string>(() => readHash() ?? TERMS_CATEGORIES[0].id);
  const [closed, setClosed] = useState<string[]>([]);
  const y = useRef({ layout: 0, content: 0 });
  const pending = useRef(!!readHash());

  useEffect(() => {
    if (!WEB) return undefined;
    const sync = () => {
      const id = readHash();
      if (id) {
        setCat(id);
        setClosed([]);
      }
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  /** Dải nội dung là khối đầu trang nên toạ độ trong khối cũng là toạ độ cuộn; chừa 90 cho thanh điều hướng nổi */
  const toContent = useCallback(() => {
    scroll.current?.scrollTo({ y: Math.max(0, y.current.layout + y.current.content - 90), animated: !reduce });
  }, [reduce, scroll]);

  const select = (id: string) => {
    setCat(id);
    setClosed([]);
    if (WEB) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${id}`);
    if (!side) toContent();
  };

  const current = TERMS_CATEGORIES.find((x) => x.id === cat) ?? TERMS_CATEGORIES[0];
  const toggle = (id: string) => setClosed((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const eyebrow = (text: string) => (
    <Txt f="bold" size={12.5} color={c.logoRed} upper accessibilityRole="header" style={{ letterSpacing: 1.6 }}>
      {text}
    </Txt>
  );

  return (
    <Band bg={c.logoPaper} wide={wide} padTop={wide ? 136 : 108} decor={<GoldRings />}>
      <SectionHeading eyebrow="Thông tin cần biết" title="Điều khoản" accent="sử dụng" description="Quy tắc dùng Đông A và cách ứng dụng bảo vệ thông tin của bạn." wide={wide} singleLine testID="terms-heading" />
      <PublicSiteNotice />
      <View onLayout={(e) => { y.current.layout = e.nativeEvent.layout.y; }} style={{ flexDirection: side ? 'row' : 'column', alignItems: 'flex-start', gap: side ? 48 : 32 }}>
        <View role="navigation" aria-label="Danh mục điều khoản" style={{ width: side ? 340 : '100%', gap: 16 }}>
          {eyebrow('Danh mục')}
          <View style={{ gap: 16 }}>
            {TERMS_GROUPS.map((g) => (
              <View key={g.id} style={[{ borderRadius: 28, borderWidth: 1, overflow: 'hidden' }, PAPER_CARD]}>
                <View style={{ paddingVertical: 18, paddingHorizontal: 22, borderLeftWidth: 4, borderLeftColor: c.logoRed }}>
                  <Txt f="heavy" size={18} color={c.logoInk} accessibilityRole="header" style={{ lineHeight: 24 }}>
                    {g.title}
                  </Txt>
                </View>
                {g.categories.map((k) => {
                  const on = k.id === current.id;
                  return (
                    <Pressable
                      key={k.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      aria-current={on ? 'true' : undefined}
                      onPress={() => select(k.id)}
                      testID={`terms-cat-${k.id}`}
                      style={({ pressed }) => ({ minHeight: 56, paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: INK_LINE, backgroundColor: on ? c.logoRed : 'transparent', opacity: pressed ? 0.85 : 1 })}
                    >
                      <Txt f={on ? 'heavy' : 'bold'} size={15.5} color={on ? c.logoPaper : c.logoInk} style={{ flex: 1, lineHeight: 22 }}>
                        {k.label}
                      </Txt>
                      <ChevronRight size={20} color={on ? c.logoPaper : INK_SOFT} strokeWidth={2.2} />
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <View
          onLayout={(e) => {
            y.current.content = e.nativeEvent.layout.y;
            if (pending.current) {
              pending.current = false;
              if (!side) setTimeout(toContent, 0);
            }
          }}
          style={{ flex: side ? 1 : undefined, width: side ? undefined : '100%', minWidth: 0, gap: 16 }}
        >
          {eyebrow('Thông tin mô tả')}
          <View accessibilityLiveRegion="polite" testID="terms-content" style={{ gap: 12 }}>
            <Txt f="heavy" size={wide ? 30 : 26} color={c.logoInk} accessibilityRole="header" style={{ lineHeight: wide ? 36 : 32, letterSpacing: -0.6 }}>
              {current.label}
            </Txt>
            <View style={{ borderTopWidth: 1, borderTopColor: INK_LINE }}>
              {current.items.map((item) => (
                <QaRow key={item.id} q={item.q} paragraphs={item.a} open={!closed.includes(item.id)} onToggle={() => toggle(item.id)} />
              ))}
            </View>
          </View>
          <Txt size={14} color={INK_SOFT}>
            Cập nhật lần cuối: {TERMS_UPDATED}
          </Txt>
          <Txt size={15} color={INK_SOFT} style={{ lineHeight: 24 }}>
            Cần hướng dẫn sử dụng Đông A?
          </Txt>
          <Cta title="Xem câu hỏi thường gặp" tone="logo" arrow onPress={() => router.push('/cau-hoi-thuong-gap')} testID="terms-faq" />
        </View>
      </View>
    </Band>
  );
}

export function TermsPage() {
  const scroll = useRef<ScrollViewInstance>(null);
  useDocumentTitle('Điều khoản sử dụng – Đông A');
  return (
    <InfoShell active="terms" scrollRef={scroll}>
      <TermsBody scroll={scroll} />
      <ImageCredits />
    </InfoShell>
  );
}
