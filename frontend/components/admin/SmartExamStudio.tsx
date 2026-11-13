/**
 * SmartExamStudio — Trình Số hóa Đề thi Word (.docx) & Biên tập Quiz Tối giản (Chuẩn giao diện 2048.vn)
 * - Màn hình Upload tối giản: Kéo thả hoặc chọn bất kỳ file .docx / .pdf / .xlsx / .txt nào để tự động bóc tách câu hỏi, tiêu đề nhóm và bảng đáp án.
 * - Màn hình Biên tập Đề thi (Canvas Editor): Thiết kế nền trắng tinh gọn chuẩn 2048.vn:
 *   + Cột trái chỉ gồm 2 hộp: "Nhập từ" (Biểu mẫu Google, Bảng tính, File Word/PDF) & "Cập nhật hàng loạt" (Thời gian, Điểm).
 *   + Danh sách câu hỏi phân theo "Tiêu đề nhóm", có nút nắm kéo [:::] để kéo thả đổi thứ tự câu hỏi (hiện viền nét đứt màu tím).
 *   + Modal "✨ Lựa chọn dạng câu hỏi" với đầy đủ 9 dạng câu hỏi chuẩn.
 *   + Màn hình Xem trước (Icon con mắt 👁) dạng slide nền tím đậm (#3B1D4A) với 4 thẻ đáp án viền màu.
 *   + Màn hình Chỉnh sửa chi tiết (✏ Chỉnh sửa) nền tím sẫm kiểu Quizizz với 4 cột đáp án màu trực quan.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import {
  AlignLeft,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Copy,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  FileUp,
  FolderPlus,
  GripHorizontal,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  ListChecks,
  ListFilter,
  MinusSquare,
  Move,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  X,
  XCircle,
} from 'lucide-react-native';
import * as learningApi from '@/api/learningApi';
import { errorMessage } from '@/api/client';
import type { Session } from '@/components/auth';
import { Btn, Card, Chip, Field, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { SYSTEM_EXAM_BANK_FOLDER_ID, upsertTeacherLibraryExam } from '@/lib/teacher-library';
import {
  buildPrintableWordHtml,
  createBlankQuestion,
  generateMixedExamVariants,
  mergeExamQuestions,
  parseDocxBufferToExam,
  parseExamDocumentText,
  parsePdfBufferToExam,
  parseXlsxBufferToExam,
  recomputeExamStats,
  type ExamQuestionType,
  type MixedExamVariant,
  type ParsedExamQuestion,
} from '@/utils/docxQuizParser';

export type SmartStudioMode = 'upload' | 'editor' | 'mix' | 'flashcards' | 'preview';

export interface SmartExamStudioInitialExam {
  id?: string;
  title?: string;
  durationMinutes?: number;
  questions?: ParsedExamQuestion[];
  folderId?: string;
  published?: boolean;
  sourceFileName?: string;
}

export interface SmartExamStudioProps {
  session: Session;
  initialMode?: SmartStudioMode;
  initialExam?: SmartExamStudioInitialExam;
  authorName?: string;
  onClose?: () => void;
  onSavedQuiz?: (quizId: number) => void;
  onPublishedToLibrary?: (examId: string, published: boolean) => void;
  onOpenKahootStudio?: (quizId?: number) => void;
  studentMode?: boolean;
}

const QUESTION_TYPE_CATALOG: Array<{
  type: ExamQuestionType;
  label: string;
  popular?: boolean;
  icon: typeof CheckCircle2;
  iconBg: string;
  iconColor: string;
}> = [
  { type: 'mcq', label: 'Trắc nghiệm', popular: true, icon: CheckCircle2, iconBg: '#EDE9FE', iconColor: '#7C3AED' },
  { type: 'truefalse_4', label: 'Đúng sai', icon: ListChecks, iconBg: '#DBEAFE', iconColor: '#2563EB' },
  { type: 'short_answer', label: 'Trả lời ngắn', icon: Edit3, iconBg: '#D1FAE5', iconColor: '#059669' },
  { type: 'essay', label: 'Tự luận', icon: Edit3, iconBg: '#E0F2FE', iconColor: '#0284C7' },
  { type: 'blank', label: 'Điền vào chỗ trống', icon: MinusSquare, iconBg: '#FFEDD5', iconColor: '#EA580C' },
  { type: 'drag_drop', label: 'Kéo và thả', icon: Move, iconBg: '#FEF3C7', iconColor: '#D97706' },
  { type: 'dropdown', label: 'Danh sách thả xuống', icon: ListFilter, iconBg: '#FCE7F3', iconColor: '#DB2777' },
  { type: 'paragraph', label: 'Đoạn văn', icon: AlignLeft, iconBg: '#E0E7FF', iconColor: '#4F46E5' },
  { type: 'title_group', label: 'Tiêu đề nhóm', icon: FolderPlus, iconBg: '#F3E8FF', iconColor: '#9333EA' },
];

const QTYPE_LABEL_MAP: Record<ExamQuestionType, string> = {
  mcq: 'Trắc nghiệm',
  truefalse_4: 'Đúng sai',
  short_answer: 'Trả lời ngắn',
  essay: 'Tự luận',
  blank: 'Điền vào chỗ trống',
  drag_drop: 'Kéo và thả',
  dropdown: 'Danh sách thả xuống',
  paragraph: 'Đoạn văn',
  title_group: 'Tiêu đề nhóm',
};

const POINT_OPTIONS = [0.25, 0.5, 1, 2, 5, 10];
const TIME_OPTIONS = [
  { label: 'Không giới hạn', value: 0 },
  { label: '15 giây', value: 15 },
  { label: '30 giây', value: 30 },
  { label: '45 giây', value: 45 },
  { label: '60 giây', value: 60 },
  { label: '120 giây', value: 120 },
];

const OPTION_CARD_COLORS = [
  { bg: '#2563EB', border: '#3B82F6', lightBg: '#EFF6FF' }, // Blue
  { bg: '#0891B2', border: '#06B6D4', lightBg: '#ECFEFF' }, // Cyan/Teal
  { bg: '#D97706', border: '#F59E0B', lightBg: '#FFFBEB' }, // Amber
  { bg: '#E11D48', border: '#F43F5E', lightBg: '#FFF1F2' }, // Rose/Coral
  { bg: '#7C3AED', border: '#8B5CF6', lightBg: '#F5F3FF' }, // Purple (for 5th option)
];

export const SmartExamStudio: React.FC<SmartExamStudioProps> = ({
  session,
  initialMode = 'upload',
  initialExam,
  authorName,
  onClose,
  onSavedQuiz,
  onPublishedToLibrary,
  studentMode = false,
}) => {
  const { c } = useTheme();
  const toast = useToast();
  // Thư viện học liệu (lưu cục bộ theo giáo viên) chỉ dành cho giáo viên. Quản trị trường / quản trị tổng (trang "Bộ đề")
  // giữ quy trình cũ: xuất bản thẳng lên máy chủ, báo lỗi rõ, có Thẻ ghi nhớ và Làm thử & Chấm điểm.
  const libraryMode = !studentMode && session.user.role === 'teacher';

  // Không nạp sẵn đề mẫu mặc định — chỉ nạp khi người dùng tải file lên, truyền từ Thư viện hoặc tự tạo mới
  const [libraryExamId, setLibraryExamId] = useState<string | undefined>(initialExam?.id);
  const [libraryFolderId] = useState<string>(initialExam?.folderId || SYSTEM_EXAM_BANK_FOLDER_ID);
  const [mode, setMode] = useState<SmartStudioMode>(initialMode);
  const [examTitle, setExamTitle] = useState<string>(initialExam?.title || 'Đề kiểm tra mới');
  const [durationMinutes, setDurationMinutes] = useState<number>(initialExam?.durationMinutes || 45);
  const [questions, setQuestions] = useState<ParsedExamQuestion[]>(initialExam?.questions || []);
  const [sourceFileName, setSourceFileName] = useState<string>(initialExam?.sourceFileName || '');
  const [uploading, setUploading] = useState<boolean>(false);
  const [savingToBank, setSavingToBank] = useState<boolean>(false);

  // Tìm kiếm & thu gọn nhóm trong màn hình Editor
  const [librarySearchQuery, setLibrarySearchQuery] = useState<string>('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [editingSectionName, setEditingSectionName] = useState<string | null>(null);
  const [editingSectionValue, setEditingSectionValue] = useState<string>('');

  // Kéo thả đổi thứ tự câu hỏi (Drag & Drop)
  const [draggingUid, setDraggingUid] = useState<string | null>(null);
  const [dragOverUid, setDragOverUid] = useState<string | null>(null);

  // Dropdown mở cho từng thẻ hoặc cập nhật hàng loạt
  const [bulkTimeDropdownOpen, setBulkTimeDropdownOpen] = useState<boolean>(false);
  const [bulkPointDropdownOpen, setBulkPointDropdownOpen] = useState<boolean>(false);
  const [openTypeDropdownUid, setOpenTypeDropdownUid] = useState<string | null>(null);
  const [openPointDropdownUid, setOpenPointDropdownUid] = useState<string | null>(null);
  const [openTimeDropdownUid, setOpenTimeDropdownUid] = useState<string | null>(null);

  // 3 Modals chuẩn 2048.vn trong màn hình Editor:
  // 1) Modal "✨ Lựa chọn dạng câu hỏi" (9 dạng câu hỏi)
  const [typePickerOpen, setTypePickerOpen] = useState<boolean>(false);
  const [typePickerTargetSection, setTypePickerTargetSection] = useState<string | undefined>(undefined);

  // 2) Modal "👁 Xem trước" từng câu hỏi dạng Slide nền tím đậm (#3B1D4A)
  const [slidePreviewIndex, setSlidePreviewIndex] = useState<number | null>(null);
  const [slideSelectedOption, setSlideSelectedOption] = useState<number | null>(null);
  const [slideShowCorrect, setSlideShowCorrect] = useState<boolean>(true);

  // 3) Modal "✏ Chỉnh sửa" câu hỏi chi tiết trên nền tím sẫm kiểu Quizizz
  const [editingQuestion, setEditingQuestion] = useState<ParsedExamQuestion | null>(null);
  const [editorTypeMenuOpen, setEditorTypeMenuOpen] = useState<boolean>(false);
  const [editorPointMenuOpen, setEditorPointMenuOpen] = useState<boolean>(false);
  const [editorExplanationOpen, setEditorExplanationOpen] = useState<boolean>(false);

  // Modal Cài đặt đề thi & Nhập từ Google Form / Văn bản
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [pasteModalOpen, setPasteModalOpen] = useState<boolean>(false);
  const [pasteRawText, setPasteRawText] = useState<string>('');

  // State cho Trộn đề thi (Mix Quiz 101-104)
  const [variantCount, setVariantCount] = useState<number>(4);
  const [activeVariantIdx, setActiveVariantIdx] = useState<number>(0);

  // State cho Flashcards
  const [fcIdx, setFcIdx] = useState<number>(0);
  const [fcFlipped, setFcFlipped] = useState<boolean>(false);

  // State cho Làm thử & Chấm điểm (Full Interactive Preview)
  const [userMcqAnswers, setUserMcqAnswers] = useState<Record<string, number>>({});
  const [userTfAnswers, setUserTfAnswers] = useState<Record<string, Record<number, boolean>>>({});
  const [userShortAnswers, setUserShortAnswers] = useState<Record<string, string>>({});
  const [userEssayAnswers, setUserEssayAnswers] = useState<Record<string, string>>({});
  const [submittedExam, setSubmittedExam] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  // Mặc định bật chế độ "Cộng nối tiếp câu hỏi" khi thêm tiếp file Word/PDF/Excel thứ 2 trở đi
  const [appendOnImport, setAppendOnImport] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const stats = useMemo(() => recomputeExamStats(questions), [questions]);

  const variants = useMemo<MixedExamVariant[]>(() => {
    if (questions.length === 0) return [];
    const codes = Array.from({ length: variantCount }, (_, i) => String(101 + i));
    return generateMixedExamVariants(
      {
        title: examTitle,
        subtitle: '',
        subject: 'Lịch sử & Địa lí',
        grade: '7',
        durationMinutes,
        questions,
        totalPoints: 10,
        stats,
      },
      codes,
    );
  }, [examTitle, durationMinutes, questions, variantCount, stats]);

  // Nhóm câu hỏi theo Section (Tiêu đề nhóm)
  const sectionGroups = useMemo(() => {
    const groups: Array<{ section: string; items: Array<{ question: ParsedExamQuestion; indexInAll: number }> }> = [];
    const filtered = questions
      .map((question, indexInAll) => ({ question, indexInAll }))
      .filter(({ question }) => {
        if (!librarySearchQuery.trim()) return true;
        const q = librarySearchQuery.trim().toLowerCase();
        // Nếu ô tìm kiếm trùng với tên đề thi mặc định thì hiển thị tất cả
        if (q === examTitle.trim().toLowerCase() || q === sourceFileName.replace(/\.[^.]+$/, '').toLowerCase()) {
          return true;
        }
        return (
          question.prompt.toLowerCase().includes(q) ||
          question.options.some((opt) => opt.toLowerCase().includes(q)) ||
          question.section.toLowerCase().includes(q)
        );
      });

    for (const item of filtered) {
      const secName = item.question.section || 'PHẦN I. TRẮC NGHIỆM (7,0 điểm)';
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.section === secName) {
        lastGroup.items.push(item);
      } else {
        groups.push({ section: secName, items: [item] });
      }
    }
    return groups;
  }, [questions, librarySearchQuery, examTitle, sourceFileName]);

  // ============================================================================
  // XỬ LÝ TẢI FILE .DOCX / .TXT / .CSV BẤT KỲ
  // ============================================================================
  const reindexQuestions = (list: ParsedExamQuestion[]): ParsedExamQuestion[] =>
    list.map((q, idx) => ({
      ...q,
      globalIndex: idx + 1,
      localIndex: idx + 1,
    }));

  const applyImportedQuestions = (
    incomingQuestions: ParsedExamQuestion[],
    cleanTitle: string,
    fileNameLabel: string,
    durationMins: number,
  ) => {
    const shouldAppend = questions.length > 0 && appendOnImport;
    if (shouldAppend) {
      const merged = mergeExamQuestions(questions, incomingQuestions);
      setQuestions(merged);
      setSourceFileName(fileNameLabel);
      setLibrarySearchQuery('');
      setSubmittedExam(false);
      setMode('editor');
      toast(
        `Đã cập nhật thêm ${incomingQuestions.length} câu hỏi từ "${fileNameLabel}" (Tổng cộng: ${merged.length} câu)!`,
      );
    } else {
      setExamTitle(cleanTitle || 'Đề kiểm tra mới');
      setDurationMinutes(durationMins || 45);
      setQuestions(incomingQuestions);
      setSourceFileName(fileNameLabel);
      setLibrarySearchQuery('');
      setSubmittedExam(false);
      setMode('editor');
      toast(`Đã đọc tự động ${incomingQuestions.length} câu hỏi từ "${fileNameLabel}"!`);
    }
  };

  const handleLoadFromRawText = (raw: string, fileNameLabel: string) => {
    const cleanTitle = fileNameLabel.replace(/\.(docx|doc|pdf|xlsx|csv|txt)$/i, '');
    const parsed = parseExamDocumentText(raw, cleanTitle);
    applyImportedQuestions(parsed.questions, cleanTitle || parsed.title, fileNameLabel, parsed.durationMinutes);
  };

  const handleWebFileSelected = async (file: File) => {
    setUploading(true);
    try {
      const name = file.name || 'De-kiem-tra.docx';
      const lower = name.toLowerCase();
      const cleanTitle = name.replace(/\.(docx|doc|pdf|xlsx|csv|txt)$/i, '');

      if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
        const ab = await file.arrayBuffer();
        const parsed = await parseDocxBufferToExam(ab, cleanTitle);
        if (parsed.questions.length === 0) {
          toast('Không tìm thấy câu hỏi trong file Word này.');
          return;
        }
        applyImportedQuestions(parsed.questions, cleanTitle, name, parsed.durationMinutes);
      } else if (lower.endsWith('.xlsx')) {
        const ab = await file.arrayBuffer();
        const parsed = await parseXlsxBufferToExam(ab, cleanTitle);
        if (parsed.questions.length === 0) {
          toast('Không tìm thấy câu hỏi trong file Excel này.');
          return;
        }
        applyImportedQuestions(parsed.questions, cleanTitle, name, parsed.durationMinutes);
      } else if (lower.endsWith('.pdf')) {
        const ab = await file.arrayBuffer();
        const parsed = await parsePdfBufferToExam(ab, cleanTitle);
        applyImportedQuestions(parsed.questions, cleanTitle, name, parsed.durationMinutes);
      } else {
        const text = await file.text();
        handleLoadFromRawText(text, name);
      }
    } catch (e) {
      toast(`Lỗi đọc file: ${errorMessage(e)}`);
    } finally {
      setUploading(false);
    }
  };

  const triggerFilePicker = () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    } else {
      setPasteModalOpen(true);
    }
  };

  // ============================================================================
  // THAO TÁC TRÊN CÂU HỎI & KÉO THẢ ĐỔI THỨ TỰ
  // ============================================================================
  const convertQuestionToType = (q: ParsedExamQuestion, nextType: ExamQuestionType): ParsedExamQuestion => {
    const next: ParsedExamQuestion = { ...q, qtype: nextType };
    if (nextType === 'mcq' || nextType === 'dropdown') {
      if (!next.options || next.options.length < 2) {
        if (q.tfStatements && q.tfStatements.length >= 2) {
          next.options = [...q.tfStatements.slice(0, 4)];
          while (next.options.length < 4) next.options.push(`Phương án ${String.fromCharCode(65 + next.options.length)}`);
        } else {
          next.options = ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'];
        }
      }
      if (next.correctIndex < 0 || next.correctIndex >= next.options.length) {
        next.correctIndex = 0;
      }
    } else if (nextType === 'truefalse_4') {
      if (!next.tfStatements || next.tfStatements.length < 2) {
        if (q.options && q.options.length >= 2) {
          next.tfStatements = [...q.options.slice(0, 4)];
          while (next.tfStatements.length < 4) next.tfStatements.push(`Mệnh đề ${String.fromCharCode(97 + next.tfStatements.length)}`);
        } else {
          next.tfStatements = ['Mệnh đề a', 'Mệnh đề b', 'Mệnh đề c', 'Mệnh đề d'];
        }
      }
      if (!next.tfCorrect || next.tfCorrect.length < 4) {
        next.tfCorrect = [true, false, true, false];
      }
    } else if (nextType === 'short_answer' || nextType === 'blank' || nextType === 'drag_drop') {
      if (!next.shortAnswer) {
        next.shortAnswer = q.options?.[q.correctIndex] || 'Đáp án mẫu';
      }
    }
    return next;
  };

  const handleUpdateQuestion = (uid: string, patch: Partial<ParsedExamQuestion>) => {
    setQuestions((prev) =>
      reindexQuestions(
        prev.map((q) => {
          if (q.uid !== uid) return q;
          if (patch.qtype && patch.qtype !== q.qtype) {
            return { ...convertQuestionToType(q, patch.qtype), ...patch };
          }
          return { ...q, ...patch };
        }),
      ),
    );
  };

  const handleDuplicateQuestion = (uid: string) => {
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q.uid === uid);
      if (idx < 0) return prev;
      const original = prev[idx];
      const copy: ParsedExamQuestion = {
        ...original,
        uid: `${original.uid}-copy-${Date.now()}`,
        options: [...original.options],
        tfStatements: [...original.tfStatements],
        tfCorrect: [...original.tfCorrect],
      };
      const next = [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
      return reindexQuestions(next);
    });
    toast('Đã nhân bản câu hỏi');
  };

  const handleDeleteQuestion = (uid: string) => {
    setQuestions((prev) => reindexQuestions(prev.filter((q) => q.uid !== uid)));
    toast('Đã xóa câu hỏi');
  };

  const handleMoveQuestionByStep = (uid: string, delta: -1 | 1) => {
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q.uid === uid);
      const targetIdx = idx + delta;
      if (idx < 0 || targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      return reindexQuestions(next);
    });
  };

  const handleReorderDrop = (sourceUid: string, targetUid: string) => {
    if (!sourceUid || !targetUid || sourceUid === targetUid) return;
    setQuestions((prev) => {
      const fromIdx = prev.findIndex((q) => q.uid === sourceUid);
      const toIdx = prev.findIndex((q) => q.uid === targetUid);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      // Cập nhật section của câu hỏi được kéo theo section của vị trí đích
      moved.section = prev[toIdx].section;
      next.splice(toIdx, 0, moved);
      return reindexQuestions(next);
    });
    setDraggingUid(null);
    setDragOverUid(null);
    toast('Đã cập nhật thứ tự câu hỏi');
  };

  const handleBulkUpdateTime = (seconds: number) => {
    setQuestions((prev) => prev.map((q) => ({ ...q, seconds })));
    setBulkTimeDropdownOpen(false);
    toast(`Đã cập nhật thời gian tất cả câu hỏi: ${seconds === 0 ? 'Không giới hạn' : `${seconds} giây`}`);
  };

  const handleBulkUpdatePoints = (points: number) => {
    setQuestions((prev) => prev.map((q) => ({ ...q, points })));
    setBulkPointDropdownOpen(false);
    toast(`Đã cập nhật điểm số tất cả câu hỏi: ${points} điểm`);
  };

  const handleAddQuestionByType = (qtype: ExamQuestionType, targetSection?: string) => {
    setTypePickerOpen(false);
    if (qtype === 'title_group') {
      const newSectionTitle = `PHẦN ${sectionGroups.length + 1}. TIÊU ĐỀ NHÓM MỚI`;
      const newQ = createBlankQuestion('mcq', questions.length + 1, newSectionTitle);
      setQuestions((prev) => reindexQuestions([...prev, newQ]));
      toast('Đã thêm nhóm câu hỏi mới');
      return;
    }
    const sec = targetSection || sectionGroups[sectionGroups.length - 1]?.section || 'PHẦN I. TRẮC NGHIỆM (7,0 điểm)';
    const created = createBlankQuestion(qtype, questions.length + 1, sec);
    setQuestions((prev) => reindexQuestions([...prev, created]));
    setEditingQuestion(created);
  };

  // ============================================================================
  // LƯU NHÁP HOẶC XUẤT BẢN ĐỀ THI VÀO THƯ VIỆN GIÁO VIÊN & MÁY CHỦ
  // ============================================================================
  /** Tạo câu hỏi + bộ đề trên máy chủ; trả về bộ đề (null khi không có câu nào chấm tự động được). */
  const publishToServer = async (): Promise<{ id: number; title: string; count: number } | null> => {
    const createdIds: number[] = [];
    for (const q of questions) {
      if (q.qtype === 'mcq' || q.qtype === 'dropdown') {
        const letters = ['a', 'b', 'c', 'd', 'e'];
        const options = q.options.map((optText, i) => ({
          id: letters[i] || `opt${i}`,
          text: optText,
        }));
        const correctLetter = letters[q.correctIndex >= 0 ? q.correctIndex : 0] || 'a';
        const saved = await learningApi.createQuestion(session.token, {
          qtype: 'single',
          prompt: q.prompt,
          explanation: q.explanation || 'Chấm tự động theo đáp án đề thi.',
          difficulty: 2,
          data: { options, correct: correctLetter } as never,
        });
        if (saved?.id) createdIds.push(saved.id);
      } else if (q.qtype === 'short_answer' || q.qtype === 'blank' || q.qtype === 'drag_drop') {
        const saved = await learningApi.createQuestion(session.token, {
          qtype: 'fill',
          prompt: `${q.prompt} ____`,
          explanation: q.explanation || `Đáp án chuẩn: ${q.shortAnswer}`,
          difficulty: 2,
          data: { blanks: [{ accept: [q.shortAnswer || 'Đáp án'] }] } as never,
        });
        if (saved?.id) createdIds.push(saved.id);
      }
    }
    if (createdIds.length === 0) return null;
    const quiz = await learningApi.createQuiz(session.token, {
      title: examTitle.trim() || 'Đề kiểm tra đã xuất bản',
      description: `Số hóa từ ${sourceFileName || 'Trình biên tập đề thi'} (${questions.length} câu)`,
      campaign_id: null,
      seconds_per_question: 30,
      pass_percent: 60,
      shuffle_questions: true,
      shuffle_options: true,
      items: createdIds.map((qid) => ({ question_id: qid, points: 100, seconds: 30 })),
    });
    return { id: quiz.id, title: quiz.title, count: createdIds.length };
  };

  const handleSaveQuizToSystem = async (publishNow = true) => {
    if (studentMode) {
      setMode('preview');
      return;
    }
    if (questions.length === 0) {
      toast(libraryMode ? 'Vui lòng tải file đề hoặc thêm ít nhất 1 câu hỏi trước khi lưu.' : 'Vui lòng tải file đề hoặc thêm ít nhất 1 câu hỏi trước khi xuất bản.');
      return;
    }
    setSavingToBank(true);
    if (!libraryMode) {
      // Quản trị: chỉ lưu lên máy chủ, lỗi thì báo ngay (không lưu cục bộ vào Thư viện giáo viên)
      try {
        const quiz = await publishToServer();
        if (quiz) {
          toast(`Đã xuất bản bộ đề "${quiz.title}" (${quiz.count} câu)!`);
          onSavedQuiz?.(quiz.id);
        } else {
          toast('Đã lưu thông tin đề thi!');
        }
      } catch (e) {
        toast(`Lỗi xuất bản: ${errorMessage(e)}`);
      } finally {
        setSavingToBank(false);
      }
      return;
    }
    try {
      let backendQuizId: number | undefined;
      if (publishNow) {
        try {
          const quiz = await publishToServer();
          if (quiz) {
            backendQuizId = quiz.id;
            onSavedQuiz?.(quiz.id);
          }
        } catch {
          // Vẫn lưu đầy đủ đề thi (gồm cả câu đúng sai 4 ý, tự luận...) vào Thư viện giáo viên
        }
      }

      const savedLibExam = upsertTeacherLibraryExam(session.user.id, {
        id: libraryExamId,
        backendQuizId,
        title: examTitle.trim() || 'Đề kiểm tra mới',
        folderId: libraryFolderId,
        published: publishNow,
        durationMinutes,
        questions,
        authorName: authorName || session.user.full_name || 'Giáo viên',
        sourceFileName,
      });
      setLibraryExamId(savedLibExam.id);
      toast(
        publishNow
          ? `Đã xuất bản “${savedLibExam.title}” vào Thư viện!`
          : `Đã lưu bản nháp “${savedLibExam.title}” vào Thư viện!`,
      );
      onPublishedToLibrary?.(savedLibExam.id, publishNow);
    } catch (e) {
      toast(`Lỗi lưu đề thi: ${errorMessage(e)}`);
    } finally {
      setSavingToBank(false);
    }
  };

  const handleDownloadVariantWord = (variant: MixedExamVariant) => {
    if (Platform.OS !== 'web') {
      toast('Tính năng tải file Word hỗ trợ trực tiếp trên trình duyệt Web.');
      return;
    }
    const html = buildPrintableWordHtml(
      {
        title: examTitle,
        subtitle: '',
        subject: 'Lịch sử & Địa lí',
        grade: '7',
        durationMinutes,
        questions,
        totalPoints: 10,
        stats,
      },
      [variant],
    );
    const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ma-de-${variant.code}-${examTitle.replace(/\s+/g, '-')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`Đã tải xuống Mã đề ${variant.code} (.doc) kèm Bảng đáp án!`);
  };

  // ============================================================================
  // TÍNH ĐIỂM BÀI LÀM THỬ (PREVIEW PLAYER)
  // ============================================================================
  const examScoreSummary = useMemo(() => {
    let earned = 0;
    let maxAuto = 0;
    let correctCount = 0;

    for (const q of questions) {
      if (q.qtype === 'mcq' || q.qtype === 'dropdown') {
        maxAuto += q.points;
        const picked = userMcqAnswers[q.uid];
        if (picked !== undefined && picked === q.correctIndex) {
          earned += q.points;
          correctCount++;
        }
      } else if (q.qtype === 'truefalse_4') {
        maxAuto += q.points;
        const pickedMap = userTfAnswers[q.uid] || {};
        let matchCount = 0;
        for (let i = 0; i < 4; i++) {
          if (pickedMap[i] !== undefined && pickedMap[i] === q.tfCorrect[i]) matchCount++;
        }
        const ratio = matchCount === 4 ? 1 : matchCount === 3 ? 0.5 : matchCount === 2 ? 0.25 : matchCount === 1 ? 0.1 : 0;
        earned += Number((q.points * ratio).toFixed(2));
        if (matchCount === 4) correctCount++;
      } else if (q.qtype === 'short_answer' || q.qtype === 'blank' || q.qtype === 'drag_drop') {
        maxAuto += q.points;
        const ans = (userShortAnswers[q.uid] || '').trim().toLowerCase();
        const target = (q.shortAnswer || '').trim().toLowerCase();
        if (ans && target && (ans === target || target.includes(ans))) {
          earned += q.points;
          correctCount++;
        }
      }
    }
    return {
      earned: Number(earned.toFixed(2)),
      maxAuto: Number(maxAuto.toFixed(2)),
      correctCount,
    };
  }, [questions, userMcqAnswers, userTfAnswers, userShortAnswers]);

  // ============================================================================
  // RENDER MODAL 1: "✨ LỰA CHỌN DẠNG CÂU HỎI" (9 DẠNG CHUẨN 2048.VN - ẢNH 1)
  // ============================================================================
  const renderQuestionTypePickerModal = () => {
    if (!typePickerOpen) return null;
    return (
      <View
        style={{
          position: 'fixed' as never,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          zIndex: 999,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 780,
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            padding: 28,
            gap: 22,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 24,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={22} color="#7C3AED" />
              </View>
              <View style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Txt f="bold" size={20} color="#0F172A">Lựa chọn</Txt>
                  <Txt f="bold" size={20} color="#7C3AED">dạng câu hỏi</Txt>
                </View>
                <Txt size={13} color="#64748B">
                  Chọn dạng câu hỏi phù hợp để bắt đầu tạo nội dung cho bài tập của bạn.
                </Txt>
              </View>
            </View>
            <Pressable
              onPress={() => setTypePickerOpen(false)}
              style={{ width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} color="#64748B" />
            </Pressable>
          </View>

          {/* Lưới 9 dạng câu hỏi (4 cột x 3 hàng) */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {QUESTION_TYPE_CATALOG.map((item) => {
              const IconComp = item.icon;
              return (
                <Pressable
                  key={item.type}
                  onPress={() => handleAddQuestionByType(item.type, typePickerTargetSection)}
                  testID={`pick-qtype-${item.type}`}
                  style={({ pressed }) => ({
                    width: '23%',
                    minWidth: 155,
                    flexGrow: 1,
                    minHeight: 118,
                    padding: 16,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: pressed ? '#7C3AED' : '#E2E8F0',
                    backgroundColor: pressed ? '#FAF5FF' : '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    position: 'relative',
                  })}
                >
                  {item.popular ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        backgroundColor: '#EDE9FE',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 99,
                      }}
                    >
                      <Txt f="bold" size={10} color="#7C3AED">Phổ biến</Txt>
                    </View>
                  ) : null}
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: item.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                    <IconComp size={20} color={item.iconColor} />
                  </View>
                  <Txt f="bold" size={13} color="#1E293B" center>
                    {item.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>

          {/* Footer mẹo */}
          <View style={{ alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
              <Sparkles size={13} color="#7C3AED" />
              <Txt size={12} color="#475569">
                <Txt f="bold" size={12} color="#1E293B">Mẹo:</Txt> Bạn có thể thay đổi dạng câu hỏi sau khi tạo.
              </Txt>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ============================================================================
  // RENDER MODAL 2: "👁 XEM TRƯỚC" SLIDE NỀN TÍM ĐẬM (ẢNH 4)
  // ============================================================================
  const renderSlidePreviewModal = () => {
    if (slidePreviewIndex === null || !questions[slidePreviewIndex]) return null;
    const q = questions[slidePreviewIndex];
    return (
      <View
        style={{
          position: 'fixed' as never,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#3B1D4A',
          zIndex: 1000,
          justifyContent: 'space-between',
          padding: 24,
        }}
      >
        {/* Top bar */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={15} color="#C4B5FD" />
              <Txt f="bold" size={13} color="#FFFFFF">
                Câu {slidePreviewIndex + 1}/{questions.length} · {QTYPE_LABEL_MAP[q.qtype]}
              </Txt>
            </View>
            <Pressable
              onPress={() => setSlideShowCorrect(!slideShowCorrect)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: slideShowCorrect ? '#10B981' : 'rgba(255,255,255,0.15)' }}
            >
              <Txt f="bold" size={12} color="#FFFFFF">
                {slideShowCorrect ? '✓ Đang hiện đáp án đúng' : '👁 Ẩn đáp án đúng'}
              </Txt>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable
              onPress={() => {
                setSlidePreviewIndex(null);
                setMode('preview');
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1E1B4B', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
            >
              <Play size={14} color="#FFFFFF" />
              <Txt f="bold" size={13} color="#FFFFFF">Xem toàn bộ quiz</Txt>
            </Pressable>
            <Pressable
              onPress={() => setSlidePreviewIndex(null)}
              style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Center White Question Box + 4 Colored Answer Cards (Chuẩn Ảnh 4) */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20, maxWidth: 1120, width: '100%', alignSelf: 'center', paddingVertical: 16 }}>
          {/* Khung trắng lớn hiển thị câu hỏi */}
          <View
            style={{
              width: '100%',
              minHeight: 240,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 28,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 16,
            }}
          >
            {q.imageUrl ? (
              <Image
                source={{ uri: q.imageUrl }}
                style={{ width: 320, height: 180, borderRadius: 10 }}
                resizeMode="contain"
              />
            ) : null}
            <Txt f="bold" size={20} color="#0F172A" center style={{ lineHeight: 30 }}>
              {q.prompt}
            </Txt>
          </View>

          {/* 4 thẻ đáp án nằm ngang bên dưới với 4 viền màu */}
          {q.qtype === 'mcq' || q.qtype === 'dropdown' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, width: '100%' }}>
              {q.options.map((opt, idx) => {
                const palette = OPTION_CARD_COLORS[idx % OPTION_CARD_COLORS.length];
                const isCorrect = slideShowCorrect && q.correctIndex === idx;
                const isSelected = slideSelectedOption === idx;
                return (
                  <Pressable
                    key={idx}
                    onPress={() => setSlideSelectedOption(idx)}
                    style={{
                      flex: 1,
                      minWidth: 220,
                      minHeight: 170,
                      backgroundColor: '#FFFFFF',
                      borderRadius: 14,
                      borderWidth: 3,
                      borderColor: isCorrect ? '#10B981' : palette.border,
                      padding: 18,
                      justifyContent: 'center',
                      alignItems: 'center',
                      position: 'relative',
                    }}
                  >
                    {/* Nút tròn góc phải trên */}
                    <View
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: isCorrect ? '#10B981' : isSelected ? palette.border : '#CBD5E1',
                        backgroundColor: isCorrect ? '#10B981' : isSelected ? palette.border : '#FFFFFF',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isCorrect || isSelected ? <Check size={14} color="#FFFFFF" /> : null}
                    </View>
                    <Txt f="bold" size={16} color="#0F172A" center style={{ lineHeight: 24 }}>
                      {opt}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          ) : q.qtype === 'truefalse_4' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, width: '100%' }}>
              {q.tfStatements.map((stmt, idx) => {
                const palette = OPTION_CARD_COLORS[idx % OPTION_CARD_COLORS.length];
                return (
                  <View
                    key={idx}
                    style={{
                      flex: 1,
                      minWidth: 220,
                      minHeight: 150,
                      backgroundColor: '#FFFFFF',
                      borderRadius: 14,
                      borderWidth: 3,
                      borderColor: palette.border,
                      padding: 16,
                      justifyContent: 'space-between',
                    }}
                  >
                    <Txt f="bold" size={14} color="#0F172A">
                      {['a)', 'b)', 'c)', 'd)'][idx]} {stmt}
                    </Txt>
                    {slideShowCorrect ? (
                      <Chip
                        text={q.tfCorrect[idx] ? 'Đáp án: ĐÚNG' : 'Đáp án: SAI'}
                        bg={q.tfCorrect[idx] ? '#D1FAE5' : '#FEE2E2'}
                        fg={q.tfCorrect[idx] ? '#065F46' : '#991B1B'}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ width: '100%', padding: 20, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.92)' }}>
              <Txt f="bold" size={15} color="#0F172A">
                Đáp án / Hướng dẫn chấm: {q.shortAnswer || q.explanation || 'Chấm tự luận theo ý'}
              </Txt>
            </View>
          )}
        </View>

        {/* Bottom Prev / Next Bar */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable
            onPress={() => {
              setSlideSelectedOption(null);
              setSlidePreviewIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
            }}
            disabled={slidePreviewIndex <= 0}
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              backgroundColor: slidePreviewIndex <= 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChevronLeft size={22} color="#FFFFFF" />
          </Pressable>

          <Txt size={13} color="#E9D5FF">
            Sử dụng nút mũi tên trái/phải để chuyển câu hỏi
          </Txt>

          <Pressable
            onPress={() => {
              setSlideSelectedOption(null);
              setSlidePreviewIndex((prev) => (prev !== null && prev < questions.length - 1 ? prev + 1 : prev));
            }}
            disabled={slidePreviewIndex >= questions.length - 1}
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              backgroundColor: slidePreviewIndex >= questions.length - 1 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChevronRight size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    );
  };

  // ============================================================================
  // RENDER MODAL 3: "✏ CHỈNH SỬA" CÂU HỎI NỀN TÍM SẪM KIỂU QUIZIZZ (ẢNH 5)
  // ============================================================================
  const renderPurpleQuestionEditorModal = () => {
    if (!editingQuestion) return null;
    const q = editingQuestion;

    const saveCurrentEditingQuestion = () => {
      handleUpdateQuestion(q.uid, q);
      setEditingQuestion(null);
      setEditorTypeMenuOpen(false);
      setEditorPointMenuOpen(false);
      setEditorExplanationOpen(false);
      toast(`Đã lưu Câu ${q.globalIndex}`);
    };

    return (
      <View
        style={{
          position: 'fixed' as never,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#1E0E29',
          zIndex: 1000,
          justifyContent: 'space-between',
        }}
      >
        {/* Top Bar chuẩn Ảnh 5 */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 20,
            paddingVertical: 10,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            borderBottomWidth: 1,
            borderBottomColor: '#E2E8F0',
            zIndex: 20,
          }}
        >
          {/* Left: Back + Question Type Dropdown */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, position: 'relative' }}>
            <Pressable
              onPress={() => setEditingQuestion(null)}
              style={{ width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={18} color="#334155" />
            </Pressable>

            <View style={{ position: 'relative' }}>
              <Pressable
                onPress={() => setEditorTypeMenuOpen(!editorTypeMenuOpen)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  backgroundColor: '#F8FAFC',
                }}
              >
                <CheckCircle2 size={15} color="#7C3AED" />
                <Txt f="bold" size={13} color="#1E293B">{QTYPE_LABEL_MAP[q.qtype]}</Txt>
                <ChevronDown size={14} color="#64748B" />
              </Pressable>

              {editorTypeMenuOpen ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 42,
                    left: 0,
                    width: 210,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    padding: 6,
                    zIndex: 50,
                    shadowColor: '#000',
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                  }}
                >
                  {QUESTION_TYPE_CATALOG.filter((t) => t.type !== 'title_group').map((t) => (
                    <Pressable
                      key={t.type}
                      onPress={() => {
                        setEditingQuestion(convertQuestionToType(q, t.type));
                        setEditorTypeMenuOpen(false);
                      }}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: q.qtype === t.type ? '#F3E8FF' : 'transparent',
                      }}
                    >
                      <Txt f={q.qtype === t.type ? 'bold' : 'body'} size={13} color={q.qtype === t.type ? '#7C3AED' : '#1E293B'}>
                        {t.label}
                      </Txt>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          {/* Right: Nhập giải thích | Điểm | Thời gian (giây) | Lưu câu hỏi */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Pressable
              onPress={() => setEditorExplanationOpen(!editorExplanationOpen)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: editorExplanationOpen ? '#7C3AED' : '#CBD5E1',
                backgroundColor: editorExplanationOpen ? '#F3E8FF' : '#FFFFFF',
              }}
            >
              <HelpCircle size={15} color="#7C3AED" />
              <Txt f="semibold" size={13} color="#334155">Nhập giải thích</Txt>
            </Pressable>

            {/* Điểm Dropdown */}
            <View style={{ position: 'relative' }}>
              <Pressable
                onPress={() => setEditorPointMenuOpen(!editorPointMenuOpen)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <Txt f="semibold" size={13} color="#334155">{q.points} điểm</Txt>
                <ChevronDown size={14} color="#64748B" />
              </Pressable>
              {editorPointMenuOpen ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 40,
                    right: 0,
                    width: 130,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    padding: 4,
                    zIndex: 50,
                  }}
                >
                  {POINT_OPTIONS.map((pt) => (
                    <Pressable
                      key={pt}
                      onPress={() => {
                        setEditingQuestion({ ...q, points: pt });
                        setEditorPointMenuOpen(false);
                      }}
                      style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6 }}
                    >
                      <Txt size={13} color="#1E293B">{pt} điểm</Txt>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Thời gian (giây) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' }}>
              <Txt size={12} color="#64748B">Thời gian (giây):</Txt>
              <TextInput
                value={String(q.seconds || 0)}
                onChangeText={(v) => setEditingQuestion({ ...q, seconds: Math.max(0, Number(v.replace(/[^0-9]/g, '')) || 0) })}
                style={{ width: 48, fontSize: 13, fontWeight: '700', color: '#0F172A', textAlign: 'center', padding: 2 }}
                keyboardType="numeric"
              />
            </View>

            {/* Nút Lưu câu hỏi */}
            <Pressable
              onPress={saveCurrentEditingQuestion}
              testID="save-purple-question"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: '#7C3AED',
              }}
            >
              <Save size={15} color="#FFFFFF" />
              <Txt f="bold" size={13} color="#FFFFFF">Lưu câu hỏi</Txt>
            </Pressable>
          </View>
        </View>

        {/* Main Purple Canvas (#3B1D4A) */}
        <ScrollView
          style={{ flex: 1, backgroundColor: '#3B1D4A' }}
          contentContainerStyle={{ padding: 24, gap: 20, maxWidth: 1180, width: '100%', alignSelf: 'center', flexGrow: 1, justifyContent: 'center' }}
        >
          {/* Hộp nhập giải thích (nếu bật) */}
          {editorExplanationOpen ? (
            <View style={{ backgroundColor: '#2A1437', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', gap: 8 }}>
              <Txt f="bold" size={13} color="#E9D5FF">💡 Giải thích đáp án / Hướng dẫn chấm:</Txt>
              <TextInput
                value={q.explanation}
                onChangeText={(v) => setEditingQuestion({ ...q, explanation: v })}
                placeholder="Nhập lời giải thích hiển thị sau khi học sinh nộp bài..."
                placeholderTextColor="rgba(255,255,255,0.45)"
                multiline
                style={{ color: '#FFFFFF', fontSize: 14, minHeight: 54, padding: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8 }}
              />
            </View>
          ) : null}

          {/* Khung nhập câu hỏi chính ở giữa (Nền tím đậm + chữ trắng lớn chuẩn Ảnh 5) */}
          <View
            style={{
              backgroundColor: '#2D143B',
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.22)',
              padding: 20,
              minHeight: 220,
              justifyContent: 'space-between',
            }}
          >
            {/* Icon Hình ảnh / Âm thanh góc trái trên */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={() => {
                  if (Platform.OS === 'web' && imageInputRef.current) {
                    imageInputRef.current.value = '';
                    imageInputRef.current.click();
                  } else {
                    toast('Hỗ trợ đính kèm hình ảnh minh họa cho câu hỏi');
                  }
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)' }}
              >
                <ImageIcon size={15} color="#FFFFFF" />
                <Txt size={12} color="#FFFFFF">Hình ảnh</Txt>
              </Pressable>
              {q.imageUrl ? (
                <Pressable
                  onPress={() => setEditingQuestion({ ...q, imageUrl: null })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.28)' }}
                >
                  <Trash2 size={13} color="#FCA5A5" />
                  <Txt size={12} color="#FCA5A5">Xóa ảnh</Txt>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => toast('Hỗ trợ đính kèm âm thanh cho câu hỏi')}
                style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Volume2 size={15} color="#FFFFFF" />
              </Pressable>
            </View>

            {q.imageUrl ? (
              <View style={{ alignItems: 'center', paddingTop: 10 }}>
                <Image
                  source={{ uri: q.imageUrl }}
                  style={{ width: 280, height: 160, borderRadius: 10, backgroundColor: '#FFFFFF' }}
                  resizeMode="contain"
                />
              </View>
            ) : null}

            {/* Ô nhập nội dung câu hỏi */}
            <TextInput
              value={q.prompt}
              onChangeText={(v) => setEditingQuestion({ ...q, prompt: v })}
              placeholder="Nhập nội dung câu hỏi tại đây..."
              placeholderTextColor="rgba(255,255,255,0.45)"
              multiline
              style={{
                color: '#FFFFFF',
                fontSize: 20,
                fontWeight: '700',
                textAlign: 'center',
                minHeight: 110,
                paddingVertical: 16,
              }}
            />

            <View style={{ height: 12 }} />
          </View>

          {/* 4 Cột phương án màu bên dưới (Chuẩn Ảnh 5) */}
          {q.qtype === 'mcq' || q.qtype === 'dropdown' ? (
            <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 14, flexWrap: 'wrap' }}>
              {q.options.map((opt, idx) => {
                const palette = OPTION_CARD_COLORS[idx % OPTION_CARD_COLORS.length];
                const isCorrect = q.multiSelect
                  ? (q.correctIndices || [q.correctIndex]).includes(idx)
                  : q.correctIndex === idx;

                return (
                  <View
                    key={idx}
                    style={{
                      flex: 1,
                      minWidth: 210,
                      minHeight: 210,
                      backgroundColor: palette.bg,
                      borderRadius: 14,
                      padding: 12,
                      justifyContent: 'space-between',
                      borderWidth: isCorrect ? 3 : 1,
                      borderColor: isCorrect ? '#4ADE80' : 'rgba(255,255,255,0.25)',
                    }}
                  >
                    {/* Thanh công cụ nhỏ trên mỗi cột đáp án */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {q.options.length > 2 ? (
                          <Pressable
                            onPress={() => {
                              const nextOpts = q.options.filter((_, i) => i !== idx);
                              setEditingQuestion({
                                ...q,
                                options: nextOpts,
                                correctIndex: q.correctIndex >= nextOpts.length ? 0 : q.correctIndex,
                              });
                            }}
                            style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.22)', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Trash2 size={14} color="#FFFFFF" />
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => toast('Chèn ảnh vào phương án')}
                          style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.22)', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <ImageIcon size={14} color="#FFFFFF" />
                        </Pressable>
                      </View>

                      {/* Nút tròn tích chọn đáp án đúng */}
                      <Pressable
                        onPress={() => {
                          if (q.multiSelect) {
                            const cur = q.correctIndices || (q.correctIndex >= 0 ? [q.correctIndex] : []);
                            const nextIndices = cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx];
                            setEditingQuestion({
                              ...q,
                              correctIndices: nextIndices,
                              correctIndex: nextIndices[0] ?? 0,
                            });
                          } else {
                            setEditingQuestion({ ...q, correctIndex: idx });
                          }
                        }}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 15,
                          borderWidth: 2,
                          borderColor: '#FFFFFF',
                          backgroundColor: isCorrect ? '#22C55E' : 'rgba(0,0,0,0.25)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={16} color="#FFFFFF" />
                      </Pressable>
                    </View>

                    {/* Ô nhập văn bản phương án */}
                    <TextInput
                      value={opt}
                      onChangeText={(v) => {
                        const nextOpts = [...q.options];
                        nextOpts[idx] = v;
                        setEditingQuestion({ ...q, options: nextOpts });
                      }}
                      placeholder={`Nhập tùy chọn trả lời ${idx + 1}...`}
                      placeholderTextColor="rgba(255,255,255,0.6)"
                      multiline
                      style={{
                        color: '#FFFFFF',
                        fontSize: 16,
                        fontWeight: '700',
                        textAlign: 'center',
                        minHeight: 110,
                        paddingVertical: 10,
                      }}
                    />

                    <View style={{ height: 4 }} />
                  </View>
                );
              })}

              {/* Nút [+] thêm phương án thứ 5 bên phải */}
              {q.options.length < 5 ? (
                <View style={{ justifyContent: 'center' }}>
                  <Pressable
                    onPress={() => setEditingQuestion({ ...q, options: [...q.options, `Phương án ${q.options.length + 1}`] })}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: 'rgba(255,255,255,0.16)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Plus size={20} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : q.qtype === 'truefalse_4' ? (
            <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 14, flexWrap: 'wrap' }}>
              {q.tfStatements.map((stmt, idx) => {
                const palette = OPTION_CARD_COLORS[idx % OPTION_CARD_COLORS.length];
                const isTrue = q.tfCorrect[idx];
                return (
                  <View
                    key={idx}
                    style={{
                      flex: 1,
                      minWidth: 210,
                      minHeight: 200,
                      backgroundColor: palette.bg,
                      borderRadius: 14,
                      padding: 12,
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Txt f="bold" size={14} color="#FFFFFF">Mệnh đề {['a)', 'b)', 'c)', 'd)'][idx]}</Txt>
                      <Pressable
                        onPress={() => {
                          const nextTf = [...q.tfCorrect];
                          nextTf[idx] = !nextTf[idx];
                          setEditingQuestion({ ...q, tfCorrect: nextTf });
                        }}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 99,
                          backgroundColor: isTrue ? '#22C55E' : '#EF4444',
                        }}
                      >
                        <Txt f="bold" size={12} color="#FFFFFF">{isTrue ? '✓ ĐÚNG' : '✕ SAI'}</Txt>
                      </Pressable>
                    </View>
                    <TextInput
                      value={stmt}
                      onChangeText={(v) => {
                        const nextStmts = [...q.tfStatements];
                        nextStmts[idx] = v;
                        setEditingQuestion({ ...q, tfStatements: nextStmts });
                      }}
                      multiline
                      style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600', textAlign: 'center', minHeight: 110 }}
                    />
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ backgroundColor: '#2D143B', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', gap: 10 }}>
              <Txt f="bold" size={14} color="#E9D5FF">
                {q.qtype === 'essay' || q.qtype === 'paragraph' ? 'Hướng dẫn chấm / Nội dung đoạn văn:' : 'Đáp án chính xác (Trả lời ngắn / Điền khuyết):'}
              </Txt>
              <TextInput
                value={q.shortAnswer || q.explanation}
                onChangeText={(v) =>
                  setEditingQuestion(
                    q.qtype === 'essay' || q.qtype === 'paragraph'
                      ? { ...q, explanation: v, shortAnswer: v }
                      : { ...q, shortAnswer: v },
                  )
                }
                placeholder="Nhập đáp án hoặc hướng dẫn chấm..."
                placeholderTextColor="rgba(255,255,255,0.45)"
                multiline
                style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600', minHeight: 80, padding: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10 }}
              />
            </View>
          )}
        </ScrollView>

        {/* Bottom Bar chuẩn Ảnh 5: Chuyển đổi "Câu trả lời đúng duy nhất" | "Nhiều câu trả lời đúng" */}
        <View
          style={{
            backgroundColor: '#251030',
            paddingHorizontal: 24,
            paddingVertical: 12,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 3 }}>
            <Pressable
              onPress={() => setEditingQuestion({ ...q, multiSelect: false })}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: !q.multiSelect ? 'rgba(255,255,255,0.2)' : 'transparent',
              }}
            >
              <Txt f="bold" size={12} color="#FFFFFF">○ Câu trả lời đúng duy nhất</Txt>
            </Pressable>
            <Pressable
              onPress={() => setEditingQuestion({ ...q, multiSelect: true })}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: q.multiSelect ? 'rgba(255,255,255,0.2)' : 'transparent',
              }}
            >
              <Txt f="bold" size={12} color="#FFFFFF">☑ Nhiều câu trả lời đúng</Txt>
            </Pressable>
          </View>

          <Txt size={12} color="#C4B5FD">
            Mẹo: Nhấn vào dấu ✓ ở góc phải mỗi ô màu để đánh dấu đáp án đúng
          </Txt>
        </View>
      </View>
    );
  };

  // ============================================================================
  // RENDER GIAO DIỆN CHÍNH
  // ============================================================================
  return (
    <View style={{ gap: 16 }}>
      {/* Input file ẩn cho trình duyệt Web — nhận mọi file .docx, .pdf, .xlsx, .csv, .txt */}
      {Platform.OS === 'web' ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.doc,.txt,.csv,.xlsx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                handleWebFileSelected(f);
                e.target.value = '';
              }
            }}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && editingQuestion) {
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === 'string') {
                    setEditingQuestion((prev) => (prev ? { ...prev, imageUrl: reader.result as string } : prev));
                  }
                };
                reader.readAsDataURL(f);
              }
              e.target.value = '';
            }}
          />
        </>
      ) : null}

      {/* Thanh điều hướng chế độ Giáo viên: Tải lên / Biên tập Đề / Trộn đề thi -> Xem trước / Lưu nháp / Xuất bản vào Thư viện */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {onClose ? (
            <Btn icon={ArrowLeft} title="Quay lại" tone="giay" size="sm" onPress={onClose} />
          ) : null}
          <Btn
            icon={Upload}
            title="Tải lên & Số hóa Word/PDF"
            tone={mode === 'upload' ? 'son' : 'giay'}
            size="sm"
            onPress={() => setMode('upload')}
            testID="smart-tab-upload"
          />
          <Btn
            icon={Edit3}
            title={`Biên tập Đề (${questions.length} câu)`}
            tone={mode === 'editor' ? 'son' : 'giay'}
            size="sm"
            onPress={() => setMode('editor')}
            testID="smart-tab-editor"
          />
          <Btn
            icon={Shuffle}
            title="Trộn đề thi (101–104)"
            tone={mode === 'mix' ? 'son' : 'giay'}
            size="sm"
            onPress={() => setMode('mix')}
            testID="smart-tab-mix"
          />
          {!libraryMode ? (
            <>
              <Btn
                icon={Layers}
                title="Thẻ ghi nhớ"
                tone={mode === 'flashcards' ? 'son' : 'giay'}
                size="sm"
                onPress={() => setMode('flashcards')}
                testID="admin-tab-flashcards"
              />
              <Btn
                icon={Play}
                title="Làm thử & Chấm điểm"
                tone={mode === 'preview' ? 'son' : 'giay'}
                size="sm"
                onPress={() => setMode('preview')}
                testID="admin-tab-preview"
              />
            </>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Btn
            icon={Eye}
            title="Xem trước"
            tone="giay"
            size="sm"
            onPress={() => {
              if (questions.length > 0) setSlidePreviewIndex(0);
              else toast('Chưa có câu hỏi nào để xem trước');
            }}
          />
          {libraryMode ? (
            <>
              <Btn
                icon={Save}
                title="Lưu bản nháp"
                tone="giay"
                size="sm"
                loading={savingToBank}
                onPress={() => handleSaveQuizToSystem(false)}
                testID="editor-save-draft-btn"
              />
              <Btn
                icon={Save}
                title="Xuất bản vào Thư viện"
                tone="son"
                size="sm"
                loading={savingToBank}
                onPress={() => handleSaveQuizToSystem(true)}
                testID="smart-publish-library-btn"
              />
            </>
          ) : null}
        </View>
      </View>

      {/* ====================================================================
          CHẾ ĐỘ 1: MÀN HÌNH UPLOAD TỐI GIẢN (NOTE 1 & NOTE 4 - BỎ CÁC NÚT ĐỀ MẪU & AI)
         ==================================================================== */}
      {mode === 'upload' ? (
        <View style={{ gap: 20 }}>
          {/* Banner 4 nút điều hướng nhanh (Không có nút Sinh đề AI) */}
          <Card
            style={{
              padding: 24,
              borderRadius: 20,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#E2E8F0',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Txt f="displayHeavy" size={22} color="#0F172A" center>
                Tạo Bài tập, Đề thi hoặc Số hóa từ File Word (.docx) 🎉
              </Txt>
              <Txt size={14} color="#64748B" center>
                Tải lên bất kỳ file đề thi .docx nào để hệ thống tự động đọc câu hỏi, nhận diện đáp án và mở trình biên tập.
              </Txt>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', width: '100%' }}>
              {[
                {
                  icon: Edit3,
                  title: 'Tạo mới',
                  sub: 'một đề thi thủ công',
                  color: '#7C3AED',
                  bg: '#F3E8FF',
                  onPress: () => setMode('editor'),
                },
                {
                  icon: Upload,
                  title: 'Tải lên',
                  sub: 'Số hóa nội dung Docx, PDF',
                  color: '#2563EB',
                  bg: '#DBEAFE',
                  onPress: triggerFilePicker,
                },
                {
                  icon: Shuffle,
                  title: 'Trộn đề thi',
                  sub: 'Hoán vị mã đề 101–104',
                  color: '#059669',
                  bg: '#D1FAE5',
                  onPress: () => setMode('mix'),
                },
                ...(!libraryMode ? [{
                  icon: Layers,
                  title: 'Thẻ ghi nhớ',
                  sub: 'Ôn tập thẻ lật 2 mặt',
                  color: '#D97706',
                  bg: '#FEF3C7',
                  onPress: () => setMode('flashcards'),
                }] : []),
              ].map((card, i) => {
                const IconComp = card.icon;
                return (
                  <Pressable
                    key={i}
                    onPress={card.onPress}
                    style={({ pressed }) => ({
                      flexGrow: 1,
                      flexBasis: 170,
                      maxWidth: 210,
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: pressed ? '#F8FAFC' : '#FFFFFF',
                      borderWidth: 1.5,
                      borderColor: '#E2E8F0',
                      alignItems: 'center',
                      gap: 8,
                    })}
                  >
                    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: card.bg, alignItems: 'center', justifyContent: 'center' }}>
                      <IconComp size={20} color={card.color} />
                    </View>
                    <Txt f="bold" size={15} color="#0F172A">{card.title}</Txt>
                    <Txt size={12} color="#64748B" center>{card.sub}</Txt>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {/* Khung Kéo Thả File Đề Thi Sạch Sẽ (Đã bỏ hoàn toàn cụm 4 nút đề mẫu ở Ảnh 2) */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
            <Card
              style={{
                flex: 2,
                minWidth: 320,
                padding: 36,
                borderRadius: 20,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: isDraggingFile ? '#2563EB' : '#CBD5E1',
                backgroundColor: isDraggingFile ? '#EFF6FF' : '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Lớp phủ input file trong suốt phủ kín 100% khung trên Web: Nhận cả Kéo-Thả trực tiếp từ Windows Explorer lẫn Click chuột bất kỳ đâu */}
              {Platform.OS === 'web' ? (
                <input
                  type="file"
                  accept=".docx,.doc,.txt,.csv,.xlsx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  title="Chọn hoặc kéo thả file đề thi (.docx, .pdf, .xlsx) vào đây"
                  onDragEnter={() => setIsDraggingFile(true)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isDraggingFile) setIsDraggingFile(true);
                  }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingFile(false);
                    const f = e.dataTransfer?.files?.[0];
                    if (f) {
                      handleWebFileSelected(f);
                      e.currentTarget.value = '';
                    }
                  }}
                  onChange={(e) => {
                    setIsDraggingFile(false);
                    const f = e.target.files?.[0];
                    if (f) {
                      handleWebFileSelected(f);
                      e.target.value = '';
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                    zIndex: 20,
                  }}
                />
              ) : null}

              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
                <FileUp size={32} color="#2563EB" />
              </View>

              <View style={{ alignItems: 'center', gap: 6 }}>
                <Txt f="bold" size={20} color="#0F172A" center>
                  Chọn File hoặc kéo thả File vào đây
                </Txt>
                <Txt size={13} color="#64748B" center>
                  Hỗ trợ các định dạng .pdf, .docx, .xlsx
                </Txt>
                <Txt size={13} color="#475569" center>
                  Có thể Upload File <Txt f="bold" size={13} color="#0F172A">Bài tập, Đề thi</Txt> hoặc <Txt f="bold" size={13} color="#0F172A">Bảng đáp án</Txt> để số hóa tự động.
                </Txt>
              </View>

              {uploading ? <Spinner label="Đang giải nén XML & bóc tách câu hỏi từ file..." /> : null}

              <Pressable
                onPress={triggerFilePicker}
                testID="dropzone-upload-btn"
                style={({ pressed }) => ({
                  paddingHorizontal: 28,
                  paddingVertical: 16,
                  borderRadius: 14,
                  backgroundColor: pressed || isDraggingFile ? '#E0E7FF' : '#F5F7FF',
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: '#93C5FD',
                  alignItems: 'center',
                  gap: 4,
                  maxWidth: 460,
                  width: '100%',
                })}
              >
                <Txt f="bold" size={15} color="#2563EB" center>
                  Kéo thả file vào khung hoặc bấm vào đây để tải lên
                </Txt>
                <Txt size={12} color="#64748B" center>
                  Hệ thống sẽ tự nhận diện định dạng phù hợp để nhập đề nhanh hơn.
                </Txt>
              </Pressable>
            </Card>

            {/* Cột phải: Tạo mới một tài nguyên */}
            <View style={{ flex: 1, minWidth: 280, gap: 14 }}>
              <Card style={{ padding: 20, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', gap: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} color="#2563EB" />
                  <View>
                    <Txt f="bold" size={15} color="#0F172A">Tạo mới một tài nguyên</Txt>
                    <Txt size={12} color="#64748B">{libraryMode ? 'Soạn đề thi, trộn mã đề và xuất bản vào Thư viện' : 'Tạo nhanh đề thi, thẻ ghi nhớ và nhiều thứ khác'}</Txt>
                  </View>
                </View>

                <Pressable
                  onPress={() => setMode('editor')}
                  style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' }}>
                    <Edit3 size={18} color="#16A34A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt f="bold" size={14} color="#0F172A">Tự soạn Đề thi / Bài tập thủ công</Txt>
                    <Txt size={12} color="#64748B">
                      Sử dụng trình soạn thảo tối giản để tạo Bài tập/Đề thi hoặc Copy & Paste từ nguồn khác.
                    </Txt>
                  </View>
                </Pressable>

                {libraryMode ? (
                  <Pressable
                    onPress={() => setMode('mix')}
                    style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  >
                    <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' }}>
                      <Shuffle size={18} color="#7C3AED" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt f="bold" size={14} color="#0F172A">Trộn mã đề 101–104 & Xuất bản Thư viện</Txt>
                      <Txt size={12} color="#64748B">Tự động hoán vị câu hỏi, xáo trộn đáp án, tải file Word (.doc) hoặc xuất bản lên Thư viện.</Txt>
                    </View>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => setMode('flashcards')}
                    style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  >
                    <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' }}>
                      <Layers size={18} color="#7C3AED" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt f="bold" size={14} color="#0F172A">Tạo thẻ ghi nhớ</Txt>
                      <Txt size={12} color="#64748B">Tạo bộ thẻ ghi nhớ giúp học sinh ôn tập hiệu quả với phương pháp học qua thẻ hai mặt.</Txt>
                    </View>
                  </Pressable>
                )}
              </Card>
            </View>
          </View>
        </View>
      ) : null}

      {/* ====================================================================
          CHẾ ĐỘ 2: MÀN HÌNH BIÊN TẬP ĐỀ THI (CHUẨN 100% 2048.VN/DASHBOARD/QUIZ/EDIT)
         ==================================================================== */}
      {mode === 'editor' ? (
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' }}>
          {/* 1. TOP HEADER BAR CHUẨN 2048.VN: [← Tên đề thi] ... [👁 Xem trước] [⚙ Cài đặt] [💾 Xuất bản] */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#E2E8F0',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {/* Left: Nút Back + Tên đề thi */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 240 }}>
              <Pressable
                onPress={() => setMode('upload')}
                style={{ width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' }}
              >
                <ArrowLeft size={18} color="#334155" />
              </Pressable>
              <TextInput
                value={examTitle}
                onChangeText={setExamTitle}
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontWeight: '700',
                  color: '#0F172A',
                  paddingVertical: 4,
                  paddingHorizontal: 8,
                  borderRadius: 6,
                }}
                placeholder="Nhập tên đề thi..."
              />
            </View>

            {/* Right: Các nút chuẩn quy trình Giáo viên: Trộn đề | Xem trước | Cài đặt | Lưu nháp | Xuất bản */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Pressable
                onPress={() => setMode('mix')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: '#F0FDF4',
                  borderWidth: 1,
                  borderColor: '#BBF7D0',
                }}
              >
                <Shuffle size={14} color="#059669" />
                <Txt f="semibold" size={13} color="#059669">Trộn đề (101–104)</Txt>
              </Pressable>

              {!libraryMode ? (
                <>
                  <Pressable
                    onPress={() => setMode('flashcards')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: '#FFFBEB',
                      borderWidth: 1,
                      borderColor: '#FDE68A',
                    }}
                  >
                    <Layers size={14} color="#D97706" />
                    <Txt f="semibold" size={13} color="#D97706">Thẻ ghi nhớ</Txt>
                  </Pressable>

                  <Pressable
                    onPress={() => setMode('preview')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: '#EFF6FF',
                      borderWidth: 1,
                      borderColor: '#BFDBFE',
                    }}
                  >
                    <Play size={14} color="#2563EB" />
                    <Txt f="semibold" size={13} color="#2563EB">Làm thử</Txt>
                  </Pressable>
                </>
              ) : null}

              <Pressable
                onPress={() => {
                  if (questions.length > 0) {
                    setSlidePreviewIndex(0);
                  } else {
                    toast('Chưa có câu hỏi nào để xem trước');
                  }
                }}
                testID="editor-top-preview"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: '#F8FAFC',
                }}
              >
                <Eye size={15} color="#7C3AED" />
                <Txt f="semibold" size={13} color="#7C3AED">Xem trước</Txt>
              </Pressable>

              <Pressable
                onPress={() => setSettingsOpen(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: '#F8FAFC',
                }}
              >
                <Settings size={15} color="#334155" />
                <Txt f="semibold" size={13} color="#334155">Cài đặt</Txt>
              </Pressable>

              {libraryMode ? (
                <Pressable
                  onPress={() => handleSaveQuizToSystem(false)}
                  disabled={savingToBank}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: '#F1F5F9',
                    opacity: savingToBank ? 0.6 : 1,
                  }}
                >
                  <FileText size={14} color="#334155" />
                  <Txt f="semibold" size={13} color="#334155">Lưu nháp</Txt>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => handleSaveQuizToSystem(true)}
                disabled={savingToBank}
                testID="editor-publish-btn"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: '#7C3AED',
                  opacity: savingToBank ? 0.6 : 1,
                }}
              >
                <Save size={15} color="#FFFFFF" />
                <Txt f="bold" size={13} color="#FFFFFF">
                  {savingToBank ? 'Đang xuất bản...' : 'Xuất bản'}
                </Txt>
              </Pressable>
            </View>
          </View>

          {/* 2. BODY 2 CỘT: CỘT TRÁI (2 HỘP TỐI GIẢN) + KHU VỰC CHÍNH (DANH SÁCH CÂU HỎI) */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 20, gap: 20, alignItems: 'flex-start', justifyContent: 'center' }}>
            {/* CỘT TRÁI (LEFT SIDEBAR — ĐÚNG 2 HỘP TRẮNG: "NHẬP TỪ" & "CẬP NHẬT HÀNG LOẠT") */}
            <View style={{ width: 250, flexGrow: 1, maxWidth: 280, gap: 16 }}>
              {/* Hộp 1: Nhập từ */}
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  padding: 16,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Txt f="bold" size={14} color="#0F172A">Nhập từ</Txt>
                  {questions.length > 0 ? (
                    <Pressable
                      onPress={() => setAppendOnImport(!appendOnImport)}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 99,
                        backgroundColor: appendOnImport ? '#EEF2FF' : '#FEF2F2',
                        borderWidth: 1,
                        borderColor: appendOnImport ? '#C7D2FE' : '#FECACA',
                      }}
                    >
                      <Txt f="bold" size={11} color={appendOnImport ? '#4338CA' : '#DC2626'}>
                        {appendOnImport ? '➕ Cộng nối tiếp' : '🔄 Thay đề mới'}
                      </Txt>
                    </Pressable>
                  ) : null}
                </View>

                <Pressable
                  onPress={() => setPasteModalOpen(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <FileText size={16} color="#7C3AED" />
                    <Txt size={13} color="#334155">Biểu mẫu Google</Txt>
                  </View>
                  <ChevronRight size={15} color="#94A3B8" />
                </Pressable>

                <Pressable
                  onPress={triggerFilePicker}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <FileSpreadsheet size={16} color="#10B981" />
                    <Txt size={13} color="#334155">Bảng tính</Txt>
                  </View>
                  <ChevronRight size={15} color="#94A3B8" />
                </Pressable>

                <Pressable
                  onPress={triggerFilePicker}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <FileUp size={16} color="#2563EB" />
                    <Txt size={13} color="#334155">File Word, PDF</Txt>
                  </View>
                  <ChevronRight size={15} color="#94A3B8" />
                </Pressable>
              </View>

              {/* Hộp 2: Cập nhật hàng loạt */}
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  padding: 16,
                  gap: 12,
                  zIndex: 30,
                }}
              >
                <Txt f="bold" size={14} color="#0F172A">Cập nhật hàng loạt</Txt>

                {/* Dropdown Thời gian */}
                <View style={{ position: 'relative' }}>
                  <Pressable
                    onPress={() => {
                      setBulkTimeDropdownOpen(!bulkTimeDropdownOpen);
                      setBulkPointDropdownOpen(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <Txt size={13} color="#475569">Thời gian</Txt>
                    <ChevronDown size={15} color="#64748B" />
                  </Pressable>
                  {bulkTimeDropdownOpen ? (
                    <View
                      style={{
                        marginTop: 4,
                        backgroundColor: '#FFFFFF',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        padding: 4,
                      }}
                    >
                      {TIME_OPTIONS.map((t) => (
                        <Pressable
                          key={t.value}
                          onPress={() => handleBulkUpdateTime(t.value)}
                          style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6 }}
                        >
                          <Txt size={12} color="#1E293B">{t.label}</Txt>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>

                {/* Dropdown Điểm */}
                <View style={{ position: 'relative' }}>
                  <Pressable
                    onPress={() => {
                      setBulkPointDropdownOpen(!bulkPointDropdownOpen);
                      setBulkTimeDropdownOpen(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <Txt size={13} color="#475569">Điểm</Txt>
                    <ChevronDown size={15} color="#64748B" />
                  </Pressable>
                  {bulkPointDropdownOpen ? (
                    <View
                      style={{
                        marginTop: 4,
                        backgroundColor: '#FFFFFF',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        padding: 4,
                      }}
                    >
                      {POINT_OPTIONS.map((pt) => (
                        <Pressable
                          key={pt}
                          onPress={() => handleBulkUpdatePoints(pt)}
                          style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6 }}
                        >
                          <Txt size={12} color="#1E293B">{pt} điểm</Txt>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {/* KHU VỰC CHÍNH (MAIN CANVAS — TÌM KIẾM THƯ VIỆN + TIÊU ĐỀ NHÓM + THẺ CÂU HỎI) */}
            <View style={{ flex: 1, minWidth: 340, maxWidth: 820, gap: 16 }}>
              {/* Khung "Tìm kiếm câu hỏi từ Thư viện:" */}
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  padding: 16,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Txt f="bold" size={14} color="#0F172A">Tìm kiếm câu hỏi từ Thư viện:</Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pressable onPress={() => setLibrarySearchQuery('')}>
                      <Trash2 size={14} color="#EF4444" />
                    </Pressable>
                    <Pressable onPress={() => setSettingsOpen(true)}>
                      <Settings size={14} color="#475569" />
                    </Pressable>
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    borderRadius: 8,
                    paddingLeft: 12,
                    paddingRight: 6,
                    paddingVertical: 4,
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <TextInput
                    value={librarySearchQuery}
                    onChangeText={setLibrarySearchQuery}
                    placeholder="Nhập từ khóa câu hỏi hoặc tên đề thi..."
                    placeholderTextColor="#94A3B8"
                    style={{ flex: 1, fontSize: 13, color: '#0F172A', paddingVertical: 6 }}
                  />
                  <Pressable
                    onPress={() => toast(`Đang lọc trong ${questions.length} câu hỏi`)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: '#7C3AED',
                      backgroundColor: '#FAF5FF',
                    }}
                  >
                    <Search size={13} color="#7C3AED" />
                    <Txt f="semibold" size={12} color="#7C3AED">Tìm kiếm</Txt>
                  </Pressable>
                </View>
              </View>

              {/* Dòng tổng số câu hỏi + Nút tím "+ Thêm câu hỏi" */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Txt f="bold" size={16} color="#0F172A">
                  {questions.length} câu hỏi
                </Txt>
                <Pressable
                  onPress={() => {
                    setTypePickerTargetSection(undefined);
                    setTypePickerOpen(true);
                  }}
                  testID="open-qtype-picker-btn"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: 8,
                    backgroundColor: '#7C3AED',
                  }}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Txt f="bold" size={13} color="#FFFFFF">Thêm câu hỏi</Txt>
                </Pressable>
              </View>

              {/* Nếu chưa có câu hỏi nào: Hiển thị khung hướng dẫn tải file hoặc bấm "+ Thêm câu hỏi" */}
              {questions.length === 0 ? (
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: '#CBD5E1',
                    padding: 36,
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <FileUp size={32} color="#7C3AED" />
                  <Txt f="bold" size={16} color="#0F172A" center>
                    Chưa có câu hỏi nào trong đề thi
                  </Txt>
                  <Txt size={13} color="#64748B" center>
                    Bấm vào <Txt f="bold" size={13} color="#2563EB">File Word, PDF</Txt> ở cột bên trái để tải đề thi .docx bất kỳ lên, hoặc bấm <Txt f="bold" size={13} color="#7C3AED">+ Thêm câu hỏi</Txt> để tự soạn câu hỏi mới.
                  </Txt>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <Btn icon={Upload} title="Tải File Word (.docx)" tone="thuy" size="sm" onPress={triggerFilePicker} />
                    <Btn
                      icon={Plus}
                      title="Thêm câu hỏi mới"
                      tone="son"
                      size="sm"
                      onPress={() => {
                        setTypePickerTargetSection(undefined);
                        setTypePickerOpen(true);
                      }}
                    />
                  </View>
                </View>
              ) : null}

              {/* Danh sách các khối "Tiêu đề nhóm" (PHẦN I, PHẦN II...) & các Thẻ câu hỏi bên trong */}
              {sectionGroups.map((group) => {
                const isCollapsed = Boolean(collapsedSections[group.section]);
                const isEditingSec = editingSectionName === group.section;

                return (
                  <View
                    key={group.section}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      padding: 16,
                      gap: 14,
                      position: 'relative',
                    }}
                  >
                    {/* Nút nắm kéo [:::] ở chính giữa cạnh trên của Tiêu đề nhóm */}
                    <View style={{ alignItems: 'center', marginTop: -8, marginBottom: -4 }}>
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 2,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          backgroundColor: '#F8FAFC',
                        }}
                      >
                        <GripHorizontal size={14} color="#94A3B8" />
                      </View>
                    </View>

                    {/* Hàng trên của Tiêu đề nhóm */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <FolderPlus size={15} color="#64748B" />
                        <Txt size={12} color="#64748B">Tiêu đề nhóm</Txt>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Pressable
                          onPress={() => {
                            setEditingSectionName(group.section);
                            setEditingSectionValue(group.section);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            backgroundColor: '#FFFFFF',
                          }}
                        >
                          <Edit3 size={12} color="#334155" />
                          <Txt f="semibold" size={12} color="#334155">Chỉnh sửa</Txt>
                        </Pressable>
                      </View>
                    </View>

                    {/* Tên Tiêu đề nhóm (VD: PHẦN I. TRẮC NGHIỆM (7,0 điểm)) */}
                    {isEditingSec ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TextInput
                          value={editingSectionValue}
                          onChangeText={setEditingSectionValue}
                          style={{
                            flex: 1,
                            fontSize: 14,
                            fontWeight: '700',
                            color: '#0F172A',
                            borderWidth: 1,
                            borderColor: '#7C3AED',
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                          }}
                        />
                        <Pressable
                          onPress={() => {
                            const newSec = editingSectionValue.trim() || group.section;
                            setQuestions((prev) =>
                              prev.map((q) => (q.section === group.section ? { ...q, section: newSec } : q)),
                            );
                            setEditingSectionName(null);
                          }}
                          style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#7C3AED' }}
                        >
                          <Txt f="bold" size={12} color="#FFFFFF">Lưu</Txt>
                        </Pressable>
                      </View>
                    ) : (
                      <Txt f="bold" size={14} color="#0F172A">
                        {group.section}
                      </Txt>
                    )}

                    {/* Thanh thu gọn "^ 17 mục" bên trái & nút "+ Thêm nội dung" bên phải */}
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: 8,
                        borderTopWidth: 1,
                        borderTopColor: '#F1F5F9',
                      }}
                    >
                      <Pressable
                        onPress={() =>
                          setCollapsedSections((prev) => ({
                            ...prev,
                            [group.section]: !prev[group.section],
                          }))
                        }
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      >
                        {isCollapsed ? <ChevronDown size={15} color="#64748B" /> : <ChevronUp size={15} color="#64748B" />}
                        <Txt size={13} color="#64748B">{group.items.length} mục</Txt>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          setTypePickerTargetSection(group.section);
                          setTypePickerOpen(true);
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        <Plus size={13} color="#334155" />
                        <Txt f="semibold" size={12} color="#334155">Thêm nội dung</Txt>
                      </Pressable>
                    </View>

                    {/* Danh sách Thẻ Câu Hỏi trong nhóm (Chuẩn Ảnh 3: 2048.vn/dashboard/quiz/160804/edit) */}
                    {!isCollapsed ? (
                      <View style={{ gap: 14 }}>
                        {group.items.map(({ question: q, indexInAll }) => {
                          const isBeingDragged = draggingUid === q.uid;
                          const isDragTarget = dragOverUid === q.uid && draggingUid !== q.uid;

                          return (
                            <View
                              key={q.uid}
                              // @ts-expect-error HTML5 Drag and Drop trên Web
                              draggable={Platform.OS === 'web'}
                              onDragStart={() => setDraggingUid(q.uid)}
                              onDragOver={(e: React.DragEvent) => {
                                e.preventDefault();
                                if (dragOverUid !== q.uid) setDragOverUid(q.uid);
                              }}
                              onDrop={(e: React.DragEvent) => {
                                e.preventDefault();
                                if (draggingUid) handleReorderDrop(draggingUid, q.uid);
                              }}
                              onDragEnd={() => {
                                setDraggingUid(null);
                                setDragOverUid(null);
                              }}
                              style={{
                                backgroundColor: '#FFFFFF',
                                borderRadius: 12,
                                borderWidth: isDragTarget || isBeingDragged ? 2 : 1,
                                borderStyle: isDragTarget || isBeingDragged ? 'dashed' : 'solid',
                                borderColor: isDragTarget || isBeingDragged ? '#7C3AED' : '#E2E8F0',
                                padding: 16,
                                gap: 12,
                                opacity: isBeingDragged ? 0.65 : 1,
                                position: 'relative',
                              }}
                            >
                              {/* Nút nắm kéo [:::] ở chính giữa cạnh trên của Thẻ Câu Hỏi (Hỗ trợ cả kéo thả chuột lẫn bấm đổi vị trí) */}
                              <View style={{ alignItems: 'center', marginTop: -10, marginBottom: -4 }}>
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    borderColor: '#E2E8F0',
                                    backgroundColor: '#F8FAFC',
                                  }}
                                >
                                  <Pressable
                                    onPress={() => handleMoveQuestionByStep(q.uid, -1)}
                                    disabled={indexInAll === 0}
                                     accessibilityLabel="Đưa câu hỏi lên"
                                  >
                                    <ArrowUp size={11} color={indexInAll === 0 ? '#CBD5E1' : '#64748B'} />
                                  </Pressable>
                                  <GripHorizontal size={14} color="#64748B" />
                                  <Pressable
                                    onPress={() => handleMoveQuestionByStep(q.uid, 1)}
                                    disabled={indexInAll === questions.length - 1}
                                    accessibilityLabel="Đưa câu hỏi xuống"
                                  >
                                    <ArrowDown size={11} color={indexInAll === questions.length - 1 ? '#CBD5E1' : '#64748B'} />
                                  </Pressable>
                                </View>
                              </View>

                              {/* Dòng Header của Thẻ Câu Hỏi:
                                  Bên trái: [1. ✓ Trắc nghiệm] [Điểm: 1 điểm ▾] [Thời gian: Không giới hạn ▾]
                                  Bên phải: [📋 Sao chép] [🗑 Xóa] [👁 Xem trước (con mắt)] [✏ Chỉnh sửa] */}
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, zIndex: 15 }}>
                                {/* Cụm Trái */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  {/* Dropdown chọn nhanh Dạng câu hỏi trực tiếp trên Thẻ */}
                                  <View style={{ position: 'relative' }}>
                                    <Pressable
                                      onPress={() => {
                                        setOpenTypeDropdownUid(openTypeDropdownUid === q.uid ? null : q.uid);
                                        setOpenPointDropdownUid(null);
                                        setOpenTimeDropdownUid(null);
                                      }}
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 5,
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                        borderRadius: 6,
                                        borderWidth: 1,
                                        borderColor: openTypeDropdownUid === q.uid ? '#7C3AED' : '#E2E8F0',
                                        backgroundColor: openTypeDropdownUid === q.uid ? '#FAF5FF' : '#FFFFFF',
                                      }}
                                    >
                                      <Txt f="bold" size={13} color="#0F172A">{indexInAll + 1}.</Txt>
                                      <CheckCircle2 size={14} color="#7C3AED" />
                                      <Txt f="semibold" size={13} color="#334155">{QTYPE_LABEL_MAP[q.qtype]}</Txt>
                                      <ChevronDown size={12} color="#64748B" />
                                    </Pressable>

                                    {openTypeDropdownUid === q.uid ? (
                                      <View
                                        style={{
                                          position: 'absolute',
                                          top: 32,
                                          left: 0,
                                          width: 195,
                                          backgroundColor: '#FFFFFF',
                                          borderRadius: 10,
                                          borderWidth: 1,
                                          borderColor: '#E2E8F0',
                                          padding: 4,
                                          zIndex: 60,
                                          shadowColor: '#000',
                                          shadowOpacity: 0.14,
                                          shadowRadius: 10,
                                        }}
                                      >
                                        {QUESTION_TYPE_CATALOG.filter((t) => t.type !== 'title_group').map((t) => (
                                          <Pressable
                                            key={t.type}
                                            onPress={() => {
                                              handleUpdateQuestion(q.uid, { qtype: t.type });
                                              setOpenTypeDropdownUid(null);
                                              toast(`Đã đổi Câu ${indexInAll + 1} sang dạng "${t.label}"`);
                                            }}
                                            style={{
                                              paddingHorizontal: 10,
                                              paddingVertical: 7,
                                              borderRadius: 6,
                                              backgroundColor: q.qtype === t.type ? '#F3E8FF' : 'transparent',
                                            }}
                                          >
                                            <Txt f={q.qtype === t.type ? 'bold' : 'body'} size={12} color={q.qtype === t.type ? '#7C3AED' : '#1E293B'}>
                                              {t.label}
                                            </Txt>
                                          </Pressable>
                                        ))}
                                      </View>
                                    ) : null}
                                  </View>

                                  {/* Dropdown Điểm trên thẻ */}
                                  <View style={{ position: 'relative' }}>
                                    <Pressable
                                      onPress={() => {
                                        setOpenPointDropdownUid(openPointDropdownUid === q.uid ? null : q.uid);
                                        setOpenTimeDropdownUid(null);
                                        setOpenTypeDropdownUid(null);
                                      }}
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 6,
                                        paddingHorizontal: 10,
                                        paddingVertical: 4,
                                        borderRadius: 6,
                                        borderWidth: 1,
                                        borderColor: '#E2E8F0',
                                        backgroundColor: '#FFFFFF',
                                      }}
                                    >
                                      <Txt size={12} color="#0F172A">{q.points} điểm</Txt>
                                      <ChevronDown size={12} color="#64748B" />
                                    </Pressable>
                                    {openPointDropdownUid === q.uid ? (
                                      <View
                                        style={{
                                          position: 'absolute',
                                          top: 30,
                                          left: 0,
                                          width: 110,
                                          backgroundColor: '#FFFFFF',
                                          borderRadius: 8,
                                          borderWidth: 1,
                                          borderColor: '#E2E8F0',
                                          padding: 4,
                                          zIndex: 40,
                                        }}
                                      >
                                        {POINT_OPTIONS.map((pt) => (
                                          <Pressable
                                            key={pt}
                                            onPress={() => {
                                              handleUpdateQuestion(q.uid, { points: pt });
                                              setOpenPointDropdownUid(null);
                                            }}
                                            style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 4 }}
                                          >
                                            <Txt size={12} color="#1E293B">{pt} điểm</Txt>
                                          </Pressable>
                                        ))}
                                      </View>
                                    ) : null}
                                  </View>

                                  {/* Dropdown Thời gian trên thẻ */}
                                  <View style={{ position: 'relative' }}>
                                    <Pressable
                                      onPress={() => {
                                        setOpenTimeDropdownUid(openTimeDropdownUid === q.uid ? null : q.uid);
                                        setOpenPointDropdownUid(null);
                                      }}
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 6,
                                        paddingHorizontal: 10,
                                        paddingVertical: 4,
                                        borderRadius: 6,
                                        borderWidth: 1,
                                        borderColor: '#E2E8F0',
                                        backgroundColor: '#FFFFFF',
                                      }}
                                    >
                                      <Txt size={12} color="#0F172A">
                                        {!q.seconds || q.seconds === 0 ? 'Không giới hạn' : `${q.seconds} giây`}
                                      </Txt>
                                      <ChevronDown size={12} color="#64748B" />
                                    </Pressable>
                                    {openTimeDropdownUid === q.uid ? (
                                      <View
                                        style={{
                                          position: 'absolute',
                                          top: 30,
                                          left: 0,
                                          width: 130,
                                          backgroundColor: '#FFFFFF',
                                          borderRadius: 8,
                                          borderWidth: 1,
                                          borderColor: '#E2E8F0',
                                          padding: 4,
                                          zIndex: 40,
                                        }}
                                      >
                                        {TIME_OPTIONS.map((t) => (
                                          <Pressable
                                            key={t.value}
                                            onPress={() => {
                                              handleUpdateQuestion(q.uid, { seconds: t.value });
                                              setOpenTimeDropdownUid(null);
                                            }}
                                            style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 4 }}
                                          >
                                            <Txt size={12} color="#1E293B">{t.label}</Txt>
                                          </Pressable>
                                        ))}
                                      </View>
                                    ) : null}
                                  </View>
                                </View>

                                {/* Cụm Phải: [📋 Sao chép] [🗑 Xóa] [👁 Xem trước (con mắt)] [✏ Chỉnh sửa] */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                  <Pressable
                                    onPress={() => handleDuplicateQuestion(q.uid)}
                                    accessibilityLabel="Sao chép câu hỏi"
                                    style={{ padding: 4 }}
                                  >
                                    <Copy size={15} color="#64748B" />
                                  </Pressable>

                                  <Pressable
                                    onPress={() => handleDeleteQuestion(q.uid)}
                                    accessibilityLabel="Xóa câu hỏi"
                                    style={{ padding: 4 }}
                                  >
                                    <Trash2 size={15} color="#64748B" />
                                  </Pressable>

                                  {/* Nút hình con mắt 👁 Xem trước câu hỏi */}
                                  <Pressable
                                    onPress={() => {
                                      setSlideSelectedOption(null);
                                      setSlidePreviewIndex(indexInAll);
                                    }}
                                    accessibilityLabel="Xem trước câu hỏi"
                                    testID={`eye-preview-${indexInAll + 1}`}
                                    style={{ padding: 4 }}
                                  >
                                    <Eye size={16} color="#64748B" />
                                  </Pressable>

                                  {/* Nút ✏ Chỉnh sửa mở màn hình nền tím sẫm kiểu Quizizz */}
                                  <Pressable
                                    onPress={() => setEditingQuestion({ ...q, options: [...q.options] })}
                                    testID={`edit-question-${indexInAll + 1}`}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 5,
                                      paddingHorizontal: 10,
                                      paddingVertical: 5,
                                      borderRadius: 6,
                                      borderWidth: 1,
                                      borderColor: '#E2E8F0',
                                      backgroundColor: '#FFFFFF',
                                    }}
                                  >
                                    <Edit3 size={12} color="#0F172A" />
                                    <Txt f="semibold" size={12} color="#0F172A">Chỉnh sửa</Txt>
                                  </Pressable>
                                </View>
                              </View>

                              {/* Nội dung câu hỏi (Chữ đậm, sạch sẽ, không có chip màu mè) */}
                              <Txt f="bold" size={14} color="#0F172A" style={{ lineHeight: 22 }}>
                                {q.prompt}
                              </Txt>

                              {/* Hình ảnh minh họa đính kèm từ file Word (nếu có) */}
                              {q.imageUrl ? (
                                <View style={{ alignItems: 'flex-start', paddingVertical: 4 }}>
                                  <Image
                                    source={{ uri: q.imageUrl }}
                                    style={{ width: 320, height: 180, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}
                                    resizeMode="contain"
                                  />
                                </View>
                              ) : null}

                              {/* Lưới hiển thị các phương án trả lời (2x2 giống hệt 2048.vn) */}
                              {q.qtype === 'mcq' || q.qtype === 'dropdown' ? (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                  {q.options.map((opt, oIdx) => {
                                    const isCorrect = q.multiSelect
                                      ? (q.correctIndices || [q.correctIndex]).includes(oIdx)
                                      : q.correctIndex === oIdx;
                                    return (
                                      <Pressable
                                        key={oIdx}
                                        onPress={() => handleUpdateQuestion(q.uid, { correctIndex: oIdx })}
                                        style={{
                                          width: '48%',
                                          flexGrow: 1,
                                          minWidth: 220,
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          gap: 8,
                                          paddingVertical: 4,
                                        }}
                                      >
                                        {isCorrect ? (
                                          <CheckCircle2 size={16} color="#10B981" />
                                        ) : (
                                          <XCircle size={16} color="#EF4444" />
                                        )}
                                        <Txt
                                          size={13}
                                          f={isCorrect ? 'bold' : 'body'}
                                          color={isCorrect ? '#065F46' : '#334155'}
                                          style={{ flex: 1 }}
                                        >
                                          {opt}
                                        </Txt>
                                      </Pressable>
                                    );
                                  })}
                                </View>
                              ) : q.qtype === 'truefalse_4' ? (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                  {q.tfStatements.map((stmt, sIdx) => {
                                    const isTrue = q.tfCorrect[sIdx];
                                    return (
                                      <Pressable
                                        key={sIdx}
                                        onPress={() => {
                                          const nextTf = [...q.tfCorrect];
                                          nextTf[sIdx] = !nextTf[sIdx];
                                          handleUpdateQuestion(q.uid, { tfCorrect: nextTf });
                                        }}
                                        style={{
                                          width: '48%',
                                          flexGrow: 1,
                                          minWidth: 220,
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          gap: 8,
                                          paddingVertical: 4,
                                        }}
                                      >
                                        {isTrue ? (
                                          <CheckCircle2 size={16} color="#10B981" />
                                        ) : (
                                          <XCircle size={16} color="#EF4444" />
                                        )}
                                        <Txt size={13} color="#334155" style={{ flex: 1 }}>
                                          {['a)', 'b)', 'c)', 'd)'][sIdx]} {stmt} ({isTrue ? 'Đúng' : 'Sai'})
                                        </Txt>
                                      </Pressable>
                                    );
                                  })}
                                </View>
                              ) : (
                                <View style={{ padding: 10, borderRadius: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }}>
                                  <Txt size={13} color="#334155">
                                    <Txt f="bold" size={13} color="#0F172A">Đáp án / Hướng dẫn:</Txt> {q.shortAnswer || q.explanation || 'Chưa nhập đáp án'}
                                  </Txt>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}

      {/* ====================================================================
          CHẾ ĐỘ 3: TRỘN ĐỀ THI TỰ ĐỘNG (MÃ ĐỀ 101, 102, 103, 104)
         ==================================================================== */}
      {mode === 'mix' ? (
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Btn icon={ArrowLeft} title="Quay lại Trình biên tập" tone="giay" size="sm" onPress={() => setMode('editor')} />
            <Txt f="bold" size={18} color={c.muc}>Trộn đề thi tự động (Mã đề 101–104)</Txt>
          </View>

          {questions.length === 0 ? (
            <Card style={{ padding: 28, alignItems: 'center', gap: 12 }}>
              <Txt f="bold" size={16}>Chưa có câu hỏi nào để trộn đề</Txt>
              <Btn icon={Upload} title="Tải File Đề (.docx) lên trước" tone="thuy" onPress={() => setMode('upload')} />
            </Card>
          ) : (
            <Card style={{ padding: 20, borderRadius: 18, gap: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <View style={{ gap: 4 }}>
                  <Txt f="bold" size={17} color={c.muc}>Hoán vị câu hỏi & đảo phương án A/B/C/D</Txt>
                  <Txt size={13} color={c.muc2}>
                    Giữ nguyên cấu trúc từng phần, tự động sinh Bảng đáp án riêng cho từng mã đề và xuất file Word (.doc) in ấn ngay.
                  </Txt>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[2, 4, 6].map((cnt) => (
                    <Btn
                      key={cnt}
                      title={`${cnt} mã đề`}
                      tone={variantCount === cnt ? 'son' : 'giay'}
                      size="sm"
                      onPress={() => {
                        setVariantCount(cnt);
                        setActiveVariantIdx(0);
                      }}
                    />
                  ))}
                </View>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {variants.map((v, idx) => (
                  <Btn
                    key={v.code}
                    icon={FileText}
                    title={`Mã đề ${v.code}`}
                    tone={activeVariantIdx === idx ? 'thuy' : 'giay'}
                    size="sm"
                    onPress={() => setActiveVariantIdx(idx)}
                  />
                ))}
              </View>

              {variants[activeVariantIdx] ? (
                <View style={{ gap: 14, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.vien }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <Txt f="bold" size={16} color={c.muc}>
                      Xem trước & Bảng đáp án — Mã đề {variants[activeVariantIdx].code}
                    </Txt>
                    <Btn
                      icon={Download}
                      title={`Tải File Word Mã đề ${variants[activeVariantIdx].code} (.doc)`}
                      tone="ngoc"
                      size="sm"
                      onPress={() => handleDownloadVariantWord(variants[activeVariantIdx])}
                      testID="download-mixed-word"
                    />
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {variants[activeVariantIdx].answerKey.map((ak) => (
                      <View
                        key={ak.questionNumber}
                        style={{
                          minWidth: 105,
                          padding: 10,
                          borderRadius: 10,
                          backgroundColor: c.giay2,
                          borderWidth: 1,
                          borderColor: c.vien,
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        <Txt f="bold" size={12} color={c.muc3}>Câu {ak.questionNumber}</Txt>
                        <Txt f="bold" size={14} color={c.ngocChu}>{ak.answerText}</Txt>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </Card>
          )}
        </View>
      ) : null}

      {/* ====================================================================
          CHẾ ĐỘ 4: THẺ GHI NHỚ (FLASHCARDS 2 MẶT TỪ ĐỀ THI)
         ==================================================================== */}
      {mode === 'flashcards' ? (
        <View style={{ gap: 16, maxWidth: 760, alignSelf: 'center', width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Btn icon={ArrowLeft} title="Quay lại" tone="giay" size="sm" onPress={() => setMode('upload')} />
            <Txt f="bold" size={18} color={c.muc}>Thẻ ghi nhớ 2 mặt từ Đề thi</Txt>
          </View>

          {questions.length === 0 ? (
            <Card style={{ padding: 28, alignItems: 'center', gap: 12 }}>
              <Txt f="bold" size={16}>Chưa có câu hỏi nào để tạo thẻ ghi nhớ</Txt>
              <Btn icon={Upload} title="Tải File Đề (.docx) lên ngay" tone="thuy" onPress={triggerFilePicker} />
            </Card>
          ) : (
            <Card style={{ padding: 24, borderRadius: 20, gap: 16 }}>
              {(() => {
                const cardQ = questions[fcIdx % questions.length];
                let answerDisplay = '';
                if (cardQ.qtype === 'mcq' || cardQ.qtype === 'dropdown') {
                  const idx = cardQ.correctIndex >= 0 ? cardQ.correctIndex : 0;
                  answerDisplay = `${['A', 'B', 'C', 'D'][idx] || 'A'}. ${cardQ.options[idx] || ''}`;
                } else if (cardQ.qtype === 'truefalse_4') {
                  answerDisplay = cardQ.tfStatements
                    .map((_s, i) => `${['a)', 'b)', 'c)', 'd)'][i]} ${cardQ.tfCorrect[i] ? 'ĐÚNG' : 'SAI'}`)
                    .join('\n');
                } else {
                  answerDisplay = cardQ.shortAnswer || cardQ.explanation;
                }

                return (
                  <>
                    <Pressable
                      onPress={() => setFcFlipped(!fcFlipped)}
                      style={{
                        minHeight: 240,
                        padding: 28,
                        borderRadius: 20,
                        backgroundColor: fcFlipped ? c.ngocNhat : c.giay2,
                        borderWidth: 2,
                        borderColor: fcFlipped ? c.ngoc : c.vien,
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16,
                      }}
                    >
                      <Txt size={12} color={c.muc3}>
                        Thẻ {(fcIdx % questions.length) + 1}/{questions.length} (Bấm để lật)
                      </Txt>
                      <Txt f="bold" size={18} color={fcFlipped ? c.ngocChu : c.muc} center style={{ lineHeight: 26 }}>
                        {fcFlipped ? answerDisplay : cardQ.prompt}
                      </Txt>
                      <Txt size={12} color={c.muc3}>
                        {fcFlipped ? 'Mặt sau (Đáp án)' : 'Mặt trước (Câu hỏi)'}
                      </Txt>
                    </Pressable>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Btn
                        title="← Thẻ trước"
                        tone="giay"
                        size="sm"
                        onPress={() => {
                          setFcFlipped(false);
                          setFcIdx((p) => (p - 1 + questions.length) % questions.length);
                        }}
                      />
                      <Btn
                        title="Lật thẻ"
                        tone="thuy"
                        size="sm"
                        onPress={() => setFcFlipped(!fcFlipped)}
                      />
                      <Btn
                        title="Thẻ tiếp →"
                        tone="giay"
                        size="sm"
                        onPress={() => {
                          setFcFlipped(false);
                          setFcIdx((p) => (p + 1) % questions.length);
                        }}
                      />
                    </View>
                  </>
                );
              })()}
            </Card>
          )}
        </View>
      ) : null}

      {/* ====================================================================
          CHẾ ĐỘ 5: LÀM THỬ & CHẤM ĐIỂM TOÀN BỘ QUIZ (INTERACTIVE PLAYER)
         ==================================================================== */}
      {mode === 'preview' ? (
        <View style={{ gap: 16 }}>
          <Card style={{ padding: 20, borderRadius: 18, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Btn icon={ArrowLeft} title="Quay lại Biên tập" tone="giay" size="sm" onPress={() => setMode('editor')} />
                <View>
                  <Txt f="bold" size={18} color={c.muc}>{examTitle}</Txt>
                  <Txt size={13} color={c.muc2}>
                    Thời gian: {durationMinutes} phút • Tổng số câu: {questions.length} câu
                  </Txt>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {submittedExam ? (
                  <Btn
                    icon={RotateCcw}
                    title="Làm lại từ đầu"
                    tone="giay"
                    size="sm"
                    onPress={() => {
                      setUserMcqAnswers({});
                      setUserTfAnswers({});
                      setUserShortAnswers({});
                      setUserEssayAnswers({});
                      setSubmittedExam(false);
                    }}
                  />
                ) : null}
                <Btn
                  icon={CheckCircle2}
                  title={submittedExam ? `Đã chấm: ${examScoreSummary.earned}/${examScoreSummary.maxAuto} điểm` : 'Nộp bài & Chấm điểm'}
                  tone="ngoc"
                  size="md"
                  onPress={() => {
                    setSubmittedExam(true);
                    toast(`Kết quả: ${examScoreSummary.earned}/${examScoreSummary.maxAuto} điểm!`);
                  }}
                  testID="submit-smart-exam"
                />
              </View>
            </View>
          </Card>

          {questions.map((q, idx) => {
            const pickedMcq = userMcqAnswers[q.uid];
            const pickedTf = userTfAnswers[q.uid] || {};
            const shortAns = userShortAnswers[q.uid] || '';
            const essayAns = userEssayAnswers[q.uid] || '';

            return (
              <Card key={q.uid} style={{ padding: 18, borderRadius: 16, gap: 12 }}>
                <Txt f="bold" size={15} color={c.muc}>
                  Câu {idx + 1} ({q.points} điểm): {q.prompt}
                </Txt>
                {q.imageUrl ? (
                  <Image
                    source={{ uri: q.imageUrl }}
                    style={{ width: 320, height: 180, borderRadius: 10, backgroundColor: '#FFFFFF' }}
                    resizeMode="contain"
                  />
                ) : null}

                {q.qtype === 'mcq' || q.qtype === 'dropdown' ? (
                  <View style={{ gap: 8 }}>
                    {q.options.map((opt, oIdx) => {
                      const selected = pickedMcq === oIdx;
                      const isCorrect = q.correctIndex === oIdx;
                      return (
                        <Pressable
                          key={oIdx}
                          disabled={submittedExam}
                          onPress={() => setUserMcqAnswers((prev) => ({ ...prev, [q.uid]: oIdx }))}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            padding: 12,
                            borderRadius: 12,
                            borderWidth: 1.5,
                            borderColor: submittedExam ? (isCorrect ? c.ngoc : selected ? c.son : c.vien) : selected ? c.thuy : c.vien,
                            backgroundColor: submittedExam ? (isCorrect ? c.ngocNhat : selected ? c.sonNhat : c.the) : selected ? c.thuyNhat : c.the,
                          }}
                        >
                          {selected ? <CheckCircle2 size={18} color={c.thuyChu} /> : <Circle size={18} color={c.muc3} />}
                          <Txt f={selected || (submittedExam && isCorrect) ? 'bold' : 'body'} size={14} color={c.muc} style={{ flex: 1 }}>
                            {['A', 'B', 'C', 'D', 'E'][oIdx]}. {opt}
                          </Txt>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : q.qtype === 'truefalse_4' ? (
                  <View style={{ gap: 8 }}>
                    {q.tfStatements.map((stmt, sIdx) => {
                      const val = pickedTf[sIdx];
                      return (
                        <View key={sIdx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 10, borderRadius: 10, backgroundColor: c.giay2 }}>
                          <Txt size={13} color={c.muc} style={{ flex: 1 }}>
                            {['a)', 'b)', 'c)', 'd)'][sIdx]} {stmt}
                          </Txt>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <Btn
                              title="Đúng"
                              tone={val === true ? 'ngoc' : 'giay'}
                              size="sm"
                              disabled={submittedExam}
                              onPress={() => setUserTfAnswers((prev) => ({ ...prev, [q.uid]: { ...(prev[q.uid] || {}), [sIdx]: true } }))}
                            />
                            <Btn
                              title="Sai"
                              tone={val === false ? 'son' : 'giay'}
                              size="sm"
                              disabled={submittedExam}
                              onPress={() => setUserTfAnswers((prev) => ({ ...prev, [q.uid]: { ...(prev[q.uid] || {}), [sIdx]: false } }))}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : q.qtype === 'short_answer' || q.qtype === 'blank' || q.qtype === 'drag_drop' ? (
                  <Field
                    label="Câu trả lời của bạn"
                    value={shortAns}
                    onChangeText={(v) => setUserShortAnswers((prev) => ({ ...prev, [q.uid]: v }))}
                    editable={!submittedExam}
                    placeholder="Nhập đáp án..."
                  />
                ) : (
                  <Field
                    label="Bài làm tự luận"
                    value={essayAns}
                    onChangeText={(v) => setUserEssayAnswers((prev) => ({ ...prev, [q.uid]: v }))}
                    editable={!submittedExam}
                    multiline
                    numberOfLines={4}
                  />
                )}
              </Card>
            );
          })}
        </View>
      ) : null}

      {/* ====================================================================
          CÁC MODAL PHỤ TRỢ (9 DẠNG CÂU HỎI, SLIDE XEM TRƯỚC, CHỈNH SỬA NỀN TÍM, CÀI ĐẶT)
         ==================================================================== */}
      {renderQuestionTypePickerModal()}
      {renderSlidePreviewModal()}
      {renderPurpleQuestionEditorModal()}

      {/* Sheet Cài đặt thông tin đề thi */}
      {settingsOpen ? (
        <Sheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          title="Cài đặt đề thi"
          subtitle="Thiết lập tiêu đề và thời gian làm bài"
          footer={
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <Btn title="Đóng" tone="thuy" onPress={() => setSettingsOpen(false)} />
            </View>
          }
        >
          <View style={{ gap: 12 }}>
            <Field label="Tên đề thi" value={examTitle} onChangeText={setExamTitle} />
            <Field
              label="Thời gian làm bài (phút)"
              value={String(durationMinutes)}
              onChangeText={(v) => setDurationMinutes(Number(v) || 45)}
              keyboardType="numeric"
            />
            <Txt size={12} color={c.muc3}>
              Tổng số câu hỏi hiện tại: {questions.length} câu ({stats.mcqCount} Trắc nghiệm, {stats.tfCount} Đúng/Sai, {stats.shortCount} Trả lời ngắn, {stats.essayCount} Tự luận).
            </Txt>
          </View>
        </Sheet>
      ) : null}

      {/* Sheet Nhập từ Biểu mẫu / Dán nội dung văn bản */}
      {pasteModalOpen ? (
        <Sheet
          open={pasteModalOpen}
          onClose={() => setPasteModalOpen(false)}
          title="Nhập nội dung Đề thi & Bảng đáp án"
          subtitle="Dán nội dung từ Google Biểu mẫu hoặc tài liệu văn bản"
          wide
          footer={
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <Btn title="Hủy" tone="giay" onPress={() => setPasteModalOpen(false)} />
              <Btn
                title="Phân tích & Nhập câu hỏi"
                tone="thuy"
                disabled={pasteRawText.trim().length < 20}
                onPress={() => {
                  handleLoadFromRawText(pasteRawText, 'De-thi-nhap-tu-bieu-mau.docx');
                  setPasteModalOpen(false);
                }}
              />
            </View>
          }
        >
          <Field
            label="Nội dung đề thi (hỗ trợ cả Bảng đáp án ở cuối)"
            value={pasteRawText}
            onChangeText={setPasteRawText}
            multiline
            numberOfLines={10}
            inputStyle={{ minHeight: 220, textAlignVertical: 'top' }}
            placeholder="Câu 1. Nội dung câu hỏi...\nA. Phương án A\nB. Phương án B\nC. Phương án C\nD. Phương án D"
          />
        </Sheet>
      ) : null}
    </View>
  );
};
