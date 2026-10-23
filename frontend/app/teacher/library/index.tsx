import React, { useMemo, useState } from 'react';
import {
  BookOpen, ChevronDown, ChevronRight, Edit3, FileQuestion, Folder, GraduationCap, LayoutGrid, List,
  MoreVertical, Play, Plus, Search, Sparkles, Trash2
} from 'lucide-react';
import { QuizCreatorView } from '@/app/teacher/library/quiz-creator/index';
import { StoryCreatorView } from '@/app/teacher/library/story-creator/index';
import { CreateFolderModal } from '@/components/customs/library/CreateFolderModal';
import { CreateQuizModal } from '@/components/customs/library/CreateQuizModal';
import { CreateStoryModal } from '@/components/customs/library/CreateStoryModal';
import { MoveToFolderModal } from '@/components/customs/library/MoveToFolderModal';
import { StoryReaderModal } from '@/components/customs/library/StoryReaderModal';
import { initialCourses, initialFolders, initialQuizzes, initialStories } from '@/constants/teacher/library';
import type { CourseItem, FolderItem, LibraryCategory, QuizItem, StoryItem } from '@/types/libraryType';

interface LibraryViewProps {
  onShowToast: (msg: string) => void;
  onOpenAiQuizModal: () => void;
  onLaunchLesson: (title: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  onShowToast,
  onOpenAiQuizModal,
  onLaunchLesson,
}) => {
  // Main Data States
  const [folders, setFolders] = useState<FolderItem[]>(initialFolders);
  const [quizzes, setQuizzes] = useState<QuizItem[]>(initialQuizzes);
  const [stories, setStories] = useState<StoryItem[]>(initialStories);
  const [courses] = useState<CourseItem[]>(initialCourses);
  const [trashedItems, setTrashedItems] = useState<{ id: string; title: string; type: 'quiz' | 'story' }[]>([]);

  // Navigation & Sub-Sidebar States
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('quiz');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isFoldersExpanded, setIsFoldersExpanded] = useState(true);

  // Filter & View States
  const [quizTab, setQuizTab] = useState<'recent' | 'draft' | 'favorite'>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [folderTypeFilter, setFolderTypeFilter] = useState<'all' | 'quiz' | 'story'>('all');

  // Modal & Creator States
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isCreateQuizOpen, setIsCreateQuizOpen] = useState(false);
  const [isQuizCreatorOpen, setIsQuizCreatorOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<QuizItem | null>(null);
  const [isStoryCreatorOpen, setIsStoryCreatorOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<StoryItem | null>(null);
  const [readingStory, setReadingStory] = useState<StoryItem | null>(null);
  const [movingItem, setMovingItem] = useState<{
    id: string;
    title: string;
    type: 'quiz' | 'story';
    folderId?: string | null;
  } | null>(null);

  // Active 3-dots Menu ID
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Handler: Add Folder
  const handleSaveFolder = (newFolder: FolderItem) => {
    setFolders((prev) => [newFolder, ...prev]);
    onShowToast(`📁 Đã tạo thư mục mới: "${newFolder.name}"`);
    setActiveCategory('folders');
    setSelectedFolderId(newFolder.id);
  };

  // Handler: Add or Update Story
  const handleSaveStory = (newStory: StoryItem) => {
    setStories((prev) => {
      const exists = prev.some((s) => s.id === newStory.id);
      if (exists) {
        return prev.map((s) => (s.id === newStory.id ? newStory : s));
      }
      return [newStory, ...prev];
    });
    onShowToast(`📖 Đã lưu câu chuyện: "${newStory.title}"`);
    setActiveCategory('story');
    setIsStoryCreatorOpen(false);
    setEditingStory(null);
  };

  // Handler: Add or Update Quiz
  const handleSaveQuiz = (newQuiz: QuizItem) => {
    setQuizzes((prev) => {
      const exists = prev.some((q) => q.id === newQuiz.id);
      if (exists) {
        return prev.map((q) => (q.id === newQuiz.id ? newQuiz : q));
      }
      return [newQuiz, ...prev];
    });
    onShowToast(`🎯 Đã lưu bộ quiz: "${newQuiz.title}"`);
    setActiveCategory('quiz');
    setIsQuizCreatorOpen(false);
    setEditingQuiz(null);
  };

  // Handler: Move item to folder
  const handleMoveItem = (targetFolderId: string | null) => {
    if (!movingItem) return;

    if (movingItem.type === 'quiz') {
      setQuizzes((prev) =>
        prev.map((q) => (q.id === movingItem.id ? { ...q, folderId: targetFolderId } : q))
      );
    } else {
      setStories((prev) =>
        prev.map((s) => (s.id === movingItem.id ? { ...s, folderId: targetFolderId } : s))
      );
    }

    const folderName = folders.find((f) => f.id === targetFolderId)?.name || 'Thư viện chung';
    onShowToast(`📦 Đã chuyển "${movingItem.title}" vào: ${folderName}`);
    setMovingItem(null);
  };

  // Handler: Trash item
  const handleTrashItem = (id: string, title: string, type: 'quiz' | 'story') => {
    if (type === 'quiz') {
      setQuizzes((prev) => prev.filter((q) => q.id !== id));
    } else {
      setStories((prev) => prev.filter((s) => s.id !== id));
    }
    setTrashedItems((prev) => [{ id, title, type }, ...prev]);
    onShowToast(`🗑️ Đã chuyển "${title}" vào Thùng rác`);
    setActiveMenuId(null);
  };

  // Handler: Restore item
  const handleRestoreItem = (item: { id: string; title: string; type: 'quiz' | 'story' }) => {
    setTrashedItems((prev) => prev.filter((i) => i.id !== item.id));
    if (item.type === 'quiz') {
      setQuizzes((prev) => [
        {
          id: item.id,
          title: item.title,
          questionCount: 5,
          status: 'ready',
          thumbnail: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80',
          author: 'Thầy Nguyễn Văn Long',
          updatedAt: 'Vừa khôi phục',
        },
        ...prev,
      ]);
    } else {
      setStories((prev) => [
        {
          id: item.id,
          title: item.title,
          readingTime: '1 phút đọc',
          status: 'published',
          thumbnail: 'https://images.unsplash.com/photo-1532012164546-f432f2e35b18?auto=format&fit=crop&w=400&q=80',
          author: 'Thầy Nguyễn Văn Long',
          updatedAt: 'Vừa khôi phục',
          summary: 'Câu chuyện đã được khôi phục từ thùng rác.',
          content: 'Nội dung câu chuyện lịch sử...',
        },
        ...prev,
      ]);
    }
    onShowToast(`♻️ Đã khôi phục "${item.title}"`);
  };

  // Filtered Quizzes
  const filteredQuizzes = useMemo(() => {
    return quizzes
      .filter((q) => {
        if (quizTab === 'draft') return q.status === 'draft';
        if (quizTab === 'favorite') return q.status === 'favorite';
        return true;
      })
      .filter((q) => {
        if (!searchQuery) return true;
        return q.title.toLowerCase().includes(searchQuery.toLowerCase());
      });
  }, [quizzes, quizTab, searchQuery]);

  // Filtered Stories
  const filteredStories = useMemo(() => {
    let list = stories.filter((s) => {
      if (!searchQuery) return true;
      return (
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.summary.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

    if (sortOrder === 'oldest') {
      list = [...list].reverse();
    }
    return list;
  }, [stories, searchQuery, sortOrder]);

  // Current Selected Folder
  const currentFolder = useMemo(() => {
    return folders.find((f) => f.id === selectedFolderId) || null;
  }, [folders, selectedFolderId]);

  // Items in Selected Folder
  const folderQuizzes = useMemo(() => {
    if (!selectedFolderId) return [];
    return quizzes.filter((q) => q.folderId === selectedFolderId);
  }, [quizzes, selectedFolderId]);

  const folderStories = useMemo(() => {
    if (!selectedFolderId) return [];
    return stories.filter((s) => s.folderId === selectedFolderId);
  }, [stories, selectedFolderId]);

  const folderTotalItems = folderQuizzes.length + folderStories.length;

  if (isQuizCreatorOpen) {
    return (
      <QuizCreatorView
        initialQuiz={editingQuiz}
        folders={folders}
        defaultFolderId={selectedFolderId}
        onSaveQuiz={handleSaveQuiz}
        onExit={() => {
          setIsQuizCreatorOpen(false);
          setEditingQuiz(null);
        }}
        onOpenAiGenerator={onOpenAiQuizModal}
        onShowToast={onShowToast}
      />
    );
  }

  if (isStoryCreatorOpen) {
    return (
      <StoryCreatorView
        initialStory={editingStory}
        folders={folders}
        defaultFolderId={selectedFolderId}
        onSaveStory={handleSaveStory}
        onExit={() => {
          setIsStoryCreatorOpen(false);
          setEditingStory(null);
        }}
        onShowToast={onShowToast}
      />
    );
  }

  return (
    <div className="flex-1 flex min-h-0 bg-white overflow-hidden" onClick={() => setActiveMenuId(null)}>
      {/* ======================================================== */}
      {/* 1. Sub-Sidebar bên trái Thư viện (Khớp chuẩn Ảnh 1, 2, 3) */}
      {/* ======================================================== */}
      <div className="w-60 bg-white border-r-2 border-duo-swan flex flex-col justify-between shrink-0 select-none">
        <div className="p-3 space-y-1">
          {/* Mục 1: Quiz (Kahoot style) */}
          <button
            onClick={() => {
              setActiveCategory('quiz');
              setSelectedFolderId(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border-2 text-sm font-extrabold transition ${
              activeCategory === 'quiz' && selectedFolderId === null
                ? 'bg-duo-blue-light text-duo-blue border-[#7dd3fc]'
                : 'text-duo-wolf border-transparent hover:bg-duo-polar'
            }`}
          >
            {/* Icon 4 ô vuông Kahoot style */}
            <div className="w-5 h-5 grid grid-cols-2 gap-0.5 shrink-0">
              <div className="bg-[#e21b3c] rounded-[2px]" />
              <div className="bg-[#1368ce] rounded-[2px]" />
              <div className="bg-[#d89e00] rounded-[2px]" />
              <div className="bg-[#26890c] rounded-[2px]" />
            </div>
            <span>Quiz</span>
            <span className="ml-auto text-[11px] font-semibold text-duo-hare">
              {quizzes.length}
            </span>
          </button>

          {/* Mục 2: Câu chuyện (Story) */}
          <button
            onClick={() => {
              setActiveCategory('story');
              setSelectedFolderId(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border-2 text-sm font-extrabold transition ${
              activeCategory === 'story' && selectedFolderId === null
                ? 'bg-duo-blue-light text-duo-blue border-[#7dd3fc]'
                : 'text-duo-wolf border-transparent hover:bg-duo-polar'
            }`}
          >
            <BookOpen className="w-4 h-4 text-duo-wolf shrink-0" />
            <span>Câu chuyện</span>
            <span className="ml-auto text-[11px] font-semibold text-duo-hare">
              {stories.length}
            </span>
          </button>

          {/* Mục 3: Khoá học */}
          <button
            onClick={() => {
              setActiveCategory('course');
              setSelectedFolderId(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border-2 text-sm font-extrabold transition ${
              activeCategory === 'course' && selectedFolderId === null
                ? 'bg-duo-blue-light text-duo-blue border-[#7dd3fc]'
                : 'text-duo-wolf border-transparent hover:bg-duo-polar'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-duo-wolf shrink-0" />
            <span>Khoá học</span>
            <span className="ml-auto text-[11px] font-semibold text-duo-hare">
              {courses.length}
            </span>
          </button>

          {/* Đường kẻ phân cách (Divider) */}
          <div className="pt-2 pb-1">
            <hr className="border-duo-swan" />
          </div>

          {/* Mục: Thư mục của bạn (Có nút + tạo folder theo yêu cầu) */}
          <div>
            <div className="flex items-center justify-between px-3 py-2 rounded-2xl text-sm font-extrabold text-duo-wolf hover:bg-duo-polar transition group">
              <div
                onClick={() => {
                  setActiveCategory('folders');
                  setSelectedFolderId(null);
                }}
                className="flex items-center gap-2.5 flex-1 cursor-pointer"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFoldersExpanded(!isFoldersExpanded);
                  }}
                  className="text-duo-hare hover:text-duo-wolf"
                >
                  {isFoldersExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
                <Folder className="w-4 h-4 text-duo-wolf" />
                <span className="truncate">Thư mục của bạn</span>
              </div>

              {/* Nút + tạo thư mục ngay trên dòng menu */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCreateFolderOpen(true);
                }}
                className="w-5 h-5 rounded hover:bg-duo-swan text-duo-wolf hover:text-duo-ink flex items-center justify-center transition"
                title="Tạo thư mục mới"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>

            {/* Danh sách các thư mục con đã tạo */}
            {isFoldersExpanded && (
              <div className="pl-6 pr-1 space-y-0.5 mt-1">
                {folders.map((folder) => {
                  const isSelected = activeCategory === 'folders' && selectedFolderId === folder.id;
                  const count =
                    quizzes.filter((q) => q.folderId === folder.id).length +
                    stories.filter((s) => s.folderId === folder.id).length;

                  return (
                    <button
                      key={folder.id}
                      onClick={() => {
                        setActiveCategory('folders');
                        setSelectedFolderId(folder.id);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition text-left group ${
                        isSelected
                          ? 'bg-duo-blue-light text-duo-blue font-bold'
                          : 'text-duo-wolf hover:bg-duo-polar'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: folder.color }}
                        />
                        <span className="truncate text-[11px]">{folder.name}</span>
                      </div>
                      <span className="text-[10px] text-duo-hare font-semibold">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Đường kẻ phân cách */}
          <div className="pt-2 pb-1">
            <hr className="border-duo-swan" />
          </div>

          {/* Mục: Thùng rác */}
          <button
            onClick={() => {
              setActiveCategory('trash');
              setSelectedFolderId(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border-2 text-sm font-extrabold transition ${
              activeCategory === 'trash'
                ? 'bg-duo-red-light text-duo-red-dark border-duo-red/40'
                : 'text-duo-wolf border-transparent hover:bg-duo-polar'
            }`}
          >
            <Trash2 className="w-4 h-4 text-duo-wolf shrink-0" />
            <span>Thùng rác</span>
            {trashedItems.length > 0 && (
              <span className="ml-auto chip bg-duo-red text-white">
                {trashedItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Nút hỗ trợ nhanh bên dưới sub-sidebar */}
        <div className="p-3 border-t-2 border-duo-swan">
          <div className="bg-duo-purple-light rounded-2xl p-3 text-center">
            <span className="text-xs font-black text-duo-purple-dark block mb-2">
              Soạn đề tự động?
            </span>
            <button
              onClick={onOpenAiQuizModal}
              className="w-full btn-3d btn-purple btn-sm"
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>Dùng AI tạo đề</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. Vùng hiển thị nội dung chính bên phải */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-white">
        {/* ======================================================== */}
        {/* VIEW A: Quiz (Khớp chuẩn Ảnh 1) */}
        {/* ======================================================== */}
        {activeCategory === 'quiz' && (
          <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
            {/* Thanh Tab: Gần đây, Bản nháp, Yêu thích + Công tắc Grid/List */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-duo-swan pb-3">
              <div className="flex items-center gap-1 bg-duo-polar border-2 border-duo-swan p-1 rounded-2xl">
                <button
                  onClick={() => setQuizTab('recent')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                    quizTab === 'recent'
                      ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]'
                      : 'text-duo-hare hover:text-duo-wolf'
                  }`}
                >
                  Gần đây
                </button>
                <button
                  onClick={() => setQuizTab('draft')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                    quizTab === 'draft'
                      ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]'
                      : 'text-duo-hare hover:text-duo-wolf'
                  }`}
                >
                  Bản nháp
                </button>
                <button
                  onClick={() => setQuizTab('favorite')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                    quizTab === 'favorite'
                      ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]'
                      : 'text-duo-hare hover:text-duo-wolf'
                  }`}
                >
                  Yêu thích
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-duo-hare" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm bài quiz..."
                    className="input-duo w-full pl-9 pr-3"
                  />
                </div>

                {/* View toggle Grid / List */}
                <div className="flex items-center border-2 border-duo-swan rounded-xl p-0.5 bg-duo-polar">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === 'grid' ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]' : 'text-duo-hare hover:text-duo-wolf'
                    }`}
                    title="Chế độ lưới"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === 'list' ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]' : 'text-duo-hare hover:text-duo-wolf'
                    }`}
                    title="Chế độ danh sách"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Danh sách Quiz Cards (Khớp ảnh 1) */}
            {filteredQuizzes.length === 0 ? (
              <div className="text-center py-16 bg-duo-polar border-2 border-dashed border-duo-swan rounded-2xl">
                <FileQuestion className="w-12 h-12 text-duo-hare mx-auto mb-3" />
                <h4 className="font-bold text-sm text-[#4b4b4b]">Chưa tìm thấy bài quiz nào</h4>
                <p className="text-xs text-duo-hare mt-1 mb-4">
                  Bấm nút "Tạo" hoặc "Tạo câu hỏi AI" để bắt đầu soạn đề.
                </p>
                <button
                  onClick={() => {
                    setEditingQuiz(null);
                    setIsQuizCreatorOpen(true);
                  }}
                  className="btn-3d btn-blue"
                >
                  Tạo bài Quiz mới
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {filteredQuizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="card-pressable !cursor-default overflow-visible flex flex-col group relative"
                  >
                    {/* Thumbnail Image Container */}
                    <div className="relative aspect-video w-full bg-duo-polar overflow-hidden rounded-t-[18px]">
                      <img
                        src={quiz.thumbnail}
                        alt={quiz.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />

                      {/* Header badge inside image */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        {quiz.status === 'draft' ? (
                          <span className="chip bg-duo-red text-white uppercase">
                            Bản nháp
                          </span>
                        ) : (
                          <span className="chip bg-duo-green text-white uppercase">
                            Sẵn sàng
                          </span>
                        )}
                      </div>

                      {/* Question count pill on bottom-right of image */}
                      <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                        {quiz.questionCount} câu hỏi
                      </span>
                    </div>

                    {/* Card Content */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Folder tag if assigned */}
                        {quiz.folderId && (
                          <span className="chip bg-duo-purple-light text-duo-purple-dark mb-1.5 max-w-full">
                            <Folder className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{folders.find((f) => f.id === quiz.folderId)?.name}</span>
                          </span>
                        )}

                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-black text-sm text-duo-ink line-clamp-2 leading-snug group-hover:text-duo-blue transition">
                            {quiz.title}
                          </h4>

                          {/* 3 dots menu button */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === quiz.id ? null : quiz.id);
                              }}
                              className="p-1 rounded-md text-duo-hare hover:text-duo-ink hover:bg-duo-polar transition"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Menu */}
                            {activeMenuId === quiz.id && (
                              <div className="absolute right-0 mt-1 w-52 bg-white border-2 border-duo-swan rounded-2xl shadow-[0_4px_0_#e7d9bc] p-1.5 z-30 text-sm animate-pop-in">
                                <button
                                  onClick={() => {
                                    onLaunchLesson(quiz.title);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left text-duo-ink hover:bg-duo-polar flex items-center gap-2 font-bold"
                                >
                                  <Play className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Bắt đầu bài giảng</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingQuiz(quiz);
                                    setIsQuizCreatorOpen(true);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left text-duo-ink hover:bg-duo-polar flex items-center gap-2 font-bold"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-duo-blue" />
                                  <span>Chỉnh sửa câu hỏi</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setMovingItem({
                                      id: quiz.id,
                                      title: quiz.title,
                                      type: 'quiz',
                                      folderId: quiz.folderId,
                                    });
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left text-duo-ink hover:bg-duo-polar flex items-center gap-2 font-bold"
                                >
                                  <Folder className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Chuyển vào thư mục</span>
                                </button>
                                <button
                                  onClick={() => handleTrashItem(quiz.id, quiz.title, 'quiz')}
                                  className="w-full px-3 py-2 rounded-xl text-left text-duo-red-dark hover:bg-duo-red-light flex items-center gap-2 font-bold"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Chuyển vào thùng rác</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Author & Launch Button */}
                      <div className="pt-3 border-t-2 border-duo-swan mt-2 flex items-center justify-between text-[11px] text-duo-wolf">
                        <span className="truncate max-w-[120px]">{quiz.author}</span>
                        <button
                          onClick={() => onLaunchLesson(quiz.title)}
                          className="btn-3d btn-green btn-sm"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Bắt đầu</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* List View */
              <div className="divide-y divide-duo-swan border-2 border-duo-swan rounded-2xl overflow-hidden bg-white">
                {filteredQuizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="p-3.5 flex items-center justify-between gap-4 hover:bg-duo-polar transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={quiz.thumbnail}
                        alt={quiz.title}
                        className="w-16 h-11 rounded-lg object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {quiz.status === 'draft' && (
                            <span className="bg-[#e21b3c] text-white text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                              Bản nháp
                            </span>
                          )}
                          <h4 className="font-extrabold text-xs text-duo-ink truncate">
                            {quiz.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-duo-hare">
                          <span>{quiz.questionCount} câu hỏi</span>
                          <span>•</span>
                          <span>{quiz.author}</span>
                          <span>•</span>
                          <span>{quiz.updatedAt}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onLaunchLesson(quiz.title)}
                        className="btn-3d btn-green btn-sm"
                      >
                        <Play className="w-3 h-3 fill-white" /> Bắt đầu
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW B: Câu chuyện (Story - Khớp chuẩn Ảnh 2) */}
        {/* ======================================================== */}
        {activeCategory === 'story' && (
          <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
            {/* Header row: Tìm kiếm (trái) và Sắp xếp theo [ Cũ nhất / Mới nhất ] + Grid/List (phải) */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Search bar matching Image 2 */}
              <div className="relative w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-duo-hare" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm"
                  className="input-duo w-full pl-9 pr-3"
                />
              </div>

              {/* Right side controls matching Image 2 */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-duo-wolf font-medium">
                  <span>Sắp xếp theo:</span>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                    className="input-duo !w-auto !py-2"
                  >
                    <option value="oldest">Cũ nhất</option>
                    <option value="newest">Mới nhất</option>
                  </select>
                </div>

                {/* View toggle */}
                <div className="flex items-center border-2 border-duo-swan rounded-xl p-0.5 bg-duo-polar">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === 'grid' ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]' : 'text-duo-hare'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition ${
                      viewMode === 'list' ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]' : 'text-duo-hare'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Grid of Story Cards (Khớp ảnh 2) */}
            {filteredStories.length === 0 ? (
              <div className="text-center py-16 bg-duo-polar border-2 border-dashed border-duo-swan rounded-2xl">
                <BookOpen className="w-12 h-12 text-duo-hare mx-auto mb-3" />
                <h4 className="font-bold text-sm text-[#4b4b4b]">Chưa có câu chuyện nào</h4>
                <p className="text-xs text-duo-hare mt-1 mb-4">
                  Bấm nút "Tạo câu chuyện" để thêm tích truyện lịch sử hào hùng.
                </p>
                <button
                  onClick={() => {
                    setEditingStory(null);
                    setIsStoryCreatorOpen(true);
                  }}
                  className="btn-3d btn-blue"
                >
                  Tạo câu chuyện mới
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {filteredStories.map((story) => (
                  <div
                    key={story.id}
                    onClick={() => setReadingStory(story)}
                    className="card-pressable overflow-visible flex flex-col group relative"
                  >
                    {/* Header nhỏ trên đầu card (Khớp ảnh 2: icon + "Câu chuyện") */}
                    <div className="px-3 py-1.5 bg-duo-purple-light rounded-t-[18px] flex items-center gap-1.5 text-[11px] text-duo-purple-dark font-black uppercase tracking-wider">
                      <BookOpen className="w-3.5 h-3.5 text-kh-purple" />
                      <span>Câu chuyện</span>
                    </div>

                    {/* Thumbnail Image */}
                    <div className="relative aspect-video w-full bg-duo-polar overflow-hidden">
                      <img
                        src={story.thumbnail}
                        alt={story.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />

                      {/* Badge: Bản nháp (Đỏ như ảnh 2) */}
                      {story.status === 'draft' && (
                        <span className="absolute top-2 left-2 chip bg-duo-red text-white uppercase">
                          Bản nháp
                        </span>
                      )}

                      {/* Badge: 1 phút đọc (Viên thuốc đen góc dưới phải như ảnh 2) */}
                      <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                        {story.readingTime}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Folder tag if assigned */}
                        {story.folderId && (
                          <span className="chip bg-duo-purple-light text-duo-purple-dark mb-1.5 max-w-full">
                            <Folder className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{folders.find((f) => f.id === story.folderId)?.name}</span>
                          </span>
                        )}

                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-black text-sm text-duo-ink line-clamp-2 leading-snug group-hover:text-kh-purple transition">
                            {story.title}
                          </h4>

                          {/* 3 dots menu button */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === story.id ? null : story.id);
                              }}
                              className="p-1 rounded-md text-duo-hare hover:text-duo-ink hover:bg-duo-polar transition"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Menu */}
                            {activeMenuId === story.id && (
                              <div className="absolute right-0 mt-1 w-52 bg-white border-2 border-duo-swan rounded-2xl shadow-[0_4px_0_#e7d9bc] p-1.5 z-30 text-sm animate-pop-in">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReadingStory(story);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left text-duo-ink hover:bg-duo-polar flex items-center gap-2 font-bold"
                                >
                                  <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Đọc câu chuyện</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingStory(story);
                                    setIsStoryCreatorOpen(true);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left text-duo-ink hover:bg-duo-polar flex items-center gap-2 font-bold"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Chỉnh sửa nội dung</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMovingItem({
                                      id: story.id,
                                      title: story.title,
                                      type: 'story',
                                      folderId: story.folderId,
                                    });
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left text-duo-ink hover:bg-duo-polar flex items-center gap-2 font-bold"
                                >
                                  <Folder className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Chuyển vào thư mục</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTrashItem(story.id, story.title, 'story');
                                  }}
                                  className="w-full px-3 py-2 rounded-xl text-left text-duo-red-dark hover:bg-duo-red-light flex items-center gap-2 font-bold"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Chuyển vào thùng rác</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Author */}
                      <div className="pt-2.5 border-t-2 border-duo-swan mt-2 text-[11px] text-duo-hare flex items-center justify-between">
                        <span className="truncate">{story.author}</span>
                        <span className="text-purple-600 font-bold group-hover:underline">
                          Đọc ngay →
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW C: Khoá học (Course) */}
        {/* ======================================================== */}
        {activeCategory === 'course' && (
          <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
            <div className="flex items-center justify-between border-b-2 border-duo-swan pb-4">
              <div>
                <h2 className="text-2xl font-black text-duo-ink">Khoá học Lịch sử</h2>
                <p className="text-xs text-duo-wolf">
                  Chuỗi bài học dài kết hợp video, tài liệu và sa bàn chiến dịch
                </p>
              </div>
              <button
                onClick={() => onShowToast('🎓 Tính năng tạo khoá học chuyên sâu đã sẵn sàng.')}
                className="btn-3d btn-blue"
              >
                + Tạo khoá học mới
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {courses.map((c) => (
                <div
                  key={c.id}
                  className="card-pressable !cursor-default p-5 flex gap-4"
                >
                  <img
                    src={c.thumbnail}
                    alt={c.title}
                    className="w-28 h-28 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <span className="chip bg-duo-blue-light text-duo-blue-dark mb-1">
                        Chuyên đề lớp 7
                      </span>
                      <h4 className="font-extrabold text-sm text-duo-ink leading-snug">
                        {c.title}
                      </h4>
                      <p className="text-xs text-duo-wolf mt-1 line-clamp-2">
                        {c.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-duo-hare pt-2 border-t-2 border-duo-swan">
                      <span>{c.chapterCount} chương • {c.duration}</span>
                      <button
                        onClick={() => onLaunchLesson(c.title)}
                        className="text-duo-blue font-bold hover:underline"
                      >
                        Vào học →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW D: Thư mục của bạn / Chi tiết Thư mục (Khớp Ảnh 3) */}
        {/* ======================================================== */}
        {activeCategory === 'folders' && (
          <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
            {/* Header: Tiêu đề Thư mục + Nút "+ Mới" (Xanh dương như ảnh 3) */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-duo-ink tracking-tight">
                  {currentFolder ? currentFolder.name : 'Thư mục của tôi'}
                </h2>
                {currentFolder && currentFolder.description && (
                  <p className="text-xs text-duo-wolf mt-0.5">{currentFolder.description}</p>
                )}
              </div>

              {/* Nút + Mới (Màu xanh dương chuẩn ảnh 3) */}
              <div className="relative">
                <button
                  onClick={() => {
                    if (selectedFolderId) {
                      // Nếu đang ở trong một thư mục, cho phép chọn tạo Quiz hoặc Story
                      setIsCreateQuizOpen(true);
                    } else {
                      setIsCreateFolderOpen(true);
                    }
                  }}
                  className="btn-3d btn-green"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Mới</span>
                </button>
              </div>
            </div>

            {/* Hàng bộ lọc: [ Tất cả các loại ▾ ] [ Gần đây nhất ▾ ] và Grid/List (Chuẩn ảnh 3) */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <select
                  value={folderTypeFilter}
                  onChange={(e) => setFolderTypeFilter(e.target.value as any)}
                  className="input-duo !w-auto !py-2"
                >
                  <option value="all">Tất cả các loại</option>
                  <option value="quiz">Chỉ Quiz</option>
                  <option value="story">Chỉ Câu chuyện</option>
                </select>

                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="input-duo !w-auto !py-2"
                >
                  <option value="newest">Gần đây nhất</option>
                  <option value="oldest">Cũ nhất</option>
                </select>
              </div>

              {/* View toggle */}
              <div className="flex items-center border-2 border-duo-swan rounded-xl p-0.5 bg-duo-polar">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === 'grid' ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]' : 'text-duo-hare'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === 'list' ? 'bg-white text-duo-blue shadow-[0_2px_0_#e7d9bc]' : 'text-duo-hare'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Trường hợp: Đang ở thư mục gốc (Root folders overview) */}
            {selectedFolderId === null ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {folders.map((folder) => {
                    const qCount = quizzes.filter((q) => q.folderId === folder.id).length;
                    const sCount = stories.filter((s) => s.folderId === folder.id).length;

                    return (
                      <div
                        key={folder.id}
                        onClick={() => setSelectedFolderId(folder.id)}
                        className="card-pressable p-5 flex flex-col justify-between h-40 group"
                      >
                        <div className="flex items-start justify-between">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                            style={{ backgroundColor: folder.color }}
                          >
                            <Folder className="w-5 h-5" />
                          </div>
                          <span className="text-[11px] font-bold text-duo-hare">
                            {qCount + sCount} bài
                          </span>
                        </div>

                        <div>
                          <h4 className="font-extrabold text-sm text-duo-ink group-hover:text-[#115e59] transition line-clamp-1">
                            {folder.name}
                          </h4>
                          <p className="text-xs text-duo-hare mt-0.5 line-clamp-1">
                            {folder.description || 'Không có mô tả'}
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-duo-wolf pt-2 border-t-2 border-duo-swan">
                          <span>{qCount} Quiz • {sCount} Câu chuyện</span>
                          <span className="text-duo-blue font-bold group-hover:translate-x-0.5 transition flex items-center">
                            Mở <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Trường hợp: Đang mở một Thư mục cụ thể */
              <div>
                {/* Thanh điều hướng quay lại danh sách thư mục */}
                <button
                  onClick={() => setSelectedFolderId(null)}
                  className="text-xs font-bold text-duo-blue hover:underline flex items-center gap-1 mb-4"
                >
                  ← Quay lại tất cả thư mục
                </button>

                {folderTotalItems === 0 ? (
                  /* ======================================================== */
                  /* Empty state minh hoạ chuẩn theo Ảnh 3 */
                  /* ======================================================== */
                  <div className="border-2 border-dashed border-duo-swan rounded-2xl p-16 flex flex-col items-center justify-center text-center bg-duo-polar min-h-[360px]">
                    {/* SVG Minh hoạ các thẻ xếp lớp có dấu hỏi chấm (?, ?, ?) như ảnh 3 */}
                    <div className="relative w-48 h-28 mb-6 flex items-center justify-center">
                      {/* Thẻ nền 1 */}
                      <div className="absolute top-2 -left-2 w-28 h-16 bg-white border-2 border-duo-swan rounded-xl rotate-[-6deg]" />
                      {/* Thẻ nền 2 */}
                      <div className="absolute top-4 right-0 w-32 h-18 bg-white border-2 border-duo-swan rounded-xl rotate-[4deg]" />
                      {/* Thẻ trung tâm */}
                      <div className="relative w-36 h-20 bg-white border-2 border-duo-swan rounded-xl flex flex-col justify-center p-3 gap-1.5 z-10">
                        <div className="w-12 h-2 bg-slate-200 rounded" />
                        <div className="w-20 h-2 bg-slate-100 rounded" />
                      </div>

                      {/* Các bong bóng dấu hỏi chấm tròn (?, ?, ?) */}
                      <div className="absolute -top-1 left-6 w-6 h-6 rounded-full bg-[#e21b3c] text-white text-[11px] font-black flex items-center justify-center z-20">
                        ?
                      </div>
                      <div className="absolute -top-3 right-16 w-5 h-5 rounded-full bg-[#1368ce] text-white text-[10px] font-black flex items-center justify-center z-20">
                        ?
                      </div>
                      <div className="absolute -bottom-2 right-8 w-6 h-6 rounded-full bg-[#26890c] text-white text-[11px] font-black flex items-center justify-center z-20">
                        ?
                      </div>
                      <div className="absolute bottom-2 left-10 w-5 h-5 rounded-full bg-[#d89e00] text-white text-[10px] font-black flex items-center justify-center z-20">
                        ?
                      </div>
                    </div>

                    {/* Dòng text thông báo chuẩn ảnh 3 */}
                    <p className="text-xs text-duo-wolf max-w-sm leading-relaxed mb-4">
                      Có vẻ như chưa có nội dung nào tại đây.
                      <br />
                      Hãy tạo bài quiz hoặc câu chuyện đầu tiên để bắt đầu nhé.
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingQuiz(null);
                          setIsQuizCreatorOpen(true);
                        }}
                        className="btn-3d btn-blue"
                      >
                        + Tạo Quiz vào thư mục
                      </button>
                      <button
                        onClick={() => {
                          setEditingStory(null);
                          setIsStoryCreatorOpen(true);
                        }}
                        className="btn-3d btn-purple"
                      >
                        + Tạo Câu chuyện
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Hiển thị các bài Quiz và Câu chuyện trong thư mục */
                  <div className="space-y-6">
                    {/* Danh sách Quiz trong thư mục */}
                    {(folderTypeFilter === 'all' || folderTypeFilter === 'quiz') &&
                      folderQuizzes.length > 0 && (
                        <div>
                          <h4 className="font-extrabold text-xs text-duo-ink mb-3 flex items-center gap-1.5">
                            <span>Quiz trắc nghiệm ({folderQuizzes.length})</span>
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {folderQuizzes.map((quiz) => (
                              <div
                                key={quiz.id}
                                className="bg-white border-2 border-duo-swan rounded-xl overflow-hidden hover:shadow-md transition"
                              >
                                <img
                                  src={quiz.thumbnail}
                                  alt={quiz.title}
                                  className="w-full aspect-video object-cover"
                                />
                                <div className="p-3">
                                  <h5 className="font-extrabold text-xs text-duo-ink line-clamp-1">
                                    {quiz.title}
                                  </h5>
                                  <div className="flex items-center justify-between text-[11px] text-duo-wolf mt-2 pt-2 border-t-2 border-duo-swan">
                                    <span>{quiz.questionCount} câu hỏi</span>
                                    <button
                                      onClick={() => onLaunchLesson(quiz.title)}
                                      className="text-duo-blue font-bold hover:underline"
                                    >
                                      Bắt đầu →
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Danh sách Câu chuyện trong thư mục */}
                    {(folderTypeFilter === 'all' || folderTypeFilter === 'story') &&
                      folderStories.length > 0 && (
                        <div>
                          <h4 className="font-extrabold text-xs text-duo-ink mb-3 flex items-center gap-1.5">
                            <span>Câu chuyện lịch sử ({folderStories.length})</span>
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {folderStories.map((story) => (
                              <div
                                key={story.id}
                                onClick={() => setReadingStory(story)}
                                className="bg-white border-2 border-duo-swan rounded-xl overflow-hidden hover:shadow-md transition cursor-pointer"
                              >
                                <div className="relative aspect-video">
                                  <img
                                    src={story.thumbnail}
                                    alt={story.title}
                                    className="w-full h-full object-cover"
                                  />
                                  <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                    {story.readingTime}
                                  </span>
                                </div>
                                <div className="p-3">
                                  <h5 className="font-extrabold text-xs text-duo-ink line-clamp-1">
                                    {story.title}
                                  </h5>
                                  <div className="flex items-center justify-between text-[11px] text-duo-wolf mt-2 pt-2 border-t-2 border-duo-swan">
                                    <span>{story.author}</span>
                                    <span className="text-kh-purple font-bold">Đọc ngay →</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW E: Thùng rác (Trash) */}
        {/* ======================================================== */}
        {activeCategory === 'trash' && (
          <div className="p-8 max-w-4xl w-full mx-auto space-y-6">
            <div className="flex items-center justify-between border-b-2 border-duo-swan pb-3">
              <div>
                <h2 className="text-base font-extrabold text-duo-ink">Thùng rác</h2>
                <p className="text-xs text-duo-wolf">
                  Các mục đã xoá có thể được khôi phục lại bất kỳ lúc nào
                </p>
              </div>
              {trashedItems.length > 0 && (
                <button
                  onClick={() => {
                    setTrashedItems([]);
                    onShowToast('🧹 Đã dọn sạch thùng rác vĩnh viễn.');
                  }}
                  className="btn-3d btn-red btn-sm"
                >
                  Dọn sạch thùng rác
                </button>
              )}
            </div>

            {trashedItems.length === 0 ? (
              <div className="text-center py-16 bg-duo-polar border-2 border-dashed border-duo-swan rounded-2xl">
                <Trash2 className="w-12 h-12 text-duo-hare mx-auto mb-2" />
                <p className="text-xs text-duo-wolf">Thùng rác đang trống.</p>
              </div>
            ) : (
              <div className="divide-y divide-duo-swan border-2 border-duo-swan rounded-2xl overflow-hidden bg-white">
                {trashedItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 flex items-center justify-between gap-4 hover:bg-duo-polar transition"
                  >
                    <div>
                      <span className="text-[10px] uppercase font-bold text-duo-hare block mb-0.5">
                        {item.type === 'quiz' ? 'Quiz trắc nghiệm' : 'Câu chuyện'}
                      </span>
                      <h4 className="font-bold text-xs text-duo-ink">{item.title}</h4>
                    </div>
                    <button
                      onClick={() => handleRestoreItem(item)}
                      className="btn-3d btn-outline btn-sm"
                    >
                      Khôi phục
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 3. Các Dialog / Modal Tương Tác */}
      {/* ======================================================== */}
      {/* Modal Tạo thư mục */}
      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onSaveFolder={handleSaveFolder}
      />

      {/* Modal Tạo câu chuyện */}
      <CreateStoryModal
        isOpen={isCreateStoryOpen}
        onClose={() => setIsCreateStoryOpen(false)}
        folders={folders}
        defaultFolderId={selectedFolderId}
        onSaveStory={handleSaveStory}
      />

      {/* Modal Tạo bài Quiz */}
      <CreateQuizModal
        isOpen={isCreateQuizOpen}
        onClose={() => setIsCreateQuizOpen(false)}
        folders={folders}
        defaultFolderId={selectedFolderId}
        onSaveQuiz={handleSaveQuiz}
        onOpenAiGenerator={onOpenAiQuizModal}
      />

      {/* Modal Đọc câu chuyện lịch sử */}
      <StoryReaderModal story={readingStory} onClose={() => setReadingStory(null)} />

      {/* Modal Chuyển bài vào thư mục */}
      <MoveToFolderModal
        isOpen={movingItem !== null}
        onClose={() => setMovingItem(null)}
        itemTitle={movingItem?.title || ''}
        itemType={movingItem?.type || 'quiz'}
        folders={folders}
        currentFolderId={movingItem?.folderId}
        onMoveToFolder={handleMoveItem}
      />
    </div>
  );
};
