import React, { useState } from 'react';
import {
  Award, Check, Clock, Copy, Eye, HelpCircle, Image as ImageIcon, ListOrdered, Palette, Plus, Sliders, Sparkles,
  Trash2, X
} from 'lucide-react';
import { BrandLogo } from '@/components/customs/BrandLogo';
import { KahootShape } from '@/components/customs/KahootShape';
import { quizThemes } from '@/constants/teacher/library';
import { ANSWER_STYLES } from '@/constants/theme';
import type { AnswerMode, FolderItem, PointsType, QuestionType, QuizItem, QuizQuestion } from '@/types/libraryType';

interface QuizCreatorViewProps {
  initialQuiz?: QuizItem | null;
  folders: FolderItem[];
  defaultFolderId?: string | null;
  onSaveQuiz: (quiz: QuizItem) => void;
  onExit: () => void;
  onOpenAiGenerator?: () => void;
  onShowToast: (msg: string) => void;
}

const DEFAULT_OPTIONS = [
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
];

const SAMPLE_HISTORICAL_IMAGES = [
  { label: 'Bình Than 1282', url: 'https://images.unsplash.com/photo-1532012164546-f432f2e35b18?auto=format&fit=crop&w=600&q=80' },
  { label: 'Diên Hồng 1285', url: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=600&q=80' },
  { label: 'Bạch Đằng 1288', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80' },
  { label: 'Chương Dương 1285', url: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=600&q=80' },
];

export const QuizCreatorView: React.FC<QuizCreatorViewProps> = ({
  initialQuiz,
  folders,
  defaultFolderId,
  onSaveQuiz,
  onExit,
  onOpenAiGenerator,
  onShowToast,
}) => {
  // Quiz Info
  const [title, setTitle] = useState(initialQuiz?.title || 'Bài trắc nghiệm mới');
  const [folderId, setFolderId] = useState<string | null>(initialQuiz?.folderId || defaultFolderId || null);
  const [themeId, setThemeId] = useState<string>(initialQuiz?.themeId || 'standard');

  // Questions List
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    initialQuiz?.questions && initialQuiz.questions.length > 0
      ? initialQuiz.questions
      : [
          {
            id: 'q-1',
            question: '',
            type: 'quiz',
            timeLimit: 20,
            points: 'standard',
            answerMode: 'single',
            options: [
              { text: '', isCorrect: false },
              { text: '', isCorrect: false },
              { text: '', isCorrect: false },
              { text: '', isCorrect: false },
            ],
          },
        ]
  );

  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [rightPanelTab, setRightPanelTab] = useState<'properties' | 'theme' | null>('properties');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const currentQ = questions[activeQuestionIndex] || questions[0];
  const currentTheme = quizThemes.find((t) => t.id === themeId) || quizThemes[0];

  // Handlers for Question Updates
  const updateCurrentQuestion = (partial: Partial<QuizQuestion>) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[activeQuestionIndex] = { ...updated[activeQuestionIndex], ...partial };
      return updated;
    });
  };

  const updateOptionText = (optionIndex: number, text: string) => {
    const newOptions = [...currentQ.options];
    newOptions[optionIndex] = { ...newOptions[optionIndex], text };
    updateCurrentQuestion({ options: newOptions });
  };

  const toggleOptionCorrect = (optionIndex: number) => {
    const newOptions = [...currentQ.options];
    if (currentQ.answerMode === 'single') {
      newOptions.forEach((opt, idx) => {
        opt.isCorrect = idx === optionIndex;
      });
    } else {
      newOptions[optionIndex].isCorrect = !newOptions[optionIndex].isCorrect;
    }
    updateCurrentQuestion({ options: newOptions });
  };

  const handleAddQuestion = (type: QuestionType = 'quiz') => {
    const newQ: QuizQuestion = {
      id: `q-${Date.now()}`,
      question: '',
      type,
      timeLimit: 20,
      points: 'standard',
      answerMode: 'single',
      options:
        type === 'true_false'
          ? [
              { text: 'Đúng', isCorrect: true },
              { text: 'Sai', isCorrect: false },
            ]
          : [
              { text: '', isCorrect: false },
              { text: '', isCorrect: false },
              { text: '', isCorrect: false },
              { text: '', isCorrect: false },
            ],
    };
    setQuestions((prev) => [...prev, newQ]);
    setActiveQuestionIndex(questions.length);
    onShowToast(`➕ Đã thêm câu hỏi ${questions.length + 1}`);
  };

  const handleDuplicateQuestion = () => {
    const cloned: QuizQuestion = {
      ...currentQ,
      id: `q-${Date.now()}`,
      question: `${currentQ.question} (Bản sao)`,
      options: currentQ.options.map((o) => ({ ...o })),
    };
    setQuestions((prev) => [...prev.slice(0, activeQuestionIndex + 1), cloned, ...prev.slice(activeQuestionIndex + 1)]);
    setActiveQuestionIndex(activeQuestionIndex + 1);
    onShowToast('📋 Đã nhân bản câu hỏi');
  };

  const handleDeleteQuestion = () => {
    if (questions.length <= 1) {
      onShowToast('⚠️ Bộ đề cần có ít nhất 1 câu hỏi.');
      return;
    }
    setQuestions((prev) => prev.filter((_, idx) => idx !== activeQuestionIndex));
    setActiveQuestionIndex(Math.max(0, activeQuestionIndex - 1));
    onShowToast('🗑️ Đã xoá câu hỏi');
  };

  const handleSave = () => {
    const readyQuiz: QuizItem = {
      id: initialQuiz?.id || `quiz-${Date.now()}`,
      title: title.trim() || 'Bài trắc nghiệm Lịch sử 7',
      questionCount: questions.length,
      status: 'ready',
      folderId,
      thumbnail: currentQ.mediaUrl || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80',
      author: 'Thầy Nguyễn Văn Long',
      updatedAt: 'Vừa xong',
      plays: initialQuiz?.plays || 0,
      themeId,
      questions,
    };
    onSaveQuiz(readyQuiz);
    onShowToast(`💾 Đã lưu thành công bài Quiz: "${readyQuiz.title}"`);
    onExit();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white text-duo-ink select-none overflow-hidden animate-in">
      {/* ======================================================== */}
      {/* 1. Header trên cùng (Khớp chuẩn Ảnh 1 & 2) */}
      {/* ======================================================== */}
      <header className="h-16 bg-white border-b-2 border-duo-swan px-4 sm:px-5 flex items-center justify-between gap-3 shrink-0 z-20">
        {/* Left: Brand + Title input + Settings + Save status */}
        <div className="flex items-center gap-3.5">
          {/* Logo Đông A EDU */}
          <BrandLogo compact />
          <span className="chip bg-kh-purple text-white hidden md:inline-flex">TRÌNH SOẠN QUIZ</span>

          {/* Title Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề quiz..."
              className="px-3 py-1 bg-duo-polar hover:bg-duo-polar focus:bg-white border-2 border-duo-swan rounded-lg text-xs font-bold text-duo-ink focus:outline-none focus:ring-2 focus:ring-[#115e59]/20 w-64 md:w-80 transition"
            />
            <button
              onClick={() => {
                const nextFolder = folders[(folders.findIndex((f) => f.id === folderId) + 1) % folders.length];
                setFolderId(nextFolder ? nextFolder.id : null);
                onShowToast(nextFolder ? `📁 Đã chọn thư mục: ${nextFolder.name}` : '📁 Lưu vào Thư viện chung');
              }}
              className="btn-3d btn-outline btn-sm btn-normal-case !text-duo-wolf"
            >
              <span>Cài đặt</span>
            </button>
          </div>

          {/* Save Status / Folder indicator */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-duo-wolf font-medium pl-2 border-l-2 border-duo-swan">
            <Check className="w-4 h-4 text-duo-green stroke-[3]" />
            <span>Lưu vào:</span>
            <span className="font-bold text-duo-ink">
              {folders.find((f) => f.id === folderId)?.name || 'Bản nháp của bạn'}
            </span>
          </div>
        </div>

        {/* Right: Upgrade + Preview + Exit + Save */}
        <div className="flex items-center gap-2.5">
          {/* Nâng cấp badge */}
          <div className="hidden sm:inline-flex chip bg-duo-gold-light text-duo-gold-dark !py-1 select-none">
            <span className="text-[10px]">★</span>
            <span>Nâng cấp</span>
          </div>

          {/* Xem trước */}
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="btn-3d btn-outline btn-sm btn-icon !text-duo-wolf"
            title="Xem trước câu hỏi"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Thoát */}
          <button
            onClick={onExit}
            className="btn-3d btn-outline btn-sm !text-duo-wolf"
          >
            Thoát
          </button>

          {/* Lưu Quiz (Xanh dương như ảnh 1) */}
          <button
            onClick={handleSave}
            className="btn-3d btn-green btn-sm"
          >
            Lưu
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. Main Workspace (3 Cột: Cột Slide trái, Canvas giữa, Panel phải) */}
      {/* ======================================================== */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* ======================================================== */}
        {/* CỘT TRÁI: Danh sách câu hỏi (Slide Panel - Khớp Ảnh 1) */}
        {/* ======================================================== */}
        <div className="w-52 bg-duo-polar border-r-2 border-duo-swan flex flex-col justify-between shrink-0 select-none z-10">
          {/* Danh sách các câu hỏi dạng Thumbnail */}
          <div className="p-2.5 space-y-2 overflow-y-auto flex-1">
            {questions.map((q, idx) => {
              const isActive = idx === activeQuestionIndex;
              return (
                <div
                  key={q.id}
                  onClick={() => setActiveQuestionIndex(idx)}
                  className={`p-2 rounded-xl cursor-pointer transition border-2 flex flex-col gap-1 relative group ${
                    isActive
                      ? 'border-duo-blue bg-duo-blue-light'
                      : 'border-duo-swan bg-white hover:border-duo-hare'
                  }`}
                >
                  {/* Tiêu đề nhỏ: 1 Trắc nghiệm */}
                  <div className="flex items-center justify-between text-[10px] font-bold text-duo-wolf">
                    <span>
                      {idx + 1} {q.type === 'quiz' ? 'Trắc nghiệm' : 'Đúng/Sai'}
                    </span>
                    {questions.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (idx === activeQuestionIndex) handleDeleteQuestion();
                          else {
                            setQuestions((prev) => prev.filter((_, i) => i !== idx));
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-duo-hare hover:text-duo-red transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Thumbnail mô phỏng slide */}
                  <div className="aspect-video w-full rounded-md border-2 border-duo-swan bg-duo-polar flex flex-col justify-between p-1 overflow-hidden relative">
                    <span className="text-[8px] text-duo-hare font-medium truncate text-center block">
                      {q.question || 'Câu hỏi'}
                    </span>

                    <div className="flex items-center justify-between px-1">
                      <span className="text-[8px] bg-slate-200 text-[#4b4b4b] px-1 rounded font-bold">
                        {q.timeLimit}s
                      </span>
                      <ImageIcon className="w-2.5 h-2.5 text-duo-hare" />
                    </div>

                    {/* Vạch 4 đáp án thu nhỏ */}
                    <div className="grid grid-cols-2 gap-0.5">
                      <div className="h-1.5 bg-kh-red rounded-sm" />
                      <div className="h-1.5 bg-kh-blue rounded-sm" />
                      <div className="h-1.5 bg-kh-yellow rounded-sm" />
                      <div className="h-1.5 bg-kh-green rounded-sm" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nút Thêm câu hỏi & Nút Tạo AI (Khớp ảnh 1) */}
          <div className="p-2.5 border-t-2 border-duo-swan space-y-2">
            <button
              onClick={() => handleAddQuestion('quiz')}
              className="w-full btn-3d btn-blue btn-sm"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Thêm</span>
            </button>

            <button
              onClick={() => {
                if (onOpenAiGenerator) {
                  onOpenAiGenerator();
                } else {
                  onShowToast('✨ Đang sinh câu hỏi tự động từ SGK Lịch sử 7...');
                  handleAddQuestion('quiz');
                }
              }}
              className="w-full btn-3d btn-outline btn-sm !text-duo-purple-dark"
            >
              <Sparkles className="w-4 h-4" />
              <span>Tạo</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* KHU VỰC TRUNG TÂM: Canvas Soạn Thảo (Khớp Ảnh 1 & 2) */}
        {/* ======================================================== */}
        <div
          className={`flex-1 flex flex-col justify-between p-6 overflow-y-auto transition-all duration-300 ${currentTheme.bgGradient}`}
        >
          {/* Ô nhập câu hỏi chính trên cùng (Khớp ảnh 1) */}
          <div className="max-w-4xl w-full mx-auto">
            <div className="bg-white rounded-2xl p-3 shadow-[0_5px_0_rgba(0,0,0,0.18)]">
              <input
                type="text"
                value={currentQ.question}
                onChange={(e) => updateCurrentQuestion({ question: e.target.value })}
                placeholder="Bắt đầu nhập câu hỏi"
                className="w-full text-center text-lg md:text-xl font-extrabold text-duo-ink placeholder:text-duo-hare focus:outline-none py-2 px-4"
                autoFocus
              />
            </div>
          </div>

          {/* Ô trung tâm: Tìm và chèn phương tiện truyền thông (Khớp ảnh 1) */}
          <div className="max-w-lg w-full mx-auto my-auto py-4">
            {currentQ.mediaUrl ? (
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-white/60 aspect-video group">
                <img
                  src={currentQ.mediaUrl}
                  alt="Ảnh minh hoạ"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => updateCurrentQuestion({ mediaUrl: undefined })}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/90 text-white rounded-lg transition"
                  title="Gỡ ảnh"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => setShowMediaPicker(!showMediaPicker)}
                className="bg-white/85 hover:bg-white border-4 border-dashed border-white/60 hover:border-duo-purple rounded-3xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group"
              >
                {/* Icon phương tiện */}
                <div className="w-14 h-14 rounded-2xl bg-duo-purple text-white flex items-center justify-center transition shadow-[0_4px_0_#6b21a8] group-hover:scale-105">
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </div>
                <h4 className="font-extrabold text-xs text-duo-ink mt-1">
                  Tìm và chèn phương tiện truyền thông
                </h4>
                <p className="text-[11px] text-duo-wolf">
                  <span className="text-duo-blue font-bold underline">Tải tệp tin lên</span> hoặc bấm để chọn ảnh sử liệu mẫu
                </p>
              </div>
            )}

            {/* Selector ảnh sử liệu mẫu khi mở */}
            {showMediaPicker && (
              <div className="bg-white rounded-2xl shadow-2xl border-2 border-duo-swan p-3 mt-3 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 mb-2 border-b-2 border-duo-swan">
                  <span className="text-xs font-bold text-duo-ink">Kho ảnh Lịch sử 7</span>
                  <button
                    onClick={() => setShowMediaPicker(false)}
                    className="text-duo-hare hover:text-duo-wolf"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {SAMPLE_HISTORICAL_IMAGES.map((img) => (
                    <div
                      key={img.label}
                      onClick={() => {
                        updateCurrentQuestion({ mediaUrl: img.url });
                        setShowMediaPicker(false);
                      }}
                      className="cursor-pointer rounded-lg overflow-hidden border-2 border-duo-swan hover:border-purple-500 transition group"
                    >
                      <img src={img.url} alt={img.label} className="w-full h-12 object-cover group-hover:scale-105 transition" />
                      <span className="text-[9px] block text-center truncate py-0.5 bg-duo-polar text-duo-wolf font-bold">
                        {img.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ô đáp án kiểu Kahoot: tự tô màu khi đã nhập nội dung */}
          <div className="max-w-4xl w-full mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentQ.options.slice(0, currentQ.type === 'quiz' ? 4 : 2).map((opt, i) => {
                const style = ANSWER_STYLES[i % ANSWER_STYLES.length];
                const filled = (opt.text || '').trim().length > 0;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-2xl transition ${opt.isCorrect ? 'ring-4 ring-duo-green ring-offset-2' : ''}`}
                    style={{ background: filled ? style.bg : '#fff', boxShadow: `0 5px 0 ${filled ? style.shadow : 'rgba(0,0,0,0.18)'}` }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: filled ? 'rgba(0,0,0,0.15)' : style.bg }}
                    >
                      <KahootShape shape={style.shape} size={22} />
                    </div>
                    <input
                      type="text"
                      value={opt.text || ''}
                      onChange={(e) => updateOptionText(i, e.target.value)}
                      placeholder={`Thêm đáp án ${i + 1}${i >= 2 ? ' (không bắt buộc)' : ''}`}
                      className={`flex-1 min-w-0 bg-transparent border-none text-sm md:text-base font-extrabold focus:outline-none ${
                        filled ? 'text-white placeholder:text-white/70' : 'text-duo-ink placeholder:text-duo-hare'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleOptionCorrect(i)}
                      className={`w-9 h-9 rounded-full border-4 flex items-center justify-center transition shrink-0 ${
                        opt.isCorrect
                          ? 'bg-duo-green border-white text-white'
                          : filled
                          ? 'border-white/70 hover:border-white'
                          : 'border-duo-swan hover:border-duo-hare'
                      }`}
                      title="Đánh dấu đáp án đúng"
                    >
                      {opt.isCorrect && <Check className="w-5 h-5 stroke-[4]" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CỘT PHẢI: Panel Thuộc tính & Giao diện (Khớp Ảnh 1 & 2) */}
        {/* ======================================================== */}
        {rightPanelTab !== null && (
          <div className="w-72 bg-white border-l-2 border-duo-swan flex flex-col justify-between shrink-0 select-none z-10">
            {/* Panel Thuộc tính câu hỏi (Khớp Ảnh 1) */}
            {rightPanelTab === 'properties' && (
              <div className="p-4 space-y-5 overflow-y-auto flex-1">
                <div className="flex items-center justify-between pb-2 border-b-2 border-duo-swan">
                  <h3 className="font-black text-base text-duo-ink">Thuộc tính câu hỏi</h3>
                  <button
                    onClick={() => setRightPanelTab(null)}
                    className="p-1 rounded text-duo-hare hover:text-duo-wolf"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 1. Loại câu hỏi */}
                <div>
                  <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-duo-hare" />
                    Loại câu hỏi
                  </label>
                  <select
                    value={currentQ.type}
                    onChange={(e) => {
                      const newType = e.target.value as QuestionType;
                      updateCurrentQuestion({
                        type: newType,
                        options:
                          newType === 'true_false'
                            ? [
                                { text: 'Đúng', isCorrect: true },
                                { text: 'Sai', isCorrect: false },
                              ]
                            : DEFAULT_OPTIONS.map((o) => ({ ...o })),
                      });
                    }}
                    className="input-duo w-full"
                  >
                    <option value="quiz">Trắc nghiệm (4 lựa chọn)</option>
                    <option value="true_false">Đúng / Sai (2 lựa chọn)</option>
                  </select>
                </div>

                {/* 2. Giới hạn thời gian */}
                <div>
                  <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-duo-hare" />
                    Giới hạn thời gian
                  </label>
                  <select
                    value={currentQ.timeLimit}
                    onChange={(e) => updateCurrentQuestion({ timeLimit: Number(e.target.value) })}
                    className="input-duo w-full"
                  >
                    <option value={5}>5 giây</option>
                    <option value={10}>10 giây</option>
                    <option value={20}>20 giây</option>
                    <option value={30}>30 giây</option>
                    <option value={60}>60 giây</option>
                    <option value={90}>90 giây</option>
                    <option value={120}>120 giây</option>
                  </select>
                  <button
                    onClick={() => {
                      setQuestions((prev) => prev.map((q) => ({ ...q, timeLimit: currentQ.timeLimit })));
                      onShowToast(`⏱️ Đã áp dụng ${currentQ.timeLimit}s cho tất cả câu hỏi!`);
                    }}
                    className="text-[11px] text-duo-blue hover:underline font-bold mt-1 inline-block"
                  >
                    Áp dụng cho tất cả câu hỏi
                  </button>
                </div>

                {/* 3. Điểm */}
                <div>
                  <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-duo-hare" />
                    Điểm
                  </label>
                  <select
                    value={currentQ.points}
                    onChange={(e) => updateCurrentQuestion({ points: e.target.value as PointsType })}
                    className="input-duo w-full"
                  >
                    <option value="standard">Tiêu chuẩn (1000 điểm)</option>
                    <option value="double">Gấp đôi điểm (2000 điểm)</option>
                    <option value="no_points">Không tính điểm</option>
                  </select>
                </div>

                {/* 4. Phương án trả lời */}
                <div>
                  <label className="block text-xs font-bold text-[#4b4b4b] mb-1.5 flex items-center gap-1.5">
                    <ListOrdered className="w-3.5 h-3.5 text-duo-hare" />
                    Phương án trả lời
                  </label>
                  <select
                    value={currentQ.answerMode}
                    onChange={(e) => updateCurrentQuestion({ answerMode: e.target.value as AnswerMode })}
                    className="input-duo w-full"
                  >
                    <option value="single">Chọn một đáp án</option>
                    <option value="multiple">Chọn nhiều đáp án</option>
                  </select>
                </div>

                {/* Nút Xoá & Sao chép dưới cùng panel (Khớp ảnh 1) */}
                <div className="pt-4 border-t-2 border-duo-swan flex items-center gap-2">
                  <button
                    onClick={handleDeleteQuestion}
                    className="flex-1 btn-3d btn-outline btn-sm !text-duo-red"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xoá</span>
                  </button>
                  <button
                    onClick={handleDuplicateQuestion}
                    className="flex-1 btn-3d btn-outline btn-sm !text-duo-wolf"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </button>
                </div>
              </div>
            )}

            {/* Panel Giao diện / Chủ đề (Khớp Ảnh 2) */}
            {rightPanelTab === 'theme' && (
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                <div className="flex items-center justify-between pb-2 border-b-2 border-duo-swan">
                  <h3 className="font-black text-base text-duo-ink">Giao diện</h3>
                  <button
                    onClick={() => setRightPanelTab(null)}
                    className="p-1 rounded text-duo-hare hover:text-duo-wolf"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Nhóm Miễn phí */}
                <div>
                  <h4 className="text-[11px] font-extrabold text-duo-wolf uppercase tracking-wider mb-2">
                    Miễn phí
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {quizThemes
                      .filter((t) => t.category === 'free')
                      .map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setThemeId(t.id)}
                          className={`rounded-xl overflow-hidden cursor-pointer border-2 transition relative ${
                            themeId === t.id ? 'border-duo-blue ring-2 ring-duo-blue-light' : 'border-duo-swan hover:border-duo-hare'
                          }`}
                        >
                          <div className={`h-12 w-full ${t.bgGradient}`} />
                          <span className="block text-center text-[10px] font-bold py-1 bg-white text-duo-ink">
                            {t.name}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Nhóm Chuyên nghiệp */}
                <div>
                  <h4 className="text-[11px] font-extrabold text-duo-wolf uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span>Chuyên nghiệp</span>
                    <span className="text-teal-600 font-bold">★</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {quizThemes
                      .filter((t) => t.category === 'pro')
                      .map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setThemeId(t.id)}
                          className={`rounded-xl overflow-hidden cursor-pointer border-2 transition relative ${
                            themeId === t.id ? 'border-duo-blue ring-2 ring-duo-blue-light' : 'border-duo-swan hover:border-duo-hare'
                          }`}
                        >
                          <div className={`h-12 w-full ${t.bgGradient}`} />
                          <span className="block text-center text-[10px] font-bold py-1 bg-white text-duo-ink">
                            {t.name}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Thanh công cụ biểu tượng góc cực phải (Giao diện / Thuộc tính - Khớp Ảnh 1 & 2) */}
        <div className="w-12 bg-white border-l-2 border-duo-swan flex flex-col items-center py-3 gap-3 shrink-0 z-10">
          <button
            onClick={() => setRightPanelTab(rightPanelTab === 'theme' ? null : 'theme')}
            className={`p-2 rounded-xl transition flex flex-col items-center gap-1 ${
              rightPanelTab === 'theme' ? 'bg-duo-blue-light text-duo-blue' : 'text-duo-wolf hover:bg-duo-polar'
            }`}
            title="Giao diện"
          >
            <Palette className="w-4 h-4" />
            <span className="text-[9px] font-black">Giao diện</span>
          </button>

          <button
            onClick={() => setRightPanelTab(rightPanelTab === 'properties' ? null : 'properties')}
            className={`p-2 rounded-xl transition flex flex-col items-center gap-1 ${
              rightPanelTab === 'properties' ? 'bg-duo-blue-light text-duo-blue' : 'text-duo-wolf hover:bg-duo-polar'
            }`}
            title="Thuộc tính"
          >
            <Sliders className="w-4 h-4" />
            <span className="text-[9px] font-black">Thuộc tính</span>
          </button>
        </div>
      </div>

      {/* Modal Xem trước (Preview) */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/55">
          <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] zoom-in-95">
            <div className="px-5 py-3 bg-white border-b-2 border-duo-swan flex items-center justify-between">
              <span className="font-black text-sm text-duo-ink">Xem trước chế độ học sinh</span>
              <button onClick={() => setIsPreviewOpen(false)} className="text-duo-wolf hover:text-duo-ink">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className={`p-8 flex-1 flex flex-col justify-between ${currentTheme.bgGradient}`}>
              <h3 className="text-xl font-black text-white text-center bg-black/30 p-4 rounded-2xl">
                {currentQ.question || 'Câu hỏi mẫu...'}
              </h3>
              <div className="grid grid-cols-2 gap-3 mt-6">
                {currentQ.options.map((opt, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl text-white font-extrabold text-sm flex items-center gap-3"
                    style={{ background: ANSWER_STYLES[i % 4].bg, color: ANSWER_STYLES[i % 4].fg, boxShadow: `0 5px 0 ${ANSWER_STYLES[i % 4].shadow}` }}
                  >
                    <KahootShape shape={ANSWER_STYLES[i % 4].shape} size={22} color={ANSWER_STYLES[i % 4].fg} />
                    {opt.text || `Đáp án ${i + 1}`}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
