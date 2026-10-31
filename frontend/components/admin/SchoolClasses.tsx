/**
 * Lớp học của trường (HK.QT.022, HK.QT.035–040): tạo lớp theo năm học và khối, phân công nhiều giáo viên, mã tham gia 6 ký tự,
 * xếp học sinh (chọn hoặc Excel), chuyển lớp cùng khối, lưu trữ/xóa, nhân bản sang năm học mới (lên lớp).
 */
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Archive, ArrowRightLeft, FileUp, Plus, RefreshCw, Trash2, UserPlus } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { Cell, DataTable, ErrorNote, FilterBar, FilterBox, FormSheet, idsToValues, ImportSheet, Page, PageHeader, StatusChip, useAction, useDebounced, useLoad, valuesToIds, yearOptions, YEAR_TEXT, type FieldDef } from '@/components/admin/kit';
import { dateText } from '@/components/admin/AccountSheet';
import type { Session } from '@/components/auth';
import { Btn, Card, ConfirmSheet, Field, Inset, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { ClassDetail, ClassItem, CloneResult, YearItem } from '@/types/api';

const KIND_TEXT: Record<string, string> = {
  create: 'Tạo lớp', update: 'Sửa lớp', assign: 'Phân công giáo viên', unassign: 'Gỡ giáo viên', teachers: 'Phân công giáo viên', transfer: 'Chuyển lớp', close: 'Lưu trữ lớp', reopen: 'Khôi phục lớp',
  join: 'Học sinh tự tham gia bằng mã', member_add: 'Thêm học sinh', member_remove: 'Gỡ học sinh', code: 'Đổi mã tham gia', clone: 'Nhân bản từ năm học trước', join_open: 'Cho phép tự tham gia', join_closed: 'Tắt tự tham gia',
};

export const SchoolClasses: React.FC<{ session: Session; years: YearItem[]; onYearsChanged: () => void }> = ({ session, years }) => {
  const { token } = session;
  const [yearSel, setYearSel] = useState('');
  const yearId = Number(yearSel || years.find((y) => y.status === 'active')?.id || years[0]?.id || 0);
  const year = years.find((y) => y.id === yearId);
  const [grade, setGrade] = useState('');
  const [q, setQ] = useState('');
  const [active, setActive] = useState('true');
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useLoad(() => (yearId ? api.listClasses(token, { year_id: yearId, grade: grade || undefined, q: dq, active: active || undefined, limit: 200 }) : Promise.resolve(null)), [token, yearId, grade, dq, active], session.expired);
  const { data: teachers } = useLoad(() => api.listMembers(token, 'teachers', { active: 'true', limit: 200 }), [token], session.expired);
  const { data: gradeData } = useLoad(() => (yearId ? api.listGrades(token, yearId) : Promise.resolve(null)), [token, yearId], session.expired);
  const teacherOptions = useMemo(() => (teachers?.items ?? []).map((t) => ({ value: String(t.id), label: `${t.full_name}${t.subject ? ` – ${t.subject}` : ''}` })), [teachers]);
  const openGrades = (gradeData?.grades ?? []).filter((g) => g.is_active).map((g) => ({ value: String(g.grade), label: `Khối ${g.grade}` }));
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [cloned, setCloned] = useState<CloneResult | null>(null);
  const ended = year?.status === 'ended';

  return (
    <Page>
      <PageHeader title="Lớp học" subtitle="Tạo lớp theo năm học và khối, phân công giáo viên, xếp học sinh và nhân bản sang năm học mới."
        actions={<>
          <Btn title="Nhân bản sang năm học mới" icon={RefreshCw} tone="giay" size="sm" disabled={!yearId} onPress={() => setCloning(true)} testID="class-clone" />
          <Btn title="Xếp lớp từ Excel" icon={FileUp} tone="giay" size="sm" disabled={!yearId || ended} onPress={() => setImporting(true)} />
          <Btn title="Tạo lớp" icon={Plus} tone="son" size="sm" disabled={!yearId || ended} onPress={() => setCreating(true)} testID="class-add" />
        </>} />
      {!years.length ? <Inset><Txt size={14}>Chưa có năm học nào. Hãy thêm và kích hoạt năm học ở mục “Trường và năm học” trước khi tạo lớp.</Txt></Inset> : null}
      <FilterBar>
        <FilterBox><AdminSelect label="Năm học" value={String(yearId)} options={yearOptions(years)} onChange={(v) => setYearSel(String(v))} /></FilterBox>
        <FilterBox><AdminSelect label="Khối" value={grade} options={[{ value: '', label: 'Mọi khối' }, ...[6, 7, 8, 9].map((g) => ({ value: String(g), label: `Khối ${g}` }))]} onChange={(v) => setGrade(String(v))} /></FilterBox>
        <FilterBox><Field label="Tìm theo tên lớp" value={q} onChangeText={setQ} autoCapitalize="none" /></FilterBox>
        <FilterBox><AdminSelect label="Trạng thái" value={active} options={[{ value: 'true', label: 'Đang hoạt động' }, { value: 'false', label: 'Đã lưu trữ' }, { value: '', label: 'Tất cả' }]} onChange={(v) => setActive(String(v))} /></FilterBox>
      </FilterBar>
      {ended ? <Inset><Txt size={13}>Năm học đã kết thúc: chỉ xem được, không sửa lớp hay học sinh của năm này.</Txt></Inset> : null}
      <ErrorNote message={error} />
      {loading && !data ? <Spinner label="Đang tải danh sách lớp…" /> : null}
      {data ? (
        <DataTable rows={data.items} rowKey={(x) => x.id} empty="Chưa có lớp nào khớp bộ lọc." onRowPress={(x) => setOpen(x.id)}
          columns={[
            { key: 'name', label: 'Lớp', render: (x) => <Cell main={x.name} sub={`Khối ${x.grade ?? '?'} · ${x.school_year}`} /> },
            { key: 'teachers', label: 'Giáo viên phụ trách', flex: 2, render: (x) => <Txt size={14}>{x.teachers.map((t) => t.full_name).join(', ') || 'Chưa phân công'}</Txt> },
            { key: 'students', label: 'Sĩ số', render: (x) => <Txt size={14}>{x.students}{x.expected_size ? ` / ${x.expected_size}` : ''}</Txt> },
            { key: 'code', label: 'Mã tham gia', render: (x) => <Txt f="bold" size={15} selectable style={{ letterSpacing: 2 }}>{x.join_code ?? '—'}</Txt> },
            { key: 'status', label: 'Trạng thái', render: (x) => <StatusChip kind={x.is_active ? 'on' : 'muted'} text={x.is_active ? (x.join_open ? 'Hoạt động' : 'Đóng tự tham gia') : 'Đã lưu trữ'} /> },
          ]} />
      ) : null}

      {open ? <ClassSheet session={session} id={open} classes={data?.items ?? []} teacherOptions={teacherOptions} gradeOptions={openGrades} onClose={() => setOpen(null)} onChanged={reload} /> : null}
      {creating && year ? (
        <FormSheet title={`Tạo lớp – năm học ${year.label}`} subtitle="Mã tham gia 6 ký tự được tạo tự động" submitLabel="Tạo lớp"
          fields={[{ name: 'name', label: 'Tên lớp', required: true, placeholder: '7A1' }, { name: 'grade', label: 'Khối', type: 'select', required: true, options: openGrades.length ? openGrades : [{ value: '', label: 'Chưa bật khối nào' }] },
            { name: 'teacher_ids', label: 'Giáo viên phụ trách (chọn một hoặc nhiều)', type: 'multi', options: teacherOptions }, { name: 'expected_size', label: 'Sĩ số dự kiến', type: 'number' }, { name: 'description', label: 'Mô tả', type: 'textarea' }]}
          initial={{ grade: openGrades[0]?.value ?? '' }} onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            await api.createClass(token, { year_id: year.id, grade: Number(v.grade), name: String(v.name), teacher_ids: valuesToIds(v.teacher_ids), expected_size: String(v.expected_size) ? Number(v.expected_size) : null, description: String(v.description) || null });
            setCreating(false);
            reload();
          }} />
      ) : null}
      {cloning ? (
        <FormSheet title="Nhân bản lớp sang năm học mới" subtitle="Tạo lớp mới cho năm học đích với học sinh của lớp cũ (lên lớp)" submitLabel="Nhân bản"
          fields={[{ name: 'from', label: 'Từ năm học', type: 'select', required: true, options: yearOptions(years) }, { name: 'to', label: 'Sang năm học', type: 'select', required: true, options: [{ value: '', label: 'Chọn năm học đích' }, ...yearOptions(years.filter((y) => y.status !== 'ended'))] },
            { name: 'promote', label: 'Lên lớp', type: 'select', options: [{ value: 'yes', label: 'Có: khối + 1 (7A1 → 8A1); lớp khối 9 không lên lớp' }, { value: 'no', label: 'Không: giữ nguyên khối' }] },
            { name: 'copy_teachers', label: 'Giáo viên phụ trách', type: 'select', options: [{ value: 'yes', label: 'Chép sang lớp mới' }, { value: 'no', label: 'Để trống' }] }]}
          initial={{ from: String(yearId), to: String(years.find((y) => y.status !== 'ended' && y.id !== yearId)?.id ?? ''), promote: 'yes', copy_teachers: 'yes' }} onClose={() => setCloning(false)}
          onSubmit={async (v) => {
            const res = await api.cloneClasses(token, { from_year_id: Number(v.from), to_year_id: Number(v.to), promote: v.promote === 'yes', copy_teachers: v.copy_teachers === 'yes' });
            setCloning(false);
            setCloned(res);
            reload();
          }} />
      ) : null}
      {cloned ? (
        <Sheet open onClose={() => setCloned(null)} title="Kết quả nhân bản lớp" subtitle={`${cloned.from_year} → ${cloned.to_year}`} footer={<Btn title="Đóng" tone="son" onPress={() => setCloned(null)} />}>
          <Txt f="bold" size={14}>Đã tạo {cloned.created.length} lớp</Txt>
          {cloned.created.map((x) => <Txt key={x.id} size={14}>• {x.from_class} → {x.name} (khối {x.grade}, {x.students} học sinh)</Txt>)}
          {cloned.skipped.length ? <Txt f="bold" size={14}>Bỏ qua {cloned.skipped.length} lớp</Txt> : null}
          {cloned.skipped.map((x) => <Txt key={x.class} size={14}>• {x.class}: {x.reason}</Txt>)}
        </Sheet>
      ) : null}
      {importing && yearId ? (
        <ImportSheet title="Xếp học sinh vào lớp từ Excel" hint={`Mỗi dòng xếp một học sinh (theo mã học sinh) vào một lớp của năm học ${year?.label}. Học sinh đã ở trong lớp được bỏ qua.`}
          template={{ fetchBlob: () => api.downloadFile(token, '/api/admin/classes/template'), filename: 'mau-phan-lop.xlsx' }}
          run={(file, commit) => api.importAssignments(token, file, { commit, year_id: yearId })} onClose={() => setImporting(false)} onDone={reload} />
      ) : null}
    </Page>
  );
};

// ---------------------------------------------------------------------- chi tiết một lớp
const ClassSheet: React.FC<{
  session: Session; id: number; classes: ClassItem[]; teacherOptions: Array<{ value: string; label: string }>; gradeOptions: Array<{ value: string; label: string }>; onClose: () => void; onChanged: () => void;
}> = ({ session, id, classes, teacherOptions, gradeOptions, onClose, onChanged }) => {
  const { c } = useTheme();
  const { token } = session;
  const { data, error, reload } = useLoad(() => api.getClass(token, id), [token, id], session.expired);
  const events = useLoad(() => api.classEvents(token, id), [token, id], session.expired);
  const { data: students } = useLoad(() => api.listMembers(token, 'students', { active: 'true', limit: 200 }), [token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [dialog, setDialog] = useState<null | 'edit' | 'add' | 'archive' | 'delete' | 'code'>(null);
  const [moving, setMoving] = useState<ClassDetail['members'][number] | null>(null);
  const [removing, setRemoving] = useState<ClassDetail['members'][number] | null>(null);
  const refresh = () => { reload(); events.reload(); onChanged(); };
  const k = data as ClassDetail | null;
  const locked = k?.year_status === 'ended';
  const memberIds = new Set((k?.members ?? []).map((m) => m.id));
  const addOptions = (students?.items ?? []).filter((s) => !memberIds.has(s.id)).map((s) => ({ value: String(s.id), label: `${s.user_code ?? '—'} · ${s.full_name}` }));
  const sameGrade = classes.filter((x) => x.id !== id && x.grade === k?.grade && x.year_id === k?.year_id && x.is_active).map((x) => ({ value: String(x.id), label: x.name }));

  const editFields: FieldDef[] = [
    { name: 'name', label: 'Tên lớp', required: true }, { name: 'grade', label: 'Khối', type: 'select', options: gradeOptions, hint: k?.students ? 'Lớp đã có học sinh nên không đổi khối được.' : undefined },
    { name: 'teacher_ids', label: 'Giáo viên phụ trách (chọn một hoặc nhiều)', type: 'multi', options: teacherOptions }, { name: 'expected_size', label: 'Sĩ số dự kiến', type: 'number' }, { name: 'description', label: 'Mô tả', type: 'textarea' },
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
              <Txt f="bold" size={30} selectable style={{ letterSpacing: 6 }} testID="class-join-code">{k.join_code ?? '—'}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Btn title="Đổi mã mới" icon={RefreshCw} tone="giay" size="sm" disabled={locked || !k.is_active} onPress={() => setDialog('code')} />
                <Btn title={k.join_open ? 'Tắt tự tham gia' : 'Bật tự tham gia'} tone="giay" size="sm" disabled={locked} onPress={async () => { if (await run(() => api.updateClass(token, id, { join_open: !k.join_open }), 'Đã cập nhật')) refresh(); }} />
              </View>
            </Inset>
            <Txt size={14}><Txt f="bold" size={14}>Giáo viên phụ trách: </Txt>{k.teachers.map((t) => t.full_name).join(', ') || 'Chưa phân công'}</Txt>
            {k.description ? <Txt size={14} color={c.muc2}>{k.description}</Txt> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Btn title="Sửa lớp / phân công" tone="giay" size="sm" disabled={locked} onPress={() => setDialog('edit')} testID="class-edit" />
              <Btn title="Thêm học sinh" icon={UserPlus} tone="giay" size="sm" disabled={locked || !k.is_active} onPress={() => setDialog('add')} testID="class-add-members" />
              <Btn title={k.is_active ? 'Lưu trữ' : 'Khôi phục'} icon={Archive} tone="giay" size="sm" disabled={locked} onPress={() => setDialog('archive')} />
              <Btn title="Xóa lớp" icon={Trash2} tone="giay" size="sm" disabled={locked || k.students > 0} onPress={() => setDialog('delete')} />
            </View>
            {k.students > 0 && !locked ? <Txt size={13} color={c.muc3}>Lớp đã có học sinh nên chỉ lưu trữ được, không xóa.</Txt> : null}

            <Txt f="bold" size={15}>Học sinh ({k.members.length})</Txt>
            {k.members.length === 0 ? <Txt size={14} color={c.muc3}>Chưa có học sinh nào trong lớp.</Txt> : k.members.map((m) => (
              <Card key={m.id} flat pad={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <View style={{ flex: 1, minWidth: 160 }}><Txt f="semibold" size={14}>{m.full_name}{m.is_active ? '' : ' (đã khóa)'}</Txt><Txt size={12} color={c.muc3}>{m.user_code ?? '—'}{m.birth_date ? ` · ${m.birth_date}` : ''}</Txt></View>
                <Btn icon={ArrowRightLeft} label={`Chuyển ${m.full_name} sang lớp khác`} tone="giay" size="sm" disabled={locked || sameGrade.length === 0} onPress={() => setMoving(m)} />
                <Btn icon={Trash2} label={`Gỡ ${m.full_name} khỏi lớp`} tone="giay" size="sm" disabled={locked} onPress={() => setRemoving(m)} />
              </Card>
            ))}
            <Txt f="bold" size={15}>Lịch sử của lớp</Txt>
            {(events.data ?? []).slice(0, 12).map((e) => <Txt key={e.id} size={13} color={c.muc2}>{dateText(e.created_at)} · {KIND_TEXT[e.kind] ?? e.kind}{e.user_name ? ` – ${e.user_name}` : ''}{e.teacher_name ? ` – ${e.teacher_name}` : ''}{e.actor_name ? ` (bởi ${e.actor_name})` : ' (học sinh tự thực hiện)'}{e.note ? ` · ${e.note}` : ''}</Txt>)}
          </>
        ) : null}
      </Sheet>

      {dialog === 'edit' && k ? (
        <FormSheet title="Sửa lớp" fields={editFields} wide onClose={() => setDialog(null)}
          initial={{ name: k.name, grade: String(k.grade ?? ''), teacher_ids: idsToValues(k.teachers.map((t) => t.id)), expected_size: k.expected_size ? String(k.expected_size) : '', description: k.description ?? '' }}
          onSubmit={async (v) => {
            await api.updateClass(token, id, { name: String(v.name), grade: Number(v.grade) || undefined, teacher_ids: valuesToIds(v.teacher_ids), expected_size: String(v.expected_size) ? Number(v.expected_size) : null, description: String(v.description) || null });
            setDialog(null);
            refresh();
          }} />
      ) : null}
      {dialog === 'add' ? (
        <FormSheet title="Thêm học sinh vào lớp" subtitle="Chọn nhiều học sinh của trường; học sinh có thể thuộc nhiều lớp" submitLabel="Thêm vào lớp"
          fields={[{ name: 'ids', label: 'Học sinh', type: 'multi', required: true, options: addOptions }]} onClose={() => setDialog(null)}
          onSubmit={async (v) => { await api.addClassMembers(token, id, valuesToIds(v.ids)); setDialog(null); refresh(); }} />
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
