/**
 * Giáo viên (HK.QT.014–023) và học sinh (HK.QT.024–034) của trường: danh sách có tìm kiếm/lọc, thêm tài khoản, nhập Excel có xem trước,
 * xuất PDF; mở một người để sửa, khóa, đặt lại mật khẩu, xóa (AccountSheet).
 */
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { FileUp, Plus } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { AccountActiveSwitch, AccountSheet, GENDER_TEXT, useAccountLock } from '@/components/admin/AccountSheet';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { RegistrationCode } from './RegistrationCode';
import { TeacherImportSheet } from './TeacherImportSheet';
import { CredentialSheet, DataTable, DownloadButton, ErrorNote, FormSheet, NameCell, Page, PageHeader, Pager, SearchFilterBar, useDebounced, useLoad, yearOptions, type FieldDef, type SearchFilter, usePageSize } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { codeFontSize } from '@/lib/code-font';
import { todayVn } from '@/lib/school-terms';
import type { CreatedAccount, YearItem } from '@/types/api';

/** Chữ số rộng bằng nhau để số thứ tự, mã, số điện thoại và ngày sinh thẳng cột */
const NUM = { fontVariant: ['tabular-nums' as const] };

/** Mã giáo viên (GOT2609102000002) và mã học sinh (HSGOT2612122008001) cùng cỡ chữ 12, trên một dòng; chỉ mã quá dài mới co chữ (lib/code-font.ts) */
const CodeText: React.FC<{ value: string }> = ({ value }) => {
  const [width, setWidth] = useState(0);
  return (
    <View style={{ minWidth: 0 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Txt f="semibold" size={codeFontSize(width, value.length)} numberOfLines={1} style={NUM}>{value}</Txt>
    </View>
  );
};

/** Một dòng chữ trong ô, dài thì hiện dấu …: mọi hàng cao bằng nhau */
const Line: React.FC<{ text: string; muted?: boolean; num?: boolean }> = ({ text, muted, num }) => {
  const { c } = useTheme();
  return <Txt size={13} numberOfLines={1} color={muted ? c.muc3 : undefined} style={num ? NUM : undefined}>{text}</Txt>;
};

/** Ngày YYYY-MM-DD hiển thị dd/mm/yyyy như trong file Excel */
const fmtBirth = (iso: string | null | undefined): string => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');

/**
 * Các ô của form thêm giáo viên / học sinh (giống cột file Excel): mã (xem trước), họ tên, giới tính, SĐT, email, ngày sinh; đủ các ô * mới tạo tài khoản.
 * Dùng chung cho trang Học sinh và nút "Tạo học sinh mới vào lớp" ở trang Lớp học (học sinh vào học muộn).
 */
export const personFields = (teacher: boolean, token: string): FieldDef[] => {
  const today = todayVn();
  return [
    { name: 'user_code', label: teacher ? 'Mã giáo viên' : 'Mã học sinh', render: (v) => <RegistrationCode token={token} kind={teacher ? 'teacher' : 'student'} showSerial birthDate={String(v.birth_date || '')} /> },
    { name: 'full_name', label: 'Họ và tên', required: true },
    { name: 'gender', label: 'Giới tính', type: 'select', options: [{ value: '', label: 'Chưa chọn' }, { value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }, ...(teacher ? [] : [{ value: 'other', label: 'Khác' }])] },
    { name: 'phone', label: 'SĐT', type: 'phone', required: true, hint: 'Đúng 10 chữ số, ví dụ 0901234567.' }, { name: 'email', label: 'Email', type: 'email', required: true, hint: 'Tên đăng nhập và mật khẩu được gửi vào email này.' },
    { name: 'birth_date', label: 'Ngày tháng năm sinh', type: 'date', calendar: true, min: teacher ? '1940-01-01' : '2000-01-01', max: today, required: true },
  ];
};

export const SchoolPeople: React.FC<{ session: Session; kind: 'teachers' | 'students'; years: YearItem[] }> = ({ session, kind, years }) => {
  const { token } = session;
  const teacher = kind === 'teachers';
  const [q, setQ] = useState('');
  const [active, setActive] = useState('');
  const [grade, setGrade] = useState('');
  const [classId, setClassId] = useState('');
  const [yearSel, setYearSel] = useState('all');
  const [semesterSel, setSemesterSel] = useState('');
  const [columnValues, setColumnValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const size = usePageSize();
  const yearId = yearSel === 'all' ? 0 : Number(yearSel || years.find((y) => y.status === 'active')?.id || years[0]?.id || 0);
  const year = years.find((y) => y.id === yearId);
  const semester = Number(semesterSel || (year?.term2_starts_on && todayVn() >= year.term2_starts_on ? '2' : '1'));
  const entryYears = years.filter((y) => y.status !== 'ended');
  const entryYear = entryYears.find((y) => y.id === yearId) ?? entryYears.find((y) => y.status === 'active') ?? entryYears[0];
  const entrySemester = entryYear?.term2_starts_on && todayVn() >= entryYear.term2_starts_on ? 2 : 1;
  const periodLabel = year ? `Năm học ${year.label} · Học kỳ ${semester}` : 'Mọi năm học';
  const dq = useDebounced(q);
  const query = { q: dq, active: (active || undefined) as 'true' | 'false' | undefined, grade: grade ? Number(grade) : undefined, class_id: classId ? Number(classId) : undefined, year_id: yearId || undefined, semester, ...columnValues };
  const { data, error, loading, reload } = useLoad(() => api.listMembers(token, kind, { ...query, page, limit: size }), [token, kind, dq, active, grade, classId, yearId, semester, columnValues, page, size], session.expired);
  const lock = useAccountLock(session, reload);
  // lớp đang hoạt động của mọi năm học chưa kết thúc (yêu cầu 13/11/2026): trước đây chỉ lấy năm học đang hoạt động nên năm đó chưa có lớp thì ô chọn lớp trống
  const { data: classes } = useLoad(() => api.listClasses(token, { active: 'true', limit: 200 }), [token], session.expired);
  const classOptions = useMemo(() => (classes?.items ?? []).filter((x) => x.is_active && x.year_status !== 'ended' && (!yearId || x.year_id === yearId)).map((x) => ({ value: String(x.id), label: `${x.name} · Khối ${x.grade ?? '?'} (${x.school_year})` })), [classes, yearId]);
  // mỗi bộ lọc khai báo một lần: nút mũi tên ở tiêu đề cột (màn rộng) và nút "Bộ lọc" của thanh tìm kiếm (màn hẹp) dùng chung
  const f_active: SearchFilter = { key: 'active', label: 'Trạng thái', value: active, options: [{ value: '', label: 'Tất cả' }, { value: 'true', label: 'Đang hoạt động' }, { value: 'false', label: 'Đã khóa' }], onChange: (v) => { setActive(v); setPage(1); } };
  const f_grade: SearchFilter = { key: 'grade', label: 'Khối', value: grade, options: [{ value: '', label: 'Mọi khối' }, ...[6, 7, 8, 9].map((g) => ({ value: String(g), label: `Khối ${g}` }))], onChange: (v) => { setGrade(v); setPage(1); } };
  const f_class: SearchFilter = { key: 'class', label: 'Lớp', value: classId, options: [{ value: '', label: 'Mọi lớp' }, ...classOptions], onChange: (v) => { setClassId(v); setPage(1); } };
  const textFilter = (key: string, label: string): SearchFilter => ({ key, label, value: columnValues[key] ?? '', options: [{ value: '', label: 'Tất cả' }], custom: true, onChange: (v) => { setColumnValues((old) => ({ ...old, [key]: v })); setPage(1); } });
  const f_code = textFilter('code', teacher ? 'Mã giáo viên' : 'Mã học sinh');
  const f_name = textFilter('name', 'Họ và tên');
  const f_phone = textFilter('phone', 'SĐT');
  const f_email = textFilter('email', 'Email');
  const f_birth = textFilter('birth', 'Ngày sinh');
  const f_gender: SearchFilter = { key: 'gender', label: 'Giới tính', value: columnValues.gender ?? '', options: [{ value: '', label: 'Tất cả' }, { value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }, { value: 'other', label: 'Khác' }], onChange: (v) => { setColumnValues((old) => ({ ...old, gender: v })); setPage(1); } };
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [credential, setCredential] = useState<CreatedAccount | null>(null);
  const exportQuery = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString();

  if (credential) return <CredentialSheet title="Tài khoản đã được tạo" account={{ full_name: credential.user.full_name, username: credential.display_username ?? credential.user.username, temporary_password: credential.temporary_password, mail: credential.mail }} onClose={() => setCredential(null)} />;

  // thêm từng người: cùng các cột với file mẫu Excel (mã, họ tên, giới tính, SĐT, email, ngày sinh); nền tảng chỉ dạy Lịch sử nên không có ô chọn môn
  const fields: FieldDef[] = [
    { name: 'year_id', label: 'Năm học', type: 'select', required: true, options: entryYears.map((y) => ({ value: String(y.id), label: y.label })) },
    { name: 'semester', label: 'Học kỳ', type: 'select', required: true, options: [{ value: '1', label: 'Học kỳ 1' }, { value: '2', label: 'Học kỳ 2' }] },
    ...personFields(teacher, token),
    ...(!teacher ? [{ name: 'class_id', label: 'Xếp vào lớp', render: (v: Record<string, string | string[]>, set: (name: string, value: string | string[]) => void) => <AdminSelect label="Xếp vào lớp" value={String(v.class_id || '')} options={[{ value: '', label: 'Chưa xếp lớp' }, ...(classes?.items ?? []).filter((x) => x.is_active && x.year_id === Number(v.year_id)).map((x) => ({ value: String(x.id), label: `${x.name} · Khối ${x.grade ?? '?'} (${x.school_year})` }))]} onChange={(value) => set('class_id', String(value))} testID="member-class" /> } as FieldDef] : []),
  ];

  return (
    <Page>
      <PageHeader title={teacher ? 'Giáo viên' : 'Học sinh'} subtitle={teacher ? `${periodLabel}. Thêm từng giáo viên hoặc nhập từ Excel; khóa hoặc đặt lại mật khẩu khi cần.` : `${periodLabel}. Tạo tài khoản học sinh, nhập từ Excel, chuyển lớp, khóa hoặc đặt lại mật khẩu.`}
        actions={<>
          {/* 14/11/2026: quản trị trường chỉ xuất PDF (danh sách in theo thể thức văn bản của nhà trường), không còn xuất Excel */}
          <DownloadButton title="Xuất PDF" fetchBlob={() => api.downloadFile(token, `/api/admin/${kind}/export?${exportQuery ? `${exportQuery}&` : ''}format=pdf`)} filename={`danh_sach_${teacher ? 'giao-vien' : 'hoc-sinh'}_${year?.label ?? 'moi-nam-hoc'}_hoc-ky-${year ? semester : 'ca-nam'}.pdf`} />
          <Btn title="Nhập từ Excel" icon={FileUp} tone="giay" size="sm" onPress={() => setImporting(true)} disabled={!entryYear} testID="import-open" />
          <Btn title={teacher ? 'Thêm giáo viên' : 'Thêm học sinh'} icon={Plus} tone="son" size="sm" onPress={() => setCreating(true)} disabled={!entryYear} testID="member-add" />
        </>} />
      <SearchFilterBar placeholder={teacher ? 'Tìm theo tên, email' : 'Tìm theo tên, mã học sinh'} value={q} onChange={(v) => { setQ(v); setPage(1); }} searchId="member-search"
        filters={teacher ? [f_code, f_name, f_gender, f_phone, f_email, f_birth, f_class, f_active] : [f_code, f_name, f_gender, f_phone, f_email, f_birth, f_grade, f_class, f_active]}
        extra={<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><View style={{ width: 220 }}><AdminSelect bare label="Năm học" value={yearId ? String(yearId) : 'all'} options={[{ value: 'all', label: 'Mọi năm học' }, ...yearOptions(years)]} onChange={(v) => { setYearSel(String(v)); setSemesterSel(''); setClassId(''); setPage(1); }} testID="member-year" /></View><View style={{ width: 160 }}><AdminSelect bare label="Học kỳ" value={String(semester)} options={[{ value: '1', label: 'Học kỳ 1' }, { value: '2', label: 'Học kỳ 2' }]} onChange={(v) => { setSemesterSel(String(v)); setPage(1); }} testID="member-semester" /></View></View>}
        />
      <ErrorNote message={error} />
      {loading && !data ? <Spinner label="Đang tải danh sách…" /> : null}
      {data ? (
        <>
          <DataTable paginate={false} gap={10} rows={data.items} rowKey={(u) => u.id} empty={teacher ? 'Chưa có giáo viên nào khớp bộ lọc.' : 'Chưa có học sinh nào khớp bộ lọc.'} onRowPress={(u) => setOpen(u.id)}
            columns={teacher ? [
              // cùng các cột với file Excel (mẫu nhập và danh sách xuất): Số thứ tự, Mã giáo viên, Họ và tên, Giới tính, SĐT, Email, Ngày tháng năm sinh; thêm Lớp phụ trách và Trạng thái.
              // Bảy cột đầu giống hệt bảng học sinh; tên dài xuống dòng để hiện đầy đủ, các cột số và mã giữ một dòng.
              { key: 'stt', label: 'Số thứ tự', width: 58, minWidth: 58, render: (u) => <Line text={String((page - 1) * size + data.items.indexOf(u) + 1)} muted num /> },
              { key: 'code', filter: f_code, label: 'Mã giáo viên', width: 140, minWidth: 140, render: (u) => <CodeText value={u.user_code || '—'} /> },
              { key: 'name', filter: f_name, label: 'Họ và tên', width: 180, minWidth: 150, grow: 2, render: (u) => <NameCell main={u.full_name} /> },
              { key: 'gender', filter: f_gender, label: 'Giới tính', width: 56, minWidth: 56, render: (u) => <Line text={u.gender ? GENDER_TEXT[u.gender] : '—'} /> },
              { key: 'phone', filter: f_phone, label: 'SĐT', width: 92, minWidth: 84, render: (u) => <Line text={u.phone || '—'} num /> },
              { key: 'email', filter: f_email, label: 'Email', width: 140, grow: 2, render: (u) => <Line text={u.email || 'Chưa có email'} muted={!u.email} /> },
              { key: 'birth', filter: f_birth, label: 'Ngày tháng năm sinh', width: 90, minWidth: 76, render: (u) => <Line text={fmtBirth(u.birth_date)} num /> },
              { key: 'classes', filter: f_class, label: 'Lớp phụ trách', width: 120, grow: 1, render: (u) => <Line text={u.classes.map((k) => k.name).join(', ') || '—'} muted={!u.classes.length} /> },
              { key: 'status', filter: f_active, label: 'Trạng thái', width: 130, minWidth: 124, render: (u) => <AccountActiveSwitch session={session} account={u} onRequest={lock.request} /> },
            ] : [
              { key: 'stt', label: 'Số thứ tự', width: 58, minWidth: 58, render: (u) => <Line text={String((page - 1) * size + data.items.indexOf(u) + 1)} muted num /> },
              { key: 'code', filter: f_code, label: 'Mã học sinh', width: 140, minWidth: 140, render: (u) => <CodeText value={u.user_code || '—'} /> },
              { key: 'name', filter: f_name, label: 'Họ và tên', width: 180, minWidth: 150, grow: 2, render: (u) => <NameCell main={u.full_name} /> },
              { key: 'gender', filter: f_gender, label: 'Giới tính', width: 56, minWidth: 56, render: (u) => <Line text={u.gender ? GENDER_TEXT[u.gender] : '—'} /> },
              { key: 'phone', filter: f_phone, label: 'SĐT', width: 92, minWidth: 84, render: (u) => <Line text={u.phone || '—'} num /> },
              { key: 'email', filter: f_email, label: 'Email', width: 140, grow: 2, render: (u) => <Line text={u.email || '—'} muted={!u.email} /> },
              { key: 'birth', filter: f_birth, label: 'Ngày tháng năm sinh', width: 90, minWidth: 76, render: (u) => <Line text={fmtBirth(u.birth_date)} num /> },
              { key: 'grade', filter: f_grade, label: 'Khối', width: 60, minWidth: 60, render: (u) => <Line text={[...new Set(u.classes.map((k) => k.grade).filter(Boolean))].map((g) => `Khối ${g}`).join(', ') || '—'} /> },
              { key: 'classes', filter: f_class, label: 'Lớp', width: 116, minWidth: 116, grow: 1, render: (u) => <Line text={u.classes.map((k) => `${k.name} (${k.school_year})`).join(', ') || 'Chưa xếp lớp'} muted={!u.classes.length} /> },
              { key: 'status', filter: f_active, label: 'Trạng thái', width: 150, minWidth: 140, render: (u) => <AccountActiveSwitch session={session} account={u} onRequest={lock.request} label={u.is_active ? (u.must_change_password ? 'Chưa đổi mật khẩu' : 'Hoạt động') : 'Đã khóa'} /> },
            ]} />
          <Pager page={page} limit={size} total={data.total} onPage={setPage} />
        </>
      ) : null}
      {open ? <AccountSheet session={session} id={open} onClose={() => setOpen(null)} onChanged={reload} /> : null}
      {lock.dialogs}
      {creating ? (
        <FormSheet title={teacher ? 'Thêm giáo viên' : 'Thêm học sinh'} subtitle={teacher ? 'Thêm từng giáo viên (muốn thêm nhiều người cùng lúc, hãy dùng Nhập từ Excel). Điền đủ các ô có dấu *: tên đăng nhập và mật khẩu tạo từ họ tên, SĐT, ngày sinh và gửi vào email; giáo viên đổi mật khẩu ở lần đăng nhập đầu tiên.' : 'Điền đủ các ô có dấu *: tên đăng nhập và mật khẩu tạo từ họ tên, SĐT, ngày sinh và gửi vào email; học sinh đổi mật khẩu ở lần đăng nhập đầu tiên.'} submitLabel="Tạo tài khoản" fields={fields} initial={{ year_id: String(entryYear?.id ?? ''), semester: String(entrySemester) }} wide onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            const body: Record<string, unknown> = {};
            for (const f of fields) { if(f.render)continue; const raw = String(v[f.name] ?? '').trim(); if (raw) body[f.name] = ['year_id', 'semester', 'class_id'].includes(f.name) ? Number(raw) : raw; }
            if (!teacher && v.class_id && classes?.items.some((x) => x.id === Number(v.class_id) && x.year_id === Number(v.year_id))) body.class_id = Number(v.class_id);
            const res = await api.createMember(token, kind, body as never);
            setCreating(false);
            setCredential(res);
            reload();
          }} />
      ) : null}
      {importing ? <TeacherImportSheet session={session} kind={kind} years={years} initialYearId={entryYear?.id ?? 0} initialSemester={entrySemester} onClose={()=>setImporting(false)} onDone={reload}/> : null}
    </Page>
  );
};
