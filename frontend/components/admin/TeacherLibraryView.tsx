/**
 * Thư viện Học liệu & Đề thi Giáo viên (Chuẩn giao diện Thư mục / Tạo bởi tôi / Bộ sưu tập).
 * - Khi giáo viên bấm "Xuất bản" hoặc "Lưu bản nháp" trong SmartExamStudio, đề thi tự động hiển thị tại đây.
 * - Hỗ trợ bật/tắt công tắc "Xuất bản" trực tiếp trên bảng Thư mục, lọc Tất cả / Bản nháp / Đã xuất bản ở "Tạo bởi tôi",
 *   mở lại để Chỉnh sửa, Xem trước Slide, Trộn mã đề 101–104, Nhân bản, Tổ chức thi hoặc Xóa.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Copy,
  Edit3,
  Eye,
  FileText,
  Folder,
  FolderPlus,
  MoreVertical,
  PenTool,
  Play,
  Plus,
  Search,
  Send,
  Shuffle,
  Trash2,
} from 'lucide-react-native';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import * as learningApi from '@/api/learningApi';
import { SmartExamStudio, type SmartStudioMode } from '@/components/admin/SmartExamStudio';
import type { Session } from '@/components/auth';
import { Btn, Card, Chip, ConfirmSheet, EmptyState, Field, Sheet, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import {
  createCollectionInState,
  createFolderInState,
  deleteExamInState,
  duplicateExamInState,
  formatLibraryDate,
  formatRelativeTime,
  loadTeacherLibrary,
  saveTeacherLibrary,
  SYSTEM_EXAM_BANK_FOLDER_ID,
  toggleExamPublishedInState,
  type TeacherLibraryExam,
  type TeacherLibraryState,
} from '@/lib/teacher-library';
import type { QuizItem } from '@/types/learning';

type LibrarySection = 'folders' | 'created_by_me' | 'recently_used' | 'assigned' | 'collection';
type CreatedFilter = 'all' | 'draft' | 'published';

export interface TeacherLibraryViewProps {
  session: Session;
  onStartLiveQuiz?: (quizId: number) => void;
  initialOpenExamId?: string | null;
}

export const TeacherLibraryView: React.FC<TeacherLibraryViewProps> = ({
  session,
  onStartLiveQuiz,
}) => {
  const { c } = useTheme();
  const toast = useToast();
  const userId = session.user.id;
  const authorName = session.user.full_name || session.user.username || 'Giáo viên';

  const [libState, setLibState] = useState<TeacherLibraryState>(() => loadTeacherLibrary(userId));
  const [section, setSection] = useState<LibrarySection>('folders');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [createdFilter, setCreatedFilter] = useState<CreatedFilter>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'most_questions' | 'title'>('newest');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal & menu state
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [openMenuExamId, setOpenMenuExamId] = useState<string | null>(null);
  const [confirmDeleteExam, setConfirmDeleteExam] = useState<TeacherLibraryExam | null>(null);

  // Studio composer state
  const [studioTarget, setStudioTarget] = useState<{
    mode: SmartStudioMode;
    exam?: TeacherLibraryExam | null;
  } | null>(null);

  const reloadLocal = useCallback(() => {
    setLibState(loadTeacherLibrary(userId));
  }, [userId]);

  // Đồng bộ thêm các bộ đề sẵn có trên server (nếu có) vào danh sách cục bộ mà không ghi đè đề đã biên tập
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await learningApi.listQuizzes(session.token, { page: 1, page_size: 40 });
        if (cancelled || !res?.items?.length) return;
        const current = loadTeacherLibrary(userId);
        const knownBackendIds = new Set(
          current.exams.map((e) => e.backendQuizId).filter((id): id is number => typeof id === 'number'),
        );
        const missing = (res.items as QuizItem[]).filter((q) => !knownBackendIds.has(q.id));
        if (!missing.length) return;
        const imported: TeacherLibraryExam[] = missing.map((q) => ({
          id: `server-quiz-${q.id}`,
          backendQuizId: q.id,
          title: q.title,
          description: q.description || `${q.question_count || 0} câu hỏi`,
          folderId: SYSTEM_EXAM_BANK_FOLDER_ID,
          published: q.scope === 'system' || q.scope === 'school' || q.assigned > 0 || q.attempts > 0,
          questionCount: q.question_count || 0,
          attemptsCount: q.attempts || 0,
          assignedCount: q.assigned || 0,
          durationMinutes: Math.max(10, Math.round((q.total_seconds || (q.question_count || 10) * (q.seconds_per_question || 30)) / 60)),
          questions: [],
          authorName: q.owner_name || authorName,
          collectionIds: [],
          createdAt: q.updated_at || new Date().toISOString(),
          updatedAt: q.updated_at || new Date().toISOString(),
          lastUsedAt: null,
        }));
        const next: TeacherLibraryState = {
          ...current,
          exams: [...current.exams, ...imported],
        };
        saveTeacherLibrary(userId, next);
        setLibState(next);
      } catch {
        // Không làm gián đoạn giao diện nếu offline
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authorName, session.token, userId]);

  const updateState = (next: TeacherLibraryState) => {
    saveTeacherLibrary(userId, next);
    setLibState(next);
  };

  const handleTogglePublish = (exam: TeacherLibraryExam) => {
    const next = toggleExamPublishedInState(libState, exam.id);
    updateState(next);
    toast(!exam.published ? `Đã xuất bản “${exam.title}”` : `Đã chuyển “${exam.title}” về Bản nháp`);
  };

  const handleDuplicate = (exam: TeacherLibraryExam) => {
    const next = duplicateExamInState(libState, exam.id);
    updateState(next);
    setOpenMenuExamId(null);
    toast(`Đã tạo bản sao “${exam.title} (Bản sao)”`);
  };

  const handleDeleteExam = () => {
    if (!confirmDeleteExam) return;
    const next = deleteExamInState(libState, confirmDeleteExam.id);
    updateState(next);
    setConfirmDeleteExam(null);
    setOpenMenuExamId(null);
    toast('Đã xóa đề thi khỏi Thư viện');
  };

  const handleOpenExamInStudio = (exam: TeacherLibraryExam, mode: SmartStudioMode = 'editor') => {
    setOpenMenuExamId(null);
    // Đánh dấu thời điểm sử dụng gần nhất
    const nowIso = new Date().toISOString();
    const touched: TeacherLibraryState = {
      ...libState,
      exams: libState.exams.map((e) => (e.id === exam.id ? { ...e, lastUsedAt: nowIso } : e)),
    };
    updateState(touched);
    setStudioTarget({ mode, exam });
  };

  const draftExamsCount = useMemo(() => libState.exams.filter((e) => !e.published).length, [libState.exams]);
  const publishedExamsCount = useMemo(() => libState.exams.filter((e) => e.published).length, [libState.exams]);
  const recentlyUsedCount = useMemo(() => libState.exams.filter((e) => Boolean(e.lastUsedAt)).length, [libState.exams]);
  const assignedCount = useMemo(() => libState.exams.filter((e) => e.assignedCount > 0).length, [libState.exams]);

  const filteredExams = useMemo(() => {
    let list = [...libState.exams];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
    }

    if (section === 'folders' && activeFolderId) {
      list = list.filter((e) => e.folderId === activeFolderId);
    } else if (section === 'created_by_me') {
      if (createdFilter === 'draft') list = list.filter((e) => !e.published);
      else if (createdFilter === 'published') list = list.filter((e) => e.published);
    } else if (section === 'recently_used') {
      list = list.filter((e) => Boolean(e.lastUsedAt));
    } else if (section === 'assigned') {
      list = list.filter((e) => e.assignedCount > 0);
    } else if (section === 'collection' && activeCollectionId) {
      list = list.filter((e) => e.collectionIds.includes(activeCollectionId));
    }

    if (sortOrder === 'most_questions') {
      list.sort((a, b) => b.questionCount - a.questionCount);
    } else if (sortOrder === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title, 'vi'));
    } else {
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    return list;
  }, [activeCollectionId, activeFolderId, createdFilter, libState.exams, searchQuery, section, sortOrder]);

  // Nếu đang mở trình soạn / biên tập / trộn đề của SmartExamStudio
  if (studioTarget) {
    const ex = studioTarget.exam;
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16, maxWidth: 1180, alignSelf: 'center', width: '100%' }}
        keyboardShouldPersistTaps="handled"
      >
        <SmartExamStudio
          session={session}
          initialMode={studioTarget.mode}
          authorName={authorName}
          initialExam={
            ex
              ? {
                  id: ex.id,
                  title: ex.title,
                  durationMinutes: ex.durationMinutes,
                  questions: ex.questions,
                  folderId: ex.folderId,
                  published: ex.published,
                  sourceFileName: ex.sourceFileName,
                }
              : undefined
          }
          onClose={() => {
            setStudioTarget(null);
            reloadLocal();
          }}
          onPublishedToLibrary={(_savedId, published) => {
            setStudioTarget(null);
            reloadLocal();
            setSection('created_by_me');
            setCreatedFilter(published ? 'published' : 'draft');
          }}
        />
      </ScrollView>
    );
  }

  const activeFolder = activeFolderId ? libState.folders.find((f) => f.id === activeFolderId) : null;

  return (
    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 18, padding: 20, alignItems: 'flex-start' }}>
      {/* CỘT TRÁI: MENU THƯ VIỆN & BỘ SƯU TẬP */}
      <View style={{ width: 240, flexGrow: 0, flexShrink: 0, gap: 14 }}>
        <Card style={{ padding: 14, gap: 6, borderRadius: 16 }}>
          <Txt f="bold" size={11} color={c.muc3} style={{ letterSpacing: 0.6, paddingHorizontal: 8, marginBottom: 4 }}>
            THƯ VIỆN
          </Txt>

          {(
            [
              { id: 'folders' as const, label: 'Thư mục', icon: Folder, badge: libState.folders.length },
              { id: 'created_by_me' as const, label: 'Tạo bởi tôi', icon: PenTool, badge: libState.exams.length },
              { id: 'recently_used' as const, label: 'Trước đây đã sử dụng', icon: Clock, badge: recentlyUsedCount },
              { id: 'assigned' as const, label: 'Hoạt động đã giao', icon: Send, badge: assignedCount },
            ] as const
          ).map((item) => {
            const active = section === item.id;
            const IconComp = item.icon;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  setSection(item.id);
                  if (item.id === 'folders') setActiveFolderId(null);
                }}
                testID={`library-nav-${item.id}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 10,
                  paddingVertical: 9,
                  borderRadius: 10,
                  backgroundColor: active ? c.thuyNhat : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 }}>
                  <IconComp size={16} color={active ? c.thuyChu : c.muc2} />
                  <Txt f={active ? 'bold' : 'semibold'} size={13} color={active ? c.thuyChu : c.muc}>
                    {item.label}
                  </Txt>
                </View>
                <View
                  style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: active ? '#FFFFFF' : c.giay2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 6,
                  }}
                >
                  <Txt f="bold" size={11} color={active ? c.thuyChu : c.muc2}>{item.badge}</Txt>
                </View>
              </Pressable>
            );
          })}
        </Card>

        {/* BỘ SƯU TẬP */}
        <Card style={{ padding: 14, gap: 10, borderRadius: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
            <Txt f="bold" size={11} color={c.muc3} style={{ letterSpacing: 0.6 }}>
              BỘ SƯU TẬP
            </Txt>
            <Btn icon={Plus} title="Mới" tone="giay" size="sm" onPress={() => setNewCollectionOpen(true)} />
          </View>

          {libState.collections.length === 0 ? (
            <View
              style={{
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: c.vien,
                borderRadius: 12,
                padding: 14,
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Txt f="bold" size={12} color={c.muc}>Chưa có bộ sưu tập</Txt>
              <Txt size={11} color={c.muc3} center>
                Tạo bộ sưu tập mới để lưu các đề quan trọng.
              </Txt>
            </View>
          ) : (
            <View style={{ gap: 4 }}>
              {libState.collections.map((col) => {
                const active = section === 'collection' && activeCollectionId === col.id;
                const count = libState.exams.filter((e) => e.collectionIds.includes(col.id)).length;
                return (
                  <Pressable
                    key={col.id}
                    onPress={() => {
                      setSection('collection');
                      setActiveCollectionId(col.id);
                    }}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: active ? c.thuyNhat : 'transparent',
                    }}
                  >
                    <Txt f={active ? 'bold' : 'semibold'} size={13} color={active ? c.thuyChu : c.muc}>
                      {col.name}
                    </Txt>
                    <Chip text={`${count}`} bg={c.giay2} fg={c.muc2} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </Card>
      </View>

      {/* KHU VỰC CHÍNH BÊN PHẢI */}
      <View style={{ flex: 1, minWidth: 320, gap: 14 }}>
        {/* HEADER CHẾ ĐỘ THƯ MỤC */}
        {section === 'folders' ? (
          <Card style={{ padding: 16, borderRadius: 18, gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {activeFolder ? (
                  <Btn icon={ArrowLeft} label="Về Thư mục của tôi" tone="giay" size="sm" onPress={() => setActiveFolderId(null)} />
                ) : null}
                <Chip text={activeFolder ? activeFolder.name : 'Thư mục của tôi'} bg={c.giay2} fg={c.muc} />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: c.vien,
                    backgroundColor: c.giay2,
                    minWidth: 200,
                  }}
                >
                  <Search size={14} color={c.muc3} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Tìm đề trong thư mục..."
                    placeholderTextColor={c.muc3}
                    style={{ flex: 1, fontSize: 13, color: c.muc }}
                  />
                </View>
                <Btn icon={FolderPlus} title="Thư mục mới" tone="giay" size="sm" onPress={() => setNewFolderOpen(true)} />
                <Btn
                  icon={Plus}
                  title="Tạo đề"
                  tone="son"
                  size="sm"
                  onPress={() => setStudioTarget({ mode: 'upload', exam: null })}
                  testID="library-create-exam-btn"
                />
              </View>
            </View>

            {/* BẢNG DANH SÁCH THƯ MỤC & ĐỀ THI */}
            <View style={{ borderTopWidth: 1, borderTopColor: c.vien }}>
              {/* Table Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: c.vien,
                }}
              >
                <Txt f="bold" size={11} color={c.muc3} style={{ flex: 3 }}>TÊN</Txt>
                <Txt f="bold" size={11} color={c.muc3} style={{ flex: 1.2 }}>NỘI DUNG</Txt>
                <Txt f="bold" size={11} color={c.muc3} style={{ flex: 1 }}>GIAO BÀI</Txt>
                <Txt f="bold" size={11} color={c.muc3} style={{ width: 120, textAlign: 'right' }}>CẬP NHẬT</Txt>
              </View>

              {/* Danh sách Thư mục khi đang ở thư mục gốc */}
              {!activeFolder
                ? libState.folders.map((folder) => {
                    const countInFolder = libState.exams.filter((e) => e.folderId === folder.id).length;
                    return (
                      <Pressable
                        key={folder.id}
                        onPress={() => setActiveFolderId(folder.id)}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 12,
                          paddingHorizontal: 8,
                          borderBottomWidth: 1,
                          borderBottomColor: c.vien,
                          backgroundColor: pressed ? c.giay2 : 'transparent',
                        })}
                      >
                        <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Folder size={18} color={c.muc2} />
                          <Txt f="bold" size={14} color={c.muc}>{folder.name}</Txt>
                          {folder.isSystem ? <Txt f="bold" size={11} color={c.sonChu}>Hệ thống</Txt> : null}
                        </View>
                        <Txt size={12} color={c.muc2} style={{ flex: 1.2 }}>{countInFolder} đề thi</Txt>
                        <Txt size={12} color={c.muc3} style={{ flex: 1 }}>—</Txt>
                        <Txt size={12} color={c.muc3} style={{ width: 120, textAlign: 'right' }}>
                          {formatLibraryDate(folder.createdAt)}
                        </Txt>
                      </Pressable>
                    );
                  })
                : null}

              {/* Danh sách Đề thi */}
              {filteredExams.length === 0 ? (
                <View style={{ paddingVertical: 28, alignItems: 'center', gap: 8 }}>
                  <Txt f="bold" size={15} color={c.muc}>Chưa có đề thi nào trong mục này</Txt>
                  <Txt size={13} color={c.muc2} center>
                    Bấm “+ Tạo đề” để tải file Word (.docx) hoặc tự biên tập bộ đề và xuất bản vào Thư viện.
                  </Txt>
                  <Btn
                    icon={Plus}
                    title="Tạo / Số hóa Đề mới"
                    tone="son"
                    size="sm"
                    onPress={() => setStudioTarget({ mode: 'upload', exam: null })}
                  />
                </View>
              ) : (
                filteredExams.map((exam) => (
                  <View
                    key={exam.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: c.vien,
                      gap: 8,
                    }}
                  >
                    {/* Cột TÊN + công tắc Xuất bản */}
                    <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          backgroundColor: '#EEF2FF',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <FileText size={16} color="#4F46E5" />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Pressable onPress={() => handleOpenExamInStudio(exam, 'editor')}>
                          <Txt f="bold" size={14} color={c.muc} numberOfLines={1}>{exam.title}</Txt>
                        </Pressable>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Txt size={12} color={exam.published ? c.ngocChu : c.muc3}>
                            {exam.published ? 'Xuất bản' : 'Bản nháp'}
                          </Txt>
                          <Switch
                            value={exam.published}
                            onValueChange={() => handleTogglePublish(exam)}
                            trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                            thumbColor="#FFFFFF"
                          />
                        </View>
                      </View>
                    </View>

                    {/* Cột NỘI DUNG */}
                    <View style={{ flex: 1.2 }}>
                      <Txt f="semibold" size={12} color={c.muc}>{exam.questionCount} câu hỏi</Txt>
                      <Txt size={11} color={c.muc3}>{exam.attemptsCount} lượt thi</Txt>
                    </View>

                    {/* Cột GIAO BÀI */}
                    <View style={{ flex: 1, alignItems: 'flex-start' }}>
                      {exam.backendQuizId && onStartLiveQuiz ? (
                        <Btn
                          icon={Play}
                          title="Tổ chức thi"
                          tone="giay"
                          size="sm"
                          onPress={() => onStartLiveQuiz(exam.backendQuizId!)}
                        />
                      ) : (
                        <Btn
                          icon={Edit3}
                          title="Biên tập"
                          tone="giay"
                          size="sm"
                          onPress={() => handleOpenExamInStudio(exam, 'editor')}
                        />
                      )}
                    </View>

                    {/* Cột CẬP NHẬT + Menu 3 chấm */}
                    <View style={{ width: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      <Txt size={12} color={c.muc2}>{formatLibraryDate(exam.updatedAt)}</Txt>
                      <Pressable
                        onPress={() => setOpenMenuExamId(openMenuExamId === exam.id ? null : exam.id)}
                        style={{ width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <MoreVertical size={16} color={c.muc2} />
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          </Card>
        ) : (
          /* CHẾ ĐỘ "TẠO BỞI TÔI" / "ĐÃ SỬ DỤNG" / "ĐÃ GIAO" / "BỘ SƯU TẬP" */
          <Card style={{ padding: 18, borderRadius: 18, gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <View>
                <Txt f="bold" size={18} color={c.muc}>
                  {section === 'created_by_me'
                    ? 'Tạo bởi tôi'
                    : section === 'recently_used'
                      ? 'Trước đây đã sử dụng'
                      : section === 'assigned'
                        ? 'Hoạt động đã giao'
                        : libState.collections.find((col) => col.id === activeCollectionId)?.name || 'Bộ sưu tập'}
                </Txt>
                <Txt size={12} color={c.muc2}>
                  Danh sách các đề thi bạn đã biên tập và lưu trong Thư viện
                </Txt>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Chip text={`${filteredExams.length} đề thi`} bg={c.thuyNhat} fg={c.thuyChu} />
                <Btn
                  title={sortOrder === 'newest' ? 'Sắp xếp: Mới nhất' : sortOrder === 'most_questions' ? 'Nhiều câu nhất' : 'Tên A–Z'}
                  tone="giay"
                  size="sm"
                  onPress={() =>
                    setSortOrder((prev) => (prev === 'newest' ? 'most_questions' : prev === 'most_questions' ? 'title' : 'newest'))
                  }
                />
                <Btn
                  icon={Plus}
                  title="Tạo đề mới"
                  tone="son"
                  size="sm"
                  onPress={() => setStudioTarget({ mode: 'upload', exam: null })}
                />
              </View>
            </View>

            {/* Filter Pills: Tất cả / Bản nháp / Đã xuất bản */}
            {section === 'created_by_me' ? (
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {(
                  [
                    { id: 'all' as const, label: `Tất cả (${libState.exams.length})` },
                    { id: 'draft' as const, label: `Bản nháp (${draftExamsCount})` },
                    { id: 'published' as const, label: `Đã xuất bản (${publishedExamsCount})` },
                  ] as const
                ).map((pill) => {
                  const active = createdFilter === pill.id;
                  return (
                    <Btn
                      key={pill.id}
                      title={pill.label}
                      tone={active ? 'son' : 'giay'}
                      size="sm"
                      onPress={() => setCreatedFilter(pill.id)}
                      testID={`library-filter-${pill.id}`}
                    />
                  );
                })}
              </View>
            ) : null}

            {filteredExams.length === 0 ? (
              <EmptyState
                mood="thinking"
                title="Chưa có đề thi phù hợp"
                text="Hãy bấm “Tạo đề mới” để tải đề Word (.docx) hoặc biên tập bộ đề và xuất bản vào Thư viện."
              />
            ) : (
              <View style={{ gap: 12 }}>
                {filteredExams.map((exam) => (
                  <View
                    key={exam.id}
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: c.vien,
                      backgroundColor: c.the,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, minWidth: 260 }}>
                      <View
                        style={{
                          width: 96,
                          height: 68,
                          borderRadius: 10,
                          backgroundColor: exam.published ? '#EEF2FF' : '#FEF3C7',
                          borderWidth: 1,
                          borderColor: c.vien,
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                        }}
                      >
                        <FileText size={22} color={exam.published ? '#4F46E5' : '#D97706'} />
                        <Txt f="bold" size={10} color={exam.published ? '#4F46E5' : '#D97706'}>
                          {exam.questionCount} câu
                        </Txt>
                      </View>

                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Chip text="Đề thi" bg={c.ngocNhat} fg={c.ngocChu} />
                          {exam.published ? (
                            <Chip text="Đã xuất bản" bg={c.thuyNhat} fg={c.thuyChu} />
                          ) : (
                            <Chip text="Chưa xuất bản" bg={c.sonNhat} fg={c.sonChu} />
                          )}
                        </View>
                        <Pressable onPress={() => handleOpenExamInStudio(exam, 'editor')}>
                          <Txt f="bold" size={15} color={c.muc}>{exam.title}</Txt>
                        </Pressable>
                        <Txt size={12} color={c.muc2}>
                          {exam.questionCount} câu hỏi · {exam.attemptsCount} lượt thi · {exam.authorName} · {formatRelativeTime(exam.updatedAt)}
                        </Txt>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Btn
                        icon={Edit3}
                        title="Chỉnh sửa"
                        tone="giay"
                        size="sm"
                        onPress={() => handleOpenExamInStudio(exam, 'editor')}
                      />
                      <Btn
                        icon={Shuffle}
                        title="Trộn mã đề"
                        tone="giay"
                        size="sm"
                        onPress={() => handleOpenExamInStudio(exam, 'mix')}
                      />
                      <Btn
                        icon={exam.backendQuizId && onStartLiveQuiz ? Play : Eye}
                        title={exam.backendQuizId && onStartLiveQuiz ? 'Tổ chức thi' : 'Xem trước'}
                        tone="son"
                        size="sm"
                        onPress={() => {
                          if (exam.backendQuizId && onStartLiveQuiz) onStartLiveQuiz(exam.backendQuizId);
                          else handleOpenExamInStudio(exam, 'editor');
                        }}
                      />
                      <Pressable
                        onPress={() => setOpenMenuExamId(openMenuExamId === exam.id ? null : exam.id)}
                        style={{ width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: c.giay2 }}
                      >
                        <MoreVertical size={16} color={c.muc2} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}
      </View>

      {/* SHEET THAO TÁC TRÊN TỪNG ĐỀ THI (⋮) */}
      {openMenuExamId ? (
        (() => {
          const target = libState.exams.find((e) => e.id === openMenuExamId);
          if (!target) return null;
          return (
            <Sheet
              open
              onClose={() => setOpenMenuExamId(null)}
              title={target.title}
              subtitle={`${target.questionCount} câu hỏi · ${target.published ? 'Đã xuất bản' : 'Bản nháp'}`}
            >
              <View style={{ gap: 8 }}>
                <Btn icon={Edit3} title="Mở trình Biên tập đề" tone="thuy" onPress={() => handleOpenExamInStudio(target, 'editor')} />
                <Btn icon={Shuffle} title="Trộn mã đề 101–104 & Xuất Word" tone="giay" onPress={() => handleOpenExamInStudio(target, 'mix')} />
                <Btn
                  icon={Send}
                  title={target.published ? 'Chuyển về Bản nháp' : 'Xuất bản đề thi'}
                  tone="ngoc"
                  onPress={() => {
                    handleTogglePublish(target);
                    setOpenMenuExamId(null);
                  }}
                />
                <Btn icon={Copy} title="Nhân bản đề thi" tone="giay" onPress={() => handleDuplicate(target)} />
                <Btn
                  icon={Trash2}
                  title="Xóa khỏi Thư viện"
                  tone="son"
                  onPress={() => {
                    setOpenMenuExamId(null);
                    setConfirmDeleteExam(target);
                  }}
                />
              </View>
            </Sheet>
          );
        })()
      ) : null}

      {/* MODAL TẠO THƯ MỤC MỚI */}
      <Sheet
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        title="Tạo thư mục mới"
        footer={
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Btn title="Hủy" tone="giay" onPress={() => setNewFolderOpen(false)} />
            <Btn
              title="Tạo thư mục"
              tone="son"
              disabled={!newFolderName.trim()}
              onPress={() => {
                const next = createFolderInState(libState, newFolderName);
                updateState(next);
                setNewFolderName('');
                setNewFolderOpen(false);
                toast('Đã tạo thư mục mới');
              }}
            />
          </View>
        }
      >
        <Field label="Tên thư mục" value={newFolderName} onChangeText={setNewFolderName} placeholder="Ví dụ: Đề kiểm tra Giữa HK1 Sử 7..." />
      </Sheet>

      {/* MODAL TẠO BỘ SƯU TẬP MỚI */}
      <Sheet
        open={newCollectionOpen}
        onClose={() => setNewCollectionOpen(false)}
        title="Tạo bộ sưu tập mới"
        footer={
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Btn title="Hủy" tone="giay" onPress={() => setNewCollectionOpen(false)} />
            <Btn
              title="Tạo bộ sưu tập"
              tone="son"
              disabled={!newCollectionName.trim()}
              onPress={() => {
                const next = createCollectionInState(libState, newCollectionName);
                updateState(next);
                setNewCollectionName('');
                setNewCollectionOpen(false);
                toast('Đã tạo bộ sưu tập mới');
              }}
            />
          </View>
        }
      >
        <Field label="Tên bộ sưu tập" value={newCollectionName} onChangeText={setNewCollectionName} placeholder="Ví dụ: Bộ đề ôn thi Học kỳ..." />
      </Sheet>

      <ConfirmSheet
        open={Boolean(confirmDeleteExam)}
        title="Xóa đề thi khỏi Thư viện?"
        message={`Đề thi “${confirmDeleteExam?.title ?? ''}” sẽ bị xóa khỏi danh sách của bạn.`}
        confirmLabel="Xóa"
        onCancel={() => setConfirmDeleteExam(null)}
        onConfirm={handleDeleteExam}
      />
    </View>
  );
};
