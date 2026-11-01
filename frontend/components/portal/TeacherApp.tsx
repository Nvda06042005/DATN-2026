/**
 * Trang giáo viên (/giao-vien), Sprint 3–8: thi đấu trực tiếp (phòng thi, màn hình chiếu, báo cáo), quản lý lớp (học sinh, đội, luật lớp, thưởng/phạt, bài tập, tiến độ), hành trình học (thư viện mẫu, tạo, sửa nút, bản đồ rẽ nhánh, giao cho lớp),
 * ngân hàng câu hỏi, bộ đề (làm thử như học sinh), nội dung đã gửi duyệt. Dùng cùng khung và giao diện phẳng với các cổng quản trị.
 */
import React, { useState } from 'react';
import { Bell, ChartColumn, CircleHelp, ClipboardList, LifeBuoy, ListChecks, Radio, Route, Send, Sparkles, Trophy, Users } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { AiTeacher } from '@/components/admin/AiTeacher';
import { TeacherAnalytics } from '@/components/admin/AnalyticsTeacher';
import { ClassManager } from '@/components/admin/ClassManager';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';
import { TeacherGame } from '@/components/admin/GameAdmin';
import { JourneyManager } from '@/components/admin/JourneyManager';
import { BroadcastManager } from '@/components/admin/PlatformComms';
import { LiveManager } from '@/components/admin/LiveManager';
import { useLoad } from '@/components/admin/kit';
import { QuestionBank } from '@/components/admin/QuestionBank';
import { QuizManager } from '@/components/admin/QuizManager';
import { ShareInbox } from '@/components/admin/ShareInbox';
import type { Session } from '@/components/auth';
import { NoticeBell } from '@/components/portal/NoticeCenter';
import { HelpPage } from '@/components/portal/HelpCenter';
import { SurveyPage } from '@/components/portal/SurveyCenter';
import { AdminUiContext } from '@/components/ui';

type Tab = 'classes' | 'analytics' | 'journeys' | 'questions' | 'quizzes' | 'live' | 'ai' | 'game' | 'shares' | 'notices' | 'surveys' | 'help';
const NAV = [
  { id: 'classes' as const, label: 'Lớp học', icon: Users },
  { id: 'analytics' as const, label: 'Thống kê lớp', icon: ChartColumn },
  { id: 'journeys' as const, label: 'Hành trình học', icon: Route },
  { id: 'questions' as const, label: 'Ngân hàng câu hỏi', icon: CircleHelp },
  { id: 'quizzes' as const, label: 'Bộ đề', icon: ListChecks },
  { id: 'live' as const, label: 'Thi đấu trực tiếp', icon: Radio },
  { id: 'ai' as const, label: 'Trợ lý AI', icon: Sparkles },
  { id: 'game' as const, label: 'Trò chơi hóa', icon: Trophy },
  { id: 'shares' as const, label: 'Nội dung đã gửi', icon: Send },
  { id: 'notices' as const, label: 'Thông báo', icon: Bell },
  { id: 'surveys' as const, label: 'Khảo sát', icon: ClipboardList },
  { id: 'help' as const, label: 'Trợ giúp', icon: LifeBuoy },
];

export const TeacherApp: React.FC<{ session: Session }> = ({ session }) => {
  const [tab, setTab] = useState<Tab>('classes');
  const profile = useLoad(() => authApi.getProfile(session.token), [session.token, session.user.profile_confirmed_at], session.expired);
  return (
    <AdminUiContext.Provider value>
      <AdminWorkspace session={session} nav={NAV} active={tab} onSelect={setTab} schoolName={profile.data?.school?.name} extra={<NoticeBell session={session} onGo={(n) => setTab(n.kind === 'survey' ? 'surveys' : n.kind === 'support' ? 'help' : 'classes')} />}>
        {tab === 'classes' ? <ClassManager session={session} />
          : tab === 'analytics' ? <TeacherAnalytics session={session} />
          : tab === 'journeys' ? <JourneyManager session={session} />
          : tab === 'questions' ? <QuestionBank session={session} />
          : tab === 'quizzes' ? <QuizManager session={session} />
          : tab === 'live' ? <LiveManager session={session} />
          : tab === 'ai' ? <AiTeacher session={session} />
          : tab === 'game' ? <TeacherGame session={session} />
          : tab === 'notices' ? <BroadcastManager session={session} />
          : tab === 'surveys' ? <SurveyPage session={session} />
          : tab === 'help' ? <HelpPage session={session} />
          : <ShareInbox session={session} />}
      </AdminWorkspace>
    </AdminUiContext.Provider>
  );
};
