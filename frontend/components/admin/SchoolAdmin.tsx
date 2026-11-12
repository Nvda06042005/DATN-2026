/**
 * Cổng quản trị viên trường học (/school-manager-admin): thông tin trường, năm học, khối lớp (HK.QT.010–013), giáo viên (HK.QT.014–023),
 * học sinh (HK.QT.024–034), lớp học (HK.QT.035–040). Chỉ làm việc trên trường ghi trong token.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Bell, CalendarDays, ChartColumn, CircleHelp, History, LifeBuoy, GraduationCap, Inbox, ListChecks, School, Trash2, UserRound, Users } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { SchoolReports } from '@/components/admin/AnalyticsAdmin';
import { SchoolYears } from '@/components/admin/SchoolYears';
import { phaseText, todayVn } from '@/lib/school-terms';
import { BroadcastManager } from '@/components/admin/PlatformComms';
import { LogsPanel } from '@/components/admin/PlatformOps';
import { SchoolEmblem } from '@/components/school-brand';
import { HelpPage } from '@/components/portal/HelpCenter';
import { NoticeBell } from '@/components/portal/NoticeCenter';
import { ErrorNote, FilterBar, FilterBox, FormSheet, Page, PageHeader, StatusChip, useAction, useLoad, yearOptions } from '@/components/admin/kit';
import { HistoryManager } from '@/components/admin/HistoryManager';
import { LessonManager } from '@/components/admin/LessonManager';
import { QuestionBank } from '@/components/admin/QuestionBank';
import { QuizManager } from '@/components/admin/QuizManager';
import { SchoolClasses } from '@/components/admin/SchoolClasses';
import { ShareInbox } from '@/components/admin/ShareInbox';
import { SchoolPeople } from '@/components/admin/SchoolPeople';
import type { Session } from '@/components/auth';
import { AdminUiContext, Btn, Card, Inset, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { usePortalTab } from '@/hooks/use-portal-tab';
import type { YearItem } from '@/types/api';

// Menu quản trị trường (13/11/2026): Báo cáo gộp vào Thống kê trường; bỏ hẳn Trò chơi hóa, Mô phỏng và mini-game, Game thẻ tướng, Nghiên cứu,
// Khảo sát, Hành trình mẫu, AI Tutor khỏi cổng quản trị trường (học sinh, giáo viên vẫn dùng như cũ; dữ liệu giữ nguyên trong cơ sở dữ liệu).
const NAV = [
  { id: 'stats' as const, label: 'Thống kê trường', icon: ChartColumn },
  { id: 'school' as const, label: 'Trường và năm học', icon: School },
  { id: 'teachers' as const, label: 'Giáo viên', icon: UserRound },
  { id: 'students' as const, label: 'Học sinh', icon: GraduationCap },
  { id: 'classes' as const, label: 'Lớp học', icon: Users },
  { id: 'review' as const, label: 'Duyệt nội dung', icon: Inbox },
  { id: 'history' as const, label: 'Kho lịch sử', icon: History },
  { id: 'lessons' as const, label: 'Bài học', icon: ListChecks },
  { id: 'questions' as const, label: 'Ngân hàng câu hỏi', icon: CircleHelp },
  { id: 'quizzes' as const, label: 'Bộ đề', icon: ListChecks },
  { id: 'notices' as const, label: 'Thông báo', icon: Bell },
  { id: 'logs' as const, label: 'Nhật ký', icon: History },
  { id: 'help' as const, label: 'Trợ giúp', icon: LifeBuoy },
];
type Tab = (typeof NAV)[number]['id'];

export const SchoolAdmin: React.FC<{ session: Session }> = ({ session }) => {
  const [tab, setTab] = usePortalTab<Tab>('stats', NAV.map(item => item.id));
  const { data: school, reload: reloadSchool } = useLoad(() => api.getMySchool(session.token), [session.token], session.expired);
  const { data: years, reload: reloadYears } = useLoad(() => api.listYears(session.token), [session.token], session.expired);
  const reloadAll = () => { reloadSchool(); reloadYears(); };
  return (
    <AdminUiContext.Provider value>
      <AdminWorkspace session={session} nav={NAV} active={tab} onSelect={setTab} schoolName={school?.name} extra={<NoticeBell session={session} onGo={(n) => setTab(n.kind === 'survey' ? 'notices' : n.kind === 'support' ? 'help' : n.kind==='teacher_change'?'classes':'school')} />}>
        {tab === 'stats' ? <SchoolReports session={session} schoolName={school?.name} />
          : tab === 'school' ? <SchoolPanel session={session} school={school} years={years ?? []} onChanged={reloadAll} />
          : tab === 'teachers' ? <SchoolPeople session={session} kind="teachers" years={years ?? []} />
          : tab === 'students' ? <SchoolPeople session={session} kind="students" years={years ?? []} />
          : tab === 'classes' ? <SchoolClasses session={session} years={years ?? []} onYearsChanged={reloadYears} />
          : tab === 'history' ? <HistoryManager session={session} />
          : tab === 'lessons' ? <LessonManager session={session} />
          : tab === 'review' ? <ShareInbox session={session} />
          : tab === 'questions' ? <QuestionBank session={session} /> : tab === 'quizzes' ? <QuizManager session={session} />
          : tab === 'notices' ? <BroadcastManager session={session} /> : tab === 'logs' ? <LogsPanel session={session} />
          : <HelpPage session={session} />}
      </AdminWorkspace>
    </AdminUiContext.Provider>
  );
};

const SCHOOL_FIELDS = [
  { name: 'name', label: 'Tên hiển thị của trường', required: true },
  { name: 'logo_url', label: 'Logo riêng (liên kết https, không bắt buộc)', hint: 'Để trống thì hệ thống dùng huy hiệu tự tạo từ tên trường.' },
  { name: 'address', label: 'Địa chỉ' },
  { name: 'contact_name', label: 'Người liên hệ' },
  { name: 'contact_email', label: 'Email liên hệ', type: 'email' as const },
  { name: 'contact_phone', label: 'Điện thoại liên hệ', type: 'tel' as const },
];

const SchoolPanel: React.FC<{ session: Session; school: Awaited<ReturnType<typeof api.getMySchool>> | null; years: YearItem[]; onChanged: () => void }> = ({ session, school, years, onChanged }) => {
  const { c } = useTheme();
  const { token } = session;
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState('');
  const yearId = Number(selected || years.find((y) => y.status === 'active')?.id || years[0]?.id || 0);
  const grades = useLoad(async () => (yearId ? api.listGrades(token, yearId) : null), [token, yearId, years.length], session.expired);
  const gradeAction = useAction(session.expired);

  return (
    <Page>
      <PageHeader title="Trường và năm học" subtitle="Thông tin hiển thị của trường, các năm học và khối lớp theo từng năm." />
      {!school ? <Spinner label="Đang tải thông tin trường…" /> : (
        <Card flat pad={16} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <SchoolEmblem name={school.name} code={school.school_code} logoUrl={school.logo_url} size={64} />
            <View style={{ flex: 1, minWidth: 200 }}>
              <Txt f="displayHeavy" size={20}>{school.name}</Txt>
              <Txt size={14} color={c.muc2}>Mã trường {school.school_code}{school.city ? ` · ${school.city}` : ''}</Txt>
            </View>
            <Btn title="Sửa thông tin" tone="son" size="sm" onPress={() => setEditing(true)} testID="school-edit" />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {[['Địa chỉ', school.address], ['Người liên hệ', school.contact_name], ['Email liên hệ', school.contact_email], ['Điện thoại', school.contact_phone],
              ['Năm học hiện tại', school.current_year ? [school.current_year.label, phaseText(school.current_year, todayVn())].filter(Boolean).join(' · ') : 'Chưa kích hoạt năm học'], ['Quy mô', `${school.counts.teachers} giáo viên · ${school.counts.students} học sinh · ${school.counts.classes} lớp`]].map(([k, v]) => (
              <View key={k as string} style={{ flexBasis: 220, flexGrow: 1 }}><Txt f="bold" size={12} color={c.muc3}>{k}</Txt><Txt size={14}>{(v as string | null) || 'Chưa có'}</Txt></View>
            ))}
          </View>
        </Card>
      )}

      <SchoolYears session={session} years={years} onSelect={setSelected} onChanged={onChanged} />

      {yearId ? (
        <>
          <PageHeader title="Khối lớp" subtitle="Chỉ tạo được lớp ở khối đang bật. Bật/tắt hoặc xóa khối của từng năm học." />
          <FilterBar><FilterBox><AdminSelect label="Năm học" value={String(yearId)} options={yearOptions(years)} onChange={(v) => setSelected(String(v))} /></FilterBox></FilterBar>
          <ErrorNote message={grades.error} />
          {grades.data ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {([6, 7, 8, 9] as const).map((g) => {
                const row = grades.data?.grades.find((x) => x.grade === g);
                const ended = grades.data?.year.status === 'ended';
                return (
                  <Card key={g} flat pad={14} style={{ flexBasis: 200, flexGrow: 1, gap: 8 }}>
                    <Txt f="displayHeavy" size={20}>Khối {g}</Txt>
                    {row ? <Txt size={13} color={c.muc2}>{row.classes} lớp · {row.students} học sinh</Txt> : <Txt size={13} color={c.muc3}>Chưa thêm vào năm học này</Txt>}
                    {row ? <StatusChip kind={row.is_active ? 'on' : 'muted'} text={row.is_active ? 'Đang bật' : 'Đã tắt'} /> : null}
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {!row ? <Btn title="Thêm khối" tone="giay" size="sm" disabled={ended} onPress={async () => { if (await gradeAction.run(() => api.setGrade(token, { year_id: yearId, grade: g, is_active: true }), `Đã thêm khối ${g}`)) grades.reload(); }} /> : (<>
                        <Btn title={row.is_active ? 'Tắt' : 'Bật'} tone="giay" size="sm" disabled={ended} onPress={async () => { if (await gradeAction.run(() => api.setGrade(token, { year_id: yearId, grade: g, is_active: !row.is_active }), 'Đã cập nhật khối')) grades.reload(); }} />
                        <Btn icon={Trash2} label={`Xóa khối ${g}`} tone="giay" size="sm" disabled={ended} onPress={async () => { if (await gradeAction.run(() => api.removeGrade(token, yearId, g).then(() => true), `Đã xóa khối ${g}`)) grades.reload(); }} />
                      </>)}
                    </View>
                  </Card>
                );
              })}
            </View>
          ) : <Spinner label="Đang tải khối lớp…" />}
          {grades.data?.year.status === 'ended' ? <Inset><Txt size={13} color={c.muc2}><CalendarDays size={13} color={c.muc2} /> Năm học đã kết thúc: không sửa được dữ liệu của năm học này.</Txt></Inset> : null}
        </>
      ) : null}

      {editing && school ? (
        <FormSheet title="Sửa thông tin trường" subtitle={`Mã trường ${school.school_code} không đổi được`} fields={SCHOOL_FIELDS} wide
          initial={Object.fromEntries(SCHOOL_FIELDS.map((f) => [f.name, String((school as unknown as Record<string, unknown>)[f.name] ?? '')]))} onClose={() => setEditing(false)}
          onSubmit={async (v) => { await api.updateMySchool(token, Object.fromEntries(SCHOOL_FIELDS.map((f) => [f.name, String(v[f.name]).trim() || null]))); setEditing(false); onChanged(); }} />
      ) : null}
    </Page>
  );
};
