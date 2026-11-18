/**
 * Cổng quản trị viên trường học (/school-manager-admin): thông tin trường, năm học (HK.QT.010–013; khối 6–9 tự có khi tạo / kích hoạt năm học,
 * không còn mục "Khối lớp" từ 18/11/2026), giáo viên (HK.QT.014–023),
 * học sinh (HK.QT.024–034), lớp học (HK.QT.035–040). Chỉ làm việc trên trường ghi trong token.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Bell, ChartColumn, FolderCog, History, KeyRound, LifeBuoy, GraduationCap, Inbox, School, UserRound, Users } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { AdminWorkspace, navLeaves } from '@/components/admin/AdminWorkspace';
import { SchoolReports } from '@/components/admin/AnalyticsAdmin';
import { SchoolYears } from '@/components/admin/SchoolYears';
import { phaseText, todayVn } from '@/lib/school-terms';
import { BroadcastManager } from '@/components/admin/PlatformComms';
import { LogsPanel } from '@/components/admin/PlatformOps';
import { SchoolEmblem } from '@/components/school-brand';
import { HelpPage } from '@/components/portal/HelpCenter';
import { NoticeBell } from '@/components/portal/NoticeCenter';
import { CredentialSheet, FormSheet, Page, PageHeader, useLoad, type FieldDef } from '@/components/admin/kit';
import { nameCaseError } from '@/lib/person-name';
import { placeFields, saveStagedLogo, SchoolLogoField } from '@/components/admin/SchoolPlace';
import { addressText, isNewUnit, isOldDistrict, streetPart } from '@/lib/admin-units';
import { SchoolClasses } from '@/components/admin/SchoolClasses';
import { PasswordList } from '@/components/admin/PasswordList';
import { ShareInbox } from '@/components/admin/ShareInbox';
import { SchoolPeople } from '@/components/admin/SchoolPeople';
import type { Session } from '@/components/auth';
import { AdminUiContext, Btn, Card, Inset, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { usePortalTab } from '@/hooks/use-portal-tab';
import type { YearItem } from '@/types/api';

// Menu quản trị trường (13/11/2026): Báo cáo gộp vào Thống kê trường; bỏ hẳn Trò chơi hóa, Mô phỏng và mini-game, Game thẻ tướng, Nghiên cứu,
// Khảo sát, Hành trình mẫu, AI Tutor khỏi cổng quản trị trường (học sinh, giáo viên vẫn dùng như cũ; dữ liệu giữ nguyên trong cơ sở dữ liệu).
// 14/11/2026: xóa hẳn Kho lịch sử, Bài học, Ngân hàng câu hỏi, Bộ đề khỏi cổng quản trị trường (không chuyển sang mục khác).
// Dữ liệu giữ nguyên: học sinh vẫn học bài, giáo viên vẫn dùng ngân hàng câu hỏi và bộ đề của mình.
const NAV = [
  { id: 'stats' as const, label: 'Thống kê trường', icon: ChartColumn },
  { id: 'school' as const, label: 'Trường và năm học', icon: School },
  // nhóm "Quản lý" (yêu cầu 14/11/2026): bấm Quản lý thì hiện Giáo viên, Học sinh, Lớp học, Mật khẩu tài khoản
  { group: 'manage', label: 'Quản lý', icon: FolderCog, items: [
    { id: 'teachers' as const, label: 'Giáo viên', icon: UserRound },
    { id: 'students' as const, label: 'Học sinh', icon: GraduationCap },
    { id: 'classes' as const, label: 'Lớp học', icon: Users },
    { id: 'passwords' as const, label: 'Mật khẩu tài khoản', icon: KeyRound },
  ] },
  { id: 'review' as const, label: 'Duyệt nội dung', icon: Inbox },
  { id: 'notices' as const, label: 'Thông báo', icon: Bell },
  { id: 'logs' as const, label: 'Nhật ký', icon: History },
  { id: 'help' as const, label: 'Trợ giúp', icon: LifeBuoy },
];
type Tab = Extract<(typeof NAV)[number], { id: string }>['id'] | Extract<(typeof NAV)[number], { items: unknown }>['items'][number]['id'];

export const SchoolAdmin: React.FC<{ session: Session }> = ({ session }) => {
  const [tab, setTab] = usePortalTab<Tab>('stats', navLeaves<Tab>(NAV).map(item => item.id));
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
          : tab === 'passwords' ? <PasswordList session={session} />
          : tab === 'review' ? <ShareInbox session={session} />
          : tab === 'notices' ? <BroadcastManager session={session} /> : tab === 'logs' ? <LogsPanel session={session} />
          : <HelpPage session={session} />}
      </AdminWorkspace>
    </AdminUiContext.Provider>
  );
};

// Giống trang Trường học của quản trị tổng (18/11/2026): logo bằng ảnh tải lên, khu vực theo phường / xã – tỉnh / thành, địa chỉ tự ghép
// người liên hệ = tài khoản quản trị viên trường đầu tiên (18/11/2026): đổi thì máy chủ cấp lại tên đăng nhập + mật khẩu theo quy ước và gửi email
const CONTACT_FIELDS: FieldDef[] = [
  { name: 'contact_note', label: 'Người liên hệ', render: () => <ContactNote /> },
  { name: 'contact_name', label: 'Người liên hệ (họ và tên)', placeholder: 'Ví dụ Nguyễn Vũ Đức Anh' },
  { name: 'contact_email', label: 'Email liên hệ', type: 'email' },
  { name: 'contact_phone', label: 'Điện thoại liên hệ', type: 'phone', hint: 'Đúng 10 chữ số; 4 số cuối ghép tên đăng nhập.' },
  { name: 'contact_birth_date', label: 'Ngày sinh người liên hệ', type: 'date', calendar: true, min: '1930-01-01', max: todayVn(), hint: 'Dùng ghép mật khẩu theo quy ước.' },
];
const SAVED_KEYS = ['name', 'city', 'region', 'address', 'contact_name', 'contact_email', 'contact_phone', 'contact_birth_date'] as const;

const ContactNote: React.FC = () => {
  const { c } = useTheme();
  return <Inset style={{ backgroundColor: c.vangNhat, gap: 2 }}>
    <Txt f="bold" size={13} color={c.vangChu}>Người liên hệ là tài khoản quản trị viên trường</Txt>
    <Txt size={13} color={c.muc}>Đổi họ tên, email, điện thoại hoặc ngày sinh người liên hệ thì tên đăng nhập và mật khẩu của tài khoản đó được cấp lại theo quy ước và gửi tới email mới; nếu đó là tài khoản của bạn, bạn sẽ phải đăng nhập lại. Thông tin liên hệ cũ được lưu trong kho dữ liệu đã xóa.</Txt>
  </Inset>;
};

const SchoolPanel: React.FC<{ session: Session; school: Awaited<ReturnType<typeof api.getMySchool>> | null; years: YearItem[]; onChanged: () => void }> = ({ session, school, years, onChanged }) => {
  const { c } = useTheme();
  const { token } = session;
  const [editing, setEditing] = useState(false);
  const [reissued, setReissued] = useState<NonNullable<Awaited<ReturnType<typeof api.updateMySchool>>['reissued']> | null>(null);

  return (
    <Page>
      <PageHeader title="Trường và năm học" subtitle="Thông tin hiển thị của trường và các năm học. Năm học tự có đủ khối 6, 7, 8, 9." />
      {!school ? <Spinner label="Đang tải thông tin trường…" /> : (
        <Card flat pad={16} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <SchoolEmblem name={school.name} code={school.school_code} logoUrl={school.logo_url} size={64} />
            <View style={{ flex: 1, minWidth: 200 }}>
              <Txt f="displayHeavy" size={20}>{school.name}</Txt>
              <Txt size={14} color={c.muc2}>Mã trường {school.school_code}{isNewUnit(school.region) ? ` · ${school.region}` : ''}{school.city ? ` · ${school.city}` : ''}</Txt>
            </View>
            <Btn title="Sửa thông tin" tone="son" size="sm" onPress={() => setEditing(true)} testID="school-edit" />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {[['Địa chỉ', addressText(school)], ['Người liên hệ', school.contact_name], ['Email liên hệ', school.contact_email], ['Điện thoại', school.contact_phone],
              ['Năm học hiện tại', school.current_year ? [school.current_year.label, phaseText(school.current_year, todayVn())].filter(Boolean).join(' · ') : 'Chưa kích hoạt năm học'], ['Quy mô', `${school.counts.teachers} giáo viên · ${school.counts.students} học sinh · ${school.counts.classes} lớp`]].map(([k, v]) => (
              <View key={k as string} style={{ flexBasis: 220, flexGrow: 1 }}><Txt f="bold" size={12} color={c.muc3}>{k}</Txt><Txt size={14}>{(v as string | null) || 'Chưa có'}</Txt></View>
            ))}
          </View>
          {isOldDistrict(school.region) ? <Inset style={{ backgroundColor: c.vangNhat }}><Txt size={13} color={c.vangChu}>Trường đang lưu khu vực cũ “{school.region}”. Từ 01/07/2025 không còn quận / huyện: bấm “Sửa thông tin” để chọn phường / xã mới.</Txt></Inset> : null}
        </Card>
      )}

      <SchoolYears session={session} years={years} onChanged={onChanged} />


      {editing && school ? (
        <FormSheet title="Sửa thông tin trường" subtitle="Mã trường do hệ thống cấp, không sửa được." wide
          fields={[
            { name: 'school_code', label: 'Mã trường', readOnly: true, hint: 'Hệ thống tự cấp, không sửa được.' },
            { name: 'name', label: 'Tên hiển thị của trường', required: true },
            ...placeFields(token),
            ...CONTACT_FIELDS,
            { name: 'logo', label: 'Logo trường', render: (values, set) => <SchoolLogoField name={school.name} code={school.school_code} logoUrl={school.logo_url} values={values} set={set} /> },
          ]}
          initial={{ ...Object.fromEntries(SAVED_KEYS.map((k) => [k, String((school as unknown as Record<string, unknown>)[k] ?? '')])), school_code: school.school_code, address: addressText(school), street: streetPart(school.address, school.city),
            // chưa ghi người liên hệ thì điền sẵn từ tài khoản quản trị viên trường đầu tiên
            contact_name: school.contact_name ?? school.admins[0]?.full_name ?? '', contact_email: school.contact_email ?? school.admins[0]?.email ?? '', contact_phone: school.contact_phone ?? school.admins[0]?.phone ?? '',
            contact_birth_date: school.admins[0]?.birth_date ?? '' }} onClose={() => setEditing(false)}
          onSubmit={async (v) => {
            const nameError = String(v.contact_name ?? '').trim() ? nameCaseError(String(v.contact_name)) : null;
            if (nameError) throw new Error(`Người liên hệ: ${nameError}`);
            await saveStagedLogo(v, (data) => api.uploadMySchoolLogo(token, data), () => api.removeMySchoolLogo(token));
            const res = await api.updateMySchool(token, Object.fromEntries(SAVED_KEYS.map((k) => [k, String(v[k] ?? '').trim() || null])));
            setEditing(false);
            if (res.reissued) setReissued(res.reissued); else onChanged();
          }} />
      ) : null}
      {reissued ? (
        <CredentialSheet title="Đã cấp lại đăng nhập cho người liên hệ" account={{ full_name: reissued.full_name, username: reissued.username, temporary_password: reissued.temporary_password, mail: reissued.mail }}
          extra={reissued.self ? <Txt size={13} color={c.muc2}>Đây là tài khoản bạn đang dùng: phiên hiện tại đã hết hiệu lực, hãy đăng nhập lại bằng thông tin trên.</Txt> : undefined}
          onClose={() => { const self = reissued.self; setReissued(null); if (self) session.expired(); else onChanged(); }} />
      ) : null}
    </Page>
  );
};
