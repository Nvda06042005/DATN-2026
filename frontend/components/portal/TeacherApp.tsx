/**
 * Trang giáo viên (/giao-vien), Sprint 3–4: lớp phụ trách (mã tham gia), hành trình học (thư viện mẫu, tạo, sửa nút, giao cho lớp),
 * ngân hàng câu hỏi, bộ đề (làm thử như học sinh), nội dung đã gửi duyệt. Dùng cùng khung và giao diện phẳng với các cổng quản trị.
 */
import React, { useState } from 'react';
import { CircleHelp, ListChecks, Route, Send, Users } from 'lucide-react-native';
import * as authApi from '@/api/authApi';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';
import { JourneyManager } from '@/components/admin/JourneyManager';
import { Page, PageHeader, useLoad } from '@/components/admin/kit';
import { QuestionBank } from '@/components/admin/QuestionBank';
import { QuizManager } from '@/components/admin/QuizManager';
import { ShareInbox } from '@/components/admin/ShareInbox';
import type { Session } from '@/components/auth';
import { ClassesPanel } from '@/components/portal/LearnerHome';
import { AdminUiContext } from '@/components/ui';

type Tab = 'classes' | 'journeys' | 'questions' | 'quizzes' | 'shares';
const NAV = [
  { id: 'classes' as const, label: 'Lớp học', icon: Users },
  { id: 'journeys' as const, label: 'Hành trình học', icon: Route },
  { id: 'questions' as const, label: 'Ngân hàng câu hỏi', icon: CircleHelp },
  { id: 'quizzes' as const, label: 'Bộ đề', icon: ListChecks },
  { id: 'shares' as const, label: 'Nội dung đã gửi', icon: Send },
];

export const TeacherApp: React.FC<{ session: Session }> = ({ session }) => {
  const [tab, setTab] = useState<Tab>('classes');
  const profile = useLoad(() => authApi.getProfile(session.token), [session.token, session.user.profile_confirmed_at], session.expired);
  return (
    <AdminUiContext.Provider value>
      <AdminWorkspace session={session} nav={NAV} active={tab} onSelect={setTab} schoolName={profile.data?.school?.name}>
        {tab === 'classes' ? (
          <Page>
            <PageHeader title={`Xin chào, ${session.user.nickname || session.user.full_name}`} subtitle="Các lớp được phân công; đọc mã tham gia cho học sinh nhập khi vào lớp." />
            <ClassesPanel session={session} />
          </Page>
        ) : tab === 'journeys' ? <JourneyManager session={session} />
          : tab === 'questions' ? <QuestionBank session={session} />
          : tab === 'quizzes' ? <QuizManager session={session} />
          : <ShareInbox session={session} />}
      </AdminWorkspace>
    </AdminUiContext.Provider>
  );
};
