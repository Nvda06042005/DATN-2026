/**
 * Kho lưu trữ & Quản lý Thư viện Học liệu Giáo viên (Thư mục, Tạo bởi tôi, Bộ sưu tập, Bản nháp / Đã xuất bản).
 * Lưu trữ cục bộ theo mã giáo viên (kết hợp đồng bộ danh sách bộ đề từ máy chủ khi có),
 * giúp giáo viên xuất bản đề từ SmartExamStudio vào Thư viện, bật/tắt Xuất bản, lọc Bản nháp / Đã xuất bản và mở lại để chỉnh sửa.
 */
import type { ParsedExamQuestion } from '@/utils/docxQuizParser';

export interface TeacherLibraryFolder {
  id: string;
  name: string;
  isSystem?: boolean;
  createdAt: string;
}

export interface TeacherLibraryCollection {
  id: string;
  name: string;
  createdAt: string;
}

export interface TeacherLibraryExam {
  id: string;
  backendQuizId?: number;
  title: string;
  description: string;
  folderId: string;
  published: boolean;
  questionCount: number;
  attemptsCount: number;
  assignedCount: number;
  durationMinutes: number;
  questions: ParsedExamQuestion[];
  authorName: string;
  sourceFileName?: string;
  collectionIds: string[];
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | null;
}

export interface TeacherLibraryState {
  version: number;
  folders: TeacherLibraryFolder[];
  collections: TeacherLibraryCollection[];
  exams: TeacherLibraryExam[];
}

export const SYSTEM_EXAM_BANK_FOLDER_ID = 'folder-ngan-hang-de-thi';

const STORAGE_PREFIX = 'dong-a:teacher-library:v1:';
const memoryFallback = new Map<string, string>();

function getStorageKey(userId: number | string) {
  return `${STORAGE_PREFIX}${String(userId)}`;
}

function readStorage(key: string): string | null {
  try {
    const ls = (globalThis as { localStorage?: { getItem: (k: string) => string | null } }).localStorage;
    if (ls) return ls.getItem(key);
  } catch {
    // fallback in Node test environment
  }
  return memoryFallback.get(key) ?? null;
}

function writeStorage(key: string, val: string): void {
  memoryFallback.set(key, val);
  try {
    const ls = (globalThis as { localStorage?: { setItem: (k: string, v: string) => void } }).localStorage;
    if (ls) ls.setItem(key, val);
  } catch {
    // ignore storage quota errors
  }
}

export function createInitialTeacherLibraryState(): TeacherLibraryState {
  const now = new Date().toISOString();
  return {
    version: 1,
    folders: [
      {
        id: SYSTEM_EXAM_BANK_FOLDER_ID,
        name: 'Ngân hàng đề thi',
        isSystem: true,
        createdAt: now,
      },
    ],
    collections: [],
    exams: [],
  };
}

export function loadTeacherLibrary(userId: number | string): TeacherLibraryState {
  const raw = readStorage(getStorageKey(userId));
  if (!raw) return createInitialTeacherLibraryState();
  try {
    const parsed = JSON.parse(raw) as Partial<TeacherLibraryState>;
    const base = createInitialTeacherLibraryState();
    const folders = Array.isArray(parsed.folders) && parsed.folders.length > 0 ? parsed.folders : base.folders;
    const hasSystem = folders.some((f) => f.id === SYSTEM_EXAM_BANK_FOLDER_ID);
    return {
      version: 1,
      folders: hasSystem ? folders : [base.folders[0], ...folders],
      collections: Array.isArray(parsed.collections) ? parsed.collections : [],
      exams: Array.isArray(parsed.exams) ? parsed.exams : [],
    };
  } catch {
    return createInitialTeacherLibraryState();
  }
}

export function saveTeacherLibrary(userId: number | string, state: TeacherLibraryState): void {
  writeStorage(getStorageKey(userId), JSON.stringify(state));
}

export interface UpsertExamInput {
  id?: string;
  backendQuizId?: number;
  title: string;
  description?: string;
  folderId?: string;
  published: boolean;
  durationMinutes: number;
  questions: ParsedExamQuestion[];
  authorName: string;
  sourceFileName?: string;
}

export function upsertExamInState(state: TeacherLibraryState, input: UpsertExamInput, nowDate = new Date()): {
  state: TeacherLibraryState;
  saved: TeacherLibraryExam;
} {
  const nowIso = nowDate.toISOString();
  const targetId = input.id || `exam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const existing = state.exams.find((e) => e.id === targetId);
  const questionCount = input.questions.filter((q) => q.qtype !== 'title_group' && q.qtype !== 'paragraph').length || input.questions.length;

  const saved: TeacherLibraryExam = {
    id: targetId,
    backendQuizId: input.backendQuizId ?? existing?.backendQuizId,
    title: input.title.trim() || 'Đề kiểm tra mới',
    description: input.description?.trim() || existing?.description || `${questionCount} câu hỏi · ${input.durationMinutes} phút`,
    folderId: input.folderId || existing?.folderId || SYSTEM_EXAM_BANK_FOLDER_ID,
    published: input.published,
    questionCount,
    attemptsCount: existing?.attemptsCount ?? 0,
    assignedCount: existing?.assignedCount ?? 0,
    durationMinutes: input.durationMinutes || 45,
    questions: input.questions,
    authorName: input.authorName || existing?.authorName || 'Giáo viên Đông A',
    sourceFileName: input.sourceFileName ?? existing?.sourceFileName,
    collectionIds: existing?.collectionIds ?? [],
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
    lastUsedAt: existing?.lastUsedAt ?? null,
  };

  const nextExams = existing
    ? state.exams.map((e) => (e.id === targetId ? saved : e))
    : [saved, ...state.exams];

  return {
    state: { ...state, exams: nextExams },
    saved,
  };
}

export function upsertTeacherLibraryExam(
  userId: number | string,
  input: UpsertExamInput,
): TeacherLibraryExam {
  const cur = loadTeacherLibrary(userId);
  const { state, saved } = upsertExamInState(cur, input);
  saveTeacherLibrary(userId, state);
  return saved;
}

export function toggleExamPublishedInState(state: TeacherLibraryState, examId: string): TeacherLibraryState {
  const nowIso = new Date().toISOString();
  return {
    ...state,
    exams: state.exams.map((e) => (e.id === examId ? { ...e, published: !e.published, updatedAt: nowIso } : e)),
  };
}

export function createFolderInState(state: TeacherLibraryState, name: string): TeacherLibraryState {
  const clean = name.trim();
  if (!clean) return state;
  const folder: TeacherLibraryFolder = {
    id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name: clean,
    isSystem: false,
    createdAt: new Date().toISOString(),
  };
  return { ...state, folders: [...state.folders, folder] };
}

export function createCollectionInState(state: TeacherLibraryState, name: string): TeacherLibraryState {
  const clean = name.trim();
  if (!clean) return state;
  const col: TeacherLibraryCollection = {
    id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name: clean,
    createdAt: new Date().toISOString(),
  };
  return { ...state, collections: [...state.collections, col] };
}

export function toggleExamInCollectionState(
  state: TeacherLibraryState,
  examId: string,
  collectionId: string,
): TeacherLibraryState {
  return {
    ...state,
    exams: state.exams.map((e) => {
      if (e.id !== examId) return e;
      const has = e.collectionIds.includes(collectionId);
      return {
        ...e,
        collectionIds: has ? e.collectionIds.filter((c) => c !== collectionId) : [...e.collectionIds, collectionId],
      };
    }),
  };
}

export function duplicateExamInState(state: TeacherLibraryState, examId: string): TeacherLibraryState {
  const src = state.exams.find((e) => e.id === examId);
  if (!src) return state;
  const nowIso = new Date().toISOString();
  const copy: TeacherLibraryExam = {
    ...src,
    id: `exam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    backendQuizId: undefined,
    title: `${src.title} (Bản sao)`,
    published: false,
    attemptsCount: 0,
    assignedCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastUsedAt: null,
  };
  return { ...state, exams: [copy, ...state.exams] };
}

export function deleteExamInState(state: TeacherLibraryState, examId: string): TeacherLibraryState {
  return { ...state, exams: state.exams.filter((e) => e.id !== examId) };
}

export function formatLibraryDate(iso: string): string {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return formatLibraryDate(iso);
}
