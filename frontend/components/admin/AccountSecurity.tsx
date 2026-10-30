import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as adminApi from '@/api/adminApi';
import { errorMessage } from '@/api/client';
import { ROLE_LABEL, type Session } from '@/components/auth';
import { Btn, Card, Chip, EmptyState, Field, Inset, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { useFail } from '@/components/provisioning';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime } from '@/lib/format';
import type { AuthRole, SchoolStat, SecurityPage, UserDetail } from '@/types/api';
import { AdminSelect } from './AdminSelect';

const PERMISSIONS: Record<AuthRole, string> = {
  root_admin: 'Quản lý tài khoản, phân quyền và dữ liệu toàn hệ thống; tạo tài khoản quản trị và quản lý trường.',
  school_admin: 'Quản lý giáo viên, học sinh, nhập tài khoản và duyệt lớp trong trường được gán. Không cấp hoặc sửa tài khoản quản trị.',
  teacher: 'Xem học sinh và bảng điểm trong lớp được phân công; mở lớp, tổ chức thi đấu và sử dụng công cụ dạy học.',
  student: 'Học, chơi game, tham gia lớp và xem tiến độ của chính mình.',
};
export function UserDetailSheet({ session, id, schools, onClose, onChanged }: { session: Session; id: number; schools: SchoolStat[]; onClose: () => void; onChanged: () => void }) {
  const { c } = useTheme();
  const [saved, setSaved] = useState<string | null>(null);
  const [data, setData] = useState<UserDetail | null>(null), [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<AuthRole>('student'), [schoolId, setSchoolId] = useState(0), [busy, setBusy] = useState(false);
  const system = session.user.role === 'root_admin';
  const canEdit = data && data.id !== session.user.id && (system || !['root_admin', 'school_admin'].includes(data.role));
  const load = useCallback(() => {
    setError(null);
    return adminApi.getUserDetail(session.token, id).then(user => { setData(user); setRole(user.role); setSchoolId(user.school_id ?? 0); }).catch(e => setError(errorMessage(e, 'Không tải được tài khoản.')));
  }, [session.token, id]);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    setBusy(true); setError(null); setSaved(null);
    try { await adminApi.assignRole(session.token, id, role, role === 'root_admin' ? undefined : schoolId || undefined); await load(); onChanged(); setSaved('Đã cập nhật phân quyền và thu hồi các phiên cũ.'); }
    catch (e) { setError(errorMessage(e, 'Không cập nhật được quyền.')); }
    finally { setBusy(false); }
  };
  const line = (label: string, value: string | number | null | undefined) => <View key={label} style={{ gap: 3 }}><Txt f="bold" size={12} color={c.muc3}>{label}</Txt><Txt size={14} selectable>{value ?? '—'}</Txt></View>;
  return <Sheet open onClose={busy ? () => undefined : onClose} title="Chi tiết tài khoản" subtitle={data?.username}>
    {saved && <Inset style={{ backgroundColor: c.ngocNhat }}><Txt color={c.ngocChu} accessibilityLiveRegion="polite">{saved}</Txt></Inset>}
    {!data && !error ? <Spinner label="Đang tải chi tiết…" /> : null}
    {error && <Inset style={{ backgroundColor: c.sonNhat }}><Txt color={c.sonChu} accessibilityRole="alert">{error}</Txt>{!data && <Btn title="Thử lại" onPress={load} />}</Inset>}
    {data && <View testID="admin-user-detail" style={{ gap: 18 }}>
      <View style={{ gap: 8 }}><Txt f="bold" size={22}>{data.full_name}</Txt><Chip text={data.is_active ? 'Đang hoạt động' : 'Đã khóa'} bg={data.is_active ? c.ngocNhat : c.sonNhat} fg={data.is_active ? c.ngocChu : c.sonChu} /></View>
      {line('Vai trò', ROLE_LABEL[data.role])}{line('Trường', data.school_name)}{line('Email', data.email)}{line('Mã người dùng', data.user_code)}{line('Khối / lớp', [data.grade ? `Khối ${data.grade}` : '', data.class_name].filter(Boolean).join(' · ') || null)}{line('Năm học', data.school_year)}{line('Ngày sinh', data.birth_date)}{line('Ngày tạo', formatDateTime(data.created_at))}{line('Đăng nhập gần nhất', data.last_login_at ? formatDateTime(data.last_login_at) : 'Chưa đăng nhập')}
      <Inset><Txt f="bold" size={14}>Phạm vi truy cập</Txt><Txt size={14} color={c.muc2}>{PERMISSIONS[data.role]}</Txt></Inset>
      <Txt f="bold" size={15}>Lớp liên quan</Txt>{data.classes.length ? data.classes.map(item => <Txt key={item.id} size={14}>{item.class_code} · {item.name} · {item.school_year} · {item.status === 'APPROVED' ? 'Đã duyệt' : item.status === 'PENDING' ? 'Chờ duyệt' : 'Từ chối'}</Txt>) : <Txt size={14} color={c.muc3}>Chưa có lớp.</Txt>}
      {canEdit && <Card pad={16} style={{ gap: 14 }}>
        <Txt f="bold" size={17}>Phân quyền tài khoản</Txt>
        <Segmented label="Vai trò mới" options={(system ? ['root_admin','school_admin','teacher','student'] as AuthRole[] : ['teacher','student'] as AuthRole[]).map(value => ({ value, label: ROLE_LABEL[value] }))} value={role} onChange={setRole} />
        {system && role !== 'root_admin' && <Segmented label="Trường được gán" options={schools.map(s => ({ value: s.id, label: s.name }))} value={schoolId} onChange={setSchoolId} />}
        <Txt size={13} color={c.muc2}>{PERMISSIONS[role]}</Txt><Txt size={13} color={c.sonChu}>Thay đổi quyền sẽ thu hồi các phiên hiện tại và bỏ lựa chọn lớp đang dùng. Tiến độ và lịch sử được giữ lại.</Txt>
        <Btn title="Lưu phân quyền" tone="son" loading={busy} disabled={role === data.role && (role === 'root_admin' || schoolId === data.school_id)} onPress={save} testID="admin-save-role" />
      </Card>}
    </View>}
  </Sheet>;
}

const REASONS: Record<string, string> = { success: 'Thành công', credentials: 'Sai thông tin đăng nhập', locked: 'Tài khoản đã khóa', deleted: 'Tài khoản ở thùng rác', portal: 'Sai cổng đăng nhập', rate_limit: 'Giới hạn số lần thử' };
const actionName = (action: string) => {
  if (action === 'LIVE grade_results') return 'Chấm điểm trận thi đấu';
  if (action.includes('/role')) return 'Phân quyền tài khoản';
  if (action.includes('/reset-password')) return 'Đặt lại mật khẩu';
  if (action.includes('/logout')) return 'Đăng xuất';
  if (action.includes('/change-password')) return 'Đổi mật khẩu';
  if (action.includes('/import')) return 'Nhập tài khoản';
  if (action.includes('/answer') || action.includes('/quiz-complete')) return 'Chấm câu trả lời / kết quả học';
  if (action.includes('/gems')) return 'Cập nhật Ấn Tín';
  if (action.includes('/users')) return action.startsWith('POST') ? 'Tạo tài khoản' : action.startsWith('DELETE') ? 'Chuyển tài khoản vào thùng rác' : 'Cập nhật / khóa tài khoản';
  return action;
};
export function SecurityHistory({ session, kind, schools }: { session: Session; kind: 'login' | 'audit'; schools: SchoolStat[] }) {
  const { c } = useTheme(), fail = useFail(session);
  const [q, setQ] = useState(''), [query, setQuery] = useState(''), [schoolId, setSchoolId] = useState(0), [success, setSuccess] = useState('all');
  const [data, setData] = useState<SecurityPage | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const serial = useRef(0);
  useEffect(() => { const timer = setTimeout(() => setQuery(q.trim()), 300); return () => clearTimeout(timer); }, [q]);
  const load = useCallback(async (page = 1) => {
    const version = ++serial.current; setLoading(true); setError(null);
    try { const result = await adminApi.getSecurityHistory(session.token, kind, { q: query, school_id: schoolId || undefined, success: success === 'all' ? undefined : success as 'true' | 'false', page, limit: 30 }); if (version === serial.current) setData(result); }
    catch (e) { if (version === serial.current) { setError(errorMessage(e, 'Không tải được lịch sử.')); fail(e); } }
    finally { if (version === serial.current) setLoading(false); }
  }, [session.token, kind, query, schoolId, success, fail]);
  useEffect(() => { void load(); return () => { serial.current++; }; }, [load]);
  return <View testID={`admin-${kind}-history`}><Card pad={20} style={{ gap: 16 }}>
    <Txt f="bold" size={19} accessibilityRole="header">{kind === 'login' ? 'Lịch sử đăng nhập' : 'Nhật ký thao tác'}</Txt>
    <Txt size={13} color={c.muc3}>Chỉ có sự kiện ghi nhận từ khi bật chức năng này; không tạo lại lịch sử cũ.</Txt>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
      <Field label={kind === 'login' ? 'Tên đăng nhập' : 'Người thực hiện hoặc thao tác'} value={q} onChangeText={setQ} autoCapitalize="none" style={{ flexGrow: 2, flexBasis: 220 }} />
      <View style={{ flexGrow: 1, flexBasis: 170 }}><AdminSelect label="Kết quả" value={success} onChange={setSuccess} options={[{ value: 'all', label: 'Tất cả kết quả' }, { value: 'true', label: 'Thành công' }, { value: 'false', label: 'Không thành công' }]} /></View>
      {session.user.role === 'root_admin' && <View style={{ flexGrow: 1, flexBasis: 220 }}><AdminSelect label="Trường" value={schoolId} onChange={setSchoolId} options={[{ value: 0, label: 'Tất cả trường' }, ...schools.map(s => ({ value: s.id, label: s.name }))]} /></View>}
      <Btn title="Tải lại" tone="giay" onPress={() => load(data?.page ?? 1)} />
    </View>
    {loading ? <Spinner label="Đang tải lịch sử…" /> : error ? <Txt color={c.sonChu} accessibilityRole="alert">{error}</Txt> : !data?.items.length ? <EmptyState title="Chưa có sự kiện phù hợp" text="Thử đổi từ khóa hoặc bộ lọc." /> : data.items.map(event => <View key={event.id} style={{ borderTopWidth: 1, borderColor: c.adminLine, paddingTop: 14, gap: 6 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}><Txt f="bold" size={14}>{kind === 'login' ? event.username : event.actor_name}</Txt><Chip text={event.success ? 'Thành công' : 'Không thành công'} bg={event.success ? c.ngocNhat : c.sonNhat} fg={event.success ? c.ngocChu : c.sonChu} /></View>
      <Txt size={13} color={c.muc2}>{formatDateTime(event.created_at)}{event.school_name ? ` · ${event.school_name}` : ' · Toàn hệ thống / chưa gán trường'}</Txt>
      <Txt size={14}>{kind === 'login' ? `${event.portal === 'app' ? 'Cổng học tập' : ROLE_LABEL[event.portal as AuthRole]} · ${REASONS[event.reason ?? ''] ?? event.reason}` : actionName(event.action ?? '')}</Txt>
      {kind === 'audit' && <Txt size={12} color={c.muc3} selectable>{event.action} · {event.target_type}{event.target_id ? ` #${event.target_id}` : ''}</Txt>}
    </View>)}
    {data && <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><Txt size={13} color={c.muc3}>{data.total} sự kiện · Trang {data.page} / {Math.max(1, Math.ceil(data.total / data.limit))}</Txt><View style={{ flexDirection: 'row', gap: 8 }}><Btn title="Trang trước" size="sm" tone="giay" disabled={loading || data.page <= 1} onPress={() => load(data.page - 1)} /><Btn title="Trang sau" size="sm" tone="giay" disabled={loading || data.page * data.limit >= data.total} onPress={() => load(data.page + 1)} /></View></View>}
  </Card></View>;
}
