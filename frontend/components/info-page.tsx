/**
 * Khung chung của hai trang thông tin công khai: "Điều khoản sử dụng" (/dieu-khoan-su-dung) và "Câu hỏi thường gặp" (/cau-hoi-thuong-gap), học theo
 * trang thông tin của EduPath AI: thanh đầu trang (logo, Trang chủ, Điều khoản sử dụng, Câu hỏi thường gặp, nút đỏ "Vào học ngay"), ảnh bìa có tiêu đề
 * (tùy chọn), phần nội dung của từng trang và chân trang gọn. Màu theo bảng màu logo như trang chủ, cố định ở mọi chế độ.
 * Cũng chứa AnswerBody: cách hiển thị đoạn trả lời (đoạn văn và danh sách gạch đầu dòng đỏ) dùng chung cho cả hai trang.
 */
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, ArrowUp, LogIn } from 'lucide-react-native';
import { BrandLogo } from '@/components/art';
import { Txt } from '@/components/ui';
import type { FaqParagraph } from '@/constants/faq';
import { useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';

export const INFO_MAX_W = 1200;
export const INK_BODY = 'rgba(35, 56, 47, 0.9)';
export const INK_SOFT = 'rgba(35, 56, 47, 0.7)';
export const INK_LINE = 'rgba(35, 56, 47, 0.16)';
export const INK_BAND = 'rgba(35, 56, 47, 0.06)';

const BANNER = require('../assets/anh-bia-6-ngang.jpg');

export type InfoTab = 'terms' | 'faq';

const TABS: Array<{ id: InfoTab; label: string; href: '/dieu-khoan-su-dung' | '/cau-hoi-thuong-gap' }> = [
  { id: 'terms', label: 'Điều khoản sử dụng', href: '/dieu-khoan-su-dung' },
  { id: 'faq', label: 'Câu hỏi thường gặp', href: '/cau-hoi-thuong-gap' },
];

/** Các đoạn trả lời: chuỗi là đoạn văn, mảng chuỗi là danh sách gạch đầu dòng đỏ */
export const AnswerBody: React.FC<{ paragraphs: FaqParagraph[] }> = ({ paragraphs }) => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 14 }}>
      {paragraphs.map((p, i) =>
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
  );
};

export const InfoShell: React.FC<{
  active: InfoTab;
  /** Tiêu đề ở ảnh bìa; bỏ trống thì không có ảnh bìa */
  banner?: string;
  scrollRef: React.RefObject<ScrollViewInstance | null>;
  children: React.ReactNode;
}> = ({ active, banner, scrollRef, children }) => {
  const { c } = useTheme();
  const router = useRouter();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const compactNav = width < 720;

  const link = (label: string, on: boolean, onPress?: () => void) => (
    <Pressable key={label} accessibilityRole="link" accessibilityState={{ selected: on }} onPress={onPress} disabled={on} style={{ minHeight: 44, paddingHorizontal: compactNav ? 7 : 14, justifyContent: 'center' }}>
      <Txt f="bold" size={compactNav ? 14 : 15} color={on ? c.logoRed : c.logoInk}>
        {label}
      </Txt>
    </Pressable>
  );
  const nav = [link('Trang chủ', false, () => router.push('/')), ...TABS.map((t) => link(t.label, t.id === active, () => router.push(t.href)))];

  return (
    <View style={{ flex: 1, backgroundColor: c.logoPaper }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ backgroundColor: c.logoPaper, borderBottomWidth: 1, borderBottomColor: INK_LINE }}>
          <View style={{ width: '100%', maxWidth: INFO_MAX_W, alignSelf: 'center', minHeight: 76, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Pressable accessibilityRole="link" accessibilityLabel="Về trang chủ Đông A" onPress={() => router.push('/')} style={{ minHeight: 44, justifyContent: 'center' }}>
              <BrandLogo compact={width < 400} />
            </Pressable>
            {!compactNav ? <View accessibilityRole="menu" style={{ flexDirection: 'row', alignItems: 'center' }}>{nav}</View> : null}
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
          {compactNav ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 4, paddingBottom: 6 }} accessibilityRole="menu">
              {nav}
            </ScrollView>
          ) : null}
        </View>

        {banner ? (
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
              {banner}
            </Txt>
          </View>
        ) : null}

        {children}

        <View style={{ backgroundColor: c.logoInk }}>
          <View style={{ width: '100%', maxWidth: INFO_MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 24, flexDirection: wide ? 'row' : 'column', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <BrandLogo light />
            <Txt size={13} color="rgba(250, 244, 231, 0.78)">
              © 2026 · Đông A
            </Txt>
            <Pressable accessibilityRole="link" accessibilityLabel="Về đầu trang" onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: !reduce })} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
};
