/**
 * Trang "Câu hỏi thường gặp" (/cau-hoi-thuong-gap), mở từ nút "Xem tất cả câu hỏi" ở trang chủ. Bố cục học từ trang câu hỏi thường gặp của EduPath AI:
 * không ảnh bìa, tiêu đề lớn chữ nghiêng đỏ ở giữa, rồi danh sách phẳng mọi câu hỏi; mỗi câu là một thẻ trắng bo tròn có biểu tượng dấu hỏi đỏ, câu hỏi
 * và mũi tên, bấm để mở/đóng (đóng sẵn, mỗi câu độc lập); cuối trang là dòng hỗ trợ. Các câu gom theo nhóm (nhãn đỏ nhỏ phía trên) để dễ tìm.
 * Nội dung ở constants/faq.ts. Không có hiệu ứng hiện dần hay trượt.
 */
import { useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, ChevronDown, ChevronUp, CircleHelp } from 'lucide-react-native';
import { PatternOverlay } from '@/components/art';
import { useDocumentTitle } from '@/components/auth';
import { AnswerBody, InfoShell, INK_LINE, INK_SOFT } from '@/components/info-page';
import { Txt } from '@/components/ui';
import { FAQ_GROUPS } from '@/constants/faq';
import { useTheme } from '@/hooks/use-theme';

const CARD_SHADOW = { boxShadow: '0 12px 28px rgba(35, 56, 47, 0.10)' } as unknown as object;

export function FaqPage() {
  const { c } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const [open, setOpen] = useState<string[]>([]);
  const scroll = useRef<ScrollViewInstance>(null);
  useDocumentTitle('Câu hỏi thường gặp – Đông A');
  const toggle = (id: string) => setOpen((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <InfoShell active="faq" scrollRef={scroll}>
      <View style={{ overflow: 'hidden' }}>
        <PatternOverlay opacity={0.07} />
        <View style={{ width: '100%', maxWidth: 1000, alignSelf: 'center', paddingHorizontal: 16, paddingTop: wide ? 56 : 36, paddingBottom: wide ? 80 : 48 }}>
          <Txt
            f="serifItalic"
            size={wide ? 54 : 36}
            color={c.logoRed}
            center
            accessibilityRole="header"
            style={{ lineHeight: wide ? 64 : 44, letterSpacing: wide ? -1.6 : -0.8, marginBottom: wide ? 48 : 30 }}
          >
            Câu hỏi thường gặp
          </Txt>

          <View style={{ gap: wide ? 34 : 26 }}>
            {FAQ_GROUPS.map((g) => (
              <View key={g.id} style={{ gap: wide ? 20 : 14 }}>
                <Txt f="bold" size={13} color={c.logoRed} upper style={{ letterSpacing: 1.6 }}>
                  {g.title}
                </Txt>
                {g.categories.flatMap((k) => k.items).map((item) => {
                  const on = open.includes(item.id);
                  return (
                    <View key={item.id} style={[{ borderRadius: 20, backgroundColor: '#ffffff', overflow: 'hidden' }, CARD_SHADOW]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded: on }}
                        aria-expanded={on}
                        onPress={() => toggle(item.id)}
                        testID={`faq-q-${item.id}`}
                        style={({ pressed }) => ({ minHeight: wide ? 84 : 68, paddingHorizontal: wide ? 28 : 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: on ? 1 : 0, borderBottomColor: INK_LINE, opacity: pressed ? 0.85 : 1 })}
                      >
                        <CircleHelp size={wide ? 28 : 24} color={c.logoRed} strokeWidth={2} />
                        <Txt f="heavy" size={wide ? 20 : 16.5} color={c.logoInk} style={{ flex: 1, lineHeight: wide ? 28 : 23 }}>
                          {item.q}
                        </Txt>
                        {on ? <ChevronUp size={22} color={INK_SOFT} strokeWidth={2.2} /> : <ChevronDown size={22} color={INK_SOFT} strokeWidth={2.2} />}
                      </Pressable>
                      {on ? (
                        <View style={{ paddingHorizontal: wide ? 28 : 18, paddingVertical: 22 }}>
                          <AnswerBody paragraphs={item.a} />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={{ alignItems: 'center', gap: 4, marginTop: wide ? 44 : 32 }}>
            <Txt size={wide ? 17 : 15} color={INK_SOFT} center style={{ lineHeight: 26 }}>
              Bạn cần thêm hỗ trợ? Hãy hỏi thầy cô hoặc quản trị viên của trường, hoặc đọc điều khoản sử dụng.
            </Txt>
            <Pressable accessibilityRole="link" onPress={() => router.push('/dieu-khoan-su-dung')} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Txt f="heavy" size={15.5} color={c.logoRed}>
                Xem điều khoản sử dụng
              </Txt>
              <ArrowRight size={18} color={c.logoRed} strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>
      </View>
    </InfoShell>
  );
}
