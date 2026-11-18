/**
 * Chi tiết và thao tác trên một tài khoản (HK.AD.021–025, HK.QT.018–021, HK.QT.028–032): sửa thông tin, đổi vai trò (quản trị tổng), xóa.
 * Quản trị tổng được xóa từng tài khoản đã dùng; quản trị trường chỉ xóa khi chưa có dữ liệu. Dùng chung cho danh sách người dùng, giáo viên và học sinh.
 * 18/11/2026: khóa / mở khóa bằng nút gạt ở cột Trạng thái của danh sách (AccountActiveSwitch); đặt lại mật khẩu chỉ ở mục Mật khẩu tài khoản ("Cấp lại"
 * theo quy ước) nên hồ sơ không còn nút "Khóa tài khoản", "Đặt lại mật khẩu". Cùng ngày (đợt sau): hồ sơ có nút gạt Trạng thái như danh sách, luôn hiện
 * Ngày kết thúc (ngày khóa; chưa khóa thì "Chưa kết thúc"), lớp đang dạy / đã tham gia chia theo Năm học – Khối – Lớp.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Pencil, Trash2, UserCog } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { ErrorNote, FormSheet, StatusChip, useAction, useLoad, type FieldDef } from '@/components/admin/kit';
import { Btn, ConfirmSheet, Inset, Sheet, Spinner, Switch, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { nameCaseError } from '@/lib/person-name';
import { todayVn } from '@/lib/school-terms';
import { RegistrationCode } from './RegistrationCode';
import type { Session } from '@/components/auth';
import type { AccountDetail, AuthRole, Gender } from '@/types/api';

export const ROLE_TEXT: Record<AuthRole, string> = { root_admin: 'Quản trị viên tổng', school_admin: 'Quản trị viên trường học', teacher: 'Giáo viên', student: 'Học sinh' };
const GENDER_OPTIONS = [{ value: '', label: 'Chưa chọn' }, { value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }, { value: 'other', label: 'Khác' }];
export const GENDER_TEXT: Record<Gender, string> = { male: 'Nam', female: 'Nữ', other: 'Khác' };
export const dateText = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : 'Chưa có');
/** YYYY-MM-DD → dd/mm/yyyy */
const dmy = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : null);

/** Lớp của một người chia theo năm học và khối: [năm học, khối, "7A1, 7A2"] */
const classGroups = (classes: AccountDetail['classes']) => {
  const groups = new Map<string, { year: string; grade: number | null; names: string[] }>();
  for (const k of classes) {
    const key = `${k.school_year}|${k.grade ?? ''}`;
    const g = groups.get(key) ?? { year: k.school_year, grade: k.grade ?? null, names: [] };
    g.names.push(`${k.name}${k.is_active ? '' : ' (đã lưu trữ)'}`);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.year.localeCompare(a.year) || (a.grade ?? 0) - (b.grade ?? 0));
};

type Dialog = null | 'edit' | 'role' | 'delete';

type LockTarget = { id: number; full_name: string; is_active: boolean; role: AuthRole };

/**
 * Khóa / mở khóa bằng nút gạt (18/11/2026, thay nút "Khóa tài khoản / Mở khóa" của hồ sơ): gạt tắt thì hỏi lý do khóa (hiện cho người bị khóa khi đăng nhập,
 * mọi phiên bị thu hồi, hôm nay là ngày kết thúc), gạt bật thì hỏi xác nhận. Hộp thoại đặt ở cấp danh sách (`dialogs`), không nằm trong dòng bảng bấm được.
 */
export function useAccountLock(session: Session, onChanged: () => void) {
  const { busy, run } = useAction(session.expired);
  const [target, setTarget] = useState<LockTarget | null>(null);
  const dialogs = (
    <>
      {target?.is_active ? (
        <FormSheet title="Khóa tài khoản" subtitle={`${target.full_name} sẽ không đăng nhập được; dữ liệu được giữ nguyên`} submitLabel="Khóa tài khoản"
          fields={[{ name: 'reason', label: 'Lý do khóa', type: 'textarea', required: true, hint: 'Lý do hiện cho người bị khóa khi họ đăng nhập. Hôm nay được ghi là ngày kết thúc của tài khoản.' }]} onClose={() => setTarget(null)}
          onSubmit={async (v) => { await api.lockUser(session.token, target.id, true, String(v.reason)); setTarget(null); onChanged(); }} />
      ) : null}
      <ConfirmSheet open={!!target && !target.is_active} title="Mở khóa tài khoản" message={`Cho phép ${target?.full_name} đăng nhập trở lại? Ngày kết thúc sẽ được xóa.`} confirmLabel="Mở khóa" busy={busy} onCancel={() => setTarget(null)}
        onConfirm={async () => { if (target && (await run(() => api.lockUser(session.token, target.id, false), 'Đã mở khóa'))) { setTarget(null); onChanged(); } }} />
    </>
  );
  return { request: setTarget, dialogs };
}

/** Nút gạt Hoạt động ↔ Khóa trong cột Trạng thái. Không gạt được tài khoản của chính mình; quản trị tổng cấp 2 không gạt được quản trị tổng. */
export const AccountActiveSwitch: React.FC<{ session: Session; account: LockTarget; onRequest: (account: LockTarget) => void; label?: string }> = ({ session, account, onRequest, label }) => {
  const { c } = useTheme();
  const disabled = account.id === session.user.id || (account.role === 'root_admin' && session.user.admin_level !== 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Switch value={account.is_active} disabled={disabled} testID={`acc-active-${account.id}`} onChange={() => onRequest(account)}
        label={account.is_active ? `${account.full_name} đang hoạt động. Gạt để khóa` : `${account.full_name} đã khóa. Gạt để mở khóa`} />
      <Txt size={13} color={account.is_active ? c.muc2 : c.sonChu} style={{ flexShrink: 1 }}>{label ?? (account.is_active ? 'Hoạt động' : 'Đã khóa')}</Txt>
    </View>
  );
};

export const AccountSheet: React.FC<{
  session: Session; id: number; schools?: Array<{ value: string; label: string }>; onClose: () => void; onChanged: () => void;
  /** Có thể ẩn thao tác ở nơi chỉ xem; quyền xóa thực tế do API xác định qua deletable. */
  canDelete?: boolean;
}> = ({ session, id, schools = [], onClose, onChanged, canDelete = true }) => {
  const { c } = useTheme();
  const { token } = session;
  const root = session.user.role === 'root_admin';
  const { data, error, loading, reload } = useLoad(() => api.getUser(token, id), [token, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [dialog, setDialog] = useState<Dialog>(null);
  const changed = () => { reload(); onChanged(); };
  const lock = useAccountLock(session, changed);

  const u = data as AccountDetail | null;
  const self = u?.id === session.user.id;
  const locked = u ? !u.is_active : false;
  const protectedRoot = u?.role === 'root_admin' && session.user.admin_level !== 1;
  const canAct = !!u && !self && !protectedRoot;

  return (
    <>
      <Sheet open onClose={onClose} title={u?.full_name ?? 'Tài khoản'} subtitle={u ? ROLE_TEXT[u.role] : undefined} wide>
        {loading && !u ? <Spinner label="Đang tải…" /> : null}
        <ErrorNote message={error} />
        {u ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
              {([
                ['Tên đăng nhập', u.username], ['Mã người dùng', u.user_code], ['Email', u.email], ['Số điện thoại', u.phone], ['Trường', u.school_name],
                u.role === 'student' || u.role === 'teacher' || u.role === 'school_admin' ? ['Ngày sinh', dmy(u.birth_date)] : null, u.role === 'student' || u.role === 'teacher' ? ['Giới tính', u.gender ? GENDER_TEXT[u.gender] : null] : null,
                u.role === 'root_admin' ? ['Cấp quản trị', `Cấp ${u.admin_level}`] : null,
                ['Đăng nhập lần cuối', dateText(u.last_login_at)], ['Ngày tạo', dateText(u.created_at)],
                // ngày kết thúc = ngày khóa tài khoản (bỏ khi mở khóa); luôn hiện
                ['Ngày kết thúc', locked ? (u.locked_at ? dateText(u.locked_at) : 'Không rõ ngày') : 'Chưa kết thúc'],
              ] as Array<[string, string | null] | null>).filter((x): x is [string, string | null] => !!x).map(([k, v]) => (
                <View key={k} style={{ flexBasis: 200, flexGrow: 1, gap: 2 }}>
                  <Txt f="bold" size={12} color={c.muc3}>{k}</Txt>
                  <Txt size={14} selectable>{v || 'Chưa có'}</Txt>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              {/* trạng thái là nút gạt khóa / mở như cột Trạng thái của danh sách */}
              <AccountActiveSwitch session={session} account={u} onRequest={lock.request} label={locked ? 'Đã khóa' : 'Đang hoạt động'} />
              {u.must_change_password ? <StatusChip kind="warn" text="Chưa đổi mật khẩu tạm" /> : null}
              {u.self_registered ? <StatusChip kind="info" text="Tự đăng ký (tự học)" /> : null}
            </View>
            {locked ? <Inset style={{ backgroundColor: c.sonNhat }}><Txt size={14} color={c.sonChu}>Lý do khóa: {u.lock_reason || 'chưa ghi lý do'}</Txt></Inset> : null}
            {u.classes.length ? (
              <View style={{ gap: 6 }} testID="acc-classes">
                <Txt f="bold" size={14}>{u.role === 'teacher' ? 'Lớp đang dạy' : 'Lớp đã tham gia'}</Txt>
                <View style={{ borderWidth: 1, borderColor: c.adminLine, borderRadius: 10, overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', backgroundColor: c.adminCanvas, paddingHorizontal: 12, paddingVertical: 8, gap: 12 }}>
                    {['Năm học', 'Khối', 'Lớp'].map((h, i) => <Txt key={h} f="bold" size={12} color={c.muc3} style={{ flex: i === 2 ? 3 : 1 }}>{h}</Txt>)}
                  </View>
                  {classGroups(u.classes).map((g) => (
                    <View key={`${g.year}${g.grade}`} style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 12, borderTopWidth: 1, borderTopColor: c.adminLine }}>
                      <Txt size={14} style={{ flex: 1 }}>{g.year}</Txt>
                      <Txt size={14} style={{ flex: 1 }}>{g.grade ? `Khối ${g.grade}` : '—'}</Txt>
                      <Txt size={14} style={{ flex: 3 }}>{g.names.join(', ')}</Txt>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {self ? <Txt size={13} color={c.muc3}>Đây là tài khoản của bạn: không tự khóa, xóa hoặc đổi quyền được. Dùng mục Hồ sơ cá nhân để sửa thông tin.</Txt> : null}
            {protectedRoot ? <Txt size={13} color={c.muc3}>Quản trị tổng cấp 2 không được thay đổi tài khoản quản trị tổng.</Txt> : null}
            {canAct ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Btn title="Sửa thông tin" icon={Pencil} tone="giay" size="sm" onPress={() => setDialog('edit')} testID="acc-edit" />
                {root && session.user.admin_level === 1 ? <Btn title="Đổi vai trò" icon={UserCog} tone="giay" size="sm" onPress={() => setDialog('role')} testID="acc-role" /> : null}
                {canDelete ? <Btn title="Xóa" icon={Trash2} tone="giay" size="sm" disabled={!u.deletable} onPress={() => setDialog('delete')} testID="acc-delete" /> : null}
              </View>
            ) : null}
            {canAct && canDelete && !u.deletable ?<Txt size={13} color={c.muc3}>Không xóa được vì tài khoản {u.delete_blocker}; chỉ khóa được để giữ nguyên dữ liệu.</Txt> : null}
          </>
        ) : null}
      </Sheet>
      {lock.dialogs}

      {dialog === 'edit' && u ? (
        <FormSheet title="Sửa thông tin" subtitle={u.full_name} fields={editFields(u, root ? schools : [], token)}
          initial={{ full_name: u.full_name, email: u.email ?? '', phone: u.phone ?? '', user_code: u.user_code ?? '', birth_date: u.birth_date ?? '', gender: u.gender ?? '', school_id: u.school_id ? String(u.school_id) : '' }}
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            // đổi họ tên thì phải viết hoa chữ cái đầu mỗi từ (giữ nguyên họ tên cũ khi chỉ sửa thông tin khác)
            const nameError = String(v.full_name).trim() !== u.full_name ? nameCaseError(String(v.full_name)) : null;
            if (nameError) throw new Error(nameError);
            const body: Record<string, unknown> = { full_name: v.full_name, email: v.email || null, phone: v.phone || null };
            if (u.role === 'student') Object.assign(body, { birth_date: v.birth_date || null, gender: v.gender || null });
            if (u.role === 'teacher') Object.assign(body, { birth_date: v.birth_date || null, gender: v.gender || null });
            if (u.role === 'school_admin' && v.birth_date) body.birth_date = v.birth_date;
            if (root && u.role !== 'root_admin' && v.school_id && Number(v.school_id) !== u.school_id) body.school_id = Number(v.school_id);
            await api.updateUser(token, u.id, body);
            setDialog(null);
            changed();
          }} />
      ) : null}
      {dialog === 'role' && u ? (
        <FormSheet title="Đổi vai trò" subtitle="Mọi phiên đăng nhập hiện tại của tài khoản sẽ bị thu hồi" submitLabel="Đổi vai trò"
          fields={[
            { name: 'role', label: 'Vai trò mới', type: 'select', required: true, options: (['student', 'teacher', 'school_admin', 'root_admin'] as AuthRole[]).map((r) => ({ value: r, label: ROLE_TEXT[r] })) },
            { name: 'school_id', label: 'Trường', type: 'select', required: true, options: schools, when: (v) => v.role !== 'root_admin' },
            { name: 'admin_level', label: 'Cấp quản trị tổng', type: 'select', options: [{ value: '1', label: 'Cấp 1 (toàn quyền)' }, { value: '2', label: 'Cấp 2 (không quản lý quản trị tổng)' }], when: (v) => v.role === 'root_admin' },
          ]}
          initial={{ role: u.role, school_id: u.school_id ? String(u.school_id) : '', admin_level: String(u.admin_level) }} onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            await api.changeRole(token, u.id, { role: v.role as AuthRole, school_id: v.role === 'root_admin' ? null : Number(v.school_id), admin_level: v.role === 'root_admin' ? (Number(v.admin_level) === 2 ? 2 : 1) : undefined });
            setDialog(null);
            changed();
          }} />
      ) : null}
      <ConfirmSheet open={canDelete && dialog === 'delete'} title="Xóa tài khoản" message={root
        ? `Xóa tài khoản ${u?.full_name} (${u?.username}) và dữ liệu cá nhân liên quan khỏi hệ thống đang dùng? Mọi phiên đăng nhập của tài khoản sẽ mất hiệu lực. Trường, lớp, tài khoản khác và nhật ký được giữ lại. Bản dữ liệu đã xóa được lưu riêng một năm để kiểm tra rồi tự xóa; chưa có chức năng khôi phục trên giao diện.`
        : `Xóa tài khoản ${u?.full_name} khỏi danh sách? Chỉ xóa được tài khoản chưa phát sinh dữ liệu. Bản dữ liệu đã xóa được lưu riêng một năm để kiểm tra rồi tự xóa.`} confirmLabel="Xóa" busy={busy} onCancel={() => setDialog(null)}
        onConfirm={async () => { if (!u?.deletable) return; const ok = await run(() => api.deleteUser(token, u.id).then(() => true), 'Đã xóa tài khoản'); if (ok) { setDialog(null); onChanged(); onClose(); } }} />
    </>
  );
};

function editFields(u: AccountDetail, schools: Array<{ value: string; label: string }>, token:string): FieldDef[] {
  const fields: FieldDef[] = [
    { name: 'full_name', label: 'Họ và tên', required: true },
    { name: 'email', label: 'Email', type: 'email', required: u.role !== 'student', hint: 'Dùng để nhận mật khẩu tạm và mã OTP khi quên mật khẩu.' },
    { name: 'phone', label: 'Số điện thoại', type: 'phone', hint: 'Đúng 10 chữ số, ví dụ 0901234567.' },
  ];
  const today = todayVn();
  if (u.role === 'teacher') fields.push({ name: 'user_code', label: 'Mã giáo viên', render:(v)=><RegistrationCode token={token} kind="teacher" showSerial userId={u.id} schoolId={Number(v.school_id)||u.school_id||undefined} birthDate={String(v.birth_date||'')}/> }, { name: 'gender', label: 'Giới tính', type: 'select', options: GENDER_OPTIONS.filter((o) => o.value !== 'other') }, { name: 'birth_date', label: 'Ngày tháng năm sinh', type: 'date', calendar: true, min: '1940-01-01', max: today, required:true });
  if (u.role === 'student') fields.push({ name: 'user_code', label: 'Mã học sinh', render:(v)=><RegistrationCode token={token} kind="student" showSerial userId={u.id} schoolId={Number(v.school_id)||u.school_id||undefined} birthDate={String(v.birth_date||'')}/> }, { name: 'birth_date', label: 'Ngày tháng năm sinh', type: 'date', calendar: true, min: '2000-01-01', max: today, required: true }, { name: 'gender', label: 'Giới tính', type: 'select', options: GENDER_OPTIONS });
  // quản trị viên trường: ngày sinh dùng ghép mật khẩu theo quy ước (DongA + ngày sinh + @ + tên), có ở hộp tạo tài khoản quản trị
  if (u.role === 'school_admin') fields.push({ name: 'birth_date', label: 'Ngày tháng năm sinh', type: 'date', calendar: true, min: '1930-01-01', max: today, hint: 'Dùng ghép mật khẩu khi cấp lại theo quy ước.' });
  if (schools.length && u.role !== 'root_admin') fields.push({ name: 'school_id', label: 'Trường', type: 'select', options: schools, hint: 'Chỉ chuyển trường được khi tài khoản chưa thuộc lớp nào.' });
  return fields;
}
