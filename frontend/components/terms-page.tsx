/**
 * Trang "Điều khoản sử dụng" (/dieu-khoan-su-dung): bố cục học từ trang "Chính sách & Điều khoản" của EduPath AI. Ảnh bìa có tiêu đề; bên trái cột "Danh mục"
 * (các nhóm, mỗi nhóm nhiều mục, mục đang xem sáng đỏ); bên phải cột "Thông tin mô tả" (các câu của mục đang chọn, mở sẵn, bấm tiêu đề để đóng/mở),
 * ngày cập nhật lần cuối và liên kết sang "Câu hỏi thường gặp". Mỗi mục có địa chỉ riêng theo dấu # (ví dụ #bm-bao-ve); điện thoại xếp dọc và tự cuộn
 * tới nội dung khi chọn mục. Nội dung nằm ở constants/terms.ts. Không có hiệu ứng hiện dần hay trượt.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native';
import { useDocumentTitle } from '@/components/auth';
import { AnswerBody, InfoShell, INFO_MAX_W, INK_BAND, INK_LINE, INK_SOFT } from '@/components/info-page';
import { Txt } from '@/components/ui';
import type { FaqItem } from '@/constants/faq';
import { TERMS_CATEGORIES, TERMS_GROUPS, TERMS_UPDATED } from '@/constants/terms';
import { useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';

const WEB = Platform.OS === 'web' && typeof window !== 'undefined';

const readHash = (): string | null => {
  if (!WEB) return null;
  const id = window.location.hash.slice(1);
  return TERMS_CATEGORIES.some((c) => c.id === id) ? id : null;
};

/** Một câu: thanh tiêu đề xám nhạt (bấm để đóng/mở) và phần trả lời */
const Entry: React.FC<{ item: FaqItem; open: boolean; onToggle: () => void }> = ({ item, open, onToggle }) => {
  const { c } = useTheme();
  return (
    <View style={{ borderRadius: 24, borderWidth: 1, borderColor: INK_LINE, overflow: 'hidden', backgroundColor: 'rgba(255, 255, 255, 0.92)' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={onToggle}
        style={({ pressed }) => ({ minHeight: 64, paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: INK_BAND, opacity: pressed ? 0.85 : 1 })}
      >
        <Txt f="heavy" size={18} color={c.logoInk} style={{ flex: 1, lineHeight: 25 }}>
          {item.q}
        </Txt>
        {open ? <ChevronUp size={20} color={INK_SOFT} strokeWidth={2.2} /> : <ChevronDown size={20} color={INK_SOFT} strokeWidth={2.2} />}
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: 24, paddingVertical: 22 }}>
          <AnswerBody paragraphs={item.a} />
        </View>
      ) : null}
    </View>
  );
};

export function TermsPage() {
  const { c } = useTheme();
  const router = useRouter();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [cat, setCat] = useState<string>(() => readHash() ?? TERMS_CATEGORIES[0].id);
  const [closed, setClosed] = useState<string[]>([]);
  const scroll = useRef<ScrollViewInstance>(null);
  const y = useRef({ body: 0, layout: 0, content: 0 });
  const pending = useRef(!!readHash());
  useDocumentTitle('Điều khoản sử dụng – Đông A');

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

  const toContent = useCallback(() => {
    scroll.current?.scrollTo({ y: Math.max(0, y.current.body + y.current.layout + y.current.content - 90), animated: !reduce });
  }, [reduce]);

  const select = (id: string) => {
    setCat(id);
    setClosed([]);
    if (WEB) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${id}`);
    if (!wide) toContent();
  };

  const current = TERMS_CATEGORIES.find((x) => x.id === cat) ?? TERMS_CATEGORIES[0];
  const toggle = (id: string) => setClosed((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const heading = (text: string) => (
    <Txt f="heavy" size={wide ? 28 : 24} color={c.logoRed} center upper accessibilityRole="header" style={{ letterSpacing: -0.6, alignSelf: 'stretch' }}>
      {text}
    </Txt>
  );

  return (
    <InfoShell active="terms" banner="Điều khoản sử dụng" scrollRef={scroll}>
      <View onLayout={(e) => { y.current.body = e.nativeEvent.layout.y; }} style={{ width: '100%', maxWidth: INFO_MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: wide ? 64 : 36, paddingBottom: wide ? 80 : 48 }}>
        <View onLayout={(e) => { y.current.layout = e.nativeEvent.layout.y; }} style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: 36 }}>
          <View role="navigation" aria-label="Danh mục điều khoản" style={{ width: wide ? 380 : '100%', gap: 22 }}>
            {heading('Danh mục')}
            <View style={{ gap: 18 }}>
              {TERMS_GROUPS.map((g) => (
                <View key={g.id} style={{ borderRadius: 24, borderWidth: 1, borderColor: INK_LINE, overflow: 'hidden', backgroundColor: 'rgba(255, 255, 255, 0.92)' }}>
                  <View style={{ paddingVertical: 18, paddingHorizontal: 22, backgroundColor: INK_BAND, borderLeftWidth: 4, borderLeftColor: c.logoRed }}>
                    <Txt f="heavy" size={20} color={c.logoInk} accessibilityRole="header" style={{ lineHeight: 26 }}>
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
                        style={({ pressed }) => ({ minHeight: 60, paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: INK_LINE, backgroundColor: on ? c.logoRed : 'transparent', opacity: pressed ? 0.85 : 1 })}
                      >
                        <Txt f={on ? 'heavy' : 'bold'} size={16.5} color={on ? c.logoPaper : c.logoInk} style={{ flex: 1, lineHeight: 23 }}>
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
                if (!wide) setTimeout(toContent, 0);
              }
            }}
            style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', minWidth: 0, gap: 22 }}
          >
            {heading('Thông tin mô tả')}
            <View accessibilityLiveRegion="polite" testID="terms-content" style={{ gap: 16 }}>
              <Txt f="heavy" size={wide ? 30 : 26} color={c.logoInk} accessibilityRole="header" style={{ lineHeight: wide ? 36 : 32, letterSpacing: -0.6 }}>
                {current.label}
              </Txt>
              {current.items.map((item) => (
                <Entry key={item.id} item={item} open={!closed.includes(item.id)} onToggle={() => toggle(item.id)} />
              ))}
            </View>
            <Txt size={14} color={INK_SOFT}>
              Cập nhật lần cuối: {TERMS_UPDATED}
            </Txt>
            <Txt size={15} color={INK_SOFT} style={{ lineHeight: 24 }}>
              Cần hướng dẫn sử dụng Đông A?
            </Txt>
            <Pressable accessibilityRole="link" onPress={() => router.push('/cau-hoi-thuong-gap')} style={{ minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Txt f="heavy" size={15.5} color={c.logoRed}>
                Xem câu hỏi thường gặp
              </Txt>
              <ArrowRight size={18} color={c.logoRed} strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>
      </View>
    </InfoShell>
  );
}
