/**
 * Trang "Câu hỏi thường gặp" (/cau-hoi-thuong-gap), mở từ nút "Xem tất cả câu hỏi" ở trang chủ. Dùng khung của trang chủ (components/info-page.tsx: cùng thanh điều
 * hướng và chân trang) và bố cục khối "Câu hỏi thường gặp" ở trang chủ: bên trái nhãn nhỏ, tiêu đề Manrope đậm kèm dòng nhấn Newsreader nghiêng đỏ, mô tả và nút;
 * bên phải danh sách các câu ngăn bằng đường kẻ mảnh, gom theo nhóm bằng nhãn đỏ nhỏ, bấm để mở/đóng (đóng sẵn, mỗi câu độc lập). Hẹp hơn 1000 px thì xếp dọc.
 * Nội dung ở constants/faq.ts. Không có hiệu ứng hiện dần hay trượt.
 */
import { useRef, useState } from 'react';
import { View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { Band, Cta, GoldRings, INK_LINE, INK_SOFT } from '@/components/home';
import { InfoShell, PublicSiteNotice, QaRow } from '@/components/info-page';
import { Txt } from '@/components/ui';
import { FAQ_GROUPS } from '@/constants/faq';
import { useTheme } from '@/hooks/use-theme';

function FaqBody() {
  const { c } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const two = width >= 1000;
  const h = wide ? 42 : 32;
  const [open, setOpen] = useState<string[]>([]);
  const toggle = (id: string) => setOpen((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Band bg={c.logoPaper} wide={wide} padTop={wide ? 136 : 108} decor={<GoldRings />}>
      <View style={{ flexDirection: two ? 'row' : 'column', alignItems: 'flex-start', gap: two ? 56 : 32 }}>
        <View testID="faq-heading" style={{ width: two ? 420 : '100%', gap: 16 }}>
          <Txt f="bold" size={12.5} color={c.logoRed} upper style={{ letterSpacing: 1.6 }}>
            Có thể bạn đang tò mò
          </Txt>
          <Txt f="heavy" size={h} color={c.logoInk} accessibilityRole="header" style={{ lineHeight: h + 7, letterSpacing: -1 }}>
            Câu hỏi{'\n'}
            <Txt f="serifItalic" size={h} color={c.logoRed} style={{ lineHeight: h + 9, letterSpacing: -0.5 }}>
              thường gặp.
            </Txt>
          </Txt>
          <Txt f="medium" size={16} color={INK_SOFT} style={{ lineHeight: 24 }}>
            Mọi điều cần biết về Đông A, dành cho học sinh, giáo viên và nhà trường. Cần thêm hỗ trợ? Hãy hỏi thầy cô hoặc quản trị viên của trường, hoặc đọc điều khoản sử dụng.
          </Txt>
          <Cta title="Xem điều khoản sử dụng" tone="logo" arrow onPress={() => router.push('/dieu-khoan-su-dung')} testID="faq-terms" />
          <PublicSiteNotice />
        </View>
        <View style={{ flex: two ? 1 : undefined, width: two ? undefined : '100%', gap: 40 }}>
          {FAQ_GROUPS.map((g) => (
            <View key={g.id} style={{ gap: 14 }}>
              <Txt f="bold" size={12.5} color={c.logoRed} upper style={{ letterSpacing: 1.6 }}>
                {g.title}
              </Txt>
              <View style={{ borderTopWidth: 1, borderTopColor: INK_LINE }}>
                {g.categories.flatMap((k) => k.items).map((item) => (
                  <QaRow key={item.id} q={item.q} paragraphs={item.a} open={open.includes(item.id)} onToggle={() => toggle(item.id)} testID={`faq-q-${item.id}`} />
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    </Band>
  );
}

export function FaqPage() {
  const scroll = useRef<ScrollViewInstance>(null);
  useDocumentTitle('Câu hỏi thường gặp – Đông A');
  return (
    <InfoShell active="faq" scrollRef={scroll}>
      <FaqBody />
    </InfoShell>
  );
}
