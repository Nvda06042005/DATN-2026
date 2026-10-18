import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Eye,
  Sliders,
  Palette,
  Image as ImageIcon,
  Check,
  X,
  Clock,
  Award,
  ListOrdered,
  HelpCircle,
} from 'lucide-react';
import type { QuizItem, QuizQuestion, FolderItem, QuestionType, PointsType, AnswerMode } from '../types/library';
import { quizThemes } from '../data/libraryMockData';

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
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1e1b4b] text-slate-800 font-sans select-none overflow-hidden animate-in fade-in duration-150">
      {/* ======================================================== */}
      {/* 1. Header trên cùng (Khớp chuẩn Ảnh 1 & 2) */}
      {/* ======================================================== */}
      <header className="h-14 bg-white border-b border-slate-200 px-5 flex items-center justify-between shrink-0 z-20 shadow-xs">
        {/* Left: Brand + Title input + Settings + Save status */}
        <div className="flex items-center gap-3.5">
          {/* Logo Đông A EDU */}
          <div className="flex items-center gap-1 bg-[#46178f] text-white px-2.5 py-1 rounded-lg font-black text-xs tracking-tight shadow-2xs">
            <span>Đông A</span>
            <span className="bg-[#ff3355] text-[9px] px-1 py-0.2 rounded font-bold uppercase">
              EDU
            </span>
          </div>

          {/* Title Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề quiz..."
              className="px-3 py-1 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#46178f]/20 w-64 md:w-80 transition"
            />
            <button
              onClick={() => {
                const nextFolder = folders[(folders.findIndex((f) => f.id === folderId) + 1) % folders.length];
                setFolderId(nextFolder ? nextFolder.id : null);
                onShowToast(nextFolder ? `📁 Đã chọn thư mục: ${nextFolder.name}` : '📁 Lưu vào Thư viện chung');
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
            >
              <span>Cài đặt</span>
            </button>
          </div>

          {/* Save Status / Folder indicator */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 font-medium pl-2 border-l border-slate-200">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>Lưu vào:</span>
            <span className="font-bold text-slate-800">
              {folders.find((f) => f.id === folderId)?.name || 'Bản nháp của bạn'}
            </span>
          </div>
        </div>

        {/* Right: Upgrade + Preview + Exit + Save */}
        <div className="flex items-center gap-2.5">
          {/* Nâng cấp badge */}
          <div className="hidden sm:flex items-center gap-1 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg select-none">
            <span className="text-[10px]">★</span>
            <span>Nâng cấp</span>
          </div>

          {/* Xem trước */}
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Xem trước câu hỏi"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Thoát */}
          <button
            onClick={onExit}
            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
          >
            Thoát
          </button>

          {/* Lưu Quiz (Xanh dương như ảnh 1) */}
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-[#1368ce] hover:bg-[#0f52a5] text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition"
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
        <div className="w-48 bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 select-none z-10">
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
                      ? 'border-[#1368ce] bg-blue-50/50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Tiêu đề nhỏ: 1 Trắc nghiệm */}
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
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
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-600 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Thumbnail mô phỏng slide */}
                  <div className="aspect-video w-full rounded-md border border-slate-200 bg-slate-50 flex flex-col justify-between p-1 overflow-hidden relative">
                    <span className="text-[8px] text-slate-400 font-medium truncate text-center block">
                      {q.question || 'Câu hỏi'}
                    </span>

                    <div className="flex items-center justify-between px-1">
                      <span className="text-[8px] bg-slate-200 text-slate-700 px-1 rounded font-bold">
                        {q.timeLimit}s
                      </span>
                      <ImageIcon className="w-2.5 h-2.5 text-slate-300" />
                    </div>

                    {/* Vạch 4 đáp án thu nhỏ */}
                    <div className="grid grid-cols-2 gap-0.5">
                      <div className="h-1 bg-red-400 rounded-2xs" />
                      <div className="h-1 bg-blue-400 rounded-2xs" />
                      <div className="h-1 bg-amber-400 rounded-2xs" />
                      <div className="h-1 bg-emerald-400 rounded-2xs" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nút Thêm câu hỏi & Nút Tạo AI (Khớp ảnh 1) */}
          <div className="p-2.5 border-t border-slate-100 space-y-2">
            <button
              onClick={() => handleAddQuestion('quiz')}
              className="w-full py-2 bg-[#1368ce] hover:bg-[#0f52a5] text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition flex items-center justify-center gap-1.5"
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
              className="w-full py-2 bg-white hover:bg-purple-50 text-[#46178f] border border-purple-300 rounded-xl text-xs font-bold shadow-2xs active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
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
            <div className="bg-white rounded-2xl shadow-xl p-3 border border-slate-100/80">
              <input
                type="text"
                value={currentQ.question}
                onChange={(e) => updateCurrentQuestion({ question: e.target.value })}
                placeholder="Bắt đầu nhập câu hỏi"
                className="w-full text-center text-lg md:text-xl font-extrabold text-slate-800 placeholder:text-slate-400 focus:outline-none py-2 px-4"
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
                className="bg-white/80 hover:bg-white backdrop-blur-md border-2 border-dashed border-slate-300 hover:border-purple-400 rounded-2xl p-6 text-center cursor-pointer shadow-lg transition flex flex-col items-center justify-center gap-2 group"
              >
                {/* Icon phương tiện */}
                <div className="w-12 h-12 rounded-2xl bg-purple-100 group-hover:bg-purple-200 text-[#46178f] flex items-center justify-center transition">
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </div>
                <h4 className="font-extrabold text-xs text-slate-800 mt-1">
                  Tìm và chèn phương tiện truyền thông
                </h4>
                <p className="text-[11px] text-slate-500">
                  <span className="text-[#1368ce] font-bold underline">Tải tệp tin lên</span> hoặc bấm để chọn ảnh sử liệu mẫu
                </p>
              </div>
            )}

            {/* Selector ảnh sử liệu mẫu khi mở */}
            {showMediaPicker && (
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 mt-3 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800">Kho ảnh Lịch sử 7</span>
                  <button
                    onClick={() => setShowMediaPicker(false)}
                    className="text-slate-400 hover:text-slate-700"
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
                      className="cursor-pointer rounded-lg overflow-hidden border border-slate-200 hover:border-purple-500 transition group"
                    >
                      <img src={img.url} alt={img.label} className="w-full h-12 object-cover group-hover:scale-105 transition" />
                      <span className="text-[9px] block text-center truncate py-0.5 bg-slate-50 text-slate-600 font-bold">
                        {img.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ô 4 Đáp án bên dưới (Khớp màu chuẩn Kahoot: Đỏ, Lam, Vàng, Lục theo Ảnh 1) */}
          <div className="max-w-4xl w-full mx-auto space-y-2.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Đáp án 1: ĐỎ (▲ Tam giác) */}
              <div
                className={`flex items-center gap-3 p-3 rounded-2xl bg-white border-2 shadow-lg transition ${
                  currentQ.options[0]?.isCorrect ? 'border-emerald-500 ring-2 ring-emerald-300' : 'border-slate-100'
                }`}
              >
                {/* Shape Đỏ */}
                <div className="w-10 h-10 rounded-xl bg-[#e21b3c] flex items-center justify-center shrink-0 text-white font-black shadow-xs">
                  <span className="text-sm">▲</span>
                </div>
                <input
                  type="text"
                  value={currentQ.options[0]?.text || ''}
                  onChange={(e) => updateOptionText(0, e.target.value)}
                  placeholder="Thêm đáp án 1"
                  className="flex-1 bg-transparent border-none text-xs md:text-sm font-bold text-slate-800 focus:outline-none"
                />
                {/* Nút đánh dấu đáp án đúng */}
                <button
                  type="button"
                  onClick={() => toggleOptionCorrect(0)}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition shrink-0 ${
                    currentQ.options[0]?.isCorrect
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 hover:border-slate-500'
                  }`}
                  title="Đánh dấu đáp án đúng"
                >
                  {currentQ.options[0]?.isCorrect && <Check className="w-4 h-4 stroke-[3]" />}
                </button>
              </div>

              {/* Đáp án 2: LAM (◆ Hình thoi) */}
              <div
                className={`flex items-center gap-3 p-3 rounded-2xl bg-white border-2 shadow-lg transition ${
                  currentQ.options[1]?.isCorrect ? 'border-emerald-500 ring-2 ring-emerald-300' : 'border-slate-100'
                }`}
              >
                {/* Shape Lam */}
                <div className="w-10 h-10 rounded-xl bg-[#1368ce] flex items-center justify-center shrink-0 text-white font-black shadow-xs">
                  <span className="text-sm">◆</span>
                </div>
                <input
                  type="text"
                  value={currentQ.options[1]?.text || ''}
                  onChange={(e) => updateOptionText(1, e.target.value)}
                  placeholder="Thêm đáp án 2"
                  className="flex-1 bg-transparent border-none text-xs md:text-sm font-bold text-slate-800 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => toggleOptionCorrect(1)}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition shrink-0 ${
                    currentQ.options[1]?.isCorrect
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 hover:border-slate-500'
                  }`}
                  title="Đánh dấu đáp án đúng"
                >
                  {currentQ.options[1]?.isCorrect && <Check className="w-4 h-4 stroke-[3]" />}
                </button>
              </div>

              {/* Đáp án 3: VÀNG (● Hình tròn) */}
              {currentQ.type === 'quiz' && (
                <div
                  className={`flex items-center gap-3 p-3 rounded-2xl bg-white border-2 shadow-lg transition ${
                    currentQ.options[2]?.isCorrect ? 'border-emerald-500 ring-2 ring-emerald-300' : 'border-slate-100'
                  }`}
                >
                  {/* Shape Vàng */}
                  <div className="w-10 h-10 rounded-xl bg-[#d89e00] flex items-center justify-center shrink-0 text-white font-black shadow-xs">
                    <span className="text-sm">●</span>
                  </div>
                  <input
                    type="text"
                    value={currentQ.options[2]?.text || ''}
                    onChange={(e) => updateOptionText(2, e.target.value)}
                    placeholder="Thêm đáp án 3 (không bắt buộc)"
                    className="flex-1 bg-transparent border-none text-xs md:text-sm font-bold text-slate-800 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => toggleOptionCorrect(2)}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition shrink-0 ${
                      currentQ.options[2]?.isCorrect
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-300 hover:border-slate-500'
                    }`}
                    title="Đánh dấu đáp án đúng"
                  >
                    {currentQ.options[2]?.isCorrect && <Check className="w-4 h-4 stroke-[3]" />}
                  </button>
                </div>
              )}

              {/* Đáp án 4: LỤC (■ Hình vuông) */}
              {currentQ.type === 'quiz' && (
                <div
                  className={`flex items-center gap-3 p-3 rounded-2xl bg-white border-2 shadow-lg transition ${
                    currentQ.options[3]?.isCorrect ? 'border-emerald-500 ring-2 ring-emerald-300' : 'border-slate-100'
                  }`}
                >
                  {/* Shape Lục */}
                  <div className="w-10 h-10 rounded-xl bg-[#26890c] flex items-center justify-center shrink-0 text-white font-black shadow-xs">
                    <span className="text-sm">■</span>
                  </div>
                  <input
                    type="text"
                    value={currentQ.options[3]?.text || ''}
                    onChange={(e) => updateOptionText(3, e.target.value)}
                    placeholder="Thêm đáp án 4 (không bắt buộc)"
                    className="flex-1 bg-transparent border-none text-xs md:text-sm font-bold text-slate-800 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => toggleOptionCorrect(3)}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition shrink-0 ${
                      currentQ.options[3]?.isCorrect
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-300 hover:border-slate-500'
                    }`}
                    title="Đánh dấu đáp án đúng"
                  >
                    {currentQ.options[3]?.isCorrect && <Check className="w-4 h-4 stroke-[3]" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CỘT PHẢI: Panel Thuộc tính & Giao diện (Khớp Ảnh 1 & 2) */}
        {/* ======================================================== */}
        {rightPanelTab !== null && (
          <div className="w-72 bg-white border-l border-slate-200/90 flex flex-col justify-between shrink-0 select-none z-10">
            {/* Panel Thuộc tính câu hỏi (Khớp Ảnh 1) */}
            {rightPanelTab === 'properties' && (
              <div className="p-4 space-y-5 overflow-y-auto flex-1">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="font-extrabold text-xs text-slate-900">Thuộc tính câu hỏi</h3>
                  <button
                    onClick={() => setRightPanelTab(null)}
                    className="p-1 rounded text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 1. Loại câu hỏi */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="quiz">Trắc nghiệm (4 lựa chọn)</option>
                    <option value="true_false">Đúng / Sai (2 lựa chọn)</option>
                  </select>
                </div>

                {/* 2. Giới hạn thời gian */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Giới hạn thời gian
                  </label>
                  <select
                    value={currentQ.timeLimit}
                    onChange={(e) => updateCurrentQuestion({ timeLimit: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
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
                    className="text-[11px] text-[#1368ce] hover:underline font-bold mt-1 inline-block"
                  >
                    Áp dụng cho tất cả câu hỏi
                  </button>
                </div>

                {/* 3. Điểm */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-slate-400" />
                    Điểm
                  </label>
                  <select
                    value={currentQ.points}
                    onChange={(e) => updateCurrentQuestion({ points: e.target.value as PointsType })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="standard">Tiêu chuẩn (1000 điểm)</option>
                    <option value="double">Gấp đôi điểm (2000 điểm)</option>
                    <option value="no_points">Không tính điểm</option>
                  </select>
                </div>

                {/* 4. Phương án trả lời */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <ListOrdered className="w-3.5 h-3.5 text-slate-400" />
                    Phương án trả lời
                  </label>
                  <select
                    value={currentQ.answerMode}
                    onChange={(e) => updateCurrentQuestion({ answerMode: e.target.value as AnswerMode })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="single">Chọn một đáp án</option>
                    <option value="multiple">Chọn nhiều đáp án</option>
                  </select>
                </div>

                {/* Nút Xoá & Sao chép dưới cùng panel (Khớp ảnh 1) */}
                <div className="pt-4 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={handleDeleteQuestion}
                    className="flex-1 py-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xoá</span>
                  </button>
                  <button
                    onClick={handleDuplicateQuestion}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
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
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="font-extrabold text-xs text-slate-900">Giao diện</h3>
                  <button
                    onClick={() => setRightPanelTab(null)}
                    className="p-1 rounded text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Nhóm Miễn phí */}
                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
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
                            themeId === t.id ? 'border-[#1368ce] ring-2 ring-blue-300' : 'border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          <div className={`h-12 w-full ${t.bgGradient}`} />
                          <span className="block text-center text-[10px] font-bold py-1 bg-white text-slate-800">
                            {t.name}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Nhóm Chuyên nghiệp */}
                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
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
                            themeId === t.id ? 'border-[#1368ce] ring-2 ring-blue-300' : 'border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          <div className={`h-12 w-full ${t.bgGradient}`} />
                          <span className="block text-center text-[10px] font-bold py-1 bg-white text-slate-800">
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
        <div className="w-12 bg-white border-l border-slate-200/90 flex flex-col items-center py-3 gap-3 shrink-0 z-10">
          <button
            onClick={() => setRightPanelTab(rightPanelTab === 'theme' ? null : 'theme')}
            className={`p-2 rounded-xl transition flex flex-col items-center gap-1 ${
              rightPanelTab === 'theme' ? 'bg-[#ebf3fe] text-[#1368ce]' : 'text-slate-500 hover:bg-slate-100'
            }`}
            title="Giao diện"
          >
            <Palette className="w-4 h-4" />
            <span className="text-[8px] font-bold">Giao diện</span>
          </button>

          <button
            onClick={() => setRightPanelTab(rightPanelTab === 'properties' ? null : 'properties')}
            className={`p-2 rounded-xl transition flex flex-col items-center gap-1 ${
              rightPanelTab === 'properties' ? 'bg-[#ebf3fe] text-[#1368ce]' : 'text-slate-500 hover:bg-slate-100'
            }`}
            title="Thuộc tính"
          >
            <Sliders className="w-4 h-4" />
            <span className="text-[8px] font-bold">Thuộc tính</span>
          </button>
        </div>
      </div>

      {/* Modal Xem trước (Preview) */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <span className="font-extrabold text-xs text-slate-700">Xem trước chế độ học sinh</span>
              <button onClick={() => setIsPreviewOpen(false)} className="text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className={`p-8 flex-1 flex flex-col justify-between ${currentTheme.bgGradient}`}>
              <h3 className="text-xl font-black text-white text-center bg-black/30 p-4 rounded-2xl backdrop-blur-xs">
                {currentQ.question || 'Câu hỏi mẫu...'}
              </h3>
              <div className="grid grid-cols-2 gap-3 mt-6">
                {currentQ.options.map((opt, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-white text-slate-800 font-extrabold text-sm shadow-md"
                  >
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
