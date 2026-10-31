/**
 * TM.SCH-CLASS (quản trị trường, quản trị tổng): bật khối theo năm học, tạo lớp, phân công/đổi/hủy giáo viên, chuyển học sinh, đóng/mở lớp.
 * Quản trị trường chỉ thao tác trường mình (máy chủ ép theo phiên); quản trị tổng chọn trường. Mọi thao tác có lịch sử ngay trong Sheet.
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import * as api from '@/api/adminApi';
import { errorMessage } from '@/api/client';
import type { Session } from '@/components/auth';
import { Btn, Card, Chip, Field, Inset, Segmented, Sheet, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { currentSchoolYear, formatDateTime } from '@/lib/format';
import type { AdminUser, ClassEvent, ClassView, DirectoryClass, SchoolGrade, SchoolStat } from '@/types/api';
import { AdminSelect } from './AdminSelect';

const GRADES = [6, 7, 8, 9] as const;
const NONE = 0;
const EVENT_TEXT: Record<string, string> = {
  create: 'Tạo lớp', update: 'Sửa thông tin', assign: 'Phân công giáo viên', change_teacher: 'Đổi giáo viên', unassign: 'Hủy phân công', transfer: 'Chuyển học sinh vào lớp',
  close: 'Đóng lớp', reopen: 'Mở lại lớp', join_password: 'Giáo viên đổi mật khẩu lớp', join_open: 'Mở đăng ký', join_closed: 'Đóng đăng ký',
};
const intText = (text: string) => (text.replace(/\D/g, '') === '' ? 0 : Number(text.replace(/\D/g, '')));
const Row = ({ children, gap = 8 }: { children: React.ReactNode; gap?: number }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap }}>{children}</View>;
function ErrorNote({ text }: { text: string | null }) {
  const { c } = useTheme();
  return text ? <Inset style={{ backgroundColor: c.sonNhat }}><Txt color={c.sonChu} accessibilityRole="alert">{text}</Txt></Inset> : null;
}

/** Giáo viên đang hoạt động của một trường, để chọn phân công */
function useTeachers(session: Session, schoolId: number | undefined) {
  const [teachers, setTeachers] = useState<AdminUser[]>([]);
  useEffect(() => {
    if (!schoolId) return;
    api.getUsers(session.token, { role: 'teacher', school_id: schoolId, active: 'true', limit: 200 }).then((p) => setTeachers(p.items)).catch(() => setTeachers([]));
  }, [session.token, schoolId]);
  return teachers;
}

// ====================================================================== khối theo năm học (SCH-CLASS.001/002)
export function GradeSetup({ session, schools, onChanged }: { session: Session; schools: SchoolStat[]; onChanged?: () => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const root = session.user.role === 'root_admin';
  const [schoolId, setSchoolId] = useState<number>(root ? schools[0]?.id ?? 0 : session.user.school_id ?? 0);
  const [year, setYear] = useState(currentSchoolYear());
  const [rows, setRows] = useState<SchoolGrade[] | null>(null), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState<number | null>(null);
  const valid = /^\d{4}-\d{4}$/.test(year) && Number(year.slice(5)) === Number(year.slice(0, 4)) + 1;
  const load = useCallback(() => {
    if (!valid || (root && !schoolId)) return;
    api.getSchoolGrades(session.token, { school_id: root ? schoolId : undefined, school_year: year }).then((v) => { setRows(v); setError(null); }).catch((e) => setError(errorMessage(e, 'Không tải được khối.')));
  }, [session.token, root, schoolId, year, valid]);
  useEffect(load, [load]);
  const toggle = async (grade: number, active: boolean) => {
    setBusy(grade);
    setError(null);
    try {
      setRows(await api.setSchoolGrade(session.token, { school_id: root ? schoolId : undefined, school_year: year, grade, is_active: active }));
      toast(active ? `Đã bật khối ${grade} năm học ${year}` : `Đã ngưng khối ${grade}`);
      onChanged?.();
    } catch (e) {
      setError(errorMessage(e, 'Không đổi được trạng thái khối.'));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card pad={18} style={{ gap: 12 }} >
      <Txt f="bold" size={17}>Khối theo năm học</Txt>
      <Txt size={13} color={c.muc3}>Bật khối trước khi tạo lớp. Chương trình hiện hỗ trợ THCS, khối 6–9. Ngưng khối chỉ được khi không còn lớp đang hoạt động; dữ liệu không bị xóa.</Txt>
      <Row gap={12}>
        {root && <View style={{ flexGrow: 2, flexBasis: 220 }}><AdminSelect label="Trường" value={schoolId} onChange={setSchoolId} options={schools.map((s) => ({ value: s.id, label: s.name }))} /></View>}
        <Field label="Năm học" value={year} onChangeText={setYear} placeholder="2026-2027" autoCapitalize="none" style={{ flexGrow: 1, flexBasis: 140 }} />
      </Row>
      {!valid && <Txt size={13} color={c.sonChu}>Năm học có dạng 2026-2027 (hai năm liên tiếp).</Txt>}
      <ErrorNote text={error} />
      {valid && (rows === null ? <Spinner /> : GRADES.map((g) => {
        const row = rows.find((r) => r.grade === g);
        return (
          <Row key={g} gap={10}>
            <Txt f="bold" size={15} style={{ width: 70 }}>Khối {g}</Txt>
            <Chip text={!row ? 'Chưa bật' : row.is_active ? 'Đang bật' : 'Đã ngưng'} bg={row?.is_active ? c.ngocNhat : row ? c.sonNhat : c.dichNhat} fg={row?.is_active ? c.ngocChu : row ? c.sonChu : c.muc2} />
            {row && <Txt size={13} color={c.muc3}>{row.active_classes}/{row.classes} lớp hoạt động</Txt>}
            <Btn title={row?.is_active ? 'Ngưng' : row ? 'Bật lại' : 'Bật khối'} tone={row?.is_active ? 'giay' : 'son'} size="sm" loading={busy === g} label={`${row?.is_active ? 'Ngưng' : 'Bật'} khối ${g}`} onPress={() => toggle(g, !row?.is_active)} />
          </Row>
        );
      }))}
    </Card>
  );
}

// ====================================================================== tạo lớp (SCH-CLASS.003)
export function NewClassSheet({ session, schools, onClose, onCreated }: { session: Session; schools: SchoolStat[]; onClose: () => void; onCreated: (c: ClassView) => void }) {
  const { c } = useTheme();
  const root = session.user.role === 'root_admin';
  const [schoolId, setSchoolId] = useState<number>(root ? schools[0]?.id ?? 0 : session.user.school_id ?? 0);
  const [f, setF] = useState({ year: currentSchoolYear(), grade: 7, code: '', name: '', size: '' });
  const [teacherId, setTeacherId] = useState(NONE);
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const teachers = useTeachers(session, schoolId);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onCreated(await api.createClassByAdmin(session.token, { school_id: root ? schoolId : undefined, class_code: f.code.trim(), school_year: f.year.trim(), grade: f.grade, name: f.name.trim(), expected_size: f.size ? intText(f.size) : null, teacher_id: teacherId || null }));
    } catch (e) {
      setError(errorMessage(e, 'Không tạo được lớp.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={busy ? () => undefined : onClose} title="Tạo lớp mới" subtitle="Lớp mới chưa có mật khẩu gia nhập; giáo viên được phân công sẽ đặt mật khẩu."
      footer={<Row gap={10}><Btn title="Hủy" tone="giay" onPress={onClose} disabled={busy} /><Btn title="Tạo lớp" tone="son" onPress={save} loading={busy} disabled={!f.code.trim() || f.name.trim().length < 2} /></Row>}>
      <ErrorNote text={error} />
      {root && <AdminSelect label="Trường" value={schoolId} onChange={setSchoolId} options={schools.map((s) => ({ value: s.id, label: s.name }))} />}
      <Field label="Năm học *" value={f.year} onChangeText={(v) => setF({ ...f, year: v })} placeholder="2026-2027" autoCapitalize="none" />
      <Segmented label="Khối" value={f.grade} onChange={(v) => setF({ ...f, grade: v })} options={GRADES.map((g) => ({ value: g, label: `Khối ${g}` }))} />
      <Field label="Mã lớp *" value={f.code} onChangeText={(v) => setF({ ...f, code: v.toUpperCase() })} autoCapitalize="characters" hint="2–20 ký tự, ví dụ 7A1. Duy nhất trong trường và năm học." />
      <Field label="Tên lớp *" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} placeholder="Lịch sử lớp 7A1" />
      <Field label="Sĩ số dự kiến" value={f.size} onChangeText={(v) => setF({ ...f, size: v.replace(/\D/g, '') })} keyboardType="number-pad" hint="1–100, không bắt buộc" />
      <AdminSelect label="Giáo viên phụ trách (có thể phân công sau)" value={teacherId} onChange={setTeacherId} options={[{ value: NONE, label: 'Chưa phân công' }, ...teachers.map((t) => ({ value: t.id, label: `${t.full_name} · ${t.username}` }))]} />
      <Txt size={12} color={c.muc3}>Khối phải đang được bật cho năm học này (mục “Khối theo năm học”).</Txt>
    </Sheet>
  );
}

// ====================================================================== quản lý một lớp (SCH-CLASS.004–009)
export function ClassManageSheet({ session, cls, onClose, onChanged }: { session: Session; cls: DirectoryClass; onClose: () => void; onChanged: () => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const [cur, setCur] = useState<ClassView>({ ...cls, teacher_id: cls.teacher_id, teacher_name: cls.teacher_name, students: cls.students } as ClassView);
  const [name, setName] = useState(cls.name), [grade, setGrade] = useState<number>(cls.grade ?? 7), [size, setSize] = useState(cls.expected_size ? String(cls.expected_size) : '');
  const teachers = useTeachers(session, cls.school_id);
  const [teacherId, setTeacherId] = useState<number>(cls.teacher_id ?? NONE);
  const [students, setStudents] = useState<AdminUser[]>([]), [targets, setTargets] = useState<DirectoryClass[]>([]);
  const [studentId, setStudentId] = useState(NONE), [toId, setToId] = useState(NONE);
  const [events, setEvents] = useState<ClassEvent[] | null>(null), [showEvents, setShowEvents] = useState(false);
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState<'close' | 'unassign' | null>(null);

  const loadPeople = useCallback(() => {
    api.getUsers(session.token, { role: 'student', school_id: cls.school_id, class_id: cls.id, limit: 200 }).then((p) => setStudents(p.items)).catch(() => setStudents([]));
    api.getClassDirectory(session.token, { school_id: cls.school_id, status: 'APPROVED', active: 'true', limit: 100 }).then((p) => setTargets(p.items.filter((k) => k.id !== cls.id))).catch(() => setTargets([]));
  }, [session.token, cls.school_id, cls.id]);
  useEffect(loadPeople, [loadPeople]);
  useEffect(() => {
    if (showEvents) api.getClassEvents(session.token, cls.id).then(setEvents).catch((e) => setError(errorMessage(e, 'Không tải được lịch sử.')));
  }, [showEvents, session.token, cls.id, cur]);

  const run = async (task: () => Promise<ClassView | void>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      const out = await task();
      if (out) setCur((v) => ({ ...v, ...out }));
      toast(done);
      onChanged();
      loadPeople();
    } catch (e) {
      setError(errorMessage(e, 'Thao tác không thành công.'));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };
  const infoChanged = name.trim() !== cur.name || grade !== (cur.grade ?? 7) || (size ? intText(size) : null) !== cur.expected_size;
  return (
    <Sheet open onClose={busy ? () => undefined : onClose} title={`Quản lý lớp ${cur.class_code}`} subtitle={`${cur.name} · ${cur.school_year} · ${cls.school_name}`}>
      <ErrorNote text={error} />
      <Row><Chip text={cur.is_active ? 'Đang hoạt động' : 'Đã đóng'} bg={cur.is_active ? c.ngocNhat : c.sonNhat} fg={cur.is_active ? c.ngocChu : c.sonChu} />
        <Chip text={cur.has_password ? (cur.join_open ? 'Đang mở đăng ký' : 'Đã đóng đăng ký') : 'Chưa có mật khẩu lớp'} bg={cur.has_password && cur.join_open ? c.thuyNhat : c.vangNhat} fg={cur.has_password && cur.join_open ? c.thuyChu : c.vangChu} />
        <Txt size={13} color={c.muc2}>{cur.students} học sinh{cur.expected_size ? ` / dự kiến ${cur.expected_size}` : ''}</Txt></Row>

      <Txt f="bold" size={16}>Thông tin lớp</Txt>
      <Field label="Tên lớp" value={name} onChangeText={setName} />
      <Segmented label="Khối" value={grade} onChange={setGrade} options={GRADES.map((g) => ({ value: g, label: `Khối ${g}` }))} />
      <Field label="Sĩ số dự kiến" value={size} onChangeText={(v) => setSize(v.replace(/\D/g, ''))} keyboardType="number-pad" />
      <Row><Btn title="Lưu thông tin" tone="son" size="sm" disabled={!infoChanged || busy} onPress={() => run(() => api.updateClassInfo(session.token, cur.id, { name: name.trim(), grade, expected_size: size ? intText(size) : null }), 'Đã lưu thông tin lớp')} /></Row>

      <Txt f="bold" size={16}>Giáo viên phụ trách</Txt>
      <Txt size={13} color={c.muc2}>Hiện tại: {cur.teacher_name ?? 'chưa phân công'}. Khi đổi hoặc hủy phân công, mật khẩu lớp cũ bị thu hồi (học sinh đã vào lớp không bị ảnh hưởng) và giáo viên mới đặt mật khẩu mới.</Txt>
      <AdminSelect label="Chọn giáo viên" value={teacherId} onChange={setTeacherId} options={[{ value: NONE, label: 'Chọn giáo viên' }, ...teachers.map((t) => ({ value: t.id, label: `${t.full_name} · ${t.username}` }))]} />
      <Row>
        <Btn title={cur.teacher_id ? 'Đổi giáo viên' : 'Phân công'} tone="son" size="sm" disabled={busy || !teacherId || teacherId === cur.teacher_id} onPress={() => run(() => api.assignClassTeacher(session.token, cur.id, teacherId), 'Đã phân công giáo viên, họ nhận thông báo')} />
        {!!cur.teacher_id && <Btn title="Hủy phân công" tone="giay" size="sm" disabled={busy} onPress={() => setConfirm('unassign')} />}
      </Row>

      <Txt f="bold" size={16}>Chuyển học sinh sang lớp khác</Txt>
      <Txt size={13} color={c.muc2}>Chỉ chuyển trong cùng trường. Điểm, tiến độ và lịch sử thi đấu của học sinh được giữ nguyên.</Txt>
      <AdminSelect label="Học sinh" value={studentId} onChange={setStudentId} options={[{ value: NONE, label: students.length ? 'Chọn học sinh' : 'Lớp chưa có học sinh' }, ...students.map((s) => ({ value: s.id, label: `${s.full_name} · ${s.username}` }))]} />
      <AdminSelect label="Chuyển tới lớp" value={toId} onChange={setToId} options={[{ value: NONE, label: 'Chọn lớp đích' }, ...targets.map((k) => ({ value: k.id, label: `${k.class_code} · ${k.name} (${k.school_year})` }))]} />
      <Row><Btn title="Chuyển học sinh" tone="son" size="sm" disabled={busy || !studentId || !toId} onPress={() => run(async () => { const out = await api.transferClassStudent(session.token, cur.id, studentId, toId); setStudentId(NONE); setToId(NONE); return out.from; }, 'Đã chuyển học sinh, học sinh và giáo viên lớp mới nhận thông báo')} /></Row>

      <Txt f="bold" size={16}>Trạng thái lớp</Txt>
      <Txt size={13} color={c.muc2}>Đóng lớp ngưng hoạt động và ngưng nhận học sinh; thành viên, điểm và lịch sử thi đấu được giữ. Mở lại lớp thì đăng ký vẫn đóng cho tới khi giáo viên mở.</Txt>
      <Row>{cur.is_active
        ? <Btn title="Đóng lớp" tone="giay" size="sm" disabled={busy} onPress={() => setConfirm('close')} />
        : <Btn title="Mở lại lớp" tone="son" size="sm" disabled={busy} onPress={() => run(() => api.updateClassInfo(session.token, cur.id, { is_active: true }), 'Đã mở lại lớp')} />}</Row>

      <Btn title={showEvents ? 'Ẩn lịch sử lớp' : 'Xem lịch sử lớp'} tone="giay" size="sm" onPress={() => setShowEvents((v) => !v)} />
      {showEvents && (events === null ? <Spinner label="Đang tải lịch sử…" /> : events.map((e) => (
        <Txt key={e.id} size={13} color={c.muc2}>
          {formatDateTime(e.created_at)} · {EVENT_TEXT[e.kind] ?? e.kind}
          {e.teacher_name ? ` · ${e.teacher_name}` : ''}{e.previous_teacher_name ? ` (trước: ${e.previous_teacher_name})` : ''}
          {e.student_name ? ` · ${e.student_name}${e.related_class_code ? ` từ ${e.related_class_code}` : ''}` : ''}{e.note ? ` · ${e.note}` : ''}{e.actor_name ? ` · bởi ${e.actor_name}` : ''}
        </Txt>
      )))}
      {/* Xác nhận ngay trong Sheet: không mở Modal thứ hai chồng lên */}
      {confirm && (
        <Inset style={{ gap: 10, backgroundColor: c.vangNhat }}>
          <Txt f="bold" size={15}>{confirm === 'close' ? 'Đóng lớp này?' : 'Hủy phân công giáo viên?'}</Txt>
          <Txt size={13}>{confirm === 'close' ? 'Lớp ngưng hoạt động và ngưng nhận học sinh. Thành viên, điểm và lịch sử thi đấu được giữ nguyên.' : 'Giáo viên mất quyền với lớp này và mật khẩu gia nhập bị thu hồi. Học sinh trong lớp vẫn giữ nguyên.'}</Txt>
          <Row>
            <Btn title="Hủy" tone="giay" size="sm" disabled={busy} onPress={() => setConfirm(null)} />
            <Btn title={confirm === 'close' ? 'Đóng lớp' : 'Hủy phân công'} tone="son" size="sm" loading={busy}
              onPress={() => (confirm === 'close' ? run(() => api.updateClassInfo(session.token, cur.id, { is_active: false }), 'Đã đóng lớp') : run(async () => { const out = await api.assignClassTeacher(session.token, cur.id, null); setTeacherId(NONE); return out; }, 'Đã hủy phân công'))} />
          </Row>
        </Inset>
      )}
    </Sheet>
  );
}
