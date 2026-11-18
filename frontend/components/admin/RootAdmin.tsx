/**
 * Cổng quản trị tổng: quản lý nghiệp vụ. Cấu hình vận hành chạy nội bộ; bảo mật tài khoản nằm trong Hồ sơ cá nhân.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Bell, Building2, ChartColumn, FolderCog, History, KeyRound, LifeBuoy, LibraryBig, Plus, Trash2, Users } from 'lucide-react-native';
import * as api from '@/api/adminApi';
import { AccountSheet, dateText, ROLE_TEXT } from '@/components/admin/AccountSheet';
import { CreateSchoolAdminSheet } from '@/components/admin/CreateSchoolAdminSheet';
import { AdminWorkspace, navLeaves } from '@/components/admin/AdminWorkspace';
import { SystemStats } from '@/components/admin/AnalyticsAdmin';
import { PasswordList } from '@/components/admin/PasswordList';
import { BroadcastManager } from '@/components/admin/PlatformComms';
import { FaqManager, LogsPanel, SupportInbox } from '@/components/admin/PlatformOps';
import { Cell, CredentialSheet, ErrorNote, FormSheet, NameCell, Page, PageHeader, Pager, SearchFilterBar, StatusChip, useAction, useDebounced, useLoad, usePageSize, DataTable, type FieldDef, type SearchFilter } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { SchoolEmblem, SchoolLinkBox } from '@/components/school-brand';
import { schoolLogoUrl } from '@/lib/school-logos';
import { AdminUiContext, Btn, ConfirmSheet, Field, Inset, Sheet, Spinner, Switch, Txt } from '@/components/ui';
import { placeFields, SchoolLogoField } from '@/components/admin/SchoolPlace';
import { addressText, composeAddress, isNewUnit, isOldDistrict, placeText, streetPart } from '@/lib/admin-units';
import { useTheme } from '@/hooks/use-theme';
import { usePortalTab } from '@/hooks/use-portal-tab';
import { fmt } from '@/lib/format';
import type { AuthRole, CreatedAccount, CreatedSchool, SchoolDirectoryItem, SchoolDuplicate, SchoolItem } from '@/types/api';

const NAV = [
  { id: 'stats' as const, label: 'Thống kê hệ thống', icon: ChartColumn },
  // nhóm "Quản lý" giống cổng quản trị trường (yêu cầu 14/11/2026)
  { group: 'manage', label: 'Quản lý', icon: FolderCog, items: [
    { id: 'schools' as const, label: 'Trường học', icon: Building2 },
    { id: 'users' as const, label: 'Người dùng', icon: Users },
    { id: 'passwords' as const, label: 'Mật khẩu tài khoản', icon: KeyRound },
  ] },
  { id: 'notices' as const, label: 'Thông báo', icon: Bell },
  { id: 'logs' as const, label: 'Nhật ký', icon: History },
  { id: 'faq' as const, label: 'Hướng dẫn và FAQ', icon: LibraryBig },
  { id: 'support' as const, label: 'Yêu cầu hỗ trợ', icon: LifeBuoy },
];
type Tab = Extract<(typeof NAV)[number], { id: string }>['id'] | Extract<(typeof NAV)[number], { items: unknown }>['items'][number]['id'];

export const RootAdmin: React.FC<{ session: Session }> = ({ session }) => {
  const [tab, setTab] = usePortalTab<Tab>('stats', navLeaves<Tab>(NAV).map(item => item.id));
  const { data: schools } = useLoad(() => api.listSchools(session.token, { limit: 200 }), [session.token], session.expired);
  const options = useMemo(() => (schools?.items ?? []).map((s) => ({ value: String(s.id), label: `${s.name} (${s.school_code})` })), [schools]);
  return (
    <AdminUiContext.Provider value>
      <AdminWorkspace session={session} nav={NAV} active={tab} onSelect={setTab}>
        {tab === 'schools' ? <SchoolsPanel session={session} schools={options} /> : tab === 'users' ? <UsersPanel session={session} schools={options} />
          : tab === 'passwords' ? <PasswordList session={session} schools={options} />
          : tab === 'stats' ? <SystemStats session={session} /> : tab === 'notices' ? <BroadcastManager session={session} />
          : tab === 'logs' ? <LogsPanel session={session} /> : tab === 'faq' ? <FaqManager session={session} />
          : <SupportInbox session={session} />}
      </AdminWorkspace>
    </AdminUiContext.Provider>
  );
};

// ---------------------------------------------------------------------- trường học
// Khu vực theo mô hình hai cấp từ 01/07/2025 (18/11/2026): placeFields ghi tỉnh / thành, phường / xã, số nhà – đường và địa chỉ tự ghép
const PLACE_KEYS = ['name', 'city', 'region', 'address'] as const;

// Thêm trường: mã trường do máy chủ tự cấp khi tạo (không hiện ở biểu mẫu); quản trị viên trường thêm sau khi tạo trường (yêu cầu 18/11/2026).
const CREATE_FIELDS = (token: string): FieldDef[] => [
  { name: 'name', label: 'Tên trường', required: true, render: (values, set) => <SchoolPicker token={token} values={values} set={set} /> },
  ...placeFields(token),
];

const SchoolsPanel: React.FC<{ session: Session; schools: Array<{ value: string; label: string }> }> = ({ session, schools }) => {
  const { c } = useTheme();
  const { token } = session;
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [active, setActive] = useState('');
  const [columnValues, setColumnValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const size = usePageSize();
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useLoad(() => api.listSchools(token, { q: dq, city, active, ...columnValues, users: columnValues.users && /^\d+$/.test(columnValues.users) ? Number(columnValues.users) : undefined, page, limit: size }), [token, dq, city, active, columnValues, page, size], session.expired);
  const { busy, run } = useAction(session.expired);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedSchool | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  const [editing, setEditing] = useState<SchoolItem | null>(null);
  const [toggling, setToggling] = useState<SchoolItem | null>(null);
  const [removing, setRemoving] = useState<SchoolItem | null>(null);
  // sau khi thêm trường: thêm quản trị viên trường ngay (chọn sẵn trường vừa tạo), xem tài khoản đã cấp hoặc mở tài khoản đã có
  const [addingAdmin, setAddingAdmin] = useState<number | null>(null);
  const [credential, setCredential] = useState<CreatedAccount | null>(null);
  const [account, setAccount] = useState<number | null>(null);

  if (credential) return <CredentialSheet title="Tài khoản quản trị đã được tạo" account={{ full_name: credential.user.full_name, username: credential.user.username.toUpperCase(), temporary_password: credential.temporary_password, mail: credential.mail }} onClose={() => setCredential(null)} />;
  if (addingAdmin) return <CreateSchoolAdminSheet session={session} initialSchoolId={addingAdmin} onClose={() => setAddingAdmin(null)}
    onCreated={(res) => { setAddingAdmin(null); setCredential(res); reload(); }} onExisting={(id) => { setAddingAdmin(null); setAccount(id); }} />;
  if (account) return <AccountSheet session={session} id={account} schools={schools} onClose={() => setAccount(null)} onChanged={reload} />;
  if (created) return (
    <Sheet open onClose={() => setCreated(null)} title="Đã thêm trường" subtitle="Đã lưu vào danh sách Trường học" wide
      footer={<View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Btn title="Đóng" tone="giay" onPress={() => setCreated(null)} />
        <Btn title="Thêm quản trị viên trường" icon={Plus} tone="son" onPress={() => { const id = created.school.id; setCreated(null); setAddingAdmin(id); }} testID="created-school-add-admin" />
      </View>}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <SchoolEmblem name={created.school.name} code={created.school.school_code} logoUrl={created.school.logo_url} size={48} />
          <View style={{ flex: 1 }}><Txt f="bold" size={15}>{created.school.name}</Txt><Txt size={12} color={c.muc2}>{addressText(created.school) || 'Chưa ghi địa chỉ'}</Txt></View>
        </View>
        <Inset style={{ gap: 4 }}><Txt f="bold" size={12} color={c.muc3}>Mã trường (hệ thống tự cấp)</Txt><Txt f="displayHeavy" size={26} selectable testID="created-school-code">{created.school.school_code}</Txt></Inset>
        <SchoolLinkBox link={created.school.link} />
        <Txt size={13} color={c.muc2}>Trường chưa có quản trị viên. Bấm “Thêm quản trị viên trường” để cấp tài khoản và gửi thư kích hoạt; có thể thêm sau ở mục Người dùng.</Txt>
      </View>
    </Sheet>
  );
  const cities = [{ value: '', label: 'Mọi tỉnh / thành' }, ...(data?.facets.cities ?? []).map((x) => ({ value: x, label: x }))];

  const f_city: SearchFilter = { key: 'city', label: 'Tỉnh / thành', value: city, options: cities, onChange: (v) => { setCity(v); setPage(1); } };
  const f_active: SearchFilter = { key: 'active', label: 'Trạng thái', value: active, options: [{ value: '', label: 'Tất cả' }, { value: 'true', label: 'Đang hoạt động' }, { value: 'false', label: 'Đã vô hiệu hóa' }], onChange: (v) => { setActive(v); setPage(1); } };
  const textFilter = (key: string, label: string): SearchFilter => ({ key, label, value: columnValues[key] ?? '', options: [{ value: '', label: 'Tất cả' }], custom: true, onChange: (v) => { setColumnValues((old) => ({ ...old, [key]: key === 'users' ? v.replace(/\D/g, '') : v })); setPage(1); } });
  const f_name = textFilter('name', 'Trường');
  const f_code = textFilter('code', 'Mã trường');
  const f_users = textFilter('users', 'Số người dùng');
  const f_created = textFilter('created', 'Ngày tạo');
  return (
    <Page>
      <PageHeader title="Trường học" subtitle="Thêm trường, sửa thông tin, gạt nút để vô hiệu hóa hoặc kích hoạt lại trường, xóa trường. Xóa trường là xóa luôn toàn bộ tài khoản và dữ liệu của trường." actions={<Btn title="Thêm trường" icon={Plus} tone="son" onPress={() => setCreating(true)} testID="school-add" />} />
      <SearchFilterBar placeholder="Tìm theo tên hoặc mã trường" value={q} onChange={(v) => { setQ(v); setPage(1); }} searchId="school-search"
        filters={[f_name, f_code, f_city, f_users, f_active, f_created]} />
      <ErrorNote message={error} />
      {loading && !data ? <Spinner label="Đang tải danh sách trường…" /> : null}
      {data ? (
        <>
          <DataTable paginate={false} rows={data.items} rowKey={(s) => s.id} empty="Không có trường nào khớp bộ lọc." onRowPress={(s) => setDetail(s.id)}
            columns={[
              { key: 'name', filter: f_name, label: 'Trường', flex: 2, render: (s) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><SchoolEmblem name={s.name} code={s.school_code} logoUrl={s.logo_url} size={36} /><View style={{ flex: 1 }}><NameCell main={s.name} sub={`Mã ${s.school_code}${isNewUnit(s.region) ? ` · ${s.region}` : ''}`} /></View></View> },
              { key: 'code', filter: f_code, label: 'Mã trường', render: (s) => <Txt size={13} selectable>{s.school_code}</Txt> },
              { key: 'city', filter: f_city, label: 'Tỉnh / thành', flex: 1.4, render: (s) => <Txt size={14}>{s.city || 'Chưa có'}</Txt> },
              { key: 'users', filter: f_users, label: 'Người dùng', render: (s) => <Cell main={fmt(s.users)} sub={`${s.teachers} GV · ${s.students} HS · ${s.classes} lớp`} /> },
              { key: 'status', filter: f_active, label: 'Trạng thái', render: (s) => <StatusChip kind={s.is_active ? 'on' : 'off'} text={s.is_active ? 'Hoạt động' : 'Vô hiệu hóa'} /> },
              { key: 'created', filter: f_created, label: 'Ngày tạo', render: (s) => <Txt size={13} color={c.muc2}>{dateText(s.created_at)}</Txt> },
              // ngày kết thúc = ngày vô hiệu hóa (migration 073); trường tắt từ trước khi có cột này mà không có nhật ký thì không rõ ngày
              { key: 'ended', label: 'Ngày kết thúc', render: (s) => <Txt size={13} color={c.muc2}>{s.is_active ? '—' : s.deactivated_at ? dateText(s.deactivated_at) : 'Không rõ ngày'}</Txt> },
            ]}
            actions={(s) => (<>
              <Btn title="Sửa" tone="giay" size="sm" onPress={() => setEditing(s)} />
              <Switch value={s.is_active} onChange={() => setToggling(s)} testID={`school-active-${s.id}`}
                label={s.is_active ? `${s.name} đang hoạt động. Gạt để vô hiệu hóa` : `${s.name} đã vô hiệu hóa. Gạt để kích hoạt lại`} />
              <Btn icon={Trash2} label={`Xóa ${s.name}`} tone="giay" size="sm" onPress={() => setRemoving(s)} />
            </>)} />
          <Pager page={page} limit={size} total={data.total} onPage={setPage} />
        </>
      ) : null}

      {creating ? (
        <FormSheet title="Thêm trường" subtitle="Chọn trường trong danh mục; mã trường do hệ thống tự cấp. Quản trị viên trường thêm sau khi tạo trường." submitLabel="Tạo trường" wide
          fields={CREATE_FIELDS(token)}
          onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            if (String(v.name).trim().length < 2) throw new Error('Hãy gõ tên trường rồi chọn trong danh sách gợi ý, hoặc tự nhập tên trường.');
            if (!String(v.city ?? '').trim()) throw new Error('Hãy chọn tỉnh / thành phố của trường.');
            const body: Record<string, unknown> = { directory_code: v.directory_code || undefined };
            for (const name of PLACE_KEYS) if (String(v[name] ?? '').trim() && !(name === 'region' && !isNewUnit(String(v.region)))) body[name] = String(v[name]).trim();
            const res = await api.createSchool(token, body);
            setCreating(false);
            setCreated(res);
            reload();
          }} />
      ) : null}
      {editing ? (
        <FormSheet title="Sửa thông tin trường" subtitle="Chọn đúng trường trong danh mục để liên kết logo chính thức. Mã trường do hệ thống cấp, không sửa được."
          fields={[
            { name: 'school_code', label: 'Mã trường', readOnly: true, hint: 'Hệ thống tự cấp, không sửa được.' },
            { name: 'name', label: 'Tên trường', required: true, render: (values, set) => <SchoolPicker token={token} values={values} set={set} currentDirectoryCode={editing.directory_code ?? undefined} excludeSchoolId={editing.id} /> },
            ...placeFields(token),
            { name: 'logo', label: 'Logo trường', render: () => <SchoolLogoField name={editing.name} code={editing.school_code} logoUrl={editing.logo_url}
              upload={(data) => api.uploadSchoolLogo(token, editing.id, data)} remove={() => api.removeSchoolLogo(token, editing.id)} onChanged={reload} /> },
          ]} wide
          initial={{ school_code: editing.school_code, name: editing.name, city: editing.city ?? '', region: editing.region ?? '', address: addressText(editing), street: streetPart(editing.address, editing.city) }} onClose={() => setEditing(null)}
          onSubmit={async (v) => {
            if (String(v.name).trim().length < 2) throw new Error('Tên trường cần ít nhất 2 ký tự.');
            await api.updateSchool(token, editing.id, { ...Object.fromEntries(PLACE_KEYS.map((k) => [k, String(v[k] ?? '').trim() || null])), ...(v.directory_code ? { directory_code: v.directory_code } : {}) });
            setEditing(null); reload();
          }} />
      ) : null}
      <ConfirmSheet open={!!toggling} title={toggling?.is_active ? 'Vô hiệu hóa trường' : 'Kích hoạt lại trường'} busy={busy} confirmLabel={toggling?.is_active ? 'Vô hiệu hóa' : 'Kích hoạt'} onCancel={() => setToggling(null)}
        message={toggling?.is_active ? `Toàn bộ tài khoản của ${toggling?.name} sẽ không đăng nhập được và mọi phiên hiện tại bị thu hồi. Hôm nay được ghi là ngày kết thúc của trường. Dữ liệu được giữ nguyên.` : `Cho phép tài khoản của ${toggling?.name} đăng nhập trở lại? Ngày kết thúc sẽ được xóa.`}
        onConfirm={async () => { if (toggling && (await run(() => api.updateSchool(token, toggling.id, { is_active: !toggling.is_active }), 'Đã cập nhật trạng thái trường'))) { setToggling(null); reload(); } }} />
      <ConfirmSheet open={!!removing} title="Xóa trường" busy={busy} confirmLabel="Xóa trường" onCancel={() => setRemoving(null)}
        message={removing ? `Xóa ${removing.name} cùng toàn bộ dữ liệu đang sử dụng của trường: ${removing.users} tài khoản (${removing.admins} quản trị viên, ${removing.teachers} giáo viên, ${removing.students} học sinh), ${removing.classes} lớp, năm học, nội dung và tiến độ học. Bản dữ liệu đã xóa được lưu riêng một năm để kiểm tra rồi tự xóa; chưa có chức năng khôi phục trên giao diện. Nếu chỉ muốn tạm dừng, hãy chọn Vô hiệu hóa.` : ''}
        onConfirm={async () => { if (removing) { await run(() => api.deleteSchool(token, removing.id).then(() => true), 'Đã xóa trường và toàn bộ dữ liệu của trường').then((ok) => { if (ok) { setRemoving(null); reload(); } else setRemoving(null); }); } }} />
      {detail ? <SchoolDetailSheet session={session} id={detail} onClose={() => setDetail(null)} onChanged={reload} /> : null}
    </Page>
  );
};

/** Khu vực của một trường trong danh mục: phường / xã mới khi biết, không thì quận / huyện cũ (ghi rõ là cũ) để phân biệt các trường trùng tên */
const directoryPlace = (r: SchoolDirectoryItem): string => [r.region ?? (r.district ? `${r.district} (cũ)` : null), r.city].filter(Boolean).join(' · ');

/** Ô tên trường kèm gợi ý từ danh mục: bấm một trường thì tên, mã, tỉnh/thành, khu vực tự điền, huy hiệu hiện ngay và đường dẫn riêng được báo trước */
const SchoolPicker: React.FC<{ token: string; values: Record<string, string | string[]>; set: (name: string, value: string | string[]) => void; currentDirectoryCode?: string; excludeSchoolId?: number }> = ({ token, values, set, currentDirectoryCode, excludeSchoolId }) => {
  const { c } = useTheme();
  const name = String(values.name ?? '');
  const query = useDebounced(name.trim(), 250);
  const [picked, setPicked] = useState<SchoolDirectoryItem | null>(null);
  const [results, setResults] = useState<SchoolDirectoryItem[]>([]);
  const [duplicates, setDuplicates] = useState<SchoolDuplicate[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const justPicked = picked !== null && name === picked.name;

  useEffect(() => {
    if (justPicked) { setResults([]); setState('idle'); return undefined; }
    let live = true;
    setState('loading');
    api.searchSchoolDirectory(token, query, excludeSchoolId).then((res) => { if (live) { setResults(res.items); setDuplicates(res.duplicates ?? []); setState('idle'); } }).catch(() => { if (live) { setResults([]); setDuplicates([]); setState('failed'); } });
    return () => { live = false; };
  }, [token, query, justPicked, excludeSchoolId]);

  const choose = (item: SchoolDirectoryItem) => {
    setPicked(item);
    setResults([]);
    set('name', item.name);
    set('directory_code', item.code);
    set('region', item.region ?? '');
    set('city', item.city);
    set('street', item.street ?? '');
    set('district', item.district ?? '');
    set('suggested_region', item.suggested_region ?? '');
    // địa chỉ tự cập nhật theo trường đã chọn: địa chỉ dạng mới của danh mục, không có thì ghép đường + phường / xã + tỉnh / thành
    set('address', item.address ?? composeAddress(item.street, item.region, item.city));
  };
  const code = String(values.directory_code ?? '');

  return (
    <View style={{ gap: 8 }}>
      <Field label="Tên trường *" value={name} nativeID="field-name"
        onChangeText={v => { set('name', v); set('directory_code', ''); if (picked) { setPicked(null); for (const k of ['city', 'region', 'address', 'street', 'district', 'suggested_region']) set(k, ''); } }} autoCapitalize="words" />
      {duplicates.length ? (
        <View testID="school-duplicate"><Inset style={{ gap: 4, backgroundColor: c.vangNhat }}>
          <Txt f="bold" size={13} color={c.vangChu}>Trường này đã có trong hệ thống, đừng tạo thêm</Txt>
          {duplicates.slice(0, 3).map((d) => <Txt key={d.id} size={13} color={c.muc}>{d.name} · mã {d.school_code}{d.region || d.city ? ` · ${[d.region, d.city].filter(Boolean).join(', ')}` : ''}{d.directory_code ? '' : ' (chưa liên kết danh mục)'}</Txt>)}
          {excludeSchoolId ? null : <Txt size={12} color={c.muc2}>Mở trường đó trong danh sách, bấm “Sửa” và chọn đúng trường trong danh mục để dùng logo chính thức.</Txt>}
        </Inset></View>
      ) : null}
      {state === 'loading' ? <Txt size={13} color={c.muc3}>Đang tìm trong danh mục…</Txt> : null}
      {state === 'failed' ? <Txt size={13} color={c.sonChu}>Chưa tải được danh mục. Bạn có thể nhập tên và địa chỉ của trường.</Txt> : null}
      {results.length ? (
        <ScrollView nestedScrollEnabled style={{ maxHeight: 240, borderWidth: 1, borderColor: c.adminLine, borderRadius: 8, backgroundColor: c.the }} accessibilityRole="list">
          {results.map((r) => (
            <Pressable key={r.code} accessibilityRole="button" accessibilityLabel={`Chọn ${r.name}, ${directoryPlace(r)}`} disabled={r.exists && r.code !== currentDirectoryCode} onPress={() => choose(r)} testID={`school-pick-${r.code}`}
              style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: r.exists ? 0.55 : 1, backgroundColor: pressed ? c.adminCanvas : c.the })}>
              <SchoolEmblem name={r.name} code={r.code} logoUrl={r.logo_url} size={32} />
              <View style={{ flex: 1 }}>
                <Txt f="semibold" size={14}>{r.name}</Txt>
                <Txt size={12} color={c.muc2}>{directoryPlace(r)}</Txt>
                {r.note ? <Txt size={12} color={c.vangChu}>{r.note}</Txt> : null}
              </View>
              {r.exists ? <StatusChip kind="muted" text={r.existing_code ? `Đã có · mã ${r.existing_code}` : 'Đã có trong hệ thống'} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {state === 'idle' && query.length >= 1 && !results.length && !justPicked ? <Txt size={13} color={c.muc3}>Chưa thấy trường phù hợp. Bạn có thể nhập tên và địa chỉ của trường.</Txt> : null}
      {justPicked ? (
        <Inset style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <SchoolEmblem name={name} code={code} logoUrl={picked.logo_url} size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt f="semibold" size={14}>{name}</Txt>
            <Txt size={12} color={c.muc2}>{directoryPlace(picked)}</Txt>
            {!picked.logo_url && !schoolLogoUrl(code) ? <Txt size={12} color={c.muc3}>Chưa có logo chính thức</Txt> : null}
          </View>
        </Inset>
      ) : null}
    </View>
  );
};

const SchoolDetailSheet: React.FC<{ session: Session; id: number; onClose: () => void; onChanged?: () => void }> = ({ session, id, onClose, onChanged }) => {
  const { c } = useTheme();
  const { data, error, reload } = useLoad(() => api.getSchool(session.token, id), [id], session.expired);
  const { busy, run } = useAction(session.expired);
  // trường nhập tay chưa gắn danh mục: tìm bản ghi danh mục cùng tên và tỉnh/thành để dùng logo chính thức (chỉ liên kết, giữ nguyên tên, khu vực, đường dẫn riêng)
  const match = useLoad(() => (data && !data.directory_code ? api.searchSchoolDirectory(session.token, data.name, data.id) : Promise.resolve(null)), [data?.id, data?.directory_code, data?.name], session.expired);
  const suggestions = (match.data?.items ?? []).filter((item) => item.matches_school && !item.exists);
  return (
    <Sheet open onClose={onClose} title={data?.name ?? 'Trường học'} subtitle={data ? `Mã ${data.school_code}${data.city ? ` · ${data.city}` : ''}` : undefined} wide>
      <ErrorNote message={error} />
      {!data && !error ? <Spinner label="Đang tải…" /> : null}
      {data ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <SchoolEmblem name={data.name} code={data.school_code} logoUrl={data.logo_url} size={56} />
            <Txt size={13} color={c.muc2} style={{ flex: 1 }}>{placeText(data.region, data.city) || 'Chưa ghi khu vực'}</Txt>
          </View>
          <SchoolLinkBox link={data.link} />
          {suggestions.map((item) => (
            <View key={item.code} testID={`school-link-suggestion-${item.code}`}><Inset style={{ gap: 8 }}>
              <Txt f="bold" size={14}>Trường này khớp danh mục, dùng logo chính thức?</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <SchoolEmblem name={item.name} code={item.code} logoUrl={item.logo_url} size={48} />
                <View style={{ flex: 1 }}>
                  <Txt f="semibold" size={14}>{item.name}</Txt>
                  <Txt size={12} color={c.muc2}>{directoryPlace(item)} · mã danh mục {item.code}</Txt>
                  {!item.logo_url && !schoolLogoUrl(item.code) ? <Txt size={12} color={c.muc3}>Danh mục chưa có logo cho trường này</Txt> : null}
                </View>
              </View>
              <Txt size={12} color={c.muc2}>Chỉ liên kết với danh mục để lấy logo; tên, khu vực, mã {data.school_code} và đường dẫn riêng của trường giữ nguyên.</Txt>
              <Btn title="Dùng logo chính thức" tone="son" size="sm" disabled={busy} testID={`school-link-apply-${item.code}`}
                onPress={async () => { if (await run(() => api.updateSchool(session.token, data.id, { directory_code: item.code, link_only: true }), 'Đã liên kết danh mục và đổi logo')) { reload(); onChanged?.(); } }} />
            </Inset></View>
          ))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StatusChip kind={data.is_active ? 'on' : 'off'} text={data.is_active ? 'Đang hoạt động' : 'Đã vô hiệu hóa'} />
            <StatusChip kind="info" text={`${data.counts.teachers} giáo viên`} />
            <StatusChip kind="info" text={`${data.counts.students} học sinh`} />
            <StatusChip kind="info" text={`${data.counts.classes} lớp`} />
            <StatusChip kind={data.current_year ? 'on' : 'warn'} text={data.current_year ? `Năm học ${data.current_year.label}` : 'Chưa kích hoạt năm học'} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {[['Địa chỉ', addressText(data)], ['Phường / xã / đặc khu', isNewUnit(data.region) ? data.region : null], ['Tỉnh / thành phố', data.city], ['Ngày tạo', dateText(data.created_at)],
              ...(data.is_active ? [] : [['Ngày kết thúc', data.deactivated_at ? dateText(data.deactivated_at) : 'Không rõ ngày']])].map(([k, v]) => (
              <View key={k as string} style={{ flexBasis: k === 'Địa chỉ' ? '100%' : 200, flexGrow: 1 }}><Txt f="bold" size={12} color={c.muc3}>{k}</Txt><Txt size={14} selectable>{(v as string | null) || 'Chưa có'}</Txt></View>
            ))}
          </View>
          {isOldDistrict(data.region) ? <Inset style={{ backgroundColor: c.vangNhat }}><Txt size={13} color={c.vangChu}>Trường đang lưu khu vực cũ “{data.region}”. Từ 01/07/2025 không còn quận / huyện: bấm “Sửa” ở danh sách để chọn phường / xã mới.</Txt></Inset> : null}
          <Txt f="bold" size={14}>Quản trị viên trường học</Txt>
          {data.admins.length ? data.admins.map((a) => (
            <Inset key={a.id} style={{ gap: 2 }}><NameCell main={`${a.full_name}${a.is_active ? '' : ' (đã khóa)'}`} sub={a.username} /><Txt size={13} color={c.muc2}>{a.email || 'chưa có email'} · đăng nhập lần cuối: {dateText(a.last_login_at)}</Txt></Inset>
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
  const [columnValues, setColumnValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const size = usePageSize();
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useLoad(() => api.listUsers(token, { q: dq, role: (role || undefined) as AuthRole | undefined, school_id: schoolId ? Number(schoolId) : undefined, active: (active || undefined) as 'true' | 'false' | undefined, ...columnValues, page, limit: size }),
    [token, dq, role, schoolId, active, columnValues, page, size], session.expired);
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [credential, setCredential] = useState<CreatedAccount | null>(null);
  const refresh = useCallback(() => reload(), [reload]);

  if (credential) return <CredentialSheet title="Tài khoản quản trị đã được tạo" account={{ full_name: credential.user.full_name, username: credential.user.role === 'school_admin' ? credential.user.username.toUpperCase() : credential.user.username, temporary_password: credential.temporary_password, mail: credential.mail }} onClose={() => setCredential(null)} />;
  const f_role: SearchFilter = { key: 'role', label: 'Vai trò', value: role, options: [{ value: '', label: 'Mọi vai trò' }, ...(Object.keys(ROLE_TEXT) as AuthRole[]).map((r) => ({ value: r, label: ROLE_TEXT[r] }))], onChange: (v) => { setRole(v); setPage(1); } };
  const f_school: SearchFilter = { key: 'school', label: 'Trường', value: schoolId, options: [{ value: '', label: 'Mọi trường' }, ...schools], onChange: (v) => { setSchoolId(v); setPage(1); } };
  const f_active: SearchFilter = { key: 'active', label: 'Trạng thái', value: active, options: [{ value: '', label: 'Tất cả' }, { value: 'true', label: 'Đang hoạt động' }, { value: 'false', label: 'Đã khóa' }], onChange: (v) => { setActive(v); setPage(1); } };
  const textFilter = (key: string, label: string): SearchFilter => ({ key, label, value: columnValues[key] ?? '', options: [{ value: '', label: 'Tất cả' }], custom: true, onChange: (v) => { setColumnValues((old) => ({ ...old, [key]: v })); setPage(1); } });
  const f_name = textFilter('name', 'Họ tên');
  const f_email = textFilter('email', 'Email');
  const f_last = textFilter('last', 'Đăng nhập cuối');
  return (
    <Page>
      <PageHeader title="Người dùng toàn hệ thống" subtitle="Xem, tìm, lọc; sửa, đổi vai trò, khóa/mở khóa, đặt lại mật khẩu hoặc xóa từng tài khoản." actions={<Btn title="Tạo tài khoản quản trị" icon={Plus} tone="son" onPress={() => setCreating(true)} testID="user-add" />} />
      <SearchFilterBar placeholder="Tìm theo tên, tên đăng nhập, email, mã" value={q} onChange={(v) => { setQ(v); setPage(1); }} searchId="user-search"
        filters={[f_name, f_role, f_school, f_email, f_last, f_active]} />
      <ErrorNote message={error} />
      {loading && !data ? <Spinner label="Đang tải danh sách…" /> : null}
      {data ? (
        <>
          <DataTable paginate={false} rows={data.items} rowKey={(u) => u.id} empty="Không có người dùng nào khớp bộ lọc." onRowPress={(u) => setOpen(u.id)}
            columns={[
              { key: 'name', filter: f_name, label: 'Họ tên', flex: 1.8, minWidth: 165, render: (u) => <NameCell main={u.full_name} sub={u.username} /> },
              { key: 'role', filter: f_role, label: 'Vai trò', flex: 1.5, render: (u) => <Cell main={ROLE_TEXT[u.role]} sub={u.role === 'root_admin' ? `Cấp ${u.admin_level}` : null} /> },
              { key: 'school', filter: f_school, label: 'Trường', flex: 1.4, render: (u) => <Txt size={14}>{u.school_name || '—'}</Txt> },
              { key: 'email', filter: f_email, label: 'Email', flex: 1.5, render: (u) => <Txt size={13} color={c.muc2} numberOfLines={2}>{u.email || 'Chưa có'}</Txt> },
              { key: 'last', filter: f_last, label: 'Đăng nhập cuối', render: (u) => <Txt size={13} color={c.muc2}>{dateText(u.last_login_at)}</Txt> },
              { key: 'status', filter: f_active, label: 'Trạng thái', render: (u) => <StatusChip kind={u.is_active ? 'on' : 'off'} text={u.is_active ? 'Hoạt động' : 'Đã khóa'} /> },
            ]} />
          <Pager page={page} limit={size} total={data.total} onPage={setPage} />
        </>
      ) : null}
      {open ? <AccountSheet session={session} id={open} schools={schools} onClose={() => setOpen(null)} onChanged={refresh} /> : null}
      {creating ? <CreateSchoolAdminSheet session={session} onClose={() => setCreating(false)}
        onCreated={res => { setCreating(false); setCredential(res); reload(); }}
        onExisting={id => { setCreating(false); setOpen(id); }} /> : null}
    </Page>
  );
};
