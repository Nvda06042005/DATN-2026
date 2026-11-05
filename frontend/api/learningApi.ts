/** API học tập: soạn nội dung (/api/content), đọc kho lịch sử (/api/learn) và học – làm bài (/api/play). Mọi hàm nhận token đăng nhập. */
import { apiBlob, apiRequest, apiUpload, type PickedFile } from '@/api/client';
import type {
  AnswerResult, AttemptHistoryItem, AttemptReview, AttemptState, CampaignMap, Detail, FigureItem, GateGuide, GateInput, HistoryOption, JourneyDetail, JourneyItem, JourneyPreview, LearningPath, LessonCheckResult, LessonCompletion, LessonDetail, LessonInput,
  LessonItem, LessonView, Listing, ListenView, MapPlace, MenuDots, NodeDetail, NodeInput, NodeResult, NoteItem, QuestionDetail, QuestionImportResult, QuestionInput, QuestionItem, QuestionVersion, Quests,
  QuizDetail, QuizInput, QuizItem, SearchHit, ShareDetail, ShareItem, SourceItem, StudentHome, TeacherClass, TermItem, TimelineEntry,
} from '@/types/learning';
import type { CommitResult, MediaLibrary, StudioDraft, StudioListItem, StudioPayload } from '@/types/studio';

type Query = Record<string, string | number | boolean | null | undefined>;
const qs = (query: Query = {}) => {
  const parts = Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

// ---------------------------------------------------------------------- ngân hàng câu hỏi (HK.GV.030–039, HK.AD.045)
export const listQuestions = (token: string, query: Query) => apiRequest<Listing<QuestionItem>>(`/api/content/questions${qs(query)}`, { token });
export const getQuestion = (token: string, id: number) => apiRequest<QuestionDetail>(`/api/content/questions/${id}`, { token });
export const createQuestion = (token: string, body: QuestionInput) => apiRequest<QuestionDetail>('/api/content/questions', { token, body });
export const updateQuestion = (token: string, id: number, body: Partial<QuestionInput>) => apiRequest<QuestionDetail>(`/api/content/questions/${id}`, { token, method: 'PUT', body });
export const deleteQuestion = (token: string, id: number) => apiRequest<void>(`/api/content/questions/${id}`, { token, method: 'DELETE' });
export const questionVersions = (token: string, id: number) => apiRequest<QuestionVersion[]>(`/api/content/questions/${id}/versions`, { token });
export const copyQuestion = (token: string, id: number) => apiRequest<QuestionDetail>(`/api/content/questions/${id}/copy`, { token, body: {} });
export const questionTemplate = (token: string) => apiBlob('/api/content/questions/template', token);
export const exportQuestions = (token: string, query: Query) => apiBlob(`/api/content/questions/export${qs(query)}`, token);
export const importQuestions = (token: string, file: PickedFile, commit: boolean) => apiUpload<QuestionImportResult>(`/api/content/questions/import${commit ? '?commit=true' : ''}`, file, token);
export const historyOptions = (token: string, type: string, query: Query = {}) => apiRequest<HistoryOption[]>(`/api/content/history-options${qs({ type, ...query })}`, { token });

// ---------------------------------------------------------------------- bộ đề (HK.GV.040–044)
// ---------------------------------------------------------------------- trình soạn Quiz và ảnh tải lên (HK.GV.085–094)
export const studioDrafts = (token: string) => apiRequest<StudioListItem[]>('/api/content/studio', { token });
export const createStudioDraft = (token: string, fromQuizId?: number) => apiRequest<StudioDraft>('/api/content/studio', { token, body: fromQuizId ? { from_quiz_id: fromQuizId } : {} });
export const getStudioDraft = (token: string, id: number) => apiRequest<StudioDraft>(`/api/content/studio/${id}`, { token });
export const saveStudioDraft = (token: string, id: number, payload: StudioPayload) => apiRequest<{ id: number; updated_at: string }>(`/api/content/studio/${id}`, { token, method: 'PUT', body: payload });
export const commitStudio = (token: string, id: number) => apiRequest<CommitResult>(`/api/content/studio/${id}/commit`, { token, body: {} });
export const deleteStudio = (token: string, id: number) => apiRequest<{ deleted: boolean }>(`/api/content/studio/${id}`, { token, method: 'DELETE' });
export const uploadMedia = (token: string, body: { name: string; data: string }) => apiRequest<{ token: string; url: string; mime: string; kind: 'image' | 'video' | 'audio'; size_bytes: number }>('/api/content/media', { token, body, timeoutMs: 180_000 });
export const deleteMedia = (token: string, fileToken: string) => apiRequest<{ deleted: boolean }>(`/api/content/media/${fileToken}`, { token, method: 'DELETE' });
export const mediaLibrary = (token: string, q: string) => apiRequest<MediaLibrary>(`/api/content/media-library${q ? `?q=${encodeURIComponent(q)}` : ''}`, { token });

export const listQuizzes = (token: string, query: Query) => apiRequest<Listing<QuizItem>>(`/api/content/quizzes${qs(query)}`, { token });
export const getQuiz = (token: string, id: number) => apiRequest<QuizDetail>(`/api/content/quizzes/${id}`, { token });
export const createQuiz = (token: string, body: QuizInput) => apiRequest<QuizDetail>('/api/content/quizzes', { token, body });
export const updateQuiz = (token: string, id: number, body: Partial<QuizInput>) => apiRequest<QuizDetail>(`/api/content/quizzes/${id}`, { token, method: 'PUT', body });
export const deleteQuiz = (token: string, id: number) => apiRequest<void>(`/api/content/quizzes/${id}`, { token, method: 'DELETE' });
export const duplicateQuiz = (token: string, id: number) => apiRequest<QuizDetail>(`/api/content/quizzes/${id}/duplicate`, { token, body: {} });
export const previewQuiz = (token: string, id: number) => apiRequest<AttemptState>(`/api/play/quizzes/${id}/preview`, { token, body: {} });

// ---------------------------------------------------------------------- bài học (HK.AD.044)
export const listLessons = (token: string, query: Query = {}) => apiRequest<LessonItem[]>(`/api/content/lessons${qs(query)}`, { token });
export const getLesson = (token: string, id: number) => apiRequest<LessonDetail>(`/api/content/lessons/${id}`, { token });
export const createLesson = (token: string, body: LessonInput) => apiRequest<LessonDetail>('/api/content/lessons', { token, body });
export const updateLesson = (token: string, id: number, body: Partial<LessonInput>) => apiRequest<LessonDetail>(`/api/content/lessons/${id}`, { token, method: 'PUT', body });
export const setLessonStatus = (token: string, id: number, status: 'draft' | 'published') => apiRequest<LessonDetail>(`/api/content/lessons/${id}/status`, { token, method: 'PATCH', body: { status } });
export const deleteLesson = (token: string, id: number) => apiRequest<void>(`/api/content/lessons/${id}`, { token, method: 'DELETE' });

// ---------------------------------------------------------------------- hành trình (HK.GV.018–021, HK.QT.042, HK.AD.043)
export const listJourneys = (token: string, query: Query = {}) => apiRequest<JourneyItem[]>(`/api/content/journeys${qs(query)}`, { token });
export const getJourney = (token: string, id: number) => apiRequest<JourneyDetail>(`/api/content/journeys/${id}`, { token });
export const createJourney = (token: string, body: Record<string, unknown>) => apiRequest<JourneyDetail>('/api/content/journeys', { token, body });
export const updateJourney = (token: string, id: number, body: Record<string, unknown>) => apiRequest<JourneyDetail>(`/api/content/journeys/${id}`, { token, method: 'PUT', body });
export const deleteJourney = (token: string, id: number) => apiRequest<void>(`/api/content/journeys/${id}`, { token, method: 'DELETE' });
export const duplicateJourney = (token: string, id: number) => apiRequest<JourneyDetail>(`/api/content/journeys/${id}/duplicate`, { token, body: {} });
export const setJourneyStatus = (token: string, id: number, status: 'draft' | 'published') => apiRequest<JourneyDetail>(`/api/content/journeys/${id}/status`, { token, method: 'PATCH', body: { status } });
export const setJourneyDefault = (token: string, id: number, value: boolean) => apiRequest<JourneyDetail>(`/api/content/journeys/${id}/default`, { token, method: 'PATCH', body: { value } });
export const addNode = (token: string, journeyId: number, body: NodeInput) => apiRequest<JourneyDetail>(`/api/content/journeys/${journeyId}/nodes`, { token, body });
export const updateNode = (token: string, nodeId: number, body: NodeInput) => apiRequest<JourneyDetail>(`/api/content/nodes/${nodeId}`, { token, method: 'PUT', body });
export const removeNode = (token: string, nodeId: number) => apiRequest<JourneyDetail>(`/api/content/nodes/${nodeId}`, { token, method: 'DELETE' });
// Cửa của lộ trình dạng đường đi (HK.AD.080)
export const addGate = (token: string, journeyId: number, body: GateInput) => apiRequest<JourneyDetail>(`/api/content/journeys/${journeyId}/gates`, { token, body });
export const updateGate = (token: string, gateId: number, body: GateInput) => apiRequest<JourneyDetail>(`/api/content/gates/${gateId}`, { token, method: 'PUT', body });
export const removeGate = (token: string, gateId: number) => apiRequest<JourneyDetail>(`/api/content/gates/${gateId}`, { token, method: 'DELETE' });
export const reorderNodes = (token: string, journeyId: number, nodeIds: number[]) => apiRequest<JourneyDetail>(`/api/content/journeys/${journeyId}/order`, { token, method: 'PUT', body: { node_ids: nodeIds } });
export const myClasses = (token: string) => apiRequest<TeacherClass[]>('/api/content/my-classes', { token });
export const assignJourney = (token: string, journeyId: number, classIds: number[]) => apiRequest<JourneyDetail>(`/api/content/journeys/${journeyId}/classes`, { token, body: { class_ids: classIds } });
export const unassignJourney = (token: string, journeyId: number, classId: number) => apiRequest<JourneyDetail>(`/api/content/journeys/${journeyId}/classes/${classId}`, { token, method: 'DELETE' });

// ---------------------------------------------------------------------- chia sẻ và duyệt (HK.GV.029, 039, HK.QT.041)
export const listShares = (token: string, query: Query = {}) => apiRequest<ShareItem[]>(`/api/content/shares${qs(query)}`, { token });
export const getShare = (token: string, id: number) => apiRequest<ShareDetail>(`/api/content/shares/${id}`, { token });
export const requestShare = (token: string, entity: 'question' | 'quiz' | 'journey', entityId: number, target: 'school' | 'system') =>
  apiRequest<ShareItem>('/api/content/shares', { token, body: { entity, entity_id: entityId, target } });
export const reviewShare = (token: string, id: number, approve: boolean, note?: string) => apiRequest<ShareDetail>(`/api/content/shares/${id}/review`, { token, body: { approve, note } });
export const withdrawShare = (token: string, id: number) => apiRequest<void>(`/api/content/shares/${id}`, { token, method: 'DELETE' });

// ---------------------------------------------------------------------- kho lịch sử cho học sinh và giáo viên (HK.HS.025–042)
export const learnCampaigns = (token: string) => apiRequest<Detail[]>('/api/learn/campaigns', { token });
export const learnFigures = (token: string, query: Query = {}) => apiRequest<FigureItem[]>(`/api/learn/figures${qs(query)}`, { token });
export const learnDetail = (token: string, kind: 'figures' | 'events' | 'battles' | 'places' | 'sources', id: number) => apiRequest<Detail>(`/api/learn/${kind}/${id}`, { token });
export const learnPlaces = (token: string, query: Query = {}) => apiRequest<Array<{ id: number; name: string; old_name: string | null; province: string | null; lat: number | null; lng: number | null }>>(`/api/learn/places${qs(query)}`, { token });
export const learnTerms = (token: string, q?: string) => apiRequest<TermItem[]>(`/api/learn/terms${qs({ q })}`, { token });
export const learnSearch = (token: string, q: string) => apiRequest<SearchHit[]>(`/api/learn/search${qs({ q })}`, { token });
export const learnTimeline = (token: string, query: Query = {}) => apiRequest<TimelineEntry[]>(`/api/learn/timeline${qs(query)}`, { token });
export const learnMap = (token: string, query: Query = {}) => apiRequest<MapPlace[]>(`/api/learn/map${qs(query)}`, { token });
export const learnSources = (token: string, query: Query = {}) => apiRequest<SourceItem[]>(`/api/learn/sources${qs(query)}`, { token });

// ---------------------------------------------------------------------- học và làm bài (HK.HS.017–050)
export const studentHome = (token: string) => apiRequest<StudentHome>('/api/play/home', { token });
export const campaignMap = (token: string, campaignId: number) => apiRequest<CampaignMap>(`/api/play/campaigns/${campaignId}/map`, { token });
export const nodeDetail = (token: string, nodeId: number) => apiRequest<NodeDetail>(`/api/play/nodes/${nodeId}`, { token });
export const completeNode = (token: string, nodeId: number) => apiRequest<NodeResult>(`/api/play/nodes/${nodeId}/complete`, { token, body: {} });
export const startNodeQuiz = (token: string, nodeId: number) => apiRequest<AttemptState>(`/api/play/nodes/${nodeId}/attempts`, { token, body: {} });
// Lộ trình dạng đường đi (HK.HS.117–125)
export const learningPath = (token: string) => apiRequest<LearningPath>('/api/play/path', { token });
export const menuDots = (token: string) => apiRequest<MenuDots>('/api/play/dots', { token });
export const gateGuide = (token: string, gateId: number) => apiRequest<GateGuide>(`/api/play/gates/${gateId}/guide`, { token });
export const listenOfNode = (token: string, nodeId: number) => apiRequest<ListenView>(`/api/play/nodes/${nodeId}/listen`, { token });
export const lessonCheck = (token: string, nodeId: number, questionId: number, answer: unknown) => apiRequest<LessonCheckResult>(`/api/play/nodes/${nodeId}/lesson/check`, { token, body: { question_id: questionId, answer } });
export const lessonOfNode = (token: string, nodeId: number) => apiRequest<LessonView>(`/api/play/nodes/${nodeId}/lesson`, { token });
export const lessonProgress = (token: string, nodeId: number, readPercent: number) => apiRequest<{ read_percent: number }>(`/api/play/nodes/${nodeId}/lesson/progress`, { token, body: { read_percent: readPercent } });
export const completeLesson = (token: string, nodeId: number, answers: Array<{ question_id: number; answer: unknown }>) => apiRequest<LessonCompletion>(`/api/play/nodes/${nodeId}/lesson/complete`, { token, body: { answers } });
export const getAttempt = (token: string, id: number) => apiRequest<AttemptState>(`/api/play/attempts/${id}`, { token });
export const answerAttempt = (token: string, id: number, questionId: number, answer: unknown) => apiRequest<AnswerResult>(`/api/play/attempts/${id}/answer`, { token, body: { question_id: questionId, answer } });
export const nextQuestion = (token: string, id: number) => apiRequest<AttemptState>(`/api/play/attempts/${id}/next`, { token, body: {} });
export const attemptReview = (token: string, id: number) => apiRequest<AttemptReview>(`/api/play/attempts/${id}/review`, { token });
export const attemptHistory = (token: string, query: Query = {}) => apiRequest<Listing<AttemptHistoryItem>>(`/api/play/history${qs(query)}`, { token });
export const practiceInfo = (token: string) => apiRequest<Array<{ question_id: number; prompt: string; qtype: string; wrong_count: number }>>('/api/play/practice', { token });
export const startPractice = (token: string) => apiRequest<AttemptState>('/api/play/practice/start', { token, body: {} });
export const playQuests = (token: string) => apiRequest<Quests>('/api/play/quests', { token });
export const listNotes = (token: string) => apiRequest<NoteItem[]>('/api/play/notes', { token });
export const saveNote = (token: string, type: 'lesson' | 'source', id: number, body: string) => apiRequest<NoteItem>(`/api/play/notes/${type}/${id}`, { token, method: 'PUT', body: { body } });
export const removeNote = (token: string, type: string, id: number) => apiRequest<void>(`/api/play/notes/${type}/${id}`, { token, method: 'DELETE' });
export const setFavorite = (token: string, sourceId: number, on: boolean) => apiRequest<{ source_id: number; favorite: boolean }>(`/api/play/favorites/${sourceId}`, { token, method: on ? 'PUT' : 'DELETE' });
export const viewEvent = (token: string, event: string, durationMs?: number) => apiRequest<{ ok: boolean }>('/api/play/events', { token, body: { event, duration_ms: durationMs } }).catch(() => undefined);

// ---------------------------------------------------------------------- trình soạn hành trình (Sprint 7, HK.GV.022–027)
export const assignJourneyScheduled = (token: string, journeyId: number, classIds: number[], schedule: { starts_at?: string | null; ends_at?: string | null }) =>
  apiRequest<JourneyDetail>(`/api/content/journeys/${journeyId}/classes`, { token, body: { class_ids: classIds, ...schedule } });
export const setJourneySchedule = (token: string, journeyId: number, classId: number, schedule: { starts_at: string | null; ends_at: string | null }) =>
  apiRequest<JourneyDetail>(`/api/content/journeys/${journeyId}/classes/${classId}/schedule`, { token, method: 'PUT', body: schedule });
export const copyJourney = (token: string, journeyId: number, body: { title?: string; class_ids?: number[]; starts_at?: string | null; ends_at?: string | null }) =>
  apiRequest<JourneyDetail>(`/api/content/journeys/${journeyId}/copy`, { token, body });
export const saveJourneyLayout = (token: string, journeyId: number, body: { nodes?: Array<{ id: number; x: number | null; y: number | null }>; edges?: Array<{ from: number; to: number }> }) =>
  apiRequest<JourneyDetail>(`/api/content/journeys/${journeyId}/layout`, { token, method: 'PUT', body });
export const previewJourney = (token: string, journeyId: number, completed: number[], hours = 0) =>
  apiRequest<JourneyPreview>(`/api/content/journeys/${journeyId}/preview`, { token, body: { completed, hours } });
export const rewardOptions = (token: string) => apiRequest<{ cards: Array<{ id: number; name: string; rarity: string }>; badges: Array<{ id: number; name: string; scope: string }> }>('/api/content/reward-options', { token });
