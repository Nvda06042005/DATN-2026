/**
 * AI Hub Dashboard - Trung tâm Điều khiển Trợ lý AI Sử học Đông A (Thiết kế tinh gọn, hiện đại)
 * Kết nối trực tiếp với Hệ thống AI Python của người dùng:
 * 1. AI Tutor: Hỏi đáp đa lượt cùng Thầy Đông A & Nhập vai 8 danh tướng (Model NLP 81 chủ điểm + ĐVSKTT)
 * 2. Quizzes: Số hóa Đề thi từ File Word (.docx), biên tập đề chuẩn 2048.vn & Trộn mã đề 101–104
 * 3. Flash Cards: Bộ thẻ ghi nhớ mốc năm, danh tướng và chiến thuật 2 mặt tương tác
 * 4. Lộ trình BKT Cá nhân hóa (Compact UI): Theo dõi tiến độ nắm vững kiến thức gọn gàng, trực quan
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  Info,
  Layers,
  ListChecks,
  RefreshCw,
  Sparkles,
  Target,
} from 'lucide-react-native';
import * as aiApi from '@/api/aiApi';
import { PersonalizedRoadmapView } from '@/components/ai/PersonalizedRoadmapView';
import type { Session } from '@/components/auth';
import { ChatPanel } from '@/components/portal/TieuTuong';
import { Btn, Card, Chip, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { BktRecommendationItem, BktRecommendationsResponse } from '@/types/ai';

export type AiHubView = 'hub' | 'tutor' | 'roadmap' | 'flashcards';

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
  onStartPractice?: (rec: BktRecommendationItem) => void;
  onGoLearn?: (nodeId?: number) => void;
  onClose?: () => void;
}

export const AiHubDashboard: React.FC<AiHubDashboardProps> = ({ session, onOpenSource, onStartPractice, onGoLearn, onClose }) => {
  const { c } = useTheme();

  const [activeView, setActiveView] = useState<AiHubView>('hub');

  // State cho Flashcards
  const [fcIndex, setFcIndex] = useState<number>(0);
  const [fcFlipped, setFcFlipped] = useState<boolean>(false);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());

  // State cho AI Tutor / Roleplay
  const [tutorTab, setTutorTab] = useState<'chat' | 'roleplay'>('chat');
  const [selectedFigure, setSelectedFigure] = useState<typeof HISTORICAL_FIGURES[0] | null>(null);
  const [pendingTutorQuestion, setPendingTutorQuestion] = useState<string | null>(null);
  const tutorScrollRef = useRef<ScrollViewInstance>(null);

  // State cho Lộ trình BKT Cá nhân hóa
  const [bktData, setBktData] = useState<BktRecommendationsResponse | null>(null);
  const [bktLoading, setBktLoading] = useState<boolean>(false);
  const [bktExplainerOpen, setBktExplainerOpen] = useState<boolean>(false);

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
  // GIAO DIỆN TRANG CHỦ AI HUB (3 THẺ CHÍNH + BANNER WORD + LỘ TRÌNH GỌN NHẸ)
  // ======================================================================
  if (activeView === 'hub') {
    const recs = bktData?.recommendations ?? [];
    const params = bktData?.bkt_parameters ?? { p_l0: 0.3, p_t: 0.15, p_g: 0.25, p_s: 0.1, mastery_threshold: 0.6 };
    const summary = bktData?.profile_summary;

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 60, gap: 22, maxWidth: 960, alignSelf: 'center', width: '100%' }} keyboardShouldPersistTaps="handled">
        {/* Header chào mừng */}
        <View style={{ alignItems: 'center', gap: 8, paddingTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Txt size={22}>👋</Txt>
            <Txt f="displayHeavy" size={24} color={c.muc}>
              Trợ lý AI Sử học Đông A — Hào Khí Đông A
            </Txt>
          </View>
          <Txt f="bold" size={22} center color={c.muc}>
            Hỏi đáp Sử liệu • Lộ trình Cá nhân hóa • Thẻ nhớ Thông minh
          </Txt>
          <Txt size={14} center color={c.muc2} style={{ maxWidth: 680 }}>
            Trợ lý đồng hành học Lịch sử 7: Hỏi đáp đa lượt cùng Thầy Đông A, lập lộ trình ôn tập cá nhân hóa theo ngày và ôn luyện thẻ nhớ sử liệu.
          </Txt>
          {onClose ? (
            <Btn title="Đóng bảng điều khiển" tone="giay" size="sm" onPress={onClose} />
          ) : null}
        </View>

        {/* Lưới 3 thẻ tính năng chính (Đã bỏ chức năng Summarizer theo Note 3) */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
          {/* Card 1: AI Tutor (Hỏi đáp & Nhập vai) */}
          <Pressable
            onPress={() => {
              setTutorTab('chat');
              setActiveView('tutor');
            }}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: 270,
              maxWidth: 310,
              minHeight: 168,
              padding: 20,
              borderRadius: 18,
              backgroundColor: pressed ? c.the2 : c.the,
              borderWidth: 1.5,
              borderColor: c.vien,
              gap: 10,
              justifyContent: 'space-between',
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={22} color="#4F46E5" />
              </View>
              <Chip text="81 Chủ điểm • 8 Danh tướng" bg={c.thuyNhat} fg={c.thuyChu} />
            </View>
            <View style={{ gap: 4 }}>
              <Txt f="bold" size={17} color={c.muc}>AI Tutor — Thầy Đông A</Txt>
              <Txt size={13} color={c.muc2} numberOfLines={3}>
                Hỏi đáp đa lượt nhớ ngữ cảnh, tự động đính chính lỗi sai lịch sử và đàm đạo cùng 8 danh tướng thời Trần.
              </Txt>
            </View>
          </Pressable>

          {/* Card 2: Lộ trình Cá nhân hóa (4 bước) */}
          <Pressable
            onPress={() => setActiveView('roadmap')}
            testID="aihub-roadmap-btn"
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: 270,
              maxWidth: 310,
              minHeight: 168,
              padding: 20,
              borderRadius: 18,
              backgroundColor: pressed ? c.the2 : c.the,
              borderWidth: 1.5,
              borderColor: c.vien,
              gap: 10,
              justifyContent: 'space-between',
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' }}>
                <ListChecks size={22} color="#059669" />
              </View>
              <Chip text="4 bước • Lịch từng ngày" bg={c.ngocNhat} fg={c.ngocChu} />
            </View>
            <View style={{ gap: 4 }}>
              <Txt f="bold" size={17} color={c.muc}>Lộ trình Cá nhân hóa</Txt>
              <Txt size={13} color={c.muc2} numberOfLines={3}>
                Thiết lập mục tiêu, lịch rảnh, tự đánh giá 4 mảng kiến thức để nhận lịch học từng ngày và điều chỉnh tự động bằng AI & BKT.
              </Txt>
            </View>
          </Pressable>

          {/* Card 3: Flash Cards (Thẻ ghi nhớ mốc năm & sự kiện) */}
          <Pressable
            onPress={() => setActiveView('flashcards')}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: 270,
              maxWidth: 310,
              minHeight: 168,
              padding: 20,
              borderRadius: 18,
              backgroundColor: pressed ? c.the2 : c.the,
              borderWidth: 1.5,
              borderColor: c.vien,
              gap: 10,
              justifyContent: 'space-between',
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={22} color="#EA580C" />
              </View>
              <Chip text={`${masteredIds.size}/${HISTORICAL_FLASHCARDS.length} đã thuộc`} bg={c.dongNhat} fg={c.dongChu} />
            </View>
            <View style={{ gap: 4 }}>
              <Txt f="bold" size={17} color={c.muc}>Flash Cards — Thẻ nhớ Sử liệu</Txt>
              <Txt size={13} color={c.muc2} numberOfLines={3}>
                Bộ thẻ ghi nhớ 2 mặt tương tác, ôn luyện nhanh mốc thời gian (1258, 1285, 1288), danh tướng và kế sách.
              </Txt>
            </View>
          </Pressable>
        </View>

        {/* CHẨN ĐOÁN NĂNG LỰC BKT & CHỦ ĐIỂM GỢI Ý */}
        <Card style={{ padding: 18, gap: 14, borderRadius: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.dongNhat, alignItems: 'center', justifyContent: 'center' }}>
                <Target size={19} color={c.dongChu} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Txt f="bold" size={16} color={c.muc}>
                    Chẩn đoán Năng lực BKT & Chủ điểm cần ôn
                  </Txt>
                  {bktData?.profile?.mastery_rank ? (
                    <Chip text={bktData.profile.mastery_rank} bg={c.thuyNhat} fg={c.thuyChu} />
                  ) : null}
                </View>
                <Txt size={12} color={c.muc2}>
                  Đọc trực tiếp từ tiến độ làm bài và gợi ý các chủ điểm lịch sử cần củng cố
                </Txt>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <Btn
                icon={Sparkles}
                title="Mở Lộ trình theo ngày"
                tone="ngoc"
                size="sm"
                onPress={() => setActiveView('roadmap')}
              />
              <Btn
                icon={Info}
                title="Cơ chế BKT"
                tone="giay"
                size="sm"
                onPress={() => setBktExplainerOpen(true)}
              />
              <Btn
                icon={RefreshCw}
                title="Làm mới"
                tone="giay"
                size="sm"
                loading={bktLoading}
                onPress={loadBktRecommendations}
              />
            </View>
          </View>

          {summary ? (
            <View
              style={{
                padding: 10,
                borderRadius: 12,
                backgroundColor: summary.has_activity ? c.giay2 : c.vangNhat,
                borderWidth: 1,
                borderColor: c.vien,
                gap: 6,
              }}
            >
              <Txt size={12} f="semibold" color={c.muc2}>
                {summary.has_activity
                  ? `Hồ sơ AI đang đọc từ tiến độ của em${summary.grade ? ` (Lớp ${summary.grade})` : ''}:`
                  : 'Chưa có lượt làm quiz/bài học — đang hiển thị lộ trình khởi động để AI đo năng lực thật:'}
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {summary.has_activity ? (
                  <>
                    <Chip
                      text={`Chính xác: ${summary.accuracy ?? 0}% (${summary.answered ?? 0} câu)`}
                      bg={c.thuyNhat}
                      fg={c.thuyChu}
                    />
                    <Chip
                      text={`Chuỗi ${summary.streak_current ?? 0} ngày`}
                      bg={c.ngocNhat}
                      fg={c.ngocChu}
                    />
                    {(summary.weak_topics_count ?? 0) > 0 ? (
                      <Chip text={`${summary.weak_topics_count} chủ đề cần ôn`} bg={c.dongNhat} fg={c.dongChu} />
                    ) : null}
                    {(summary.wrong_questions_count ?? 0) > 0 ? (
                      <Chip text={`${summary.wrong_questions_count} câu sai chưa gỡ`} bg={c.sonNhat} fg={c.sonChu} />
                    ) : null}
                  </>
                ) : null}
                {summary.upcoming_assignment ? (
                  <Chip
                    text={`Sắp thi: ${summary.upcoming_assignment.title} (còn ${summary.upcoming_assignment.days_left} ngày)`}
                    bg={c.sonNhat}
                    fg={c.sonChu}
                  />
                ) : null}
                {summary.next_node && onGoLearn ? (
                  <Btn
                    title={`Học tiếp: ${summary.next_node.title}`}
                    tone="giay"
                    size="sm"
                    onPress={() => onGoLearn(summary.next_node?.node_id)}
                  />
                ) : null}
              </View>
            </View>
          ) : null}

          {bktLoading && !recs.length ? (
            <Spinner label="Đang tải lộ trình ôn tập…" />
          ) : recs.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {recs.slice(0, 4).map((rec) => {
                const masteryVal = rec.current_mastery ?? rec.current_p_l ?? 0.3;
                const pct = Math.round(masteryVal * 100);
                const progressFill = pct >= 80 ? c.ngoc : pct >= 60 ? c.thuy : c.dong;
                const canPractice = Boolean(onStartPractice) && (
                  (rec.action_kind === 'practice_topic' && rec.topic_type && rec.topic_id)
                  || rec.action_kind === 'practice_wrong'
                );
                const canJumpLearn = Boolean(onGoLearn) && rec.action_kind === 'journey_node';

                return (
                  <View
                    key={rec.unit_id}
                    style={{
                      width: '48%',
                      flexGrow: 1,
                      minWidth: 280,
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: rec.due_urgent ? c.son : c.vien,
                      backgroundColor: c.the,
                      gap: 8,
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <Txt f="bold" size={14} color={c.muc} style={{ flex: 1 }} numberOfLines={2}>
                        {rec.topic}
                      </Txt>
                      <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                        {rec.due_urgent ? <Chip text="Ưu tiên" bg={c.sonNhat} fg={c.sonChu} /> : null}
                        <Chip
                          text={`${pct}%`}
                          bg={pct >= 60 ? c.thuyNhat : c.dongNhat}
                          fg={pct >= 60 ? c.thuyChu : c.dongChu}
                        />
                      </View>
                    </View>

                    {/* Thanh tiến độ mảnh gọn */}
                    <View style={{ height: 5, borderRadius: 3, backgroundColor: c.vien, overflow: 'hidden' }}>
                      <View
                        style={{
                          width: `${Math.min(100, Math.max(8, pct))}%`,
                          height: '100%',
                          backgroundColor: progressFill,
                        }}
                      />
                    </View>

                    {rec.reason || rec.recommendation_reason ? (
                      <Txt size={11.5} color={c.muc2} numberOfLines={2}>
                        {rec.reason || rec.recommendation_reason}
                      </Txt>
                    ) : null}

                    {/* Dòng dưới gọn gàng: SGK tham chiếu + nút hành động */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 120 }}>
                        <BookOpen size={12} color={c.muc3} />
                        <Txt size={11} color={c.muc3} numberOfLines={1} style={{ flex: 1 }}>
                          {rec.sgk_reference || 'SGK Lịch sử 7 - Bài 15'}
                        </Txt>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        {canPractice ? (
                          <Btn
                            title="Luyện ngay"
                            tone="ngoc"
                            size="sm"
                            onPress={() => onStartPractice?.(rec)}
                          />
                        ) : canJumpLearn ? (
                          <Btn
                            title="Học ngay"
                            tone="ngoc"
                            size="sm"
                            onPress={() => onGoLearn?.(rec.node_id)}
                          />
                        ) : null}
                        <Btn
                          icon={Sparkles}
                          title="Hỏi Thầy"
                          tone="thuy"
                          size="sm"
                          onPress={() => handleAskFromBkt(rec)}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : bktData?.profile_summary?.has_activity ? (
            <Txt size={13} color={c.muc2}>
              🎉 Tuyệt vời! Em đã nắm vững các chủ điểm trọng tâm.
            </Txt>
          ) : (
            <Txt size={13} color={c.muc2}>
              Em chưa có dữ liệu phân tích BKT mới nhất. Hãy bấm thẻ “Lộ trình Cá nhân hóa” ở trên để lập lịch học theo ngày hoặc làm một bài quiz trên Bản đồ Học nhé!
            </Txt>
          )}
        </Card>

        {/* Sheet giải thích thuật toán BKT */}
        {bktExplainerOpen ? (
          <Sheet
            open={bktExplainerOpen}
            onClose={() => setBktExplainerOpen(false)}
            title="Cơ chế AI Theo dõi Năng lực (BKT)"
            subtitle="Mô hình Bayesian Knowledge Tracing 4 tham số"
            footer={
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Btn title="Đã hiểu" tone="thuy" onPress={() => setBktExplainerOpen(false)} />
              </View>
            }
          >
            <View style={{ gap: 12 }}>
              <Txt size={14} color={c.muc} style={{ lineHeight: 21 }}>
                Hệ thống sử dụng mô hình <Txt f="bold" color={c.muc}>Bayesian Knowledge Tracing (BKT)</Txt> để tự động cập nhật xác suất nắm vững kiến thức của học sinh sau mỗi câu hỏi hoặc bài tập:
              </Txt>
              <View style={{ gap: 8 }}>
                <View style={{ padding: 10, borderRadius: 10, backgroundColor: c.the, borderWidth: 1, borderColor: c.vien }}>
                  <Txt f="bold" size={13} color={c.muc}>1. Xác suất ban đầu P(L₀) = {Math.round(params.p_l0 * 100)}%</Txt>
                </View>
                <View style={{ padding: 10, borderRadius: 10, backgroundColor: c.the, borderWidth: 1, borderColor: c.vien }}>
                  <Txt f="bold" size={13} color={c.muc}>2. Tốc độ tiếp thu P(T) = +{Math.round(params.p_t * 100)}%</Txt>
                </View>
                <View style={{ padding: 10, borderRadius: 10, backgroundColor: c.the, borderWidth: 1, borderColor: c.vien }}>
                  <Txt f="bold" size={13} color={c.muc}>3. Hệ số loại trừ đoán mò P(G) = {Math.round(params.p_g * 100)}%</Txt>
                </View>
                <View style={{ padding: 10, borderRadius: 10, backgroundColor: c.the, borderWidth: 1, borderColor: c.vien }}>
                  <Txt f="bold" size={13} color={c.muc}>4. Hệ số bù trừ sơ suất P(S) = {Math.round(params.p_s * 100)}%</Txt>
                </View>
              </View>
            </View>
          </Sheet>
        ) : null}
      </ScrollView>
    );
  }

  // ======================================================================
  // GIAO DIỆN CON 0: LỘ TRÌNH HỌC TẬP CÁ NHÂN HÓA THEO NGÀY (4 BƯỚC)
  // ======================================================================
  if (activeView === 'roadmap') {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16, maxWidth: 1180, alignSelf: 'center', width: '100%' }} keyboardShouldPersistTaps="handled">
        <PersonalizedRoadmapView
          userId={session.user.id}
          bktData={bktData}
          onBackToHub={() => setActiveView('hub')}
          onStartPractice={onStartPractice}
          onOpenFlashcards={() => setActiveView('flashcards')}
          onAskTutor={(q) => {
            setSelectedFigure(null);
            setTutorTab('chat');
            setPendingTutorQuestion(q);
            setActiveView('tutor');
          }}
          onGoLearn={onGoLearn}
        />
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

  // ======================================================================
  // GIAO DIỆN CON 2: AI TUTOR & NHẬP VAI DANH TƯỚNG
  // ======================================================================
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
