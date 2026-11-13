/**
 * Mật khẩu tài khoản (yêu cầu 13/11/2026) cho quản trị trường (trường mình) và quản trị tổng (mọi trường, không gồm quản trị tổng).
 * Mật khẩu hiện tại không ai xem được (chỉ lưu dạng băm một chiều). Trang chỉ hiện mật khẩu ban đầu hoặc mật khẩu do quản trị cấp lại khi người dùng
 * CHƯA tự đổi (máy chủ lưu bản mã hóa, tự xóa khi người dùng đổi). "Cấp lại" đặt lại mật khẩu theo quy ước (DongA…), gửi email, buộc đổi ở lần đăng nhập sau.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Eye, EyeOff, KeyRound } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { Cell, CredentialSheet, DataTable, ErrorNote, Page, PageHeader, Pager, SearchFilterBar, StatusDot, useAction, useDebounced, useLoad, usePageSize, type SearchFilter } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Btn, ConfirmSheet, Inset, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { CreatedAccount, PasswordRow } from '@/types/api';

const ROLE_LABEL: Record<PasswordRow['role'], string> = { school_admin: 'Quản trị trường', teacher: 'Giáo viên', student: 'Học sinh' };

export const PasswordList: React.FC<{ session: Session; schools?: Array<{ value: string; label: string }> }> = ({ session, schools }) => {
  const { c } = useTheme();
  const { token } = session;
  const root = session.user.role === 'root_admin';
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [page, setPage] = useState(1);
  const [shown, setShown] = useState(false);
  const [confirm, setConfirm] = useState<PasswordRow | null>(null);
  const [issued, setIssued] = useState<CreatedAccount | null>(null);
  const size = usePageSize();
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useLoad(() => api.passwordList(token, { q: dq, role: (role || undefined) as PasswordRow['role'] | undefined, school_id: schoolId ? Number(schoolId) : undefined, page, limit: size }),
    [token, dq, role, schoolId, page, size], session.expired);
  const { busy, run } = useAction(session.expired);

  if (issued) return <CredentialSheet title="Đã cấp lại mật khẩu" account={{ full_name: issued.user.full_name, username: issued.display_username ?? issued.user.username, temporary_password: issued.temporary_password, mail: issued.mail }} onClose={() => { setIssued(null); reload(); }} />;

  const f_role: SearchFilter = { key: 'role', label: 'Vai trò', value: role, options: [{ value: '', label: 'Mọi vai trò' }, ...(['school_admin', 'teacher', 'student'] as const).map((r) => ({ value: r, label: ROLE_LABEL[r] }))], onChange: (v) => { setRole(v); setPage(1); } };
  const f_school: SearchFilter = { key: 'school', label: 'Trường', value: schoolId, options: [{ value: '', label: 'Mọi trường' }, ...(schools ?? [])], onChange: (v) => { setSchoolId(v); setPage(1); } };
  return (
    <Page>
      <PageHeader title="Mật khẩu tài khoản" subtitle={root ? 'Mật khẩu ban đầu của tài khoản các trường khi người dùng chưa tự đổi; cấp lại mật khẩu theo quy ước và gửi email.' : 'Mật khẩu ban đầu của giáo viên, học sinh trong trường khi người dùng chưa tự đổi; cấp lại mật khẩu theo quy ước và gửi email.'}
        actions={<Btn title={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} icon={shown ? EyeOff : Eye} tone="giay" size="sm" onPress={() => setShown((x) => !x)} testID="password-toggle" />} />
      <Inset><Txt size={13} color={c.muc2}>Mật khẩu người dùng tự đặt không ai xem được, kể cả quản trị: hệ thống chỉ lưu dạng băm một chiều. Người dùng quên mật khẩu thì bấm “Cấp lại” để đặt lại theo quy ước (gửi vào email), người dùng phải đổi ở lần đăng nhập sau.</Txt></Inset>
      <SearchFilterBar placeholder="Tìm theo tên, tên đăng nhập, mã" value={q} onChange={(v) => { setQ(v); setPage(1); }} searchId="password-search" filters={root ? [f_role, f_school] : [f_role]} />
      <ErrorNote message={error} />
      {loading && !data ? <Spinner label="Đang tải danh sách…" /> : null}
      {data ? (
        <>
          <DataTable paginate={false} gap={10} rows={data.items} rowKey={(u) => u.id} empty="Không có tài khoản nào khớp bộ lọc."
            columns={[
              { key: 'stt', label: 'STT', width: 44, minWidth: 44, render: (u) => <Txt size={14} color={c.muc2}>{(page - 1) * size + data.items.indexOf(u) + 1}</Txt> },
              { key: 'name', label: 'Họ và tên', width: 150, grow: 2, render: (u: PasswordRow) => <Cell main={u.full_name} sub={[ROLE_LABEL[u.role], root ? u.school_name : null, u.user_code].filter(Boolean).join(' · ')} /> },
              { key: 'username', label: 'Tên đăng nhập', width: 150, grow: 1, render: (u) => <Txt size={13} selectable numberOfLines={1}>{u.username}</Txt> },
              { key: 'password', label: 'Mật khẩu', width: 170, grow: 1, render: (u) => u.status === 'initial'
                ? <Txt f="bold" size={13} selectable numberOfLines={1} testID={`password-${u.id}`}>{shown ? u.password : '••••••••••'}</Txt>
                : <Txt size={13} color={c.muc3} numberOfLines={2}>{u.status === 'changed' ? 'Đã tự đổi, không xem được' : 'Chưa có bản xem được – bấm Cấp lại'}</Txt> },
              { key: 'status', label: 'Trạng thái', width: 130, minWidth: 120, render: (u) => <StatusDot kind={!u.is_active ? 'off' : u.status === 'changed' ? 'on' : 'warn'} text={!u.is_active ? 'Đã khóa' : u.status === 'changed' ? 'Đã đổi mật khẩu' : 'Chưa đổi mật khẩu'} /> },
              { key: 'action', label: '', width: 96, minWidth: 96, render: (u) => <Btn title="Cấp lại" icon={KeyRound} tone="giay" size="sm" onPress={() => setConfirm(u)} testID={`password-reissue-${u.id}`} /> },
            ]} />
          <Pager page={page} limit={size} total={data.total} onPage={setPage} />
        </>
      ) : null}
      <View>
        <ConfirmSheet open={!!confirm} title="Cấp lại mật khẩu theo quy ước" busy={busy} confirmLabel="Cấp lại và gửi email" onCancel={() => setConfirm(null)}
          message={`Đặt lại mật khẩu của ${confirm?.full_name} theo quy ước (DongA…), gửi vào email và buộc đổi ở lần đăng nhập sau? Mọi phiên đăng nhập hiện tại của tài khoản bị thoát.`}
          onConfirm={async () => { if (!confirm) return; const res = await run(() => api.reissuePassword(token, confirm.id), 'Đã cấp lại mật khẩu'); if (res) { setConfirm(null); setIssued(res); } }} />
      </View>
    </Page>
  );
};
