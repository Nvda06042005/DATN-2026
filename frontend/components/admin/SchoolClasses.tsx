/**
 * Lớp học của trường (HK.QT.022, HK.QT.035–039). Từ 19/11/2026 (yêu cầu người dùng) tách làm hai mục của nhóm Quản lý:
 * - "Lớp học" (`mode="classes"`): tạo lớp chỉ gồm Lớp, Học kỳ, Khối, Sĩ số dự kiến; tạo nhiều lớp từ file Excel (như nhập giáo viên / học sinh);
 *   xuất PDF danh sách lớp dạng bảng (như PDF danh sách giáo viên / học sinh); sửa tên / khối / sĩ số dự kiến, lưu trữ / xóa lớp.
 * - "Phân công giáo viên" (`mode="assign"`, ngay dưới Lớp học): giáo viên phụ trách theo học kỳ, mã tham gia DongA + lớp + giáo viên + HK + năm học,
 *   xếp học sinh vào lớp (chọn theo mã hoặc file Excel xếp lớp), chuyển lớp cùng khối, đề nghị đổi giáo viên, PDF danh sách học sinh theo lớp.
 * Nút "Nhân bản sang năm học mới" đã bỏ khỏi giao diện theo yêu cầu 12/11/2026 (API nhân bản vẫn giữ).
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Archive, ArrowRightLeft, CheckSquare, FileUp, Pencil, Plus, RefreshCw, Square, Trash2, UserCheck, UserPlus, X } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { TeacherChangeReview } from './ClassTeacherChange';
import { fmtDay,todayVn } from '@/lib/school-terms';
import { CredentialSheet, DataTable, distinctValues, DownloadButton, ErrorNote, FormSheet, ImportSheet, NameCell, Page, PageHeader, SearchFilterBar, StatusChip, useAction, useDebounced, useLoad, valuesToIds, yearOptions, YEAR_TEXT, type FieldDef, type SearchFilter } from '@/components/admin/kit';
import { dateText, GENDER_TEXT } from '@/components/admin/AccountSheet';
import { personFields } from './SchoolPeople';
import type { Session } from '@/components/auth';
import { Btn, ConfirmSheet, Field, Inset, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { Account, ClassDetail, ClassItem, CreatedAccount, YearItem } from '@/types/api';

const KIND_TEXT: Record<string, string> = {
  change_teacher:'Đổi giáo viên phụ trách lớp',
  create: 'Tạo lớp', update: 'Sửa lớp', assign: 'Phân công giáo viên', unassign: 'Gỡ giáo viên', teachers: 'Phân công giáo viên', transfer: 'Chuyển lớp', close: 'Lưu trữ lớp', reopen: 'Khôi phục lớp',
  join: 'Học sinh tự tham gia bằng mã', member_add: 'Thêm học sinh', member_remove: 'Gỡ học sinh', code: 'Đổi mã tham gia', clone: 'Nhân bản từ năm học trước', join_open: 'Cho phép tự tham gia', join_closed: 'Tắt tự tham gia',
};
const SEMESTERS=[{value:'1',label:'Học kỳ 1'},{value:'2',label:'Học kỳ 2'}];
const GRADES=[{ value: '', label: 'Mọi khối' }, ...[6, 7, 8, 9].map((g) => ({ value: String(g), label: `Khối ${g}` }))];
const GRADE_OPTIONS=[6, 7, 8, 9].map((g) => ({ value: String(g), label: `Khối ${g}` }));

/**
 * Chọn học sinh của trường theo mã (như cột Mã học sinh của file Excel xếp lớp, yêu cầu 13/11/2026): gõ mã hoặc họ tên để tìm, bấm để chọn;
 * họ tên, ngày sinh, giới tính tự hiện trong bảng đã chọn. Tìm trên máy chủ nên trường đông học sinh vẫn chọn được. `exclude`: học sinh đã ở trong lớp.
 */
const StudentPicker: React.FC<{ session: Session; value: string[]; onChange: (ids: string[]) => void; exclude?: Set<number>; label?: string }> = ({ session, value, onChange, exclude, label = 'Học sinh (mã học sinh · họ tên)' }) => {
  const { c } = useTheme();
  const { token } = session;
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [known, setKnown] = useState<Record<string, Account>>({});
  const { data, loading } = useLoad(() => api.listMembers(token, 'students', { q: dq || undefined, active: 'true', limit: 30 }), [token, dq], session.expired);
  const results = (data?.items ?? []).filter((s) => !exclude?.has(s.id));
  const picked = value.map((id) => known[id]).filter((s): s is Account => Boolean(s));
  const toggle = (s: Account) => {
    const id = String(s.id);
    if (value.includes(id)) { onChange(value.filter((x) => x !== id)); return; }
    setKnown((k) => ({ ...k, [id]: s }));
    onChange([...value, id]);
  };
  const birth = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
  return (
    <View style={{ gap: 8 }}>
      <Txt f="bold" size={14} color={c.muc2}>{label}</Txt>
      <Field label="Tìm học sinh" hint="Gõ mã hoặc họ tên rồi bấm vào học sinh để chọn; bấm lần nữa để bỏ chọn." value={q} onChangeText={setQ} placeholder="Ví dụ HSGOT hoặc Nguyễn Văn An" nativeID="student-picker-search" autoCapitalize="none" />
      <View style={{ borderWidth: 1, borderColor: c.adminLine, borderRadius: 5, maxHeight: 220, backgroundColor: c.the }}>
        <ScrollView nestedScrollEnabled>
          {loading && !data ? <Txt size={13} color={c.muc3} style={{ padding: 12 }}>Đang tìm…</Txt> : null}
          {data && !results.length ? <Txt size={13} color={c.muc3} style={{ padding: 12 }}>Không có học sinh nào khớp.</Txt> : null}
          {results.map((s) => {
            const on = value.includes(String(s.id));
            const now = s.classes.map((k) => `${k.name} (${k.school_year})`).join(', ');
            return (
              <Pressable key={s.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(s)} testID={`student-pick-${s.id}`}
                style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: pressed ? c.adminCanvas : c.the })}>
                {on ? <CheckSquare size={18} color={c.son} /> : <Square size={18} color={c.muc3} />}
                <Txt size={14} style={{ flex: 1 }} numberOfLines={2}>{s.user_code ?? '—'} · {s.full_name} · {birth(s.birth_date)}{now ? ` · đang ở ${now}` : ''}</Txt>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <Txt f="bold" size={13} testID="student-picker-count">Đã chọn {picked.length} học sinh (Nam {picked.filter((s) => s.gender === 'male').length} · Nữ {picked.filter((s) => s.gender === 'female').length})</Txt>
      {picked.length ? (
        <DataTable paginate={false} gap={10} rows={picked} rowKey={(s) => s.id} empty="Chưa chọn học sinh nào."
          columns={[
            { key: 'stt', label: 'STT', width: 40, minWidth: 40, render: (s) => <Txt size={14} color={c.muc2}>{picked.indexOf(s) + 1}</Txt> },
            { key: 'code', label: 'Mã học sinh', width: 150, minWidth: 140, render: (s) => <Txt size={12} numberOfLines={1}>{s.user_code ?? '—'}</Txt> },
            { key: 'name', label: 'Họ và tên', width: 180, minWidth: 150, grow: 2, render: (s) => <NameCell main={s.full_name} /> },
            { key: 'birth', label: 'Ngày sinh', width: 88, minWidth: 84, render: (s) => <Txt size={14}>{birth(s.birth_date)}</Txt> },
            { key: 'gender', label: 'Giới tính', width: 64, minWidth: 60, render: (s) => <Txt size={14}>{s.gender ? GENDER_TEXT[s.gender] : '—'}</Txt> },
            { key: 'remove', label: '', width: 48, minWidth: 48, render: (s) => <Btn icon={X} label={`Bỏ chọn ${s.full_name}`} tone="giay" size="sm" onPress={() => toggle(s)} /> },
          ]} />
      ) : null}
    </View>
  );
};

export const SchoolClasses: React.FC<{ session: Session; years: YearItem[]; onYearsChanged: () => void; mode?: 'classes' | 'assign' }> = ({ session, years, mode = 'classes' }) => {
  const { token } = session;
  const assign = mode === 'assign';
  const [yearSel, setYearSel] = useState('');
  const yearId = Number(yearSel || years.find((y) => y.status === 'active')?.id || years[0]?.id || 0);
  const year = years.find((y) => y.id === yearId);
  const [semesterSel,setSemesterSel]=useState('');
  const semester=Number(semesterSel || (year?.term2_starts_on && todayVn()>=year.term2_starts_on ? '2':'1'));
  const [grade, setGrade] = useState('');
  const [q, setQ] = useState('');
  const [active, setActive] = useState('true');
  const [columnValues, setColumnValues] = useState<Record<string, string>>({});
  const dq = useDebounced(q);
  const listQuery = { year_id: yearId, semester, grade: grade || undefined, q: dq, active: active || undefined, ...columnValues, students: columnValues.students && /^\d+$/.test(columnValues.students) ? Number(columnValues.students) : undefined };
  const { data, error, loading, reload } = useLoad(() => (yearId ? api.listClasses(token, { ...listQuery, limit: 200 }) : Promise.resolve(null)), [token, yearId,semester, grade, dq, active, columnValues], session.expired);
  const { data: teachers } = useLoad(() => (assign ? api.listMembers(token, 'teachers', { active: 'true', limit: 200 }) : Promise.resolve(null)), [token, assign], session.expired);
  const teacherOptions = useMemo(() => (teachers?.items ?? []).map((t) => ({ value: String(t.id), label: `${t.user_code ?? 'Chưa có mã'} · ${t.full_name}` })), [teachers]);
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const requests=useLoad(()=>(assign ? api.teacherChangeRequests(token) : Promise.resolve([])),[token, assign],session.expired);
  const [reviewing,setReviewing]=useState(false);
  const ended = year?.status === 'ended';
  const f_active: SearchFilter = { key: 'active', label: 'Trạng thái', value: active, options: [{ value: '', label: 'Tất cả' }, { value: 'true', label: 'Đang hoạt động' }, { value: 'false', label: 'Đã lưu trữ' }], onChange: setActive };
  const textFilter = (key: string, label: string, suggest?: SearchFilter['suggest']): SearchFilter => ({ key, label, suggest, value: columnValues[key] ?? '', options: [{ value: '', label: 'Tất cả' }], custom: true, onChange: (v) => setColumnValues((old) => ({ ...old, [key]: key === 'students' ? v.replace(/\D/g, '') : v })) });
  const classValues = (key: string, pick: (k: ClassItem) => string | number | Array<string> | null) => async (term: string) => (yearId
    ? distinctValues((await api.listClasses(token, { ...listQuery, students: undefined, [key]: key === 'students' ? (/^\d+$/.test(term) ? Number(term) : undefined) : term || undefined, limit: 200 })).items, pick)
    : []);
  const f_name = textFilter('name', 'Tên lớp', classValues('name', (k) => k.name));
  const f_registration = textFilter('registration', 'Mã lớp', classValues('registration', (k) => k.registration_code));
  const f_teacher = textFilter('teacher', 'Giáo viên phụ trách', classValues('teacher', (k) => k.teachers.map((t) => t.full_name)));
  const f_students = textFilter('students', 'Sĩ số chính xác', classValues('students', (k) => k.students));
  const f_join = textFilter('join_code', 'Mã tham gia', classValues('join_code', (k) => k.join_code));
  const listPdf = `/api/admin/classes/list-pdf?year_id=${yearId}${grade ? `&grade=${grade}` : ''}${active ? `&active=${active}` : ''}${dq ? `&q=${encodeURIComponent(dq)}` : ''}`;

  return (
    <Page>
      <PageHeader title={assign ? 'Phân công giáo viên' : 'Lớp học'} subtitle={assign
        ? 'Phân công giáo viên phụ trách từng lớp theo học kỳ, xếp học sinh vào lớp (chọn theo mã hoặc file Excel xếp lớp), mã tham gia lớp.'
        : 'Tạo lớp theo năm học: lớp, học kỳ, khối, sĩ số dự kiến (từng lớp hoặc từ file Excel). Phân công giáo viên và xếp học sinh ở mục Phân công giáo viên.'}
        actions={assign ? <>
          <Btn title={`Đề nghị đổi giáo viên${requests.data?.length ? ` (${requests.data.length})`:''}`} tone="giay" size="sm" testID="teacher-change-review" onPress={()=>{requests.reload();setReviewing(true);}}/>
          {yearId ? <DownloadButton title="Xuất PDF danh sách học sinh theo lớp" fetchBlob={() => api.downloadFile(token, `/api/admin/classes/export?year_id=${yearId}&semester=${semester}&format=pdf`)} filename={`danh_sach_lop_${year?.label ?? 'nam-hoc'}_hoc-ky-${semester}.pdf`} /> : null}
          <Btn title="Xếp lớp từ Excel" icon={FileUp} tone="son" size="sm" disabled={!yearId || ended} onPress={() => setImporting(true)} testID="class-import" />
        </> : <>
          {yearId ? <DownloadButton title="Xuất PDF" fetchBlob={() => api.downloadFile(token, listPdf)} filename={`danh_sach_lop_hoc_${year?.label ?? 'nam-hoc'}.pdf`} /> : null}
          <Btn title="Nhập từ Excel" icon={FileUp} tone="giay" size="sm" disabled={!yearId || ended} onPress={() => setImporting(true)} testID="class-create-import" />
          <Btn title="Tạo lớp" icon={Plus} tone="son" size="sm" disabled={!yearId || ended} onPress={() => setCreating(true)} testID="class-add" />
        </>} />
      {!years.length ? <Inset><Txt size={14}>Chưa có năm học nào. Hãy thêm và kích hoạt năm học ở mục “Trường và năm học” trước khi tạo lớp.</Txt></Inset> : null}
      {reviewing?<TeacherChangeReview session={session} requests={requests.data??[]} loading={requests.loading} error={requests.error} onReload={()=>{requests.reload();reload();}} onClose={()=>{setReviewing(false);reload();}}/>:null}
      <SearchFilterBar placeholder="Tìm theo tên lớp" value={q} onChange={setQ} searchId="class-search" filters={assign ? [f_name, f_teacher, f_students, f_join, f_active] : [f_name, f_registration, f_students, f_active]}
        extra={<View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>
          <View style={{ width: 220 }}><AdminSelect bare label="Năm học" value={String(yearId)} options={yearOptions(years)} onChange={(v) => {setYearSel(String(v));setSemesterSel('');}} testID="class-year" /></View>
          {assign ? <View style={{width:160}}><AdminSelect bare label="Học kỳ" value={String(semester)} options={SEMESTERS} onChange={setSemesterSel} testID="class-semester"/></View> : null}
          {/* khối chọn ở ô chọn (như trang Giáo viên / Học sinh), cột Khối không có nút lọc riêng */}
          <View style={{width:150}}><AdminSelect bare label="Khối" value={grade} options={GRADES} onChange={(v) => setGrade(String(v))} testID="class-grade"/></View>
        </View>} />
      {ended ? <Inset><Txt size={13}>Năm học đã kết thúc: chỉ xem được, không sửa lớp hay học sinh của năm này.</Txt></Inset> : null}
      <ErrorNote message={error} />
      {loading && !data ? <Spinner label="Đang tải danh sách lớp…" /> : null}
      {data ? (
        <DataTable rows={data.items} rowKey={(x) => x.id} empty="Chưa có lớp nào khớp bộ lọc." onRowPress={(x) => setOpen(x.id)}
          columns={assign ? [
            { key: 'name', filter: f_name, label: 'Lớp', render: (x) => <NameCell main={x.name} sub={`Khối ${x.grade ?? '?'}`} /> },
            { key: 'teachers', filter: f_teacher, label: 'Giáo viên phụ trách lớp', flex: 2, render: (x) => <NameCell main={x.teachers.map((t) => t.full_name).join(', ') || 'Chưa phân công'} sub={`Học kỳ ${semester}`} /> },
            { key: 'students', filter: f_students, label: 'Sĩ số', render: (x) => <Txt size={14}>{x.students}{x.expected_size ? ` / ${x.expected_size}` : ''}</Txt> },
            { key: 'code', filter: f_join, label: 'Mã tham gia', flex: 1.6, render: (x) => <Txt f="bold" size={(x.join_code?.length ?? 0) > 8 ? 13 : 15} selectable numberOfLines={1} style={{ letterSpacing: (x.join_code?.length ?? 0) > 8 ? 0 : 2 }}>{x.join_code ?? '—'}</Txt> },
            { key: 'status', filter: f_active, label: 'Trạng thái', render: (x) => <StatusChip kind={x.is_active ? 'on' : 'muted'} text={x.is_active ? (x.join_open ? 'Hoạt động' : 'Đóng tự tham gia') : 'Đã lưu trữ'} /> },
          ] : [
            { key: 'name', filter: f_name, label: 'Lớp', render: (x) => <NameCell main={x.name} sub={x.school_year} /> },
            { key: 'registration', filter: f_registration, label: 'Mã lớp', render: (x) => <Txt size={14} selectable>{x.registration_code}</Txt> },
            { key: 'grade', label: 'Khối', flex: 0.7, render: (x) => <Txt size={14}>Khối {x.grade ?? '?'}</Txt> },
            { key: 'expected', label: 'Sĩ số dự kiến', flex: 0.8, render: (x) => <Txt size={14}>{x.expected_size ?? '—'}</Txt> },
            { key: 'students', filter: f_students, label: 'Sĩ số', flex: 0.7, render: (x) => <Txt size={14}>{x.students}</Txt> },
            { key: 'status', filter: f_active, label: 'Trạng thái', render: (x) => <StatusChip kind={x.is_active ? 'on' : 'muted'} text={x.is_active ? 'Hoạt động' : 'Đã lưu trữ'} /> },
          ]} />
      ) : null}

      {open ? <ClassSheet session={session} id={open} mode={mode} semester={semester} classes={data?.items ?? []} teacherOptions={teacherOptions} onClose={() => setOpen(null)} onChanged={reload} /> : null}
      {creating && year ? (
        // 19/11/2026: tạo lớp chỉ gồm Lớp, Học kỳ, Khối, Sĩ số dự kiến; giáo viên và học sinh ở mục Phân công giáo viên
        <FormSheet title={`Tạo lớp – năm học ${year.label}`} subtitle="Điền lớp, học kỳ, khối và sĩ số dự kiến. Giáo viên phụ trách và học sinh xếp ở mục Phân công giáo viên." submitLabel="Tạo lớp" wide
          fields={[
            { name: 'name', label: 'Lớp', required: true, placeholder: '6A1', hint: 'Ví dụ 6A1; số đầu là khối.' }, {name:'semester',label:'Học kỳ',type:'select',required:true,options:SEMESTERS},
            { name: 'grade', label: 'Khối', type: 'select', required: true, options: GRADE_OPTIONS }, { name: 'expected_size', label: 'Sĩ số dự kiến', type: 'number' }]}
          initial={{ grade: grade || '6', semester:String(semester) }} onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            const name = String(v.name).trim();
            if (/^[6-9]/.test(name) && name[0] !== String(v.grade)) throw new Error(`Lớp ${name} có số đầu khác khối ${v.grade}.`);
            await api.createClass(token, { year_id: year.id,semester:Number(v.semester), grade: Number(v.grade), name, teacher_ids: [], student_ids: [], expected_size: String(v.expected_size) ? Number(v.expected_size) : null, description: null });
            setCreating(false);
            reload();
          }} />
      ) : null}
      {importing && yearId ? (assign ? <ClassImportSheet session={session} yearId={yearId} onClose={() => setImporting(false)} onDone={reload} /> : <ClassCreateImportSheet session={session} yearId={yearId} onClose={() => setImporting(false)} onDone={reload} />) : null}
    </Page>
  );
};

// ---------------------------------------------------------------------- tạo lớp từ Excel: cùng cách với nhập giáo viên / học sinh (19/11/2026)
const ClassCreateImportSheet: React.FC<{ session: Session; yearId: number; onClose: () => void; onDone: () => void }> = ({ session, yearId, onClose, onDone }) => {
  const { token } = session;
  const title = 'Tạo lớp từ Excel';
  const { data: spec, error, reload } = useLoad(() => api.classCreateSpec(token, yearId), [token, yearId], session.expired);
  if (!spec) return <Sheet open title={title} onClose={onClose}>{error ? <><ErrorNote message={error} /><Btn title="Thử lại" onPress={reload} /></> : <Spinner label="Đang tải file mẫu của trường…" />}</Sheet>;
  return <ImportSheet title={title} hint="Mỗi lớp một dòng: Lớp, Khối (6–9), Học kỳ (1 hoặc 2), Sĩ số dự kiến. Xem trước để thấy dòng lỗi (thiếu ô, trùng lớp, số đầu tên lớp khác khối) rồi bấm lưu để tạo các lớp hợp lệ."
    acceptText="Chỉ nhận file Excel." note={`Phải đúng file mẫu tạo lớp năm học ${spec.year_label} của ${spec.school_name} (${spec.filename}). File của trường hoặc năm học khác sẽ báo lỗi.`}
    template={{ filename: spec.filename, fetchBlob: () => api.downloadFile(token, `/api/admin/classes/create-template?year_id=${yearId}`) }}
    run={(file, commit) => api.importCreateClasses(token, file, { commit, year_id: yearId })} onClose={onClose} onDone={onDone} />;
};

// ---------------------------------------------------------------------- xếp lớp từ Excel: cùng cách với nhập giáo viên/học sinh
/** Mỗi lớp một file (ô Lớp, Học kỳ, Giáo viên phụ trách ở đầu file); chỉ nhận đúng file mẫu của trường và năm học; học sinh nhận ra bằng mã hoặc họ tên + ngày sinh */
const ClassImportSheet: React.FC<{ session: Session; yearId: number; onClose: () => void; onDone: () => void }> = ({ session, yearId, onClose, onDone }) => {
  const { token } = session;
  const title = 'Xếp học sinh vào lớp từ Excel';
  const { data: spec, error, reload } = useLoad(() => api.classImportSpec(token, yearId), [token, yearId], session.expired);
  if (!spec) return <Sheet open title={title} onClose={onClose}>{error ? <><ErrorNote message={error} /><Btn title="Thử lại" onPress={reload} /></> : <Spinner label="Đang tải file mẫu của trường…" />}</Sheet>;
  return <ImportSheet title={title} multiple hint={`Mỗi lớp một sheet (chép sheet trong Excel) hoặc mỗi lớp một file (chọn nhiều file cùng lúc). Mỗi lớp điền đủ Lớp, Khối, Học kỳ, Giáo viên phụ trách; thiếu một ô là file bị báo lỗi. Lớp chưa có sẽ được tạo, sĩ số lấy theo số học sinh thực có, lưu xong lớp có mã tham gia DongA + lớp + giáo viên + HK + năm học.`}
    acceptText="Chỉ nhận file Excel." note={`Phải đúng file mẫu xếp lớp năm học ${spec.year_label} của ${spec.school_name} (được thêm tên lớp ở cuối tên file, ví dụ ${spec.filename.replace(/\.xlsx$/, '')}_6A1.xlsx). File của trường hoặc năm học khác sẽ báo lỗi.`}
    template={{ filename: spec.filename, fetchBlob: () => api.downloadFile(token, `/api/admin/classes/template?year_id=${yearId}`) }}
    run={(file, commit) => api.importAssignments(token, file, { commit, year_id: yearId })} onClose={onClose} onDone={onDone} />;
};

// ---------------------------------------------------------------------- chi tiết một lớp (Lớp học: thông tin lớp; Phân công giáo viên: giáo viên, mã tham gia, học sinh)
const ClassSheet: React.FC<{
  session: Session; id: number; mode: 'classes' | 'assign'; semester:number; classes: ClassItem[]; teacherOptions: Array<{ value: string; label: string }>; onClose: () => void; onChanged: () => void;
}> = ({ session, id, mode, semester, classes, teacherOptions, onClose, onChanged }) => {
  const { c } = useTheme();
  const { token } = session;
  const assign = mode === 'assign';
  const { data, error, reload } = useLoad(() => api.getClass(token, id,semester), [token, id,semester], session.expired);
  const events = useLoad(() => api.classEvents(token, id), [token, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [dialog, setDialog] = useState<null | 'edit' | 'teacher' | 'add' | 'create' | 'archive' | 'delete' | 'code'>(null);
  const [credential, setCredential] = useState<CreatedAccount | null>(null);
  const [moving, setMoving] = useState<ClassDetail['members'][number] | null>(null);
  const [removing, setRemoving] = useState<ClassDetail['members'][number] | null>(null);
  const [reassign,setReassign]=useState<Parameters<typeof api.updateClass>[2]|null>(null);
  const refresh = () => { reload(); events.reload(); onChanged(); };
  const k = data as ClassDetail | null;
  const locked = k?.year_status === 'ended';
  const memberIds = new Set((k?.members ?? []).map((m) => m.id));
  const sameGrade = classes.filter((x) => x.id !== id && x.grade === k?.grade && x.year_id === k?.year_id && x.is_active).map((x) => ({ value: String(x.id), label: x.name }));

  // Lớp học: chỉ thông tin lớp (tên, khối, sĩ số dự kiến)
  const editFields: FieldDef[] = [
    {name:'registration_code',label:'Mã lớp',readOnly:true},
    { name: 'name', label: 'Tên lớp', required: true }, { name: 'grade', label: 'Khối', type: 'select', options: GRADE_OPTIONS, hint: k?.students ? 'Lớp đã có học sinh nên không đổi khối được.' : undefined },
    { name: 'expected_size', label: 'Sĩ số dự kiến', type: 'number' },
  ];
  // Phân công giáo viên: học kỳ + giáo viên phụ trách (đổi trong học kỳ đang diễn ra qua đề nghị và duyệt)
  const teacherFields: FieldDef[] = [
    {name:'semester',label:'Học kỳ',render:(v,set)=><AdminSelect label="Học kỳ" value={String(v.semester)} options={SEMESTERS} onChange={s=>{set('semester',s);const matches=k?.term_teachers?.filter(t=>t.semester===Number(s))??[];set('teacher_id',matches.length===1&&matches[0].teacher_id ? String(matches[0].teacher_id):'');}} testID="edit-class-semester"/>},
    { name: 'teacher_id', label: 'Giáo viên phụ trách lớp', render:(v,set)=>{
      const term=k?.term_teachers?.filter(t=>t.semester===Number(v.semester))??[];
      const needsApproval=k?.year_status==='active' && Number(v.semester)===k.active_semester && (term.some(t=>t.teacher_id!==null)||k.legacy_teacher_review);
      return needsApproval?<View style={{gap:8}}><Txt f="bold" size={14}>Giáo viên phụ trách lớp</Txt><Txt size={14}>{term.map(t=>t.teacher_name).filter(Boolean).join(', ')||'Chưa phân công'}</Txt><Txt size={13}>Thay đổi trong học kỳ được thực hiện qua đề nghị của giáo viên và quản trị trường duyệt.</Txt></View>:<AdminSelect label="Giáo viên phụ trách lớp (mã giáo viên · họ tên)" value={String(v.teacher_id)} options={[{value:'',label:'Chưa phân công'},...teacherOptions]} onChange={value=>set('teacher_id',value)} testID="field-teacher_id"/>;
    } },
  ];

  return (
    <>
      <Sheet open onClose={onClose} wide title={k ? `Lớp ${k.name}` : 'Lớp học'} subtitle={k ? `Khối ${k.grade ?? '?'} · năm học ${k.school_year}` : undefined}>
        <ErrorNote message={error} />
        {!k && !error ? <Spinner label="Đang tải…" /> : null}
        {k ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <StatusChip kind={k.is_active ? 'on' : 'muted'} text={k.is_active ? 'Đang hoạt động' : 'Đã lưu trữ'} />
              {assign ? <StatusChip kind={k.join_open ? 'info' : 'warn'} text={k.join_open ? 'Học sinh được tự tham gia bằng mã' : 'Đóng tự tham gia'} /> : null}
              {k.year_status ? <StatusChip kind={k.year_status === 'ended' ? 'muted' : 'info'} text={`Năm học ${YEAR_TEXT[k.year_status].toLowerCase()}`} /> : null}
            </View>
            {!assign ? (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                  {[['Mã lớp', k.registration_code], ['Khối', `Khối ${k.grade ?? '?'}`], ['Sĩ số dự kiến', k.expected_size ? String(k.expected_size) : 'Chưa có'], ['Sĩ số hiện có', `${k.members.length} học sinh`]].map(([label, value]) => (
                    <View key={label} style={{ flexBasis: 180, flexGrow: 1, gap: 2 }}><Txt f="bold" size={12} color={c.muc3}>{label}</Txt><Txt size={14} selectable>{value}</Txt></View>
                  ))}
                </View>
                <Inset><Txt size={13} color={c.muc2}>Giáo viên phụ trách, mã tham gia lớp và danh sách học sinh: xem và sửa ở mục Phân công giáo viên.</Txt></Inset>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Btn title="Sửa lớp" icon={Pencil} tone="giay" size="sm" disabled={locked} onPress={() => setDialog('edit')} testID="class-edit" />
                  <Btn title={k.is_active ? 'Lưu trữ' : 'Khôi phục'} icon={Archive} tone="giay" size="sm" disabled={locked} onPress={() => setDialog('archive')} />
                  <Btn title="Xóa lớp" icon={Trash2} tone="giay" size="sm" disabled={locked || k.students > 0} onPress={() => setDialog('delete')} />
                </View>
                {k.students > 0 && !locked ? <Txt size={13} color={c.muc3}>Lớp đã có học sinh nên chỉ lưu trữ được, không xóa.</Txt> : null}
              </>
            ) : (
              <>
                <Inset style={{ gap: 6 }}>
                  <Txt size={13} color={c.muc2}>Mã tham gia lớp (giáo viên đọc cho học sinh nhập)</Txt>
                  <Txt f="bold" size={(k.join_code?.length ?? 0) > 8 ? 20 : 30} selectable style={{ letterSpacing: (k.join_code?.length ?? 0) > 8 ? 0.5 : 6 }} testID="class-join-code">{k.join_code ?? '—'}</Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Btn title="Đổi mã mới" icon={RefreshCw} tone="giay" size="sm" disabled={locked || !k.is_active} onPress={() => setDialog('code')} />
                    <Btn title={k.join_open ? 'Tắt tự tham gia' : 'Bật tự tham gia'} tone="giay" size="sm" disabled={locked} onPress={async () => { if (await run(() => api.updateClass(token, id, { join_open: !k.join_open }), 'Đã cập nhật')) refresh(); }} />
                  </View>
                </Inset>
                {k.legacy_teacher_review ? <Inset><Txt size={14}>Chọn một giáo viên phụ trách lớp cho từng học kỳ ở nút Phân công giáo viên.</Txt></Inset>:null}
                {(k.term_teachers??[]).map((t,i)=><View key={`${t.semester}-${i}`} style={{gap:4}}><Txt size={14}><Txt f="bold" size={14}>Học kỳ {t.semester} · Giáo viên phụ trách lớp: </Txt>{t.teacher_name||'Chưa phân công'}</Txt><Txt size={12} color={c.muc3}>{fmtDay(t.starts_on)} → {fmtDay(t.ends_on)}</Txt></View>)}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Btn title="Phân công giáo viên" icon={UserCheck} tone="son" size="sm" disabled={locked} onPress={() => setDialog('teacher')} testID="class-assign-teacher" />
                  <DownloadButton title="Xuất PDF danh sách lớp" fetchBlob={() => api.downloadFile(token, `/api/admin/classes/export?class_id=${id}&semester=${semester}&format=pdf`)} filename={`danh_sach_lop_${k.name.replace(/[^A-Za-z0-9]+/g, '-')}_${k.school_year}_hoc-ky-${semester}.pdf`} />
                  <Btn title="Thêm học sinh đã có" icon={UserPlus} tone="giay" size="sm" disabled={locked || !k.is_active} onPress={() => setDialog('add')} testID="class-add-members" />
                  <Btn title="Tạo học sinh mới vào lớp" icon={Plus} tone="giay" size="sm" disabled={locked || !k.is_active} onPress={() => setDialog('create')} testID="class-create-student" />
                </View>

                {/* danh sách học sinh như bảng của file Excel: STT, Mã học sinh, Họ và tên, Ngày sinh, Giới tính; sĩ số là số học sinh thực có */}
                <Txt f="bold" size={15} testID="class-roster-title">Danh sách học sinh lớp {k.name} · Sĩ số {k.members.length} (Nam {k.members.filter((m) => m.gender === 'male').length} · Nữ {k.members.filter((m) => m.gender === 'female').length})</Txt>
                <DataTable paginate={false} gap={10} rows={k.members} rowKey={(m) => m.id} empty="Chưa có học sinh nào trong lớp."
                  columns={[
                    { key: 'stt', label: 'STT', width: 40, minWidth: 40, render: (m) => <Txt size={14} color={c.muc2}>{k.members.indexOf(m) + 1}</Txt> },
                    { key: 'code', label: 'Mã học sinh', width: 150, minWidth: 140, render: (m) => <Txt size={12} selectable numberOfLines={1}>{m.user_code ?? '—'}</Txt> },
                    { key: 'name', label: 'Họ và tên', width: 180, minWidth: 150, grow: 2, render: (m) => <NameCell main={`${m.full_name}${m.is_active ? '' : ' (đã khóa)'}`} /> },
                    { key: 'birth', label: 'Ngày sinh', width: 88, minWidth: 84, render: (m) => <Txt size={14}>{m.birth_date ? m.birth_date.split('-').reverse().join('/') : '—'}</Txt> },
                    { key: 'gender', label: 'Giới tính', width: 64, minWidth: 60, render: (m) => <Txt size={14}>{m.gender ? GENDER_TEXT[m.gender] : '—'}</Txt> },
                    { key: 'actions', label: '', width: 92, minWidth: 92, render: (m) => (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <Btn icon={ArrowRightLeft} label={`Chuyển ${m.full_name} sang lớp khác`} tone="giay" size="sm" disabled={locked || sameGrade.length === 0} onPress={() => setMoving(m)} />
                        <Btn icon={Trash2} label={`Gỡ ${m.full_name} khỏi lớp`} tone="giay" size="sm" disabled={locked} onPress={() => setRemoving(m)} />
                      </View>
                    ) },
                  ]} />
              </>
            )}
            <Txt f="bold" size={15}>Lịch sử của lớp</Txt>
            {(events.data ?? []).slice(0, 12).map((e) => <Txt key={e.id} size={13} color={c.muc2}>{dateText(e.created_at)} · {KIND_TEXT[e.kind] ?? e.kind}{e.user_name ? ` – ${e.user_name}` : ''}{e.teacher_name ? ` – ${e.teacher_name}` : ''}{e.actor_name ? ` (bởi ${e.actor_name})` : ' (học sinh tự thực hiện)'}{e.note ? ` · ${e.note}` : ''}</Txt>)}
          </>
        ) : null}
      </Sheet>

      {dialog === 'edit' && k ? (
        <FormSheet title="Sửa lớp" fields={editFields} wide onClose={() => setDialog(null)}
          initial={{ registration_code:k.registration_code,name: k.name, grade: String(k.grade ?? ''), expected_size: k.expected_size ? String(k.expected_size) : '' }}
          onSubmit={async (v) => {
            await api.updateClass(token, id, { name: String(v.name), grade: Number(v.grade) || undefined, expected_size: String(v.expected_size) ? Number(v.expected_size) : null });
            setDialog(null);
            refresh();
          }} />
      ) : null}
      {dialog === 'teacher' && k ? (
        <FormSheet title={`Phân công giáo viên – lớp ${k.name}`} subtitle="Mỗi học kỳ một giáo viên phụ trách; có giáo viên thì mã tham gia là DongA + lớp + giáo viên + HK + năm học." fields={teacherFields} wide onClose={() => setDialog(null)}
          initial={{ semester:String(k.semester),teacher_id:k.teachers.length===1?String(k.teachers[0].id):'' }}
          onSubmit={async (v) => {
            const term=k.term_teachers?.filter(t=>t.semester===Number(v.semester))??[];
            const needsApproval=k.year_status==='active' && Number(v.semester)===k.active_semester && (term.some(t=>t.teacher_id!==null)||k.legacy_teacher_review);
            if (needsApproval) { setDialog(null); return; }
            const body={ semester:Number(v.semester), teacher_ids: v.teacher_id?[Number(v.teacher_id)]:[] };
            const old=term.find(t=>t.semester===body.semester)?.teacher_id;
            if(k.legacy_teacher_review || (old && old!==(body.teacher_ids[0]??null))){setReassign(body);return;}
            await api.updateClass(token, id,body);
            setDialog(null);
            refresh();
          }} />
      ) : null}
      {reassign ? <ConfirmSheet open title="Đổi giáo viên phụ trách lớp" message={`Thay đổi giáo viên phụ trách lớp trong Học kỳ ${reassign.semester}? Phân công học kỳ khác và dữ liệu của lớp được giữ lại.`} confirmLabel="Xác nhận thay đổi" busy={busy} onCancel={()=>setReassign(null)} onConfirm={async()=>{if(await run(()=>api.updateClass(token,id,{...reassign,confirm_reassignment:true}),'Đã cập nhật phân công')){setReassign(null);setDialog(null);refresh();}}}/> : null}
      {dialog === 'create' && k ? (
        <FormSheet title={`Tạo học sinh mới vào lớp ${k.name}`} subtitle="Học sinh vào học muộn: điền các ô có dấu * như ở mục Học sinh. Tài khoản được tạo và xếp vào lớp này; có email thì tên đăng nhập và mật khẩu gửi vào email." submitLabel="Tạo và xếp vào lớp" wide
          fields={personFields(false, token)} onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            const body: Record<string, unknown> = { class_id: id };
            for (const f of personFields(false, token)) { if (f.render) continue; const raw = String(v[f.name] ?? '').trim(); if (raw) body[f.name] = raw; }
            const res = await api.createMember(token, 'students', body as never);
            setDialog(null);
            setCredential(res);
            refresh();
          }} />
      ) : null}
      {credential ? <CredentialSheet title={`Đã tạo và xếp vào lớp ${k?.name ?? ''}`} account={{ full_name: credential.user.full_name, username: credential.display_username ?? credential.user.username, temporary_password: credential.temporary_password, mail: credential.mail }} onClose={() => setCredential(null)} /> : null}
      {dialog === 'add' ? (
        <FormSheet title="Thêm học sinh đã có vào lớp" subtitle="Chọn nhiều học sinh của trường theo mã học sinh (họ tên, ngày sinh, giới tính tự hiện); học sinh có thể thuộc nhiều lớp" submitLabel="Thêm vào lớp" wide
          fields={[{ name: 'ids', label: 'Học sinh', render: (v, set) => <StudentPicker session={session} value={Array.isArray(v.ids) ? v.ids : []} onChange={(ids) => set('ids', ids)} exclude={memberIds} /> }]} initial={{ ids: [] }} onClose={() => setDialog(null)}
          onSubmit={async (v) => { const ids = valuesToIds(v.ids); if (!ids.length) throw new Error('Chọn ít nhất một học sinh.'); await api.addClassMembers(token, id, ids); setDialog(null); refresh(); }} />
      ) : null}
      {moving ? (
        <FormSheet title={`Chuyển ${moving.full_name}`} subtitle="Chỉ chuyển sang lớp cùng khối, cùng năm học; dữ liệu học giữ nguyên" submitLabel="Chuyển lớp"
          fields={[{ name: 'to', label: 'Lớp mới', type: 'select', required: true, options: [{ value: '', label: 'Chọn lớp' }, ...sameGrade] }]} onClose={() => setMoving(null)}
          onSubmit={async (v) => { await api.transferStudent(token, { student_id: moving.id, from_class_id: id, to_class_id: Number(v.to) }); setMoving(null); refresh(); }} />
      ) : null}
      <ConfirmSheet open={!!removing} title="Gỡ học sinh khỏi lớp" busy={busy} confirmLabel="Gỡ khỏi lớp" onCancel={() => setRemoving(null)} message={`Gỡ ${removing?.full_name} khỏi lớp ${k?.name}? Tài khoản và dữ liệu học của học sinh vẫn được giữ.`}
        onConfirm={async () => { if (removing && (await run(() => api.removeClassMember(token, id, removing.id).then(() => true), 'Đã gỡ khỏi lớp'))) { setRemoving(null); refresh(); } }} />
      <ConfirmSheet open={dialog === 'archive'} title={k?.is_active ? 'Lưu trữ lớp' : 'Khôi phục lớp'} busy={busy} confirmLabel={k?.is_active ? 'Lưu trữ' : 'Khôi phục'} onCancel={() => setDialog(null)}
        message={k?.is_active ? `Lưu trữ lớp ${k?.name}? Lớp không nhận học sinh mới và mã tham gia ngừng dùng được; dữ liệu giữ nguyên, khôi phục lại được.` : `Khôi phục lớp ${k?.name} về trạng thái hoạt động?`}
        onConfirm={async () => { if (k && (await run(() => api.archiveClass(token, id, k.is_active), 'Đã cập nhật lớp'))) { setDialog(null); refresh(); } }} />
      <ConfirmSheet open={dialog === 'delete'} title="Xóa lớp" busy={busy} confirmLabel="Xóa lớp" onCancel={() => setDialog(null)} message={`Xóa hẳn lớp ${k?.name}? Chỉ xóa được lớp chưa có học sinh.`}
        onConfirm={async () => { if (await run(() => api.deleteClass(token, id).then(() => true), 'Đã xóa lớp')) { setDialog(null); onChanged(); onClose(); } }} />
      <ConfirmSheet open={dialog === 'code'} title="Đổi mã tham gia lớp" busy={busy} confirmLabel="Đổi mã" onCancel={() => setDialog(null)} message="Tạo mã mới và vô hiệu hóa mã cũ? Học sinh đã vào lớp không bị ảnh hưởng."
        onConfirm={async () => { if (await run(() => api.regenerateJoinCode(token, id), 'Đã đổi mã')) { setDialog(null); refresh(); } }} />
    </>
  );
};
