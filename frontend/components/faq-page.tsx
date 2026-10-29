/**
 * Trang "Câu hỏi thường gặp" đầy đủ (/cau-hoi-thuong-gap), mở từ nút "Xem tất cả câu hỏi" ở trang chủ. Bố cục học từ trang chính sách của EduPath AI:
 * thanh đầu trang, ảnh bìa có tiêu đề, bên trái cột "Danh mục" (các nhóm, mỗi nhóm nhiều mục, mục đang xem sáng đỏ), bên phải cột "Thông tin mô tả"
 * (các câu của mục đang chọn, mở sẵn, bấm tiêu đề để đóng/mở). Mỗi mục có địa chỉ riêng theo dấu # (ví dụ #gv-thi-dau) để gửi cho người khác.
 * Nội dung nằm ở constants/faq.ts. Màu theo bảng màu logo như trang chủ, cố định ở mọi chế độ; không có hiệu ứng hiện dần hay trượt.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, ArrowUp, ChevronDown, ChevronRight, ChevronUp, LogIn } from 'lucide-react-native';
import { BrandLogo } from '@/components/art';
import { useDocumentTitle } from '@/components/auth';
import { Txt } from '@/components/ui';
import { FAQ_CATEGORIES, FAQ_GROUPS, type FaqItem } from '@/constants/faq';
import { useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';

const WEB = Platform.OS === 'web' && typeof window !== 'undefined';
const BANNER = require('../assets/anh-bia-6-ngang.jpg');
const MAX_W = 1200;
const INK_BODY = 'rgba(35, 56, 47, 0.9)';
const INK_SOFT = 'rgba(35, 56, 47, 0.7)';
const INK_LINE = 'rgba(35, 56, 47, 0.16)';
const BAND = 'rgba(35, 56, 47, 0.06)';

const readHash = (): string | null => {
  if (!WEB) return null;
  const id = window.location.hash.slice(1);
  return FAQ_CATEGORIES.some((c) => c.id === id) ? id : null;
};

/** Một câu: thanh tiêu đề xám nhạt (bấm để đóng/mở) và phần trả lời; danh sách hiện thành các gạch đầu dòng đỏ */
const Answer: React.FC<{ item: FaqItem; open: boolean; onToggle: () => void }> = ({ item, open, onToggle }) => {
  const { c } = useTheme();
  return (
    <View style={{ borderRadius: 24, borderWidth: 1, borderColor: INK_LINE, overflow: 'hidden', backgroundColor: 'rgba(255, 255, 255, 0.92)' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={onToggle}
        style={({ pressed }) => ({ minHeight: 64, paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: BAND, opacity: pressed ? 0.85 : 1 })}
      >
        <Txt f="heavy" size={18} color={c.logoInk} style={{ flex: 1, lineHeight: 25 }}>
          {item.q}
        </Txt>
        {open ? <ChevronUp size={20} color={INK_SOFT} strokeWidth={2.2} /> : <ChevronDown size={20} color={INK_SOFT} strokeWidth={2.2} />}
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: 24, paddingVertical: 22, gap: 14 }}>
          {item.a.map((p, i) =>
            typeof p === 'string' ? (
              <Txt key={i} size={16} color={INK_BODY} style={{ lineHeight: 28 }}>
                {p}
              </Txt>
            ) : (
              <View key={i} style={{ gap: 10 }}>
                {p.map((li) => (
                  <View key={li} style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.logoRed, marginTop: 11 }} />
                    <Txt size={16} color={INK_BODY} style={{ flex: 1, lineHeight: 28 }}>
                      {li}
                    </Txt>
                  </View>
                ))}
              </View>
            ),
          )}
        </View>
      ) : null}
    </View>
  );
};

export function FaqPage() {
  const { c } = useTheme();
  const router = useRouter();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [cat, setCat] = useState<string>(() => readHash() ?? FAQ_CATEGORIES[0].id);
  const [closed, setClosed] = useState<string[]>([]);
  const scroll = useRef<ScrollViewInstance>(null);
  const y = useRef({ body: 0, layout: 0, content: 0 });
  const pending = useRef(!!readHash());
  useDocumentTitle('Câu hỏi thường gặp – Đông A');

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

  const current = FAQ_CATEGORIES.find((x) => x.id === cat) ?? FAQ_CATEGORIES[0];
  const toggle = (id: string) => setClosed((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const nav = (label: string, on: boolean, onPress?: () => void) => (
    <Pressable accessibilityRole="link" accessibilityState={{ selected: on }} onPress={onPress} disabled={on} style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' }}>
      <Txt f="bold" size={15} color={on ? c.logoRed : c.logoInk}>
        {label}
      </Txt>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.logoPaper }}>
      <ScrollView ref={scroll} contentContainerStyle={{ flexGrow: 1 }}>
        {/* thanh đầu trang */}
        <View style={{ backgroundColor: c.logoPaper, borderBottomWidth: 1, borderBottomColor: INK_LINE }}>
          <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', minHeight: 76, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Pressable accessibilityRole="link" accessibilityLabel="Về trang chủ Đông A" onPress={() => router.push('/')} style={{ minHeight: 44, justifyContent: 'center' }}>
              <BrandLogo compact={width < 400} />
            </Pressable>
            {width >= 640 ? (
              <View accessibilityRole="menu" style={{ flexDirection: 'row', alignItems: 'center' }}>
                {nav('Trang chủ', false, () => router.push('/'))}
                {nav('Câu hỏi thường gặp', true)}
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vào học ngay"
              onPress={() => router.push('/portal')}
              style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: width >= 420 ? 20 : 14, borderRadius: 999, backgroundColor: c.logoRed, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.9 : 1 })}
            >
              {width >= 420 ? (
                <>
                  <Txt f="heavy" size={15} color={c.logoPaper}>
                    Vào học ngay
                  </Txt>
                  <ArrowRight size={18} color={c.logoPaper} strokeWidth={2.2} />
                </>
              ) : (
                <LogIn size={20} color={c.logoPaper} strokeWidth={2} />
              )}
            </Pressable>
          </View>
        </View>

        {/* ảnh bìa */}
        <View style={{ height: wide ? 320 : 200, backgroundColor: c.logoInk, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <Image source={BANNER} alt="" resizeMode="cover" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10, 18, 14, 0.5)' }]} />
          <Txt
            f="heavy"
            size={wide ? 56 : 30}
            color="#ffffff"
            center
            upper
            accessibilityRole="header"
            style={{ paddingHorizontal: 16, lineHeight: wide ? 64 : 36, letterSpacing: wide ? -1.5 : -0.5, textShadowColor: 'rgba(0, 0, 0, 0.55)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 18 }}
          >
            Câu hỏi thường gặp
          </Txt>
        </View>

        {/* hai cột */}
        <View onLayout={(e) => { y.current.body = e.nativeEvent.layout.y; }} style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: wide ? 64 : 36, paddingBottom: wide ? 80 : 48, gap: 36 }}>
          <View onLayout={(e) => { y.current.layout = e.nativeEvent.layout.y; }} style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: wide ? 36 : 36 }}>
            <View role="navigation" aria-label="Danh mục câu hỏi" style={{ width: wide ? 380 : '100%', gap: 22 }}>
              <Txt f="heavy" size={wide ? 28 : 24} color={c.logoRed} center upper accessibilityRole="header" style={{ letterSpacing: -0.6, alignSelf: 'stretch' }}>
                Danh mục
              </Txt>
              <View style={{ gap: 18 }}>
                {FAQ_GROUPS.map((g) => (
                  <View key={g.id} style={{ borderRadius: 24, borderWidth: 1, borderColor: INK_LINE, overflow: 'hidden', backgroundColor: 'rgba(255, 255, 255, 0.92)' }}>
                    <View style={{ paddingVertical: 18, paddingHorizontal: 22, backgroundColor: BAND, borderLeftWidth: 4, borderLeftColor: c.logoRed }}>
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
                          testID={`faq-cat-${k.id}`}
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

            <View onLayout={(e) => { y.current.content = e.nativeEvent.layout.y; if (pending.current) { pending.current = false; if (!wide) setTimeout(toContent, 0); } }} style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', minWidth: 0, gap: 22 }}>
              <Txt f="heavy" size={wide ? 28 : 24} color={c.logoRed} center upper accessibilityRole="header" style={{ letterSpacing: -0.6, alignSelf: 'stretch' }}>
                Thông tin mô tả
              </Txt>
              <View accessibilityLiveRegion="polite" testID="faq-content" style={{ gap: 16 }}>
                <Txt f="heavy" size={wide ? 30 : 26} color={c.logoInk} accessibilityRole="header" style={{ lineHeight: wide ? 36 : 32, letterSpacing: -0.6 }}>
                  {current.label}
                </Txt>
                {current.items.map((item) => (
                  <Answer key={item.id} item={item} open={!closed.includes(item.id)} onToggle={() => toggle(item.id)} />
                ))}
              </View>
              <Txt size={15} color={INK_SOFT} style={{ lineHeight: 24 }}>
                Chưa thấy câu trả lời em cần? Hãy hỏi Quân Sư AI trong game hoặc nhờ thầy cô, quản trị viên của trường.
              </Txt>
              <Pressable accessibilityRole="link" onPress={() => router.push('/')} style={{ minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt f="heavy" size={15.5} color={c.logoRed}>
                  Về trang chủ
                </Txt>
                <ArrowRight size={18} color={c.logoRed} strokeWidth={2.2} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* chân trang gọn */}
        <View style={{ backgroundColor: c.logoInk }}>
          <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 24, flexDirection: wide ? 'row' : 'column', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <BrandLogo light />
            <Txt size={13} color="rgba(250, 244, 231, 0.78)">
              © 2026 · Đông A
            </Txt>
            <Pressable accessibilityRole="link" accessibilityLabel="Về đầu trang" onPress={() => scroll.current?.scrollTo({ y: 0, animated: !reduce })} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Txt size={13} color="rgba(250, 244, 231, 0.78)">
                Về đầu trang
              </Txt>
              <ArrowUp size={18} color={c.logoGold} strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
