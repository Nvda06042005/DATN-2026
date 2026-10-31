/**
 * Giáo viên (HK.QT.014–023) và học sinh (HK.QT.024–034) của trường: danh sách có tìm kiếm/lọc, thêm tài khoản, nhập Excel có xem trước,
 * xuất Excel; mở một người để sửa, khóa, đặt lại mật khẩu, xóa (AccountSheet).
 */
import React, { useMemo, useState } from 'react';
import { FileUp, Plus } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { AccountSheet, dateText, GENDER_TEXT } from '@/components/admin/AccountSheet';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { Cell, CredentialSheet, DataTable, DownloadButton, ErrorNote, FilterBar, FilterBox, FormSheet, ImportSheet, Page, PageHeader, Pager, StatusChip, useDebounced, useLoad, yearOptions, type FieldDef } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, Field, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { CreatedAccount, YearItem } from '@/types/api';

export const SchoolPeople: React.FC<{ session: Session; kind: 'teachers' | 'students'; years: YearItem[] }> = ({ session, kind, years }) => {
  const { c } = useTheme();
  const { token } = session;
  const teacher = kind === 'teachers';
  const [q, setQ] = useState('');
  const [active, setActive] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [classId, setClassId] = useState('');
  const [page, setPage] = useState(1);
  const [yearSel, setYearSel] = useState('');
  const yearId = Number(yearSel || years.find((y) => y.status === 'active')?.id || years[0]?.id || 0);
  const dq = useDebounced(q), ds = useDebounced(subject);
  const query = { q: dq, active: active || undefined, subject: ds || undefined, grade: grade ? Number(grade) : undefined, class_id: classId ? Number(classId) : undefined };
  const { data, error, loading, reload } = useLoad(() => api.listMembers(token, kind, { ...query, page, limit: 30 } as never), [token, kind, dq, active, ds, grade, classId, page], session.expired);
  const { data: classes } = useLoad(() => api.listClasses(token, { year_id: yearId || undefined, limit: 200 }), [token, yearId], session.expired);
  const classOptions = useMemo(() => (classes?.items ?? []).filter((x) => x.is_active).map((x) => ({ value: String(x.id), label: x.name })), [classes]);
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [credential, setCredential] = useState<CreatedAccount | null>(null);
  const exportQuery = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString();

  if (credential) return <CredentialSheet title="Tài khoản đã được tạo" account={{ full_name: credential.user.full_name, username: credential.user.username, temporary_password: credential.temporary_password, mail: credential.mail }} onClose={() => setCredential(null)} />;

  const fields: FieldDef[] = teacher
    ? [{ name: 'full_name', label: 'Họ và tên', required: true }, { name: 'email', label: 'Email', type: 'email', required: true, hint: 'Mật khẩu tạm được gửi vào email này.' }, { name: 'subject', label: 'Bộ môn' }, { name: 'phone', label: 'Số điện thoại', type: 'tel' }, { name: 'user_code', label: 'Mã giáo viên' }]
    : [{ name: 'user_code', label: 'Mã học sinh', required: true }, { name: 'full_name', label: 'Họ và tên', required: true }, { name: 'birth_date', label: 'Ngày sinh', type: 'date', required: true },
      { name: 'gender', label: 'Giới tính', type: 'select', options: [{ value: '', label: 'Chưa chọn' }, { value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }, { value: 'other', label: 'Khác' }] },
      { name: 'class_id', label: 'Xếp vào lớp (năm học đang chọn)', type: 'select', options: [{ value: '', label: 'Chưa xếp lớp' }, ...classOptions] },
      { name: 'email', label: 'Email học sinh', type: 'email' }, { name: 'parent_email', label: 'Email phụ huynh', type: 'email', hint: 'Dữ liệu của trẻ vị thành niên: chỉ dùng cho việc liên lạc của nhà trường.' }];

  return (
    <Page>
      <PageHeader title={teacher ? 'Giáo viên' : 'Học sinh'} subtitle={teacher ? 'Tạo tài khoản giáo viên, nhập danh sách từ Excel, khóa hoặc đặt lại mật khẩu.' : 'Tạo tài khoản học sinh (mã, ngày sinh, lớp), nhập danh sách từ Excel, chuyển lớp, khóa hoặc đặt lại mật khẩu.'}
        actions={<>
          <DownloadButton title="Xuất Excel" fetchBlob={() => api.downloadFile(token, `/api/admin/${kind}/export${exportQuery ? `?${exportQuery}` : ''}`)} filename={teacher ? 'danh-sach-giao-vien.xlsx' : 'danh-sach-hoc-sinh.xlsx'} />
          <Btn title="Nhập từ Excel" icon={FileUp} tone="giay" size="sm" onPress={() => setImporting(true)} testID="import-open" />
          <Btn title={teacher ? 'Thêm giáo viên' : 'Thêm học sinh'} icon={Plus} tone="son" size="sm" onPress={() => setCreating(true)} testID="member-add" />
        </>} />
      <FilterBar>
        <FilterBox flex={2}><Field label={teacher ? 'Tìm theo tên, email' : 'Tìm theo tên, mã học sinh'} value={q} onChangeText={(v) => { setQ(v); setPage(1); }} autoCapitalize="none" /></FilterBox>
        {teacher ? <FilterBox><Field label="Bộ môn" value={subject} onChangeText={(v) => { setSubject(v); setPage(1); }} /></FilterBox> : (
          <>
            <FilterBox><AdminSelect label="Năm học (để lọc lớp)" value={String(yearId)} options={yearOptions(years)} onChange={(v) => { setYearSel(String(v)); setClassId(''); setPage(1); }} /></FilterBox>
            <FilterBox><AdminSelect label="Khối" value={grade} options={[{ value: '', label: 'Mọi khối' }, ...[6, 7, 8, 9].map((g) => ({ value: String(g), label: `Khối ${g}` }))]} onChange={(v) => { setGrade(String(v)); setPage(1); }} /></FilterBox>
            <FilterBox><AdminSelect label="Lớp" value={classId} options={[{ value: '', label: 'Mọi lớp' }, ...classOptions]} onChange={(v) => { setClassId(String(v)); setPage(1); }} /></FilterBox>
          </>
        )}
        <FilterBox><AdminSelect label="Trạng thái tài khoản" value={active} options={[{ value: '', label: 'Tất cả' }, { value: 'true', label: 'Đang hoạt động' }, { value: 'false', label: 'Đã khóa' }]} onChange={(v) => { setActive(String(v)); setPage(1); }} /></FilterBox>
      </FilterBar>
      <ErrorNote message={error} />
      {loading && !data ? <Spinner label="Đang tải danh sách…" /> : null}
      {data ? (
        <>
          <DataTable rows={data.items} rowKey={(u) => u.id} empty={teacher ? 'Chưa có giáo viên nào khớp bộ lọc.' : 'Chưa có học sinh nào khớp bộ lọc.'} onRowPress={(u) => setOpen(u.id)}
            columns={teacher ? [
              { key: 'name', label: 'Giáo viên', flex: 2, render: (u) => <Cell main={u.full_name} sub={u.username} /> },
              { key: 'email', label: 'Email / điện thoại', flex: 2, render: (u) => <Cell main={u.email || 'Chưa có email'} sub={u.phone} /> },
              { key: 'subject', label: 'Bộ môn', render: (u) => <Txt size={14}>{u.subject || '—'}</Txt> },
              { key: 'classes', label: 'Lớp phụ trách', render: (u) => <Txt size={13}>{u.classes.map((k) => k.name).join(', ') || '—'}</Txt> },
              { key: 'status', label: 'Trạng thái', render: (u) => <StatusChip kind={u.is_active ? 'on' : 'off'} text={u.is_active ? 'Hoạt động' : 'Đã khóa'} /> },
            ] : [
              { key: 'code', label: 'Mã', render: (u) => <Txt f="semibold" size={14}>{u.user_code || '—'}</Txt> },
              { key: 'name', label: 'Học sinh', flex: 2, render: (u) => <Cell main={u.full_name} sub={[u.birth_date, u.gender ? GENDER_TEXT[u.gender] : null].filter(Boolean).join(' · ')} /> },
              { key: 'classes', label: 'Lớp', flex: 1.5, render: (u) => <Txt size={13}>{u.classes.map((k) => `${k.name} (${k.school_year})`).join(', ') || 'Chưa xếp lớp'}</Txt> },
              { key: 'last', label: 'Đăng nhập cuối', render: (u) => <Txt size={13} color={c.muc2}>{dateText(u.last_login_at)}</Txt> },
              { key: 'status', label: 'Trạng thái', render: (u) => <StatusChip kind={u.is_active ? (u.must_change_password ? 'warn' : 'on') : 'off'} text={u.is_active ? (u.must_change_password ? 'Chưa đổi mật khẩu' : 'Hoạt động') : 'Đã khóa'} /> },
            ]} />
          <Pager page={page} limit={30} total={data.total} onPage={setPage} />
        </>
      ) : null}
      {open ? <AccountSheet session={session} id={open} onClose={() => setOpen(null)} onChanged={reload} /> : null}
      {creating ? (
        <FormSheet title={teacher ? 'Thêm giáo viên' : 'Thêm học sinh'} subtitle="Hệ thống sinh tên đăng nhập và mật khẩu tạm; người dùng đổi mật khẩu ở lần đăng nhập đầu tiên" submitLabel="Tạo tài khoản" fields={fields} wide onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            const body: Record<string, unknown> = {};
            for (const f of fields) { const raw = String(v[f.name] ?? '').trim(); if (raw) body[f.name] = f.name === 'class_id' ? Number(raw) : raw; }
            const res = await api.createMember(token, kind, body as never);
            setCreating(false);
            setCredential(res);
            reload();
          }} />
      ) : null}
      {importing ? (
        <ImportSheet title={teacher ? 'Nhập danh sách giáo viên' : 'Nhập danh sách học sinh'}
          hint={teacher ? 'Tải file mẫu, điền mỗi giáo viên một dòng (họ tên, email bắt buộc). Hệ thống báo dòng trùng email, thiếu hoặc sai dữ liệu trước khi lưu.' : `Tải file mẫu, điền mỗi học sinh một dòng. Cột Lớp (nếu có) là tên lớp trong năm học ${years.find((y) => y.id === yearId)?.label ?? 'đã chọn'}. Hệ thống báo dòng trùng mã, sai ngày sinh, lớp không có trước khi lưu.`}
          template={{ fetchBlob: () => api.downloadFile(token, `/api/admin/${kind}/template`), filename: teacher ? 'mau-giao-vien.xlsx' : 'mau-hoc-sinh.xlsx' }}
          run={(file, commit) => api.importMembers(token, kind, file, { commit, year_id: teacher ? undefined : yearId })} onClose={() => setImporting(false)} onDone={reload} />
      ) : null}
    </Page>
  );
};
