/**
 * Chi tiết và thao tác trên một tài khoản (HK.AD.021–025, HK.QT.018–021, HK.QT.028–032): sửa thông tin, đổi vai trò (quản trị tổng),
 * khóa/mở khóa kèm lý do, đặt lại mật khẩu, xóa khi chưa phát sinh dữ liệu. Dùng chung cho danh sách người dùng, giáo viên và học sinh.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { KeyRound, Lock, Pencil, Trash2, Unlock, UserCog } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { CredentialSheet, ErrorNote, FormSheet, StatusChip, useAction, useLoad, type FieldDef } from '@/components/admin/kit';
import { Btn, ConfirmSheet, Inset, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { Session } from '@/components/auth';
import type { AccountDetail, AuthRole, CreatedAccount, Gender } from '@/types/api';

export const ROLE_TEXT: Record<AuthRole, string> = { root_admin: 'Quản trị viên tổng', school_admin: 'Quản trị viên trường học', teacher: 'Giáo viên', student: 'Học sinh' };
const GENDER_OPTIONS = [{ value: '', label: 'Chưa chọn' }, { value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }, { value: 'other', label: 'Khác' }];
export const GENDER_TEXT: Record<Gender, string> = { male: 'Nam', female: 'Nữ', other: 'Khác' };
export const dateText = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : 'Chưa có');

type Dialog = null | 'edit' | 'role' | 'lock' | 'unlock' | 'reset' | 'delete';

export const AccountSheet: React.FC<{
  session: Session; id: number; schools?: Array<{ value: string; label: string }>; onClose: () => void; onChanged: () => void;
}> = ({ session, id, schools = [], onClose, onChanged }) => {
  const { c } = useTheme();
  const { token } = session;
  const root = session.user.role === 'root_admin';
  const { data, error, loading, reload } = useLoad(() => api.getUser(token, id), [token, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [credential, setCredential] = useState<CreatedAccount | null>(null);
  const changed = () => { reload(); onChanged(); };
  if (credential) return <CredentialSheet title="Mật khẩu tạm mới" account={{ full_name: credential.user.full_name, username: credential.user.username, temporary_password: credential.temporary_password, mail: credential.mail }} onClose={() => setCredential(null)} />;

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
                u.role === 'teacher' ? ['Bộ môn', u.subject] : null, u.role === 'student' ? ['Ngày sinh', u.birth_date] : null, u.role === 'student' ? ['Giới tính', u.gender ? GENDER_TEXT[u.gender] : null] : null,
                u.role === 'student' ? ['Email phụ huynh', u.parent_email] : null, u.role === 'root_admin' ? ['Cấp quản trị', `Cấp ${u.admin_level}`] : null,
                ['Đăng nhập lần cuối', dateText(u.last_login_at)], ['Ngày tạo', dateText(u.created_at)],
              ] as Array<[string, string | null] | null>).filter((x): x is [string, string | null] => !!x).map(([k, v]) => (
                <View key={k} style={{ flexBasis: 200, flexGrow: 1, gap: 2 }}>
                  <Txt f="bold" size={12} color={c.muc3}>{k}</Txt>
                  <Txt size={14} selectable>{v || 'Chưa có'}</Txt>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <StatusChip kind={locked ? 'off' : 'on'} text={locked ? 'Đã khóa' : 'Đang hoạt động'} />
              {u.must_change_password ? <StatusChip kind="warn" text="Chưa đổi mật khẩu tạm" /> : null}
              {u.self_registered ? <StatusChip kind="info" text="Tự đăng ký (tự học)" /> : null}
            </View>
            {locked ? <Inset style={{ backgroundColor: c.sonNhat }}><Txt size={14} color={c.sonChu}>Lý do khóa: {u.lock_reason || 'chưa ghi lý do'}{u.locked_at ? ` · ${dateText(u.locked_at)}` : ''}</Txt></Inset> : null}
            {u.classes.length ? (
              <View style={{ gap: 4 }}>
                <Txt f="bold" size={14}>{u.role === 'teacher' ? 'Lớp phụ trách' : 'Lớp đã tham gia'}</Txt>
                {u.classes.map((k) => <Txt key={`${k.relation}${k.id}`} size={14} color={c.muc2}>• {k.name} · khối {k.grade ?? '?'} · {k.school_year}{k.is_active ? '' : ' (đã lưu trữ)'}</Txt>)}
              </View>
            ) : null}
            {self ? <Txt size={13} color={c.muc3}>Đây là tài khoản của bạn: không tự khóa, xóa hoặc đổi quyền được. Dùng mục Hồ sơ cá nhân để sửa thông tin.</Txt> : null}
            {protectedRoot ? <Txt size={13} color={c.muc3}>Quản trị tổng cấp 2 không được thay đổi tài khoản quản trị tổng.</Txt> : null}
            {canAct ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Btn title="Sửa thông tin" icon={Pencil} tone="giay" size="sm" onPress={() => setDialog('edit')} testID="acc-edit" />
                {root && session.user.admin_level === 1 ? <Btn title="Đổi vai trò" icon={UserCog} tone="giay" size="sm" onPress={() => setDialog('role')} testID="acc-role" /> : null}
                {locked ? <Btn title="Mở khóa" icon={Unlock} tone="giay" size="sm" onPress={() => setDialog('unlock')} /> : <Btn title="Khóa tài khoản" icon={Lock} tone="giay" size="sm" onPress={() => setDialog('lock')} testID="acc-lock" />}
                <Btn title="Đặt lại mật khẩu" icon={KeyRound} tone="giay" size="sm" onPress={() => setDialog('reset')} testID="acc-reset" />
                <Btn title="Xóa" icon={Trash2} tone="giay" size="sm" disabled={!u.deletable} onPress={() => setDialog('delete')} testID="acc-delete" />
              </View>
            ) : null}
            {canAct && !u.deletable ? <Txt size={13} color={c.muc3}>Không xóa được vì tài khoản {u.delete_blocker}; chỉ khóa được để giữ nguyên dữ liệu.</Txt> : null}
          </>
        ) : null}
      </Sheet>

      {dialog === 'edit' && u ? (
        <FormSheet title="Sửa thông tin" subtitle={u.full_name} fields={editFields(u, root ? schools : [])}
          initial={{ full_name: u.full_name, email: u.email ?? '', phone: u.phone ?? '', subject: u.subject ?? '', user_code: u.user_code ?? '', birth_date: u.birth_date ?? '', gender: u.gender ?? '', parent_email: u.parent_email ?? '', school_id: u.school_id ? String(u.school_id) : '' }}
          onClose={() => setDialog(null)}
          onSubmit={async (v) => {
            const body: Record<string, unknown> = { full_name: v.full_name, email: v.email || null, phone: v.phone || null };
            if (u.role === 'teacher') Object.assign(body, { subject: v.subject || null });
            if (u.role === 'student') Object.assign(body, { user_code: v.user_code, birth_date: v.birth_date || null, gender: v.gender || null, parent_email: v.parent_email || null });
            if (u.role === 'teacher') Object.assign(body, { user_code: v.user_code || null });
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
      {dialog === 'lock' && u ? (
        <FormSheet title="Khóa tài khoản" subtitle={`${u.full_name} sẽ không đăng nhập được; dữ liệu được giữ nguyên`} submitLabel="Khóa tài khoản"
          fields={[{ name: 'reason', label: 'Lý do khóa', type: 'textarea', required: true, hint: 'Lý do hiện cho người bị khóa khi họ đăng nhập.' }]} onClose={() => setDialog(null)}
          onSubmit={async (v) => { await api.lockUser(token, u.id, true, String(v.reason)); setDialog(null); changed(); }} />
      ) : null}
      <ConfirmSheet open={dialog === 'unlock'} title="Mở khóa tài khoản" message={`Cho phép ${u?.full_name} đăng nhập trở lại?`} confirmLabel="Mở khóa" busy={busy} onCancel={() => setDialog(null)}
        onConfirm={async () => { if (u && (await run(() => api.lockUser(token, u.id, false), 'Đã mở khóa'))) { setDialog(null); changed(); } }} />
      <ConfirmSheet open={dialog === 'reset'} title="Đặt lại mật khẩu" message={`Sinh mật khẩu tạm mới cho ${u?.full_name}${u?.email ? ' và gửi vào email của họ' : ''}? Mật khẩu cũ và các phiên đăng nhập hiện tại sẽ mất hiệu lực.`} confirmLabel="Đặt lại" busy={busy} onCancel={() => setDialog(null)}
        onConfirm={async () => { if (!u) return; const res = await run(() => api.resetUserPassword(token, u.id)); if (res) { setDialog(null); setCredential(res); changed(); } }} />
      <ConfirmSheet open={dialog === 'delete'} title="Xóa tài khoản" message={`Xóa hẳn tài khoản ${u?.full_name}? Thao tác này không hoàn tác được. Chỉ xóa được tài khoản chưa phát sinh dữ liệu.`} confirmLabel="Xóa" busy={busy} onCancel={() => setDialog(null)}
        onConfirm={async () => { if (!u) return; const ok = await run(() => api.deleteUser(token, u.id).then(() => true), 'Đã xóa tài khoản'); if (ok) { setDialog(null); onChanged(); onClose(); } }} />
    </>
  );
};

function editFields(u: AccountDetail, schools: Array<{ value: string; label: string }>): FieldDef[] {
  const fields: FieldDef[] = [
    { name: 'full_name', label: 'Họ và tên', required: true },
    { name: 'email', label: 'Email', type: 'email', required: u.role !== 'student', hint: 'Dùng để nhận mật khẩu tạm và mã OTP khi quên mật khẩu.' },
    { name: 'phone', label: 'Số điện thoại', type: 'tel' },
  ];
  if (u.role === 'teacher') fields.push({ name: 'subject', label: 'Bộ môn' }, { name: 'user_code', label: 'Mã giáo viên' });
  if (u.role === 'student') fields.push({ name: 'user_code', label: 'Mã học sinh', required: true }, { name: 'birth_date', label: 'Ngày sinh', type: 'date', required: true }, { name: 'gender', label: 'Giới tính', type: 'select', options: GENDER_OPTIONS }, { name: 'parent_email', label: 'Email phụ huynh', type: 'email' });
  if (schools.length && u.role !== 'root_admin') fields.push({ name: 'school_id', label: 'Trường', type: 'select', options: schools, hint: 'Chỉ chuyển trường được khi tài khoản chưa thuộc lớp nào.' });
  return fields;
}
