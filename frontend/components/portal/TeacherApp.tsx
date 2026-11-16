/**
 * Trang giáo viên (/giao-vien): lớp học được quản trị trường phân công (học sinh, đội, luật lớp, thưởng/phạt, bài tập, tiến độ), thống kê lớp, thư viện học liệu,
 * ngân hàng câu hỏi, thi đấu trực tiếp, trợ lý AI, nội dung đã gửi duyệt, thông báo, trợ giúp. Dùng cùng khung và giao diện phẳng với các cổng quản trị.
 * 16/11/2026 (yêu cầu của người dùng): xóa hẳn mục Khảo sát, trình soạn "Quiz (Kahoot-style)" và hộp "Soạn đề bằng AI"; hộp "+ Tạo" chỉ còn Câu hỏi và Phòng thi đấu.
 */
import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bell, BookOpen, ChartColumn, CircleHelp, LifeBuoy, ListChecks, Plus, Radio, Route, Send, Sparkles, Users } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import * as authApi from '@/api/authApi';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';
import { AiTeacher } from '@/components/admin/AiTeacher';
import { TeacherAnalytics } from '@/components/admin/AnalyticsTeacher';
import { ClassManager } from '@/components/admin/ClassManager';
import { JourneyManager } from '@/components/admin/JourneyManager';
import { LiveManager } from '@/components/admin/LiveManager';
import { useLoad } from '@/components/admin/kit';
import { BroadcastManager } from '@/components/admin/PlatformComms';
import { QuestionBank } from '@/components/admin/QuestionBank';
import { ShareInbox } from '@/components/admin/ShareInbox';
import { TeacherLibraryView } from '@/components/admin/TeacherLibraryView';
import type { Session } from '@/components/auth';
import { HelpPage } from '@/components/portal/HelpCenter';
import { NoticeBell } from '@/components/portal/NoticeCenter';
import { AdminUiContext, Btn, Sheet, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { usePortalTab } from '@/hooks/use-portal-tab';

type Tab = 'classes' | 'analytics' | 'library' | 'journeys' | 'questions' | 'quizzes' | 'live' | 'ai' | 'shares' | 'notices' | 'help';
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
  { id: 'help' as const, label: 'Trợ giúp', icon: LifeBuoy },
];
const VISIBLE_NAV = NAV.filter((it) => !TEMP_HIDDEN_TEACHER_TABS.includes(it.id));

type CreateKind = 'question' | 'live';
/** Hộp "+ Tạo" trên thanh đầu: thêm câu hỏi vào ngân hàng câu hỏi, mở phòng thi đấu trực tiếp */
const CreateMenu: React.FC<{ open: boolean; onClose: () => void; onPick: (what: CreateKind) => void }> = ({ open, onClose, onPick }) => {
  const { c } = useTheme();
  const items: Array<{ id: CreateKind; title: string; desc: string; icon: typeof CircleHelp }> = [
    { id: 'question', title: 'Câu hỏi', desc: 'Thêm câu hỏi nhiều dạng vào ngân hàng câu hỏi', icon: CircleHelp },
    { id: 'live', title: 'Phòng thi đấu trực tiếp', desc: 'Mở phòng thi kiểu Kahoot cho cả lớp', icon: Radio },
  ];
  return (
    <Sheet open={open} onClose={onClose} title="Tạo mới">
      <View style={{ gap: 10 }}>
        {items.map((it) => (
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
  const router = useRouter();
  const params = useLocalSearchParams<{ quiz?: string }>();
  const [tab, setTab] = usePortalTab<Tab>('classes', VISIBLE_NAV.map(item => item.id));
  const [menu, setMenu] = useState(false);
  const [liveQuiz, setLiveQuiz] = useState<number | null>(null);
  const pick = (what: CreateKind) => { setMenu(false); setTab(what === 'live' ? 'live' : 'questions'); };
  const profile = useLoad(() => authApi.getProfile(session.token), [session.token, session.user.profile_confirmed_at], session.expired);
  return (
    <AdminUiContext.Provider value>
      <AdminWorkspace session={session} nav={VISIBLE_NAV} active={tab} onSelect={setTab} schoolName={profile.data?.school?.name} extra={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Btn icon={Plus} title="Tạo" tone="son" size="sm" onPress={() => setMenu(true)} testID="create-menu" /><NoticeBell session={session} onGo={(n) => setTab(n.kind === 'support' ? 'help' : 'classes')} /></View>}>
        {tab === 'classes' ? <ClassManager session={session} />
          : tab === 'analytics' ? <TeacherAnalytics session={session} />
          : tab === 'library' ? <TeacherLibraryView session={session} onStartLiveQuiz={(quizId) => { setLiveQuiz(quizId); setTab('live', { quiz: String(quizId) }); }} />
          : tab === 'journeys' ? <JourneyManager session={session} />
          : tab === 'questions' ? <QuestionBank session={session} />
          : tab === 'live' ? <LiveManager session={session} startQuizId={liveQuiz ?? (typeof params.quiz === 'string' && /^\d+$/.test(params.quiz) ? Number(params.quiz) : null)} onStarted={() => { setLiveQuiz(null); router.setParams({ quiz: '' }); }} />
          : tab === 'ai' ? <AiTeacher session={session} onGoLibrary={() => setTab('library')} />
          : tab === 'notices' ? <BroadcastManager session={session} />
          : tab === 'help' ? <HelpPage session={session} />
          : <ShareInbox session={session} />}
      </AdminWorkspace>
      <CreateMenu open={menu} onClose={() => setMenu(false)} onPick={pick} />
    </AdminUiContext.Provider>
  );
};
