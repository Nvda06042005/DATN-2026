/**
 * Trang giáo viên (/giao-vien), Sprint 3–8: thi đấu trực tiếp (phòng thi, màn hình chiếu, báo cáo), quản lý lớp (học sinh, đội, luật lớp, thưởng/phạt, bài tập, tiến độ), hành trình học (thư viện mẫu, tạo, sửa nút, bản đồ rẽ nhánh, giao cho lớp),
 * ngân hàng câu hỏi, bộ đề (làm thử như học sinh), nội dung đã gửi duyệt. Dùng cùng khung và giao diện phẳng với các cổng quản trị.
 */
import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bell, BookOpen, ChartColumn, CircleHelp, ClipboardList, LifeBuoy, ListChecks, Plus, Radio, Route, Send, Sparkles, Users } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import * as learning from '@/api/learningApi';
import { errorMessage } from '@/api/client';
import { QuizStudio } from '@/components/admin/QuizStudio';
import { AiQuizModal } from '@/components/admin/AiQuizModal';
import { TeacherLibraryView } from '@/components/admin/TeacherLibraryView';
import * as authApi from '@/api/authApi';
import { AiTeacher } from '@/components/admin/AiTeacher';
import { TeacherAnalytics } from '@/components/admin/AnalyticsTeacher';
import { ClassManager } from '@/components/admin/ClassManager';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';
import { JourneyManager } from '@/components/admin/JourneyManager';
import { BroadcastManager } from '@/components/admin/PlatformComms';
import { LiveManager } from '@/components/admin/LiveManager';
import { useLoad } from '@/components/admin/kit';
import { QuestionBank } from '@/components/admin/QuestionBank';
import { ShareInbox } from '@/components/admin/ShareInbox';
import type { Session } from '@/components/auth';
import { NoticeBell } from '@/components/portal/NoticeCenter';
import { HelpPage } from '@/components/portal/HelpCenter';
import { SurveyPage } from '@/components/portal/SurveyCenter';
import { AdminUiContext, Btn, Sheet, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { usePortalTab } from '@/hooks/use-portal-tab';

type Tab = 'classes' | 'analytics' | 'library' | 'journeys' | 'questions' | 'quizzes' | 'studio' | 'live' | 'ai' | 'shares' | 'notices' | 'surveys' | 'help';
const TEMP_HIDDEN_TEACHER_TABS: Tab[] = ['journeys', 'quizzes'];
const NAV = [
  { id: 'classes' as const, label: 'Lớp học', icon: Users },
  { id: 'analytics' as const, label: 'Thống kê lớp', icon: ChartColumn },
  { id: 'library' as const, label: 'Thư viện học liệu', icon: BookOpen },
  { id: 'journeys' as const, label: 'Hành trình học', icon: Route },
  { id: 'questions' as const, label: 'Ngân hàng câu hỏi', icon: CircleHelp },
  { id: 'quizzes' as const, label: 'Bộ đề', icon: ListChecks },
  { id: 'live' as const, label: 'Thi đấu trực tiếp', icon: Radio },
  { id: 'ai' as const, label: 'Trợ lý AI', icon: Sparkles },
  { id: 'shares' as const, label: 'Nội dung đã gửi', icon: Send },
  { id: 'notices' as const, label: 'Thông báo', icon: Bell },
  { id: 'surveys' as const, label: 'Khảo sát', icon: ClipboardList },
  { id: 'help' as const, label: 'Trợ giúp', icon: LifeBuoy },
];
const VISIBLE_NAV = NAV.filter((it) => !TEMP_HIDDEN_TEACHER_TABS.includes(it.id));

/** Menu "+ Tạo" trên thanh công cụ: Quiz tương tác ngắn (trình soạn kiểu Kahoot), bộ đề từ ngân hàng câu hỏi, hành trình học, phòng thi đấu */
const CreateMenu: React.FC<{ open: boolean; onClose: () => void; onPick: (what: 'quiz' | 'quizset' | 'journey' | 'live' | 'question' | 'ai_quiz') => void }> = ({ open, onClose, onPick }) => {
  const { c } = useTheme();
  const items = [
    { id: 'quiz' as const, title: 'Quiz (Kahoot-style)', desc: 'Bài học tương tác ngắn với các câu hỏi bình chọn và trắc nghiệm', icon: Sparkles },
    { id: 'ai_quiz' as const, title: 'Soạn đề bằng AI', desc: 'Sinh bộ câu hỏi chuẩn SGK 7 & DVSKTT theo 5 nhóm chủ đề và ma trận Bloom', icon: Sparkles },
    { id: 'quizset' as const, title: 'Bộ đề', desc: 'Chọn câu hỏi có sẵn trong ngân hàng để làm bộ đề', icon: ListChecks },
    { id: 'question' as const, title: 'Câu hỏi', desc: 'Thêm câu hỏi nhiều dạng vào ngân hàng câu hỏi', icon: CircleHelp },
    { id: 'journey' as const, title: 'Hành trình học', desc: 'Thiết kế bản đồ nhiệm vụ cho lớp', icon: Route },
    { id: 'live' as const, title: 'Phòng thi đấu trực tiếp', desc: 'Mở phòng thi kiểu Kahoot cho cả lớp', icon: Radio },
  ];
  return (
    <Sheet open={open} onClose={onClose} title="Tạo mới">
      <View style={{ gap: 10 }}>
        {items.filter(it => it.id !== 'quizset' && it.id !== 'journey').map((it) => (
          <Pressable key={it.id} accessibilityRole="button" accessibilityLabel={`${it.title}: ${it.desc}`} onPress={() => onPick(it.id)} testID={`create-${it.id}`}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 64, borderRadius: 12, borderWidth: 2, borderColor: c.vien, backgroundColor: pressed ? c.the2 : c.the })}>
            <it.icon size={26} color={c.sonChu} />
            <View style={{ flex: 1 }}><Txt f="bold" size={16}>{it.title}</Txt><Txt size={13} color={c.muc2}>{it.desc}</Txt></View>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
};

export const TeacherApp: React.FC<{ session: Session }> = ({ session }) => {
  const toast = useToast();
  const router = useRouter();
  const params = useLocalSearchParams<{ draft?: string; quiz?: string }>();
  const [tab, setTab] = usePortalTab<Tab>('classes', [...VISIBLE_NAV.map(item => item.id), 'studio']);
  const [menu, setMenu] = useState(false);
  const [aiModal, setAiModal] = useState(false);
  const studio = params.draft && /^\d+$/.test(params.draft) ? Number(params.draft) : null;
  const setStudio = (id: number | null) => router.setParams({ draft: id === null ? '' : String(id) });
  const [liveQuiz, setLiveQuiz] = useState<number | null>(null);
  const openStudio = async (fromQuizId?: number) => {
    try { const d = await learning.createStudioDraft(session.token, fromQuizId); setTab('studio', { draft: String(d.id) }); } catch (e) { toast(errorMessage(e)); }
  };
  const pick = (what: 'quiz' | 'quizset' | 'journey' | 'live' | 'question' | 'ai_quiz') => {
    setMenu(false);
    if (what === 'ai_quiz') { setAiModal(true); return; }
    if (what === 'quiz') void openStudio();
    else { setStudio(null); setTab(what === 'quizset' ? 'quizzes' : what === 'journey' ? 'journeys' : what === 'live' ? 'live' : 'questions'); }
  };
  const profile = useLoad(() => authApi.getProfile(session.token), [session.token, session.user.profile_confirmed_at], session.expired);
  return (
    <AdminUiContext.Provider value>
      <AdminWorkspace session={session} nav={VISIBLE_NAV} active={tab} onSelect={setTab} schoolName={profile.data?.school?.name} extra={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Btn icon={Plus} title="Tạo" tone="son" size="sm" onPress={() => setMenu(true)} testID="create-menu" /><NoticeBell session={session} onGo={(n) => { setStudio(null); setTab(n.kind === 'survey' ? 'surveys' : n.kind === 'support' ? 'help' : 'classes'); }} /></View>}>
        {tab === 'classes' ? <ClassManager session={session} />
          : tab === 'analytics' ? <TeacherAnalytics session={session} />
          : tab === 'library' ? <TeacherLibraryView session={session} onStartLiveQuiz={(quizId) => { setLiveQuiz(quizId); setTab('live', { quiz: String(quizId) }); }} />
          : tab === 'journeys' ? <JourneyManager session={session} />
          : tab === 'questions' ? <QuestionBank session={session} />
          : tab === 'studio' ? (studio !== null
            ? <QuizStudio session={session} draftId={studio} onClose={() => setTab('classes')} onOpenRoom={(quizId) => { setLiveQuiz(quizId); setTab('live', { quiz: String(quizId) }); }} />
            : <View style={{ padding: 20, gap: 12 }}><Txt>Chọn Tạo → Quiz để mở trình soạn Quiz tương tác.</Txt><Btn title="Soạn Quiz" onPress={() => { void openStudio(); }} /></View>)
          : tab === 'live' ? <LiveManager session={session} startQuizId={liveQuiz ?? (typeof params.quiz === 'string' && /^\d+$/.test(params.quiz) ? Number(params.quiz) : null)} onStarted={() => { setLiveQuiz(null); router.setParams({ quiz: '' }); }} />
          : tab === 'ai' ? <AiTeacher session={session} onGoLibrary={() => setTab('library')} />
          : tab === 'notices' ? <BroadcastManager session={session} />
          : tab === 'surveys' ? <SurveyPage session={session} />
          : tab === 'help' ? <HelpPage session={session} />
          : <ShareInbox session={session} />}
      </AdminWorkspace>
      <CreateMenu open={menu} onClose={() => setMenu(false)} onPick={pick} />
      {aiModal ? <AiQuizModal open={aiModal} onClose={() => setAiModal(false)} session={session} /> : null}
    </AdminUiContext.Provider>
  );
};
