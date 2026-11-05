/**
 * AI Hub Dashboard - Trung tâm Điều khiển Trợ lý AI (Thiết kế độc lập chuẩn EdTech)
 * Bố cục dạng Hub Grid 4 thẻ tính năng trọng tâm (đã lược bỏ Homework Helper & Course Creator theo yêu cầu):
 * 1. AI Tutor: Hỏi đáp trực tiếp cùng Tiểu Tướng & Nhập vai danh tướng (trích dẫn DVSKTT)
 * 2. Quizzes: Luyện đề trắc nghiệm thông minh theo 5 nhóm chủ đề & ma trận Bloom GDPT 2018
 * 3. Flash Cards: Bộ thẻ ghi nhớ mốc năm, danh tướng và chiến thuật 2 mặt tương tác
 * 4. Summarizer: Tóm tắt bài học, chiến dịch và sử liệu ngắn gọn
 *
 * Tách biệt hoàn toàn thành module riêng, không can thiệp hay ghi đè lên code của đồng đội.
 */
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  FileText,
  Layers,
  ListChecks,
  Sparkles,
} from 'lucide-react-native';
import * as aiApi from '@/api/aiApi';
import { errorMessage } from '@/api/client';
import { AiQuizModal } from '@/components/admin/AiQuizModal';
import type { Session } from '@/components/auth';
import { ChatPanel, MarkdownText } from '@/components/portal/TieuTuong';
import { Btn, Card, Chip, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

export type AiHubView = 'hub' | 'tutor' | 'quizzes' | 'flashcards' | 'summarizer';

interface FlashcardItem {
  id: string;
  category: string;
  front: string;
  back: string;
  reference: string;
}

const HISTORICAL_FLASHCARDS: FlashcardItem[] = [
  {
    id: 'fc-1',
    category: 'Mốc năm 1258',
    front: 'Cuộc kháng chiến chống quân Mông Cổ lần thứ nhất diễn ra vào năm nào và kết thúc bằng trận đánh nào?',
    back: 'Diễn ra tháng 1/1258. Quân ta rút lui bảo toàn lực lượng rồi phản công sấm sét bằng Đại thắng Đông Bộ Đầu (29/1/1258).',
    reference: 'DVSKTT Bản Kỷ Quyển V, tờ 22a-23b',
  },
  {
    id: 'fc-2',
    category: 'Câu nói bất hủ 1258',
    front: 'Câu nói nổi tiếng của Thái sư Trần Thủ Độ khi vua Trần Thái Tông lo ngại trước thế giặc năm 1258 là gì?',
    back: '“Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo!”',
    reference: 'DVSKTT Bản Kỷ Quyển V, tờ 22b',
  },
  {
    id: 'fc-3',
    category: 'Hội nghị Bình Than 1282',
    front: 'Thiếu niên anh hùng nào vì còn nhỏ tuổi không được dự bàn việc quân tại Hội nghị Bình Than đã bóp nát quả cam?',
    back: 'Hoài Văn hầu Trần Quốc Toản. Sau đó chàng về chiêu mộ hơn 1.000 gia nô thêu cờ “Phá cường địch, báo hoàng ân”.',
    reference: 'SGK Lịch sử 7 - KNTT, Bài 15',
  },
  {
    id: 'fc-4',
    category: 'Hội nghị Diên Hồng 1285',
    front: 'Tại Hội nghị Diên Hồng đầu năm 1285, Thượng hoàng Trần Thánh Tông hỏi ý kiến các bô lão và nhận được câu trả lời đồng thanh là gì?',
    back: 'Muôn người cùng hô vang một tiếng: “ĐÁNH!” — Biểu tượng sức mạnh đoàn kết toàn dân tộc.',
    reference: 'DVSKTT Bản Kỷ Quyển V, tờ 44a',
  },
  {
    id: 'fc-5',
    category: 'Khí tiết anh hùng 1285',
    front: 'Bảo Nghĩa vương Trần Bình Trọng trước lời dụ dỗ phong vương của giặc Nguyên đã khẳng khái thét lên câu gì?',
    back: '“Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!”',
    reference: 'DVSKTT Bản Kỷ Quyển V, tờ 45b',
  },
  {
    id: 'fc-6',
    category: 'Chiến sự 1287 - 1288',
    front: 'Vị tướng nào đã chỉ huy trận hải chiến Vân Đồn tiêu diệt đoàn thuyền lương 70 vạn thạch của Trương Văn Hổ?',
    back: 'Nhân Huệ vương Trần Khánh Dư, làm phá sản hoàn toàn kế hoạch tiếp tế của giặc Nguyên.',
    reference: 'SGK Lịch sử 7 - KNTT, Bài 15',
  },
  {
    id: 'fc-7',
    category: 'Đại thắng Bạch Đằng 1288',
    front: 'Chiến thuật quyết định nào được Quốc công Tiết chế Trần Hưng Đạo áp dụng trên sông Bạch Đằng năm 1288?',
    back: 'Bố trí trận địa cọc ngầm bịt sắt, nhử địch vào bẫy khi thủy triều rút, bắt sống Ô Mã Nhi và Phàn Tiếp.',
    reference: 'DVSKTT Bản Kỷ Quyển V, tờ 54a-56a',
  },
  {
    id: 'fc-8',
    category: 'Kế sách toàn cuộc',
    front: 'Kế sách xuyên suốt cả 3 lần kháng chiến khiến quân Mông - Nguyên lâm vào cảnh thiếu lương thảo kiệt quệ là gì?',
    back: 'Kế sách “Vườn không nhà trống” — chủ động rút lui, sơ tán toàn bộ nhân dân và lương thực khỏi Thăng Long.',
    reference: 'Toàn bộ 3 cuộc kháng chiến chống Mông - Nguyên',
  },
];

const HISTORICAL_FIGURES = [
  { id: 1, name: 'Trần Hưng Đạo', role: 'Quốc Công Tiết Chế', quote: 'Nếu bệ hạ muốn hàng, xin chém đầu tôi trước.' },
  { id: 2, name: 'Trần Quốc Toản', role: 'Hoài Văn Hầu', quote: 'Phá cường địch, báo hoàng ân.' },
  { id: 3, name: 'Trần Thủ Độ', role: 'Thái Sư', quote: 'Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo.' },
  { id: 4, name: 'Trần Bình Trọng', role: 'Bảo Nghĩa Vương', quote: 'Ta thà làm quỷ nước Nam chứ không thèm làm vương đất Bắc.' },
  { id: 5, name: 'Trần Nhân Tông', role: 'Phật Hoàng Trúc Lâm', quote: 'Xã tắc hai phen chồn ngựa đá / Non sông nghìn thuở vững âu vàng.' },
  { id: 6, name: 'Trần Khánh Dư', role: 'Nhân Huệ Vương', quote: 'Đánh đắm đoàn thuyền lương Vân Đồn, bẻ gãy nhuệ khí giặc Nguyên.' },
];

export interface AiHubDashboardProps {
  session: Session;
  onOpenSource?: (kind: string, id: number) => void;
  onClose?: () => void;
}

export const AiHubDashboard: React.FC<AiHubDashboardProps> = ({ session, onOpenSource, onClose }) => {
  const { c } = useTheme();
  const toast = useToast();

  const [activeView, setActiveView] = useState<AiHubView>('hub');
  const [quizModalOpen, setQuizModalOpen] = useState<boolean>(false);

  // State cho Flashcards
  const [fcIndex, setFcIndex] = useState<number>(0);
  const [fcFlipped, setFcFlipped] = useState<boolean>(false);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());

  // State cho Summarizer
  const [summaryKind, setSummaryKind] = useState<string>('all');
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);

  // State cho AI Tutor / Roleplay
  const [tutorTab, setTutorTab] = useState<'chat' | 'roleplay'>('chat');
  const [selectedFigure, setSelectedFigure] = useState<typeof HISTORICAL_FIGURES[0] | null>(null);
  const tutorScrollRef = useRef<ScrollViewInstance>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      tutorScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // ---------------------------------------------------------------------- Xử lý Summarizer
  const handleSummarizeTopic = async (topicTitle: string, promptText: string) => {
    setSummaryLoading(true);
    setSummaryText(null);
    try {
      const res = await aiApi.aiAsk(session.token, {
        question: `Tóm tắt ngắn gọn, dễ nhớ (khoảng 3 đến 5 gạch đầu dòng) về: ${promptText}. Nêu rõ mốc thời gian, người chỉ huy và ý nghĩa.`,
      });
      if (res?.message?.content) {
        setSummaryText(`### Tóm tắt: ${topicTitle}\n\n${res.message.content}`);
      }
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setSummaryLoading(false);
    }
  };

  // ---------------------------------------------------------------------- Xử lý Flashcards
  const currentCard = HISTORICAL_FLASHCARDS[fcIndex];
  const isMastered = masteredIds.has(currentCard.id);

  const handleNextCard = () => {
    setFcFlipped(false);
    setFcIndex((prev) => (prev + 1) % HISTORICAL_FLASHCARDS.length);
  };

  const handlePrevCard = () => {
    setFcFlipped(false);
    setFcIndex((prev) => (prev - 1 + HISTORICAL_FLASHCARDS.length) % HISTORICAL_FLASHCARDS.length);
  };

  const handleToggleMastered = () => {
    setMasteredIds((prev) => {
      const next = new Set(prev);
      if (next.has(currentCard.id)) next.delete(currentCard.id);
      else next.add(currentCard.id);
      return next;
    });
    handleNextCard();
  };

  // ======================================================================
  // GIAO DIỆN TRANG CHỦ AI HUB (LƯỚI 4 THẺ CÂN ĐỐI 2x2)
  // ======================================================================
  if (activeView === 'hub') {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 60, gap: 24, maxWidth: 960, alignSelf: 'center', width: '100%' }} keyboardShouldPersistTaps="handled">
        {/* Header chào mừng */}
        <View style={{ alignItems: 'center', gap: 10, paddingTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Txt size={22}>👋</Txt>
            <Txt f="displayHeavy" size={24} color={c.muc}>
              Your AI Tutor — Hào Khí Đông A
            </Txt>
          </View>
          <Txt f="bold" size={28} center color={c.muc}>
            Chats, quizzes, and practice — together.
          </Txt>
          <Txt size={15} center color={c.muc2} style={{ maxWidth: 620 }}>
            Khởi đầu từ một chủ đề hoặc bài học để luyện đề trắc nghiệm, ôn thẻ ghi nhớ hoặc hỏi đáp cùng trợ lý AI.
          </Txt>
          {onClose ? (
            <Btn title="Đóng bảng điều khiển" tone="giay" size="sm" onPress={onClose} />
          ) : null}
        </View>

        {/* Lưới 4 thẻ tính năng chính (2x2 Grid) */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, justifyContent: 'center' }}>
          {/* Card 1: AI Tutor (Hỏi đáp & Nhập vai) */}
          <Pressable
            onPress={() => {
              setTutorTab('chat');
              setActiveView('tutor');
            }}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: 360,
              maxWidth: 440,
              minHeight: 180,
              padding: 22,
              borderRadius: 20,
              backgroundColor: pressed ? c.the2 : c.the,
              borderWidth: 2,
              borderColor: c.vien,
              gap: 12,
              justifyContent: 'space-between',
            })}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={24} color="#4F46E5" />
            </View>
            <View style={{ gap: 4 }}>
              <Txt f="bold" size={18} color={c.muc}>AI Tutor</Txt>
              <Txt size={13} color={c.muc2} numberOfLines={3}>
                Hỏi đáp tự do về lịch sử thời Trần, truy xuất căn cứ sử liệu chính thức từ Đại Việt Sử Ký Toàn Thư và đàm đạo cùng danh tướng.
              </Txt>
            </View>
          </Pressable>

          {/* Card 2: Quizzes (Luyện đề trắc nghiệm Bloom) */}
          <Pressable
            onPress={() => setQuizModalOpen(true)}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: 360,
              maxWidth: 440,
              minHeight: 180,
              padding: 22,
              borderRadius: 20,
              backgroundColor: pressed ? c.the2 : c.the,
              borderWidth: 2,
              borderColor: c.vien,
              gap: 12,
              justifyContent: 'space-between',
            })}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' }}>
              <ListChecks size={24} color="#059669" />
            </View>
            <View style={{ gap: 4 }}>
              <Txt f="bold" size={18} color={c.muc}>Quizzes</Txt>
              <Txt size={13} color={c.muc2} numberOfLines={3}>
                Sinh đề trắc nghiệm chuẩn hóa 4 mức độ nhận thức Bloom (Nhận biết, Thông hiểu, Vận dụng) theo 5 nhóm chủ đề SGK 7.
              </Txt>
            </View>
          </Pressable>

          {/* Card 3: Flash Cards (Thẻ ghi nhớ mốc năm & sự kiện) */}
          <Pressable
            onPress={() => setActiveView('flashcards')}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: 360,
              maxWidth: 440,
              minHeight: 180,
              padding: 22,
              borderRadius: 20,
              backgroundColor: pressed ? c.the2 : c.the,
              borderWidth: 2,
              borderColor: c.vien,
              gap: 12,
              justifyContent: 'space-between',
            })}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={24} color="#EA580C" />
            </View>
            <View style={{ gap: 4 }}>
              <Txt f="bold" size={18} color={c.muc}>Flash Cards</Txt>
              <Txt size={13} color={c.muc2} numberOfLines={3}>
                Bộ thẻ ghi nhớ 2 mặt tương tác, ôn luyện nhanh mốc thời gian (1258, 1285, 1288), danh tướng và kế sách kháng chiến.
              </Txt>
            </View>
          </Pressable>

          {/* Card 4: Summarizer (Tóm tắt sử liệu) */}
          <Pressable
            onPress={() => setActiveView('summarizer')}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: 360,
              maxWidth: 440,
              minHeight: 180,
              padding: 22,
              borderRadius: 20,
              backgroundColor: pressed ? c.the2 : c.the,
              borderWidth: 2,
              borderColor: c.vien,
              gap: 12,
              justifyContent: 'space-between',
            })}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FCE7F3', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={24} color="#DB2777" />
            </View>
            <View style={{ gap: 4 }}>
              <Txt f="bold" size={18} color={c.muc}>Summarizer</Txt>
              <Txt size={13} color={c.muc2} numberOfLines={3}>
                Tóm tắt diễn biến trận đánh, sự kiện và nhân vật lịch sử thời Trần thành các ý súc tích, dễ nhớ.
              </Txt>
            </View>
          </Pressable>
        </View>

        {/* Modal sinh đề trắc nghiệm AI */}
        {quizModalOpen ? (
          <AiQuizModal
            open={quizModalOpen}
            onClose={() => setQuizModalOpen(false)}
            session={session}
          />
        ) : null}
      </ScrollView>
    );
  }

  // ======================================================================
  // GIAO DIỆN CON 1: FLASHCARDS TƯƠNG TÁC LẬT MẶT
  // ======================================================================
  if (activeView === 'flashcards') {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 18, maxWidth: 760, alignSelf: 'center', width: '100%' }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Btn icon={ArrowLeft} title="Quay lại AI Hub" tone="giay" size="sm" onPress={() => setActiveView('hub')} />
          <Txt f="bold" size={18} color={c.muc} style={{ flex: 1 }}>Thẻ ghi nhớ Flashcards</Txt>
          <Chip text={`${masteredIds.size}/${HISTORICAL_FLASHCARDS.length} đã nhớ`} bg={c.ngocNhat} fg={c.ngocChu} />
        </View>

        {/* Thẻ 2 mặt */}
        <Pressable
          onPress={() => setFcFlipped(!fcFlipped)}
          style={{
            minHeight: 260,
            padding: 24,
            borderRadius: 24,
            backgroundColor: fcFlipped ? c.thuyNhat : c.the,
            borderWidth: 2,
            borderColor: fcFlipped ? c.thuy : c.vien,
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Chip text={currentCard.category} bg={c.giay2} fg={c.muc2} />
            <Txt size={12} color={c.muc3}>
              Thẻ {fcIndex + 1}/{HISTORICAL_FLASHCARDS.length} (Bấm để lật)
            </Txt>
          </View>

          <View style={{ alignItems: 'center', paddingVertical: 16, gap: 10 }}>
            <Txt f="bold" size={fcFlipped ? 17 : 20} center color={fcFlipped ? c.thuyChu : c.muc}>
              {fcFlipped ? currentCard.back : currentCard.front}
            </Txt>
            {fcFlipped ? (
              <Txt size={12} color={c.muc3} center>
                Nguồn: {currentCard.reference}
              </Txt>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} color={c.muc3} />
            <Txt size={12} color={c.muc3}>
              {fcFlipped ? 'Mặt sau (Đáp án & Căn cứ sử liệu)' : 'Mặt trước (Câu hỏi thử thách)'}
            </Txt>
          </View>
        </Pressable>

        {/* Nút điều hướng & đánh dấu */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <Btn title="← Câu trước" tone="giay" size="sm" onPress={handlePrevCard} />

          <Btn
            icon={isMastered ? Check : Sparkles}
            title={isMastered ? 'Đã nhớ vững' : 'Đánh dấu đã thuộc'}
            tone={isMastered ? 'ngoc' : 'son'}
            size="md"
            onPress={handleToggleMastered}
          />

          <Btn title="Câu sau →" tone="giay" size="sm" onPress={handleNextCard} />
        </View>
      </ScrollView>
    );
  }

  if (activeView === 'summarizer') {
    const TOPICS = [
      { id: 'kc1', title: 'Kháng chiến lần 1 (1258)', prompt: 'Cuộc kháng chiến chống Mông Cổ lần thứ nhất năm 1258, trận Bình Lệ Nguyên và Đông Bộ Đầu' },
      { id: 'kc2', title: 'Kháng chiến lần 2 (1285)', prompt: 'Cuộc kháng chiến chống quân Nguyên lần 2 năm 1285, Hội nghị Bình Than, Diên Hồng và Hàm Tử - Chương Dương' },
      { id: 'kc3', title: 'Kháng chiến lần 3 (1287-1288)', prompt: 'Cuộc kháng chiến chống quân Nguyên lần 3 năm 1287-1288, trận Vân Đồn và Bạch Đằng' },
      { id: 'qs', title: 'Nghệ thuật quân sự thời Trần', prompt: 'Nghệ thuật quân sự đánh giặc giữ nước của nhà Trần và bài học Khoan thư sức dân' },
    ];

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 18, maxWidth: 840, alignSelf: 'center', width: '100%' }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Btn icon={ArrowLeft} title="Quay lại AI Hub" tone="giay" size="sm" onPress={() => setActiveView('hub')} />
          <Txt f="bold" size={18} color={c.muc} style={{ flex: 1 }}>Summarizer — Tóm tắt sử liệu</Txt>
        </View>

        <Txt size={14} color={c.muc2}>Chọn một chuyên đề lịch sử để AI tóm tắt thành 3–5 gạch đầu dòng cô đọng nhất:</Txt>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {TOPICS.map((t) => (
            <Btn
              key={t.id}
              icon={BookOpen}
              title={t.title}
              tone={summaryKind === t.id ? 'son' : 'giay'}
              size="sm"
              onPress={() => {
                setSummaryKind(t.id);
                handleSummarizeTopic(t.title, t.prompt);
              }}
            />
          ))}
        </View>

        {summaryLoading ? (
          <View style={{ alignItems: 'center', padding: 30, gap: 10 }}>
            <Spinner />
            <Txt size={14} color={c.muc2}>Tiểu Tướng đang cô đọng sử liệu...</Txt>
          </View>
        ) : null}

        {summaryText && !summaryLoading ? (
          <Card style={{ padding: 18, gap: 10, backgroundColor: c.the, borderColor: c.vien }}>
            <MarkdownText content={summaryText} size={15} lineHeight={24} />
          </Card>
        ) : null}
      </ScrollView>
    );
  }

  if (activeView === 'tutor') {
    return (
      <ScrollView ref={tutorScrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 16, maxWidth: 920, alignSelf: 'center', width: '100%' }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Btn icon={ArrowLeft} title="Quay lại AI Hub" tone="giay" size="sm" onPress={() => { setSelectedFigure(null); setActiveView('hub'); }} />
          <Txt f="bold" size={18} color={c.muc} style={{ flex: 1 }}>AI Tutor — Trợ lý Tiểu Tướng</Txt>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Btn
              title="Hỏi đáp chung"
              tone={tutorTab === 'chat' && !selectedFigure ? 'son' : 'giay'}
              size="sm"
              onPress={() => { setSelectedFigure(null); setTutorTab('chat'); }}
            />
            <Btn
              title="Nhập vai Danh tướng"
              tone={tutorTab === 'roleplay' || selectedFigure ? 'son' : 'giay'}
              size="sm"
              onPress={() => setTutorTab('roleplay')}
            />
          </View>
        </View>

        {/* Chế độ Nhập vai */}
        {tutorTab === 'roleplay' ? (
          selectedFigure ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Chip text={`Đang đàm đạo cùng: ${selectedFigure.name}`} bg={c.sonNhat} fg={c.sonChu} />
                <Btn title="Chọn vị tướng khác" tone="giay" size="sm" onPress={() => setSelectedFigure(null)} />
              </View>
              <ChatPanel
                session={session}
                mode="roleplay"
                onScrollToEnd={scrollToBottom}
                figure={{ id: selectedFigure.id, name: selectedFigure.name }}
                placeholder={`Em muốn hỏi gì với ${selectedFigure.name}?`}
                samples={[
                  `Ngài nghĩ gì về âm mưu xâm lược của giặc Thát?`,
                  `Kế sách giữ nước quan trọng nhất của ngài là gì?`,
                  `Ý nghĩa câu nói nổi tiếng của ngài là gì?`,
                ]}
              />
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <Txt size={14} color={c.muc2}>Chọn một nhân vật lịch sử thời Trần để đối thoại trực tiếp:</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {HISTORICAL_FIGURES.map((fig) => (
                  <Pressable
                    key={fig.id}
                    onPress={() => setSelectedFigure(fig)}
                    style={({ pressed }) => ({
                      flexGrow: 1,
                      flexBasis: 260,
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: pressed ? c.the2 : c.the,
                      borderWidth: 2,
                      borderColor: c.vien,
                      gap: 6,
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Txt f="bold" size={16} color={c.muc}>{fig.name}</Txt>
                      <Chip text={fig.role} bg={c.giay2} fg={c.muc2} />
                    </View>
                    <Txt size={12} color={c.muc3} style={{ fontStyle: 'italic' }}>“{fig.quote}”</Txt>
                  </Pressable>
                ))}
              </View>
            </View>
          )
        ) : (
          /* Chế độ Hỏi đáp Tiểu Tướng chung */
          <ChatPanel session={session} mode="tutor" onOpen={onOpenSource} onScrollToEnd={scrollToBottom} />
        )}
      </ScrollView>
        );
  }

  return null;
};
