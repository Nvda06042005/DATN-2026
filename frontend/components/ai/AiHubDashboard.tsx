/**
 * AI Hub Dashboard - Trung tâm Điều khiển Trợ lý AI Sử học Đông A (Thiết kế độc lập chuẩn EdTech)
 * Kết nối trực tiếp với Hệ thống AI Python của người dùng:
 * 1. AI Tutor: Hỏi đáp đa lượt cùng Thầy Đông A & Nhập vai 8 danh tướng (Model NLP 81 chủ điểm + ĐVSKTT)
 * 2. Quizzes: Luyện đề trắc nghiệm thông minh theo 5 nhóm chủ đề & ma trận Bloom GDPT 2018
 * 3. Flash Cards: Bộ thẻ ghi nhớ mốc năm, danh tướng và chiến thuật 2 mặt tương tác
 * 4. Summarizer: Tóm tắt bài học, chiến dịch và sử liệu ngắn gọn
 * 5. Lộ trình BKT Cá nhân hóa (Bayesian Knowledge Tracing): Theo dõi xác suất nắm vững P(L) và gợi ý ôn tập
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  FileText,
  Layers,
  ListChecks,
  RefreshCw,
  Sparkles,
  Target,
} from 'lucide-react-native';
import * as aiApi from '@/api/aiApi';
import { errorMessage } from '@/api/client';
import { AiQuizModal } from '@/components/admin/AiQuizModal';
import type { Session } from '@/components/auth';
import { ChatPanel, MarkdownText } from '@/components/portal/TieuTuong';
import { Btn, Card, Chip, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { BktRecommendationItem, BktRecommendationsResponse } from '@/types/ai';

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
  { id: 1, name: 'Trần Hưng Đạo', role: 'Quốc Công Tiết Chế', quote: 'Nếu bệ hạ muốn hàng, xin hãy chém đầu thần trước đã!' },
  { id: 2, name: 'Trần Quốc Toản', role: 'Hoài Văn Hầu', quote: 'Phá cường địch, báo hoàng ân!' },
  { id: 3, name: 'Trần Thủ Độ', role: 'Thái Sư', quote: 'Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo!' },
  { id: 4, name: 'Trần Bình Trọng', role: 'Bảo Nghĩa Vương', quote: 'Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!' },
  { id: 5, name: 'Trần Nhân Tông', role: 'Phật Hoàng Trúc Lâm', quote: 'Xã tắc hai phen chồn ngựa đá / Non sông nghìn thuở vững âu vàng.' },
  { id: 6, name: 'Trần Khánh Dư', role: 'Nhân Huệ Vương', quote: 'Đánh đắm đoàn thuyền lương Vân Đồn, bẻ gãy dạ dày giặc Nguyên!' },
  { id: 7, name: 'Phạm Ngũ Lão', role: 'Điện Súy', quote: 'Múa giáo non sông trải mấy thu / Ba quân khí mạnh nuốt trôi trâu.' },
  { id: 8, name: 'Yết Kiêu', role: 'Danh Tướng Thủy Chiến', quote: 'Dưới làn nước sâu sông Bạch Đằng, một lòng đục thuyền giặc giữ non sông!' },
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
  const [pendingTutorQuestion, setPendingTutorQuestion] = useState<string | null>(null);
  const tutorScrollRef = useRef<ScrollViewInstance>(null);

  // State cho Lộ trình BKT Cá nhân hóa
  const [bktData, setBktData] = useState<BktRecommendationsResponse | null>(null);
  const [bktLoading, setBktLoading] = useState<boolean>(false);

  const loadBktRecommendations = useCallback(async () => {
    setBktLoading(true);
    try {
      const res = await aiApi.aiBktRecommendations(session.token, 6);
      setBktData(res);
    } catch {
      // Bỏ qua nếu chưa có dữ liệu
    } finally {
      setBktLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    loadBktRecommendations();
  }, [loadBktRecommendations]);

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
        question: `Tóm tắt 3 ý chính dễ thuộc về: ${promptText}`,
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

  const handleAskFromBkt = (rec: BktRecommendationItem) => {
    setSelectedFigure(null);
    setTutorTab('chat');
    setPendingTutorQuestion(`Giải thích chi tiết giúp em về chủ đề: ${rec.topic}`);
    setActiveView('tutor');
  };

  // ======================================================================
  // GIAO DIỆN TRANG CHỦ AI HUB (LƯỚI 4 THẺ CÂN ĐỐI 2x2 + LỘ TRÌNH BKT)
  // ======================================================================
  if (activeView === 'hub') {
    const recs = bktData?.recommendations ?? [];
    const params = bktData?.bkt_parameters ?? { p_l0: 0.3, p_t: 0.15, p_g: 0.25, p_s: 0.1, mastery_threshold: 0.6 };

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 60, gap: 24, maxWidth: 960, alignSelf: 'center', width: '100%' }} keyboardShouldPersistTaps="handled">
        {/* Header chào mừng */}
        <View style={{ alignItems: 'center', gap: 10, paddingTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Txt size={22}>👋</Txt>
            <Txt f="displayHeavy" size={24} color={c.muc}>
              Trợ lý AI Sử học Đông A — Hào Khí Đông A
            </Txt>
          </View>
          <Txt f="bold" size={26} center color={c.muc}>
            Hỏi đáp Sử liệu • Sinh đề Bloom • Hồ sơ BKT Cá nhân hóa
          </Txt>
          <Txt size={15} center color={c.muc2} style={{ maxWidth: 680 }}>
            Tích hợp Model NLP Đông A (81 chủ điểm chuyên sâu, 1.083 đoạn biên niên sử Đại Việt Sử Ký Toàn Thư) và thuật toán Bayesian Knowledge Tracing theo dõi mức độ nắm vững kiến thức P(L).
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={24} color="#4F46E5" />
              </View>
              <Chip text="81 Chủ điểm • 8 Danh tướng" bg={c.thuyNhat} fg={c.thuyChu} />
            </View>
            <View style={{ gap: 4 }}>
              <Txt f="bold" size={18} color={c.muc}>AI Tutor — Thầy Đông A & Nhập vai</Txt>
              <Txt size={13} color={c.muc2} numberOfLines={3}>
                Hỏi đáp đa lượt nhớ ngữ cảnh, tự động đính chính lỗi sai lịch sử, khảo bài tự luận trực tiếp trên Chat và đàm đạo cùng 8 danh tướng thời Trần.
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' }}>
                <ListChecks size={24} color="#059669" />
              </View>
              <Chip text="Ma trận Bloom GDPT 2018" bg={c.ngocNhat} fg={c.ngocChu} />
            </View>
            <View style={{ gap: 4 }}>
              <Txt f="bold" size={18} color={c.muc}>Quizzes — Khảo thí Thích ứng</Txt>
              <Txt size={13} color={c.muc2} numberOfLines={3}>
                Sinh đề trắc nghiệm chuẩn hóa các mức độ nhận thức Bloom (Nhận biết, Thông hiểu, Vận dụng) theo 5 nhóm chuyên đề SGK Lịch sử 7.
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={24} color="#EA580C" />
              </View>
              <Chip text={`${masteredIds.size}/${HISTORICAL_FLASHCARDS.length} đã thuộc`} bg={c.dongNhat} fg={c.dongChu} />
            </View>
            <View style={{ gap: 4 }}>
              <Txt f="bold" size={18} color={c.muc}>Flash Cards — Thẻ nhớ Sử liệu</Txt>
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FCE7F3', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={24} color="#DB2777" />
              </View>
              <Chip text="Tóm tắt 3 ý cốt lõi" bg={c.sonNhat} fg={c.sonChu} />
            </View>
            <View style={{ gap: 4 }}>
              <Txt f="bold" size={18} color={c.muc}>Summarizer — Tóm tắt Chuyên đề</Txt>
              <Txt size={13} color={c.muc2} numberOfLines={3}>
                Tóm tắt diễn biến trận đánh, sự kiện và nghệ thuật quân sự thời Trần thành các luận điểm súc tích, dễ thuộc.
              </Txt>
            </View>
          </Pressable>
        </View>

        {/* BẢNG LỘ TRÌNH ÔN TẬP CÁ NHÂN HÓA (BAYESIAN KNOWLEDGE TRACING - BKT) */}
        <Card style={{ padding: 20, gap: 14, borderRadius: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.dongNhat, alignItems: 'center', justifyContent: 'center' }}>
                <Target size={20} color={c.dongChu} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt f="bold" size={16} color={c.muc}>
                  Lộ trình Ôn tập Cá nhân hóa (Bayesian Knowledge Tracing — BKT)
                </Txt>
                <Txt size={12} color={c.muc3}>
                  Mô hình xác suất Bayes tự động phát hiện lỗ hổng kiến thức P(L) &lt; {Math.round(params.mastery_threshold * 100)}% và gợi ý chủ điểm cần củng cố
                </Txt>
              </View>
            </View>
            <Btn icon={RefreshCw} title="Cập nhật BKT" tone="giay" size="sm" loading={bktLoading} onPress={loadBktRecommendations} />
          </View>

          {/* 4 Tham số BKT chuẩn */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip text={`Khởi tạo P(L₀) = ${Math.round(params.p_l0 * 100)}%`} bg={c.giay2} fg={c.muc2} />
            <Chip text={`Tích lũy P(T) = +${Math.round(params.p_t * 100)}%`} bg={c.ngocNhat} fg={c.ngocChu} />
            <Chip text={`Đoán mò P(G) = ${Math.round(params.p_g * 100)}%`} bg={c.thuyNhat} fg={c.thuyChu} />
            <Chip text={`Sơ suất P(S) = ${Math.round(params.p_s * 100)}%`} bg={c.dongNhat} fg={c.dongChu} />
          </View>

          {bktLoading && !recs.length ? (
            <Spinner label="Đang phân tích hồ sơ năng lực BKT của em…" />
          ) : recs.length > 0 ? (
            <View style={{ gap: 10 }}>
              {recs.slice(0, 4).map((rec) => {
                const pct = Math.round((rec.current_p_l ?? 0.3) * 100);
                return (
                  <View
                    key={rec.unit_id}
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: c.vien,
                      backgroundColor: c.giay2,
                      gap: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <Txt f="bold" size={14} color={c.muc} style={{ flexShrink: 1 }}>
                          {rec.topic}
                        </Txt>
                        <Chip text={rec.cognitive_level} bg={c.the} fg={c.muc2} />
                      </View>
                      <Chip
                        text={`Mức nắm vững P(L): ${pct}%`}
                        bg={pct >= 60 ? c.ngocNhat : c.dongNhat}
                        fg={pct >= 60 ? c.ngocChu : c.dongChu}
                      />
                    </View>
                    {/* Thanh tiến trình P(L) */}
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: c.vien, overflow: 'hidden' }}>
                      <View
                        style={{
                          width: `${Math.min(100, Math.max(8, pct))}%`,
                          height: '100%',
                          backgroundColor: pct >= 60 ? c.ngoc : c.dong,
                        }}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <Txt size={12} color={c.muc2} style={{ flex: 1 }}>
                        {rec.recommendation_reason}
                      </Txt>
                      <Btn
                        icon={Sparkles}
                        title="Hỏi Thầy Đông A"
                        tone="thuy"
                        size="sm"
                        onPress={() => handleAskFromBkt(rec)}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Txt size={13} color={c.muc2}>
              🎉 Tuyệt vời! Em đã nắm vững các chủ điểm trọng tâm. Hãy thử sức với chế độ khảo bài tự luận trên AI Tutor nhé!
            </Txt>
          )}
        </Card>

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

        <Txt size={14} color={c.muc2}>Chọn một chuyên đề lịch sử để AI tóm tắt thành các luận điểm cô đọng nhất:</Txt>

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
            <Txt size={14} color={c.muc2}>Trợ lý AI Đông A đang cô đọng sử liệu...</Txt>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Btn icon={ArrowLeft} title="Quay lại AI Hub" tone="giay" size="sm" onPress={() => { setSelectedFigure(null); setActiveView('hub'); loadBktRecommendations(); }} />
          <Txt f="bold" size={18} color={c.muc} style={{ flex: 1 }}>AI Tutor — Trợ lý Sử học Đông A</Txt>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Btn
              title="Hỏi đáp Thầy Đông A"
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Chip text={`Đang đàm đạo cùng: ${selectedFigure.role} ${selectedFigure.name}`} bg={c.sonNhat} fg={c.sonChu} />
                <Btn title="Chọn vị tướng khác" tone="giay" size="sm" onPress={() => setSelectedFigure(null)} />
              </View>
              <ChatPanel
                key={`rp-${selectedFigure.id}`}
                session={session}
                mode="roleplay"
                onScrollToEnd={scrollToBottom}
                onChanged={loadBktRecommendations}
                figure={{ id: selectedFigure.id, name: selectedFigure.name }}
                placeholder={`Em muốn hỏi gì với ${selectedFigure.name}?`}
                samples={[
                  `Ngài nghĩ gì về âm mưu xâm lược của giặc Mông - Nguyên?`,
                  `Kế sách đánh giặc quan trọng nhất của nhà Trần là gì?`,
                  `Ý nghĩa câu nói nổi tiếng của ngài trong lịch sử là gì?`,
                ]}
              />
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <Txt size={14} color={c.muc2}>Chọn một nhân vật lịch sử thời Trần để đối thoại trực tiếp (hóa thân dựa trên chính sử):</Txt>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
          /* Chế độ Hỏi đáp Thầy Đông A chung */
          <ChatPanel
            session={session}
            mode="tutor"
            initialQuestion={pendingTutorQuestion}
            onInitialQuestionConsumed={() => setPendingTutorQuestion(null)}
            onOpen={onOpenSource}
            onChanged={loadBktRecommendations}
            onScrollToEnd={scrollToBottom}
          />
        )}
      </ScrollView>
    );
  }

  return null;
};
