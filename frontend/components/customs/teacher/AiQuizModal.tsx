import { useState, useEffect, useMemo } from 'react';
import { 
  AlertCircle, 
  Award, 
  BookOpen, 
  Check, 
  RefreshCw, 
  X, 
  Shield, 
  Swords, 
  Crown, 
  ScrollText, 
  Trash2, 
  Sparkles,
  Layers,
  CheckCircle2
} from 'lucide-react';
import * as quizApi from '@/api/quizApi';
import type { TopicGroupItem } from '@/types/libraryType';
import { KahootShape } from '@/components/customs/KahootShape';
import { Mascot } from '@/components/customs/Mascot';
import { ANSWER_STYLES } from '@/constants/theme';
import { stripOptionPrefix } from '@/utils/format';

interface AiQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveQuestions: (count: number) => void;
}

interface QuestionItem {
  id: string | number;
  q: string;
  options: string[];
  correct: number;
  citation: string;
  cognitiveLevel?: string;
  explanation?: string;
  topicGroupId?: string;
  topicGroupName?: string;
  unitId?: string;
  unitTopic?: string;
}

// Danh mục 5 nhóm chủ đề khảo thí chuẩn SGK Lịch sử 7 mặc định (dự phòng tức thì khi offline)
const DEFAULT_TOPIC_GROUPS: TopicGroupItem[] = [
  {
    id: 'KHANG_CHIEN_1',
    title: 'Kháng chiến chống Mông Cổ lần thứ nhất (1258)',
    short_title: 'Kháng chiến 1 (1258)',
    badge: '1258 - Mông Cổ',
    description: 'Bình Lệ Nguyên, kế sách Vườn không nhà trống tại Thăng Long, Thái sư Trần Thủ Độ và Đại thắng Đông Bộ Đầu.',
    sgk_reference: 'SGK Lịch sử & Địa lí 7 (KNTT) - Bài 15, Mục 1, Trang 66–67',
    question_count_available: 19,
    units: [
      { unit_id: 'KC1_OVERVIEW', topic: 'Toàn cảnh kháng chiến lần 1 (1258)', cognitive_level: 'Nhận biết' },
      { unit_id: 'KC1_WHY_INVADE', topic: 'Âm mưu Mông Cổ xâm lược Đại Việt', cognitive_level: 'Thông hiểu' },
      { unit_id: 'KC1_BINH_LE_NGUYEN', topic: 'Trận Bình Lệ Nguyên & Lê Phụ Trần', cognitive_level: 'Thông hiểu' },
      { unit_id: 'KC1_VUON_KHONG_NHA_TRONG', topic: 'Kế sách Vườn không nhà trống', cognitive_level: 'Vận dụng' },
      { unit_id: 'KC1_TRAN_THU_DO_QUOTE', topic: 'Thái sư Trần Thủ Độ và câu nói bất hủ', cognitive_level: 'Nhận biết' },
      { unit_id: 'KC1_DONG_BO_DAU', topic: 'Đại thắng phản công Đông Bộ Đầu', cognitive_level: 'Nhận biết' }
    ]
  },
  {
    id: 'KHANG_CHIEN_2',
    title: 'Kháng chiến chống quân Nguyên lần thứ hai (1285)',
    short_title: 'Kháng chiến 2 (1285)',
    badge: '1285 - Quân Nguyên',
    description: 'Hội nghị Bình Than, Trần Quốc Toản bóp cam, Hội nghị Diên Hồng (tiếng hô ĐÁNH), Hịch tướng sĩ, Trần Bình Trọng, Hàm Tử - Chương Dương, Thoát Hoan chui ống đồng.',
    sgk_reference: 'SGK Lịch sử & Địa lí 7 (KNTT) - Bài 15, Mục 2, Trang 68–71',
    question_count_available: 35,
    units: [
      { unit_id: 'BINH_THAN_CONFERENCE', topic: 'Hội nghị Bình Than (10/1282)', cognitive_level: 'Nhận biết' },
      { unit_id: 'TQT_WHY_ORANGE', topic: 'Trần Quốc Toản bóp nát quả cam', cognitive_level: 'Thông hiểu' },
      { unit_id: 'TQT_SIX_GOLDEN_WORDS', topic: 'Lá cờ Phá cường địch báo hoàng ân', cognitive_level: 'Nhận biết' },
      { unit_id: 'DIEN_HONG_CONFERENCE', topic: 'Hội nghị Diên Hồng & Tiếng hô ĐÁNH', cognitive_level: 'Thông hiểu' },
      { unit_id: 'HICH_TUONG_SI', topic: 'Hịch tướng sĩ & Chữ Sát Thát', cognitive_level: 'Thông hiểu' },
      { unit_id: 'KC2_TRAN_BINH_TRONG', topic: 'Trần Bình Trọng & Câu nói bất tử', cognitive_level: 'Nhận biết' },
      { unit_id: 'KC2_HAM_TU_CHUONG_DUONG', topic: 'Chiến thắng Hàm Tử - Chương Dương', cognitive_level: 'Thông hiểu' },
      { unit_id: 'KC2_THOAT_HOAN_COPPER_PIPE', topic: 'Thoát Hoan chui ống đồng tháo chạy', cognitive_level: 'Nhận biết' }
    ]
  },
  {
    id: 'KHANG_CHIEN_3',
    title: 'Kháng chiến chống quân Nguyên lần thứ ba (1287 – 1288)',
    short_title: 'Kháng chiến 3 (1287-1288)',
    badge: '1287-1288 - Vân Đồn & Bạch Đằng',
    description: 'Hải chiến Vân Đồn (Trần Khánh Dư đánh chìm 17 vạn thạch lương Trương Văn Hổ), Đại thắng Bạch Đằng 1288 với bãi cọc ngầm lim bắt sống Ô Mã Nhi.',
    sgk_reference: 'SGK Lịch sử & Địa lí 7 (KNTT) - Bài 15, Mục 3, Trang 71–73',
    question_count_available: 12,
    units: [
      { unit_id: 'KC3_OVERVIEW', topic: 'Toàn cảnh kháng chiến lần 3 (1287-1288)', cognitive_level: 'Nhận biết' },
      { unit_id: 'KC3_VAN_DON', topic: 'Hải chiến Vân Đồn - Tiêu diệt thuyền lương', cognitive_level: 'Thông hiểu' },
      { unit_id: 'GAME_TRAN_KHANH_DU', topic: 'Nhân Huệ Vương Trần Khánh Dư', cognitive_level: 'Nhận biết' },
      { unit_id: 'KC3_BACH_DANG_HOW', topic: 'Đại thắng Bạch Đằng & Bãi cọc lim ngầm', cognitive_level: 'Vận dụng' }
    ]
  },
  {
    id: 'NHAN_VAT_QUAN_SU',
    title: 'Nhân vật Lịch sử, Hội nghị & Nghệ thuật Quân sự thời Trần',
    short_title: 'Nhân vật & Quân sự',
    badge: 'Hào khí Đông A',
    description: 'Điện súy Phạm Ngũ Lão, Yết Kiêu - Dã Tượng, Phật Hoàng Trần Nhân Tông, Tù trưởng miền núi, Ngụ binh ư nông, Cấm quân Thánh Dực, Căn cứ Vạn Kiếp - Thiên Trường, Bài học lịch sử.',
    sgk_reference: 'SGK Lịch sử & Địa lí 7 (KNTT) - Bài 14 & Bài 15, Trang 62–75',
    question_count_available: 26,
    units: [
      { unit_id: 'CAUSES_OF_VICTORY', topic: 'Nguyên nhân thắng lợi của 3 lần kháng chiến', cognitive_level: 'Thông hiểu' },
      { unit_id: 'HISTORICAL_SIGNIFICANCE', topic: 'Ý nghĩa lịch sử của 3 lần kháng chiến', cognitive_level: 'Thông hiểu' },
      { unit_id: 'MILITARY_ART_TRAN_DYNASTY', topic: 'Nghệ thuật quân sự lấy yếu thắng mạnh', cognitive_level: 'Vận dụng' },
      { unit_id: 'HISTORICAL_LESSONS_TODAY', topic: 'Bài học Khoan thư sức dân làm kế sâu rễ bền gốc', cognitive_level: 'Vận dụng' },
      { unit_id: 'GAME_NGU_BINH_U_NONG', topic: 'Chính sách ngụ binh ư nông', cognitive_level: 'Thông hiểu' },
      { unit_id: 'GAME_QUAN_THANH_DUC_SAT_THAT', topic: 'Cấm quân Thánh Dực & Tinh binh Sát Thát', cognitive_level: 'Nhận biết' },
      { unit_id: 'YET_KIEU_DA_TUONG', topic: 'Yết Kiêu và Dã Tượng - Hai gia tướng trung kiên', cognitive_level: 'Nhận biết' },
      { unit_id: 'PHAM_NGU_LAO', topic: 'Phạm Ngũ Lão và hào khí Đông A', cognitive_level: 'Nhận biết' }
    ]
  },
  {
    id: 'TONG_HOP_TOAN_KHOA',
    title: 'Tổng hợp Toàn khóa 3 lần Kháng chiến (1258 - 1288)',
    short_title: 'Đề Tổng hợp 3 lần',
    badge: 'Ma trận Bloom GDPT 2018',
    description: 'Đề khảo thí tích hợp toàn diện bao quát 3 cuộc kháng chiến chống Mông - Nguyên, phân bổ chuẩn ma trận nhận thức GDPT 2018.',
    sgk_reference: 'Toàn bộ Chương trình Lịch sử 7 - Chủ đề Ba lần kháng chiến chống Mông - Nguyên',
    question_count_available: 92,
    units: []
  }
];

export const AiQuizModal = ({
  isOpen,
  onClose,
  onSaveQuestions,
}: AiQuizModalProps) => {
  const [topicGroups, setTopicGroups] = useState<TopicGroupItem[]>(DEFAULT_TOPIC_GROUPS);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('KHANG_CHIEN_2');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [customKeyword, setCustomKeyword] = useState<string>('');
  const [count, setCount] = useState<number>(4);
  const [cognitiveLevel, setCognitiveLevel] = useState<string>('Phân bổ ma trận');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Khởi tạo bộ câu hỏi mẫu mặc định chất lượng cao
  const [generatedQuestions, setGeneratedQuestions] = useState<QuestionItem[]>([
    {
      id: 'init-1',
      q: 'Tại Hội nghị Diên Hồng (đầu 1285), khi Thượng hoàng hỏi "Nên đánh hay nên hòa?", các bô lão đã đồng thanh hô vang điều gì?',
      options: [
        'A. Hòa!',
        'B. ĐÁNH!',
        'C. Rút lui về Vạn Kiếp!',
        'D. Cầu viện phương Bắc!'
      ],
      correct: 1,
      cognitiveLevel: 'Thông hiểu',
      citation: 'SGK Lịch sử 7 (KNTT), tr. 69',
      explanation: 'Hội nghị Diên Hồng triệu tập các bô lão đại diện cho toàn dân. Tiếng hô ĐÁNH đồng thanh thể hiện khối đại đoàn kết toàn dân tộc triều Trần.',
      topicGroupId: 'KHANG_CHIEN_2',
      topicGroupName: 'Kháng chiến chống quân Nguyên lần 2 (1285)',
      unitId: 'DIEN_HONG_CONFERENCE',
      unitTopic: 'Hội nghị Diên Hồng'
    },
    {
      id: 'init-2',
      q: 'Hành động bóp nát quả cam vua ban của Hoài Văn hầu Trần Quốc Toản tại bến Bình Than thể hiện điều gì?',
      options: [
        'A. Nỗi giận dữ vì quả cam bị hỏng',
        'B. Uất ức vì chưa đủ tuổi dự bàn việc quân, nung nấu ý chí giết giặc cứu nước',
        'C. Muốn thách đấu với các tướng già',
        'D. Không đồng ý với kế sách rút lui'
      ],
      correct: 1,
      cognitiveLevel: 'Thông hiểu',
      citation: 'Đại Việt Sử Ký Toàn Thư (tr. 560)',
      explanation: 'Trần Quốc Toản vì chưa đủ tuổi dự hội nghị Bình Than nên vừa hờn vừa tủi, vô tình bóp nát quả cam, rồi về chiêu mộ gia nô thêu cờ 6 chữ vàng.',
      topicGroupId: 'KHANG_CHIEN_2',
      topicGroupName: 'Kháng chiến chống quân Nguyên lần 2 (1285)',
      unitId: 'TQT_WHY_ORANGE',
      unitTopic: 'Trần Quốc Toản bóp cam'
    },
    {
      id: 'init-3',
      q: 'Tướng giặc Thoát Hoan đã phải dùng mưu kế nhục nhã nào để thoát thân khi bị truy kích ráo riết vào tháng 6/1285?',
      options: [
        'A. Cải trang làm thường dân lội bộ qua sông',
        'B. Chui vào ống đồng bắt quân lính khiêng tháo chạy về phương Bắc',
        'C. Đổi áo bào cho phó tướng để đánh lừa',
        'D. Đầu hàng xin tha mạng'
      ],
      correct: 1,
      cognitiveLevel: 'Nhận biết',
      citation: 'SGK Lịch sử 7 (KNTT), tr. 71',
      explanation: 'Thoát Hoan sợ trúng tên tẩm thuốc độc của quân ta, phải chui vào ống đồng cho quân khiêng chạy thoát thân về nước.',
      topicGroupId: 'KHANG_CHIEN_2',
      topicGroupName: 'Kháng chiến chống quân Nguyên lần 2 (1285)',
      unitId: 'KC2_THOAT_HOAN_COPPER_PIPE',
      unitTopic: 'Thoát Hoan chui ống đồng'
    },
    {
      id: 'init-4',
      q: 'Câu nói bất hủ của Trần Bình Trọng khi bị giặc dụ dỗ phong vương là gì?',
      options: [
        'A. Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo',
        'B. Ta thà làm ma nước Nam, chứ không thèm làm vương đất Bắc',
        'C. Khoan thư sức dân để làm kế sâu rễ bền gốc',
        'D. Nếu bệ hạ muốn hàng, xin hãy chém đầu thần trước'
      ],
      correct: 1,
      cognitiveLevel: 'Vận dụng',
      citation: 'Đại Việt Sử Ký Toàn Thư (tr. 564)',
      explanation: 'Bảo Nghĩa Vương Trần Bình Trọng hiên ngang khẳng khái thà chết vinh quang chứ không chịu cúi đầu làm tay sai ngoại bang.',
      topicGroupId: 'KHANG_CHIEN_2',
      topicGroupName: 'Kháng chiến chống quân Nguyên lần 2 (1285)',
      unitId: 'KC2_TRAN_BINH_TRONG',
      unitTopic: 'Trần Bình Trọng'
    }
  ]);

  // Load danh mục nhóm chủ đề từ backend API khi modal mở
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    quizApi.getTopicGroups()
      .then(res => {
        if (isMounted && res.groups && Array.isArray(res.groups) && res.groups.length > 0) {
          setTopicGroups(res.groups);
        }
      })
      .catch(err => {
        console.warn('Sử dụng danh mục nhóm chủ đề dự phòng cục bộ:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const currentGroup = useMemo(() => {
    return topicGroups.find(g => g.id === selectedGroupId) || topicGroups[0];
  }, [topicGroups, selectedGroupId]);

  if (!isOpen) return null;

  // Xử lý chuyển tab nhóm chủ đề
  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    setSelectedUnitIds([]); // Reset các sub-unit khi đổi nhóm chủ đề lớn
    setErrorMessage(null);
  };

  // Xử lý toggle chọn cụm tri thức con
  const handleToggleUnit = (unitId: string) => {
    setSelectedUnitIds(prev => {
      if (prev.includes(unitId)) {
        return prev.filter(id => id !== unitId);
      } else {
        return [...prev, unitId];
      }
    });
  };

  // Xóa một câu hỏi cụ thể trong danh sách xem trước
  const handleDeleteQuestion = (id: string | number) => {
    setGeneratedQuestions(prev => prev.filter(q => q.id !== id));
  };

  // Gọi API sinh câu hỏi theo Nhóm chủ đề
  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const data = await quizApi.generateQuiz({
        topicGroupId: selectedGroupId,
        unitIds: selectedUnitIds.length > 0 ? selectedUnitIds : undefined,
        topic: customKeyword.trim() || undefined,
        numQuestions: count,
        cognitiveLevel: cognitiveLevel
      });

      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        const mapped: QuestionItem[] = data.questions.map((q: any, idx: number) => ({
          id: q.id || `gen-${idx + 1}`,
          q: q.question,
          options: q.options,
          correct: q.correct_index,
          cognitiveLevel: q.cognitive_level || 'Thông hiểu',
          citation: q.curriculum_reference || currentGroup.sgk_reference,
          explanation: q.explanation || `Căn cứ theo tư liệu chuẩn SGK Lịch sử 7 - ${currentGroup.title}.`,
          topicGroupId: q.topic_group_id || selectedGroupId,
          topicGroupName: q.topic_group_name || currentGroup.title,
          unitId: q.unit_id,
          unitTopic: q.topic
        }));
        setGeneratedQuestions(mapped);
      } else {
        throw new Error('Dữ liệu câu hỏi trả về rỗng');
      }
    } catch (err: any) {
      console.warn('Lỗi gọi API AI Quiz:', err);
      setErrorMessage('Không thể kết nối Backend AI, đang hiển thị câu hỏi mẫu từ Kho sử liệu vàng.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getGroupIcon = (id: string) => {
    switch (id) {
      case 'KHANG_CHIEN_1':
        return <Shield className="w-4 h-4 shrink-0" />;
      case 'KHANG_CHIEN_2':
        return <Swords className="w-4 h-4 shrink-0" />;
      case 'KHANG_CHIEN_3':
        return <Sparkles className="w-4 h-4 shrink-0" />;
      case 'NHAN_VAT_QUAN_SU':
        return <Crown className="w-4 h-4 shrink-0" />;
      case 'TONG_HOP_TOAN_KHOA':
      default:
        return <ScrollText className="w-4 h-4 shrink-0" />;
    }
  };

  const getCognitiveBadgeColor = (level?: string) => {
    switch (level) {
      case 'Nhận biết':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Thông hiểu':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Vận dụng':
      case 'Vận dụng cao':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-purple-100 text-purple-800 border-purple-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94vh] zoom-in-95 border-2 border-duo-swan"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-duo-purple via-duo-purple to-indigo-700 text-white px-6 py-4 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-white/20 p-1 flex items-center justify-center shrink-0 shadow-inner">
              <Mascot size={48} accessory="scholar" mood="excited" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg sm:text-xl tracking-tight">Trợ lý AI Soạn Đề Theo Nhóm Chủ Đề</h3>
                <span className="chip bg-white/20 text-white text-[11px] font-black border border-white/30 backdrop-blur-sm">
                  RAG Grounded SGK 7
                </span>
              </div>
              <p className="text-xs font-semibold text-white/90 mt-0.5">
                Định vị chuẩn 42 cụm tri thức & 92 đề thi khảo thí SGK Lịch sử 7 (KNTT) & Đại Việt Sử Ký Toàn Thư
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl hover:bg-white/20 text-white/80 hover:text-white transition"
            title="Đóng modal"
          >
            <X className="w-5 h-5 stroke-[3]" />
          </button>
        </div>

        {/* TOPIC GROUPS TAB NAVIGATION */}
        <div className="bg-duo-polar px-4 sm:px-6 pt-3 pb-2 border-b-2 border-duo-swan shrink-0">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-duo-wolf flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-duo-purple" />
              Chọn Nhóm Chủ Đề Khảo Thí Lịch Sử Thời Trần:
            </label>
            <span className="text-[11px] font-bold text-duo-hare">
              Sẵn sàng: <strong className="text-duo-ink">{currentGroup.question_count_available} câu hỏi chuẩn</strong>
            </span>
          </div>

          {/* Segmented Group Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
            {topicGroups.map(group => {
              const isActive = group.id === selectedGroupId;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleSelectGroup(group.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl font-black text-xs transition shrink-0 border-2 ${
                    isActive
                      ? 'bg-duo-purple text-white border-duo-purple shadow-sm ring-2 ring-duo-purple/20'
                      : 'bg-white text-duo-wolf border-duo-swan hover:border-duo-purple-light hover:bg-white'
                  }`}
                >
                  {getGroupIcon(group.id)}
                  <span>{group.short_title || group.title}</span>
                  {group.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-lg font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-duo-swan text-duo-hare'
                    }`}>
                      {group.badge.split(' - ')[0]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* CAMPAIGN METADATA & CONTROLS */}
        <div className="p-4 sm:p-5 border-b-2 border-duo-swan space-y-3 shrink-0 bg-white">
          {/* Group details banner */}
          <div className="bg-duo-polar border-2 border-duo-swan/80 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-xs text-duo-ink">{currentGroup.title}</span>
                <span className="text-[11px] font-bold text-duo-purple bg-duo-purple-light px-2 py-0.5 rounded-lg">
                  {currentGroup.sgk_reference}
                </span>
              </div>
              <p className="text-xs text-duo-wolf leading-relaxed font-medium line-clamp-2">
                {currentGroup.description}
              </p>
            </div>
          </div>

          {/* Sub-unit / Specific Knowledge Pillars */}
          {currentGroup.units && currentGroup.units.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-duo-wolf">
                <span>Cụm sự kiện / Bài học trong nhóm:</span>
                {selectedUnitIds.length > 0 ? (
                  <button 
                    onClick={() => setSelectedUnitIds([])}
                    className="text-duo-purple hover:underline text-[10px] font-black"
                  >
                    (Đang chọn {selectedUnitIds.length} bài • Nhấn để chọn tất cả)
                  </button>
                ) : (
                  <span className="text-emerald-700 font-black text-[10px]">
                    ✓ Đang lấy toàn bộ nhóm chủ đề
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto pr-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedUnitIds([])}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition border ${
                    selectedUnitIds.length === 0
                      ? 'bg-duo-purple text-white border-duo-purple font-black shadow-xs'
                      : 'bg-white text-duo-wolf border-duo-swan hover:border-duo-purple'
                  }`}
                >
                  Tất cả bài học trong nhóm ({currentGroup.units.length})
                </button>
                {currentGroup.units.map(unit => {
                  const isChecked = selectedUnitIds.includes(unit.unit_id);
                  return (
                    <button
                      key={unit.unit_id}
                      type="button"
                      onClick={() => handleToggleUnit(unit.unit_id)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 border ${
                        isChecked
                          ? 'bg-duo-purple-light text-duo-purple-dark border-duo-purple font-black'
                          : 'bg-white text-duo-wolf border-duo-swan hover:border-duo-purple/60'
                      }`}
                    >
                      {isChecked && <CheckCircle2 className="w-3 h-3 text-duo-purple stroke-[3]" />}
                      <span>{unit.topic}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form Settings Row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1 items-end">
            <div className="sm:col-span-5">
              <label className="text-xs font-black text-duo-wolf block mb-1">
                Từ khóa nhấn mạnh (tùy chọn):
              </label>
              <input
                type="text"
                value={customKeyword}
                onChange={(e) => setCustomKeyword(e.target.value)}
                placeholder="VD: Bãi cọc ngầm, Hào khí Đông A, Trận Hàm Tử..."
                className="input-duo !py-2 !text-xs"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="text-xs font-black text-duo-wolf block mb-1">
                Mức độ nhận thức (Bloom):
              </label>
              <select
                value={cognitiveLevel}
                onChange={(e) => setCognitiveLevel(e.target.value)}
                className="input-duo !py-2 !text-xs"
              >
                <option value="Phân bổ ma trận">Phân bổ ma trận Bloom (Tất cả mức độ)</option>
                <option value="Nhận biết">Nhận biết (Mốc thời gian, nhân vật, sự kiện)</option>
                <option value="Thông hiểu">Thông hiểu (Nguyên nhân, diễn biến, ý nghĩa)</option>
                <option value="Vận dụng">Vận dụng (Nghệ thuật quân sự, so sánh, bài học)</option>
              </select>
            </div>

            <div className="sm:col-span-1.5">
              <label className="text-xs font-black text-duo-wolf block mb-1">
                Số câu:
              </label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="input-duo !py-2 !text-xs !w-full"
              >
                <option value={3}>3 câu</option>
                <option value={4}>4 câu</option>
                <option value={5}>5 câu</option>
                <option value={8}>8 câu</option>
                <option value={10}>10 câu</option>
              </select>
            </div>

            <div className="sm:col-span-1.5">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="btn-3d btn-purple w-full !py-2 !text-xs flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>{isGenerating ? 'Đang tạo...' : 'Tạo AI'}</span>
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* QUESTIONS PREVIEW LIST */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 text-xs bg-slate-50/50">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <p className="font-black text-duo-ink uppercase tracking-wider text-[11px]">
                Danh sách {generatedQuestions.length} câu hỏi AI tạo lập theo nhóm:
              </p>
              <span className="chip bg-duo-purple-light text-duo-purple-dark text-[11px] font-black">
                {currentGroup.short_title || currentGroup.title}
              </span>
            </div>
            {isGenerating && (
              <span className="text-duo-purple-dark font-black text-xs flex items-center gap-1.5 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Đang đối chiếu sử liệu SGK 7...
              </span>
            )}
          </div>

          {generatedQuestions.length === 0 ? (
            <div className="text-center py-12 text-duo-hare space-y-2">
              <p className="font-bold text-sm">Chưa có câu hỏi nào trong danh sách xem trước.</p>
              <p className="text-xs">Nhấn nút <strong>"Tạo AI"</strong> ở trên để sinh đề theo nhóm chủ đề đang chọn!</p>
            </div>
          ) : (
            generatedQuestions.map((item, idx) => (
              <div key={item.id} className="card-duo p-4 space-y-3 bg-white transition hover:border-duo-purple shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="font-black text-duo-purple">
                        Câu {idx + 1}
                      </span>
                      {item.cognitiveLevel && (
                        <span className={`chip border text-[10px] font-black ${getCognitiveBadgeColor(item.cognitiveLevel)}`}>
                          <Award className="w-3 h-3" />
                          {item.cognitiveLevel}
                        </span>
                      )}
                      {item.unitTopic && (
                        <span className="chip bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                          📌 {item.unitTopic}
                        </span>
                      )}
                    </div>
                    <h4 className="font-black text-sm text-duo-ink leading-snug pt-0.5">
                      {item.q}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleDeleteQuestion(item.id)}
                      className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                      title="Xóa câu hỏi này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 4 Answers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {item.options.map((opt, oIdx) => {
                    const isCorrect = oIdx === item.correct;
                    return (
                      <div
                        key={oIdx}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition ${
                          isCorrect
                            ? 'ring-2 ring-emerald-500 bg-emerald-50 text-emerald-950 font-black border-2 border-emerald-500'
                            : 'bg-slate-50 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <div 
                          className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 text-white font-black text-[10px]"
                          style={{ background: ANSWER_STYLES[oIdx % 4].bg }}
                        >
                          <KahootShape shape={ANSWER_STYLES[oIdx % 4].shape} size={11} color="#FFFFFF" />
                        </div>
                        <span className="flex-1">{stripOptionPrefix(opt)}</span>
                        {isCorrect && (
                          <span className="chip bg-emerald-600 text-white text-[10px] font-black shrink-0 px-1.5 py-0.5">
                            <Check className="w-3 h-3 stroke-[3]" />
                            Đúng
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Citation & Pedagogical Explanation */}
                <div className="pt-1 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-duo-hare text-[11px] font-bold">
                    <BookOpen className="w-3.5 h-3.5 text-duo-purple" />
                    <span>Căn cứ: <strong className="text-duo-ink">{item.citation}</strong></span>
                  </div>
                  {item.explanation && (
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 text-amber-950 leading-relaxed text-[11px]">
                      <strong className="text-amber-900 font-black">💡 Giải thích sư phạm:</strong> {item.explanation}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="px-6 py-4 bg-white border-t-2 border-duo-swan flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-duo-wolf font-bold flex items-center gap-2">
            <span>Đã chọn: <strong className="text-duo-ink text-sm">{generatedQuestions.length} câu</strong></span>
            <span className="hidden sm:inline text-duo-hare">• Chuẩn kiến thức kỹ năng GDPT 2018</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="btn-3d btn-ghost !py-2.5 !px-4 text-xs"
            >
              Hủy bỏ
            </button>
            <button
              onClick={() => onSaveQuestions(generatedQuestions.length)}
              disabled={generatedQuestions.length === 0}
              className="btn-3d btn-green !py-2.5 !px-5 text-xs font-black flex items-center gap-2 disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Áp dụng {generatedQuestions.length} câu vào bộ đề</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
