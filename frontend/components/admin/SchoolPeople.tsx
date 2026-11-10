/**
 * Giáo viên (HK.QT.014–023) và học sinh (HK.QT.024–034) của trường: danh sách có tìm kiếm/lọc, thêm tài khoản, nhập Excel có xem trước,
 * xuất Excel; mở một người để sửa, khóa, đặt lại mật khẩu, xóa (AccountSheet).
 */
import React, { useMemo, useState } from 'react';
import { FileUp, Plus } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { AccountSheet, dateText, GENDER_TEXT } from '@/components/admin/AccountSheet';
import { RegistrationCode } from './RegistrationCode';
import { TeacherImportSheet } from './TeacherImportSheet';
import { Cell, CredentialSheet, DataTable, DownloadButton, ErrorNote, FormSheet, Page, PageHeader, Pager, SearchFilterBar, StatusChip, useDebounced, useLoad, type FieldDef, type SearchFilter, usePageSize } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { todayVn } from '@/lib/school-terms';
import type { CreatedAccount, YearItem } from '@/types/api';

/** Ngày YYYY-MM-DD hiển thị dd/mm/yyyy như trong file Excel */
const fmtBirth = (iso: string | null | undefined): string => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');

export const SchoolPeople: React.FC<{ session: Session; kind: 'teachers' | 'students'; years: YearItem[] }> = ({ session, kind, years }) => {
  const { c } = useTheme();
  const { token } = session;
  const teacher = kind === 'teachers';
  const [q, setQ] = useState('');
  const [active, setActive] = useState('');
  const [grade, setGrade] = useState('');
  const [classId, setClassId] = useState('');
  const [page, setPage] = useState(1);
  const size = usePageSize();
  const yearId = years.find((y) => y.status === 'active')?.id ?? years[0]?.id ?? 0;
  const dq = useDebounced(q);
  const query = { q: dq, active: active || undefined, grade: grade ? Number(grade) : undefined, class_id: classId ? Number(classId) : undefined };
  const { data, error, loading, reload } = useLoad(() => api.listMembers(token, kind, { ...query, page, limit: size } as never), [token, kind, dq, active, grade, classId, page, size], session.expired);
  const { data: classes } = useLoad(() => api.listClasses(token, { year_id: yearId || undefined, limit: 200 }), [token, yearId], session.expired);
  const classOptions = useMemo(() => (classes?.items ?? []).filter((x) => x.is_active).map((x) => ({ value: String(x.id), label: x.name })), [classes]);
  // mỗi bộ lọc khai báo một lần: nút mũi tên ở tiêu đề cột (màn rộng) và nút "Bộ lọc" của thanh tìm kiếm (màn hẹp) dùng chung
  const f_active: SearchFilter = { key: 'active', label: 'Trạng thái', value: active, options: [{ value: '', label: 'Tất cả' }, { value: 'true', label: 'Đang hoạt động' }, { value: 'false', label: 'Đã khóa' }], onChange: (v) => { setActive(v); setPage(1); } };
  const f_grade: SearchFilter = { key: 'grade', label: 'Khối', value: grade, options: [{ value: '', label: 'Mọi khối' }, ...[6, 7, 8, 9].map((g) => ({ value: String(g), label: `Khối ${g}` }))], onChange: (v) => { setGrade(v); setPage(1); } };
  const f_class: SearchFilter = { key: 'class', label: 'Lớp', value: classId, options: [{ value: '', label: 'Mọi lớp' }, ...classOptions], onChange: (v) => { setClassId(v); setPage(1); } };
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [credential, setCredential] = useState<CreatedAccount | null>(null);
  const exportQuery = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString();

  if (credential) return <CredentialSheet title="Tài khoản đã được tạo" account={{ full_name: credential.user.full_name, username: credential.user.username, temporary_password: credential.temporary_password, mail: credential.mail }} onClose={() => setCredential(null)} />;

  const today = todayVn();
  // thêm từng người: cùng các cột với file mẫu Excel (mã, họ tên, giới tính, SĐT, email, ngày sinh); nền tảng chỉ dạy Lịch sử nên không có ô chọn môn
  const fields: FieldDef[] = teacher
    ? [{ name: 'user_code', label: 'Mã giáo viên', render:(v)=> <RegistrationCode token={token} kind="teacher" showSerial birthDate={String(v.birth_date||'')}/> }, { name: 'full_name', label: 'Họ và tên', required: true },
      { name: 'gender', label: 'Giới tính', type: 'select', options: [{ value: '', label: 'Chưa chọn' }, { value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }] },
      { name: 'phone', label: 'SĐT', type: 'phone', hint: 'Đúng 10 chữ số, ví dụ 0901234567.' }, { name: 'email', label: 'Email', type: 'email', required: true, hint: 'Mật khẩu tạm được gửi vào email này.' },
      { name: 'birth_date', label: 'Ngày tháng năm sinh', type: 'date', calendar: true, min: '1940-01-01', max: today, required: true }]
    : [{ name: 'user_code', label: 'Mã học sinh', render:(v)=> <RegistrationCode token={token} kind="student" showSerial birthDate={String(v.birth_date||'')}/> }, { name: 'full_name', label: 'Họ và tên', required: true },
      { name: 'gender', label: 'Giới tính', type: 'select', options: [{ value: '', label: 'Chưa chọn' }, { value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }, { value: 'other', label: 'Khác' }] },
      { name: 'phone', label: 'SĐT', type: 'phone', hint: 'Đúng 10 chữ số, ví dụ 0901234567.' }, { name: 'email', label: 'Email', type: 'email' },
      { name: 'birth_date', label: 'Ngày tháng năm sinh', type: 'date', calendar: true, min: '2000-01-01', max: today, required: true },
      { name: 'class_id', label: 'Xếp vào lớp (năm học đang hoạt động)', type: 'select', options: [{ value: '', label: 'Chưa xếp lớp' }, ...classOptions] },
      { name: 'parent_email', label: 'Email phụ huynh', type: 'email', hint: 'Dữ liệu của trẻ vị thành niên: chỉ dùng cho việc liên lạc của nhà trường.' }];

  return (
    <Page>
      <PageHeader title={teacher ? 'Giáo viên' : 'Học sinh'} subtitle={teacher ? 'Có hai cách thêm giáo viên: nút Thêm giáo viên để thêm từng người, hoặc Nhập từ Excel để thêm hàng loạt. Khóa hoặc đặt lại mật khẩu khi cần.' : 'Tạo tài khoản học sinh (mã, ngày sinh, lớp), nhập danh sách từ Excel, chuyển lớp, khóa hoặc đặt lại mật khẩu.'}
        actions={<>
          <DownloadButton title="Xuất Excel" fetchBlob={() => api.downloadFile(token, `/api/admin/${kind}/export${exportQuery ? `?${exportQuery}` : ''}`)} filename={teacher ? 'danh-sach-giao-vien.xlsx' : 'danh-sach-hoc-sinh.xlsx'} />
          <Btn title="Nhập từ Excel" icon={FileUp} tone="giay" size="sm" onPress={() => setImporting(true)} testID="import-open" />
          <Btn title={teacher ? 'Thêm giáo viên' : 'Thêm học sinh'} icon={Plus} tone="son" size="sm" onPress={() => setCreating(true)} testID="member-add" />
        </>} />
      <SearchFilterBar placeholder={teacher ? 'Tìm theo tên, email' : 'Tìm theo tên, mã học sinh'} value={q} onChange={(v) => { setQ(v); setPage(1); }} searchId="member-search"
        filters={teacher ? [f_active] : [f_grade, f_class, f_active]}
        />
      <ErrorNote message={error} />
      {loading && !data ? <Spinner label="Đang tải danh sách…" /> : null}
      {data ? (
        <>
          <DataTable paginate={false} rows={data.items} rowKey={(u) => u.id} empty={teacher ? 'Chưa có giáo viên nào khớp bộ lọc.' : 'Chưa có học sinh nào khớp bộ lọc.'} onRowPress={(u) => setOpen(u.id)}
            columns={teacher ? [
              // cùng các cột với file Excel (mẫu nhập và danh sách xuất): Số thứ tự, Mã giáo viên, Họ và tên, Giới tính, SĐT, Email, Ngày tháng năm sinh; thêm Lớp phụ trách và Trạng thái
              { key: 'stt', label: 'Số thứ tự', flex: 0.7, render: (u) => <Txt size={13} color={c.muc2}>{(page - 1) * size + data.items.indexOf(u) + 1}</Txt> },
              { key: 'code', label: 'Mã giáo viên', flex: 1, render: (u) => <Txt f="semibold" size={13}>{u.user_code || '—'}</Txt> },
              { key: 'name', label: 'Họ và tên', flex: 1.8, render: (u) => <Cell main={u.full_name} sub={u.username} /> },
              { key: 'gender', label: 'Giới tính', flex: 0.8, render: (u) => <Txt size={13}>{u.gender ? GENDER_TEXT[u.gender] : '—'}</Txt> },
              { key: 'phone', label: 'SĐT', flex: 1.1, render: (u) => <Txt size={13}>{u.phone || '—'}</Txt> },
              { key: 'email', label: 'Email', flex: 2, render: (u) => <Txt size={13} numberOfLines={2}>{u.email || 'Chưa có email'}</Txt> },
              { key: 'birth', label: 'Ngày tháng năm sinh', flex: 1.2, render: (u) => <Txt size={13}>{fmtBirth(u.birth_date)}</Txt> },
              { key: 'classes', label: 'Lớp phụ trách', flex: 1, render: (u) => <Txt size={13}>{u.classes.map((k) => k.name).join(', ') || '—'}</Txt> },
              { key: 'status', filter: f_active, label: 'Trạng thái', flex: 1.1, render: (u) => <StatusChip kind={u.is_active ? 'on' : 'off'} text={u.is_active ? 'Hoạt động' : 'Đã khóa'} /> },
            ] : [
              { key: 'stt', label: 'Số thứ tự', flex: 0.7, render: (u) => <Txt size={13} color={c.muc2}>{(page - 1) * size + data.items.indexOf(u) + 1}</Txt> },
              { key: 'code', label: 'Mã học sinh', flex: 1.9, render: (u) => <Txt f="semibold" size={13}>{u.user_code || '—'}</Txt> },
              { key: 'name', label: 'Họ và tên', flex: 1.8, render: (u) => <Cell main={u.full_name} sub={u.username} /> },
              { key: 'gender', label: 'Giới tính', flex: 0.8, render: (u) => <Txt size={13}>{u.gender ? GENDER_TEXT[u.gender] : '—'}</Txt> },
              { key: 'phone', label: 'SĐT', flex: 1.1, render: (u) => <Txt size={13}>{u.phone || '—'}</Txt> },
              { key: 'email', label: 'Email', flex: 2, render: (u) => <Txt size={13} numberOfLines={2}>{u.email || '—'}</Txt> },
              { key: 'birth', label: 'Ngày tháng năm sinh', flex: 1.2, render: (u) => <Txt size={13}>{fmtBirth(u.birth_date)}</Txt> },
              { key: 'grade', filter: f_grade, label: 'Khối', flex: 0.7, render: (u) => <Txt size={13}>{[...new Set(u.classes.map((k) => k.grade).filter(Boolean))].map((g) => `Khối ${g}`).join(', ') || '—'}</Txt> },
              { key: 'classes', filter: f_class, label: 'Lớp', flex: 1.5, render: (u) => <Txt size={13}>{u.classes.map((k) => `${k.name} (${k.school_year})`).join(', ') || 'Chưa xếp lớp'}</Txt> },
              { key: 'last', label: 'Đăng nhập cuối', render: (u) => <Txt size={13} color={c.muc2}>{dateText(u.last_login_at)}</Txt> },
              { key: 'status', filter: f_active, label: 'Trạng thái', render: (u) => <StatusChip kind={u.is_active ? (u.must_change_password ? 'warn' : 'on') : 'off'} text={u.is_active ? (u.must_change_password ? 'Chưa đổi mật khẩu' : 'Hoạt động') : 'Đã khóa'} /> },
            ]} />
          <Pager page={page} limit={size} total={data.total} onPage={setPage} />
        </>
      ) : null}
      {open ? <AccountSheet session={session} id={open} onClose={() => setOpen(null)} onChanged={reload} /> : null}
      {creating ? (
        <FormSheet title={teacher ? 'Thêm giáo viên' : 'Thêm học sinh'} subtitle={teacher ? 'Thêm từng giáo viên (muốn thêm nhiều người cùng lúc, hãy dùng Nhập từ Excel). Hệ thống sinh tên đăng nhập và mật khẩu tạm; giáo viên đổi mật khẩu ở lần đăng nhập đầu tiên.' : 'Hệ thống sinh tên đăng nhập và mật khẩu tạm; người dùng đổi mật khẩu ở lần đăng nhập đầu tiên'} submitLabel="Tạo tài khoản" fields={fields} wide onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            const body: Record<string, unknown> = {};
            for (const f of fields) { if(f.render)continue; const raw = String(v[f.name] ?? '').trim(); if (raw) body[f.name] = f.name === 'class_id' ? Number(raw) : raw; }
            const res = await api.createMember(token, kind, body as never);
            setCreating(false);
            setCredential(res);
            reload();
          }} />
      ) : null}
      {importing ? <TeacherImportSheet session={session} kind={kind} yearId={yearId} onClose={()=>setImporting(false)} onDone={reload}/> : null}
    </Page>
  );
};
