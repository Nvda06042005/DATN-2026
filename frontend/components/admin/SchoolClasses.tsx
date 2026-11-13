/**
 * Lớp học của trường (HK.QT.022, HK.QT.035–039): tạo lớp theo năm học và khối (chọn luôn giáo viên phụ trách và học sinh theo mã, như file Excel xếp lớp),
 * mã tham gia DongA + lớp + giáo viên + HK + năm học, xếp học sinh (chọn hoặc Excel theo file mẫu của trường và năm học), chuyển lớp cùng khối, lưu trữ/xóa.
 * Nút "Nhân bản sang năm học mới" đã bỏ khỏi giao diện theo yêu cầu 12/11/2026 (API nhân bản vẫn giữ).
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Archive, ArrowRightLeft, CheckSquare, FileUp, Plus, RefreshCw, Square, Trash2, UserPlus, X } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { RegistrationCode } from './RegistrationCode';
import { TeacherChangeReview } from './ClassTeacherChange';
import { fmtDay,todayVn } from '@/lib/school-terms';
import { Cell, CredentialSheet, DataTable, DownloadButton, ErrorNote, FormSheet, ImportSheet, Page, PageHeader, SearchFilterBar, StatusChip, useAction, useDebounced, useLoad, valuesToIds, yearOptions, YEAR_TEXT, type FieldDef, type SearchFilter } from '@/components/admin/kit';
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
            { key: 'name', label: 'Họ và tên', width: 150, grow: 2, render: (s) => <Txt f="semibold" size={14} numberOfLines={1}>{s.full_name}</Txt> },
            { key: 'birth', label: 'Ngày sinh', width: 88, minWidth: 84, render: (s) => <Txt size={14}>{birth(s.birth_date)}</Txt> },
            { key: 'gender', label: 'Giới tính', width: 64, minWidth: 60, render: (s) => <Txt size={14}>{s.gender ? GENDER_TEXT[s.gender] : '—'}</Txt> },
            { key: 'remove', label: '', width: 48, minWidth: 48, render: (s) => <Btn icon={X} label={`Bỏ chọn ${s.full_name}`} tone="giay" size="sm" onPress={() => toggle(s)} /> },
          ]} />
      ) : null}
    </View>
  );
};

export const SchoolClasses: React.FC<{ session: Session; years: YearItem[]; onYearsChanged: () => void }> = ({ session, years }) => {
  const { token } = session;
  const [yearSel, setYearSel] = useState('');
  const yearId = Number(yearSel || years.find((y) => y.status === 'active')?.id || years[0]?.id || 0);
  const year = years.find((y) => y.id === yearId);
  const [semesterSel,setSemesterSel]=useState('');
  const semester=Number(semesterSel || (year?.term2_starts_on && todayVn()>=year.term2_starts_on ? '2':'1'));
  const [grade, setGrade] = useState('');
  const [q, setQ] = useState('');
  const [active, setActive] = useState('true');
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useLoad(() => (yearId ? api.listClasses(token, { year_id: yearId,semester, grade: grade || undefined, q: dq, active: active || undefined, limit: 200 }) : Promise.resolve(null)), [token, yearId,semester, grade, dq, active], session.expired);
  const { data: teachers } = useLoad(() => api.listMembers(token, 'teachers', { active: 'true', limit: 200 }), [token], session.expired);
  const { data: gradeData } = useLoad(() => (yearId ? api.listGrades(token, yearId) : Promise.resolve(null)), [token, yearId], session.expired);
  const teacherOptions = useMemo(() => (teachers?.items ?? []).map((t) => ({ value: String(t.id), label: `${t.user_code ?? 'Chưa có mã'} · ${t.full_name}` })), [teachers]);
  const openGrades = (gradeData?.grades ?? []).filter((g) => g.is_active).map((g) => ({ value: String(g.grade), label: `Khối ${g.grade}` }));
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const requests=useLoad(()=>api.teacherChangeRequests(token),[token],session.expired);
  const [reviewing,setReviewing]=useState(false);
  const ended = year?.status === 'ended';
  const f_grade: SearchFilter = { key: 'grade', label: 'Khối', value: grade, options: [{ value: '', label: 'Mọi khối' }, ...[6, 7, 8, 9].map((g) => ({ value: String(g), label: `Khối ${g}` }))], onChange: setGrade };
  const f_active: SearchFilter = { key: 'active', label: 'Trạng thái', value: active, options: [{ value: '', label: 'Tất cả' }, { value: 'true', label: 'Đang hoạt động' }, { value: 'false', label: 'Đã lưu trữ' }], onChange: setActive };

  return (
    <Page>
      <PageHeader title="Lớp học" subtitle="Tạo lớp theo năm học và khối, phân công giáo viên và xếp học sinh vào lớp."
        actions={<>
          <Btn title={`Đề nghị đổi giáo viên${requests.data?.length ? ` (${requests.data.length})`:''}`} tone="giay" size="sm" testID="teacher-change-review" onPress={()=>{requests.reload();setReviewing(true);}}/>
          {yearId ? <DownloadButton title="Xuất danh sách lớp" fetchBlob={() => api.downloadFile(token, `/api/admin/classes/export?year_id=${yearId}`)} filename={`danh_sach_lop_${year?.label ?? 'nam-hoc'}.xlsx`} /> : null}
          <Btn title="Xếp lớp từ Excel" icon={FileUp} tone="giay" size="sm" disabled={!yearId || ended} onPress={() => setImporting(true)} testID="class-import" />
          <Btn title="Tạo lớp" icon={Plus} tone="son" size="sm" disabled={!yearId || ended} onPress={() => setCreating(true)} testID="class-add" />
        </>} />
      {!years.length ? <Inset><Txt size={14}>Chưa có năm học nào. Hãy thêm và kích hoạt năm học ở mục “Trường và năm học” trước khi tạo lớp.</Txt></Inset> : null}
      {reviewing?<TeacherChangeReview session={session} requests={requests.data??[]} loading={requests.loading} error={requests.error} onReload={()=>{requests.reload();reload();}} onClose={()=>{setReviewing(false);reload();}}/>:null}
      <SearchFilterBar placeholder="Tìm theo tên lớp" value={q} onChange={setQ} searchId="class-search" filters={[f_grade, f_active]}
        extra={<View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}><View style={{ width: 220 }}><AdminSelect bare label="Năm học" value={String(yearId)} options={yearOptions(years)} onChange={(v) => {setYearSel(String(v));setSemesterSel('');}} testID="class-year" /></View><View style={{width:160}}><AdminSelect bare label="Học kỳ" value={String(semester)} options={SEMESTERS} onChange={setSemesterSel} testID="class-semester"/></View></View>} />
      {ended ? <Inset><Txt size={13}>Năm học đã kết thúc: chỉ xem được, không sửa lớp hay học sinh của năm này.</Txt></Inset> : null}
      <ErrorNote message={error} />
      {loading && !data ? <Spinner label="Đang tải danh sách lớp…" /> : null}
      {data ? (
        <DataTable rows={data.items} rowKey={(x) => x.id} empty="Chưa có lớp nào khớp bộ lọc." onRowPress={(x) => setOpen(x.id)}
          columns={[
            { key: 'name', label: 'Lớp', render: (x) => <Cell main={x.name} sub={x.school_year} /> },
            {key:'registration',label:'Mã lớp',render:x=><Txt size={14} selectable>{x.registration_code}</Txt>},
            { key: 'grade', filter: f_grade, label: 'Khối', flex: 0.7, render: (x) => <Txt size={14}>Khối {x.grade ?? '?'}</Txt> },
            { key: 'teachers', label: 'Giáo viên phụ trách lớp', flex: 2, render: (x) => <Cell main={x.teachers.map((t) => t.full_name).join(', ') || 'Chưa phân công'} sub={`Học kỳ ${semester}`} /> },
            { key: 'students', label: 'Sĩ số', render: (x) => <Txt size={14}>{x.students}{x.expected_size ? ` / ${x.expected_size}` : ''}</Txt> },
            { key: 'code', label: 'Mã tham gia', flex: 1.6, render: (x) => <Txt f="bold" size={(x.join_code?.length ?? 0) > 8 ? 13 : 15} selectable numberOfLines={1} style={{ letterSpacing: (x.join_code?.length ?? 0) > 8 ? 0 : 2 }}>{x.join_code ?? '—'}</Txt> },
            { key: 'status', filter: f_active, label: 'Trạng thái', render: (x) => <StatusChip kind={x.is_active ? 'on' : 'muted'} text={x.is_active ? (x.join_open ? 'Hoạt động' : 'Đóng tự tham gia') : 'Đã lưu trữ'} /> },
          ]} />
      ) : null}

      {open ? <ClassSheet session={session} id={open} semester={semester} classes={data?.items ?? []} teacherOptions={teacherOptions} gradeOptions={openGrades} onClose={() => setOpen(null)} onChanged={reload} /> : null}
      {creating && year ? (
        <FormSheet title={`Tạo lớp – năm học ${year.label}`} subtitle="Giống file Excel xếp lớp: lớp, khối, học kỳ, giáo viên phụ trách và danh sách học sinh chọn theo mã. Có giáo viên phụ trách thì mã tham gia là DongA + lớp + giáo viên + HK + năm học." submitLabel="Tạo lớp" wide
          fields={[
            { name: 'name', label: 'Lớp', required: true, placeholder: '6A1', hint: 'Ví dụ 6A1; số đầu là khối.' }, {name:'semester',label:'Học kỳ',type:'select',required:true,options:SEMESTERS},
            { name: 'grade', label: 'Khối', type: 'select', required: true, options: openGrades.length ? openGrades : [{ value: '', label: 'Chưa bật khối nào' }] }, { name: 'expected_size', label: 'Sĩ số dự kiến', type: 'number', hint: 'Chọn học sinh bên dưới thì sĩ số lấy theo số học sinh đã chọn.' },
            { name: 'teacher_id', label: 'Giáo viên phụ trách (mã giáo viên · họ tên)', type: 'select', options: [{value:'',label:'Chưa phân công'},...teacherOptions] },
            {name:'registration_code',label:'Mã lớp',render:()=> <RegistrationCode token={token} kind="class"/>},
            { name: 'student_ids', label: 'Học sinh', render: (v, set) => <StudentPicker session={session} value={Array.isArray(v.student_ids) ? v.student_ids : []} onChange={(ids) => set('student_ids', ids)} /> }]}
          initial={{ grade: openGrades[0]?.value ?? '',semester:String(semester), student_ids: [] }} onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            const studentIds = valuesToIds(v.student_ids);
            await api.createClass(token, { year_id: year.id,semester:Number(v.semester), grade: Number(v.grade), name: String(v.name), teacher_ids: v.teacher_id ? [Number(v.teacher_id)] : [], student_ids: studentIds, expected_size: !studentIds.length && String(v.expected_size) ? Number(v.expected_size) : null, description: null });
            setCreating(false);
            reload();
          }} />
      ) : null}
      {importing && yearId ? <ClassImportSheet session={session} yearId={yearId} onClose={() => setImporting(false)} onDone={reload} /> : null}
    </Page>
  );
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

// ---------------------------------------------------------------------- chi tiết một lớp
const ClassSheet: React.FC<{
  session: Session; id: number; semester:number; classes: ClassItem[]; teacherOptions: Array<{ value: string; label: string }>; gradeOptions: Array<{ value: string; label: string }>; onClose: () => void; onChanged: () => void;
}> = ({ session, id,semester, classes, teacherOptions, gradeOptions, onClose, onChanged }) => {
  const { c } = useTheme();
  const { token } = session;
  const { data, error, reload } = useLoad(() => api.getClass(token, id,semester), [token, id,semester], session.expired);
  const events = useLoad(() => api.classEvents(token, id), [token, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [dialog, setDialog] = useState<null | 'edit' | 'add' | 'create' | 'archive' | 'delete' | 'code'>(null);
  const [credential, setCredential] = useState<CreatedAccount | null>(null);
  const [moving, setMoving] = useState<ClassDetail['members'][number] | null>(null);
  const [removing, setRemoving] = useState<ClassDetail['members'][number] | null>(null);
  const [reassign,setReassign]=useState<Parameters<typeof api.updateClass>[2]|null>(null);
  const refresh = () => { reload(); events.reload(); onChanged(); };
  const k = data as ClassDetail | null;
  const locked = k?.year_status === 'ended';
  const memberIds = new Set((k?.members ?? []).map((m) => m.id));
  const sameGrade = classes.filter((x) => x.id !== id && x.grade === k?.grade && x.year_id === k?.year_id && x.is_active).map((x) => ({ value: String(x.id), label: x.name }));

  const editFields: FieldDef[] = [
    {name:'registration_code',label:'Mã lớp',readOnly:true},
    { name: 'name', label: 'Tên lớp', required: true }, { name: 'grade', label: 'Khối', type: 'select', options: gradeOptions, hint: k?.students ? 'Lớp đã có học sinh nên không đổi khối được.' : undefined },
    {name:'semester',label:'Học kỳ',render:(v,set)=><AdminSelect label="Học kỳ" value={String(v.semester)} options={SEMESTERS} onChange={s=>{set('semester',s);const matches=k?.term_teachers?.filter(t=>t.semester===Number(s))??[];set('teacher_id',matches.length===1&&matches[0].teacher_id ? String(matches[0].teacher_id):'');}} testID="edit-class-semester"/>},
    { name: 'teacher_id', label: 'Giáo viên phụ trách lớp', render:(v,set)=>{
      const term=k?.term_teachers?.filter(t=>t.semester===Number(v.semester))??[];
      const needsApproval=k?.year_status==='active' && Number(v.semester)===k.active_semester && (term.some(t=>t.teacher_id!==null)||k.legacy_teacher_review);
      return needsApproval?<View style={{gap:8}}><Txt f="bold" size={14}>Giáo viên phụ trách lớp</Txt><Txt size={14}>{term.map(t=>t.teacher_name).filter(Boolean).join(', ')||'Chưa phân công'}</Txt><Txt size={13}>Thay đổi trong học kỳ được thực hiện qua đề nghị của giáo viên và quản trị trường duyệt.</Txt></View>:<AdminSelect label="Giáo viên phụ trách lớp" value={String(v.teacher_id)} options={[{value:'',label:'Chưa phân công'},...teacherOptions]} onChange={value=>set('teacher_id',value)} testID="field-teacher_id"/>;
    } }, { name: 'expected_size', label: 'Sĩ số dự kiến', type: 'number' },
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
              <StatusChip kind={k.join_open ? 'info' : 'warn'} text={k.join_open ? 'Học sinh được tự tham gia bằng mã' : 'Đóng tự tham gia'} />
              {k.year_status ? <StatusChip kind={k.year_status === 'ended' ? 'muted' : 'info'} text={`Năm học ${YEAR_TEXT[k.year_status].toLowerCase()}`} /> : null}
            </View>
            <Inset style={{ gap: 6 }}>
              <Txt size={13} color={c.muc2}>Mã tham gia lớp (giáo viên đọc cho học sinh nhập)</Txt>
              <Txt f="bold" size={(k.join_code?.length ?? 0) > 8 ? 20 : 30} selectable style={{ letterSpacing: (k.join_code?.length ?? 0) > 8 ? 0.5 : 6 }} testID="class-join-code">{k.join_code ?? '—'}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Btn title="Đổi mã mới" icon={RefreshCw} tone="giay" size="sm" disabled={locked || !k.is_active} onPress={() => setDialog('code')} />
                <Btn title={k.join_open ? 'Tắt tự tham gia' : 'Bật tự tham gia'} tone="giay" size="sm" disabled={locked} onPress={async () => { if (await run(() => api.updateClass(token, id, { join_open: !k.join_open }), 'Đã cập nhật')) refresh(); }} />
              </View>
            </Inset>
            <Txt size={14}><Txt f="bold" size={14}>Mã lớp: </Txt>{k.registration_code}</Txt>
            {k.legacy_teacher_review ? <Inset><Txt size={14}>Chọn một giáo viên phụ trách lớp cho từng học kỳ ở mục Sửa lớp / phân công.</Txt></Inset>:null}
            {(k.term_teachers??[]).map((t,i)=><View key={`${t.semester}-${i}`} style={{gap:4}}><Txt size={14}><Txt f="bold" size={14}>Học kỳ {t.semester} · Giáo viên phụ trách lớp: </Txt>{t.teacher_name||'Chưa phân công'}</Txt><Txt size={12} color={c.muc3}>{fmtDay(t.starts_on)} → {fmtDay(t.ends_on)}</Txt></View>)}
            {k.description ? <Txt size={14} color={c.muc2}>{k.description}</Txt> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Btn title="Sửa lớp / phân công" tone="giay" size="sm" disabled={locked} onPress={() => setDialog('edit')} testID="class-edit" />
              <DownloadButton title="Xuất danh sách lớp" fetchBlob={() => api.downloadFile(token, `/api/admin/classes/export?class_id=${id}`)} filename={`danh_sach_lop_${k.name.replace(/[^A-Za-z0-9]+/g, '-')}_${k.school_year}.xlsx`} />
              <Btn title="Tạo học sinh mới vào lớp" icon={Plus} tone="son" size="sm" disabled={locked || !k.is_active} onPress={() => setDialog('create')} testID="class-create-student" />
              <Btn title="Thêm học sinh đã có" icon={UserPlus} tone="giay" size="sm" disabled={locked || !k.is_active} onPress={() => setDialog('add')} testID="class-add-members" />
              <Btn title={k.is_active ? 'Lưu trữ' : 'Khôi phục'} icon={Archive} tone="giay" size="sm" disabled={locked} onPress={() => setDialog('archive')} />
              <Btn title="Xóa lớp" icon={Trash2} tone="giay" size="sm" disabled={locked || k.students > 0} onPress={() => setDialog('delete')} />
            </View>
            {k.students > 0 && !locked ? <Txt size={13} color={c.muc3}>Lớp đã có học sinh nên chỉ lưu trữ được, không xóa.</Txt> : null}

            {/* danh sách học sinh như bảng của file Excel: STT, Mã học sinh, Họ và tên, Ngày sinh, Giới tính; sĩ số là số học sinh thực có */}
            <Txt f="bold" size={15} testID="class-roster-title">Danh sách học sinh lớp {k.name} · Sĩ số {k.members.length} (Nam {k.members.filter((m) => m.gender === 'male').length} · Nữ {k.members.filter((m) => m.gender === 'female').length})</Txt>
            <DataTable paginate={false} gap={10} rows={k.members} rowKey={(m) => m.id} empty="Chưa có học sinh nào trong lớp."
              columns={[
                { key: 'stt', label: 'STT', width: 40, minWidth: 40, render: (m) => <Txt size={14} color={c.muc2}>{k.members.indexOf(m) + 1}</Txt> },
                { key: 'code', label: 'Mã học sinh', width: 150, minWidth: 140, render: (m) => <Txt size={12} selectable numberOfLines={1}>{m.user_code ?? '—'}</Txt> },
                { key: 'name', label: 'Họ và tên', width: 150, grow: 2, render: (m) => <Txt f="semibold" size={14} numberOfLines={1}>{m.full_name}{m.is_active ? '' : ' (đã khóa)'}</Txt> },
                { key: 'birth', label: 'Ngày sinh', width: 88, minWidth: 84, render: (m) => <Txt size={14}>{m.birth_date ? m.birth_date.split('-').reverse().join('/') : '—'}</Txt> },
                { key: 'gender', label: 'Giới tính', width: 64, minWidth: 60, render: (m) => <Txt size={14}>{m.gender ? GENDER_TEXT[m.gender] : '—'}</Txt> },
                { key: 'actions', label: '', width: 92, minWidth: 92, render: (m) => (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Btn icon={ArrowRightLeft} label={`Chuyển ${m.full_name} sang lớp khác`} tone="giay" size="sm" disabled={locked || sameGrade.length === 0} onPress={() => setMoving(m)} />
                    <Btn icon={Trash2} label={`Gỡ ${m.full_name} khỏi lớp`} tone="giay" size="sm" disabled={locked} onPress={() => setRemoving(m)} />
                  </View>
                ) },
              ]} />
            <Txt f="bold" size={15}>Lịch sử của lớp</Txt>
            {(events.data ?? []).slice(0, 12).map((e) => <Txt key={e.id} size={13} color={c.muc2}>{dateText(e.created_at)} · {KIND_TEXT[e.kind] ?? e.kind}{e.user_name ? ` – ${e.user_name}` : ''}{e.teacher_name ? ` – ${e.teacher_name}` : ''}{e.actor_name ? ` (bởi ${e.actor_name})` : ' (học sinh tự thực hiện)'}{e.note ? ` · ${e.note}` : ''}</Txt>)}
          </>
        ) : null}
      </Sheet>

      {dialog === 'edit' && k ? (
        <FormSheet title="Sửa lớp" fields={editFields} wide onClose={() => setDialog(null)}
          initial={{ registration_code:k.registration_code,name: k.name, grade: String(k.grade ?? ''), semester:String(k.semester),teacher_id:k.teachers.length===1?String(k.teachers[0].id):'', expected_size: k.expected_size ? String(k.expected_size) : '' }}
          onSubmit={async (v) => {
            const term=k.term_teachers?.filter(t=>t.semester===Number(v.semester))??[];
            const needsApproval=k.year_status==='active' && Number(v.semester)===k.active_semester && (term.some(t=>t.teacher_id!==null)||k.legacy_teacher_review);
            const body={ name: String(v.name), grade: Number(v.grade) || undefined,semester:Number(v.semester), teacher_ids: needsApproval ? undefined : v.teacher_id?[Number(v.teacher_id)]:[], expected_size: String(v.expected_size) ? Number(v.expected_size) : null };
            const old=k.term_teachers?.find(t=>t.semester===body.semester)?.teacher_id;
            if(!needsApproval && (k.legacy_teacher_review || (old && old!==(body.teacher_ids?.[0]??null)))){setReassign(body);return;}
            await api.updateClass(token, id,body);
            setDialog(null);
            refresh();
          }} />
      ) : null}
      {reassign ? <ConfirmSheet open title="Đổi giáo viên phụ trách lớp" message={`Thay đổi giáo viên phụ trách lớp trong Học kỳ ${reassign.semester}? Phân công học kỳ khác và dữ liệu của lớp được giữ lại.`} confirmLabel="Xác nhận thay đổi" busy={busy} onCancel={()=>setReassign(null)} onConfirm={async()=>{if(await run(()=>api.updateClass(token,id,{...reassign,confirm_reassignment:true}),'Đã cập nhật phân công')){setReassign(null);setDialog(null);refresh();}}}/> : null}
      {dialog === 'create' && k ? (
        <FormSheet title={`Tạo học sinh mới vào lớp ${k.name}`} subtitle="Học sinh vào học muộn: điền đủ các ô có dấu * như ở mục Học sinh. Tài khoản được tạo và xếp vào lớp này; tên đăng nhập và mật khẩu gửi vào email." submitLabel="Tạo và xếp vào lớp" wide
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
