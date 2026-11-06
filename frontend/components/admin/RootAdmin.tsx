/**
 * Cổng quản trị tổng: quản lý nghiệp vụ. Cấu hình vận hành chạy nội bộ; bảo mật tài khoản nằm trong Hồ sơ cá nhân.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Bell, Building2, ChartColumn, History, LifeBuoy, LibraryBig, Plus, Trash2, Users } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { AccountSheet, dateText, ROLE_TEXT } from '@/components/admin/AccountSheet';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';
import { SystemStats } from '@/components/admin/AnalyticsAdmin';
import { BroadcastManager } from '@/components/admin/PlatformComms';
import { FaqManager, LogsPanel, SupportInbox } from '@/components/admin/PlatformOps';
import { Cell, CredentialSheet, ErrorNote, FilterBar, FilterBox, FormSheet, Page, PageHeader, Pager, StatusChip, useAction, useDebounced, useLoad, DataTable, type FieldDef } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { SchoolEmblem, SchoolLinkBox } from '@/components/school-brand';
import { AdminUiContext, Btn, ConfirmSheet, Field, Inset, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmt } from '@/lib/format';
import type { AuthRole, CreatedAccount, CreatedSchool, SchoolDirectoryItem, SchoolItem } from '@/types/api';

const NAV = [
  { id: 'schools' as const, label: 'Trường học', icon: Building2 },
  { id: 'users' as const, label: 'Người dùng', icon: Users },
  { id: 'stats' as const, label: 'Thống kê hệ thống', icon: ChartColumn },
  { id: 'notices' as const, label: 'Thông báo', icon: Bell },
  { id: 'logs' as const, label: 'Nhật ký', icon: History },
  { id: 'faq' as const, label: 'Hướng dẫn và FAQ', icon: LibraryBig },
  { id: 'support' as const, label: 'Yêu cầu hỗ trợ', icon: LifeBuoy },
];
type Tab = (typeof NAV)[number]['id'];

export const RootAdmin: React.FC<{ session: Session }> = ({ session }) => {
  const [tab, setTab] = useState<Tab>('schools');
  const { data: schools } = useLoad(() => api.listSchools(session.token, { limit: 200 }), [session.token], session.expired);
  const options = useMemo(() => (schools?.items ?? []).map((s) => ({ value: String(s.id), label: `${s.name} (${s.school_code})` })), [schools]);
  return (
    <AdminUiContext.Provider value>
      <AdminWorkspace session={session} nav={NAV} active={tab} onSelect={setTab} schoolCount={schools?.total}>
        {tab === 'schools' ? <SchoolsPanel session={session} /> : tab === 'users' ? <UsersPanel session={session} schools={options} />
          : tab === 'stats' ? <SystemStats session={session} /> : tab === 'notices' ? <BroadcastManager session={session} />
          : tab === 'logs' ? <LogsPanel session={session} /> : tab === 'faq' ? <FaqManager session={session} />
          : <SupportInbox session={session} />}
      </AdminWorkspace>
    </AdminUiContext.Provider>
  );
};

// ---------------------------------------------------------------------- trường học
const SCHOOL_FIELDS: FieldDef[] = [
  { name: 'name', label: 'Tên trường', required: true },
  { name: 'city', label: 'Tỉnh / thành phố' },
  { name: 'region', label: 'Vùng / khu vực' },
  { name: 'address', label: 'Địa chỉ' },
  { name: 'contact_name', label: 'Người liên hệ' },
  { name: 'contact_email', label: 'Email liên hệ', type: 'email' },
  { name: 'contact_phone', label: 'Điện thoại liên hệ', type: 'tel' },
  { name: 'logo_url', label: 'Logo riêng (liên kết https, không bắt buộc)', hint: 'Để trống thì hệ thống dùng huy hiệu tự tạo từ tên trường.' },
];

// Thêm trường: tên trường là ô chọn từ danh mục; chọn xong mã, tỉnh/thành, khu vực tự điền và huy hiệu tự hiện (không dán ảnh)
const CREATE_FIELDS = (token: string): FieldDef[] => [
  { name: 'name', label: 'Tên trường', required: true, render: (values, set) => <SchoolPicker token={token} values={values} set={set} /> },
  { name: 'school_code', label: 'Mã trường (chữ số)', required: true, hint: 'Tự điền khi chọn trường từ danh mục (mã 8 chữ số của Bộ GD&ĐT). Trường ngoài danh mục: tự nhập mã, tối đa 8 chữ số.' },
  { name: 'city', label: 'Tỉnh / thành phố' },
  { name: 'region', label: 'Vùng / khu vực', hint: 'Quận, huyện hoặc thị xã; nằm trong đường dẫn riêng của trường.' },
  ...SCHOOL_FIELDS.filter((f) => !['name', 'city', 'region', 'logo_url'].includes(f.name)),
  { name: 'admin_name', label: 'Quản trị viên đầu tiên – họ tên', required: true },
  { name: 'admin_email', label: 'Quản trị viên đầu tiên – email', type: 'email', required: true },
  { name: 'admin_phone', label: 'Quản trị viên đầu tiên – điện thoại', type: 'tel' },
];

const SchoolsPanel: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const { token } = session;
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useLoad(() => api.listSchools(token, { q: dq, city, active, page, limit: 30 }), [token, dq, city, active, page], session.expired);
  const { busy, run } = useAction(session.expired);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedSchool | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  const [editing, setEditing] = useState<SchoolItem | null>(null);
  const [toggling, setToggling] = useState<SchoolItem | null>(null);
  const [removing, setRemoving] = useState<SchoolItem | null>(null);

  if (created) return <CredentialSheet title="Trường đã được tạo" account={{ full_name: `${created.admin.full_name} – quản trị viên ${created.school.name}`, username: created.admin.username, temporary_password: created.temporary_password, mail: created.mail }} onClose={() => setCreated(null)}
    extra={<View style={{ gap: 10 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><SchoolEmblem name={created.school.name} code={created.school.school_code} logoUrl={created.school.logo_url} size={48} /><Txt f="bold" size={15} style={{ flex: 1 }}>{created.school.name} · mã {created.school.school_code}</Txt></View><SchoolLinkBox link={created.school.link} /></View>} />;
  const cities = [{ value: '', label: 'Mọi tỉnh / thành' }, ...(data?.facets.cities ?? []).map((x) => ({ value: x, label: x }))];

  return (
    <Page>
      <PageHeader title="Trường học" subtitle="Thêm trường kèm quản trị viên đầu tiên, sửa thông tin, vô hiệu hóa hoặc xóa trường chưa có dữ liệu." actions={<Btn title="Thêm trường" icon={Plus} tone="son" onPress={() => setCreating(true)} testID="school-add" />} />
      <FilterBar>
        <FilterBox flex={2}><Field label="Tìm theo tên hoặc mã trường" value={q} onChangeText={(v) => { setQ(v); setPage(1); }} autoCapitalize="none" /></FilterBox>
        <FilterBox><AdminSelect label="Tỉnh / thành" value={city} options={cities} onChange={(v) => { setCity(String(v)); setPage(1); }} /></FilterBox>
        <FilterBox><AdminSelect label="Trạng thái" value={active} options={[{ value: '', label: 'Tất cả' }, { value: 'true', label: 'Đang hoạt động' }, { value: 'false', label: 'Đã vô hiệu hóa' }]} onChange={(v) => { setActive(String(v)); setPage(1); }} /></FilterBox>
      </FilterBar>
      <ErrorNote message={error} />
      {loading && !data ? <Spinner label="Đang tải danh sách trường…" /> : null}
      {data ? (
        <>
          <DataTable rows={data.items} rowKey={(s) => s.id} empty="Không có trường nào khớp bộ lọc." onRowPress={(s) => setDetail(s.id)}
            columns={[
              { key: 'name', label: 'Trường', flex: 2.2, render: (s) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><SchoolEmblem name={s.name} code={s.school_code} logoUrl={s.logo_url} size={36} /><View style={{ flex: 1 }}><Cell main={s.name} sub={`Mã ${s.school_code}${s.region ? ` · ${s.region}` : ''}`} /></View></View> },
              { key: 'city', label: 'Tỉnh / thành', render: (s) => <Txt size={14}>{s.city || 'Chưa có'}</Txt> },
              { key: 'users', label: 'Người dùng', render: (s) => <Cell main={fmt(s.users)} sub={`${s.teachers} GV · ${s.students} HS · ${s.classes} lớp`} /> },
              { key: 'status', label: 'Trạng thái', render: (s) => <StatusChip kind={s.is_active ? 'on' : 'off'} text={s.is_active ? 'Hoạt động' : 'Vô hiệu hóa'} /> },
              { key: 'created', label: 'Ngày tạo', render: (s) => <Txt size={13} color={c.muc2}>{dateText(s.created_at)}</Txt> },
            ]}
            actions={(s) => (<>
              <Btn title="Sửa" tone="giay" size="sm" onPress={() => setEditing(s)} />
              <Btn title={s.is_active ? 'Vô hiệu' : 'Kích hoạt'} tone="giay" size="sm" onPress={() => setToggling(s)} />
              <Btn icon={Trash2} label={`Xóa ${s.name}`} tone="giay" size="sm" onPress={() => setRemoving(s)} />
            </>)} />
          <Pager page={page} limit={30} total={data.total} onPage={setPage} />
        </>
      ) : null}

      {creating ? (
        <FormSheet title="Thêm trường" subtitle="Chọn trường để tự điền mã, khu vực và logo; hệ thống tạo đường dẫn riêng của trường, cùng tài khoản quản trị viên đầu tiên (mật khẩu tạm gửi qua email)" submitLabel="Tạo trường" wide
          fields={CREATE_FIELDS(token)}
          onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            if (String(v.name).trim().length < 2) throw new Error('Hãy gõ tên trường rồi chọn trong danh sách gợi ý, hoặc tự nhập tên trường.');
            if (!/\d/.test(String(v.school_code))) throw new Error('Mã trường cần có chữ số.');
            const body: Record<string, unknown> = { school_code: v.school_code, admin: { full_name: v.admin_name, email: v.admin_email, phone: v.admin_phone || undefined } };
            for (const f of CREATE_FIELDS(token)) if (!f.name.startsWith('admin_') && f.name !== 'school_code' && String(v[f.name]).trim()) body[f.name] = v[f.name];
            const res = await api.createSchool(token, body);
            setCreating(false);
            setCreated(res);
            reload();
          }} />
      ) : null}
      {editing ? (
        <FormSheet title="Sửa thông tin trường" subtitle={`Mã trường ${editing.school_code} không đổi được`} fields={SCHOOL_FIELDS} wide
          initial={Object.fromEntries(SCHOOL_FIELDS.map((f) => [f.name, String((editing as unknown as Record<string, unknown>)[f.name] ?? '')]))} onClose={() => setEditing(null)}
          onSubmit={async (v) => { await api.updateSchool(token, editing.id, Object.fromEntries(SCHOOL_FIELDS.map((f) => [f.name, String(v[f.name]).trim() || null]))); setEditing(null); reload(); }} />
      ) : null}
      <ConfirmSheet open={!!toggling} title={toggling?.is_active ? 'Vô hiệu hóa trường' : 'Kích hoạt lại trường'} busy={busy} confirmLabel={toggling?.is_active ? 'Vô hiệu hóa' : 'Kích hoạt'} onCancel={() => setToggling(null)}
        message={toggling?.is_active ? `Toàn bộ tài khoản của ${toggling?.name} sẽ không đăng nhập được và mọi phiên hiện tại bị thu hồi. Dữ liệu được giữ nguyên.` : `Cho phép tài khoản của ${toggling?.name} đăng nhập trở lại?`}
        onConfirm={async () => { if (toggling && (await run(() => api.updateSchool(token, toggling.id, { is_active: !toggling.is_active }), 'Đã cập nhật trạng thái trường'))) { setToggling(null); reload(); } }} />
      <ConfirmSheet open={!!removing} title="Xóa trường" busy={busy} confirmLabel="Xóa trường" onCancel={() => setRemoving(null)}
        message={`Xóa hẳn ${removing?.name}? Chỉ xóa được trường chưa phát sinh dữ liệu (không lớp, giáo viên, học sinh; quản trị viên chưa dùng hệ thống). Trường đã có dữ liệu chỉ vô hiệu hóa được.`}
        onConfirm={async () => { if (removing) { await run(() => api.deleteSchool(token, removing.id).then(() => true), 'Đã xóa trường').then((ok) => { if (ok) { setRemoving(null); reload(); } else setRemoving(null); }); } }} />
      {detail ? <SchoolDetailSheet session={session} id={detail} onClose={() => setDetail(null)} /> : null}
    </Page>
  );
};

/** Ô tên trường kèm gợi ý từ danh mục: bấm một trường thì tên, mã, tỉnh/thành, khu vực tự điền, huy hiệu hiện ngay và đường dẫn riêng được báo trước */
const SchoolPicker: React.FC<{ token: string; values: Record<string, string | string[]>; set: (name: string, value: string | string[]) => void }> = ({ token, values, set }) => {
  const { c } = useTheme();
  const name = String(values.name ?? '');
  const query = useDebounced(name.trim(), 250);
  const [picked, setPicked] = useState<SchoolDirectoryItem | null>(null);
  const [results, setResults] = useState<SchoolDirectoryItem[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const justPicked = picked !== null && name === picked.name;

  useEffect(() => {
    if (justPicked || query.length < 2) { setResults([]); setState('idle'); return undefined; }
    let live = true;
    setState('loading');
    api.searchSchoolDirectory(token, query).then((res) => { if (live) { setResults(res.items); setState('idle'); } }).catch(() => { if (live) { setResults([]); setState('failed'); } });
    return () => { live = false; };
  }, [token, query, justPicked]);

  const choose = (item: SchoolDirectoryItem) => {
    setPicked(item);
    setResults([]);
    set('name', item.name);
    set('school_code', item.code);
    set('region', item.region);
    set('city', item.city);
  };
  const code = String(values.school_code ?? '');

  return (
    <View style={{ gap: 8 }}>
      <Field label="Tên trường *" hint="Gõ tên trường (có dấu hoặc không dấu) rồi bấm một trường trong danh sách để tự điền mã, khu vực và logo." value={name} nativeID="field-name"
        onChangeText={(v) => set('name', v)} autoCapitalize="words" />
      {state === 'loading' ? <Txt size={13} color={c.muc3}>Đang tìm trong danh mục…</Txt> : null}
      {state === 'failed' ? <Txt size={13} color={c.sonChu}>Chưa tìm được trong danh mục. Bạn vẫn có thể tự nhập tên và mã trường.</Txt> : null}
      {results.length ? (
        <View style={{ borderWidth: 1, borderColor: c.adminLine, borderRadius: 8, backgroundColor: c.the, overflow: 'hidden' }} accessibilityRole="list">
          {results.map((r) => (
            <Pressable key={r.code} accessibilityRole="button" accessibilityLabel={`Chọn ${r.name}, ${r.region}`} disabled={r.exists} onPress={() => choose(r)} testID={`school-pick-${r.code}`}
              style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: r.exists ? 0.55 : 1, backgroundColor: pressed ? c.adminCanvas : c.the })}>
              <SchoolEmblem name={r.name} code={r.code} size={32} />
              <View style={{ flex: 1 }}>
                <Txt f="semibold" size={14}>{r.name}</Txt>
                <Txt size={12} color={c.muc2}>Mã {r.code} · {r.region} · {r.city}</Txt>
                {r.note ? <Txt size={12} color={c.vangChu}>{r.note}</Txt> : null}
              </View>
              {r.exists ? <StatusChip kind="muted" text="Đã có trong hệ thống" /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      {state === 'idle' && query.length >= 2 && !results.length && !justPicked ? <Txt size={13} color={c.muc3}>Không thấy trường này trong danh mục. Hãy tự nhập mã và khu vực ở các ô bên dưới.</Txt> : null}
      {name.trim().length >= 2 && (justPicked || (state === 'idle' && !results.length && query === name.trim())) ? (
        <Inset style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <SchoolEmblem name={name} code={code} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt f="semibold" size={14}>Logo tự tạo từ tên trường, không cần dán ảnh</Txt>
            <Txt size={12} color={c.muc2} selectable>{justPicked ? `Đường dẫn của trường: /${picked.slug}` : 'Đường dẫn riêng của trường được tạo khi bấm Tạo trường.'}</Txt>
          </View>
        </Inset>
      ) : null}
    </View>
  );
};

const SchoolDetailSheet: React.FC<{ session: Session; id: number; onClose: () => void }> = ({ session, id, onClose }) => {
  const { c } = useTheme();
  const { data, error } = useLoad(() => api.getSchool(session.token, id), [id], session.expired);
  return (
    <Sheet open onClose={onClose} title={data?.name ?? 'Trường học'} subtitle={data ? `Mã ${data.school_code}${data.city ? ` · ${data.city}` : ''}` : undefined} wide>
      <ErrorNote message={error} />
      {!data && !error ? <Spinner label="Đang tải…" /> : null}
      {data ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <SchoolEmblem name={data.name} code={data.school_code} logoUrl={data.logo_url} size={56} />
            <Txt size={13} color={c.muc2} style={{ flex: 1 }}>{[data.region, data.city].filter(Boolean).join(' · ') || 'Chưa ghi khu vực'}</Txt>
          </View>
          <SchoolLinkBox link={data.link} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StatusChip kind={data.is_active ? 'on' : 'off'} text={data.is_active ? 'Đang hoạt động' : 'Đã vô hiệu hóa'} />
            <StatusChip kind="info" text={`${data.counts.teachers} giáo viên`} />
            <StatusChip kind="info" text={`${data.counts.students} học sinh`} />
            <StatusChip kind="info" text={`${data.counts.classes} lớp`} />
            <StatusChip kind={data.current_year ? 'on' : 'warn'} text={data.current_year ? `Năm học ${data.current_year.label}` : 'Chưa kích hoạt năm học'} />
          </View>
          {[['Địa chỉ', data.address], ['Người liên hệ', data.contact_name], ['Email liên hệ', data.contact_email], ['Điện thoại', data.contact_phone]].map(([k, v]) => (
            <View key={k as string}><Txt f="bold" size={12} color={c.muc3}>{k}</Txt><Txt size={14}>{(v as string | null) || 'Chưa có'}</Txt></View>
          ))}
          <Txt f="bold" size={14}>Quản trị viên trường học</Txt>
          {data.admins.length ? data.admins.map((a) => (
            <Inset key={a.id} style={{ gap: 2 }}><Txt f="semibold" size={14}>{a.full_name}{a.is_active ? '' : ' (đã khóa)'}</Txt><Txt size={13} color={c.muc2}>{a.username} · {a.email || 'chưa có email'} · đăng nhập lần cuối: {dateText(a.last_login_at)}</Txt></Inset>
          )) : <Txt size={14} color={c.muc3}>Chưa có quản trị viên.</Txt>}
        </>
      ) : null}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- người dùng
const UsersPanel: React.FC<{ session: Session; schools: Array<{ value: string; label: string }> }> = ({ session, schools }) => {
  const { c } = useTheme();
  const { token } = session;
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useLoad(() => api.listUsers(token, { q: dq, role: (role || undefined) as AuthRole | undefined, school_id: schoolId ? Number(schoolId) : undefined, active: (active || undefined) as 'true' | 'false' | undefined, page, limit: 30 }),
    [token, dq, role, schoolId, active, page], session.expired);
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [credential, setCredential] = useState<CreatedAccount | null>(null);
  const top = session.user.admin_level === 1;
  const refresh = useCallback(() => reload(), [reload]);

  if (credential) return <CredentialSheet title="Tài khoản quản trị đã được tạo" account={{ full_name: credential.user.full_name, username: credential.user.username, temporary_password: credential.temporary_password, mail: credential.mail }} onClose={() => setCredential(null)} />;
  return (
    <Page>
      <PageHeader title="Người dùng toàn hệ thống" subtitle="Xem, tìm, lọc; sửa, đổi vai trò, khóa/mở khóa, đặt lại mật khẩu hoặc xóa tài khoản chưa phát sinh dữ liệu." actions={<Btn title="Tạo tài khoản quản trị" icon={Plus} tone="son" onPress={() => setCreating(true)} testID="user-add" />} />
      <FilterBar>
        <FilterBox flex={2}><Field label="Tìm theo tên, tên đăng nhập, email, mã" value={q} onChangeText={(v) => { setQ(v); setPage(1); }} autoCapitalize="none" /></FilterBox>
        <FilterBox><AdminSelect label="Vai trò" value={role} options={[{ value: '', label: 'Mọi vai trò' }, ...(Object.keys(ROLE_TEXT) as AuthRole[]).map((r) => ({ value: r, label: ROLE_TEXT[r] }))]} onChange={(v) => { setRole(String(v)); setPage(1); }} /></FilterBox>
        <FilterBox><AdminSelect label="Trường" value={schoolId} options={[{ value: '', label: 'Mọi trường' }, ...schools]} onChange={(v) => { setSchoolId(String(v)); setPage(1); }} /></FilterBox>
        <FilterBox><AdminSelect label="Trạng thái" value={active} options={[{ value: '', label: 'Tất cả' }, { value: 'true', label: 'Đang hoạt động' }, { value: 'false', label: 'Đã khóa' }]} onChange={(v) => { setActive(String(v)); setPage(1); }} /></FilterBox>
      </FilterBar>
      <ErrorNote message={error} />
      {loading && !data ? <Spinner label="Đang tải danh sách…" /> : null}
      {data ? (
        <>
          <DataTable rows={data.items} rowKey={(u) => u.id} empty="Không có người dùng nào khớp bộ lọc." onRowPress={(u) => setOpen(u.id)}
            columns={[
              { key: 'name', label: 'Họ tên', flex: 2, render: (u) => <Cell main={u.full_name} sub={u.username} /> },
              { key: 'role', label: 'Vai trò', render: (u) => <Cell main={ROLE_TEXT[u.role]} sub={u.role === 'root_admin' ? `Cấp ${u.admin_level}` : null} /> },
              { key: 'school', label: 'Trường', flex: 1.5, render: (u) => <Txt size={14}>{u.school_name || '—'}</Txt> },
              { key: 'email', label: 'Email', flex: 1.6, render: (u) => <Txt size={13} color={c.muc2} numberOfLines={2}>{u.email || 'Chưa có'}</Txt> },
              { key: 'last', label: 'Đăng nhập cuối', render: (u) => <Txt size={13} color={c.muc2}>{dateText(u.last_login_at)}</Txt> },
              { key: 'status', label: 'Trạng thái', render: (u) => <StatusChip kind={u.is_active ? 'on' : 'off'} text={u.is_active ? 'Hoạt động' : 'Đã khóa'} /> },
            ]} />
          <Pager page={page} limit={30} total={data.total} onPage={setPage} />
        </>
      ) : null}
      {open ? <AccountSheet session={session} id={open} schools={schools} onClose={() => setOpen(null)} onChanged={refresh} /> : null}
      {creating ? (
        <FormSheet title="Tạo tài khoản quản trị" subtitle="Mật khẩu tạm được gửi vào email; người dùng phải đổi ở lần đăng nhập đầu tiên" submitLabel="Tạo tài khoản"
          fields={[
            { name: 'full_name', label: 'Họ và tên', required: true },
            { name: 'role', label: 'Loại tài khoản', type: 'select', required: true, options: [...(top ? [{ value: 'root_admin', label: 'Quản trị viên tổng' }] : []), { value: 'school_admin', label: 'Quản trị viên trường học' }] },
            { name: 'admin_level', label: 'Cấp quản trị tổng', type: 'select', options: [{ value: '2', label: 'Cấp 2 (không quản lý quản trị tổng, không tạo/xóa trường)' }, { value: '1', label: 'Cấp 1 (toàn quyền)' }], when: (v) => v.role === 'root_admin' },
            { name: 'school_id', label: 'Trường', type: 'select', required: true, options: schools, when: (v) => v.role === 'school_admin' },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'phone', label: 'Số điện thoại', type: 'tel' },
          ]}
          initial={{ role: top ? 'root_admin' : 'school_admin', admin_level: '2' }} onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            const res = await api.createAdminAccount(token, { full_name: String(v.full_name), role: v.role as 'root_admin' | 'school_admin', email: String(v.email), phone: String(v.phone) || undefined, school_id: v.role === 'school_admin' ? Number(v.school_id) : undefined, admin_level: v.role === 'root_admin' ? (Number(v.admin_level) === 1 ? 1 : 2) : undefined });
            setCreating(false);
            setCredential(res);
            reload();
          }} />
      ) : null}
    </Page>
  );
};
