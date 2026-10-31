/**
 * Cổng quản trị viên trường học (/school-manager-admin): thông tin trường, năm học, khối lớp (HK.QT.010–013), giáo viên (HK.QT.014–023),
 * học sinh (HK.QT.024–034), lớp học (HK.QT.035–040). Chỉ làm việc trên trường ghi trong token.
 */
import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { CalendarDays, GraduationCap, Plus, School, Trash2, UserRound, Users } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { dateText } from '@/components/admin/AccountSheet';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { Cell, DataTable, ErrorNote, FilterBar, FilterBox, FormSheet, Page, PageHeader, StatusChip, useAction, useLoad, yearOptions, YEAR_TEXT } from '@/components/admin/kit';
import { SchoolClasses } from '@/components/admin/SchoolClasses';
import { SchoolPeople } from '@/components/admin/SchoolPeople';
import type { Session } from '@/components/auth';
import { AdminUiContext, Btn, Card, ConfirmSheet, Inset, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { YearItem } from '@/types/api';

type Tab = 'school' | 'teachers' | 'students' | 'classes';
const NAV = [
  { id: 'school' as const, label: 'Trường và năm học', icon: School },
  { id: 'teachers' as const, label: 'Giáo viên', icon: UserRound },
  { id: 'students' as const, label: 'Học sinh', icon: GraduationCap },
  { id: 'classes' as const, label: 'Lớp học', icon: Users },
];
const YEAR_KIND = { planned: 'info', active: 'on', ended: 'muted' } as const;

export const SchoolAdmin: React.FC<{ session: Session }> = ({ session }) => {
  const [tab, setTab] = useState<Tab>('school');
  const { data: school, reload: reloadSchool } = useLoad(() => api.getMySchool(session.token), [session.token], session.expired);
  const { data: years, reload: reloadYears } = useLoad(() => api.listYears(session.token), [session.token], session.expired);
  const reloadAll = () => { reloadSchool(); reloadYears(); };
  return (
    <AdminUiContext.Provider value>
      <AdminWorkspace session={session} nav={NAV} active={tab} onSelect={setTab} schoolName={school?.name}>
        {tab === 'school' ? <SchoolPanel session={session} school={school} years={years ?? []} onChanged={reloadAll} />
          : tab === 'teachers' ? <SchoolPeople session={session} kind="teachers" years={years ?? []} />
          : tab === 'students' ? <SchoolPeople session={session} kind="students" years={years ?? []} />
          : <SchoolClasses session={session} years={years ?? []} onYearsChanged={reloadYears} />}
      </AdminWorkspace>
    </AdminUiContext.Provider>
  );
};

const SCHOOL_FIELDS = [
  { name: 'name', label: 'Tên hiển thị của trường', required: true },
  { name: 'logo_url', label: 'Logo (liên kết https)', hint: 'Dán địa chỉ ảnh bắt đầu bằng https://' },
  { name: 'address', label: 'Địa chỉ' },
  { name: 'contact_name', label: 'Người liên hệ' },
  { name: 'contact_email', label: 'Email liên hệ', type: 'email' as const },
  { name: 'contact_phone', label: 'Điện thoại liên hệ', type: 'tel' as const },
];

const SchoolPanel: React.FC<{ session: Session; school: Awaited<ReturnType<typeof api.getMySchool>> | null; years: YearItem[]; onChanged: () => void }> = ({ session, school, years, onChanged }) => {
  const { c } = useTheme();
  const { token } = session;
  const [editing, setEditing] = useState(false);
  const [yearForm, setYearForm] = useState<{ year: YearItem | null } | null>(null);
  const [confirm, setConfirm] = useState<{ year: YearItem; action: 'activate' | 'end' } | null>(null);
  const { busy, run } = useAction(session.expired);
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
            {school.logo_url ? <Image source={{ uri: school.logo_url }} accessibilityLabel={`Logo ${school.name}`} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: c.dichNhat }} resizeMode="contain" /> : null}
            <View style={{ flex: 1, minWidth: 200 }}>
              <Txt f="displayHeavy" size={20}>{school.name}</Txt>
              <Txt size={14} color={c.muc2}>Mã trường {school.school_code}{school.city ? ` · ${school.city}` : ''}</Txt>
            </View>
            <Btn title="Sửa thông tin" tone="son" size="sm" onPress={() => setEditing(true)} testID="school-edit" />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {[['Địa chỉ', school.address], ['Người liên hệ', school.contact_name], ['Email liên hệ', school.contact_email], ['Điện thoại', school.contact_phone],
              ['Năm học hiện tại', school.current_year?.label ?? 'Chưa kích hoạt năm học'], ['Quy mô', `${school.counts.teachers} giáo viên · ${school.counts.students} học sinh · ${school.counts.classes} lớp`]].map(([k, v]) => (
              <View key={k as string} style={{ flexBasis: 220, flexGrow: 1 }}><Txt f="bold" size={12} color={c.muc3}>{k}</Txt><Txt size={14}>{(v as string | null) || 'Chưa có'}</Txt></View>
            ))}
          </View>
        </Card>
      )}

      <PageHeader title="Năm học" actions={<Btn title="Thêm năm học" icon={Plus} tone="son" size="sm" onPress={() => setYearForm({ year: null })} testID="year-add" />} />
      <DataTable rows={years} rowKey={(y) => y.id} empty="Chưa có năm học nào. Hãy thêm năm học đầu tiên." onRowPress={(y) => setSelected(String(y.id))}
        columns={[
          { key: 'label', label: 'Năm học', render: (y) => <Cell main={y.label} sub={`${y.starts_on} → ${y.ends_on}`} /> },
          { key: 'status', label: 'Trạng thái', render: (y) => <StatusChip kind={YEAR_KIND[y.status]} text={YEAR_TEXT[y.status]} /> },
          { key: 'classes', label: 'Số lớp', render: (y) => <Txt size={14}>{y.classes ?? 0}</Txt> },
          { key: 'ended', label: 'Kết thúc lúc', hideOnCard: true, render: (y) => <Txt size={13} color={c.muc2}>{y.ended_at ? dateText(y.ended_at) : '—'}</Txt> },
        ]}
        actions={(y) => (<>
          {y.status !== 'ended' ? <Btn title="Sửa" tone="giay" size="sm" onPress={() => setYearForm({ year: y })} /> : null}
          {y.status === 'planned' ? <Btn title="Kích hoạt" tone="giay" size="sm" onPress={() => setConfirm({ year: y, action: 'activate' })} /> : null}
          {y.status === 'active' ? <Btn title="Kết thúc" tone="giay" size="sm" onPress={() => setConfirm({ year: y, action: 'end' })} /> : null}
        </>)} />

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
      {yearForm ? (
        <FormSheet title={yearForm.year ? `Sửa năm học ${yearForm.year.label}` : 'Thêm năm học'} subtitle="Năm học gồm hai năm liên tiếp, ví dụ 2026-2027" submitLabel={yearForm.year ? 'Lưu' : 'Thêm năm học'}
          fields={[{ name: 'label', label: 'Năm học', required: true, placeholder: '2026-2027', hint: yearForm.year && yearForm.year.classes ? 'Năm học đã có lớp nên chỉ sửa được ngày.' : undefined }, { name: 'starts_on', label: 'Ngày bắt đầu', type: 'date', required: true }, { name: 'ends_on', label: 'Ngày kết thúc', type: 'date', required: true }]}
          initial={yearForm.year ? { label: yearForm.year.label, starts_on: yearForm.year.starts_on, ends_on: yearForm.year.ends_on } : undefined} onClose={() => setYearForm(null)}
          onSubmit={async (v) => {
            const body = { label: String(v.label).trim(), starts_on: String(v.starts_on), ends_on: String(v.ends_on) };
            if (yearForm.year) await api.updateYear(token, yearForm.year.id, yearForm.year.classes ? { starts_on: body.starts_on, ends_on: body.ends_on } : body);
            else await api.createYear(token, body);
            setYearForm(null);
            onChanged();
          }} />
      ) : null}
      <ConfirmSheet open={!!confirm} busy={busy} onCancel={() => setConfirm(null)} confirmLabel={confirm?.action === 'activate' ? 'Kích hoạt' : 'Kết thúc năm học'}
        title={confirm?.action === 'activate' ? 'Kích hoạt năm học' : 'Kết thúc năm học'}
        message={confirm?.action === 'activate' ? `Đặt ${confirm?.year.label} làm năm học đang hoạt động? Mỗi trường chỉ có một năm học đang hoạt động.` : `Kết thúc năm học ${confirm?.year.label}? Sau đó không sửa được lớp, học sinh trong lớp và khối của năm học này; không thể hoàn tác.`}
        onConfirm={async () => { if (confirm && (await run(() => (confirm.action === 'activate' ? api.activateYear(token, confirm.year.id) : api.endYear(token, confirm.year.id)), 'Đã cập nhật năm học'))) { setConfirm(null); onChanged(); } }} />
    </Page>
  );
};
