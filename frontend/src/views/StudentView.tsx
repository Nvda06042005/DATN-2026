import React, { useState, useRef, useEffect } from 'react';
import {
  LearnMapIcon,
  QuestChestIcon,
  ShopStoreIcon,
  ProfileDashedIcon,
} from '../components/GameIcons';
import {
  Trophy,
  MessageSquare,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Lock,
  Swords,
  ChevronRight,
  Send,
  Heart,
  Flame,
  Gem,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { StudentQuizModal } from '../components/StudentQuizModal';
import { QuestsModal } from '../components/QuestsModal';
import { ShopModal } from '../components/ShopModal';
import { ProfileModal } from '../components/ProfileModal';
import { QuestWorldMapView } from './QuestWorldMapView';
import {
  CircularCarousel,
  SpotlightCard,
  TiltedCard,
  ShinyText,
  MagneticButton,
  DONG_A_CAROUSEL_ITEMS,
} from '../components/reactbits';
import { API_BASE_URL } from '../config/api';

interface StudentViewProps {
  onShowToast: (msg: string) => void;
}

interface RecommendationItem {
  unit_id: string;
  topic: string;
  category: string;
  current_mastery: number;
  difficulty: number;
  cognitive_level: string;
  reason: string;
}

const renderInlineMarkdown = (line: string): React.ReactNode[] => {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-extrabold text-slate-950">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

const renderFormattedAiText = (rawText: string): React.ReactNode => {
  const lines = rawText.split('\n');
  return (
    <div className="space-y-2.5">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return null;

        // Bullet points (*, -, •)
        const bulletMatch = line.match(/^([*\-•])\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div
              key={idx}
              className="flex items-start gap-3 pl-1 py-1.5 px-3 rounded-xl bg-slate-50/90 border border-slate-200/60"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
              <div className="text-[13px] leading-relaxed text-slate-700 flex-1">
                {renderInlineMarkdown(bulletMatch[2])}
              </div>
            </div>
          );
        }

        // Numbered lists (1., 2., 3.)
        const numMatch = line.match(/^(\d+)[.)]\s+(.*)$/);
        if (numMatch) {
          return (
            <div
              key={idx}
              className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/90 border border-slate-200/60"
            >
              <span className="w-5 h-5 rounded-lg bg-slate-900 text-amber-300 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                {numMatch[1]}
              </span>
              <div className="text-[13px] leading-relaxed text-slate-700 flex-1">
                {renderInlineMarkdown(numMatch[2])}
              </div>
            </div>
          );
        }

        // Standard paragraph
        return (
          <p key={idx} className="text-[13.5px] leading-relaxed text-slate-700">
            {renderInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
};

export const StudentView: React.FC<StudentViewProps> = ({ onShowToast }) => {
  const [activeTab, setActiveTab] = useState<
    'learn' | 'quests' | 'bkt_path' | 'shop' | 'profile' | 'leaderboard' | 'ai_chat'
  >('learn');
  const [show3DCarousel, setShow3DCarousel] = useState(true);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [isQuestsModalOpen, setIsQuestsModalOpen] = useState(false);
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Student Game Stats
  const [studentPoints, setStudentPoints] = useState(1450);
  const [studentStreak] = useState(6);
  const [studentHearts] = useState(5);

  // Dynamic Session ID for multi-turn context management
  const [sessionId, setSessionId] = useState<string>('student_session_long');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // BKT Recommendations state
  const [bktRecommendations, setBktRecommendations] = useState<RecommendationItem[]>([]);
  const [isBktLoading, setIsBktLoading] = useState(false);

  const fetchBKTRecommendations = async () => {
    setIsBktLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/quiz/recommendations/student_nguyen_van_long?top_k=5`
      );
      if (response.ok) {
        const data = await response.json();
        setBktRecommendations(data.recommendations || []);
      }
    } catch (err) {
      console.warn('Lỗi tải gợi ý BKT:', err);
    } finally {
      setIsBktLoading(false);
    }
  };

  useEffect(() => {
    fetchBKTRecommendations();
  }, []);

  // AI Chat state for Student
  const [chatInput, setChatInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    Array<{
      sender: 'ai' | 'user';
      text: string;
      characterName?: string;
      citation?: string;
    }>
  >([
    {
      sender: 'ai',
      text: 'Chào em Nguyễn Văn Long! Thầy là Trợ lý AI Sử học Đông A. Em có thắc mắc gì về 3 lần kháng chiến chống quân Mông - Nguyên (1258 - 1288) theo SGK Lịch sử 7 không?',
      characterName: 'Trợ lý AI Sử học Đông A',
      citation: 'SGK Lịch sử 7 KNTT & Đại Việt Sử Ký Toàn Thư',
    },
  ]);

  useEffect(() => {
    if (activeTab === 'ai_chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isAiLoading, activeTab]);

  const navItems = [
    {
      id: 'learn',
      label: 'BÀI HỌC 3D',
      icon: LearnMapIcon,
      badge: '3D Mới',
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'bkt_path',
      label: 'LỘ TRÌNH BKT',
      icon: Sparkles,
      badge: 'Cá nhân hóa',
      badgeColor: 'bg-indigo-100 text-indigo-700',
    },
    {
      id: 'quests',
      label: 'NHIỆM VỤ',
      icon: QuestChestIcon,
      badge: '3',
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'shop',
      label: 'CỬA HÀNG',
      icon: ShopStoreIcon,
    },
    {
      id: 'profile',
      label: 'HỒ SƠ',
      icon: ProfileDashedIcon,
    },
    {
      id: 'leaderboard',
      label: 'BẢNG XẾP HẠNG',
      icon: Trophy,
    },
    {
      id: 'ai_chat',
      label: 'HỎI ĐÁP AI',
      icon: MessageSquare,
      badge: 'AI RAG',
      badgeColor: 'bg-purple-100 text-purple-700',
    },
  ];

  const sendQueryToAi = async (queryText: string) => {
    const userText = queryText.trim();
    if (!userText || isAiLoading) return;
    setChatMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');
    setIsAiLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/dong-a`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userText,
          character_id: sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Máy chủ AI phản hồi mã lỗi: ${response.status}`);
      }

      const data = await response.json();
      const primarySource =
        data.grounding_sources && data.grounding_sources.length > 0
          ? data.grounding_sources[0].curriculum_match
          : undefined;

      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: data.answer,
          characterName: data.character_name || 'Trợ lý AI Sử học Đông A',
          citation: primarySource,
        },
      ]);
    } catch (err) {
      console.warn('Lỗi gọi API chat Đông A, chuyển sang phản hồi dự phòng:', err);
      const lowerQ = userText.toLowerCase().trim();
      let aiResponse = '';
      let citation: string | undefined = undefined;

      if (lowerQ.includes('cam') || lowerQ.includes('toản')) {
        aiResponse =
          'Thầy biết rất rõ về Hoài Văn hầu Trần Quốc Toản! Tại hội nghị Bình Than (1282), vì tuổi còn nhỏ nên Quốc Toản không được dự bàn việc quân. Vừa căm thù giặc vừa hờn tủi, chàng đã vô tình bóp nát quả cam vua ban, sau đó về chiêu mộ hơn 1.000 gia nô thêu cờ 6 chữ vàng "Phá cường địch, báo hoàng ân" lập nhiều chiến công hiển hách!';
        citation = 'SGK Lịch sử 7 (KNTT) - Bài 13, Mục 2b, Tr. 68';
      } else if (
        lowerQ.includes('diên hồng') ||
        lowerQ.includes('đánh') ||
        lowerQ.includes('bô lão')
      ) {
        aiResponse =
          'Hội nghị Diên Hồng tổ chức đầu năm 1285 tại Thăng Long. Thượng hoàng Trần Thánh Tông hỏi các bô lão: "Nên đánh hay nên hòa?", muôn người đồng thanh hô vang: "ĐÁNH!", thể hiện khối đại đoàn kết toàn dân tộc.';
        citation = 'SGK Lịch sử 7 (KNTT) - Bài 13, Mục 2b, Tr. 69';
      } else if (
        lowerQ.includes('bạch đằng') ||
        lowerQ.includes('cọc') ||
        lowerQ.includes('1288')
      ) {
        aiResponse =
          'Trận Bạch Đằng (tháng 4/1288) là đỉnh cao nghệ thuật quân sự: Trần Hưng Đạo cho cắm bãi cọc gỗ lim ngầm, lợi dụng quy luật triều dâng rút để nhử địch vào bẫy, tiêu diệt toàn bộ thủy quân của Ô Mã Nhi và Phàn Tiếp!';
        citation = 'SGK Lịch sử 7 (KNTT) - Bài 13, Mục 2c, Tr. 73';
      } else if (
        lowerQ.includes('vườn không') ||
        lowerQ.includes('1258') ||
        lowerQ.includes('đông bộ đầu')
      ) {
        aiResponse =
          'Kế sách "Vườn không nhà trống" được thực hiện triệt để năm 1258: triệt thoái kinh thành Thăng Long khiến kỵ binh Mông Cổ không có lương ăn, rơi vào cảnh đói kiệt và suy sụp sĩ khí, tạo thời cơ để quân Trần phản công tại Đông Bộ Đầu.';
        citation = 'SGK Lịch sử 7 (KNTT) - Bài 13, Mục 2a, Tr. 65 - 66';
      } else {
        aiResponse = `⚠️ Rất tiếc, thầy không tìm thấy dữ liệu lịch sử phù hợp với câu hỏi "${userText}" trong kho bài học 'Ba lần kháng chiến chống quân Mông - Nguyên (1258 - 1288)'.\n\n👉 Em hãy thử hỏi về: Trần Quốc Toản, Trần Hưng Đạo, Hội nghị Diên Hồng, kế sách Vườn không nhà trống hoặc Trận Bạch Đằng nhé!`;
      }

      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: aiResponse,
          characterName: 'Trợ lý AI Sử học Đông A',
          citation,
        },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSendMessage = () => {
    sendQueryToAi(chatInput);
  };

  const handleResetChatSession = () => {
    const newId = `student_session_${Date.now()}`;
    setSessionId(newId);
    setChatMessages([
      {
        sender: 'ai',
        text: 'Đã làm mới phiên trò chuyện! Em muốn tìm hiểu về trận đánh hay nhân vật lịch sử nào trong 3 lần kháng chiến chống quân Mông - Nguyên (1258 - 1288)?',
        characterName: 'Trợ lý AI Sử học Đông A',
        citation: 'SGK Lịch sử 7 KNTT & Đại Việt Sử Ký Toàn Thư',
      },
    ]);
    onShowToast('🔄 Đã làm mới ngữ cảnh hội thoại AI!');
  };

  const handleQuizComplete = (score: number) => {
    setStudentPoints((prev) => prev + score * 60);
    onShowToast(
      `🎉 Tuyệt vời! Em đã đạt ${score}/3 câu đúng và nhận thêm +${score * 60} điểm!`
    );
  };

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden font-sans text-slate-800 bg-[#f6f7fb] awwwards-dot-grid">
      {/* 1. Student Sidebar */}
      <aside className="w-64 bg-white/95 backdrop-blur-xl border-r border-slate-200/80 flex flex-col justify-between shrink-0 h-full shadow-xs">
        <div>
          {/* Brand Header */}
          <div className="p-4 border-b border-slate-100 flex items-center gap-2.5">
            <div className="flex items-center gap-1 bg-gradient-to-br from-emerald-600 to-teal-700 text-white px-2.5 py-1.5 rounded-xl font-black text-sm shadow-md shadow-emerald-900/15">
              <span>Đông A</span>
              <span className="bg-amber-400 text-slate-950 text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase">
                EDU
              </span>
            </div>
            <div>
              <span className="text-xs font-extrabold text-slate-900 block">Lịch sử 7</span>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-md">
                Interactive Hub
              </span>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="p-2.5 space-y-1.5 mt-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as typeof activeTab);
                    if (item.id === 'quests') setIsQuestsModalOpen(true);
                    if (item.id === 'shop') setIsShopModalOpen(true);
                    if (item.id === 'profile') setIsProfileModalOpen(true);
                  }}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 group relative ${
                    isActive
                      ? 'border-2 border-sky-400 bg-sky-50/90 text-sky-700 shadow-xs'
                      : 'border-2 border-transparent text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <div className="w-6 h-6 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                  </div>

                  <div className="flex-1 flex items-center justify-between text-left">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold tracking-normal ${
                          item.badgeColor || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Student Mini Card at Bottom */}
        <div className="p-3 border-t border-slate-100">
          <TiltedCard
            maxTilt={6}
            onClick={() => setIsProfileModalOpen(true)}
            className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50/70 border border-emerald-200/80 rounded-2xl cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <img
                src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=100&q=80"
                alt="Nguyễn Văn Long"
                className="w-10 h-10 rounded-xl object-cover border-2 border-emerald-500 shadow-xs"
              />
              <div className="leading-tight">
                <span className="font-extrabold text-xs text-slate-900 block truncate">
                  Nguyễn Văn Long
                </span>
                <span className="text-[10px] text-emerald-800 font-bold block">
                  Lớp 7A1 • Hạng 1 tuần
                </span>
              </div>
            </div>
          </TiltedCard>
        </div>
      </aside>

      {/* 2. Main Student Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
        {/* Student Top Stats Header */}
        <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200/80 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                Bài 13: Ba lần kháng chiến chống Mông - Nguyên
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                Lớp 7A1
              </span>
            </div>
          </div>

          {/* Game Status Counters (Hearts, Streak, Gems) */}
          <div className="flex items-center gap-3">
            {activeTab === 'learn' && (
              <button
                type="button"
                onClick={() => setShow3DCarousel((v) => !v)}
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs border transition ${
                  show3DCarousel
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-amber-600" />
                <span>{show3DCarousel ? 'Ẩn Sa bàn 3D' : 'Hiện Sa bàn 3D'}</span>
              </button>
            )}

            {/* Streak */}
            <div
              className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl font-black text-xs text-orange-600 cursor-pointer shadow-2xs"
              title="Chuỗi ngày học liên tục"
            >
              <Flame className="w-4 h-4 fill-orange-500 text-orange-500 animate-bounce" />
              <span>{studentStreak} Ngày</span>
            </div>

            {/* Gems / Points */}
            <div
              className="flex items-center gap-1.5 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-xl font-black text-xs text-sky-600 cursor-pointer shadow-2xs"
              title="Điểm tích lũy cá nhân"
              onClick={() => setIsShopModalOpen(true)}
            >
              <Gem className="w-4 h-4 fill-sky-500 text-sky-500" />
              <span>{studentPoints.toLocaleString()}</span>
            </div>

            {/* Hearts */}
            <div
              className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl font-black text-xs text-rose-600 cursor-pointer shadow-2xs"
              title="Tim / Năng lượng học tập"
            >
              <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
              <span>{studentHearts}/5</span>
            </div>

            {/* Quick Action: Làm bài ngay */}
            <MagneticButton
              onClick={() => setIsQuizModalOpen(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-md shadow-emerald-500/20 active:scale-95 transition cursor-pointer"
            >
              <Swords className="w-4 h-4" />
              <span>Làm bài ngay</span>
            </MagneticButton>
          </div>
        </header>

        {/* Tab 1: BÀI HỌC 3D - ReactBits Circular Carousel + Interactive Learning Path */}
        {activeTab === 'learn' && (
          <main className="flex-1 p-6 max-w-6xl w-full mx-auto space-y-6">
            {/* ReactBits 3D Circular Carousel Showcase */}
            {show3DCarousel && (
              <CircularCarousel
                items={DONG_A_CAROUSEL_ITEMS}
                variant="student"
                primaryActionLabel="Hỏi Thầy Đông A về chặng này"
                secondaryActionLabel="Vào Thi Đấu (+180đ)"
                onPrimaryAction={(item) => {
                  const question =
                    item.promptSuggestion ||
                    `Thầy giải thích giúp em về ${item.title} (${item.period}) với ạ!`;
                  setActiveTab('ai_chat');
                  sendQueryToAi(question);
                  onShowToast(`💬 Đang hỏi Trợ lý AI Đông A về: "${item.title}"`);
                }}
                onSecondaryAction={() => {
                  setIsQuizModalOpen(true);
                }}
              />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 8 cols: Interactive Stepping Path */}
              <SpotlightCard
                spotlightColor="rgba(16, 185, 129, 0.1)"
                className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs"
              >
                <div className="mb-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full inline-block mb-1">
                      LỘ TRÌNH BÀI HỌC • CHƯƠNG 2
                    </span>
                    <h2 className="text-lg font-black text-slate-900">
                      Cuộc kháng chiến lần thứ hai (Năm 1285)
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-500 block">Tiến độ bài học</span>
                    <strong className="text-sm font-black text-emerald-600">2 / 4 Chặng</strong>
                  </div>
                </div>

                {/* Stepping Path Nodes */}
                <div className="relative py-4 flex flex-col items-center gap-8">
                  {/* Node 1: Bình Than */}
                  <div className="flex items-center gap-4 w-full max-w-md">
                    <div className="w-16 h-16 rounded-full bg-emerald-500 text-white border-4 border-emerald-200 flex items-center justify-center font-black text-xl shadow-md shrink-0">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="flex-1 bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl">
                      <div className="flex justify-between items-center">
                        <h4 className="font-extrabold text-xs text-emerald-950">
                          Chặng 1: Hội nghị Bình Than (1282)
                        </h4>
                        <span className="text-amber-500 text-xs">⭐⭐⭐</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        Đã hoàn thành • Đạt 10/10 điểm • Bóp nát quả cam
                      </p>
                    </div>
                  </div>

                  {/* Connecting Line 1 */}
                  <div className="w-1 h-6 bg-emerald-400 rounded-full" />

                  {/* Node 2: Vạn Kiếp */}
                  <div className="flex items-center gap-4 w-full max-w-md pl-6">
                    <div className="w-16 h-16 rounded-full bg-emerald-500 text-white border-4 border-emerald-200 flex items-center justify-center font-black text-xl shadow-md shrink-0">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="flex-1 bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl">
                      <div className="flex justify-between items-center">
                        <h4 className="font-extrabold text-xs text-emerald-950">
                          Chặng 2: Phòng tuyến Vạn Kiếp (1285)
                        </h4>
                        <span className="text-amber-500 text-xs">⭐⭐⭐</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        Đã hoàn thành • Đạt 10/10 điểm • Kế sách lui quân
                      </p>
                    </div>
                  </div>

                  {/* Connecting Line 2 */}
                  <div className="w-1 h-6 bg-emerald-400 rounded-full" />

                  {/* Node 3: Chương Dương Độ (ACTIVE - PULSING) */}
                  <div className="flex items-center gap-4 w-full max-w-md relative">
                    <div
                      onClick={() => setIsQuizModalOpen(true)}
                      className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 text-slate-950 border-4 border-amber-200 flex flex-col items-center justify-center font-black shadow-xl shadow-amber-500/30 shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition animate-pulse"
                    >
                      <Swords className="w-8 h-8" />
                      <span className="text-[9px] uppercase tracking-wider font-black">BẮT ĐẦU</span>
                    </div>
                    <TiltedCard
                      maxTilt={5}
                      className="flex-1 bg-gradient-to-r from-amber-50 to-orange-50/70 border-2 border-amber-300 p-4 rounded-2xl shadow-sm"
                    >
                      <div className="flex justify-between items-center">
                        <h4 className="font-black text-xs text-slate-900">
                          Chặng 3: Trận Chương Dương Độ (1285)
                        </h4>
                        <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                          BÀI HỌC HÔM NAY
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Phản công cắt đứt tiếp tế của giặc Ô Mã Nhi. Bộ 3 câu hỏi trắc nghiệm SGK.
                      </p>
                      <button
                        onClick={() => setIsQuizModalOpen(true)}
                        className="mt-2.5 flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs transition"
                      >
                        <span>Vào làm bài thi đấu (+180đ)</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </TiltedCard>
                  </div>

                  {/* Connecting Line 3 */}
                  <div className="w-1 h-6 bg-slate-300 rounded-full" />

                  {/* Node 4: Thăng Long (LOCKED) */}
                  <div className="flex items-center gap-4 w-full max-w-md opacity-60">
                    <div className="w-16 h-16 rounded-full bg-slate-200 text-slate-400 border-4 border-slate-100 flex items-center justify-center font-black text-xl shrink-0">
                      <Lock className="w-7 h-7" />
                    </div>
                    <div className="flex-1 bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
                      <h4 className="font-bold text-xs text-slate-700">
                        Chặng 4: Giải phóng Thăng Long (1285)
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Khóa 🔒 • Cần hoàn thành Chặng 3 để mở khóa
                      </p>
                    </div>
                  </div>
                </div>
              </SpotlightCard>

              {/* Right 4 cols: Side widgets for student */}
              <div className="lg:col-span-4 space-y-4">
                {/* Daily Quests Widget */}
                <SpotlightCard
                  spotlightColor="rgba(245, 158, 11, 0.1)"
                  className="bg-white rounded-3xl border border-slate-200/90 p-4 shadow-xs"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <QuestChestIcon className="w-5 h-5" />
                      <h3 className="font-extrabold text-xs text-slate-900 uppercase">
                        Nhiệm vụ hôm nay
                      </h3>
                    </div>
                    <button
                      onClick={() => setIsQuestsModalOpen(true)}
                      className="text-[11px] font-bold text-sky-600 hover:underline"
                    >
                      Xem tất cả
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-slate-800">Chuỗi 5 câu đúng liên tiếp</span>
                        <span className="text-emerald-600">+50đ</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-emerald-500 h-full w-full" />
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-slate-800">Làm bài Chương Dương Độ</span>
                        <span className="text-amber-600">+100đ</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-amber-500 h-full w-[80%]" />
                      </div>
                    </div>
                  </div>
                </SpotlightCard>

                {/* Textbook Citation helper */}
                <SpotlightCard
                  spotlightColor="rgba(99, 102, 241, 0.1)"
                  className="bg-white rounded-3xl border border-slate-200/90 p-4 shadow-xs"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-extrabold text-xs text-slate-900 uppercase">
                      Ghi nhớ nhanh SGK 7
                    </h3>
                  </div>
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs leading-relaxed text-slate-700">
                    <p className="font-bold text-amber-950 mb-1">• Bình Than (1282):</p>
                    <p className="text-[11px] text-slate-600 mb-2">
                      Hội nghị vương hầu tướng lĩnh, Trần Quốc Toản bóp nát quả cam vì chưa đủ tuổi dự bàn việc quân.
                    </p>
                    <p className="font-bold text-amber-950 mb-1">• Diên Hồng (1285):</p>
                    <p className="text-[11px] text-slate-600">
                      Hội nghị bô lão cả nước đại diện nhân dân, đồng thanh hô "ĐÁNH!".
                    </p>
                  </div>
                </SpotlightCard>

                {/* Shop promotion card with TiltedCard */}
                <TiltedCard
                  maxTilt={7}
                  className="bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-3xl p-4 shadow-md"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span className="font-extrabold text-xs uppercase">Cửa hàng đổi quà</span>
                  </div>
                  <p className="text-[11px] text-sky-100 mb-3">
                    Em đang có {studentPoints.toLocaleString()} điểm, đủ để đổi Bút chì lưu niệm Đông A!
                  </p>
                  <button
                    onClick={() => setIsShopModalOpen(true)}
                    className="w-full py-2 bg-white text-sky-700 font-extrabold text-xs rounded-xl shadow-xs hover:bg-sky-50 transition"
                  >
                    Đến Cửa Hàng Đổi Quà
                  </button>
                </TiltedCard>
              </div>
            </div>
          </main>
        )}

        {/* Tab 2: BẢNG XẾP HẠNG (Leaderboard) */}
        {activeTab === 'leaderboard' && (
          <main className="flex-1 p-6 max-w-3xl w-full mx-auto">
            <SpotlightCard
              spotlightColor="rgba(245, 158, 11, 0.12)"
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs"
            >
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center font-black">
                    🏆
                  </div>
                  <div>
                    <h2 className="font-black text-base text-slate-900">BẢNG XẾP HẠNG LỚP 7A1</h2>
                    <p className="text-xs text-slate-500">Thi đua học tập tuần thứ 4</p>
                  </div>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full">
                  Em đang xếp Hạng 1
                </span>
              </div>

              <div className="space-y-2">
                {[
                  { rank: 1, name: 'Nguyễn Văn Long (Em)', points: 1450, streak: 6, isMe: true },
                  { rank: 2, name: 'Trần Quốc Anh', points: 1320, streak: 5, isMe: false },
                  { rank: 3, name: 'Lê Minh Thư', points: 1150, streak: 4, isMe: false },
                  { rank: 4, name: 'Phạm Đức Dũng', points: 980, streak: 3, isMe: false },
                  { rank: 5, name: 'Vũ Hoàng Nam', points: 920, streak: 3, isMe: false },
                ].map((item) => (
                  <div
                    key={item.rank}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between transition hover:scale-[1.01] ${
                      item.isMe
                        ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/20'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${
                          item.rank === 1
                            ? 'bg-amber-400 text-slate-950'
                            : item.rank === 2
                            ? 'bg-slate-300 text-slate-900'
                            : item.rank === 3
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {item.rank}
                      </span>
                      <div>
                        <strong className="text-xs font-bold text-slate-900 block">
                          {item.name}
                        </strong>
                        <span className="text-[10px] text-slate-400">
                          Chuỗi {item.streak} ngày học
                        </span>
                      </div>
                    </div>
                    <span className="font-black text-xs text-indigo-700 bg-white px-3 py-1 rounded-full border border-slate-200">
                      {item.points.toLocaleString()} điểm
                    </span>
                  </div>
                ))}
              </div>
            </SpotlightCard>
          </main>
        )}

        {/* Tab 2.5: BẢN ĐỒ NHIỆM VỤ (Quest World Map) */}
        {activeTab === 'quests' && (
          <div className="flex-1 w-full h-full overflow-hidden flex flex-col">
            <QuestWorldMapView onShowToast={onShowToast} />
          </div>
        )}

        {/* Tab 2.8: LỘ TRÌNH CÁ NHÂN HÓA (Bayesian Knowledge Tracing - BKT) */}
        {activeTab === 'bkt_path' && (
          <main className="flex-1 p-6 max-w-5xl w-full mx-auto space-y-6 overflow-y-auto">
            {/* Header Card */}
            <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-700/50 relative overflow-hidden">
              <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-amber-400/10 blur-3xl" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 rounded-full text-[10px] font-black uppercase tracking-wider">
                      <ShinyText text="AI KHẢO THÍ & PHÂN TÍCH NĂNG LỰC" className="text-amber-200" />
                    </span>
                    <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-[10px] font-bold">
                      Q-Matrix Active
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-white">
                    LỘ TRÌNH ÔN TẬP CÁ NHÂN HÓA (BKT)
                  </h2>
                  <p className="text-xs text-indigo-200 mt-1 max-w-2xl leading-relaxed">
                    Hệ thống theo dõi tiến trình tri thức của học sinh theo mô hình Bayesian Knowledge Tracing (4 tham số: Prior, Transition, Guess, Slip). Tự động phát hiện các lỗ hổng kiến thức để đề xuất ôn tập trọng tâm.
                  </p>
                </div>

                <MagneticButton
                  onClick={fetchBKTRecommendations}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 self-start md:self-auto shrink-0 shadow-md cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Cập nhật tiến trình</span>
                </MagneticButton>
              </div>

              {/* BKT 4-Parameter Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-indigo-700/50 relative z-10">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                  <span className="text-[10px] font-bold text-indigo-200 block">P(L₀) Khởi điểm</span>
                  <strong className="text-sm font-black text-white">30%</strong>
                  <span className="text-[9px] text-indigo-300 block">Xác suất biết ban đầu</span>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                  <span className="text-[10px] font-bold text-indigo-200 block">P(T) Tiếp thu</span>
                  <strong className="text-sm font-black text-emerald-300">+15%</strong>
                  <span className="text-[9px] text-indigo-300 block">Tăng sau mỗi lượt học</span>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                  <span className="text-[10px] font-bold text-indigo-200 block">P(G) Đoán mò</span>
                  <strong className="text-sm font-black text-amber-300">25%</strong>
                  <span className="text-[9px] text-indigo-300 block">Xác suất đoán đúng</span>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                  <span className="text-[10px] font-bold text-indigo-200 block">
                    P(S) Trượt/Sơ suất
                  </span>
                  <strong className="text-sm font-black text-rose-300">10%</strong>
                  <span className="text-[9px] text-indigo-300 block">Sai sót dù đã biết</span>
                </div>
              </div>
            </div>

            {/* Recommendations Content */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span>Vùng Kiến Thức Cần Củng Cố Gấp</span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                      P(L) &lt; 60%
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Dựa trên kết quả làm bài trắc nghiệm và câu hỏi tương tác gần nhất
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {bktRecommendations.length} chủ điểm ưu tiên
                </span>
              </div>

              {isBktLoading ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 space-y-2">
                  <Sparkles className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
                  <p className="text-xs text-slate-500">
                    Đang tính toán ma trận tri thức BKT cho học sinh...
                  </p>
                </div>
              ) : bktRecommendations.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl mx-auto mb-3">
                    🎉
                  </div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Xuất sắc! Em đã nắm vững tất cả 32 cụm tri thức
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Toàn bộ các chủ đề trong chương Ba lần kháng chiến chống Mông - Nguyên đều đạt mức độ thành thạo trên 60%.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {bktRecommendations.map((rec) => {
                    const masteryPercent = Math.round(rec.current_mastery * 100);
                    const isVeryLow = masteryPercent < 30;

                    const levelBadge =
                      rec.cognitive_level === 'NHAN_BIET'
                        ? { label: 'Nhận biết', color: 'bg-blue-50 text-blue-700 border-blue-200' }
                        : rec.cognitive_level === 'THONG_HIEU'
                        ? {
                            label: 'Thông hiểu',
                            color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          }
                        : {
                            label: 'Vận dụng',
                            color: 'bg-purple-50 text-purple-700 border-purple-200',
                          };

                    return (
                      <SpotlightCard
                        key={rec.unit_id}
                        spotlightColor="rgba(99, 102, 241, 0.12)"
                        className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition"
                      >
                        <div className="flex flex-col justify-between h-full">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${levelBadge.color}`}
                              >
                                Mức độ: {levelBadge.label}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                Độ khó: {rec.difficulty}
                              </span>
                            </div>

                            <h4 className="font-black text-sm text-slate-900 mb-1.5 leading-snug">
                              {rec.topic}
                            </h4>

                            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                              {rec.reason}
                            </p>

                            {/* Mastery Bar */}
                            <div className="mb-4">
                              <div className="flex justify-between items-center text-xs mb-1">
                                <span className="font-bold text-slate-600">
                                  Mức độ nắm vững P(L):
                                </span>
                                <strong
                                  className={
                                    isVeryLow
                                      ? 'text-rose-600 font-black'
                                      : 'text-amber-600 font-black'
                                  }
                                >
                                  {masteryPercent}%
                                </strong>
                              </div>
                              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-500 ${
                                    isVeryLow ? 'bg-rose-500' : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${masteryPercent}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                            <button
                              onClick={() => {
                                const q = `Thầy giải thích giúp em về: ${rec.topic} với ạ`;
                                setActiveTab('ai_chat');
                                sendQueryToAi(q);
                                onShowToast('💬 Đã gửi câu hỏi ôn tập BKT tới Trợ lý AI Đông A!');
                              }}
                              className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Hỏi Thầy Đông A</span>
                            </button>

                            <button
                              onClick={() => setIsQuizModalOpen(true)}
                              className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                            >
                              <Swords className="w-3.5 h-3.5" />
                              <span>Luyện tập</span>
                            </button>
                          </div>
                        </div>
                      </SpotlightCard>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        )}

        {/* Tab 3: HỎI ĐÁP AI (Student Chat — Editorial Awwwards Interface) */}
        {activeTab === 'ai_chat' && (
          <main className="flex-1 p-4 sm:p-6 max-w-4xl w-full mx-auto flex flex-col h-[calc(100vh-130px)]">
            <div className="bg-white/95 backdrop-blur-2xl rounded-3xl border border-slate-200/80 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)] flex-1 flex flex-col overflow-hidden relative">
              {/* Minimalist Architectural Header (No Robot Icon) */}
              <div className="px-6 py-4 border-b border-white/10 bg-[#0b0f19] text-white flex items-center justify-between relative overflow-hidden">
                <div className="pointer-events-none absolute -top-20 left-1/3 w-72 h-40 bg-amber-500/10 blur-3xl rounded-full" />

                <div className="relative z-10 flex flex-col gap-0.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-pulse" />
                    <h3 className="font-black text-sm sm:text-base tracking-tight text-white">
                      Trợ Lý Sử Học Đông A
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                      SGK Lịch Sử 7 • KNTT
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-4.5">
                    Hệ thống truy xuất và đối chiếu sử liệu chính thống Đại Việt Sử Ký Toàn Thư
                  </p>
                </div>

                <div className="relative z-10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetChatSession}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/10 text-xs font-bold text-slate-200 transition active:scale-95 cursor-pointer"
                    title="Làm mới ngữ cảnh hội thoại"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                    <span className="hidden sm:inline">Làm mới hội thoại</span>
                  </button>
                </div>
              </div>

              {/* Editorial Conversation Canvas */}
              <div className="flex-1 px-5 sm:px-8 py-6 overflow-y-auto space-y-6 bg-gradient-to-b from-[#f8fafc]/60 via-white to-[#f8fafc]/40">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col animate-slide-up ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    {msg.sender === 'ai' && msg.characterName && (
                      <div className="flex items-center gap-2 mb-1.5 pl-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                          {msg.characterName}
                        </span>
                      </div>
                    )}

                    {msg.sender === 'user' ? (
                      <div className="max-w-[80%] px-5 py-3.5 rounded-2xl rounded-tr-xs bg-[#0f172a] text-white text-xs sm:text-[13.5px] leading-relaxed font-medium shadow-md shadow-slate-900/10">
                        {msg.text}
                      </div>
                    ) : (
                      <div
                        className={`max-w-[92%] sm:max-w-[86%] p-5 sm:p-6 rounded-3xl rounded-tl-xs shadow-[0_4px_24px_-6px_rgba(15,23,42,0.06)] transition ${
                          msg.text.startsWith('⚠️')
                            ? 'bg-amber-50/90 text-amber-950 border border-amber-200/90'
                            : 'bg-white text-slate-800 border border-slate-200/80'
                        }`}
                      >
                        {renderFormattedAiText(msg.text)}

                        {msg.citation && (
                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <div className="inline-flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50/90 border border-emerald-200/70 font-bold px-3 py-1 rounded-full">
                              <BookOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Nguồn đối chiếu: {msg.citation}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {isAiLoading && (
                  <div className="flex items-center gap-3 px-5 py-4 bg-white border border-slate-200/80 rounded-2xl max-w-md text-xs font-medium text-slate-600 shadow-xs animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                    <span>
                      Đang truy xuất sử liệu SGK Lịch sử 7 và biên soạn câu trả lời...
                    </span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Clean Floating Composer Bar */}
              <div className="p-4 sm:px-6 sm:py-4 border-t border-slate-100 bg-white/95 backdrop-blur-xl">
                <div className="flex items-center gap-2.5 bg-slate-50/90 hover:bg-slate-50 focus-within:bg-white border border-slate-200/90 focus-within:border-slate-900 focus-within:ring-4 focus-within:ring-slate-900/5 rounded-2xl p-1.5 pl-4 transition-all duration-200 shadow-2xs">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={isAiLoading}
                    placeholder="Đặt câu hỏi lịch sử Đại Việt thời Trần (1258 – 1288)..."
                    className="flex-1 py-2 bg-transparent text-xs sm:text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isAiLoading || !chatInput.trim()}
                    className="px-5 py-2.5 bg-[#0b0f19] hover:bg-slate-800 disabled:opacity-35 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition active:scale-95 cursor-pointer shrink-0 shadow-xs"
                  >
                    <span>Gửi</span>
                    <Send className="w-3.5 h-3.5 text-amber-300" />
                  </button>
                </div>
              </div>
            </div>
          </main>
        )}
      </div>

      {/* Modals for Student */}
      <StudentQuizModal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        onComplete={handleQuizComplete}
      />

      <QuestsModal
        isOpen={isQuestsModalOpen}
        onClose={() => setIsQuestsModalOpen(false)}
      />

      <ShopModal
        isOpen={isShopModalOpen}
        onClose={() => setIsShopModalOpen(false)}
        userPoints={studentPoints}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};
