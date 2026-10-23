import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart2, Bell, BookOpen, Check, ChevronRight, Compass, Eye, FileSpreadsheet, Flame, Lock, Play, Radio,
  Search, Sparkles, Star, Target, Users
} from 'lucide-react';
import * as liveApi from '@/api/liveApi';
import * as teacherApi from '@/api/teacherApi';
import { TeacherRosterPage } from '@/app/teacher/groups/index';
import { LibraryView } from '@/app/teacher/library/index';
import { QuizCreatorView } from '@/app/teacher/library/quiz-creator/index';
import { StoryCreatorView } from '@/app/teacher/library/story-creator/index';
import { LiveHostModal } from '@/app/teacher/live/index';
import { QuestWorldMapView } from '@/app/teacher/quests/index';
import { CircularCarousel } from '@/components/customs/carousel/CircularCarousel';
import { KahootMiniGrid, KahootShape } from '@/components/customs/KahootShape';
import { Mascot } from '@/components/customs/Mascot';
import { AiQuizModal } from '@/components/customs/teacher/AiQuizModal';
import { ClassInsights } from '@/components/customs/teacher/ClassInsights';
import { CreateDropdown } from '@/components/customs/teacher/CreateDropdown';
import { LiveHistoryCard } from '@/components/customs/teacher/LiveHistoryCard';
import { Sidebar } from '@/components/customs/teacher/Sidebar';
import { TextbookModal } from '@/components/customs/teacher/TextbookModal';
import { TodoListModal } from '@/components/customs/teacher/TodoListModal';
import { DONG_A_CAROUSEL_ITEMS } from '@/constants/teacher/carousel';
import { COURSE_STAGE_NAMES, DEFAULT_LESSON, initialTodoTasks } from '@/constants/teacher/dashboard';
import { initialFolders } from '@/constants/teacher/library';
import { ANSWER_STYLES } from '@/constants/theme';
import type { AuthUser } from '@/types/authType';
import type { QuizItem, StoryItem } from '@/types/libraryType';
import type { LiveSessionSummary, TeacherClass, TodoTask } from '@/types/teacherType';
import { avatarColor, formatDateTime, initialsOf, pct } from '@/utils/format';
import { ApiError } from '@/utils/http';

interface TeacherViewProps {
  token: string;
  user: AuthUser;
  onShowToast: (msg: string) => void;
  onSessionExpired: () => void;
}

export const TeacherView: React.FC<TeacherViewProps> = ({ token, user, onShowToast, onSessionExpired }) => {
  const displayName = user.full_name;
  const className = user.class_name;
  const [cls, setCls] = useState<TeacherClass | null>(null);
  const [clsLoading, setClsLoading] = useState(true);

  const loadClass = useCallback(() => {
    setClsLoading(true);
    teacherApi.getMyClass(token)
      .then(setCls)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) onSessionExpired();
        else onShowToast(`⚠️ ${err instanceof Error ? err.message : 'Không tải được danh sách lớp'}`);
      })
      .finally(() => setClsLoading(false));
  }, [token, onSessionExpired, onShowToast]);

  useEffect(() => {
    loadClass();
  }, [loadClass]);

  const [liveHistory, setLiveHistory] = useState<LiveSessionSummary[] | null>(null);
  const loadLiveHistory = useCallback(() => {
    liveApi.getLiveSessions(token, 5)
      .then(setLiveHistory)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) onSessionExpired();
        else setLiveHistory([]);
      });
  }, [token, onSessionExpired]);

  useEffect(() => {
    loadLiveHistory();
  }, [loadLiveHistory]);

  /** Trận vừa lưu: cập nhật lịch sử và tiến độ lớp (câu trả lời trong trận đã cộng vào tiến độ học sinh) */
  const handleLiveSaved = useCallback(() => {
    loadLiveHistory();
    loadClass();
  }, [loadLiveHistory, loadClass]);

  const roster = useMemo(() => cls?.students ?? [], [cls]);
  const summary = cls?.summary;
  const total = summary?.total ?? 0;
  const practiced = summary?.practiced ?? 0;
  const rosterNames = useMemo(() => roster.map((st) => ({ id: String(st.id), name: st.full_name })), [roster]);
  const courseStages = COURSE_STAGE_NAMES.map((name, i) => {
    const done = roster.filter((st) => (st.campaign_stars?.[i] ?? 0) >= 3).length;
    return { name, done, status: done === 0 ? 'locked' : total > 0 && done >= total ? 'done' : 'current' };
  });
  const teacherInitials = (() => {
    const parts = displayName.trim().split(/\s+/);
    return ((parts[parts.length - 1]?.[0] ?? '') + (parts.length > 1 ? parts[0][0] : '')).toUpperCase();
  })();
  const [activeTab, setActiveTab] = useState<string>('home');
  const [activeCourseTab, setActiveCourseTab] = useState<'session' | 'course'>('session');
  const [show3DCarousel, setShow3DCarousel] = useState<boolean>(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isTextbookModalOpen, setIsTextbookModalOpen] = useState(false);
  const [isCreateQuizOpen, setIsCreateQuizOpen] = useState(false);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isTodoListModalOpen, setIsTodoListModalOpen] = useState(false);
  const [tasks, setTasks] = useState<TodoTask[]>(initialTodoTasks);
  const [liveTitle, setLiveTitle] = useState<string | null>(null);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextStatus = t.status === 'completed' ? 'active' : 'completed';
          onShowToast(nextStatus === 'completed' ? `✅ Đã hoàn thành: "${t.title}"` : `🔄 Đã đưa lại vào danh sách cần làm: "${t.title}"`);
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );
  };

  const handleSkipTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          onShowToast(`⏩ Đã bỏ qua đầu việc: "${t.title}"`);
          return { ...t, status: 'skipped' };
        }
        return t;
      })
    );
  };

  const handleRestoreTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          onShowToast(`↩️ Đã khôi phục đầu việc: "${t.title}"`);
          return { ...t, status: 'active' };
        }
        return t;
      })
    );
  };

  /** Xuất báo cáo tiến độ thật của lớp ra CSV (mở bằng Excel) */
  const handleExportExcel = () => {
    if (roster.length === 0) {
      onShowToast('📭 Lớp chưa có học sinh để xuất báo cáo.');
      return;
    }
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows: Array<Array<string | number>> = [
      ['STT', 'Họ tên', 'Tên đăng nhập', 'XP', 'XP tuần', 'Lượt học/trận', 'Lượt đạt 100%', 'Số câu đã làm', 'Độ chính xác', 'Nắm vững (BKT)', 'Sao Màn 1', 'Sao Màn 2', 'Sao Màn 3', 'Số tướng', 'Chuỗi ngày', 'Câu hỏi Quân Sư', 'Đăng nhập gần nhất'],
      ...roster.map((st, i) => [
        i + 1,
        st.full_name,
        st.username,
        st.xp,
        st.week_xp,
        st.lessons_completed,
        st.perfect_runs,
        st.questions_answered,
        pct(st.accuracy),
        pct(st.avg_mastery),
        st.campaign_stars?.[0] ?? 0,
        st.campaign_stars?.[1] ?? 0,
        st.campaign_stars?.[2] ?? 0,
        st.heroes,
        st.streak,
        st.ai_questions,
        formatDateTime(st.last_login_at),
      ]),
    ];
    const csv = '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-lop-${className ?? 'chua-gan-lop'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast(`📥 Đã xuất báo cáo ${roster.length} học sinh (mở được bằng Excel)`);
  };

  /** Mở phòng thi đấu trực tiếp kiểu Kahoot */
  const handleLaunchLesson = (title = DEFAULT_LESSON) => {
    setIsTodoListModalOpen(false);
    setLiveTitle(title);
  };

  const handleExecuteAction = (actionType?: string) => {
    switch (actionType) {
      case 'profile':
        onShowToast(`👤 Hồ sơ giảng viên: ${displayName}${className ? ` – phụ trách lớp ${className}` : ''}`);
        break;
      case 'report':
      case 'excel':
        handleExportExcel();
        break;
      case 'ai':
        setIsTodoListModalOpen(false);
        setIsAiModalOpen(true);
        break;
      case 'lesson':
        handleLaunchLesson();
        break;
      case 'library':
        setIsTodoListModalOpen(false);
        setIsCreateStoryOpen(true);
        break;
      default:
        onShowToast('👍 Thao tác đã được thực hiện thành công.');
    }
  };

  const handleSaveQuizFromHeader = (newQuiz: QuizItem) => {
    onShowToast(`🎯 Đã tạo bộ Quiz: "${newQuiz.title}"`);
    setActiveTab('library');
  };

  const handleSaveStoryFromHeader = (newStory: StoryItem) => {
    onShowToast(`📖 Đã tạo câu chuyện: "${newStory.title}"`);
    setActiveTab('library');
  };

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const visibleCount = tasks.filter((t) => t.status !== 'skipped').length;

  const kpis = [
    { label: 'Hoạt động 7 ngày qua', value: summary ? `${summary.active_7d}/${summary.total}` : '—', icon: <Users className="w-6 h-6" />, color: '#0f766e' },
    { label: 'Tỷ lệ đúng trung bình', value: pct(summary?.avg_accuracy), icon: <Target className="w-6 h-6" />, color: '#0369a1' },
    { label: 'Chuỗi học dài nhất', value: summary ? `${summary.best_streak} ngày` : '—', icon: <Flame className="w-6 h-6" />, color: '#c2410c' },
    { label: 'Sao chiến dịch cả lớp', value: summary ? `${summary.total_stars.toLocaleString('vi-VN')} sao` : '—', icon: <Star className="w-6 h-6" />, color: '#d97706' },
  ];

  const tools = [
    { title: 'Trình tạo AI', desc: 'Soạn đề trắc nghiệm chuẩn SGK 7 bằng AI trong vài giây.', icon: Sparkles, color: '#7e22ce', shadow: '#6b21a8', onClick: () => setIsAiModalOpen(true), cta: 'Bắt đầu ngay' },
    { title: 'Bản đồ nhiệm vụ', desc: 'Hành trình 13 ải lịch sử và tiến độ của cả lớp.', icon: Compass, color: '#c2410c', shadow: '#9a3412', onClick: () => setActiveTab('quests'), cta: 'Mở bản đồ' },
    { title: 'Thư viện sử liệu', desc: 'Quiz, câu chuyện và thư mục tài liệu của thầy.', icon: BookOpen, color: '#0369a1', shadow: '#075985', onClick: () => setActiveTab('library'), cta: 'Mở thư viện' },
    { title: 'Báo cáo lớp học', desc: 'Xuất tiến độ, độ chính xác và mức nắm vững của cả lớp ra Excel.', icon: BarChart2, color: '#b91c1c', shadow: '#7f1d1d', onClick: handleExportExcel, cta: 'Xem báo cáo' },
  ];

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-white text-duo-ink">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tabId) => {
          if (tabId === 'live') {
            handleLaunchLesson();
            return;
          }
          setActiveTab(tabId);
          if (tabId === 'quests') {
            onShowToast('🗺️ Đã mở Bản đồ Nhiệm vụ (Hành trình 13 ải lịch sử).');
          } else if (tabId === 'library') {
            onShowToast('📚 Đã mở Thư viện học liệu (Quiz, Câu chuyện & Thư mục)');
          } else if (tabId === 'reports') {
            handleExportExcel();
          } else if (tabId === 'groups') {
            loadClass();
          } else if (tabId === 'help') {
            setIsTextbookModalOpen(true);
          } else if (tabId === 'discover') {
            setActiveTab('home');
            setShow3DCarousel(true);
            onShowToast('🧭 Đã bật Sa bàn 3D: Bài 13 - Ba lần kháng chiến chống quân Mông - Nguyên.');
          }
        }}
        onOpenAiModal={() => setIsAiModalOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* ===== Header ===== */}
        <header className="bg-white border-b-2 border-duo-swan px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg font-black text-duo-ink truncate">
              {activeTab === 'library' ? 'Thư viện học liệu số' : activeTab === 'quests' ? 'Bản đồ nhiệm vụ' : activeTab === 'groups' ? 'Học sinh của lớp' : 'Bảng điều khiển'}
            </h1>
            {className && <span className="chip bg-duo-purple-light text-kh-purple hidden sm:inline-flex">Lớp {className}</span>}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative w-64 hidden lg:block">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-duo-hare" />
              <input type="text" placeholder="Tìm bài giảng, câu hỏi, tài liệu..." className="input-duo !py-2 !pl-10 !text-sm" />
            </div>

            {activeTab === 'home' && (
              <button
                type="button"
                onClick={() => setShow3DCarousel((v) => !v)}
                className={`hidden sm:inline-flex btn-3d btn-sm ${show3DCarousel ? 'btn-gold' : 'btn-outline !text-duo-wolf'}`}
              >
                <Compass className="w-4 h-4" /> {show3DCarousel ? 'Ẩn sa bàn' : 'Sa bàn 3D'}
              </button>
            )}

            <button
              onClick={() => onShowToast('⭐ Bạn đang dùng phiên bản Đông A EDU Studio cao cấp.')}
              className="hidden md:inline-flex chip bg-duo-gold-light text-duo-gold-dark !py-1.5 !px-3 !text-xs"
            >
              ★ PRO
            </button>

            <CreateDropdown
              onCreateQuiz={() => setIsCreateQuizOpen(true)}
              onCreateStory={() => setIsCreateStoryOpen(true)}
              onCreateCourse={() => {
                setActiveTab('library');
                onShowToast('🎓 Đã chuyển đến mục Khoá học trong Thư viện.');
              }}
            />

            <button
              onClick={() => onShowToast('🔔 Bạn không có thông báo mới.')}
              className="relative w-10 h-10 rounded-xl text-duo-hare hover:text-duo-wolf hover:bg-duo-polar flex items-center justify-center"
              title="Thông báo"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-duo-red rounded-full ring-2 ring-white" />
            </button>

            <div className="flex items-center gap-2 pl-2 border-l-2 border-duo-swan">
              <span className="w-10 h-10 rounded-full bg-kh-purple text-white font-black flex items-center justify-center" title="Tài khoản giáo viên">
                {teacherInitials}
              </span>
              <div className="hidden xl:block leading-tight">
                <span className="block text-sm font-black">{displayName}</span>
                <span className="block text-xs font-bold text-duo-hare">Giáo viên phụ trách</span>
              </div>
            </div>
          </div>
        </header>

        {activeTab === 'quests' ? (
          <QuestWorldMapView onShowToast={onShowToast} roster={rosterNames} />
        ) : activeTab === 'library' ? (
          <LibraryView onShowToast={onShowToast} onOpenAiQuizModal={() => setIsAiModalOpen(true)} onLaunchLesson={handleLaunchLesson} />
        ) : activeTab === 'groups' ? (
          <TeacherRosterPage className={className} roster={roster} summary={summary} cls={cls} loading={clsLoading} onRefresh={loadClass} onExport={handleExportExcel} />
        ) : (
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
              {/* ===== Hero kiểu Kahoot ===== */}
              <section className="relative kahoot-bg rounded-3xl p-6 sm:p-8 text-white overflow-hidden" style={{ boxShadow: '0 6px 0 #0b3d3a' }}>
                <div className="absolute inset-0 pointer-events-none">
                  {ANSWER_STYLES.map((s, i) => (
                    <div
                      key={s.shape}
                      className="absolute animate-float-slow"
                      style={{ right: `${8 + i * 9}%`, top: `${i % 2 ? 62 : 14}%`, animationDelay: `${i * 0.6}s`, opacity: 0.9 }}
                    >
                      <KahootShape shape={s.shape} size={26 + i * 4} color={s.bg} />
                    </div>
                  ))}
                </div>
                <div className="relative flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-1">
                    <span className="chip bg-white/15 text-white">{className ? `LỚP ${className}` : 'CHƯA GÁN LỚP'} • LỊCH SỬ 7 • GDPT 2018</span>
                    <h2 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">Xin chào, {displayName}! 👋</h2>
                    <p className="text-white/85 font-bold mt-2 max-w-xl">
                      {!className
                        ? 'Tài khoản chưa được gán lớp phụ trách. Nhờ quản trị viên cập nhật để theo dõi học sinh.'
                        : total === 0
                        ? `Lớp ${className} chưa có học sinh nào trên hệ thống. Quản trị viên cấp tài khoản tại trang quản trị.`
                        : `${practiced}/${total} học sinh lớp ${className} đã làm bài. Hôm nay tổ chức một trận thi đấu Sử cho cả lớp nhé?`}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-5">
                      <button onClick={() => handleLaunchLesson()} className="btn-3d btn-gold btn-lg">
                        <Radio className="w-5 h-5" /> Thi đấu trực tiếp
                      </button>
                      <button onClick={() => setIsAiModalOpen(true)} className="btn-3d btn-white btn-lg">
                        <Sparkles className="w-5 h-5" /> Tạo đề bằng AI
                      </button>
                    </div>
                  </div>
                  <div className="hidden md:flex flex-col items-center shrink-0 mr-6">
                    <div className="speech-bubble tail-bottom text-sm !text-kh-purple">
                      {total > 0 ? `Lớp mình có ${total} tráng sĩ nhỏ!` : 'Chờ các bạn học sinh nhé!'}
                    </div>
                    <Mascot size={150} accessory="helmet" mood="excited" bob className="mt-2" />
                  </div>
                </div>
              </section>

              {/* ===== KPI ===== */}
              <section className="grid grid-cols-1 min-[520px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {kpis.map((k) => (
                  <div key={k.label} className="card-duo p-4 flex items-center gap-3">
                    <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: k.color }}>
                      {k.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="font-black text-xl text-duo-ink leading-tight">{k.value}</div>
                      <div className="text-xs font-bold text-duo-hare truncate">{k.label}</div>
                    </div>
                  </div>
                ))}
              </section>

              {className && total > 0 && <ClassInsights cls={cls} loading={clsLoading} />}
              {className && <LiveHistoryCard sessions={liveHistory} onLaunch={() => handleLaunchLesson()} />}

              {show3DCarousel && (
                <CircularCarousel
                  items={DONG_A_CAROUSEL_ITEMS}
                  variant="teacher"
                  primaryActionLabel="Soạn câu hỏi AI"
                  secondaryActionLabel="Thi đấu chuyên đề này"
                  onPrimaryAction={(item) => {
                    setIsAiModalOpen(true);
                    onShowToast(`✨ Đang mở Trình tạo câu hỏi AI cho chuyên đề: "${item.title}"`);
                  }}
                  onSecondaryAction={(item) => handleLaunchLesson(`${item.title} (${item.period})`)}
                />
              )}

              {/* ===== Công cụ ===== */}
              <section>
                <h3 className="text-xl font-black text-duo-ink mb-3">Công cụ cho nhà giáo dục</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {tools.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button key={t.title} onClick={t.onClick} className="card-pressable p-5 text-left flex flex-col gap-3 group">
                        <span className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: t.color, boxShadow: `0 4px 0 ${t.shadow}` }}>
                          <Icon className="w-7 h-7 text-white" />
                        </span>
                        <div>
                          <h4 className="font-black text-lg text-duo-ink">{t.title}</h4>
                          <p className="text-sm font-semibold text-duo-wolf leading-snug mt-0.5">{t.desc}</p>
                        </div>
                        <span className="mt-auto text-xs font-black uppercase tracking-wider flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: t.shadow }}>
                          {t.cta} <ChevronRight className="w-4 h-4" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* ===== Bài giảng ===== */}
                <section className="lg:col-span-8 card-duo p-5">
                  <div className="flex items-center gap-1 bg-duo-polar p-1 rounded-2xl border-2 border-duo-swan w-fit mb-4">
                    {(['session', 'course'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveCourseTab(tab)}
                        className={`px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider transition ${
                          activeCourseTab === tab ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]' : 'text-duo-hare hover:text-duo-wolf'
                        }`}
                      >
                        {tab === 'session' ? 'Bài giảng của bạn' : 'Chiến dịch 3 màn'}
                      </button>
                    ))}
                  </div>

                  {activeCourseTab === 'session' ? (
                    <div className="rounded-2xl border-2 border-duo-swan overflow-hidden">
                      <div className="kahoot-bg p-5 text-white flex items-center gap-4">
                        <KahootMiniGrid size={44} />
                        <div className="min-w-0">
                          <span className="chip bg-white/15 text-white">LỊCH SỬ 7 • KẾT NỐI TRI THỨC</span>
                          <h4 className="text-lg font-black leading-snug mt-1">Bài 14: Ba lần kháng chiến chống quân xâm lược Mông - Nguyên (1258 - 1288)</h4>
                        </div>
                        <span className="chip bg-duo-green text-white ml-auto shrink-0 hidden sm:inline-flex">Sẵn sàng</span>
                      </div>
                      <div className="p-5">
                        <p className="text-sm font-semibold text-duo-wolf leading-relaxed">
                          Bộ câu hỏi trắc nghiệm tương tác về Hội nghị Bình Than, Vạn Kiếp, chiến thắng Chương Dương Độ và giải phóng Thăng Long.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="chip bg-duo-blue-light text-duo-blue-dark">
                            <Users className="w-3 h-3" /> {total} học sinh
                          </span>
                          <span className="chip bg-duo-gold-light text-duo-gold-dark">10 câu trắc nghiệm</span>
                          <span className="chip bg-duo-green-light text-duo-green-dark">12 phút</span>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-5">
                          <button onClick={() => handleLaunchLesson()} className="btn-3d btn-green">
                            <Play className="w-4 h-4 fill-white" /> Bắt đầu
                          </button>
                          <button
                            onClick={() => {
                              setActiveTab('library');
                              onShowToast('📚 Đã chuyển đến Thư viện để xem danh sách câu hỏi.');
                            }}
                            className="btn-3d btn-outline"
                          >
                            <Eye className="w-4 h-4" /> Xem thư viện
                          </button>
                          <button onClick={() => setIsAiModalOpen(true)} className="btn-3d btn-outline !text-duo-purple-dark">
                            <Sparkles className="w-4 h-4" /> Tạo đề AI
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {courseStages.map((s, i) => (
                        <div key={s.name} className="flex items-center gap-4 p-3 rounded-2xl border-2 border-duo-swan">
                          <span
                            className="w-12 h-11 rounded-[50%] flex items-center justify-center shrink-0"
                            style={{
                              background: s.status === 'locked' ? '#e7d9bc' : '#0f766e',
                              boxShadow: `0 4px 0 ${s.status === 'locked' ? '#b7b7b7' : '#134e4a'}`,
                            }}
                          >
                            {s.status === 'locked' ? (
                              <Lock className="w-5 h-5 text-duo-hare" />
                            ) : s.status === 'done' ? (
                              <Check className="w-6 h-6 text-white stroke-[3]" />
                            ) : (
                              <span className="font-black text-white">{i + 1}</span>
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-duo-ink">{s.name}</p>
                            <div className="progress-duo progress-sm mt-1.5">
                              <div className="progress-fill" style={{ width: `${total ? (s.done / total) * 100 : 0}%` }} />
                            </div>
                          </div>
                          <span className="text-sm font-black text-duo-wolf shrink-0">
                            {s.done}/{total}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* ===== Cột phải ===== */}
                <div className="lg:col-span-4 space-y-4">
                  <section className="card-duo p-5 text-center">
                    <Mascot size={84} mood="happy" accessory="scholar" className="mx-auto" />
                    <h4 className="font-black text-lg text-duo-ink mt-1">Tạo bài giảng mới</h4>
                    <p className="text-sm font-semibold text-duo-wolf mb-4">Dùng mẫu có sẵn hoặc để AI soạn đề chuẩn SGK.</p>
                    <button onClick={() => setIsCreateQuizOpen(true)} className="btn-3d btn-blue w-full">
                      Tạo bài giảng mới
                    </button>
                  </section>

                  <section className="card-duo p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-black text-lg text-duo-ink">Báo cáo mới nhất</h4>
                      <button onClick={handleExportExcel} className="text-xs font-black text-duo-blue uppercase tracking-wider">
                        Tất cả
                      </button>
                    </div>
                    <div className="rounded-2xl bg-duo-polar p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-duo-ink">{className ? `Lớp ${className} – Bài 14` : 'Lớp của bạn'}</span>
                        <span className="chip bg-duo-green-light text-duo-green-dark">Đúng {pct(summary?.avg_accuracy)}</span>
                      </div>
                      <div className="progress-duo progress-sm my-2">
                        <div className="progress-fill" style={{ width: `${total ? (practiced / total) * 100 : 0}%` }} />
                      </div>
                      <p className="text-xs font-bold text-duo-wolf mb-3">
                        {practiced} / {total} học sinh đã làm bài
                      </p>
                      <button onClick={handleExportExcel} className="btn-3d btn-outline btn-sm w-full !text-duo-green-dark">
                        <FileSpreadsheet className="w-4 h-4" /> Xuất Excel
                      </button>
                    </div>
                  </section>

                  <section className="card-duo p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-black text-lg text-duo-ink">Top học sinh</h4>
                      <button onClick={() => setActiveTab('groups')} className="text-xs font-black text-duo-blue uppercase tracking-wider">
                        Cả lớp
                      </button>
                    </div>
                    {roster.length === 0 ? (
                      <p className="text-sm font-bold text-duo-wolf">{clsLoading ? 'Đang tải…' : 'Lớp chưa có học sinh nào.'}</p>
                    ) : (
                      <div className="space-y-2.5">
                        {roster.slice(0, 3).map((st, i) => (
                          <div key={st.id} className="flex items-center gap-3">
                            <span className="w-6 text-center font-black" style={{ color: ['#92400e', '#9a9a9a', '#cd7f32'][i] }}>
                              {i + 1}
                            </span>
                            <span className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-xs" style={{ background: avatarColor(st.full_name) }}>
                              {initialsOf(st.full_name)}
                            </span>
                            <span className="flex-1 font-extrabold text-sm truncate">{st.full_name}</span>
                            <span className="font-black text-sm text-duo-wolf">{st.xp.toLocaleString('vi-VN')} KN</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>

              {/* ===== Việc cần làm ===== */}
              <section className="card-duo p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-black text-lg text-duo-ink">Việc cần làm</h3>
                    <span className="chip bg-duo-green-light text-duo-green-dark">
                      {completedCount}/{visibleCount} đã xong
                    </span>
                  </div>
                  <button onClick={() => setIsTodoListModalOpen(true)} className="text-xs font-black text-duo-blue uppercase tracking-wider">
                    Xem tất cả
                  </button>
                </div>
                <div className="progress-duo progress-sm mb-3">
                  <div className="progress-fill" style={{ width: `${visibleCount ? (completedCount / visibleCount) * 100 : 0}%` }} />
                </div>
                <div className="divide-y-2 divide-duo-swan">
                  {tasks
                    .filter((t) => t.status !== 'skipped')
                    .slice(0, 4)
                    .map((task) => {
                      const isDone = task.status === 'completed';
                      return (
                        <div key={task.id} className="py-3 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={() => toggleTask(task.id)}
                              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                                isDone ? 'bg-duo-green border-duo-green-dark text-white' : 'border-duo-swan hover:border-duo-green bg-white'
                              }`}
                              title={isDone ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành'}
                            >
                              {isDone && <Check className="w-5 h-5 stroke-[3.5]" />}
                            </button>
                            <div className="min-w-0">
                              <h4 className={`font-black text-sm truncate ${isDone ? 'line-through text-duo-hare' : 'text-duo-ink'}`}>{task.title}</h4>
                              <p className="text-xs font-semibold text-duo-wolf truncate">{task.description}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleExecuteAction(task.actionType)}
                            className="btn-3d btn-outline btn-icon btn-sm shrink-0"
                            title={task.actionLabel || 'Chi tiết'}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              </section>
            </div>
          </main>
        )}
      </div>

      {/* ===== Modals ===== */}
      <AiQuizModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onSaveQuestions={(count) => {
          setIsAiModalOpen(false);
          onShowToast(`✅ Đã thêm ${count} câu hỏi trắc nghiệm mới vào Bài 13!`);
        }}
      />

      {isCreateQuizOpen && (
        <QuizCreatorView
          folders={initialFolders}
          onSaveQuiz={handleSaveQuizFromHeader}
          onExit={() => setIsCreateQuizOpen(false)}
          onOpenAiGenerator={() => {
            setIsCreateQuizOpen(false);
            setIsAiModalOpen(true);
          }}
          onShowToast={onShowToast}
        />
      )}

      {isCreateStoryOpen && (
        <StoryCreatorView folders={initialFolders} onSaveStory={handleSaveStoryFromHeader} onExit={() => setIsCreateStoryOpen(false)} onShowToast={onShowToast} />
      )}

      <TextbookModal isOpen={isTextbookModalOpen} onClose={() => setIsTextbookModalOpen(false)} pageNumber={68} />

      <TodoListModal
        isOpen={isTodoListModalOpen}
        onClose={() => setIsTodoListModalOpen(false)}
        tasks={tasks}
        onToggleComplete={toggleTask}
        onSkipTask={handleSkipTask}
        onRestoreTask={handleRestoreTask}
        onExecuteAction={handleExecuteAction}
      />

      <LiveHostModal
        isOpen={liveTitle !== null}
        onClose={() => setLiveTitle(null)}
        title={liveTitle ?? DEFAULT_LESSON}
        token={token}
        onShowToast={onShowToast}
        onSessionExpired={onSessionExpired}
        onSaved={handleLiveSaved}
        students={rosterNames}
      />
    </div>
  );
};
