/**
 * Mật khẩu tài khoản (yêu cầu 13/11/2026) cho quản trị trường (trường mình) và quản trị tổng (mọi trường, không gồm quản trị tổng).
 * Hiện mật khẩu ban đầu / mật khẩu do quản trị cấp lại khi người dùng chưa đổi. Từ 18/11/2026 (người dùng chọn "Lưu để quản trị xem được", migration 074)
 * quản trị tổng xem được cả mật khẩu người dùng tự đổi (bản mã hóa); mật khẩu đổi trước ngày đó chỉ có dạng băm nên không xem được. Quản trị trường không xem
 * được mật khẩu tự đổi. "Cấp lại" luôn đặt lại theo quy ước (DongA…), gửi email, buộc đổi ở lần đăng nhập sau. Cột Trạng thái là nút gạt khóa / mở tài khoản.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Eye, EyeOff, KeyRound } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { AccountActiveSwitch, useAccountLock } from '@/components/admin/AccountSheet';
import { CredentialSheet, DataTable, distinctValues, ErrorNote, NameCell, Page, PageHeader, Pager, SearchFilterBar, useAction, useDebounced, useLoad, usePageSize, type SearchFilter } from '@/components/admin/kit';
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
  const [columnValues, setColumnValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [shown, setShown] = useState(false);
  const [confirm, setConfirm] = useState<PasswordRow | null>(null);
  const [issued, setIssued] = useState<CreatedAccount | null>(null);
  const size = usePageSize();
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useLoad(() => api.passwordList(token, { q: dq, role: (role || undefined) as PasswordRow['role'] | undefined, school_id: schoolId ? Number(schoolId) : undefined, ...columnValues, active: columnValues.active as 'true' | 'false' | undefined, password_state: columnValues.password_state as 'initial' | 'changed' | 'unknown' | undefined, stt: Number(columnValues.stt) > 0 ? Number(columnValues.stt) : undefined, page, limit: size }),
    [token, dq, role, schoolId, columnValues, page, size], session.expired);
  const { busy, run } = useAction(session.expired);
  const lock = useAccountLock(session, reload);

  if (issued) return <CredentialSheet title="Đã cấp lại mật khẩu" account={{ full_name: issued.user.full_name, username: issued.display_username ?? issued.user.username, temporary_password: issued.temporary_password, mail: issued.mail }} onClose={() => { setIssued(null); reload(); }} />;

  const f_role: SearchFilter = { key: 'role', label: 'Vai trò', value: role, options: [{ value: '', label: 'Mọi vai trò' }, ...(['school_admin', 'teacher', 'student'] as const).map((r) => ({ value: r, label: ROLE_LABEL[r] }))], onChange: (v) => { setRole(v); setPage(1); } };
  const f_school: SearchFilter = { key: 'school', label: 'Trường', value: schoolId, options: [{ value: '', label: 'Mọi trường' }, ...(schools ?? [])], onChange: (v) => { setSchoolId(v); setPage(1); } };
  const textFilter = (key: string, label: string, suggest?: SearchFilter['suggest']): SearchFilter => ({ key, label, suggest, value: columnValues[key] ?? '', options: [{ value: '', label: 'Tất cả' }], custom: true, onChange: (v) => { setColumnValues((old) => ({ ...old, [key]: key === 'stt' ? v.replace(/\D/g, '') : v })); setPage(1); } });
  // lọc STT (18/11/2026): gõ số thứ tự để hiện đúng dòng đó (theo các bộ lọc khác)
  // danh sách giá trị của từng cột để chọn khi lọc (theo các bộ lọc khác đang bật)
  const base = { q: dq, role: (role || undefined) as PasswordRow['role'] | undefined, school_id: schoolId ? Number(schoolId) : undefined, ...columnValues, active: columnValues.active as 'true' | 'false' | undefined, password_state: columnValues.password_state as 'initial' | 'changed' | 'unknown' | undefined, stt: undefined, page: 1, limit: 200 };
  const values = (key: string, pick: (u: PasswordRow) => string | null) => (term: string) => api.passwordList(token, { ...base, [key]: term || undefined }).then((r) => distinctValues(r.items, pick));
  const f_stt = textFilter('stt', 'STT', async (term) => Array.from({ length: Math.min(data?.total ?? 0, 500) }, (_, i) => String(i + 1)).filter((n) => !term || n.startsWith(term.replace(/\D/g, ''))).map((n) => ({ value: n, label: n })));
  const f_name = textFilter('name', 'Họ và tên hoặc mã', values('name', (u) => u.full_name));
  const f_username = textFilter('username', 'Tên đăng nhập', values('username', (u) => u.username));
  const f_password: SearchFilter = { key: 'password_state', label: 'Mật khẩu', value: columnValues.password_state ?? '', options: [{ value: '', label: 'Tất cả' }, { value: 'initial', label: 'Chưa đổi' }, { value: 'changed', label: 'Đã đổi' }, { value: 'unknown', label: 'Chưa có bản xem được' }], onChange: (v) => { setColumnValues((old) => ({ ...old, password_state: v })); setPage(1); } };
  const f_active: SearchFilter = { key: 'active', label: 'Trạng thái tài khoản', value: columnValues.active ?? '', options: [{ value: '', label: 'Tất cả' }, { value: 'true', label: 'Hoạt động' }, { value: 'false', label: 'Đã khóa' }], onChange: (v) => { setColumnValues((old) => ({ ...old, active: v })); setPage(1); } };
  return (
    <Page>
      <PageHeader title="Mật khẩu tài khoản" subtitle={root ? 'Mật khẩu ban đầu của tài khoản các trường khi người dùng chưa tự đổi; cấp lại mật khẩu theo quy ước và gửi email.' : 'Mật khẩu ban đầu của giáo viên, học sinh trong trường khi người dùng chưa tự đổi; cấp lại mật khẩu theo quy ước và gửi email.'}
        actions={<Btn title={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} icon={shown ? EyeOff : Eye} tone="giay" size="sm" onPress={() => setShown((x) => !x)} testID="password-toggle" />} />
      <Inset><Txt size={13} color={c.muc2}>{root
        ? 'Bấm “Hiện mật khẩu” để xem mật khẩu hiện tại, kể cả mật khẩu người dùng tự đổi từ 18/11/2026. Mật khẩu đổi trước ngày đó chỉ lưu dạng băm nên không xem được: bấm “Cấp lại” để đặt lại theo quy ước (gửi vào email).'
        : 'Mật khẩu người dùng tự đổi chỉ quản trị tổng xem được. Người dùng quên mật khẩu thì bấm “Cấp lại” để đặt lại theo quy ước (gửi vào email), người dùng phải đổi ở lần đăng nhập sau.'}</Txt></Inset>
      <SearchFilterBar placeholder="Tìm theo tên, tên đăng nhập, mã" value={q} onChange={(v) => { setQ(v); setPage(1); }} searchId="password-search" filters={root ? [f_stt, f_name, f_username, f_role, f_school, f_password, f_active] : [f_stt, f_name, f_username, f_role, f_password, f_active]} />
      <ErrorNote message={error} />
      {loading && !data ? <Spinner label="Đang tải danh sách…" /> : null}
      {data ? (
        <>
          <DataTable paginate={false} gap={10} rows={data.items} rowKey={(u) => u.id} empty="Không có tài khoản nào khớp bộ lọc."
            columns={[
              { key: 'stt', filter: f_stt, label: 'STT', width: 64, minWidth: 64, render: (u) => <Txt size={14} color={c.muc2}>{(data.offset ?? (page - 1) * size) + data.items.indexOf(u) + 1}</Txt> },
              { key: 'name', filter: f_name, label: 'Họ và tên', width: 190, minWidth: 160, grow: 2, render: (u: PasswordRow) => <NameCell main={u.full_name} sub={u.user_code ?? undefined} /> },
              // 18/11/2026: vai trò (và trường, ở quản trị tổng) thành cột riêng có lọc ở tiêu đề như các cột khác
              { key: 'role', filter: f_role, label: 'Vai trò', width: 120, minWidth: 104, render: (u) => <Txt size={13} numberOfLines={2}>{ROLE_LABEL[u.role]}</Txt> },
              ...(root ? [{ key: 'school', filter: f_school, label: 'Trường', width: 150, minWidth: 120, grow: 1, render: (u: PasswordRow) => <Txt size={13} numberOfLines={2}>{u.school_name ?? '—'}</Txt> }] : []),
              { key: 'username', filter: f_username, label: 'Tên đăng nhập', width: 150, grow: 1, render: (u) => <Txt size={13} selectable numberOfLines={1}>{u.username}</Txt> },
              { key: 'password', filter: f_password, label: 'Mật khẩu', width: 180, grow: 1, render: (u) => (
                <View style={{ gap: 2 }}>
                  {u.password
                    ? <Txt f="bold" size={13} selectable numberOfLines={1} testID={`password-${u.id}`}>{shown ? u.password : '••••••••••'}</Txt>
                    : <Txt size={13} color={c.muc3} numberOfLines={2}>{u.status === 'changed' ? (root ? 'Không xem được (đổi trước 18/11/2026)' : 'Đã tự đổi, chỉ quản trị tổng xem được') : 'Chưa có bản xem được – bấm Cấp lại'}</Txt>}
                  <Txt size={12} color={u.status === 'changed' ? c.mocChu : c.vangChu}>{u.status === 'changed' ? 'Đã đổi mật khẩu' : 'Chưa đổi mật khẩu'}</Txt>
                </View>
              ) },
              { key: 'status', filter: f_active, label: 'Trạng thái', width: 140, minWidth: 130, render: (u) => <AccountActiveSwitch session={session} account={u} onRequest={lock.request} /> },
              { key: 'action', label: '', width: 96, minWidth: 96, render: (u) => <Btn title="Cấp lại" icon={KeyRound} tone="giay" size="sm" onPress={() => setConfirm(u)} testID={`password-reissue-${u.id}`} /> },
            ]} />
          <Pager page={page} limit={size} total={data.total} onPage={setPage} />
        </>
      ) : null}
      {lock.dialogs}
      <View>
        <ConfirmSheet open={!!confirm} title="Cấp lại mật khẩu theo quy ước" busy={busy} confirmLabel="Cấp lại và gửi email" onCancel={() => setConfirm(null)}
          message={`Đặt lại mật khẩu của ${confirm?.full_name} theo quy ước (DongA…), gửi vào email và buộc đổi ở lần đăng nhập sau? Mọi phiên đăng nhập hiện tại của tài khoản bị thoát.`}
          onConfirm={async () => { if (!confirm) return; const res = await run(() => api.reissuePassword(token, confirm.id), 'Đã cấp lại mật khẩu'); if (res) { setConfirm(null); setIssued(res); } }} />
      </View>
    </Page>
  );
};
